import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyComponentDefaults, withExtraIssues, checkOverlaysFramed, checkPageTypeErrors, collectGlobalIssues, collectIssues, formatHuman, runDoctor, toDoctorJson } from '../doctor.ts';
import type { ComponentRecord, ResolvedConfig } from '../types.ts';
import type { StaticPage } from '../staticPage.ts';

function page(overrides: Partial<StaticPage>): StaticPage {
  return { file: '/x/Widget.catalog.tsx', checkable: true, ...overrides };
}

function component(overrides: Partial<ComponentRecord>): ComponentRecord {
  return { name: 'Widget', file: '/x/Widget.tsx', props: [], inheritedFrom: [], ...overrides };
}

function ids(issues: { id: string }[]): string[] {
  return issues.map((i) => i.id);
}

test('component-export-removed fires for a documented export that no longer exists', () => {
  const issues = collectIssues([page({ component: 'OldName' })], []);
  assert.deepEqual(ids(issues).filter((id) => id === 'component-export-removed'), ['component-export-removed']);
});

test('component-export-removed exempts a page with no "component" at all', () => {
  const issues = collectIssues([page({ component: undefined, group: 'Tokens' })], []);
  assert.deepEqual(ids(issues).filter((id) => id === 'component-export-removed'), []);
});

test('component-no-examples fires once per component with zero matching pages', () => {
  const issues = collectIssues([], [component({ name: 'Widget' }), component({ name: 'Gadget' })]);
  assert.deepEqual(ids(issues).filter((id) => id === 'component-no-examples').length, 2);
});

test('component-no-examples also fires for a checkable page documenting a component with none of variants/states/comparison/render — not just "no page at all"', () => {
  // `init`'s own "Needs examples" draft is exactly this shape: component/group/description only.
  const widget = component({ name: 'Widget' });
  const emptyPage = page({ component: 'Widget' });
  assert.equal(collectIssues([emptyPage], [widget]).filter((i) => i.id === 'component-no-examples').length, 1);
  const withVariants = page({ component: 'Widget', variantsItems: [{ key: 'a', name: 'A' }] });
  assert.equal(collectIssues([withVariants], [widget]).filter((i) => i.id === 'component-no-examples').length, 0);
});

test('duplicate-page-id fires once per page sharing an id, and not for distinct ids', () => {
  const dup = collectIssues([page({ id: 'Same', file: '/a.catalog.tsx' }), page({ id: 'Same', file: '/b.catalog.tsx' })], []);
  assert.equal(ids(dup).filter((id) => id === 'duplicate-page-id').length, 2);
  const distinct = collectIssues([page({ id: 'A', file: '/a.catalog.tsx' }), page({ id: 'B', file: '/b.catalog.tsx' })], []);
  assert.equal(ids(distinct).filter((id) => id === 'duplicate-page-id').length, 0);
});

test('page-parse-error maps a reader parse failure into its own issue, and suppresses page-not-checkable for the same page', () => {
  const issues = collectIssues([page({ checkable: false, parseError: 'Unexpected token' })], []);
  assert.deepEqual(ids(issues), ['page-parse-error']);
});

test('page-not-checkable fires for a non-literal page with no parse error', () => {
  const issues = collectIssues([page({ checkable: false })], []);
  assert.deepEqual(ids(issues), ['page-not-checkable']);
});

test('grid-axis-key-invalid fires for a duplicate row key', () => {
  const issues = collectIssues([page({
    comparison: { rows: { items: [{ key: 'a', label: 'A' }, { key: 'a', label: 'A again' }] }, columns: { items: [{ key: 'c', label: 'C' }] } },
  })], []);
  assert.ok(issues.some((i) => i.id === 'grid-axis-key-invalid' && i.message.includes('Duplicate row key "a"')));
});

test('grid-axis-key-invalid fires for an empty key', () => {
  const issues = collectIssues([page({
    comparison: { rows: { items: [{ key: '', label: 'A' }] }, columns: { items: [{ key: 'c', label: 'C' }] } },
  })], []);
  assert.ok(issues.some((i) => i.id === 'grid-axis-key-invalid' && i.message.includes('empty key')));
});

test('grid-column-limit fires only once the regular-size limit (3) is exceeded', () => {
  const columnsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `c${i}`, label: `C${i}` }));
  const within = collectIssues([page({ comparison: { rows: { items: [{ key: 'r', label: 'R' }] }, columns: { items: columnsOf(3) } } })], []);
  assert.equal(within.filter((i) => i.id === 'grid-column-limit').length, 0);
  const over = collectIssues([page({ comparison: { rows: { items: [{ key: 'r', label: 'R' }] }, columns: { items: columnsOf(4) } } })], []);
  assert.equal(over.filter((i) => i.id === 'grid-column-limit').length, 1);
});

test('propnotes-prop-removed fires for a propNotes key naming a removed prop', () => {
  const issues = collectIssues([page({ component: 'Widget', propNoteKeys: ['removed'] })], [component({ props: [{ name: 'kept', type: 'string', required: false, desc: '' }] })]);
  assert.ok(issues.some((i) => i.id === 'propnotes-prop-removed'));
});

test('bound-axis-prop-removed fires when the bound prop name no longer exists', () => {
  const issues = collectIssues([page({
    component: 'Widget',
    comparison: { rows: { prop: 'gone', items: [{ key: 'a', label: 'A' }] }, columns: { items: [{ key: 'c', label: 'C' }] } },
  })], [component({ props: [] })]);
  assert.ok(issues.some((i) => i.id === 'bound-axis-prop-removed'));
});

test('bound-axis-not-union fires when the bound prop exists but has no options', () => {
  const issues = collectIssues([page({
    component: 'Widget',
    comparison: { rows: { prop: 'disabled', items: [{ key: 'a', label: 'A' }] }, columns: { items: [{ key: 'c', label: 'C' }] } },
  })], [component({ props: [{ name: 'disabled', type: 'boolean', required: false, desc: '' }] })]);
  assert.ok(issues.some((i) => i.id === 'bound-axis-not-union'));
});

test('bound-option-removed fires for a bound axis item whose key is no longer an option', () => {
  const issues = collectIssues([page({
    component: 'Widget',
    comparison: { rows: { prop: 'variant', items: [{ key: 'ghost', label: 'Ghost' }] }, columns: { items: [{ key: 'c', label: 'C' }] } },
  })], [component({ props: [{ name: 'variant', type: "'primary'", required: true, desc: '', options: ['primary'] }] })]);
  assert.ok(issues.some((i) => i.id === 'bound-option-removed' && i.message.includes('row')));
});

