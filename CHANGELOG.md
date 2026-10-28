# Changelog

All notable changes to `@krapwoo/ds-viewer` are documented here. Entries are assembled
automatically by `npm run release` from the files under `.changes/`.

## 0.18.0

- The Overview shows only the Components grid (the Usage tab is gone, and an old `#ds-viewer-overview/usage` link still opens the Overview), and every card is now the same height.

## 0.17.0

- A catalog with usage data now has an **Overview** page, first in the sidebar, with a Components tab (a card with a live thumbnail for every page, grouped by area, filterable and sortable) and a Usage tab (a components-by-area table shaded by use count).
- A new `usage` config field points at a JSON file of where each component is used, and every page that has usage now shows an "Appears in" block (uses per area, and the files that use it), with `doctor` flagging usage keys that match no page (`usage-unknown-page`) and a shorter `nothing-to-show` fix. `dev` also watches the usage file, so regenerating it updates the open catalog without a restart.
- On pages that aren't a family, group or token page, the Guidance, Quick reference, Composition and Props now open from a **Notes and API ›** link in the same side panel family members use, and the Overview's Usage table shows each count in an inset chip (empty when zero) while the "Appears in" bars stop stretching past 240px.

## 0.16.0

- `doctor` now warns about a page that is only a built-in part of one other page (`part-own-page`) and a page that shows no specimens (`nothing-to-show`), and a new `standalone: '<reason>'` page field records a deliberate exception (a blank one is reported as `standalone-reason-empty`); pages in a pattern group (`patternGroups`, default `Patterns`) never count as the whole.

## 0.15.0

- A `tokenDefinition` page can now group entries within a section, opens with a jump row when it has more than one section, renders a light/dark color pair as one swatch, resolves its own and its sections' aliases, and gets a `doctor` error (`token-definition-duplicate-kind`) if another page declares the same kind.
- A page can now set `navigation: 'reference'` to stay fully routable but leave the browse lists, which adds a catalog-wide **Source reference** search to the sidebar; a page's Composition names and "also used by" uses now link to their real catalog page when they resolve, with a Back link that returns to where you came from; a family whole's own alias now opens its family page instead of "Page not found"; and every ordinary page now shows its own "also used by" uses, the same way a family member's already did.
- A page with `members` but no `whole`/`sections` is now a group page — each top-level member gets its own section with a jump row, embedded families can carry their own numbered anatomy, and a family can list an external part defined on a group page that links back and forth between the two. `FamilyDef.whole` is now `string | undefined` (undefined on group pages).
- A token page can now opt into `tokenDefinition` — a structured shape for its real entries (name, value, provenance, resolution) across all eight token kinds — instead of a hand-built `render()`, with its own `doctor` checks and each entry's provenance shown as plain caption text (once per section when all its entries share it).
- Family and group page members now open their notes and API in a side panel instead of expanding in place, those pages say what kind of page they are under the description, and standalone pages accept optional `notes`.

## 0.14.2

- A family page's anatomy legend now stays readable in a narrow content pane (e.g. behind a sidebar): it drops below the picture once the card no longer has room for both, instead of squeezing into an unreadably narrow column, and a legend of more than six items now narrows from three to two to one columns rather than staying cramped.

## 0.14.1

- Pages within a sidebar group now sort by their displayed title (falling back to their id when they have none) instead of always by id.

## 0.14.0

- Family pages now show an "Also used by …" line on each member and on the whole, naming other catalog pages that declare they use it. It is derived from the `composedOf` declarations already in your catalog, so nothing new is authored: if a page declares `composedOf: [{ component: 'X', relationship: 'built-in' }]`, then X's own page says it is also used by that page. The member's own parent, its whole, itself and its same-page siblings are excluded, `'slot'` and `'related'` entries derive nothing, and a member nothing else uses shows no line at all. One user shows its role; two or three are listed plainly; more than three show the first three and a plain-text "+N more". `FamilyDef` members carry the result as an optional `alsoUsedBy` array, with the `AlsoUsedByEntry` type exported alongside it.

## 0.13.1

- Catalog components can now be rendered in tests, so defects in component structure are caught by `npm run test:render` instead of only in a browser.

## 0.13.0

