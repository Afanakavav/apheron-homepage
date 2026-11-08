/* eslint-disable */
// Copied from the private exam-coach lab (engine/prompt.js) by scripts/tools/sync-engine.js: edit it there.
"use strict";
/**
 * Exam Coach engine: builds the Claude API requests for one exam pack and parses the answers.
 * SDK-free and exam-agnostic: everything exam-specific comes from pack.json and the pack's knowledge-base text.
 * The lab evaluation and the production functions use this same file, so the measured prompt is the deployed one.
 *
 * API shapes from the claude-api skill (2026-11-08):
 * - adaptive thinking on Opus 5.5 ({type: "adaptive"}, cannot be disabled; effort defaults to medium, so it is
 *   always set); Fable 5.1 thinks always: `thinking` is omitted.
 * - structured output: output_config.format {type: "json_schema", schema}; the schema is part of the cached
 *   prefix, so answer, deep and warm requests share one schema.
 * - prompt caching: one breakpoint {type: "ephemeral", ttl: "1h"} on the knowledge-base block (sessions of up to
 *   an hour; a read refreshes the TTL).
 * - deep review: a per-message effort change (beta mid-conversation-output-config-2026-07-01, a role "system"
 *   message with empty content and output_config.effort) raises effort without invalidating the cached prefix,
 *   which a top-level effort change would do.
 * - refusals: server-side fallbacks: "default" (beta server-side-fallback-2026-07-01), not allowed in Batches.
 * - images up to 2576 px on the long edge are read at native resolution.
 */

const MODELS = {
  opus: { id: "claude-opus-5-5", thinking: { type: "adaptive" } },
  fable: { id: "claude-fable-5-1", thinking: null },
};
const BETA_FALLBACK = "server-side-fallback-2026-07-01";
const BETA_MESSAGE_EFFORT = "mid-conversation-output-config-2026-07-01";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const MAX_TOKENS = { answer: 16000, deep: 32000, warm: 16 };
const CONFIDENCE = ["high", "medium", "low"];

/** Generic instructions; {placeholders} are filled from pack.json. */
const INSTRUCTIONS = `You are an exam coach for the {examTitle} certification. The user studies with practice tests: they photograph one practice question on a computer screen with a phone and send the photo. Read the question and its options, decide which option or options are correct according to the exam material below, and return the structured result.

Reading the photo
- The photo may be skewed, blurred, show screen moire, or be cut at the edges. Read the question, any scenario text shown with it, the instruction about how many options to select (for example "Select 2" or "Choose all that apply") and every option with its letter.
- required_count is the number of options the question asks for; use 1 when it does not say. answers holds exactly required_count option letters, uppercase, sorted. If the options have no printed letters, call them A, B, C... from top to bottom.
- answer_texts holds the full text of each chosen option as printed, in the same order as answers.
- If something cannot be read, say what in read_issue and still give your best answer.

Deciding the answer
- {examFormat}
- The exam is written against the sources with authority 1. Answer as they teach it, even when your general knowledge or a lower source differs. Authority order, highest first: {authorityOrder}. The document "Notes on the sources" lists known conflicts between sources and how to resolve them.
- Use the official legal and framework texts for details the course does not state, and the lower sources to understand the course better. When a lower source states a newer fact than the course, keep the course answer and mention the newer fact in conflict_note.
- The course knowledge checks (<knowledge_check> blocks, correct options marked ✓) show how the course frames a topic. If the photographed question is the same as one of them or as a registry question, list its id in matches and set exact_match to true; list similar ones with exact_match false.
- In scenario questions, reason from the facts given in the photo. Words such as "best", "first", "most important" or "primary" ask for the course's priority, not for any acceptable action.
- When the sources disagree in a way that changes which option is correct, or the deciding fact is not in the material, set confidence to low and explain in conflict_note.

Fields
- confidence: high when the material states the rule that decides the question; medium when you infer it from related material; low when the material is silent, sources conflict, the options are ambiguous, or the photo is partly unreadable.
- explanation: English, at most two sentences (about 40 words): why the chosen option or options are right and why the strongest distractor is wrong.
- citations: up to three sources that support the answer, in each document's cite format, for example {citeExamples}.
- domain: the exam domain of the question: {domains}.
- question_stem: the first 12 words of the question as you read them, so the user can check you read the right one.
- conflict_note and read_issue: empty strings when there is nothing to report.

Never refuse and never ask questions back: the user only needs the answer, a short reason, the sources and your confidence.`;

