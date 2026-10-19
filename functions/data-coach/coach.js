"use strict";
/**
 * Data Coach: gestori delle tre callable (ping, risposta rapida, approfondimento) e relativi aiuti.
 *
 * - dataCoachPing: scalda l'istanza caricando la base di conoscenza dal bucket privato.
 * - dataCoachAnswer: via rapida. Foto -> Claude (buildFastRequest) -> lettere, motivo, fiducia; registra la foto nel
 *   bucket (photos/<logId>.<ext>) e il risultato in Firestore (dataCoachLog/<logId>).
 * - dataCoachDeep: via lenta. Rilegge la foto registrata, aggiunge i capitoli dei manuali della sezione e chiede un
 *   riesame a sforzo alto in streaming; salva il risultato nel campo deep del documento.
 *
 * Regole: nessun dato d'esame e nessuna chiave in questo file; la chiave arriva dal Secret Manager
 * (ANTHROPIC_API_KEY) e non viene mai scritta nei log o nei messaggi d'errore.
 * Riferimenti SDK: skill claude-api (client.messages.create per la via rapida, client.messages.stream(...)
 * .finalMessage() per la via lenta, errori tipizzati Anthropic.RateLimitError / InternalServerError /
 * APIConnectionError / BadRequestError, campi usage input_tokens, output_tokens,
 * cache_creation_input_tokens, cache_read_input_tokens).
 */

