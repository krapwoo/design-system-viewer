import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { collectIssues, formatHuman, toDoctorJson, withExtraIssues, type DoctorIssue } from '../doctor.ts';
import { readStaticPages, type StaticMember, type StaticPage } from '../staticPage.ts';

// Slice G1: guards against mistakes a real catalog made — `style-as-part`, `anatomy-no-picture`,
// `anatomy-picture-not-specimen` (cli/doctor.ts), and the `grid-empty-cell` hint, which are advisory: printed and counted, never failing `--ci`, never promoted by `strict`.

function page(overrides: Partial<StaticPage>): StaticPage {
  return { file: '/x/Widget.catalog.tsx', checkable: true, ...overrides };
}
const member = (id: string, overrides: Partial<StaticMember> = {}): StaticMember => ({ id, hasWhenToUse: true, hasA11y: true, hasExamples: true, ...overrides });
const run = (pages: StaticPage[], id: string): DoctorIssue[] => collectIssues(pages, []).filter((i) => i.id === id);

// ---- style-as-part (rule 3) ----

const family = (members: StaticMember[], inWhole = true): StaticPage =>
  page({
    id: 'Button', whole: 'Button', hasMembers: true, hasWhole: true, hasSections: true,
    members: [member('Button'), ...members],
    sections: [{ label: 'Parts', kind: 'blocks', members: members.map((m) => m.id), inWhole }],
  });

test('style-as-part fires on a member whose relationship is Style or Modifier, in any case', () => {
  for (const relationship of ['Style', 'modifier', 'MODIFIER']) {
    const found = run([family([member('Label', { relationship })])], 'style-as-part');
    assert.equal(found.length, 1, relationship);
    assert.equal(found[0].severity, 'warning');
    assert.equal(found[0].message, 'Member "Label" is a style, not a part: give it its own page and name it in `relatedPages` on a family page.');
  }
});

test('style-as-part fires on an id or component ending in Style or Modifier', () => {
  assert.equal(run([family([member('PrimaryButtonStyle')])], 'style-as-part').length, 1);
  assert.equal(run([family([member('Pressed', { component: 'PressedModifier', fidelity: 'documentation-only' })])], 'style-as-part').length, 1);
});

test('style-as-part stays quiet for a real part, a lowercase "lifestyle", a non-inWhole section, and a plain Part relationship', () => {
  assert.equal(run([family([member('Label', { relationship: 'Part' })])], 'style-as-part').length, 0);
  assert.equal(run([family([member('Lifestyle')])], 'style-as-part').length, 0);
  assert.equal(run([family([member('ButtonStyle', { relationship: 'Style' })], false)], 'style-as-part').length, 0);
});

// F11: groups number a member with a `parent` as a part of that parent.
test('F11: style-as-part applies to a group member whose parent is on the page, by relationship or by name', () => {
  const group = (child: StaticMember) => page({ id: 'Group', hasMembers: true, members: [member('Top'), child] });
  assert.equal(run([group(member('Pressed', { parent: 'Top', relationship: 'Modifier' }))], 'style-as-part').length, 1);
  assert.equal(run([group(member('ButtonStyle', { parent: 'Top' }))], 'style-as-part').length, 1);
  assert.equal(run([group(member('ButtonStyle', { parent: 'Elsewhere' }))], 'style-as-part').length, 0, 'a parent that is not on this page numbers nothing');
  assert.equal(run([group(member('ButtonStyle'))], 'style-as-part').length, 0, 'a top-level member is not a part');
});

test('F11: a name ending in Style/Modifier only counts for a member with no component or a documentation-only one; a relationship always counts', () => {
  const inFamily = (m: StaticMember) => run([family([m])], 'style-as-part').length;
  assert.equal(inFamily(member('QuantityModifier', { component: 'QuantityModifier' })), 0, 'a real component is a part');
  assert.equal(inFamily(member('QuantityModifier', { component: 'QuantityModifier', fidelity: 'replicated' })), 0);
  assert.equal(inFamily(member('QuantityModifier', { component: 'QuantityModifier', fidelity: 'documentation-only' })), 1);
  assert.equal(inFamily(member('QuantityModifier')), 1, 'no component: the name decides');
  assert.equal(inFamily(member('Stepper', { component: 'Stepper', relationship: 'Modifier' })), 1, 'an authored relationship always counts');
});

