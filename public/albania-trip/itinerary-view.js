// "Itineraries" tab — renders the 3-itinerary decision analysis + group vote,
// inside the same trip app (shares the gate/login of the questionnaire).

import { PLACE_ICON, PREFS, ITINERARIES, MATRIX, RECOMMENDATION, PRACTICAL, HEAT_NOTES, DRIVING_NOTE } from "./itineraries.js";
import { PEOPLE } from "./questions.js";
import { db, collection, doc, getDocs, setDoc } from "/firebase-config.js";

const VOTE_COLLECTION = "albaniaItineraryVotes";
const slug = (n) => String(n).trim().toLowerCase();

const voteState = { person: null, choice: null, votes: {} };
let tallyEl = null; // reference to the live tally container

/* tiny DOM helper */
function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) { if (c == null) continue; n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }
  return n;
}
const scoreClass = (s) => (s >= 8 ? "g" : s >= 6.5 ? "a" : "r");
const legClass = (h) => (h <= 2 ? "g" : h <= 3.5 ? "a" : "r");
const fmtH = (h) => { const m = Math.round((h % 1) * 60); return Math.floor(h) + "h" + (m ? String(m).padStart(2, "0") : ""); };
const drivingTotal = (it) => it.legs.reduce((s, l) => s + l.h, 0);
const longestLeg = (it) => Math.max(...it.legs.map((l) => l.h));
const borderCount = (it) => it.legs.filter((l) => l.border).length;

/* Public entry point: build the whole Itineraries tab into `root` (once). */
export function mountItineraryView(root) {
  root.innerHTML = "";

  // Intro + preference yardstick
  root.appendChild(el("div", { class: "itin-intro" }, [
    el("h2", { text: "Choosing the best route" }),
    el("p", { text: "Three itineraries, judged against what the four of you asked for in the questionnaire. All are valid — one fits this group best." })
  ]));
  const prefs = el("div", { class: "prefs" });
  PREFS.forEach((p) => prefs.appendChild(el("div", { class: "pref" }, [el("span", { class: "ic", text: p.icon }), el("span", { text: p.label })])));
  root.appendChild(prefs);

  root.appendChild(sectionHead("The options", "Three itineraries at a glance"));
  root.appendChild(renderCards());

  root.appendChild(sectionHead("Day by day", "Explore each route — timeline, driving times & honest pros/cons"));
  root.appendChild(renderExplorer());

  root.appendChild(sectionHead("Side by side", "The comparison matrix — higher is always better, greener is stronger"));
  root.appendChild(renderMatrix());
  root.appendChild(el("p", { class: "matrix-cap", text: "Itinerary 3 wins on what we weighted most — relaxation, low stress and group fit. Itinerary 2's single ◀ on “Beauty” is honest, not a competing recommendation." }));

  root.appendChild(sectionHead("The recommendation", "The route that fits us best"));
  root.appendChild(renderReco());

  root.appendChild(sectionHead("Don't forget", "Practical decision factors for an August trip"));
  root.appendChild(renderPractical());

  root.appendChild(sectionHead("Decide together", "Cast your vote"));
  root.appendChild(renderVote());

  loadVotes();
}

function sectionHead(kicker, title) {
  return el("div", { class: "itin-head" }, [el("div", { class: "kicker", text: kicker }), el("h3", { text: title })]);
}

/* ---------- Route strip ---------- */
function routeStrip(it) {
  const strip = el("div", { class: "routestrip" });
  it.route.forEach((s, i) => {
    if (i > 0) strip.appendChild(el("span", { class: "arrow", text: "→" }));
    strip.appendChild(el("span", { class: "stop", text: (PLACE_ICON[s.t] || "") + " " + s.p }));
  });
  return strip;
}

