# 🚀 Deploy su GitHub - Guida Completa

## 📋 **PASSI PER DEPLOY SU GITHUB**

### **FASE 1: Test Locale con VSCode** 🧪

1. **Apri VSCode** (già fatto con `code .`)
2. **Installa Live Server** (se non l'hai già):
   - Apri Extensions (Ctrl+Shift+X)
   - Cerca "Live Server"
   - Installa l'estensione di Ritwick Dey
3. **Testa il progetto**:
   - Apri `local-test.html` in VSCode
   - Clicca destro → "Open with Live Server"
   - Testa tutte le funzionalità

### **FASE 2: Configurazione API** 🔧

Prima del deploy, configura le API:

#### **Google Analytics**
1. Vai su [Google Analytics](https://analytics.google.com)
2. Crea una nuova proprietà
3. Copia il Measurement ID (es: G-XXXXXXXXXX)
4. Sostituisci in `config.js`:
```javascript
GA_MEASUREMENT_ID: 'G-XXXXXXXXXX', // Il tuo ID reale
```

#### **Google Maps API**
1. Vai su [Google Cloud Console](https://console.cloud.google.com)
2. Crea un nuovo progetto
3. Abilita "Maps JavaScript API"
4. Crea una API Key
5. Sostituisci in `config.js`:
```javascript
GOOGLE_MAPS_API_KEY: 'AIzaSyXXXXXXXXXXXXXXXXXXXXXX', // La tua chiave reale
```

### **FASE 3: Inizializzazione Git** 📦

Apri il terminale in VSCode (Ctrl+`) e esegui:

```bash
# Inizializza repository Git
git init

# Aggiungi tutti i file
git add .

# Commit iniziale
git commit -m "Initial commit: Italian lessons landing page"
```

### **FASE 4: Creazione Repository GitHub** 🐙

1. **Vai su GitHub.com** e fai login
2. **Clicca "New repository"**
3. **Configura il repository**:
   - Nome: `italian-lessons-dublin`
   - Descrizione: `🇮🇹 Interactive landing page for Italian lessons in Dublin`
   - Pubblico (per GitHub Pages gratuito)
   - NON inizializzare con README (abbiamo già i file)
4. **Clicca "Create repository"**

### **FASE 5: Collegamento e Push** 🔗

Nel terminale di VSCode:

```bash
# Collega al repository GitHub (sostituisci TUO_USERNAME)
git remote add origin https://github.com/TUO_USERNAME/italian-lessons-dublin.git

# Push su GitHub
git push -u origin main
```

### **FASE 6: Abilitazione GitHub Pages** 🌐

1. **Vai al tuo repository** su GitHub
2. **Clicca su "Settings"** (tab in alto)
3. **Scorri fino a "Pages"** (sidebar sinistra)
4. **Configura**:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
5. **Clicca "Save"**
6. **Aspetta 2-3 minuti** per il deploy
7. **Il tuo sito sarà disponibile** su: `https://TUO_USERNAME.github.io/italian-lessons-dublin`

### **FASE 7: Test del Sito Live** ✅

1. **Apri l'URL** del tuo sito
2. **Testa tutte le funzionalità**:
   - Quiz italiano
   - Parola del giorno
   - Mini gioco
   - Sistema prenotazione
   - WhatsApp integration
   - Google Maps
3. **Testa su mobile** (importante per QR code)

### **FASE 8: Generazione QR Code** 📱

1. **Vai su un generatore QR**:
   - [QR Code Generator](https://www.qr-code-generator.com/)
   - [QR Code Monkey](https://www.qrcode-monkey.com/)
2. **Inserisci l'URL**: `https://TUO_USERNAME.github.io/italian-lessons-dublin`
3. **Configura**:
   - Dimensione: 300x300 px
   - Formato: PNG
   - Colore: Nero su bianco
4. **Scarica e stampa** il QR code

## 🔧 **Comandi Git Utili**

```bash
# Per aggiornamenti futuri
git add .
git commit -m "Update: [descrizione modifica]"
git push

# Per vedere lo stato
git status

# Per vedere la cronologia
git log --oneline

# Per tornare a un commit precedente
git reset --hard [HASH_COMMIT]
```

## 📱 **Test Mobile**

Importante testare su mobile perché il QR code aprirà il sito su smartphone:

1. **Apri il sito** su smartphone
2. **Testa**:
   - Caricamento veloce
   - Pulsanti touch-friendly
   - Quiz e giochi funzionanti
   - WhatsApp integration
   - Booking modal responsive

## 🚨 **Risoluzione Problemi**

### **Git Push Fallisce**
```bash
# Se hai errori di autenticazione
git config --global user.name "Tuo Nome"
git config --global user.email "tua-email@example.com"

# Se il repository esiste già
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### **GitHub Pages Non Funziona**
- Verifica che il branch sia "main"
- Controlla che index.html sia nella root
- Aspetta 5-10 minuti per il deploy
- Controlla la tab "Actions" per errori

### **API Non Funzionano**
- Verifica le chiavi API in config.js
- Controlla la console del browser per errori
- Assicurati che le API siano abilitate

## 📊 **Monitoraggio Post-Deploy**

1. **Google Analytics**: Monitora visite e conversioni
2. **GitHub Insights**: Vedi statistiche repository
3. **Test QR Code**: Scansiona e verifica funzionamento
4. **Feedback Utenti**: Raccogli commenti dai primi studenti

## 🎯 **Checklist Finale**

- [ ] Test locale completato
- [ ] API configurate
- [ ] Repository GitHub creato
- [ ] Codice pushato su GitHub
- [ ] GitHub Pages abilitato
- [ ] Sito live testato
- [ ] QR code generato
- [ ] Test mobile completato
- [ ] Analytics configurato

---

**Il tuo volantino digitale è pronto! 🇮🇹✨**
