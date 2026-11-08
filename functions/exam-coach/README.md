# Exam Coach functions

Callables of the generic Exam Coach engine: one engine, one knowledge pack per exam. This folder holds only generic
code. The packs (knowledge base, question registry), the photos and the logs live in private storage. No exam
material may ever be added to this repository.

| File | Role |
|---|---|
| `coach.js` | handlers of `examCoachAnswer` and `examCoachPhoto` |
| `kb.js` | loads the packs from the private bucket and keeps them in memory per instance |
| `engine/prompt.js`, `engine/cost.js` | request builder, answer parser, cost; **copied from the private lab** by its `scripts/tools/sync-engine.js` (they start with `/* eslint-disable */`). Never edit them here: edit them in the lab and sync again |

Exports are in `../index.js` (region `europe-west1`, Node 22, firebase-functions v2 `onCall`, `enforceAppCheck: true`).

## Callables

### `examCoachAnswer` (1 GiB, 540 s timeout, secret `EXAM_COACH_ANTHROPIC_KEY`)

Request `data`:

| Field | Type | Notes |
|---|---|---|
| `examId` | string | one of `kb.ALLOWED_EXAMS` |
| `mode` | `"answer"` \| `"deep"` \| `"warm"` | default `"answer"` |
| `image` | `{mediaType, base64}` | JPEG, PNG or WebP, plain base64 (no `data:` prefix), at most 5 MiB of base64. Required for `answer`; for `deep` optional when `previousLogId` is given; ignored for `warm` |
| `previousLogId` | string | `deep` only: the answer to review; its answer is passed to the model as "previous" and its photo is reused when no `image` is sent |
| `force` | boolean | `deep` only: run again even if this answer already has a stored deep review |

Modes:

- **answer**: one streamed call with the production settings of the pack. The photo is written to the bucket in
  parallel; after the model call the reply waits for it at most 5 s (`PHOTO_WAIT_MS`). A failed or hanging write
  never blocks the answer: the log then has `photoPath: null` (and `photoTimedOut: true` when the write was still
  running; it goes on in the background, and the object carries its `logId` in its metadata).
- **deep**: same request and same cached prefix, with the effort raised per message (`production.deepEffort`) and a
  longer explanation. With `previousLogId`, a completed deep review is stored on the previous answer
  (`deepLogId`) and returned again (`cached: true`) on a second tap unless `force` is true.
- **warm**: same cached prefix without a photo and with `max_tokens` 16, to write or refresh the 1-hour prompt cache;
  it also loads the pack on this instance. Call it once when a study session opens, not on every page focus: a warm on
  a cold cache pays the full 1-hour cache write, a warm on a warm cache pays a cache read. Every answer and deep
  review also refreshes the 1-hour TTL.

Reply of `answer` and `deep`:

```
{logId, examId, mode, packVersion, previousLogId,
 questionStem, requiredCount, answers, answerTexts, textsPaired, explanation, citations, confidence, domain,
 matches, exactMatch, conflictNote, readIssue,
 model, servedBy, fellBack, effort, latencyMs, costUsd, cacheRead, cacheWrite, cached}
```

`servedBy` differs from `model` and `fellBack` is true when the server-side refusal fallback answered. `answers` and
`answerTexts` are sorted as pairs by the engine's `parseAnswer`; `textsPaired` is false when the model gave a
different number of texts than letters (the texts are then as given; null on logs written before this field).

Reply of `warm`: `{ok, mode, logId, examId, packVersion, packWarm, loadMs, model, latencyMs, cacheWrite, cacheRead, costUsd}`.

Errors are `HttpsError`s with short English messages; model errors carry `details.reason`:

| Code | `details.reason` | When |
|---|---|---|
| `unauthenticated` / `permission-denied` | | not signed in; not the allowed user; email not verified |
| `invalid-argument` | | bad input (no reason), or `bad-request`: the API rejected the request |
| `deadline-exceeded` | `timeout` | the model call went past its budget (see Timeouts) |
| `unavailable` | `overloaded` / `pack` | overload or server error after 2 retries on the same model; the pack could not be downloaded |
| `resource-exhausted` | `rate-limited` | API rate limit |
| `failed-precondition` | `refusal` / `pack` | the model declined; the pack's files are not valid (`kb.PackInvalidError`, for example `kb.md` built for another configuration than `production.config`) or its `production` block is invalid (also: photo of a previous answer no longer available) |
| `internal` | `truncated` / `unreadable` / `auth` / `model` / `api` / `internal` | other failures |

