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

## Deploy commands
```bash
npm ci
npm run build
cd functions && npm ci && npm run build && cd ..
firebase deploy
```
