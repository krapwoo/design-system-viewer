// A token page can document components (`documents: [{ component, title }]`): the pure half —
// validation, the section model, routing, titles and search. The mounted half is
// `documentsRender.test.tsx`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogSections, defineCatalogPage, validateDocuments } from '../pageApi.ts';
import { aliasTargets, resolveRoute } from '../catalogNavigation.ts';
import { memberTitleMap } from '../familyModel.ts';
import { buildReferenceIndex, resolveReference, searchReferenceIndex } from '../catalogReferences.ts';

const component = (name: string) => ({ name, file: `src/icons/${name}.tsx`, props: [], inheritedFrom: [] });
const COMPONENTS = [component('HeaderLogo'), component('FooterMark'), component('Banner')];
const NAMES = new Set(COMPONENTS.map((c) => c.name));

const iconography = () => defineCatalogPage({
  id: 'Iconography', title: 'Icons', group: 'Tokens', description: 'Small icons.',
  documents: [{ component: 'HeaderLogo', title: 'Header logo' }, { component: 'FooterMark', title: 'Footer mark' }],
  render: () => null,
});
const hero = () => defineCatalogPage({
  id: 'Hero', group: 'Components', description: 'A hero.',
  composedOf: [{ component: 'HeaderLogo', role: 'Brand', relationship: 'built-in' }],
  render: () => null,
});
const build = (pages: ReturnType<typeof defineCatalogPage>[]) => buildCatalogSections(pages.map((page) => ({ ...page, id: page.id!, file: `${page.id}.catalog.tsx` })), COMPONENTS);

test('validateDocuments accepts a token page that documents known components', () => {
  assert.deepEqual(validateDocuments([iconography()], NAMES), []);
});

test('validateDocuments reports an unknown component', () => {
  const issues = validateDocuments([defineCatalogPage({ id: 'Icons', group: 'Tokens', description: 'x', documents: [{ component: 'Nope', title: 'Nope' }] })], NAMES);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /"Nope" is not a component export/);
  assert.equal(issues[0].page, 'Icons');
});

test('validateDocuments reports a component documented by two pages', () => {
  const second = defineCatalogPage({ id: 'More', group: 'Tokens', description: 'x', documents: [{ component: 'HeaderLogo', title: 'Logo again' }] });
  const issues = validateDocuments([iconography(), second], NAMES);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].page, 'More');
  assert.match(issues[0].message, /already documented by page "Iconography"/);
});

test('validateDocuments reports a documented component that also has its own page', () => {
  const own = defineCatalogPage({ id: 'HeaderLogo', group: 'Components', description: 'x' });
  const viaComponent = defineCatalogPage({ id: 'LogoPage', component: 'FooterMark', group: 'Components', description: 'x' });
  const issues = validateDocuments([iconography(), own, viaComponent], NAMES);
  assert.deepEqual(issues.map((i) => i.message.match(/entry "(\w+)" also has its own page \("(\w+)"\)/)?.slice(1)), [['HeaderLogo', 'HeaderLogo'], ['FooterMark', 'LogoPage']]);
});

test('validateDocuments reports a blank title and a repeated entry', () => {
  const page = defineCatalogPage({ id: 'Icons', group: 'Tokens', description: 'x', documents: [{ component: 'HeaderLogo', title: '  ' }, { component: 'HeaderLogo', title: 'Again' }] });
  const messages = validateDocuments([page], NAMES).map((i) => i.message);
  assert.equal(messages.length, 2);
  assert.match(messages[0], /blank title/);
  assert.match(messages[1], /more than once/);
});

test('validateDocuments reports documents on a family page and an id collision', () => {
  const family = defineCatalogPage({
    id: 'Fam', group: 'Components', description: 'x', whole: 'Fam', sections: [],
    members: [{ id: 'FooterMark', source: 's', fidelity: 'replicated', relationship: 'Part', description: 'd' }],
    documents: [{ component: 'HeaderLogo', title: 'Header logo' }],
  } as never);
  const collider = defineCatalogPage({ id: 'Icons', group: 'Tokens', description: 'x', documents: [{ component: 'FooterMark', title: 'Mark' }] });
  const messages = validateDocuments([family, collider], NAMES).map((i) => i.message);
  assert.ok(messages.some((m) => /not used on a family or group page/.test(m)));
  assert.ok(messages.some((m) => /"FooterMark" collides with an id or alias on page "Fam"/.test(m)));
});

