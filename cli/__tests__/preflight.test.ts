import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { preflight } from '../preflight.ts';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');

function makeProject(packageJson: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-preflight-'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify(packageJson));
  return dir;
}

test('preflight passes for the fixture project (every requirement satisfied)', () => {
  const result = preflight(FIXTURE_ROOT);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test('preflight reports a missing package.json and nothing else', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-preflight-'));
  const result = preflight(dir);
  assert.deepEqual(result.errors, [{ package: 'package.json', installCommand: 'Run this inside an Expo project (no package.json found).' }]);
  assert.deepEqual(result.warnings, []);
  rmSync(dir, { recursive: true, force: true });
});

test('preflight reports each missing required package with its install command', () => {
  const dir = makeProject({ name: 'bare', dependencies: { expo: '~57.0.4' } });
  const result = preflight(dir);
  assert.deepEqual(result.errors, [
    { package: 'react-native-web', installCommand: 'npx expo install react-native-web' },
    { package: 'react-dom', installCommand: 'npx expo install react-dom' },
  ]);
  assert.deepEqual(result.warnings, [
    { package: '@expo/metro-runtime', installCommand: 'npx expo install @expo/metro-runtime' },
    { package: 'typescript', installCommand: 'npm install --save-dev typescript' },
  ]);
  rmSync(dir, { recursive: true, force: true });
});

test('preflight flags an Expo SDK below 57', () => {
  const dir = makeProject({
    name: 'old',
    dependencies: { expo: '~56.0.0', 'react-native-web': '*', 'react-dom': '*', '@expo/metro-runtime': '*' },
    devDependencies: { typescript: '*' },
  });
  const result = preflight(dir);
  assert.deepEqual(result.errors, [{ package: 'expo', installCommand: 'Upgrade to Expo SDK 57 or later: npx expo install expo@^57' }]);
  rmSync(dir, { recursive: true, force: true });
});

test('preflight accepts a short Expo version string with no patch segment', () => {
  const dir = makeProject({
    name: 'short-version',
    dependencies: { expo: '^57', 'react-native-web': '*', 'react-dom': '*', '@expo/metro-runtime': '*' },
    devDependencies: { typescript: '*' },
  });
  const result = preflight(dir);
  assert.deepEqual(result.errors, []);
  rmSync(dir, { recursive: true, force: true });
});
