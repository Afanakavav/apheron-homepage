# 🚀 Guida Passo-Passo Completa - Configurazione Sito Avvocato Taiti

Questa guida ti accompagnerà passo dopo passo nella configurazione del sito, anche se non hai mai usato questi strumenti prima.

---

## 📋 INDICE DEI PASSAGGI

1. [PASSO 1: Creare un progetto Firebase](#passo-1-creare-un-progetto-firebase)
2. [PASSO 2: Ottenere le credenziali Firebase](#passo-2-ottenere-le-credenziali-firebase)
3. [PASSO 3: Configurare Firestore Database](#passo-3-configurare-firestore-database)
4. [PASSO 4: Configurare Google reCAPTCHA](#passo-4-configurare-google-recaptcha)
5. [PASSO 5: Configurare Google Analytics](#passo-5-configurare-google-analytics)
6. [PASSO 6: Creare la Firebase Function per le email](#passo-6-creare-la-firebase-function-per-le-email)
7. [PASSO 7: Aggiungere le immagini](#passo-7-aggiungere-le-immagini)
8. [PASSO 8: Test finale](#passo-8-test-finale)

---

## PASSO 1: Creare un progetto Firebase

### Cosa faremo:
Creeremo un progetto Firebase che gestirà il database (dove salvare i messaggi del form) e le funzioni (per inviare le email).

### Istruzioni dettagliate:

1. **Apri il browser** e vai su: https://console.firebase.google.com/

2. **Accedi con il tuo account Google**
   - Se non hai un account Google, creane uno su https://accounts.google.com/signup

3. **Clicca su "Aggiungi progetto"** (o "Add project" se l'interfaccia è in inglese)
   - Si trova in alto a destra o al centro della pagina

4. **Nome del progetto:**
   - Inserisci un nome, ad esempio: `studio-legale-taiti` o `apheron-lawyer-site`
   - Clicca "Continua" (o "Continue")

5. **Google Analytics (opzionale):**
   - Puoi lasciare attivato (consigliato) o disattivarlo
   - Se lo lasci attivo, seleziona o crea un account Analytics
   - Clicca "Continua"

6. **Attendi la creazione del progetto** (30-60 secondi)
   - Quando vedi "Il tuo progetto è pronto", clicca "Continua"

7. **Sei nella dashboard del progetto!** ✅
   - Dovresti vedere una schermata con varie opzioni (Firestore, Functions, Hosting, ecc.)

### ✅ Verifica:
- Hai un progetto Firebase attivo
- Sei nella dashboard del progetto

**👉 Quando hai completato questo passo, dimmi e passiamo al successivo!**

---

## PASSO 2: Ottenere le credenziali Firebase

### Cosa faremo:
Prenderemo le "chiavi" di accesso al progetto Firebase e le inseriremo nel file di configurazione.

### Istruzioni dettagliate:

1. **Nella dashboard Firebase**, cerca l'icona ⚙️ (ingranaggio) in alto a sinistra
   - Clicca su "Impostazioni progetto" (o "Project settings")

2. **Scorri verso il basso** fino alla sezione "Le tue app" (o "Your apps")
   - Se non vedi app, clicca sull'icona `</>` (Web) o "Aggiungi app" > "Web"

3. **Se devi creare una nuova app Web:**
   - Clicca sull'icona `</>` (Web)
   - Inserisci un nome: `Studio Legale Taiti Website`
   - NON spuntare "Configura anche Firebase Hosting" (già configurato)
   - Clicca "Registra app"

4. **Ora vedrai una schermata con il codice di configurazione**
   - Dovresti vedere qualcosa come:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyC...",
     authDomain: "tuo-progetto.firebaseapp.com",
     projectId: "tuo-progetto",
     storageBucket: "tuo-progetto.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

5. **Copia questi valori** (uno alla volta, con attenzione)

6. **Apri il file** `apheron-homepage/public/studioavvocato/js/firebase-config.js`
   - Puoi aprirlo con qualsiasi editor di testo (Notepad, VS Code, ecc.)

7. **Sostituisci i valori** nelle righe 10-16:
   ```javascript
   const firebaseConfig = {
       apiKey: "INCOLLA_QUI_API_KEY",           // ← Incolla apiKey qui
       authDomain: "INCOLLA_QUI_AUTH_DOMAIN",   // ← Incolla authDomain qui
       projectId: "INCOLLA_QUI_PROJECT_ID",     // ← Incolla projectId qui
       storageBucket: "INCOLLA_QUI_STORAGE",     // ← Incolla storageBucket qui
       messagingSenderId: "INCOLLA_QUI_SENDER", // ← Incolla messagingSenderId qui
       appId: "INCOLLA_QUI_APP_ID"               // ← Incolla appId qui
   };
   ```

8. **Salva il file** (Ctrl+S o File > Salva)

### ⚠️ Attenzione:
- Mantieni le virgolette `"` intorno ai valori
- Non lasciare spazi extra
- Controlla di aver copiato tutto correttamente

### ✅ Verifica:
- Il file `firebase-config.js` contiene i valori reali (non più "YOUR_API_KEY", ecc.)

**👉 Quando hai completato questo passo, dimmi e passiamo al successivo!**

---

## PASSO 3: Configurare Firestore Database

### Cosa faremo:
Creeremo il database dove verranno salvati i messaggi del form di contatto.

### Istruzioni dettagliate:

1. **Nella dashboard Firebase**, clicca su "Firestore Database" nel menu a sinistra
   - Se non lo vedi, cerca "Firestore" nella lista

2. **Clicca su "Crea database"** (o "Create database")

3. **Modalità di sicurezza:**
   - Seleziona "Inizia in modalità test" (Start in test mode)
   - Clicca "Avanti" (Next)

4. **Scegli la posizione del database:**
   - Seleziona `europe-west` (Belgio) o `europe-southwest` (Belgio) per essere vicino all'Italia
   - Clicca "Abilita" (Enable)
   - Attendi 1-2 minuti per la creazione

5. **Ora sei nella schermata Firestore!**
   - Dovresti vedere una tabella vuota

6. **Crea la collection "leads":**
   - Clicca su "Inizia collection" (Start collection)
   - **Collection ID:** inserisci `leads` (minuscolo, senza spazi)
   - Clicca "Avanti"

7. **Aggiungi il primo campo (opzionale, solo per test):**
   - **Field name:** `test`
   - **Type:** string
   - **Value:** `test`
   - Clicca "Salva"
   - Poi elimina questo documento cliccando sui tre puntini e "Elimina"

8. **Configura le Security Rules:**
   - Clicca sulla tab "Regole" (Rules) in alto
   - Sostituisci il contenuto con:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /leads/{leadId} {
         // Funzione helper per validare email
         function isValidEmail(email) {
           return email.matches('.*@.*\\..*');
         }
         
         // Funzione helper per validare telefono (almeno 8 cifre)
         function isValidPhone(phone) {
           return phone is string && phone.size() >= 8 && phone.size() <= 20;
         }
         
         // Permetti creazione solo se i dati sono validi
         allow create: if request.resource.data.keys().hasAll(['nome', 'email', 'messaggio', 'privacy', 'timestamp', 'status', 'source'])
                       && request.resource.data.nome is string
                       && request.resource.data.nome.size() > 0
                       && request.resource.data.nome.size() <= 200
                       && request.resource.data.email is string
                       && isValidEmail(request.resource.data.email)
                       && request.resource.data.email.size() <= 200
                       && request.resource.data.messaggio is string
                       && request.resource.data.messaggio.size() > 0
                       && request.resource.data.messaggio.size() <= 5000
                       && request.resource.data.privacy is bool
                       && request.resource.data.privacy == true
                       && request.resource.data.status is string
                       && request.resource.data.status == 'new'
                       && request.resource.data.source is string
                       && request.resource.data.source == 'website_contact_form'
                       && (!('telefono' in request.resource.data) || isValidPhone(request.resource.data.telefono));
         
         // Solo utenti autenticati possono leggere/modificare
         allow read, update, delete: if request.auth != null;
       }
     }
   }
   ```
   - Clicca "Pubblica" (Publish)
   
   **Nota:** Queste regole sono più sicure perché:
   - Validano che tutti i campi obbligatori siano presenti
   - Verificano il formato email
   - Limitano la lunghezza dei campi per prevenire abusi
   - Richiedono che privacy sia accettata
   - Verificano che il telefono (se presente) sia valido

### ✅ Verifica:
- Hai creato la collection "leads" in Firestore
- Le regole di sicurezza sono pubblicate

**👉 Quando hai completato questo passo, dimmi e passiamo al successivo!**

---

## PASSO 4: Configurare Google reCAPTCHA

### Cosa faremo:
Configureremo reCAPTCHA per proteggere il form di contatto dallo spam.

### Istruzioni dettagliate:

1. **Apri il browser** e vai su: https://www.google.com/recaptcha/admin

2. **Accedi con il tuo account Google** (lo stesso di Firebase)

3. **Clicca su "+" (Aggiungi)** in alto a destra

4. **Compila il modulo:**
   - **Etichetta:** `Studio Legale Taiti Website`
   - **Tipo reCAPTCHA:** seleziona **reCAPTCHA v3**
   - **Domini:**
     - Aggiungi: `apheron.io`
     - Aggiungi: `localhost` (per test locali)
   - Spunta "Accetto i Termini di servizio"
   - Clicca "Invia"

5. **Ora vedrai due chiavi:**
   - **Chiave del sito** (Site Key) - questa la useremo nel sito
   - **Chiave segreta** (Secret Key) - questa la useremo nella Firebase Function (più avanti)
   - **COPIA LA CHIAVE DEL SITO** (Site Key) - è una stringa lunga tipo: `6Lc...`

6. **Apri il file** `apheron-homepage/public/studioavvocato/index.html`

7. **Cerca la riga ~30** che contiene:
   ```html
   <script src="https://www.google.com/recaptcha/api.js?render=YOUR_RECAPTCHA_SITE_KEY" async defer></script>
   ```
   - Sostituisci `YOUR_RECAPTCHA_SITE_KEY` con la tua Site Key (mantieni le virgolette)

8. **Apri il file** `apheron-homepage/public/studioavvocato/js/form-handler.js`

9. **Cerca la riga ~280** che contiene:
   ```javascript
   grecaptcha.execute('YOUR_RECAPTCHA_SITE_KEY', { action: 'submit_contact_form' })
   ```
   - Sostituisci `YOUR_RECAPTCHA_SITE_KEY` con la tua Site Key (mantieni le virgolette)

10. **Salva entrambi i file**

### ⚠️ Nota importante:
- Conserva anche la **Secret Key** - la useremo nel prossimo passo per la Firebase Function

### ✅ Verifica:
- Hai sostituito `YOUR_RECAPTCHA_SITE_KEY` in entrambi i file
- Hai salvato la Secret Key da qualche parte (la useremo dopo)

**👉 Quando hai completato questo passo, dimmi e passiamo al successivo!**

---

## PASSO 5: Configurare Google Analytics

### Cosa faremo:
Configureremo Google Analytics per tracciare le visite al sito.

### Istruzioni dettagliate:

1. **Vai su:** https://analytics.google.com/

2. **Accedi con il tuo account Google**

3. **Se non hai ancora un account Analytics:**
   - Clicca "Inizia a misurare" (Start measuring)
   - Inserisci un nome account (es: "Apheron Analytics")
   - Clicca "Avanti"
   - Configura le proprietà (nome: "Studio Legale Taiti")
   - Compila le informazioni aziendali
   - Clicca "Crea" e accetta i termini

4. **Se hai già un account:**
   - Clicca "Amministrazione" (Admin) in basso a sinistra
   - Clicca "Crea proprietà" (Create Property)

5. **Ottieni il Measurement ID:**
   - Vai su "Amministrazione" > "Flussi di dati" (Data Streams)
   - Clicca "Aggiungi flusso" (Add stream) > "Web"
   - Inserisci:
     - **Nome sito web:** Studio Legale Taiti
     - **URL del sito web:** https://apheron.io
   - Clicca "Crea flusso"
   - **COPIA IL MEASUREMENT ID** - è formato tipo: `G-XXXXXXXXXX`

6. **Apri il file** `apheron-homepage/public/studioavvocato/index.html`

7. **Cerca la riga ~60** che contiene:
   ```html
   <script async src="https://www.googletagmanager.com/gtag/js?id=YOUR_GA4_ID"></script>
   ```
   - Sostituisci `YOUR_GA4_ID` con il tuo Measurement ID

8. **Cerca la riga ~65** che contiene:
   ```javascript
   gtag('config', 'YOUR_GA4_ID', {
   ```
   - Sostituisci `YOUR_GA4_ID` con il tuo Measurement ID

9. **Salva il file**

### ✅ Verifica:
- Hai sostituito `YOUR_GA4_ID` in entrambe le posizioni nel file index.html

**👉 Quando hai completato questo passo, dimmi e passiamo al successivo!**

---

## PASSO 6: Creare la Firebase Function per le email

### Cosa faremo:
Creeremo una funzione che invierà automaticamente le email quando qualcuno compila il form.

### ⚠️ Questo è il passo più complesso. Ti guiderò passo dopo passo.

### Opzione A: Usare EmailJS (PIÙ SEMPLICE - Consigliato per iniziare)

#### 6A.1: Creare account EmailJS

1. **Vai su:** https://www.emailjs.com/
2. **Clicca "Sign Up"** e crea un account gratuito
3. **Verifica la tua email** (controlla la posta)

#### 6A.2: Configurare EmailJS

1. **Nella dashboard EmailJS**, vai su "Email Services"
2. **Clicca "Add New Service"**
3. **Scegli "Gmail"** (o il tuo provider email)
4. **Collega il tuo account Gmail** (carlottataiti@gmail.com)
5. **Copia il Service ID** (es: `service_xxxxx`)

6. **Vai su "Email Templates"**
7. **Clicca "Create New Template"**
8. **Configura il template:**
   - **Template Name:** Contact Form
   - **Subject:** Nuova richiesta consulenza - {{tipologia}}
   - **Content:**
   ```
   Nuova richiesta di consulenza ricevuta dal sito web.
   
   Nome: {{nome}}
   Email: {{email}}
   Telefono: {{telefono}}
   Tipologia: {{tipologia}}
   
   Messaggio:
   {{messaggio}}
   ```
   - **To Email:** carlottataiti@gmail.com
   - **From Name:** {{nome}}
   - **From Email:** {{email}}
9. **Salva il template** e copia il **Template ID** (es: `template_xxxxx`)

10. **Vai su "Account" > "General"**
11. **Copia la Public Key** (es: `xxxxx`)

#### 6A.3: Creare la Firebase Function

1. **Apri il terminale/command prompt** nella cartella del progetto:
   ```bash
   cd C:\Users\frape\apheron-homepage
   ```

2. **Installa Firebase CLI** (se non l'hai già fatto):
   ```bash
   npm install -g firebase-tools
   ```

3. **Login a Firebase:**
   ```bash
   firebase login
   ```
   - Si aprirà il browser per l'autenticazione

4. **Inizializza Functions** (se non già fatto):
   ```bash
   firebase init functions
   ```
   - Scegli JavaScript quando richiesto
   - Installa le dipendenze quando richiesto

5. **Apri il file** `functions/index.js` (o crealo se non esiste)

6. **Sostituisci il contenuto con:**
   ```javascript
   const functions = require('firebase-functions');
   const axios = require('axios');

   exports.sendContactEmail = functions.https.onCall(async (data, context) => {
     // Validazione base
     if (!data.nome || !data.email || !data.messaggio) {
       throw new functions.https.HttpsError(
         'invalid-argument',
         'Campi obbligatori mancanti'
       );
     }

     const emailjsConfig = {
       service_id: 'TUO_SERVICE_ID',        // ← Sostituisci
       template_id: 'TUO_TEMPLATE_ID',      // ← Sostituisci
       user_id: 'TUA_PUBLIC_KEY',           // ← Sostituisci
       template_params: {
         nome: data.nome,
         email: data.email,
         telefono: data.telefono || 'Non fornito',
         tipologia: data.tipologia || 'Generale',
         messaggio: data.messaggio
       }
     };

     try {
       const response = await axios.post(
         'https://api.emailjs.com/api/v1.0/email/send',
         emailjsConfig
       );
       return { success: true, messageId: response.data };
     } catch (error) {
       console.error('EmailJS error:', error.response?.data || error.message);
       throw new functions.https.HttpsError(
         'internal',
         'Errore nell\'invio dell\'email: ' + (error.response?.data?.text || error.message)
       );
     }
   });
   ```

7. **Sostituisci i valori:**
   - `TUO_SERVICE_ID` → Service ID di EmailJS
   - `TUO_TEMPLATE_ID` → Template ID di EmailJS
   - `TUA_PUBLIC_KEY` → Public Key di EmailJS

8. **Installa axios** (se non già installato):
   ```bash
   cd functions
   npm install axios
   cd ..
   ```

9. **Deploy della function:**
   ```bash
   firebase deploy --only functions
   ```
   - Attendi il completamento (2-5 minuti)

### ✅ Verifica:
- La function è stata deployata con successo
- Vedi un messaggio tipo: "Function URL: https://..."

**👉 Quando hai completato questo passo, dimmi e passiamo al successivo!**

---

## PASSO 7: Aggiungere le immagini

### Cosa faremo:
Aggiungeremo le immagini necessarie al sito (foto avvocato, logo, ecc.)

### Istruzioni dettagliate:

1. **Prepara le immagini:**
   - Foto professionale dell'avvocato (formato JPG o PNG)
   - Logo dello studio (opzionale)
   - Immagine per social media/Open Graph (1200x630px, opzionale)

2. **Rinomina e posiziona le immagini:**
   - Foto avvocato → `carlotta-taiti.jpg`
   - Mettila in: `apheron-homepage/public/studioavvocato/images/team/`

3. **Se hai altre immagini:**
   - Logo → `images/logo.png`
   - Open Graph → `images/og-image.jpg`

### ⚠️ Nota:
- Se non hai le immagini ora, il sito funzionerà comunque (mostrerà immagini mancanti)
- Puoi aggiungerle in qualsiasi momento

### ✅ Verifica:
- Almeno la foto dell'avvocato è nella cartella corretta

**👉 Quando hai completato questo passo, dimmi e passiamo al successivo!**

---

## PASSO 8: Test finale

### Cosa faremo:
Testeremo che tutto funzioni correttamente.

### Istruzioni dettagliate:

1. **Apri il file** `index.html` nel browser:
   - Vai su: `apheron-homepage/public/studioavvocato/index.html`
   - Clicca destro > "Apri con" > Browser

2. **Testa le funzionalità:**
   - ✅ Menu mobile (clicca l'icona hamburger)
   - ✅ FAQ (clicca sulle domande)
   - ✅ Smooth scroll (clicca sui link del menu)
   - ✅ Cookie consent (dovrebbe apparire in basso)

3. **Testa il form di contatto:**
   - Compila tutti i campi
   - Clicca "Invia richiesta"
   - Dovresti vedere un messaggio di successo
   - Controlla in Firestore se il documento è stato creato nella collection "leads"
   - Controlla la tua email (carlottataiti@gmail.com) per vedere se hai ricevuto la notifica

4. **Test su mobile:**
   - Apri il sito su un telefono o usa gli strumenti sviluppatore del browser (F12 > Toggle device toolbar)

### ✅ Verifica finale:
- [ ] Il sito si carica correttamente
- [ ] Il menu funziona
- [ ] Il form invia i dati
- [ ] I dati appaiono in Firestore
- [ ] Ricevi l'email di notifica
- [ ] Il sito è responsive (funziona su mobile)

---

## 🎉 COMPLETATO!

Se tutti i test sono passati, il sito è configurato e pronto!

### Prossimi passi opzionali:
- Aggiungere Google Maps embed (vedi SETUP.md)
- Configurare Calendly per le prenotazioni
- Personalizzare ulteriormente i colori/stili
- Aggiungere più contenuti nelle sezioni

---

## ❓ PROBLEMI COMUNI

### Il form non invia i dati
- Controlla la console del browser (F12 > Console) per errori
- Verifica che Firebase config sia corretto
- Controlla che Firestore sia attivo

### Non ricevo le email
- Verifica che la Firebase Function sia deployata
- Controlla i log di Firebase Functions nella console
- Verifica le credenziali EmailJS

### reCAPTCHA non funziona
- Verifica che la Site Key sia corretta in entrambi i file
- Controlla che il dominio sia autorizzato in reCAPTCHA

---

**Hai bisogno di aiuto? Dimmi a quale passo sei e ti aiuterò!** 🚀

