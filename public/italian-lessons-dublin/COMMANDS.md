# 🖥️ Comandi Terminale - Italian Lessons Dublin

## 🚀 **COMANDI RAPIDI**

### **Test Locale**
```bash
# Apri VSCode
code .

# Apri test locale
start local-test.html

# Apri pagina principale
start index.html
```

### **Setup Git**
```bash
# Setup automatico Windows
setup.bat

# Setup automatico Linux/Mac
./setup.sh

# Setup manuale
git init
git add .
git commit -m "Initial commit: Italian lessons landing page"
```

### **Deploy GitHub**
```bash
# Collega repository (sostituisci TUO_USERNAME)
git remote add origin https://github.com/TUO_USERNAME/italian-lessons-dublin.git

# Push su GitHub
git push -u origin main

# Per aggiornamenti futuri
git add .
git commit -m "Update: [descrizione]"
git push
```

### **Comandi Utili**
```bash
# Verifica stato Git
git status

# Vedi cronologia
git log --oneline

# Vedi file del progetto
dir

# Apri cartella in Explorer
explorer .
```

## 📱 **URL FINALI**

- **GitHub Repository**: `https://github.com/TUO_USERNAME/italian-lessons-dublin`
- **GitHub Pages**: `https://TUO_USERNAME.github.io/italian-lessons-dublin`
- **QR Code**: Genera con l'URL GitHub Pages

## 🔧 **Configurazione API**

### **Google Analytics**
1. Vai su [Google Analytics](https://analytics.google.com)
2. Crea proprietà
3. Copia Measurement ID
4. Sostituisci in `config.js`:
```javascript
GA_MEASUREMENT_ID: 'G-XXXXXXXXXX',
```

### **Google Maps**
1. Vai su [Google Cloud Console](https://console.cloud.google.com)
2. Abilita Maps JavaScript API
3. Crea API Key
4. Sostituisci in `config.js`:
```javascript
GOOGLE_MAPS_API_KEY: 'AIzaSyXXXXXXXXXXXXXXXXXXXXXX',
```

## 📋 **Checklist Rapida**

- [ ] Test locale completato
- [ ] API configurate
- [ ] Repository GitHub creato
- [ ] Codice pushato
- [ ] GitHub Pages abilitato
- [ ] QR code generato
- [ ] Test mobile completato

---

**Tutto pronto per il lancio! 🇮🇹✨**
