# Catalog Studio Matrix — Verification (Task 8)

- **Branch:** `feat/catalog-studio-matrix` (base `922dee4f8ec433cd0024b00bcb052827036a16cc`)
- **Date:** 2026-10-06
- **Environment:** `native-preview` Expo web on `http://localhost:5181`, Chrome via CDP. The tab was brought to the front before every measurement: a hidden tab pauses `requestAnimationFrame`, which react-native-web uses to deliver `onLayout`.
- **Spec:** `docs/superpowers/specs/2026-10-06-catalog-studio-matrix-design.md`
- **Plan:** `docs/superpowers/plans/2026-10-06-catalog-studio-matrix.md`

All results below are from the corrected code (after the review correction pass), unless noted.

## Automated checks

| Check | Result |
|---|---|
| `npm run test:catalog` | 17 tests, 17 pass, 0 fail |
| `tsc` error codes in `native/catalog` | Baseline `TS2307 TS2322 TS2875 TS7006 TS7031`; after: the same codes, none new. The baseline cannot resolve `react`/`react-native` types from `native/`, so tsc is weak for JSX. |
| RED evidence | Task 1: `SyntaxError … does not provide an export named 'CATALOG_LAYOUT'`. Task 2: `Cannot find module …/catalogNavigation.ts`. Task 3: `Cannot find module …/comparison.ts`. |

## Rendered matrix (1280×900 unless noted)

| # | Result | Measured |
|---|---|---|
| R1 | Pass | Button: one level-1 heading. Grid 6 rows × 4 columns (headers included), cells 277px, 16px padding on every side. "Other configurations" list: With icon, Trailing icon, Icon-only, Full width, Medium size, Small size; 2 rows × 3 columns, 316px cells; no Loading or Disabled. No document horizontal scroll. |
| R2 | Pass | Badge grid 6×5, 208px cells. Pill grid 3×5, 208px. Avatar grid 4×4, 277px, then a one-item list (Custom colour, 402px). No "Missing example". |
| R3 | Pass | Switch: Variants 1 item; States 4 items in one row, 237px. Banner: two lists, 402px cells, 3 rows each, one blank cell each. |
| R4 | Pass | 1600×900: grid cells 338px, list cells 378px (maximum cell 378px ≤ 402px). Content column 1200px. No horizontal scroll. |
| R5 | Pass | Colors: "Tokens" block, no table, no reference panel. SavedTrips: "Preview" block; switching Map/List changes the content. |
| R6 | Pass | Filter `but` → Button, ButtonGroup, InputClearButton; `zzz` → "No matches"; open page stays Button in both. Clear button: 44×44, 3px focus ring; Enter or click clears and returns focus to the filter field. |
| R7 | Pass | First page (Button): "No previous page", `aria-disabled=true`. Next moves to ButtonGroup (sidebar order). Manifest: "No next page", `aria-disabled=true`. |
| R8 | Pass | `#Badge` opens Badge. `#Nope` opens Button and becomes `#Button`, including when Button is already open. Clicking Card pushes `#Card` and focuses its heading. Back returns to Button; `aria-current=page` follows. |
| R9 | Pass after correction | Sidebar links, pager, filter field, and clear button show a 3px `rgb(201, 215, 255)` ring. Sidebar rows 44px; pager 44×44; filter field 44px. Enter on a focused sidebar link opens the page and focuses the heading (role heading, level 1). Before the correction, Enter did nothing; see Corrections. |
| R10 | Pass | Page `#f6f6f4`; sidebar 264px with `#dddddd` 1px right border; active row `#e9efff` with `#174dc6` weight 700; grid and list cards `#d7d7d7`, 14px radius; reference card `#dddddd`, 12px radius, 20px padding; title 28px, 700, `#181818`; description `#666666`. Props-table and token-row dividers `#e4e4e4` 1px; no sub-1px borders on the Card page. `StyleSheet.hairlineWidth` remains in untouched `DividedStack` (divider, `#dddddd`), `Swatch`, and `PhoneFrame`. |
| R11 | Pass | Framework `#SectionBlock`: one level-1 heading; demo heading is level 2; one grid with "Not supported — B has no disabled look"; no horizontal scroll. |
| R12 | Pass | Metro log: no new errors. Present and pre-existing on the unchanged baseline: `react-native-svg` errors from `Icon.native.tsx` and `Loading.tsx` (product components); warnings for deprecated `shadow*`, `props.pointerEvents`, and `useNativeDriver`. No `[Catalog]` warnings. |

Accessibility tree (Chrome `Accessibility.getFullAXTree`, Button page): the "Button: Other configurations" list owns 6 listitems; the page heading is level 1 and focusable.

