# Sito Web - Chiara Caruso • Baby-sitter

Sito one-page per Chiara Caruso, baby-sitter a Prato, Firenze e Pistoia.

## 📁 Struttura Progetto

```
tata-chiara-caruso/
├── index.html          # Pagina principale
├── styles.css          # Stili CSS
├── app.js              # JavaScript (WhatsApp, animazioni, etc.)
├── assets/             # Immagini e risorse
│   ├── chiara-hero.jpg # Foto principale (richiesta)
│   ├── favicon.png     # Icona sito (richiesta)
│   └── README.md       # Info immagini
└── README.md           # Questo file
```

## 🚀 URL Pubblicazione

Il sito è pubblicato su: **https://apheron.io/tata-chiara-caruso**

## 📝 Note Importanti

### Immagini Richieste

Prima di pubblicare, assicurati di aggiungere le seguenti immagini nella cartella `assets/`:

1. **chiara-hero.jpg** - Foto principale di Chiara per la sezione Hero
   - Dimensioni consigliate: 1920x1080px o superiore
   - Formato: JPG ottimizzato per web
   - Questa immagine viene usata come background nella sezione hero

2. **favicon.png** - Icona del sito
   - Dimensioni consigliate: 32x32px o 64x64px
   - Formato: PNG con trasparenza

### Funzionalità Implementate

✅ **WhatsApp Integration**
- 3 tipi di messaggi precompilati:
  - Richiesta veloce (default)
  - Serale / Weekend
  - Urgenza (oggi/domani)
- Numero WhatsApp: +353 89 404 0077

✅ **Design System**
- Colori: Turchese/Teal (#20B2AA), Corallo (#FF6B6B), Giallo (#FFD93D)
- Mobile-first responsive
- Animazioni leggere (rispetta prefers-reduced-motion)

✅ **SEO Locale**
- Meta tags ottimizzati per Prato, Firenze, Pistoia
- JSON-LD LocalBusiness schema
- Open Graph tags

✅ **Accessibilità**
- Contrasto testo ottimizzato
- Pulsanti minimo 44px
- Rispetta prefers-reduced-motion

✅ **Funzionalità JavaScript**
- Smooth scroll
- Fade-in on scroll
- Confetti minimal (solo su click CTA)
- Sticky WhatsApp button (mobile)

## 🔧 Personalizzazione

### Modificare i Testi

Tutti i testi sono direttamente nel file `index.html`. Cerca le sezioni:
- Hero: `.hero-headline` e `.hero-subtitle`
- Trust cards: `.trust-card`
- Servizi: `.chip`
- FAQ: `.faq-item`

### Modificare i Colori

I colori sono definiti come variabili CSS in `styles.css`:

```css
:root {
    --primary: #20B2AA;      /* Turchese/Teal */
    --secondary: #FF6B6B;    /* Corallo */
    --accent: #FFD93D;       /* Giallo */
}
```

### Modificare i Messaggi WhatsApp

I messaggi precompilati sono in `app.js`:

```javascript
const WHATSAPP_MESSAGES = {
    default: `...`,
    serale: `...`,
    urgenza: `...`
};
```

## 📱 Test

Prima di pubblicare, testa:
- [ ] Tutti i link WhatsApp funzionano
- [ ] Il sito è responsive su mobile
- [ ] Le immagini sono caricate correttamente
- [ ] Le animazioni funzionano (o sono disabilitate con prefers-reduced-motion)
- [ ] Il sticky button appare su mobile

## 🎨 Design

Il design è:
- **Gioioso ma non infantile**
- **Pulito e affidabile**
- **Mobile-first**
- **Accessibile**

## 📞 Contatti

- **WhatsApp**: +353 89 404 0077
- **Instagram**: [@chiaracarusoo](https://www.instagram.com/chiaracarusoo/)

---

Creato seguendo le specifiche dello script CursorAI.

