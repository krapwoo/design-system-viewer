# Changelog

All notable changes to `@krapwoo/ds-viewer` are documented here. Entries are assembled
automatically by `npm run release` from the files under `.changes/`.

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
