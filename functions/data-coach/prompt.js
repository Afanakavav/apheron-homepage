"use strict";
/**
 * Data Coach: costruttore delle richieste all'API Claude per la via rapida.
 *
 * Questo modulo contiene SOLO logica e istruzioni: nessun dato d'esame, nessun estratto dei manuali.
 * La base di conoscenza (compendio, glossario, registro compatto) arriva come parametro: dal bucket
 * privato in produzione, dai file del laboratorio nella prova di fase 2. Il laboratorio importa questo
 * stesso modulo, così la misura riguarda esattamente il prompt di produzione.
 *
 * Riferimenti: skill claude-api (adaptive thinking, output_config.effort, structured outputs
 * con output_config.format, prompt caching con cache_control sull'ultimo blocco statico).
 */

const MODEL = "claude-opus-5-5";
const FALLBACK_MODEL = "claude-sonnet-5-5";

/** Slug delle sei sezioni del programma d'esame, usati anche nello schema della risposta. */
const SECTION_SLUGS = ["positioning", "setup", "ingestion", "harmonization", "enhancements", "activation"];

/** Varianti del contesto, usate dalla prova di fase 2. In produzione si usa "full". */
const VARIANTS = ["full", "no-compendium", "model-only"];

const INSTRUCTIONS = [
  "You are an expert Salesforce Data 360 consultant (Data 360 is the current name of Data Cloud) acting as an",
  "exam coach for the Salesforce Certified Data 360 Consultant certification.",
  "",
  "The user sends a photo of one practice-exam question taken with a phone from a computer screen. The photo",
  "may be skewed, slightly blurred, or cut at the edges. Your job: read the question and its options, decide",
  "which option letter(s) are correct, and return the structured result.",
  "",
  "How to read the photo:",
  "- Extract the question text, the instruction line (for example \"Choose only ONE best answer\",",
  "  \"Choose 2 answers\", \"Choose ALL answers that apply\") and every option with its letter.",
  "- required_count is the number of answers the question asks for. If the text says \"Choose N answers\" use N;",
  "  otherwise 1. Return exactly required_count letters in answers, uppercase, in alphabetical order.",
  "- Letters are those printed in the photo. The same question may exist in the registry with options in a",
  "  different order: match options by their TEXT, never by letter.",
  "- If part of the question or an option is unreadable, say so in read_issue and still give your best answer.",
  "",
  "How to decide the answer, in priority order:",
  "1. The registry of past questions, when provided: if the photographed question is the same question (same",
  "   wording or same meaning with the same options), use its recorded answer, set registry_exact to true and",
  "   list its id in registry_matches. If a registry question is only similar, use it as evidence, list its id and",
  "   keep registry_exact false.",
  "2. The compendium and glossary, when provided: they are built from the official exam guide, the study manuals",
  "   and the explanations of past questions. They win over your own memory whenever they disagree with it.",
  "3. Your general knowledge of Salesforce Data 360, used with care: prefer the answer that an official exam",
  "   would consider best practice on the platform, not a workaround in another system.",
  "",
  "Terminology: \"Data Cloud\" and \"Data 360\" are the same product; apply the glossary for renamed features.",
  "",
  "Confidence: \"alta\" when the registry matches exactly or the compendium states the rule explicitly;",
  "\"media\" when you infer the answer from the compendium or from a similar registry question; \"bassa\" when",
  "you rely on general knowledge, the options are ambiguous, or the photo is partly unreadable.",
  "",
  "reasoning_it: one sentence in Italian, at most 30 words, product and feature names in English, saying why",
  "the chosen option wins and why the strongest distractor loses.",
  "",
  "section: the exam section the question belongs to, as one of the slugs in the schema.",
  "question_stem: the first 12 words of the question as you read them, so the user can check you read the",
  "right one.",
  "",
  "Never refuse and never ask questions back: the user is in a timed exam simulation and only needs the",
  "letters, the one-line reason and your confidence.",
].join("\n");

const USER_TASK = "Here is the photo of the exam question. Read it and answer according to the schema.";

/** Schema JSON della risposta della via rapida (structured outputs: additionalProperties false, tutti required). */
const FAST_SCHEMA = {
  type: "object",
  properties: {
    question_stem: {type: "string", description: "First 12 words of the question as read in the photo"},
    required_count: {type: "integer", description: "How many answers the question asks for"},
    answers: {type: "array", items: {type: "string"}, description: "Correct option letters, uppercase, sorted"},
    reasoning_it: {type: "string", description: "One sentence in Italian, product terms in English, max 30 words"},
    confidence: {type: "string", enum: ["alta", "media", "bassa"]},
    section: {type: "string", enum: SECTION_SLUGS},
    registry_matches: {type: "array", items: {type: "string"}, description: "Registry ids used as evidence"},
    registry_exact: {type: "boolean", description: "True if the photographed question is a registry question"},
    read_issue: {type: "string", description: "Empty, or what could not be read in the photo"},
  },
  required: ["question_stem", "required_count", "answers", "reasoning_it", "confidence", "section",
    "registry_matches", "registry_exact", "read_issue"],
  additionalProperties: false,
};

