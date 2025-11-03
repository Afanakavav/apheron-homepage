# 🔗 Come Ottenere i Link ai Tuoi Profili Google Business

## 📍 Metodo 1: Dal Dashboard Google Business Profile

1. Vai su: https://business.google.com
2. Accedi al tuo account
3. Seleziona il profilo (Italia o Irlanda)
4. Nel menu laterale, vai su **"Home"** o **"Informazioni"**
5. Scorri fino a **"Condividi il tuo profilo"** o **"Share your profile"**
6. Clicca su **"Copia link"** o **"Copy link"**
7. Il link sarà simile a: `https://g.page/r/XXXXXXXXXXXXX/review` o `https://www.google.com/maps/place/...`

---

## 📍 Metodo 2: Da Google Maps

1. Cerca il tuo business su Google Maps
2. Clicca sul profilo
3. Clicca sui **tre puntini** (menu) → **"Condividi"** / **"Share"**
4. Copia il link

---

## 📍 Metodo 3: Link Diretto (se conosci l'ID)

Se conosci l'ID del tuo profilo, il formato è:
- `https://g.page/r/[ID_PROFILO]/review`

---

## ✅ Dove Inserire i Link

Una volta che hai i link, aggiorna questi valori in `translations.js`:

### Per il Profilo ITALIA (italiano):
```javascript
googleBusinessLink: "https://g.page/r/TUO_ID_ITALIA/review" // Sostituisci con il tuo link
```

### Per il Profilo IRLANDA (inglese):
```javascript
googleBusinessLink: "https://g.page/r/TUO_ID_IRLANDA/review" // Sostituisci con il tuo link
```

---

## 🎯 Formato Link Tipico

I link Google Business Profile hanno questo formato:
- `https://g.page/r/[ID_UNIVOCO]/review` (link per recensioni)
- `https://www.google.com/maps/place/[NOME_BUSINESS]/@[COORDINATE]` (link Maps)

Entrambi funzionano! Usa quello che preferisci.

---

**Nota**: Se un profilo non è ancora verificato, il link potrebbe non essere disponibile. In quel caso, puoi lasciare il campo vuoto temporaneamente e il link non verrà mostrato per quella lingua.

