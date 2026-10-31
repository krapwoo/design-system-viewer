Three small fixes to the 0.25.0 additions:
- Reloading the catalog's `sections` (a hot reload) while an unbound documented component is open no longer scrolls its token page back to the top.
- A `MotionSpecimen` spring with no damping now always shows all three swings: each swing is capped at 1.5 s so they finish before the 5 s cut-off, and a config with no `stiffness` uses `Animated`'s default of 100 for its period.
- An `api` excerpt on a token page is no longer shown in its Quick reference card. `api` is for plain component pages, which show it in the Notes and API panel.
