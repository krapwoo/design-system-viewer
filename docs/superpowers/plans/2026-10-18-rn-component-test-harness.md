# React Native Component Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it possible to render a catalog component in a test, so defects in component *wiring* are caught by `npm test` instead of by a human measuring a browser.

**Architecture:** Node's `--experimental-strip-types` removes TypeScript annotations but does not transform JSX, so today no test can import a `.tsx` file at all — component "tests" read source text and assert on strings. This plan registers a module loader that transforms `.tsx` through esbuild, resolves this repo's extensionless imports, and aliases `react-native` to `react-native-web` (the same substitution the real catalog runs through in a browser). Components then render into jsdom, and tests assert on the resulting DOM structure.

**Tech Stack:** Node 22.23 `node:test`, esbuild (transform), jsdom, react / react-dom 19, react-native-web, @testing-library/react.

## Global Constraints

- **The harness must never ship.** `package.json`'s `files` allowlist is `["native/catalog","!native/catalog/**/__tests__","starter-kit","dist/cli","dist/config","dist/native","config/index.ts","README.md","LICENSE"]`. Harness files live under `test/` (not in the allowlist) and every dependency it needs is a `devDependency`.
- **The harness must borrow `kit-host`'s React — it must NOT install its own.** `react`, `react-dom`, `react-native`, `react-native-web`, `expo` and `react-native-safe-area-context` are `peerDependencies: "*"` and are not resolvable at the repo root, but **both catalog hosts resolve them upward into that root when it has them**. Installing them at the root gives the hosts a second, different copy and the catalog renders nothing. Proven by A/B during execution: root react 19.3.1 against kit-host's 19.2.3 (and react-native-web 0.21.4 against 0.21.3) turned `npm run check:catalog` from exit 0 into `[error] catalog: render-failed: The catalog rendered no sidebar links`. The loader therefore resolves `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client` and `react-native` → `react-native-web` from `kit-host/node_modules` via `createRequire`, and **throws a named error if that tree is missing rather than falling back** — the silent fallback is what caused the bug. CI already runs `npm ci --prefix kit-host` before `npm test` (`.github/workflows/ci.yml:23-28`). Only non-React tooling (`esbuild`, `jsdom`, `@types/jsdom`) belongs in root devDependencies.
- **This harness tests structure, not geometry.** jsdom has no layout engine: `getBoundingClientRect()` returns zeros. It can prove *which element wraps what*; it cannot prove "the description sits 16px from the column edge". The rendered browser pass stays the only check for geometry. Say so in every doc this plan touches.
- **Do not convert existing source-assertion tests.** They are cheap and currently green. Add renderer tests alongside; conversion is a later, separate decision.
- Baseline before this work: `npm test` → 821 passing, exit 0. Every check must still exit 0 at every commit.
- Run every check by **exit code**, never by grepping its output for expected text.

---

## File Structure

| File | Responsibility |
|---|---|
| `test/jsxLoader.mjs` (create) | Node module hooks: transform `.tsx`/`.ts` via esbuild, resolve extensionless imports, alias `react-native` → `react-native-web` |
| `test/register.mjs` (create) | Registers the loader via `node:module`'s `register()`; the file `--import` points at |
| `test/renderCatalog.tsx` (create) | One helper: render a component into jsdom and return the container |
| `package.json` (modify) | New `test:render` script, devDependencies |
| `native/catalog/__tests__/familyPageRender.test.tsx` (create) | The first real renderer tests — the legend pin slot and the Related block |
| `.github/workflows/ci.yml` (modify) | Run the new script |
| `README.md` (modify) | Document what the harness does and what it cannot see |

---

### Task 1: A loader that can import a `.tsx` component

