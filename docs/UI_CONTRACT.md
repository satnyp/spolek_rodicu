# UI contract (závazné)

1) Žádná prázdná obrazovka: vždy renderuj buď UI, nebo error screen.
2) Layout hlavní stránky je 3-sloupcový dle SPEC.md a předlohy (timeline / list / editor).
3) Editor (pravý panel) se zobrazí jen když je vybraný request. Jinak je skrytý.
4) Prázdná databáze: vždy se zobrazí aktuální měsíc jako nadpis + pod ním prázdný list + "řádek pro vytvoření požadavku".
5) Vytvoření požadavku: inline řádek v listu (klik = edit, Enter = uložit vytvořením).
6) Stavové barvy a prvky musí odpovídat předloze (light + dark).
7) Admin (satny@gvid.cz) má vždy plný přístup. Non-admin může mazat jen své requests.
8) Vizuální shoda: pixel-ish s tolerancí.
Automatický test: screenshot diff s maxDiffPixelRatio = 0.008 (drobné odchylky povoleny).
