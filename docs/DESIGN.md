# UI Design Spec (source of truth)

Tento projekt má pevnou vizuální předlohu. UI se NESMÍ „vymýšlet“, ale musí vycházet z HTML šablon.

## Source of truth
- `design_html/design_main.html` (+ `design_html/design_main.png`) = hlavní obrazovka (light)
- `design_html/dark_mode.html` (+ `design_html/dark_mode.png`) = hlavní obrazovka (dark)
- `design_html/prihlasovaci_obrazovka.html` (+ `design_html/prihlasovaci_obrazovka.png`) = login
- `design_html/nastaveni.html` (+ `design_html/nastaveni.png`) = settings / správa oprávnění

## Design tokens (musí sedět)
Přenést do Tailwind configu a globálů:
- font: Inter (Google Fonts)
- ikony: Material Symbols Outlined (Google Fonts)
- barvy:
  - primary: #1978e5
  - background-light: #f6f7f8
  - background-dark: #111821
- darkMode: class
- border radius:
  - default 0.25rem
  - lg 0.5rem
  - xl 0.75rem

## Layout – hlavní obrazovka
Musí odpovídat `design_main.html`:
- celý app shell: levý sidebar (w-72), horní topbar v content části (search + tlačítka Filtry/Exportovat CSV)
- obsah: sekce "Pravidelné požadavky" (card), potom "Školní rok …" a měsíce (Září 2023, Srpen 2023 …)
- request řádek: avatar bublina, title, subtitle (učitel + datum), částka vpravo, měsíc label, status badge (Schváleno/Vyřízeno/Zamítnuto…)
- pozadí stránky: bg-background-light (light), bg-background-dark (dark)

Poznámka: editor panel (pravý sloupec) je funkční rozšíření – v design referenci není vždy vidět.
V design test route se musí renderovat výchozí stav BEZ otevřeného editoru, aby screenshot seděl.

## Implementační pravidla
- Přenést HTML markup a Tailwind classNames co nejvíc 1:1 do React komponent.
- Nevymýšlet jiné spacingy, jiné border-radius, jiné barvy.
- Nepoužívat nové UI knihovny (shadcn apod.) pro hlavní shell – největší riziko odchylky.
- Všechny obrazovky musí fungovat i bez dat (empty state), ale vizuální layout musí zůstat shodný.

## Deterministické design routes (pro testy)
Přidat routy, které renderují UI se stabilními mock daty:
- `/__design/login`
- `/__design/main?theme=light`
- `/__design/main?theme=dark`
- `/__design/settings`

Tyto routy se používají jen pro vizuální regresní testy.

## Vizuální regresní test
Cíl: pixel-match s tolerancí.
- Playwright otevře výše uvedené routy, nastaví viewport 1440x900, udělá screenshot.
- Screenshot porovná s referencí v `design_html/*.png` pomocí pixelmatch.
- ŽÁDNÉ nové binární screenshoty se necommitují (žádné snapshot .png do testů).
- Při failu uložit diff PNG jen jako artefakt CI (necommitovat).

Tolerance:
- threshold ~0.12
- maxDiffPixelRatio <= 0.01
(je to „pixel-ish“, ne absolutní 1:1)