// ---- F2: relatedPages on a page that cannot render it ----

test('F2: related-pages-unused warns on a page without members, and is quiet on a family page, an empty list, or no list', () => {
  const related = [{ page: 'Shadow' }];
  const found = run([page({ id: 'Card', relatedPages: related })], 'related-pages-unused');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'warning');
  assert.match(found[0].message, /"relatedPages" is not used on a page without members \(it renders no Related list\)/);
  assert.equal(run([{ ...family([]), relatedPages: related }], 'related-pages-unused').length, 0);
  assert.equal(run([page({ id: 'Card', relatedPages: [] })], 'related-pages-unused').length, 0);
  // `members: []` is a page without members for the viewer, as for relatedPagesUnusedMessage
  assert.equal(run([page({ id: 'Card', hasMembers: true, members: [], relatedPages: related })], 'related-pages-unused').length, 1);
  // a `members` the doctor can't read statically stays quiet
  assert.equal(run([page({ id: 'Card', hasMembers: true, relatedPages: related })], 'related-pages-unused').length, 0);
  assert.equal(run([page({ id: 'Card' })], 'related-pages-unused').length, 0);
});

test('F2: the style-as-part advice says the Related list is a family-page feature', () => {
  const [found] = run([family([member('Label', { relationship: 'Style' })])], 'style-as-part');
  assert.match(found.message, /name it in `relatedPages` on a family page/);
  assert.match(found.fix, /relatedPages on a family page/);
});

// ---- anatomy-no-picture (rule 4) ----

const shape = (overrides: Record<string, unknown> = {}) => ({ memberIds: ['Label'], otherCount: 0, hasPicture: false, ...overrides });

test('anatomy-no-picture fires when the anatomy lists a visible part and has no picture', () => {
  const p = family([member('Label', { fidelity: 'replicated' })]);
  const found = run([{ ...p, anatomyShape: shape() }], 'anatomy-no-picture');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'warning');
  assert.match(found[0].fix, /draw the whole with AnatomySpecimen and pin the parts/i);
});

/** A family page whose own anatomy has `overrides` for its shape, so the viewer draws it. */
const familyWith = (overrides: Record<string, unknown>, id = 'Card'): StaticPage => ({ ...family([]), id, whole: id, members: [member(id)], anatomyShape: shape(overrides) });

test('anatomy-no-picture counts an `other` item as visible, and checks a group member own anatomy', () => {
  assert.equal(run([familyWith({ memberIds: [], otherCount: 2 })], 'anatomy-no-picture').length, 1);
  const group = page({ id: 'Group', hasMembers: true, members: [member('Top', { anatomyShape: shape({ memberIds: ['Part'] }) }), member('Part', { fidelity: 'approximated' })] });
  assert.equal(run([group], 'anatomy-no-picture').length, 1);
});

test('F12: both anatomy rules look at the anatomies the viewer draws: standalone, family, top-level group member', () => {
  const none = shape({ memberIds: [], otherCount: 2 });
  const other = shape({ memberIds: [], hasPicture: true, pictureRoot: 'other', pictureTag: 'View' });
  for (const id of ['anatomy-no-picture', 'anatomy-picture-not-specimen']) {
    const s = id === 'anatomy-no-picture' ? none : other;
    // a standalone component page's anatomy is rendered (SectionBlock draws def.anatomy)
    assert.equal(run([page({ id: 'Plain', anatomyShape: s })], id).length, 1, `${id} on a component page`);
    // a family member's own anatomy is never rendered
    const fam = family([member('Part', { anatomyShape: s, fidelity: 'replicated' })]);
    assert.equal(run([fam], id).length, 0, `${id} on a family member`);
    // a group member nested under another is not top level (already an error elsewhere)
    const nested = page({ id: 'Group', hasMembers: true, members: [member('Top'), member('Child', { parent: 'Top', anatomyShape: s })] });
    assert.equal(run([nested], id).length, 0, `${id} on a nested group member`);
    // and the family page's own, and a top-level group member's, are
    assert.equal(run([{ ...family([]), anatomyShape: s }], id).length, 1, `${id} on a family page`);
    assert.equal(run([page({ id: 'Group', hasMembers: true, members: [member('Top', { anatomyShape: s })] })], id).length, 1, `${id} on a top-level group member`);
  }
});

