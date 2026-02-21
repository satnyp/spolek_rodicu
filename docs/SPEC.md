# sr (Spolek rodičů) — SPEC.md
Verze: 1.0
Repo: spolek_rodicu
Cíl: MVP webové aplikace hostované na Firebase (Hosting + Firestore + Auth + Storage + Functions) s přihlášením přes Google (učitelé) a Seznam (rodiče), řízeným přístupem přes allowlist/role, workflow požadavků + fronta, přílohami, generováním PDF ze šablony a odesíláním informačních emailů přes Google Apps Script.

---

## 0) Základní rozhodnutí a omezení

UI design je řízen souborem DESIGN.md a šablonami v design_html/. UI se má portovat 1:1 z HTML předloh, ne vymýšlet.

### Hosting & stack
- Frontend: Vite + React + TypeScript
- Firebase Hosting (bez vlastní domény)
- Firebase Auth (Google provider + custom token pro Seznam)
- Firestore (data)
- Firebase Storage (přílohy)
- Cloud Functions (HTTP pro Seznam OAuth callback + proxy pro Apps Script)
- Apps Script Web App: pouze SEND MAIL (odesílá z účtu satny@gvid.cz)

### Důraz
- Jednoduché ovládání, rychlost, minimální klikání.
- Bez čtení emailů, bez OCR (jen komprese obrázků).
- Minimalizovat Firestore reads (sidebar nesmí číst tisíce requests).

### Projektové jméno
- Firebase project id zkusit `prispevekrodicu` (pokud obsazeno, zvolit variantu `sr-gvid` / `sr-spolek` apod.). V kódu používat jen `firebaseConfig` dle vytvořeného projektu.

---

## 1) Role, přístup, allowlist

### Role (enum)
- `viewer` — pouze čtení
- `requester` — smí vytvářet nové požadavky do fronty (queue)
- `accountant` — schvaluje frontu, mění stavy, přidává info záznamy, posílá emaily
- `admin` — plná práva, správa allowlistu

### Tvrdé pravidlo (nelze odebrat)
- Uživatel s emailem `satny@gvid.cz` je vždy `admin` a `active=true`.

### Allowlist
- Přístup do aplikace má jen uživatel, jehož email je v allowlistu a je aktivní.
- Google login: navíc musí mít email končící `@gvid.cz`.
- Seznam login: povolen je jen konkrétní email ze seznamu (typicky @seznam.cz; ale allowlist rozhoduje).

### Zamítnutí přístupu
- Pokud uživatel projde loginem (Google/Seznam), ale není v allowlistu nebo je inactive:
  - okamžitý signOut
  - obrazovka “Nemáš přístup — kontaktuj správce.”

---

## 2) Datový model (Firestore)

### Kolekce `allowlist/{emailLower}`
Klíč dokumentu: email lowercase (např. `novak@gvid.cz`)
Pole:
- `emailLower` (string)
- `role` ("viewer"|"requester"|"accountant"|"admin")
- `active` (boolean)
- `label` (string, volitelné — jméno/poznámka)
- `createdAt`, `updatedAt` (timestamp)
- `createdBy` (uid/email)

### Kolekce `users/{uid}`
Pole:
- `uid`
- `email`
- `provider` ("google"|"seznam")
- `role` (z allowlistu)
- `active` (z allowlistu)
- `displayName`
- `photoURL`
- `lastLoginAt`
- `createdAt`

### Kolekce `queueRequests/{id}` (fronta)
Pole:
- `createdAt`
- `createdByUid`
- `createdByEmail`
- `monthKey` (YYYY-MM, default aktuální měsíc)
- `description`
- `amountCzk` (int, v haléřích nebo Kč — zvolit konzistentně; doporučeno int v Kč)
- `status` ("QUEUED"|"APPROVED"|"REJECTED")
- `reviewedAt` (timestamp)
- `reviewedByUid/email`
- `note` (volitelně)

