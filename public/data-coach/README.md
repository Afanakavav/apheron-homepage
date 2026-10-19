# Data Coach

Pagina mobile privata (`apheron.io/data-coach/`, `noindex`) per allenarsi: si fotografa una domanda e le
funzioni callable rispondono con le lettere, il ragionamento e, su richiesta, un approfondimento con citazioni.
Vanilla JS (ES modules), nessun build. Questo file non va online (`**/*.md` è ignorato nel deploy).

## File
- `index.html` — viste login e coach, foglio impostazioni (`<dialog>`), meta PWA per iPhone.
- `app.js` — collante: auth Firebase, callable `dataCoachPing` / `dataCoachAnswer` / `dataCoachDeep` (regione
  `europe-west1`), flag "dubbia" su Firestore, impostazioni in `localStorage` (`data-coach:settings`).
- `image.js` — compressione della foto (lato lungo 1568 px, JPEG 0.8, orientamento EXIF) in base64.
- `ui.js` — rendering puro (nessun Firebase): `renderResult`, `renderDeep`, `renderBusy`, `renderError`, formattatori
  e mappa degli errori in italiano.
- `styles.css`, `manifest.json`, icone (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`).

Cache: gli asset della pagina hanno `?v=N` in `index.html` e negli import di `app.js`: alzare il numero a ogni modifica.

## Uso su iPhone
Safari → `apheron.io/data-coach/` → Condividi → **Aggiungi alla schermata Home**. Si apre a schermo intero,
l'accesso resta memorizzato. "Fotografa la domanda" apre la fotocamera, "Scegli dalla galleria" il rullino.
In Impostazioni (ingranaggio): sforzo della risposta rapida (low/medium/high), approfondimento automatico quando
la confidenza è bassa, uscita.

## Prova in locale
```
npx serve public -l 5001
```
Apri `http://localhost:5001/data-coach/` (serve `public/config.local.js` per la configurazione Firebase; il login
funziona solo con l'account autorizzato dalle funzioni). Test automatico, senza rete né Firebase:
`npx playwright test e2e/data-coach.spec.js --reporter=line`.

Nel repo non ci sono dati d'esame, estratti dei manuali né chiavi: la base di conoscenza vive nel bucket privato.
