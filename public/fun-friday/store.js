// Wheel of Facts · FUN Friday — saved state and window sync
// Everything lives in this browser's localStorage: the real fun facts are typed or imported
// on the page and never belong in the code or the repo. The Control window is the only writer;
// the Board reads the same key and listens on a BroadcastChannel (plus the storage event).

import { SCHEMA_VERSION, DEFAULT_SETTINGS, MAX_FACTS, emptySession, slug, uid } from "./engine.js";

export const DEFAULT_PLAYERS = [
  "Abhijeet", "Alejandro", "Antoine", "Chelsea", "Daniel", "Dhruti", "Francesco", "Ivjyot", "Jai", "Joel",
  "Michael", "Naiara", "Oliver", "Preethi", "Rakesh", "Samkit", "Shatadal", "Somia", "Sowmya", "Steven",
];
export const DEFAULT_HOST = "francesco";

// Demo mode only: invented people and invented facts, for rehearsals and the index preview.
export const DEMO_PLAYERS = [
  ["Ada", "I once ate pizza on a glacier", "I can juggle four lemons", "My first job was in a circus"],
  ["Bruno", "I have climbed a volcano twice", "I collect tiny spoons", "I was born during a blizzard"],
  ["Clara", "I taught my parrot to whistle jazz", "I have never seen snow", "I ran a marathon in a costume"],
  ["Dario", "I sang karaoke with a famous chef", "I own forty board games", "I learned to sail at sixty"],
  ["Elsa", "I slept one night in a lighthouse", "I speak five languages badly", "I once met a real astronaut"],
  ["Felix", "I built my own electric guitar", "I have a twin who lives in Peru", "I can solve a cube in a minute"],
  ["Gaia", "I once danced on a moving train", "I grew a pumpkin of thirty kilos", "I have visited forty countries"],
  ["Hugo", "I got lost in a desert for a day", "I bake bread every single Sunday", "My cat has its own passport"],
  ["Iris", "I swam with sharks in Australia", "I was a TV extra in a soap opera", "I knit sweaters for my dogs"],
  ["Jonas", "I once won a pie eating contest", "I have read every Tintin book", "I skated across a frozen lake"],
  ["Kira", "I lived on a boat for two years", "I can draw with both hands", "I met my partner at a bus stop"],
  ["Leo", "I have a black belt in karate", "I once cooked for three hundred", "I played drums in a punk band"],
  ["Maya", "I trained as a circus acrobat", "I have ridden a camel in Egypt", "I can name every world capital"],
  ["Nico", "I once missed a flight by a minute", "I grow chillies on my balcony", "I have jumped out of a plane"],
  ["Olga", "I was a champion chess player", "I once hiked across Iceland", "I sleep with socks all year"],
  ["Pablo", "I invented a card game at ten", "I have eaten a whole tarantula", "I can whistle like a bird"],
  ["Rosa", "I once rescued a lost baby goat", "I have a tattoo of a pineapple", "I learned to surf in Portugal"],
  ["Sven", "I built a treehouse with my dad", "I have been on live radio twice", "I cannot ride a bicycle"],
  ["Tara", "I sold lemonade to a movie star", "I have two left handed brothers", "I once slept in an ice hotel"],
  ["Victor", "I biked from Paris to Rome", "I collect old vinyl records", "I was a lifeguard for ten years"],
];

