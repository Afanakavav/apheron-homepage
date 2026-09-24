# RUNBOOK — apheron.io (L'Edizione)

Procedure operative per il direttore. Tempi reali: 2–10 minuti l'una.

## Aggiungere un capitolo (nuovo sito)
1. Copia la cartella del nuovo sito in `public/<nome>/` (con il suo `index.html`).
2. In `firebase.json` (target `apheron-homepage`) aggiungi le due rewrite:
   `{"source": "/<nome>", "destination": "/<nome>/index.html"}` e idem con `/<nome>/**`.
   Se il sito ha JS/CSS che cambieranno, aggiungi anche una regola no-cache **in fondo**
   alla lista `headers` (vedi quella di `fun-friday`): se due regole combaciano vince
   l'ultima, e quelle generiche da un anno per `**/*.js` e `**/*.css` stanno prima.
3. In `public/index.html` copia una voce normale (es. la 01: `<a href>`, `voce__desc` >
   `voce__inner` > `p` + `voce__foto`), mettila nella sezione giusta, metti `href` e chiavi
   `eN.*`. I numeri visibili (`voce__num`) seguono l'ordine della pagina: se la inserisci in
   mezzo, fai scalare quelli dopo (le chiavi `eN` restano uguali). Aggiorna il numero della
   voce fantasma.
4. In `public/translations.js` aggiungi le chiavi `eN.title/meta/desc` in EN e IT
   (e aggiorna i contatori `secX.count` e `ghost.meta`). Poi alza il `?v=` di
   `translations.js` in `index.html`, così chi ha la copia vecchia in cache prende la nuova.
5. Anteprima: screenshot 960×600 in `public/anteprime/<nome>.jpg` (sotto ~60 KB; il
   bicromo lo fa il CSS). Le immagini hanno un anno di cache: per cambiarla usa un nome nuovo.
6. `firebase deploy --only hosting:apheron-homepage`

## Rendere PRIVATO un sito (stato «Edizione riservata»)
Protezione vera (dopo la Fase 4 Cloudflare):
1. Dashboard Cloudflare → Zero Trust → Access → Applications → Add self-hosted.
2. Dominio `apheron.io`, path `<nome>/*`. Policy: Allow → Emails → `fra.perone@alice.it`.
3. Sessione: 1 mese. Salva. (~2 minuti, effetto immediato, zero deploy.)

Aspetto nell'indice (facoltativo ma elegante):
4. In `public/index.html` sulla `<li class="voce">` aggiungi `voce--riservata`,
   sostituisci `<a href=…>` con `<div class="voce__corpo">` (guarda la voce 08 come esempio),
   e la freccia con `<span class="asterisco">✳</span>`; meta → chiave `eN.meta` = "Reserved edition"/"Edizione riservata".
5. `firebase deploy --only hosting:apheron-homepage`

Per farlo TORNARE pubblico: elimina (o metti in pausa) l'app Access e inverti il punto 4.

⚠️ Limite noto: `apheron-homepage.web.app` bypassa Cloudflare. Per contenuti davvero
sensibili il singolo sito va spostato su Cloudflare Pages (nome progetto casuale + Access).

## Aggiornare la riga «Now» del colophon (3–4 volte l'anno)
In `public/translations.js`: chiavi `colophon.now.label` e `colophon.now` (EN e IT).
Aggiorna anche la data nel label. Poi deploy.

## Wheel of Facts (FUN Friday) — `/fun-friday`
Checklist del giorno e prove in locale: `public/fun-friday/README.md`.
I fun fact dei colleghi stanno SOLO nel localStorage del browser (Export/Import JSON in
Control → Settings & data): mai nel codice né nel repo (i backup sono in `.gitignore`).

## Cose da NON toccare
- `public/config.local.js` e `public/firebase-config.js`: **albania-trip li importa dalla
  radice** (`/firebase-config.js` negli import ES di app.js e itinerary-view.js).
- Il redirect 301 `/studioprofessionalebiancalani` → studiobiancalani.it in `firebase.json`
  e tutto il target hosting `studio` (fonte di verità: repo `studiobiancalani-website`).
- `public/sw.js` è un kill-switch della vecchia PWA: lasciarlo online fino a ~fine 2026.

## Deploy
Solo hub e sotto-siti: `firebase deploy --only hosting:apheron-homepage`
(mai `--only hosting` da solo: toccherebbe anche il target `studio` di Biancalani).