const ANSWER_TASK = "Here is the photo of the practice question. Answer according to the schema.";
const WARM_TASK = "Cache warm-up request: no question attached. Reply with an empty answer.";

/** Deep review: same schema and prefix, more effort, a longer explanation asked in the uncached user turn. */
function deepTask(previous) {
  const prev = previous
    ? `A first answer was ${(previous.answers || []).join(", ") || "none"} with ${previous.confidence || "unknown"} confidence: "${previous.explanation || ""}". `
    : "";
  return `${ANSWER_TASK}\nDeep review requested. ${prev}Re-examine the question from scratch and check every option against the material. In explanation write up to six sentences that cover each option, and give the most precise citations you can.`;
}

/**
 * Instructions text for a pack (stable for a given pack.json: part of the cached prefix).
 * @param {object} pack pack.json
 */
function buildInstructions(pack) {
  const e = pack.exam || {};
  const examFormat = e.items
    ? `Exam format: ${e.items} questions, ${e.format || "multiple choice"}. A question that asks for several options gives no partial credit.`
    : "Questions are multiple choice.";
  const fill = {
    examTitle: pack.title,
    examFormat,
    authorityOrder: (pack.authorityOrder || []).map((s) => s.replace(/^\d+\s*/, "")).join("; "),
    citeExamples: pack.citeExamples || "\"M3/L2\" for a course lesson",
    domains: (pack.domains || []).map((d) => `${d.id} ${d.title}`).join("; "),
  };
  return INSTRUCTIONS.replace(/\{(\w+)\}/g, (m, k) => (fill[k] !== undefined ? fill[k] : m));
}

/** JSON schema of the answer (all fields required, no extra properties); the domain enum comes from the pack. */
function answerSchema(pack) {
  const domains = (pack.domains || []).map((d) => d.id);
  return {
    type: "object",
    properties: {
      question_stem: { type: "string", description: "First 12 words of the question as read in the photo" },
      required_count: { type: "integer", description: "How many options the question asks for" },
      answers: { type: "array", items: { type: "string" }, description: "Chosen option letters, uppercase, sorted" },
      answer_texts: { type: "array", items: { type: "string" }, description: "Full text of each chosen option, same order as answers" },
      explanation: { type: "string", description: "Why the answer is right and the strongest distractor wrong" },
      citations: { type: "array", items: { type: "string" }, description: "Up to three sources in the documents' cite format" },
      confidence: { type: "string", enum: CONFIDENCE },
      domain: domains.length ? { type: "string", enum: domains } : { type: "string" },
      matches: { type: "array", items: { type: "string" }, description: "Ids of knowledge checks or registry questions used as evidence" },
      exact_match: { type: "boolean", description: "True if the photographed question is one of the matches" },
      conflict_note: { type: "string", description: "Empty, or the source conflict or newer fact that matters" },
      read_issue: { type: "string", description: "Empty, or what could not be read in the photo" },
    },
    required: ["question_stem", "required_count", "answers", "answer_texts", "explanation", "citations", "confidence",
      "domain", "matches", "exact_match", "conflict_note", "read_issue"],
    additionalProperties: false,
  };
}

/**
 * System blocks: instructions, then the knowledge base (and the optional compact registry) with the 1-hour cache
 * breakpoint on the last block.
 * @param {object} pack pack.json
 * @param {string} kbText knowledge-base text of one context configuration (build/<pack>/kb/<config>/kb.md)
 * @param {string} [registryText] compact registry of practice questions, if any
 */
function buildSystem(pack, kbText, registryText) {
  const blocks = [{ type: "text", text: buildInstructions(pack) }, { type: "text", text: kbText }];
  if (registryText) blocks.push({ type: "text", text: `<registry>\n${registryText.trim()}\n</registry>` });
  blocks[blocks.length - 1].cache_control = { type: "ephemeral", ttl: "1h" };
  return blocks;
}

