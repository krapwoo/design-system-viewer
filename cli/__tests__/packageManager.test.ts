// cli/__tests__/packageManager.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectPackageManager, installUpgradeCommand, platformCommand } from '../packageManager.ts';

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-pm-'));
  for (const [name, contents] of Object.entries(files)) writeFileSync(path.join(dir, name), contents);
  return dir;
}

test('detectPackageManager: package-lock.json is npm', () => {
  const dir = project({ 'package-lock.json': '{}' });
  assert.equal(detectPackageManager(dir), 'npm');
  rmSync(dir, { recursive: true, force: true });
});

test('detectPackageManager: no lockfile at all is npm', () => {
  const dir = project({});
  assert.equal(detectPackageManager(dir), 'npm');
  rmSync(dir, { recursive: true, force: true });
});

test('detectPackageManager: pnpm-lock.yaml is pnpm', () => {
  const dir = project({ 'pnpm-lock.yaml': 'lockfileVersion: 9' });
  assert.equal(detectPackageManager(dir), 'pnpm');
  rmSync(dir, { recursive: true, force: true });
});

test('detectPackageManager: a v1 yarn.lock is yarn-classic', () => {
  const dir = project({ 'yarn.lock': '# yarn lockfile v1\n' });
  assert.equal(detectPackageManager(dir), 'yarn-classic');
  rmSync(dir, { recursive: true, force: true });
});

test('detectPackageManager: a Berry yarn.lock (no v1 header) is yarn-berry', () => {
  const dir = project({ 'yarn.lock': '__metadata:\n  version: 8\n' });
  assert.equal(detectPackageManager(dir), 'yarn-berry');
  rmSync(dir, { recursive: true, force: true });
});

test('installUpgradeCommand: one case per package manager', () => {
  assert.deepEqual(installUpgradeCommand('npm', '@krapwoo/ds-viewer', '0.5.0'), { command: 'npm', args: ['install', '--save-dev', '@krapwoo/ds-viewer@0.5.0'] });
  assert.deepEqual(installUpgradeCommand('pnpm', '@krapwoo/ds-viewer', '0.5.0'), { command: 'pnpm', args: ['add', '--save-dev', '@krapwoo/ds-viewer@0.5.0'] });
  assert.deepEqual(installUpgradeCommand('yarn-classic', '@krapwoo/ds-viewer', '0.5.0'), { command: 'yarn', args: ['add', '--dev', '@krapwoo/ds-viewer@0.5.0'] });
  assert.deepEqual(installUpgradeCommand('yarn-berry', '@krapwoo/ds-viewer', '0.5.0'), { command: 'yarn', args: ['add', '--dev', '@krapwoo/ds-viewer@0.5.0'] });
});

// Windows: npm, npx, pnpm and yarn are `.cmd` shims, which Node refuses to run without a shell
// (since the CVE-2024-27980 fix). Everywhere else, and for real executables, no shell.
test('platformCommand: package managers run through a shell on win32 only, with quoted arguments', () => {
  assert.deepEqual(platformCommand('npm', ['install', '--save-dev', '@krapwoo/ds-viewer@0.4.1'], 'darwin'), {
    command: 'npm', args: ['install', '--save-dev', '@krapwoo/ds-viewer@0.4.1'], shell: false,
  });
  assert.deepEqual(platformCommand('npm', ['pack', 'x@1.0.0', '--pack-destination', 'C:\\Users\\Jane Doe\\Temp\\ds'], 'win32'), {
    command: 'npm', args: ['pack', 'x@1.0.0', '--pack-destination', '"C:\\Users\\Jane Doe\\Temp\\ds"'], shell: true,
  });
  for (const pm of ['npx', 'pnpm', 'yarn']) assert.equal(platformCommand(pm, ['add'], 'win32').shell, true);
});

test('platformCommand: real executables (node, tar, git) never get a shell, even on win32', () => {
  for (const exe of ['node', 'tar', 'git']) {
    assert.deepEqual(platformCommand(exe, ['a b'], 'win32'), { command: exe, args: ['a b'], shell: false });
  }
});
