# DEPLOY checklist

## User must do (externí konfigurace)
- [ ] Vytvořit Firebase projekt a doplnit `.firebaserc` project id.
- [ ] Zapnout Firebase Auth provider Google.
- [ ] Nastavit OAuth consent + authorized domains pro Hosting URL.
- [ ] Vytvořit Seznam OAuth aplikaci a doplnit `SEZNAM_CLIENT_ID`, `SEZNAM_CLIENT_SECRET`, `SEZNAM_REDIRECT_URI`.
- [ ] Nasadit Apps Script Web App a doplnit `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET`.
- [ ] Nastavit Functions env proměnné.
- [ ] Přidat `satny@gvid.cz` do allowlist se `role=admin`, `active=true` (i když app to vynucuje hard-rule).

## Deploy kroky
1. `npm install`
2. `npm run build`
3. `cd functions && npm install && npm run build && cd ..`
4. `firebase deploy`

## Ověření po deploy
- [ ] Google login funguje jen pro `@gvid.cz` + allowlist.
- [ ] Seznam login vrací custom token pouze pro allowlisted email.
- [ ] Allowlist admin obrazovka dostupná jen adminovi.
- [ ] Upload příloh komprimuje obrázky.
- [ ] Bulk email volá Cloud Function a zapisuje audit.
