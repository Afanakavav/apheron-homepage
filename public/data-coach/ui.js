// Data Coach — funzioni di rendering pure: prendono oggetti semplici e restituiscono elementi DOM.
// Nessun import Firebase, così i test le importano direttamente.

const SECTION_LABELS = {
  positioning: "Positioning",
  setup: "Setup",
  ingestion: "Ingestion",
  harmonization: "Harmonization",
  enhancements: "Enhancements",
  activation: "Activation",
};

const FUNCTION_ERRORS = {
  "unauthenticated": "Accedi di nuovo",
  "permission-denied": "Account non autorizzato",
  "resource-exhausted": "Troppe richieste, riprova tra poco",
  "unavailable": "Servizio momentaneamente non disponibile",
  "deadline-exceeded": "Errore, riprova",
  "internal": "Errore, riprova",
  "invalid-argument": "Foto non valida, riprova",
  "not-found": "Richiesta non trovata, rifai la foto",
  "failed-precondition": "Foto non più disponibile, rifai la foto",
};

const AUTH_ERRORS = {
  "auth/invalid-credential": "Email o password non corretti",
  "auth/invalid-login-credentials": "Email o password non corretti",
  "auth/wrong-password": "Email o password non corretti",
  "auth/user-not-found": "Email o password non corretti",
  "auth/invalid-email": "Email non valida",
  "auth/missing-password": "Inserisci la password",
  "auth/too-many-requests": "Troppi tentativi, riprova più tardi",
  "auth/network-request-failed": "Rete assente, riprova",
  "auth/user-disabled": "Account disattivato",
};

// ---------- formattatori ----------

export function formatLetters(answers) {
  return (answers || []).map((a) => String(a).toUpperCase()).join(" · ");
}

