# Spolek rodičů (sr)

## Quick start
1. `npm install`
2. `cp .env.example .env` a doplň Firebase hodnoty
3. `npm run dev`

## Kontroly
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Firebase deploy
- Hosting: `firebase deploy --only hosting`
- Kompletní: `firebase deploy`
- Functions env: nastav přes `firebase functions:secrets:set` nebo `.env` v Functions Gen2.