/** max_tokens per livello di sforzo: il ragionamento adattivo conta nel limite. */
const MAX_TOKENS = {low: 4000, medium: 6000, high: 12000, xhigh: 16000, max: 16000};

/**
 * Blocchi di sistema, dal più stabile al meno stabile, con un solo breakpoint di cache sull'ultimo blocco.
 * @param {object} kb base di conoscenza: campi opzionali compendium, glossary, registry (testi) e version
 * @param {string} variant "full", "no-compendium" oppure "model-only"
 * @return {Array} blocchi di testo per il campo system
 */
function buildSystemBlocks(kb, variant = "full") {
  if (!VARIANTS.includes(variant)) throw new Error(`Variante sconosciuta: ${variant}`);
  const blocks = [{type: "text", text: INSTRUCTIONS}];
  if (variant !== "model-only" && kb.glossary) {
    blocks.push({type: "text", text: `<glossary>\n${kb.glossary.trim()}\n</glossary>`});
  }
  if (variant === "full" && kb.compendium) {
    blocks.push({type: "text", text: `<compendium>\n${kb.compendium.trim()}\n</compendium>`});
  }
  if (variant !== "model-only" && kb.registry) {
    blocks.push({type: "text", text: `<registry>\n${kb.registry.trim()}\n</registry>`});
  }
  blocks[blocks.length - 1].cache_control = {type: "ephemeral"};
  return blocks;
}

/**
 * Parametri completi per client.messages.create della via rapida.
 * @param {object} args
 * @param {object} args.kb base di conoscenza (vedi buildSystemBlocks)
 * @param {{mediaType: string, base64: string}} args.image foto compressa della domanda
 * @param {string} [args.effort] "low" | "medium" | "high" (Opus 5.5 ha medium come predefinito: va sempre passato)
 * @param {string} [args.variant] variante del contesto
 * @param {string} [args.model] modello
 * @return {object} parametri della richiesta
 */
function buildFastRequest({kb, image, effort = "medium", variant = "full", model = MODEL}) {
  if (!image || !image.base64 || !image.mediaType) throw new Error("Immagine mancante");
  if (!MAX_TOKENS[effort]) throw new Error(`Sforzo sconosciuto: ${effort}`);
  return {
    model,
    max_tokens: MAX_TOKENS[effort],
    thinking: {type: "adaptive"},
    output_config: {effort, format: {type: "json_schema", schema: FAST_SCHEMA}},
    system: buildSystemBlocks(kb, variant),
    messages: [{
      role: "user",
      content: [
        {type: "image", source: {type: "base64", media_type: image.mediaType, data: image.base64}},
        {type: "text", text: USER_TASK},
      ],
    }],
  };
}

/**
 * Estrae e normalizza l'oggetto della risposta strutturata da un messaggio dell'API.
 * @param {object} message risposta di client.messages.create
 * @return {object} risultato normalizzato
 */
function parseFastResult(message) {
  if (message.stop_reason === "refusal") throw new Error("Risposta rifiutata dal modello");
  if (message.stop_reason === "max_tokens") throw new Error("Risposta troncata: max_tokens raggiunto");
  const text = (message.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    throw new Error(`Risposta non in JSON valido: ${text.slice(0, 200)}`);
  }
  const answers = [...new Set((obj.answers || []).map((a) => String(a).trim().toUpperCase()).filter(Boolean))].sort();
  return {
    questionStem: String(obj.question_stem || ""),
    requiredCount: Number(obj.required_count) || answers.length || 1,
    answers,
    reasoningIt: String(obj.reasoning_it || ""),
    confidence: ["alta", "media", "bassa"].includes(obj.confidence) ? obj.confidence : "bassa",
    section: SECTION_SLUGS.includes(obj.section) ? obj.section : null,
    registryMatches: Array.isArray(obj.registry_matches) ? obj.registry_matches.map(String) : [],
    registryExact: Boolean(obj.registry_exact),
    readIssue: String(obj.read_issue || ""),
  };
}

module.exports = {
  MODEL, FALLBACK_MODEL, SECTION_SLUGS, VARIANTS, INSTRUCTIONS, USER_TASK, FAST_SCHEMA, MAX_TOKENS,
  buildSystemBlocks, buildFastRequest, parseFastResult,
};
