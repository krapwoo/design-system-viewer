import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sync } from '../sync.ts';
import type { ResolvedConfig } from '../types.ts';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const TYPE_ROOT = path.resolve(import.meta.dirname, '../../kit-host/node_modules');
const RESOLVE_OPTIONS = {
  paths: {
    react: [path.join(TYPE_ROOT, '@types/react')],
    'react/*': [path.join(TYPE_ROOT, '@types/react/*')],
    'react-native': [path.join(TYPE_ROOT, 'react-native')],
    'react-native/*': [path.join(TYPE_ROOT, 'react-native/*')],
  },
};

function copyFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-sync-'));
  cpSync(FIXTURE_ROOT, dir, { recursive: true });
  return dir;
}

test('sync writes components.json, tokens.json, generated/index.ts, and pages.ts', () => {
  const projectRoot = copyFixture();
  const config: ResolvedConfig = {
    name: 'Fixture App',
    components: ['src/components/*/index.ts'],
    tokens: ['src/tokens/index.ts'],
    pages: ['src/pages/*.catalog.tsx'],
    groupOrder: ['Components', 'Tokens'],
    updateCheck: true,
    doctor: { strict: false },
    projectRoot,
    configPath: path.join(projectRoot, 'ds-viewer.config.ts'),
  };

  const result = sync(config, RESOLVE_OPTIONS);

  assert.equal(result.componentCount, 2);
  assert.equal(result.pageCount, 2);
  assert.equal(result.generatedDir, path.join(projectRoot, '.ds-viewer', 'generated'));

  const components = JSON.parse(readFileSync(path.join(result.generatedDir, 'components.json'), 'utf8'));
  assert.deepEqual(components.map((c: { name: string }) => c.name), ['Badge', 'Button']);

  const tokens = JSON.parse(readFileSync(path.join(result.generatedDir, 'tokens.json'), 'utf8'));
  assert.equal(tokens[0].exports.DS_COLOR.text, '#181818');

  const generatedIndex = readFileSync(path.join(result.generatedDir, 'index.ts'), 'utf8');
  assert.match(generatedIndex, /export \{ default as components \} from '\.\/components\.json';/);
  assert.match(generatedIndex, /export \{ default as tokens \} from '\.\/tokens\.json';/);

  const pagesIndex = readFileSync(path.join(result.generatedDir, 'pages.ts'), 'utf8');
  assert.match(pagesIndex, /export default \[resolved0, resolved1\];/);

  rmSync(projectRoot, { recursive: true, force: true });
});

