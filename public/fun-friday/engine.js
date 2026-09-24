// Wheel of Facts · FUN Friday — game engine
// Pure logic, no DOM and no storage: phrase layout, turn clock, wheel, scoring, standings.
// Both windows derive everything from the saved state + Date.now(), so a throttled or
// reloaded window always catches up. Mutators change the draft they receive (see store.update).

export const SCHEMA_VERSION = 1;
export const MAX_FACTS = 3;
export const SPIN_MS = 6000;

// Each player keeps one colour (player.color = index). Dark and light shades alternate, so
// neighbours on the wheel stay distinct; fg is the readable text colour on that slice.
export const PALETTE = [
  { bg: "#0176D3", fg: "#FFFFFF" }, { bg: "#FE9339", fg: "#032D60" },
  { bg: "#06A59A", fg: "#FFFFFF" }, { bg: "#FCC003", fg: "#032D60" },
  { bg: "#9050E9", fg: "#FFFFFF" }, { bg: "#45C65A", fg: "#032D60" },
  { bg: "#E3066A", fg: "#FFFFFF" }, { bg: "#1AB9FF", fg: "#032D60" },
  { bg: "#014486", fg: "#FFFFFF" }, { bg: "#FFB75D", fg: "#032D60" },
  { bg: "#0B827C", fg: "#FFFFFF" }, { bg: "#FF8BAE", fg: "#032D60" },
  { bg: "#7526E3", fg: "#FFFFFF" }, { bg: "#91DB8B", fg: "#032D60" },
  { bg: "#BA0517", fg: "#FFFFFF" }, { bg: "#AACBFF", fg: "#032D60" },
  { bg: "#2E844A", fg: "#FFFFFF" }, { bg: "#D17DFE", fg: "#032D60" },
  { bg: "#C23934", fg: "#FFFFFF" }, { bg: "#78E5E6", fg: "#032D60" },
];
export const WHEEL_COLORS = PALETTE.length;
export const colorOf = (player) => PALETTE[((player?.color ?? 0) % WHEEL_COLORS + WHEEL_COLORS) % WHEEL_COLORS];

/* ---------- small helpers ---------- */

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function randomFloat() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 4294967296;
}

export const randomInt = (n) => Math.floor(randomFloat() * n);

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uid(prefix = "") {
  const b = new Uint32Array(2);
  crypto.getRandomValues(b);
  return prefix + b[0].toString(36) + b[1].toString(36);
}

// Case- and accent-insensitive key, used for ids and to match pasted names.
export const slug = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036F]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ---------- defaults ---------- */

export const DEFAULT_SETTINGS = {
  timerSec: 60,
  pace: "auto",            // "auto" = interval chosen per phrase, "fixed" = revealSec
  revealSec: 3,
  autoTarget: 0.75,        // share of tiles revealed when the timer ends (auto pace)
  places: [3, 2, 1],
  bonusTiers: [[75, 3], [50, 2], [25, 1]],   // % still hidden >= first → +second
  bonusScope: "all",       // "all" = every place gets the speed bonus, "first" = only 1st
  hostId: null,            // the host knows every fact: never placeable, not in standings
  muted: false,
  tickLastSec: 10,
};

export function emptySession(now = Date.now()) {
  return { id: uid("s"), startedOn: todayISO(new Date(now)), turns: [], adjust: [] };
}

/* ---------- phrases → tiles ---------- */

// Always visible on the board (never hidden, never counted as tiles to guess).
export const PUNCTUATION = "'-,.!?&:;()/\"%\u20AC$\u00A3#+@\u00A1\u00BF\u00AB\u00BB";
export const MAX_COLS = 14;
export const HARD_MAX_COLS = 16;
export const MAX_ROWS = 4;
// Tile area of the 1920×1080 board stage. board.js lays tiles out with the same numbers.
export const BOARD_AREA = { w: 1760, h: 540, gap: 14, aspect: 0.8 };

