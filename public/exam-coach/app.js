// Exam Coach — glue between the page, Firebase (auth, Firestore, App Check) and the callable functions.
// Views are in index.html; rendering in ui.js; photo compression in image.js; pure helpers in core.js.

import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, updateDoc } from "/firebase-config.js?v=2"; // ?v: the shared file has a one-year cache
import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
// Same URL as in /firebase-config.js: same Firestore module instance, so the same db.
import { collection, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  examFromPath, shouldWarm, loadSettings, saveSettings, loadLastActive, saveLastActive,
  CALL_TIMEOUT_MS, LOG_ARRIVAL_MS, LOG_GRACE_MS, LOG_TICK_GAP_MS, newRequestId, logOutcome, isCutConnection,
} from "./core.js?v=2";
import { compressImage } from "./image.js?v=1";
import * as ui from "./ui.js?v=1";

const LOG_COLLECTION = "examCoachLog";
// The one field firestore.rules lets the page change on its log documents: the "doubtful" mark (v1 called it dubbia).
const FLAG_FIELD = "flagged";
const APP_CHECK_URL = "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";
// Public reCAPTCHA Enterprise site key: the same value and override as in /firebase-config.js.
const RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY || "6LffriksAAAAAKvSqVFkxt6ggpicybwvV_yVF3Jq";

const HINT_READY = "Fit the whole question and all its options in the photo, upright and without glare.";
const HINT_WARMING = "Loading the exam material: up to a minute at the start of a session. You can take the photo now.";
const HINT_WARM_FAILED = "Warm-up failed: the first answer will take longer.";
// Before the single retry of a failed warm-up: a few seconds, so a brief overload or network gap can pass.
const WARM_RETRY_MIN_MS = 3000;
const WARM_RETRY_MAX_MS = 5000;

const exam = examFromPath(location.pathname);
const storage = safeStorage();
const functions = getFunctions(getApp(), "europe-west1");
// The server keeps an answer's model time (a cold cache write included) and its log well inside 180 s: the page
// waits that long, so it never gives up on an answer that is still being paid for.
const callAnswer = httpsCallable(functions, "examCoachAnswer", { timeout: CALL_TIMEOUT_MS.answer });
// Warm-up and deep review may write the whole cached knowledge base or think longer: same function (540 s timeout),
// and the page waits a little longer than the function can run.
const callLong = httpsCallable(functions, "examCoachAnswer", { timeout: CALL_TIMEOUT_MS.deep });
const callPhoto = httpsCallable(functions, "examCoachPhoto", { timeout: 35000 });

const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  busy: false,
  thumbUrl: null,
  image: null, // compressed photo of the question on screen, sent again with the deep review
  fast: null, // normalized answer on screen
  deep: null, // its deep review, once done
  doubtful: false, // the question on screen is marked as doubtful
  warming: null, // promise of the warm-up in flight (it never rejects)
  inFlight: 0, // answers, deep reviews and warm-ups running: each reads or writes the cache, so no warm-up starts
  lastActiveAt: loadLastActive(storage, exam.id),
  packVersion: "",
  settings: loadSettings(storage),
};

function safeStorage() {
  try {
    return window.localStorage;
  } catch (e) {
    return null; // blocked storage: settings fall back to the defaults
  }
}

// ---------- views and status ----------

function showView(view) {
  document.body.dataset.view = view;
  $("login").hidden = view !== "login";
  $("coach").hidden = view !== "coach";
  $("splash").hidden = true;
}

// The pill's label is the live text; its seconds counter is aria-hidden, so a tick is never announced.
function setStatus(name, text) {
  const s = $("status");
  s.dataset.state = name;
  s.querySelector(".status-label").textContent = text;
  s.querySelector(".status-seconds").textContent = "";
}

function setHint(text, isError) {
  const h = $("capture-hint");
  h.textContent = text;
  h.classList.toggle("is-error", Boolean(isError));
}