// ---- F4: `picture: null` is a deliberate opt-out ----

test('F4: anatomy-no-picture stays quiet for an explicit `picture: null`, and still fires when the picture is omitted', () => {
  assert.equal(run([familyWith({ memberIds: [], otherCount: 1, pictureOptOut: true })], 'anatomy-no-picture').length, 0);
  const fires = run([familyWith({ memberIds: [], otherCount: 1 })], 'anatomy-no-picture');
  assert.equal(fires.length, 1);
  assert.match(fires[0].fix, /picture: null/);
});

test('anatomy-no-picture stays quiet with a picture, with only documentation-only parts, and for a part it cannot resolve', () => {
  const visible = family([member('Label', { fidelity: 'replicated' })]);
  assert.equal(run([{ ...visible, anatomyShape: shape({ hasPicture: true, pictureRoot: 'specimen' }) }], 'anatomy-no-picture').length, 0);
  const noArea = family([member('Label', { fidelity: 'documentation-only' })]);
  assert.equal(run([{ ...noArea, anatomyShape: shape() }], 'anatomy-no-picture').length, 0);
  assert.equal(run([{ ...visible, anatomyShape: shape({ memberIds: ['Elsewhere'] }) }], 'anatomy-no-picture').length, 0);
});

// ---- anatomy-picture-not-specimen (rule 5a) ----

