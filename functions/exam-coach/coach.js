"use strict";
/**
 * Exam Coach: handlers of the callables of the generic engine (one knowledge pack per exam).
 *
 * - examCoachAnswer({examId, mode, image?, previousLogId?, force?}):
 *   - mode "answer": photo -> Claude (engine/prompt.js buildRequest) -> letters, short explanation, citations,
 *     confidence; the photo goes to the private bucket (photos/<logId>.<ext>) in parallel (the reply waits for it
 *     at most PHOTO_WAIT_MS after the model call), the result to Firestore (examCoachLog/<logId>).
 *   - mode "deep": the same request with the per-message effort raised (same cached prefix); with previousLogId it
 *     passes that answer as "previous", reuses its photo when none is sent, and returns the stored deep result if
 *     one exists (force: true runs it again).
 *   - mode "warm": the same prefix without a photo and with max_tokens 16, to write (or refresh) the 1-hour prompt
 *     cache when a study session opens; it also loads the pack on this instance. Logged like the others, because
 *     cache writes are the main cost.
 * - examCoachPhoto({logId}): the stored photo of an answer, in base64, to its owner only.
 *
 * Rules: no exam material and no key in this file or anywhere in this repository; packs come from the private
 * bucket (kb.js), the Anthropic key from Secret Manager (EXAM_COACH_ANTHROPIC_KEY) and is never logged.
 * The engine (engine/prompt.js, engine/cost.js) is copied from the private lab by its sync script: never edit it
 * here.
 * SDK references (claude-api skill): client.beta.messages.stream(params, {timeout}).finalMessage(); the SDK
 * timeout only covers the wait for the response headers of a streamed request, so an overall deadline aborts the
 * stream (stream.abort() -> APIUserAbortError); an overload can also arrive mid-stream as an SSE error event
 * (APIError with no status and type "overloaded_error"); typed errors RateLimitError, InternalServerError,
 * APIConnectionError / APIConnectionTimeoutError, BadRequestError, AuthenticationError, PermissionDeniedError,
 * NotFoundError; usage.cache_creation splits cache writes by TTL (ephemeral_5m / ephemeral_1h input tokens);
 * usage.iterations entries of type "fallback_message" mark a server-side refusal fallback; with fallbacks,
 * usage.iterations is the per-attempt source of truth for billing and the top-level usage covers only the attempt
 * that produced the reply (so costs come from engine/cost.js messageCost, which prices every iteration).
 * The SDK (0.135.0) sends anthropic-version 2023-06-01; the 2026-10-21 API version changes (sampling parameters,
 * documents in assistant turns, citations in user turns, Admin API fields) touch nothing these requests send.
 */