// Seconds counter (an aria-hidden element) of a waiting row or the status pill; returns the function that stops it.
function tick(el) {
  const t0 = Date.now();
  if (el) el.textContent = "0 s";
  const id = setInterval(() => {
    if (el) el.textContent = `${Math.round((Date.now() - t0) / 1000)} s`;
  }, 500);
  return () => clearInterval(id);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Detail under the message: the server's English text only, never bare codes or stacks.
function detailOf(err) {
  const msg = String((err && err.message) || "").trim();
  if (!msg || /^[a-z/-]+$/i.test(msg) || msg.length > 240) return "";
  return msg;
}

// Signed in and still "unauthenticated": the App Check token failed, and a new sign-in would not help.
function messageOf(err) {
  return ui.errorMessage(err, { signedIn: Boolean(state.user) });
}

// Errors that a second attempt a few seconds later would not fix (or would only make worse).
function isFinalError(err) {
  return /permission-denied|invalid-argument|not-found|unauthenticated|failed-precondition|resource-exhausted|already-exists/
      .test(String((err && err.code) || ""));
}

// ---------- calls whose connection may be cut ----------

// The log document of a request whose connection was cut. It resolves with the result (status "ok") and rejects with
// the stored error (status "error"). It rejects with the call's own error when the document never shows up (the
// request did not reach the function), and with deadline-exceeded when it is still running at the end of the call's
// time. Neither limit is applied sooner than LOG_GRACE_MS after the failure or after the page wakes up from the
// background, so the listener can reconnect and report a result that is already stored. The page may read its own
// log documents (firestore.rules).
function resultFromLog(requestId, mode, sentAt, callErr) {
  return new Promise((resolve, reject) => {
    let done = false;
    let seen = false;
    let unsubscribe = null;
    let arrivalAt = Math.max(sentAt + LOG_ARRIVAL_MS, Date.now() + LOG_GRACE_MS);
    let endAt = Math.max(sentAt + (CALL_TIMEOUT_MS[mode] || CALL_TIMEOUT_MS.deep), arrivalAt);
    let lastTick = Date.now();
    const finish = (settle, value) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      if (unsubscribe) unsubscribe();
      settle(value);
    };
    // Checked every second rather than with one long timer: a page frozen in the background resumes with the clock.
    const timer = setInterval(() => {
      const now = Date.now();
      if (now - lastTick > LOG_TICK_GAP_MS) {
        arrivalAt = Math.max(arrivalAt, now + LOG_GRACE_MS);
        endAt = Math.max(endAt, now + LOG_GRACE_MS);
      }
      lastTick = now;
      if (!seen && now >= arrivalAt) finish(reject, callErr);
      else if (now >= endAt) {
        finish(reject, Object.assign(new Error("deadline-exceeded"), { code: "functions/deadline-exceeded" }));
      }
    }, 1000);
    unsubscribe = onSnapshot(doc(db, LOG_COLLECTION, requestId), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      const outcome = logOutcome(data);
      if (outcome.state === "missing") return;
      seen = true;
      if (outcome.state === "ok") finish(resolve, { ...data, logId: snap.id });
      else if (outcome.state === "error") {
        // The function's own sentence when the document has it, so the detail line reads as on a direct reply.
        finish(reject, Object.assign(new Error(outcome.message || outcome.code), { code: `functions/${outcome.code}` }));
      }
    }, () => finish(reject, callErr));
    if (done) unsubscribe();
  });
}

// Every call to examCoachAnswer carries a requestId, and the function names the request's log document after it.
// When the connection is cut (isCutConnection in core.js) the function goes on, so the page waits for the result in
// that document instead of failing; onWaiting lets the caller say so on screen.
async function callCoach(callable, payload, onWaiting) {
  const requestId = newRequestId();
  const sentAt = Date.now();
  try {
    const { data } = await callable({ ...payload, requestId });
    return { data, sentAt };
  } catch (err) {
    if (isFinalError(err) || !isCutConnection(err)) throw err;
    if (onWaiting) onWaiting();
    const data = await resultFromLog(requestId, payload.mode, sentAt, err);
    return { data, sentAt };
  }
}

// ---------- App Check ----------

// /firebase-config.js starts App Check asynchronously, and the callables enforce it: the first call waits for a
// token. initializeAppCheck with the same options returns the instance that already exists, whichever runs first.
let appCheckPromise = null;
function appCheckReady() {
  if (!appCheckPromise) {
    appCheckPromise = (async () => {
      try {
        const { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } = await import(APP_CHECK_URL);
        const appCheck = initializeAppCheck(getApp(), {
          provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
          isTokenAutoRefreshEnabled: true,
        });
        await Promise.race([getToken(appCheck), new Promise((resolve) => setTimeout(resolve, 8000))]);
      } catch (err) {
        console.warn("App Check not ready:", (err && err.message) || err);
      }
    })();
  }
  return appCheckPromise;
}

