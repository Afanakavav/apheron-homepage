# 🇮🇪 Quando il Profilo Irlanda sarà Verificato

## 📝 **Cosa Fare**

Quando il profilo Google Business Irlanda sarà verificato, segui questi passaggi:

### Step 1: Ottieni il Link Corretto
1. Vai su: https://business.google.com
2. Seleziona il profilo **Irlanda (Dublin)**
3. Vai su **"Condividi il tuo profilo"** / **"Share your profile"**
4. Copia il link (formato: `https://g.page/r/XXXXX/review` o simile)

### Step 2: Aggiorna il Codice
Apri il file: `apheron-homepage/public/translations.js`

Trova la riga **50** (sezione inglese):
```javascript
googleBusinessLink: "" // Ireland profile link - will be added when verified
```

Sostituisci con:
```javascript
googleBusinessLink: "https://g.page/r/TUO_ID_IRLANDA/review"
```

### Step 3: Test e Deploy
1. Testa sul sito: cambia lingua in inglese → verifica che il link appaia
2. Committa e deploy:
```bash
git add public/translations.js
git commit -m "Add Ireland Google Business Profile link"
git push origin main
firebase deploy --only hosting
```

---

## ⚠️ **Nota sul Link Italia**

Il link attuale per l'Italia è un link di ricerca Google. Per ottenere il link diretto al profilo:

1. Vai su Google Business Profile: https://business.google.com
2. Seleziona profilo Italia
3. Menu → **"Condividi"** → **"Copia link"**
4. Il link dovrebbe essere tipo: `https://g.page/r/XXXXX/review`

**Opzionale**: Puoi sostituire il link attuale con quello diretto quando vuoi.

---

## ✅ **Status Attuale**

- ✅ **Profilo Italia**: Link aggiunto (link ricerca - può essere migliorato con link diretto)
- ⏳ **Profilo Irlanda**: In attesa di verifica - link sarà aggiunto quando pronto

