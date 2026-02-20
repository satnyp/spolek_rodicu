# UI Contract (závazné)

Cíl: UI musí vizuálně odpovídat referenčním předlohám v /docs/design.
Ne “podobně”, ale stejný layout, spacing, typografie, komponenty a stavy.

## Referenční předlohy
- /docs/design/prihlasovaci_obrazovka.html (+ png)
- /docs/design/design_main.html (+ png)
- /docs/design/dark_mode.html (+ png)
- /docs/design/nastaveni.html (+ png)

## Co se musí shodovat
1) Layout grid:
   - sidebar šířka a padding jako v designu
   - topbar výška a layout jako v designu
   - cards (rounded + shadow + padding) jako v designu

2) Typografie:
   - font Inter
   - nadpisy velikosti a váhy jako v designu
   - sekundární text (šedý) jako v designu

3) Komponenty:
   - primární/sekundární tlačítko přesně dle designu
   - status pill (Schváleno/Vyřízeno/Zamítnuto) stejné barvy + radius
   - modal “Hromadná správa oprávnění” layout 3 sloupce + šipky jako v designu

4) Dark mode:
   - barvy pozadí, sidebar, cards, text a hover musí odpovídat dark_mode.html

## Zakázané
- Nevymýšlet vlastní layout nebo jiné komponenty.
- Nepoužívat jiné spacing než design.
- Nevyměňovat strukturu obrazovek (pořadí bloků).

## Povinná evidence v PR
- Screenshoty: login, hlavní obrazovka, settings modal, dark mode.
- Každý screenshot musí být vizuálně srovnatelný s PNG z /docs/design.