## Corrections made during verification and review

| Source | Issue | Resolution |
|---|---|---|
| Rendered check R9 | Enter on a sidebar link did nothing: react-native-web leaves `role="link"` activation to the browser, which only fires click for real anchors. | Links render as `<a href="#Id">`. One history entry per navigation; re-clicking the open page adds none. |
| Review — Critical | Filter clear button: no focus ring, about 14×20px target. | 44×44 target, 3px focus ring. |
| Review — Important | List items not owned by the list (unroled row wrappers). | Rows `role="none"`. |
| Review — Important | `hide` doc stranded above `comparison`, describing the removed column layout. | Doc moved and rewritten for blocks. |
| Review — Important | Props-table and token-row dividers used `#dddddd` hairlines. | `#e4e4e4` at 1px. |
| Review — Important | `aria-current` not in React Native's prop types (portability). | Passed through a typed cast with `href`. |
| Review — Minor | Focus landed on a wrapper, not the heading; unknown fragment on the open page not corrected; stale spacing-use notes and comments. | Fixed. |
| Follow-up review — Minor | Clearing the filter dropped focus to the page; two comments misdescribed the mechanism. | Focus returns to the field; comments corrected. |

## Durable screenshots

| File | SHA-256 |
|---|---|
| `R1-button-1280.png` | `4c33cb0758e368dfeb921b78c31e0b145ade8730676bb69ceb1d52375163db1d` |
| `R1b-button-other-configurations-and-reference-1280.png` | `e5bbafd058e95a6ac1af62c60d6f622885d522bb972b0a1796092269b3bfae22` |
| `R2-badge-1280.png` | `26e6f1936971b84d84040c1504caf2f3247f648dc313c68685b3f8c136ef1755` |
| `R3-banner-1280.png` | `6e0f242a3319c5f2c48ec7a6f0c67af18c00ff7f1802d57bcac1c657c4cef2b0` |
| `R5-colors-1280.png` | `2a9295223783793f8548f067536193402030f113c226394f8af2f88f5c45da58` |
| `R10-visual-system-1280.png` | `238ae158ec7a7f5e064bb185dfe6be18115acf83c4123837a362c1c3bbac473a` |
| `R11-framework-sectionblock-1280.png` | `c729e3a8248a6a4422f89af2dc93a3099f3e7f9508bc3300e092554e0376489f` |
| `composite-reference-vs-R1-1280.png` (layouts reference left, R1 right) | `203c576798cf0f7e941ae0c4d8b418bf9230aae56751a6ee33172408b0106698` |

## Report only (not changed)

- The clear button (44px) overlaps the filter field's 1px top and bottom border; its focus ring extends slightly outside the field. A deliberate cost of the 44×44 target.
- The layouts reference shows a "Two props that combine freely" hint beside the grid label; the spec does not require it.
- Token-gallery pages show no source path. The spec's Required line asks for one on every page, while the approved reference hides the reference panel on token pages. Needs a decision.
- Render-only pages (SegmentedToggle, UnderlineTabs, BottomSheet, Dialog) show a second block reading "No additional states or configurations documented."
- The grid card's border scrolls with an overflowing grid; wide lists have no horizontal scroller below about 870px (outside the desktop/laptop target).
- `VariantSlot.align` is now unused; `grid()` in `CatalogExample.tsx` types its axes as `string`; three files keep an unused default `React` import.
- The framework catalog's diagram chrome still uses host-app tokens, and it does not document `ComparisonGrid`, `ComparisonList`, or `ReferenceDetails`.
- Product components log `react-native-svg` errors on web (pre-existing).

## Independent review

Read-only Claude Opus reviews through the guarded runner (Read, Grep, Glob only). Reviewer output is not stored in the repository.

| Review | Verdict | Findings |
|---|---|---|
| Initial, frozen implementation | BLOCK | 1 Critical, 4 Important, 12 Minor |
| Follow-up, correction pass (bounded to prior findings and touched lines) | PASS_WITH_FINDINGS | 0 Critical, 0 Important, 4 Minor. All prior Critical and Important findings and the controller-found Enter defect resolved. |

Three of the follow-up Minors were fixed afterwards and checked in the browser (see Corrections). Those edits were not re-reviewed, by design: no blocking finding remained.

---

# Revision 3 (Part B) verification

- **Base:** `3e012c4`; Part B uncommitted at the time of checking.
- **Environment:** the same 5181 preview (watch mode), tab in front.

## Automated checks

| Check | Result |
|---|---|
| `npm run test:catalog` | 21 tests, 21 pass, 0 fail |
| `tsc` error codes in `native/catalog` | Unchanged: `TS2307 TS2322 TS2875 TS7006 TS7031` |
| RED evidence | Task 10: `SyntaxError … does not provide an export named 'PREVIEW_MAX_WIDTH'` |