// ---------- prompt cache warm-up ----------

// The knowledge base is cached for 1 hour and every answer renews it, so the page warms it only at the start of a
// session: after sign-in and when it becomes visible again, if nothing read the cache in the last 55 minutes.
// The cache is renewed when the request reaches the model, so the mark is the time the call was sent, not the time
// it ended: a long deep review must not push the next warm-up past the cache's expiry.
function markActive(sentAt) {
  // A call that started earlier than the last mark does not move it back, unless the clock itself went back.
  if (sentAt <= state.lastActiveAt && state.lastActiveAt <= Date.now()) return;
  state.lastActiveAt = sentAt;
  saveLastActive(storage, exam.id, sentAt);
}

// A successful warm-up, answer or deep review: cache renewed at sentAt, knowledge base version from the reply.
function noteReply(data, sentAt) {
  // A deep review the server had already stored is returned without reaching the model: the cache was not renewed.
  if (!(data && data.cached)) markActive(sentAt);
  const version = data && (data.packVersion || data.kbVersion);
  if (version) state.packVersion = String(version);
}

// Counts a call that reads or writes the exam's cache for as long as it runs.
async function inFlight(run) {
  state.inFlight++;
  try {
    return await run();
  } finally {
    state.inFlight--;
  }
}

function maybeWarm() {
  if (!state.user || !exam.known) return;
  // A warm-up next to a running answer or deep review would pay for a second cache write: that call renews it.
  if (state.warming || state.inFlight > 0) return;
  if (!shouldWarm(state.lastActiveAt)) {
    setStatus("ready", "ready");
    return;
  }
  state.warming = inFlight(warm).finally(() => {
    state.warming = null;
  });
}

async function warm() {
  setStatus("warming", "warming"); // short: with its seconds it must fit a 320 px top bar
  setHint(HINT_WARMING);
  const stop = tick($("status").querySelector(".status-seconds"));
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await appCheckReady();
        const { data, sentAt } = await callCoach(callLong, { examId: exam.id, mode: "warm" });
        noteReply(data, sentAt);
        setStatus("ready", "ready");
        setHint(HINT_READY);
        return;
      } catch (err) {
        // A warm-up that ran out of time was still billed: retrying it would pay for a second cold write.
        if (attempt < 2 && !isFinalError(err) && !/deadline-exceeded/.test(String(err && err.code))) {
          await wait(WARM_RETRY_MIN_MS + Math.random() * (WARM_RETRY_MAX_MS - WARM_RETRY_MIN_MS));
          continue;
        }
        setStatus("offline", "offline");
        const denied = /permission-denied|unauthenticated/.test(String(err && err.code));
        setHint(denied ? messageOf(err) : HINT_WARM_FAILED, denied);
        return;
      }
    }
  } finally {
    stop();
  }
}

// ---------- sign-in ----------

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("login-submit");
  $("login-error").textContent = "";
  btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-password").value);
    $("login-password").value = "";
  } catch (err) {
    $("login-error").textContent = ui.authErrorMessage(err);
  } finally {
    btn.disabled = false;
  }
});

onAuthStateChanged(auth, (user) => {
  state.user = user;
  if (!user) {
    showView("login");
    return;
  }
  $("settings-user").textContent = user.email || "";
  showView("coach");
  resetStage();
  if (!exam.known) {
    setStatus("offline", "unknown exam");
    setHint(`Unknown exam “${exam.id}”. Open /exam-coach/aigp/ instead.`, true);
    $("btn-camera").disabled = true;
    $("btn-library").disabled = true;
    return;
  }
  setHint(HINT_READY);
  maybeWarm();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") maybeWarm();
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted) maybeWarm();
});

// ---------- photo → answer ----------

$("btn-camera").addEventListener("click", () => $("file-camera").click());
$("btn-library").addEventListener("click", () => $("file-library").click());
for (const id of ["file-camera", "file-library"]) {
  $(id).addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) askAbout(file);
  });
}

function resetStage() {
  if (state.thumbUrl) URL.revokeObjectURL(state.thumbUrl);
  state.thumbUrl = null;
  state.image = null;
  state.fast = null;
  state.deep = null;
  state.doubtful = false;
  $("thumb").removeAttribute("src");
  $("result-root").replaceChildren();
  $("work").hidden = true;
  $("capture").hidden = false;
  $("doubtful").hidden = true;
  $("stage").hidden = false;
}

