// Wheel of Facts · FUN Friday — Board window
// What the team sees in Meet: wheel, tile board, timer, overlays, and every sound. Display only:
// each frame is rendered from the saved state + Date.now(), and an unrevealed letter never enters the DOM.

import { PALETTE, BOARD_AREA, clamp, colorOf, layoutPhrase, tileSize, wheelPool, sliceUnderPointer,
  spinDone, wheelAngle, turnClock, standings, podium, findPlayer } from "./engine.js";
import { connectBoard } from "./store.js";
import { createSound } from "./sound.js";

/* ---------- constants ---------- */

const STAGE_W = 1920;
const STAGE_H = 1080;
const SVG_NS = "http://www.w3.org/2000/svg";
const WHEEL_R = 440;             // slice radius in the wheel's 1000×1000 viewBox (drawn at 1000 px)
const HUB_R = 74;
const LABEL_INSET = 30;          // gap between a name and the rim
const TIMER_R = 128;
const TIMER_C = 2 * Math.PI * TIMER_R;
const MEDAL_COLORS = ["#FCC003", "#D8DDE6", "#E8A15B"];
const RING_COLORS = { normal: "#0176D3", warn: "#FE9339", over: "#EA001E", paused: "#8FA3BF" };
const B_PHASES = ["ready", "running", "revealed"];
const PODIUM_REVEAL_MS = { 3: 800, 2: 2000, 1: 3400 };
const PODIUM_LATE_MS = 4000;     // a board (re)loaded later than this shows the final podium at once
const CONFETTI_MS = 4500;
const CONFETTI_PIECES = 160;
const CASCADE_MS = 70;
const RESYNC_GAP_MS = 1500;      // a longer gap between frames (hidden or frozen tab) = catch up silently
const CLICK_MIN_MS = 40;
const WHOOSH_WINDOW_MS = 500;
const STATUS_EVERY_MS = 2000;

/* ---------- DOM helpers ---------- */

function setProps(node, props) {
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") node.setAttribute("class", v);
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v; // static strings only
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
}

function addChildren(node, children) {
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c);
  }
  return node;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  setProps(node, props);
  return addChildren(node, children);
}

function svgEl(tag, props = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  setProps(node, props);
  return addChildren(node, children);
}

function readFlag(key) {
  try { return sessionStorage.getItem(key) === "1"; } catch (e) { return false; }
}

function writeFlag(key) {
  try { sessionStorage.setItem(key, "1"); } catch (e) { /* private mode: the overlay just comes back on reload */ }
}

/* ---------- wheel geometry ---------- */

// Same convention as engine.sliceUnderPointer: angles clockwise from 12 o'clock; SVG y points down.
const polar = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};
const fmt = (n) => Math.round(n * 100) / 100;

function slicePath(i, s, r) {
  if (s >= 360) return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  const [x1, y1] = polar(r, i * s);
  const [x2, y2] = polar(r, (i + 1) * s);
  return `M 0 0 L ${fmt(x1)} ${fmt(y1)} A ${r} ${r} 0 ${s > 180 ? 1 : 0} 1 ${fmt(x2)} ${fmt(y2)} Z`;
}

// Name size by slice count: about 41 px for 20 slices, capped for a few big slices.
const labelSize = (n) => clamp(Math.round(WHEEL_R * ((2 * Math.PI) / n) * 0.3), 28, 60);

/* ---------- static stage ---------- */

