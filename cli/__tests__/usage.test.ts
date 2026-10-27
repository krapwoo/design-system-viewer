import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadUsage, parseUsage, validateUsage } from '../usage.ts';

// U1–U3: usage file format v1 (README "Usage data").

const VALID = {
  version: 1,
  areas: ['Chat', 'Bots'],
  components: {
    ChatBubble: { area: 'Chat', uses: [{ area: 'Bots', file: 'BotRoomView.swift', line: 152 }, { area: 'Chat', file: 'ChatView.swift' }] },
  },
};

function problemOf(value: unknown): string {
  const result = validateUsage(value);
  assert.ok('problem' in result, 'expected a problem');
  return result.problem;
}

test('a valid usage file is accepted as written', () => {
  const result = parseUsage(JSON.stringify(VALID), 'usage.json');
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.usage, VALID);
});

test('areas and a use line are optional, and a component may have no uses', () => {
  const result = validateUsage({ version: 1, components: { Spacer: { uses: [] }, Chip: { uses: [{ area: 'A', file: 'a.swift' }] } } });
  assert.ok('usage' in result);
  assert.equal(result.usage.areas, undefined);
  assert.deepEqual(result.usage.components.Spacer, { uses: [] });
  assert.deepEqual(result.usage.components.Chip.uses, [{ area: 'A', file: 'a.swift' }]);
});

test('unknown fields are ignored and dropped at every level', () => {
  const result = validateUsage({
    version: 1, generator: 'scan 2', extra: true,
    components: { A: { area: 'X', owner: 'me', uses: [{ area: 'X', file: 'f.swift', line: 3, snippet: 'A()' }] } },
  });
  assert.ok('usage' in result);
  assert.deepEqual(result.usage, { version: 1, components: { A: { area: 'X', uses: [{ area: 'X', file: 'f.swift', line: 3 }] } } });
});

test('malformed JSON is a warning naming the file, and no data', () => {
  const result = parseUsage('{ "version": 1, ', 'build/usage.json');
  assert.equal(result.usage, undefined);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /^Usage file build\/usage\.json is not valid JSON \(.+\); ignoring it\.$/);
});

test('a wrong shape is a warning that names the problem, and the whole file is ignored', () => {
  const result = parseUsage(JSON.stringify({ version: 1, components: { A: { area: 'X', uses: 'many' } } }), 'usage.json');
  assert.equal(result.usage, undefined);
  assert.deepEqual(result.warnings, ['Usage file usage.json is not in the expected format: components["A"].uses must be an array; ignoring it.']);
});

test('each shape rule reports its own path', () => {
  assert.equal(problemOf([]), 'the top level must be an object');
  assert.equal(problemOf(null), 'the top level must be an object');
  assert.equal(problemOf({ components: {} }), '"version" must be 1 (found undefined)');
  assert.equal(problemOf({ version: 2, components: {} }), '"version" must be 1 (found 2)');
  assert.equal(problemOf({ version: 1, areas: 'Chat', components: {} }), '"areas" must be an array of strings');
  assert.equal(problemOf({ version: 1, areas: [1], components: {} }), '"areas" must be an array of strings');
  assert.equal(problemOf({ version: 1 }), '"components" must be an object');
  assert.equal(problemOf({ version: 1, components: [] }), '"components" must be an object');
  assert.equal(problemOf({ version: 1, components: { A: 3 } }), 'components["A"] must be an object');
  assert.equal(problemOf({ version: 1, components: { A: { area: 1, uses: [] } } }), 'components["A"].area must be a string');
  assert.equal(problemOf({ version: 1, components: { A: { uses: ['x'] } } }), 'components["A"].uses[0] must be an object');
  assert.equal(problemOf({ version: 1, components: { A: { uses: [{ file: 'f' }] } } }), 'components["A"].uses[0].area must be a string');
  assert.equal(problemOf({ version: 1, components: { A: { uses: [{ area: 'X', file: '' }] } } }), 'components["A"].uses[0].file must be a non-empty string');
  assert.equal(problemOf({ version: 1, components: { A: { uses: [{ area: 'X', file: 'f', line: 0 }] } } }), 'components["A"].uses[0].line must be a positive whole number');
  assert.equal(problemOf({ version: 1, components: { A: { uses: [{ area: 'X', file: 'f', line: '3' }] } } }), 'components["A"].uses[0].line must be a positive whole number');
});

test('loadUsage reads a file relative to the project root', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-usage-'));
  writeFileSync(path.join(dir, 'usage.json'), JSON.stringify(VALID));
  const result = loadUsage(dir, 'usage.json');
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.usage, VALID);
  rmSync(dir, { recursive: true, force: true });
});

test('a missing usage file is a warning, not a crash', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-usage-'));
  const result = loadUsage(dir, 'nope/usage.json');
  assert.equal(result.usage, undefined);
  assert.deepEqual(result.warnings, ['Usage file not found: nope/usage.json — showing no usage data.']);
  rmSync(dir, { recursive: true, force: true });
});

test('a usage path that is a directory is a warning, not a crash', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-usage-'));
  const result = loadUsage(path.dirname(dir), path.basename(dir));
  assert.equal(result.usage, undefined);
  assert.match(result.warnings[0], /^Could not read usage file /);
  rmSync(dir, { recursive: true, force: true });
});
