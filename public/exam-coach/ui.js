// Exam Coach — pure rendering functions: they take plain objects and return DOM elements.
// No Firebase imports, so the tests import this module directly. All text goes in through textContent.

const CONFIDENCE = ["high", "medium", "low"];

const FUNCTION_ERRORS = {
  "unauthenticated": "Please sign in again",
  "permission-denied": "This account is not allowed",
  "resource-exhausted": "Too many requests, try again shortly",
  "unavailable": "Service unavailable, try again shortly",
  "deadline-exceeded": "It took too long, try again",
  "internal": "Something went wrong, try again",
  "invalid-argument": "Photo not accepted, take it again",
  "not-found": "Question not found, take a new photo",
  "failed-precondition": "Not available any more, take a new photo",
  "image/unreadable": "Could not read this image, try another photo",
};
const SECURITY_CHECK_FAILED = "Security check failed: reload the page";

const AUTH_ERRORS = {
  "auth/invalid-credential": "Wrong email or password",
  "auth/invalid-login-credentials": "Wrong email or password",
  "auth/wrong-password": "Wrong email or password",
  "auth/user-not-found": "Wrong email or password",
  "auth/invalid-email": "Email not valid",
  "auth/missing-password": "Enter the password",
  "auth/too-many-requests": "Too many attempts, try again later",
  "auth/network-request-failed": "No connection, try again",
  "auth/user-disabled": "Account disabled",
};

// ---------- formatters ----------

export function formatLetters(answers) {
  return (answers || []).map((a) => String(a).toUpperCase()).join(" · ");
}

export function formatSeconds(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  return `${(ms / 1000).toFixed(1)} s`;
}

export function modelLabel(model) {
  const m = String(model || "");
  for (const name of ["Opus", "Fable", "Sonnet", "Haiku"]) {
    if (m.toLowerCase().includes(name.toLowerCase())) return name;
  }
  return m;
}

export function confidenceLabel(confidence) {
  const c = CONFIDENCE.includes(confidence) ? confidence : "low";
  return `${c[0].toUpperCase()}${c.slice(1)} confidence`;
}

export function domainLabel(domain, title) {
  if (!domain) return "";
  return title ? `Domain ${domain} · ${title}` : `Domain ${domain}`;
}

/**
 * English message for a callable or Firestore error.
 * @param {object} err error with a code ("functions/unavailable", "permission-denied", ...)
 * @param {{signedIn?: boolean}} [options] signedIn: the page has a user, so "unauthenticated" comes from a failed
 *   App Check token, not from the sign-in
 */