**Files:**
- Create: `test/jsxLoader.mjs`
- Create: `test/register.mjs`
- Create: `test/__tests__/loader.test.ts`
- Modify: `package.json` (devDependencies, `test:render` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `node --import ./test/register.mjs` can import any `.tsx` under `native/catalog/`, including this repo's extensionless imports (`./tokens`, `./SectionBlock`) and its `react-native` imports.

- [ ] **Step 1: Prove the problem still exists**

```bash
cd /path/to/design-system-viewer
printf "export const X = () => <div>hi</div>;\n" > /tmp/probe.tsx
node --experimental-strip-types -e "import('/tmp/probe.tsx').catch(e => console.log(e.code))"
```

Expected output: `ERR_UNKNOWN_FILE_EXTENSION`. This is the blocker the task removes.

- [ ] **Step 2: Add the dependencies**

```bash
npm i -D esbuild@^0.25.0 jsdom@^26.0.0 @types/jsdom@^21.0.0
```

**Only these three.** Do not add `react`, `react-dom`, `react-native-web` or `@testing-library/react`: a React at the repo root breaks both catalog hosts (see Global Constraints), and nothing here uses Testing Library — `renderCatalog` drives `react-dom/client` directly. These are devDependencies only; consumers never install them, and `test/` is not in the `files` allowlist.

After any change to the dependency list, regenerate the lockfile with `npm install --package-lock-only` — `npm ci` reads the lockfile but never rewrites it, so a trimmed `package.json` otherwise leaves a lockfile still naming the removed packages.

- [ ] **Step 3: Write the loader**

Create `test/jsxLoader.mjs`:

```js
// Node's --experimental-strip-types removes type annotations but does not transform JSX, so a
// `.tsx` component cannot be imported at all (ERR_UNKNOWN_FILE_EXTENSION). These hooks do three
// things the catalog's own files need: transform TSX through esbuild, resolve the extensionless
// relative imports every file here uses (`./tokens`, `./SectionBlock`), and alias `react-native`
// to `react-native-web` — the same substitution the catalog already runs through in a browser,
// so a test renders the component the consumer actually sees.
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { transform } from 'esbuild';

const EXTENSIONS = ['.tsx', '.ts'];

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') return nextResolve('react-native-web', context);

  if (specifier.startsWith('.') && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    const basePath = fileURLToPath(base);
    if (!existsSync(basePath)) {
      for (const ext of EXTENSIONS) {
        if (existsSync(basePath + ext)) {
          return { url: pathToFileURL(basePath + ext).href, format: 'module', shortCircuit: true };
        }
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.tsx') || url.endsWith('.ts')) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    const { code } = await transform(source, {
      loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      jsx: 'automatic',
      target: 'node22',
      sourcefile: url,
    });
    return { format: 'module', source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
```

Create `test/register.mjs`:

```js
import { register } from 'node:module';
register('./jsxLoader.mjs', import.meta.url);
```

- [ ] **Step 4: Write the failing test**

Create `test/__tests__/loader.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the loader can import a catalog component that uses JSX, react-native and extensionless imports', async () => {
  // FamilyPage is the hardest case in the repo: JSX, a `react-native` import, and extensionless
  // relative imports (`./tokens`, `./SectionBlock`). If this imports, every lighter component will.
  const mod = await import('../../native/catalog/FamilyPage.tsx');
  assert.equal(typeof mod.FamilyPage, 'function', 'FamilyPage must be an importable component');
  assert.equal(typeof mod.AnatomyPin, 'function', 'its named exports must come through too');
});
```

- [ ] **Step 5: Run it and watch it fail for the right reason**

```bash
node --test 'test/__tests__/loader.test.ts'
```

Expected: FAIL with `ERR_UNKNOWN_FILE_EXTENSION` — the loader is not registered yet.

- [ ] **Step 6: Add the script and run it green**

In `package.json` `scripts`, add:

```json
"test:render": "node --import ./test/register.mjs --test 'test/__tests__/*.test.ts' 'native/catalog/__tests__/*.test.tsx'"
```

```bash
npm run test:render; echo "exit=$?"
```

Expected: `exit=0`, the loader test passing.

- [ ] **Step 7: Confirm the existing suite is untouched**

```bash
npm test; echo "exit=$?"
```

Expected: `exit=0`, **821 passing** — the new script is separate and `npm test`'s globs are unchanged.

- [ ] **Step 8: Commit**

```bash
git add test/ package.json package-lock.json
git commit -m "test: add a JSX-capable loader so a catalog component can be imported at all"
```

---

### Task 2: Render a component into jsdom

**Files:**
- Create: `test/renderCatalog.tsx`
- Modify: `test/__tests__/loader.test.ts` (add the render smoke test)

**Interfaces:**
- Consumes: the loader from Task 1.
- Produces: `renderCatalog(element: React.ReactElement): { container: HTMLElement; cleanup: () => void }` — used by every later test.

- [ ] **Step 1: Write the helper**

Create `test/renderCatalog.tsx`:

```tsx
// Renders a catalog component the way a consumer's browser does: react-native-web primitives into
// a DOM. jsdom has no layout engine, so this proves structure (which element wraps what, what text
// and roles exist) and never geometry — `getBoundingClientRect()` is all zeros here. Anything about
// position or size still needs the rendered browser pass in `cli/render.ts`.
import React from 'react';
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

export function renderCatalog(element: React.ReactElement): { container: HTMLElement; cleanup: () => void } {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  // Node 22 ships a getter-only global `navigator`, so a plain assignment throws
  // "Cannot set property navigator ... which has only a getter".
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  // Without this React logs an act() warning on every render, which buries real output.
  g.IS_REACT_ACT_ENVIRONMENT = true;
  const container = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(container);
  act(() => { root.render(element); });
  return {
    container,
    cleanup: () => { act(() => { root.unmount(); }); dom.window.close(); },
  };
}
```

- [ ] **Step 2: Write the failing smoke test**

Append to `test/__tests__/loader.test.ts`:

```ts
test('a catalog component renders real DOM through react-native-web', async () => {
  // PagerButton, not Blocks: `Blocks` takes `blocks`/`def`/`surface` and has no `children` prop,
  // so a children-based assertion could never pass. PagerButton is the lightest component in the
  // same file with real props, and its accessibility label proves react-native-web reached the DOM.
  const { PagerButton } = await import('../../native/catalog/SectionBlock.tsx');
  const { renderCatalog } = await import('../renderCatalog.tsx');
  const React = (await import('react')).default;
  const { container, cleanup } = renderCatalog(
    React.createElement(PagerButton as never, {
      direction: 'next', targetId: 'NextPage', onNavigate: () => {}, labelOf: (id: string) => id,
    } as never),
  );
  const button = container.querySelector('[aria-label]');
  assert.ok(button, 'the component must render an accessible control into the DOM');
  assert.equal(button!.getAttribute('aria-label'), 'Next: NextPage');
  cleanup();
});
```

- [ ] **Step 3: Run it**

```bash
npm run test:render; echo "exit=$?"
```

Expected: `exit=0`, both tests passing. If `Blocks` needs props this file does not supply, read `native/catalog/SectionBlock.tsx` and pass the minimum its signature requires — do not stub the component.

- [ ] **Step 4: Commit**

```bash
git add test/ && git commit -m "test: render catalog components into jsdom through react-native-web"
```

---

### Task 3: Pin the legend's conditional pin slot — the defect that started this

**Files:**
- Create: `native/catalog/__tests__/familyPageRender.test.tsx`

**Interfaces:**
- Consumes: `renderCatalog` from Task 2.
- Produces: nothing later tasks depend on.

**Why this case:** `AnatomyMemberRow` reserves its 34px pin slot only when a pin exists, while `AnatomyOtherRow` keeps its slot because its ↗ always renders. During the `relatedPages` slice an implementer moved that ↗ inline, which broke the approved "description starts at the name's left edge" rule — **and all 814 tests still passed**, because nothing could render the component. This test makes that class of regression fail in CI.

- [ ] **Step 1: Write the failing test**

Create `native/catalog/__tests__/familyPageRender.test.tsx`:

```tsx
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderCatalog } from '../../test/renderCatalog.tsx';
import { FamilyPage } from '../FamilyPage.tsx';

// A family whose legend has one numbered row and one row with no number at all: `Related` sits
// outside every `inWhole` section, so `numberFor` gives it no number and its legend row must
// render with no pin slot reserved. This is the shape `APPROVED.md` line 21 describes.
function familyWithPinlessLegendRow() {
  return {
    whole: 'Whole',
    members: [
      { id: 'Whole', path: 'Whole.tsx', description: 'The whole.' },
      { id: 'Part', path: 'Part.tsx', parent: 'Whole', description: 'A part.' },
      { id: 'Related', path: 'Related.tsx', description: 'Merely related.' },
    ],
    sections: [
      { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Part'] },
      { label: 'Related', kind: 'blocks' as const, inWhole: false, members: ['Related'] },
    ],
    outline: new Map([['Part', { number: '1', level: 0 }]]),
    anatomy: {
      picture: React.createElement('div', null, 'picture'),
      groups: [
        { label: 'In this picture', items: [{ member: 'Part', description: 'The numbered part.' }] },
        { label: 'No number of their own', items: [{ member: 'Related', description: 'The pinless row.' }] },
      ],
    },
  };
}

test('a legend row with no pin reserves no pin slot, while a numbered row does', () => {
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { family: familyWithPinlessLegendRow(), resolvesAddress: () => true } as never),
  );

  const rowOf = (name: string) => {
    const label = [...container.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && (e.textContent || '').trim() === name,
    );
    assert.ok(label, `expected a legend row named ${name}`);
    return label!.closest('div')!.parentElement!;
  };

  // The pin slot is a fixed-width element that exists only to hold a pin. The numbered row has one;
  // the pinless row must not, or its name renders under blank space (APPROVED.md lines 12 and 21).
  const numberedSlots = rowOf('Part').querySelectorAll('[data-pin-slot]');
  const pinlessSlots = rowOf('Related').querySelectorAll('[data-pin-slot]');
  assert.equal(numberedSlots.length, 1, 'a numbered legend row keeps its pin slot');
  assert.equal(pinlessSlots.length, 0, 'a legend row with no pin must reserve no slot at all');

  cleanup();
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run test:render; echo "exit=$?"
```

Expected: FAIL — `native/catalog/FamilyPage.tsx` has no `data-pin-slot` marker yet, so both counts are 0 and the numbered assertion fails.

- [ ] **Step 3: Add the marker to the component**

In `native/catalog/FamilyPage.tsx`, in `AnatomyMemberRow`, change the pin slot element to carry a test marker:

```tsx
        <View style={styles.legendPinSlot} {...({ 'data-pin-slot': 'member' } as Record<string, unknown>)}>
          <Pin number={pin.number} dashed={pin.dashed} />
        </View>
```

and the same `{...({ 'data-pin-slot': 'other' } as Record<string, unknown>)}` on `AnatomyOtherRow`'s slot. React Native Web forwards unknown `data-*` props to the DOM; on native they are ignored. Add a short comment saying the marker exists so a renderer test can assert the slot's presence without depending on class names.

- [ ] **Step 4: Run it green, then prove it bites**

```bash
npm run test:render; echo "exit=$?"
```

Expected: `exit=0`.

Now mutate the component — in `AnatomyMemberRow`, make the slot unconditional again:

```tsx
      <View style={styles.legendPinSlot} {...({ 'data-pin-slot': 'member' } as Record<string, unknown>)}>{pin && <Pin number={pin.number} dashed={pin.dashed} />}</View>
```

```bash
npm run test:render; echo "exit=$?"
```

Expected: **FAIL** on `a legend row with no pin must reserve no slot at all`. Revert the mutation and confirm `exit=0` again. A test that survives this mutation is not pinning anything — if it passes, fix the test before continuing.

- [ ] **Step 5: Run the whole gate**

```bash
npm test; echo "test exit=$?"
npm run test:render; echo "render exit=$?"
npm run typecheck; echo "typecheck exit=$?"
npm run build; echo "build exit=$?"
npm run check:types; echo "check:types exit=$?"
npm run check:catalog; echo "check:catalog exit=$?"
npm run check:doctor; echo "check:doctor exit=$?"
```

Expected: every line `exit=0`, `npm test` still 821 passing.

- [ ] **Step 6: Commit**

```bash
git add native/catalog/FamilyPage.tsx native/catalog/__tests__/familyPageRender.test.tsx
git commit -m "test: pin the legend's conditional pin slot with a rendered test"
```

---

### Task 4: Pin the Related block's links, notes and empty state

**Files:**
- Modify: `native/catalog/__tests__/familyPageRender.test.tsx`

**Interfaces:**
- Consumes: `renderCatalog`, and the `familyWithPinlessLegendRow` fixture from Task 3.
- Produces: nothing.

**Why this case:** `relatedPages` renders a resolvable entry as a link, an unresolvable one as plain text, an optional note after it, and nothing at all when the list is empty. Today only a human in a browser has ever confirmed that.

- [ ] **Step 1: Write the failing tests**

Append to `native/catalog/__tests__/familyPageRender.test.tsx`:

```tsx
test('relatedPages renders a resolvable entry as a link and an unresolvable one as plain text', () => {
  const family = { ...familyWithPinlessLegendRow(), relatedPages: [
    { page: 'RealPage', note: 'Why you would go there.' },
    { page: 'GonePage' },
  ] };
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { family, resolvesAddress: (n: string) => n === 'RealPage' } as never),
  );

  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#RealPage'), 'a resolvable entry must render as a real link');
  assert.ok(!links.includes('#GonePage'), 'an unresolvable entry must never render as a link');
  assert.ok((container.textContent || '').includes('GonePage'), 'but its name must still be readable as plain text');
  assert.ok((container.textContent || '').includes('Why you would go there.'), 'a note must render when present');

  cleanup();
});

test('a family with no relatedPages and no Related sections renders no Related heading at all', () => {
  const family = { ...familyWithPinlessLegendRow(), sections: [
    { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Part'] },
  ] };
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { family, resolvesAddress: () => true } as never),
  );
  const headings = [...container.querySelectorAll('h2')].map((h) => (h.textContent || '').trim());
  assert.ok(!headings.includes('Related'), 'an empty Related group must render nothing, not an empty heading');
  cleanup();
});
```

- [ ] **Step 2: Run them**

```bash
npm run test:render; echo "exit=$?"
```

Expected: `exit=0` — this behaviour already exists and shipped in 0.13.0; these tests lock it. If one fails, that is a real defect found: stop and report it rather than editing the test to match.

- [ ] **Step 3: Prove they bite**

In `native/catalog/FamilyPage.tsx`'s `RelatedPagesList`, render every entry as a link regardless of `resolvesAddress`. Run `npm run test:render` and expect FAIL on the unresolvable assertion. Revert, re-run, expect `exit=0`.

- [ ] **Step 4: Commit**

```bash
git add native/catalog/__tests__/familyPageRender.test.tsx
git commit -m "test: pin relatedPages link, note and empty-state rendering"
```

---

### Task 5: Wire it into CI and document what it cannot see

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Create: `.changes/render-test-harness.md`

- [ ] **Step 1: Add the CI step**

In `.github/workflows/ci.yml`, immediately after the existing `- run: npm test` step (line 28):

```yaml
      # Renders catalog components into jsdom through react-native-web. This catches wiring
      # defects (which element wraps what) that `npm test`'s source-text assertions cannot see.
      # It proves no geometry — jsdom has no layout engine — so `check:catalog`'s real browser
      # pass remains the only check for position and size.
      - run: npm run test:render
```

- [ ] **Step 2: Document it in the README**

In the testing section, add a short paragraph with exactly this split: `npm test` covers pure logic and source assertions; `npm run test:render` covers component structure; `npm run check:catalog` is the only thing that sees geometry, because jsdom returns zeros from `getBoundingClientRect()`. State that a layout or alignment claim must be verified in a browser, never in a renderer test.

- [ ] **Step 3: Write the change note**

Create `.changes/render-test-harness.md`, one sentence as `.changes/README.md:3-5` requires:

```md
Catalog components can now be rendered in tests, so defects in component structure are caught by `npm run test:render` instead of only in a browser.
```

- [ ] **Step 4: Run the full gate by exit code**

```bash
npm test; echo "test exit=$?"
npm run test:render; echo "render exit=$?"
npm run typecheck; echo "typecheck exit=$?"
npm run build; echo "build exit=$?"
npm run check:types; echo "check:types exit=$?"
npm run check:catalog; echo "check:catalog exit=$?"
npm run check:doctor; echo "check:doctor exit=$?"
```

Expected: every line `exit=0`.

- [ ] **Step 5: Confirm the harness does not ship**

```bash
npm pack --dry-run 2>&1 | grep -c 'test/' ; echo "expect 0"
npm pack --dry-run 2>&1 | grep -E 'total files'
```

Expected: `0` files from `test/`, and the file count unchanged from the previous release (232 at 0.13.0). If anything under `test/` appears, the `files` allowlist is wrong — fix it before committing.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml README.md .changes/render-test-harness.md
git commit -m "ci: run the component render tests"
```

---

## What this plan deliberately does not do

- **It does not convert the existing source-assertion tests.** They pass today and rewriting them is a separate decision with its own risk.
- **It does not attempt geometry.** jsdom cannot do layout. Any attempt to assert pixel positions here would produce confident, meaningless numbers — worse than no test. Geometry stays in `cli/render.ts`'s real browser pass.
- **It does not add a test framework.** No Jest, no Vitest. The repo runs `node:test`; this adds a loader, not a runtime.
- **It does not render every component.** Two files' worth of the highest-value cases first. Broadening is cheap once the harness exists; doing it now would hide harness problems behind a wall of new tests.

## Execution record

Tasks 1 and 2 were executed on branch `feat/render-test-harness` (commits `3489ce9`, `5a7da97`, `3d1473a`). Three things in this plan were wrong when run, and the text above has been corrected in place. They are recorded here because they are the plan's own lessons, not the implementer's mistakes:

1. **The dependency constraint was backwards.** The plan said the harness must bring its own React. Doing so broke both catalog hosts — they resolve React upward into the repo root, so a root copy at a different version meant two Reacts and `check:catalog` went to exit 1 with `render-failed`. The harness now borrows `kit-host`'s React and throws if that tree is missing.
2. **The smoke test called a prop that does not exist.** `Blocks` has no `children`; the assertion could never have passed. Replaced with `PagerButton`.
3. **`globalThis.navigator = …` throws on Node 22**, which ships a getter-only global. Needs `Object.defineProperty`, plus `IS_REACT_ACT_ENVIRONMENT = true` to keep output clean.

The general lesson: **plan code is a hypothesis until it runs.** Keeping Task 1 small and executing it before anything was built on top is what surfaced all three cheaply. Later tasks should expect the same and report deviations rather than forcing the written code to work.

## Self-Review

**Spec coverage.** The gap identified was "component wiring is invisible to unit tests, which is how an alignment regression passed 814 tests". Task 1 removes the technical blocker (`ERR_UNKNOWN_FILE_EXTENSION`, verified), Task 2 provides rendering, Task 3 pins the exact defect class that escaped, Task 4 pins the feature shipped alongside it, Task 5 makes CI enforce it. The geometry limitation is stated in the constraints, in the helper's own comment, in the CI comment, and in the README.

**Placeholder scan.** No TBDs. Every code step carries real code; every command carries its expected exit code or failure reason.

**Type consistency.** `renderCatalog` is defined once in Task 2 with the signature Tasks 3 and 4 use. `familyWithPinlessLegendRow` is defined in Task 3 and reused in Task 4 from the same file. `data-pin-slot` is introduced in Task 3 and used only there.

**Known risk to surface during execution, not to pre-solve:** `FamilyPage`'s props may require more than `family` and `resolvesAddress` (it also takes `openRows`, `onToggleRow`, `registerNode` in places). The implementer should read the component's own signature and pass the minimum it needs — and if the component cannot render without a large prop harness, that is itself a finding worth reporting, because it means the component is hard for a consumer to use too.
