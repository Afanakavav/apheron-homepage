// Wheel of Facts · FUN Friday — sounds
// Everything is synthesised with the Web Audio API: no audio files, no network. Only the Board plays
// sounds and its tab audio is what Meet shares with 20 people, so levels are gentle and ticks stay quiet.

/* ---------- tuning ---------- */

const MASTER_LEVEL = 0.7;
const MUTE_RAMP = 0.05;     // seconds: muting fades instead of cutting mid-sound
const LEAD = 0.01;          // schedule a hair after currentTime so an envelope never starts in the past
const SILENT = 0.0001;      // exponential ramps cannot reach 0
const RESUME_WAIT = 1500;   // resume() stays pending without a user gesture: never let unlock() hang

// Minimum spacing per sound (seconds). A throttled Board catching up can fire a burst of calls
// in one frame; stacking identical sounds would only be louder, never clearer.
const MIN_GAP = {
  tick: 0.05, ding: 0.045, click: 0.025, whoosh: 0.25, land: 0.25, correct: 0.08,
  buzzer: 0.4, revealAll: 0.3, fanfare: 1,
};

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const [G4, C5, E5, G5, C6, E6, G6] = [67, 72, 76, 79, 84, 88, 91];
// C major pentatonic, C6 to E7: the letters of a phrase walk up and down it as a little melody.
const PENTA = [84, 86, 88, 91, 93, 96, 98, 100];

/* ---------- graph helpers ---------- */

// One second of white noise per context, shared by every noisy sound (each starts at a random offset).
const noiseBuffers = new WeakMap();
function noiseBuffer(ac) {
  let buf = noiseBuffers.get(ac);
  if (!buf) {
    buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ac, buf);
  }
  return buf;
}

// master gain → gentle compressor → speakers. The compressor only glues overlapping sounds together.
function buildChain(ac, level, useCompressor = true) {
  const master = ac.createGain();
  master.gain.value = level;
  if (!useCompressor) {
    master.connect(ac.destination);
    return master;
  }
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  master.connect(comp).connect(ac.destination);
  return master;
}

// A voice holds the nodes of one sound. When its last source ends every node is disconnected,
// so hundreds of clicks and ticks never pile up in the audio graph.
function makeVoice(ac, out) {
  const nodes = [];
  let live = 0;
  const keep = (node, to) => {
    nodes.push(node);
    if (to) node.connect(to);
    return node;
  };
  const ended = () => {
    live -= 1;
    if (live > 0) return;
    nodes.forEach((n) => {
      try { n.disconnect(); } catch (e) { /* already disconnected */ }
    });
    nodes.length = 0;
  };
  const run = (src, t0, t1, offset = 0) => {
    live += 1;
    src.onended = ended;
    src.start(t0, offset);
    src.stop(t1);
    return src;
  };
  return {
    // Starts silent; `to` = null leaves it unconnected (e.g. a vibrato depth feeding detune params).
    gain(to = out) {
      const g = keep(ac.createGain(), to);
      g.gain.value = 0;
      return g;
    },
    filter(type, freq, q, to) {
      const f = keep(ac.createBiquadFilter(), to);
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    },
    osc(type, freq, to, t0, t1) {
      const o = keep(ac.createOscillator(), to);
      o.type = type;
      o.frequency.value = freq;
      return run(o, t0, t1);
    },
    noise(to, t0, t1) {
      const s = keep(ac.createBufferSource(), to);
      s.buffer = noiseBuffer(ac);
      s.loop = true;
      return run(s, t0, t1, Math.random() * 0.9);
    },
  };
}