test('a documented component gets no stub page, and the section carries its documents', () => {
  const { sections, groups } = build([iconography(), hero()]);
  assert.deepEqual(sections.map((s) => s.id).sort(), ['Banner', 'Hero', 'Iconography']);
  assert.deepEqual(sections.find((s) => s.id === 'Iconography')?.documents, [{ component: 'HeaderLogo', title: 'Header logo', path: 'src/icons/HeaderLogo.tsx' }, { component: 'FooterMark', title: 'Footer mark', path: 'src/icons/FooterMark.tsx' }]);
  assert.equal(groups.find((g) => g.label === 'Tokens')?.ids.includes('HeaderLogo' as never), false);
});

test('the documenting page inherits the documented component\'s "Also used by"', () => {
  const { sections } = build([iconography(), hero()]);
  assert.deepEqual(sections.find((s) => s.id === 'Iconography')?.alsoUsedBy, [{ component: 'Hero', role: 'Brand' }]);
});

test('a documented component resolves to its page at that tile, like a member', () => {
  const { sections } = build([iconography(), hero()]);
  const aliases = aliasTargets(sections);
  assert.deepEqual(aliases.get('HeaderLogo'), { pageId: 'Iconography', memberId: 'HeaderLogo' });
  const order = sections.map((s) => s.id);
  assert.deepEqual(resolveRoute('#HeaderLogo', order, aliases), { kind: 'member', pageId: 'Iconography', memberId: 'HeaderLogo' });
  assert.deepEqual(resolveReference('FooterMark', order, aliases, buildReferenceIndex(sections)), { kind: 'address', pageId: 'Iconography', memberId: 'FooterMark' });
});

test('a documented component is named by its title', () => {
  const { sections } = build([iconography(), hero()]);
  const titles = memberTitleMap(sections);
  assert.equal(titles.get('HeaderLogo'), 'Header logo');
  assert.equal(titles.get('FooterMark'), 'Footer mark');
});

test('search finds a documented component by its name or its title', () => {
  const { sections } = build([iconography(), hero()]);
  const index = buildReferenceIndex(sections);
  for (const query of ['header logo', 'HeaderLogo']) {
    const hit = searchReferenceIndex(index, query).find((entry) => entry.memberId === 'HeaderLogo');
    assert.equal(hit?.pageId, 'Iconography', query);
    assert.equal(hit?.title, 'Header logo');
  }
});

// M-7: found by the component's own source file, as a family member is.
test('search by a documented component\'s source path finds it, and its entry carries that path', () => {
  const { sections } = build([iconography(), hero()]);
  const hit = searchReferenceIndex(buildReferenceIndex(sections), 'src/icons/HeaderLogo.tsx').find((entry) => entry.memberId === 'HeaderLogo');
  assert.equal(hit?.pageId, 'Iconography');
  assert.equal(hit?.path, 'src/icons/HeaderLogo.tsx');
});

// M-6: an untyped entry with no title must not throw (the dev console runs this inside the build).
test('validateDocuments reports a missing or non-string title instead of throwing', () => {
  const page = defineCatalogPage({ id: 'Icons', group: 'Tokens', description: 'x', documents: [{ component: 'HeaderLogo' }, { component: 'FooterMark', title: 7 }] as never });
  const messages = validateDocuments([page], NAMES).map((i) => i.message);
  assert.equal(messages.length, 2);
  assert.ok(messages.every((m) => /blank title/.test(m)));
});

test('validateDocuments reports a collision with a token-definition page alias and section alias', () => {
  const tokens = defineCatalogPage({
    id: 'Colors', group: 'Tokens', description: 'x', aliases: ['HeaderLogo'],
    tokenDefinition: { kind: 'color', sections: [{ id: 'base', title: 'Base', aliases: ['FooterMark'], entries: [] }] },
  } as never);
  const messages = validateDocuments([tokens, iconography()], NAMES).map((i) => i.message);
  assert.ok(messages.some((m) => /"HeaderLogo" collides with an id or alias on page "Colors"/.test(m)), messages.join('|'));
  assert.ok(messages.some((m) => /"FooterMark" collides with an id or alias on page "Colors"/.test(m)), messages.join('|'));
});
