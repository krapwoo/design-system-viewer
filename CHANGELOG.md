# Changelog

All notable changes to `@krapwoo/ds-viewer` are documented here. Entries are assembled
automatically by `npm run release` from the files under `.changes/`.

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