const crypto = require("crypto");
const {HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const sdk = require("@anthropic-ai/sdk");
const Anthropic = sdk.default || sdk;
const engine = require("./engine/prompt");
const {messageCost} = require("./engine/cost");
const packs = require("./kb");

/** Secret Manager name of the Anthropic API key used by Exam Coach (key "exam-coach-prod" in the Console). */
const SECRET_NAME = "EXAM_COACH_ANTHROPIC_KEY";
const anthropicKey = defineSecret(SECRET_NAME);

/**
 * Only allowed user, as in the Firestore rules: uid and email must both match. The account (email/password,
 * sign-up disabled) has an unverified email, so the identity check binds to the uid, which only that account
 * presents, instead of the email_verified claim.
 */
const ALLOWED_EMAILS = ["francesco.perone00@gmail.com"];
const ALLOWED_UIDS = ["x5PmQWOKoBcGrrqzxVIdVx5Mi0t1"];
const LOG_COLLECTION = "examCoachLog";
const PHOTO_PREFIX = "photos/";
const MODES = ["answer", "deep", "warm"];
/** Accepted photo types and their file extension in the bucket. */
const MEDIA_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"};
/** Longest accepted base64 string of a photo (5 MiB, about 3.75 MB of image). */
const MAX_IMAGE_BASE64 = 5 * 1024 * 1024;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const LOG_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/**
 * Production settings used when pack.json has no "production" block (or leaves a field out). The block is
 * required at publish time; its absence is logged once per loaded pack version.
 */
const PRODUCTION_DEFAULTS = {config: null, model: "opus", effort: "high", deepEffort: "max"};

/** timeoutSeconds of examCoachAnswer (index.js): every deadline below stays under it. */
const FUNCTION_TIMEOUT_S = 540;
/**
 * Callable timeouts the page must use (public/exam-coach/app.js): answer 180 s; warm and deep 560 s, longer than
 * the function timeout. An answer handler also ends before the page's 180 s.
 */
const PAGE_TIMEOUT_MS = {answer: 180000, warm: 560000, deep: 560000};
/** Time kept after the model call for the photo, the log and the reply. */
const HANDLER_MARGIN_MS = 25000;
/**
 * Wall-clock budget of the model call per mode, retries included: answer 150 s; warm 240 s (a cold 1-hour cache
 * write of up to ~480k tokens); deep 480 s (max effort on a 311k-482k-token context). An aborted stream is still
 * billed, so the budgets are generous.
 */
const MODEL_BUDGET_MS = {answer: 150000, warm: 240000, deep: 480000};
/** No new attempt starts with less than this left in the budget (a shorter attempt would likely be aborted). */
const MIN_ATTEMPT_MS = {answer: 30000, warm: 60000, deep: 120000};
/** Longest wait for the photo write after the model call: past it the reply goes out with photoPath null. */
const PHOTO_WAIT_MS = 5000;
/** Extra attempts on the SAME model after an overload or a server error, and the waits before them. */
const OVERLOAD_RETRIES = 2;
const RETRY_DELAYS_MS = [2000, 6000];

/** Anthropic client built once per instance; tests can replace it with setClient. */
let client = null;

/**
 * @return {object} Anthropic client (key from Secret Manager; retries are done here, not by the SDK, so that they
 *   stay inside the function deadline)
 */
function getClient() {
  if (!client) client = new Anthropic({apiKey: anthropicKey.value(), maxRetries: 0});
  return client;
}

/**
 * Replaces the Anthropic client (tests only).
 * @param {object|null} fake object with beta.messages.stream(params, options) returning {finalMessage, abort}
 */
function setClient(fake) {
  client = fake;
}

/**
 * The model run went past its deadline (the stream was aborted).
 */
class ModelDeadlineError extends Error {
  /**
   * @param {number} ms budget that ran out
   */
  constructor(ms) {
    super(`Model call aborted after ${ms} ms`);
    this.name = "ModelDeadlineError";
  }
}

/**
 * The model answered but the answer cannot be used (refusal, truncation, invalid JSON).
 */
class AnswerError extends Error {
  /**
   * @param {"refusal"|"truncated"|"unreadable"} reason why the answer cannot be used
   * @param {string} message details for the logs
   */
  constructor(reason, message) {
    super(message);
    this.name = "AnswerError";
    this.reason = reason;
  }
}

/**
 * A model call that failed after its attempts; keeps what the failed attempts consumed for the cost log.
 */
class ModelCallError extends Error {
  /**
   * @param {Error} cause last error
   * @param {number} attempts attempts made
   * @param {object[]} failures failed attempts (error summary, partial usage, estimated cost)
   */
  constructor(cause, attempts, failures) {
    super(String((cause && cause.message) || "Model call failed"));
    this.name = "ModelCallError";
    this.cause = cause;
    this.attempts = attempts;
    this.failures = failures;
  }
}

/**
 * The pack's "production" block is not usable.
 */
class PackConfigError extends Error {
  /**
   * @param {string} message what is wrong
   */
  constructor(message) {
    super(message);
    this.name = "PackConfigError";
  }
}

/**
 * @return {boolean} true when running in the emulator (log documents get test: true)
 */
function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

/**
 * @param {object} obj object
 * @param {string} key key
 * @return {boolean} true if obj has its own property key
 */
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * @param {*} data request.data
 * @return {object} data if it is a plain object, otherwise {}
 */
function plainData(data) {
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

/**
 * @param {string} message English text for the user
 * @return {HttpsError} invalid-argument error
 */
function invalid(message) {
  return new HttpsError("invalid-argument", message);
}

/**
 * Checks sign-in and the allowlist: both the owner's uid and email must match.
 * @param {object} request callable request
 * @return {{uid: string, email: string}} allowed user
 */
function requireUser(request) {
  if (!request || !request.auth) throw new HttpsError("unauthenticated", "Sign-in required.");
  const token = request.auth.token || {};
  const uid = String(request.auth.uid || "");
  const email = String(token.email || "").trim().toLowerCase();
  if (!ALLOWED_UIDS.includes(uid) || !email || !ALLOWED_EMAILS.includes(email)) {
    throw new HttpsError("permission-denied", "This account is not allowed.");
  }
  return {uid, email};
}

/**
 * App Check state of the request, for the logs: with enforceAppCheck the SDK rejects requests without a valid
 * token, and request.app is set only when the token is valid.
 * @param {object} request callable request
 * @return {string} "valid" or "missing"
 */
function appCheckState(request) {
  return request && request.app ? "valid" : "missing";
}

/**
 * @param {Buffer} bytes decoded photo
 * @param {string} mediaType declared type
 * @return {boolean} true if the leading bytes match the declared type
 */
function matchesMediaType(bytes, mediaType) {
  if (mediaType === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mediaType === "image/png") {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return bytes.length > 8 && bytes.subarray(0, 8).equals(signature);
  }
  if (mediaType === "image/webp") {
    return bytes.length > 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP";
  }
  return false;
}

/**
 * Validates the photo of a request.
 * @param {*} image request.data.image
 * @return {{mediaType: string, base64: string, bytes: Buffer}} validated photo
 */
function parseImage(image) {
  if (!image || typeof image !== "object") throw invalid("image must be {mediaType, base64}.");
  const {mediaType, base64} = image;
  if (typeof mediaType !== "string" || !hasOwn(MEDIA_TYPES, mediaType)) {
    throw invalid("Unsupported photo format: use JPEG, PNG or WebP.");
  }
  if (typeof base64 !== "string" || !base64) throw invalid("Photo missing.");
  if (base64.length > MAX_IMAGE_BASE64) throw invalid("Photo too large (at most 5 MB of base64).");
  if (!BASE64_RE.test(base64)) throw invalid("The photo must be plain base64, without a data: prefix.");
  const bytes = Buffer.from(base64, "base64");
  if (!matchesMediaType(bytes, mediaType)) throw invalid("The photo content does not match its format.");
  return {mediaType, base64, bytes};
}

/**
 * Validates the data of examCoachAnswer.
 * @param {*} data request.data
 * @return {{examId: string, mode: string, image: (object|null), previousLogId: (string|null), force: boolean}} input
 */
function parseAnswerData(data) {
  const d = plainData(data);
  const examId = typeof d.examId === "string" ? d.examId.trim() : "";
  if (!packs.isAllowedExam(examId)) throw invalid("Unknown exam.");
  const mode = d.mode === undefined || d.mode === null ? "answer" : d.mode;
  if (!MODES.includes(mode)) throw invalid("Unknown mode: use answer, deep or warm.");
  let previousLogId = null;
  if (d.previousLogId !== undefined && d.previousLogId !== null && d.previousLogId !== "") {
    previousLogId = typeof d.previousLogId === "string" ? d.previousLogId.trim() : "";
    if (!LOG_ID_RE.test(previousLogId)) throw invalid("previousLogId is not valid.");
    if (mode !== "deep") throw invalid("previousLogId is accepted only in deep mode.");
  }
  // A warm-up never sends a photo: whatever came with it is ignored.
  const image = mode !== "warm" && d.image !== undefined && d.image !== null ? parseImage(d.image) : null;
  if (mode === "answer" && !image) throw invalid("Photo missing.");
  if (mode === "deep" && !image && !previousLogId) throw invalid("Deep review needs the photo or previousLogId.");
  return {examId, mode, image, previousLogId, force: d.force === true};
}

/** pack.json objects whose missing "production" block was already logged (one per loaded version per instance). */
const warnedNoProduction = new WeakSet();

/**
 * Production settings of a pack: pack.json "production" {config, model, effort, deepEffort}, defaults otherwise.
 * The block is required at publish time: when it is missing, a warning is logged once and the defaults apply.
 * @param {object} pack pack.json
 * @return {{config: (string|null), model: string, effort: string, deepEffort: string}} settings
 */
function productionSettings(pack) {
  const hasBlock = Boolean(pack && pack.production && typeof pack.production === "object");
  if (!hasBlock && pack && typeof pack === "object" && !warnedNoProduction.has(pack)) {
    warnedNoProduction.add(pack);
    logger.warn("examCoach: pack.json has no production block, using the defaults", {
      examId: String(pack.id), defaults: PRODUCTION_DEFAULTS,
    });
  }
  const p = hasBlock ? pack.production : {};
  const pick = (key) => (p[key] === undefined || p[key] === null ? PRODUCTION_DEFAULTS[key] : p[key]);
  const settings = {config: pick("config"), model: pick("model"), effort: pick("effort"), deepEffort: pick("deepEffort")};
  if (settings.config !== null && typeof settings.config !== "string") throw new PackConfigError("production.config");
  if (typeof settings.model !== "string" || !hasOwn(engine.MODELS, settings.model)) {
    throw new PackConfigError(`production.model "${settings.model}"`);
  }
  if (!engine.EFFORTS.includes(settings.effort)) throw new PackConfigError(`production.effort "${settings.effort}"`);
  if (!engine.EFFORTS.includes(settings.deepEffort)) {
    throw new PackConfigError(`production.deepEffort "${settings.deepEffort}"`);
  }
  return settings;
}

/**
 * @param {Buffer} bytes content
 * @return {string} hexadecimal SHA-256
 */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * @param {*} value number or anything
 * @return {number} value as a non-negative integer count (0 if missing)
 */
function count(value) {
  return Number(value) || 0;
}

/**
 * @param {number} x amount in USD
 * @return {number} x rounded to 6 decimals
 */
function round6(x) {
  return Math.round(x * 1e6) / 1e6;
}

/**
 * Token usage of an API message, with the cache writes split by TTL. With a server-side fallback this is the
 * attempt that produced the reply only; iterationsOf has every attempt.
 * @param {object} message API message (or a partial stream snapshot)
 * @return {object} {input, output, cacheRead, cacheWrite, cacheWrite5m, cacheWrite1h}
 */
function usageOf(message) {
  return tokensOf((message && message.usage) || {});
}

/**
 * @param {object} u usage object (message.usage or one entry of usage.iterations)
 * @return {object} {input, output, cacheRead, cacheWrite, cacheWrite5m, cacheWrite1h}
 */
function tokensOf(u) {
  const split = u.cache_creation || {};
  const cacheWrite = count(u.cache_creation_input_tokens);
  const cacheWrite1h = count(split.ephemeral_1h_input_tokens);
  const cacheWrite5m = split.ephemeral_5m_input_tokens !== undefined && split.ephemeral_5m_input_tokens !== null ?
    count(split.ephemeral_5m_input_tokens) :
    Math.max(0, cacheWrite - cacheWrite1h);
  return {
    input: count(u.input_tokens),
    output: count(u.output_tokens),
    cacheRead: count(u.cache_read_input_tokens),
    cacheWrite,
    cacheWrite5m,
    cacheWrite1h,
  };
}

/**
 * Compact copy of usage.iterations for the log (one entry per attempt: the declined one and the fallback one).
 * @param {object} message API message (or a partial stream snapshot)
 * @return {object[]|null} [{type, model, input, output, cacheRead, cacheWrite5m, cacheWrite1h}], null when the
 *   message has no iterations
 */
function iterationsOf(message) {
  const u = (message && message.usage) || {};
  if (!Array.isArray(u.iterations) || !u.iterations.length) return null;
  return u.iterations.map((it) => {
    const entry = it && typeof it === "object" ? it : {};
    const t = tokensOf(entry);
    return {
      type: entry.type ? String(entry.type) : null,
      model: entry.model ? String(entry.model) : null,
      input: t.input,
      output: t.output,
      cacheRead: t.cacheRead,
      cacheWrite5m: t.cacheWrite5m,
      cacheWrite1h: t.cacheWrite1h,
    };
  });
}

/**
 * Cost of a message with the engine's price list (engine/cost.js messageCost: every usage.iterations entry at its
 * own model, so a declined attempt before a server-side fallback is counted too).
 * @param {object} message API message (or a partial stream snapshot)
 * @param {string} requestedModel model id sent in the request (params.model)
 * @return {{usd: (number|null), byModel: (object|null)}} cost in USD rounded to 6 decimals and per model, null if
 *   a model has no price
 */
function costOf(message, requestedModel) {
  try {
    const c = messageCost(message || {}, requestedModel);
    const byModel = {};
    for (const key of Object.keys(c.byModel)) byModel[key] = round6(c.byModel[key]);
    return {usd: round6(c.usd), byModel};
  } catch (err) {
    logger.warn("examCoach: no price for a model, cost not computed", {
      model: String(message && message.model), requestedModel: String(requestedModel),
      error: String((err && err.message) || "").slice(0, 200),
    });
    return {usd: null, byModel: null};
  }
}

/**
 * @param {object} message API message
 * @return {{servedBy: (string|null), fellBack: boolean}} model that served the answer and whether a server-side
 *   refusal fallback ran
 */
function servedByOf(message) {
  const u = (message && message.usage) || {};
  const iterations = Array.isArray(u.iterations) ? u.iterations : [];
  return {
    servedBy: message && message.model ? String(message.model) : null,
    fellBack: iterations.some((i) => i && i.type === "fallback_message"),
  };
}

/**
 * Short description of an error for the logs: never headers, never the key, never the stack.
 * @param {Error} err error
 * @return {object} summary fields
 */
function describeError(err) {
  return {
    name: err && err.constructor ? err.constructor.name : "Error",
    status: err && err.status ? err.status : null,
    type: err && err.type ? err.type : null,
    requestId: err && err.requestID ? String(err.requestID) : null,
    message: String((err && err.message) || "").slice(0, 300),
  };
}

/**
 * @param {Error} err SDK error
 * @return {boolean} true for an overload or a server-side error worth retrying on the same model: 529 / 5xx, an
 *   overloaded_error or api_error event mid-stream, or a connection error that is not a timeout
 */
function isRetryable(err) {
  if (err instanceof Anthropic.APIUserAbortError) return false;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return false;
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.InternalServerError) return true;
  if (err instanceof Anthropic.APIError) {
    const status = Number(err.status) || 0;
    return status === 529 || status >= 500 || err.type === "overloaded_error" || err.type === "api_error";
  }
  return false;
}

/**
 * @param {number} ms wait
 * @return {Promise<void>} resolves after ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Streams one request with an overall deadline and retries on the same model after overloads or server errors
 * (no switch to another model: it would have no cache; refusals are handled by the server-side fallback that the
 * engine puts in the request).
 * @param {object} api Anthropic client (or a fake with beta.messages.stream)
 * @param {object} params request parameters from engine.buildRequest
 * @param {{deadline: number, minAttemptMs: number}} opts deadline: epoch ms by which the call must end
 * @return {Promise<{message: object, requestedModel: string, latencyMs: number, attempts: number,
 *   failures: object[]}>} final message
 */
async function callModel(api, params, opts) {
  const t0 = Date.now();
  const failures = [];
  for (let attempt = 1; ; attempt++) {
    const remaining = opts.deadline - Date.now();
    if (remaining <= 0) throw new ModelCallError(new ModelDeadlineError(opts.deadline - t0), attempt - 1, failures);
    const stream = api.beta.messages.stream(params, {timeout: remaining});
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stream.abort();
    }, remaining);
    try {
      const message = await stream.finalMessage();
      return {message, requestedModel: params.model, latencyMs: Date.now() - t0, attempts: attempt, failures};
    } catch (rawErr) {
      clearTimeout(timer);
      const err = timedOut ? new ModelDeadlineError(Date.now() - t0) : rawErr;
      const partial = stream.currentMessage || null;
      failures.push({
        ...describeError(err),
        usage: partial ? usageOf(partial) : null,
        iterations: partial ? iterationsOf(partial) : null,
        costUsd: partial && partial.usage ? costOf(partial, params.model).usd : null,
      });
      const wait = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
      const left = opts.deadline - Date.now() - wait;
      if (timedOut || !isRetryable(err) || attempt > OVERLOAD_RETRIES || left < opts.minAttemptMs) {
        throw new ModelCallError(err, attempt, failures);
      }
      logger.warn("examCoach: model overloaded or server error, retrying the same model", {
        model: params.model, attempt, waitMs: wait, ...describeError(err),
      });
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Reads the answer of a completed call, turning a refusal, a truncation or invalid JSON into an AnswerError
 * (checked on stop_reason first, so no message matching is needed).
 * @param {object} message API message
 * @param {object} pack pack.json
 * @return {object} normalized answer (engine.parseAnswer)
 */
function readAnswer(message, pack) {
  if (message.stop_reason === "refusal") {
    const d = message.stop_details || {};
    throw new AnswerError("refusal", `Refused (${d.category || "no category"})`);
  }
  if (message.stop_reason === "max_tokens") throw new AnswerError("truncated", "max_tokens reached");
  try {
    return engine.parseAnswer(message, pack);
  } catch (err) {
    throw new AnswerError("unreadable", String(err && err.message).slice(0, 300));
  }
}

/**
 * Maps an error to an HttpsError with a short English message (details.reason lets the page react), without
 * stack or internal details.
 * @param {Error} err original error
 * @param {string} where function name, for the logs
 * @return {HttpsError} error for the client
 */
function toHttpsError(err, where) {
  if (err instanceof HttpsError) return err;
  const e = err instanceof ModelCallError ? err.cause : err;
  logger.error(`${where}: error`, describeError(e));
  if (e instanceof ModelDeadlineError || e instanceof Anthropic.APIConnectionTimeoutError) {
    return new HttpsError("deadline-exceeded", "The model took too long to answer. Try again.", {reason: "timeout"});
  }
  if (e instanceof AnswerError) {
    if (e.reason === "refusal") {
      return new HttpsError("failed-precondition", "The model declined to answer this question.", {reason: "refusal"});
    }
    if (e.reason === "truncated") {
      return new HttpsError("internal", "The answer was cut off. Try again.", {reason: "truncated"});
    }
    return new HttpsError("internal", "The model's answer could not be read. Try again.", {reason: "unreadable"});
  }
  if (e instanceof PackConfigError) {
    return new HttpsError("failed-precondition", "The exam pack configuration is not valid.", {reason: "pack"});
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new HttpsError("resource-exhausted", "Too many requests to the model. Try again in a minute.",
        {reason: "rate-limited"});
  }
  if (isRetryable(e)) {
    return new HttpsError("unavailable", "The model is overloaded or unreachable right now. Try again shortly.",
        {reason: "overloaded"});
  }
  if (e instanceof Anthropic.BadRequestError) {
    return new HttpsError("invalid-argument", "The model rejected the request: check the photo and try again.",
        {reason: "bad-request"});
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return new HttpsError("internal", "The model service rejected the server credentials.", {reason: "auth"});
  }
  if (e instanceof Anthropic.NotFoundError) {
    return new HttpsError("internal", "The configured model is not available.", {reason: "model"});
  }
  if (e instanceof Anthropic.APIError) {
    return new HttpsError("internal", "Model error. Try again later.", {reason: "api"});
  }
  return new HttpsError("internal", "Internal error. Try again later.", {reason: "internal"});
}

/**
 * Loads the current pack of an exam: a pack whose files are not valid (kb.PackInvalidError, for example kb.md built
 * for another configuration than pack.production.config) becomes "failed-precondition", bucket errors become
 * "unavailable"; both with reason "pack".
 * @param {string} examId exam id
 * @return {Promise<{pack: object, warm: boolean, loadMs: number, stale: (boolean|undefined)}>} result of kb.ensurePack
 */
async function packOrThrow(examId) {
  try {
    return await packs.ensurePack(examId);
  } catch (err) {
    logger.error("examCoachAnswer: pack not loaded", {examId, ...describeError(err)});
    if (err instanceof packs.PackInvalidError) {
      throw new HttpsError("failed-precondition", "The exam pack is not valid.", {reason: "pack"});
    }
    throw new HttpsError("unavailable", "The exam material is not available. Try again shortly.", {reason: "pack"});
  }
}

/**
 * Writes a log document; a failure is logged and never blocks the reply.
 * @param {object} ref Firestore document reference
 * @param {object} doc document
 * @return {Promise<void>} resolves when written or failed
 */
async function writeLog(ref, doc) {
  if (isEmulator()) doc.test = true;
  try {
    await ref.set(doc);
  } catch (err) {
    logger.error("examCoachAnswer: log not written", {logId: ref.id, ...describeError(err)});
  }
}

/**
 * Starts writing the photo to the bucket; a failure is logged and resolves to null.
 * @param {{mediaType: string, bytes: Buffer}} image validated photo
 * @param {string} logId id of the log document
 * @param {{uid: string}} user allowed user
 * @param {string} examId exam id
 * @return {Promise<string|null>} object path, or null if the write failed
 */
function savePhoto(image, logId, user, examId) {
  const photoPath = `${PHOTO_PREFIX}${logId}.${MEDIA_TYPES[image.mediaType]}`;
  return getStorage().bucket(packs.BUCKET).file(photoPath)
      .save(image.bytes, {
        contentType: image.mediaType,
        resumable: false,
        metadata: {metadata: {logId, uid: user.uid, examId}},
      })
      .then(() => photoPath)
      .catch((err) => {
        logger.error("examCoachAnswer: photo not saved", {logId, ...describeError(err)});
        return null;
      });
}

/**
 * Waits for the photo write at most PHOTO_WAIT_MS, so a hanging save never delays or breaks the reply. On timeout
 * the write goes on in the background (the object carries its logId in its metadata) and the log gets photoPath
 * null and photoTimedOut true.
 * @param {Promise<string|null>} photoWrite result of savePhoto (never rejects), or a resolved path
 * @param {string} logId id of the log document
 * @param {number} [waitMs] longest wait (PHOTO_WAIT_MS)
 * @return {Promise<{photoPath: (string|null), photoTimedOut: boolean}>} log fields
 */
async function settlePhoto(photoWrite, logId, waitMs = PHOTO_WAIT_MS) {
  const timedOut = Symbol("timedOut");
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(timedOut), waitMs);
  });
  try {
    const result = await Promise.race([photoWrite, timeout]);
    if (result !== timedOut) return {photoPath: result || null, photoTimedOut: false};
  } finally {
    clearTimeout(timer);
  }
  logger.warn("examCoachAnswer: photo write still running, reply sent without it", {logId, waitMs});
  Promise.resolve(photoWrite).then((late) => {
    if (late) logger.info("examCoachAnswer: photo saved after the reply", {logId, photoPath: late});
  });
  return {photoPath: null, photoTimedOut: true};
}

