# Design baseline (závazné)

UI/UX musí odpovídat referenčním designům v /docs/design (HTML + PNG). 
Pokud SPEC neřeší konkrétní vizuální detail, rozhoduje tento dokument.

## Referenční obrazovky (grafika, funkčnost dodělat)
- Login: /docs/design/prihlasovaci_obrazovka.html
- App shell light: /docs/design/design_main.html
- App shell dark: /docs/design/dark_mode.html
- Modal správy oprávnění: /docs/design/nastaveni.html

## Povinné UX
- Prázdná DB: zobraz aktuální měsíc jako nadpis uprostřed + divider + inline řádek pro rychlé vytvoření požadavku.
- Levý panel: timeline měsíců (aktuální nahoře), scroll do minulosti.
- Pravý panel jen při editaci / PDF preview; jinak skrytý.
- Admin-only: správa allowlistu/rolí přes UI dle designu.
