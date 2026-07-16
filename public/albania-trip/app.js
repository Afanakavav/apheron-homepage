// Albania & Montenegro Summer Trip 2026 — app logic
// Gate -> questionnaire -> Firestore -> shared analysis dashboard.

import { SECTIONS, PEOPLE, QUESTION_BY_ID } from "./questions.js";
import { db, collection, doc, getDocs, setDoc } from "/firebase-config.js";
import { mountItineraryView } from "./itinerary-view.js";

const COLLECTION = "albaniaTripPreferences";

// Gate credentials (cosmetic: real data protection is App Check + Firestore rules)
const GATE_USER = "FamDublin";
const GATE_PASS = "Albania";
const AUTH_KEY = "albania_trip_auth";

const slug = (name) => String(name).trim().toLowerCase();

// In-memory state
const state = {
  person: null,
  responses: {},     // slug -> { name, answers, updatedAt }
  answers: {}         // current form working copy: qid -> value
};

/* ============================================================
   Tiny DOM helper
   ============================================================ */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/* ============================================================
   Gate
   ============================================================ */
function initGate() {
  const gate = document.getElementById("gate");
  const form = document.getElementById("gate-form");
  const errEl = document.getElementById("gate-error");

  if (sessionStorage.getItem(AUTH_KEY) === "true") {
    enterApp();
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = document.getElementById("gate-user").value.trim();
    const p = document.getElementById("gate-pass").value;
    if (u === GATE_USER && p === GATE_PASS) {
      sessionStorage.setItem(AUTH_KEY, "true");
      gate.style.opacity = "0";
      gate.style.transition = "opacity 0.4s";
      setTimeout(() => { gate.remove(); enterApp(); }, 400);
    } else {
      errEl.textContent = "Wrong username or password.";
      document.getElementById("gate-pass").value = "";
    }
  });
}

function enterApp() {
  const gate = document.getElementById("gate");
  if (gate) gate.remove();
  document.getElementById("app").hidden = false;
  document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
  });
  setupTabs();
  renderForm({});
  loadResponses(); // populate cache (for prefill + results count)
}

/* ============================================================
   Tabs
   ============================================================ */
let tabsRef = null;
let itineraryMounted = false;

function activateTab(key) {
  if (!tabsRef) return;
  Object.entries(tabsRef).forEach(([k, t]) => {
    t.btn.classList.toggle("active", k === key);
    t.view.hidden = k !== key;
  });
  if (key === "results") renderResults();
  if (key === "itinerary" && !itineraryMounted) {
    mountItineraryView(tabsRef.itinerary.view);
    itineraryMounted = true;
  }
  if (key === "itinerary") window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupTabs() {
  tabsRef = {
    form: { btn: document.getElementById("tab-form"), view: document.getElementById("form-view") },
    results: { btn: document.getElementById("tab-results"), view: document.getElementById("results-view") },
    itinerary: { btn: document.getElementById("tab-itinerary"), view: document.getElementById("itinerary-view") }
  };
  tabsRef.form.btn.addEventListener("click", () => activateTab("form"));
  tabsRef.results.btn.addEventListener("click", () => activateTab("results"));
  tabsRef.itinerary.btn.addEventListener("click", () => activateTab("itinerary"));
}

/* ============================================================
   Firestore I/O
   ============================================================ */
async function loadResponses() {
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    state.responses = {};
    snap.forEach((d) => { state.responses[d.id] = d.data(); });
  } catch (err) {
    console.error("Failed to load responses:", err);
  }
  updateResultsCount();
}

function updateResultsCount() {
  const n = Object.keys(state.responses).length;
  const badge = document.getElementById("results-count");
  badge.hidden = false;
  badge.textContent = `${n}/${PEOPLE.length}`;
}

async function saveResponse(payload) {
  await setDoc(doc(db, COLLECTION, slug(payload.name)), payload);
  state.responses[slug(payload.name)] = payload;
  updateResultsCount();
}

/* ============================================================
   Form rendering
   ============================================================ */
