"use strict";
/**
 * Exam Coach: loader of the exam packs from the private bucket gs://apheron-homepage-exam-coach.
 *
 * No exam material lives in this repository. For each exam id the bucket holds:
 *   packs/<examId>/current.json              {"version": "<version>", "updatedAt": "<ISO date>"}
 *   packs/<examId>/<version>/pack.json       pack configuration (domains, cite formats, "production" settings)
 *   packs/<examId>/<version>/kb.md           knowledge-base text of the production context configuration
 *   packs/<examId>/<version>/manifest.json   optional build manifest of kb.md ({pack, config, sha256, ...}, written
 *                                            by the lab's 03-build-kb.js next to kb.md)
 *   packs/<examId>/<version>/registry.txt    optional compact registry of practice questions
 * The texts stay in memory at module level, so they survive between invocations on the same instance.
 * current.json (a few bytes) is read on every call, so a new version is picked up without a redeploy; a version
 * that cannot be loaded never replaces the one already in memory, and is not downloaded again for
 * FAILURE_MEMO_MS (the version in memory, if any, is served meanwhile).
 * When manifest.json is present, kb.md must match it (sha256) and manifest.config must equal
 * pack.production.config, so the deployed knowledge base is the declared context configuration.
 */

const crypto = require("crypto");
const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");

const BUCKET = "apheron-homepage-exam-coach";
/** Exam ids the callables accept (one pack each in the bucket). */
const ALLOWED_EXAMS = ["aigp"];
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** How long a version that failed to load is not downloaded again (per exam and version). */
const FAILURE_MEMO_MS = 60000;

/**
 * In-memory packs: examId -> {examId, version, updatedAt, pack, kbText, registryText, manifestConfig, chars,
 * loadedAt}.
 */
const cache = new Map();
/** Loads in progress, shared by concurrent requests: examId -> {version, promise}. */
const inflight = new Map();
/** Last failed load per exam: examId -> {version, at, error}. */
const failures = new Map();

/**
 * The files of a pack version are present but not valid (bad JSON, wrong id, empty kb.md, kb.md that does not
 * match its manifest or the declared production configuration): retrying soon would not help.
 */
class PackInvalidError extends Error {
  /**
   * @param {string} message what is wrong
   */
  constructor(message) {
    super(message);
    this.name = "PackInvalidError";
  }
}

/**
 * @return {object} the private bucket of the packs
 */
function bucket() {
  return getStorage().bucket(BUCKET);
}

/**
 * @param {*} examId value to check
 * @return {boolean} true if examId is one of ALLOWED_EXAMS
 */
function isAllowedExam(examId) {
  return typeof examId === "string" && ALLOWED_EXAMS.includes(examId);
}

/**
 * @param {string} examId exam id
 * @return {string} object prefix of the exam's packs, e.g. packs/aigp/
 */
function packPrefix(examId) {
  return `packs/${examId}/`;
}

/**
 * Downloads a text object from the bucket.
 * @param {string} objectPath path inside the bucket
 * @return {Promise<string>} UTF-8 content
 */
async function readText(objectPath) {
  const [buf] = await bucket().file(objectPath).download();
  return buf.toString("utf8");
}

/**
 * @param {Error} err error from Cloud Storage
 * @return {boolean} true when the object does not exist
 */
function isNotFound(err) {
  return Number(err && err.code) === 404;
}

/**
 * Downloads a text object that may be missing.
 * @param {string} objectPath path inside the bucket
 * @return {Promise<string|null>} content, or null if the object does not exist
 */
