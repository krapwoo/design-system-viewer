# Contributing to `@krapwoo/ds-viewer`

Thanks for helping. Most improvements come from using ds-viewer in a real app (for example,
Skiffr), so this guide starts there.

## Issue or pull request?

| You found | Do this |
|---|---|
| A bug, or something confusing | Open an issue ("Bug"). Say which app, which ds-viewer version (`npx ds-viewer --version`), and paste the command output or a screenshot. |
| An improvement you'd like but haven't built | Open an issue ("Improvement"). Describe the problem first, then your idea. |
| A small fix you've already made (copy, a layout bug, a `doctor` rule) | Open a pull request directly. |
| A bigger change (a new page field, a new command, a different layout) | Open an issue first so we can agree on the approach before you build it. Changes to the viewer's look need a quick mockup or screenshot in the issue. |

**What belongs here, and what stays in your app:** the viewer, the CLI (`init`, `sync`, `dev`,
`doctor`, `explain`, `update`), the starter kit and the page guide in the README belong here.
Your app's own catalog pages (`*.catalog.tsx`), config and tokens stay in your app's repository.

## Make the change

1. Fork this repository on GitHub, then clone your fork:
   ```bash
   git clone https://github.com/<you>/design-system-viewer.git
   cd design-system-viewer
   npm ci
   npm ci --prefix kit-host
   git checkout -b <short-topic>
   ```
2. Try it in this repository's own catalog: `npm run kit:dev`.
3. Try it in the app where you found the problem. Pack your build and install it in a scratch
   branch of your app (don't commit this to your app):
   ```bash
   npm pack                                       # in this repository: builds, then makes krapwoo-ds-viewer-<version>.tgz
   cd ../your-app                                 # e.g. Skiffr's metro-native/
   npm install --save-dev ../design-system-viewer/krapwoo-ds-viewer-<version>.tgz
   npx ds-viewer dev
   ```
   Afterwards, put your app back with `git checkout -- package.json package-lock.json && npm install`,
   and delete the `.tgz` (it's ignored by git, but don't attach it to a pull request).

## What a pull request needs

- **One change per pull request**, with a title that says what changed for users.
- **A test that fails before your change and passes after** for any logic change: a CLI command, a
  `doctor` rule, layout maths. Tests live next to the code (`cli/__tests__/`,
  `native/catalog/__tests__/`) and run with Node's built-in test runner.
- **A one-sentence note in `.changes/`** when users will notice the change (see
  `.changes/README.md`). Docs-only and test-only changes don't need one.
- **These checks pass locally**, the same ones CI runs:
  ```bash
  npm test
  npm run typecheck
  npm run build
  npm run check:types     # type-checks the viewer the way an app sees it
  npm run check:catalog   # opens every catalog page in headless Chrome; needs zero console errors
  npm run check:doctor
  ```
- **For anything you can see** (the viewer, a page layout, the starter kit): before and after
  screenshots at 1280 × 800 in the pull request, and a note of which pages you checked.
- **Follow the README's page guide** ("Adding a component", "Organising the catalog", "Token
  pages") when you touch page fields or layouts, and update it in the same pull request if your
  change adds a rule.
- **Leave releases alone:** don't change `version`, `CHANGELOG.md` or the release workflow. The
  owner releases.
- **No new runtime dependencies** without discussing it in an issue first.

## What happens next

1. CI runs on your pull request. If it's your first contribution, the owner approves the first run.
2. The owner reviews it. Expect questions about edge cases and how it looks.
3. Accepted pull requests are squash-merged into `main`.
4. The owner publishes a release. Apps using ds-viewer then see "Update available" in the viewer,
   and can update with **Update now** or `npx ds-viewer update`.

## Using an AI coding agent

Agents should follow this file and the README's page guide. Give your agent this checklist: write
the failing test first, run every check above, add the `.changes/` note, attach screenshots for
visual changes, and keep the pull request to one change.
