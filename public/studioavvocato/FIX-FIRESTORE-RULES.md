# 🔧 Fix Firestore Security Rules - "Missing or insufficient permissions"

## Problema

L'errore "Missing or insufficient permissions" indica che le security rules di Firestore sono troppo restrittive e bloccano la creazione di documenti nella collection "leads".

## Soluzione: Aggiornare le Security Rules

### Passo 1: Apri Firebase Console

1. Vai su: https://console.firebase.google.com/
2. Seleziona il progetto: **apheron-homepage**
3. Nel menu a sinistra, clicca su **Firestore Database**
4. Clicca sulla tab **Regole** (Rules) in alto

### Passo 2: Sostituisci le Regole

**SOSTITUISCI TUTTO IL CONTENUTO** della sezione Rules con questo codice:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leads/{leadId} {
      // Permetti creazione a chiunque (per il form di contatto)
      // Validazione base: nome, email e messaggio devono essere presenti
      allow create: if request.resource.data.keys().hasAll(['nome', 'email', 'messaggio'])
                    && request.resource.data.nome is string
                    && request.resource.data.nome.size() > 0
                    && request.resource.data.nome.size() <= 200
                    && request.resource.data.email is string
                    && request.resource.data.email.matches('.*@.*\\..*')
                    && request.resource.data.email.size() <= 200
                    && request.resource.data.messaggio is string
                    && request.resource.data.messaggio.size() > 0
                    && request.resource.data.messaggio.size() <= 5000;
      
      // Solo utenti autenticati possono leggere/modificare
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

### Passo 3: Pubblica le Regole

1. Clicca sul pulsante **"Pubblica"** (Publish) in alto a destra
2. Attendi la conferma (pochi secondi)

### Passo 4: Testa il Form

1. Torna al sito: `https://apheron.io/avvocato_carlotta_taiti`
2. Compila e invia il form
3. Verifica che funzioni correttamente

---

## Regole Semplificate (Alternativa - Se le regole sopra non funzionano)

Se le regole sopra non funzionano, usa questa versione ancora più semplice (meno sicura ma funzionante):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leads/{leadId} {
      // Permetti creazione a chiunque (per il form)
      allow create: if true;
      
      // Solo utenti autenticati possono leggere/modificare
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

**⚠️ Nota:** Questa versione è meno sicura ma permetterà al form di funzionare. Puoi sempre migliorare le regole dopo.

---

## Verifica

Dopo aver pubblicato le regole, il form dovrebbe funzionare. Se vedi ancora errori, controlla:
1. Che le regole siano state pubblicate correttamente
2. Che la collection "leads" esista in Firestore
3. La console del browser per altri errori