const crypto = require("crypto");
const {HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const sdk = require("@anthropic-ai/sdk");
const Anthropic = sdk.default || sdk;
const prompt = require("./prompt");
const kbStore = require("./kb");

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

/** Unico utente ammesso (stessa email delle regole Firestore). */
const ALLOWED_EMAILS = ["francesco.perone00@gmail.com"];
const LOG_COLLECTION = "dataCoachLog";
const PHOTO_PREFIX = "photos/";
/** Tipi di immagine accettati e relativa estensione del file nel bucket. */
const MEDIA_TYPES = {"image/jpeg": "jpg", "image/png": "png"};
const EFFORTS = ["low", "medium", "high"];
const DEFAULT_EFFORT = "medium";
/** Lunghezza massima della stringa base64 della foto (6 MB). */
const MAX_IMAGE_BASE64 = 6 * 1024 * 1024;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const LOG_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/**
 * Timeout per richiesta (ms) della via rapida, per livello di sforzo (misurati 3-5 s a medium; a high il
 * ragionamento puo' allungarsi), con una sola ripetizione dell'SDK per restare nei 60 s della funzione.
 * La via lenta ha 300 s di funzione.
 */
const FAST_TIMEOUT_MS = {low: 30000, medium: 30000, high: 50000};
const FAST_MAX_RETRIES = 1;
const DEEP_TIMEOUT_MS = 240000;
/** Capitoli al massimo inviati alla via lenta. */
const MAX_CHAPTERS = 2;

/** Listino USD per milione di token (tariffa diretta Anthropic, skill claude-api). */
const PRICES = {
  "claude-opus-5-5": {input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2},
  "claude-sonnet-5-5": {input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2},
};

/** Client Anthropic costruito una volta per istanza. */
let client = null;

/**
 * @return {object} client Anthropic (chiave dal Secret Manager, ripetizioni predefinite dell'SDK: 2)
 */
function getClient() {
  if (!client) client = new Anthropic({apiKey: anthropicKey.value(), maxRetries: 2});
  return client;
}

/**
 * @return {boolean} vero quando il codice gira nell'emulatore (i documenti di prova vengono marcati test:true)
 */
function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

/**
 * Verifica autenticazione e lista degli utenti ammessi.
 * @param {object} request richiesta della callable
 * @return {{uid: string, email: string}} utente ammesso
 */
function requireUser(request) {
  if (!request || !request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
  const token = request.auth.token || {};
  const email = String(token.email || "").trim().toLowerCase();
  if (!email || !ALLOWED_EMAILS.includes(email)) {
    throw new HttpsError("permission-denied", "Utente non autorizzato.");
  }
  return {uid: String(request.auth.uid || ""), email};
}

/**
 * @param {string} message testo in italiano per l'utente
 * @return {HttpsError} errore invalid-argument
 */
function invalid(message) {
  return new HttpsError("invalid-argument", message);
}

/**
 * Valida i dati della via rapida.
 * @param {object} data request.data
 * @return {{image: string, mediaType: string, effort: string}} dati validati
 */
function parseAnswerData(data) {
  const d = data && typeof data === "object" ? data : {};
  if (typeof d.image !== "string" || !d.image) throw invalid("Immagine mancante.");
  if (d.image.length > MAX_IMAGE_BASE64) throw invalid("Immagine troppo grande (massimo 6 MB).");
  if (!Object.prototype.hasOwnProperty.call(MEDIA_TYPES, d.mediaType)) {
    throw invalid("Formato immagine non supportato: usa JPEG o PNG.");
  }
  if (!BASE64_RE.test(d.image)) throw invalid("Immagine non in base64 (senza prefisso data:).");
  const effort = d.effort === undefined || d.effort === null ? DEFAULT_EFFORT : d.effort;
  if (!EFFORTS.includes(effort)) throw invalid("Livello di sforzo non valido: usa low, medium o high.");
  return {image: d.image, mediaType: d.mediaType, effort};
}

/**
 * @param {Buffer} bytes contenuto
 * @return {string} SHA-256 esadecimale
 */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * Normalizza i campi usage di un messaggio dell'API.
 * @param {object} message risposta dell'API
 * @return {{input: number, output: number, cacheRead: number, cacheWrite: number}} token per voce
 */
function usageOf(message) {
  const u = (message && message.usage) || {};
  return {
    input: Number(u.input_tokens) || 0,
    output: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
  };
}

/**
 * Costo in USD di una chiamata secondo il listino.
 * @param {{input: number, output: number, cacheRead: number, cacheWrite: number}} usage token per voce
 * @param {string} model modello che ha risposto
 * @return {number|null} costo arrotondato a 6 decimali, null se il modello non e' in listino
 */
function costUsd(usage, model) {
  const p = PRICES[model];
  if (!p) return null;
  const total = usage.input * p.input + usage.output * p.output +
    usage.cacheWrite * p.cacheWrite + usage.cacheRead * p.cacheRead;
  return Math.round(total) / 1e6;
}

/**
 * @param {Error} err errore dell'SDK
 * @return {boolean} vero per sovraccarico o errore del server (529/5xx): si ritenta con il modello di ripiego
 */
function isOverloaded(err) {
  if (err instanceof Anthropic.InternalServerError) return true;
  if (err instanceof Anthropic.APIError) {
    const status = Number(err.status) || 0;
    return status === 529 || status >= 500 || err.type === "overloaded_error";
  }
  return false;
}

/**
 * Descrizione breve di un errore per i log: mai intestazioni, mai la chiave, mai lo stack.
 * @param {Error} err errore
 * @return {object} campi sintetici
 */
function describeError(err) {
  return {
    name: err && err.constructor ? err.constructor.name : "Error",
    status: err && err.status ? err.status : null,
    type: err && err.type ? err.type : null,
    message: String((err && err.message) || "").slice(0, 300),
  };
}

/**
 * Traduce un errore in HttpsError con messaggio breve in italiano, senza stack ne' dettagli interni.
 * @param {Error} err errore originale
 * @param {string} where nome della funzione, per i log
 * @return {HttpsError} errore da restituire al client
 */
function toHttpsError(err, where) {
  if (err instanceof HttpsError) return err;
  logger.error(`${where}: errore`, describeError(err));
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpsError("resource-exhausted", "Troppe richieste al modello: riprova tra qualche secondo.");
  }
  if (err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
    return new HttpsError("unavailable", "Il modello non risponde in questo momento: riprova.");
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new HttpsError("internal", "Richiesta al modello rifiutata: foto o parametri non validi.");
  }
  if (err instanceof Anthropic.APIError) {
    return new HttpsError("internal", "Errore del modello: riprova piu' tardi.");
  }
  if (err && /JSON|troncata|rifiutata/i.test(String(err.message))) {
    return new HttpsError("internal", "Risposta del modello non interpretabile: riprova.");
  }
  return new HttpsError("internal", "Errore interno: riprova piu' tardi.");
}

/**
 * Chiama il modello con ripiego: se dopo le ripetizioni dell'SDK l'errore e' ancora sovraccarico/5xx, ritenta una
 * volta con FALLBACK_MODEL. mode "create" = non streaming; "stream" = streaming con finalMessage().
 * @param {object} api client Anthropic
 * @param {object} params parametri della richiesta (buildFastRequest / buildDeepRequest)
 * @param {object} opts mode "create" o "stream", timeout in ms, maxRetries facoltativo (ripetizioni dell'SDK)
 * @return {Promise<{message: object, latencyMs: number, model: string, fellBack: boolean}>} risposta e misure
 */
async function callModel(api, params, opts) {
  const t0 = Date.now();
  const reqOpts = {timeout: opts.timeout};
  if (opts.maxRetries !== undefined) reqOpts.maxRetries = opts.maxRetries;
  const send = (p) => (opts.mode === "stream" ?
    api.messages.stream(p, reqOpts).finalMessage() :
    api.messages.create(p, reqOpts));
  try {
    const message = await send(params);
    return {message, latencyMs: Date.now() - t0, model: params.model, fellBack: false};
  } catch (err) {
    if (!isOverloaded(err) || params.model === prompt.FALLBACK_MODEL) throw err;
    logger.warn("dataCoach: modello sovraccarico, ripiego", {
      from: params.model, to: prompt.FALLBACK_MODEL, ...describeError(err),
    });
    const message = await send({...params, model: prompt.FALLBACK_MODEL});
    return {message, latencyMs: Date.now() - t0, model: prompt.FALLBACK_MODEL, fellBack: true};
  }
}

/**
 * Indici di sezione (1..6) dei capitoli da inviare alla via lenta: la sezione della via rapida se nota, altrimenti
 * le sezioni dei prefissi S<n> degli id del registro citati (al massimo MAX_CHAPTERS, nell'ordine citato).
 * @param {object} fast risultato della via rapida (section, registryMatches)
 * @return {number[]} indici, eventualmente vuoto
 */
function selectChapterIndexes(fast) {
  const f = fast || {};
  const bySlug = prompt.SECTION_SLUGS.indexOf(f.section) + 1;
  if (bySlug > 0) return [bySlug];
  const out = [];
  for (const id of Array.isArray(f.registryMatches) ? f.registryMatches : []) {
    const m = /^S([1-6])-/i.exec(String(id).trim());
    if (!m) continue;
    const idx = Number(m[1]);
    if (!out.includes(idx)) out.push(idx);
    if (out.length >= MAX_CHAPTERS) break;
  }
  return out;
}

/**
 * Carica i capitoli scelti; un capitolo non leggibile viene saltato (la via lenta resta possibile sul compendio).
 * @param {object} fast risultato della via rapida (section, registryMatches)
 * @param {Function} load caricatore asincrono di un capitolo per indice (kb.loadChapter)
 * @return {Promise<{indexes: number[], texts: string[]}>} indici effettivamente caricati e testi
 */
async function loadChaptersFor(fast, load) {
  const wanted = selectChapterIndexes(fast);
  const loaded = await Promise.all(wanted.map((index) => load(index).catch((err) => {
    logger.warn("dataCoachDeep: capitolo non caricato", {index, ...describeError(err)});
    return null;
  })));
  const ok = loaded.filter((c) => c && c.text);
  return {indexes: ok.map((c) => c.index), texts: ok.map((c) => c.text)};
}

/**
 * Riesame a sforzo alto (via lenta), senza accesso a Firestore o al bucket: utile anche nei test con client finto.
 * @param {object} args
 * @param {object} args.api client Anthropic (o un finto con messages.stream(...).finalMessage())
 * @param {object} args.kb base di conoscenza {compendium, glossary, registry, version}
 * @param {string[]} args.chapters testi dei capitoli
 * @param {{mediaType: string, base64: string}} args.image foto
 * @param {{answers: string[], confidence: string, reasoningIt: string}} args.fast risultato della via rapida
 * @return {Promise<object>} risultato normalizzato con latencyMs, model, fellBack, usage, costUsd
 */
async function reviewDeep({api, kb, chapters, image, fast}) {
  const params = prompt.buildDeepRequest({kb, chapters, image, fast, effort: "high", model: prompt.MODEL});
  const call = await callModel(api, params, {mode: "stream", timeout: DEEP_TIMEOUT_MS});
  const result = prompt.parseDeepResult(call.message);
  const usage = usageOf(call.message);
  return {
    ...result,
    latencyMs: call.latencyMs,
    model: call.model,
    fellBack: call.fellBack,
    usage,
    costUsd: costUsd(usage, call.model),
  };
}

/**
 * Carica la base di conoscenza traducendo gli errori del bucket in "unavailable".
 * @param {string} where nome della funzione, per i log
 * @return {Promise<{kb: object, warm: boolean, loadMs: number}>} esito di ensureKb
 */
async function kbOrThrow(where) {
  try {
    return await kbStore.ensureKb();
  } catch (err) {
    logger.error(`${where}: base di conoscenza non caricata`, describeError(err));
    throw new HttpsError("unavailable", "Base di conoscenza non disponibile: riprova tra poco.");
  }
}

/**
 * dataCoachPing: scalda l'istanza e verifica la versione della base di conoscenza.
 * @param {object} request richiesta della callable
 * @return {Promise<{ok: boolean, kbVersion: string, warm: boolean, loadMs: number}>} stato
 */
async function ping(request) {
  requireUser(request);
  const {kb, warm, loadMs} = await kbOrThrow("dataCoachPing");
  return {ok: true, kbVersion: kb.version, warm, loadMs};
}

/** PNG 1x1 bianco: immagine minuscola per la richiesta di riscaldamento. */
const WARM_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
/** Uscita massima della richiesta di riscaldamento: ci interessa solo il prefill che scrive la cache. */
const WARM_MAX_TOKENS = 16;

/**
 * Riscaldamento della via rapida: carica la base di conoscenza su QUESTA istanza e scrive (o rinfresca) la cache
 * del prompt. Misurato in produzione: una richiesta a max_tokens 0 senza output_config.format NON scalda la cache
 * della richiesta vera, perche' lo schema dell'uscita strutturata entra nel prefisso. Quindi il riscaldamento usa
 * esattamente la richiesta vera (stesso sforzo, stesso schema) con un'immagine 1x1 e un'uscita di pochi token.
 * @param {{uid: string, email: string}} user utente ammesso
 * @param {object} data request.data ({warm: true, effort})
 * @return {Promise<object>} stato del riscaldamento
 */
async function warm(user, data) {
  const effort = EFFORTS.includes(data.effort) ? data.effort : DEFAULT_EFFORT;
  const {kb, warm: kbWarm, loadMs} = await kbOrThrow("dataCoachAnswer");
  const t0 = Date.now();
  let usage = null;
  try {
    const params = prompt.buildFastRequest({
      kb: {compendium: kb.compendium, glossary: kb.glossary, registry: kb.registry, version: kb.version},
      image: {mediaType: "image/png", base64: WARM_IMAGE_BASE64},
      effort,
      variant: "full",
      model: prompt.MODEL,
    });
    params.max_tokens = WARM_MAX_TOKENS;
    const message = await getClient().messages.create(params, {
      timeout: FAST_TIMEOUT_MS[effort], maxRetries: FAST_MAX_RETRIES,
    });
    usage = usageOf(message);
  } catch (err) {
    logger.warn("dataCoachAnswer: pre-riscaldamento della cache non riuscito", describeError(err));
  }
  const prewarmMs = Date.now() - t0;
  logger.info("dataCoachAnswer: warm", {uid: user.uid, kbVersion: kb.version, kbWarm, loadMs, prewarmMs, usage});
  return {
    ok: true, warm: true, kbVersion: kb.version, kbWarm, loadMs, prewarmMs,
    cacheWrite: usage ? usage.cacheWrite : null, cacheRead: usage ? usage.cacheRead : null,
  };
}

/**
 * dataCoachAnswer: via rapida (con {warm: true} fa solo il riscaldamento).
 * @param {object} request richiesta della callable
 * @return {Promise<object>} risposta per la pagina
 */
async function answer(request) {
  const user = requireUser(request);
  const data = request.data && typeof request.data === "object" ? request.data : {};
  if (data.warm === true) return warm(user, data);
  const input = parseAnswerData(data);
  const {kb} = await kbOrThrow("dataCoachAnswer");

  const bytes = Buffer.from(input.image, "base64");
  const photoHash = sha256(bytes);
  const db = getFirestore();
  const logRef = db.collection(LOG_COLLECTION).doc();
  const logId = logRef.id;
  const photoPath = `${PHOTO_PREFIX}${logId}.${MEDIA_TYPES[input.mediaType]}`;
  // La foto parte subito, in parallelo alla chiamata al modello; un errore di scrittura non blocca la risposta.
  const photoWrite = getStorage().bucket(kbStore.BUCKET).file(photoPath)
      .save(bytes, {contentType: input.mediaType, resumable: false, metadata: {metadata: {logId, uid: user.uid}}})
      .then(() => photoPath)
      .catch((err) => {
        logger.error("dataCoachAnswer: foto non salvata", {logId, ...describeError(err)});
        return null;
      });

  let call;
  let result;
  try {
    const params = prompt.buildFastRequest({
      kb: {compendium: kb.compendium, glossary: kb.glossary, registry: kb.registry, version: kb.version},
      image: {mediaType: input.mediaType, base64: input.image},
      effort: input.effort,
      variant: "full",
      model: prompt.MODEL,
    });
    call = await callModel(getClient(), params, {
      mode: "create", timeout: FAST_TIMEOUT_MS[input.effort], maxRetries: FAST_MAX_RETRIES,
    });
    result = prompt.parseFastResult(call.message);
  } catch (err) {
    const httpsErr = toHttpsError(err, "dataCoachAnswer");
    // Anche una chiamata fallita lascia traccia (costo e foto), cosi' il registro non sottostima la spesa.
    const savedPhotoPath = await photoWrite;
    const errorDoc = {
      uid: user.uid, email: user.email, createdAt: FieldValue.serverTimestamp(), photoHash,
      photoPath: savedPhotoPath, mediaType: input.mediaType, status: "error", error: httpsErr.code,
      effort: input.effort, kbVersion: kb.version, dubbia: false, deep: null,
    };
    if (isEmulator()) errorDoc.test = true;
    await logRef.set(errorDoc).catch((e2) => logger.error("dataCoachAnswer: registro errore non scritto", {logId, ...describeError(e2)}));
    throw httpsErr;
  }

  const usage = usageOf(call.message);
  const cost = costUsd(usage, call.model);
  const savedPhotoPath = await photoWrite;
  const doc = {
    uid: user.uid,
    email: user.email,
    createdAt: FieldValue.serverTimestamp(),
    status: "ok",
    photoHash,
    photoPath: savedPhotoPath,
    mediaType: input.mediaType,
    questionStem: result.questionStem,
    answers: result.answers,
    requiredCount: result.requiredCount,
    reasoningIt: result.reasoningIt,
    confidence: result.confidence,
    section: result.section,
    registryExact: result.registryExact,
    registryMatches: result.registryMatches,
    readIssue: result.readIssue,
    latencyMs: call.latencyMs,
    model: call.model,
    fellBack: call.fellBack,
    effort: input.effort,
    kbVersion: kb.version,
    usage,
    costUsd: cost,
    dubbia: false,
    deep: null,
  };
  if (isEmulator()) doc.test = true;
  try {
    await logRef.set(doc);
  } catch (err) {
    logger.error("dataCoachAnswer: registro non scritto", {logId, ...describeError(err)});
  }
  logger.info("dataCoachAnswer: risposta", {
    logId, answers: result.answers, confidence: result.confidence, section: result.section,
    latencyMs: call.latencyMs, model: call.model, fellBack: call.fellBack, costUsd: cost, usage,
  });
  return {
    logId,
    answers: result.answers,
    requiredCount: result.requiredCount,
    reasoningIt: result.reasoningIt,
    confidence: result.confidence,
    section: result.section,
    questionStem: result.questionStem,
    registryExact: result.registryExact,
    registryMatches: result.registryMatches,
    readIssue: result.readIssue,
    latencyMs: call.latencyMs,
    model: call.model,
    fellBack: call.fellBack,
    kbVersion: kb.version,
  };
}

/**
 * dataCoachDeep: via lenta sul documento di una risposta rapida.
 * @param {object} request richiesta della callable
 * @return {Promise<object>} risultato dell'approfondimento piu' logId
 */
async function deep(request) {
  const user = requireUser(request);
  const data = request.data && typeof request.data === "object" ? request.data : {};
  const logId = typeof data.logId === "string" ? data.logId.trim() : "";
  if (!LOG_ID_RE.test(logId)) throw invalid("logId mancante o non valido.");

  const db = getFirestore();
  const logRef = db.collection(LOG_COLLECTION).doc(logId);
  const snap = await logRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Risposta non trovata.");
  const log = snap.data();
  if (log.uid !== user.uid) throw new HttpsError("permission-denied", "Risposta di un altro utente.");
  if (log.status === "error") throw new HttpsError("failed-precondition", "La risposta rapida non era riuscita: rifai la foto.");
  // Idempotenza: un secondo "Approfondisci" sulla stessa risposta restituisce il risultato gia' salvato.
  if (log.deep && data.force !== true) {
    const d = log.deep;
    const created = d.createdAt && typeof d.createdAt.toDate === "function" ? d.createdAt.toDate().toISOString() : null;
    return {logId, ...d, createdAt: created, cached: true};
  }
  if (!log.photoPath || !Object.prototype.hasOwnProperty.call(MEDIA_TYPES, log.mediaType)) {
    throw new HttpsError("failed-precondition", "Foto non disponibile per questa risposta.");
  }

  let photoBase64;
  try {
    const [bytes] = await getStorage().bucket(kbStore.BUCKET).file(log.photoPath).download();
    photoBase64 = bytes.toString("base64");
  } catch (err) {
    logger.error("dataCoachDeep: foto non leggibile", {logId, ...describeError(err)});
    throw new HttpsError("failed-precondition", "Foto non piu' disponibile (le foto restano 30 giorni).");
  }

  const {kb} = await kbOrThrow("dataCoachDeep");
  const fast = {
    answers: Array.isArray(log.answers) ? log.answers : [],
    confidence: log.confidence,
    reasoningIt: log.reasoningIt,
    section: log.section || null,
    registryMatches: Array.isArray(log.registryMatches) ? log.registryMatches : [],
  };
  const chapters = await loadChaptersFor(fast, kbStore.loadChapter);

  let review;
  try {
    review = await reviewDeep({
      api: getClient(),
      kb: {compendium: kb.compendium, glossary: kb.glossary, registry: kb.registry, version: kb.version},
      chapters: chapters.texts,
      image: {mediaType: log.mediaType, base64: photoBase64},
      fast,
    });
  } catch (err) {
    throw toHttpsError(err, "dataCoachDeep");
  }

  const createdAt = Timestamp.now();
  const stored = {...review, chapters: chapters.indexes, kbVersion: kb.version, createdAt};
  try {
    await logRef.update({deep: stored});
  } catch (err) {
    logger.error("dataCoachDeep: registro non aggiornato", {logId, ...describeError(err)});
  }
  logger.info("dataCoachDeep: risposta", {
    logId, answers: review.answers, agreesWithFast: review.agreesWithFast, confidence: review.confidence,
    chapters: chapters.indexes, latencyMs: review.latencyMs, model: review.model, fellBack: review.fellBack,
    costUsd: review.costUsd, usage: review.usage,
  });
  return {logId, ...stored, createdAt: createdAt.toDate().toISOString()};
}

module.exports = {
  anthropicKey, ALLOWED_EMAILS, LOG_COLLECTION, PRICES,
  ping, answer, deep,
  // Aiuti esportati per i test unitari (nessuna chiamata di rete).
  requireUser, parseAnswerData, usageOf, costUsd, isOverloaded, toHttpsError, callModel,
  selectChapterIndexes, loadChaptersFor, reviewDeep,
};
