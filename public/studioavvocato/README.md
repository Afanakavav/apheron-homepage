# Studio Legale Taiti - Website

Sito web professionale per l'Avvocato Carlotta Taiti, iscritta all'Ordine degli Avvocati di Prato.

## Struttura del Progetto

```
studioavvocato/
├── index.html              # Pagina principale (one-page scroll)
├── styles.css              # Stili CSS completi
├── script.js               # JavaScript principale (UI, navigazione, FAQ, search)
├── js/
│   ├── firebase-config.js  # Configurazione Firebase
│   └── form-handler.js     # Gestione form contatti e Firestore
├── images/
│   ├── team/               # Foto del team (placeholder: carlotta-taiti.jpg)
│   └── office/             # Foto dello studio
└── README.md               # Questo file
```

## Configurazione Richiesta

### 1. Firebase Configuration

Aprire `js/firebase-config.js` e sostituire i valori placeholder:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 2. Google reCAPTCHA v3

1. Ottenere una Site Key da [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Sostituire `YOUR_RECAPTCHA_SITE_KEY` in `index.html` (due occorrenze):
   - Nel tag `<script>` per il caricamento di reCAPTCHA
   - In `js/form-handler.js` nella funzione `getRecaptchaToken()`

### 3. Google Analytics GA4

1. Creare una proprietà GA4 in [Google Analytics](https://analytics.google.com/)
2. Sostituire `YOUR_GA4_ID` in `index.html` (due occorrenze)

### 4. Firebase Functions

Creare una Firebase Function per l'invio email. Esempio struttura:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendContactEmail = functions.https.onCall(async (data, context) => {
    // Validazione input
    // Invio email tramite EmailJS, Nodemailer, o SendGrid
    // Restituire risultato
});
```

**Nota:** Aggiornare il nome della funzione in `js/form-handler.js` se diverso da `sendContactEmail`.

### 5. Firestore Security Rules

Configurare le regole di sicurezza per la collection `leads`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leads/{leadId} {
      allow create: if request.auth == null; // Permetti creazione senza auth
      allow read, update, delete: if request.auth != null; // Solo admin autenticati
    }
  }
}
```

### 6. Immagini

Aggiungere le seguenti immagini nella directory `images/`:

- `images/team/carlotta-taiti.jpg` - Foto professionale dell'avvocato
- `images/office/` - Foto dello studio (opzionale)
- `images/logo.png` - Logo dello studio (opzionale)
- `images/og-image.jpg` - Immagine per Open Graph (1200x630px consigliato)

## URL e Routing

Il sito è configurato per essere servito su:
- **URL pubblico:** `https://apheron.io/avvocato_carlotta_taiti`
- **Directory fisica:** `public/studioavvocato/`

Il routing è gestito tramite `firebase.json` con rewrite rules.

## Funzionalità Implementate

### Frontend
- ✅ Design responsive mobile-first
- ✅ Navigazione smooth scroll con menu mobile
- ✅ FAQ accordion interattivo
- ✅ Ricerca interna nel sito (Ctrl/Cmd + K)
- ✅ Cookie consent banner (GDPR compliant)
- ✅ Modali per Privacy Policy, Cookie Policy, Note Legali
- ✅ Form di contatto con validazione client-side
- ✅ Timeline interattiva per il processo di consulenza
- ✅ Google Maps embed per l'indirizzo dello studio

### SEO
- ✅ Meta tags completi (title, description, Open Graph)
- ✅ Structured data (Schema.org LegalService e Attorney)
- ✅ Geographic meta tags per Prato
- ✅ Canonical URL
- ✅ Sitemap-ready structure

### Analytics
- ✅ Google Analytics GA4 integration
- ✅ Event tracking per:
  - CTA clicks (telefono, email, bottoni)
  - Form submissions
  - Scroll depth (25%, 50%, 75%, 100%)

### Backend Integration
- ✅ Firestore per salvataggio lead
- ✅ Firebase Functions per notifiche email
- ✅ reCAPTCHA v3 per protezione spam
- ✅ Validazione form client-side e server-side ready

## Personalizzazione

### Colori
Modificare le variabili CSS in `styles.css`:

```css
:root {
    --color-primary: #1a3a5f;      /* Blu scuro principale */
    --color-accent: #d4af37;        /* Oro per accenti */
    --color-background: #ffffff;     /* Sfondo bianco */
}
```

### Font
I font sono caricati da Google Fonts:
- **Titoli:** Playfair Display (serif)
- **Testo:** Inter (sans-serif)

### Contenuti
Tutti i testi sono in italiano e facilmente modificabili direttamente in `index.html`.

## Deployment

Il sito viene deployato automaticamente tramite Firebase Hosting quando si fa push al repository principale.

Per deploy manuale:

```bash
cd apheron-homepage
firebase deploy --only hosting
```

## Note Legali e Deontologiche

Il sito rispetta:
- ✅ Regole deontologiche dell'Ordine degli Avvocati
- ✅ GDPR compliance (Privacy Policy, Cookie Policy)
- ✅ Nessuna promessa di risultati o successi garantiti
- ✅ Ton informativo e professionale

## Supporto

Per domande o modifiche, contattare il team di sviluppo.

---

**Ultimo aggiornamento:** Gennaio 2025

