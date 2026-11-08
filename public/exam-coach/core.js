// Exam Coach — pure helpers shared by boot.js, app.js and the tests: exam from the path, settings, warm-up timing.
// No DOM rendering and no Firebase. The page holds no exam content: only the exam's display name.

/** Exams served by this page: id (the path segment and the pack id on the server) → display name. */
export const EXAMS = { aigp: "IAPP AIGP" };
export const DEFAULT_EXAM = "aigp";

export const SETTINGS_KEY = "exam-coach:settings";
export const ACTIVE_KEY = "exam-coach:last-active";

// The knowledge base is cached for 1 hour and every read renews it: warm up only after 55 minutes without a call.
export const WARM_AFTER_MS = 55 * 60 * 1000;

const DEFAULT_SETTINGS = { autoDeep: true };

/**
 * Exam of the page from its path: /exam-coach/<examId>/..., default aigp for /exam-coach/.
 * @param {string} pathname location.pathname
 * @return {{id: string, name: string, known: boolean}} exam id, display name ("" if unknown) and whether it is served
 */
export function examFromPath(pathname) {
  const m = /^\/exam-coach\/([^/?#]+)/.exec(String(pathname || ""));
  let id = DEFAULT_EXAM;
  if (m && m[1] !== "index.html") {
    try { id = decodeURIComponent(m[1]).toLowerCase(); } catch (e) { id = m[1].toLowerCase(); }
  }
  const known = /^[a-z0-9-]{1,40}$/.test(id) && Object.prototype.hasOwnProperty.call(EXAMS, id);
  return { id, name: known ? EXAMS[id] : "", known };
}

/** Canonical path of an exam's page, the PWA start_url. */
export function examPath(examId) {
  return `/exam-coach/${examId}/`;
}

/**
 * True when the prompt cache may have expired: nothing recorded, the last call is 55+ minutes old, or the clock moved back.
 * @param {number} lastActiveAt time of the last successful warm-up, answer or deep review (ms)
 * @param {number} [now]
 */
export function shouldWarm(lastActiveAt, now = Date.now()) {
  if (!Number.isFinite(lastActiveAt) || lastActiveAt <= 0 || now < lastActiveAt) return true;
  return now - lastActiveAt >= WARM_AFTER_MS;
}

// ---------- localStorage (it may be missing or throw: private mode, blocked storage) ----------

function readJson(storage, key) {
  try {
    const value = JSON.parse((storage && storage.getItem(key)) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (e) {
    return {};
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/** Page settings, defaults filled in. */
export function loadSettings(storage) {
  const saved = readJson(storage, SETTINGS_KEY);
  return { autoDeep: typeof saved.autoDeep === "boolean" ? saved.autoDeep : DEFAULT_SETTINGS.autoDeep };
}

/** @return {boolean} false when the browser refused to store them */
export function saveSettings(storage, settings) {
  return writeJson(storage, SETTINGS_KEY, { autoDeep: Boolean(settings && settings.autoDeep) });
}

/** Time of the last call that read or wrote the exam's prompt cache, 0 if unknown. */
export function loadLastActive(storage, examId) {
  const v = Number(readJson(storage, ACTIVE_KEY)[examId]);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function saveLastActive(storage, examId, ms) {
  const all = readJson(storage, ACTIVE_KEY);
  all[examId] = ms;
  return writeJson(storage, ACTIVE_KEY, all);
}