test('bound-option-removed also fires for a tagged list item whose value is no longer an option, or whose tagged prop name doesn\'t exist at all', () => {
  const valueRemoved = collectIssues([page({
    component: 'Widget',
    variantsItems: [{ key: 'ghost', name: 'Ghost', props: { variant: 'ghost' } }],
  })], [component({ props: [{ name: 'variant', type: "'primary'", required: true, desc: '', options: ['primary'] }] })]);
  assert.ok(valueRemoved.some((i) => i.id === 'bound-option-removed' && i.message.includes('tagged')));

  // Previously silently skipped — `!prop?.options` was true for both "prop missing entirely" and
  // "prop exists but isn't a union," so a renamed/removed prop name never surfaced here at all.
  const propNameRemoved = collectIssues([page({
    component: 'Widget',
    variantsItems: [{ key: 'ghost', name: 'Ghost', props: { gone: 'ghost' } }],
  })], [component({ props: [] })]);
  assert.ok(propNameRemoved.some((i) => i.id === 'bound-option-removed' && i.message.includes('no longer a prop')));
});

test('bound-option-removed is never fired for a tagged prop name that is genuinely inherited from node_modules (e.g. autoCapitalize on a TextInput-extending component) — only a real drift fires', () => {
  const inherited = collectIssues([page({
    component: 'SearchField',
    variantsItems: [{ key: 'a', name: 'A', props: { autoCapitalize: 'none' } }],
  })], [component({ name: 'SearchField', props: [], inheritedFrom: ['TextInput'] })]);
  assert.deepEqual(inherited.filter((i) => i.id === 'bound-option-removed'), []);
});

test('internal-prop-unknown catches a misspelled internalProps key, but not a genuinely inherited prop', () => {
  const twoOptions = [component({ props: [{ name: 'size', type: "'a' | 'b'", required: true, desc: '', options: ['a', 'b'] }] })];
  // A real key exempts the prop and says nothing.
  const correct = collectIssues([page({ component: 'Widget', internalProps: ['size'] })], twoOptions);
  assert.deepEqual(correct.filter((i) => i.id === 'internal-prop-unknown'), []);
  assert.deepEqual(correct.filter((i) => i.id === 'option-not-covered'), []);

  // A typo exempts nothing, so say so rather than leaving the author with unexplained warnings.
  const typo = collectIssues([page({ component: 'Widget', internalProps: ['sizee'] })], twoOptions);
  const unknown = typo.filter((i) => i.id === 'internal-prop-unknown');
  assert.equal(unknown.length, 1);
  assert.match(unknown[0].message, /"sizee", which is not a prop of Widget/);
  assert.equal(typo.filter((i) => i.id === 'option-not-covered').length, 2);

  // An inherited name is absent from component.props by design — the same exemption
  // bound-option-removed makes for a tagged inherited prop.
  const inherited = collectIssues([page({
    component: 'SearchField',
    internalProps: ['autoCapitalize'],
  })], [component({ name: 'SearchField', props: [], inheritedFrom: ['TextInput'] })]);
  assert.deepEqual(inherited.filter((i) => i.id === 'internal-prop-unknown'), []);
});

test('option-not-covered fires for an uncovered option and not for one covered by a bound axis or a tagged item', () => {
  const twoOptions = [component({ props: [{ name: 'variant', type: "'a' | 'b'", required: true, desc: '', options: ['a', 'b'] }] })];
  const uncovered = collectIssues([page({ component: 'Widget' })], twoOptions);
  assert.equal(uncovered.filter((i) => i.id === 'option-not-covered').length, 2);
  const coveredByAxis = collectIssues([page({
    component: 'Widget',
    comparison: { rows: { prop: 'variant', items: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] }, columns: { items: [{ key: 'c', label: 'C' }] } },
  })], twoOptions);
  assert.equal(coveredByAxis.filter((i) => i.id === 'option-not-covered').length, 0);
  const coveredByTag = collectIssues([page({
    component: 'Widget',
    variantsItems: [{ key: 'a', name: 'A', props: { variant: 'a' } }, { key: 'b', name: 'B', props: { variant: 'b' } }],
  })], twoOptions);
  assert.equal(coveredByTag.filter((i) => i.id === 'option-not-covered').length, 0);
});

test('group-unmatched fires when a states item names a group with no matching variant key', () => {
  const issues = collectIssues([page({
    component: 'Widget',
    variantsItems: [{ key: 'circle', name: 'Circle' }],
    statesItems: [{ key: 'x', name: 'X', group: 'triangle' }],
  })], [component({})]);
  assert.ok(issues.some((i) => i.id === 'group-unmatched'));
});

test('missing-guidance-or-a11y fires for a missing whenToUse and a missing a11y, as two separate messages under the same id; both are silenced by tokenGallery, and hiding the section is not an exemption', () => {
  const missingBoth = collectIssues([page({ component: 'Widget', hasWhenToUse: false, hasA11y: false })], [component({})]);
  assert.equal(missingBoth.filter((i) => i.id === 'missing-guidance-or-a11y').length, 2);
  assert.ok(missingBoth.some((i) => i.message.includes('whenToUse')));
  assert.ok(missingBoth.some((i) => i.message.includes('a11y')));
  const missingWhenToUseOnly = collectIssues([page({ component: 'Widget', hasWhenToUse: false, hasA11y: true })], [component({})]);
  assert.equal(missingWhenToUseOnly.filter((i) => i.id === 'missing-guidance-or-a11y').length, 1);
  const missingA11yOnly = collectIssues([page({ component: 'Widget', hasWhenToUse: true, hasA11y: false })], [component({})]);
  assert.equal(missingA11yOnly.filter((i) => i.id === 'missing-guidance-or-a11y').length, 1);
  const hasBoth = collectIssues([page({ component: 'Widget', hasWhenToUse: true, hasA11y: true })], [component({})]);
  assert.equal(hasBoth.filter((i) => i.id === 'missing-guidance-or-a11y').length, 0);
  // Hiding the accessibility section removes the visible placeholder, not the obligation: the gap
  // would otherwise be invisible to both the reader and the doctor.
  const hiddenA11y = collectIssues([page({ component: 'Widget', hasWhenToUse: true, hasA11y: false, hidesAccessibility: true })], [component({})]);
  const hidden = hiddenA11y.filter((i) => i.id === 'missing-guidance-or-a11y');
  assert.equal(hidden.length, 1);
  assert.ok(hidden[0].message.includes('hides the accessibility section'));
  const tokenPage = collectIssues([page({ component: 'Widget', tokenGallery: true, hasWhenToUse: false, hasA11y: false })], [component({})]);
  assert.equal(tokenPage.filter((i) => i.id === 'missing-guidance-or-a11y').length, 0);
});

test('internalProps exempts a declared plumbing prop from option-not-covered, and only that prop', () => {
  const widget = component({ props: [
    { name: 'size', type: "'sm' | 'lg'", options: ['sm', 'lg'] },
    { name: 'tone', type: "'calm' | 'loud'", options: ['calm', 'loud'] },
  ] });
  const uncovered = collectIssues([page({ component: 'Widget', variantsItems: [{ key: 'a', name: 'A' }] })], [widget]);
  assert.equal(uncovered.filter((i) => i.id === 'option-not-covered').length, 4);
  const declared = collectIssues([page({ component: 'Widget', variantsItems: [{ key: 'a', name: 'A' }], internalProps: ['size'] })], [widget]);
  const left = declared.filter((i) => i.id === 'option-not-covered');
  assert.equal(left.length, 2);
  assert.ok(left.every((i) => i.message.includes('tone')));
});