### Kolekce `requests/{id}` (schválené/aktivní)
Pole:
- `createdAt`
- `createdByUid`
- `createdByEmail`
- `monthKey` (YYYY-MM)
- `vs` (string, formát DDMMYYYY + seqNum; např. 120120251)
- `seqYear` (int, např. 2025)
- `seqNum` (int)
- `description`
- `amountCzk`
- `state` ("NEW"|"PAID"|"HAS_INVOICES"|"HANDED_TO_ACCOUNTANT")
- `editorData` (object — údaje vyplňované vpravo; ukládat jen data, ne měnit šablonu)
- `attachments` (array of objects; viz níže)
- `updatedAt`
- `updatedByUid/email`

#### attachment object
- `storagePath` (string)
- `filename`
- `mime`
- `sizeBytes`
- `uploadedAt`
- `uploadedByUid/email`
- `kind` ("invoice"|"other")

### Kolekce `months/{monthKey}`
Aby sidebar byl rychlý:
- `monthKey` (YYYY-MM)
- `label` (např. “leden 2026”)
- `counts` (object): { NEW, PAID, HAS_INVOICES, HANDED_TO_ACCOUNTANT, total }
- `updatedAt`

### Kolekce `events/{id}` (info záznamy v měsíci)
- `monthKey`
- `date` (timestamp nebo string)
- `title`
- `text`
- `type` ("INFO")
- `createdAt`
- `createdByUid/email`

### Kolekce `audit/{id}`
- `ts`
- `actorUid`
- `actorEmail`
- `action` (string)
- `targetType` ("queue"|"request"|"event"|"allowlist"|"mail")
- `targetId`
- `diff` (object)

### Kolekce `counters/{year}`
- `year` (int)
- `nextSeq` (int)

---

## 3) VS generování (DDMMYYYY + pořadí v roce)
- VS se generuje při APPROVE queue -> create request.
- DDMMYYYY je datum schválení (lokální), seqNum je pořadí požadavku v daném roce.
- Implementace: Firestore transaction:
  - read `counters/{year}` (pokud neexistuje, vytvořit s nextSeq=1)
  - vzít seqNum = nextSeq
  - increment nextSeq
  - sestavit vs = DDMMYYYY + seqNum
  - vytvořit request

---

## 4) UI / UX (layout + chování)

### Layout (3 sloupce)
1) Levý úzký sloupec (timeline)
- seznam měsíců od aktuálního směrem do minulosti
- lazy load po stránkách (např. 24 měsíců)
- každý měsíc ukáže mini přehled (total + barevné mini indikátory)

2) Střed (hlavní obsah)
- Nadpis: `Měsíc Rok` (vybraný monthKey)
- Seznam položek v měsíci:
  - requests + events (INFO) v jednom streamu
- Každý request je “card” se světle barevným pozadím dle state:
  - NEW: bílá
  - PAID: světle modrá
  - HAS_INVOICES: světle fialová
  - HANDED_TO_ACCOUNTANT: světle zelená
- Na card:
  - VS vlevo
  - popis
  - částka
  - checkbox pro výběr do emailu
  - ikona zámku (lock)
  - tlačítko “Edit” (otevře pravý panel)
  - tlačítka změny state (jen role != viewer a jen pokud unlocked)

3) Pravý panel (editor)
- Zobrazí se po kliknutí Edit/na obrázek Pdf
- Uvede, který request je aktivní (zvýraznění v seznamu)
- Panel má:
  - PDF náhled šablony (template)
  - formulář polí (editorData)
  - tlačítko Uložit
  - tlačítko Stáhnout PDF (vyplní šablonu a stáhne)
  - upload příloh (invoice JPG/PDF)
  - seznam příloh s možností stáhnout / smazat (dle role)

### Bulk akce: Poslat informační mail
- pokud je vybrán aspoň 1 checkbox:
  - zobrazí se sticky bar s tlačítkem “Poslat informační mail”
- po kliknutí:
  - dialog s výběrem recipientů z allowlistu (filtr: role accountant/admin + ruční výběr)
  - subject default: `SR — Požadavky {month label}`
  - body: seznam vybraných požadavků (VS, popis, částka)
- odeslání jde přes Cloud Function -> Apps Script (odesílá satny@gvid.cz)

