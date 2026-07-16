# 🔧 RIPRISTINO REGOLE FIRESTORE - Progetto APHERON

## ⚠️ PROBLEMA RILEVATO

Gli errori nella console mostrano:
- `Error loading reviews: Missing or insufficient permissions`
- `Error loading projects: Missing or insufficient permissions`

Questo significa che le regole Firestore in Firebase Console sono state modificate e non corrispondono più a quelle corrette.

## ✅ REGOLE CORRETTE DA COPIARE

Copia e incolla queste regole **ESATTE** in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Projects collection - only francesco.perone00@gmail.com can read/write
    match /projects/{projectId} {
      // Allow read/write only for francesco.perone00@gmail.com
      allow read, write: if request.auth != null && 
                           request.auth.token.email == "francesco.perone00@gmail.com";
    }
    
    // Reviews collection - public read (for Schema.org updates), authenticated write only
    match /reviews/{reviewId} {
      // Allow public read (for reviews-updater.js script on main page)
      allow read: if true;
      // Allow write only for francesco.perone00@gmail.com
      allow write: if request.auth != null && 
                    request.auth.token.email == "francesco.perone00@gmail.com";
    }
    
    // Deny all other collections by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 📋 ISTRUZIONI PASSO-PASSO

1. **Apri Firebase Console**
   - Vai su: https://console.firebase.google.com/project/apheron-homepage/firestore/rules

2. **Vai alla sezione Rules**
   - Clicca su "Firestore Database" nel menu laterale
   - Clicca sulla tab "Rules"

3. **Copia le regole corrette**
   - Seleziona tutto il testo attuale nelle regole
   - Eliminalo (Ctrl+A, poi Canc)
   - Incolla le regole corrette sopra (il blocco di codice completo)

4. **Pubblica le regole**
   - Clicca sul pulsante "Publish" in alto a destra
   - Attendi la conferma "Rules published successfully"

5. **Verifica**
   - Ricarica la pagina Admin (`/admin.html`)
   - Fai login con `francesco.perone00@gmail.com`
   - Controlla che i progetti e le recensioni si carichino correttamente

## 🔍 SPIEGAZIONE DELLE REGOLE

### Collection `projects`
- **Read/Write**: Solo utente autenticato con email `francesco.perone00@gmail.com`
- **Scopo**: Proteggere i progetti dall'accesso non autorizzato

### Collection `reviews`
- **Read**: Pubblico (chiunque può leggere)
  - Necessario per `reviews-updater.js` che aggiorna Schema.org markup
- **Write**: Solo utente autenticato con email `francesco.perone00@gmail.com`
  - Permette di modificare recensioni dal pannello Admin

### Altre collections
- **Bloccate**: Tutte le altre collections sono completamente bloccate per sicurezza

## ⚠️ NOTA IMPORTANTE

**NON modificare queste regole per il progetto principale APHERON.**

Le regole per i progetti nelle sottocartelle (come `studioavvocato`) sono separate e non influenzano queste regole.

## 🐛 ERRORE APP CHECK (Non critico)

Gli errori `AppCheck: Requests throttled due to 400 error` sono relativi a reCAPTCHA v3 e non bloccano il funzionamento dell'app. L'app può funzionare anche senza App Check, ma la protezione API key è ridotta.

Se vuoi risolvere anche questo:
1. Vai su: https://console.firebase.google.com/project/apheron-homepage/appcheck
2. Verifica che reCAPTCHA v3 sia configurato correttamente
3. Controlla che la site key in `firebase-config.js` corrisponda a quella in Firebase Console

---

**Data creazione**: 2025-12-15
**Ultima verifica**: 2025-12-15

