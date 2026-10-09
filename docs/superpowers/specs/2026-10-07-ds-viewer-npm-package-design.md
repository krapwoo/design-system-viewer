# `@krapwoo/ds-viewer` — npm Package Design

- **Status:** Revision 3 (2026-10-07). Brainstormed and approved section by section; revised for two independent Fable reviews (first: SOUND_WITH_CHANGES, 2 Critical / 11 Important / 14 Minor; follow-up: SOUND_WITH_CHANGES, 0 Critical / 4 Important / 7 Minor, all prior findings resolved) and for earlier owner decisions found in session history. Implementation not authorized.
- **Repository:** `krapwoo/design-system-viewer` (public; `main` at `eab3aab`)
- **Builds on:** `docs/superpowers/specs/2026-10-06-catalog-studio-matrix-design.md` (revision 3), which defines the viewer's page layouts. This design does not change those layouts except where noted in §4.
- **Supersedes:** the published package `@krapwoo/catalog` (0.1.0–0.2.2, command `wooho-catalog`, Vite web runtime). Its source repository no longer exists.

## Outcome

A designer or developer working on an Expo / React Native app installs one package, points it at their components and tokens, and browses an always-current catalog in the browser, branded with their product's name and optional logo. They can start a new app from a finished starter kit or bring the viewer into an existing app. An AI working on the project keeps the catalog current because the tooling tells it, precisely and without guessing, what is missing or wrong. When a new viewer version is released, users see a notice in the viewer and can update with an **Update now** button or one command. Stakeholders run the viewer locally.

## Decisions