---

## 5) PDF šablona (assets)
- Šablona je v repu: `assets/Zadost_fillable_final_toggles_masks.pdf`
- Aplikace ji jen čte jako template (nikdy ji nemění).
- Pro download se generuje nový PDF:
  - předvyplní známé údaje z request + editorData
  - vyplní ANO/NE a přeplatek/nedoplatek dle editorData (pokud pole existují ve formu)
- Implementace:
  - použít pdf-lib
  - při startu v DEV režimu zobrazit “PDF debug”: vypsat názvy všech AcroForm polí (pokud existují)
  - vytvořit `assets/pdf-map.json`:
    - buď mapování form field names -> editorData keys
    - nebo mapování souřadnic (fallback), pokud pole nejsou ve formu dostupná
   
## Design baseline (závazné)
Vzhled UI/UX musí odpovídat /docs/DESIGN_BASELINE.md a referenčním HTML v /docs/design.
Pokud SPEC neřeší vizuální detail, rozhoduje DESIGN_BASELINE.


---

## 6) Přílohy + komprese JPG (cílově ~200 KB)

### Upload pravidla
- povolené: JPG, PNG, PDF
- limit: max 10 MB vstup, po kompresi cíl 200–250 KB (u JPG/PNG)
- ukládat do Storage: `attachments/{requestId}/{uuid}_{originalName}`

### Klientská komprese (povinné)
- Pokud user vybere JPG/PNG:
  - přečíst, opravit orientaci (EXIF), zmenšit max šířku 1600 px (nebo 2000 px pro textové účtenky)
  - převést do JPEG nebo WebP (zvolit JPEG pro kompatibilitu)
  - iterativně snižovat kvalitu, dokud size <= 250 KB
  - pokud nelze dosáhnout cíle bez ztráty čitelnosti, povolit až 500 KB a zobrazit upozornění
- UI zobrazí: “Původní X MB -> Výsledné Y KB”

### Server-side fallback (doporučeno)
- Cloud Function trigger na finalize Storage upload:
  - pokud file > 500 KB a je image, vytvoří “compressed” variantu, origin smaže nebo archivuje
- (toto zajišťuje, že se úložiště nenafukuje, i kdyby někdo obešel UI)

---

## 7) Seznam OAuth (login)
- Implementovat přes Cloud Functions HTTP endpoints:
  - `/auth/seznam/start` -> redirect na Seznam OAuth auth endpoint
  - `/auth/seznam/callback` -> vyměnit code za token, získat /user, ověřit allowlist, vytvořit Firebase custom token, vrátit HTML do popup, které přes postMessage pošle token do openeru.
- Frontend:
  - otevře popup na `/auth/seznam/start`
  - poslouchá postMessage
  - po obdržení tokenu zavolá `signInWithCustomToken`
- Bezpečnost:
  - používat state + PKCE
  - redirect URI je přesně funkční endpoint

---

## 8) Email přes Google Apps Script

### Požadavek
- Email se má odesílat z účtu `satny@gvid.cz` přes Apps Script (GmailApp).
- Web NIKDY nesmí volat Apps Script přímo bez serverové autorizace.

### Implementace
- Cloud Function `mail/send`:
  - ověří Firebase ID token volajícího
  - ověří roli (admin/accountant)
  - zkontroluje, že recipients jsou v allowlistu active=true
  - zavolá Apps Script Web App URL s tajným klíčem (header `X-SR-SECRET`)
- Apps Script:
  - ověří `X-SR-SECRET`
  - pošle email na recipients s textem

---

## 9) Firestore/Storage Security Rules (povinné)

### Firestore rules (princip)
- čtení:
  - jen authenticated user, který je active a v allowlistu
- zápisy:
  - viewer: žádné
  - requester: create `queueRequests`
  - accountant/admin:
    - approve/reject queue
    - create/update requests
    - create/update events
    - send mail audit
  - allowlist:
    - jen admin
  - satny@gvid.cz:
    - vždy admin (v rules + ve FE i v backendu)