function renderForm(prefill) {
  state.answers = JSON.parse(JSON.stringify(prefill || {}));
  const root = document.getElementById("form-view");
  root.innerHTML = "";

  // Intro note
  root.appendChild(el("div", { class: "intro-note", html:
    "Answer honestly and individually — there are no wrong answers. " +
    "It takes about <strong>10 minutes</strong>. Pick your name, then complete the sections. " +
    "You can come back and edit your answers any time." }));

  // Who are you
  const who = el("div", { class: "who" });
  who.appendChild(el("h2", { text: "Who are you?" }));
  who.appendChild(el("p", { text: "Select your name so we can save (and let you edit) your answers." }));
  const whoOpts = el("div", { class: "who-options" });
  PEOPLE.forEach((name) => {
    const chip = el("button", { type: "button", class: "who-chip", text: name });
    chip.addEventListener("click", () => selectPerson(name));
    if (state.person === name) chip.classList.add("selected");
    whoOpts.appendChild(chip);
  });
  who.appendChild(whoOpts);
  who.appendChild(el("div", { class: "who-status", id: "who-status" }));
  root.appendChild(who);

  // Sections
  SECTIONS.forEach((section) => {
    const sec = el("div", { class: "section" });
    sec.appendChild(el("h2", { text: section.title }));
    sec.appendChild(el("div", { class: "section-rule" }));
    section.questions.forEach((q) => sec.appendChild(renderQuestion(q)));
    root.appendChild(sec);
  });

  // Submit bar
  const bar = el("div", { class: "submit-bar" });
  const btn = el("button", { type: "button", class: "btn-primary", id: "submit-btn", text: "Submit my answers" });
  btn.addEventListener("click", onSubmit);
  bar.appendChild(btn);
  bar.appendChild(el("div", { class: "submit-msg", id: "submit-msg" }));
  root.appendChild(bar);

  refreshWhoStatus();
}

function renderQuestion(q) {
  const wrap = el("div", { class: "q", id: `wrap-${q.id}` });
  const label = el("div", { class: "q-label", id: `lbl-${q.id}` });
  label.appendChild(document.createTextNode(q.label));
  if (q.required) label.appendChild(el("span", { class: "q-req", text: "*" }));
  wrap.appendChild(label);

  if (q.prompt) wrap.appendChild(el("div", { class: "q-prompt", text: q.prompt }));

  if (q.type === "single") {
    wrap.appendChild(renderChoices(q, false));
  } else if (q.type === "multi") {
    wrap.appendChild(el("div", { class: "q-hint", text: "Select all that apply." }));
    wrap.appendChild(renderChoices(q, true));
  } else if (q.type === "scale") {
    wrap.appendChild(renderScale(q));
  } else if (q.type === "paragraph") {
    const ta = el("textarea", { placeholder: "Write here…", "aria-label": q.label });
    ta.value = state.answers[q.id] || "";
    ta.addEventListener("input", () => { state.answers[q.id] = ta.value; });
    wrap.appendChild(ta);
  }
  return wrap;
}

function renderChoices(q, multi) {
  const box = el("div", { class: "opts", role: multi ? "group" : "radiogroup", "aria-labelledby": `lbl-${q.id}` });
  q.options.forEach((opt) => {
    const checked = multi
      ? Array.isArray(state.answers[q.id]) && state.answers[q.id].includes(opt)
      : state.answers[q.id] === opt;
    const input = el("input", {
      type: multi ? "checkbox" : "radio",
      name: q.id,
      value: opt
    });
    input.checked = checked;
    const row = el("label", { class: "opt" + (checked ? " checked" : "") }, [input, el("span", { text: opt })]);
    input.addEventListener("change", () => {
      if (multi) {
        const arr = Array.isArray(state.answers[q.id]) ? state.answers[q.id].slice() : [];
        if (input.checked) { if (!arr.includes(opt)) arr.push(opt); }
        else { const i = arr.indexOf(opt); if (i >= 0) arr.splice(i, 1); }
        state.answers[q.id] = arr;
        row.classList.toggle("checked", input.checked);
      } else {
        state.answers[q.id] = opt;
        box.querySelectorAll(".opt").forEach((r) => r.classList.remove("checked"));
        row.classList.add("checked");
      }
      clearInvalid(q.id);
    });
    box.appendChild(row);
  });
  return box;
}

