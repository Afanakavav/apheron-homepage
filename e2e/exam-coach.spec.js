// @ts-check
// Exam Coach — smoke test of the mobile page: loading, photo compression, rendering and the hosting config.
// No network and no Firebase: every request that leaves localhost is aborted, and core.js, image.js and ui.js are
// pure modules imported in the page.
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const ORIGIN = "http://localhost:5001";
const BASE = ORIGIN + "/exam-coach/aigp/";
const PAGE_FILE = path.join(__dirname, "..", "public", "exam-coach", "index.html");

// Minimal stand-ins for the Firebase JS SDK 10.7.1 modules that /firebase-config.js and app.js import.
const FIREBASE_MOCKS = {
  "firebase-app": `
    const app = { name: "[DEFAULT]", options: {} };
    export function initializeApp(options) { app.options = options; return app; }
    export function getApp() { return app; }`,
  "firebase-auth": `
    const auth = { currentUser: null };
    const listeners = [];
    const emit = () => listeners.forEach((cb) => cb(auth.currentUser));
    export function getAuth() { return auth; }
    export function onAuthStateChanged(a, cb) { listeners.push(cb); setTimeout(() => cb(auth.currentUser), 0); return () => {}; }
    export async function signInWithEmailAndPassword(a, email, password) {
      if (password !== "test-password") throw Object.assign(new Error("denied"), { code: "auth/invalid-credential" });
      auth.currentUser = { uid: "test-uid", email };
      emit();
      return { user: auth.currentUser };
    }
    export async function signOut() { auth.currentUser = null; emit(); }`,
  "firebase-firestore": `
    const db = {};
    export function getFirestore() { return db; }
    export function collection(d, path) { return { path }; }
    export function doc(d, path, id) { return { path, id }; }
    export function where(field, op, value) { return { field, op, value }; }
    export function query(col, ...constraints) { return { path: col.path, constraints }; }
    export function orderBy() { return {}; }
    export async function getDocs(q) {
      const docs = Object.entries(window.__docs)
          .filter(([, d]) => q.constraints.every((c) => c.op === "==" && d[c.field] === c.value))
          .map(([id, d]) => ({ id, data: () => ({ ...d }) }));
      return { docs };
    }
    export async function updateDoc(ref, patch) { window.__updates.push({ id: ref.id, patch }); Object.assign(window.__docs[ref.id], patch); }
    // Polls window.__docs and reports each change of the document; window.__snapshots counts the open listeners.
    // window.__snapshotDelay delays the first report (a listener reconnecting after the page was frozen).
    export function onSnapshot(ref, next, error) {
      let last;
      let timer = null;
      const emit = () => {
        const d = window.__docs[ref.id];
        const key = JSON.stringify(d === undefined ? null : d);
        if (key === last) return;
        last = key;
        next({ id: ref.id, exists: () => d !== undefined, data: () => (d === undefined ? undefined : { ...d }) });
      };
      window.__snapshots = (window.__snapshots || 0) + 1;
      const first = setTimeout(() => { emit(); timer = setInterval(emit, 50); }, window.__snapshotDelay || 0);
      return () => { clearTimeout(first); clearInterval(timer); window.__snapshots--; };
    }
    export async function addDoc() {}
    export async function deleteDoc() {}
    export async function setDoc() {}`,
  "firebase-functions": `
    export function getFunctions(app, region) { return { region }; }
    export function httpsCallable(fns, name, options) {
      return async (data) => {
        window.__calls.push({ name, region: fns.region, timeout: options && options.timeout, data });
        return { data: await window.__server(name, data) };
      };
    }`,
  "firebase-app-check": `
    let instance = null;
    export class ReCaptchaEnterpriseProvider { constructor(siteKey) { this.siteKey = siteKey; } }
    export function initializeAppCheck(app, options) { instance = instance || { options }; return instance; }
    export async function getToken() { return { token: "mock-token" }; }`,
};

// Server side of the mocks: replies shaped like functions/exam-coach (publicResult), log documents in window.__docs.
const MOCK_SERVER = `
  window.__calls = [];
  window.__updates = [];
  window.__docs = {};
  window.__server = async (name, data) => {
    if (name === "examCoachPhoto") {
      return { logId: data.logId, mediaType: "image/png",
        base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" };
    }
    if (data.mode === "warm") return { ok: true, mode: "warm", logId: "log-w", examId: data.examId, packVersion: "v-test" };
    const deep = data.mode === "deep";
    const reply = {
      logId: deep ? "log-d" : "log-a", examId: data.examId, mode: data.mode, previousLogId: deep ? data.previousLogId : null,
      questionStem: "Test question stem", requiredCount: 1, answers: [deep ? "C" : "B"], answerTexts: [deep ? "Text C" : "Text B"],
      explanation: deep ? "Test deep explanation." : "Test explanation.", citations: deep ? ["M2/L1"] : ["M1/L1"],
      confidence: deep ? "high" : "low", domain: "I", matches: [], exactMatch: false, conflictNote: null, readIssue: null,
      model: "claude-opus-5-5", servedBy: "claude-opus-5-5", fellBack: false, latencyMs: null, packVersion: "v-test",
    };
    window.__docs[reply.logId] = { ...reply, flagged: false, createdAt: new Date().toISOString() };
    return reply;
  };`;

// Test controls on top of MOCK_SERVER: hold a mode's replies until released, make the next warm-ups fail with the
// given codes (errors sent by the function, so with its own sentence), patch the replies of a mode, record when each
// call was sent (page clock), and cut the connection of the next calls of a mode (window.__cuts[mode]: "ok",
// "ok-late", "never" or "error:<code>[:<sentence>]"). A cut call fails like a dropped fetch in the Firebase SDK
// (code and message "internal"): at once, or for "ok-late" only when the hold "cut" is released (the page learns of
// the cut when it wakes up). Except with "never" the function goes on: it creates the log document named after the
// requestId with status "running" and, once the mode's hold is released, stores the result or the error there.
const MOCK_CONTROLS = `
  window.__sentAt = [];
  window.__holds = {};
  window.__warmErrors = [];
  window.__replyPatch = {};
  window.__cuts = {};
  window.__hold = (mode) => {
    let release;
    const promise = new Promise((resolve) => { release = resolve; });
    window.__holds[mode] = { promise, release };
  };
  window.__release = (mode) => {
    const hold = window.__holds[mode];
    delete window.__holds[mode];
    if (hold) hold.release();
  };
  const base = window.__server;
  window.__server = async (name, data) => {
    window.__sentAt.push(Date.now());
    const cut = (window.__cuts[data.mode] || []).shift();
    if (cut) {
      if (cut !== "never") {
        window.__docs[data.requestId] = { status: "running", mode: data.mode };
        (async () => {
          const held = window.__holds[data.mode];
          if (held) await held.promise;
          if (cut.startsWith("error:")) {
            const [, code, ...sentence] = cut.split(":");
            const error = { code, message: "cause text, never shown" };
            if (sentence.length) error.userMessage = sentence.join(":");
            window.__docs[data.requestId] = { status: "error", mode: data.mode, error };
          } else {
            const reply = { ...(await base(name, data)), ...(window.__replyPatch[data.mode] || {}) };
            window.__docs[data.requestId] = { ...reply, logId: data.requestId, status: "ok", flagged: false };
          }
        })();
      }
      if (cut === "ok-late" && window.__holds.cut) await window.__holds.cut.promise;
      throw Object.assign(new Error("internal"), { code: "functions/internal" });
    }
    const hold = window.__holds[data.mode];
    if (hold) await hold.promise;
    if (data.mode === "warm" && window.__warmErrors.length) {
      const code = window.__warmErrors.shift();
      throw Object.assign(new Error("The function failed (" + code + ")."), { code: "functions/" + code });
    }
    return { ...(await base(name, data)), ...(window.__replyPatch[data.mode] || {}) };
  };`;