/**
 * Downloads a stored photo.
 * @param {string} photoPath object path in the bucket
 * @return {Promise<Buffer>} photo bytes
 */
async function downloadPhoto(photoPath) {
  const [bytes] = await getStorage().bucket(packs.BUCKET).file(photoPath).download();
  return bytes;
}

/**
 * Answer fields copied from engine.parseAnswer into the log and the reply (textsPaired: false when the model gave
 * a different number of texts than letters, so answerTexts are as given and not sorted with the letters).
 */
const ANSWER_FIELDS = ["questionStem", "requiredCount", "answers", "answerTexts", "textsPaired", "explanation",
  "citations", "confidence", "domain", "matches", "exactMatch", "conflictNote", "readIssue"];

/**
 * Reply of an answer or deep review, from its log document (also used for a stored deep result).
 * @param {string} logId log document id
 * @param {object} d log document
 * @param {boolean} cached true when the result comes from an earlier call
 * @return {object} reply for the page
 */
function publicResult(logId, d, cached) {
  const out = {
    logId,
    examId: d.examId || null,
    mode: d.mode || null,
    packVersion: d.packVersion || null,
    previousLogId: d.previousLogId || null,
  };
  for (const key of ANSWER_FIELDS) out[key] = d[key] === undefined ? null : d[key];
  return {
    ...out,
    model: d.model || null,
    servedBy: d.servedBy || null,
    fellBack: Boolean(d.fellBack),
    effort: d.mode === "deep" ? d.deepEffort || null : d.effort || null,
    latencyMs: d.latencyMs === undefined ? null : d.latencyMs,
    costUsd: d.costUsd === undefined ? null : d.costUsd,
    cacheRead: d.usage ? d.usage.cacheRead : null,
    cacheWrite: d.usage ? d.usage.cacheWrite : null,
    cached: Boolean(cached),
  };
}

