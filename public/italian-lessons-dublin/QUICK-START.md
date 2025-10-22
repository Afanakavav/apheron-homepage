# 🚀 Quick Start Guide - Italian Lessons Dublin

## ⚡ **PASSI RAPIDI PER DEPLOY**

### **1. Test Locale** 🧪
```bash
# Apri VSCode (già fatto)
code .

# Apri local-test.html con Live Server
# Clicca destro → "Open with Live Server"
```

### **2. Configura API** 🔧
Modifica `config.js`:
```javascript
GA_MEASUREMENT_ID: 'G-XXXXXXXXXX', // Il tuo Google Analytics ID
GOOGLE_MAPS_API_KEY: 'AIzaSyXXXXXXXXXXXXXXXXXXXXXX', // La tua Google Maps API key
```

### **3. Setup Git** 📦
```bash
# Windows
setup.bat

# Linux/Mac
./setup.sh

# Oppure manualmente:
git init
git add .
git commit -m "Initial commit: Italian lessons landing page"
```

### **4. Crea Repository GitHub** 🐙
1. Vai su [GitHub.com](https://github.com)
2. Clicca "New repository"
3. Nome: `italian-lessons-dublin`
4. Pubblico
5. NON inizializzare con README
6. Clicca "Create repository"

### **5. Push su GitHub** 🔗
```bash
git remote add origin https://github.com/TUO_USERNAME/italian-lessons-dublin.git
git push -u origin main
```

### **6. Abilita GitHub Pages** 🌐
1. Vai su Settings → Pages
2. Source: Deploy from a branch
3. Branch: main
4. Folder: / (root)
5. Save

### **7. Genera QR Code** 📱
- URL: `https://TUO_USERNAME.github.io/italian-lessons-dublin`
- Usa [QR Code Generator](https://www.qr-code-generator.com/)
- Stampa e distribuisci!

## 📋 **CHECKLIST COMPLETA**

### **Prima del Deploy**
- [ ] Test locale completato
- [ ] Google Analytics ID configurato
- [ ] Google Maps API key configurato
- [ ] Video intro aggiunto (opzionale)
- [ ] Orari disponibili aggiornati

### **Dopo il Deploy**
- [ ] Sito live testato
- [ ] Funzionalità mobile verificate
- [ ] WhatsApp integration testata
- [ ] QR code generato e testato
- [ ] Analytics configurato

## 🆘 **RISOLUZIONE PROBLEMI**

### **Git Push Fallisce**
```bash
git config --global user.name "Tuo Nome"
git config --global user.email "tua-email@example.com"
git push -u origin main
```

### **GitHub Pages Non Funziona**
- Verifica branch "main"
- Controlla che index.html sia nella root
- Aspetta 5-10 minuti per deploy

### **API Non Funzionano**
- Verifica chiavi in config.js
- Controlla console browser per errori
- Assicurati che API siano abilitate

## 📞 **Supporto**

- **Email**: francesco.perone00@gmail.com
- **WhatsApp**: +353 89 404 0077
- **Documentazione**: Vedi README.md e GITHUB-DEPLOY.md

---

**Buona fortuna con le tue lezioni di italiano! 🇮🇹✨**
