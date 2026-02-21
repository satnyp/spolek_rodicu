# Deploy checklist

## User must do (external setup)
- [ ] Vytvořit Firebase project a doplnit `.firebaserc` (`default` project id).
- [ ] Zapnout Auth providers: Google + Custom token.
- [ ] Zapnout Firestore a Storage.
- [ ] Vytvořit Seznam OAuth aplikaci a získat `SEZNAM_CLIENT_ID`, `SEZNAM_CLIENT_SECRET`.
- [ ] Nastavit callback URL na Function endpoint `/authSeznamCallback`.
- [ ] Deploynout Apps Script a získat `APPS_SCRIPT_URL`.
- [ ] V Apps Script nastavit `SR_SECRET`.
- [ ] Nastavit Firebase Secrets:
  - `firebase functions:secrets:set SEZNAM_CLIENT_ID`
  - `firebase functions:secrets:set SEZNAM_CLIENT_SECRET`
  - `firebase functions:secrets:set SEZNAM_REDIRECT_URI`
  - `firebase functions:secrets:set APPS_SCRIPT_URL`
  - `firebase functions:secrets:set APPS_SCRIPT_SECRET`
- [ ] Do Firestore seednout `allowlist/satny@gvid.cz` (`role: admin`, `active: true`).
- [ ] GitHub secret `FIREBASE_SERVICE_ACCOUNT_PRISPEVKYRODICU` musí obsahovat SA JSON s rolemi minimálně:
  - Firebase Hosting Admin
  - Cloud Functions Admin
  - Firestore Rules Admin
  - Firebase Admin (pro deploy indexes/storage)

## Deploy commands (pinned local tools)
```bash
npm ci
./node_modules/.bin/playwright install --with-deps
npm run lint
npm run typecheck
npm test
npm run build
npm run test:visual
cd functions && npm ci && npm run build && cd ..
GOOGLE_APPLICATION_CREDENTIALS=/path/firebase-sa.json ./node_modules/.bin/firebase deploy
```