function buildStage(root, demo) {
  const ui = {};
  root.textContent = "";
  ui.stage = el("div", { class: "bd-stage", "data-mode": "wait" });

  ui.wait = el("div", { class: "bd-wait" }, [
    el("p", { class: "bd-eyebrow", text: "FUN FRIDAY" }),
    el("h1", { class: "bd-wait-title", text: "Wheel of Facts" }),
    el("p", { class: "bd-wait-text", text: "Waiting for the Control window…" }),
    el("p", { class: "bd-wait-text", text: `open /fun-friday/#${demo ? "demo-" : ""}control on the laptop` }),
  ]);

  // Wheel: rotating group (slices, pegs) + fixed rim, hub and pointer.
  ui.slices = svgEl("g", { class: "bd-slices" });
  ui.rot = svgEl("g", { class: "bd-rot" }, [ui.slices]);
  ui.wheelSvg = svgEl("svg", { class: "bd-wheel", viewBox: "-500 -500 1000 1000", width: 1000, height: 1000, "aria-hidden": "true" }, [
    svgEl("circle", { class: "bd-rim-outer", r: WHEEL_R + 27 }),
    svgEl("circle", { class: "bd-rim", r: WHEEL_R + 12 }),
    ui.rot,
    svgEl("text", { class: "bd-wheel-empty", x: 0, y: 190, "text-anchor": "middle", "dominant-baseline": "central", text: "No facts left" }),
    svgEl("circle", { class: "bd-hub", r: HUB_R }),
    svgEl("circle", { class: "bd-hub-dot", r: 18 }),
    svgEl("polygon", { class: "bd-pointer", points: "-38,-492 38,-492 0,-414" }),
  ]);
  ui.wheelWrap = el("div", { class: "bd-wheel-wrap" }, [ui.wheelSvg]);

  // Layout A: right panel.
  ui.headA = el("div", { class: "bd-head-a" });
  ui.miniRows = el("div", { class: "bd-mini-rows" });
  ui.mini = el("div", { class: "bd-mini" }, [el("p", { class: "bd-mini-label", text: "Leaderboard" }), ui.miniRows]);
  ui.side = el("div", { class: "bd-side" }, [
    el("div", { class: "bd-side-inner" }, [
      el("p", { class: "bd-eyebrow", text: "FUN FRIDAY" }),
      el("h1", { class: "bd-title", text: "Wheel of Facts" }),
      ui.headA,
      ui.mini,
    ]),
  ]);

  // Layout B: header, timer, tile board, status chips, leaderboard strip.
  ui.headB = el("div", { class: "bd-head-b" });
  ui.ring = svgEl("circle", { class: "bd-ring", r: TIMER_R, transform: "rotate(-90)", "stroke-dasharray": fmt(TIMER_C), "stroke-dashoffset": 0 });
  ui.digits = el("span", { class: "bd-digits", text: "" });
  ui.tlabel = el("span", { class: "bd-tlabel", text: "" });
  ui.timer = el("div", { class: "bd-timer" }, [
    svgEl("svg", { viewBox: "-150 -150 300 300", width: 300, height: 300, "aria-hidden": "true" }, [
      svgEl("circle", { class: "bd-ring-bg", r: TIMER_R }),
      ui.ring,
    ]),
    el("div", { class: "bd-timer-text" }, [ui.digits, ui.tlabel]),
  ]);
  ui.tiles = el("div", { class: "bd-tiles" });
  ui.status = el("div", { class: "bd-status" });
  ui.strip = el("div", { class: "bd-strip" });
  ui.turn = el("div", { class: "bd-turn" }, [
    ui.headB, ui.timer, el("div", { class: "bd-panel" }), ui.tiles, ui.status, ui.strip,
  ]);

  // Overlays, confetti, demo badge, start overlay.
  ui.overlay = el("div", { class: "bd-overlay" });
  ui.confetti = el("canvas", { class: "bd-confetti", width: STAGE_W, height: STAGE_H, hidden: true });
  ui.demo = demo ? el("div", { class: "bd-demo", text: "DEMO" }) : null;
  ui.start = el("div", { class: "bd-start" }, [
    el("p", { class: "bd-start-title", text: "Click anywhere to start the board" }),
    el("p", { class: "bd-start-text", text: "Turns on sound and full screen. Do this before you present it in Meet." }),
  ]);

  addChildren(ui.stage, [ui.wait, ui.side, ui.turn, ui.wheelWrap, ui.overlay, ui.confetti, ui.demo, ui.start]);
  root.append(ui.stage);
  return ui;
}

/* ---------- mount ---------- */