// Percussive envelope: linear rise to `peak` in `attack` s, then an exponential fall to -60 dB over `decay` s.
function strike(param, t, peak, attack, decay) {
  param.setValueAtTime(SILENT, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(peak * 0.001, t + attack + decay);
}

/* ---------- instruments ---------- */

// Small bell: sine plus a quieter, slightly detuned strike partial at 2.76× that fades first.
function bell(v, t, f, level, decay) {
  const g = v.gain();
  strike(g.gain, t, level, 0.005, decay);
  v.osc("sine", f, g, t, t + decay + 0.03);
  const p = v.gain();
  strike(p.gain, t, level * 0.3, 0.005, decay * 0.55);
  v.osc("sine", f * 2.76 * 1.003, p, t, t + decay * 0.55 + 0.03);
}

// Chime: sine with a soft octave, rounder than the bell.
function chime(v, t, f, level, decay) {
  const g = v.gain();
  strike(g.gain, t, level, 0.006, decay);
  v.osc("sine", f, g, t, t + decay + 0.03);
  const o = v.gain();
  strike(o.gain, t, level * 0.22, 0.006, decay * 0.6);
  v.osc("sine", f * 2, o, t, t + decay * 0.6 + 0.03);
}

// Marimba: warm sine bar, a fast-fading overtone near 4× (tuned bars) and a soft mallet knock.
function marimba(v, t, f, level, decay) {
  const g = v.gain();
  strike(g.gain, t, level, 0.002, decay);
  v.osc("sine", f, g, t, t + decay + 0.03);
  const o = v.gain();
  strike(o.gain, t, level * 0.28, 0.001, 0.09);
  v.osc("sine", f * 3.93, o, t, t + 0.12);
  const k = v.gain();
  strike(k.gain, t, level * 0.5, 0.0005, 0.02);
  v.noise(v.filter("bandpass", f * 2, 1.2, k), t, t + 0.03);
}

// Brass: a sawtooth plus a quieter one 7 cents sharp, through a lowpass that opens on the attack (the
// "blat") and settles. The second saw is quieter so the beating warms the note without cancelling it.
function brass(v, t, f, dur, level, vibrato = null) {
  const settle = Math.min(0.1, dur * 0.6);
  const g = v.gain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.linearRampToValueAtTime(level, t + 0.025);
  g.gain.linearRampToValueAtTime(level * 0.8, t + settle);
  g.gain.setValueAtTime(level * 0.8, t + dur);
  g.gain.exponentialRampToValueAtTime(SILENT, t + dur + 0.15);
  const lp = v.filter("lowpass", f * 2, 1.2, g);
  lp.frequency.setValueAtTime(f * 1.5, t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(f * 7, 5000), t + 0.035);
  lp.frequency.exponentialRampToValueAtTime(Math.min(f * 4, 3000), t + settle + 0.05);
  const second = v.gain(lp);
  second.gain.value = 0.4;
  for (const [cents, to] of [[0, lp], [7, second]]) {
    const o = v.osc("sawtooth", f, to, t, t + dur + 0.17);
    o.detune.value = cents;
    if (vibrato) vibrato.connect(o.detune);
  }
}

/* ---------- the sounds ---------- */

// Each voice gets (v, t, ...args): a fresh voice and its start time on the context clock.
const VOICES = {
  // Clock tick for the last seconds: woodblock-ish knock plus a short falling tone.
  tick(v, t, urgent) {
    const f = urgent ? 2000 : 1500;
    const level = urgent ? 0.6 : 0.42;
    const knock = v.gain();
    strike(knock.gain, t, level, 0.001, 0.03);
    v.noise(v.filter("bandpass", f, 3, knock), t, t + 0.04);
    const tone = v.gain();
    strike(tone.gain, t, level * 0.35, 0.001, 0.035);
    const o = v.osc("sine", f, tone, t, t + 0.045);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.035);
  },

  // One bell per revealed letter; i walks the pentatonic scale up and back down.
  ding(v, t, i) {
    const n = Number.isFinite(i) ? Math.abs(Math.trunc(i)) : 0;
    const top = PENTA.length - 1;
    const step = n % (2 * top);
    bell(v, t, hz(PENTA[step <= top ? step : 2 * top - step]), 0.2, 0.6);
  },

  // Wheel peg: a tiny bandpassed noise tick (it can fire every 40 ms, so it stays very quiet).
  click(v, t) {
    const g = v.gain();
    strike(g.gain, t, 0.15, 0.0008, 0.012);
    v.noise(v.filter("bandpass", 2800 + Math.random() * 400, 1.4, g), t, t + 0.02);
  },

  // Spin start: noise through a bandpass sweeping upwards.
  whoosh(v, t) {
    const g = v.gain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.7);
    const bp = v.filter("bandpass", 400, 1.3, g);
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(2000, t + 0.7);
    v.noise(bp, t, t + 0.72);
  },

  // Wheel stopped: G5 → C6 with a light shimmer (two high sines beating a few times a second).
  land(v, t) {
    chime(v, t, hz(G5), 0.16, 0.45);
    chime(v, t + 0.12, hz(C6), 0.19, 0.58);
    for (const f of [hz(C6) * 3, hz(C6) * 3 + 6]) {
      const g = v.gain();
      strike(g.gain, t + 0.12, 0.018, 0.06, 0.5);
      v.osc("sine", f, g, t + 0.12, t + 0.72);
    }
  },

  // A place was given: 1st = C6-E6-G6, 2nd = C6-E6, 3rd (or later) = C6.
  correct(v, t, place) {
    const notes = place === 2 ? [C6, E6] : place >= 3 ? [C6] : [C6, E6, G6];
    notes.forEach((m, k) => {
      const last = k === notes.length - 1;
      marimba(v, t + k * 0.09, hz(m), 0.24, last ? 0.7 : 0.4);
    });
  },

  // Time's up: two detuned sawtooths, lowpassed, with a small droop at the end. Clear, not harsh.
  buzzer(v, t) {
    const dur = 0.7;
    const g = v.gain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.03);
    g.gain.setValueAtTime(0.18, t + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    const lp = v.filter("lowpass", 900, 0.7, g);
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.linearRampToValueAtTime(600, t + dur);
    for (const f of [150, 155]) {
      const o = v.osc("sawtooth", f, lp, t, t + dur + 0.02);
      o.frequency.setValueAtTime(f, t + 0.3);
      o.frequency.exponentialRampToValueAtTime(f * 0.88, t + dur);
    }
  },

  // Whole phrase revealed: a quick rising bell glissando that rings out on the top note.
  revealAll(v, t) {
    const top = PENTA.length - 1;
    PENTA.forEach((m, k) => {
      bell(v, t + k * 0.045, hz(m), k === top ? 0.17 : 0.1, k === top ? 0.9 : 0.35);
    });
  },

  // Winner: ta-ta-ta TAA, ta-TAA, then a held C major chord with vibrato and a soft cymbal swell into it.
  fanfare(v, t) {
    const level = 0.17;
    [[G4, 0, 0.09], [G4, 0.12, 0.09], [G4, 0.24, 0.09], [C5, 0.36, 0.26], [E5, 0.72, 0.12], [G5, 0.88, 0.24]]
      .forEach(([m, at, dur]) => brass(v, t + at, hz(m), dur, level));

    const c = t + 1.2;
    const depth = v.gain(null); // vibrato depth in cents, fading in after the chord lands
    depth.gain.setValueAtTime(0, c + 0.25);
    depth.gain.linearRampToValueAtTime(9, c + 0.8);
    v.osc("sine", 5.5, depth, c, c + 1.4);
    [C5, E5, G5, C6].forEach((m) => brass(v, c, hz(m), 1.2, level * 0.6, depth));

    const cym = v.gain();
    cym.gain.setValueAtTime(SILENT, c - 0.5);
    cym.gain.exponentialRampToValueAtTime(0.12, c);
    cym.gain.exponentialRampToValueAtTime(0.0002, c + 1.3);
    v.noise(v.filter("highpass", 5000, 0.7, cym), c - 0.5, c + 1.35);
  },
};