function renderScale(q) {
  // Real radio inputs: keyboard-operable (Tab + arrows) and announced as a radio group.
  const group = el("div", { class: "scale", role: "radiogroup", "aria-labelledby": `lbl-${q.id}` });
  for (let v = q.min; v <= q.max; v++) {
    const input = el("input", { type: "radio", name: q.id, value: String(v), "aria-label": String(v) });
    input.checked = state.answers[q.id] === v;
    const cell = el("label", { class: "scale-opt" + (input.checked ? " checked" : "") }, [
      input,
      el("span", { text: String(v) })
    ]);
    input.addEventListener("change", () => {
      state.answers[q.id] = v;
      group.querySelectorAll(".scale-opt").forEach((c) => c.classList.remove("checked"));
      cell.classList.add("checked");
      clearInvalid(q.id);
    });
    group.appendChild(cell);
  }
  const ends = el("div", { class: "scale-ends" }, [
    el("span", { text: `${q.min} — ${q.minLabel}` }),
    el("span", { text: `${q.max} — ${q.maxLabel}` })
  ]);
  const holder = el("div");
  holder.appendChild(group);
  holder.appendChild(ends);
  return holder;
}

function selectPerson(name) {
  state.person = name;
  // renderForm rebuilds the chips and re-derives the selection highlight from
  // state.person, and prefills this person's saved answers if any.
  const existing = state.responses[slug(name)];
  renderForm(existing ? existing.answers : {});
}

function refreshWhoStatus() {
  const status = document.getElementById("who-status");
  const submitBtn = document.getElementById("submit-btn");
  if (!status) return;
  if (!state.person) {
    status.textContent = "";
    if (submitBtn) submitBtn.textContent = "Submit my answers";
    return;
  }
  const existing = state.responses[slug(state.person)];
  if (existing) {
    const when = existing.updatedAt ? new Date(existing.updatedAt).toLocaleDateString() : "";
    status.textContent = `✓ You already submitted${when ? " on " + when : ""}. You can edit and resubmit.`;
    if (submitBtn) submitBtn.textContent = "Update my answers";
  } else {
    status.textContent = `You are answering as ${state.person}.`;
    if (submitBtn) submitBtn.textContent = "Submit my answers";
  }
}

function clearInvalid(qid) {
  const w = document.getElementById(`wrap-${qid}`);
  if (w) w.classList.remove("invalid");
}

/* ============================================================
   Submit
   ============================================================ */
function validate() {
  const missing = [];
  for (const q of Object.values(QUESTION_BY_ID)) {
    if (!q.required) continue;
    const v = state.answers[q.id];
    const ok = q.type === "multi" ? Array.isArray(v) && v.length > 0
      : q.type === "scale" ? typeof v === "number"
      : typeof v === "string" && v.length > 0;
    if (!ok) missing.push(q.id);
  }
  return missing;
}

