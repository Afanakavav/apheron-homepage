# Exam Coach

Private mobile page (`apheron.io/exam-coach/<examId>/`, first exam `aigp`, `noindex`) for studying with practice
tests: photograph one question, the callable answers with the option letters, a short explanation, sources and a
confidence level; a deep review on request or automatically when the confidence is low.
Vanilla JS (ES modules), no build. This file is not deployed (`**/*.md` is ignored by hosting).

The page holds no exam content: only the exam's display name (`core.js`, `EXAMS`). The knowledge base lives in the
private bucket and is read by the functions (`functions/exam-coach/`).

## Files
- `index.html` — sign-in and coach views, settings sheet (`<dialog>`), PWA meta for iPhone. Absolute asset paths:
  the page is served at `/exam-coach/<examId>/` through the `firebase.json` rewrites.
- `boot.js` — runs without Firebase: exam name in the title and views, `/exam-coach/` → `/exam-coach/aigp/`.
- `app.js` — glue: Firebase auth, App Check gate, callables `examCoachAnswer` (modes `warm`, `answer`, `deep`) and
  `examCoachPhoto` in `europe-west1`, the `flagged` mark on `examCoachLog` documents (the only field
  `firestore.rules` lets the page change), settings in `localStorage` (`exam-coach:settings`).
- `core.js` — pure helpers: exam from the path, settings, warm-up timing (`exam-coach:last-active`), request ids
  and cut connections.
- `image.js` — photo compression: long edge at most 2576 px, JPEG 0.85, EXIF orientation, byte cap 3.5 MB.
- `ui.js` — pure rendering (no Firebase): answer card, deep review, doubtful list, English error messages.
- `styles.css`, `manifest.json` (start_url and scope `/exam-coach/aigp/`), icons.

Cache: `firebase.json` serves `/exam-coach/**` with `no-cache`; the `?v=N` on the assets is kept anyway for the iOS
home-screen app: raise it when a file changes. `/firebase-config.js?v=2` is shared with other pages: never edit it.

## Prompt cache warm-up
The knowledge base is cached for 1 hour and every answer renews it. The page calls `mode: "warm"` after sign-in and
when it becomes visible again, only if no warm-up, answer or deep review sent in the last 55 minutes succeeded (the
time the successful call was sent, kept in `localStorage`, so a reload does not warm again). Never on a timer, and
never while an answer, a deep review or another warm-up is running (that call renews the cache). A photo taken during
the warm-up waits for it, so the cache is not written twice. A failed warm-up is retried once, 3 to 5 seconds later,
except for errors a retry cannot fix (`permission-denied`, `unauthenticated`, `failed-precondition`,
`resource-exhausted`, `invalid-argument`, `not-found`). Signed in and `unauthenticated` means the App Check token was
refused: the page says "Security check failed: reload the page", not "sign in again".

Client timeouts: answer 180 s; warm-up and deep review 560 s (the function's timeout is 540 s). The knowledge base
version in the settings comes from the last reply (`packVersion`).

## Cut connections
iOS Safari drops a request that receives nothing for about 60 s, and a deep review at effort max takes 1-3 minutes;
locking the phone or switching app cuts the call too. The function goes on and stores its result anyway, so every
`examCoachAnswer` call carries a `requestId` (`core.js`, `newRequestId`), which the function uses as the id of the
log document (created as `running` before the model call). When a call fails without the function's own message
(`isCutConnection`: the SDK's bare `internal`, `unavailable` or `deadline-exceeded`), `app.js` (`callCoach`) listens
to `examCoachLog/<requestId>` instead: it shows the result (`ok`) or its error (`error`); it gives up with the call's
own error if the document does not appear within 30 s of the call (8 s after the failure at least), and with
`deadline-exceeded` at the end of the call's time. Meanwhile the waiting row says "Still reviewing…" or "Connection
lost, waiting for the answer…".

## Use on iPhone
Safari → `apheron.io/exam-coach/aigp/` → Share → **Add to Home Screen**. "Take photo" opens the camera, "Choose from
library" the photo roll. Settings (gear): automatic deep review when the confidence is low, sign out.

## Local test
```
npx serve public -l 5001
```
`npx serve` has no rewrites: open `http://localhost:5001/exam-coach/` (it moves to `/exam-coach/aigp/` in the
address bar; a reload there gives 404 locally only). Sign-in needs `public/config.local.js` and the authorized
account. Automatic test, no network and no Firebase (the SDK is mocked):
`npx playwright test e2e/exam-coach.spec.js --reporter=line`.
