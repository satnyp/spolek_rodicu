# AGENTS.md — sr (Spolek rodičů)
Repo: spolek_rodicu

Tento soubor říká agentovi (Codex), jak v repozitáři pracovat, jaké konvence držet a jak projekt vyvíjet tak, aby byl bezpečný, levný na provoz a vždy nasaditelný.

---

## 1) Základní cíle
- Dodržet `SPEC.md` a pracovat po milestonách.
- Po každém milestone musí být projekt **deploynutelný** na Firebase.
- Minimalizovat Firestore reads/writes (kvóty, rychlost, cena).
- Udržet jednoduché UI (3 sloupce: timeline / list / editor).
- Nezavádět zbytečné služby mimo Firebase + Apps Script.

---

## 2) Technologický stack (pevně daný)
Frontend:
- Vite + React + TypeScript
- Routing: react-router (nebo equivalent) – jednoduché routes
- Styling: klidně Tailwind nebo čisté CSS modules (nepřidávat těžké UI frameworky bez důvodu)

Backend:
- Firebase:
  - Hosting
  - Auth
  - Firestore
  - Storage
  - Functions (jen co je nezbytné: Seznam OAuth a mail proxy)

Externí:
- Google Apps Script Web App: pouze odesílání mailů (execute as satny@gvid.cz)

PDF:
- používat `pdf-lib` (vyplnění šablony a download)
- PDF šablona je v repo: `assets/Zadost_fillable_final_toggles_masks.pdf` (neměnit šablonu v repu, jen z ní generovat nové PDF)

Obrázky:
- komprese na klientovi (preferované), server fallback volitelný

---

## 3) Pravidla pro bezpečnost a přístup
- Přístup do aplikace jen pro allowlisted uživatele (Firestore `allowlist`).
- Hard rule: `satny@gvid.cz` je vždy `admin` a `active=true` (v UI i v server logic a v rules).
- Google login: povolit pouze `@gvid.cz` (a zároveň allowlist).
- Seznam login: povolit pouze allowlist email (ověřovat serverově).
- Viewer nikdy nesmí mít možnost změny dat (jen čtení).

Nikdy:
- neukládat žádné tajné klíče do frontendu
- nevystavovat Apps Script endpoint přímo klientovi bez serverového ověření
- nevypínat rules “pro testování” v main branch

---

## 4) Datové konvence (Firestore)
Dodržet kolekce a pole ze `SPEC.md`. Nezavádět alternativní názvy bez důvodu.

Zásady:
- Email vždy ukládat i v lowercase variantě (`emailLower`) pro lookup.
- Používat `serverTimestamp()` pro `createdAt/updatedAt`.
- Všechny mutace důležitých polí logovat do `audit`.

Minimalizace reads:
- Sidebar timeline čte jen `months`, ne `requests`.
- `requests` se načítají pouze pro vybraný `monthKey` s limitem a řazením.
- Pokud je potřeba přehled (počty), držet to v `months.counts`.

---

## 5) UI/UX zásady
- 3 sloupce:
  1) timeline měsíců (lazy load)
  2) list požadavků + info eventů (měsíc)
  3) editor panel (otevírá se jen při editaci)
- Stavové barvy jsou světlé a nerušivé (NEW bílá, PAID světle modrá, HAS_INVOICES světle fialová, HANDED_TO_ACCOUNTANT světle zelená).
- Zámek (lock):
  - default locked
  - unlock na 10 min (timer), pak auto-lock
  - viewer nemůže unlocknout
- Bulk email:
  - aktivuje se jen pokud je vybrán aspoň 1 request checkbox
  - dialog pro výběr recipientů z allowlistu

---

## 6) Práce se soubory (Storage) + komprese obrázků
- Povoleno uploadovat: JPG/PNG/PDF
- Max vstup 10 MB, ale image komprimovat před uploadem.
- Klientská komprese:
  - opravit orientaci (EXIF)
  - max šířka 1600–2000 px
  - iterovat kvalitu, cílit 200–250 KB; fallback 500 KB pokud by text nebyl čitelný
  - zobrazit uživateli “před/po”
