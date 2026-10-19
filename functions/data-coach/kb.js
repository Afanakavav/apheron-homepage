"use strict";
/**
 * Data Coach: caricatore della base di conoscenza dal bucket privato gs://apheron-homepage-data-coach.
 *
 * Nessun dato d'esame vive in questo repository: compendio, glossario, registro compatto e capitoli dei manuali
 * stanno nel bucket, in kb/<versione>/..., e kb/current.json indica la versione in uso. I testi vengono tenuti in
 * memoria a livello di modulo, cosi' sopravvivono tra le invocazioni della stessa istanza; i capitoli (usati solo
 * dalla via lenta) si caricano uno per uno, alla prima richiesta.
 */

const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const {SECTION_SLUGS} = require("./prompt");

const BUCKET = "apheron-homepage-data-coach";
const CURRENT_PATH = "kb/current.json";
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** Cache a livello di modulo: {version, updatedAt, compendium, glossary, registry, chaptersByIndex, loadedAt}. */
let cache = null;
/** Caricamento in corso, condiviso tra richieste concorrenti: {version, promise}. */
let inflight = null;

/**
 * @return {object} il bucket privato della base di conoscenza
 */
function bucket() {
  return getStorage().bucket(BUCKET);
}

/**
 * Scarica un oggetto di testo dal bucket.
 * @param {string} objectPath percorso dentro il bucket
 * @return {Promise<string>} contenuto UTF-8
 */
async function readText(objectPath) {
  const [buf] = await bucket().file(objectPath).download();
  return buf.toString("utf8");
}

/**
 * Legge kb/current.json e ne valida la forma.
 * @return {Promise<{version: string, updatedAt: string}>} versione corrente
 */
async function readCurrent() {
  const obj = JSON.parse(await readText(CURRENT_PATH));
  if (!obj || typeof obj.version !== "string" || !VERSION_RE.test(obj.version)) {
    throw new Error("kb/current.json non valido: manca una versione");
  }
  return {version: obj.version, updatedAt: String(obj.updatedAt || "")};
}

/**
 * Percorso di un capitolo dei manuali dentro il bucket.
 * @param {string} version versione della base di conoscenza
 * @param {number} index indice di sezione 1..6
 * @return {string} percorso, es. kb/v1/chapters/sec4-harmonization.md
 */
function chapterPath(version, index) {
  const slug = SECTION_SLUGS[index - 1];
  if (!slug) throw new Error(`Indice di sezione non valido: ${index}`);
  return `kb/${version}/chapters/sec${index}-${slug}.md`;
}

/**
 * Scarica i tre testi fissi di una versione.
 * @param {{version: string, updatedAt: string}} current versione da caricare
 * @return {Promise<object>} base di conoscenza caricata
 */
async function loadVersion(current) {
  const base = `kb/${current.version}/`;
  const [compendium, glossary, registry] = await Promise.all([
    readText(`${base}compendium.md`),
    readText(`${base}glossary.md`),
    readText(`${base}registry-compact.txt`),
  ]);
  return {
    version: current.version,
    updatedAt: current.updatedAt,
    compendium,
    glossary,
    registry,
    chaptersByIndex: new Map(),
    loadedAt: Date.now(),
  };
}

/**
 * Garantisce che la base di conoscenza corrente sia in memoria. Legge sempre kb/current.json (un oggetto piccolo):
 * se la versione e' cambiata, o non c'e' nulla in memoria, o force e' vero, ricarica i testi. Se current.json non
 * e' leggibile ma una versione e' gia' in memoria, usa quella e lo segnala nei log.
 * @param {object} [opts] opts.force: ricarica anche se la versione non e' cambiata
 * @return {Promise<{kb: object, warm: boolean, loadMs: number}>} warm: la versione giusta era gia' in memoria
 */
async function ensureKb(opts = {}) {
  const t0 = Date.now();
  const force = Boolean(opts.force);
  let current;
  try {
    current = await readCurrent();
  } catch (err) {
    if (cache && !force) {
      logger.warn("dataCoach kb: current.json non leggibile, uso la versione in memoria", {
        version: cache.version, error: String(err && err.message),
      });
      return {kb: cache, warm: true, loadMs: Date.now() - t0};
    }
    throw err;
  }
  if (cache && cache.version === current.version && !force) {
    return {kb: cache, warm: true, loadMs: Date.now() - t0};
  }
  if (!inflight || inflight.version !== current.version || force) {
    const promise = loadVersion(current).then((kb) => {
      cache = kb;
      logger.info("dataCoach kb: caricata", {
        version: kb.version, ms: Date.now() - t0,
        bytes: kb.compendium.length + kb.glossary.length + kb.registry.length,
      });
      return kb;
    }).finally(() => {
      if (inflight && inflight.promise === promise) inflight = null;
    });
    inflight = {version: current.version, promise};
  }
  let kb;
  try {
    kb = await inflight.promise;
  } catch (err) {
    // Versione nuova non leggibile (file mancanti): meglio servire la versione in memoria che fermarsi.
    if (cache && !force) {
      logger.error("dataCoach kb: versione nuova non caricabile, resto sulla versione in memoria", {
        wanted: current.version, inMemory: cache.version, error: String(err && err.message),
      });
      return {kb: cache, warm: true, loadMs: Date.now() - t0, stale: true};
    }
    throw err;
  }
  return {kb, warm: false, loadMs: Date.now() - t0};
}

/**
 * @return {object|null} la base di conoscenza in memoria, se gia' caricata
 */
function getKb() {
  return cache;
}

/**
 * Carica (una volta per istanza e versione) il capitolo dei manuali di una sezione.
 * @param {number} index indice di sezione 1..6
 * @return {Promise<{index: number, slug: string, path: string, text: string}>} capitolo
 */
async function loadChapter(index) {
  if (!cache) await ensureKb();
  const kb = cache;
  const objectPath = chapterPath(kb.version, index);
  if (!kb.chaptersByIndex.has(index)) {
    kb.chaptersByIndex.set(index, readText(objectPath).catch((err) => {
      kb.chaptersByIndex.delete(index);
      throw err;
    }));
  }
  const text = await kb.chaptersByIndex.get(index);
  return {index, slug: SECTION_SLUGS[index - 1], path: objectPath, text};
}

/**
 * Svuota la cache (solo per i test).
 */
function resetKb() {
  cache = null;
  inflight = null;
}

module.exports = {BUCKET, CURRENT_PATH, ensureKb, getKb, loadChapter, chapterPath, resetKb};