export function formatSeconds(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

export function modelLabel(model) {
  const m = String(model || "");
  if (/opus/i.test(m)) return "Opus";
  if (/sonnet/i.test(m)) return "Sonnet";
  if (/haiku/i.test(m)) return "Haiku";
  return m;
}

export function sectionLabel(slug) {
  return SECTION_LABELS[slug] || "";
}

export function errorMessage(err) {
  const code = String((err && err.code) || "").replace(/^functions\//, "");
  return FUNCTION_ERRORS[code] || "Errore, riprova";
}

export function authErrorMessage(err) {
  const code = String((err && err.code) || "");
  return AUTH_ERRORS[code] || "Accesso non riuscito, riprova";
}

// ---------- mattoncini ----------

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function button(className, action, label) {
  const b = el("button", className, label);
  b.type = "button";
  b.dataset.action = action;
  return b;
}

export function renderPill(confidence) {
  const c = ["alta", "media", "bassa"].includes(confidence) ? confidence : "bassa";
  return el("span", `pill pill-${c}`, `confidenza ${c}`);
}

function timingChip(latencyMs, model, fellBack) {
  const parts = [formatSeconds(latencyMs), modelLabel(model), fellBack ? "modello di riserva" : ""].filter(Boolean);
  return parts.length ? el("span", "chip", parts.join(" · ")) : null;
}

// ---------- viste ----------

/** Scheda della risposta rapida: lettere grandi, "Scegli N", ragionamento, meta, pulsanti. */
export function renderResult(r) {
  const answers = r.answers || [];
  const root = el("section", "result");
  root.dataset.logId = r.logId || "";

  const head = el("div", "result-head");
  head.append(el("div", "letters" + (answers.length >= 3 ? " letters-many" : ""), formatLetters(answers) || "—"));
  head.append(renderPill(r.confidence));
  root.append(head);

  if (r.requiredCount > 1) root.append(el("p", "choose", `Scegli ${r.requiredCount}`));
  if (r.reasoningIt) root.append(el("p", "reasoning", r.reasoningIt));
  if (r.readIssue) root.append(el("p", "warn", `Lettura incerta: ${r.readIssue}`));

  const meta = el("div", "meta");
  if (r.registryExact) meta.append(el("span", "badge", "Nel registro"));
  if (r.registryConflict) meta.append(el("span", "badge badge-warn", "Registro in disaccordo"));
  if (r.section) meta.append(el("span", "chip", sectionLabel(r.section)));
  const timing = timingChip(r.latencyMs, r.model, r.fellBack);
  if (timing) meta.append(timing);
  if (meta.childElementCount) root.append(meta);

  if (r.questionStem) root.append(el("p", "stem", r.questionStem));

  const actions = el("div", "actions");
  actions.append(
      button("btn btn-primary btn-deep", "deep", "Approfondisci"),
      button("btn", "dubbia", "Dubbia"),
      button("btn", "new", "Nuova domanda"),
  );
  root.append(actions, el("div", "deep-slot"));
  return root;
}

/** Esito dell'approfondimento sotto la risposta rapida: "Confermato" oppure "Cambia in X · Y". */
export function renderDeep(deep, fast) {
  const root = el("section", "deep");
  const letters = formatLetters(deep.answers);
  // Contano le lettere: se coincidono con la via rapida è una conferma, altrimenti un cambio.
  const confirmed = fast && fast.answers ? letters === formatLetters(fast.answers) : Boolean(deep.agreesWithFast);

  root.append(el("p", "deep-label", "Approfondimento"));
  const head = el("div", "result-head");
  head.append(el("div", "deep-head " + (confirmed ? "ok" : "change"), confirmed ? "Confermato" : `Cambia in ${letters || "—"}`));
  head.append(renderPill(deep.confidence));
  root.append(head);

  if (!confirmed && deep.requiredCount > 1) root.append(el("p", "choose", `Scegli ${deep.requiredCount}`));
  if (deep.explanationIt) root.append(el("p", "reasoning", deep.explanationIt));

  const cites = (deep.citations || []).filter(Boolean);
  if (cites.length) {
    const list = el("div", "citations");
    for (const c of cites) list.append(el("span", "citation", c));
    root.append(list);
  }

  const meta = el("div", "meta");
  if (deep.section) meta.append(el("span", "chip", sectionLabel(deep.section)));
  const timing = timingChip(deep.latencyMs, deep.model, false);
  if (timing) meta.append(timing);
  if (meta.childElementCount) root.append(meta);
  return root;
}

/** Riga di attesa con spinner e contatore dei secondi (aggiornato da chi la mostra). */
export function renderBusy(label) {
  const root = el("div", "busy");
  root.append(el("span", "spin"), el("span", "busy-label", label), el("span", "busy-seconds", "0 s"));
  return root;
}

/** Riga di errore; con retry=true aggiunge il pulsante "Nuova domanda". */
export function renderError(message, { detail = "", retry = false } = {}) {
  const frag = document.createDocumentFragment();
  const box = el("p", "error", message);
  if (detail) box.append(el("span", "error-detail", detail));
  frag.append(box);
  if (retry) {
    const actions = el("div", "actions");
    const b = button("btn btn-primary", "new", "Nuova domanda");
    b.style.gridColumn = "1 / -1";
    actions.append(b);
    frag.append(actions);
  }
  return frag;
}

// ---------- lista delle domande dubbie ----------

/** Data e ora brevi in italiano da un Timestamp Firestore, una Date o una stringa ISO. */
export function formatWhen(value) {
  let d = null;
  if (value && typeof value.toDate === "function") d = value.toDate();
  else if (value instanceof Date) d = value;
  else if (typeof value === "string" || typeof value === "number") d = new Date(value);
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Una domanda segnata come dubbia: risposta rapida, eventuale approfondimento e azioni (foto, non più dubbia).
 * item = { id, createdAt, questionStem, answers, requiredCount, confidence, reasoningIt, section, registryConflict,
 *          deep: {answers, explanationIt, confidence, citations} | null }
 */
export function renderDubbiaItem(item) {
  const root = el("article", "result dubbia-item");
  root.dataset.logId = item.id || "";

  const top = el("div", "meta");
  const when = formatWhen(item.createdAt);
  if (when) top.append(el("span", "chip", when));
  if (item.section) top.append(el("span", "chip", sectionLabel(item.section)));
  if (item.registryConflict) top.append(el("span", "badge badge-warn", "Registro in disaccordo"));
  root.append(top);

  if (item.questionStem) root.append(el("p", "dubbia-stem", item.questionStem));

  const head = el("div", "result-head");
  const fast = el("div", "dubbia-answer");
  fast.append(el("span", "deep-label", "Risposta rapida"), el("span", "letters letters-small", formatLetters(item.answers) || "—"));
  head.append(fast, renderPill(item.confidence));
  root.append(head);
  if (item.reasoningIt) root.append(el("p", "reasoning", item.reasoningIt));

  if (item.deep && Array.isArray(item.deep.answers)) {
    root.append(renderDeep(item.deep, { answers: item.answers || [] }));
  }

  const photo = el("div", "dubbia-photo");
  root.append(photo);
  const actions = el("div", "actions");
  actions.append(button("btn", "photo", "Mostra foto"), button("btn", "undubbia", "Non più dubbia"));
  root.append(actions);
  return root;
}

/** Elenco completo, dal più recente; con nessun elemento mostra un messaggio vuoto. */
export function renderDubbieList(items) {
  const frag = document.createDocumentFragment();
  if (!items || !items.length) {
    frag.append(el("p", "hint", "Nessuna domanda segnata come dubbia."));
    return frag;
  }
  frag.append(el("p", "hint", items.length === 1 ? "1 domanda dubbia" : `${items.length} domande dubbie`));
  for (const it of items) frag.append(renderDubbiaItem(it));
  return frag;
}