### Timeouts

| | answer | warm | deep |
|---|---:|---:|---:|
| Model budget, retries included (`MODEL_BUDGET_MS`) | 150 s | 240 s (a cold 1-hour cache write of up to ~480k tokens) | 480 s (max effort on a 311k-482k-token context) |
| No new attempt with less than (`MIN_ATTEMPT_MS`) | 30 s | 60 s | 120 s |
| Handler ends by (minus a 25 s margin for photo, log and reply) | page timeout, 180 s | function timeout, 540 s | function timeout, 540 s |
| **Page callable timeout** (`PAGE_TIMEOUT_MS`) | **180000 ms** | **560000 ms** | **560000 ms** |

The function timeout is 540 s (`FUNCTION_TIMEOUT_S`). The page must use 180 s for `answer` and 560 s for `warm` and
`deep` (longer than the function, so the page always receives the function's reply or its `timeout` error). An
`answer` deadline is also capped at 155 s from the start of the handler, under the page's 180 s. An aborted stream
is still billed, which is why the budgets are generous.

### `examCoachPhoto` (256 MiB, 30 s; page timeout 35 s)

`{logId}` -> `{logId, mediaType, base64}`, owner only. Deep reviews that reused a photo point to the original file.

## Model calls

- Request built by `engine.buildRequest` with the pack's `production` settings (`pack.json`:
  `"production": {"config", "model", "effort", "deepEffort"}`). The block is **required at publish time**; if it is
  missing, the function logs a warning once per loaded pack version and uses the defaults `opus`, `high`, `max`
  (`config` null). An invalid block fails with `failed-precondition` instead of silently changing model.
- `client.beta.messages.stream(params, {timeout}).finalMessage()`. The SDK timeout only bounds the wait for the
  response headers of a streamed request, so an overall deadline aborts the stream.
- Retries: the SDK client has `maxRetries: 0`; `coach.js` retries the **same model** up to 2 times (waits 2 s and 6 s)
  on 529/5xx, on an `overloaded_error` or `api_error` event mid-stream and on connection errors other than timeouts,
  and only while the remaining budget allows a full attempt. There is no switch to another model: it would have no
  cache. Refusals are handled by the server-side fallback that the engine puts in the request.
- Refusal, truncation and invalid JSON are detected from `stop_reason` before `engine.parseAnswer`; `parseAnswer`
  is never called for a warm-up.
- Cost: `engine/cost.js` `messageCost(message, params.model)`. With a server-side fallback, `usage.iterations` lists
  every attempt (the declined one on the requested model and the fallback one) and is the source of truth for
  billing, while the top-level `usage` covers only the attempt that produced the reply: `messageCost` prices each
  iteration at its own model, so the declined attempt is counted. A compact copy of `usage.iterations` is logged
  (`iterations`). Failed attempts log their partial usage and an estimated cost (`failedAttempts`, `failedCostUsd`).
- SDK: `@anthropic-ai/sdk` 0.135.0, which sends `anthropic-version: 2023-06-01`. The API version 2026-10-21 changes
  (sampling parameters `temperature`/`top_p`/`top_k` rejected, `document` blocks in assistant turns, `citations` on
  user text, Admin and Analytics API fields) touch nothing these requests send, so the SDK stays on 0.135.0 for now;
  moving to 2026-10-21 later is an SDK upgrade with no request changes.

## Firestore `examCoachLog/<logId>`

One document per call, warm-ups and failed calls included (cache writes are the main cost).