test('preview-only-component-page fires for a component documented by render() alone, never for a token gallery or a declared static preview', () => {
  const previewOnly = collectIssues([page({ component: 'Widget', hasRender: true })], [component({})]);
  assert.equal(previewOnly.filter((i) => i.id === 'preview-only-component-page').length, 1);
  // A named example of any kind is enough: the reader gets captions and the other rules can read them.
  const withVariants = collectIssues([page({ component: 'Widget', hasRender: true, variantsItems: [{ key: 'a', name: 'A' }] })], [component({})]);
  assert.equal(withVariants.filter((i) => i.id === 'preview-only-component-page').length, 0);
  const tokenGallery = collectIssues([page({ component: 'Widget', hasRender: true, tokenGallery: true })], [component({})]);
  assert.equal(tokenGallery.filter((i) => i.id === 'preview-only-component-page').length, 0);
  const declaredStatic = collectIssues([page({ component: 'Widget', hasRender: true, intentionalStaticPreviewReason: 'A gallery of every icon.' })], [component({})]);
  assert.equal(declaredStatic.filter((i) => i.id === 'preview-only-component-page').length, 0);
});

test('a page marked not checkable only ever gets page-not-checkable — every other check (grid axis keys, bound options) is skipped for it, even when some of its data was in fact read', () => {
  const notCheckable = page({
    checkable: false, component: 'Widget', id: 'Widget',
    // Both of these would otherwise fire (a duplicate row key; a tagged option that doesn't
    // exist) — proving the suppression is real, not just "there was nothing to flag anyway".
    comparison: { rows: { items: [{ key: 'a', label: 'A' }, { key: 'a', label: 'A again' }] }, columns: { items: [{ key: 'c', label: 'C' }] } },
    variantsItems: [{ key: 'ghost', name: 'Ghost', props: { variant: 'ghost' } }],
  });
  const issues = collectIssues([notCheckable], [component({ props: [{ name: 'variant', type: "'primary'", required: true, desc: '', options: ['primary'] }] })]);
  assert.deepEqual(ids(issues), ['page-not-checkable']);
});

test('collectGlobalIssues maps each sync warning and flags zero configured token files', () => {
  const issues = collectGlobalIssues({ syncWarnings: ['Could not read Bad/index.ts: boom'], tokenFileCount: 0 });
  assert.deepEqual(ids(issues), ['props-unreadable', 'no-token-modules']);
  const withTokens = collectGlobalIssues({ syncWarnings: [], tokenFileCount: 1 });
  assert.deepEqual(ids(withTokens), []);
});

// Errata 1 (controller, binding): a page discovered from a component folder (not a `pages` glob)
// with no explicit "component:" documents the component named by its own file (design §2 — the
// viewer already applies this same default via `page.component ?? page.id`, and the generated
// page index already defaults a missing `id` to the file stem). This proves the default is real:
// a bound option that no longer exists against the defaulted component name still fires the drift
// error, and the page is never also reported as `component-no-examples` just because it never
// wrote an explicit "component:".
test('a component-folder page with no "component:" defaults to its own file\'s stem — drift against that defaulted component still fires, and component-no-examples does not', () => {
  const widgetPage = page({
    file: '/components/Widget/Widget.catalog.tsx',
    component: undefined,
    comparison: { rows: { prop: 'variant', items: [{ key: 'ghost', label: 'Ghost' }] }, columns: { items: [{ key: 'c', label: 'C' }] } },
  });
  const defaulted = applyComponentDefaults([widgetPage], new Set(['/components/Widget']));
  const widget = component({ name: 'Widget', props: [{ name: 'variant', type: "'primary'", required: true, desc: '', options: ['primary'] }] });
  const issues = collectIssues(defaulted, [widget]);
  assert.ok(issues.some((i) => i.id === 'bound-option-removed'));
  assert.equal(issues.filter((i) => i.id === 'component-no-examples').length, 0);
  // Pages from `pages` globs stay standalone and exempt — never defaulted just by file location.
  const standalone = page({ file: '/pages/Colors.catalog.tsx', component: undefined, group: 'Tokens' });
  assert.equal(applyComponentDefaults([standalone], new Set(['/components/Widget']))[0].component, undefined);
});

const WIDGET_SOURCE = `
import type React from 'react';
export type WidgetVariant = 'primary' | 'secondary';
export function Widget({ variant }: { variant: WidgetVariant }): React.ReactElement {
  return null as never;
}
`;

// Errata (controller, binding): a stub `node_modules/@krapwoo/ds-viewer` so `checkPageTypeErrors`'s
// real `ts.Program` never reports TS2307 on every fixture page's own `import { defineCatalogPage }
// from '@krapwoo/ds-viewer'` — `defineCatalogPage`/`grid` are declared `any`-typed. `react` is
// deliberately left unresolved (`checkPageTypeErrors` never needs it to be real; a page's own
// `import type React from 'react'` in a fixture component is a type-only import and never reaches
// this check at all).
function makeProject(pageSource: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-doctor-'));
  mkdirSync(path.join(dir, 'components', 'Widget'), { recursive: true });
  writeFileSync(path.join(dir, 'components', 'Widget', 'index.ts'), WIDGET_SOURCE);
  writeFileSync(path.join(dir, 'components', 'Widget', 'Widget.catalog.tsx'), pageSource);
  mkdirSync(path.join(dir, 'tokens'), { recursive: true });
  writeFileSync(path.join(dir, 'tokens', 'index.ts'), "export const DS_COLOR = { blue: '#00f' };\n");
  mkdirSync(path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer'), { recursive: true });
  writeFileSync(
    path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer', 'package.json'),
    JSON.stringify({ name: '@krapwoo/ds-viewer', types: 'index.d.ts' }),
  );
  writeFileSync(
    path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer', 'index.d.ts'),
    'export const defineCatalogPage: any;\nexport const grid: any;\n',
  );
  return dir;
}

function configFor(dir: string, overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    name: 'Fixture', components: ['components/*/index.ts'], tokens: ['tokens/index.ts'], pages: [],
    updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'ds-viewer.config.ts'),
    ...overrides,
  };
}

const FULLY_COVERED_PAGE = `
import { defineCatalogPage } from '@krapwoo/ds-viewer';
export default defineCatalogPage({
  component: 'Widget', group: 'Components', description: 'x',
  variants: { items: [
    { key: 'primary', name: 'Primary', props: { variant: 'primary' }, node: null },
    { key: 'secondary', name: 'Secondary', props: { variant: 'secondary' }, node: null },
  ] },
});
`;

