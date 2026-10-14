# Presentation-fitness rules — specification

**Status:** proposed, not implemented. Written after a review session in which every layout defect
was found by a person looking at a screen, and none by the checks.

## The gap this closes

`renderCheck` drives a real browser over every page and has seven rules. Six of them read the
**console**: `render-error`, `render-catalog-warning`, `render-layout`, `render-failed`,
`render-unavailable`, `render-no-heading`. Only `identical-variants` inspects the DOM, and it
compares fingerprints rather than geometry.

`render-layout` is the clearest symptom: despite its name it does not measure overflow. It matches
an overflow *string* inside a `[Catalog]` warning a component emitted about itself. A specimen that
silently paints outside its cell produces no warning and no finding.

So the viewer has the page open, in a browser, with full layout information available, and asks it
almost nothing. Each rule below measures something already on screen.

Precedent: `device-frame-scale` (0.6.10) is the first rule of this class. It found four
under-declared pages on its first run, three of which a manual 37-page audit had just missed —
because the audit measured the list cell while the frame measured the width actually left for the
device. Mechanical measurement beat careful review on its first outing.

## Shared design

Every rule here follows the pattern `device-frame-scale` established:

- **Measure, never infer.** A finding states a number from the rendered page.
- **Thresholds are calibrated against the whole corpus before shipping.** The first device-scale
  threshold (0.99) fired on a 1.3% reduction nobody could see. A rule that cries wolf teaches
  authors to ignore every rule. Calibration means: run against both catalogs, list every page that
  trips, and justify each one as a real defect or move the threshold.
- **Exemptions are declared in the page, visibly, at the point of the decision** — the
  `intentionalScale` precedent. Never a config file, never a global.
- **Severity `warning`.** `check:catalog` already fails on any finding, so warning is enough to
  block CI without claiming a page is broken.
- **Measured at 1280 and 1728.** A rule verified at one width is verified for one window. Several
  of this session's defects only appear below a breakpoint.

## Rule 1 — `specimen-clipped`

**Build this first.** Pure geometry, no threshold to argue about.

| | |
|---|---|
| Measures | any painted descendant of a specimen whose bounding box crosses its cell's bounds, **where no ancestor between it and the document root scrolls on the crossing axis** |
| Fires when | `child.left < cell.left - 1` or `child.right > cell.right + 1` (1px for subpixel rounding) |
| Would have caught | `Tooltip` — the first States specimen rendered as "to add a stop", with "Tap" clipped off, through a clean check |
| Exemption | none needed; content unreachably outside its cell is never intended |

**Calibrated against the corpus before writing any code.** All 50 starter-kit pages, at 1280 and
1728 — 100 page-widths. Exactly one page tripped the naive "crosses its cell" test:

```
PillRow · "Many pills (scrollable)" · 220px over at 1280, 174px at 1728
```

That is not a defect. The pills sit in an ancestor with `overflow-x: auto`: the content is off the
cell but **reachable by scrolling**, which is the specimen's entire point. So the rule is not
"crosses the cell" — it is:

> **`hidden` means the content is lost; `auto`/`scroll` means it is reachable.** Flag the first,
> ignore the second.

Verified against the real defect rather than against a model of it: `itemsFill` was temporarily
restored to `Tooltip` and the corpus remeasured with the shipped script. **Three** cells overflowed
— `Placement: bottom` (32px), `Top-right arrow` (25px) and `Bottom-right arrow` (45px) — all to the
**left**, at both widths, and nothing else on any of the other 49 pages moved. (I had only noticed
one of the three by eye.)

Those distances correct a figure from the first throwaway probe, which reported 234–274px: it
printed the right-edge delta, which is negative for content overflowing left. The overflow is
25–45px. Worth recording because the larger number looked more alarming and was simply wrong.

One correction this exposed: the clipping ancestor is not necessarily inside the cell. `PillRow`'s
scroller is within it; `Tooltip`'s clipper is the card above it. **The ancestor walk must run to the
document root**, not stop at the cell — a probe that stopped at the cell reported "no clipping
ancestor" for a specimen that was visibly cut off.

| False positives | one known class, scrollable specimens, excluded by the rule above. `PhoneFrame`/`OverlayDemo` do not trip: they render into a bounded viewport inside the cell. |


Message shape:

```
[Catalog] Tooltip (states/bottom): the specimen paints 38px outside its cell.
Its content is wider than the width the page gives it.
```

## Rule 2 — `filled-specimen-is-small`

