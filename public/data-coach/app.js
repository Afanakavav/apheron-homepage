// Data Coach — collante fra la pagina, Firebase (auth, Firestore) e le funzioni callable.
// Le viste sono in index.html; il rendering della risposta è in ui.js; la foto si comprime in image.js.

import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, updateDoc } from "/firebase-config.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { compressImage } from "./image.js?v=2";
import * as ui from "./ui.js?v=2";

const SETTINGS_KEY = "data-coach:settings";
const functions = getFunctions(getApp(), "europe-west1");
const callAnswer = httpsCallable(functions, "dataCoachAnswer", { timeout: 70000 });
// Il riscaldamento passa dalla stessa funzione della risposta (servizio distinto dal ping): carica la base di
// conoscenza su quell'istanza e scrive la cache del prompt, che dura 5 minuti. Non lo ripetiamo prima di 4 minuti.
const WARM_MIN_GAP_MS = 4 * 60 * 1000;
let lastWarmAt = 0;
const callDeep = httpsCallable(functions, "dataCoachDeep", { timeout: 310000 });

const $ = (id) => document.getElementById(id);
const state = { user: null, fast: null, busy: false, thumbUrl: null, settings: loadSettings() };

// ---------- impostazioni (localStorage) ----------

function loadSettings() {
  const base = { effort: "medium", autoDeep: true };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }; } catch (e) { return base; }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch (e) { /* privato o pieno */ }
}

// ---------- viste e stato ----------

function showView(view) {
  document.body.dataset.view = view;
  $("login").hidden = view !== "login";
  $("coach").hidden = view !== "coach";
  $("splash").hidden = true;
}

function setStatus(name, text) {
  const s = $("status");
  s.dataset.state = name;
  s.textContent = text;
}

function setHint(text, isError) {
  const h = $("capture-hint");
  h.textContent = text;
  h.classList.toggle("is-error", Boolean(isError));
}

// Contatore dei secondi dentro una riga di attesa; restituisce la funzione che lo ferma.
function tick(el) {
  const t0 = Date.now();
  const id = setInterval(() => { if (el) el.textContent = `${Math.round((Date.now() - t0) / 1000)} s`; }, 500);
  return () => clearInterval(id);
}

// Dettaglio da mostrare sotto il messaggio: solo testi utili, mai codici o stack.
function detailOf(err) {
  const code = String((err && err.code) || "");
  const msg = String((err && err.message) || "").trim();
  if (code && code !== "functions/internal") return "";
  return /^[a-z-]+$/i.test(msg) ? "" : msg;
}

// ---------- ping ----------

async function ping(retry = true) {
  if (!state.user) return;
  if (Date.now() - lastWarmAt < WARM_MIN_GAP_MS) return;
  setStatus("starting", "avvio…");
  try {
    const { data } = await callAnswer({ warm: true, effort: state.settings.effort });
    lastWarmAt = Date.now();
    setStatus("ready", `pronto · ${data.kbVersion || "?"}`);
  } catch (err) {
    const code = String(err && err.code);
    const denied = /permission-denied|unauthenticated/.test(code);
    if (retry && !denied) return ping(false);
    setStatus("offline", "offline");
    if (denied) setHint(ui.errorMessage(err), true);
  }
}

// ---------- login ----------

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
  if (!user) { showView("login"); return; }
  $("settings-user").textContent = user.email || "";
  showView("coach");
  resetStage();
  ping();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.user) ping();
});

// ---------- foto → risposta rapida ----------

$("btn-camera").addEventListener("click", () => $("file-camera").click());
$("btn-gallery").addEventListener("click", () => $("file-gallery").click());
for (const id of ["file-camera", "file-gallery"]) {
  $(id).addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) askAbout(file);
  });
}

function resetStage() {
  if (state.thumbUrl) URL.revokeObjectURL(state.thumbUrl);
  state.thumbUrl = null;
  state.fast = null;
  $("thumb").removeAttribute("src");
  $("result-root").replaceChildren();
  $("work").hidden = true;
  $("capture").hidden = false;
}

function showWork(file) {
  state.thumbUrl = URL.createObjectURL(file);
  $("thumb").src = state.thumbUrl;
  $("capture").hidden = true;
  $("work").hidden = false;
}

async function askAbout(file) {
  if (state.busy) return;
  state.busy = true;
  state.fast = null;
  showWork(file);
  const root = $("result-root");
  root.replaceChildren(ui.renderBusy("Analisi in corso…"));
  const stop = tick(root.querySelector(".busy-seconds"));
  try {
    const img = await compressImage(file);
    const { data } = await callAnswer({ image: img.base64, mediaType: img.mediaType, effort: state.settings.effort });
    lastWarmAt = Date.now(); // la risposta vera ha appena rinfrescato la cache del prompt
    state.fast = data;
    root.replaceChildren(ui.renderResult(data));
    if (data.confidence === "bassa" && state.settings.autoDeep) deepen(); // non blocca l'interfaccia
  } catch (err) {
    root.replaceChildren(ui.renderError(ui.errorMessage(err), { detail: detailOf(err), retry: true }));
  } finally {
    stop();
    state.busy = false;
  }
}

// ---------- approfondimento e azioni sulla scheda ----------

async function deepen() {
  const fast = state.fast;
  const root = $("result-root");
  const slot = root.querySelector(".deep-slot");
  const btn = root.querySelector("[data-action=deep]");
  if (!fast || !fast.logId || !slot || slot.dataset.state === "running" || slot.dataset.state === "done") return;
  slot.dataset.state = "running";
  if (btn) btn.disabled = true;
  slot.replaceChildren(ui.renderBusy("Approfondimento in corso…"));
  const stop = tick(slot.querySelector(".busy-seconds"));
  try {
    const { data } = await callDeep({ logId: fast.logId });
    slot.replaceChildren(ui.renderDeep(data, fast));
    slot.dataset.state = "done";
    if (btn) btn.hidden = true;
  } catch (err) {
    slot.replaceChildren(ui.renderError(ui.errorMessage(err), { detail: detailOf(err) }));
    slot.dataset.state = "error";
    if (btn) btn.disabled = false;
  } finally {
    stop();
  }
}

async function markDubbia(btn) {
  const fast = state.fast;
  if (!fast || !fast.logId) return;
  btn.disabled = true;
  try {
    await updateDoc(doc(db, "dataCoachLog", fast.logId), { dubbia: true });
    btn.textContent = "Segnata come dubbia";
    btn.classList.add("btn-done");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Dubbia · riprova";
  }
}

$("result-root").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "deep") deepen();
  else if (btn.dataset.action === "dubbia") markDubbia(btn);
  else if (btn.dataset.action === "new") resetStage();
});

// ---------- impostazioni ----------

const settings = $("settings");
$("settings-open").addEventListener("click", () => {
  $("set-effort").value = state.settings.effort;
  $("set-autodeep").checked = Boolean(state.settings.autoDeep);
  settings.showModal();
});
settings.addEventListener("click", (e) => { if (e.target === settings) settings.close(); });
$("set-effort").addEventListener("change", (e) => { state.settings.effort = e.target.value; saveSettings(); });
$("set-autodeep").addEventListener("change", (e) => { state.settings.autoDeep = e.target.checked; saveSettings(); });
$("btn-signout").addEventListener("click", async () => {
  settings.close();
  resetStage();
  try { await signOut(auth); } catch (e) { /* onAuthStateChanged aggiorna comunque la vista */ }
});