async function readOptionalText(objectPath) {
  try {
    return await readText(objectPath);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/**
 * Reads packs/<examId>/current.json and checks its shape.
 * @param {string} examId exam id
 * @return {Promise<{version: string, updatedAt: string}>} current version
 */
async function readCurrent(examId) {
  const objectPath = `${packPrefix(examId)}current.json`;
  let obj;
  try {
    obj = JSON.parse(await readText(objectPath));
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error(`${objectPath} is not valid JSON`);
    throw err;
  }
  if (!obj || typeof obj.version !== "string" || !VERSION_RE.test(obj.version)) {
    throw new Error(`${objectPath} has no valid version`);
  }
  return {version: obj.version, updatedAt: String(obj.updatedAt || "")};
}

/**
 * Checks kb.md against its build manifest and the pack's declared production configuration.
 * @param {string} base object prefix of the version
 * @param {string} examId exam id
 * @param {object} pack pack.json
 * @param {string} kbText kb.md
 * @param {string} manifestText manifest.json
 * @return {string|null} configuration of kb.md according to the manifest
 */
function checkManifest(base, examId, pack, kbText, manifestText) {
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (err) {
    throw new PackInvalidError(`${base}manifest.json is not valid JSON`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new PackInvalidError(`${base}manifest.json is not an object`);
  }
  if (manifest.pack !== undefined && manifest.pack !== examId) {
    throw new PackInvalidError(`${base}manifest.json is for pack "${manifest.pack}", expected "${examId}"`);
  }
  if (typeof manifest.sha256 === "string") {
    const actual = crypto.createHash("sha256").update(kbText).digest("hex");
    if (actual !== manifest.sha256) throw new PackInvalidError(`${base}kb.md does not match manifest.json (sha256)`);
  }
  const production = pack.production && typeof pack.production === "object" ? pack.production : null;
  const declared = production && typeof production.config === "string" ? production.config : null;
  if (declared !== null && manifest.config !== declared) {
    throw new PackInvalidError(`${base}kb.md is configuration "${manifest.config}", ` +
      `pack.production.config is "${declared}"`);
  }
  return typeof manifest.config === "string" ? manifest.config : null;
}

/**
 * Downloads and checks the files of one pack version.
 * @param {string} examId exam id
 * @param {{version: string, updatedAt: string}} current version to load
 * @return {Promise<object>} loaded pack
 */
async function loadVersion(examId, current) {
  const base = `${packPrefix(examId)}${current.version}/`;
  const [packText, kbText, manifestText, registryText] = await Promise.all([
    readText(`${base}pack.json`),
    readText(`${base}kb.md`),
    readOptionalText(`${base}manifest.json`),
    readOptionalText(`${base}registry.txt`),
  ]);
  let pack;
  try {
    pack = JSON.parse(packText);
  } catch (err) {
    throw new PackInvalidError(`${base}pack.json is not valid JSON`);
  }
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
    throw new PackInvalidError(`${base}pack.json is not an object`);
  }
  if (pack.id !== examId) throw new PackInvalidError(`${base}pack.json has id "${pack.id}", expected "${examId}"`);
  if (!kbText.trim()) throw new PackInvalidError(`${base}kb.md is empty`);
  const manifestConfig = manifestText === null ? null : checkManifest(base, examId, pack, kbText, manifestText);
  const registry = registryText && registryText.trim() ? registryText : null;
  return {
    examId,
    version: current.version,
    updatedAt: current.updatedAt,
    pack,
    kbText,
    registryText: registry,
    manifestConfig,
    chars: kbText.length + (registry ? registry.length : 0),
    loadedAt: Date.now(),
  };
}

/**
 * When a version could not be loaded: the version already in memory (stale), or the error.
 * @param {string} examId exam id
 * @param {string} wanted version that failed
 * @param {Error} err load error
 * @param {{t0: number, force: boolean, memo: boolean}} info start time, force flag, true if the failure is
 *   memoized from an earlier call
 * @return {{pack: object, warm: boolean, loadMs: number, stale: boolean}} the version in memory
 */
function staleOrThrow(examId, wanted, err, info) {
  const fallback = cache.get(examId);
  if (fallback && !info.force) {
    const fields = {examId, wanted, inMemory: fallback.version, error: String(err && err.message)};
    if (info.memo) {
      logger.warn("examCoach packs: version failed recently, serving the version in memory", fields);
    } else {
      logger.error("examCoach packs: new version not loadable, serving the version in memory", fields);
    }
    return {pack: fallback, warm: true, loadMs: Date.now() - info.t0, stale: true};
  }
  throw err;
}

/**
 * Makes sure the current pack of an exam is in memory. Always reads current.json: if the version changed, nothing
 * is in memory, or opts.force is true, the pack is (re)loaded; concurrent calls share one load. When current.json
 * or a new version cannot be read but a version is already in memory, that version is served and the problem is
 * logged. A version that failed is not downloaded again for FAILURE_MEMO_MS: meanwhile the version in memory is
 * served, or the same error is thrown at once (opts.force skips the memo).
 * @param {string} examId exam id from ALLOWED_EXAMS
 * @param {{force: (boolean|undefined)}} [opts] force: reload even if the version did not change
 * @return {Promise<{pack: object, warm: boolean, loadMs: number, stale: (boolean|undefined)}>} warm: the right
 *   version was already in memory; stale: a newer version exists but could not be loaded
 */
async function ensurePack(examId, opts = {}) {
  if (!isAllowedExam(examId)) throw new Error(`Unknown exam: ${examId}`);
  const t0 = Date.now();
  const force = Boolean(opts.force);
  const inMemory = cache.get(examId) || null;
  let current;
  try {
    current = await readCurrent(examId);
  } catch (err) {
    if (inMemory && !force) {
      logger.warn("examCoach packs: current.json not readable, serving the version in memory", {
        examId, version: inMemory.version, error: String(err && err.message),
      });
      return {pack: inMemory, warm: true, loadMs: Date.now() - t0, stale: true};
    }
    throw err;
  }
  if (inMemory && inMemory.version === current.version && !force) {
    return {pack: inMemory, warm: true, loadMs: Date.now() - t0};
  }
  let job = inflight.get(examId);
  if (!job || job.version !== current.version || force) {
    const failed = failures.get(examId);
    if (!force && failed && failed.version === current.version && Date.now() - failed.at < FAILURE_MEMO_MS) {
      return staleOrThrow(examId, current.version, failed.error, {t0, force, memo: true});
    }
    const promise = loadVersion(examId, current).then((loaded) => {
      cache.set(examId, loaded);
      failures.delete(examId);
      logger.info("examCoach packs: loaded", {
        examId, version: loaded.version, ms: Date.now() - t0, chars: loaded.chars,
        registry: Boolean(loaded.registryText), kbConfig: loaded.manifestConfig,
      });
      return loaded;
    }, (err) => {
      failures.set(examId, {version: current.version, at: Date.now(), error: err});
      throw err;
    }).finally(() => {
      const now = inflight.get(examId);
      if (now && now.promise === promise) inflight.delete(examId);
    });
    job = {version: current.version, promise};
    inflight.set(examId, job);
  }
  try {
    const loaded = await job.promise;
    return {pack: loaded, warm: false, loadMs: Date.now() - t0};
  } catch (err) {
    return staleOrThrow(examId, current.version, err, {t0, force, memo: false});
  }
}

/**
 * @param {string} examId exam id
 * @return {object|null} the pack in memory, if already loaded
 */
function getPack(examId) {
  return cache.get(examId) || null;
}

/**
 * Empties the in-memory packs (tests only).
 */
function resetPacks() {
  cache.clear();
  inflight.clear();
  failures.clear();
}

module.exports = {
  BUCKET, ALLOWED_EXAMS, FAILURE_MEMO_MS, PackInvalidError, isAllowedExam, packPrefix, ensurePack, getPack, resetPacks,
};
