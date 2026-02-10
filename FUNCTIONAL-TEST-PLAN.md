# Functional Test Plan — apheron-homepage

## Inventario funzionalità (Italian Lessons Dublin)

### Pagina / route

- **URL:** `/italian-lessons-dublin/` (o `index.html` in locale).
- **Contenuto:** Single page con sezioni: Hero, Features, Quiz, Word of the Day, Mini Game, Contact (mappa), Special Offer, Modali (Booking, Video).

### Navigazione

- Link interni `a[href^="#"]`: smooth scroll (gestito da script.js su DOMContentLoaded).
- Nessun menu di navigazione multi-pagina; tutto on-page.

### Form

- **Booking (Request time):** Form `.custom-time-form` con campi Data, Ora, Messaggio; submit chiama `handleBookingRequest`, apre WhatsApp con messaggio compilato e chiude il modal.
- Nessun form di login o pagamento.

### Integrazioni

- **Google Analytics:** gtag (async) in head.
- **Google Maps:** Caricato in body se `GOOGLE_MAPS_API_KEY` è impostato; callback `initMap`; fallback messaggio se API non disponibile.
- **WhatsApp:** Link `wa.me` e apertura in nuova finestra da bottoni e dal submit del form.
- **Email:** Link `mailto:` in Contact.

### Elementi interattivi

- **Booking modal:** Apertura (pulsanti "Book Your Lesson", "Claim Your Free Lesson", "Book Your First Lesson"), chiusura (×, click outside, ESC).
- **Video modal:** Apertura (non presente un pulsante visibile nell’HTML fornito; potrebbe essere aggiunto da script o in altra sezione). Chiusura (×, ESC, click outside).
- **Quiz:** Tre opzioni; click su risposta corretta/errata → dopo 1s compare `#quizResult`.
- **Mini game:** Opzioni dinamiche (caricate da script); click su risposta corretta → `#gameResult` visibile.
- **Word of the Day:** Pulsante "New Word" → `getNewWord()` aggiorna parola.
- **Countdown:** Timer 24h (o da CONFIG) aggiornato ogni secondo.

---

## Copertura test automatici (E2E)

| Flusso | Test | Stato |
|--------|------|--------|
| Home carica | Titolo e H1 "Ciao Dublin!" presenti, sezione hero visibile | ✅ E2E |
| Sezioni principali | Features, Quiz, Contact, Special Offer presenti | ✅ E2E |
| Modal prenotazione | Apertura da "Book Your Lesson", modal visibile; chiusura con ESC, modal nascosto | ✅ E2E |
| Modal video | Apertura (se pulsante presente); chiusura con ESC | ✅ E2E (se UI ha pulsante) |
| Quiz | Click su opzione "Hello/Goodbye"; dopo attesa, risultato "Bravo!" visibile | ✅ E2E |
| Form booking | Form con date, time, message; submit non apre finestra (mock o check href) | ✅ E2E (verifica form e campi) |
| Link WhatsApp | Link "WhatsApp Me" con href che contiene wa.me | ✅ E2E |
| Countdown | Elementi ore/minuti/secondi presenti | ✅ E2E |

---

## Come eseguire i test

Dalla root del progetto (`apheron-homepage`):

```powershell
cd apheron-homepage
npm install
npx playwright install chromium
npm run test:e2e
```

- **Prima esecuzione:** `npx playwright install chromium` scarica il browser (una tantum).
- **Test disponibili:** `npm run test` è alias di `npm run test:e2e`.
- **UI / debug:** `npx playwright test --ui` oppure `npx playwright test --debug`.

Il server statico parte automaticamente (cartella `public/italian-lessons-dublin` sulla porta 5000) durante i test.