export function defaultState({ demo = false, now = Date.now() } = {}) {
  const players = demo
    ? DEMO_PLAYERS.map(([name, ...facts], i) => ({
        id: slug(name), name, color: i,
        facts: facts.map((text) => ({ id: uid("f"), text, usedOn: null })),
      }))
    : DEFAULT_PLAYERS.map((name, i) => ({ id: slug(name), name, color: i, facts: [] }));
  return {
    schemaVersion: SCHEMA_VERSION,
    epoch: uid("e"),
    rev: 0,
    savedAt: now,
    settings: { ...DEFAULT_SETTINGS, hostId: demo ? null : DEFAULT_HOST },
    players,
    cycle: { drawn: [], round: 1 },
    session: emptySession(now),
    pastSessions: [],
    turn: null,
    undo: null,
    board: { overlay: null, overlayAt: 0, showMini: true, wheelDeg: 0 },
    meta: { createdAt: now, lastExportAt: null, factsChangedAt: null, demo },
  };
}

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const isNum = Number.isFinite;
const num = (v, lo, hi, fallback) => (isNum(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const PHASES = ["pick", "ready", "running", "revealed"];

function cleanSettings(raw, base, ids) {
  const r = isObj(raw) ? raw : {};
  const s = { ...base };
  s.timerSec = num(r.timerSec, 10, 600, base.timerSec);
  s.revealSec = num(r.revealSec, 0.5, 20, base.revealSec);
  s.autoTarget = num(r.autoTarget, 0.4, 1, base.autoTarget);
  s.tickLastSec = num(r.tickLastSec, 0, 30, base.tickLastSec);
  s.pace = ["auto", "fixed"].includes(r.pace) ? r.pace : base.pace;
  s.bonusScope = ["all", "first"].includes(r.bonusScope) ? r.bonusScope : base.bonusScope;
  s.muted = typeof r.muted === "boolean" ? r.muted : base.muted;
  if (Array.isArray(r.places) && r.places.length >= 1 && r.places.length <= 3 && r.places.every((p) => isNum(p) && p >= 0)) {
    s.places = r.places.slice();
  }
  if (Array.isArray(r.bonusTiers) && r.bonusTiers.every((x) => Array.isArray(x) && x.length === 2 && x.every(isNum))) {
    s.bonusTiers = r.bonusTiers.map((x) => x.slice()).sort((a, b) => b[0] - a[0]);
  }
  s.hostId = r.hostId === null || ids.has(r.hostId) ? (r.hostId ?? null) : base.hostId && ids.has(base.hostId) ? base.hostId : null;
  return s;
}

const cleanResult = (r) => isObj(r) && typeof r.pid === "string" && isNum(r.points) && isNum(r.place);

function cleanTurn(t, players) {
  if (!isObj(t) || !PHASES.includes(t.phase)) return null;
  const p = players.find((x) => x.id === t.pid);
  if (!p || (t.factId && !p.facts.some((f) => f.id === t.factId))) return null;
  if (!["results", "marks", "order"].every((k) => Array.isArray(t[k]))) return null;
  if (t.phase !== "pick" && !(isNum(t.durMs) && t.durMs > 0 && isNum(t.intervalMs) && t.intervalMs > 0 && isNum(t.letters))) return null;
  if (t.startedAt != null && !isNum(t.startedAt)) return null;
  if (t.spin && !(isObj(t.spin) && Array.isArray(t.spin.pool) && [t.spin.t0, t.spin.ms, t.spin.fromDeg, t.spin.toDeg].every(isNum))) return null;
  return { ...t, pausedMs: isNum(t.pausedMs) ? t.pausedMs : 0, results: t.results.filter(cleanResult),
    marks: t.marks.filter((m) => isObj(m) && isNum(m.at) && isNum(m.hiddenPct)) };
}

// Fills in anything missing (older or hand-edited files) and drops what cannot be trusted,
// so a damaged file can never break the Control (and hide Import / Restore with it).
export function migrate(input) {
  if (!isObj(input)) throw new Error("Not a Wheel of Facts state.");
  if ((input.schemaVersion ?? 1) > SCHEMA_VERSION) throw new Error("This file comes from a newer version of the game.");
  if (!Array.isArray(input.players)) throw new Error("The file has no players.");
  const base = defaultState({ demo: !!input.meta?.demo });
  const s = { ...base, ...input, schemaVersion: SCHEMA_VERSION };

  const used = new Set();
  s.players = input.players.filter((p) => isObj(p) && String(p.name ?? "").trim()).map((p, i) => {
    let id = String(p.id || slug(p.name) || uid("p"));
    while (used.has(id)) id += "-2";
    used.add(id);
    return {
      id,
      name: String(p.name).trim().slice(0, 40),
      color: Number.isInteger(p.color) ? p.color : i % 20,
      facts: (Array.isArray(p.facts) ? p.facts : [])
        .map((f) => (typeof f === "string" ? { text: f } : f))
        .filter((f) => isObj(f) && String(f.text ?? "").trim())
        .slice(0, MAX_FACTS)
        .map((f) => ({ id: String(f.id || uid("f")), text: String(f.text).trim(), usedOn: typeof f.usedOn === "string" ? f.usedOn : null })),
    };
  });
  const ids = new Set(s.players.map((p) => p.id));

  s.settings = cleanSettings(input.settings, base.settings, ids);
  const b = isObj(input.board) ? input.board : {};
  s.board = { overlay: [null, "leaderboard", "podium"].includes(b.overlay) ? b.overlay : null,
    overlayAt: isNum(b.overlayAt) ? b.overlayAt : 0, showMini: b.showMini !== false, wheelDeg: isNum(b.wheelDeg) ? b.wheelDeg : 0 };
  s.meta = { ...base.meta, ...(isObj(input.meta) ? input.meta : {}) };
  const c = isObj(input.cycle) ? input.cycle : {};
  s.cycle = { drawn: (Array.isArray(c.drawn) ? c.drawn : []).filter((id) => ids.has(id)), round: num(c.round, 1, 1e6, 1) };
  const ss = isObj(input.session) ? input.session : {};
  s.session = { id: String(ss.id || base.session.id), startedOn: String(ss.startedOn || base.session.startedOn),
    turns: (Array.isArray(ss.turns) ? ss.turns : []).filter(isObj).map((t) => ({ ...t, results: (Array.isArray(t.results) ? t.results : []).filter(cleanResult) })),
    adjust: (Array.isArray(ss.adjust) ? ss.adjust : []).filter((a) => isObj(a) && typeof a.pid === "string" && isNum(a.delta)) };
  s.pastSessions = (Array.isArray(input.pastSessions) ? input.pastSessions : []).filter((x) => isObj(x) && Array.isArray(x.top));
  // A turn in progress survives a reload only if its person and fact still exist.
  s.turn = cleanTurn(input.turn, s.players);
  const u = input.undo;
  s.undo = isObj(u) && cleanTurn(u.turn, s.players) && isObj(u.cycleBefore) && Array.isArray(u.cycleBefore.drawn) ? u : null;
  if (typeof s.epoch !== "string") s.epoch = uid("e");
  if (!isNum(s.rev)) s.rev = 0;
  return s;
}

const namespace = (demo) => (demo ? "funfriday-demo" : "funfriday");

// Opens the Board as a normal tab. The window name makes a second click reuse the same tab.
export function openBoard(demo = false) {
  window.open(`/fun-friday/#${demo ? "demo-" : ""}board`, `${namespace(demo)}-board`);
}

// Set when the saved game could not be read at start-up; shown on the Control until reload.
let bootNotice = null;

function readState(key, { keepUnreadable = false } = {}) {
  let raw = null;
  try {
    raw = localStorage.getItem(key);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch (e) {
    console.warn("Wheel of Facts: saved state could not be read", e);
    // Keep a copy of whatever was there before the Control window starts writing again.
    if (keepUnreadable && raw) {
      const copy = `${key}:unreadable-${Date.now()}`;
      try { localStorage.setItem(copy, raw); } catch (err) { /* nothing more to do */ }
      bootNotice = `The saved game could not be read (${e instanceof SyntaxError ? "damaged data" : e.message}). ` +
        "A copy was kept in this browser — download it in Settings & data, or Import your last export.";
    }
    return null;
  }
}

// Newer = another epoch (import / reset) or a higher revision of the same one.
const isNewer = (incoming, current) =>
  !!incoming && (!current || incoming.epoch !== current.epoch || incoming.rev > current.rev);

/* ============ CONTROL: the only writer ============ */

export function createStore({ demo = false } = {}) {
  const ns = namespace(demo);
  const KEY = `${ns}:state`;
  const BACKUPS = `${ns}:backups`;
  const channel = new BroadcastChannel(ns);
  const listeners = new Set();
  const statusListeners = new Set();
  const saved = readState(KEY, { keepUnreadable: true });
  let state = saved || defaultState({ demo });
  let readOnly = false;
  let boardStatus = null;
  let lastError = null;

  const notify = () => listeners.forEach((fn) => fn(state));

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      lastError = null;
    } catch (e) {
      lastError = "Could not save in this browser (storage full or blocked). Export a backup now.";
      console.error(e);
    }
    channel.postMessage({ t: "state", state });
  }

  function backups() {
    try {
      const list = JSON.parse(localStorage.getItem(BACKUPS) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  // Returns false when the backup could not be written: the destructive action is then refused.
  function pushBackup(reason, snapshot) {
    const list = backups();
    list.unshift({ at: Date.now(), reason, state: snapshot });
    try {
      localStorage.setItem(BACKUPS, JSON.stringify(list.slice(0, 10)));
      return true;
    } catch (e) {
      console.warn("Backup not saved", e);
      lastError = "A backup could not be saved (browser storage full), so nothing was changed. Export first, then try again.";
      notify();
      return false;
    }
  }

  // Runs an engine action on a copy of the state. If it returns false nothing is saved.
  function update(action, { backup = null } = {}) {
    if (readOnly) return false;
    const now = Date.now();
    const draft = structuredClone(state);
    const result = action(draft, now);
    if (result === false) return false;
    if (backup && !pushBackup(backup, state)) return false;
    draft.rev = state.rev + 1;
    draft.savedAt = now;
    state = draft;
    persist();
    notify();
    return result ?? true;
  }

  function replace(next, reason) {
    if (readOnly) return false;
    if (reason && !pushBackup(reason, state)) return false;
    next.epoch = uid("e");
    next.rev = state.rev + 1;
    next.savedAt = Date.now();
    state = next;
    persist();
    notify();
    return true;
  }

  // A Board opened before this window is waiting on its "hello": send the state right away
  // (and save a fresh namespace once, so a Board opened later finds it in localStorage).
  if (!saved) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* reported on the first real save */ }
  }
  channel.postMessage({ t: "state", state });

  channel.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.t === "hello") channel.postMessage({ t: "state", state });
    else if (msg.t === "status") {
      boardStatus = { ...msg, at: Date.now() };
      statusListeners.forEach((fn) => fn(boardStatus));
      // The Board is ahead of us (a save failed, then this window was reloaded): jump past its
      // revision so it accepts our state again instead of showing a turn that no longer exists.
      if (!readOnly && msg.epoch === state.epoch && msg.rev > state.rev) {
        state = { ...state, rev: msg.rev + 1 };
        persist();
        notify();
      }
    } else if (msg.t === "state" && readOnly && isNewer(msg.state, state)) {
      state = msg.state; // a second Control window just follows the first one
      notify();
    }
  };

  // Only one Control window may write. Returns a promise of true (writer) or false (read-only).
  // A read-only window queues for the lock and reloads as the writer when the other one closes.
  function claimControl() {
    if (!navigator.locks) return Promise.resolve(true);
    const name = `${ns}-control`;
    return new Promise((resolve) => {
      navigator.locks.request(name, { ifAvailable: true }, (lock) => {
        if (!lock) {
          readOnly = true;
          resolve(false);
          navigator.locks.request(name, () => {
            location.reload();
            return new Promise(() => {});
          }).catch(() => {});
          return undefined;
        }
        resolve(true);
        return new Promise(() => {}); // hold the lock for the life of this window
      }).catch(() => resolve(true));
    });
  }

  // Everything this namespace keeps in the browser: state, backups, unreadable copies.
  const ownKeys = () => Object.keys(localStorage).filter((k) => k === KEY || k === BACKUPS || k.startsWith(`${KEY}:unreadable-`));

  return {
    demo,
    get state() { return state; },
    get readOnly() { return readOnly; },
    get boardStatus() { return boardStatus; },
    get lastError() { return lastError || bootNotice; },
    origin: location.origin,
    update,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onBoardStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); },
    claimControl,
    backups,

    exportJSON() {
      const now = Date.now();
      update((s) => { s.meta.lastExportAt = now; });
      return JSON.stringify({ app: "wheel-of-facts", schemaVersion: SCHEMA_VERSION, exportedAt: new Date(now).toISOString(), state }, null, 2);
    },
    // Validates a file's text. Returns { ok, state, summary } or { ok: false, error }.
    parseImport(text) {
      try {
        const data = JSON.parse(text);
        const raw = isObj(data) && data.app === "wheel-of-facts" ? data.state : data;
        const next = migrate(raw);
        const facts = next.players.reduce((n, p) => n + p.facts.length, 0);
        const used = next.players.reduce((n, p) => n + p.facts.filter((f) => f.usedOn).length, 0);
        return { ok: true, state: next, summary: `${next.players.length} players, ${facts} facts (${used} used), ${next.session.turns.length} turns in the current FUN Friday` };
      } catch (e) {
        return { ok: false, error: e instanceof SyntaxError ? "This is not a valid JSON file." : e.message };
      }
    },
    applyImport(next) { return replace(migrate(structuredClone(next)), "Before import"); },
    restoreBackup(i) {
      const b = backups()[i];
      return b ? replace(migrate(structuredClone(b.state)), "Before restoring a backup") : false;
    },
    resetEverything() { return replace(defaultState({ demo }), "Before reset"); },
    // Copies kept when a saved game could not be read: [{ key, at, text }].
    unreadableCopies() {
      return ownKeys().filter((k) => k.includes(":unreadable-"))
        .map((k) => ({ key: k, at: Number(k.split("-").pop()) || 0, text: localStorage.getItem(k) || "" }));
    },
    // End of season: removes every fact from this browser (state, backups, unreadable copies).
    purgeAll() {
      if (readOnly) return false;
      ownKeys().forEach((k) => localStorage.removeItem(k));
      bootNotice = null;
      lastError = null;
      return replace(defaultState({ demo }), null);
    },
  };
}

/* ============ BOARD: read-only follower ============ */

export function connectBoard({ demo = false, onState }) {
  const ns = namespace(demo);
  const KEY = `${ns}:state`;
  const channel = new BroadcastChannel(ns);
  let state = readState(KEY);

  const accept = (incoming) => {
    if (!isNewer(incoming, state)) return;
    state = incoming;
    onState(state);
  };

  channel.onmessage = (e) => {
    if (e.data?.t === "state") accept(e.data.state);
  };
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue) {
      try { accept(migrate(JSON.parse(e.newValue))); } catch (err) { /* ignore a half-written value */ }
    }
  });

  // After connectBoard has returned, so onState may already use the returned link.
  if (state) queueMicrotask(() => onState(state));
  channel.postMessage({ t: "hello" });

  return {
    get state() { return state; },
    sendStatus(status) { channel.postMessage({ t: "status", ...status }); },
  };
}