| Topic | Decision | Source |
|---|---|---|
| Package name | `@krapwoo/ds-viewer`; command `ds-viewer`; npm account `krapwoo` owns the scope | Owner |
| Visibility | Public npm package; public GitHub repository; MIT license | Owner |
| Audience | The owner's projects first; other people from 1.0 | Owner |
| Relationship to `@krapwoo/catalog` | `ds-viewer` replaces it; `@krapwoo/catalog` is deprecated on npm with a pointer once `ds-viewer` 0.2 is usable | Owner |
| Spec scope | All phases in one spec, each phase its own release | Owner |
| First users | One existing app and one new app, both within weeks | Owner |
| Stack | Expo / React Native only; the viewer runs in a browser through React Native Web | Owner |
| Where the viewer opens | A separate local browser tool (`npx ds-viewer dev`); the user's app is not modified to host it | Owner |
| Rendering approach | A self-contained preview workspace inside the project that reuses the project's own Expo, Babel, TypeScript, and `node_modules` | Owner (approach A) |
| Stakeholder access | Stakeholders run the viewer locally; no hosted or exported catalog | Owner (replaces the 2026-09-26 "keep it hosted" decision) |
| Branding | Product name plus an optional logo, shown in the sidebar header | Owner (original brief) |
| Page files | Next to each component: `Button/Button.catalog.tsx` | Owner |
| Drift enforcement | The PR check fails on errors (`doctor --ci`); local work is never blocked | Owner |
| AI instructions | `AGENTS.md` only | Owner |
| Starter kit | One full kit: tokens, components, icons | Owner |
| Update notice | A quiet line in the sidebar footer; a banner for major versions; an **Update now** button in the local viewer | Owner (2026-10-03 requirement restored) |
| Update trigger | Users are notified only when a release is published; pushes to `main` are invisible to users | Owner |
| Starter-kit quality | The kit renders with zero console errors before new projects receive it (today's `react-native-svg` errors in `Icon.native` and `Loading` are fixed in 0.2) | Owner |
| Monorepo support | Later | Owner |

## Scope contract

### Required

1. A public npm package `@krapwoo/ds-viewer` containing the viewer, the page API, the CLI, and the starter kit.
2. `init` for new projects (starter kit) and existing projects (detection and confirmation).
3. `dev`: a local browser viewer for the current project with live reload, product name, and optional logo.
4. `sync`: component list, props tables, token data, and the page index, generated from source.
5. `doctor`: static drift errors and coverage warnings, human-readable, `--json`, and `--ci`.
6. `explain <Page>`: layout decisions with reasons.
7. The `AGENTS.md` section and a GitHub Action, added by `init`.
8. A release pipeline publishing to npm from version tags.
9. Update checks in the CLI; a viewer notice; an **Update now** button running the update through the local `dev` process; `update` with migrations; `kit diff`.
10. A README with installation, commands, and a page-authoring guide.
11. A starter kit that renders every page with zero console errors.
12. Automated tests: unit, static-analysis fixtures, fixture-project CLI snapshots, a browser smoke test, migration tests.

### Report only

- Components whose props cannot be read statically.
- Token values computed at runtime.
- Host projects whose Babel or Metro configuration cannot be reused automatically.
- Page data that cannot be read statically (reported as "page not statically checkable").

### Prohibited

- Modifying the user's app to host the viewer (no routes, no entry changes).
- Writing to user-owned files except: `init` adding missing files, and a confirmed `update` migration.
- Inventing grid cells, groups, examples, or prop-option bindings; drafts are marked as needing examples.
- Telemetry or sending project data; network calls are limited to the update check and the update plan's package download (§5).
- Handling npm credentials in tooling or by agents.
- The **Update now** endpoint accepting requests from anything other than the local viewer page.
- Non-goals: rendering on phones or simulators, plain React web, monorepo switching, hosted or exported catalogs, instruction files other than `AGENTS.md`.

## 1. Package contents

### Three parts

| Part | Contents | Used by |
|---|---|---|
| **Viewer** (React Native) | Shell, sidebar (name, logo), pages, grid, grouped rows, lists, previews, Props box, update notice and **Update now** flow — today's `native/catalog` without the example catalogs. Pages are wrapped in `SafeAreaProvider` when `react-native-safe-area-context` is installed (optional require), because components such as the kit's Dock call `useSafeAreaInsets` | `ds-viewer dev` |
| **Page API** (TypeScript) | `defineCatalogPage()`, `defineConfig()`, the page and layout types, `explainLayout()` | Users and AI writing pages |
| **CLI** (Node) | `init`, `dev`, `sync`, `doctor`, `explain`, `update`, `migrate`, `kit diff` | Users, AI, CI |

The starter kit ships inside the package (`starter-kit/`) and is copied, never imported, into new projects.

### Page shape

`defineCatalogPage()` takes today's `SectionDef` without `id`, `path`, and `props` (all derived), plus:

| Field | Purpose |
|---|---|
| `component` | Export name; defaults to the file stem for component pages |
| `group` | Sidebar group label |
| `propNotes` | Extra text per prop, added to generated descriptions |

Everything else (`description`, `whenToUse`, `a11y`, `variants`, `states`, `comparison`, `specimenSize`, `previewWidths`, `render`, `tokenGallery`, `hide`) keeps its current meaning, with the binding additions in §4. The unused `VariantSlot.align` field is removed.

### Ownership

| Location | Owner | Package may write? |
|---|---|---|
| `ds-viewer.config.ts` | User | Created by `init`; changed only by confirmed migrations |
| `*.catalog.tsx` (component and standalone pages) | User | Created by `init` (drafts or kit pages); changed only by confirmed migrations |
| Starter-kit files in the project | User | Copied once by `init`; never changed |
| `AGENTS.md` section, `.github/workflows/ds-viewer.yml` | User | Added by `init` when missing; the `AGENTS.md` section lives between markers and is refreshed only by a confirmed `update` |
| `.ds-viewer/` | Package | Yes — generated, git-ignored, rewritten freely |

### This repository after the change

- Becomes the package source with a root `package.json`, `LICENSE`, and README.
- `native/components`, `tokens`, `icons`, and `WHEN_TO_USE.md` move into `starter-kit/` with a fixed internal layout: `<kit root>/components`, `<kit root>/tokens`, `<kit root>/icons`. Only the kit root is configurable.
- `CatalogExample.tsx` becomes per-component `*.catalog.tsx` files and standalone pages inside the kit.
- `CatalogFrameworkExample` becomes the package's own documentation catalog, and gains pages for the pieces it does not document today: `ComparisonGrid`, `ComparisonGroups`, `ComparisonList`, `ReferenceDetails`, and (from 0.4) the update panel.
- `native-preview/` stays until 0.2, when the repository views itself with `ds-viewer dev` against the kit.
- The kit version equals the package version.

### Host requirements

| Requirement | Check |
|---|---|
| Expo SDK 54 or later | Required. Lowered from 57 in 0.4.2 (owner-approved) after `init --new`, `init --existing`, `sync`, `doctor`, the viewer and **Update now** were verified end to end on a fresh SDK 54 app and on Skiffr (SDK 54) |
| `react-native-web`, `react-dom` | Required (Expo web) |
| `@expo/metro-runtime` | Not required: Expo web works without it (verified on SDK 57 in the 0.1 spike and in `native-preview`, and on SDK 54 in 0.4.2); preflight only warns when it is missing |
| `react-native-svg`, `react-native-safe-area-context` | Required for the starter kit; installed with `expo install` by the new-project path |
| `@krapwoo/ds-viewer` as a local devDependency | Required; `dev` refuses to run from the npx cache because pages import from the package and a second React would load |
| Node 20.19 or later | Required for the CLI |
| TypeScript | Recommended; without it `init` continues with a warning and props tables show "Props not available" |

Peer dependencies: `expo`, `react`, `react-dom`, `react-native`, `react-native-web`; optional peer: `react-native-safe-area-context`.

## 2. Setup and running

### `init`

First run in a project: `npx @krapwoo/ds-viewer init`. (`npx ds-viewer` would resolve an unrelated unscoped package.) This path installs `@krapwoo/ds-viewer` as a devDependency first; afterwards the local `ds-viewer` command is used.

1. **Preflight:** checks the requirements above. Missing required items are reported with the exact install command and `init` stops without writing files. Missing TypeScript is a warning.
2. **One question:** new project or existing project.

| Step | New project | Existing project |
|---|---|---|
| 1 | Runs `expo install react-native-svg react-native-safe-area-context` for any that are missing, then copies the starter kit into `src/ds/` (kit root configurable): tokens, icons, components, `WHEN_TO_USE.md`, each component with a finished `*.catalog.tsx`, plus standalone pages (token pages, Icons, recipes, Manifest) | Detects components (§3 "What is a component") and token modules (exports of color, spacing, typography values); shows them for confirmation or editing; warns when a component folder lies inside an Expo Router `app/` directory, where `*.catalog.tsx` files would become routes |
| 2 | Records `starterKit.version` in the config | Writes a draft `<Export>.catalog.tsx` per component with `group: 'Components'` and a "needs examples" marker; no invented examples |
| 3 | — | Prints coverage, e.g. "38 components · 0 with examples" |

3. **Both paths then write what is missing:** `ds-viewer.config.ts`, a `ds-viewer` package script, `.ds-viewer/` in `.gitignore`. From 0.3, also the `AGENTS.md` section (appended between markers; creating `AGENTS.md` if absent) and `.github/workflows/ds-viewer.yml`. Running `init` again adds only what is missing; an `AGENTS.md` without the markers counts as missing the section.
4. Every written file is listed.

### Config

```ts
export default defineConfig({
  name: 'Rider App',
  logo: './assets/logo.png',                       // optional; loaded as an image asset; use PNG if the project transforms SVG imports into components
  components: ['src/ds/components/*/index.ts'],   // globs
  exclude: ['src/ds/components/_internal/**'],    // optional
  tokens: ['src/ds/tokens/index.ts'],
  pages: ['src/ds/pages/*.catalog.tsx'],          // standalone pages (token pages, icons, recipes)
  groupOrder: ['Actions', 'Inputs', 'Tokens'],    // optional order of sidebar groups
  starterKit: { version: '0.2.0' },               // kit projects only
  updateCheck: true,                              // default true
  doctor: { strict: false },                      // true promotes warnings to errors
});
```

### The preview workspace and `npx ds-viewer dev`

`.ds-viewer/` is a self-contained Expo web project rooted inside the user's project:

- `package.json` whose `main` is the generated entry file, a minimal `app.json`, a `babel.config.js` that re-exports the project's Babel config, a `tsconfig.json` that extends the project's, and a `metro.config.js` that starts from the project's Metro config, adds the project root to `watchFolders`, and resolves modules from the project's `node_modules`.
- This keeps Babel plugins (e.g. Reanimated, module-resolver aliases) and `tsconfig` paths working inside the viewer.
- If the project's Babel or Metro config cannot be reused (e.g. it is not a loadable module), `dev` stops with the reason rather than guessing.

`dev`:

1. Checks that the package is installed locally.
2. Runs `sync`.
3. Writes `.ds-viewer/`.
4. Starts Expo web with `--host localhost` on the first free port from 5181 and opens the browser. The viewer is never exposed on the network.
5. Watches components, tokens, and page files; re-runs `sync` on change. Live reload covers components and pages.
6. Starts the local update endpoint (§5).

### Pages and discovery

- **Component pages:** `<Export>.catalog.tsx` in the component's folder, one per component export.
- **Standalone pages:** files matched by `pages`, with no component — token pages, Icons, recipes, Manifest, overview pages. They set `render` or `tokenGallery`.
- **Page id:** the component export name for component pages; the file stem for standalone pages. The id is used in the URL fragment and by `explain`.
- **Discovery:** `sync` writes a generated import list of all pages into `.ds-viewer/`; the viewer and `doctor` use the same list. `dev` regenerates it when page files are added or removed.
- **Sidebar:** each page declares its `group`; component pages default to "Components", token pages to "Tokens". `groupOrder` orders groups; unlisted groups follow alphabetically; pages are alphabetical within a group, as today.
- A component without a page still appears with its generated props and "No examples documented."

### Errors

- A page that throws at render shows the error on that page only, with the file name.
- A Metro build failure prints the build output with a hint.
- Unreusable host configuration: `dev` stops with the reason.

## 3. Generated data (`sync`)

Read with the TypeScript compiler; nothing from the app is executed. The only project file the CLI executes is `ds-viewer.config.ts`, loaded with a bundled TypeScript loader; it may import only the package's `defineConfig` and must not import app code.

### What is a component

Any export from a matched folder's entry whose type is a React component: a function returning JSX, `React.memo(...)`, `forwardRef(...)`, or a value typed `ComponentType`. Each gets a record and may have its own page. A props type is optional. Constants and non-component exports are ignored.

### Props tables

- **Props type:** `React.ComponentProps<typeof Export>`, resolved by the type checker. This handles `memo` and `forwardRef`.
- **Unions of object types** (e.g. `CardProps` as two intersections) are merged into one table; a prop present in only some members is marked "only with …".
- **Inherited props declared in `node_modules`** (e.g. `extends TextInputProps`) are summarised as one row: "plus all TextInput props".
- **Defaults:** read from the innermost component function's parameter destructuring or `@default`; shown as source text, plus the resolved value when it is static (`duration = DS_MOTION_DURATION.base` → "DS_MOTION_DURATION.base (240)").
- **Type column:** keeps alias names (`IconName`), not expanded unions.
- **Descriptions:** from JSDoc. Pages may add `propNotes`; a note for a prop that no longer exists is a `doctor` error.
- **Options for coverage:** string-literal unions declared inside the configured component or token folders, and, for a component folder, only in the component's own subfolder. Unions from elsewhere (e.g. 44 icon names, or an `IconName` declared in a sibling `Icon/` component) are not coverage targets (0.4.3, owner-approved after the Skiffr test).

### Tokens

- Token pages are authored standalone pages that import token modules directly, as today, so galleries keep their steps, values, and use notes.
- `tokens.json` is generated for `doctor` and for an automatic "Tokens" page when a project has no token pages. It keeps shadow, typography, and motion entries as objects instead of flattening them.
- Literal values and references to other tokens are resolved statically; values computed at runtime show "computed — see source".

### Output and speed

- `.ds-viewer/generated/components.json`, `tokens.json`, and the page import list; sorted and deterministic.
- These replace `buildComponentManifest`. Standalone pages read generated data through the virtual module `@krapwoo/ds-viewer/generated`, which the workspace Metro config maps to `.ds-viewer/generated/`; the kit's Manifest page uses it.
- No per-file cache in the first version. Target: under 2 seconds for 50 components on a typical laptop, measured during implementation. A cache keyed by each file's import closure is added only if the target is missed.
- One component or file that cannot be read never fails the run; it is reported.

## 4. `doctor` and AI tooling

### Static checking

`doctor` runs `sync`, then reads every page with the TypeScript compiler. It never imports page files, so no app code runs in Node.

Layout-relevant page data must be literal to be checked: `specimenSize`, `group`, grid `rows` and `columns`, list items' `key`/`name`/`props`/`group`, and `propNotes` keys. Specimen nodes and `cell(...)` functions are not evaluated. A page whose layout data is not literal gets one warning: "page not statically checkable".

### Binding examples to props

Drift and coverage checks fire only where a page states which prop an example demonstrates:

- **Grid axes** may name a prop: `rows: { prop: 'variant', items: [{ key: 'primary', label: 'Primary' }, …] }`. Each item key must then be an option of that prop. Only props typed as string-literal unions can be bound (the same set as coverage targets); binding any other prop is a `doctor` error.
- **Grid cells** are produced by `cell(row, column)`, matching today's `grid()` helper; the page states rows and columns literally.
- **List items** use the existing `props` tag: `{ key: 'ghost', name: 'Ghost', props: { variant: 'ghost' }, node: … }`.

Unbound axes and untagged items are allowed and never produce drift errors; `doctor` reports how many examples are unbound as information.

### Checks

| Severity | Fails `--ci`? | Rules |
|---|---|---|
| **Error** — the viewer shows something untrue | Yes | Component page for an export that no longer exists (standalone pages exempt) · bound grid axis item or tagged example using a prop option that no longer exists · bound axis naming a prop that no longer exists · grid with missing or duplicate keys, or more columns than fit a 1280px laptop · `propNotes` for a prop that no longer exists · axis bound to a prop that is not a string-literal union · two pages with the same id · page file that fails to parse or typecheck |
| **Warning** — the viewer is incomplete | No (unless `doctor.strict`) | Component with no examples · option of a coverage-target union without a bound or tagged example · `group` matching no variant (the viewer still shows it under "Other configurations") · missing guidance or accessibility notes · props that could not be read · page not statically checkable · no token modules configured |

The column-limit rule becomes a `doctor` error; in the viewer it stays a development warning (layout spec unchanged).

### Output

- **Human:** grouped by page; each issue has a one-line fix.
- **`--json`:** stable, documented, versioned format:

```json
{
  "version": 1,
  "summary": { "errors": 0, "warnings": 26, "components": 38, "withExamples": 12, "unboundExamples": 40 },
  "update": { "current": "0.3.0", "latest": "0.4.0", "breaking": false },
  "issues": [
    { "id": "bound-option-removed", "severity": "error", "page": "Button",
      "file": "src/ds/components/Button/Button.catalog.tsx", "line": 42,
      "message": "Grid row 'outline' is bound to variant, which no longer has option 'outline'.",
      "fix": "Delete row 'outline' from rows." }
  ]
}
```

- **`--ci`:** exit code 1 only when errors exist; no update check.
- In the viewer, the same rules appear as development warnings naming the page.

### `npx ds-viewer explain <Page>`

Prints each layout decision with its reason, using the same pure functions as the viewer. Side-by-side placement depends on measured heights, so `explain` reports it as "decided in the viewer" unless heights are passed with `--heights`. `--json` is available.

### `AGENTS.md` section

Written between `<!-- ds-viewer:start v1 -->` and `<!-- ds-viewer:end -->`; short:

1. When you add or change a component's props or a token, update its `*.catalog.tsx` in the same change.
2. Bind examples to props (`prop` on grid axes, `props` on list items) so drift is detected.
3. Never invent grid cells or groups; author only combinations that exist.
4. Run `npx ds-viewer doctor` before finishing and fix every error. Use `npx ds-viewer explain <Page>` to check layout; see the README's page-authoring guide.

### GitHub Action

Runs on every pull request (no path filters): install dependencies, then `npx ds-viewer doctor --ci`. Actions are pinned to commit SHAs.

## 5. Releases and updates

### Releasing (from this repository)

1. Each PR with a user-visible change adds a short note under `.changes/`.
2. A GitHub Action runs unit tests, typecheck, static fixtures, and `doctor` against the starter kit on every PR.
3. `npm run release <patch|minor|major>` bumps the version, assembles `CHANGELOG.md`, and tags `v*`.
4. Pushing a `v*` tag triggers an Action that publishes with npm **trusted publishing** (OIDC) and provenance; no long-lived npm token. The `v*` tag pattern is protected.
5. The first publish of `@krapwoo/ds-viewer` is done by the owner from their machine; trusted publishing is configured on npm afterwards.
6. **Versioning:** before 0.4, breaking changes ship with written migration notes. From 0.4, every breaking change ships an automatic migration. From 1.0, breaking changes only in major versions.

### Update check

- Runs in the CLI (`dev`, `doctor`), at most once every 24 hours, cached in the user's cache folder and shared across projects.
- Requests: `https://registry.npmjs.org/@krapwoo%2Fds-viewer/latest` for the version, and the GitHub release for that tag for the summary. Timeout under 1 second each.
- Like any npm install, the requests disclose the user's IP address; nothing else about the user or project is sent.
- `dev` writes the result to `.ds-viewer/update.json`; the viewer reads it. The browser never contacts the network for updates.
- Offline or blocked: silent. Disabled by `updateCheck: false` or `DS_VIEWER_NO_UPDATE_CHECK=1`. Never runs with `--ci`.

### Viewer notice and **Update now**

The visual design requires a mockup and approval before implementation.

- **Minor or patch:** a quiet line in the sidebar footer, "Update available · 0.5.0".
- **Major:** a top banner, "DS Viewer 2.0 is available — includes breaking changes · Migration guide", dismissible per version; the footer line remains.
- Activating either opens an update panel. It requests the plan (§5 "Update plan") and shows current → latest, the release summary, and the files that would change, with **Update now**.
- **Update now** asks the running `dev` process to apply the plan with the same steps as `update`. The panel shows progress, then the result: success with "Changes are not committed — review them in your editor", or failure with the log and the recovery command.

**Local endpoint safeguards:**

- Listens on `127.0.0.1` only, on a random port. Metro itself runs with `--host localhost`.
- A secret is generated when `dev` starts and is valid until `dev` exits. `dev` writes it into the generated viewer files; the viewer sends it in a request header.
- Every request must carry an `Origin` header exactly equal to the viewer's Metro URL, including port; requests without `Origin` are rejected. State-changing requests are POST only.
- Endpoints: `POST /plan`, `POST /update` (start), and `GET /update/status` (progress, polled with the secret header).
- Runs one update at a time; further start requests are refused while one runs.
- Refuses with the plan's dirty-file list when any planned file has uncommitted changes; the panel offers no override.

**Restart handoff:**

1. When an endpoint update starts, `dev` pauses its file watcher and hot reload so the panel is not reloaded mid-update.
2. After `doctor`, `dev` records the final result for `/update/status` and the viewer reads it before restart.
3. `dev` closes its listeners, then restarts on the new version with the same Metro port.
4. The viewer polls the Metro URL and reloads when it answers.
5. If the restart fails, the terminal prints the recovery command (`npx ds-viewer dev`) and the result of the update.

### Update plan

`update`, `update --dry-run`, and the update panel share one first step, the **plan**:

1. Download the target version into a temporary folder (this fetches the package from npm, like any install).
2. Run that version's `ds-viewer migrate --from <installed version> --dry-run --json`.
3. Produce the plan: version change, release summary, files each migration would change, starter-kit files that differ, and dirty files among those to be changed.

The plan is the data source for the panel's file list and for the dirty-file refusal.

### `npx ds-viewer update`

1. Builds the plan; shows current → latest, the release summary, and the files that would change; asks for confirmation (`--yes` skips).
2. Refuses if any file in the plan has uncommitted changes, unless `--force`.
3. Upgrades with the project's package manager, detected from the lockfile.
4. Re-runs the newly installed binary: `ds-viewer migrate --from <old version>`.
5. Runs `doctor` and prints a summary. Changes stay uncommitted.
6. `--dry-run` stops after printing the plan.

### Starter-kit changes

- Never applied automatically; users own those files.
- `update` reports "N kit files differ from the installed kit's version".
- `npx ds-viewer kit diff <Component>` shows the user's file against the installed kit's file.

### Replacing `@krapwoo/catalog`

Once `ds-viewer` 0.2 is usable for both of the owner's projects, `@krapwoo/catalog` is deprecated on npm with the message "Replaced by @krapwoo/ds-viewer". Deprecation is a publication step and needs the owner's separate approval at that time.

## 6. Delivery, testing, and limits

### Releases

| Release | Contents | Usable for |
|---|---|---|
| 0.1 | Package layout, config, preview workspace, `dev`, `sync`, existing-project `init` (detection, draft `<Export>.catalog.tsx` pages, config, script, `.gitignore`), MIT `LICENSE`, release pipeline; `native-preview/` kept | The owner's existing app |
| 0.2 | Kit moved into the package with component and standalone pages, kit console errors fixed (`Icon.native`, `Loading`), new-project `init`, logo in the sidebar header (mockup first), `native-preview/` retired, `@krapwoo/catalog` deprecation (owner approval) | The owner's new app |
| 0.3 | `doctor` (`--json`, `--ci`), prop binding, `explain`, `AGENTS.md` section and GitHub Action added by `init` | Keeping both current with AI |
| 0.4 | Update check, footer line, major banner, update panel and **Update now** (mockup first), `update`, `migrate`, `kit diff` | Getting improvements into both |
| 1.0 | After both projects have used it: page format frozen, migrations guaranteed | Other people |

### Testing

- **Unit:** the existing 21 layout tests; component detection (`memo`, `forwardRef`, multiple exports); props resolution (unions, inherited props, defaults); token reading; `doctor` rules; version comparison; endpoint token and origin checks.
- **Static fixtures:** pages with bound and unbound axes, non-literal layout data, removed options, removed props.
- **Fixture projects:** a starter-kit project; an existing project with unusual folders, a multi-export folder, missing tokens, and an untyped component; a broken project. CLI tests run `init`, `sync`, `doctor --json`, and `update --dry-run` and compare snapshots.
- **Browser smoke test in CI:** `dev` on the starter-kit fixture; a headless browser checks every page renders its heading with zero console errors (from 0.2).
- **Migrations:** each has before/after fixture files.

### Error-handling rule

One broken component, page, or token never stops the rest: it is reported with its file and a fix. Only `--ci` turns errors into a failed check.

### Known viewer issues carried over

Report-only findings from the viewer's reviews remain report-only unless a release touches the code: recorded placement heights are kept across a width change; Loading's grouped rows scroll inside their card at 1100px; `grid()` in the catalog types its axes as plain strings (superseded by prop binding in 0.3).

### Later (not in this design)

Monorepo project switching; `ds-viewer list` and `update --all` across projects; `scaffold` suggestions from prop types; a `verify` screenshot and geometry command; an MCP server for AI tools.

### Owner actions

| Action | When | Status |
|---|---|---|
| npm account `krapwoo` owns the `@krapwoo` scope | Before 0.1 | Confirmed |
| GitHub repository public | Before 0.1 | Done (verified) |
| License | Before 0.1 | Decided: MIT |
| First publish of `@krapwoo/ds-viewer` from the owner's machine, then enable trusted publishing on npm | At 0.1 | Done: 0.1.0 published 2026-10-08; trusted publishing configured (owner-reported) |
| Approve deprecating `@krapwoo/catalog` | At 0.2 | Pending |