test('anatomy-picture-not-specimen fires on a readable root that is not AnatomySpecimen', () => {
  const found = run([familyWith({ hasPicture: true, pictureRoot: 'other', pictureTag: 'View' })], 'anatomy-picture-not-specimen');
  assert.equal(found.length, 1);
  assert.equal(found[0].message, "The anatomy picture's root is <View>, not AnatomySpecimen.");
  assert.equal(found[0].severity, 'warning');
  assert.match(found[0].fix, /wrap the picture in AnatomySpecimen so it is drawn at the page's phone width, centred like the variant cells, with pins beside it/i);
});

test('anatomy-picture-not-specimen stays quiet for a specimen root and for a root it cannot read', () => {
  for (const pictureRoot of ['specimen', 'unknown'] as const) {
    assert.equal(run([familyWith({ hasPicture: true, pictureRoot })], 'anatomy-picture-not-specimen').length, 0, pictureRoot);
  }
});

// The static read itself: which roots count as AnatomySpecimen.
function readPicture(source: string) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-anatomy-'));
  try {
    const file = path.join(dir, 'Card.catalog.tsx');
    writeFileSync(file, source);
    return readStaticPages([file])[0].anatomyShape;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const pageSource = (picture: string, extra = '') => `import React from 'react';
import { View } from 'react-native';
import { defineCatalogPage, AnatomySpecimen } from '@krapwoo/ds-viewer';
${extra}
export default defineCatalogPage({ id: 'Card', anatomy: { picture: ${picture}, groups: [{ label: 'In this picture', items: [{ other: 'Chip', description: 'd' }] }] } });
`;

test('the static read tells AnatomySpecimen, a plain View, a same-file wrapper and an unreadable root apart', () => {
  assert.equal(readPicture(pageSource('<AnatomySpecimen><View /></AnatomySpecimen>'))?.pictureRoot, 'specimen');
  assert.equal(readPicture(pageSource('(<View><Text>x</Text></View>)', "import { Text } from 'react-native';"))?.pictureRoot, 'other');
  assert.equal(readPicture(pageSource('<View><Chip /></View>', "import { Chip } from './Chip';"))?.pictureRoot, 'unknown', 'a wrapper around a component it cannot read is not guessed at');
  assert.equal(readPicture(pageSource('<Picture />', 'function Picture() { return <AnatomySpecimen><View /></AnatomySpecimen>; }'))?.pictureRoot, 'specimen');
  assert.equal(readPicture(pageSource('<Picture />', 'const Picture = () => <View />;'))?.pictureRoot, 'other');
  assert.equal(readPicture(pageSource('<Picture />', "import { Picture } from './Picture';"))?.pictureRoot, 'unknown');
  assert.equal(readPicture(pageSource('makePicture()'))?.pictureRoot, 'unknown');
});

// Hermex's exact shape: a plain stretch wrapper around the specimen is still the specimen.
const HERMEX_PICTURE = "<View style={{ alignSelf: 'stretch' }}><AnatomySpecimen pins={<View />}><View /></AnatomySpecimen></View>";

test('a plain wrapper whose only child is AnatomySpecimen reads as a specimen root, through fragments and nested wrappers', () => {
  assert.equal(readPicture(pageSource(HERMEX_PICTURE))?.pictureRoot, 'specimen');
  assert.equal(readPicture(pageSource('<View><View><><AnatomySpecimen /></></View></View>'))?.pictureRoot, 'specimen');
  assert.equal(readPicture(pageSource('<View><Picture /></View>', 'const Picture = () => <AnatomySpecimen />;'))?.pictureRoot, 'specimen');
});

test('a wrapper with anything besides the specimen stays "other"', () => {
  assert.equal(readPicture(pageSource('<View><AnatomySpecimen /><View /></View>'))?.pictureRoot, 'other');
  assert.equal(readPicture(pageSource('<View><View /></View>'))?.pictureRoot, 'other');
  assert.equal(readPicture(pageSource('<View>{pins}<AnatomySpecimen /></View>'))?.pictureRoot, 'other');
  assert.equal(readPicture(pageSource('<View />'))?.pictureRoot, 'other');
});

test('anatomy-picture-not-specimen stays quiet on the Hermex shape and still fires on a bare View', () => {
  const quiet = readPicture(pageSource(HERMEX_PICTURE));
  assert.equal(run([{ ...familyWith({}), anatomyShape: quiet }], 'anatomy-picture-not-specimen').length, 0);
  const fires = readPicture(pageSource('<View style={{ alignSelf: "stretch" }}><View /></View>'));
  assert.equal(run([{ ...familyWith({}), anatomyShape: fires }], 'anatomy-picture-not-specimen').length, 1);
});

test('the static read sees a missing picture, and `picture: undefined` is the same as none', () => {
  const none = readPicture(`import { defineCatalogPage } from '@krapwoo/ds-viewer';
export default defineCatalogPage({ id: 'Card', anatomy: { groups: [{ label: 'g', items: [{ other: 'Chip', description: 'd' }] }] } });
`);
  assert.equal(none?.hasPicture, false);
  assert.equal(none?.otherCount, 1);
  assert.equal(readPicture(pageSource('undefined'))?.hasPicture, false);
  assert.equal(readPicture(pageSource('undefined'))?.pictureOptOut, undefined);
});

test('F4: the static read tells `picture: null` (a deliberate opt-out) from an omitted picture', () => {
  const optOut = readPicture(pageSource('null'));
  assert.equal(optOut?.hasPicture, false);
  assert.equal(optOut?.pictureOptOut, true);
});

// ---- F1: shorthand `picture` and spreads in `anatomy` ----

const groupsSource = "groups: [{ label: 'In this picture', items: [{ other: 'Chip', description: 'd' }] }]";
const anatomySource = (anatomy: string, extra = '') => `import React from 'react';
import { View } from 'react-native';
import { defineCatalogPage, AnatomySpecimen } from '@krapwoo/ds-viewer';
${extra}
export default defineCatalogPage({ id: 'Card', anatomy: ${anatomy} });
`;

test('F1: a shorthand `picture` is a picture (and is read through its same-file const)', () => {
  const unresolvable = readPicture(anatomySource(`{ picture, ${groupsSource} }`, "import { picture } from './picture';"));
  assert.equal(unresolvable?.hasPicture, true, 'a shorthand picture is present');
  assert.equal(unresolvable?.pictureRoot, 'unknown', 'an unresolvable one is never guessed at');
  assert.equal(readPicture(anatomySource(`{ picture, ${groupsSource} }`, 'const picture = <AnatomySpecimen><View /></AnatomySpecimen>;'))?.pictureRoot, 'specimen');
  assert.equal(readPicture(anatomySource(`{ picture, ${groupsSource} }`, 'const picture = <View />;'))?.pictureRoot, 'other');
  const shorthandNull = readPicture(anatomySource(`{ picture, ${groupsSource} }`, 'const picture = null;'));
  assert.equal(shorthandNull?.pictureOptOut, true);
});

test('F1: the anatomy rules stay quiet for a shorthand picture and for a spread, and still fire without one', () => {
  const quiet = (anatomy: string, extra?: string) => {
    const shapeRead = readPicture(anatomySource(anatomy, extra));
    return [run([{ ...familyWith({}), anatomyShape: shapeRead }], 'anatomy-no-picture').length, run([{ ...familyWith({}), anatomyShape: shapeRead }], 'anatomy-picture-not-specimen').length];
  };
  assert.deepEqual(quiet(`{ picture, ${groupsSource} }`, "import { picture } from './picture';"), [0, 0]);
  assert.deepEqual(quiet(`{ ...shared, ${groupsSource} }`, "import { shared } from './shared';"), [0, 0]);
  assert.deepEqual(quiet(`{ ...shared, ${groupsSource} }`, 'const shared = { picture: <View /> };'), [0, 0], 'a spread is skipped even when its source is readable');
  assert.deepEqual(quiet(`{ ${groupsSource} }`), [1, 0], 'no picture, no spread: fires');
  assert.deepEqual(quiet(`{ picture, ${groupsSource} }`, 'const picture = <View />;'), [0, 1], 'a resolvable shorthand that is not a specimen: fires');
});

// ---- F3: wrapper look-through ----

test('F3: JSX comments, a `{specimen}` const and a same-file `{children}` wrapper are looked through', () => {
  const root = (picture: string, extra = '') => readPicture(pageSource(picture, extra))?.pictureRoot;
  assert.equal(root('<View>{/* pins beside */}<AnatomySpecimen /></View>'), 'specimen');
  assert.equal(root('<>{/* c */}<AnatomySpecimen /></>'), 'specimen');
  assert.equal(root("<View style={{ alignSelf: 'stretch' }}>{specimen}</View>", 'const specimen = <AnatomySpecimen />;'), 'specimen');
  assert.equal(root('<Frame><AnatomySpecimen /></Frame>', 'function Frame({ children }) { return <View>{children}</View>; }'), 'specimen');
  assert.equal(root('<Frame><AnatomySpecimen /></Frame>', 'const Frame = (props) => <View>{props.children}</View>;'), 'specimen');
  assert.equal(root('<View>{specimen}</View>', 'const specimen = <View />;'), 'other', 'a const that is not the specimen still fires');
  assert.equal(root('<Frame><View /></Frame>', 'function Frame({ children }) { return <View>{children}</View>; }'), 'other');
  assert.equal(root('<View>{makeSpecimen()}</View>'), 'unknown', 'an unreadable expression child is never guessed at');
  assert.equal(root('<View>{/* only a comment */}</View>'), 'other');
});

// ---- F12: the message names what the author wrote ----

test('F12: a same-file component picture is reported as <Picture> (renders <View>), and a missing tag is worded once', () => {
  const read = readPicture(pageSource('<Picture />', 'const Picture = () => <View />;'));
  assert.equal(read?.pictureVia, 'Picture');
  assert.equal(read?.pictureTag, 'View');
  const [issue] = run([{ ...familyWith({}), anatomyShape: read }], 'anatomy-picture-not-specimen');
  assert.equal(issue.message, "The anatomy picture's root is <Picture> (renders <View>), not AnatomySpecimen.");
  const [fallback] = run([familyWith({ hasPicture: true, pictureRoot: 'other' })], 'anatomy-picture-not-specimen');
  assert.equal(fallback.message, "The anatomy picture's root is not AnatomySpecimen.");
});

// ---- grid-empty-cell (rule 6, hint) ----

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, name: `Item ${i}` }));

