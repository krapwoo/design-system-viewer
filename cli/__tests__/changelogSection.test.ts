import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changelogSection } from '../../scripts/changelogSection.mjs';
import { extractSummaryBullets } from '../updateCheck.ts';

const changelog = `# Changelog

All notable changes are documented here.

## 0.4.5

- Cells turn gray when the example is white.

## 0.4.4

- Catalog pages can cap columns.
- MotionSpecimen.

## 0.4.3

- Page titles.
`;

test("changelogSection returns exactly one version's bullets, without its heading or the next version", () => {
  assert.equal(changelogSection(changelog, '0.4.4'), '- Catalog pages can cap columns.\n- MotionSpecimen.');
  assert.equal(changelogSection(changelog, '0.4.5'), '- Cells turn gray when the example is white.');
  assert.equal(changelogSection(changelog, '0.4.3'), '- Page titles.');
});

test('changelogSection is undefined for a version with no entry, so the release step fails loudly', () => {
  assert.equal(changelogSection(changelog, '9.9.9'), undefined);
  assert.equal(changelogSection(changelog, '0.4'), undefined);
});

test("the viewer reads the section back as its What's new bullets", () => {
  assert.deepEqual(extractSummaryBullets(changelogSection(changelog, '0.4.4')!), ['Catalog pages can cap columns.', 'MotionSpecimen.']);
});
