import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const packageJson = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf8'));

test('package.json exports its own package.json, so tools can require("@krapwoo/ds-viewer/package.json")', () => {
  assert.equal(packageJson.exports['./package.json'], './package.json');
});