test('runDoctor never reports component-export-removed for a page inside a folder excluded via config.exclude — that folder is dropped the same way sync drops it', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ group: 'Components', description: 'x' });
  `);
  const result = runDoctor(configFor(dir, { exclude: [path.join('components', 'Widget', 'index.ts')] }));
  assert.equal(result.issues.filter((i) => i.id === 'component-export-removed').length, 0);
  rmSync(dir, { recursive: true, force: true });
});

// Important finding 2 (Fable's review): `checkPageTypeErrors` must honor the host project's own
// tsconfig (its ambient declarations and its `strict`/`lib`/etc. settings), not a fixed option set.
function makeProjectWithTsconfig(pageSource: string, tsconfigCompilerOptions: Record<string, unknown>, extraFiles: Record<string, string> = {}): string {
  const dir = makeProject(pageSource);
  writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { module: 'esnext', moduleResolution: 'bundler', jsx: 'react-jsx', ...tsconfigCompilerOptions } }),
  );
  for (const [name, contents] of Object.entries(extraFiles)) writeFileSync(path.join(dir, name), contents);
  return dir;
}

test('checkPageTypeErrors resolves a page import through the host tsconfig\'s own ambient module declarations (e.g. expo-env.d.ts\'s *.png)', () => {
  const dir = makeProjectWithTsconfig(
    `
      import { defineCatalogPage } from '@krapwoo/ds-viewer';
      import logo from './logo.png';
      export default defineCatalogPage({ component: 'Widget', group: 'Components', description: logo });
    `,
    {},
    { 'declarations.d.ts': "declare module '*.png' {\n  const value: string;\n  export default value;\n}\n" },
  );
  const result = runDoctor(configFor(dir));
  assert.deepEqual(result.issues.filter((i) => i.id === 'page-parse-error'), []);
  rmSync(dir, { recursive: true, force: true });
});

test('checkPageTypeErrors uses the host project\'s tsconfig even when every page lives outside it (a sibling kit folder under a parent with other settings)', () => {
  // workspace/
  //   tsconfig.json          ← a parent's own settings (no JSX), like this repo's CLI tsconfig
  //   kit/Widget.catalog.tsx ← the pages, outside the host
  //   host/                  ← the project ds-viewer runs in, with its own JSX-enabled tsconfig
  const root = mkdtempSync(path.join(tmpdir(), 'ds-viewer-doctor-sibling-'));
  writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'nodenext', moduleResolution: 'nodenext' } }));
  mkdirSync(path.join(root, 'kit'), { recursive: true });
  const pageFile = path.join(root, 'kit', 'Widget.catalog.tsx');
  writeFileSync(pageFile, "import React from 'react';\nexport const node = <view />;\nexport default { group: 'Components', description: 'x' };\n");
  const host = path.join(root, 'host');
  mkdirSync(path.join(host, 'node_modules', '@types', 'react'), { recursive: true });
  writeFileSync(path.join(host, 'node_modules', '@types', 'react', 'index.d.ts'), 'declare const React: any; export = React; declare global { namespace JSX { interface IntrinsicElements { [name: string]: any } } }\n');
  writeFileSync(path.join(host, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'esnext', moduleResolution: 'bundler', jsx: 'react-jsx', jsxImportSource: undefined, types: [] } }));
  const fallbackPaths = { '*': [path.join(host, 'node_modules', '@types', '*'), path.join(host, 'node_modules', '*')] };
  const issues = checkPageTypeErrors([{ file: pageFile, checkable: true, group: 'Components' }], { fallbackPaths, hostRoot: host });
  const messages = issues.map((i) => i.message);
  assert.ok(!messages.some((m) => /--jsx|explicit file extensions/.test(m)), messages.join('\n'));
  rmSync(root, { recursive: true, force: true });
});

test('checkPageTypeErrors honors a host tsconfig that sets strict: false — no strict-only diagnostic fires', () => {
  const dir = makeProjectWithTsconfig(
    `
      import { defineCatalogPage } from '@krapwoo/ds-viewer';
      const identity = (x) => x;
      export default defineCatalogPage({ component: 'Widget', group: 'Components', description: String(identity(1)) });
    `,
    { strict: false },
  );
  const result = runDoctor(configFor(dir));
  assert.deepEqual(result.issues.filter((i) => i.id === 'page-parse-error'), []);
  rmSync(dir, { recursive: true, force: true });
});

// Minor finding (Fable's review), Errata 6: a page with a genuine syntax error is skipped by
// `checkPageTypeErrors` (`pages.filter((p) => !p.parseError)`) so it is reported exactly once, by
// `checkParseErrors` — never a second time from the real `ts.Program` typecheck. Previously only
// tested at the `collectIssues` level (not `runDoctor`, where both checks actually run together).
test('runDoctor reports a syntax-error page exactly once, not twice (once from the syntactic reader, once from the real ts.Program)', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ group: 'Components', description: 'x'
  `);
  const result = runDoctor(configFor(dir));
  assert.equal(result.issues.filter((i) => i.id === 'page-parse-error').length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctor reports zero errors for a fully covered page', () => {
  const dir = makeProject(FULLY_COVERED_PAGE);
  const result = runDoctor(configFor(dir));
  assert.equal(result.summary.errors, 0);
  assert.equal(result.exitCode, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctor reports an error for a tagged option that no longer exists, with every issue\'s file relative to the project root', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { items: [{ key: 'removed', name: 'Removed', props: { variant: 'removed' }, node: null }] },
    });
  `);
  const result = runDoctor(configFor(dir));
  assert.equal(result.summary.errors, 1);
  assert.equal(result.exitCode, 1);
  const boundOptionIssue = result.issues.find((i) => i.id === 'bound-option-removed');
  assert.ok(boundOptionIssue);
  // Design's own `--json` example gives a project-relative `file` — never the absolute path
  // `StaticPage.file` (from `discoverAllPageFiles`) carries internally.
  assert.equal(boundOptionIssue?.file, path.join('components', 'Widget', 'Widget.catalog.tsx'));
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctor reports a page-parse-error, with a real line number, for a page file with a genuine semantic type error', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const bad: string = 42;
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const result = runDoctor(configFor(dir));
  const typeIssue = result.issues.find((i) => i.id === 'page-parse-error');
  assert.ok(typeIssue, 'expected a page-parse-error issue from the real ts.Program typecheck');
  assert.equal(typeof typeIssue?.line, 'number');
  assert.ok((typeIssue?.line ?? 0) > 0);
  rmSync(dir, { recursive: true, force: true });
});

test('doctor.strict promotes every warning to an error, flipping the exit code', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const lenient = runDoctor(configFor(dir));
  assert.equal(lenient.exitCode, 0);
  assert.ok(lenient.summary.warnings > 0);
  const strict = runDoctor(configFor(dir, { doctor: { strict: true } }));
  assert.equal(strict.summary.warnings, 0);
  assert.ok(strict.summary.errors > 0);
  assert.equal(strict.exitCode, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('toDoctorJson produces exactly {version, summary, update, issues}, with update always null in 0.3', () => {
  const dir = makeProject(FULLY_COVERED_PAGE);
  const json = toDoctorJson(runDoctor(configFor(dir)));
  assert.deepEqual(Object.keys(json).sort(), ['issues', 'summary', 'update', 'version']);
  assert.equal(json.version, 1);
  assert.equal(json.update, null);
  rmSync(dir, { recursive: true, force: true });
});

test('formatHuman groups issues by page, lists page-less issues under "General", and ends with a summary line', () => {
  const text = formatHuman({
    version: 1, update: null,
    summary: { errors: 1, warnings: 1, components: 1, withExamples: 1, unboundExamples: 0 },
    issues: [
      { id: 'bound-option-removed', severity: 'error', page: 'Widget', file: '/x/Widget.catalog.tsx', message: 'm1', fix: 'f1' },
      { id: 'no-token-modules', severity: 'warning', message: 'm2', fix: 'f2' },
    ],
  });
  assert.match(text, /^Widget\n/);
  assert.match(text, /General/);
  assert.match(text, /1 error, 1 warning/);
});

test('formatHuman appends an issue\'s file (and line, when present) so a syntax error isn\'t reported with no file at all, and a semantic one doesn\'t lose its line', () => {
  const text = formatHuman({
    version: 1, update: null,
    summary: { errors: 2, warnings: 0, components: 1, withExamples: 0, unboundExamples: 0 },
    issues: [
      { id: 'page-parse-error', severity: 'error', file: 'pages/Bad.catalog.tsx', message: 'Unexpected token', fix: 'Fix the syntax error, then rerun doctor.' },
      { id: 'page-parse-error', severity: 'error', page: 'Widget', file: 'components/Widget/Widget.catalog.tsx', line: 12, message: 'Failed to typecheck: x', fix: 'Fix the error, then rerun doctor.' },
    ],
  });
  assert.match(text, /Unexpected token \(pages\/Bad\.catalog\.tsx\)/);
  assert.match(text, /Failed to typecheck: x \(components\/Widget\/Widget\.catalog\.tsx:12\)/);
});

test('the summary counts an unbound grid axis item and an untagged list item as unbound examples', () => {
  const dir = makeProject(`
    import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: grid('Variant', 'State', [{ key: 'primary', label: 'Primary' }], [{ key: 'default', label: 'Default' }], (row, column) => null),
      states: { items: [{ key: 'untagged', name: 'Untagged', node: null }] },
    });
  `);
  // 1 unbound row + 1 unbound column + 1 untagged state item.
  assert.equal(runDoctor(configFor(dir)).summary.unboundExamples, 3);
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctor itself always returns update: null — the update check is layered on by runDoctorCommand, never inside the pure rules engine', () => {
  const dir = makeProject(FULLY_COVERED_PAGE);
  assert.equal(runDoctor(configFor(dir)).update, null);
  rmSync(dir, { recursive: true, force: true });
});

// Guided intelligence design §4 / plan Task 3 — `missing-composition-suggestion`: a conservative,
// advisory (never fatal) nudge naming a candidate's component, source file and line — never an
// inferred role/relationship, which stays the author's own call via `composedOf`.
test('missing-composition-suggestion fires for a composedOfCandidate the page\'s composedOf never names', () => {
  const widget = component({ composedOfCandidates: [{ component: 'Icon', file: 'x/Widget.tsx', line: 12 }] });
  const issues = collectIssues([page({ component: 'Widget', hasComposedOf: false })], [widget, component({ name: 'Icon', file: '/x/Icon.tsx' })]);
  const found = issues.find((i) => i.id === 'missing-composition-suggestion');
  assert.ok(found, 'expected a missing-composition-suggestion issue');
  assert.equal(found!.severity, 'warning');
  assert.match(found!.message, /"Icon"/);
  assert.match(found!.message, /x\/Widget\.tsx:12/);
  // Conservative: never an invented role/relationship word in the message or its fix.
  assert.ok(!/built-in|slot|related/i.test(found!.message + found!.fix));
});

test('missing-composition-suggestion does not fire once the page\'s own composedOf already names the candidate', () => {
  const widget = component({ composedOfCandidates: [{ component: 'Icon', file: 'x/Widget.tsx', line: 12 }] });
  const issues = collectIssues([page({ component: 'Widget', hasComposedOf: true, composedOf: [{ component: 'Icon' }] })], [widget]);
  assert.equal(issues.filter((i) => i.id === 'missing-composition-suggestion').length, 0);
});

test('missing-composition-suggestion never fires when composedOf was authored but not literally readable — never a false "missing" claim', () => {
  const widget = component({ composedOfCandidates: [{ component: 'Icon', file: 'x/Widget.tsx', line: 12 }] });
  // hasComposedOf: true, composedOf: undefined — authored non-literally (e.g. a `.map()` call).
  const issues = collectIssues([page({ component: 'Widget', hasComposedOf: true, composedOf: undefined })], [widget]);
  assert.equal(issues.filter((i) => i.id === 'missing-composition-suggestion').length, 0);
});

test('missing-composition-suggestion only suggests a real catalog component or page — naming anything else would log "unknown component" in the viewer', () => {
  // Icon here is a plain helper (e.g. starter-kit/icons), not a detected component or a page.
  const widget = component({ composedOfCandidates: [{ component: 'Icon', file: 'x/Widget.tsx', line: 12 }, { component: 'Spinner', file: 'x/Widget.tsx', line: 20 }] });
  const spinner = component({ name: 'Spinner', file: '/x/Spinner.tsx' });
  const issues = collectIssues([page({ component: 'Widget' })], [widget, spinner]).filter((i) => i.id === 'missing-composition-suggestion');
  assert.deepEqual(issues.map((i) => /renders "(\w+)"/.exec(i.message)?.[1]), ['Spinner']);
  // A page id counts as known too (e.g. a standalone recipe page).
  const viaPage = collectIssues([page({ component: 'Widget' }), page({ id: 'Icon', file: '/x/Icon.catalog.tsx' })], [widget]).filter((i) => i.id === 'missing-composition-suggestion');
  assert.deepEqual(viaPage.map((i) => /renders "(\w+)"/.exec(i.message)?.[1]), ['Icon']);
});

test('missing-composition-suggestion reports each component once per page, at its first call site', () => {
  const widget = component({ composedOfCandidates: [{ component: 'Button', file: 'x/Widget.tsx', line: 30 }, { component: 'Button', file: 'x/Widget.tsx', line: 31 }] });
  const issues = collectIssues([page({ component: 'Widget' })], [widget, component({ name: 'Button', file: '/x/Button.tsx' })]).filter((i) => i.id === 'missing-composition-suggestion');
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /x\/Widget\.tsx:30/);
});

test('missing-composition-suggestion never fires for a component with no candidates at all', () => {
  const widget = component({});
  const issues = collectIssues([page({ component: 'Widget' })], [widget]);
  assert.equal(issues.filter((i) => i.id === 'missing-composition-suggestion').length, 0);
});

// Guided intelligence design §2 / plan Task 3 — `degenerate-grid-axis`: a grid whose row or column
// axis has only one item reads as a one-axis list, not a real two-axis comparison. Advisory
// (warning, never an error) and semantically distinct from the existing hard grid-validity errors
// (`grid-axis-key-invalid`, `grid-column-limit`) — authors keep full authority to keep it as is.
test('degenerate-grid-axis fires a warning for a 1-column grid', () => {
  const issues = collectIssues([page({
    comparison: { rows: { items: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] }, columns: { items: [{ key: 'c', label: 'C' }] } },
  })], []);
  const found = issues.find((i) => i.id === 'degenerate-grid-axis');
  assert.ok(found);
  assert.equal(found!.severity, 'warning');
});

test('degenerate-grid-axis fires for a 1-row grid too', () => {
  const issues = collectIssues([page({
    comparison: { rows: { items: [{ key: 'a', label: 'A' }] }, columns: { items: [{ key: 'c', label: 'C' }, { key: 'd', label: 'D' }] } },
  })], []);
  assert.equal(issues.filter((i) => i.id === 'degenerate-grid-axis').length, 1);
});

test('degenerate-grid-axis does not fire for a genuine two-axis (2x2 or larger) grid', () => {
  const issues = collectIssues([page({
    comparison: {
      rows: { items: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] },
      columns: { items: [{ key: 'c', label: 'C' }, { key: 'd', label: 'D' }] },
    },
  })], []);
  assert.equal(issues.filter((i) => i.id === 'degenerate-grid-axis').length, 0);
});

test('degenerate-grid-axis never runs against a not-checkable page — never a partial read', () => {
  const issues = collectIssues([page({ checkable: false, comparison: undefined })], []);
  assert.equal(issues.filter((i) => i.id === 'degenerate-grid-axis').length, 0);
});

// Guided intelligence design §3 / plan Task 3 — `missing-working-preview`: advisory, never fatal,
// and fired only when a documented component has a controlled state/event pair (e.g.
// `selected`/`onSelectedChange`) AND every direct-component example confidently demonstrates a
// fixed value with a no-op/omitted callback. Unknown callback/wrapper logic must stay uncheckable
// — never declared inert — and a genuine stateful wrapper or an explicit intentional-static
// declaration must never fire it.
const pillRow = component({
  name: 'PillRow',
  props: [
    { name: 'selected', type: 'string', required: false, desc: '' },
    { name: 'onSelectedChange', type: '(next: string) => void', required: false, desc: '' },
  ],
});

test('missing-working-preview fires when every direct example passes a fixed value with a no-op callback', () => {
  const issues = collectIssues([page({
    component: 'PillRow',
    variantsItems: [
      { key: 'a', name: 'A', nodeDirectComponent: 'PillRow', nodeAttributes: { selected: { kind: 'literal', value: 'one' }, onSelectedChange: { kind: 'no-op-callback' } } },
    ],
  })], [pillRow]);
  const found = issues.find((i) => i.id === 'missing-working-preview');
  assert.ok(found);
  assert.equal(found!.severity, 'warning');
});

test('missing-working-preview does not fire for a genuine stateful wrapper', () => {
  const issues = collectIssues([page({
    component: 'PillRow',
    variantsItems: [{ key: 'a', name: 'A', nodeStatefulWrapper: true }],
  })], [pillRow]);
  assert.equal(issues.filter((i) => i.id === 'missing-working-preview').length, 0);
});

test('missing-working-preview is suppressed by an explicit intentional-static declaration with its reason', () => {
  const issues = collectIssues([page({
    component: 'PillRow',
    intentionalStaticPreviewReason: 'Selection is already demonstrated by SegmentedToggle.',
    variantsItems: [
      { key: 'a', name: 'A', nodeDirectComponent: 'PillRow', nodeAttributes: { selected: { kind: 'literal', value: 'one' }, onSelectedChange: { kind: 'no-op-callback' } } },
    ],
  })], [pillRow]);
  assert.equal(issues.filter((i) => i.id === 'missing-working-preview').length, 0);
});

test('missing-working-preview does not fire for a component with no controlled state/event pair', () => {
  const plain = component({ name: 'Badge', props: [{ name: 'label', type: 'string', required: true, desc: '' }] });
  const issues = collectIssues([page({
    component: 'Badge',
    variantsItems: [{ key: 'a', name: 'A', nodeDirectComponent: 'Badge', nodeAttributes: { label: { kind: 'literal', value: 'Hi' } } }],
  })], [plain]);
  assert.equal(issues.filter((i) => i.id === 'missing-working-preview').length, 0);
});

test('missing-working-preview does not run against a not-checkable (computed) page — never a partial read', () => {
  const issues = collectIssues([page({
    component: 'PillRow', checkable: false,
    variantsItems: [
      { key: 'a', name: 'A', nodeDirectComponent: 'PillRow', nodeAttributes: { selected: { kind: 'literal', value: 'one' }, onSelectedChange: { kind: 'no-op-callback' } } },
    ],
  })], [pillRow]);
  assert.equal(issues.filter((i) => i.id === 'missing-working-preview').length, 0);
});

test('missing-working-preview does not fire when the callback is an unknown expression — uncheckable, never declared inert', () => {
  const issues = collectIssues([page({
    component: 'PillRow',
    variantsItems: [
      { key: 'a', name: 'A', nodeDirectComponent: 'PillRow', nodeAttributes: { selected: { kind: 'literal', value: 'one' }, onSelectedChange: { kind: 'unknown' } } },
    ],
  })], [pillRow]);
  assert.equal(issues.filter((i) => i.id === 'missing-working-preview').length, 0);
});

test('overlay-without-device-frame warns when a Modal-opening component\'s page has no device frame', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-overlay-'));
  writeFileSync(path.join(dir, 'Picker.tsx'), "import { Modal as RNModal, View } from 'react-native';\nexport function Picker() { return null; }\n");
  const picker = component({ name: 'Picker', file: 'Picker.tsx' });
  const bare = checkOverlaysFramed([page({ component: 'Picker', viewerImports: ['defineCatalogPage'] })], [picker], dir);
  assert.deepEqual(bare.map((i) => [i.id, i.severity]), [['overlay-without-device-frame', 'warning']]);
  for (const frame of ['PhoneFrame', 'OverlayDemo', 'PhoneScreen', 'BoundedOverlayViewport']) {
    assert.equal(checkOverlaysFramed([page({ component: 'Picker', viewerImports: ['defineCatalogPage', frame] })], [picker], dir).length, 0, frame);
  }
  assert.equal(checkOverlaysFramed([page({ component: 'Picker' })], [picker], dir).length, 0, 'unknown imports never count as missing');
  rmSync(dir, { recursive: true, force: true });
});

test('overlay-without-device-frame ignores components that never import Modal (a local name "Modal" is not RN\'s)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-overlay-'));
  writeFileSync(path.join(dir, 'Sheet.tsx'), "import { View as Modal } from 'react-native';\nexport function Sheet() { return null; }\n");
  assert.equal(checkOverlaysFramed([page({ component: 'Sheet', viewerImports: [] })], [component({ name: 'Sheet', file: 'Sheet.tsx' })], dir).length, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('withExtraIssues adds findings, recounts the summary and exit code, and applies strict', () => {
  const base = { version: 1 as const, summary: { errors: 0, warnings: 1, components: 3, withExamples: 3, unboundExamples: 0 }, update: null, issues: [{ id: 'a', severity: 'warning' as const, message: 'm', fix: 'f' }], exitCode: 0 };
  const warn = { id: 'render-layout', severity: 'warning' as const, message: 'w', fix: 'f' };
  const plain = withExtraIssues(base, [warn], false);
  assert.deepEqual([plain.summary.errors, plain.summary.warnings, plain.exitCode, plain.summary.components], [0, 2, 0, 3]);
  const strict = withExtraIssues(base, [warn], true);
  assert.deepEqual([strict.summary.errors, strict.summary.warnings, strict.exitCode], [1, 1, 1]);
});

test('runDoctor maps each page id to its project-relative file', () => {
  const dir = makeProject(FULLY_COVERED_PAGE);
  assert.equal(runDoctor(configFor(dir)).pageFiles.get('Widget'), path.join('components', 'Widget', 'Widget.catalog.tsx'));
  rmSync(dir, { recursive: true, force: true });
});

test('overlay-without-device-frame ignores type-only Modal imports', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-overlay-'));
  writeFileSync(path.join(dir, 'A.tsx'), "import type { Modal } from 'react-native';\nexport function A() { return null; }\n");
  writeFileSync(path.join(dir, 'B.tsx'), "import { type Modal, View } from 'react-native';\nexport function B() { return null; }\n");
  const pages = [page({ component: 'A', viewerImports: [] }), page({ component: 'B', viewerImports: [] })];
  assert.equal(checkOverlaysFramed(pages, [component({ name: 'A', file: 'A.tsx' }), component({ name: 'B', file: 'B.tsx' })], dir).length, 0);
  rmSync(dir, { recursive: true, force: true });
});

// Plan V3: a family page's own `members` get the same advisories a page-level `component` gets,
// per member — and a component documented only as a member counts as documented.

function familyPage(overrides: Partial<StaticPage> = {}): StaticPage {
  return page({
    id: 'Toast', group: 'Patterns',
    whole: 'Toast',
    sections: [{ label: 'Parts', kind: 'blocks', members: ['ToastBanner'] }],
    members: [
      { id: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: false },
      { id: 'ToastBanner', component: 'Banner', parent: 'Toast', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
    ...overrides,
  });
}

test('a component documented only as a member counts as documented — component-no-examples does not fire for it', () => {
  const issues = collectIssues([familyPage()], [component({ name: 'Banner' })]);
  assert.equal(issues.filter((i) => i.id === 'component-no-examples' && i.message.includes('"Banner"')).length, 0);
});

test('component-no-examples fires per component-bound member that itself has no examples, naming the member', () => {
  const noExamples = familyPage({
    members: [
      { id: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: false },
      { id: 'ToastBanner', component: 'Banner', parent: 'Toast', hasWhenToUse: true, hasA11y: true, hasExamples: false },
    ],
  });
  const issues = collectIssues([noExamples], [component({ name: 'Banner' })]);
  const member = issues.filter((i) => i.id === 'component-no-examples' && i.message.includes('"ToastBanner"'));
  assert.equal(member.length, 1);
});

test('missing-guidance-or-a11y fires per component-bound member missing whenToUse or a11y, naming the member', () => {
  const missing = familyPage({
    members: [
      { id: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: false },
      { id: 'ToastBanner', component: 'Banner', parent: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: true },
    ],
  });
  const issues = collectIssues([missing], [component({ name: 'Banner' })]);
  const forMember = issues.filter((i) => i.id === 'missing-guidance-or-a11y' && i.message.includes('"ToastBanner"'));
  assert.equal(forMember.length, 2);
});

// V2c item 13: with an empty component list, `componentsByName.has(member.component)` would skip
// `Toast` for the same reason regardless of the `if (!member.component) continue;` guard — passing
// a real component record named after the documentation-only member's own id (never set as its
// `component`) proves the exemption follows `member.component`, not `member.id`.
test('documentation-only members (no component) are exempt from every per-member advisory', () => {
  const issues = collectIssues([familyPage()], [component({ name: 'Toast' }), component({ name: 'Banner' })]);
  assert.equal(issues.filter((i) => i.message.includes('Member "Toast"')).length, 0);
});

// V2c item 6: doctor must use the same `members.length > 0` predicate the runtime uses
// (`pageApi.ts`'s `buildCatalogSections`) — an empty `members` array is not a family page, and its
// usual page-level checks must still run.
test('a page with members: [] is not treated as a family — page-level checks still run, and no family-invalid fires', () => {
  const emptyMembers = page({ component: 'Widget', members: [], whole: 'Widget', hasWhenToUse: false, hasA11y: false });
  const issues = collectIssues([emptyMembers], [component({ name: 'Widget' })]);
  assert.ok(issues.some((i) => i.id === 'missing-guidance-or-a11y'));
  assert.equal(issues.filter((i) => i.id === 'family-invalid').length, 0);
  assert.equal(issues.filter((i) => i.id === 'component-no-examples' && i.message.includes('Member')).length, 0);
});

// V2c item 9: a member whose `component` names an export that doesn't exist must be reported —
// never silently ignored (its props would also silently vanish from the disclosure at runtime).
test('component-export-removed fires for a member naming a component that no longer exists', () => {
  const broken = familyPage({
    members: [
      { id: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: false },
      { id: 'ToastBanner', component: 'NoSuchComponent', parent: 'Toast', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
  });
  const issues = collectIssues([broken], [component({ name: 'Banner' })]);
  assert.ok(issues.some((i) => i.id === 'component-export-removed' && i.severity === 'error' && i.message.includes('"ToastBanner"') && i.message.includes('"NoSuchComponent"')));
});

test('a family page is exempt from the page-level missing-guidance-or-a11y check, even after applyComponentDefaults assigns it a "component"', () => {
  // Simulates what `applyComponentDefaults` can do to a family page living in a component's own
  // folder: it gains a page-level `component` matching a real export, even though the page's own
  // guidance always lives on its members, never on the page itself.
  const withPageComponent = familyPage({
    component: 'Toast',
    members: [
      { id: 'Toast', component: 'Toast', hasWhenToUse: true, hasA11y: true, hasExamples: true },
      { id: 'ToastBanner', component: 'Banner', parent: 'Toast', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
  });
  const issues = collectIssues([withPageComponent], [component({ name: 'Toast' }), component({ name: 'Banner' })]);
  assert.equal(issues.filter((i) => i.id === 'missing-guidance-or-a11y').length, 0);
  assert.equal(issues.filter((i) => i.id === 'component-no-examples').length, 0);
});

test('family-invalid reuses validateFamily: reports the whole missing from its own members', () => {
  const broken = familyPage({ whole: 'NoSuchMember' });
  const issues = collectIssues([broken], [component({ name: 'Banner' })]);
  assert.ok(issues.some((i) => i.id === 'family-invalid' && i.severity === 'error' && i.message.includes('is not one of its members')));
});

test('family-invalid reports a member in more than one section', () => {
  const dup = familyPage({ sections: [{ label: 'Parts', kind: 'blocks', members: ['ToastBanner', 'ToastBanner'] }] });
  const issues = collectIssues([dup], [component({ name: 'Banner' })]);
  assert.ok(issues.some((i) => i.id === 'family-invalid' && i.message.includes('is in more than one section')));
});

// N3: the doctor-side `family-invalid` rule must name the real section — not an empty label, which
// its old flattened `sectionMemberIds` had no way to carry.
test('family-invalid names the real section label for an unknown member id, not an empty string', () => {
  const broken = familyPage({ sections: [{ label: 'Parts', kind: 'blocks', members: ['Typo'] }] });
  const issues = collectIssues([broken], [component({ name: 'Banner' })]);
  const found = issues.find((i) => i.id === 'family-invalid' && i.message.includes('is not a member of this page'));
  assert.ok(found, 'expected a family-invalid issue for the unknown member id');
  assert.ok(found!.message.includes('section "Parts" lists "Typo"'), found!.message);
});

// N6: doctor's own `family-invalid` rule also catches a component-bound member with real specimens
// placed in a `list` section — `FoldedRow` would silently drop them at runtime.
test('family-invalid reports a list-section member that has specimens', () => {
  const withSpecimen = familyPage({ sections: [{ label: 'Helpers', kind: 'list', members: ['ToastBanner'] }] });
  const issues = collectIssues([withSpecimen], [component({ name: 'Banner' })]);
  assert.ok(issues.some((i) => i.id === 'family-invalid' && i.message.includes('"ToastBanner" has specimens, but list sections')));
});

// A member in a list section renders as a folded row without specimens, so doctor must not also
// ask it for examples (that would contradict the list-section rule above).
test('component-no-examples never fires for a component-bound member in a list section', () => {
  const listed = familyPage({
    sections: [{ label: 'Helpers', kind: 'list', members: ['ToastBanner'] }],
    members: [
      { id: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: false },
      { id: 'ToastBanner', component: 'Banner', hasWhenToUse: true, hasA11y: true, hasExamples: false },
    ],
  });
  const issues = collectIssues([listed], [component({ name: 'Banner' })]);
  assert.equal(issues.filter((i) => i.id === 'component-no-examples').length, 0);
  assert.equal(issues.filter((i) => i.id === 'family-invalid').length, 0);
});

test('family-invalid never runs against a not-checkable page — never a partial read', () => {
  const broken = familyPage({ checkable: false, whole: 'NoSuchMember' });
  const issues = collectIssues([broken], []);
  assert.equal(issues.filter((i) => i.id === 'family-invalid').length, 0);
});

test('a page with no members at all never triggers family-invalid', () => {
  const issues = collectIssues([page({ component: 'Widget' })], [component({ name: 'Widget', props: [] })]);
  assert.equal(issues.filter((i) => i.id === 'family-invalid').length, 0);
});

// V2d item 5: `doctor` resolves a member's own `composedOf` the same way `buildCatalogSections`
// resolves it at runtime (`validateComposedOf`) — against every known component name, every page
// id, and every member id across the whole catalog — so an unknown name is reported here too.
test('composed-of-unknown fires for a member\'s composedOf naming an unknown component, not a known one', () => {
  const withComposedOf = familyPage({
    members: [
      { id: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: false, composedOf: [{ component: 'ToastBanner' }, { component: 'NoSuchThing' }] },
      { id: 'ToastBanner', component: 'Banner', parent: 'Toast', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
  });
  const issues = collectIssues([withComposedOf], [component({ name: 'Banner' })]);
  const unknown = issues.filter((i) => i.id === 'composed-of-unknown');
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].severity, 'warning');
  assert.ok(unknown[0].message.includes('Member "Toast"') && unknown[0].message.includes('"NoSuchThing"'));
});

// N8: doctor's own known-name universe must accept a member alias and a page-level alias too —
// the same universe FamilyPage's own link resolution already accepts (aliasTargets).
test('composed-of-unknown never fires for a member\'s composedOf naming a sibling member\'s alias', () => {
  const withComposedOf = familyPage({
    members: [
      { id: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: false, composedOf: [{ component: 'ToastBannerAlias' }] },
      { id: 'ToastBanner', component: 'Banner', parent: 'Toast', aliases: ['ToastBannerAlias'], hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
  });
  const issues = collectIssues([withComposedOf], [component({ name: 'Banner' })]);
  assert.equal(issues.filter((i) => i.id === 'composed-of-unknown').length, 0);
});

test('composed-of-unknown never fires for a member\'s composedOf naming another page\'s own alias', () => {
  const withComposedOf = familyPage({
    aliases: ['OldToast'],
    members: [
      { id: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: false, composedOf: [{ component: 'OldToast' }] },
      { id: 'ToastBanner', component: 'Banner', parent: 'Toast', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
  });
  const issues = collectIssues([withComposedOf], [component({ name: 'Banner' })]);
  assert.equal(issues.filter((i) => i.id === 'composed-of-unknown').length, 0);
});

test('composed-of-unknown never fires for a member\'s composedOf naming a sibling member id', () => {
  const withComposedOf = familyPage({
    members: [
      { id: 'Toast', hasWhenToUse: false, hasA11y: false, hasExamples: false, composedOf: [{ component: 'ToastBanner' }] },
      { id: 'ToastBanner', component: 'Banner', parent: 'Toast', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
  });
  const issues = collectIssues([withComposedOf], [component({ name: 'Banner' })]);
  assert.equal(issues.filter((i) => i.id === 'composed-of-unknown').length, 0);
});

test('composed-of-unknown never runs against a not-checkable page, or a member with no composedOf', () => {
  const notCheckable = familyPage({ checkable: false });
  assert.equal(collectIssues([notCheckable], [component({ name: 'Banner' })]).filter((i) => i.id === 'composed-of-unknown').length, 0);
  assert.equal(collectIssues([familyPage()], [component({ name: 'Banner' })]).filter((i) => i.id === 'composed-of-unknown').length, 0);
});