test('sync excludes globs listed in config.exclude', () => {
  const projectRoot = copyFixture();
  const config: ResolvedConfig = {
    name: 'Fixture App',
    components: ['src/components/*/index.ts'],
    exclude: ['src/components/Badge/index.ts'],
    tokens: ['src/tokens/index.ts'],
    pages: [],
    updateCheck: true,
    doctor: { strict: false },
    projectRoot,
    configPath: path.join(projectRoot, 'ds-viewer.config.ts'),
  };
  const result = sync(config, RESOLVE_OPTIONS);
  assert.equal(result.componentCount, 1);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('sync reports an unreadable component file and still syncs the rest', () => {
  const projectRoot = copyFixture();
  const brokenFile = path.join(projectRoot, 'src/components/Button/Button.tsx');
  chmodSync(brokenFile, 0o000);
  const config: ResolvedConfig = {
    name: 'Fixture App',
    components: ['src/components/*/index.ts'],
    tokens: ['src/tokens/index.ts'],
    pages: [],
    updateCheck: true,
    doctor: { strict: false },
    projectRoot,
    configPath: path.join(projectRoot, 'ds-viewer.config.ts'),
  };
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    // readComponents throws "Cannot read …" for a file that exists but cannot be read (Task 6
    // compiler-host wrapper); sync catches it per entry. Not meaningful when run as root, where
    // chmod 0o000 is unenforced — CI and local runs are non-root.
    const result = sync(config, RESOLVE_OPTIONS);
    assert.equal(result.componentCount, 1);
    const components = JSON.parse(readFileSync(path.join(result.generatedDir, 'components.json'), 'utf8'));
    assert.deepEqual(components.map((c: { name: string }) => c.name), ['Badge']);
    assert.ok(warnings.some((message) => message.includes('Cannot read') && message.includes('Button')));
  } finally {
    console.warn = originalWarn;
    chmodSync(brokenFile, 0o644);
  }
  rmSync(projectRoot, { recursive: true, force: true });
});

test('sync reads the starter kit\'s 37 components in under 3 seconds (one shared program, not one per entry)', () => {
  const config: ResolvedConfig = {
    name: 'Starter Kit',
    components: ['starter-kit/components/*/index.ts'],
    tokens: ['starter-kit/tokens/index.ts'],
    pages: [],
    updateCheck: true,
    doctor: { strict: false },
    projectRoot: REPO_ROOT,
    configPath: path.join(REPO_ROOT, 'ds-viewer.config.ts'),
  };
  const start = Date.now();
  const result = sync(config, RESOLVE_OPTIONS);
  const elapsedMs = Date.now() - start;
  assert.equal(result.componentCount, 37);
  assert.ok(elapsedMs < 3000, `sync took ${elapsedMs}ms, expected under 3000ms`);
  rmSync(path.join(REPO_ROOT, '.ds-viewer'), { recursive: true, force: true });
});

test('sync resolves a component entry file outside config.projectRoot, falling back to the project\'s own node_modules — no `paths` injected', () => {
  const outer = mkdtempSync(path.join(tmpdir(), 'ds-viewer-sync-fallback-'));
  const projectRoot = path.join(outer, 'host');
  const siblingComponent = path.join(outer, 'components', 'Widget');
  mkdirSync(path.join(projectRoot, 'node_modules', 'widget-kit'), { recursive: true });
  writeFileSync(path.join(projectRoot, 'node_modules', 'widget-kit', 'package.json'), '{"name":"widget-kit","main":"index.js"}');
  writeFileSync(path.join(projectRoot, 'node_modules', 'widget-kit', 'index.js'), 'module.exports = {};\n');
  // A SEPARATE, types-only package for the same specifier — mirrors `react`'s own split between its
  // untyped runtime package and `@types/react`. Guards the fallback's *order*: once `paths` redirects
  // a specifier to an on-disk folder, TypeScript resolves it there and never tries a second entry
  // just because the first has no types — the wrong order would leave this component's return type
  // `any` and therefore undetectable, reproducing the same silent-zero bug this test guards against.
  mkdirSync(path.join(projectRoot, 'node_modules', '@types', 'widget-kit'), { recursive: true });
  writeFileSync(path.join(projectRoot, 'node_modules', '@types', 'widget-kit', 'index.d.ts'), 'export interface ReactNode { readonly node: true }\n');
  mkdirSync(siblingComponent, { recursive: true });
  // Imported under a local alias, not the bare name: TypeScript's error recovery for an unresolved
  // module preserves a type reference's own written text, which would make `WidgetNode` print as
  // `ReactNode` (matching COMPONENT_RETURN_HINT) even while genuinely unresolved, defeating the RED
  // this test depends on. Aliasing means the RED case prints the local alias (`WidgetNode`, no
  // match) while the GREEN case — once the module actually resolves — prints the real symbol's own
  // name (`ReactNode`, matches), which is what readComponentRecord's heuristic is built around.
  writeFileSync(
    path.join(siblingComponent, 'index.ts'),
    "import type { ReactNode as WidgetNode } from 'widget-kit';\nexport function Widget(): WidgetNode {\n  return null;\n}\n",
  );
  const config: ResolvedConfig = {
    name: 'Fallback Fixture',
    components: ['../components/Widget/index.ts'],
    tokens: [],
    pages: [],
    updateCheck: true,
    doctor: { strict: false },
    projectRoot,
    configPath: path.join(projectRoot, 'ds-viewer.config.ts'),
  };
  const result = sync(config); // no RESOLVE_OPTIONS — the fallback must come from config.projectRoot alone
  assert.equal(result.componentCount, 1);
  const components = JSON.parse(readFileSync(path.join(result.generatedDir, 'components.json'), 'utf8'));
  assert.deepEqual(components.map((c: { name: string }) => c.name), ['Widget']);
  rmSync(outer, { recursive: true, force: true });
});

test('sync summarizes a component\'s node_modules heritage as one clean name for an entry file outside config.projectRoot — no `paths` injected', () => {
  // Mirrors kit-host exactly: `config.projectRoot` is `kit-host/`, the component entry lives in
  // the sibling `starter-kit/`, and no `paths` are injected — real `sync` callers never pass
  // `resolveOptions`, only tests do (see this file's `RESOLVE_OPTIONS`), so this is the only case
  // that exercises the production `fallbackPaths` path end to end for a real `extends TextInputProps`.
  const kitHostRoot = path.join(REPO_ROOT, 'kit-host');
  const config: ResolvedConfig = {
    name: 'Starter Kit',
    components: ['../starter-kit/components/SearchField/index.ts'],
    tokens: [],
    pages: [],
    updateCheck: true,
    doctor: { strict: false },
    projectRoot: kitHostRoot,
    configPath: path.join(kitHostRoot, 'ds-viewer.config.ts'),
  };
  const result = sync(config); // no RESOLVE_OPTIONS
  const components = JSON.parse(readFileSync(path.join(result.generatedDir, 'components.json'), 'utf8'));
  const searchField = components.find((c: { name: string }) => c.name === 'SearchField');
  assert.deepEqual(searchField.inheritedFrom, ['TextInput']);
  assert.deepEqual(
    searchField.props.map((p: { name: string }) => p.name).sort(),
    ['containerStyle', 'disabled', 'iconName'],
  );
  rmSync(path.join(kitHostRoot, '.ds-viewer'), { recursive: true, force: true });
});
