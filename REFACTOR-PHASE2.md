# Phase 2 — Refactor for Maintainability

## Ridondanze rimosse / refactor

### functions/

- **Codice duplicato:** I tre `throw new functions.https.HttpsError("invalid-argument", ...)` sono stati sostituiti dalla helper `throwValidationError(message)`. Stesso comportamento, un solo punto di modifica.
- **Dipendenze:** Nessuna rimossa; tutte usate (firebase-functions, firebase-admin, nodemailer).

### public/italian-lessons-dublin/

- **Codice morto:** Rimossa la variabile globale `selectedTimeSlot` (dichiarata ma mai letta).
- **Ridondanza analytics:** Le 6 chiamate ripetute a `gtag('event', ..., { event_category, event_label })` sono state unificate in una helper `trackEvent(category, eventName, label)` che usa `CONFIG.EVENTS` quando disponibile.
- **Dati duplicati:** Lo script usava valori hardcoded (WhatsApp `353894040077`, mappa `53.3455/-6.2435`, countdown 24h) ora sostituiti da `CONFIG.CONTACT.whatsapp`, `CONFIG.MAP_CENTER`, `CONFIG.OFFER.countdownHours`. Fallback ai valori precedenti se CONFIG non è disponibile (comportamento invariato).

### Non modificato

- **netlify.toml:** Lasciato (deploy attuale è Firebase; file può servire per altri ambienti).
- **File .md (COMMANDS, DEPLOY, ecc.):** Documentazione, non toccata.
- **test.html:** Mantenuto per test manuali.

## Comportamento

- Nessun cambiamento di UI/UX.
- Nessuna modifica alle API o al flusso utente.
- Lint in `functions/` invariato (passa).