### Storage rules
- read/write attachments:
  - jen authenticated allowlisted active
  - write: pouze pro role != viewer
  - delete: accountant/admin (nebo vlastník + accountant/admin)

---

## 10) Minimalizace reads + indexy
- Sidebar používá `months` (ne query přes requests).
- Requests pro monthKey načítat s `where("monthKey","==",selected)` + orderBy createdAt.
- Queue má vlastní view a query jen pro accountant/admin.

- Připravit `firestore.indexes.json`:
  - requests: (monthKey, createdAt desc)
  - events: (monthKey, date asc)
  - queueRequests: (status, createdAt desc)

---

## 11) Milestones (8 kroků, po každém deploy)

### Milestone 1 — Skeleton + Firebase deploy + Google login
Úkoly:
- Vite+React+TS, router, layout 3 sloupce (zatím placeholder)
- Firebase init (hosting, firestore, auth)
- Google sign-in + persistence
Acceptance:
- `firebase deploy --only hosting` nasadí app
- login přes Google funguje a ukáže email v UI

### Milestone 2 — Allowlist + role + “satny@gvid.cz always admin”
Úkoly:
- allowlist kolekce + admin stránka pro správu allowlistu (CRUD)
- gate: bez allowlistu nepustit dál
- satny@gvid.cz je admin “natvrdo”
Acceptance:
- jiný účet než allowlisted se nepřihlásí do aplikace (po loginu je odhlášen)
- satny@gvid.cz vidí Admin/Allowlist stránku a může přidávat uživatele

### Milestone 3 — Seznam login přes OAuth + custom token
Úkoly:
- Cloud Functions endpoints start/callback (state + PKCE)
- FE popup flow + signInWithCustomToken
Acceptance:
- Seznam login funguje a pustí jen allowlisted email
- audit log: LOGIN_SEZNAM

### Milestone 4 — months + timeline + načítání month requests
Úkoly:
- months kolekce a render v levém panelu (lazy load)
- center view pro monthKey: seznam requests + events
Acceptance:
- přepínání měsíců funguje a je rychlé (žádné masivní čtení)

### Milestone 5 — Queue workflow + approve/reject + VS generování
Úkoly:
- requester vytvoří queue request
- accountant/admin approve/reject
- VS generování transakcí + counters
- update months counts
Acceptance:
- vytvořený queue jde schválit a objeví se v requests s VS dle formátu

### Milestone 6 — Request card: lock/unlock + state buttons + editor panel
Úkoly:
- lock timer
- změna state + audit
- editorData form + save
Acceptance:
- viewer nic neupraví
- accountant/admin může odemknout a měnit state a ukládat editorData

### Milestone 7 — Attachments + JPG komprese + Storage rules
Úkoly:
- upload příloh na request
- klientská komprese obrázků + UI info o úspoře
- list příloh + download/delete dle role
Acceptance:
- 5MB jpg se před uploadem zmenší ~ na stovky KB
- příloha je dohledatelná u requestu

### Milestone 8 — PDF generování + email bulk action
Úkoly:
- PDF panel + download vyplněného PDF ze šablony `assets/Zadost_fillable_final_toggles_masks.pdf`
- email bulk action -> Cloud Function -> Apps Script
- audit: SEND_MAIL
Acceptance:
- klik “Stáhnout PDF” stáhne SR_<VS>.pdf s vyplněnými daty
- bulk mail pošle email vybraným recipientům a uloží audit

---

## 12) Deliverables
- Funkční deploy: Hosting + Firestore + Auth + Storage + Functions
- `README.md` (lokální run + deploy)
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`
- `assets/pdf-map.json` + dev nástroj pro výpis PDF field names
- `apps-script/` s Code.gs + instrukce deploy Web App
- základní seed script / instrukce: jak přidat satny@gvid.cz do allowlistu, pokud není automaticky

## UI: Source-of-truth:

“Design je definovaný soubory v design_html/.”

“Implementace v Reactu musí být 1:1 převod layoutu, žádný redesign.”

“Font: Inter, tokens v CSS, stejné spacingy.”



Konec SPEC.md
