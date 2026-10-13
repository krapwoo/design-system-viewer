`explain` reports the column counts for the layout that will actually render. Two blocks placed side by side get half the row each, but the counts were computed at the full row width and printed as fact — so a page whose blocks the viewer halved was described with a geometry it never had. `explain Banner` claimed 3 columns where the catalog rendered 2, at 270px specimens.

With `--heights`, the placement decision now chooses the width every block is measured at:

    Variants
      5 items (wide) → 1 column × 5 rows.

    Placement
      With heights 600px/600px on a 1280px laptop (952px content width): side, so each
      block gets 462px.

Without `--heights` the placement is still decided in the viewer at runtime, so the counts stay full-width — but they now say so, instead of leaving the reader to assume they are final:

    The counts above are for the full 952px row; side by side each block gets 462px instead,
    which can fit fewer columns. Pass --heights <first>,<second> to resolve it here.

Closes #37.
