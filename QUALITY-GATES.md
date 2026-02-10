# Quality Gates — apheron-homepage

Comandi standard (CI-friendly, nessun prompt interattivo). Eseguire dalla **root** del repo (`apheron-homepage`).

## Checklist

| Comando | Descrizione | Stato |
|---------|-------------|--------|
| `npm run lint` | ESLint in `functions/` | ✅ Passa |
| `npm run format` | Applica fix ESLint in `functions/` | ✅ |
| `npm run typecheck` | No TypeScript — no-op | ✅ |
| `npm run test` | Nessun test — no-op | ⚠️ Da estendere in Phase 4 |
| `npm run build` | Hosting statico — no build | ✅ no-op |

## Esecuzione locale (Windows)

```powershell
cd apheron-homepage
npm run lint
npm run format
```

## Dipendenze

- **Root:** nessuna dipendenza (solo script che delegano a `functions/`).
- **Lint/format:** eseguiti in `functions/` (`npm install` in `functions/` prima del primo lint).

Prima esecuzione:

```powershell
cd apheron-homepage\functions
npm install
cd ..
npm run lint
```

## Pre-commit

Nessun hook pre-commit configurato (non presente nello stack attuale).