- Storage path:
  - `attachments/{requestId}/{uuid}_{safeOriginalName}`
- Metadata ukládat do `requests.attachments[]` dle `SPEC.md`.

---

## 7) Seznam OAuth a Apps Script
Seznam login:
- Realizovat přes Firebase Cloud Functions HTTP endpoints (start/callback).
- Použít state + PKCE.
- V callback:
  - vyměnit code za token (Seznam token endpoint)
  - stáhnout user info (Seznam user endpoint)
  - ověřit allowlist
  - vydat Firebase custom token a poslat do popup okna přes `postMessage`.

Apps Script mail:
- Klient nikdy nevolá Apps Script přímo.
- Cloud Function ověří Firebase ID token a roli (admin/accountant),
  zvaliduje recipients (musí být allowlisted active),
  a až pak volá Apps Script s tajným klíčem.

---

## 8) Struktura repozitáře (doporučená)
- `/src` — frontend
- `/public` — statické soubory (pokud se hodí; PDF může zůstat v /assets a být kopírované nebo served přes bundler)
- `/assets` — šablony a mapy pro PDF:
  - `Zadost_fillable_final_toggles_masks.pdf`
  - `pdf-map.json` (vytvořit)
- `/functions` — Firebase Functions
- `/apps-script` — Apps Script (Code.gs + README)

Neprovádět “velké” refaktory mezi milestonami. Změny držet malé a ověřitelné.

---

## 9) Jak spouštět a testovat
Lokálně:
- `npm install`
- `npm run dev`

Lint / typecheck (pokud je nastaveno):
- `npm run lint`
- `npm run typecheck`

Firebase (později):
- `firebase emulators:start` (pokud připraveno; není povinné v MVP)

Po každém milestone:
- musí projít build: `npm run build`
- musí být možné nasadit: `firebase deploy` (nebo `firebase deploy --only hosting` u čistého FE milestone)

---

## 10) Commit & PR pravidla
- Každý milestone jako samostatný PR nebo aspoň samostatný commit blok.
- Commit message: `M{n}: <short title>` (např. `M2: allowlist gate + admin UI`)
- V PR popsat:
  - co bylo dodáno
  - jak to otestovat
  - jaké config proměnné je potřeba nastavit (pokud vznikly)

---

## 11) Konfigurační proměnné (nepatří do frontendu)
Seznam:
- `SEZNAM_CLIENT_ID`
- `SEZNAM_CLIENT_SECRET`
- `SEZNAM_REDIRECT_URI` (odvoditelné nebo config)

Apps Script:
- `APPS_SCRIPT_URL`
- `APPS_SCRIPT_SECRET`

Nic z toho nesmí být v `src/` jako plaintext.

---

## 12) “Nesmíš zapomenout”
- Vždy vynucovat allowlist před zobrazením dat.
- Vždy logovat důležité změny do `audit`.
- Nezvyšovat reads (sidebar = months).
- Komprese obrázků před uploadem.
- PDF generovat z šablony v `assets/` a stahovat nový soubor, šablonu neměnit.
- satny@gvid.cz je vždy admin.

## Dokumentace (single source of truth)
- Kanonické dokumenty jsou pouze v `docs/`:
  - docs/SPEC.md
  - docs/DESIGN.md
  - docs/DESIGN_BASELINE.md
  - docs/ACCEPTANCE.md
  - docs/AGENTS.md


## UI baseline
UI nesmí být “holé”. Vzhled a UX musí odpovídat /docs/DESIGN_BASELINE.md.
Agent musí ověřit výsledek proti designům (screenshoty do PR).

“Než začneš měnit UI, porovnej výsledek s /__design/* routami.”

“Playwright visual test musí projít v CI (musí instalovat browsers).”

“Zakázáno ‘inventovat’ nové UI komponenty mimo design tokens.”

Zajisti, že design_html je v repu (už máš) + ideálně i PNG náhledy (už máš).