function showWork(file) {
  state.thumbUrl = URL.createObjectURL(file);
  $("thumb").src = state.thumbUrl;
  $("capture").hidden = true;
  $("work").hidden = false;
  window.scrollTo(0, 0);
}

async function askAbout(file) {
  if (state.busy || !exam.known) return;
  state.busy = true;
  resetStage();
  showWork(file);
  const root = $("result-root");
  root.replaceChildren(ui.renderBusy("Reading the question…"));
  const label = root.querySelector(".busy-label");
  const stop = tick(root.querySelector(".busy-seconds"));
  const t0 = Date.now();
  // Counted from the photo on: a visibility change during the compression must not start a warm-up either.
  await inFlight(async () => {
    try {
      const compressing = compressImage(file);
      compressing.catch(() => {}); // awaited below; this only keeps an early failure from being reported as unhandled
      if (state.warming) {
        // A second request while the warm-up is still writing the cache would pay for a second write: wait for it.
        label.textContent = "Finishing the warm-up…";
        await state.warming;
        label.textContent = "Reading the question…";
      }
      const img = await compressing;
      state.image = { mediaType: img.mediaType, base64: img.base64 };
      await appCheckReady();
      const { data, sentAt } = await callCoach(callAnswer, { examId: exam.id, mode: "answer", image: state.image },
          () => { label.textContent = "Connection lost, waiting for the answer…"; });
      noteReply(data, sentAt);
      const fast = ui.normalizeResult(data);
      if (!Number.isFinite(fast.latencyMs)) fast.latencyMs = Date.now() - t0;
      state.fast = fast;
      root.replaceChildren(ui.renderResult(fast));
      setStatus("ready", "ready");
      setHint(HINT_READY);
      if (fast.confidence === "low" && state.settings.autoDeep) deepen(); // does not block the page
    } catch (err) {
      root.replaceChildren(ui.renderError(messageOf(err), { detail: detailOf(err), retry: true }));
    } finally {
      stop();
      state.busy = false;
    }
  });
}

// ---------- deep review and card actions ----------

async function deepen() {
  const fast = state.fast;
  const root = $("result-root");
  const slot = root.querySelector(".deep-slot");
  const btn = root.querySelector("[data-action=deep]");
  if (!fast || !fast.logId || !slot || slot.dataset.state === "running" || slot.dataset.state === "done") return;
  slot.dataset.state = "running";
  if (btn) btn.disabled = true;
  slot.replaceChildren(ui.renderBusy("Deep review…"));
  const stop = tick(slot.querySelector(".busy-seconds"));
  const t0 = Date.now();
  await inFlight(async () => {
    try {
      if (state.warming) {
        // As for an answer: a deep review sent during the warm-up would pay for a second cache write.
        const label = slot.querySelector(".busy-label");
        if (label) label.textContent = "Finishing the warm-up…";
        await state.warming;
        if (label) label.textContent = "Deep review…";
      }
      await appCheckReady();
      const payload = { examId: exam.id, mode: "deep", previousLogId: fast.logId };
      if (state.image) payload.image = state.image;
      const { data, sentAt } = await callCoach(callLong, payload, () => {
        const label = slot.querySelector(".busy-label");
        if (label) label.textContent = "Still reviewing…";
      });
      noteReply(data, sentAt);
      const deep = ui.normalizeResult(data);
      if (!Number.isFinite(deep.latencyMs)) deep.latencyMs = Date.now() - t0;
      slot.replaceChildren(ui.renderDeep(deep, fast));
      slot.dataset.state = "done";
      if (btn) btn.hidden = true;
      if (state.fast === fast) {
        state.deep = deep;
        // Marked as doubtful before the review ended: the review goes in the doubtful list too.
        if (state.doubtful && deep.logId) setDoubtful([deep.logId], true).catch(() => {});
      }
    } catch (err) {
      slot.replaceChildren(ui.renderError(messageOf(err), { detail: detailOf(err) }));
      slot.dataset.state = "error";
      if (btn) btn.disabled = false;
    } finally {
      stop();
    }
  });
}

