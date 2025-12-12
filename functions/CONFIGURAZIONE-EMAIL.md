# 📧 Configurazione Email per Firebase Function

Questa guida ti aiuterà a configurare le credenziali Gmail per la Firebase Function che invia le email.

## ⚠️ IMPORTANTE: App Password di Gmail

Per usare Nodemailer con Gmail, **NON puoi usare la password normale** del tuo account Gmail. Devi creare una **"App Password"** (Password per app).

---

## 📋 Passo 1: Abilitare la Verifica in Due Passaggi

1. **Vai su:** https://myaccount.google.com/security
2. **Accedi** con il tuo account Google (carlottataiti@gmail.com)
3. **Cerca "Verifica in due passaggi"** (2-Step Verification)
4. **Clicca su "Verifica in due passaggi"**
5. **Segui le istruzioni** per abilitarla
   - Ti verrà chiesto di inserire il numero di telefono
   - Riceverai un codice via SMS
   - Inserisci il codice per completare l'attivazione

**⚠️ Nota:** La verifica in due passaggi è **obbligatoria** per creare App Password.

---

## 📋 Passo 2: Creare l'App Password

1. **Torna su:** https://myaccount.google.com/security
2. **Cerca "Password per app"** (App passwords)
   - Se non la vedi, assicurati che la verifica in due passaggi sia attiva
3. **Clicca su "Password per app"**
4. **Seleziona l'app:** scegli "Altro (nome personalizzato)"
5. **Inserisci un nome:** ad esempio "Firebase Function Email"
6. **Clicca "Genera"**
7. **COPIA LA PASSWORD GENERATA** (16 caratteri, tipo: `abcd efgh ijkl mnop`)
   - ⚠️ **IMPORTANTE:** Questa password apparirà solo una volta! Copiala subito!
   - Rimuovi gli spazi: `abcdefghijklmnop`

---

## 📋 Passo 3: Configurare le Credenziali in Firebase

Ora devi inserire le credenziali nella configurazione di Firebase Functions.

### Opzione A: Usando il Terminale (Consigliato)

1. **Apri il terminale** nella cartella del progetto:
   ```bash
   cd C:\Users\frape\apheron-homepage
   ```

2. **Configura l'email utente:**
   ```bash
   firebase functions:config:set email.user="carlottataiti@gmail.com"
   ```

3. **Configura l'App Password:**
   ```bash
   firebase functions:config:set email.password="LA_TUA_APP_PASSWORD_QUI"
   ```
   - Sostituisci `LA_TUA_APP_PASSWORD_QUI` con la password di 16 caratteri che hai copiato (senza spazi)

4. **Verifica la configurazione:**
   ```bash
   firebase functions:config:get
   ```
   - Dovresti vedere `email.user` e `email.password`

### Opzione B: Usando Firebase Console (Alternativa)

1. Vai su: https://console.firebase.google.com/
2. Seleziona il progetto "studio-legale-taiti"
3. Vai su "Functions" > "Config"
4. Aggiungi le variabili:
   - `email.user` = `carlottataiti@gmail.com`
   - `email.password` = `LA_TUA_APP_PASSWORD_QUI`

---

## ✅ Verifica

Dopo aver configurato le credenziali, puoi testare la function:

1. **Deploy della function:**
   ```bash
   cd C:\Users\frape\apheron-homepage
   firebase deploy --only functions
   ```

2. **Testa il form** sul sito web
3. **Controlla la tua email** (carlottataiti@gmail.com)

---

## 🔒 Sicurezza

- ⚠️ **NON condividere mai** l'App Password
- ⚠️ **NON committare** le credenziali nel codice (sono già salvate in Firebase Config)
- ✅ L'App Password può essere revocata in qualsiasi momento da Google Account

---

## 🆘 Problemi Comuni

### "Invalid login" o "Authentication failed"
- Verifica di aver usato l'App Password, non la password normale
- Assicurati di aver rimosso gli spazi dalla password
- Verifica che la verifica in due passaggi sia attiva

### "App passwords not available"
- La verifica in due passaggi deve essere attiva
- Se usi un account Google Workspace, potrebbe essere disabilitata dall'amministratore

### La function non trova le credenziali
- Verifica di aver fatto il deploy dopo aver configurato le credenziali
- Controlla con: `firebase functions:config:get`

---

**Quando hai completato questi passaggi, dimmi e procediamo con il deploy!** 🚀