/**
 * Fields of a log document that describe the model call.
 * @param {object} call result of callModel
 * @return {object} servedBy, fellBack, stopReason, messageId, usage, iterations, cost, latency, attempts
 */
function callFields(call) {
  const message = call.message;
  const cost = costOf(message, call.requestedModel);
  const failedCost = call.failures.reduce((s, f) => s + (f.costUsd || 0), 0);
  return {
    ...servedByOf(message),
    stopReason: message.stop_reason || null,
    messageId: message.id || null,
    usage: usageOf(message),
    iterations: iterationsOf(message),
    costUsd: cost.usd,
    costByModel: cost.byModel,
    latencyMs: call.latencyMs,
    attempts: call.attempts,
    failedAttempts: call.failures,
    failedCostUsd: round6(failedCost),
  };
}

/**
 * Fields of a log document for a model call that failed.
 * @param {Error} err error thrown by callModel
 * @return {object} attempts and what the failed attempts consumed
 */
function failedCallFields(err) {
  if (!(err instanceof ModelCallError)) return {attempts: 0, failedAttempts: [], failedCostUsd: 0};
  return {
    attempts: err.attempts,
    failedAttempts: err.failures,
    failedCostUsd: round6(err.failures.reduce((s, f) => s + (f.costUsd || 0), 0)),
  };
}