async function onSubmit() {
  const msg = document.getElementById("submit-msg");
  const btn = document.getElementById("submit-btn");
  msg.className = "submit-msg";
  msg.textContent = "";

  if (!state.person) {
    msg.classList.add("err");
    msg.textContent = "Please select your name first (top of the page).";
    document.querySelector(".who").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const missing = validate();
  if (missing.length) {
    document.querySelectorAll(".q.invalid").forEach((n) => n.classList.remove("invalid"));
    missing.forEach((qid) => document.getElementById(`wrap-${qid}`)?.classList.add("invalid"));
    msg.classList.add("err");
    msg.textContent = `Please answer the ${missing.length} highlighted question${missing.length > 1 ? "s" : ""}.`;
    document.getElementById(`wrap-${missing[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const payload = {
    name: state.person,
    answers: state.answers,
    updatedAt: new Date().toISOString()
  };

  btn.disabled = true;
  const prevText = btn.textContent;
  btn.textContent = "Saving…";
  try {
    await saveResponse(payload);
    msg.classList.add("ok");
    msg.textContent = "Thank you! Your answers were saved. You can edit them any time, or check the Results tab.";
    refreshWhoStatus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error("Save failed:", err);
    msg.classList.add("err");
    msg.textContent = "Could not save (network or permission issue). Please try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = prevText;
  }
}

/* ============================================================
   Analysis maps
   ============================================================ */
const ADV_PCT = {
  "70% relax / 30% adventure": 30,
  "60% relax / 40% adventure": 40,
  "50% relax / 50% adventure": 50,
  "40% relax / 60% adventure": 60
};
const TREK_RANK = {
  "I don't want hiking during this trip": 0,
  "I prefer minimal hiking": 1,
  "Easy scenic walks, 1–2 hours": 2,
  "Moderate hikes, 3–4 hours": 3,
  "Longer hikes if the view is worth it": 4
};
const TREK_LABEL = ["No hiking", "Minimal", "Easy walks (1–2h)", "Moderate (3–4h)", "Longer hikes"];
const DRIVE_HOURS = {
  "2 hours": 2, "3 hours": 3, "4 hours": 4, "5 hours if needed": 5, "I don't mind long drives": 6
};
const NIGHTS_MIN = {
  "Every night is fine": 1,
  "Prefer 2 nights minimum": 2,
  "Prefer 3 nights when possible": 3,
  "I strongly dislike moving often": 3
};
const MNE_SCORE = {
  "Must-have": 3, "Nice if it fits naturally": 2, "Sacrificable if Albania becomes better": 1
};

// Short labels for the per-person constraint matrix
const SHORT = {
  q1: (a) => a == null ? "—" : (ADV_PCT[a] != null ? `${ADV_PCT[a]}% adv` : "Flexible"),
  q3: (a) => a == null ? "—" : `${a}/5`,
  q5: (a) => a == null ? "—" : `${a}/5`,
  q7: (a) => a == null ? "—" : ["No hiking", "Minimal", "Easy 1–2h", "Mod 3–4h", "Longer"][TREK_RANK[a]] ?? a,
  q10: (a) => ({ "Low: above 30°C is difficult for me": "Low", "Medium: okay with shade, AC and sea": "Medium", "High: not a big issue": "High", "I'm not sure": "Unsure" }[a] || "—"),
  q12: (a) => ({ "Yes, definitely": "Yes", "Yes, if it fits naturally": "If it fits", "Maybe, but not at the cost of too much driving": "Maybe", "No, I prefer sea/towns": "No", "I'm flexible": "Flexible" }[a] || "—"),
  q13: (a) => ({ "2 hours": "≤2h", "3 hours": "≤3h", "4 hours": "≤4h", "5 hours if needed": "5h ok", "I don't mind long drives": "Any" }[a] || "—"),
  q14: (a) => ({ "Every night is fine": "1/night ok", "Prefer 2 nights minimum": "≥2 nights", "Prefer 3 nights when possible": "≥3 nights", "I strongly dislike moving often": "Hates moving", "I'm flexible": "Flexible" }[a] || "—"),
  q15: (a) => ({ "Fine, part of the experience": "Fine", "Okay occasionally": "Sometimes", "I prefer to avoid them where possible": "Avoid", "I strongly dislike them": "Hates", "I don't know": "?" }[a] || "—"),
  q16: (a) => ({ "Must-have": "Must-have", "Nice if it fits naturally": "Nice", "Sacrificable if Albania becomes better": "Sacrificable", "I don't have a strong opinion": "No opinion" }[a] || "—")
};

const respondedList = () => Object.values(state.responses);
const answersFor = (qid) =>
  respondedList()
    .map((r) => ({ name: r.name, value: r.answers ? r.answers[qid] : undefined }))
    .filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

const avg = (nums) => nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
const round = (n) => Math.round(n * 10) / 10;

/* ============================================================
   Results rendering
   ============================================================ */
async function renderResults() {
  const root = document.getElementById("results-view");
  root.innerHTML = "<div class='empty'>Loading…</div>";
  await loadResponses();
  root.innerHTML = "";

  const responded = respondedList();
  const n = responded.length;

  root.appendChild(el("div", { class: "results-head" }, [
    el("h2", { text: "Group results" }),
    el("button", { class: "link-btn", text: "↻ Refresh", onclick: renderResults })
  ]));

  // Respondent chips
  const chips = el("div", { class: "respondents" });
  PEOPLE.forEach((name) => {
    const has = !!state.responses[slug(name)];
    chips.appendChild(el("span", { class: "resp-chip" + (has ? "" : " missing"), text: (has ? "✓ " : "… ") + name }));
  });
  root.appendChild(chips);

  // Next-step CTA -> switch to the Itineraries tab (same app, no new page)
  root.appendChild(el("button", { class: "next-cta", type: "button", onclick: () => activateTab("itinerary") }, [
    el("div", {}, [
      el("div", { class: "next-cta-k", text: "NEXT STEP" }),
      el("div", { class: "next-cta-t", text: "Compare the 3 possible itineraries →" })
    ]),
    el("span", { class: "next-cta-ic", text: "🧭" })
  ]));

  if (n === 0) {
    root.appendChild(el("div", { class: "empty" }, [
      el("div", { class: "big", text: "🏝️" }),
      el("p", { text: "No answers yet. Once someone submits the questionnaire, the group profile appears here." })
    ]));
    return;
  }

  root.appendChild(renderProfileCards());
  root.appendChild(renderConstraintMatrix());
  root.appendChild(renderDivergence());
  root.appendChild(renderBreakdown());
}

function renderProfileCards() {
  const grid = el("div", { class: "cards" });

  // Relax vs adventure
  const advNums = answersFor("q1").map((x) => ADV_PCT[x.value]).filter((v) => v != null);
  const flexCount = answersFor("q1").filter((x) => ADV_PCT[x.value] == null).length;
  if (advNums.length) {
    const a = Math.round(avg(advNums));
    grid.appendChild(card("Relax vs adventure", `${100 - a}% relax / ${a}% adventure`,
      flexCount ? `${flexCount} flexible` : "group average", a >= 55 ? "sun" : ""));
  } else {
    grid.appendChild(card("Relax vs adventure", "Everyone flexible", "no strong lean", ""));
  }

  // Max daily driving = the most conservative person sets the ceiling
  const driveH = answersFor("q13").map((x) => ({ name: x.name, h: DRIVE_HOURS[x.value] })).filter((x) => x.h != null);
  if (driveH.length) {
    const minH = Math.min(...driveH.map((x) => x.h));
    const who = driveH.filter((x) => x.h === minH).map((x) => x.name).join(", ");
    const lbl = minH >= 6 ? "No real limit" : `≤ ${minH} h / day`;
    grid.appendChild(card("Daily driving", lbl, minH >= 6 ? "all comfortable" : `set by ${who}`, minH <= 3 ? "warn" : ""));
  }

  // Trekking ceiling = lowest comfortable level
  const trek = answersFor("q7").map((x) => ({ name: x.name, r: TREK_RANK[x.value] })).filter((x) => x.r != null);
  if (trek.length) {
    const minR = Math.min(...trek.map((x) => x.r));
    const who = trek.filter((x) => x.r === minR).map((x) => x.name).join(", ");
    grid.appendChild(card("Trekking ceiling", TREK_LABEL[minR],
      minR <= 1 ? `keep it light — ${who}` : `comfortable max for all`, minR <= 1 ? "warn" : "good"));
  }

  // Heat
  const heat = answersFor("q10").map((x) => x.value);
  const lowHeat = answersFor("q10").filter((x) => String(x.value).startsWith("Low")).map((x) => x.name);
  if (heat.length) {
    if (lowHeat.length) {
      grid.appendChild(card("Heat tolerance", "Plan around the heat",
        `${lowHeat.join(", ")} ${lowHeat.length === 1 ? "struggles" : "struggle"} above 30°C — shade, AC, early starts`, "warn"));
    } else {
      grid.appendChild(card("Heat tolerance", "Manageable", "shade/AC/sea is enough", "good"));
    }
  }

  // Nights per base = highest individual minimum
  const nights = answersFor("q14").map((x) => NIGHTS_MIN[x.value]).filter((v) => v != null);
  if (nights.length) {
    const target = Math.max(...nights);
    grid.appendChild(card("Accommodation base", `Aim for ≥ ${target} night${target > 1 ? "s" : ""}`,
      "minimise moving days", ""));
  }

  // Montenegro
  const mne = answersFor("q16");
  const mneScores = mne.map((x) => MNE_SCORE[x.value]).filter((v) => v != null);
  const must = mne.filter((x) => x.value === "Must-have").map((x) => x.name);
  if (mne.length) {
    const m = mneScores.length ? avg(mneScores) : null;
    let verdict, note, cls;
    if (must.length >= 2 || (m != null && m >= 2.4)) { verdict = "Include it"; note = must.length ? `must-have for ${must.join(", ")}` : "clearly wanted"; cls = "good"; }
    else if (m != null && m >= 1.6) { verdict = "If it fits naturally"; note = "nice-to-have, don't force it"; cls = "sun"; }
    else { verdict = "Optional / can drop"; note = "weak group interest"; cls = ""; }
    grid.appendChild(card("Montenegro", verdict, note, cls));
  }

  return grid;
}

function card(k, v, note, cls) {
  return el("div", { class: "card" + (cls ? " " + cls : "") }, [
    el("div", { class: "card-k", text: k }),
    el("div", { class: "card-v", text: v }),
    el("div", { class: "card-note", text: note })
  ]);
}

function renderConstraintMatrix() {
  const keyQs = ["q1", "q3", "q5", "q7", "q10", "q12", "q13", "q14", "q15", "q16"];
  const labels = {
    q1: "Relax/adventure", q3: "Likes moving around", q5: "Avoids crowds", q7: "Trekking max",
    q10: "Heat tolerance", q12: "Cool mountain area", q13: "Max driving", q14: "Accom. changes",
    q15: "Winding roads", q16: "Montenegro"
  };
  const panel = el("details", { class: "panel", open: true });
  panel.appendChild(el("summary", { text: "Per-person constraints" }));
  const body = el("div", { class: "panel-body" });
  const wrap = el("div", { class: "matrix-wrap" });
  const table = el("table", { class: "matrix" });

  const head = el("tr", {}, [el("th", { text: "" })]);
  PEOPLE.forEach((p) => head.appendChild(el("th", { text: state.responses[slug(p)] ? p : p + " ·" })));
  table.appendChild(head);

  keyQs.forEach((qid) => {
    const tr = el("tr", {}, [el("td", { class: "mx-q", text: labels[qid] })]);
    PEOPLE.forEach((p) => {
      const r = state.responses[slug(p)];
      const val = r && r.answers ? r.answers[qid] : null;
      tr.appendChild(el("td", { text: SHORT[qid] ? SHORT[qid](val ?? null) : (val ?? "—") }));
    });
    table.appendChild(tr);
  });

  wrap.appendChild(table);
  body.appendChild(wrap);
  body.appendChild(el("p", { class: "scale-people", text: "“·” marks people who haven't answered yet." }));
  panel.appendChild(body);
  return panel;
}

function renderDivergence() {
  const items = [];

  const numericSpread = (qid, mapFn, label, fmt) => {
    const vals = answersFor(qid).map((x) => ({ name: x.name, v: mapFn(x.value) })).filter((x) => x.v != null);
    if (vals.length < 2) return;
    const lo = Math.min(...vals.map((x) => x.v)), hi = Math.max(...vals.map((x) => x.v));
    if (hi - lo >= (qid === "q1" ? 20 : 2)) {
      const loWho = vals.filter((x) => x.v === lo).map((x) => x.name).join(", ");
      const hiWho = vals.filter((x) => x.v === hi).map((x) => x.name).join(", ");
      items.push(`${label}: ${fmt(lo)} (${loWho}) → ${fmt(hi)} (${hiWho}).`);
    }
  };

  numericSpread("q1", (a) => ADV_PCT[a], "Relax vs adventure", (v) => `${v}% adventure`);
  numericSpread("q3", (a) => a, "Desire to change places", (v) => `${v}/5`);
  numericSpread("q5", (a) => a, "Crowd avoidance", (v) => `${v}/5`);
  numericSpread("q7", (a) => TREK_RANK[a], "Trekking appetite", (v) => TREK_LABEL[v]);
  numericSpread("q13", (a) => DRIVE_HOURS[a], "Driving tolerance", (v) => v >= 6 ? "any" : `${v}h`);

  // Heat: both low and high present
  const heat = answersFor("q10");
  const low = heat.filter((x) => String(x.value).startsWith("Low")).map((x) => x.name);
  const high = heat.filter((x) => String(x.value).startsWith("High")).map((x) => x.name);
  if (low.length && high.length) items.push(`Heat tolerance: Low for ${low.join(", ")} vs High for ${high.join(", ")} — build in shaded midday breaks.`);

  // Montenegro split
  const mne = answersFor("q16");
  const must = mne.filter((x) => x.value === "Must-have").map((x) => x.name);
  const drop = mne.filter((x) => String(x.value).startsWith("Sacrificable")).map((x) => x.name);
  if (must.length && drop.length) items.push(`Montenegro: must-have for ${must.join(", ")} but sacrificable for ${drop.join(", ")} — needs a group decision.`);

  const panel = el("details", { class: "panel", open: true });
  panel.appendChild(el("summary", { text: "Where you disagree most" }));
  const body = el("div", { class: "panel-body" });
  if (items.length === 0) {
    body.appendChild(el("p", { class: "scale-people", text: "No major disagreements so far — the group is fairly aligned. 🎉" }));
  } else {
    const list = el("div", { class: "divergence-list" });
    items.forEach((t) => list.appendChild(el("div", { class: "div-item" }, [el("span", { class: "div-dot" }), el("span", { text: t })])));
    body.appendChild(list);
  }
  panel.appendChild(body);
  return panel;
}

function renderBreakdown() {
  const frag = document.createDocumentFragment();
  SECTIONS.forEach((section) => {
    const panel = el("details", { class: "panel" });
    panel.appendChild(el("summary", { text: section.title }));
    const body = el("div", { class: "panel-body" });
    section.questions.forEach((q) => body.appendChild(renderQABlock(q)));
    panel.appendChild(body);
    frag.appendChild(panel);
  });
  const holder = el("div");
  holder.appendChild(frag);
  return holder;
}

function renderQABlock(q) {
  const block = el("div", { class: "qa" });
  block.appendChild(el("div", { class: "qa-q", text: q.label }));
  const got = answersFor(q.id);

  if (q.type === "paragraph") {
    if (got.length === 0) { block.appendChild(el("p", { class: "scale-people", text: "No answers." })); return block; }
    got.forEach((x) => block.appendChild(el("div", { class: "free" }, [
      el("div", { class: "free-who", text: x.name }),
      el("div", { class: "free-txt", text: x.value })
    ])));
    return block;
  }

  if (q.type === "scale") {
    block.appendChild(renderScaleViz(q, got));
    return block;
  }

  // single / multi: count per option with who-tags
  const counts = {};
  q.options.forEach((o) => (counts[o] = []));
  got.forEach((x) => {
    const vals = q.type === "multi" ? (Array.isArray(x.value) ? x.value : []) : [x.value];
    vals.forEach((v) => { if (counts[v]) counts[v].push(x.name); });
  });
  const max = Math.max(1, ...q.options.map((o) => counts[o].length));
  q.options.forEach((o) => {
    const c = counts[o].length;
    if (c === 0) return; // hide unchosen options to keep it readable
    const row = el("div", { class: "bar-row" });
    row.appendChild(el("div", { class: "bar-top" }, [
      el("span", {}, [document.createTextNode(o + " "), el("span", { class: "who-tags", text: counts[o].join(", ") })]),
      el("span", { class: "bar-count", text: `${c}/${got.length}` })
    ]));
    const track = el("div", { class: "bar-track" });
    track.appendChild(el("div", { class: "bar-fill", style: `width:${(c / max) * 100}%` }));
    row.appendChild(track);
    block.appendChild(row);
  });
  if (q.options.every((o) => counts[o].length === 0)) block.appendChild(el("p", { class: "scale-people", text: "No answers." }));
  return block;
}

function renderScaleViz(q, got) {
  const holder = el("div");
  const nums = got.map((x) => x.value).filter((v) => typeof v === "number");
  const dist = {};
  for (let v = q.min; v <= q.max; v++) dist[v] = [];
  got.forEach((x) => { if (dist[x.value]) dist[x.value].push(x.name); });
  const max = Math.max(1, ...Object.values(dist).map((a) => a.length));

  const viz = el("div", { class: "scale-viz" });
  for (let v = q.min; v <= q.max; v++) {
    const h = (dist[v].length / max) * 100;
    const bar = el("div", { class: "scale-bar" }, [
      el("i", { style: `height:${h}%` }),
      el("b", { text: String(v) })
    ]);
    viz.appendChild(bar);
  }
  holder.appendChild(viz);
  const a = avg(nums);
  holder.appendChild(el("div", { class: "scale-avg", html: `Average: <strong>${a != null ? round(a) : "—"}/${q.max}</strong> &nbsp;·&nbsp; <span style="color:var(--muted)">${q.min}=${q.minLabel} · ${q.max}=${q.maxLabel}</span>` }));
  const perPerson = got.map((x) => `${x.name}: ${x.value}`).join("  ·  ");
  if (perPerson) holder.appendChild(el("div", { class: "scale-people", text: perPerson }));
  return holder;
}

/* ============================================================
   Boot
   ============================================================ */
initGate();
