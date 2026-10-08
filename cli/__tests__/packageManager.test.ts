// cli/__tests__/packageManager.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectPackageManager, installUpgradeCommand } from '../packageManager.ts';

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
