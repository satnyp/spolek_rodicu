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

Build/CI
- npm run lint
- npm run typecheck
- npm test
- npm run build
