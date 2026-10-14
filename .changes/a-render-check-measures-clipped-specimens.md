`doctor --render` gains `specimen-clipped`: an example whose content paints outside the cell the page gives it, where it is cut off rather than reachable.

The check already drove a real browser over every page, and asked it almost nothing: of its seven rules, six read the console. `render-layout`, despite the name, does not measure overflow — it matches an overflow *string* inside a `[Catalog]` warning a component chose to emit about itself. A specimen that silently paints past its cell produced no warning and no finding, which is how a `Tooltip` example that rendered as "to add a stop", with the first word clipped off, passed a clean check.

The rule is not "crosses its cell". It is "crosses its cell with nothing above it that scrolls on that axis":

- `hidden` means the content is lost — the reader sees a cut-off component with no indication anything is missing.
- `auto` and `scroll` mean it is reachable, which is the point of a specimen like `PillRow`'s "Many pills (scrollable)".

That distinction came from calibration rather than from taste. Measured across all 50 starter-kit pages at 1280 and 1728, the naive test reported exactly one page — `PillRow`, 220px outside its cell at 1280 — and it was correct behaviour, not a defect. The ancestor walk runs past the cell to the document element, because what clips a specimen is usually the card above it rather than anything inside it.

Verified against the defect rather than against a model of it: `itemsFill` was temporarily restored to `Tooltip` and the corpus remeasured with the shipped script. Three cells overflowed — `Placement: bottom` (32px), `Top-right arrow` (25px), `Bottom-right arrow` (45px), all leftward, at both widths — and nothing on the other 49 pages moved. Only one of the three had been noticed by eye. With the page as it ships, 50 pages at two widths produce no findings at all.

Like `identical-variants`, the pass is advisory: if its script throws, the page keeps its own findings instead of inheriting a render error.