/* ---------- Cards ---------- */
function renderCards() {
  const grid = el("div", { class: "cards3" });
  ITINERARIES.forEach((it) => {
    const card = el("div", { class: "icard" + (it.recommended ? " win" : "") });
    if (it.recommended) card.appendChild(el("div", { class: "badge", text: "★ RECOMMENDED" }));
    card.appendChild(el("div", { class: "num", text: "Itinerary " + it.id }));
    card.appendChild(el("h4", { text: it.name }));
    card.appendChild(el("div", { class: "tag", text: it.tagline }));
    card.appendChild(el("div", { class: "score" }, [el("b", { text: it.score.toFixed(1) }), el("span", { text: "/ 10" })]));
    if (it.scoreNote) card.appendChild(el("div", { class: "score-note", text: it.scoreNote }));
    card.appendChild(routeStrip(it));
    card.appendChild(el("p", { class: "desc", text: it.summary }));
    card.appendChild(metaRow("Bases", String(it.bases)));
    card.appendChild(metaRow("Total driving", "~" + fmtH(drivingTotal(it))));
    const longest = el("span", { class: "pill " + legClass(longestLeg(it)), text: fmtH(longestLeg(it)) });
    card.appendChild(metaRowEl("Longest drive", longest));
    const bc = borderCount(it);
    card.appendChild(metaRowEl("Borders", el("span", { class: "pill " + (bc ? "high" : "low"), text: bc ? String(bc) + " ✕" : "none" })));
    card.appendChild(metaRowEl("Stress", el("span", { class: "pill " + it.stress, text: it.stress })));
    card.appendChild(metaRow("Best for", it.bestFor));
    card.appendChild(metaRow("Main risk", it.mainRisk));
    card.appendChild(el("div", { class: "verdict", text: "“" + it.verdict + "”" }));
    grid.appendChild(card);
  });
  return grid;
}
const metaRow = (lab, val) => el("div", { class: "meta-row" }, [el("span", { class: "lab", text: lab }), el("span", { text: val })]);
const metaRowEl = (lab, valEl) => el("div", { class: "meta-row" }, [el("span", { class: "lab", text: lab }), valEl]);

/* ---------- Explorer ---------- */
function renderExplorer() {
  const wrap = el("div");
  const tabs = el("div", { class: "explorer-tabs" });
  const body = el("div", { class: "explorer-body" });

  const show = (id) => {
    [...tabs.children].forEach((t) => t.classList.toggle("active", Number(t.dataset.id) === id));
    body.innerHTML = "";
    const it = ITINERARIES.find((i) => i.id === id);

    // timeline
    const tl = el("div", { class: "timeline" }, [el("h5", { text: "Day by day — " + it.name })]);
    const ul = el("ul", { class: "tl" });
    it.timeline.forEach((d) => ul.appendChild(el("li", { text: d })));
    tl.appendChild(ul);

    // driving legs
    const drv = el("div", { class: "driving" }, [el("h5", { text: "Driving legs" })]);
    it.legs.forEach((l) => {
      drv.appendChild(el("div", { class: "leg" }, [
        el("span", { class: "leg-dot " + legClass(l.h) }),
        el("span", { class: "leg-route", text: l.from + " → " + l.to + (l.note ? "  (" + l.note + ")" : "") + (l.border ? "  🛂" : "") }),
        el("span", { class: "leg-time " + legClass(l.h), text: fmtH(l.h) })
      ]));
    });
    drv.appendChild(el("div", { class: "leg-summary", text: `Total ~${fmtH(drivingTotal(it))} · longest ${fmtH(longestLeg(it))}${borderCount(it) ? " · " + borderCount(it) + " border crossing(s)" : " · no borders"}` }));

    // pros/cons
    const pc = el("div", { class: "proscons" });
    const pros = el("div", { class: "pc pros" }, [el("h5", { text: "✓ Strengths" })]);
    const pul = el("ul"); it.pros.forEach((x) => pul.appendChild(el("li", { text: x }))); pros.appendChild(pul);
    const cons = el("div", { class: "pc cons" }, [el("h5", { text: "✗ Weak points" })]);
    const cul = el("ul"); it.cons.forEach((x) => cul.appendChild(el("li", { text: x }))); cons.appendChild(cul);
    pc.appendChild(pros); pc.appendChild(cons);

    const left = el("div"); left.appendChild(tl); left.appendChild(drv);
    body.appendChild(left); body.appendChild(pc);
  };

  ITINERARIES.forEach((it) => {
    const t = el("button", { class: "explorer-tab" + (it.recommended ? " win" : ""), text: it.id + " · " + it.name });
    t.dataset.id = it.id;
    t.addEventListener("click", () => show(it.id));
    tabs.appendChild(t);
  });
  wrap.appendChild(tabs); wrap.appendChild(body);
  show((ITINERARIES.find((i) => i.recommended) || ITINERARIES[0]).id);
  return wrap;
}