const PHOTO = path.join(__dirname, "..", "public", "exam-coach", "icon-192.png");
// Every examCoachAnswer call carries a requestId: 20 letters and digits made by the page.
const REQUEST_ID = expect.stringMatching(/^[A-Za-z0-9]{20}$/);

/**
 * Opens the page with the Firebase SDK mocked (MOCK_SERVER and MOCK_CONTROLS), the page clock installed, signed in.
 * @return {Promise<() => Promise<object[]>>} reader of the callable calls: name, timeout and mode
 */
async function openSignedIn(page, { beforeSignIn } = {}) {
  for (const [name, body] of Object.entries(FIREBASE_MOCKS)) {
    await page.route(`https://www.gstatic.com/firebasejs/10.7.1/${name}.js`, (route) => route.fulfill({
      body, contentType: "application/javascript", headers: { "Access-Control-Allow-Origin": "*" },
    }));
  }
  await page.addInitScript(MOCK_SERVER);
  await page.addInitScript(MOCK_CONTROLS);
  await page.clock.install();
  await page.goto(BASE);
  await expect(page.locator("#login-form")).toBeVisible();
  if (beforeSignIn) await page.evaluate(beforeSignIn);
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#coach")).toBeVisible();
  return () => page.evaluate(() => window.__calls.map((c) => ({ name: c.name, timeout: c.timeout, mode: c.data.mode })));
}

const visible = (page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
const lastActive = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("exam-coach:last-active") || "{}").aigp);
// The page reads the clock just before the call and the mock just after: the same instant, give or take a tick.
const expectSameTime = (a, b) => expect(Math.abs(a - b)).toBeLessThanOrEqual(20);

test.beforeEach(async ({ page }) => {
  // Firebase SDK (gstatic), reCAPTCHA and anything else outside the local server: no network in this test.
  await page.route((url) => url.hostname !== "localhost", (route) => route.abort());
  // npx serve has no rewrites: emulate the firebase.json rewrite of /exam-coach/<examId>/ to /exam-coach/index.html.
  await page.route(/\/exam-coach\/[a-z0-9-]+\/?(\?.*)?$/, (route) =>
    route.fulfill({ path: PAGE_FILE, contentType: "text/html; charset=utf-8" }));
});

