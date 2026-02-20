# Acceptance checklist (MVP)

## Automatické kontroly (musí projít)
- npm run lint
- npm run typecheck
- npm test
- npm run build

## Manuální kontrola (preview URL)
### Login
- Login obrazovka odpovídá designu (Google + Seznam tlačítka).
- Přihlášení Google funguje a filtruje podle allowlistu / domény.
- satny@gvid.cz je vždy admin.

### Empty state / měsíce
- Prázdná DB: zobrazí aktuální měsíc + inline create řádek.
- Vytvoření požadavku: klik → editace → vytvoří se záznam a objeví se karta.

### Oprávnění
- Requester může mazat jen své requesty.
- Admin může mazat a editovat všechny.

### PDF panel
- Klik na ikonu PDF otevře pravý panel s HTML preview.
- Preview vypadá jako PDF šablona, ale je to html.
- V preview je i možnost stažení pdf.
- PDF šablona se stáhne až při otevření panelu.
- Download vygeneruje vyplněné PDF.
- PDF se stahuje ke klientovi až klikne na stáhnout na panelu HTML preview, jinak se pdf nestahuje a ani nenačítá (šetří se stahování z databáze)

### Faktury / přílohy
- Upload funguje, obrázky se před uploadem komprimují (~200–250 KB, max 500 KB + upozornění).
- Přílohy se ukládají do Storage a jsou vidět u requestu.
