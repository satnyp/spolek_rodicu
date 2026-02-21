# Acceptance (musí projít)

UI
- Login odpovídá `docs/design/prihlasovaci_obrazovka.png`
- Main light odpovídá `docs/design/design_main.png`
- Main dark odpovídá `docs/design/dark_mode.png`
- Settings odpovídá `docs/design/nastaveni.png`

UX
- Prázdná DB: zobrazí se aktuální měsíc + možnost vytvořit request inline
- Timeline rolování do minulosti funguje (lazy load)
- Request list: click-to-edit, lock/unlock, barevné state
- PDF panel: otevře se vpravo až po kliknutí na PDF
- Upload příloh: komprese obrázků ~200–250 KB, fallback max 500 KB + warning

Auth / E2E (funkční)
- E2E testy běží proti Firebase Emulators (Auth/Firestore/Storage/Functions).
- Allowlisted user se přihlásí a dostane se na main/dashboard.
- Non-allowlisted user je po loginu odhlášen a vidí “Nemáš přístup”.
- Requester vytvoří queueRequest a vidí ho v seznamu.
- Accountant schválí queueRequest -> vznikne request + audit log.

Build/CI
- npm run lint
- npm run typecheck
- npm test
- npm run build
