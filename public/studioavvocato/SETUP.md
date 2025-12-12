# Setup Guide - Studio Legale Taiti Website

## ✅ File Creati

Tutti i file principali sono stati creati e sono pronti per la configurazione:

1. ✅ `index.html` - Pagina principale completa con tutte le sezioni
2. ✅ `styles.css` - Stili CSS responsive e mobile-first
3. ✅ `script.js` - JavaScript per UI, navigazione, FAQ, search
4. ✅ `js/firebase-config.js` - Configurazione Firebase (da completare)
5. ✅ `js/form-handler.js` - Gestione form e integrazione Firestore
6. ✅ `README.md` - Documentazione completa

## 🔧 Configurazione Necessaria

### 1. Firebase Project Setup

**Passo 1:** Creare un progetto Firebase su [Firebase Console](https://console.firebase.google.com/)

**Passo 2:** Abilitare i seguenti servizi:
- ✅ Firestore Database
- ✅ Firebase Functions
- ✅ Firebase Hosting (già configurato nel progetto principale)

**Passo 3:** Ottenere le credenziali:
- Vai su Project Settings > General > Your apps
- Copia la configurazione Firebase
- Incolla in `js/firebase-config.js` sostituendo i placeholder

### 2. Firestore Database Setup

**Collection da creare:** `leads`

**Struttura documento:**
```javascript
{
  nome: string,
  email: string,
  telefono: string,
  tipologia: string,
  messaggio: string,
  privacy: boolean,
  timestamp: string,
  recaptchaToken: string (opzionale),
  status: string ('new'),
  createdAt: timestamp,
  updatedAt: timestamp,
  source: string ('website_contact_form')
}
```

**Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leads/{leadId} {
      allow create: if true; // Permetti creazione senza auth
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

### 3. Firebase Function per Email

**File da creare:** `functions/index.js` (nella root del progetto apheron-homepage)

**Opzione A - EmailJS:**
```javascript
const functions = require('firebase-functions');
const axios = require('axios');

exports.sendContactEmail = functions.https.onCall(async (data, context) => {
  const emailjsConfig = {
    service_id: 'YOUR_SERVICE_ID',
    template_id: 'YOUR_TEMPLATE_ID',
    user_id: 'YOUR_USER_ID',
    template_params: {
      to_email: 'carlottataiti@gmail.com',
      from_name: data.nome,
      from_email: data.email,
      phone: data.telefono,
      message: data.messaggio,
      tipologia: data.tipologia || 'Generale'
    }
  };

  try {
    const response = await axios.post(
      'https://api.emailjs.com/api/v1.0/email/send',
      emailjsConfig
    );
    return { success: true, messageId: response.data };
  } catch (error) {
    console.error('EmailJS error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});
```

**Opzione B - Nodemailer (Gmail/SMTP):**
```javascript
const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.password
  }
});

exports.sendContactEmail = functions.https.onCall(async (data, context) => {
  const mailOptions = {
    from: 'carlottataiti@gmail.com',
    to: 'carlottataiti@gmail.com',
    subject: `Nuova richiesta consulenza - ${data.tipologia || 'Generale'}`,
    html: `
      <h2>Nuova richiesta di consulenza</h2>
      <p><strong>Nome:</strong> ${data.nome}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Telefono:</strong> ${data.telefono}</p>
      <p><strong>Tipologia:</strong> ${data.tipologia || 'Non specificata'}</p>
      <p><strong>Messaggio:</strong></p>
      <p>${data.messaggio}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});
```

**Deploy della function:**
```bash
cd apheron-homepage
firebase deploy --only functions
```

### 4. Google reCAPTCHA v3

**Passo 1:** Registrarsi su [Google reCAPTCHA](https://www.google.com/recaptcha/admin)

**Passo 2:** Creare un sito reCAPTCHA v3:
- Tipo: reCAPTCHA v3
- Domini: `apheron.io`, `localhost` (per test)

**Passo 3:** Sostituire `YOUR_RECAPTCHA_SITE_KEY` in:
- `index.html` (linea ~30 nel tag script)
- `js/form-handler.js` (linea ~280 nella funzione getRecaptchaToken)

### 5. Google Analytics GA4

**Passo 1:** Creare proprietà GA4 in [Google Analytics](https://analytics.google.com/)

**Passo 2:** Ottenere Measurement ID (formato: G-XXXXXXXXXX)

**Passo 3:** Sostituire `YOUR_GA4_ID` in `index.html` (due occorrenze, linee ~60-70)

### 6. Immagini da Aggiungere

Aggiungere le seguenti immagini nella directory `images/`:

- ✅ `images/team/carlotta-taiti.jpg` - Foto professionale (consigliato: 400x400px)
- ✅ `images/office/` - Foto dello studio (opzionale)
- ✅ `images/logo.png` - Logo dello studio (opzionale)
- ✅ `images/og-image.jpg` - Immagine Open Graph (1200x630px)

**Nota:** Se le immagini non sono disponibili, il sito funzionerà comunque ma mostrerà immagini mancanti.

### 7. Google Maps Embed

**Passo 1:** Ottenere l'URL embed corretto da [Google Maps](https://www.google.com/maps)

**Passo 2:** Cercare "Via Amedeo Modigliani 7, Prato"

**Passo 3:** Cliccare su "Condividi" > "Incorpora una mappa"

**Passo 4:** Sostituire l'iframe in `index.html` (sezione Contatti, ~linea 650)

### 8. Calendly Integration (Opzionale)

Se si desidera utilizzare Calendly per le prenotazioni:

**Passo 1:** Creare account su [Calendly](https://calendly.com)

**Passo 2:** Configurare disponibilità e tipi di consulenza

**Passo 3:** Ottenere il link pubblico

**Passo 4:** Sostituire `https://calendly.com/carlotta-taiti` in `index.html` (sezione Prenota Consulenza)

## 🧪 Test Locali

### Test senza Firebase

Il sito può essere testato localmente anche senza configurare Firebase:

1. Aprire `index.html` in un browser locale
2. Tutte le funzionalità UI funzioneranno (menu, FAQ, search, modali)
3. Il form mostrerà un errore quando si tenta di inviare (normale senza Firebase)

### Test con Firebase

1. Installare Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Inizializzare: `firebase init` (se non già fatto)
4. Emulatore locale: `firebase emulators:start`
5. Testare il form con Firestore emulator

## 🚀 Deployment

Il sito viene deployato automaticamente quando si fa push al repository principale.

Per deploy manuale:

```bash
cd apheron-homepage
firebase deploy --only hosting
```

## ✅ Checklist Pre-Deployment

- [ ] Firebase configurato in `js/firebase-config.js`
- [ ] reCAPTCHA Site Key aggiunto
- [ ] Google Analytics GA4 ID aggiunto
- [ ] Firebase Function creata e deployata
- [ ] Firestore collection `leads` creata
- [ ] Firestore security rules configurate
- [ ] Immagini aggiunte (almeno foto avvocato)
- [ ] Google Maps embed aggiornato
- [ ] Calendly link aggiornato (se utilizzato)
- [ ] Test form di contatto funzionante
- [ ] Test su dispositivi mobili
- [ ] Verifica SEO (meta tags, structured data)

## 📞 Supporto

Per assistenza nella configurazione, consultare:
- `README.md` per documentazione completa
- Firebase Documentation: https://firebase.google.com/docs
- Google reCAPTCHA Docs: https://developers.google.com/recaptcha

---

**Buon lavoro! 🎉**