export function errorMessage(err, { signedIn = false } = {}) {
  const code = String((err && err.code) || "").replace(/^(functions|firestore)\//, "");
  if (code === "unauthenticated" && signedIn) return SECURITY_CHECK_FAILED;
  return FUNCTION_ERRORS[code] || "Something went wrong, try again";
}

export function authErrorMessage(err) {
  const code = String((err && err.code) || "");
  return AUTH_ERRORS[code] || "Sign-in failed, try again";
}

// ---------- data ----------

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

// Letters sorted and without duplicates; each option text stays with its letter when the two lists pair up.
// pairedHint is the server's textsPaired: false means the model gave a different number of texts and letters, so
// the texts belong to no letter even when the counts now match (duplicate letters removed by the engine).
function sortAnswers(letters, texts, pairedHint) {
  const paired = pairedHint !== false && texts.length === letters.length;
  const seen = new Set();
  const rows = [];
  letters.forEach((letter, i) => {
    if (!letter || seen.has(letter)) return;
    seen.add(letter);
    rows.push({ letter, text: paired ? texts[i] : "" });
  });
  rows.sort((a, b) => a.letter.localeCompare(b.letter));
  return {
    answers: rows.map((r) => r.letter),
    answerTexts: paired ? rows.map((r) => r.text) : texts,
    textsPaired: paired && rows.length > 0,
  };
}

/**
 * One shape for every answer the page shows: the callable response, a Firestore log document (fields flat or
 * nested under "answer"/"result") or an already normalized object. Accepts camelCase and the schema's snake_case.
 * @param {object} raw
 * @return {object} {logId, mode, examId, packVersion, previousLogId, questionStem, requiredCount, answers,
 *   answerTexts, textsPaired, explanation, citations, confidence, domain, domainTitle, exactMatch, conflictNote,
 *   readIssue, latencyMs, model, fellBack, createdAt, deep}
 */
export function normalizeResult(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const nested = [src.answer, src.result].find((x) => x && typeof x === "object" && !Array.isArray(x));
  const r = nested ? { ...src, ...nested } : src;
  const get = (...keys) => {
    for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
    return undefined;
  };
  const text = (...keys) => String(get(...keys) || "").trim();
  const pairedHint = get("textsPaired", "texts_paired");
  const { answers, answerTexts, textsPaired } = sortAnswers(
      toArray(get("answers")).map((a) => String(a ?? "").trim().toUpperCase()),
      toArray(get("answerTexts", "answer_texts")).map((t) => String(t ?? "").trim()),
      pairedHint === undefined ? undefined : Boolean(pairedHint),
  );
  const confidence = text("confidence").toLowerCase();
  const latency = Number(get("latencyMs", "latency_ms"));
  return {
    logId: text("logId", "log_id", "id"),
    mode: text("mode") || "answer",
    examId: text("examId", "exam_id"),
    packVersion: text("packVersion", "pack_version"),
    previousLogId: text("previousLogId", "previous_log_id"),
    questionStem: text("questionStem", "question_stem"),
    requiredCount: Number(get("requiredCount", "required_count")) || answers.length || 1,
    answers,
    answerTexts,
    textsPaired,
    explanation: text("explanation"),
    citations: toArray(get("citations")).map((c) => String(c).trim()).filter(Boolean),
    confidence: CONFIDENCE.includes(confidence) ? confidence : "low",
    domain: text("domain"),
    domainTitle: text("domainTitle", "domain_title"),
    exactMatch: Boolean(get("exactMatch", "exact_match")),
    conflictNote: text("conflictNote", "conflict_note"),
    readIssue: text("readIssue", "read_issue"),
    latencyMs: Number.isFinite(latency) && latency >= 0 ? latency : NaN,
    model: text("servedBy", "served_by", "model"),
    fellBack: Boolean(get("fellBack", "fell_back")),
    createdAt: get("createdAt", "created_at") ?? null,
    deep: src.deep && typeof src.deep === "object" ? normalizeResult(src.deep) : null,
  };
}

/** Milliseconds from a Firestore Timestamp, a Date, an ISO string or a number; 0 if none. */
export function timeOf(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

// ---------- building blocks ----------

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function button(className, action, label) {
  const b = el("button", className, label);
  b.type = "button";
  b.dataset.action = action;
  return b;
}

export function renderPill(confidence) {
  const c = CONFIDENCE.includes(confidence) ? confidence : "low";
  return el("span", `pill pill-${c}`, confidenceLabel(c));
}

function timingChip(latencyMs, model, fellBack) {
  const parts = [formatSeconds(latencyMs), modelLabel(model), fellBack ? "fallback model" : ""].filter(Boolean);
  return parts.length ? el("span", "chip", parts.join(" · ")) : null;
}

function letters(answers, extraClass) {
  const n = el("div", "letters" + (answers.length >= 3 ? " letters-many" : "") + (extraClass ? ` ${extraClass}` : ""),
      formatLetters(answers) || "—");
  n.setAttribute("aria-label", answers.length ? `Answer ${answers.join(", ")}` : "No answer");
  return n;
}

/**
 * The chosen options with their printed text: "B  Conduct an impact assessment". Paired texts keep their letter and
 * an empty one is skipped in place, so the next texts never move to the wrong letter; texts that cannot be paired
 * get a bullet instead of a letter.
 */
function answerTexts(r) {
  const rows = r.answerTexts
      .map((text, i) => ({ letter: r.textsPaired ? r.answers[i] || "" : "", text }))
      .filter((row) => row.text);
  if (!rows.length) return null;
  const list = el("ul", "options");
  for (const row of rows) {
    const li = el("li", "option");
    li.append(el("span", "option-letter", row.letter || "•"), el("span", "option-text", row.text));
    list.append(li);
  }
  return list;
}

function notes(r) {
  const out = [];
  if (r.conflictNote) {
    const p = el("p", "warn");
    p.append(el("strong", null, "Source conflict: "), r.conflictNote);
    out.push(p);
  }
  if (r.readIssue) {
    const p = el("p", "warn");
    p.append(el("strong", null, "Photo: "), r.readIssue);
    out.push(p);
  }
  return out;
}

function citations(list) {
  if (!list.length) return null;
  const box = el("div", "citations");
  box.setAttribute("aria-label", "Sources");
  for (const c of list) box.append(el("span", "citation", c));
  return box;
}

// ---------- views ----------

/** Answer card: big letters, confidence, option texts, explanation, sources, meta and the actions. */
export function renderResult(raw) {
  const r = normalizeResult(raw);
  const root = el("section", "result");
  root.dataset.logId = r.logId;

  const head = el("div", "result-head");
  head.append(letters(r.answers), renderPill(r.confidence));
  root.append(head);

  if (r.requiredCount > 1) root.append(el("p", "choose", `Select ${r.requiredCount}`));
  const options = answerTexts(r);
  if (options) root.append(options);
  if (r.explanation) root.append(el("p", "reasoning", r.explanation));
  root.append(...notes(r));
  const cites = citations(r.citations);
  if (cites) root.append(cites);

  const meta = el("div", "meta");
  if (r.exactMatch) meta.append(el("span", "badge", "Known question"));
  if (r.domain) meta.append(el("span", "chip", domainLabel(r.domain, r.domainTitle)));
  const timing = timingChip(r.latencyMs, r.model, r.fellBack);
  if (timing) meta.append(timing);
  if (meta.childElementCount) root.append(meta);

  if (r.questionStem) root.append(el("p", "stem", `Read as: “${r.questionStem}…”`));

  const actions = el("div", "actions");
  actions.append(
      button("btn btn-primary btn-deep", "deep", "Deep review"),
      button("btn", "doubtful", "Mark as doubtful"),
      button("btn", "new", "New question"),
  );
  root.append(actions, el("div", "deep-slot"));
  return root;
}

/** Deep review under the answer: "Confirmed" or "Changes to X · Y", with the longer explanation. */
export function renderDeep(rawDeep, rawFast) {
  const deep = normalizeResult(rawDeep);
  const fast = rawFast ? normalizeResult(rawFast) : null;
  const root = el("section", "deep");
  const shown = formatLetters(deep.answers);
  // The letters decide: the same letters as the first answer confirm it, anything else is a change.
  const confirmed = Boolean(fast) && shown !== "" && shown === formatLetters(fast.answers);

  root.append(el("p", "deep-label", "Deep review"));
  const head = el("div", "result-head");
  head.append(el("div", "deep-head " + (confirmed ? "ok" : "change"), confirmed ? "Confirmed" : `Changes to ${shown || "—"}`));
  head.append(renderPill(deep.confidence));
  root.append(head);

  if (!confirmed) {
    if (deep.requiredCount > 1) root.append(el("p", "choose", `Select ${deep.requiredCount}`));
    const options = answerTexts(deep);
    if (options) root.append(options);
  }
  if (deep.explanation) root.append(el("p", "reasoning", deep.explanation));
  root.append(...notes(deep));
  const cites = citations(deep.citations);
  if (cites) root.append(cites);

  const meta = el("div", "meta");
  if (deep.domain && (!fast || deep.domain !== fast.domain)) meta.append(el("span", "chip", domainLabel(deep.domain, deep.domainTitle)));
  const timing = timingChip(deep.latencyMs, deep.model, deep.fellBack);
  if (timing) meta.append(timing);
  if (meta.childElementCount) root.append(meta);
  return root;
}

/**
 * Waiting row with a spinner and a seconds counter (updated by the caller). The counter is hidden from assistive
 * technology: the live region announces the label, not every tick.
 */
export function renderBusy(label) {
  const root = el("div", "busy");
  root.setAttribute("role", "status");
  const seconds = el("span", "busy-seconds", "0 s");
  seconds.setAttribute("aria-hidden", "true");
  root.append(el("span", "spin"), el("span", "busy-label", label), seconds);
  return root;
}

/** Error row; with retry=true it adds a "New question" button. */
export function renderError(message, { detail = "", retry = false } = {}) {
  const frag = document.createDocumentFragment();
  const box = el("p", "error", message);
  box.setAttribute("role", "alert");
  if (detail && detail !== message) box.append(el("span", "error-detail", detail));
  frag.append(box);
  if (retry) {
    const actions = el("div", "actions");
    const b = button("btn btn-primary btn-wide", "new", "New question");
    actions.append(b);
    frag.append(actions);
  }
  return frag;
}

// ---------- doubtful list ----------

/** Short date and time from a Firestore Timestamp, a Date, an ISO string or a number. */
export function formatWhen(value) {
  const t = timeOf(value);
  if (!t) return "";
  return new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function doubtfulCountText(n) {
  return n === 1 ? "1 doubtful question" : `${n} doubtful questions`;
}

/**
 * Doubtful log documents → one entry per question, newest first. A deep review logged as its own document
 * (mode "deep", previousLogId) is attached to its answer when that is in the list too; ids lists every log document
 * the entry stands for, so "Not doubtful" clears them all.
 * @param {object[]} items raw or normalized documents
 * @return {object[]} normalized entries with ids
 */
export function groupDoubtful(items) {
  const list = toArray(items).map((it) => ({ ...normalizeResult(it), ids: [] }));
  const byId = new Map(list.filter((it) => it.logId).map((it) => [it.logId, it]));
  const out = [];
  for (const it of list) {
    const parent = it.mode === "deep" && it.previousLogId ? byId.get(it.previousLogId) : null;
    if (parent && parent !== it) {
      if (!parent.deep || timeOf(it.createdAt) >= timeOf(parent.deep.createdAt)) parent.deep = it;
      parent.ids.push(it.logId);
      continue;
    }
    if (it.logId) it.ids.unshift(it.logId);
    out.push(it);
  }
  return out.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
}

/** One doubtful question: answer, deep review if any, and the actions (photo, not doubtful). */
export function renderDoubtfulItem(entry) {
  const item = entry && Array.isArray(entry.ids) ? entry : { ...normalizeResult(entry), ids: [] };
  if (!item.ids.length && item.logId) item.ids.push(item.logId);
  const root = el("article", "result doubtful-item");
  root.dataset.logId = item.logId;
  root.dataset.logIds = item.ids.join(",");

  const top = el("div", "meta");
  const when = formatWhen(item.createdAt);
  if (when) top.append(el("span", "chip", when));
  if (item.domain) top.append(el("span", "chip", domainLabel(item.domain, item.domainTitle)));
  if (item.exactMatch) top.append(el("span", "badge", "Known question"));
  if (top.childElementCount) root.append(top);

  if (item.questionStem) root.append(el("p", "doubtful-stem", `${item.questionStem}…`));

  const head = el("div", "result-head");
  const answer = el("div", "doubtful-answer");
  answer.append(el("span", "deep-label", item.mode === "deep" ? "Deep review" : "Answer"), letters(item.answers, "letters-small"));
  head.append(answer, renderPill(item.confidence));
  root.append(head);
  const options = answerTexts(item);
  if (options) root.append(options);
  if (item.explanation) root.append(el("p", "reasoning", item.explanation));
  root.append(...notes(item));

  if (item.deep) root.append(renderDeep(item.deep, item));

  root.append(el("div", "doubtful-photo"));
  const actions = el("div", "actions");
  actions.append(button("btn", "photo", "Show photo"), button("btn", "undoubt", "Not doubtful"));
  root.append(actions);
  return root;
}

/** The whole list, newest first; an empty list shows a message. */
export function renderDoubtfulList(items) {
  const frag = document.createDocumentFragment();
  const entries = groupDoubtful(items);
  if (!entries.length) {
    frag.append(el("p", "hint doubtful-empty", "No questions marked as doubtful."));
    return frag;
  }
  frag.append(el("p", "hint doubtful-count", doubtfulCountText(entries.length)));
  for (const it of entries) frag.append(renderDoubtfulItem(it));
  return frag;
}
