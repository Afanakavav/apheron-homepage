/* eslint-disable */
// Copied from the private exam-coach lab (engine/cost.js) by scripts/tools/sync-engine.js: edit it there.
"use strict";
/**
 * Cost of a Claude API call from its usage, with prompt-cache writes split by TTL.
 * Prices in USD per million tokens, from the claude-api skill (model table cached 2026-10-06, checked 2026-11-08):
 * cache writes cost 1.25x input for the 5-minute TTL and 2x for the 1-hour TTL; reads 0.05x on Opus 5.5 and
 * 0.025x on Fable 5.1. Batch requests are billed at half price.
 */

// claude-opus-4-8 and claude-opus-5 are the targets of the server-side refusal fallback ("default" mode).
const PRICES = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
};

/**
 * @param {string} model model id that served the call (message.model)
 * @param {object} usage message.usage
 * @param {{batch?:boolean}} [opts]
 * @return {{usd:number, parts:object, tokens:object}} total and breakdown in USD
 */
function callCost(model, usage, opts = {}) {
  const p = PRICES[model];
  if (!p) throw new Error(`No price for model ${model}`);
  const u = usage || {};
  const split = u.cache_creation || {};
  const write1h = split.ephemeral_1h_input_tokens || 0;
  const write5m = split.ephemeral_5m_input_tokens != null ? split.ephemeral_5m_input_tokens : Math.max(0, (u.cache_creation_input_tokens || 0) - write1h);
  const tokens = {
    input: u.input_tokens || 0,
    output: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    write5m,
    write1h,
  };
  const m = opts.batch ? 0.5 : 1;
  const parts = {
    input: (tokens.input * p.input * m) / 1e6,
    output: (tokens.output * p.output * m) / 1e6,
    cacheRead: (tokens.cacheRead * p.cacheRead * m) / 1e6,
    write5m: (tokens.write5m * p.input * 1.25 * m) / 1e6,
    write1h: (tokens.write1h * p.input * 2 * m) / 1e6,
  };
  return { usd: Object.values(parts).reduce((s, v) => s + v, 0), parts, tokens };
}

/**
 * Cost of a whole message. With server-side fallbacks, usage.iterations lists every attempt (the declined one on
 * the requested model and the fallback one) with its own model and tokens, while the top-level usage covers only
 * the attempt that produced the reply: each iteration is priced at its own model.
 * @param {object} message API response
 * @param {string} requestedModel model id sent in the request (iterations of the first attempt may carry no model)
 * @param {{batch?:boolean}} [opts]
 * @return {{usd:number, iterations:number, byModel:Object<string,number>}}
 */
function messageCost(message, requestedModel, opts = {}) {
  const its = message && message.usage && Array.isArray(message.usage.iterations) ? message.usage.iterations : [];
  if (!its.length) {
    const c = callCost(message.model || requestedModel, message.usage, opts);
    return { usd: c.usd, iterations: 1, byModel: { [message.model || requestedModel]: c.usd } };
  }
  const byModel = {};
  let usd = 0;
  for (const it of its) {
    const model = it.model || (it.type === "fallback_message" ? message.model : requestedModel);
    const c = callCost(model, it, opts).usd;
    byModel[model] = (byModel[model] || 0) + c;
    usd += c;
  }
  return { usd, iterations: its.length, byModel };
}

module.exports = { PRICES, callCost, messageCost };
