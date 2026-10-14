import test from 'node:test';
import assert from 'node:assert/strict';
import { diffLayouts, formatLayoutDiff, type LayoutSnapshot } from '../layout.ts';
import { runLayoutDiffCommand } from '../main.ts';

const snapshot = (version: string, pages: LayoutSnapshot['pages']): LayoutSnapshot => ({ version, width: 952, pages });

const banner = (columns: number, half = columns) => ({
  page: 'Banner',
  blocks: [
    { title: 'Variants', kind: 'list' as const, size: 'wide', items: 5, minWidth: 404, full: { columns, rows: 5 / columns, fillers: 0 }, half: { columns: half, rows: 5, fillers: 0 } },
  ],
  sideEligible: false,
});

test('an unchanged snapshot reports no changes, and says so rather than printing nothing', () => {
  const before = snapshot('0.6.11', [banner(2)]);
  const after = snapshot('0.7.0', [banner(2)]);
  assert.deepEqual(diffLayouts(before, after), []);
  const text = formatLayoutDiff(before, after, []);
  assert.match(text, /0\.6\.11 → 0\.7\.0/);
  assert.match(text, /No page changes layout\./);
});

test('a column count that moved is reported with both numbers', () => {
  const changes = diffLayouts(snapshot('0.6.11', [banner(2)]), snapshot('0.7.0', [banner(1)]));
  const geometry = changes.filter((c) => c.kind === 'geometry');
  assert.ok(geometry.length > 0, 'a changed column count must be a geometry change');
  assert.match(geometry[0].detail, /"Variants" at full width: 2×/);
});

test('a page that can no longer share a row is reported as a placement change', () => {
  // The case this command exists for: a rule in the package moves, and a consumer's page is laid
  // out differently with nothing in their repository to explain it.
  const before = snapshot('0.6.11', [{ ...banner(2), sideEligible: true }]);
  const after = snapshot('0.7.0', [{ ...banner(2), sideEligible: false }]);
  const changes = diffLayouts(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, 'placement');
  assert.match(changes[0].detail, /can no longer share a row/);
  assert.match(formatLayoutDiff(before, after, changes), /Layout changes on 1 page: Banner\./);
});

test('added and removed pages are named, not silently dropped', () => {
  const changes = diffLayouts(snapshot('a', [banner(2)]), snapshot('b', [{ page: 'Toast', blocks: [], }]));
  assert.deepEqual(changes.map((c) => [c.page, c.kind]).sort(), [['Banner', 'removed'], ['Toast', 'added']]);
});

test('a page that stops being statically readable is a change, not a disappearance', () => {
  const before = snapshot('a', [banner(2)]);
  const after = snapshot('b', [{ page: 'Banner', blocks: [], notCheckable: true as const }]);
  const changes = diffLayouts(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, 'checkable');
  assert.match(changes[0].detail, /no longer statically readable/);
});

test('a block inserted at the front does not report its neighbours as changed', () => {
  // Comparing blocks by position made an inserted block diff every later block against its
  // neighbour: a page that gained an intro block reported four changes, including a brand-new
  // block "changing" from a geometry it never had. A tool whose output is meant to be believed
  // must not invent changes that did not happen.
  const blk = (title: string, columns: number) => ({
    title, kind: 'list' as const, size: 'regular', items: 2, minWidth: 242,
    full: { columns, rows: 1, fillers: 0 }, half: { columns, rows: 1, fillers: 0 },
  });
  const before = snapshot('a', [{ page: 'X', blocks: [blk('Variants', 2), blk('States', 3)] }]);
  const after = snapshot('b', [{ page: 'X', blocks: [blk('Intro', 1), blk('Variants', 2), blk('States', 3)] }]);
  const changes = diffLayouts(before, after);
  assert.deepEqual(changes.map((c) => c.detail), ['"Intro" is new']);

  // ...and removing one names the block that went, not the ones that shifted up.
  const removed = diffLayouts(after, before);
  assert.deepEqual(removed.map((c) => c.detail), ['"Intro" is gone']);
});

