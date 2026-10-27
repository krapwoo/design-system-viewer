import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectIssues, type DoctorIssue } from '../doctor.ts';
import type { StaticMember, StaticPage } from '../staticPage.ts';
import type { ComponentRecord } from '../types.ts';
import type { UsageData } from '../../native/catalog/usage.ts';

// U4/U5: `usage-unknown-page` (cli/doctor.ts).

const SPECIMEN = [{ key: 'a', name: 'A' }];

function page(overrides: Partial<StaticPage>): StaticPage {
  return { file: '/x/Widget.catalog.tsx', checkable: true, variantsItems: SPECIMEN, ...overrides };
}

function member(id: string, component?: string): StaticMember {
  return { id, component, hasWhenToUse: true, hasA11y: true, hasExamples: true };
}

function usageWith(...keys: string[]): UsageData {
  return { version: 1, components: Object.fromEntries(keys.map((key) => [key, { uses: [] }])) };
}

function unknownKeys(pages: StaticPage[], usage: UsageData | undefined, components: ComponentRecord[] = []): DoctorIssue[] {
  return collectIssues(pages, components, { usage }).filter((i) => i.id === 'usage-unknown-page');
}

test('a key naming a page id is known', () => {
  assert.deepEqual(unknownKeys([page({ id: 'Widget' })], usageWith('Widget')), []);
});

test('a key naming a page component is known, even when the page has a different id', () => {
  assert.deepEqual(unknownKeys([page({ id: 'WidgetPage', component: 'Widget' })], usageWith('Widget')), []);
});

test('a page with no id or component is known by its file stem', () => {
  assert.deepEqual(unknownKeys([page({ file: '/x/Chip.catalog.tsx' })], usageWith('Chip')), []);
});

test('a key naming a family member id is known', () => {
  const family = page({ id: 'Card', members: [member('CardHeader')] });
  assert.deepEqual(unknownKeys([family], usageWith('CardHeader')), []);
});

test('a key naming a family member component is known', () => {
  const family = page({ id: 'Card', members: [member('CardHeader', 'CardHeaderView')] });
  assert.deepEqual(unknownKeys([family], usageWith('CardHeaderView')), []);
});

test('a key naming a detected component without its own page is known', () => {
  const components: ComponentRecord[] = [{ name: 'Spacer', file: 'Spacer.tsx', props: [], inheritedFrom: [] }];
  assert.deepEqual(unknownKeys([], usageWith('Spacer'), components), []);
});

test('an unknown key is reported once, as a warning not tied to a page, and names the key', () => {
  const found = unknownKeys([page({ id: 'Widget' })], usageWith('Widget', 'OldWidget'));
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'warning');
  assert.equal(found[0].page, undefined);
  assert.equal(found[0].message, 'Usage key "OldWidget" matches no page id, component, or family member id, so its usage is not shown.');
  assert.match(found[0].fix, /Rename the key/);
});

test('every unknown key is reported, in the usage file\'s order', () => {
  const found = unknownKeys([], usageWith('B', 'A'));
  assert.deepEqual(found.map((i) => i.message.match(/"(.+?)"/)?.[1]), ['B', 'A']);
});

test('no usage data means no usage check', () => {
  assert.deepEqual(unknownKeys([page({ id: 'Widget' })], undefined), []);
});
