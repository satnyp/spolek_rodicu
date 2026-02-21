# Acceptance (musí projít)

## UI / Design contract
- UI implementace odpovídá referenčním HTML v `docs/design/`.
- `/__design/*` routy existují a vrací deterministický mock layout.
- Ověření UI probíhá DOM/role/data-testid asercemi (bez screenshot PNG diff).

## Auth / E2E (funkční)
- E2E běží proti Firebase Emulators: Auth, Firestore, Storage, Functions.
- Allowlisted user se přihlásí a dostane se na dashboard.
- Non-allowlisted user je po loginu odhlášen a vidí „Nemáš přístup“.
- Requester vytvoří `queueRequest`.
- Accountant schválí `queueRequest` a vznikne `request` + audit záznam.

## Build/CI
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e:ci`
- Zakázané jsou screenshot diff testy vyžadující PNG.
