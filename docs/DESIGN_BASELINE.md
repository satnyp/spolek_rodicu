# Design baseline (závazné)

- Zdroj pravdy: textové předlohy v `docs/design/*.html` (+ případně `docs/design/*.svg`).
- Pokud je rozpor mezi `DESIGN.md` a `DESIGN_BASELINE.md`, rozhoduje tento dokument.
- UI se ověřuje bez PNG: kontrola DOM struktury, `data-testid`, textů, ARIA rolí a přítomnosti hlavních layout sekcí.
- `/__design/*` routy mají mock-only režim (bez Firestore/Storage přístupu).
