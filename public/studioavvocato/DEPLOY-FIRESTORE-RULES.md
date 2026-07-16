# 🔧 Deploy Firestore Rules per Studio Legale Taiti

## Metodo 1: Deploy Manuale dalla Console Firebase (Consigliato)

1. Vai su: https://console.firebase.google.com/project/studio-legale-taiti/firestore/rules
2. Clicca sulla tab **"Regole"** (Rules)
3. Apri il file: `apheron-homepage/public/studioavvocato/firestore.rules`
4. Copia tutto il contenuto del file
5. Incolla nella console Firebase
6. Clicca **"Pubblica"** (Publish)

## Metodo 2: Deploy tramite CLI (Script)

Esegui questi comandi in PowerShell dalla root del progetto:

```powershell
cd C:\Users\frape\apheron-homepage

# Backup regole apheron-homepage
Copy-Item firestore.rules firestore.rules.apheron.backup

# Copia regole studio-legale-taiti nella root
Copy-Item public\studioavvocato\firestore.rules firestore.rules

# Deploy per studio-legale-taiti
firebase use studio-legale-taiti
firebase deploy --only firestore:rules

# Ripristina regole apheron-homepage
Copy-Item firestore.rules.apheron.backup firestore.rules
Remove-Item firestore.rules.apheron.backup

# Ripristina progetto apheron-homepage
firebase use apheron-homepage
```

## Verifica

Dopo il deploy, verifica che le regole siano attive:
1. Vai su: https://console.firebase.google.com/project/studio-legale-taiti/firestore/rules
2. Controlla che le regole per la collection `leads` siano presenti