| Field | Notes |
|---|---|
| `uid`, `email`, `examId`, `packVersion`, `packConfig`, `kbConfig`, `packStale`, `packWarm`, `loadMs` | who and which pack; `packConfig` is `production.config`, `kbConfig` the configuration in `manifest.json` (null without one) |
| `mode`, `model`, `effort`, `deepEffort`, `previousLogId`, `deepLogId` | request; `deepLogId` is set on an answer once it has a deep review |
| `servedBy`, `fellBack`, `stopReason`, `messageId` | response |
| answer fields | `questionStem` ... `readIssue` (with `textsPaired`), as in the reply (not on warm-ups) |
| `usage` | `{input, output, cacheRead, cacheWrite, cacheWrite5m, cacheWrite1h}` of the attempt that produced the reply |
| `iterations` | null, or one entry per attempt `{type, model, input, output, cacheRead, cacheWrite5m, cacheWrite1h}` (`type` `fallback_message` for the fallback; `model` as sent by the API, may be null) |
| `costUsd`, `costByModel` | cost of every iteration, in total and per model |
| `failedCostUsd`, `attempts`, `failedAttempts` | retries: each failed attempt has its error, partial `usage`, `iterations` and `costUsd` |
| `latencyMs`, `totalMs` | model call, whole handler |
| `photoPath`, `photoTimedOut`, `mediaType`, `photoHash`, `photoBytes` | photo (`photos/<logId>.<ext>` in the bucket); `photoTimedOut` true when the reply did not wait for the write |
| `appCheck`, `createdAt`, `status`, `error`, `flagged`, `test` | `status` is `ok` or `error`; `flagged` is the only field the page may change (`firestore.rules`); `test` only in the emulator |

## Private bucket `gs://apheron-homepage-exam-coach`

```
packs/<examId>/current.json             {"version": "<version>", "updatedAt": "<ISO date>"}
packs/<examId>/<version>/pack.json      pack configuration; "id" must equal <examId>; "production" required
packs/<examId>/<version>/kb.md          knowledge base of the production context configuration
packs/<examId>/<version>/manifest.json  optional: the lab's build manifest of that kb.md (build/<pack>/kb/<config>/)
packs/<examId>/<version>/registry.txt   optional compact registry
photos/<logId>.<jpg|png|webp>           question photos (custom metadata logId, uid, examId)
```

`current.json` is read on every call, so publishing a new version needs no redeploy. A version that cannot be loaded
never replaces the one in memory (`packStale` in the log), and is not downloaded again for 60 s
(`kb.FAILURE_MEMO_MS`, per exam and version): meanwhile the version in memory is served, or, on an instance without
one, the same error is returned at once.

When `manifest.json` is present, the load fails with `kb.PackInvalidError` (reply `failed-precondition`, reason
`pack`) unless: `manifest.pack` equals the exam id, `manifest.sha256` is the SHA-256 of `kb.md` exactly as uploaded,
and `manifest.config` equals `pack.production.config` (when `production.config` is set). Publish `kb.md` and its
`manifest.json` from the same `build/<pack>/kb/<config>/` folder, byte for byte.

## Setup before the first deploy (owner)

1. Bucket in `europe-west1` with uniform bucket-level access, public access prevention and a lifecycle rule that
   deletes `photos/` after 30 days; the functions' runtime service account needs `roles/storage.objectAdmin` on it.
2. Secret: `firebase functions:secrets:set EXAM_COACH_ANTHROPIC_KEY --project apheron-homepage` (the deploy grants
   the runtime service account access to it). The name is `SECRET_NAME` in `coach.js`.
3. The allowed account must have a verified email (`emailVerified` in Firebase Auth), otherwise every call and every
   read of `examCoachLog` is refused. **Open:** the owner's account (email/password, sign-up disabled) currently has
   `emailVerified: false`. Either the account's email gets verified, or the owner approves removing the
   `email_verified` check from `coach.js` (`requireUser`) and from the `examCoachLog` block of `firestore.rules`,
   leaving the email allowlist as in Data Coach v1 (which then relies on sign-up staying disabled and on no other
   sign-in provider being enabled).
4. The page must initialize App Check (reCAPTCHA Enterprise provider) before calling: both callables enforce it.
   A production smoke test without the page must send an `X-Firebase-AppCheck` token, for example one minted with the
   Admin SDK (`getAppCheck().createToken(appId)`), next to the ID token.
5. The page's callable timeouts: 180000 ms for `answer`, 560000 ms for `warm` and `deep`, 35000 ms for the photo.
6. Deploy (only with the owner's approval):
   `FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions:examCoachAnswer,functions:examCoachPhoto --project apheron-homepage --non-interactive`
   and `firebase deploy --only firestore:rules --project apheron-homepage`.
