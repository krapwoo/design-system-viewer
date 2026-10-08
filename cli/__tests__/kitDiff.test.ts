// cli/__tests__/kitDiff.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { diffLines, listKitFileDiffs, runKitDiffCommand } from '../kitDiff.ts';
import type { ResolvedConfig } from '../types.ts';

function kitProject(): { dir: string; config: ResolvedConfig } {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-kitdiff-'));
  const userKit = path.join(dir, 'src', 'ds');
  const installedKit = path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer', 'starter-kit');
  mkdirSync(path.join(userKit, 'components', 'Button'), { recursive: true });
  mkdirSync(path.join(installedKit, 'components', 'Button'), { recursive: true });
  writeFileSync(path.join(userKit, 'components', 'Button', 'Button.catalog.tsx'), "export default 'user version';\n");
  writeFileSync(path.join(installedKit, 'components', 'Button', 'Button.catalog.tsx'), "export default 'installed version';\n");
  writeFileSync(path.join(userKit, 'components', 'Button', 'index.ts'), "export const same = true;\n");
  writeFileSync(path.join(installedKit, 'components', 'Button', 'index.ts'), "export const same = true;\n");
  mkdirSync(path.join(installedKit, 'components', 'Tabs'), { recursive: true });
  writeFileSync(path.join(installedKit, 'components', 'Tabs', 'index.ts'), "export const Tabs = () => null;\n");
  const config: ResolvedConfig = {
    name: 'X', components: ['src/ds/components/*/index.ts'], tokens: [],
    starterKit: { version: '0.3.0', root: 'src/ds' }, updateCheck: true, doctor: { strict: false },
    projectRoot: dir, configPath: path.join(dir, 'ds-viewer.config.ts'),
  };
  return { dir, config };
}

test('listKitFileDiffs: identical, modified, and kit-only (a new Tabs component not yet copied)', () => {
  const { dir, config } = kitProject();
  const diffs = listKitFileDiffs(config);
  assert.deepEqual(diffs.find((d) => d.relativePath === 'components/Button/Button.catalog.tsx')?.status, 'modified');
  assert.deepEqual(diffs.find((d) => d.relativePath === 'components/Button/index.ts')?.status, 'identical');
  assert.deepEqual(diffs.find((d) => d.relativePath === 'components/Tabs/index.ts')?.status, 'kit-only');
  rmSync(dir, { recursive: true, force: true });
});

test('listKitFileDiffs: a file the user added that the installed kit does not have is user-only', () => {
  const { dir, config } = kitProject();
  writeFileSync(path.join(dir, 'src', 'ds', 'components', 'Button', 'Notes.md'), 'local notes');
  const diffs = listKitFileDiffs(config);
  assert.equal(diffs.find((d) => d.relativePath === 'components/Button/Notes.md')?.status, 'user-only');
  rmSync(dir, { recursive: true, force: true });
});

test('listKitFileDiffs returns [] for a project with no starterKit configured', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-kitdiff-'));
  const config: ResolvedConfig = { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts') };
  assert.deepEqual(listKitFileDiffs(config), []);
  rmSync(dir, { recursive: true, force: true });
});

test('diffLines marks only the changed line, keeps the rest as context', () => {
  const lines = diffLines('a\nb\nc\n', 'a\nx\nc\n');
  assert.deepEqual(lines, ['  a', '- b', '+ x', '  c', '  ']);
});

test('runKitDiffCommand: no starterKit configured reports the reason and exits 1', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-kitdiff-'));
  const config: ResolvedConfig = { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts') };
  const { output, exitCode } = runKitDiffCommand(config, 'Button');
  assert.match(output, /no starter kit configured/);
  assert.equal(exitCode, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('runKitDiffCommand: an unknown component name exits 1', () => {
  const { dir, config } = kitProject();
  const { exitCode } = runKitDiffCommand(config, 'Nope');
  assert.equal(exitCode, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('runKitDiffCommand: identical files report "match exactly" and exit 0', () => {
  const { dir, config } = kitProject();
  writeFileSync(path.join(dir, 'src', 'ds', 'components', 'Button', 'Button.catalog.tsx'), "export default 'installed version';\n");
  const { output, exitCode } = runKitDiffCommand(config, 'Button');
  assert.match(output, /match the installed kit exactly/);
  assert.equal(exitCode, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('runKitDiffCommand: a modified file prints its diff and still exits 0 (informational, not an error)', () => {
  const { dir, config } = kitProject();
  const { output, exitCode } = runKitDiffCommand(config, 'Button');
  assert.match(output, /--- components\/Button\/Button\.catalog\.tsx/);
  assert.match(output, /- export default 'installed version';/);
  assert.match(output, /\+ export default 'user version';/);
  assert.equal(exitCode, 0);
  rmSync(dir, { recursive: true, force: true });
});
