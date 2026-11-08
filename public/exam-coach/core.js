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

// ---------- requests whose connection may be cut ----------

// How long the page waits for each kind of call, from the moment it is sent (the function's timeout is 540 s).
export const CALL_TIMEOUT_MS = { answer: 180000, warm: 560000, deep: 560000 };
// After a cut connection, the log document must show up within this time from the call (the function creates it
// before calling the model; a cold start and the pack load take a few seconds)...
export const LOG_ARRIVAL_MS = 30000;
// ...and never less than this after the failure, so a page back from the background has time to reconnect.
export const LOG_GRACE_MS = 8000;
// A wait checks the clock every second; a longer gap between two checks means the page was frozen (locked phone,
// another app), so both limits move to at least LOG_GRACE_MS after it wakes up.
export const LOG_TICK_GAP_MS = 3000;

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Id of a request and of its log document: 20 letters and digits, like a Firestore automatic id.
 * @param {{getRandomValues: function(Uint8Array): Uint8Array}} [random] crypto source (tests may pass their own)
 */
export function newRequestId(random = globalThis.crypto) {
  const bytes = random.getRandomValues(new Uint8Array(20));
  let id = "";
  // 62 symbols: bytes from 248 up are dropped and drawn again, so every symbol is equally likely.
  for (let i = 0; id.length < 20; i++) {
    if (i >= bytes.length) {
      random.getRandomValues(bytes);
      i = 0;
    }
    if (bytes[i] < 248) id += ID_CHARS[bytes[i] % 62];
  }
  return id;
}

/**
 * What a log document says about a request: still running, done (ok) or failed (error, with its code and the
 * function's own sentence, "" when the document has none).
 * @param {object|null} data document data, null when the document does not exist (yet)
 * @return {{state: string, code?: string, message?: string}} state "missing", "running", "ok" or "error"
 */
export function logOutcome(data) {
  if (!data || typeof data !== "object") return { state: "missing" };
  if (data.status === "ok") return { state: "ok" };
  if (data.status === "error") {
    const error = data.error && typeof data.error === "object" ? data.error : {};
    const code = String(error.code || "internal").replace(/^functions\//, "");
    const message = typeof error.userMessage === "string" ? error.userMessage.trim() : "";
    return {
      state: "error",
      code: /^[a-z-]+$/.test(code) ? code : "internal",
      message: message.length <= 240 ? message : "",
    };
  }
  return { state: "running" };
}

/**
 * True when a callable failed without a reply from the function: the connection was cut (iOS Safari drops a request
 * that receives nothing for about 60 s; a locked phone or a switch to another app does the same) or the page's own
 * timeout fired. The Firebase SDK then gives a bare code as the message ("internal", "deadline-exceeded"); an error
 * sent by the function always carries its own sentence.
 * @param {object} err callable error
 */
export function isCutConnection(err) {
  const code = String((err && err.code) || "").replace(/^functions\//, "");
  const message = String((err && err.message) || "").trim();
  return ["internal", "unavailable", "deadline-exceeded", "unknown"].includes(code) &&
      (message === "" || message === code || message === `functions/${code}`);
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
