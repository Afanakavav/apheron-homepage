# Phase 3 — Performance Optimization

## Scope

Solo **public/italian-lessons-dublin** (sito statico). Nessun bundler; nessun React. Headers di cache già configurati in `firebase.json` (Phase 0).

## Ottimizzazioni applicate

### 1. Preconnect a origini critiche

Aggiunti in `<head>`:

- `https://fonts.googleapis.com` e `https://fonts.gstatic.com` (font)
- `https://cdnjs.cloudflare.com` (Font Awesome)
- `https://www.googletagmanager.com` (Google Analytics)

**Effetto:** Il browser apre connessioni TCP/TLS in anticipo; le richieste a questi domini partono con meno latenza. Nessun cambiamento di comportamento.

### 2. Config non bloccante in head

- **Prima:** `config.js` in `<head>` → bloccava il first paint.
- **Dopo:** `config.js` spostato in `<body>` prima di `config.local.js` e degli script che usano `CONFIG`.

**Effetto:** L’head non attende più config; first paint può avvenire prima. L’ordine di esecuzione (config → config.local → inline Maps → script.js) è invariato.

### 3. Video: preload="none"

- **Prima:** `<video>` senza `preload` (comportamento di default del browser, spesso preload="auto").
- **Dopo:** `preload="none"` sul video nel modal.

**Effetto:** Il video non viene scaricato al caricamento della pagina, solo quando l’utente apre il modal (e il browser può comunque caricarlo al play). Riduce dati e tempo di caricamento iniziale.

### 4. script.js con defer

- **Prima:** `<script src="script.js">` in coda al body (già in fondo, ma senza `defer`).
- **Dopo:** `<script src="script.js" defer></script>`.

**Effetto:** Lo script non blocca il parsing; viene eseguito dopo il parsing del documento. Con uno script già in coda al body il guadagno è limitato, ma allinea alle best practice e tiene il documento più “pulito” per eventuali altri script.

## Non modificato (intenzionale)

- **Cache:** `firebase.json` ha già `Cache-Control` per immagini/JS/CSS (1 anno) e HTML (no-cache). Nessuna modifica.
- **Font Awesome:** Uso di `all.min.css` mantenuto (non introdotte sostituzioni con subset o icone inline per evitare cambi di aspetto).
- **Immagine hero:** Nessun `loading="lazy"` (above the fold).
- **functions:** Nessun bundle; nessuna modifica lato performance.

## Before / After (note)

| Metrica | Prima | Dopo |
|--------|--------|------|
| **Bundle size** | N/A (statico) | N/A |
| **Build time** | N/A | N/A |
| **First paint** | Ritardato da config.js in head | Config in body → head più leggero |
| **Risorse precaricate** | Nessuna | 0 (solo preconnect, nessun preload aggiuntivo) |
| **Video** | Caricamento dipendente dal browser | `preload="none"` → niente download fino all’uso |

Per misure quantitative (LCP, FCP, TTI) usare Lighthouse o WebPageTest su una build deployata, prima/dopo queste modifiche.