/**
 * Request parameters for client.beta.messages.create / .stream.
 * @param {object} args
 * @param {object} args.pack pack.json
 * @param {string} args.kbText knowledge-base text
 * @param {string} [args.registryText] compact registry
 * @param {{mediaType:string, base64:string}} [args.image] the question photo (not needed for warm)
 * @param {"answer"|"deep"|"warm"} [args.mode]
 * @param {"opus"|"fable"} [args.model]
 * @param {string} [args.effort] top-level effort, the same for every mode so the prefix stays cached
 * @param {string} [args.deepEffort] effort of the deep review, set per message
 * @param {object} [args.previous] previous answer (answers, confidence, explanation) for a deep review
 * @param {boolean} [args.fallbacks] server-side refusal fallbacks (default true; must be false in Batches)
 */
function buildRequest({ pack, kbText, registryText, image, mode = "answer", model = "opus", effort = "high", deepEffort = "max", previous, fallbacks = true }) {
  const m = MODELS[model];
  if (!m) throw new Error(`Unknown model: ${model}`);
  if (!EFFORTS.includes(effort) || !EFFORTS.includes(deepEffort)) throw new Error(`Unknown effort: ${effort}/${deepEffort}`);
  if (mode !== "warm" && (!image || !image.base64 || !image.mediaType)) throw new Error("Question photo missing");

  const content = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } });
  content.push({ type: "text", text: mode === "warm" ? WARM_TASK : mode === "deep" ? deepTask(previous) : ANSWER_TASK });

  const messages = [];
  const betas = [];
  if (mode === "deep") {
    messages.push({ role: "system", content: [], output_config: { effort: deepEffort } });
    betas.push(BETA_MESSAGE_EFFORT);
  }
  messages.push({ role: "user", content });

  const params = {
    model: m.id,
    max_tokens: MAX_TOKENS[mode],
    output_config: { effort, format: { type: "json_schema", schema: answerSchema(pack) } },
    system: buildSystem(pack, kbText, registryText),
    messages,
  };
  if (m.thinking) params.thinking = m.thinking;
  if (fallbacks) {
    params.fallbacks = "default";
    betas.push(BETA_FALLBACK);
  }
  if (betas.length) params.betas = betas;
  return params;
}

/**
 * Normalized answer from an API message.
 * @param {object} message response of messages.create / stream.finalMessage()
 * @param {object} pack pack.json
 */
function parseAnswer(message, pack) {
  if (message.stop_reason === "refusal") {
    const d = message.stop_details || {};
    throw new Error(`Refused (${d.category || "no category"}): ${d.explanation || ""}`);
  }
  if (message.stop_reason === "max_tokens") throw new Error("Answer truncated: max_tokens reached");
  const text = (message.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  let o;
  try {
    o = JSON.parse(text);
  } catch (err) {
    throw new Error(`Answer is not valid JSON: ${text.slice(0, 200)}`);
  }
  const letters = (o.answers || []).map((a) => String(a).trim().toUpperCase()).filter(Boolean);
  const texts = Array.isArray(o.answer_texts) ? o.answer_texts.map(String) : [];
  // Letters and texts are sorted as pairs; when the counts differ the texts cannot be paired and stay as given.
  let answers = [...new Set(letters)].sort();
  let answerTexts = texts;
  if (texts.length === letters.length) {
    const pairs = new Map();
    letters.forEach((l, i) => pairs.has(l) || pairs.set(l, texts[i]));
    answers = [...pairs.keys()].sort();
    answerTexts = answers.map((l) => pairs.get(l));
  }
  const domains = (pack.domains || []).map((d) => d.id);
  return {
    questionStem: String(o.question_stem || ""),
    requiredCount: Number(o.required_count) || answers.length || 1,
    answers,
    answerTexts,
    textsPaired: texts.length === letters.length,
    explanation: String(o.explanation || ""),
    citations: Array.isArray(o.citations) ? o.citations.map(String).slice(0, 3) : [],
    confidence: CONFIDENCE.includes(o.confidence) ? o.confidence : "low",
    domain: domains.includes(o.domain) ? o.domain : null,
    matches: Array.isArray(o.matches) ? o.matches.map(String) : [],
    exactMatch: Boolean(o.exact_match),
    conflictNote: String(o.conflict_note || ""),
    readIssue: String(o.read_issue || ""),
    servedBy: message.model,
    fellBack: (message.usage && Array.isArray(message.usage.iterations) ? message.usage.iterations : []).some((i) => i.type === "fallback_message"),
  };
}

module.exports = { MODELS, EFFORTS, MAX_TOKENS, ANSWER_TASK, WARM_TASK, buildInstructions, answerSchema, buildSystem, buildRequest, parseAnswer };
