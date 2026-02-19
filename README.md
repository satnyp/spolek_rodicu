# Spolek rodičů (MVP)

## Quick start

```bash
npm ci
cp .env.example .env
npm run dev
```

Functions:

```bash
cd functions
npm ci
cp .env.example .env
npm run build
```

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy

```bash
firebase deploy
```

Pouze hosting:

```bash
firebase deploy --only hosting
```