/* ---------- public API ---------- */

export function createSound() {
  let ctx = null;
  let master = null;
  let muted = false;
  let warned = false;
  const listeners = new Set();
  const lastAt = {};

  const isRunning = () => !!ctx && ctx.state === "running";

  const fire = () => {
    const running = isRunning();
    listeners.forEach((fn) => {
      try { fn(running); } catch (e) { console.error(e); }
    });
  };

  // Fire-and-forget: silent when locked, muted or throttled, and a sound never breaks the game.
  function play(name, args) {
    if (muted || !isRunning()) return;
    try {
      const t = ctx.currentTime + LEAD;
      if (t - (lastAt[name] ?? -Infinity) < MIN_GAP[name]) return;
      lastAt[name] = t;
      VOICES[name](makeVoice(ctx, master), t, ...args);
    } catch (e) {
      if (!warned) console.warn("Wheel of Facts: a sound could not play", e);
      warned = true;
    }
  }

  // Must run inside a user gesture (Chrome's autoplay policy). Safe to call any number of times.
  async function unlock() {
    try {
      if (ctx && ctx.state === "closed") ctx = null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!ctx && AC) {
        ctx = new AC({ latencyHint: "interactive" });
        master = buildChain(ctx, muted ? 0 : MASTER_LEVEL);
        ctx.addEventListener("statechange", fire);
      }
      if (ctx && ctx.state !== "running") {
        await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, RESUME_WAIT))]);
      }
    } catch (e) {
      /* resume refused: stay silent, the caller can try again on the next click */
    }
    fire();
    return isRunning();
  }

  function setMuted(b) {
    muted = !!b;
    if (!ctx || !master) return;
    try {
      const g = master.gain;
      const now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(muted ? 0 : MASTER_LEVEL, now + MUTE_RAMP);
    } catch (e) { /* the flag alone already silences new sounds */ }
  }

  return {
    unlock,
    get running() { return isRunning(); },
    get muted() { return muted; },
    setMuted,
    // fn(running) on every AudioContext state change and after each unlock(); returns an unsubscribe.
    onChange(fn) {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    tick: (urgent = false) => play("tick", [!!urgent]),
    ding: (i = 0) => play("ding", [i]),
    click: () => play("click", []),
    whoosh: () => play("whoosh", []),
    land: () => play("land", []),
    correct: (place = 1) => play("correct", [place]),
    buzzer: () => play("buzzer", []),
    revealAll: () => play("revealAll", []),
    fanfare: () => play("fanfare", []),

    // Test hook, unused by the game: renders sounds offline through the same chain and reports
    // the peak and the loudest 50 ms RMS. calls = [{ name, args, at }].
    async _render(calls, { seconds = 3, compressor = true } = {}) {
      const rate = 48000;
      const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
      const out = buildChain(off, MASTER_LEVEL, compressor);
      calls.forEach(({ name, args = [], at = 0 }) => VOICES[name](makeVoice(off, out), at + LEAD, ...args));
      const data = (await off.startRendering()).getChannelData(0);
      const win = rate / 20;
      let peak = 0;
      let rms = 0;
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        peak = Math.max(peak, Math.abs(data[i]));
        sum += data[i] * data[i];
        if (i >= win) sum -= data[i - win] * data[i - win];
        rms = Math.max(rms, Math.sqrt(Math.max(0, sum) / win));
      }
      return { peak, rms, data };
    },
  };
}
