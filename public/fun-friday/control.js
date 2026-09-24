// Wheel of Facts · FUN Friday — Control window
// The host's cockpit: turn flow, places and points, players & facts, settings and backups.
// It only writes through store.update(engine action); every time-based number is derived each frame.

import * as E from "./engine.js";
import { createStore, openBoard } from "./store.js";

const TABS = [
  { id: "game", label: "Game" },
  { id: "players", label: "Players & facts" },
  { id: "settings", label: "Settings & data" },
];
const STEPS = ["Spin", "Choose a fact", "Ready", "Guessing", "Story time"];
const BOARD_STALE_MS = 5000;
const TOAST_MS = 4000;
// A render that lands between mousedown and mouseup would swallow the click: wait (a little) for the release.
const MAX_POINTER_DEFER_MS = 1200;

/* ---------- small helpers ---------- */

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  let value = null;
  let checked = null;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style") node.style.cssText = v;
    else if (k === "value") value = v;
    else if (k === "checked") checked = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  if (value != null) node.value = value;
  if (checked != null) node.checked = !!checked;
  return node;
}

const ordinal = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const byName = (a, b) => a.name.localeCompare(b.name);
const normKey = (t) => E.normalizePhrase(t).toLowerCase();
const fmtSec = (ms) => String(Math.round(ms / 100) / 10);
const pctText = (x) => `${Math.floor(x + 1e-9)}%`;