export function normalizePhrase(text) {
  return String(text ?? "")
    .normalize("NFC")
    .replace(/[\uFB00-\uFB06]/g, (c) => c.normalize("NFKC"))
    .replace(/[\u2018\u2019\u201B\u2032`\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, "\"")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

export const isLetter = (ch) => /^[\p{L}\p{N}]$/u.test(ch);

// Upper-case one character at a time and keep the original when the length would change (ß → SS).
function upper(ch) {
  if (ch === "\u00DF") return "\u1E9E";
  const u = ch.toLocaleUpperCase("en");
  return [...u].length === 1 ? u : ch;
}

// Tile size in px for a grid, inside BOARD_AREA (width-limited or height-limited).
export function tileSize(cols, rows, area = BOARD_AREA) {
  const byW = (area.w - (cols - 1) * area.gap) / cols;
  const byH = ((area.h - (rows - 1) * area.gap) / rows) * area.aspect;
  const w = Math.floor(Math.min(byW, byH, 150));
  return { w, h: Math.floor(w / area.aspect), gap: area.gap };
}

function wrap(words, cols) {
  const lines = [];
  let cur = [];
  let len = 0;
  for (const w of words) {
    const add = cur.length ? len + 1 + w.length : w.length;
    if (cur.length && add > cols) {
      lines.push(cur);
      cur = [w];
      len = w.length;
    } else {
      cur.push(w);
      len = add;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

const lineLength = (line) => line.reduce((n, w) => n + w.length, 0) + line.length - 1;

// Lays a phrase out as rows of cells, never splitting a word, choosing the grid that gives
// the biggest tiles (then fewer rows, then the most even lines).
// Cell: { ch, kind: "letter" | "punct" | "space", li } — li is the hidden-tile index (-1 if not a letter).
export function layoutPhrase(raw) {
  const text = normalizePhrase(raw);
  const errors = [];
  const warnings = [];
  const out = { text, rows: [], cols: 0, letters: 0, errors, warnings };
  if (!text) {
    errors.push("The fact is empty.");
    return out;
  }
  const chars = [...text];
  const bad = [...new Set(chars.filter((c) => c !== " " && !isLetter(c) && !PUNCTUATION.includes(c)))];
  if (bad.length) errors.push(`Unsupported character${bad.length > 1 ? "s" : ""}: ${bad.join(" ")}`);

  const words = text.split(" ").map((w) => [...w]);
  const longest = Math.max(...words.map((w) => w.length));
  if (longest > HARD_MAX_COLS) errors.push(`A word is longer than ${HARD_MAX_COLS} letters.`);
  if (errors.length) return out;

  let best = null;
  for (let cols = longest; cols <= HARD_MAX_COLS; cols++) {
    const lines = wrap(words, cols);
    if (lines.length > MAX_ROWS) continue;
    const widest = Math.max(...lines.map(lineLength));
    const size = tileSize(widest, lines.length).w;
    const ragged = lines.reduce((s, l) => s + (widest - lineLength(l)) ** 2, 0);
    const cand = { lines, widest, size, ragged };
    if (!best || size > best.size ||
        (size === best.size && (lines.length < best.lines.length ||
          (lines.length === best.lines.length && ragged < best.ragged)))) best = cand;
  }
  if (!best) {
    errors.push(`Too long: it does not fit in ${MAX_ROWS} rows of ${HARD_MAX_COLS} tiles.`);
    return out;
  }

  let li = 0;
  out.rows = best.lines.map((line) => {
    const cells = [];
    line.forEach((word, wi) => {
      if (wi) cells.push({ ch: " ", kind: "space", li: -1 });
      for (const c of word) {
        if (isLetter(c)) cells.push({ ch: upper(c), kind: "letter", li: li++ });
        else cells.push({ ch: c, kind: "punct", li: -1 });
      }
    });
    return cells;
  });
  out.cols = best.widest;
  out.letters = li;
  if (best.widest > MAX_COLS) warnings.push("Long phrase: the tiles will be smaller than usual.");
  if (li < 12) warnings.push("Very short: it will be guessed quickly.");
  if (li > 40) warnings.push("More than 40 letters: consider shortening it.");
  if (li === 0) errors.push("There are no letters to guess.");
  return out;
}

/* ---------- players & facts ---------- */

export const hasFact = (f) => !!(f && normalizePhrase(f.text));
export const openFacts = (p) => p.facts.filter((f) => hasFact(f) && !f.usedOn);
export const findPlayer = (state, pid) => state.players.find((p) => p.id === pid) || null;
export const findFact = (player, factId) => (player ? player.facts.find((f) => f.id === factId) || null : null);

export function nextColor(state) {
  const used = new Set(state.players.map((p) => p.color));
  for (let c = 0; c < WHEEL_COLORS; c++) if (!used.has(c)) return c;
  return state.players.length % WHEEL_COLORS;
}

export function addPlayer(state, name) {
  const clean = String(name ?? "").trim();
  if (!clean) return null;
  let id = slug(clean) || uid("p");
  while (state.players.some((p) => p.id === id)) id += "-2";
  const p = { id, name: clean, color: nextColor(state), facts: [] };
  state.players.push(p);
  return p;
}

// Replaces a player's facts (quick paste). A fact whose text is unchanged keeps its id and used state.
export function setFacts(player, texts) {
  const old = player.facts.slice();
  player.facts = texts.map((t) => String(t ?? "").trim()).filter(Boolean).slice(0, MAX_FACTS).map((text) => {
    const same = old.find((f) => normalizePhrase(f.text) === normalizePhrase(text));
    if (!same) return { id: uid("f"), text, usedOn: null };
    old.splice(old.indexOf(same), 1);
    return { ...same, text };
  });
}

// Per-person editor: changes one slot. Fixing a typo keeps the fact's id and used state.
export function editFact(state, pid, index, text, now = Date.now()) {
  const p = findPlayer(state, pid);
  if (!p || index < 0 || index >= MAX_FACTS) return false;
  if (state.turn?.pid === pid && state.turn.factId === p.facts[index]?.id) return false;
  const clean = String(text ?? "").trim();
  const f = p.facts[index];
  if (f && clean) f.text = clean;
  else if (f) p.facts.splice(index, 1);
  else if (clean) p.facts.push({ id: uid("f"), text: clean, usedOn: null });
  else return false;
  state.meta.factsChangedAt = now;
  return true;
}

export function setFactUsed(state, pid, factId, used, now = Date.now()) {
  const f = findFact(findPlayer(state, pid), factId);
  if (!f) return false;
  f.usedOn = used ? todayISO(new Date(now)) : null;
  return true;
}

export function renamePlayer(state, pid, name) {
  const p = findPlayer(state, pid);
  const clean = String(name ?? "").trim();
  if (!p || !clean) return false;
  p.name = clean;
  return true;
}

export function removePlayer(state, pid) {
  if (!findPlayer(state, pid) || state.turn?.pid === pid) return false;
  state.players = state.players.filter((p) => p.id !== pid);
  state.cycle.drawn = state.cycle.drawn.filter((id) => id !== pid);
  if (state.settings.hostId === pid) state.settings.hostId = null;
  if (state.turn?.results.some((r) => r.pid === pid)) {
    state.turn.results = state.turn.results.filter((r) => r.pid !== pid);
    rescore(state);
  }
  state.undo = null;
  return true;
}

export function setHost(state, pid) {
  if (pid && !findPlayer(state, pid)) return false;
  if (pid && state.turn?.results.some((r) => r.pid === pid)) return false;
  state.settings.hostId = pid || null;
  return true;
}

// "Name | fact 1 | fact 2 | fact 3", one line per person. Returns a preview; nothing is changed.
export function parseQuickPaste(text, players) {
  const rows = [];
  const seen = new Set();
  String(text ?? "").split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split("|").map((s) => s.trim());
    const name = parts[0];
    const facts = parts.slice(1).filter((s) => s !== "");
    const row = { line: i + 1, name, player: null, isNew: false, facts: [], errors: [], warnings: [] };
    if (!name) row.errors.push("Missing name.");
    const key = slug(name);
    row.player = players.find((p) => slug(p.name) === key) || null;
    row.isNew = !row.player && !!name;
    if (row.isNew) row.warnings.push("New player: will be added.");
    if (seen.has(key)) row.errors.push("This name appears twice.");
    seen.add(key);
    if (!facts.length) row.errors.push("No facts on this line.");
    if (facts.length > MAX_FACTS) row.errors.push(`More than ${MAX_FACTS} facts.`);
    else if (facts.length && facts.length < MAX_FACTS) row.warnings.push(`Only ${facts.length} fact${facts.length > 1 ? "s" : ""}.`);
    row.facts = facts.map((t) => {
      const l = layoutPhrase(t);
      return { text: t, errors: l.errors, warnings: l.warnings, letters: l.letters };
    });
    if (row.facts.some((f) => f.errors.length)) row.errors.push("A fact has errors.");
    if (name.length > 40) row.errors.push("Name longer than 40 characters.");
    // A line replaces the person's list: say so when facts they have now would disappear.
    const gone = row.player ? row.player.facts.filter((f) => !facts.some((t) => normalizePhrase(t) === normalizePhrase(f.text))) : [];
    if (gone.length) {
      const used = gone.filter((f) => f.usedOn).length;
      row.warnings.push(`Replaces ${gone.length} current fact${gone.length > 1 ? "s" : ""}${used ? ` (${used} already used)` : ""}.`);
    }
    rows.push(row);
  });
  return rows;
}

export function applyQuickPaste(state, rows, now = Date.now()) {
  let changed = 0;
  for (const row of rows) {
    if (row.errors.length) continue;
    const p = findPlayer(state, row.player?.id) || addPlayer(state, row.name);
    if (!p || (state.turn?.pid === p.id && state.turn.factId)) continue;
    setFacts(p, row.facts.map((f) => f.text));
    changed++;
  }
  if (changed) state.meta.factsChangedAt = now;
  return changed;
}

/* ---------- wheel ---------- */

// Everyone with an unused fact who has not been drawn in this cycle, in roster order.
// When everybody has been drawn, the cycle starts again with everyone who still has facts.
export function wheelPool(state) {
  const withFacts = state.players.filter((p) => openFacts(p).length);
  const drawn = new Set(state.cycle.drawn);
  const pool = withFacts.filter((p) => !drawn.has(p.id));
  return (pool.length ? pool : withFacts).map((p) => p.id);
}

const easeOutQuart = (t) => 1 - (1 - t) ** 4;

// Wheel geometry: slice i covers [i·s, (i+1)·s) degrees clockwise from 12 o'clock (s = 360/count).
// The wheel is drawn rotated clockwise by `deg`; the pointer is fixed at 12 o'clock.
export function sliceUnderPointer(deg, count) {
  const a = (((-deg) % 360) + 360) % 360;
  return Math.floor(a / (360 / count)) % count;
}

export function planSpin(pool, targetId, fromDeg) {
  const s = 360 / pool.length;
  const i = pool.indexOf(targetId);
  const landing = (i + 0.15 + 0.7 * randomFloat()) * s;       // somewhere safely inside the slice
  const base = ((fromDeg % 360) + 360) % 360;
  const want = (360 - landing) % 360;
  const delta = (want - base + 360) % 360;
  return { fromDeg, toDeg: fromDeg + (5 + randomInt(2)) * 360 + delta };
}

export function spinAngle(spin, now) {
  const t = clamp((now - spin.t0) / spin.ms, 0, 1);
  return spin.fromDeg + (spin.toDeg - spin.fromDeg) * easeOutQuart(t);
}

export const spinDone = (spin, now) => !spin || now >= spin.t0 + spin.ms;

// Angle the wheel is resting at (or passing through) right now.
export function wheelAngle(state, now) {
  const spin = state.turn?.spin;
  return spin ? spinAngle(spin, now) : state.board.wheelDeg;
}

/* ---------- turn clock ---------- */

export function paceMs(settings, letters) {
  if (settings.pace === "fixed") return Math.round(clamp(settings.revealSec, 0.5, 20) * 1000);
  const ms = (settings.timerSec * 1000) / (Math.max(1, letters) * settings.autoTarget);
  // Rounded down, so the share uncovered at the buzzer is never below the target.
  return clamp(Math.floor(ms / 100) * 100, 1000, 8000);
}

// Everything time-dependent about a turn, at instant `now`.
export function turnClock(turn, now) {
  const n = turn?.letters || 0;
  const base = { started: false, elapsed: 0, remaining: turn?.durMs || 0, progress: 0, byClock: 0,
    revealed: 0, hiddenPct: 100, timeUp: false, paused: false };
  if (!turn || turn.phase === "pick") return base;
  if (!turn.startedAt) return { ...base, revealed: turn.phase === "revealed" ? n : 0 };
  let stop = turn.pausedAt ?? now;
  if (turn.revealedAt) stop = Math.min(stop, turn.revealedAt);
  const elapsed = clamp(stop - turn.startedAt - turn.pausedMs, 0, turn.durMs);
  const byClock = Math.min(n, Math.floor(elapsed / turn.intervalMs));
  return {
    started: true,
    elapsed,
    remaining: turn.durMs - elapsed,
    progress: turn.durMs ? elapsed / turn.durMs : 1,
    byClock,                                        // tiles uncovered by the clock
    revealed: turn.phase === "revealed" ? n : byClock,
    hiddenPct: n ? (100 * (n - byClock)) / n : 0,   // what the speed bonus is measured on
    timeUp: elapsed >= turn.durMs,
    paused: !!turn.pausedAt && turn.phase === "running",
  };
}

/* ---------- scoring ---------- */

export function bonusFor(hiddenPct, tiers) {
  for (const [min, pts] of tiers) if (hiddenPct >= min - 1e-9) return pts;
  return 0;
}

export function scoreFor(place, hiddenPct, settings) {
  const base = settings.places[place - 1] ?? 0;
  const bonus = settings.bonusScope === "first" && place !== 1 ? 0 : bonusFor(hiddenPct, settings.bonusTiers);
  return { base, bonus, points: base + bonus };
}

// Who can be given a place in the current turn.
export function canPlace(state, pid) {
  const t = state.turn;
  if (!t || !t.startedAt || !["running", "revealed"].includes(t.phase)) return false;
  if (pid === t.pid || pid === state.settings.hostId) return false;
  if (t.results.some((r) => r.pid === pid)) return false;
  return t.results.length < state.settings.places.length && !!findPlayer(state, pid);
}

// Live standings (host excluded). Equal points are ordered by the number of 1st places, then 2nd,
// then 3rd; only a full tie shares the rank (1, 1, 3).
export function standings(state, { includeCurrent = true } = {}) {
  const rows = new Map();
  for (const p of state.players) {
    if (p.id === state.settings.hostId) continue;
    rows.set(p.id, { pid: p.id, name: p.name, color: p.color, points: 0, firsts: 0, seconds: 0, thirds: 0, turnDelta: 0 });
  }
  const addResult = (r, current) => {
    const row = rows.get(r.pid);
    if (!row) return;
    row.points += r.points;
    if (current) row.turnDelta += r.points;
    if (r.place === 1) row.firsts++;
    else if (r.place === 2) row.seconds++;
    else if (r.place === 3) row.thirds++;
  };
  for (const t of state.session.turns) t.results.forEach((r) => addResult(r, false));
  if (includeCurrent && state.turn) state.turn.results.forEach((r) => addResult(r, true));
  for (const a of state.session.adjust) {
    const row = rows.get(a.pid);
    if (row) row.points += a.delta;
  }
  const list = [...rows.values()].sort((a, b) =>
    b.points - a.points || b.firsts - a.firsts || b.seconds - a.seconds || b.thirds - a.thirds ||
    a.name.localeCompare(b.name));
  // Same rule as the podium: a shared rank only when points and places are all equal.
  list.forEach((r, i) => {
    r.rank = i && rankKey(list[i - 1]) === rankKey(r) ? list[i - 1].rank : i + 1;
  });
  return list;
}

const rankKey = (r) => [r.points, r.firsts, r.seconds, r.thirds].join("/");

// Podium steps 1–3 (only players with points). Full ties share a step.
export function podium(list) {
  const steps = [];
  let position = 0;
  list.filter((r) => r.points > 0).forEach((r, i, arr) => {
    if (!i || rankKey(arr[i - 1]) !== rankKey(r)) position = i + 1;
    if (position > 3) return;
    const step = steps.find((s) => s.position === position);
    if (step) step.players.push(r);
    else steps.push({ position, players: [r] });
  });
  return steps;
}

/* ---------- actions (mutate the draft; return false to refuse) ---------- */

function newTurn(pid, spin) {
  return { id: uid("t"), phase: "pick", pid, spin, factId: null, text: "", letters: 0, order: [],
    intervalMs: 0, durMs: 0, startedAt: null, pausedAt: null, pausedMs: 0, revealedAt: null,
    marks: [], results: [] };
}

export function spinWheel(state, now, { exclude = [] } = {}) {
  const t = state.turn;
  if (t && !["pick", "ready"].includes(t.phase)) return false;
  const pool = wheelPool(state);
  if (!pool.length) return false;
  const candidates = pool.filter((id) => !exclude.includes(id));
  const choices = candidates.length ? candidates : pool;
  const target = choices[randomInt(choices.length)];
  const { fromDeg, toDeg } = planSpin(pool, target, wheelAngle(state, now));
  state.turn = newTurn(target, { t0: now, ms: SPIN_MS, pool, fromDeg, toDeg });
  state.board.overlay = null;
  state.undo = null;
  return target;
}

export const respin = (state, now) => spinWheel(state, now, { exclude: state.turn ? [state.turn.pid] : [] });

export function pickPlayer(state, pid, now) {
  const t = state.turn;
  if (t && !["pick", "ready"].includes(t.phase)) return false;
  const p = findPlayer(state, pid);
  if (!p || !p.facts.some(hasFact)) return false;
  if (t?.spin) state.board.wheelDeg = spinAngle(t.spin, now) % 360;
  state.turn = newTurn(pid, null);
  state.board.overlay = null;
  state.undo = null;
  return true;
}

export function chooseFact(state, factId, now) {
  const t = state.turn;
  if (!t || !["pick", "ready"].includes(t.phase) || !spinDone(t.spin, now)) return false;
  const fact = findFact(findPlayer(state, t.pid), factId);
  if (!fact || !hasFact(fact)) return false;
  const layout = layoutPhrase(fact.text);
  if (layout.errors.length) return false;
  // "Change fact" keeps a timer the host already set for this turn, and a hand-set interval.
  const autoFor = (letters) => paceMs({ ...state.settings, timerSec: (t.durMs || state.settings.timerSec * 1000) / 1000 }, letters);
  const handSet = t.phase === "ready" && t.intervalMs !== autoFor(t.letters);
  t.durMs = t.durMs || state.settings.timerSec * 1000;
  t.intervalMs = handSet ? t.intervalMs : autoFor(layout.letters);
  t.factId = fact.id;
  t.text = layout.text;
  t.letters = layout.letters;
  t.order = shuffle([...Array(layout.letters).keys()]);
  t.phase = "ready";
  return true;
}

// Timer length and reveal interval can be changed until the turn starts.
export function setTurnTiming(state, { timerSec, intervalSec }) {
  const t = state.turn;
  if (!t || t.phase !== "ready") return false;
  if (timerSec) t.durMs = Math.round(clamp(timerSec, 10, 600) * 1000);
  if (intervalSec) t.intervalMs = Math.round(clamp(intervalSec, 0.5, 20) * 1000);
  return true;
}

export function startTurn(state, now) {
  const t = state.turn;
  if (!t || t.phase !== "ready") return false;
  t.phase = "running";
  t.startedAt = now;
  t.pausedAt = null;
  t.pausedMs = 0;
  return true;
}

export function togglePause(state, now) {
  const t = state.turn;
  if (!t || t.phase !== "running" || turnClock(t, now).timeUp) return false;
  if (t.pausedAt) {
    t.pausedMs += now - t.pausedAt;
    t.pausedAt = null;
  } else {
    t.pausedAt = now;
  }
  return true;
}

export function revealAll(state, now) {
  const t = state.turn;
  if (!t || !["ready", "running"].includes(t.phase)) return false;
  t.phase = "revealed";
  t.revealedAt = now;
  return true;
}

// Space bar: "someone got it!" — freezes the instant for the next place you click.
export function markGotOne(state, now) {
  const t = state.turn;
  if (!t || !t.startedAt || !["running", "revealed"].includes(t.phase)) return false;
  if (t.results.length + t.marks.length >= state.settings.places.length) return false;
  t.marks.push({ at: now, hiddenPct: turnClock(t, now).hiddenPct });
  return true;
}

function rescore(state) {
  state.turn.results.forEach((r, i) => {
    r.place = i + 1;
    Object.assign(r, scoreFor(r.place, r.hiddenPct, state.settings));
  });
}

export function assignPlace(state, pid, now) {
  if (!canPlace(state, pid)) return false;
  const t = state.turn;
  // Without a Space mark, a place given after "Reveal all" gets no speed bonus: the phrase is on screen.
  const mark = t.marks.shift() || { at: now, hiddenPct: t.phase === "revealed" ? 0 : turnClock(t, now).hiddenPct };
  t.results.push({ pid, place: 0, at: mark.at, hiddenPct: mark.hiddenPct, base: 0, bonus: 0, points: 0 });
  rescore(state);
  return true;
}

export function removePlace(state, pid) {
  const t = state.turn;
  if (!t) return false;
  const before = t.results.length;
  t.results = t.results.filter((r) => r.pid !== pid);
  if (t.results.length === before) return false;
  rescore(state);
  return true;
}

// Z after a misclick: the instant that answer was marked goes back in the queue for the right name.
export function undoLastPlace(state) {
  const t = state.turn;
  if (!t || !t.results.length) return false;
  const r = t.results.pop();
  t.marks.unshift({ at: r.at, hiddenPct: r.hiddenPct });
  rescore(state);
  return true;
}

export function clearMarks(state) {
  if (!state.turn?.marks.length) return false;
  state.turn.marks = [];
  return true;
}

export function cancelTurn(state, now) {
  const t = state.turn;
  if (!t) return false;
  if (t.spin) state.board.wheelDeg = spinAngle(t.spin, now) % 360;
  state.turn = null;
  return true;
}

// Ends the turn: the fact and the person are used only now, so Cancel/Re-spin never cost anything.
export function commitTurn(state, now) {
  const t = state.turn;
  if (!t || t.phase !== "revealed") return false;
  const p = findPlayer(state, t.pid);
  const fact = findFact(p, t.factId);
  // Only what this commit changes is remembered, so "Undo last turn" never touches later edits.
  state.undo = { at: now, turn: structuredClone(t), usedOnBefore: fact ? fact.usedOn : null,
    cycleBefore: structuredClone(state.cycle), wheelDegBefore: state.board.wheelDeg };
  if (fact) fact.usedOn = todayISO(new Date(now));
  if (p && !state.cycle.drawn.includes(p.id)) state.cycle.drawn.push(p.id);
  const stillToDraw = state.players.filter((x) => openFacts(x).length && !state.cycle.drawn.includes(x.id));
  if (!stillToDraw.length) {
    state.cycle.drawn = [];
    state.cycle.round++;
  }
  state.session.turns.push({ id: t.id, pid: t.pid, factId: t.factId, text: t.text, at: now,
    results: t.results.map((r) => ({ ...r })) });
  if (t.spin) state.board.wheelDeg = t.spin.toDeg % 360;
  state.turn = null;
  return true;
}

// Puts the last finished turn back as it was just before "Next turn" (phrase revealed).
// Only that turn is undone: players or facts edited since then stay as they are.
export function undoLastTurn(state) {
  const u = state.undo;
  if (!u || state.turn) return false;
  const p = findPlayer(state, u.turn.pid);
  const fact = findFact(p, u.turn.factId);
  if (!fact) return false;
  fact.usedOn = u.usedOnBefore;
  const ids = new Set(state.players.map((x) => x.id));
  state.cycle = { ...u.cycleBefore, drawn: u.cycleBefore.drawn.filter((id) => ids.has(id)) };
  state.session.turns = state.session.turns.filter((x) => x.id !== u.turn.id);
  state.board.wheelDeg = u.wheelDegBefore;
  state.turn = u.turn;
  state.turn.results = state.turn.results.filter((r) => ids.has(r.pid));
  state.undo = null;
  return true;
}

export function adjustPoints(state, pid, delta, now) {
  if (!findPlayer(state, pid) || pid === state.settings.hostId || !delta) return false;
  state.session.adjust.push({ pid, delta, at: now });
  state.undo = null;
  return true;
}

export function newFunFriday(state, now) {
  const list = standings(state, { includeCurrent: false });
  if (state.session.turns.length || state.session.adjust.length) {
    state.pastSessions.unshift({ id: state.session.id, startedOn: state.session.startedOn,
      endedOn: todayISO(new Date(now)), turns: state.session.turns.length,
      top: list.filter((r) => r.points > 0).slice(0, 5).map((r) => ({ name: r.name, points: r.points })) });
    state.pastSessions = state.pastSessions.slice(0, 20);
  }
  if (state.turn?.spin) state.board.wheelDeg = spinAngle(state.turn.spin, now) % 360;
  state.session = emptySession(now);
  state.turn = null;
  state.undo = null;
  state.board.overlay = null;
  return true;
}

export function resetFacts(state) {
  state.players.forEach((p) => p.facts.forEach((f) => { f.usedOn = null; }));
  state.cycle = { drawn: [], round: 1 };
  state.undo = null;
  return true;
}

export function resetCycle(state) {
  state.cycle.drawn = [];
  state.cycle.round++;
  return true;
}

// Board overlays: null | "leaderboard" | "podium". Same value again = close it.
export function toggleOverlay(state, overlay, now) {
  state.board.overlay = state.board.overlay === overlay ? null : overlay;
  state.board.overlayAt = now;
  return true;
}

export function toggleMiniLeaderboard(state) {
  state.board.showMini = !state.board.showMini;
  return true;
}