/**
 * Error fields of a log document.
 * @param {HttpsError} httpsErr error returned to the page
 * @param {Error} err original error
 * @return {object} {status: "error", error: {...}}
 */
function errorFields(httpsErr, err) {
  const cause = err instanceof ModelCallError ? err.cause : err;
  return {
    status: "error",
    error: {
      code: httpsErr.code,
      reason: httpsErr.details && httpsErr.details.reason ? httpsErr.details.reason : null,
      ...describeError(cause),
    },
  };
}

/**
 * Model deadline of a call that starts now: its budget, and HANDLER_MARGIN_MS before the earlier of the function
 * timeout and the page's callable timeout for the mode, so the reply (or the error) reaches the page.
 * @param {number} t0 start of the handler (epoch ms)
 * @param {string} mode answer, deep or warm
 * @return {number} epoch ms
 */
function modelDeadline(t0, mode) {
  const handlerEnd = t0 + Math.min(FUNCTION_TIMEOUT_S * 1000, PAGE_TIMEOUT_MS[mode]);
  return Math.min(Date.now() + MODEL_BUDGET_MS[mode], handlerEnd - HANDLER_MARGIN_MS);
}

/**
 * Warm-up: same cached prefix as the answers (instructions, schema, knowledge base), no photo, max_tokens 16. The
 * reply is cut by max_tokens on purpose, so stop_reason is not checked and parseAnswer is not called.
 * @param {object} ctx request context (user, input, appCheck, loaded, settings, t0, packWarm, loadMs, base)
 * @return {Promise<object>} warm-up result
 */