/* ---------- Matrix ---------- */
function renderMatrix() {
  const wrap = el("div", { class: "imatrix-wrap" });
  const table = el("table", { class: "imatrix" });
  const colgroup = el("colgroup");
  colgroup.appendChild(el("col"));
  ITINERARIES.forEach((it) => colgroup.appendChild(el("col", it.recommended ? { class: "wincol" } : {})));
  table.appendChild(colgroup);

  const head = el("tr", {}, [el("th", { class: "crit", scope: "col", text: "Criteria" })]);
  ITINERARIES.forEach((it) => head.appendChild(el("th", { scope: "col", class: it.recommended ? "win" : "", html: (it.recommended ? "★ " : "") + "Itin. " + it.id + "<br><span class='th-sub'>" + it.name + "</span>" })));
  table.appendChild(head);

  MATRIX.criteria.forEach((row) => {
    const best = Math.max(...row.scores);
    const tr = el("tr", {}, [el("th", { class: "crit", scope: "row", text: row.label })]);
    row.scores.forEach((s, idx) => {
      const td = el("td", { class: ITINERARIES[idx].recommended ? "win" : "" });
      td.appendChild(el("span", { class: "cell " + scoreClass(s), text: s.toFixed(1) }));
      if (s === best) td.appendChild(el("span", { class: "win-flag", text: " ◀" }));
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  const ov = el("tr", { class: "overall" }, [el("th", { class: "crit", scope: "row", text: "Overall" })]);
  MATRIX.overall.forEach((t, idx) => ov.appendChild(el("td", { class: ITINERARIES[idx].recommended ? "win" : "", text: t })));
  table.appendChild(ov);

  wrap.appendChild(table);
  return wrap;
}

/* ---------- Recommendation ---------- */
function renderReco() {
  const it = ITINERARIES.find((i) => i.recommended);
  const reco = el("div", { class: "reco" });
  const top = el("div", { class: "reco-top" }, [
    el("span", { class: "winbadge", text: "★ OUR RECOMMENDED CHOICE" }),
    el("h4", { text: "Itinerary " + it.id + " — " + it.name }),
    el("p", { text: it.summary })
  ]);
  const dayline = el("div", { class: "dayline" });
  it.timeline.forEach((d) => dayline.appendChild(el("span", { class: "day", text: d })));
  top.appendChild(dayline);

  const gain = el("div", { class: "gain" }, [el("h5", { text: "What we gain" })]);
  const gul = el("ul"); RECOMMENDATION.gain.forEach((x) => gul.appendChild(el("li", { text: x }))); gain.appendChild(gul);
  const give = el("div", { class: "give" }, [el("h5", { text: "What we give up" }), el("p", { html: "<strong>" + RECOMMENDATION.giveUp + "</strong>" })]);
  const wul = el("ul"); RECOMMENDATION.whyWins.forEach((x) => wul.appendChild(el("li", { text: x })));
  const why = el("div", {}, [el("h5", { text: "Why it wins" }), wul]);

  const body = el("div", { class: "reco-body" }, [
    el("div", { class: "reco-cols" }, [gain, give]),
    why,
    el("div", { class: "reframe", text: RECOMMENDATION.reframe })
  ]);
  reco.appendChild(top); reco.appendChild(body);
  return reco;
}

/* ---------- Practical + heat ---------- */
function renderPractical() {
  const wrap = el("div");
  const grid = el("div", { class: "pgrid" });
  PRACTICAL.forEach((p) => grid.appendChild(el("div", { class: "pcard" }, [
    el("div", { class: "ic", text: p.icon }), el("h5", { text: p.title }), el("p", { text: p.text })
  ])));
  wrap.appendChild(grid);
  const heat = el("div", { class: "heat" }, [el("h5", { text: "☀️ Heat & driving rules of thumb" })]);
  const ul = el("ul"); HEAT_NOTES.forEach((n) => ul.appendChild(el("li", { text: n }))); heat.appendChild(ul);
  wrap.appendChild(heat);
  wrap.appendChild(el("p", { class: "drive-note", text: "🚗 " + DRIVING_NOTE }));
  return wrap;
}

/* ---------- Vote ---------- */
function renderVote() {
  const root = el("div", { class: "vote" });
  root.appendChild(el("h4", { id: "itin-vote-q", text: "Which route do you prefer?" }));
  root.appendChild(el("p", { class: "lead", text: "Pick your name and your favourite itinerary. You can change it any time — everyone sees the live tally." }));

  const who = el("div", { class: "vote-who", role: "group", "aria-label": "Who are you?" });
  PEOPLE.forEach((name) => {
    const chip = el("button", { class: "who-chip", type: "button", text: name, "aria-pressed": "false" });
    chip.addEventListener("click", () => selectVoter(name, who, choices, noteEl, btn, msg));
    who.appendChild(chip);
  });
  root.appendChild(who);

  const choices = el("div", { class: "vote-choices", role: "radiogroup", "aria-labelledby": "itin-vote-q" });
  ITINERARIES.forEach((it) => {
    const input = el("input", { type: "radio", name: "itin-vote-choice", value: String(it.id) });
    const row = el("label", { class: "choice" }, [input, el("span", { html: "<strong>Itinerary " + it.id + "</strong> — " + it.name + (it.recommended ? " ★" : "") })]);
    input.addEventListener("change", () => {
      voteState.choice = it.id;
      [...choices.children].forEach((c) => c.classList.remove("sel"));
      row.classList.add("sel");
    });
    choices.appendChild(row);
  });
  root.appendChild(choices);

  const noteEl = el("textarea", { placeholder: "Optional: one line on why (visible to the group)" });
  root.appendChild(noteEl);
  const msg = el("div", { class: "vote-msg" });
  const btn = el("button", { class: "btn-primary", type: "button", text: "Submit my vote", style: "margin-top:.7rem" });
  btn.addEventListener("click", () => submitVote(noteEl, btn, msg));
  root.appendChild(btn);
  root.appendChild(msg);

  tallyEl = el("div", { class: "tally" });
  root.appendChild(tallyEl);
  return root;
}

function selectVoter(name, who, choices, noteEl, btn, msg) {
  voteState.person = name;
  [...who.children].forEach((c) => {
    const on = c.textContent === name;
    c.classList.toggle("selected", on);
    c.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const existing = voteState.votes[slug(name)];
  [...choices.querySelectorAll("input")].forEach((inp) => {
    inp.checked = existing ? Number(inp.value) === existing.choice : false;
    inp.closest(".choice").classList.toggle("sel", inp.checked);
  });
  voteState.choice = existing ? existing.choice : null;
  noteEl.value = existing && existing.note ? existing.note : "";
  btn.textContent = existing ? "Update my vote" : "Submit my vote";
  msg.className = "vote-msg"; msg.textContent = "";
}

async function submitVote(noteEl, btn, msg) {
  msg.className = "vote-msg";
  if (!voteState.person) { msg.classList.add("err"); msg.textContent = "Pick your name first."; return; }
  if (!voteState.choice) { msg.classList.add("err"); msg.textContent = "Choose an itinerary."; return; }
  btn.disabled = true; const prev = btn.textContent; btn.textContent = "Saving…";
  const payload = { name: voteState.person, choice: voteState.choice, note: noteEl.value.trim(), updatedAt: new Date().toISOString() };
  try {
    await setDoc(doc(db, VOTE_COLLECTION, slug(voteState.person)), payload);
    voteState.votes[slug(voteState.person)] = payload;
    msg.classList.add("ok"); msg.textContent = "Thanks! Your vote is saved.";
    btn.textContent = "Update my vote";
    renderTally();
  } catch (err) {
    console.error("Vote save failed:", err);
    msg.classList.add("err"); msg.textContent = "Could not save (network/permission). Try again.";
    btn.textContent = prev;
  } finally {
    btn.disabled = false;
  }
}

async function loadVotes() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const snap = await getDocs(collection(db, VOTE_COLLECTION));
      voteState.votes = {};
      snap.forEach((d) => { voteState.votes[d.id] = d.data(); });
      break;
    } catch (err) {
      console.error(`Failed to load itinerary votes (attempt ${attempt + 1}):`, err);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  renderTally();
}

function renderTally() {
  if (!tallyEl) return;
  tallyEl.innerHTML = "";
  const votes = Object.values(voteState.votes);
  tallyEl.appendChild(el("h5", { text: `Live tally — ${votes.length}/${PEOPLE.length} voted` }));
  if (votes.length === 0) { tallyEl.appendChild(el("p", { class: "lead", text: "No votes yet — be the first." })); return; }
  ITINERARIES.forEach((it) => {
    const whoVoted = votes.filter((v) => v.choice === it.id).map((v) => v.name);
    const pct = (whoVoted.length / PEOPLE.length) * 100;
    const row = el("div", { class: "tally-row" });
    row.appendChild(el("div", { class: "tl-top" }, [
      el("span", {}, [document.createTextNode("Itin. " + it.id + " — " + it.name + " "), el("span", { class: "who", text: whoVoted.join(", ") })]),
      el("span", { text: whoVoted.length + "/" + PEOPLE.length })
    ]));
    const bar = el("div", { class: "tbar" }); bar.appendChild(el("i", { class: it.recommended ? "win" : "", style: `width:${pct}%` }));
    row.appendChild(bar);
    tallyEl.appendChild(row);
  });
  const withNotes = votes.filter((v) => v.note);
  if (withNotes.length) {
    const nb = el("div", { style: "margin-top:.8rem" });
    withNotes.forEach((v) => nb.appendChild(el("div", { style: "font-size:.82rem;margin-bottom:.25rem" }, [
      el("strong", { text: `${v.name} (Itin. ${v.choice}): ` }),
      document.createTextNode(v.note)
    ])));
    tallyEl.appendChild(nb);
  }
}
