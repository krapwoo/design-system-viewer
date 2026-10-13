import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changelogEntry, toBullet } from '../../scripts/changelogEntry.mjs';
import { changelogSection } from '../../scripts/changelogSection.mjs';
import { extractSummaryBullets } from '../updateCheck.ts';

const ONE_PARAGRAPH = 'Cells turn gray when the example is white.';
const THREE_PARAGRAPHS = [
  'Every page documents when to reach for it.',
  'The three comparison layouts now state the rule that decides between them.',
  'Where a component has no special handling, the note says so.',
].join('\n\n');

test('a one-paragraph note is a plain bullet', () => {
  assert.equal(toBullet(ONE_PARAGRAPH), `- ${ONE_PARAGRAPH}`);
});

test("a multi-paragraph note keeps its later paragraphs inside its own bullet", () => {
  // Left at column 0 these render as separate top-level prose, detached from the note they belong
  // to — three consecutive releases had to be corrected by hand before this was fixed.
  const bullet = toBullet(THREE_PARAGRAPHS);
  const lines = bullet.split('\n');
  assert.equal(lines[0], '- Every page documents when to reach for it.');
  for (const line of lines.slice(1)) {
    assert.ok(line === '' || line.startsWith('  '), `continuation line not indented: ${JSON.stringify(line)}`);
  }
  // A blank line between paragraphs stays blank rather than becoming two stray spaces.
  assert.ok(bullet.includes('\n\n  The three comparison layouts'));
});

test('an entry is one bullet per note, in the order given', () => {
  const entry = changelogEntry('1.2.3', [ONE_PARAGRAPH, THREE_PARAGRAPHS]);
  assert.ok(entry.startsWith('## 1.2.3\n\n'));
  assert.equal(entry.split('\n').filter((l) => l.startsWith('- ')).length, 2);
  assert.ok(entry.indexOf(`- ${ONE_PARAGRAPH}`) < entry.indexOf('- Every page documents'));
});

test("the update page reads one bullet per note, never a note's own paragraphs as extra bullets", () => {
  // extractSummaryBullets trims each line before matching, so an indented paragraph must not begin
  // with a list marker — this is what keeps "What's new" to one line per shipped change.
  const entry = changelogEntry('1.2.3', [ONE_PARAGRAPH, THREE_PARAGRAPHS]);
  const body = changelogSection(`# Changelog\n\nIntro.\n\n${entry}\n\n## 1.2.2\n\n- Older.`, '1.2.3');
  assert.deepEqual(extractSummaryBullets(body ?? ''), [
    ONE_PARAGRAPH,
    'Every page documents when to reach for it.',
  ]);
});