test('a renamed block reads as one gone and one new, never as a geometry change', () => {
  const blk = (title: string) => ({
    title, kind: 'list' as const, size: 'regular', items: 2, minWidth: 242,
    full: { columns: 2, rows: 1, fillers: 0 }, half: { columns: 1, rows: 2, fillers: 0 },
  });
  const changes = diffLayouts(
    snapshot('a', [{ page: 'X', blocks: [blk('States')] }]),
    snapshot('b', [{ page: 'X', blocks: [blk('Configurations')] }]),
  );
  assert.deepEqual(changes.map((c) => c.detail).sort(), ['"Configurations" is new', '"States" is gone']);
});

test('snapshots taken at different widths refuse to be compared', () => {
  // Geometry at 952px and at 1112px legitimately differs, so diffing them would report rule
  // changes that never happened — the most expensive kind of false alarm for this command.
  const before = { ...snapshot('a', [banner(2)]), width: 952 };
  const after = { ...snapshot('b', [banner(1)]), width: 1112 };
  const text = formatLayoutDiff(before, after, diffLayouts(before, after));
  assert.match(text, /different widths \(952px and 1112px\), so their geometry is not comparable/);
});

test('layout-diff refuses mismatched widths on the --json path too, not just when printing prose', () => {
  // The guard lived only in formatLayoutDiff, so --json — the path most likely to be automated —
  // returned a confident list of changes computed across incomparable widths.
  const narrow = JSON.stringify({ ...snapshot('a', [banner(2)]), width: 952 });
  const wide = JSON.stringify({ ...snapshot('b', [banner(1)]), width: 1112 });
  const read = (file: string) => (file === 'narrow.json' ? narrow : wide);
  for (const args of [['narrow.json', 'wide.json'], ['narrow.json', 'wide.json', '--json']]) {
    const result = runLayoutDiffCommand(args, { readFile: read });
    assert.equal(result.exitCode, 1, `${args.join(' ')} must refuse`);
    assert.match(result.output, /different widths \(952px and 1112px\)/);
  }
});

test('layout-diff refuses a file that is not a snapshot instead of reporting every page removed', () => {
  const files: Record<string, string> = {
    'good.json': JSON.stringify(snapshot('a', [banner(2)])),
    'notjson.json': 'this is not json',
    'other.json': JSON.stringify({ hello: 'world' }),
  };
  const read = (file: string) => {
    if (!(file in files)) throw new Error('ENOENT');
    return files[file];
  };

  const missing = runLayoutDiffCommand(['nope.json', 'good.json'], { readFile: read });
  assert.equal(missing.exitCode, 1);
  assert.match(missing.output, /Could not read nope\.json/);

  const broken = runLayoutDiffCommand(['notjson.json', 'good.json'], { readFile: read });
  assert.equal(broken.exitCode, 1);
  assert.match(broken.output, /not valid JSON/);

  // The important one: a well-formed JSON file that is not a snapshot must not diff as
  // "every page removed", which reads like a catastrophe rather than the wrong file.
  const wrong = runLayoutDiffCommand(['other.json', 'good.json'], { readFile: read });
  assert.equal(wrong.exitCode, 1);
  assert.match(wrong.output, /is not a layout snapshot/);

  assert.equal(runLayoutDiffCommand(['good.json'], { readFile: read }).exitCode, 1);
  assert.match(runLayoutDiffCommand([], { readFile: read }).output, /Usage: ds-viewer layout-diff/);

  const ok = runLayoutDiffCommand(['good.json', 'good.json'], { readFile: read });
  assert.equal(ok.exitCode, 0);
  assert.match(ok.output, /No page changes layout\./);
  assert.equal(JSON.parse(runLayoutDiffCommand(['good.json', 'good.json', '--json'], { readFile: read }).output).length, 0);
});
