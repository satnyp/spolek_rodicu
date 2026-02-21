# Spolek rodičů (MVP)

## Lokální vývoj

```bash
npm ci
cd functions && npm ci && cd ..
```

Spuštění aplikace proti produkčnímu Firebase configu:

```bash
npm run dev
```

## DEV/CI režim (deterministický login za OAuth)

1. Spusť emulátory:

```bash
firebase emulators:start
```

2. V druhém terminálu seedni data:

```bash
node scripts/seedEmulator.mjs
```

3. Spusť frontend v E2E režimu:

```bash
VITE_E2E=true VITE_USE_EMULATORS=true npm run dev
```

## Testy a kontroly

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

E2E (Playwright + emulátory + seed):

```bash
npm run test:e2e:ci
```

## Deploy

```bash
firebase deploy
```