## Rendered rows

| # | Result | Measured |
|---|---|---|
| B1 | Pass | Loading: "Variant × configuration", lists "Loading: Circle" and "Loading: Linear" with 3 items each; cells 277px (1280), 338px (1600), 240px with in-card scrolling (1100); specimens centred within 1px; "Other configurations" with Accent colour. |
| B2 | Pass | SegmentedToggle and UnderlineTabs: frames 402px and 320px with captions; no empty block. |
| B3 | Pass | Dropdown: States beside Variants at 1280 and 1600 (x = 728); below at 1100. Live resize on the open page: side → stacked (1100) → side (1280) → side (1600) → side (1280). |
| B4 | Pass | Switch, Banner, Button stacked; Part A geometry unchanged (Button 277 / 316, Switch 237, Banner 402). |
| B5 | Pass | Button Props two columns at 1280 (label, variant / size, showIcon); one column at 1100; SegmentedToggle (3 props) one column. |
| B6 | Pass | Colors: only "Quick reference" with Source `tokens/palette.ts · tokens/semantic.ts`. |
| B7 | Pass | Framework `#SectionBlock`: no phone frames; one table with the unsupported cell; no horizontal scroll. |
| B8 | Pass | Metro log: only the baseline `Icon.native` / `Loading` errors and existing deprecation warnings; no `[Catalog]` warnings. |
| Regression | Pass | Enter on a sidebar link opens the page and focuses its heading; Back returns; `#Nope` falls back to `#Button`. |

## Screenshots

| File | SHA-256 |
|---|---|
| `B1-loading-1280.png` | `90424aa6f0b9a7edcd5c52dcbe03eb918e9409575845815103710c3cd6a9b750` |
| `B2-segmentedtoggle-1280.png` | `a232bd441bc2e6e3490fb97933814e1eed5cc56a18efe6c35e8f07282d929e31` |
| `B3-dropdown-1100.png` | `f2ead5d713a618e48d86f9d9a540d018fc8b875ef94ecba9721b7d50f4184cf4` |
| `B3-dropdown-1280.png` | `85c0ed5fbfb4048435742ada8a5cdc91f7d99115572e5eff9c89c33eb405a997` |
| `B5-button-props-1280.png` | `34423a4752ae5edecf2544d3beb0a546814eeba64e9c99ce9d83df3d9f22fd05` |
| `B6-colors-1280.png` | `3fb922206d10e59cefade7e531d61b2a3d4f778e8eab81665e91abfaed308a00` |

## Report only

- At 1100px, Loading's grouped rows need 842px and scroll inside their card.
- A two-block page may shift once after load when it moves side by side.
- Each preview frame is its own live instance; state is not shared between frames.

## Independent review (Part B)

Read-only Claude Opus (`claude-opus-5`) through the guarded runner, on the frozen Part B diff.

| Review | Verdict | Findings |
|---|---|---|
| Part B | PASS_WITH_FINDINGS | 0 Critical, 1 Important, 10 Minor |

The reviewer confirmed the placement state machine cannot loop or oscillate, page changes remount it, grouping uses only authored `group` data, and nothing Prohibited changed.

### Correction pass (no re-review: no blocking finding)

| Finding | Resolution | Check |
|---|---|---|
| Important — `types.ts` docs still described Part A (always-rendered blocks, empty sentences, token pages without reference) | Rewritten for revision 3 | Read |
| README "one of three layouts" and token-page sentence | Corrected | Read |
| `CATALOG_SPACE_USE.xl` note | "Preview-card padding; gap between preview frames." | Shown on the framework Spacing page |
| Preview frames indistinguishable to assistive tech | Each frame is `role="group"` labeled "402 · Default phone" / "320 · Small phone" when there are two | Rendered |
| Unmatched `group` key silent | Development warning | Code |
| Dead condition; `hide.variants` alone produced "No examples documented." | Removed; empty block only when nothing is hidden | New unit assertion |
| `PROPS_COLUMN_GAP` not tied to the token | Asserted equal to `CATALOG_SPACE['2xl']` | Unit test |
| `presentationBlocks` recomputed each render | Memoized | Code |
| Redundant wrapper in `ComparisonGroups` | Removed | Rendered (Loading unchanged) |

After the pass: 21/21 unit tests; tsc codes unchanged; Loading 277px cells, Dropdown side by side, Button 277 / 316 at 1280.

### Left report-only

- Recorded heights are kept across a width change (they may be from the previous width). Clearing them reintroduces the mount-order defect found in the rehearsal; the reviewer rates impact low.