export function mountBoard(root, { demo = false } = {}) {
  const ns = demo ? "funfriday-demo" : "funfriday";
  const START_KEY = `${ns}:board-started`;
  const sound = createSound();
  window.__funfridaySound = sound; // test hook: lets a harness observe which sounds play
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ui = buildStage(root, demo);

  let link = null;
  let state = null;
  let derivedFor = null;   // the state object `cur` was computed for
  let jumped = true;       // boot or another epoch: catch up without sounds or animations
  let lastFrameAt = 0;
  let started = readFlag(START_KEY);
  let wakeLock = null;
  let guards = null;       // one-shot sound guards, keyed by turn id
  let tiles = null;        // { key, cells: Map(li → { node, flip, back, ch }), shown }
  let pod = null;          // podium overlay staging
  let confetti = null;
  let fanfareFor = null;   // overlayAt of the podium that already had its fanfare
  let clearTimer = 0;
  const keys = {};
  const cur = { pool: [], wheelPlayers: [], player: null, list: [], miniKey: "", standKey: "" };
  const fits = [];         // text that must shrink to fit; re-measured once the web font is in
  const labelBase = new WeakMap();

  /* ---------- stage scaling ---------- */

  function fitStage() {
    const sc = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    const x = (window.innerWidth - STAGE_W * sc) / 2;
    const y = (window.innerHeight - STAGE_H * sc) / 2;
    ui.stage.style.transform = `translate(${fmt(x)}px, ${fmt(y)}px) scale(${sc})`;
  }

  /* ---------- text fitting ---------- */

  // Shrinks a single-line element until its layout width fits (transforms do not affect offsetWidth).
  function fitText(node, maxW, px, minPx) {
    node.style.fontSize = `${px}px`;
    const w = node.offsetWidth;
    if (w > maxW) node.style.fontSize = `${Math.max(minPx, Math.floor((px * maxW) / w))}px`;
  }

  function fit(node, maxW, px, minPx) {
    for (let i = fits.length - 1; i >= 0; i--) if (!fits[i].node.isConnected) fits.splice(i, 1);
    fits.push({ node, maxW, px, minPx });
    fitText(node, maxW, px, minPx);
  }

  function refitAll() {
    for (let i = fits.length - 1; i >= 0; i--) {
      const f = fits[i];
      if (!f.node.isConnected) fits.splice(i, 1);
      else fitText(f.node, f.maxW, f.px, f.minPx);
    }
    fitWheelLabels();
  }

  /* ---------- wheel ---------- */

  function renderWheel(players) {
    ui.slices.textContent = "";
    ui.sliceNodes = new Map();
    keys.hl = undefined;
    const n = players.length;
    ui.wheelSvg.classList.toggle("bd-wheel-none", !n);
    if (!n) {
      ui.slices.append(svgEl("circle", { class: "bd-slice-none", r: WHEEL_R }));
      return;
    }
    const s = 360 / n;
    const size = n === 1 ? 72 : labelSize(n);
    players.forEach((p, i) => {
      const c = colorOf(p);
      const d = slicePath(i, s, WHEEL_R);
      const mid = (i + 0.5) * s;
      // Names read from the centre outwards, right-aligned against the rim.
      const label = n === 1
        ? svgEl("text", { class: "bd-slice-label", x: 0, y: 250, fill: c.fg, "font-size": size, "text-anchor": "middle", "dominant-baseline": "central", text: p.name })
        : svgEl("text", { class: "bd-slice-label", x: WHEEL_R - LABEL_INSET, y: 0, fill: c.fg, "font-size": size, "text-anchor": "end",
          "dominant-baseline": "central", transform: `rotate(${fmt(mid - 90)})`, text: p.name });
      labelBase.set(label, { size, maxLen: n === 1 ? 2 * Math.sqrt(WHEEL_R ** 2 - 250 ** 2) - 80 : WHEEL_R - LABEL_INSET - HUB_R - 24 });
      const g = svgEl("g", { class: "bd-slice", "data-pid": p.id }, [
        svgEl("path", { class: "bd-slice-fill", d, fill: c.bg }),
        label,
        svgEl("path", { class: "bd-slice-dim", d }),
      ]);
      ui.slices.append(g);
      ui.sliceNodes.set(p.id, g);
    });
    for (let i = 0; i < n; i++) {
      const [x, y] = polar(WHEEL_R + 12, i * s);
      ui.slices.append(svgEl("circle", { class: "bd-peg", cx: fmt(x), cy: fmt(y), r: 8 }));
    }
    fitWheelLabels();
  }

  // Long names shrink; below 20 px they are squeezed instead, so nothing ever crosses the hub.
  function fitWheelLabels() {
    ui.slices.querySelectorAll(".bd-slice-label").forEach((label) => {
      const base = labelBase.get(label);
      if (!base) return;
      label.setAttribute("font-size", base.size);
      label.removeAttribute("textLength");
      label.removeAttribute("lengthAdjust");
      let len = 0;
      try { len = label.getComputedTextLength(); } catch (e) { len = 0; }
      if (!len) len = [...label.textContent].length * base.size * 0.62;
      if (len <= base.maxLen) return;
      const next = Math.floor((base.size * base.maxLen) / len);
      if (next >= 20) {
        label.setAttribute("font-size", next);
      } else {
        label.setAttribute("font-size", 20);
        label.setAttribute("textLength", fmt(base.maxLen));
        label.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
    });
  }

  function syncWheel(now, t, inB) {
    const deg = wheelAngle(state, now);
    if (deg !== keys.deg) {
      keys.deg = deg;
      ui.rot.setAttribute("transform", `rotate(${deg.toFixed(3)})`);
    }
    // Highlight the drawn person once the wheel has stopped (a manual pick outside the pool: none).
    const known = t && (!t.spin || spinDone(t.spin, now) || inB);
    const hl = known && cur.pool.includes(t.pid) ? t.pid : "";
    if (hl !== keys.hl) {
      keys.hl = hl;
      ui.wheelSvg.classList.toggle("bd-dimmed", !!hl);
      for (const [pid, g] of ui.sliceNodes) g.classList.toggle("bd-target", pid === hl);
    }
  }

  /* ---------- name pills ---------- */

  function namePill(player, cls) {
    const c = colorOf(player);
    return el("span", { class: `bd-pill ${cls}`, style: { background: c.bg, color: c.fg }, text: player?.name ?? "?" });
  }

  /* ---------- layout A: headline ---------- */

  function syncHeadlineA(now, t) {
    let key;
    if (!t) key = "idle";
    else if (t.spin && !spinDone(t.spin, now)) key = "spin";
    else key = `name\u0001${t.pid}\u0001${cur.player?.name}\u0001${cur.player?.color}`;
    if (key === keys.headA) return;
    keys.headA = key;
    ui.headA.textContent = "";
    if (key === "idle") ui.headA.append(el("p", { class: "bd-big", text: "Who's next?" }));
    else if (key === "spin") ui.headA.append(el("p", { class: "bd-big bd-big-spin", text: "Spinning…" }));
    else {
      const pill = namePill(cur.player, "bd-pill-a");
      ui.headA.append(el("p", { class: "bd-its", text: "It's" }), pill);
      fit(pill, 760, 140, 56);
    }
  }

  /* ---------- layout B: header, timer ---------- */

  function syncHeaderB(t) {
    const key = `${t.pid}\u0001${cur.player?.name}\u0001${cur.player?.color}`;
    if (key === keys.headB) return;
    keys.headB = key;
    const pill = namePill(cur.player, "bd-pill-b");
    ui.headB.textContent = "";
    ui.headB.append(el("p", { class: "bd-from", text: "Fun fact from" }), pill);
    fit(pill, 1160, 110, 50);
  }

  function syncTimer(t, clock) {
    const tickMs = (state.settings.tickLastSec ?? 10) * 1000;
    const rem = Math.max(0, clock.remaining);
    const frac = t.durMs ? clamp(rem / t.durMs, 0, 1) : 0;
    let label;
    let tone;
    if (!clock.started) {
      label = t.phase === "ready" ? "READY" : "sec";
      tone = "normal";
    } else if (clock.timeUp) {
      label = "TIME'S UP";
      tone = "over";
    } else if (clock.paused) {
      label = "PAUSED";
      tone = "paused";
    } else {
      label = "sec";
      tone = rem <= tickMs ? "warn" : "normal";
    }
    const off = fmt(TIMER_C * (1 - frac));
    if (off !== keys.ringOff) {
      keys.ringOff = off;
      ui.ring.setAttribute("stroke-dashoffset", off);
      ui.ring.style.opacity = frac > 0.002 ? "1" : "0"; // a round cap would leave a dot at zero
    }
    if (tone !== keys.tone) {
      keys.tone = tone;
      ui.ring.style.stroke = RING_COLORS[tone];
      ui.timer.dataset.tone = tone;
    }
    const digits = String(Math.ceil(rem / 1000));
    if (digits !== keys.digits) {
      keys.digits = digits;
      ui.digits.textContent = digits;
    }
    if (label !== keys.tlabel) {
      keys.tlabel = label;
      ui.tlabel.textContent = label;
    }
  }

  /* ---------- layout B: tiles ---------- */

  function buildTiles(t, key) {
    ui.tiles.textContent = "";
    tiles = { key, cells: new Map(), shown: 0 };
    const layout = layoutPhrase(t.text);
    const rows = layout.rows;
    if (!rows.length) return;
    const size = tileSize(layout.cols, rows.length);
    const gridW = layout.cols * size.w + (layout.cols - 1) * size.gap;
    const gridH = rows.length * size.h + (rows.length - 1) * size.gap;
    const x0 = Math.round((BOARD_AREA.w - gridW) / 2);
    const y0 = Math.round((BOARD_AREA.h - gridH) / 2);
    ui.tiles.style.fontSize = `${Math.round(size.h * 0.62)}px`;
    ui.tiles.style.setProperty("--tile-r", `${Math.max(8, Math.round(size.w * 0.12))}px`);
    const frag = document.createDocumentFragment();
    rows.forEach((row, r) => {
      const pad = Math.floor((layout.cols - row.length) / 2);
      for (let c = 0; c < layout.cols; c++) {
        const cell = row[c - pad];
        const style = {
          left: `${x0 + c * (size.w + size.gap)}px`, top: `${y0 + r * (size.h + size.gap)}px`,
          width: `${size.w}px`, height: `${size.h}px`,
        };
        if (!cell || cell.kind === "space") {
          frag.append(el("div", { class: "bd-tile bd-tile-empty", style }));
        } else if (cell.kind === "punct") {
          frag.append(el("div", { class: "bd-tile bd-tile-punct", style, text: cell.ch }));
        } else {
          // The letter stays in memory; the back face gets it only when the tile is revealed.
          const back = el("div", { class: "bd-face bd-back" });
          const flip = el("div", { class: "bd-flip" }, [el("div", { class: "bd-face bd-front" }), back]);
          const node = el("div", { class: "bd-tile bd-tile-letter", style }, [flip]);
          tiles.cells.set(cell.li, { node, flip, back, ch: cell.ch });
          frag.append(node);
        }
      }
    });
    ui.tiles.append(frag);
  }

  function revealCell(cell, how, delay) {
    cell.back.textContent = cell.ch;
    if (how === "instant") {
      cell.node.classList.add("bd-instant", "bd-on");
      return;
    }
    if (delay) cell.flip.style.transitionDelay = `${delay}ms`;
    cell.node.classList.add("bd-on");
    if (how === "flip") cell.node.classList.add("bd-glow");
  }

  function syncTiles(t, clock, live) {
    const key = `${t.id}\u0001${t.text}`;
    let fresh = false;
    if (!tiles || tiles.key !== key) {
      buildTiles(t, key);
      fresh = true;
    }
    const n = Math.min(clock.revealed, t.order.length);
    if (n < tiles.shown) {
      buildTiles(t, key); // never un-flip a tile in place: rebuild and show the right set
      fresh = true;
    }
    if (n === tiles.shown) return;
    const instant = fresh || !live;
    const cascade = !instant && t.phase === "revealed" && n - tiles.shown > 1;
    const first = tiles.shown;
    for (let k = first; k < n; k++) {
      const cell = tiles.cells.get(t.order[k]);
      if (!cell) continue;
      if (instant) revealCell(cell, "instant", 0);
      else if (cascade) revealCell(cell, "cascade", (k - first) * CASCADE_MS);
      else revealCell(cell, "flip", 0);
    }
    tiles.shown = n;
  }

  /* ---------- layout B: status chips ---------- */

  function syncChips(t, clock) {
    const timeUp = t.phase === "running" && clock.timeUp;
    const story = t.phase === "revealed";
    const results = t.results.map((r) => ({ ...r, name: findPlayer(state, r.pid)?.name ?? "?" }));
    const key = results.map((r) => `${r.pid}:${r.place}:${r.points}:${r.name}`).join(",") + `|${timeUp}|${story}`;
    if (key === keys.chips) return;
    const before = new Set(keys.chipIds || []);
    keys.chips = key;
    keys.chipIds = [];
    ui.status.textContent = "";
    for (const r of results) {
      const id = `r:${r.pid}:${r.place}`;
      keys.chipIds.push(id);
      ui.status.append(el("div", { class: `bd-chip${before.has(id) ? "" : " bd-new"}` }, [
        el("span", { class: "bd-medal", style: { background: MEDAL_COLORS[r.place - 1] || "#FFFFFF" }, text: String(r.place) }),
        el("span", { class: "bd-chip-name", text: r.name }),
        el("span", { class: "bd-chip-pts", text: `+${r.points}` }),
      ]));
    }
    if (timeUp) {
      keys.chipIds.push("timeup");
      ui.status.append(el("div", { class: `bd-chip bd-chip-timeup${before.has("timeup") ? "" : " bd-new"}`, text: "TIME'S UP!" }));
    }
    if (story) {
      keys.chipIds.push("story");
      ui.status.append(el("div", { class: `bd-chip bd-chip-story${before.has("story") ? "" : " bd-new"}`, text: "Story time!" }));
    }
  }

  /* ---------- mini leaderboard (layout A panel + layout B strip) ---------- */

  function renderMini() {
    const show = !!state.board.showMini;
    ui.mini.hidden = !show;
    ui.strip.hidden = !show;
    ui.miniRows.textContent = "";
    ui.strip.textContent = "";
    if (!show) return;
    // Only people who scored: a row of zero-point "3rd places" would read as a podium in Meet.
    const top = cur.list.filter((r) => r.points > 0).slice(0, 5);
    if (!top.length) {
      ui.miniRows.append(el("p", { class: "bd-mini-empty", text: "No points yet" }));
      ui.strip.append(el("p", { class: "bd-strip-empty", text: "Leaderboard: no points yet" }));
      return;
    }
    for (const r of top) {
      const dot = el("span", { class: "bd-dot", style: { background: colorOf(r).bg } });
      ui.miniRows.append(el("div", { class: "bd-mini-row" }, [
        el("span", { class: "bd-rank", text: String(r.rank) }), dot,
        el("span", { class: "bd-name", text: r.name }),
        el("span", { class: "bd-pts", text: String(r.points) }),
      ]));
      ui.strip.append(el("div", { class: "bd-strip-item" }, [
        el("span", { class: "bd-rank", text: String(r.rank) }),
        el("span", { class: "bd-dot", style: { background: colorOf(r).bg } }),
        el("span", { class: "bd-name", text: r.name }),
        el("span", { class: "bd-pts", text: String(r.points) }),
      ]));
    }
  }

  /* ---------- overlays ---------- */

  function buildLeaderboard() {
    const list = cur.list.slice(0, 20);
    const row = (r) => el("div", { class: "bd-lb-row" }, [
      el("span", { class: "bd-lb-rank", text: r.points > 0 ? String(r.rank) : "–" }),
      el("span", { class: "bd-dot bd-lb-dot", style: { background: colorOf(r).bg } }),
      el("span", { class: "bd-lb-name", text: r.name }),
      el("span", { class: "bd-lb-pts", text: String(r.points) }),
    ]);
    const cols = list.length ? [list.slice(0, 10), list.slice(10, 20)].filter((c) => c.length) : [];
    return el("div", { class: "bd-lb" }, [
      el("h2", { class: "bd-ov-title", text: "Leaderboard" }),
      cols.length
        ? el("div", { class: `bd-lb-cols${cols.length === 1 ? " bd-lb-one" : ""}` }, cols.map((c) => el("div", { class: "bd-lb-col" }, c.map(row))))
        : el("p", { class: "bd-ov-empty", text: "No players yet" }),
    ]);
  }

  function buildPodium(now) {
    const at = state.board.overlayAt || 0;
    const steps = podium(cur.list);
    const title = el("h2", { class: "bd-ov-title", text: steps.length ? "And the winners are…" : "No points yet" });
    pod = { at, final: now - at > PODIUM_LATE_MS, done: !steps.length, title, cols: {} };
    const stand = el("div", { class: "bd-pod" });
    for (const pos of [2, 1, 3]) {
      const step = steps.find((s) => s.position === pos);
      const who = el("div", { class: `bd-pod-who${step && step.players.length > 3 ? " bd-pod-many" : ""}` });
      if (step) {
        step.players.forEach((p) => {
          const c = colorOf(p);
          who.append(el("div", { class: "bd-pod-name", style: { background: c.bg, color: c.fg }, text: p.name }));
        });
        const pts = step.players[0].points;
        who.append(el("div", { class: "bd-pod-pts", text: `${pts} ${pts === 1 ? "pt" : "pts"}` }));
        pod.cols[pos] = who;
      }
      stand.append(el("div", { class: `bd-pod-col bd-pod-${pos}` }, [
        who,
        el("div", { class: "bd-pod-step" }, [el("span", { class: "bd-pod-num", text: String(pos) })]),
      ]));
    }
    return el("div", { class: "bd-podium" }, [title, stand]);
  }

  function syncOverlay(now, live) {
    const raw = state.board.overlay;
    const ov = raw === "leaderboard" || raw === "podium" ? raw : null;
    const key = ov ? `${ov}|${ov === "podium" ? state.board.overlayAt : ""}|${cur.standKey}` : "";
    if (key !== keys.overlay) {
      keys.overlay = key;
      pod = null;
      if (!ov) {
        ui.overlay.classList.remove("bd-show");
        stopConfetti();
      } else {
        ui.overlay.textContent = "";
        ui.overlay.append(ov === "podium" ? buildPodium(now) : buildLeaderboard());
        ui.overlay.classList.add("bd-show");
        if (ov !== "podium") stopConfetti();
      }
    }
    if (pod) updatePodium(now, live);
  }

  function updatePodium(now, live) {
    const since = now - pod.at;
    for (const pos of [3, 2, 1]) {
      const who = pod.cols[pos];
      if (who && !who.classList.contains("bd-in") && (pod.final || since >= PODIUM_REVEAL_MS[pos])) {
        who.classList.add("bd-in");
        if (pod.final) who.classList.add("bd-instant");
      }
    }
    if (!pod.done && (pod.final || since >= PODIUM_REVEAL_MS[1])) {
      pod.done = true;
      pod.title.textContent = "Congratulations!";
      if (!pod.final && live && fanfareFor !== pod.at) {
        fanfareFor = pod.at;
        sound.fanfare();
        if (!motion.matches) startConfetti(now);
      }
    }
  }

  /* ---------- confetti ---------- */

  function startConfetti(now) {
    const rnd = Math.random;
    confetti = {
      t0: now, last: now,
      pieces: Array.from({ length: CONFETTI_PIECES }, () => ({
        x: rnd() * STAGE_W, y: -20 - rnd() * 900, vx: (rnd() - 0.5) * 260, vy: 180 + rnd() * 260,
        r: rnd() * Math.PI * 2, vr: (rnd() - 0.5) * 8, w: 14 + rnd() * 14, h: 8 + rnd() * 8,
        c: PALETTE[Math.floor(rnd() * PALETTE.length)].bg,
      })),
    };
    ui.confetti.hidden = false;
  }

  function stopConfetti() {
    if (!confetti) return;
    confetti = null;
    ui.confetti.getContext("2d").clearRect(0, 0, STAGE_W, STAGE_H);
    ui.confetti.hidden = true;
  }

  function drawConfetti(now) {
    if (!confetti) return;
    const age = now - confetti.t0;
    if (age > CONFETTI_MS) {
      stopConfetti();
      return;
    }
    const dt = Math.min(0.05, (now - confetti.last) / 1000);
    confetti.last = now;
    const ctx = ui.confetti.getContext("2d");
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    ctx.globalAlpha = clamp((CONFETTI_MS - age) / 700, 0, 1);
    for (const p of confetti.pieces) {
      p.vy = Math.min(p.vy + 420 * dt, 620);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      if (p.y < -40 || p.y > STAGE_H + 40) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- sounds ---------- */

  // What has already been heard for the current turn, taken from the state as it is now.
  function snapshot(now, t) {
    const clock = turnClock(t, now);
    const pool = t?.spin?.pool;
    return {
      turnId: t?.id ?? null,
      spinT0: t?.spin?.t0 ?? null,
      spinSeen: false,
      landed: false,
      slice: pool?.length ? sliceUnderPointer(wheelAngle(state, now), pool.length) : null,
      clickAt: 0,
      revealed: clock.revealed,
      tickSec: Math.ceil(clock.remaining / 1000),
      timeUp: clock.timeUp,
      results: t?.results.length ?? 0,
      phase: t?.phase ?? null,
    };
  }

  function playSounds(now, t, live) {
    const id = t?.id ?? null;
    if (!guards || !live) {
      guards = snapshot(now, t);
      return;
    }
    if (id !== guards.turnId) {
      // A live new turn starts in "pick"; anything else (undo, import) is a jump: no replay.
      guards = snapshot(now, t);
      if (!t || t.phase !== "pick") return;
      guards.spinT0 = null;
    }
    if (!t) return;

    if (t.spin) {
      if (guards.spinT0 !== t.spin.t0) {
        guards.spinT0 = t.spin.t0;
        if (now - t.spin.t0 < WHOOSH_WINDOW_MS) sound.whoosh();
      }
      if (!spinDone(t.spin, now)) {
        guards.spinSeen = true;
        const i = sliceUnderPointer(wheelAngle(state, now), t.spin.pool.length);
        if (guards.slice !== null && i !== guards.slice && now - guards.clickAt >= CLICK_MIN_MS) {
          guards.clickAt = now;
          sound.click();
        }
        guards.slice = i;
      } else if (guards.spinSeen && !guards.landed) {
        guards.landed = true;
        sound.land();
      }
    }

    const clock = turnClock(t, now);
    if (t.phase === "running") {
      if (clock.revealed > guards.revealed) sound.ding(clock.revealed);
      const sec = Math.ceil(clock.remaining / 1000);
      const tickMs = (state.settings.tickLastSec ?? 10) * 1000;
      if (sec !== guards.tickSec && !clock.paused && clock.remaining > 0 && clock.remaining <= tickMs) sound.tick(sec <= 3);
      guards.tickSec = sec;
      if (clock.timeUp && !guards.timeUp) sound.buzzer();
    }
    guards.revealed = clock.revealed;
    guards.timeUp = clock.timeUp;

    if (t.results.length > guards.results) {
      t.results.slice(guards.results).forEach((r) => sound.correct(r.place));
    }
    guards.results = t.results.length;

    if (t.phase === "revealed" && guards.phase !== "revealed") sound.revealAll();
    guards.phase = t.phase;
  }

  /* ---------- state ---------- */

  function applyState() {
    derivedFor = state;
    const t = state.turn;
    cur.player = t ? findPlayer(state, t.pid) : null;
    cur.pool = t?.spin ? t.spin.pool : wheelPool(state);
    // A person removed after the spin keeps a blank slice, so the geometry still matches the spin.
    cur.wheelPlayers = cur.pool.map((id) => findPlayer(state, id) || { id, name: "", color: 0 });
    const wheelKey = cur.wheelPlayers.map((p) => `${p.id}\u0001${p.name}\u0001${p.color}`).join("\u0002");
    if (wheelKey !== keys.wheel) {
      keys.wheel = wheelKey;
      renderWheel(cur.wheelPlayers);
    }
    cur.list = standings(state);
    cur.standKey = cur.list.map((r) => `${r.pid}:${r.name}:${r.color}:${r.points}:${r.rank}:${r.firsts}:${r.seconds}:${r.thirds}`).join(",");
    const miniKey = `${state.board.showMini}|${cur.list.filter((r) => r.points > 0).slice(0, 5).map((r) => `${r.rank}:${r.name}:${r.color}:${r.points}`).join(",")}`;
    if (miniKey !== keys.mini) {
      keys.mini = miniKey;
      renderMini();
    }
  }

  function setMode(mode) {
    if (mode === keys.mode) return;
    keys.mode = mode;
    ui.stage.dataset.mode = mode;
    clearTimeout(clearTimer);
    if (mode !== "b") {
      // After the fade, drop the finished turn's pieces so the next turn starts clean.
      clearTimer = setTimeout(() => {
        if (keys.mode === "b") return;
        ui.tiles.textContent = "";
        ui.status.textContent = "";
        ui.headB.textContent = "";
        tiles = null;
        keys.headB = keys.chips = undefined;
        keys.chipIds = [];
      }, 900);
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    const now = Date.now();
    const gap = now - lastFrameAt;
    lastFrameAt = now;
    if (!state) {
      setMode("wait");
      return;
    }
    if (state !== derivedFor) applyState();
    const live = !jumped && gap < RESYNC_GAP_MS;
    jumped = false;
    const t = state.turn;
    const inB = !!t && B_PHASES.includes(t.phase);
    setMode(inB ? "b" : "a");
    syncWheel(now, t, inB);
    if (inB) {
      const clock = turnClock(t, now);
      syncHeaderB(t);
      syncTimer(t, clock);
      syncTiles(t, clock, live);
      syncChips(t, clock);
    } else {
      syncHeadlineA(now, t);
    }
    syncOverlay(now, live);
    drawConfetti(now);
    playSounds(now, t, live);
  }

  /* ---------- start, full screen, wake lock, status ---------- */

  function sendStatus() {
    if (!link) return;
    link.sendStatus({
      audio: !!sound.running,
      fullscreen: !!document.fullscreenElement,
      visible: document.visibilityState === "visible",
      started,
      rev: state?.rev ?? null,
      epoch: state?.epoch ?? null,
    });
  }

  function requestFullscreen() {
    try {
      const p = document.documentElement.requestFullscreen?.();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* not allowed here */ }
  }

  async function requestWakeLock() {
    if (!navigator.wakeLock || document.visibilityState !== "visible") return;
    if (wakeLock && !wakeLock.released) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch (e) {
      wakeLock = null; // refused (battery saver, policy): the screen may sleep, nothing else to do
    }
  }

  function wakeUp() {
    Promise.resolve(sound.unlock()).then(sendStatus, () => {});
    requestFullscreen();
    requestWakeLock();
  }

  function onClick() {
    wakeUp();
    if (!started) {
      started = true;
      writeFlag(START_KEY);
      document.body.classList.add("board-live");
      ui.start.classList.add("bd-gone");
      setTimeout(() => { ui.start.hidden = true; }, 450);
    }
    sendStatus();
  }

  function onKey(e) {
    if (e.key !== "f" && e.key !== "F") return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    e.preventDefault();
    if (document.fullscreenElement) {
      try { document.exitFullscreen?.()?.catch?.(() => {}); } catch (err) { /* already out */ }
    } else {
      requestFullscreen();
    }
  }

  /* ---------- boot ---------- */

  if (started) {
    ui.start.hidden = true;
    document.body.classList.add("board-live");
    requestWakeLock();
    // After a reload Chrome may still allow sound; if not, the Control asks for one click.
    Promise.resolve(sound.unlock()).then(() => sendStatus(), () => {});
  }
  fitStage();
  window.addEventListener("resize", fitStage);
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  document.addEventListener("fullscreenchange", sendStatus);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && started) requestWakeLock();
    sendStatus();
  });
  document.fonts?.ready.then(refitAll).catch(() => {});
  sound.onChange(sendStatus);

  link = connectBoard({
    demo,
    onState: (s) => {
      if (state && s.epoch !== state.epoch) jumped = true;
      state = s;
      sound.setMuted(!!s.settings?.muted);
      sendStatus();
    },
  });
  setInterval(sendStatus, STATUS_EVERY_MS);
  sendStatus();
  requestAnimationFrame(frame);
}
