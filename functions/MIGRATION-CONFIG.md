# Migrazione a Secret Manager

Le credenziali email sono ora in **Google Secret Manager** invece di `.env` o `functions.config()`.

## Configurazione (una tantum)

1. **Imposta i secret** nella cartella del progetto:
   ```bash
   cd apheron-homepage
   firebase functions:secrets:set EMAIL_USER   # Inserire email Gmail quando richiesto
   firebase functions:secrets:set EMAIL_PASS   # Inserire password app Gmail quando richiesto
   ```

2. **Deploy**:
   ```bash
   firebase deploy --only functions
   ```

## Test locale (emulatore)

Per testare in locale, creare `functions/.secret.local` con:
```
EMAIL_USER=tua-email@gmail.com
EMAIL_PASS=tua-password-app
```
**Non committare** `.secret.local` (è già in .gitignore).

## Comandi utili

```bash
# Visualizzare i secret configurati
firebase functions:secrets:access EMAIL_USER

# Aggiornare un secret (poi rideploy)
firebase functions:secrets:set EMAIL_PASS
```
