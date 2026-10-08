import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sync } from '../sync.ts';
import type { ResolvedConfig } from '../types.ts';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const TYPE_ROOT = path.resolve(import.meta.dirname, '../../native-preview/node_modules');
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
    components: ['native/components/*/index.ts'],
    tokens: ['tokens/index.ts'],
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