// The page may only change the flag on its log documents (firestore.rules); everything else is the server's.
function setDoubtful(ids, value) {
  return Promise.all(ids.map((id) => updateDoc(doc(db, LOG_COLLECTION, id), { [FLAG_FIELD]: value })));
}

async function markDoubtful(btn) {
  const fast = state.fast;
  if (!fast || !fast.logId) return;
  btn.disabled = true;
  try {
    await setDoubtful([fast.logId, state.deep && state.deep.logId].filter(Boolean), true);
    state.doubtful = true;
    btn.textContent = "Marked as doubtful";
    btn.classList.add("btn-done");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Doubtful · try again";
  }
}

$("result-root").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "deep") deepen();
  else if (btn.dataset.action === "doubtful") markDoubtful(btn);
  else if (btn.dataset.action === "new") resetStage();
});

// ---------- settings ----------

const settings = $("settings");
$("settings-open").addEventListener("click", () => {
  $("set-autodeep").checked = Boolean(state.settings.autoDeep);
  $("settings-pack").textContent = state.packVersion ? `Knowledge base ${state.packVersion}` : "";
  settings.showModal();
});
settings.addEventListener("click", (e) => {
  if (e.target === settings) settings.close();
});
$("set-autodeep").addEventListener("change", (e) => {
  state.settings.autoDeep = e.target.checked;
  saveSettings(storage, state.settings);
});
$("btn-signout").addEventListener("click", async () => {
  settings.close();
  resetStage();
  try {
    await signOut(auth);
  } catch (e) { /* onAuthStateChanged updates the view anyway */ }
});

// ---------- doubtful questions ----------

function showDoubtful(open) {
  $("stage").hidden = open;
  $("doubtful").hidden = !open;
  window.scrollTo(0, 0);
}

async function loadDoubtful() {
  const list = $("doubtful-list");
  list.replaceChildren(ui.renderBusy("Loading doubtful questions…"));
  const stop = tick(list.querySelector(".busy-seconds"));
  try {
    // Only the flag filter: ui.js sorts, so no composite index is needed. Other exams are filtered here.
    const snap = await getDocs(query(collection(db, LOG_COLLECTION), where(FLAG_FIELD, "==", true)));
    const items = snap.docs.map((d) => ({ ...d.data(), logId: d.id }))
        .filter((it) => !it.examId || it.examId === exam.id);
    list.replaceChildren(ui.renderDoubtfulList(items));
  } catch (err) {
    list.replaceChildren(ui.renderError(messageOf(err), { detail: detailOf(err) }));
  } finally {
    stop();
  }
}

function photoSrc(data) {
  const url = String((data && data.url) || "");
  if (/^https:\/\//.test(url)) return url;
  if (data && data.base64) return `data:${/^image\/[a-z+.-]+$/.test(data.mediaType) ? data.mediaType : "image/jpeg"};base64,${data.base64}`;
  return "";
}

async function showPhoto(item, btn) {
  const slot = item.querySelector(".doubtful-photo");
  btn.disabled = true;
  btn.textContent = "Loading photo…";
  try {
    await appCheckReady();
    const { data } = await callPhoto({ logId: item.dataset.logId });
    const src = photoSrc(data);
    if (!src) throw Object.assign(new Error("No photo"), { code: "not-found" });
    const img = document.createElement("img");
    img.alt = "Photo of the question";
    img.src = src;
    slot.replaceChildren(img);
    btn.hidden = true;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Show photo";
    slot.replaceChildren(ui.renderError(messageOf(err)));
  }
}

async function undoubt(item, btn) {
  btn.disabled = true;
  try {
    await setDoubtful(item.dataset.logIds.split(",").filter(Boolean), false);
    item.remove();
    const list = $("doubtful-list");
    const left = list.querySelectorAll(".doubtful-item").length;
    if (!left) list.replaceChildren(ui.renderDoubtfulList([]));
    else list.querySelector(".doubtful-count").textContent = ui.doubtfulCountText(left);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Try again";
  }
}

$("doubtful-open").addEventListener("click", () => {
  showDoubtful(true);
  loadDoubtful();
});
$("doubtful-close").addEventListener("click", () => showDoubtful(false));
$("doubtful-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  const item = e.target.closest(".doubtful-item");
  if (!btn || !item) return;
  if (btn.dataset.action === "photo") showPhoto(item, btn);
  else if (btn.dataset.action === "undoubt") undoubt(item, btn);
});
