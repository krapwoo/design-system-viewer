`explain --all` writes every page's geometry as JSON, and `layout-diff` reports what a version changed about it.

Layout rules live in this package and reach every consuming project on `update`, while their page files never change. So a release can reshape someone's catalog with nothing in their repository to explain it. 0.7.0 did exactly that: three starter-kit pages moved from side-by-side to stacked, and the only trace a consumer gets is a changelog paragraph they have to read and believe.

```
ds-viewer explain --all > before.json      # on the version you have
ds-viewer explain --all > after.json       # after upgrading
ds-viewer layout-diff before.json after.json
```

```
0.6.11 → 0.7.0, measured at 952px

Layout changes on 3 pages: Banner, EmptyState, Shimmer.

Banner
  its two blocks can no longer share a row
```

The snapshot records what can be decided without a browser: each block's kind, declared size, item count, minimum width, and its column×row geometry at both full and half width — plus, for a two-block page, whether both blocks still fit one row at half width.

That last field is the honest part. `choosePlacement` also weighs a single tall specimen and the height actually saved, and neither is knowable without measuring a real render, so the snapshot reports **eligibility** rather than the outcome. It is the height-independent half of the decision, and it is the half a rule change moves.

Two refusals, both so a wrong answer cannot look like a real one. Snapshots taken at different widths refuse to compare, because geometry at 952px and at 1112px legitimately differs and diffing them would report rule changes that never happened. A file that is valid JSON but not a snapshot is rejected rather than diffed, because treating it as an empty snapshot reports every page as removed, which reads like a catastrophe instead of the wrong filename.

Verified by simulating the change this command exists to catch: with 0.7.0's placement rule loosened back to its pre-0.7.0 form, the diff reported 25 affected pages; against itself it reports none.