test.describe("Exam Coach", () => {
  test("the page loads at /exam-coach/aigp/ with the exam name, noindex, manifest and the sign-in form", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle("IAPP AIGP · Exam Coach"); // set by boot.js, which needs no Firebase
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/exam-coach/manifest.json");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0E3B43");
    await expect(page.locator(".lede [data-exam-name]")).toHaveText("IAPP AIGP");

    const manifest = await page.request.get(ORIGIN + "/exam-coach/manifest.json");
    expect(manifest.ok()).toBeTruthy();
    const m = await manifest.json();
    expect(m.start_url).toBe("/exam-coach/aigp/");
    expect(m.scope).toBe("/exam-coach/aigp/");
    expect(m.display).toBe("standalone");
    expect(m.icons.map((i) => i.src)).toContain("/exam-coach/icon-512.png");
    for (const src of [...new Set(m.icons.map((i) => i.src)), "/exam-coach/apple-touch-icon.png"]) {
      const icon = await page.request.get(ORIGIN + src);
      expect(icon.ok(), src).toBeTruthy();
      expect(icon.headers()["content-type"]).toContain("image/png");
    }

    await expect(page.locator("#splash")).toBeHidden({ timeout: 10000 }); // CSS fallback: app.js cannot load offline
    await expect(page.locator("#login-form")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("#coach")).toBeHidden();
    // Without the Firebase SDK the page says so, and submitting never puts the password in the URL.
    await expect(page.locator("#login-error")).toContainText("Could not load the sign-in service");
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(300);
    expect(page.url()).toBe(BASE);
  });

  test("/exam-coach/ moves to the canonical /exam-coach/aigp/; an unknown exam is named as such", async ({ page }) => {
    await page.goto(ORIGIN + "/exam-coach/");
    await expect(page).toHaveURL(BASE);
    await expect(page).toHaveTitle("IAPP AIGP · Exam Coach");

    await page.goto(ORIGIN + "/exam-coach/nope/");
    await expect(page).toHaveTitle("Exam Coach");
    await expect(page.locator(".lede [data-exam-name]")).toHaveText("Unknown exam");
    await expect(page).toHaveURL(ORIGIN + "/exam-coach/nope/");
  });

  test("core.js reads the exam from the path, keeps settings safe and warms only after 55 minutes", async ({ page }) => {
    await page.goto(BASE);
    const out = await page.evaluate(async () => {
      const core = await import("/exam-coach/core.js");
      const now = 10 * 60 * 60 * 1000;
      const memory = new Map();
      const store = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)) };
      const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
      const saved = core.saveSettings(store, { autoDeep: false });
      core.saveLastActive(store, "aigp", now - 1000);
      return {
        paths: ["/exam-coach/aigp/", "/exam-coach/AIGP", "/exam-coach/", "/exam-coach/index.html", "/exam-coach/x%2Fy/", "/elsewhere"]
            .map((p) => core.examFromPath(p)),
        warm: [
          core.shouldWarm(0, now),
          core.shouldWarm(now - 54 * 60 * 1000, now),
          core.shouldWarm(now - 55 * 60 * 1000, now),
          core.shouldWarm(now + 60 * 1000, now),
        ],
        defaults: core.loadSettings(broken),
        savedToBroken: core.saveSettings(broken, { autoDeep: true }),
        saved,
        loaded: core.loadSettings(store),
        raw: memory.get("exam-coach:settings"),
        lastActive: core.loadLastActive(store, "aigp"),
        lastActiveOther: core.loadLastActive(store, "other"),
        lastActiveBroken: core.loadLastActive(broken, "aigp"),
        lastActiveNull: core.loadLastActive(null, "aigp"),
      };
    });
    expect(out.paths).toEqual([
      { id: "aigp", name: "IAPP AIGP", known: true },
      { id: "aigp", name: "IAPP AIGP", known: true },
      { id: "aigp", name: "IAPP AIGP", known: true },
      { id: "aigp", name: "IAPP AIGP", known: true },
      { id: "x/y", name: "", known: false },
      { id: "aigp", name: "IAPP AIGP", known: true },
    ]);
    expect(out.warm).toEqual([true, false, true, true]);
    expect(out.defaults).toEqual({ autoDeep: true });
    expect(out.savedToBroken).toBe(false);
    expect(out.saved).toBe(true);
    expect(out.loaded).toEqual({ autoDeep: false });
    expect(out.raw).toBe('{"autoDeep":false}');
    expect(out.lastActive).toBe(10 * 60 * 60 * 1000 - 1000);
    expect([out.lastActiveOther, out.lastActiveBroken, out.lastActiveNull]).toEqual([0, 0, 0]);
  });

  test("image.js shrinks a 4000×3000 photo to 2576×1932, JPEG in base64 without prefix", async ({ page }) => {
    await page.goto(BASE);
    const out = await page.evaluate(async () => {
      const { compressImage } = await import("/exam-coach/image.js");
      const c = document.createElement("canvas");
      c.width = 4000;
      c.height = 3000;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(0, 0, 4000, 3000);
      ctx.fillStyle = "#0E3B43";
      ctx.font = "140px sans-serif";
      ctx.fillText("Which option is correct?", 200, 500);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
      const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
      const r = await compressImage(file);
      return { width: r.width, height: r.height, mediaType: r.mediaType, bytes: r.bytes, quality: r.quality,
        head: r.base64.slice(0, 12), len: r.base64.length };
    });
    expect(out.width).toBe(2576);
    expect(out.height).toBe(1932);
    expect(out.mediaType).toBe("image/jpeg");
    expect(out.quality).toBe(0.85);
    expect(out.head).not.toMatch(/^data:/);
    expect(out.head.startsWith("/9j/")).toBe(true); // FF D8 FF: start of a JPEG, in base64
    expect(out.bytes).toBeGreaterThan(1000);
    expect(out.len).toBeGreaterThan(out.bytes);
  });

  test("image.js keeps a heavy photo under the byte cap: lower quality, then a smaller size", async ({ page }) => {
    await page.goto(BASE);
    const out = await page.evaluate(async () => {
      const { compressImage } = await import("/exam-coach/image.js");
      const c = document.createElement("canvas");
      c.width = 1600;
      c.height = 1200;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(1600, 1200);
      let seed = 7;
      for (let i = 0; i < img.data.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff; // deterministic noise: JPEG cannot compress it much
        img.data[i] = i % 4 === 3 ? 255 : seed & 255;
      }
      ctx.putImageData(img, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      const file = new File([blob], "noise.png", { type: "image/png" });
      const full = await compressImage(file, { maxBytes: 1e9 });
      const capped = await compressImage(file, { maxBytes: 300000, minSide: 300 });
      return { full: { w: full.width, bytes: full.bytes }, capped: { w: capped.width, h: capped.height, bytes: capped.bytes, q: capped.quality } };
    });
    expect(out.full.w).toBe(1600); // smaller than 2576: never enlarged
    expect(out.full.bytes).toBeGreaterThan(300000);
    expect(out.capped.bytes).toBeLessThanOrEqual(300000);
    expect(out.capped.q).toBe(0.65);
    expect(out.capped.w).toBeLessThan(1600);
    expect(out.capped.w / out.capped.h).toBeCloseTo(4 / 3, 1);
  });

  test("ui.js renders single and multiple answers with confidence, option texts, sources and notes", async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(async () => {
      const ui = await import("/exam-coach/ui.js");
      const root = document.createElement("div");
      root.id = "test-root";
      document.body.append(root);
      // Callable response in camelCase (engine parseAnswer + server fields).
      const single = ui.renderResult({
        logId: "log-single", questionStem: "Which of the following is the first step", requiredCount: 1, answers: ["b"],
        answerTexts: ["Test option text B"], explanation: "Test explanation of the single answer.",
        citations: ["M3/L2", "AI Act Art. 9"], confidence: "high", domain: "III", exactMatch: true,
        conflictNote: "", readIssue: "", latencyMs: 6240, servedBy: "claude-opus-5-5", fellBack: false,
      });
      single.id = "card-single";
      // Firestore-like document with the schema's snake_case fields nested under "answer".
      const multi = ui.renderResult({
        id: "log-multi", latencyMs: 9100, model: "claude-fable-5-1", fellBack: true,
        answer: {
          question_stem: "Select two", required_count: 2, answers: ["C", "A"], answer_texts: ["Text C", "Text A"],
          explanation: "Test explanation of the multiple answer.", citations: ["Book ch. 7"], confidence: "medium",
          domain: "II", exact_match: false, conflict_note: "Test conflict note.", read_issue: "Test read issue.",
        },
      });
      multi.id = "card-multi";
      const three = ui.renderResult({ answers: ["A", "B", "D"], requiredCount: 3, confidence: "weird" });
      three.id = "card-three";
      root.append(single, multi, three);
    });
    const single = page.locator("#card-single");
    await expect(single.locator(".letters")).toHaveText("B");
    await expect(single.locator(".result-head .pill")).toHaveText("High confidence");
    await expect(single.locator(".result-head .pill")).toHaveClass(/pill-high/);
    await expect(single.locator(".choose")).toHaveCount(0);
    await expect(single.locator(".option")).toHaveText(["BTest option text B"]);
    await expect(single.locator(".reasoning")).toHaveText("Test explanation of the single answer.");
    await expect(single.locator(".citation")).toHaveText(["M3/L2", "AI Act Art. 9"]);
    await expect(single.locator(".badge")).toHaveText("Known question");
    await expect(single.locator(".meta .chip")).toHaveText(["Domain III", "6.2 s · Opus"]);
    await expect(single.locator(".warn")).toHaveCount(0);
    await expect(single.locator(".stem")).toHaveText("Read as: “Which of the following is the first step…”");
    for (const name of ["Deep review", "Mark as doubtful", "New question"]) {
      await expect(single.getByRole("button", { name })).toBeVisible();
    }
    expect(await single.getAttribute("data-log-id")).toBe("log-single");

    const multi = page.locator("#card-multi");
    await expect(multi.locator(".letters")).toHaveText("A · C");
    await expect(multi.locator(".choose")).toHaveText("Select 2");
    await expect(multi.locator(".option-letter")).toHaveText(["A", "C"]);
    await expect(multi.locator(".option-text")).toHaveText(["Text A", "Text C"]);
    await expect(multi.locator(".result-head .pill")).toHaveText("Medium confidence");
    await expect(multi.locator(".warn")).toHaveText(["Source conflict: Test conflict note.", "Photo: Test read issue."]);
    await expect(multi.locator(".citation")).toHaveText(["Book ch. 7"]);
    await expect(multi.locator(".meta .chip")).toHaveText(["Domain II", "9.1 s · Fable · fallback model"]);
    await expect(multi.locator(".badge")).toHaveCount(0);
    expect(await multi.getAttribute("data-log-id")).toBe("log-multi");

    const three = page.locator("#card-three");
    await expect(three.locator(".letters")).toHaveText("A · B · D");
    await expect(three.locator(".letters")).toHaveClass(/letters-many/);
    await expect(three.locator(".pill")).toHaveText("Low confidence"); // unknown values fall back to low
    await expect(three.locator(".citations")).toHaveCount(0);
  });

  test("ui.js renders the deep review (confirmed or changed) and the error messages", async ({ page }) => {
    await page.goto(BASE);
    const errors = await page.evaluate(async () => {
      const ui = await import("/exam-coach/ui.js");
      const root = document.createElement("div");
      root.id = "test-root";
      document.body.append(root);
      const fast = { logId: "log-1", answers: ["B", "D"], requiredCount: 2, confidence: "low", explanation: "First.", domain: "IV" };
      const card = ui.renderResult(fast);
      root.append(card);
      card.querySelector(".deep-slot").append(ui.renderDeep({
        logId: "log-2", answers: ["A", "C"], requiredCount: 2, answerTexts: ["Deep A", "Deep C"],
        explanation: "Longer test explanation of the deep review.", confidence: "high",
        citations: ["M5/L1", "NIST AI RMF MAP 1.1"], domain: "IV", latencyMs: 31000, servedBy: "claude-opus-5-5",
      }, fast));
      const confirm = document.createElement("div");
      confirm.id = "confirm-root";
      document.body.append(confirm);
      confirm.append(ui.renderDeep({ answers: ["D", "B"], confidence: "medium", explanation: "Same letters." }, fast));
      const err = document.createElement("div");
      err.id = "error-root";
      document.body.append(err);
      err.append(ui.renderError(ui.errorMessage({ code: "functions/unavailable" }), { detail: "The model is overloaded.", retry: true }));
      const busy = ui.renderBusy("Deep review…");
      return {
        busyLive: busy.getAttribute("role"),
        busySecondsHidden: busy.querySelector(".busy-seconds").getAttribute("aria-hidden"),
        signIn: ui.errorMessage({ code: "functions/unauthenticated" }),
        security: ui.errorMessage({ code: "functions/unauthenticated" }, { signedIn: true }),
        exhausted: ui.errorMessage({ code: "functions/resource-exhausted" }),
        denied: ui.errorMessage({ code: "functions/permission-denied" }),
        firestore: ui.errorMessage({ code: "permission-denied" }),
        image: ui.errorMessage({ code: "image/unreadable" }),
        unknown: ui.errorMessage(new Error("boom")),
        auth: ui.authErrorMessage({ code: "auth/invalid-credential" }),
        authUnknown: ui.authErrorMessage({ code: "auth/whatever" }),
      };
    });
    const root = page.locator("#test-root");
    await expect(root.locator(".deep-label")).toHaveText("Deep review");
    await expect(root.locator(".deep-head")).toHaveText("Changes to A · C");
    await expect(root.locator(".deep-head")).toHaveClass(/change/);
    await expect(root.locator(".deep .choose")).toHaveText("Select 2");
    await expect(root.locator(".deep .option-text")).toHaveText(["Deep A", "Deep C"]);
    await expect(root.locator(".deep .reasoning")).toHaveText("Longer test explanation of the deep review.");
    await expect(root.locator(".deep .citation")).toHaveText(["M5/L1", "NIST AI RMF MAP 1.1"]);
    await expect(root.locator(".deep .pill")).toHaveText("High confidence");
    await expect(root.locator(".deep .meta .chip")).toHaveText(["31.0 s · Opus"]); // same domain: not repeated

    const confirm = page.locator("#confirm-root");
    await expect(confirm.locator(".deep-head")).toHaveText("Confirmed");
    await expect(confirm.locator(".deep-head")).toHaveClass(/ok/);
    await expect(confirm.locator(".option")).toHaveCount(0);

    const err = page.locator("#error-root");
    await expect(err.locator(".error")).toHaveText("Service unavailable, try again shortlyThe model is overloaded.");
    await expect(err.getByRole("button", { name: "New question" })).toBeVisible();
    expect(errors).toEqual({
      busyLive: "status",
      busySecondsHidden: "true", // the live region announces the label, not every tick
      signIn: "Please sign in again",
      security: "Security check failed: reload the page", // signed in: the App Check token failed
      exhausted: "Too many requests, try again shortly",
      denied: "This account is not allowed",
      firestore: "This account is not allowed",
      image: "Could not read this image, try another photo",
      unknown: "Something went wrong, try again",
      auth: "Wrong email or password",
      authUnknown: "Sign-in failed, try again",
    });
  });

  test("ui.js keeps each option text with its letter: empty texts skipped in place, unpaired texts without a letter", async ({ page }) => {
    await page.goto(BASE);
    const out = await page.evaluate(async () => {
      const ui = await import("/exam-coach/ui.js");
      const root = document.createElement("div");
      root.id = "pairing-root";
      document.body.append(root);
      const card = (id, raw) => {
        const n = ui.renderResult(raw);
        n.id = id;
        root.append(n);
      };
      // Paired (engine textsPaired true): A has no text, so C's text must stay with C, not move up to A.
      card("pair-gap", { answers: ["A", "C"], answerTexts: ["", "Text C"], textsPaired: true, requiredCount: 2 });
      // Paired but given out of order: the pairs are sorted together.
      card("pair-sort", { answers: ["D", "B"], answerTexts: ["Text D", ""], requiredCount: 2 });
      // The engine could not pair them (textsPaired false) although the counts now match: no letter on the text.
      card("unpaired-flag", { answers: ["A"], answerTexts: ["Loose text"], textsPaired: false });
      // Counts differ: the texts cannot be paired either.
      card("unpaired-count", { answers: ["B", "A"], answer_texts: ["Only one"], requiredCount: 2 });
      // Deep review that changes the answer, with a paired empty text.
      const fast = { answers: ["B"], answerTexts: ["Text B"], textsPaired: true };
      const deep = document.createElement("div");
      deep.id = "pair-deep";
      root.append(deep);
      deep.append(ui.renderDeep({ answers: ["C", "A"], answerTexts: ["Deep C", ""], textsPaired: true, requiredCount: 2 }, fast));
      // Firestore log document (snake_case) in the doubtful list.
      const list = document.createElement("div");
      list.id = "pair-doubtful";
      root.append(list);
      list.append(ui.renderDoubtfulList([{ logId: "log-p", answers: ["A", "B"], answer_texts: ["", "Doubt B"], texts_paired: true }]));
      const once = ui.normalizeResult({ answers: ["A"], answerTexts: ["x"], textsPaired: false });
      return { idempotent: ui.normalizeResult(once).textsPaired, paired: ui.normalizeResult({ answers: ["A"], answerTexts: ["x"] }).textsPaired };
    });
    const options = (id) => page.locator(`#${id} .option`);
    await expect(page.locator("#pair-gap .letters")).toHaveText("A · C");
    await expect(options("pair-gap")).toHaveCount(1);
    await expect(page.locator("#pair-gap .option-letter")).toHaveText(["C"]);
    await expect(page.locator("#pair-gap .option-text")).toHaveText(["Text C"]);
    await expect(page.locator("#pair-sort .letters")).toHaveText("B · D");
    await expect(page.locator("#pair-sort .option-letter")).toHaveText(["D"]);
    await expect(page.locator("#pair-sort .option-text")).toHaveText(["Text D"]);
    await expect(page.locator("#unpaired-flag .option-letter")).toHaveText(["•"]);
    await expect(page.locator("#unpaired-flag .option-text")).toHaveText(["Loose text"]);
    await expect(page.locator("#unpaired-count .letters")).toHaveText("A · B");
    await expect(page.locator("#unpaired-count .option-letter")).toHaveText(["•"]);
    await expect(page.locator("#unpaired-count .option-text")).toHaveText(["Only one"]);
    await expect(page.locator("#pair-deep .deep-head")).toHaveText("Changes to A · C");
    await expect(page.locator("#pair-deep .option-letter")).toHaveText(["C"]);
    await expect(page.locator("#pair-deep .option-text")).toHaveText(["Deep C"]);
    await expect(page.locator("#pair-doubtful .option-letter")).toHaveText(["B"]);
    await expect(page.locator("#pair-doubtful .option-text")).toHaveText(["Doubt B"]);
    expect(out).toEqual({ idempotent: false, paired: true });
  });

  test("ui.js renders the doubtful list, with deep reviews attached to their answer, and its empty state", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("#doubtful-open")).toHaveCount(1);
    await expect(page.locator("#doubtful")).toBeHidden();
    await page.evaluate(async () => {
      const ui = await import("/exam-coach/ui.js");
      const ts = (iso) => ({ toMillis: () => Date.parse(iso), toDate: () => new Date(iso) }); // Firestore Timestamp
      const root = document.createElement("div");
      root.id = "doubtful-test";
      document.body.append(root);
      root.append(ui.renderDoubtfulList([
        { logId: "log-old", createdAt: ts("2026-11-07T09:00:00Z"), mode: "answer", questionStem: "Second test question",
          answers: ["B", "D"], requiredCount: 2, confidence: "low", explanation: "Older reason." },
        { logId: "log-deep", createdAt: ts("2026-11-08T10:05:00Z"), mode: "deep", previousLogId: "log-new",
          answers: ["C"], confidence: "high", explanation: "Deep reason.", citations: ["M2/L1"] },
        { logId: "log-new", createdAt: ts("2026-11-08T10:00:00Z"), mode: "answer", questionStem: "First test question",
          answers: ["A"], confidence: "medium", explanation: "Quick reason.", domain: "I", conflict_note: "Test conflict." },
      ]));
      const empty = document.createElement("div");
      empty.id = "doubtful-empty";
      document.body.append(empty);
      empty.append(ui.renderDoubtfulList([]));
    });
    const root = page.locator("#doubtful-test");
    const items = root.locator(".doubtful-item");
    await expect(items).toHaveCount(2);
    await expect(root.locator(".doubtful-count")).toHaveText("2 doubtful questions");
    await expect(items.first()).toContainText("First test question");
    await expect(items.first()).toContainText("08 Nov");
    await expect(items.first().locator(".chip").nth(1)).toHaveText("Domain I");
    await expect(items.first().locator(".warn")).toHaveText("Source conflict: Test conflict.");
    await expect(items.first().locator(".deep-head")).toHaveText("Changes to C");
    await expect(items.first().locator(".deep .citation")).toHaveText(["M2/L1"]);
    expect(await items.first().getAttribute("data-log-id")).toBe("log-new");
    expect(await items.first().getAttribute("data-log-ids")).toBe("log-new,log-deep");
    await expect(items.nth(1).locator(".letters")).toHaveText("B · D");
    await expect(items.nth(1).locator(".pill").first()).toHaveText("Low confidence");
    await expect(items.nth(1).locator(".deep")).toHaveCount(0);
    await expect(root.getByRole("button", { name: "Show photo" })).toHaveCount(2);
    await expect(root.getByRole("button", { name: "Not doubtful" })).toHaveCount(2);
    await expect(page.locator("#doubtful-empty")).toHaveText("No questions marked as doubtful.");
  });

  test("app.js flow with a mocked Firebase SDK: sign-in, one warm-up, answer, auto deep review, doubtful list", async ({ page }) => {
    // The gstatic Firebase modules are replaced by local mocks: no network, no Firebase project, no API call.
    for (const [name, body] of Object.entries(FIREBASE_MOCKS)) {
      await page.route(`https://www.gstatic.com/firebasejs/10.7.1/${name}.js`, (route) => route.fulfill({
        body, contentType: "application/javascript", headers: { "Access-Control-Allow-Origin": "*" },
      }));
    }
    await page.addInitScript(MOCK_SERVER);
    await page.clock.install();
    await page.goto(BASE);
    const calls = () => page.evaluate(() => window.__calls.map((c) => ({ ...c, data: { ...c.data, image: c.data.image ? {
      mediaType: c.data.image.mediaType, jpeg: c.data.image.base64.startsWith("/9j/") } : undefined } })));

    await expect(page.locator("#login-form")).toBeVisible();
    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("#login-error")).toHaveText("Wrong email or password");
    await page.getByLabel("Password").fill("test-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("#coach")).toBeVisible();
    await expect(page.locator("#status")).toHaveText("ready");
    expect(await calls()).toEqual([
      { name: "examCoachAnswer", region: "europe-west1", timeout: 560000, data: { examId: "aigp", mode: "warm", requestId: REQUEST_ID } },
    ]);

    // Visible again within 55 minutes: no second warm-up.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(200);
    expect(await calls()).toHaveLength(1);

    // Photo → answer (low confidence) → automatic deep review with the previous log id.
    await page.locator("#file-camera").setInputFiles(path.join(__dirname, "..", "public", "exam-coach", "icon-192.png"));
    await expect(page.locator("#result-root .result > .result-head .letters")).toHaveText("B");
    await expect(page.locator("#result-root .deep-head")).toHaveText("Changes to C");
    await expect(page.locator("#result-root .deep .citation")).toHaveText(["M2/L1"]);
    await expect(page.getByRole("button", { name: "Deep review" })).toBeHidden();
    const [, answer, deep] = await calls();
    expect(answer).toEqual({ name: "examCoachAnswer", region: "europe-west1", timeout: 180000,
      data: { examId: "aigp", mode: "answer", image: { mediaType: "image/jpeg", jpeg: true }, requestId: REQUEST_ID } });
    expect(deep).toEqual({ name: "examCoachAnswer", region: "europe-west1", timeout: 560000,
      data: { examId: "aigp", mode: "deep", previousLogId: "log-a", image: { mediaType: "image/jpeg", jpeg: true }, requestId: REQUEST_ID } });
    expect(new Set((await calls()).map((c) => c.data.requestId)).size).toBe(3);

    await page.getByRole("button", { name: "Mark as doubtful" }).click();
    await expect(page.getByRole("button", { name: "Marked as doubtful" })).toBeDisabled();
    expect(await page.evaluate(() => window.__updates)).toEqual([
      { id: "log-a", patch: { flagged: true } }, { id: "log-d", patch: { flagged: true } },
    ]);

    await page.getByRole("button", { name: "Doubtful questions" }).click();
    const item = page.locator("#doubtful-list .doubtful-item");
    await expect(item).toHaveCount(1);
    expect(await item.getAttribute("data-log-ids")).toBe("log-a,log-d");
    await expect(item.locator(".deep-head")).toHaveText("Changes to C");
    await item.getByRole("button", { name: "Show photo" }).click();
    await expect(item.locator(".doubtful-photo img")).toHaveAttribute("src", /^data:image\/png;base64,/);
    expect((await calls()).at(-1)).toEqual({ name: "examCoachPhoto", region: "europe-west1", timeout: 35000, data: { logId: "log-a" } });
    await item.getByRole("button", { name: "Not doubtful" }).click();
    await expect(page.locator("#doubtful-list")).toHaveText("No questions marked as doubtful.");
    await page.getByRole("button", { name: "Back" }).click();

    // After 56 minutes away the next visit warms the cache again.
    const before = (await calls()).length;
    await page.clock.fastForward("56:00");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(async () => (await calls()).length).toBe(before + 1);
    expect((await calls()).at(-1).data).toEqual({ examId: "aigp", mode: "warm", requestId: REQUEST_ID });

    // Settings: auto-deep saved under exam-coach:settings; sign-out returns to the login form.
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.locator("#settings-pack")).toHaveText("Knowledge base v-test");
    await page.getByText("Automatic deep review").click();
    expect(await page.evaluate(() => localStorage.getItem("exam-coach:settings"))).toBe('{"autoDeep":false}');
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.locator("#login-form")).toBeVisible();
  });

  test("app.js never starts a warm-up while an answer or a deep review is running; the cache mark is the call start", async ({ page }) => {
    const calls = await openSignedIn(page);
    await expect(page.locator("#status")).toHaveText("ready");
    expect(await calls()).toEqual([{ name: "examCoachAnswer", timeout: 560000, mode: "warm" }]);
    const warmSent = await page.evaluate(() => window.__sentAt[0]);
    expectSameTime(await lastActive(page), warmSent);

    // An answer that is still running when the page comes back after 56 minutes: no warm-up next to it.
    await page.evaluate(() => { window.__hold("answer"); window.__hold("deep"); });
    await page.locator("#file-camera").setInputFiles(PHOTO);
    await expect.poll(async () => (await calls()).map((c) => c.mode)).toEqual(["warm", "answer"]);
    const answerSent = await page.evaluate(() => window.__sentAt[1]);
    await page.clock.fastForward("56:00");
    await visible(page);
    await page.waitForTimeout(300);
    expect((await calls()).map((c) => c.mode)).toEqual(["warm", "answer"]);

    // The answer ends 56 minutes after it was sent: the mark is its start, so the cache counts as old again...
    await page.evaluate(() => window.__release("answer"));
    await expect(page.locator("#result-root .result > .result-head .letters")).toHaveText("B");
    expectSameTime(await lastActive(page), answerSent);
    // ...and the automatic deep review (low confidence) is running: still no warm-up.
    await expect.poll(async () => (await calls()).map((c) => c.mode)).toEqual(["warm", "answer", "deep"]);
    await visible(page);
    await page.waitForTimeout(300);
    expect((await calls()).map((c) => c.mode)).toEqual(["warm", "answer", "deep"]);

    // Deep review done: its start renews the mark, so no warm-up now; 56 minutes later there is one again.
    const deepSent = await page.evaluate(() => window.__sentAt[2]);
    await page.evaluate(() => window.__release("deep"));
    await expect(page.locator("#result-root .deep-head")).toHaveText("Changes to C");
    expectSameTime(await lastActive(page), deepSent);
    await visible(page);
    await page.waitForTimeout(300);
    expect(await calls()).toHaveLength(3);
    await page.clock.fastForward("56:00");
    await visible(page);
    await expect.poll(async () => (await calls()).map((c) => c.mode)).toEqual(["warm", "answer", "deep", "warm"]);
    await expect(page.locator("#status")).toHaveText("ready");
  });

  test("app.js retries a failed warm-up once after a few seconds, never on final errors, and keeps the pack version of the replies", async ({ page }) => {
    const calls = await openSignedIn(page, { beforeSignIn: () => { window.__warmErrors.push("unavailable"); } });
    // The first warm-up fails: no immediate retry, none within 2 seconds either...
    await expect.poll(async () => (await calls()).length).toBe(1);
    await page.waitForTimeout(300);
    await page.clock.fastForward(1500);
    await page.waitForTimeout(100);
    expect(await calls()).toHaveLength(1);
    await expect(page.locator("#status .status-label")).toHaveText("warming");
    // ...the single retry comes 3 to 5 seconds after the failure.
    await page.clock.fastForward(3500);
    await expect.poll(async () => (await calls()).length).toBe(2);
    await expect(page.locator("#status")).toHaveText("ready");
    const sent = await page.evaluate(() => window.__sentAt);
    expect(sent[1] - sent[0]).toBeGreaterThanOrEqual(3000);

    // Final errors are not retried. resource-exhausted: the usual warm-up failure hint.
    await page.evaluate(() => window.__warmErrors.push("resource-exhausted"));
    await page.clock.fastForward("56:00");
    await visible(page);
    await expect(page.locator("#status")).toHaveText("offline");
    await expect(page.locator("#capture-hint")).toHaveText("Warm-up failed: the first answer will take longer.");
    await page.clock.fastForward("00:10");
    await page.waitForTimeout(300);
    expect(await calls()).toHaveLength(3);

    // Signed in and "unauthenticated" (App Check token refused): a security message, not a sign-in request.
    await page.evaluate(() => window.__warmErrors.push("unauthenticated", "failed-precondition"));
    await visible(page);
    await expect(page.locator("#capture-hint")).toHaveText("Security check failed: reload the page");
    await expect(page.locator("#capture-hint")).toHaveClass(/is-error/);
    await page.clock.fastForward("00:10");
    await page.waitForTimeout(300);
    expect(await calls()).toHaveLength(4);
    await visible(page);
    await expect(page.locator("#capture-hint")).toHaveText("Warm-up failed: the first answer will take longer.");
    await page.clock.fastForward("00:10");
    await page.waitForTimeout(300);
    expect(await calls()).toHaveLength(5);

    // The knowledge base version shown in the settings follows the replies of the answers too.
    await page.evaluate(() => { window.__replyPatch.answer = { packVersion: "v-answer", confidence: "high" }; });
    await page.locator("#file-camera").setInputFiles(PHOTO);
    await expect(page.locator("#result-root .result > .result-head .letters")).toHaveText("B");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.locator("#settings-pack")).toHaveText("Knowledge base v-answer");
  });

  test("core.js makes 20-character request ids, reads log outcomes and tells a cut connection from a function error", async ({ page }) => {
    await page.goto(BASE);
    const r = await page.evaluate(async () => {
      const core = await import("/exam-coach/core.js");
      const ids = Array.from({ length: 500 }, () => core.newRequestId());
      // 25 bytes of 255 (out of the 62-symbol range, drawn again), then 61 ("9"): rejection sampling and refills.
      let n = 0;
      const source = { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = n++ < 25 ? 255 : 61; return a; } };
      return {
        shaped: ids.every((id) => /^[A-Za-z0-9]{20}$/.test(id)),
        unique: new Set(ids).size,
        drawnAgain: core.newRequestId(source),
        outcomes: [null, {}, { status: "running" }, { status: "ok" }, { status: "error", error: { code: "deadline-exceeded" } },
          { status: "error", error: { code: "functions/unavailable" } }, { status: "error", error: { code: "<b>x</b>" } },
          { status: "error" },
          { status: "error", error: { code: "failed-precondition", message: "cause", userMessage: " The model declined to answer this question. " } },
          { status: "error", error: { code: "internal", userMessage: "x".repeat(241) } }].map(core.logOutcome),
        cut: [
          { code: "functions/internal", message: "internal" },
          { code: "functions/deadline-exceeded", message: "deadline-exceeded" },
          { code: "functions/unavailable", message: "unavailable" },
          { code: "functions/internal", message: "Internal error. Try again later." },
          { code: "functions/unavailable", message: "The exam material is not available. Try again shortly." },
          { code: "functions/permission-denied", message: "permission-denied" },
          { code: "functions/resource-exhausted", message: "resource-exhausted" },
          null,
        ].map(core.isCutConnection),
        timeouts: core.CALL_TIMEOUT_MS,
        waits: [core.LOG_ARRIVAL_MS, core.LOG_GRACE_MS, core.LOG_TICK_GAP_MS],
      };
    });
    expect(r.shaped).toBe(true);
    expect(r.unique).toBe(500);
    expect(r.drawnAgain).toBe("99999999999999999999");
    expect(r.outcomes).toEqual([
      { state: "missing" }, { state: "running" }, { state: "running" }, { state: "ok" },
      { state: "error", code: "deadline-exceeded", message: "" }, { state: "error", code: "unavailable", message: "" },
      { state: "error", code: "internal", message: "" }, { state: "error", code: "internal", message: "" },
      { state: "error", code: "failed-precondition", message: "The model declined to answer this question." },
      { state: "error", code: "internal", message: "" },
    ]);
    expect(r.cut).toEqual([true, true, true, false, false, false, false, false]);
    expect(r.timeouts).toEqual({ answer: 180000, warm: 560000, deep: 560000 });
    expect(r.waits).toEqual([30000, 8000, 3000]);
  });

  test("app.js recovers a deep review whose connection is cut (iOS drops idle requests after ~60 s) from its log document", async ({ page }) => {
    await openSignedIn(page);
    await expect(page.locator("#status")).toHaveText("ready");
    // The low-confidence answer starts the automatic deep review; its connection is cut while the function works on.
    await page.evaluate(() => { window.__cuts.deep = ["ok"]; window.__hold("deep"); });
    await page.locator("#file-camera").setInputFiles(PHOTO);
    await expect(page.locator("#result-root .result > .result-head .letters")).toHaveText("B");
    const slotLabel = page.locator("#result-root .deep-slot .busy-label");
    await expect(slotLabel).toHaveText("Still reviewing…");
    const requestId = await page.evaluate(() => window.__calls.at(-1).data.requestId);
    expect(requestId).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(await page.evaluate((id) => window.__docs[id].status, requestId)).toBe("running");

    // Three minutes later the function is still working: the page keeps waiting, with no error and no new call.
    await page.clock.fastForward("03:00");
    await page.waitForTimeout(200);
    await expect(slotLabel).toHaveText("Still reviewing…");
    expect(await page.evaluate(() => window.__calls.length)).toBe(3);

    // The result lands in the log document: shown as the deep review, under the request id.
    await page.evaluate(() => window.__release("deep"));
    await expect(page.locator("#result-root .deep-head")).toHaveText("Changes to C");
    await expect(page.locator("#result-root .deep .citation")).toHaveText(["M2/L1"]);
    await expect(page.getByRole("button", { name: "Deep review" })).toBeHidden();
    expect(await page.evaluate(() => window.__snapshots)).toBe(0);
    await page.getByRole("button", { name: "Mark as doubtful" }).click();
    await expect(page.getByRole("button", { name: "Marked as doubtful" })).toBeDisabled();
    expect(await page.evaluate(() => window.__updates)).toEqual([
      { id: "log-a", patch: { flagged: true } }, { id: requestId, patch: { flagged: true } },
    ]);
  });

  test("app.js gives up on a cut call whose log never shows up, shows a stored error, and never waits on a function's own error", async ({ page }) => {
    // A warm-up whose request never reached the function: it waits 30 s for its log document, then the usual retry.
    const calls = await openSignedIn(page, { beforeSignIn: () => { window.__cuts.warm = ["never"]; } });
    await expect.poll(async () => (await calls()).length).toBe(1);
    await page.clock.runFor(29000);
    await expect(page.locator("#status .status-label")).toHaveText("warming");
    expect(await calls()).toHaveLength(1);
    await page.clock.runFor(7000);
    await expect(page.locator("#status")).toHaveText("ready");
    expect((await calls()).map((c) => c.mode)).toEqual(["warm", "warm"]);
    const label = page.locator("#result-root .busy-label");

    // The request never reached the function: no log document within 30 s of the call, then the call's own error.
    await page.evaluate(() => { window.__cuts.answer = ["never"]; });
    await page.locator("#file-camera").setInputFiles(PHOTO);
    await expect(label).toHaveText("Connection lost, waiting for the answer…");
    await page.clock.runFor(20000);
    await expect(label).toHaveText("Connection lost, waiting for the answer…");
    await page.clock.runFor(11000);
    await expect(page.locator("#result-root .error")).toHaveText("Something went wrong, try again");
    expect(await page.evaluate(() => window.__snapshots)).toBe(0);

    // The function stored an error for the cut request: its message, at once; with the function's own sentence when
    // the log has it (the cause's text is never shown).
    await page.getByRole("button", { name: "New question" }).click();
    await page.evaluate(() => { window.__cuts.answer = ["error:deadline-exceeded"]; });
    await page.locator("#file-camera").setInputFiles(PHOTO);
    await expect(page.locator("#result-root .error")).toHaveText("It took too long, try again");
    await page.getByRole("button", { name: "New question" }).click();
    await page.evaluate(() => { window.__cuts.answer = ["error:failed-precondition:The model declined to answer this question."]; });
    await page.locator("#file-camera").setInputFiles(PHOTO);
    await expect(page.locator("#result-root .error")).toHaveText(
        "Not available any more, take a new photoThe model declined to answer this question.");
    await expect(page.locator("#result-root .error")).not.toContainText("cause text");

    // A cut answer stored fine: shown, with the request id as its log id.
    await page.getByRole("button", { name: "New question" }).click();
    await page.evaluate(() => { window.__cuts.answer = ["ok"]; window.__replyPatch.answer = { confidence: "high" }; });
    await page.locator("#file-camera").setInputFiles(PHOTO);
    await expect(page.locator("#result-root .result > .result-head .letters")).toHaveText("B");
    const answerId = await page.evaluate(() => window.__calls.at(-1).data.requestId);
    expect(await page.locator("#result-root .result").getAttribute("data-log-id")).toBe(answerId);

    // An error sent by the function (its own sentence) is shown without waiting for any log document.
    await page.evaluate(() => {
      const base = window.__server;
      window.__server = async (name, data) => {
        if (data.mode === "deep") throw Object.assign(new Error("Model unavailable. Try again shortly."), { code: "functions/unavailable" });
        return base(name, data);
      };
    });
    await page.getByRole("button", { name: "Deep review" }).click();
    await expect(page.locator("#result-root .deep-slot .error")).toContainText("Service unavailable, try again shortly");
    expect(await page.evaluate(() => window.__snapshots)).toBe(0);
    await expect(page.getByRole("button", { name: "Deep review" })).toBeEnabled();
  });

  test("app.js shows a result stored while the phone was locked, and gives up on a still-running call only after a grace period", async ({ page }) => {
    await openSignedIn(page);
    await expect(page.locator("#status")).toHaveText("ready");

    // Phone locked during an answer: the function stores it at once, but the page learns of the cut only when it
    // wakes up 4 minutes later (past the 180 s of an answer), and Firestore takes 3 s to report the document.
    await page.evaluate(() => {
      window.__cuts.answer = ["ok-late"];
      window.__hold("cut");
      window.__replyPatch.answer = { confidence: "high" };
    });
    await page.locator("#file-camera").setInputFiles(PHOTO);
    await expect.poll(() => page.evaluate(() => window.__calls.length)).toBe(2);
    const id = await page.evaluate(() => window.__calls.at(-1).data.requestId);
    await expect.poll(() => page.evaluate((i) => window.__docs[i] && window.__docs[i].status, id)).toBe("ok");
    await page.clock.fastForward("04:00");
    await page.evaluate(() => { window.__snapshotDelay = 3000; window.__release("cut"); });
    await page.clock.runFor(1500);
    await expect(page.locator("#result-root .busy-label")).toHaveText("Connection lost, waiting for the answer…");
    await page.clock.runFor(3000);
    await expect(page.locator("#result-root .result > .result-head .letters")).toHaveText("B");
    expect(await page.locator("#result-root .result").getAttribute("data-log-id")).toBe(id);

    // A deep review still running when the page wakes up past its 560 s: no instant failure, the grace period first.
    await page.evaluate(() => { window.__snapshotDelay = 0; window.__cuts.deep = ["ok"]; window.__hold("deep"); });
    await page.getByRole("button", { name: "Deep review" }).click();
    const slot = page.locator("#result-root .deep-slot");
    await expect(slot.locator(".busy-label")).toHaveText("Still reviewing…");
    await page.clock.runFor(1000);
    await page.clock.fastForward("09:30");
    await page.clock.runFor(1500);
    await expect(slot.locator(".busy-label")).toHaveText("Still reviewing…");
    await page.clock.runFor(8000);
    await expect(slot.locator(".error")).toHaveText("It took too long, try again");
    await expect(page.getByRole("button", { name: "Deep review" })).toBeEnabled();
    expect(await page.evaluate(() => window.__snapshots)).toBe(0);
  });

  test("the coach view has an h1, a status whose ticking seconds are hidden from screen readers, and fits 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openSignedIn(page, { beforeSignIn: () => window.__hold("warm") });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/IAPP AIGP/);
    const status = page.locator("#status");
    await expect(status).toHaveAttribute("role", "status");
    await expect(status.locator(".status-label")).toHaveText("warming");
    await expect(status.locator(".status-seconds")).toHaveAttribute("aria-hidden", "true");
    await page.clock.fastForward("00:12");
    await expect(status.locator(".status-seconds")).toHaveText(/^1[2-4] s$/);
    await expect(status.locator(".status-label")).toHaveText("warming"); // the live text does not change with the ticks
    await page.evaluate(() => { document.querySelector("#status .status-seconds").textContent = "888 s"; }); // widest digits (a warm-up may run 560 s)

    const layout = () => page.evaluate(async () => {
      await document.fonts.ready;
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      const name = document.querySelector(".brand-exam");
      const kicker = document.querySelector(".brand-kicker");
      return {
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
        nameTruncated: name.scrollWidth > name.clientWidth,
        kickerShown: getComputedStyle(kicker).display !== "none",
        kickerLines: Math.round(kicker.getBoundingClientRect().height / parseFloat(getComputedStyle(kicker).lineHeight)),
        statusLines: Math.round(box("#status .status-label").height / parseFloat(getComputedStyle(document.querySelector("#status")).lineHeight)),
        statusRight: box("#status").right,
        buttonsLeft: box("#doubtful-open").left,
        brandRight: box(".brand").right,
        statusLeft: box("#status").left,
      };
    });
    const narrow = await layout();
    expect(narrow).toMatchObject({ pageOverflow: false, nameTruncated: false, kickerShown: false, statusLines: 1 });
    expect(narrow.statusRight).toBeLessThanOrEqual(narrow.buttonsLeft);
    expect(narrow.brandRight).toBeLessThanOrEqual(narrow.statusLeft);

    await page.setViewportSize({ width: 390, height: 800 });
    const phone = await layout();
    expect(phone).toMatchObject({ pageOverflow: false, nameTruncated: false, kickerShown: true, kickerLines: 1, statusLines: 1 });
  });

  test("firebase.json serves /exam-coach through rewrites and keeps its files out of the one-year cache", async () => {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "firebase.json"), "utf8"));
    const site = config.hosting.find((h) => h.target === "apheron-homepage");
    const rewrites = site.rewrites.filter((r) => r.source.startsWith("/exam-coach"));
    for (const source of ["/exam-coach/aigp", "/exam-coach/aigp/**", "/exam-coach/**"]) {
      expect(rewrites).toContainEqual({ source, destination: "/exam-coach/index.html" });
    }
    // If two header rules match, the last one wins: the no-cache rule must come after the generic **/*.js one.
    const last = site.headers[site.headers.length - 1];
    expect(last.regex).toBe("^/exam-coach(/.*)?$");
    expect(last.headers).toContainEqual({ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" });
    const re = new RegExp(last.regex);
    expect(["/exam-coach", "/exam-coach/aigp/", "/exam-coach/app.js", "/exam-coach/styles.css"].every((p) => re.test(p))).toBe(true);
    expect(re.test("/exam-coach-other/app.js")).toBe(false);
    expect(re.test("/data-coach/app.js")).toBe(false);
  });
});