test('grid-empty-cell hints on an odd list laid out two across where regular fits three', () => {
  const found = run([page({ id: 'Dialog', specimenSize: 'wide', variantsItems: items(3) })], 'grid-empty-cell');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'hint');
  assert.match(found[0].message, /^3 items in a 2-wide grid leave an empty cell; consider specimenSize: 'regular'/);
});

test('F9: grid-empty-cell skips a scope with exactly two blocks, and its fix names the whole-page scope of specimenSize', () => {
  const one = run([page({ id: 'Dialog', specimenSize: 'wide', variantsItems: items(3) })], 'grid-empty-cell');
  assert.equal(one.length, 1);
  assert.match(one[0].fix, /applies to the whole page or member/);
  const two = run([page({ id: 'Dialog', specimenSize: 'wide', variantsItems: items(3), statesItems: items(4) })], 'grid-empty-cell');
  assert.equal(two.length, 0, 'the viewer may seat two blocks side by side');
});

test('grid-empty-cell stays quiet for an even count, regular size, a column cap, and a page using a device frame', () => {
  assert.equal(run([page({ id: 'A', specimenSize: 'wide', variantsItems: items(4) })], 'grid-empty-cell').length, 0);
  assert.equal(run([page({ id: 'B', specimenSize: 'regular', variantsItems: items(3) })], 'grid-empty-cell').length, 0);
  assert.equal(run([page({ id: 'C', specimenSize: 'wide', variantsMaxColumns: 2, variantsItems: items(3) })], 'grid-empty-cell').length, 0);
  assert.equal(run([page({ id: 'D', specimenSize: 'wide', viewerImports: ['PhoneFrame'], variantsItems: items(3) })], 'grid-empty-cell').length, 0);
});

