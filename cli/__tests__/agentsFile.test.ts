import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureAgentsFileSection } from '../agentsFile.ts';

const EXPECTED_BODY = [
  "1. When you add or change a component's props or a token, update its `*.catalog.tsx` in the same change.",
  "2. Bind examples to props (`prop` on grid axes, `props` on list items) so drift is detected.",
  '3. Never invent grid cells or groups; author only combinations that exist.',
  '4. Run `npx ds-viewer doctor` before finishing and fix every error. Use `npx ds-viewer explain <Page>` to check layout; see the README\'s page-authoring guide.',
].join('\n');

function makeDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'ds-viewer-agents-'));
}

test('writes AGENTS.md with the exact markers and text when the file is absent', () => {
  const dir = makeDir();
  const written = ensureAgentsFileSection(dir);
  assert.deepEqual(written, [path.join(dir, 'AGENTS.md')]);
  const content = readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.equal(content, `<!-- ds-viewer:start v1 -->\n${EXPECTED_BODY}\n<!-- ds-viewer:end -->\n`);
  rmSync(dir, { recursive: true, force: true });
});

test('appends to an existing AGENTS.md with exactly one blank line before the section', () => {
  const dir = makeDir();
  writeFileSync(path.join(dir, 'AGENTS.md'), '# Project notes\n\nSome existing guidance.\n');
  ensureAgentsFileSection(dir);
  const content = readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.equal(content, `# Project notes\n\nSome existing guidance.\n\n<!-- ds-viewer:start v1 -->\n${EXPECTED_BODY}\n<!-- ds-viewer:end -->\n`);
  rmSync(dir, { recursive: true, force: true });
});

test('a file with no trailing newline still gets exactly one blank line before the section', () => {
  const dir = makeDir();
  writeFileSync(path.join(dir, 'AGENTS.md'), '# Project notes');
  ensureAgentsFileSection(dir);
  const content = readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.equal(content, `# Project notes\n\n<!-- ds-viewer:start v1 -->\n${EXPECTED_BODY}\n<!-- ds-viewer:end -->\n`);
  rmSync(dir, { recursive: true, force: true });
});

test('is idempotent: a second call writes nothing and the file is unchanged', () => {
  const dir = makeDir();
  ensureAgentsFileSection(dir);
  const before = readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  const written = ensureAgentsFileSection(dir);
  assert.deepEqual(written, []);
  assert.equal(readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), before);
  rmSync(dir, { recursive: true, force: true });
});

test('a file with unrelated content and no start marker counts as missing the section, and its own content is untouched', () => {
  const dir = makeDir();
  writeFileSync(path.join(dir, 'AGENTS.md'), 'Unrelated instructions that happen to mention ds-viewer in passing.\n');
  const written = ensureAgentsFileSection(dir);
  assert.equal(written.length, 1);
  const content = readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.ok(content.startsWith('Unrelated instructions that happen to mention ds-viewer in passing.\n'));
  assert.ok(content.includes('<!-- ds-viewer:start v1 -->'));
  rmSync(dir, { recursive: true, force: true });
});

test('a file that already has the start marker is left completely untouched', () => {
  const dir = makeDir();
  const already = `<!-- ds-viewer:start v1 -->\nsomething a future version wrote differently\n<!-- ds-viewer:end -->\n`;
  writeFileSync(path.join(dir, 'AGENTS.md'), already);
  const written = ensureAgentsFileSection(dir);
  assert.deepEqual(written, []);
  assert.equal(readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), already);
  rmSync(dir, { recursive: true, force: true });
});