async function warmUp(ctx) {
  const logRef = getFirestore().collection(LOG_COLLECTION).doc();
  const logId = logRef.id;
  let call;
  try {
    const params = engine.buildRequest({
      pack: ctx.loaded.pack,
      kbText: ctx.loaded.kbText,
      registryText: ctx.loaded.registryText || undefined,
      mode: "warm",
      model: ctx.settings.model,
      effort: ctx.settings.effort,
      deepEffort: ctx.settings.deepEffort,
      fallbacks: true,
    });
    ctx.base.model = params.model;
    call = await callModel(getClient(), params, {deadline: modelDeadline(ctx.t0, "warm"), minAttemptMs: MIN_ATTEMPT_MS.warm});
  } catch (err) {
    const httpsErr = toHttpsError(err, "examCoachAnswer(warm)");
    const doc = {...ctx.base, ...failedCallFields(err), ...errorFields(httpsErr, err), totalMs: Date.now() - ctx.t0};
    await writeLog(logRef, doc);
    throw httpsErr;
  }
  const fields = callFields(call);
  await writeLog(logRef, {...ctx.base, status: "ok", ...fields, totalMs: Date.now() - ctx.t0});
  logger.info("examCoachAnswer: warm", {
    logId, examId: ctx.input.examId, packVersion: ctx.loaded.version, packWarm: ctx.packWarm, loadMs: ctx.loadMs,
    latencyMs: fields.latencyMs, usage: fields.usage, costUsd: fields.costUsd, appCheck: ctx.appCheck,
  });
  return {
    ok: true,
    mode: "warm",
    logId,
    examId: ctx.input.examId,
    packVersion: ctx.loaded.version,
    packWarm: ctx.packWarm,
    loadMs: ctx.loadMs,
    model: fields.servedBy,
    latencyMs: fields.latencyMs,
    cacheWrite: fields.usage.cacheWrite,
    cacheRead: fields.usage.cacheRead,
    costUsd: fields.costUsd,
  };
}