// ---- the static long-id rule is gone: the heading wraps, and `doctor --render` hints on a real mid-word break ----

test('a long untitled id is no longer flagged statically; only the render check can tell whether the heading breaks', () => {
  const found = collectIssues([page({ id: 'TranscriptMediaUnavailableChip' })], []);
  assert.deepEqual(found.filter((i) => i.severity === 'hint'), []);
  assert.equal(found.some((i) => i.id === 'untitled-long-id'), false);
});

// ---- hints never fail --ci and are never promoted by strict ----

test('a hint is counted on its own, printed, and never counted as an error or warning', () => {
  const hint: DoctorIssue = { id: 'grid-empty-cell', severity: 'hint', page: 'X', message: 'm', fix: 'f' };
  const base = { version: 1 as const, summary: { errors: 0, warnings: 0, components: 0, withExamples: 0, unboundExamples: 0 }, update: null, issues: [], exitCode: 0 };
  for (const strict of [false, true]) {
    const result = withExtraIssues(base, [hint], strict);
    assert.equal(result.exitCode, 0, `strict=${strict}`);
    assert.deepEqual([result.summary.errors, result.summary.warnings, result.summary.hints], [0, 0, 1]);
    assert.equal(result.issues[0].severity, 'hint', 'strict must not promote a hint');
  }
  const text = formatHuman(toDoctorJson(withExtraIssues(base, [hint], false)));
  assert.match(text, /\[hint\] grid-empty-cell/);
  assert.match(text, /0 errors, 0 warnings, 1 hint —/);
  const promoted = withExtraIssues(base, [{ ...hint, severity: 'warning' }], true);
  assert.equal(promoted.exitCode, 1, 'a warning is still promoted by strict');
});

// ---- F14: the starter kit's own references stay true after `init` copies it into a project ----

const KIT = path.resolve(import.meta.dirname, '../../starter-kit');

test('F14: TripCard and Radius point at kit-relative files that exist, without a line number to drift', () => {
  const tripCard = readFileSync(path.join(KIT, 'pages/TripCard.catalog.tsx'), 'utf8');
  const tripSource = tripCard.match(/source: '([^']+)'/)?.[1];
  assert.equal(tripSource, 'pages/TripCard.catalog.tsx', 'the pattern is defined in its own catalog file');
  assert.ok(existsSync(path.join(KIT, tripSource!)));
  const radius = readFileSync(path.join(KIT, 'pages/Radius.catalog.tsx'), 'utf8');
  const radiusSource = radius.match(/RADIUS_SOURCE = '([^']+)'/)?.[1];
  assert.ok(radiusSource && !radiusSource.startsWith('starter-kit/') && !/:\d+$/.test(radiusSource), radiusSource);
  assert.ok(existsSync(path.join(KIT, radiusSource!)));
  assert.match(readFileSync(path.join(KIT, radiusSource!), 'utf8'), /export const DS_RADIUS\b/);
});

test('F14: the Motion SwiftUI label is built from the spring values it shows', () => {
  const motion = readFileSync(path.join(KIT, 'pages/Motion.catalog.tsx'), 'utf8');
  assert.match(motion, /label=\{`\{ response: \$\{SWIFTUI_SPRING\.response\}, dampingFraction: \$\{SWIFTUI_SPRING\.dampingFraction\} \}`\}/);
  assert.doesNotMatch(motion, /label="\{ response: 0\.5/);
});