- Family pages can now link to other catalog pages via a `relatedPages` list instead of documenting a merely-related component inline, which deprecates non-`inWhole` sections (`doctor`'s new `deprecated-related-section` warning — an error under `doctor.strict` — names every page still using one) and fixes the anatomy legend to stop reserving blank pin-column space for unnumbered rows.

## 0.12.1

- When `dev` repairs a workspace whose files were deleted underneath it, it now restores `.ds-viewer/endpoint.json` too, so the next restart still reuses the same local address instead of coming back on a new port that an already-open catalog page can't reach.

## 0.12.0

- A page title with no spaces (an unbroken component identifier) now wraps inside its own column instead of painting over the previous/next buttons, and `doctor --render` reports a new `page-head-overlap` error when anything covers a page's heading — the one check measured at 800x600, where that overlap appears and the other checks, all running at 1280, never looked.

## 0.11.0

- Catalog pages can now document a family of components on one page with `members`, `whole`, `sections` and an `anatomy` box of numbered parts, with an address and search entry for each member. An address that matches no page now shows a "Page not found" notice instead of silently opening the first page.

## 0.10.0

- Viewer chrome text now follows a fixed set of typography roles instead of ad hoc sizes/weights: the heavier `800` font weight is now `700` everywhere it appeared, uppercase label letter-spacing is consistent across the sidebar, grids, lists and panels, and the italic empty-state notes are gone. A reference card's contents now sit vertically centred — the last Source/Accessibility/Composition row no longer adds a trailing divider and padding on top of the card's own. The sidebar footer's padding is now even top and bottom, so its label sits centred against the divider above it.

  A few visible side effects of moving to fixed roles: the "OS component" badge is now shown in capitals, since the catalog's uppercase role is the closest match; the update page's section heading and version arrow are now bold; non-uppercase table, grid and list captions no longer carry the extra letter-spacing that uppercase text needs; and a couple of lines (the props table's description, a token tile's note) are a pixel or two taller or shorter to match their role's line-height.

## 0.9.1

- The update page no longer shows a red "couldn't prepare the update" error when the viewer itself isn't running or was just restarted — it now shows a calm note ("The viewer isn’t running"), disables the unavailable action, and reconnects itself in place, with no reload, once the viewer is reachable again. Restarting `dev` now reuses the same local address across the restart, so this is the common case; if the address can't be reused, the page falls back to a "still isn’t answering" state with a manual **Reconnect** button.

## 0.9.0

- `update` no longer treats a `package.json`/`package-lock.json` as uncommitted when the only
  difference from the last commit is a previously-finished bump to the version already installed —
  it now offers the regular **Update now** instead of refusing.

## 0.8.0

- `explain --all` now writes a deterministic JSON layout snapshot for every statically readable catalog page, and the new `layout-diff <before.json> <after.json>` command explains viewer-owned layout changes across package upgrades. This makes changes visible even though a consumer's `.catalog.tsx` files remain unchanged.

  Snapshots record block identity, order, minimum width, responsive list and token-section geometry, and static side-by-side eligibility. Final placement can also depend on measured browser height, so the command deliberately reports eligibility rather than claiming an unmeasured side-by-side or stacked outcome.

  `layout-diff` refuses malformed or duplicate-page snapshots and snapshots captured at different catalog content widths, including in `--json` mode, so an incomparable input cannot produce a plausible but incorrect report.

## 0.7.0

- A repair now restarts Metro, because rewriting the files was not enough. 0.6.11 claimed "Metro picks the files back up without a restart; the catalog keeps serving" — that held in a staged test and was wrong in the wild. Observed four times since: the files came back, and Metro went on answering every request with

      Unable to resolve "expo" from "entry.tsx"

  because it had already cached a module map that no longer matched the directory. The catalog stayed blank until someone restarted the server by hand, which is exactly the interruption the repair exists to prevent.

  The server now restarts Metro as part of the repair and says so:

      Restarting Metro so the catalog picks the files back up — the page reloads itself in a few seconds.

  The server itself stays up and the page reloads itself. The respawn waits for the port to come free before starting Metro again — it is not free the instant the old process exits — and says so if it is still held after the wait, rather than letting Expo quietly move the catalog to a port the dev lock does not name. The restart is bounded by the same five-repair cap, so a continuous deleter cannot turn it into a restart loop.

  Verified by deleting all eight generated files from a serving catalog: the files came back, Metro restarted on the same port, and the catalog rendered 50 pages with zero console errors — with no manual restart.

  The cause of the deletion is still unidentified (#41). A sixth theory died this round: a render check running beside a live server was the obvious suspect, but fingerprinting the live workspace across one proved every file byte-identical, with no repair triggered.
- The starter kit's `Motion` page gives each kind of token its own card, and lays a spring out as the config object it is.

  Duration, loop duration, easing and spring shared one card, so four different things — a scale in milliseconds, another scale in milliseconds, a set of bezier curves, and a config object — read as one long box. They are now four `tokenSections` cards. That also fixes a heading that was centred while the other three were left-aligned, which was not a choice: that one group was missing `align="left"`.

  The spring section was laid out as a wrapping grid of six fixed-width fields, which broke `restDisplacementThreshold` mid-word and orphaned the sixth field on its own row. It is now a table: the field names read down, and each spring token is a column. The field vocabulary is fixed at six and the number of tokens is what grows, so a second spring adds a column rather than repeating all six names, and `damping` can be compared across tokens along one line. The preview and the "when to use" note are rows of their own instead of loose content under a grid.

  `Tooltip` drops `itemsFill` from its states. That flag is for "wide block-level components (Banner, Card, Toast, InputField) rather than small instances meant to sit centered" — a floating bubble on an icon trigger is the second kind. Filling pinned each trigger to its cell's left edge, and the bubble, which centres on its trigger, overflowed the cell: the first specimen rendered as "to add a stop" with the first word clipped off.
- Token pages put each token's note where it can be read against its specimen, and small self-contained previews are tiles rather than rows.

  `Radius` and `Shadow` use `TokenGrid`/`TokenTile`, which is what that component exists for: "tokens whose preview is small and self-contained (radius, shadow, colour, control height)". Six radii side by side can be compared against each other, which is the only way to read a scale; one per row, 100px apart, cannot. `Shadow` also gives each tile a tinted stage to cast onto — an elevated white surface on the catalog's own white card was, accurately, invisible.

  `Font`, `Typography`, `Spacing` and `Motion` keep their rows, because a type sample and a spacing bar need real width, but the note now sits beside the specimen instead of beneath it. The column it sits in is measured from the widest sample in that stack (`TokenRowGroup`) rather than fixed: a fixed column has to be wide enough for the largest sample a page might hold, which strands every smaller one. A font-weight sample is ~110px, and in a column sized for an 88px display sample its note sat 700px away.

  Measured, each page now fits its own content — the Font page's column is as wide as a font weight, the type scale's as wide as `display`, the internals type scale's as wide as `pageTitle` — and the notes stay aligned in one column to read down. The width only ever grows, so it settles after the first layout.
- Two blocks stack by default, and share a row only when sharing costs nothing.

  Side by side used to be taken whenever it saved 120px of height. That is how `Banner` ended up drawing five full-width banners in a 462px column: the saving was real, and the specimens were half the width the component is ever used at.

  Stacked is now the default, and a split has to earn the space. Two things earn it:

  - **A single tall specimen.** One specimen taller than the column is wide leaves a long empty strip beside it — an open `Dropdown` is 738px tall in a 462px column — and the other block fits there for free.
  - **Both blocks still fit one row.** Specimens small enough that each block is a single row at half width lose nothing by sharing it.

  Deliberately stricter than "the same number of rows as a full row would give": with the default three-column cap a block can already be two rows at full width, and two wrapped rows staying two wrapped rows is not a reason to halve every specimen on the page. That looser rule was written first, and a rendered pass caught it — `EmptyState` and `Shimmer` kept sharing a row when they should not have.

  Both blocks must still keep their minimum width in half a row, and the result must still save real height; side by side that saves nothing is just a narrower page.

  Across the starter kit this changes three pages and leaves the rest alone: `Banner` (specimens 540px → 555px), `EmptyState` (540px → 1110px) and `Shimmer` (270px → 555px) now stack, while `Dropdown` and `TextArea` keep sharing their row.
- `doctor --render` gains `specimen-clipped`: an example in a list card painting past the left or right of its cell, where it is cut off rather than contained.

  The check already drove a real browser over every page and asked it almost nothing: of its seven rules, six read the console. `render-layout`, despite the name, does not measure overflow — it matches an overflow *string* inside a `[Catalog]` warning a component chose to emit about itself. A specimen that silently paints past its cell produced no warning and no finding, which is how a `Tooltip` example that rendered as "to add a stop", with the first word clipped off, passed a clean check.

  The rule is not "crosses its cell" but "crosses its cell without being held by anything between it and that cell". Content inside something that scrolls (`auto`/`scroll`) is reachable; content inside something that clips (`hidden`/`clip`) is the component's own doing — a carousel, a shimmer sweep, a card rounding its corners. Either way the specimen is containing its own overflow, and the page is not at fault.

  The walk stops at the cell deliberately. Looking past it consults the catalog's own chrome: `ComparisonGroups` wraps every grouped card in a horizontal `ScrollView`, so a walk to the document element would find that scroller above every grouped cell and exempt all of them.

  Two limits worth knowing. Treating `hidden` as containment means a full-width component clipping its own corners hides a genuinely too-narrow cell from this rule — that is the price of staying quiet about carousels. And only horizontal crossings in `role=list` cells are measured: a cell's width is what the page allocates, while its height grows with content, and matrix (`ComparisonGrid`) cells are not visited.

  Calibrated before shipping rather than after. Across all 50 starter-kit pages at 1280 and 1728 the rule reports nothing; with `Tooltip`'s `itemsFill` restored it reports exactly its three cells — `Placement: bottom` (32px), `Top-right arrow` (25px), `Bottom-right arrow` (45px), all leftward, at both widths. Only one of the three had been noticed by eye.

  Like `identical-variants`, the pass is advisory: if its script throws, the page keeps its own findings instead of inheriting a render error.

- `doctor --render` takes `--port`, so the check can be steered off a port something else is holding.

  The check starts its own `dev` on the first free port from 5181 and had no way to be told otherwise. That is fine alone and bad in company: run it while another project's catalog is on that range and the two contend for the same port. Observed — a run that collided with another catalog on 5182 reported **257 errors**, every one `ERR_CONNECTION_REFUSED`, naming this project's pages for a server that was never this project's.

  ```
  ds-viewer doctor --render --port 5190
  ```

  A port that cannot be a port is refused rather than ignored. Silently falling back to a self-chosen port is how the 257-error run happened in the first place: a check that renders against something other than what you pointed it at reports another server's pages as your failures.

  What this does *not* fix, and is worth knowing: `waitForServer` accepts **any** HTTP reply on the port as proof the catalog is up — its own comment says so. A stranger's server still satisfies it. The flag lets you avoid the collision; it does not let the check notice one. Telling the two apart needs its own change.

## 0.6.11

- A running `dev` notices when something deletes its workspace, and writes it back. The server owns the generated files under `.ds-viewer/` and nothing else should remove them — but something does, rarely, and the symptom was badly misleading:

      ConfigError: Cannot resolve entry file: The `main` field defined in your package.json
      points to an unresolvable or non-existent path.

  That names the *project's* `package.json` — a file the developer never touched and which is perfectly fine. The catalog would sit there broken, blaming the wrong file, until someone thought to restart it.

  The server now checks its own workspace every few seconds, and when the defining files are gone it says what happened and rewrites them:

      Something outside this server deleted package.json, app.json, tsconfig.json,
      metro.config.js, entry.tsx from .ds-viewer/. Rewriting them — your project is fine,
      this is the catalog's own generated workspace. If the catalog looks broken, reload
      the page.

  Metro picks the files back up without a restart; the catalog keeps serving.

  The repair is capped at five per run. If something is deleting continuously, rewriting forever would hide it behind a repair loop, so past the cap the server stops repairing and keeps reporting, with a link to issue #41.

  This is a mitigation, not a fix. **The cause is still unidentified** — see #41, where four theories have been eliminated (duplicate `dev` servers, render-workspace clobbering, directory replacement, and the viewer's own deletion code), and filesystem instrumentation showed every observed removal correctly scoped to the workspace that owned it. What this change does is make the failure name itself and recover, instead of pointing at an innocent file.

## 0.6.10

- A `PhoneFrame` that has to shrink now says so. Any example given a cell narrower than the 375px device scales the whole phone down, and its own body text shrinks with it — which is no longer the size anyone reads the component at. The frame already computes that scale to lay itself out, so it now warns when it drops below 95%, naming the page, the example and the cell width:

      [Catalog] BottomSheet (variants/content-only) is shown at 75% of device size: its cell is
      283px, narrower than the 375px device. Declare a larger specimenSize so the example keeps
      the width it is used at.

  `check:catalog` fails on any `[Catalog]` warning, so an under-declared page is caught in CI rather than by someone noticing that a screenshot looks cramped.

  The threshold is 95%, not 100%: a regular cell leaves 370px for a 375px device, and warning about a 1.3% reduction nobody can see would only train authors to ignore the warning.

  Where the scaling is the point — a page documenting that a narrow cell shrinks the device rather than reflowing it — the example declares `<PhoneFrame intentionalScale>`. The exemption sits in the example itself, visible where the decision was made, rather than in config.

  This found four pages whose phones were being rendered at 75%: `BottomSheet`, `Dialog`, `OverlayDemo` and `PhoneScreen`. All four now declare `specimenSize: 'wide'`.
- `BottomSheet` declares `specimenSize: 'wide'`. Every example on that page is a phone, and at the default size its two blocks shared the row, dropping each cell to 270px and squeezing the frame until the sheet's own title and body text were barely readable. The page now stacks at full width, with each phone at 555px — the width the sheet is actually used at.
- `explain` reports the column counts for the layout that will actually render. Two blocks placed side by side get half the row each, but the counts were computed at the full row width and printed as fact — so a page whose blocks the viewer halved was described with a geometry it never had. `explain Banner` claimed 3 columns where the catalog rendered 2, at 270px specimens.

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

## 0.6.9

- Only one `dev` serves a project at a time. A second one now refuses, naming the pid and port of the one already running, instead of starting beside it and sharing its generated directory. Two servers both rewrote `entry.tsx`, `package.json`, `app.json`, `metro.config.js` and `tsconfig.json`, and the loser was left serving a workspace that no longer described it — which Expo reports as an unresolvable `main` field, naming neither the other server nor the shared directory. To run two deliberately, give one its own directory with `--workspace-dir`.

  The ownership is a small `dev-lock.json` in the workspace holding the owning pid and port, released on exit, on a signal, and before a restart replaces the process. A lock whose process is gone owns nothing, so a crashed `dev` never blocks the next one, and a half-written one is ignored rather than throwing. Each workspace directory has its own lock, so `doctor --render` — which owns `.ds-viewer-render/` — still runs beside an open catalog.
- `Banner` and `Toast` declare `specimenSize: 'wide'`. At `'regular'` their two blocks fit side by side, which halves the row and rendered every specimen about 270px wide — a quarter of the page, for components that span the screen. A 402px minimum means a block no longer fits in half a row the same way, so the specimens keep a width these components are actually used at.
- `Surface` is renamed `SurfaceScope`, and its page now shows the reason it is a component at all rather than just the `surface.*` tokens it paints with. It does two things: it fills a View with `surface.white` or `surface.main`, and it publishes that tone to everything inside it. The second half is what a token cannot do — `DS_SEMANTIC.surface.*` already holds the values, but a value cannot tell a descendant what it is sitting on, which is how `FieldContainer` and `InputField` choose between a recessed fill and an opaque white one. The name now says it is a scope rather than a surface, so it no longer reads as a component version of the token group.

  The page gained a states group putting the same `InputField` inside each tone, so the fill really changes between the two cells instead of the page asserting that it would.

  Starter-kit files are copied once by `init` and never touched again, so an existing project keeps its own `Surface.tsx` and is unaffected. Only new copies get the new name — and `kit diff Surface` will no longer find a counterpart, because the path moved.

## 0.6.8

- `update` refuses when the package is installed from local source instead of the registry — a `file:`, `link:`, `workspace:` or `portal:` spec, or a bare path. Installing a published version over one of those replaces the checkout the project deliberately points at, and the catalog keeps running while no longer reflecting the source being edited, which is hard to notice. The refusal names the spec it found and how to proceed either way; `--force` does not override it, because it exists for uncommitted files rather than for changing where the package comes from. The update page's Update now refuses identically, reported as a failed install step so the page offers its normal recovery rather than appearing to succeed.

  The upgrade also keeps the package in whichever section `package.json` already declares it in, instead of always writing a devDependency — a host app that ships it as a runtime dependency no longer silently changes section by accepting an update.

## 0.6.7

- A filled specimen whose root spans its cell now stays full width instead of being centered at its narrower painted width, and a fixed-width `Preview`'s contrast stage now covers its whole padded card rather than only each frame.

## 0.6.6

- `npm run release` keeps a note's later paragraphs inside the bullet that note became. Only a note's first line gets the `- ` marker, and the rest were left at column 0, so a multi-paragraph note rendered as one bullet followed by detached top-level prose — three consecutive releases had their CHANGELOG entry corrected by hand before this was fixed. The entry assembly moved into `scripts/changelogEntry.mjs` so it can be tested without running a release.

## 0.6.5

- The internals catalog documents the four components its own cells are built from — `SpecimenSurface` (the cell backing, with the `auto` rule shown against an example that needs it and one that doesn't), `SpecimenContent` (the phone-width cap, the centring of a narrow filled example, and all three explicit alignments), `TokenTile` and `SpecimenAddressProvider`. The three comparison layouts and `CatalogShell` now declare these in `composedOf`, so a page says what it is actually made of. `doctor` is clean across both catalogs.

  `SpecimenContent` and `SpecimenAddressProvider` stay out of the package's public exports: they are documented from the source tree, because a catalog page is a reason to explain a component, not a reason to widen an API.

## 0.6.4

- Every component page in both catalogs now documents when to reach for it, and what its accessibility actually does — `doctor`'s `missing-guidance-or-a11y` is clean, where before 30 pages rendered a visible "No usage guidance documented." or "No accessibility notes documented." placeholder to the reader.

  The three comparison layouts now state the rule that decides between them, which the catalog had never said out loud: one axis is a `ComparisonList`, two axes whose columns mean the same thing in every row are a `ComparisonGrid`, and two axes where the second belongs to each variant are `ComparisonGroups`. Each page names the others, so arriving at the wrong one leads you to the right one.

  Where a component genuinely has no special accessibility handling, the note says so and says what that means for the reader — for the scale galleries, that every value is real text beside the bar rather than being carried by the bar's length.
- The starter kit's last four preview-only pages now name their real variants instead of showing one unlabelled demo: `SegmentedToggle` (two options, an icon per segment, a badge beside a label-only segment, and the thumb at each end of the track), `UnderlineTabs` (labels only, a leading icon, a badge, and the underline at each end), `BottomSheet` (content only, a TopNav header, a header with a Dock footer, and content long enough to scroll) and `Dialog` (two actions, one action, title and actions only). The overlay examples start open, because a closed one is the same empty phone and trigger in every cell, whatever it is named for. `doctor`'s `preview-only-component-page` is now clean across both catalogs.

## 0.6.3

- `doctor --render` no longer disturbs a catalog you already have open. It starts its own `dev` server, and that server now has its own generated directory (`.ds-viewer-render/`, which `init` gitignores beside `.ds-viewer/`) and no local update endpoint (`dev --no-update-endpoint`). Before, both servers wrote the one `.ds-viewer/` workspace and the last writer decided what was in it: the check wrote its own short-lived endpoint there and exited, leaving the open catalog calling a port that had died with it — reported on the update page as "Couldn't reach the viewer's local server. If this keeps happening, restart npx ds-viewer dev," against a server that was perfectly healthy. The update page's actions (Check now, Update now) now keep working across a render check.
- A refusal the page is allowed to read — a wrong secret (401) or an unknown route (404), where the endpoint's Origin check has already passed — now carries the `Access-Control-Allow-Origin` header. Without it the browser blocked the response and the update page could not tell a wrong secret from a server that was not running: both arrived as the same opaque network failure, which is what disguised the stale port above. A rejected or absent Origin still gets no CORS headers at all.
- `doctor --render` waits for the catalog's sidebar before it starts opening pages, instead of reading the page once as soon as the server answers. A workspace Metro has never bundled takes longer the first time, and an empty read was reported as a catalog that failed to render. `startDev` likewise waits for the catalog to answer before the first navigation: it used to resolve as soon as `dev` printed the port, which `dev` does before it spawns Expo, so the first page load raced the bundler.

## 0.6.2

- `explain` now reads a page's `previewLayout`, so a `previewLayout: 'table'` preview is priced with the table card's own chrome (a 1px border and `cellPadding` around each frame, 34px) instead of the frames card's (24px padding and a border, 50px). A `previewLayout` the reader cannot resolve to a literal makes the page not statically checkable, the same rule a slot's `maxColumns` follows, rather than letting the CLI report a minimum the viewer does not use.

## 0.6.1

- `CatalogButton` gains `disabled` (flat grey, not pressable) and `busy` (its own colours, a spinner before the label, and no second press), both reported through `accessibilityState`. The update page now uses it for every action — Check now, Update now, Try again — instead of its own copies, which had kept the 22px black pill the button moved away from. Two new tokens, `controlDisabled` and `controlDisabledText`, carry the disabled colours.

A `specimenSize: 'page'` example no longer centres when its painted content is narrower than the cell. That centring is for a small control adrift in a wide cell; a page-width cell holds a layout, whose content sits at the left of its own measure, and centring collapsed it to whatever it happened to have painted — which is why the four UpdatePanel examples rendered at four different widths.

When the catalog is open through a tunnel or a LAN address, the update page now says so instead of blaming the local server: the viewer only takes actions from the machine it runs on, because that endpoint installs packages and restarts the server.

## 0.6.0

- A `variants`/`states` list now measures the space it actually has instead of assuming a laptop's content width, so a list inside a narrower container (an example cell, a split layout) shrinks its columns rather than being cut off, and it never overflows while it waits for its first measurement.
- Every specimen card now fills the column it is given, with its columns or cells sharing that width equally, instead of stopping at 402px each: a two-column grid is as wide as a five-column one, and a two-item list no longer floats centred in a short card. Phone width still caps the specimen inside a cell, which is where that limit belongs. Two blocks placed side by side now split the row into two equal columns — the arrangement is chosen when both blocks keep their minimum width there and it still saves at least 120px of page height.
- Filled examples (fields, dropdowns, full-width buttons) are at most 370px wide, a phone's content width, and centred, however wide their cell. Other examples keep their own width.
- New `specimenSize: 'page'` for components wider than a phone: example cells are at least 512px wide and share the row instead of stopping at phone width (402px).
- The DS Viewer internals catalog (`npm run viewer:dev`) covers every viewer export, including PhoneFrame, PhoneScreen, OverlayDemo, CatalogButton, MotionSpecimen, TokenGrid and TokenSections, with Tokens and Components groups. `VersionStatus` and `AutoCheckSource` are now exported types, for `UpdatePanel`'s `versionStatus` prop.
- The catalog's own type scale uses only 10, 12, 14, 16, 18, 24, 28, 32 and 40 px (table headers and panel headings 12, the sidebar name 18, the update page's version numbers 24). `CatalogButton` is a rounded rectangle, with the primary button in the catalog's accent blue.
- `doctor --render` gains `identical-variants`: two examples in the same card whose specimens render identically, which means the difference their names claim isn't visible — usually a cell too narrow to show it, or a prop that was never wired up. The fingerprint covers each specimen's whole subtree, including a `PhoneFrame`'s child document and a field's value, but not the caption that carries the variant's own name; two examples differing only in colour (default versus disabled) are not reported. `TokenSections` also warns in development when it is asked for more columns than its measured width can fit, instead of quietly rendering one.
- `doctor` gains `preview-only-component-page`: a warning when a component is documented by a `render()` preview alone, with no named variants, states or comparison — the case where nothing is captioned and several other checks have no example to read. Token galleries and pages that declare `intentionalStaticPreview` are exempt. `hide: { accessibility: true }` no longer silences the missing-`a11y` warning either: hiding the section removes the visible placeholder, not the need to document the behaviour. A page can also declare `internalProps: { size: 'why' }` for props a parent passes rather than the reader choosing, which exempts just those props from `option-not-covered`. A key that names no prop of the component is reported as `internal-prop-unknown`, since it exempts nothing as written — unless the component inherits props from a node_modules base, where an absent name is expected.

## 0.5.0

- New `PhoneScreen` (a whole app screen in a phone: header and footer pinned, scrolling body between, a floating layer for toasts) and `OverlayDemo` (a phone with a catalog button that opens a sheet, dialog or toast). The starter kit's overlay and screen demos use them.
- `doctor` warns (`overlay-without-device-frame`) when a component opens a React Native `Modal` but its page shows it outside a phone frame, where it would cover the whole catalog page.
- `npx ds-viewer doctor --render` opens every catalog page in a headless browser and reports console errors, pages that don't render, and examples that overflow their cells, with `--json`, `--ci` and `doctor.strict` support. It needs `puppeteer` in your project.

## 0.4.9

- After an update, the update page no longer stays on the result: it shows as a note at the top (success, or a failure with a button that recovers from the failed step), and Check now, the automatic-check switch and newer updates keep working below it.

## 0.4.8

- In development, the viewer now warns in the browser console when an example is wider than its cell (naming a wider `specimenSize`), ignoring what scrolling or clipped areas hide. Filled examples are centred by what's actually visible, so a tooltip or a fixed-width skeleton inside a full-width wrapper no longer sits against the edge.
- The starter kit's catalog is organised by the page guide: Tokens, then every component in one A–Z Components group, then Patterns (whole screens) and Reference. `init --new` writes that order. Every component that renders or slots other kit components, and every pattern, lists its composition, and full-width components show their examples 3 across. `doctor` now type-checks pages with the project's own tsconfig even when the pages live outside the project folder.
- `PhoneFrame` is now a real device: demos lay out in an iPhone SE viewport (375 × 667 points), scaled down only for a narrower cell, and in the browser each opens in its own device-sized document so sheets, dialogs and pickers open inside the phone instead of over the catalog. Full-width examples wrap at most 3 across (was up to 4 on wide windows), filled examples with their own fixed width are centred, and single-width previews are centred in their card.

## 0.4.7

- A new opt-in `BoundedOverlayViewport` gives a modal/sheet/portal specimen a same-origin bounded browsing context — a maximum width that still shrinks to its real owning cell, and an exact height — instead of letting the overlay portal into and cover the whole catalog page; Sheet's full-height and TimePickerModal's open examples now use it.
- The reference panel now stacks or widens to two or three columns (Guidance, Quick reference, and — only with confirmed composition — its own Composition column) based on its actual measured inner content width instead of always using two; Quick reference and Composition put each label above its left-aligned description or value; a composition entry's label now drops the redundant "· built-in" suffix (slot/related entries keep theirs); a `fill` specimen's content now stretches to its wrapper's full width by default instead of centering (so an auto-sized full-width example keeps its own measured width), while a capped-width `fill` example (e.g. a phone-frame preview) centers itself; a non-`fill` specimen now centers horizontally even when its own root sets `alignSelf: 'flex-start'`, keeping its intrinsic width; and `variants`/`states` items (and, for a directly-authored grid, its cells) can now override their own `surface`/`fill`/`align` independently of the page's defaults, with an item's explicit `fill: false` always winning over an inherited `itemsFill: true`.

A `render()` page can now opt a numeric-width Preview into `previewLayout: 'table'` — every width shares one bordered, captioned card instead of each getting its own separate frame — while a `'full'` preview width or a token gallery keeps today's `'frames'` presentation regardless.
- `doctor`'s `missing-composition-suggestion` now only suggests names the viewer accepts in `composedOf` (a detected component or a page), once per component per page; the starter kit's pages declare their real composition. If you use `doctor.strict: true`, the new advisories from this release count as errors until you add `composedOf` (or leave `strict` off while you review them).
- `npx ds-viewer doctor` now also reports three conservative, source-backed advisories — `missing-composition-suggestion`, `degenerate-grid-axis`, and `missing-working-preview` (suppressible per page with `intentionalStaticPreview`) — each a warning that suggests from real JSX/prop evidence without ever overriding an author's own `composedOf` or examples.

## 0.4.6

- The sidebar always shows the installed version and opens the update page, which now says whether you're on the latest version, automatic checks are off, or npm couldn't be reached, and offers **Check now** and a switch for automatic checks (saved per project, for you only, on this computer). `doctor` honours the same switch.
- The viewer's update page now shows "What's new" and the release date: each release publishes its CHANGELOG notes as a GitHub release.

## 0.4.5

- Example cells now turn light gray automatically when their example is white or near-white with no visible border (a white card, sheet or neutral banner), instead of 0.4.4's gray backdrop behind every example. Other cells stay white, as in 0.4.3. `specimenSurface` defaults to `'auto'`; `'neutral'` forces every cell gray and `'transparent'` keeps them white.

## 0.4.4

- Catalog pages can now cap a one-axis slot's columns with `maxColumns`, set a page-level `specimenSurface` ('neutral'/'white'/'dark'/'transparent') behind every live specimen, disclose structured composition via `composedOf` (shown as a "Composition" subsection in Quick reference), and demonstrate motion tokens with the new reusable `MotionSpecimen` (replay button, reduce-motion aware); `TokenRow` also gained balanced vertical padding.

## 0.4.3

- Pages can set a display `title`, a `source` file for pages that document something other than a component (e.g. a token file), and `osComponent: 'full' | 'partial'`, which shows an "OS component" badge under the title.
- Token pages can now split into titled sections (`tokenSections`, side by side with `tokenColumns`), show tokens as tiles in columns (`TokenGrid`, `TokenTile`), and put a token's note beside a narrow sample (`TokenRow notePlacement="right"`). The README's page guide covers token-page layouts, catalog grouping, column counts for wide components, and marking OS components.
- `doctor` no longer asks for one example per icon: a string-literal union declared in another component's folder (such as a shared `IconName`) is not a coverage target for the component using it.

## 0.4.2

- ds-viewer now supports Expo SDK 54 and later (it required 57). The starter kit type-checks on React Native 0.81 as well as 0.86, and `init` explains an Expo SDK that is too old instead of calling it missing.

## 0.4.1

- Package-manager commands that `update` and **Update now** run (npm, pnpm, yarn) now work on Windows, where they are `.cmd` shims that need a shell. The README lists the known limits of updating.
- `npx ds-viewer update` now exits 0 when you are already on the latest version, instead of 1.

## 0.4.0

- Added `npx ds-viewer kit diff <Component>` to compare your starter-kit files against the
installed kit's copy.
- Added `npx ds-viewer migrate --from <version>` and the migrations framework `update` uses to
apply breaking changes automatically from 0.4 on. This release ships the framework with an empty
migration list — it introduces no breaking change of its own.
- Added `npx ds-viewer update` (with `--dry-run`, `--yes`, `--force`) to build an update plan and
apply it from the terminal.
- The viewer now shows a footer line (and, for a major version, a dismissible banner) when an
update is available, opening an update page with an **Update now** button that applies it without
leaving the browser.
- `dev` and `doctor` now check for a newer version at most once a day (never with `--ci`), cached
across projects; disable with `updateCheck: false` or `DS_VIEWER_NO_UPDATE_CHECK=1`.
- `ds-viewer.config.ts`'s `starterKit` gained an optional `root` field, written by `init --new`;
older configs without it still work via inference from the `components` glob.

## 0.3.0

- Added `npx ds-viewer doctor` (`--json`, `--ci`) — checks every page for drift and coverage gaps by reading it statically, never by running app code.
- Added `npx ds-viewer explain <Page>` (`--heights`, `--json`) — prints why a page's specimens are laid out the way they are, using the catalog's own layout logic.
- Grid comparisons can bind a row or column axis to a real prop (`{ prop: 'variant', items: [...] }`), so `doctor` can check it against that prop's actual options.
- The catalog now warns in development when two pages resolve to the same id.
- `init` now appends a short `AGENTS.md` section telling an AI how to keep the catalog current with `doctor`/`explain`.
- `init` now writes a SHA-pinned `.github/workflows/ds-viewer.yml` that installs dependencies (npm, pnpm, or yarn — detected from the project's lockfile) and runs `doctor --ci` on every pull request.

## 0.2.0

- Fixed two starter-kit console errors on web: `Icon.native` no longer spreads `key` into JSX or leaks `translateX`/`translateY` to the DOM, and `Loading` no longer leaks `collapsable`/`accessible` to the DOM.
- The `logo` config field now works end to end: a missing file warns instead of silently doing nothing, and a valid image is bundled into the preview workspace and shown in the sidebar — a small mark beside the name, or a wide wordmark in place of it, depending on the image's own shape.
- The generated props table now keeps a prop's declared alias name even when it's optional, joins a wrapped multi-line JSDoc description into one line, and summarizes every inherited prop from the same source as a single "plus all `<Source>` props" row instead of one row per prop.
- `ds-viewer init` now supports starting a brand-new project: it installs `react-native-svg`/`react-native-safe-area-context` if missing (via `expo install`), then copies the starter kit — every component already documented with a finished example page — into `src/ds/` (`--kit-root` to change where).

## 0.1.1

- `ds-viewer --help` (also `-h`, `help`, or no command) lists every command, and `ds-viewer --version` (`-v`) prints the installed version; an unknown command now shows the full usage.

## 0.1.0

- Initial 0.1 release of `@krapwoo/ds-viewer`: `init`, `sync`, and `dev` CLI commands, and the browsable catalog viewer for an existing Expo/React Native app's components and tokens.