/**
 * Previous answer for a deep review: same owner, same exam, a completed answer or deep review.
 * @param {object} db Firestore
 * @param {{uid: string}} user allowed user
 * @param {string} examId exam id of the request
 * @param {string} previousLogId log id of the previous answer
 * @return {Promise<{ref: object, log: object}>} document reference and data
 */
async function loadPrevious(db, user, examId, previousLogId) {
  const ref = db.collection(LOG_COLLECTION).doc(previousLogId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Previous answer not found.");
  const log = snap.data();
  if (log.uid !== user.uid) throw new HttpsError("permission-denied", "That answer belongs to another user.");
  if (log.examId !== examId) throw invalid("The previous answer is for another exam.");
  if (log.mode === "warm" || log.status !== "ok") {
    throw new HttpsError("failed-precondition", "That request has no answer to review: send the photo again.");
  }
  return {ref, log};
}

/**
 * Stored deep review of a previous answer, if one was completed (idempotent "Deep review" button).
 * @param {object} db Firestore
 * @param {{uid: string}} user allowed user
 * @param {object} previousLog previous log document
 * @return {Promise<object|null>} reply for the page, or null if there is none
 */
async function storedDeep(db, user, previousLog) {
  const deepLogId = previousLog.deepLogId;
  if (typeof deepLogId !== "string" || !LOG_ID_RE.test(deepLogId)) return null;
  try {
    const snap = await db.collection(LOG_COLLECTION).doc(deepLogId).get();
    if (!snap.exists) return null;
    const d = snap.data();
    if (d.uid !== user.uid || d.status !== "ok" || d.mode !== "deep") return null;
    return publicResult(deepLogId, d, true);
  } catch (err) {
    logger.warn("examCoachAnswer: stored deep review not readable", {deepLogId, ...describeError(err)});
    return null;
  }
}

/**
 * Answer or deep review of a photographed question.
 * @param {object} ctx request context (user, input, appCheck, loaded, settings, t0, base)
 * @return {Promise<object>} reply for the page
 */
async function answerQuestion(ctx) {
  const {user, input} = ctx;
  const db = getFirestore();

  let previous = null;
  if (input.previousLogId) {
    previous = await loadPrevious(db, user, input.examId, input.previousLogId);
    if (!input.force) {
      const stored = await storedDeep(db, user, previous.log);
      if (stored) {
        logger.info("examCoachAnswer: stored deep review returned", {logId: stored.logId, previousLogId: previous.ref.id});
        return stored;
      }
    }
  }

  const logRef = db.collection(LOG_COLLECTION).doc();
  const logId = logRef.id;
  let image = input.image;
  let photoWrite;
  if (image && previous && previous.log.photoPath && previous.log.photoHash === sha256(image.bytes)) {
    // Same photo as the answer under review: no second copy in the bucket.
    photoWrite = Promise.resolve(previous.log.photoPath);
  } else if (image) {
    // The photo is written in parallel with the model call; a failed or hanging write never blocks the answer.
    photoWrite = savePhoto(image, logId, user, input.examId);
  } else {
    const prevPath = previous.log.photoPath;
    if (!prevPath || !hasOwn(MEDIA_TYPES, previous.log.mediaType)) {
      throw new HttpsError("failed-precondition", "The photo of that answer is not available: send it again.");
    }
    try {
      const bytes = await downloadPhoto(prevPath);
      image = {mediaType: previous.log.mediaType, base64: bytes.toString("base64"), bytes};
    } catch (err) {
      logger.warn("examCoachAnswer: previous photo not readable", {previousLogId: input.previousLogId, ...describeError(err)});
      throw new HttpsError("failed-precondition",
          "The photo of that answer is no longer available (photos are kept for 30 days): send it again.");
    }
    photoWrite = Promise.resolve(prevPath);
  }

  const base = {
    ...ctx.base,
    previousLogId: input.previousLogId,
    mediaType: image.mediaType,
    photoHash: sha256(image.bytes),
    photoBytes: image.bytes.length,
  };
  const prevAnswer = previous ? {
    answers: Array.isArray(previous.log.answers) ? previous.log.answers : [],
    confidence: previous.log.confidence || null,
    explanation: previous.log.explanation || "",
  } : undefined;

  let call;
  let result;
  try {
    const params = engine.buildRequest({
      pack: ctx.loaded.pack,
      kbText: ctx.loaded.kbText,
      registryText: ctx.loaded.registryText || undefined,
      image: {mediaType: image.mediaType, base64: image.base64},
      mode: input.mode,
      model: ctx.settings.model,
      effort: ctx.settings.effort,
      deepEffort: ctx.settings.deepEffort,
      previous: prevAnswer,
      fallbacks: true,
    });
    base.model = params.model;
    call = await callModel(getClient(), params, {
      deadline: modelDeadline(ctx.t0, input.mode), minAttemptMs: MIN_ATTEMPT_MS[input.mode],
    });
    result = readAnswer(call.message, ctx.loaded.pack);
  } catch (err) {
    const httpsErr = toHttpsError(err, `examCoachAnswer(${input.mode})`);
    // A failed call still leaves a trace (photo, cost), so the log never underestimates the spend.
    const doc = {...base, ...(await settlePhoto(photoWrite, logId)), ...errorFields(httpsErr, err)};
    Object.assign(doc, call ? callFields(call) : failedCallFields(err));
    doc.totalMs = Date.now() - ctx.t0;
    await writeLog(logRef, doc);
    throw httpsErr;
  }

  const doc = {...base, status: "ok", ...callFields(call)};
  for (const key of ANSWER_FIELDS) doc[key] = result[key] === undefined ? null : result[key];
  Object.assign(doc, await settlePhoto(photoWrite, logId));
  doc.totalMs = Date.now() - ctx.t0;
  await writeLog(logRef, doc);
  if (previous) {
    await previous.ref.update({deepLogId: logId}).catch((err) => {
      logger.warn("examCoachAnswer: previous answer not linked to its deep review", {logId, ...describeError(err)});
    });
  }
  logger.info(`examCoachAnswer: ${input.mode}`, {
    logId, examId: input.examId, packVersion: ctx.loaded.version, answers: result.answers,
    confidence: result.confidence, domain: result.domain, exactMatch: result.exactMatch, servedBy: doc.servedBy,
    fellBack: doc.fellBack, latencyMs: doc.latencyMs, attempts: doc.attempts, usage: doc.usage, costUsd: doc.costUsd,
    appCheck: ctx.appCheck,
  });
  return publicResult(logId, doc, false);
}

/**
 * examCoachAnswer: answer, deep review or warm-up (data.mode), see the file header.
 * @param {object} request callable request
 * @return {Promise<object>} reply for the page
 */
async function answer(request) {
  const t0 = Date.now();
  const user = requireUser(request);
  const input = parseAnswerData(request.data);
  const appCheck = appCheckState(request);
  const {pack: loaded, warm: packWarm, loadMs, stale} = await packOrThrow(input.examId);
  let settings;
  try {
    settings = productionSettings(loaded.pack);
  } catch (err) {
    throw toHttpsError(err, "examCoachAnswer");
  }
  const base = {
    uid: user.uid,
    email: user.email,
    examId: input.examId,
    packVersion: loaded.version,
    packConfig: settings.config,
    kbConfig: loaded.manifestConfig || null,
    packStale: Boolean(stale),
    mode: input.mode,
    model: engine.MODELS[settings.model].id,
    effort: settings.effort,
    deepEffort: input.mode === "deep" ? settings.deepEffort : null,
    previousLogId: null,
    appCheck,
    packWarm,
    loadMs,
    createdAt: FieldValue.serverTimestamp(),
    photoPath: null,
    flagged: false,
  };
  const ctx = {user, input, appCheck, loaded, settings, t0, packWarm, loadMs, base};
  if (input.mode === "warm") return warmUp(ctx);
  return answerQuestion(ctx);
}

/**
 * examCoachPhoto: the stored photo of an answer, to its owner only (for the list of flagged answers).
 * @param {object} request callable request ({logId})
 * @return {Promise<{logId: string, mediaType: string, base64: string}>} photo in base64
 */
async function photo(request) {
  const user = requireUser(request);
  const d = plainData(request.data);
  const logId = typeof d.logId === "string" ? d.logId.trim() : "";
  if (!LOG_ID_RE.test(logId)) throw invalid("logId is missing or not valid.");
  const snap = await getFirestore().collection(LOG_COLLECTION).doc(logId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Answer not found.");
  const log = snap.data();
  if (log.uid !== user.uid) throw new HttpsError("permission-denied", "That answer belongs to another user.");
  if (!log.photoPath || !hasOwn(MEDIA_TYPES, log.mediaType)) {
    throw new HttpsError("failed-precondition", "No photo for this answer.");
  }
  try {
    const bytes = await downloadPhoto(log.photoPath);
    logger.info("examCoachPhoto: photo", {logId, bytes: bytes.length, appCheck: appCheckState(request)});
    return {logId, mediaType: log.mediaType, base64: bytes.toString("base64")};
  } catch (err) {
    logger.warn("examCoachPhoto: photo not readable", {logId, ...describeError(err)});
    throw new HttpsError("failed-precondition", "The photo is no longer available (photos are kept for 30 days).");
  }
}

module.exports = {
  SECRET_NAME, anthropicKey, ALLOWED_EMAILS, LOG_COLLECTION, FUNCTION_TIMEOUT_S, PAGE_TIMEOUT_MS, MODEL_BUDGET_MS,
  HANDLER_MARGIN_MS, PHOTO_WAIT_MS,
  answer, photo, appCheckState,
  // Helpers exported for unit tests (no network calls).
  setClient, requireUser, parseAnswerData, parseImage, productionSettings, usageOf, iterationsOf, costOf, servedByOf,
  isRetryable, callModel, readAnswer, toHttpsError, publicResult, callFields, settlePhoto, modelDeadline,
  ModelDeadlineError, AnswerError, ModelCallError, PackConfigError,
};
