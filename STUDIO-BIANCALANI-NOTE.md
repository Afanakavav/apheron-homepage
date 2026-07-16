# Studio Professionale Biancalani – Note e riepilogo

## Sito live
- **https://www.studiobiancalani.it** (e https://studiobiancalani.it → redirect a www)
- Hosting: Firebase (site `studioprofessionalebiancalani`)

## Dove si modificano i contenuti
- **Fonte di verità:** `studiobiancalani-website/` (repo git, allineata alla versione live a luglio 2026)
  - Dati (professionisti, servizi, link, PEC, ecc.): `js/data.js`
  - Testi e struttura: `index.html`, `css/styles.css`
- **Cartella di deploy:** `apheron-homepage/public/studioprofessionalebiancalani/` (aggiornata da `AGGIORNA-SITO.bat`)

## Deploy (dopo modifiche)
1. Da `studiobiancalani-website`: eseguire `AGGIORNA-SITO.bat`
2. Dalla cartella **apheron-homepage** (entrambi i target, così anche apheron.io resta allineato):
```bash
firebase deploy --only "hosting:studio,hosting:apheron-homepage"
```
3. Commit in `studiobiancalani-website`

## Modifiche effettuate (log)
- **PEC Roberto Tosa:** sostituita con `roberto.tosa@pec.commercialisti.it` (prima: roberto.tosa@odcecprato.legalmail.it) – file `js/data.js`.
- **Privacy e Cookie (GDPR):** aggiunte pagine `privacy.html` e `cookie.html` (testi aggiornati per nuovo sito, hosting Firebase, titolari Paolo/Andrea/Francesco, cookie tecnici e terze parti; rimosso Privacy Shield, inserite clausole tipo). Footer aggiornato con link alle pagine. Aggiunta barra informativa cookie in home (solo cookie tecnici) con link a Cookie Policy e pulsante OK (preferenza in localStorage).
- **Luglio 2026 (4):** Rifiniture: hero con h1 sul nome dello studio (SEO, aspetto invariato); consenso cookie con scadenza 12 mesi (allineato alla policy); rimosse 2 foto duplicate inutilizzate; README esclusi dal deploy; header di sicurezza (nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy). Repo sorgente pushato su GitHub PRIVATO: https://github.com/Afanakavav/studioprofessionalebiancalani (era pubblico e fermo al 2° commit; reso privato via API e allineato).
- **Luglio 2026 (3):** Mappa "Dove Siamo" con query sul nome dello studio (scheda mostra "Studio Professionale Biancalani"). SEO: robots.txt, sitemap.xml, canonical su tutte le pagine, Open Graph/Twitter card, JSON-LD Schema.org AccountingService. Pagina 404.html personalizzata. Cache (firebase.json, target studio): font 1 anno, immagini/PDF 7 giorni, HTML must-revalidate. Link "Tribunale di Prato" non risponde ma si lascia così (problema loro, deciso dal cliente).
- **Luglio 2026 (2):** Font Google e Font Awesome ospitati in locale (css/fonts.css, css/fa/, css/webfonts/) — niente più richieste a terze parti per i font; cookie policy aggiornata (tolti font dalle terze parti, aggiunta Google Maps). Rimosso il base href con script di riscrittura (causava 404 fantasma in console dal preload scanner). Galleria ACB svuotata in data.js (le foto in images/acb/ non sono mai esistite, davano 404; voci commentate per ripristino). Redirect 301 da apheron.io/studioprofessionalebiancalani verso www.studiobiancalani.it in firebase.json (target apheron-homepage): il sito ora risponde solo sul dominio ufficiale.
- **Luglio 2026 (1):** "Chiara M." → "Dott.ssa Chiara M." (sezione Segreteria, index.html). Rimossi Firebase SDK, `firebase-config.js` (aveva ancora i placeholder) e script smooth-scroll da CDN: codice morto mai usato, il sito non cambia. Repo `studiobiancalani-website` riallineato alla versione live (cookie banner, pagine policy) e ripulito dai file di migrazione: ora è la fonte di verità.
- **Compliance privacy (marzo 2026):** (1) Privacy Policy: date marzo 2026; sezioni esplicite (Titolare, Quali dati, Perché, Base giuridica, Dove conservati, Quanto tempo, Diritti incluso reclamo Garante, Contatti per privacy). (2) Cookie Policy: date marzo 2026. (3) Note Legali: nuova pagina `note-legali.html` (denominazione, P.IVA, Cod.Fisc., USAL8PV, iscrizione Ordine Dottori Commercialisti Prato, contatti, utilizzo sito, link esterni). (4) Footer: Privacy Policy | Cookie Policy | Note Legali su tutte le pagine. (5) Banner cookie sostituito con **Accetta** | **Rifiuta** | **Preferenze** (link a cookie.html); scelta salvata in localStorage. Nota: sul sito non è presente un form contatti; in caso di aggiunta futura, inserire checkbox "Ho letto e accetto la Privacy Policy" con link.
