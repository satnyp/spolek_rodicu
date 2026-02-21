# UI Design Spec (source of truth)

## Source of truth
Kanonické design podklady jsou pouze textové soubory v `docs/design/`:
- `docs/design/prihlasovaci_obrazovka.html`
- `docs/design/design_main.html`
- `docs/design/dark_mode.html`
- `docs/design/nastaveni.html`
- volitelně textové reference ve formátu `docs/design/*.svg`

PNG/JPG/PDF nejsou povolené jako referenční baseline.

## Design routes pro testy
Routy:
- `/__design/login`
- `/__design/main`
- `/__design/settings`

Tyto routy slouží pouze pro vizuální/DOM kontroly a musí používat pouze mock data. Nesmí číst ani zapisovat Firestore/Storage.

## Ověření bez PNG diff
Vizuální regrese se ověřuje DOM-based asercemi:
- existence hlavních sekcí (timeline/list/editor)
- `data-testid` na klíčových blocích
- textové nadpisy a role (`button`, `heading`, `region`)
- základní layoutové kontejnery a jejich pořadí

Screenshot diff testy závislé na PNG nejsou součástí kanonického testování.