function fmtClock(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function fmtDay(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const fmtStamp = (ms) => new Date(ms).toLocaleString("en-GB",
  { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function fileStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${E.todayISO(d)}-${p(d.getHours())}${p(d.getMinutes())}`;
}

const dot = (p) => el("span", { class: "ctl-dot", style: `--dot:${E.colorOf(p).bg}`, "aria-hidden": "true" });

function chip(p, big = false) {
  const c = E.colorOf(p);
  return el("span", { class: `ctl-chip${big ? " ctl-chip-big" : ""}`, style: `--chip-bg:${c.bg};--chip-fg:${c.fg}`, text: p?.name || "?" });
}

// Interval the auto pace would pick for this phrase and this timer length.
function autoInterval(s, letters, durMs) {
  return s.settings.pace === "auto"
    ? E.paceMs({ ...s.settings, timerSec: durMs / 1000 }, letters)
    : E.paceMs(s.settings, letters);
}

/* ---------- tile previews (host-only window: letters are shown) ---------- */

function tilePreview(layout, size = "md") {
  const grid = el("div", { class: `ctl-tiles ctl-tiles-${size}`, "aria-hidden": "true" });
  for (const row of layout.rows) {
    const r = el("div", { class: "ctl-tiles-row" });
    for (const c of row) {
      const cell = el("span", { class: `ctl-tile ctl-tile-${c.kind}`, text: c.kind === "space" ? "" : c.ch });
      if (c.kind === "letter") cell.dataset.li = String(c.li);
      r.append(cell);
    }
    grid.append(r);
  }
  return grid;
}

function paintReveal(grid, order, count) {
  if (grid.dataset.count === String(count)) return;
  grid.dataset.count = String(count);
  const open = new Set(order.slice(0, count));
  grid.querySelectorAll("[data-li]").forEach((n) => n.classList.toggle("is-open", open.has(Number(n.dataset.li))));
}

/* ---------- focus-preserving section patches ---------- */

function captureFocus(scope) {
  const a = document.activeElement;
  if (!a || a === document.body || !scope.contains(a) || !a.dataset.k) return null;
  const f = { k: a.dataset.k };
  if ((a.tagName === "INPUT" || a.tagName === "TEXTAREA") && !["checkbox", "radio"].includes(a.type)) {
    f.v = a.value;
    try { f.s = a.selectionStart; f.e = a.selectionEnd; } catch (e) { /* number inputs have no selection */ }
  }
  return f;
}

function restoreFocus(scope, f) {
  if (!f) return;
  const n = scope.querySelector(`[data-k="${CSS.escape(f.k)}"]`);
  if (!n || n.disabled) return;
  if (f.v != null && n.value !== f.v) n.value = f.v; // keep what the host is typing
  n.focus({ preventScroll: true });
  if (f.s != null) {
    try { n.setSelectionRange(f.s, f.e); } catch (e) { /* not a text input */ }
  }
  n.dispatchEvent(new Event("ctl-restored"));
}

/* ============================================================
   mountControl
   ============================================================ */

export async function mountControl(root, { demo = false } = {}) {
  const store = createStore({ demo });
  const writer = await store.claimControl();
  const TAB_KEY = `funfriday${demo ? "-demo" : ""}:control-tab`;

  const ui = {
    tab: null,
    turnId: null,
    allowUsed: false,
    changeFact: false,
    paste: "",
    pasteRows: null,
    pasteV: 0,
    search: "",
    open: new Set(),
    details: { log: false, past: false, keys: false },
    v: 0, // bumps on local UI changes so section signatures notice them
  };

  const act = (fn, opts) => (writer ? store.update(fn, opts) : false);

  /* ---------- skeleton ---------- */

  root.replaceChildren();
  root.classList.add("ctl");
  root.classList.toggle("ctl-readonly", !writer);

  const pill = el("div", { class: "ctl-pill", role: "status" });
  const muteBtn = el("button", { type: "button", class: "btn ctl-bar-btn", "aria-keyshortcuts": "M", onclick: () => toggleMute() });
  const bar = el("div", { class: "ctl-bar" }, [
    el("div", { class: "ctl-bar-title" }, [
      el("strong", { text: "CONTROL — do not share this window" }),
      demo ? el("span", { class: "ctl-badge-demo", text: "DEMO" }) : null,
    ]),
    pill,
    el("div", { class: "ctl-bar-actions" }, [
      el("button", { type: "button", class: "btn ctl-bar-btn", "data-keep": "", text: "Open Board", onclick: () => openBoard(demo) }),
      muteBtn,
    ]),
  ]);
  const banners = el("div", { class: "ctl-banners" });
  const tabBtns = TABS.map((t) => el("button", {
    type: "button", class: "ctl-tab", role: "tab", id: `ctl-tab-${t.id}`, "aria-controls": `ctl-panel-${t.id}`,
    text: t.label, onclick: () => setTab(t.id),
  }));
  const head = el("header", { class: "ctl-head" }, [bar, banners, el("nav", { class: "ctl-tabs", role: "tablist", "aria-label": "Control sections" }, tabBtns)]);

  const panelOf = (id) => el("section", { class: "ctl-panel", id: `ctl-panel-${id}`, role: "tabpanel", "aria-labelledby": `ctl-tab-${id}` });
  const panels = { game: panelOf("game"), players: panelOf("players"), settings: panelOf("settings") };

  // Game tab
  const slot = () => el("div", { class: "ctl-slot" });
  const g = { turn: slot(), places: slot(), lb: slot(), log: slot() };
  // The places grid heads the side column, so all 20 names are on screen next to the running clock
  // (it is empty outside a guessing turn, so the leaderboard moves up then).
  panels.game.append(el("div", { class: "ctl-game" }, [
    el("div", { class: "ctl-col ctl-col-main" }, [g.turn]),
    el("div", { class: "ctl-col ctl-col-side" }, [g.places, g.lb, g.log, buildKeys()]),
  ]));

  // Players & facts tab
  const pl = { summary: slot(), preview: slot(), list: el("div", { class: "ctl-plist" }), empty: el("p", { class: "ctl-muted", hidden: true }) };
  const cardSlots = new Map();
  const pasteArea = el("textarea", {
    class: "ctl-input ctl-paste", rows: "8", spellcheck: "false", "data-k": "paste",
    placeholder: "Name | fact 1 | fact 2 | fact 3", "aria-label": "Quick paste: one line per person",
    oninput: (e) => {
      ui.paste = e.target.value;
      // A preview must match what Save will write: editing the text drops the old preview.
      if (ui.pasteRows) {
        ui.pasteRows = null;
        ui.pasteV++;
        scheduleRender();
      }
    },
  });
  const searchInput = el("input", {
    type: "search", class: "ctl-input", placeholder: "Search names or facts…", "data-k": "search", "data-keep": "",
    "aria-label": "Search players", oninput: (e) => { ui.search = e.target.value; applySearch(); },
  });
  const addInput = el("input", {
    type: "text", class: "ctl-input", placeholder: "New player's name", maxlength: "40", "data-k": "add-name",
    "aria-label": "New player's name", onkeydown: (e) => { if (e.key === "Enter") doAddPlayer(); },
  });
  panels.players.append(
    el("div", { class: "ctl-card" }, [
      el("h2", { class: "ctl-h2", text: "Players & facts" }),
      pl.summary,
      el("p", { class: "ctl-note", text: "Facts stay in this browser only. Export a backup after editing." }),
    ]),
    el("div", { class: "ctl-card" }, [
      el("h2", { class: "ctl-h2", text: "Quick paste" }),
      el("p", { class: "ctl-muted", text: "One line per person: the name, then up to three facts, separated by a vertical bar. An existing name gets exactly the facts on its line (the preview warns when current facts would be replaced); new names are added." }),
      pasteArea,
      el("div", { class: "ctl-actions" }, [
        el("button", { type: "button", class: "btn", text: "Preview", onclick: () => doPreviewPaste() }),
        el("button", { type: "button", class: "link-btn", text: "Clear", onclick: () => { pasteArea.value = ""; ui.paste = ""; ui.pasteRows = null; ui.pasteV++; render(); } }),
      ]),
      pl.preview,
    ]),
    el("div", { class: "ctl-card" }, [
      el("h2", { class: "ctl-h2", text: "Edit one person" }),
      el("div", { class: "ctl-toolbar" }, [
        el("div", { class: "ctl-toolbar-search" }, [searchInput]),
        el("div", { class: "ctl-toolbar-add" }, [addInput, el("button", { type: "button", class: "btn", text: "Add player", onclick: () => doAddPlayer() })]),
      ]),
      pl.empty,
      pl.list,
    ]),
  );

  // Settings & data tab
  const st = { main: slot() };
  const fileInput = el("input", { type: "file", accept: ".json,application/json", hidden: true, onchange: (e) => onImportFile(e) });
  panels.settings.append(st.main, fileInput);

  const toasts = el("div", { class: "ctl-toasts", role: "status", "aria-live": "polite" });
  root.append(head, panels.game, panels.players, panels.settings, toasts);

  /* ---------- tabs ---------- */

  function setTab(id) {
    ui.tab = id;
    try { sessionStorage.setItem(TAB_KEY, id); } catch (e) { /* private mode */ }
    tabBtns.forEach((b, i) => {
      const on = TABS[i].id === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    Object.entries(panels).forEach(([k, p]) => { p.hidden = k !== id; });
    render();
  }

  head.querySelector(".ctl-tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = TABS.findIndex((t) => t.id === ui.tab);
    const j = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[j].id);
    tabBtns[j].focus();
  });

  /* ---------- rendering ---------- */

  const sigs = new WeakMap();
  const lives = new Map();
  let liveSink = null;
  const live = (fn) => { if (liveSink) liveSink.push(fn); };

  // Rebuilds a section only when its signature changed, keeping keyboard focus and caret.
  function patch(target, sig, build) {
    if (sigs.get(target) === sig) return;
    sigs.set(target, sig);
    const focus = captureFocus(target);
    const list = [];
    liveSink = list;
    const out = build();
    liveSink = null;
    target.replaceChildren(...[].concat(out).filter(Boolean));
    lives.set(target, list);
    restoreFocus(target, focus);
    const now = Date.now();
    list.forEach((fn) => fn(now));
  }

  let renderQueued = false;
  let pointerDownAt = 0;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(flushRender, 0);
  }
  function flushRender() {
    if (pointerDownAt && Date.now() - pointerDownAt < MAX_POINTER_DEFER_MS) {
      setTimeout(flushRender, 40);
      return;
    }
    renderQueued = false;
    render();
  }
  window.addEventListener("pointerdown", () => { pointerDownAt = Date.now(); }, true);
  const release = () => { pointerDownAt = 0; };
  window.addEventListener("pointerup", release, true);
  window.addEventListener("pointercancel", release, true);

  function render() {
    const s = store.state;
    const now = Date.now();
    if (s.turn?.id !== ui.turnId) {
      ui.turnId = s.turn?.id || null;
      ui.allowUsed = false;
      ui.changeFact = false;
    }
    renderHead(now, true);
    if (ui.tab === "game") renderGame(s, now);
    else if (ui.tab === "players") renderPlayers(s);
    else if (ui.tab === "settings") renderSettings(s);
    if (!writer) lockInputs();
  }

  function lockInputs() {
    root.querySelectorAll(".ctl-panel button, .ctl-panel input, .ctl-panel select, .ctl-panel textarea, .ctl-bar button, .ctl-banners button")
      .forEach((n) => { if (!n.hasAttribute("data-keep")) n.disabled = true; });
  }

  /* ---------- header: board status, mute, banners ---------- */

  let headKey = "";
  let lastHeadAt = 0;
  function renderHead(now) {
    lastHeadAt = now;
    const s = store.state;
    const bs = store.boardStatus;
    const connected = !!bs && now - bs.at < BOARD_STALE_MS;
    const key = JSON.stringify([connected, connected ? [bs.audio, bs.fullscreen, bs.visible] : 0, s.settings.muted,
      s.meta.factsChangedAt, s.meta.lastExportAt, store.lastError, writer]);
    if (key === headKey) return;
    headKey = key;

    pill.className = `ctl-pill ${connected ? "is-ok" : "is-bad"}`;
    if (!connected) pill.replaceChildren(el("span", { text: "Board: not connected" }));
    else {
      pill.replaceChildren(
        el("span", { class: "ctl-pill-main", text: "Board connected" }),
        el("span", { class: bs.audio ? "" : "ctl-pill-warn", text: bs.audio ? "sound on" : "sound off" }),
        el("span", { class: bs.fullscreen ? "" : "ctl-pill-dim", text: bs.fullscreen ? "full screen" : "not full screen" }),
        bs.visible === false ? el("span", { class: "ctl-pill-warn", text: "tab hidden" }) : "",
      );
    }
    muteBtn.replaceChildren(s.settings.muted ? "Sound: muted" : "Sound: on", el("kbd", { class: "ctl-kbd", text: "M", "aria-hidden": "true" }));
    muteBtn.setAttribute("aria-pressed", String(!!s.settings.muted));
    muteBtn.classList.toggle("is-muted", !!s.settings.muted);

    const list = [];
    if (!writer) list.push(el("div", { class: "ctl-banner ctl-banner-red", role: "alert", text: "Another Control window is open — this one only follows it, and takes over by itself when that one closes." }));
    if (store.lastError) list.push(el("div", { class: "ctl-banner ctl-banner-red", role: "alert", text: store.lastError }));
    if (connected && !bs.audio) list.push(el("div", { class: "ctl-banner ctl-banner-red", text: "Click the Board once to turn its sound on" }));
    if ((s.meta.factsChangedAt || 0) > (s.meta.lastExportAt || 0)) {
      list.push(el("div", { class: "ctl-banner ctl-banner-amber" }, [
        el("span", { text: "Facts changed since your last export — Export a backup" }),
        el("button", { type: "button", class: "btn ctl-btn-sm", text: "Export", onclick: () => doExport() }),
      ]));
    }
    banners.replaceChildren(...list);
    if (!writer) lockInputs();
  }

  /* ---------- time-driven refresh (never writes state) ---------- */

  function timeKey(s, now) {
    const t = s.turn;
    if (!t) return "idle";
    return `${E.spinDone(t.spin, now)}|${E.turnClock(t, now).timeUp}`;
  }

  let lastTimeKey = "";
  let tabLiveKey = "";
  function tick() {
    requestAnimationFrame(tick); // first, so one failing update can never stop the clock
    const now = Date.now();
    if (ui.tab === "game") {
      if (timeKey(store.state, now) !== lastTimeKey) scheduleRender();
      lives.forEach((list, target) => { if (target.isConnected) list.forEach((fn) => fn(now)); });
    }
    if (now - lastHeadAt > 400) renderHead(now);
    renderTabLive(now);
  }

  // While a turn is on, the Game tab says so (and shows the clock) from the other tabs too.
  function renderTabLive(now) {
    const t = store.state.turn;
    let label = "Game";
    if (t) {
      const c = E.turnClock(t, now);
      label = t.phase === "running" && !c.timeUp ? `Game ● ${fmtClock(c.remaining)}` : "Game ●";
    }
    if (label === tabLiveKey) return;
    tabLiveKey = label;
    tabBtns[0].textContent = label;
    tabBtns[0].classList.toggle("is-live", !!t);
  }

  /* ============================================================
     GAME tab
     ============================================================ */

  function renderGame(s, now) {
    lastTimeKey = timeKey(s, now);
    const base = `${s.epoch}|${s.rev}|${ui.v}`;
    patch(g.turn, `${base}|${lastTimeKey}`, () => buildTurn(s, now));
    patch(g.places, base, () => buildPlaces(s));
    patch(g.lb, base, () => buildLeaderboard(s));
    patch(g.log, base, () => buildLog(s));
  }

  function button(label, { key, primary, big, danger, small, k, onclick, disabled, title, cls, keep } = {}) {
    const classes = ["btn", primary && "btn-primary", big && "btn-lg ctl-btn-big", danger && "btn-danger", small && "ctl-btn-sm", cls];
    return el("button", {
      type: "button", class: classes.filter(Boolean).join(" "), "data-k": k, disabled: !!disabled, title,
      "aria-keyshortcuts": key, "data-keep": keep, onclick,
    }, [label, key ? el("kbd", { class: "ctl-kbd", text: key === " " ? "Space" : key, "aria-hidden": "true" }) : null]);
  }

  function card(cls, children) {
    return el("div", { class: `ctl-card ${cls}` }, children);
  }

  function stepper(i) {
    return el("ol", { class: "ctl-steps", "aria-label": "Turn steps" },
      STEPS.map((label, j) => el("li", { class: j < i ? "is-done" : j === i ? "is-now" : "", "aria-current": j === i ? "step" : null, text: label })));
  }

  function progressBar(cls = "") {
    return el("div", { class: `ctl-progress ${cls}`, role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" }, [el("span")]);
  }
  function setProgress(barEl, frac) {
    const w = `${(E.clamp(frac, 0, 1) * 100).toFixed(1)}%`;
    if (barEl.firstChild.style.width !== w) {
      barEl.firstChild.style.width = w;
      barEl.setAttribute("aria-valuenow", String(Math.round(frac * 100)));
    }
  }
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  function pickSelect(s, label) {
    const picks = s.players.filter((p) => p.facts.some(E.hasFact)).sort(byName);
    return el("select", {
      class: "ctl-select", "data-k": "pick", "aria-label": label,
      onchange: (e) => {
        const pid = e.target.value;
        // Blur first: a focused select would eat the next shortcut letter (type-ahead picks someone else).
        e.target.blur();
        if (pid) act((d, now) => E.pickPlayer(d, pid, now));
      },
    }, [
      el("option", { value: "", text: label }),
      ...picks.map((p) => {
        const tags = [];
        if (p.id === s.settings.hostId) tags.push("host");
        if (s.cycle.drawn.includes(p.id)) tags.push("already drawn");
        if (!E.openFacts(p).length) tags.push("no unused facts");
        return el("option", { value: p.id, text: p.name + (tags.length ? ` (${tags.join(", ")})` : "") });
      }),
    ]);
  }

  function buildTurn(s, now) {
    const t = s.turn;
    if (!t) return buildIdle(s);
    const p = E.findPlayer(s, t.pid);
    if (t.phase === "pick" && !E.spinDone(t.spin, now)) return buildSpinning(s, t);
    if (t.phase === "pick" || (t.phase === "ready" && ui.changeFact)) return buildPick(s, t, p);
    if (t.phase === "ready") return buildReady(s, t, p);
    if (t.phase === "running") return buildRunning(s, t, p, now);
    return buildRevealed(s, t, p);
  }

  function lastTurnLine(s) {
    const last = s.session.turns[s.session.turns.length - 1];
    if (!last) return null;
    const who = E.findPlayer(s, last.pid);
    const res = last.results.length
      ? last.results.map((r) => `${ordinal(r.place)} ${E.findPlayer(s, r.pid)?.name || "?"} +${r.points}`).join(" · ")
      : "nobody got it";
    return el("p", { class: "ctl-muted ctl-last" }, [el("strong", { text: "Last turn: " }), `${who?.name || "?"} — ${res}`]);
  }

  function buildIdle(s) {
    const pool = E.wheelPool(s);
    const undoWho = s.undo ? E.findPlayer(s, s.undo.turn.pid) : null;
    const anyFacts = s.players.some((p) => p.facts.some(E.hasFact));
    return card("ctl-turn", [
      stepper(0),
      el("h2", { class: "ctl-turn-title", text: "Next turn" }),
      pool.length ? null : anyFacts
        ? el("p", { class: "ctl-empty", text: "All facts are used — Reset facts in Settings & data to play them again." })
        : el("p", { class: "ctl-empty" }, ["No facts yet — ",
          el("button", { type: "button", class: "link-btn", "data-k": "go-players", text: "add them in Players & facts", onclick: () => setTab("players") }), "."]),
      el("div", { class: "ctl-actions ctl-actions-main" }, [
        button("Spin the wheel", { key: "S", primary: true, big: true, disabled: !pool.length, k: "spin", onclick: doSpin }),
        pickSelect(s, "Pick manually…"),
      ]),
      el("p", { class: "ctl-info", text: `Wheel: ${plural(pool.length, "name")} · round ${s.cycle.round}` }),
      s.undo ? el("div", { class: "ctl-undo-row" }, [
        button("Undo last turn", { k: "undo-turn", onclick: doUndoTurn }),
        el("span", { class: "ctl-muted", text: `Puts ${undoWho?.name || "the last"}'s turn back to story time.` }),
      ]) : null,
      lastTurnLine(s),
    ]);
  }

  function buildSpinning(s, t) {
    const barEl = progressBar();
    live((now) => setProgress(barEl, (now - t.spin.t0) / t.spin.ms));
    return card("ctl-turn", [
      stepper(0),
      el("h2", { class: "ctl-turn-title", text: "Spinning…" }),
      el("p", { class: "ctl-muted", text: "The wheel is turning on the Board. The name appears here when it stops." }),
      barEl,
      el("div", { class: "ctl-actions" }, [button("Cancel", { key: "Esc", k: "cancel", onclick: () => askCancel() })]),
    ]);
  }

  function personHead(p, sub) {
    return el("div", { class: "ctl-person" }, [chip(p, true), sub ? el("span", { class: "ctl-person-sub", text: sub }) : null]);
  }

  function factChoice(s, t, f, i) {
    const l = E.layoutPhrase(f.text);
    const used = !!f.usedOn;
    const current = t.factId === f.id;
    const blocked = l.errors.length > 0 || (used && !ui.allowUsed);
    return el("button", {
      type: "button", class: `ctl-fact${used ? " is-used" : ""}${current ? " is-current" : ""}${l.errors.length ? " is-error" : ""}`,
      disabled: blocked, "data-k": `choose-${f.id}`, "aria-keyshortcuts": String(i + 1),
      onclick: () => doChooseFact(f.id),
    }, [
      el("span", { class: "ctl-fact-num", text: String(i + 1), "aria-hidden": "true" }),
      el("span", { class: "ctl-fact-body" }, [
        el("span", { class: "ctl-fact-text", text: f.text }),
        l.errors.length
          ? el("span", { class: "ctl-fact-meta ctl-err", text: l.errors.join(" ") })
          : el("span", { class: "ctl-fact-meta", text: `${l.letters} tiles · reveal every ${fmtSec(E.paceMs(s.settings, l.letters))} s` }),
        used ? el("span", { class: "ctl-fact-used", text: `Used on ${fmtDay(f.usedOn)}` }) : null,
        current ? el("span", { class: "ctl-fact-cur", text: "Chosen now" }) : null,
      ]),
    ]);
  }

  function buildPick(s, t, p) {
    const facts = p.facts.filter(E.hasFact);
    const anyUsed = facts.some((f) => f.usedOn);
    const allUsed = facts.length && facts.every((f) => f.usedOn);
    return card("ctl-turn", [
      stepper(1),
      personHead(p, t.spin ? "the wheel stopped here" : "picked by hand"),
      el("h2", { class: "ctl-turn-title", text: "Choose a fun fact" }),
      el("div", { class: "ctl-facts" }, facts.map((f, i) => factChoice(s, t, f, i))),
      allUsed && !ui.allowUsed ? el("p", { class: "ctl-warn-box", text: "All their facts are used. Re-spin, or tick “Allow used facts”." }) : null,
      anyUsed ? el("label", { class: "ctl-check" }, [
        el("input", { type: "checkbox", "data-k": "allow-used", checked: ui.allowUsed, onchange: (e) => { ui.allowUsed = e.target.checked; ui.v++; render(); } }),
        " Allow used facts",
      ]) : null,
      el("div", { class: "ctl-actions" }, [
        t.phase === "ready" ? button("Keep the chosen fact", { k: "keep-fact", primary: true, onclick: () => { ui.changeFact = false; ui.v++; render(); } }) : null,
        button("Re-spin", { key: "R", k: "respin", onclick: doRespin }),
        button("Cancel turn", { key: "Esc", k: "cancel", onclick: () => askCancel() }),
        pickSelect(s, "Pick someone else…"),
      ]),
    ]);
  }

  // Enter commits the value (change fires on blur) and frees the keyboard: the next Enter starts.
  function blurOnEnter(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.target.blur();
  }

  function timingNote(s, t) {
    const auto = autoInterval(s, t.letters, t.durMs);
    const shown = Math.min(t.letters, Math.floor(t.durMs / t.intervalMs));
    const pct = t.letters ? Math.round((100 * shown) / t.letters) : 0;
    return `${t.intervalMs === auto ? `Auto for ${t.letters} tiles · ` : ""}about ${shown} of ${t.letters} tiles (${pct}%) are uncovered when the timer ends.`;
  }

  function buildReady(s, t, p) {
    const layout = E.layoutPhrase(t.text);
    const timerIn = el("input", {
      type: "number", class: "ctl-input ctl-num", min: "10", max: "600", step: "1", "data-k": "t-timer", id: "ctl-t-timer",
      value: String(Math.round(t.durMs / 1000)),
      onkeydown: blurOnEnter,
      onchange: (e) => {
        const v = Number(e.target.value);
        if (!Number.isFinite(v) || v < 10 || v > 600) {
          toast("Timer: enter 10 to 600 seconds.", "error");
          e.target.value = String(Math.round(t.durMs / 1000));
          return;
        }
        act((d) => {
          const tt = d.turn;
          if (!tt || tt.phase !== "ready") return false;
          const wasAuto = tt.intervalMs === autoInterval(d, tt.letters, tt.durMs);
          if (!E.setTurnTiming(d, { timerSec: v })) return false;
          if (wasAuto) E.setTurnTiming(d, { intervalSec: autoInterval(d, tt.letters, tt.durMs) / 1000 });
          return true;
        });
      },
    });
    const intIn = el("input", {
      type: "number", class: "ctl-input ctl-num", min: "0.5", max: "20", step: "0.1", "data-k": "t-int", id: "ctl-t-int",
      value: fmtSec(t.intervalMs),
      onkeydown: blurOnEnter,
      onchange: (e) => {
        const v = Number(e.target.value);
        if (!Number.isFinite(v) || v < 0.5 || v > 20) {
          toast("Reveal every: enter 0.5 to 20 seconds.", "error");
          e.target.value = fmtSec(t.intervalMs);
          return;
        }
        act((d) => E.setTurnTiming(d, { intervalSec: v }));
      },
    });
    return card("ctl-turn", [
      stepper(2),
      personHead(p, "is up"),
      el("div", { class: "ctl-phrase" }, [
        el("span", { class: "ctl-phrase-label", text: "The phrase — only you see it" }),
        el("span", { class: "ctl-phrase-text", text: t.text }),
      ]),
      tilePreview(layout, "md"),
      el("div", { class: "ctl-timing" }, [
        el("label", { class: "ctl-field", for: "ctl-t-timer" }, [el("span", { text: "Timer (s)" }), timerIn]),
        el("label", { class: "ctl-field", for: "ctl-t-int" }, [el("span", { text: "Reveal every (s)" }), intIn]),
        el("p", { class: "ctl-muted ctl-timing-note", text: timingNote(s, t) }),
      ]),
      el("div", { class: "ctl-actions ctl-actions-main" }, [
        button("Start", { key: "Enter", primary: true, big: true, k: "start", onclick: doStart }),
        button("Change fact", { k: "change-fact", onclick: () => { ui.changeFact = true; ui.v++; render(); } }),
        button("Re-spin", { key: "R", k: "respin", onclick: doRespin }),
        button("Cancel turn", { key: "Esc", k: "cancel", onclick: () => askCancel() }),
      ]),
    ]);
  }

  function statsLine(s, t, c) {
    const b = E.bonusFor(c.hiddenPct, s.settings.bonusTiers);
    const bonus = s.settings.bonusScope === "first" ? `1st-place bonus now +${b}` : `bonus now +${b}`;
    return `Revealed ${c.revealed} / ${t.letters} · ${pctText(c.hiddenPct)} hidden · ${bonus}`;
  }

  function buildRunning(s, t, p, now) {
    const c0 = E.turnClock(t, now);
    const timeUp = c0.timeUp;
    const paused = c0.paused;
    const clockEl = el("div", { class: `ctl-clock${paused ? " is-paused" : ""}${timeUp ? " is-up" : ""}`, "aria-live": "off" });
    const barEl = progressBar(timeUp ? "is-up" : paused ? "is-paused" : "");
    const stats = el("p", { class: "ctl-stats" });
    const tiles = tilePreview(E.layoutPhrase(t.text), "md");
    tiles.classList.add("ctl-run-tiles"); // hidden on narrow screens: the names grid matters more there
    live((n) => {
      const c = E.turnClock(t, n);
      setText(clockEl, fmtClock(c.remaining));
      setProgress(barEl, c.progress);
      setText(stats, statsLine(s, t, c));
      paintReveal(tiles, t.order, c.revealed);
    });
    const full = t.results.length + t.marks.length >= s.settings.places.length;
    const marks = t.marks.length ? el("p", { class: "ctl-marks" }, [
      el("strong", { text: `${plural(t.marks.length, "answer")} marked` }),
      ` (${t.marks.map((m) => pctText(m.hiddenPct)).join(", ")} hidden) — now click the name${t.marks.length > 1 ? "s" : ""} · `,
      el("button", { type: "button", class: "link-btn", "data-k": "clear-marks", text: "clear", onclick: () => act((d) => E.clearMarks(d)) }),
    ]) : null;
    const gotOne = button("Got one!", { key: " ", primary: !timeUp, big: !timeUp, k: "got-one", disabled: full, onclick: doGotOne,
      title: full ? "All places are taken or marked" : "Freezes this instant for the next name you click" });

    return card(`ctl-turn${timeUp ? " is-up" : ""}`, [
      stepper(3),
      el("div", { class: "ctl-run-head" }, [
        personHead(p, null),
        el("span", { class: "ctl-phrase-mini", text: t.text }),
      ]),
      el("div", { class: "ctl-clock-row" }, [
        clockEl,
        paused ? el("span", { class: "ctl-paused-badge", text: "PAUSED — the Board is frozen" }) : null,
        timeUp ? el("span", { class: "ctl-up-badge", text: "Time's up!" }) : null,
      ]),
      barEl,
      stats,
      timeUp ? el("div", { class: "ctl-banner-in ctl-banner-up", role: "alert", text: "Time's up — assign places for answers sent in time, then reveal the phrase" }) : null,
      el("div", { class: "ctl-actions ctl-actions-main" }, timeUp ? [
        button("Reveal the phrase", { key: "A", primary: true, big: true, k: "reveal", onclick: doReveal }),
        button("Cancel turn", { key: "Esc", k: "cancel", onclick: () => askCancel() }),
      ] : [
        gotOne,
        button(paused ? "Resume" : "Pause", { key: "P", k: "pause", cls: paused ? "ctl-btn-resume" : "", onclick: doPause }),
        button("Reveal all", { key: "A", k: "reveal", onclick: doReveal }),
        button("Cancel turn", { key: "Esc", k: "cancel", onclick: () => askCancel() }),
      ]),
      marks,
      tiles,
    ]);
  }

  function buildRevealed(s, t, p) {
    const tiles = tilePreview(E.layoutPhrase(t.text), "md");
    paintReveal(tiles, t.order, t.letters);
    return card("ctl-turn ctl-turn-story", [
      stepper(4),
      el("h2", { class: "ctl-story" }, ["Story time — ", chip(p, true), " tells the story"]),
      el("div", { class: "ctl-phrase" }, [el("span", { class: "ctl-phrase-text", text: t.text })]),
      tiles,
      el("p", { class: "ctl-muted", text: "Late correct answers can still get a place — without speed bonus, unless you marked them with Space before revealing." }),
      el("div", { class: "ctl-actions ctl-actions-main" }, [
        button("Next turn", { key: "Enter", primary: true, big: true, k: "next", onclick: doNext }),
        button("Cancel turn", { key: "Esc", k: "cancel", onclick: () => askCancel() }),
      ]),
    ]);
  }

  /* ---------- places ---------- */

  function buildPlaces(s) {
    const t = s.turn;
    if (!t || !t.startedAt || !["running", "revealed"].includes(t.phase)) return null;
    const total = s.settings.places.length;
    const assigned = t.results.map((r) => {
      const who = E.findPlayer(s, r.pid);
      return el("li", { class: `ctl-place ctl-place-${r.place}` }, [
        el("span", { class: "ctl-place-badge", text: ordinal(r.place) }),
        who ? dot(who) : null,
        el("span", { class: "ctl-place-name", text: who?.name || "?" }),
        el("strong", { class: "ctl-place-pts", text: `+${r.points}` }),
        el("span", { class: "ctl-muted", text: `(${r.base} + ${r.bonus} bonus · ${pctText(r.hiddenPct)} hidden)` }),
        el("button", { type: "button", class: "ctl-x", "data-k": `unplace-${r.pid}`, title: `Remove ${who?.name || ""}'s place`,
          "aria-label": `Remove ${who?.name || ""}'s place`, text: "✕", onclick: () => act((d) => E.removePlace(d, r.pid)) }),
      ]);
    });

    const next = el("p", { class: "ctl-next" });
    if (t.results.length < total) {
      live((now) => {
        const mark = t.marks[0];
        const revealed = t.phase === "revealed";
        const hidden = mark ? mark.hiddenPct : revealed ? 0 : E.turnClock(t, now).hiddenPct;
        const sc = E.scoreFor(t.results.length + 1, hidden, s.settings);
        const why = mark ? ", from the Space mark" : revealed ? ", phrase already revealed" : "";
        setText(next, `Next click: ${ordinal(t.results.length + 1)} place · +${sc.points} (${sc.base} + ${sc.bonus} bonus${why})`);
      });
    } else next.textContent = "All places are given.";

    const grid = el("div", { class: "ctl-pgrid" }, [...s.players].sort(byName).map((p) => {
      const r = t.results.find((x) => x.pid === p.id);
      const isHost = p.id === s.settings.hostId;
      const isTurn = p.id === t.pid;
      const can = E.canPlace(s, p.id);
      const why = isHost ? "The host knows every fact" : isTurn ? "It is their own fact"
        : r ? `Click to remove the ${ordinal(r.place)} place` : can ? `Give ${p.name} the ${ordinal(t.results.length + 1)} place` : "All places are given";
      return el("button", {
        type: "button", class: `ctl-pbtn${r ? " is-placed" : ""}${isHost || isTurn ? " is-out" : ""}`, "data-k": `place-${p.id}`,
        disabled: isHost || isTurn || (!r && !can), title: why,
        onclick: () => (r ? act((d) => E.removePlace(d, p.id)) : act((d, now) => E.assignPlace(d, p.id, now))),
      }, [
        dot(p),
        el("span", { class: "ctl-pbtn-name", text: p.name }),
        r ? el("span", { class: `ctl-place-badge ctl-pb-${r.place}`, text: ordinal(r.place) }) : null,
        isHost ? el("span", { class: "ctl-pbtn-tag", text: "host" }) : isTurn ? el("span", { class: "ctl-pbtn-tag", text: "their fact" }) : null,
      ]);
    }));

    return card("ctl-places", [
      el("div", { class: "ctl-card-head" }, [
        el("h2", { class: "ctl-h2", text: "Who got it?" }),
        el("span", { class: "ctl-muted", text: "Click in order: 1st, 2nd, 3rd" }),
      ]),
      assigned.length ? el("ol", { class: "ctl-place-list" }, assigned) : null,
      el("div", { class: "ctl-places-bar" }, [
        next,
        button("Undo last", { key: "Z", small: true, k: "undo-place", disabled: !t.results.length, onclick: () => act((d) => E.undoLastPlace(d)) }),
      ]),
      grid,
      el("p", { class: "ctl-hint", text: "Press Space the moment a right answer appears in the chat, then click the name — the bonus uses that instant." }),
    ]);
  }

  /* ---------- leaderboard ---------- */

  function toggleBtn(label, on, key, onclick, k) {
    return el("button", { type: "button", class: `btn ctl-toggle${on ? " is-on" : ""}`, "aria-pressed": String(on), "data-k": k, "aria-keyshortcuts": key, onclick }, [
      el("span", { class: "ctl-toggle-state", text: on ? "ON" : "OFF", "aria-hidden": "true" }),
      label,
      key ? el("kbd", { class: "ctl-kbd", text: key, "aria-hidden": "true" }) : null,
    ]);
  }

  function buildLeaderboard(s) {
    const rows = E.standings(s);
    const b = s.board;
    const podiumOn = b.overlay === "podium";
    return card("ctl-lb", [
      el("div", { class: "ctl-card-head" }, [
        el("h2", { class: "ctl-h2", text: "Leaderboard" }),
        el("span", { class: "ctl-muted", text: `This FUN Friday · ${plural(s.session.turns.length, "turn")}` }),
      ]),
      el("div", { class: "ctl-lb-toggles" }, [
        toggleBtn("Leaderboard strip on Board", !!b.showMini, "L", doStrip, "tg-strip"),
        toggleBtn("Full leaderboard on Board", b.overlay === "leaderboard", "O", () => doOverlay("leaderboard"), "tg-full"),
        el("button", { type: "button", class: `btn ctl-toggle${podiumOn ? " is-on" : ""}`, "aria-pressed": String(podiumOn), "data-k": "tg-podium",
          onclick: () => doOverlay("podium") }, [el("span", { class: "ctl-toggle-state", text: podiumOn ? "ON" : "OFF", "aria-hidden": "true" }), podiumOn ? "Close podium" : "Final podium"]),
      ]),
      rows.length ? el("ol", { class: "ctl-lb-list" }, rows.map((r) => {
        const p = E.findPlayer(s, r.pid);
        return el("li", { class: `ctl-lb-row${r.turnDelta ? " is-delta" : ""}` }, [
          el("span", { class: "ctl-lb-rank", text: String(r.rank) }),
          dot(p),
          el("span", { class: "ctl-lb-name", text: r.name }),
          r.turnDelta ? el("span", { class: "ctl-lb-delta", text: `+${r.turnDelta}` }) : el("span"),
          r.firsts ? el("span", { class: "ctl-lb-firsts", title: "1st places", text: `1st ×${r.firsts}` }) : el("span"),
          el("strong", { class: "ctl-lb-pts", text: String(r.points) }),
          el("span", { class: "ctl-lb-adj" }, [
            el("button", { type: "button", class: "ctl-adj", "data-k": `minus-${r.pid}`, "aria-label": `One point less for ${r.name}`, title: "−1 point", text: "−",
              onclick: () => act((d, now) => E.adjustPoints(d, r.pid, -1, now)) }),
            el("button", { type: "button", class: "ctl-adj", "data-k": `plus-${r.pid}`, "aria-label": `One point more for ${r.name}`, title: "+1 point", text: "+",
              onclick: () => act((d, now) => E.adjustPoints(d, r.pid, 1, now)) }),
          ]),
        ]);
      })) : el("p", { class: "ctl-muted", text: "No players yet." }),
      el("div", { class: "ctl-actions" }, [button("New FUN Friday", { k: "new-ff", onclick: askNewFunFriday })]),
    ]);
  }

  /* ---------- session log & shortcuts ---------- */

  function details(key, summary, children, cls = "") {
    return el("details", { class: `ctl-details ${cls}`, open: !!ui.details[key], ontoggle: (e) => { ui.details[key] = e.currentTarget.open; } }, [
      el("summary", {}, summary),
      ...children,
    ]);
  }

  function buildLog(s) {
    const turns = s.session.turns;
    const name = (pid) => E.findPlayer(s, pid)?.name || "(removed)";
    const items = turns.map((t, i) => el("li", { class: "ctl-log-item" }, [
      el("div", { class: "ctl-log-head" }, [el("span", { class: "ctl-log-num", text: `#${i + 1}` }), el("strong", { text: name(t.pid) })]),
      el("div", { class: "ctl-log-fact", text: t.text }),
      el("div", { class: "ctl-muted", text: t.results.length ? t.results.map((r) => `${ordinal(r.place)} ${name(r.pid)} +${r.points}`).join(" · ") : "Nobody got it" }),
    ])).reverse();
    const adj = s.session.adjust.length ? el("p", { class: "ctl-muted", text: `Manual adjustments: ${s.session.adjust.length}` }) : null;
    const past = s.pastSessions.length ? details("past", `Past FUN Fridays (${s.pastSessions.length})`, [
      el("ul", { class: "ctl-past" }, s.pastSessions.map((ps) => el("li", {}, [
        el("strong", { text: `${fmtDay(ps.startedOn)}${ps.endedOn && ps.endedOn !== ps.startedOn ? ` → ${fmtDay(ps.endedOn)}` : ""}` }),
        ` · ${plural(ps.turns, "turn")}`,
        ps.top?.length ? el("div", { class: "ctl-muted", text: ps.top.map((x) => `${x.name} ${x.points}`).join(" · ") }) : null,
      ]))),
    ], "ctl-details-inner") : null;
    return card("ctl-log", [
      details("log", `Session log · ${plural(turns.length, "turn")}`, [
        items.length ? el("ol", { class: "ctl-log-list" }, items) : el("p", { class: "ctl-muted", text: "No turns yet in this FUN Friday." }),
        adj,
        past,
      ]),
    ]);
  }

  function buildKeys() {
    const rows = [
      ["S", "Spin (idle) · re-spin (choosing / ready)"], ["R", "Re-spin"], ["1 2 3", "Choose fact 1, 2 or 3"],
      ["Enter", "Start (ready) · next turn (story time)"], ["Space", "Got one! — freeze the instant"],
      ["P", "Pause / resume"], ["A", "Reveal all"], ["Z", "Undo last place"], ["Esc", "Cancel turn (asks first)"],
      ["L", "Leaderboard strip on Board"], ["O", "Full leaderboard on Board"], ["M", "Mute the Board"],
    ];
    const d = el("details", { class: "ctl-details", ontoggle: (e) => { ui.details.keys = e.currentTarget.open; } }, [
      el("summary", { text: "Keyboard shortcuts" }),
      el("p", { class: "ctl-muted", text: "They work on the Game tab, not while typing in a field." }),
      el("dl", { class: "ctl-keys" }, rows.flatMap(([k, v]) => [el("dt", {}, k.split(" ").map((x) => el("kbd", { class: "ctl-kbd", text: x }))), el("dd", { text: v })])),
    ]);
    return card("ctl-keys-card", [d]);
  }

  /* ---------- game actions ---------- */

  function doSpin() {
    if (!act((d, now) => E.spinWheel(d, now))) toast("Nobody left on the wheel.", "error");
  }
  function doRespin() {
    if (!act((d, now) => E.respin(d, now))) toast("Cannot re-spin now.", "error");
  }
  function doChooseFact(fid) {
    if (act((d, now) => E.chooseFact(d, fid, now))) {
      ui.changeFact = false;
      ui.v++;
    }
  }
  function chooseByIndex(i) {
    const s = store.state;
    const p = E.findPlayer(s, s.turn?.pid);
    const f = p?.facts.filter(E.hasFact)[i];
    if (!f) return;
    if (f.usedOn && !ui.allowUsed) { toast("That fact is used. Tick “Allow used facts” to choose it.", "error"); return; }
    if (E.layoutPhrase(f.text).errors.length) { toast("That fact has errors: fix it in Players & facts.", "error"); return; }
    doChooseFact(f.id);
  }
  const doStart = () => act((d, now) => E.startTurn(d, now));
  const doPause = () => act((d, now) => E.togglePause(d, now));
  const doReveal = () => act((d, now) => E.revealAll(d, now));
  const doNext = () => act((d, now) => E.commitTurn(d, now));
  const doGotOne = () => {
    if (!act((d, now) => E.markGotOne(d, now))) toast("All places are already taken or marked.", "error");
    else {
      flash(g.turn.querySelector("[data-k='got-one']"));
      // Narrow window (one column): bring the names grid into view for the click that follows.
      const grid = g.places.querySelector(".ctl-pgrid");
      if (grid && grid.getBoundingClientRect().bottom > window.innerHeight) grid.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };
  const doStrip = () => act((d) => E.toggleMiniLeaderboard(d));
  const doOverlay = (o) => act((d, now) => E.toggleOverlay(d, o, now));
  function doUndoTurn() {
    if (act((d) => E.undoLastTurn(d))) toast("The last turn is back in story time.");
  }
  function toggleMute() {
    act((d) => { d.settings.muted = !d.settings.muted; });
  }

  function flash(node) {
    if (!node) return;
    node.classList.remove("is-flash");
    void node.offsetWidth;
    node.classList.add("is-flash");
  }

  async function askCancel() {
    const t = store.state.turn;
    if (!t) return;
    if (t.startedAt) {
      const ok = await dialog({
        title: "Cancel this turn?",
        body: ["Nothing is used: the person and the fact stay available, and the places of this turn are dropped."],
        actions: [{ label: "Keep playing", value: "" }, { label: "Cancel turn", value: "yes", danger: true }],
      });
      if (ok !== "yes") return;
    }
    act((d, now) => E.cancelTurn(d, now));
  }

  // The A key before time's up asks first: one stray key would show the phrase to everyone.
  async function askReveal() {
    const t = store.state.turn;
    if (!t || t.phase !== "running") return;
    if (!E.turnClock(t, Date.now()).timeUp) {
      const ok = await dialog({
        title: "Reveal the whole phrase now?",
        body: ["Everyone will see it on the Board. Places can still be given afterwards."],
        actions: [{ label: "Keep guessing", value: "" }, { label: "Reveal", value: "yes", primary: true }],
        focus: "yes", // A then Enter reveals; Esc keeps guessing
      });
      if (ok !== "yes") return;
    }
    doReveal();
  }

  async function askNewFunFriday() {
    const t = store.state.turn;
    const who = t ? E.findPlayer(store.state, t.pid)?.name : null;
    const v = await dialog({
      title: "Start a new FUN Friday?",
      body: ["Scores go back to zero. Used facts stay used.",
        t ? `The turn in progress (${who || "?"}) is cancelled and not counted.` : null].filter(Boolean),
      actions: [{ label: "Cancel", value: "" }, { label: "Start new", value: "new" }, { label: "Export backup and start new", value: "export", primary: true }],
    });
    if (!v) return;
    if (v === "export") doExport();
    if (act((d, now) => E.newFunFriday(d, now), { backup: "Before New FUN Friday" })) toast("New FUN Friday: scores are back to zero.");
  }

  /* ---------- keyboard ---------- */

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector("dialog[open]")) return; // Esc closes the dialog natively
    const tg = e.target instanceof Element ? e.target : null;
    // Typing fields keep their keys; a ticked checkbox does not steal the shortcuts.
    if (tg && tg.closest("input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable='true']")) return;
    if (tg && tg.matches("input[type=checkbox], input[type=radio]") && (e.key === " " || e.key === "Enter")) return;
    if (e.repeat) {
      if (e.key === " " && ui.tab === "game") e.preventDefault();
      return;
    }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === "m") { if (writer) toggleMute(); e.preventDefault(); return; }
    if (!writer) return;
    if (ui.tab !== "game") {
      if (store.state.turn && [" ", "p", "a", "z", "s", "Enter", "1", "2", "3"].includes(key)) {
        toast("A turn is on: switch to the Game tab to control it.", "error");
      }
      return;
    }

    const s = store.state;
    const t = s.turn;
    const now = Date.now();
    const phase = t?.phase;
    const spinning = phase === "pick" && !E.spinDone(t.spin, now);
    const choosing = !!t && !spinning && (phase === "pick" || phase === "ready");
    const onButton = tg && tg.closest("button, a, summary");
    let handled = true;
    switch (key) {
      case "s":
        if (!t) doSpin();
        else if (choosing) doRespin();
        else handled = false;
        break;
      case "r":
        if (choosing) doRespin();
        else handled = false;
        break;
      case "1": case "2": case "3":
        if (choosing) chooseByIndex(Number(key) - 1);
        else handled = false;
        break;
      case "Enter":
        if (onButton) handled = false; // a focused button keeps its own Enter
        else if (phase === "ready") doStart();
        else if (phase === "revealed") doNext();
        else handled = false;
        break;
      case " ":
        if (t?.startedAt && (phase === "running" || phase === "revealed")) doGotOne();
        else handled = false;
        break;
      case "p":
        if (phase === "running") doPause();
        else handled = false;
        break;
      case "a":
        if (phase === "running") askReveal();
        else handled = false;
        break;
      case "z":
        if (t?.results.length) act((d) => E.undoLastPlace(d));
        else handled = false;
        break;
      case "Escape":
        if (t) askCancel();
        else handled = false;
        break;
      case "l": doStrip(); break;
      case "o": doOverlay("leaderboard"); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  });

  // A mouse click leaves focus on the button; drop it so Enter / Space go to the shortcuts.
  root.addEventListener("click", (e) => {
    const b = e.target instanceof Element ? e.target.closest("button") : null;
    if (b && e.detail > 0 && document.activeElement === b) b.blur();
  });

  /* ============================================================
     PLAYERS & FACTS tab
     ============================================================ */

  function duplicateMap(s) {
    const map = new Map();
    for (const p of s.players) {
      for (const f of p.facts) {
        if (!E.hasFact(f)) continue;
        const k = normKey(f.text);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push({ pid: p.id, fid: f.id, name: p.name });
      }
    }
    return map;
  }

  function renderPlayers(s) {
    patch(pl.summary, `${s.epoch}|${s.rev}`, () => buildSummary(s));
    patch(pl.preview, `${ui.pasteV}|${writer}`, () => buildPastePreview());
    if (pasteArea.value !== ui.paste && document.activeElement !== pasteArea) pasteArea.value = ui.paste;

    const dups = duplicateMap(s);
    const sorted = [...s.players].sort(byName);
    const seen = new Set();
    for (const p of sorted) {
      let target = cardSlots.get(p.id);
      if (!target) {
        target = el("div", { class: "ctl-pcard-slot" });
        cardSlots.set(p.id, target);
      }
      seen.add(p.id);
      const dupSig = p.facts.map((f) => (dups.get(normKey(f.text)) || []).filter((x) => x.fid !== f.id).map((x) => x.name).join(","));
      const sig = JSON.stringify([p, ui.open.has(p.id), s.settings.hostId === p.id, s.turn?.pid === p.id ? s.turn.factId : null, dupSig, writer]);
      patch(target, sig, () => buildPlayerCard(s, p, dups));
    }
    for (const [pid, target] of cardSlots) {
      if (!seen.has(pid)) {
        target.remove();
        cardSlots.delete(pid);
        ui.open.delete(pid);
      }
    }
    const want = sorted.map((p) => cardSlots.get(p.id));
    if (want.length !== pl.list.children.length || want.some((n, i) => pl.list.children[i] !== n)) {
      const f = captureFocus(pl.list);
      pl.list.replaceChildren(...want);
      restoreFocus(pl.list, f);
    }
    pl.empty.hidden = s.players.length > 0;
    pl.empty.textContent = "No players yet — paste them above or add one.";
    applySearch();
  }

  function applySearch() {
    const q = ui.search.trim().toLowerCase();
    const s = store.state;
    for (const p of s.players) {
      const target = cardSlots.get(p.id);
      if (!target) continue;
      const hit = !q || p.name.toLowerCase().includes(q) || p.facts.some((f) => f.text.toLowerCase().includes(q));
      target.hidden = !hit;
    }
  }

  function buildSummary(s) {
    const facts = s.players.reduce((n, p) => n + p.facts.filter(E.hasFact).length, 0);
    const used = s.players.reduce((n, p) => n + p.facts.filter((f) => E.hasFact(f) && f.usedOn).length, 0);
    const max = s.players.length * E.MAX_FACTS;
    const exp = s.meta.lastExportAt ? fmtStamp(s.meta.lastExportAt) : "never";
    return el("p", { class: "ctl-summary" }, [
      el("strong", { text: plural(s.players.length, "player") }),
      ` · ${facts}/${max} facts · ${used} used · last export: ${exp}`,
    ]);
  }

  function doPreviewPaste() {
    ui.paste = pasteArea.value;
    ui.pasteRows = E.parseQuickPaste(ui.paste, store.state.players);
    ui.pasteV++;
    render();
  }

  function buildPastePreview() {
    const rows = ui.pasteRows;
    if (!rows) return null;
    if (!rows.length) return el("p", { class: "ctl-muted", text: "Nothing to preview: paste one line per person." });
    const good = rows.filter((r) => !r.errors.length);
    const table = el("table", { class: "ctl-ptable" }, [
      el("thead", {}, el("tr", {}, ["Line", "Name", "Facts", "Status"].map((h) => el("th", { scope: "col", text: h })))),
      el("tbody", {}, rows.map((r) => {
        const rowWarn = r.warnings.filter((w) => !w.startsWith("New player"));
        return el("tr", { class: r.errors.length ? "is-error" : rowWarn.length ? "is-warn" : "" }, [
          el("td", { class: "ctl-ptable-line", text: String(r.line) }),
          el("td", {}, [
            el("strong", { text: r.name || "—" }),
            r.name ? el("span", { class: `ctl-tag ${r.isNew ? "ctl-tag-new" : ""}`, text: r.isNew ? "new" : "existing" }) : null,
          ]),
          el("td", {}, r.facts.length ? el("ol", { class: "ctl-ptable-facts" }, r.facts.map((f) => el("li", {}, [
            el("span", { text: f.text }),
            el("span", { class: "ctl-muted", text: ` · ${plural(f.letters, "letter")}` }),
            ...f.errors.map((m) => el("span", { class: "ctl-err", text: m })),
            ...f.warnings.map((m) => el("span", { class: "ctl-warn", text: m })),
          ]))) : el("span", { class: "ctl-muted", text: "—" })),
          el("td", {}, r.errors.length
            ? r.errors.map((m) => el("span", { class: "ctl-err", text: m }))
            : [el("span", { class: "ctl-ok", text: "OK" }), ...rowWarn.map((m) => el("span", { class: "ctl-warn", text: m }))]),
        ]);
      })),
    ]);
    return el("div", { class: "ctl-preview" }, [
      el("div", { class: "ctl-table-wrap" }, table),
      el("div", { class: "ctl-actions" }, [
        button(`Save ${plural(good.length, "person", "people")}`, { primary: true, k: "paste-save", disabled: !good.length, onclick: doSavePaste }),
        el("span", { class: "ctl-muted", text: good.length < rows.length ? `${rows.length - good.length} line(s) with errors will be skipped.` : "Facts with identical text keep their used state." }),
      ]),
    ]);
  }

  function doSavePaste() {
    const rows = E.parseQuickPaste(pasteArea.value, store.state.players);
    const n = act((d, now) => E.applyQuickPaste(d, rows, now) || false, { backup: "Before quick paste" });
    if (!n) { toast("Nothing was saved.", "error"); return; }
    toast(`Saved ${plural(n, "person", "people")}. Export a backup when you are done.`);
    pasteArea.value = "";
    ui.paste = "";
    ui.pasteRows = null;
    ui.pasteV++;
    render();
  }

  function doAddPlayer() {
    const name = addInput.value.trim();
    if (!name) { addInput.focus(); return; }
    if (store.state.players.some((p) => E.slug(p.name) === E.slug(name))) { toast(`${name} is already on the list.`, "error"); return; }
    const p = act((d) => E.addPlayer(d, name) || false);
    if (!p) return;
    addInput.value = "";
    ui.open.add(p.id);
    ui.search = "";
    searchInput.value = "";
    render();
    const target = cardSlots.get(p.id);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    target?.querySelector(`[data-k="fact-${p.id}-0"]`)?.focus({ preventScroll: true });
  }

  function buildPlayerCard(s, p, dups) {
    const open = ui.open.has(p.id);
    const isHost = s.settings.hostId === p.id;
    const facts = p.facts.filter(E.hasFact);
    const used = facts.filter((f) => f.usedOn).length;
    const bad = facts.some((f) => E.layoutPhrase(f.text).errors.length);
    const headBtn = el("button", {
      type: "button", class: "ctl-pcard-head", "aria-expanded": String(open), "data-k": `pc-${p.id}`, "data-keep": "",
      onclick: () => {
        if (open) ui.open.delete(p.id);
        else ui.open.add(p.id);
        renderPlayers(store.state);
        if (!writer) lockInputs();
      },
    }, [
      dot(p),
      el("span", { class: "ctl-pcard-name", text: p.name }),
      isHost ? el("span", { class: "ctl-tag ctl-tag-host", text: "host" }) : null,
      bad ? el("span", { class: "ctl-tag ctl-tag-err", text: "check facts" }) : null,
      el("span", { class: "ctl-pcard-meta", text: `${plural(facts.length, "fact")} · ${used} used` }),
      el("span", { class: "ctl-chev", "aria-hidden": "true" }),
    ]);
    if (!open) return el("div", { class: "ctl-pcard" }, [headBtn]);

    const nameIn = el("input", {
      type: "text", class: "ctl-input", value: p.name, maxlength: "40", "data-k": `name-${p.id}`, "aria-label": "Name",
      onchange: (e) => {
        const v = e.target.value.trim();
        if (!v) { e.target.value = p.name; toast("A name cannot be empty.", "error"); return; }
        act((d) => E.renamePlayer(d, p.id, v));
      },
    });
    const inTurn = s.turn?.pid === p.id;
    return el("div", { class: "ctl-pcard is-open" }, [
      headBtn,
      el("div", { class: "ctl-pcard-body" }, [
        el("label", { class: "ctl-field ctl-field-name" }, [el("span", { text: "Name" }), nameIn]),
        ...[0, 1, 2].map((i) => factSlot(s, p, i, dups)),
        el("div", { class: "ctl-actions" }, [
          button("Remove player", { danger: true, small: true, k: `remove-${p.id}`, disabled: inTurn, title: inTurn ? "They are in the current turn" : null,
            onclick: () => askRemovePlayer(p) }),
        ]),
      ]),
    ]);
  }

  function factSlot(s, p, i, dups) {
    const f = p.facts[i];
    const inPlay = !!f && s.turn?.pid === p.id && s.turn.factId === f.id;
    const check = el("div", { class: "ctl-fcheck" });
    const mini = el("div", { class: "ctl-fmini" });
    const paint = (text) => {
      check.replaceChildren();
      mini.replaceChildren();
      if (!text.trim()) {
        if (f) check.append(el("span", { class: "ctl-warn", text: "Empty — this fact will be deleted." }));
        return;
      }
      const l = E.layoutPhrase(text);
      if (!l.errors.length) {
        check.append(el("span", { class: "ctl-ok", text: plural(l.letters, "tile") }));
        mini.append(tilePreview(l, "xs"));
      }
      l.errors.forEach((m) => check.append(el("span", { class: "ctl-err", text: m })));
      l.warnings.forEach((m) => check.append(el("span", { class: "ctl-warn", text: m })));
      const same = (dups.get(normKey(text)) || []).filter((x) => x.fid !== f?.id);
      if (same.length) check.append(el("span", { class: "ctl-warn", text: `Same fact as ${same.map((x) => (x.pid === p.id ? "another of theirs" : x.name)).join(", ")}` }));
    };
    const input = el("input", {
      type: "text", class: "ctl-input", value: f?.text || "", placeholder: `Fact ${i + 1}`, maxlength: "140",
      "data-k": `fact-${p.id}-${i}`, "aria-label": `${p.name} — fact ${i + 1}`, disabled: inPlay,
      oninput: (e) => paint(e.target.value),
      // Emptying a field deletes that fact: keep a backup first, facts exist only in this browser.
      onchange: (e) => act((d, now) => E.editFact(d, p.id, i, e.target.value, now),
        f && !e.target.value.trim() ? { backup: `Before deleting ${p.name}'s fact ${i + 1}` } : undefined),
    });
    // After a focus-preserving rebuild the input may hold a draft: validate what is shown.
    input.addEventListener("ctl-restored", () => paint(input.value));
    paint(f?.text || "");
    return el("div", { class: "ctl-fslot" }, [
      el("label", { class: "ctl-fslot-label", text: `Fact ${i + 1}` }),
      input,
      check,
      mini,
      f ? el("div", { class: "ctl-fused" }, [
        el("span", { class: f.usedOn ? "ctl-used-yes" : "ctl-muted", text: inPlay ? "In play right now — edit it after the turn" : f.usedOn ? `Used on ${fmtDay(f.usedOn)}` : "Not used yet" }),
        button(f.usedOn ? "Mark unused" : "Mark used", { small: true, k: `used-${f.id}`, disabled: inPlay,
          onclick: () => act((d, now) => E.setFactUsed(d, p.id, f.id, !f.usedOn, now)) }),
      ]) : null,
    ]);
  }

  async function askRemovePlayer(p) {
    const ok = await dialog({
      title: `Remove ${p.name}?`,
      body: ["Their facts are deleted too. A backup is saved first (Settings & data → Backups)."],
      actions: [{ label: "Cancel", value: "" }, { label: "Remove player", value: "yes", danger: true }],
    });
    if (ok !== "yes") return;
    if (act((d) => E.removePlayer(d, p.id), { backup: `Before removing ${p.name}` })) {
      ui.open.delete(p.id);
      toast(`${p.name} removed.`);
    }
  }

  /* ============================================================
     SETTINGS & DATA tab
     ============================================================ */

  function renderSettings(s) {
    patch(st.main, `${s.epoch}|${s.rev}|${ui.v}`, () => buildSettings(s));
  }

  function numInput({ k, value, min, max, step = 1, label, onSet, cls = "" }) {
    return el("input", {
      type: "number", class: `ctl-input ctl-num ${cls}`, min: String(min), max: String(max), step: String(step), value: String(value),
      "data-k": k, "aria-label": label,
      onchange: (e) => {
        const v = Number(e.target.value);
        if (e.target.value === "" || !Number.isFinite(v) || v < min || v > max) {
          toast(`${label}: enter a number from ${min} to ${max}.`, "error");
          e.target.value = String(value);
          return;
        }
        act((d) => onSet(d, v));
      },
    });
  }

  function radio(name, value, current, label, k, onPick) {
    return el("label", { class: "ctl-radio" }, [
      el("input", { type: "radio", name, value, checked: current === value, "data-k": k, onchange: () => act((d) => onPick(d, value)) }),
      el("span", {}, label),
    ]);
  }

  function buildSettings(s) {
    const set = s.settings;
    const hostSel = el("select", {
      class: "ctl-select", "data-k": "host", "aria-label": "Host", value: set.hostId || "",
      onchange: (e) => {
        if (!act((d) => E.setHost(d, e.target.value || null))) {
          toast("They already have a place in this turn: remove it first.", "error");
          e.target.value = set.hostId || "";
        }
      },
    }, [el("option", { value: "", text: "No host" }), ...[...s.players].sort(byName).map((p) => el("option", { value: p.id, text: p.name }))]);

    const tierRows = set.bonusTiers.map(([h, b], i) => el("div", { class: "ctl-tier" }, [
      "if at least ",
      numInput({ k: `tier-h-${i}`, value: h, min: 1, max: 100, label: `Bonus tier ${i + 1} — % hidden`,
        onSet: (d, v) => { d.settings.bonusTiers[i][0] = v; d.settings.bonusTiers.sort((a, c) => c[0] - a[0]); } }),
      "% hidden → +",
      numInput({ k: `tier-b-${i}`, value: b, min: 0, max: 20, label: `Bonus tier ${i + 1} — points`, onSet: (d, v) => { d.settings.bonusTiers[i][1] = v; } }),
    ]));

    const gameCard = card("ctl-settings", [
      el("h2", { class: "ctl-h2", text: "Game settings" }),
      el("div", { class: "ctl-form" }, [
        el("div", { class: "ctl-row" }, [
          el("span", { class: "ctl-row-label", text: "Timer" }),
          el("div", { class: "ctl-row-body" }, [
            numInput({ k: "set-timer", value: set.timerSec, min: 10, max: 600, label: "Timer seconds", onSet: (d, v) => { d.settings.timerSec = v; } }),
            " seconds per turn",
          ]),
        ]),
        el("div", { class: "ctl-row" }, [
          el("span", { class: "ctl-row-label", text: "Reveal pace" }),
          el("div", { class: "ctl-row-body ctl-stack" }, [
            el("div", { class: "ctl-radio-line" }, [
              radio("ctl-pace", "auto", set.pace, "Auto — about ", "pace-auto", (d, v) => { d.settings.pace = v; }),
              numInput({ k: "set-target", value: Math.round(set.autoTarget * 100), min: 40, max: 100, label: "Auto target %",
                onSet: (d, v) => { d.settings.autoTarget = v / 100; } }),
              " % of the tiles are uncovered when the timer ends",
            ]),
            el("div", { class: "ctl-radio-line" }, [
              radio("ctl-pace", "fixed", set.pace, "Fixed every ", "pace-fixed", (d, v) => { d.settings.pace = v; }),
              numInput({ k: "set-reveal", value: set.revealSec, min: 0.5, max: 20, step: 0.5, label: "Fixed reveal seconds", onSet: (d, v) => { d.settings.revealSec = v; } }),
              " s",
            ]),
          ]),
        ]),
        el("div", { class: "ctl-row" }, [
          el("span", { class: "ctl-row-label", text: "Points" }),
          el("div", { class: "ctl-row-body ctl-inline" }, set.places.map((pts, i) => el("label", { class: "ctl-mini-field" }, [
            el("span", { text: ordinal(i + 1) }),
            numInput({ k: `set-place-${i}`, value: pts, min: 0, max: 20, label: `Points for ${ordinal(i + 1)}`, onSet: (d, v) => { d.settings.places[i] = v; } }),
          ]))),
        ]),
        el("div", { class: "ctl-row" }, [
          el("span", { class: "ctl-row-label", text: "Speed bonus" }),
          el("div", { class: "ctl-row-body ctl-stack" }, [
            ...tierRows,
            el("div", { class: "ctl-radio-line" }, [
              el("span", { text: "Bonus for: " }),
              radio("ctl-scope", "all", set.bonusScope, "All three places", "scope-all", (d, v) => { d.settings.bonusScope = v; }),
              radio("ctl-scope", "first", set.bonusScope, "1st place only", "scope-first", (d, v) => { d.settings.bonusScope = v; }),
            ]),
          ]),
        ]),
        el("div", { class: "ctl-row" }, [
          el("span", { class: "ctl-row-label", text: "Countdown tick" }),
          el("div", { class: "ctl-row-body" }, [
            "in the last ",
            numInput({ k: "set-tick", value: set.tickLastSec, min: 0, max: 30, label: "Countdown tick seconds", onSet: (d, v) => { d.settings.tickLastSec = v; } }),
            " seconds (0 = off)",
          ]),
        ]),
        el("div", { class: "ctl-row" }, [
          el("span", { class: "ctl-row-label", text: "Host" }),
          el("div", { class: "ctl-row-body ctl-stack" }, [
            hostSel,
            el("p", { class: "ctl-muted", text: "The host knows every fact: never placeable and not in the standings, but stays on the wheel." }),
          ]),
        ]),
      ]),
    ]);

    const drawn = s.cycle.drawn.map((id) => E.findPlayer(s, id)?.name).filter(Boolean);
    const wheelCard = card("ctl-settings", [
      el("h2", { class: "ctl-h2", text: "Wheel" }),
      el("p", {}, [el("strong", { text: `Round ${s.cycle.round}` }), ` · drawn so far: ${drawn.length ? drawn.join(", ") : "nobody yet"}`]),
      el("p", { class: "ctl-muted", text: "People drawn in this round are off the wheel until everyone with facts has had a turn." }),
      el("div", { class: "ctl-actions" }, [button("Start a new wheel round", { k: "new-round", onclick: askNewRound })]),
    ]);

    const backups = store.backups();
    const unreadable = store.unreadableCopies();
    const dataCard = card("ctl-settings", [
      el("h2", { class: "ctl-h2", text: "Data" }),
      el("p", { class: "ctl-note", text: `Data lives only in this browser at ${store.origin}. Use Export to back it up or move it to another computer — then open the same address there and Import.` }),
      el("div", { class: "ctl-actions" }, [
        button("Export JSON", { primary: true, k: "export", onclick: doExport }),
        button("Import JSON…", { k: "import", onclick: () => fileInput.click() }),
        el("span", { class: "ctl-muted", text: `Last export: ${s.meta.lastExportAt ? fmtStamp(s.meta.lastExportAt) : "never"}` }),
      ]),
      el("h3", { class: "ctl-h3", text: "Backups in this browser" }),
      backups.length ? el("ul", { class: "ctl-backups" }, backups.map((b, i) => el("li", {}, [
        el("span", { class: "ctl-backup-when", text: fmtStamp(b.at) }),
        el("span", { class: "ctl-backup-why", text: b.reason }),
        button("Restore", { small: true, k: `restore-${i}`, onclick: () => askRestore(i, b) }),
      ]))) : el("p", { class: "ctl-muted", text: "None yet: a backup is saved automatically before every big change." }),
      el("h3", { class: "ctl-h3", text: "Reset facts" }),
      el("p", { class: "ctl-muted", text: "Makes every fact available again and starts a new wheel round. Scores are kept." }),
      el("div", { class: "ctl-actions" }, [button("Reset facts", { k: "reset-facts", onclick: askResetFacts })]),
      unreadable.length ? el("div", {}, [
        el("h3", { class: "ctl-h3", text: "Saved data that could not be read" }),
        el("ul", { class: "ctl-backups" }, unreadable.map((u) => el("li", {}, [
          el("span", { class: "ctl-backup-when", text: u.at ? fmtStamp(u.at) : "?" }),
          el("span", { class: "ctl-backup-why", text: "Kept as it was" }),
          button("Download", { small: true, k: `unreadable-${u.at}`, onclick: () => download(u.text, `fun-friday-${demo ? "demo-" : ""}backup-unreadable-${u.at}.json`) }),
        ]))),
      ]) : null,
      el("div", { class: "ctl-danger" }, [
        el("h3", { class: "ctl-h3", text: "Danger zone" }),
        el("p", { class: "ctl-muted", text: "Erase everything: players, facts, scores and settings go back to the start. A backup is kept." }),
        button("Erase everything…", { danger: true, k: "erase", onclick: askErase }),
        el("p", { class: "ctl-muted", text: "End of the season: delete every trace of the game from this browser — the game, all backups and any unreadable copies. Export first." }),
        button("Delete all game data from this browser…", { danger: true, k: "purge", onclick: askPurge }),
      ]),
    ]);

    const demoCard = demo ? card("ctl-settings ctl-demo-card", [
      el("h2", { class: "ctl-h2", text: "Demo" }),
      el("p", { text: "This is the DEMO: invented players and facts, stored apart from the real game." }),
      el("div", { class: "ctl-actions" }, [button("Reset demo", { k: "reset-demo", onclick: askResetDemo })]),
    ]) : null;

    return [demoCard, el("div", { class: "ctl-settings-grid" }, [
      el("div", { class: "ctl-col" }, [gameCard]),
      el("div", { class: "ctl-col" }, [wheelCard, dataCard]),
    ])];
  }

  /* ---------- data actions ---------- */

  function download(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = el("a", { href: url, download: name, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function doExport() {
    const json = store.exportJSON();
    const name = `fun-friday-${demo ? "demo-" : ""}backup-${fileStamp()}.json`;
    download(json, name);
    toast(`Exported ${name}`);
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let text = "";
    try {
      text = await file.text();
    } catch (err) {
      await dialog({ title: "Import failed", body: ["The file could not be read."], actions: [{ label: "OK", value: "ok", primary: true }] });
      return;
    }
    const res = store.parseImport(text);
    if (!res.ok) {
      await dialog({ title: "Import failed", body: [res.error], actions: [{ label: "OK", value: "ok", primary: true }] });
      return;
    }
    const kind = res.state.meta?.demo ? "the DEMO" : "the real game";
    const go = await dialog({
      title: "Import this backup?",
      body: [
        el("p", { class: "ctl-dialog-strong", text: res.summary }),
        el("p", { text: `File: ${file.name} — from ${kind}.` }),
        el("p", { text: "It replaces what this Control holds now. Your current data is saved as a backup first." }),
      ],
      actions: [{ label: "Cancel", value: "" }, { label: "Import", value: "yes", primary: true }],
    });
    if (go === "yes" && store.applyImport(res.state)) toast("Backup imported.");
  }

  async function askRestore(i, b) {
    const ok = await dialog({
      title: "Restore this backup?",
      body: [`${fmtStamp(b.at)} — ${b.reason}.`, "Your current data is saved as a backup first."],
      actions: [{ label: "Cancel", value: "" }, { label: "Restore", value: "yes", primary: true }],
    });
    if (ok === "yes" && store.restoreBackup(i)) toast("Backup restored.");
  }

  async function askResetFacts() {
    const ok = await dialog({
      title: "Reset facts?",
      body: ["Every fact becomes available again and a new wheel round starts. Scores are kept. A backup is saved first."],
      actions: [{ label: "Cancel", value: "" }, { label: "Reset facts", value: "yes", danger: true }],
    });
    if (ok === "yes" && act((d) => E.resetFacts(d), { backup: "Before reset facts" })) toast("All facts are available again.");
  }

  async function askNewRound() {
    const ok = await dialog({
      title: "Start a new wheel round?",
      body: ["Everyone with unused facts goes back on the wheel. Facts stay as they are."],
      actions: [{ label: "Cancel", value: "" }, { label: "New round", value: "yes", primary: true }],
    });
    if (ok === "yes" && act((d) => E.resetCycle(d), { backup: "Before new wheel round" })) toast("New wheel round.");
  }

  async function askErase() {
    const ok = await dialog({
      title: "Erase everything?",
      body: ["Players, facts, scores and settings go back to the start. A backup is kept in this browser, but export one first if you can.", "Type ERASE to confirm."],
      input: { placeholder: "ERASE", match: "ERASE" },
      actions: [{ label: "Cancel", value: "" }, { label: "Erase everything", value: "yes", danger: true, needsMatch: true }],
    });
    if (ok === "yes" && store.resetEverything()) {
      ui.open.clear();
      toast("Everything was erased. A backup is in the list.");
    }
  }

  async function askPurge() {
    const ok = await dialog({
      title: "Delete all game data from this browser?",
      body: ["The game, every backup and any unreadable copy are removed from this browser. Only an exported file can bring them back.", "Type DELETE to confirm."],
      input: { placeholder: "DELETE", match: "DELETE" },
      actions: [{ label: "Cancel", value: "" }, { label: "Delete everything", value: "yes", danger: true, needsMatch: true }],
    });
    if (ok === "yes" && store.purgeAll()) {
      ui.open.clear();
      toast("All game data was deleted from this browser.");
    }
  }

  async function askResetDemo() {
    const ok = await dialog({
      title: "Reset the demo?",
      body: ["The invented players and facts come back and demo scores go to zero."],
      actions: [{ label: "Cancel", value: "" }, { label: "Reset demo", value: "yes", primary: true }],
    });
    if (ok === "yes" && store.resetEverything()) toast("Demo reset.");
  }

  /* ---------- dialogs & toasts ---------- */

  function dialog({ title, body = [], actions, input = null, focus = null }) {
    return new Promise((resolve) => {
      const id = `ctl-dlg-${Math.random().toString(36).slice(2, 8)}`;
      const field = input ? el("input", { type: "text", class: "ctl-input", placeholder: input.placeholder, autocomplete: "off", "aria-label": input.placeholder }) : null;
      const btns = actions.map((a) => el("button", {
        type: "submit", value: a.value || "cancel",
        class: ["btn", a.primary && "btn-primary", a.danger && "ctl-btn-danger-solid"].filter(Boolean).join(" "),
        disabled: !!(a.needsMatch && input), text: a.label,
      }));
      if (field) {
        field.addEventListener("input", () => {
          actions.forEach((a, i) => { if (a.needsMatch) btns[i].disabled = field.value.trim() !== input.match; });
        });
      }
      const dlg = el("dialog", { class: "ctl-dialog", "aria-labelledby": id }, [
        el("form", { method: "dialog" }, [
          el("h2", { class: "ctl-dialog-title", id, text: title }),
          ...body.map((b) => (typeof b === "string" ? el("p", { text: b }) : b)),
          field,
          el("div", { class: "ctl-dialog-actions" }, btns),
        ]),
      ]);
      dlg.addEventListener("close", () => {
        const v = dlg.returnValue;
        dlg.remove();
        resolve(v && v !== "cancel" ? v : null);
      });
      document.body.append(dlg);
      dlg.showModal();
      if (field) field.focus();
      else if (focus) btns[actions.findIndex((a) => a.value === focus)]?.focus();
    });
  }

  function toast(msg, kind = "ok") {
    const t = el("div", { class: `ctl-toast ctl-toast-${kind}`, text: msg });
    toasts.append(t);
    setTimeout(() => {
      t.classList.add("is-out");
      setTimeout(() => t.remove(), 300);
    }, TOAST_MS);
  }

  /* ---------- boot ---------- */

  store.subscribe(() => scheduleRender());
  store.onBoardStatus(() => renderHead(Date.now()));

  let firstTab = null;
  try { firstTab = sessionStorage.getItem(TAB_KEY); } catch (e) { /* private mode */ }
  if (!TABS.some((t) => t.id === firstTab)) {
    firstTab = store.state.players.some((p) => p.facts.some(E.hasFact)) ? "game" : "players";
  }
  setTab(firstTab);
  requestAnimationFrame(tick);
}