| | |
|---|---|
| Measures | natural content width of a specimen in a slot declaring `itemsFill`, against its cell width |
| Fires when | natural content ≤ 50% of the cell |
| Would have caught | `Tooltip` at the root cause rather than the symptom — a 40px icon trigger filling a 370px cell |
| Exemption | `itemsFill` is itself the declaration; a page that means it can set `align: 'center'` per item, which the rule should accept as intent |
| Risk | measuring "natural" width requires an unconstrained wrapper, the same technique `TokenRowGroup` uses. Reuse it rather than inventing a second measurement path. |

`itemsFill` is documented as being for "wide block-level components (Banner, Card, Toast,
InputField) rather than small instances meant to sit centered". This rule enforces exactly that
sentence. 25 kit pages declare the flag today, so calibration matters: the expectation is that only
`Tooltip` trips, and any other page that does is either a real defect or a threshold correction.

## Rule 3 — `grid-candidate`

| | |
|---|---|
| Measures | in a token gallery built from `TokenRow`, the painted width of each sample against the row width |
| Fires when | every sample in the stack uses ≤ 25% of the row |
| Would have caught | `Radius` and `Shadow` — six 64px swatches in 1110px rows, with ~440px dead to the right of every note |
| Fix it suggests | `TokenGrid`/`TokenTile`, whose own doc says it is "for tokens whose preview is small and self-contained (radius, shadow, colour, control height)" |
| Exemption | a page that wants rows for an ordered scale declares `intentionalRows`, with a reason |

This one is advisory in a way the others are not: a narrow sample in a row is a judgement about
whether the tokens should be compared side by side. Start it at `info` severity if that proves
noisy, and promote only once the corpus is clean.

## Rule 4 — `block-component-narrow-specimen`

| | |
|---|---|
| Measures | the component's own root style (source-backed, the way `PropsTable` already reads component source) against the page's declared `specimenSize` |
| Fires when | the root carries `width: '100%'` or `flex: 1` and the page declares `compact` or `regular` |
| Would have caught | `Banner` and `Toast` — screen-spanning components drawn at 270px |
| Exemption | `specimenSize` is the declaration; a page that deliberately shows a narrow instance says so with a reason |

I previously told the owner this class was "not derivable — intent, not a property". That was
wrong, and worth recording: a root `width: '100%'` is a readable fact about the component, and the
viewer already parses component source for props. It is not a complete test of "spans the screen",
but it covers the common case without guessing.

## Layout diff across versions

Not a rule — the answer to "if a layout rule changes, how does a consumer find out?"

Layout rules live in the package and reach every consuming project on `update`; their page files
never change. So a release can silently reshape a catalog with no diff in the consumer's repo to
explain it. This session's placement change does exactly that, benignly.

The geometry is already computed: `explain` prints placement, column count and specimen size per
page today.

**Proposal.** `ds-viewer explain --json --all` writes one snapshot per page:

```json
{ "page": "Banner", "placement": "stacked", "blocks": [{ "slot": "variants", "columns": 2, "rows": 3, "specimen": 555 }] }
```

`ds-viewer layout-diff <before.json> <after.json>` prints what changed. Run it in the release
workflow against the previous tag and the changelog can state:

> Changes placement on 3 pages: Banner, EmptyState, Shimmer — specimens 540px → 1110px.

This turns a silent propagation into a reviewable artifact, and it costs little because the
measurement exists.

## Audit harness

Each rule needs the same evidence before it ships: **every page in both catalogs, at 1280 and
1728**, listing every page that trips and why. The dimensions worth capturing are columns, centring
by painted extent, device frames, extra widths, overflow, and `[Catalog]` warnings.

Hold the review server as a tracked background process launched with `node` directly. Servers
wrapped in `tee`/`script` pipes stop between turns — which is what repeatedly took down the review
catalogs during this session and sent me chasing issue #41 for failures it did not cause.

## Sequence

1. `specimen-clipped` — pure geometry, highest value, no calibration argument
2. Audit harness — needed by everything after this point
3. `filled-specimen-is-small` — reuses `TokenRowGroup`'s natural-width measurement
4. `block-component-narrow-specimen` — needs the source reader
5. `grid-candidate` — most judgement, ship last, possibly as `info`
6. Layout diff — independent of the rules; can be done in parallel

## What this does not attempt

- Deciding whether a component "should" be compared side by side. Rule 3 suggests; it does not
  decide.
- Catching "different markup, identical picture". `identical-variants` already proved a fingerprint
  cannot see this — four closed `BottomSheet` phones were genuinely distinct DOM and visually
  useless.
- Replacing a person looking at the screen. Every rule here exists because someone looked, and the
  point is to stop the same class recurring, not to claim the looking is now unnecessary.
