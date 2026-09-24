# Wheel of Facts · FUN Friday

Gioco a indovinelli per il FUN Friday del team: `apheron.io/fun-friday/`.
Vanilla JS (ES modules), nessun backend. Questo file non va online (`**/*.md` è ignorato nel deploy).

## Le due finestre
- `#control` = **Regia**, sul portatile. Tutti i comandi. Solo una Regia può scrivere: una
  seconda finestra Regia resta in sola lettura.
- `#board` = **Lavagna**, sul secondo monitor, presentata su Meet. Nessun pulsante: la comanda la Regia.
- `#demo-control` / `#demo-board` = stessa cosa con giocatori e frasi inventati, in uno spazio
  separato (non tocca i dati veri).
- Senza `#` = pagina di lancio con i due pulsanti e le istruzioni.

## Dati
- Tutto nel `localStorage` del browser, per indirizzo: `https://apheron.io`, `http://localhost:5000` e
  `http://127.0.0.1:5000` sono tre archivi diversi.
- Per spostarli: Regia → Settings & data → **Export** sul PC di partenza, poi **Import** sull'altro
  (stesso indirizzo in cui giocherai). Ogni Import/Reset salva prima un backup (ultimi 10).
- I file `fun-friday-backup-*.json` contengono i fun fact dei colleghi: tienili fuori dal repo
  (sono già in `.gitignore` e negli `ignore` del deploy).
- Fine stagione: Export, poi Settings & data → **Delete all game data from this browser** (cancella
  stato, backup e copie illeggibili).

## Prova in locale (due finestre)
```
npx serve public -l 5000
```
Apri `http://localhost:5000/fun-friday/#control`, poi **Open Board** (si apre `#board` in una nuova
scheda). Per provare le rewrite di Firebase: `firebase emulators:start --only hosting` (porta 5000 di
default). Su Windows l'emulatore non applica le regole `headers`: la cache si verifica dopo il deploy con
`curl -sI https://apheron.io/fun-friday/app.js` (atteso `max-age=0, must-revalidate`).

Test automatico (demo, due finestre): `npx playwright test e2e/fun-friday.spec.js --reporter=line`.

## Checklist del FUN Friday
1. Portatile **attaccato alla corrente** (il risparmio energetico rallenta le animazioni), cuffie.
2. Chrome su `https://apheron.io/fun-friday/` → **Open Control**. In alto deve comparire "Board connected".
3. **Open Board** → trascina la scheda sul secondo monitor → **un clic** sulla Lavagna (attiva suono e
   schermo intero). In Regia controlla "audio on".
4. Meet in una terza finestra, **accanto** alla Regia (non sopra: una finestra coperta rallenta).
   Con la Regia larga almeno ~900 px (es. metà di uno schermo 1920) i 20 nomi da cliccare stanno
   tutti a destra del timer; più stretta va su una colonna e Spazio porta la griglia in vista.
5. Meet → **Presenta → Una scheda** → "BOARD — Wheel of Facts" con **"Condividi anche l'audio della
   scheda"** attivo.
6. Nuova sessione: Regia → Game → **New FUN Friday** (azzera i punti, i fatti usati restano usati).

## Durante un turno
| Tasto | Azione |
|---|---|
| S | Gira la ruota / ri-gira |
| 1 2 3 | Scegli il fun fact |
| Enter | Start · poi Next turn |
| Spazio | "Got one!": fissa l'istante del bonus, poi clicca il nome |
| P | Pausa / riprendi |
| A | Rivela tutto |
| Z | Annulla l'ultimo piazzamento |
| Esc | Annulla il turno |
| L / O | Striscia classifica / classifica completa sulla Lavagna |
| M | Muto |

Punteggio: 3/2/1 ai primi tre + bonus velocità sulle caselle ancora coperte al momento del clic
(≥75% +3, ≥50% +2, ≥25% +1). Col ritmo automatico allo scadere è scoperto circa il 75% delle caselle,
quindi il bonus vale +3 nel primo terzo del tempo, +2 nel secondo, +1 nel terzo.
Tutto è modificabile in Settings & data.
