// An `Inventory` follows the token-page layout: the banner and the filter chips at page level, each
// group its own section (uppercase title and description outside, tiles in the group's own bordered
// box), exactly as `TokenSections` draws a token page's sections. A page whose content starts with
// an `Inventory` draws that way by default; one placed anywhere else keeps everything in the box it
// is in. jsdom has no layout, so these tests pin structure and the styles the components share, and
// `doctor --render` / the browser pass pin the geometry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;

const { Inventory, InventoryGroup, InventoryTile, startsWithInventory } = await import('../Inventory.tsx');
const { SectionBlock } = await import('../SectionBlock.tsx');
const { WarningBanner } = await import('../WarningBanner.tsx');
const { JumpRow } = await import('../JumpRow.tsx');
const { TokenSections } = await import('../TokenLayouts.tsx');
const { Text, View, StyleSheet } = await import('react-native');

class FakeResizeObserver {
  static current: FakeResizeObserver | undefined;
  observed = new Set<Element>();
  constructor(private callback: (entries: Array<{ target: Element }>) => void) { FakeResizeObserver.current = this; }
  observe(node: Element) { this.observed.add(node); }
  unobserve(node: Element) { this.observed.delete(node); }
  disconnect() { this.observed.clear(); }
  triggerAll() { this.callback([...this.observed].map((target) => ({ target }))); }
}

function mountWith(element: React.ReactElement) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (dom.window as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserver;
  const container = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(container);
  act(() => { root.render(element); });
  return { container, cleanup: () => { act(() => { root.unmount(); }); dom.window.close(); } };
}

async function settle(width = 1200) {
  for (let i = 0; i < 3; i += 1) {
    const observer = FakeResizeObserver.current;
    if (!observer) return;
    for (const node of observer.observed) {
      Object.defineProperty(node, 'offsetWidth', { value: width, configurable: true });
      Object.defineProperty(node, 'offsetHeight', { value: 10, configurable: true });
    }
    await act(async () => { observer.triggerAll(); await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
}

/** The rules react-native-web generated for an element's atomic classes: property -> value. */
function declared(el: Element): Record<string, string> {
  const rules = StyleSheet.getSheet().textContent.split('\n');
  const out: Record<string, string> = {};
  for (const cls of (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)) {
    for (const rule of rules) {
      const m = rule.match(new RegExp(`^\\.${cls}\\{(.*)\\}$`));
      if (m) for (const d of m[1].split(';').filter(Boolean)) { const i = d.indexOf(':'); out[d.slice(0, i)] = d.slice(i + 1); }
    }
  }
  return out;
}

const BOX = '[data-testid="token-section-box"]';
const PAGE_BOX = '[data-testid="page-preview-box"]';
const FILTERS = '[data-testid="inventory-filters"]';
const click = (el: Element) => act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
const inBox = (el: Element) => el.closest(`${BOX}, ${PAGE_BOX}`) !== null;
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & 4);

const tile = (name: string, tags?: string[]) => <InventoryTile key={name} target={`#${name}`} tags={tags} specimen={<Text>{name} specimen</Text>} />;
const overview = (layout?: 'sections' | 'inline') => (
  <>
    <WarningBanner title="One primary per surface">Each screen gets one primary Button.</WarningBanner>
    <Inventory layout={layout}>
      <InventoryGroup title="One action" description="A single Button.">{[tile('Button', ['Has a label'])]}</InventoryGroup>
      <InventoryGroup title="Several actions" description="A ButtonGroup.">{[tile('ButtonGroup'), tile('SplitButton', ['Has a label'])]}</InventoryGroup>
    </Inventory>
  </>
);
const page = (render: () => React.ReactNode) =>
  <SectionBlock def={{ id: 'Buttons', description: 'Start here.', path: 'Buttons.tsx', previewWidths: 'full', render } as never} />;

test('a page that starts with an Inventory draws at page level: no box around the banner, the chips or the groups together', async () => {
  const { container, cleanup } = mountWith(page(() => overview()));
  await settle();
  try {
    assert.equal(container.querySelectorAll(PAGE_BOX).length, 0, 'the page preview is not one box');
    const banner = container.querySelector('[role="note"]')!;
    const chips = container.querySelector(FILTERS)!;
    assert.ok(banner && chips);
    assert.equal(inBox(banner), false, 'the banner is outside any box');
    assert.equal(inBox(chips), false, 'the chips are outside any box');
    const boxes = [...container.querySelectorAll(BOX)];
    assert.equal(boxes.length, 2, 'each group is its own section box');
    assert.ok(before(banner, chips) && before(chips, boxes[0]), 'banner, then chips, then the sections');
  } finally { cleanup(); }
});

test('each group is a section: its title and description sit outside its own box, its tiles inside', async () => {
  const { container, cleanup } = mountWith(page(() => overview()));
  await settle();
  try {
    const boxes = [...container.querySelectorAll(BOX)] as HTMLElement[];
    const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');
    assert.equal(boxes[0].querySelectorAll('a').length, 1);
    assert.equal(boxes[1].querySelectorAll('a').length, 2);
    for (const [i, [title, desc]] of ([['One action · 1', 'A single Button.'], ['Several actions · 2', 'A ButtonGroup.']] as const).entries()) {
      assert.ok(!text(boxes[i]).includes(title) && !text(boxes[i]).includes(desc), 'the title and description are not inside the box');
      const section = boxes[i].parentElement!;
      assert.ok(text(section).startsWith(`${title}${desc}`), `${title}: title, then description, then the box`);
    }
  } finally { cleanup(); }
});

test('the section frame is the one a token page uses: same title, description and box styles, same chip row as the jump row', async () => {
  const dimension = mountWith(
    <View>
      <JumpRow items={[{ id: 'a', title: 'Spacing', qualifier: '3' }]} />
      <TokenSections columns={1} sections={[{ title: 'Spacing', desc: 'Gaps.', render: () => <Text>x</Text> }]} />
    </View>,
  );
  await settle();
  const token = {
    row: declared(dimension.container.querySelector('[role="list"]')!),
    box: declared(dimension.container.querySelector(BOX)!),
    title: declared(dimension.container.querySelector(`${BOX}`)!.previousElementSibling!.previousElementSibling!),
    desc: declared(dimension.container.querySelector(BOX)!.previousElementSibling!),
    stack: declared(dimension.container.querySelector(BOX)!.parentElement!.parentElement!)['gap'],
  };
  dimension.cleanup();
  const { container, cleanup } = mountWith(page(() => overview()));
  await settle();
  try {
    const box = container.querySelector(BOX)!;
    assert.deepEqual(declared(box), token.box, 'the section box');
    assert.deepEqual(declared(box.previousElementSibling!), token.desc, 'the description');
    assert.deepEqual(declared(box.previousElementSibling!.previousElementSibling!), token.title, 'the title');
    assert.deepEqual(declared(container.querySelector(FILTERS)!), token.row, 'the chip row is the jump row (position, wrap, gap and the space under it)');
    assert.equal(token.row['margin-bottom'], '14px');
    // The sections sit one under another with the gap a token page's sections have between rows.
    assert.equal(declared(box.parentElement!.parentElement!)['gap'], token.stack, 'the gap between sections');
    assert.equal(token.stack, '20px');
  } finally { cleanup(); }
});

test('the chips still filter and count, and a filter that empties a group hides its whole section', async () => {
  const { container, cleanup } = mountWith(page(() => overview()));
  await settle();
  try {
    const chips = () => [...container.querySelectorAll(`${FILTERS} [aria-pressed]`)] as HTMLElement[];
    assert.deepEqual(chips().map((c) => c.getAttribute('aria-label')), ['All, 3', 'One action, 1', 'Several actions, 2', 'Has a label, 2']);
    click(chips()[1]);
    await settle();
    assert.equal(container.querySelectorAll(BOX).length, 1, 'the group with nothing left is gone, title and box');
    assert.ok(!(container.textContent ?? '').includes('Several actions · '));
    assert.equal(container.querySelector('[role="status"]')!.textContent, 'Showing 1 of 3');
    click(chips()[3]);
    await settle();
    assert.equal(container.querySelectorAll(BOX).length, 2, 'a tag shows its tiles in both groups');
    assert.ok((container.textContent ?? '').includes('Several actions · 1 of 2'));
    click(chips()[0]);
    await settle();
    assert.equal(container.querySelectorAll(BOX).length, 2);
  } finally { cleanup(); }
});

test('the filter status sits in the chip row, so the space under the chips is the jump row\'s in both states', async () => {
  const { container, cleanup } = mountWith(page(() => overview()));
  await settle();
  try {
    assert.ok(container.querySelector(FILTERS)!.contains(container.querySelector('[role="status"]')), 'the status is a child of the chip row, not a row of its own');
  } finally { cleanup(); }
});

test('an Inventory placed anywhere else stays inline: one box holds the banner, the chips and every group (existing catalogs are unchanged)', async () => {
  const { container, cleanup } = mountWith(page(() => <View>{overview()}</View>));
  await settle();
  try {
    const box = container.querySelector(PAGE_BOX)!;
    assert.ok(box, 'a page that does not start with an Inventory keeps its one box');
    assert.equal(container.querySelectorAll(BOX).length, 0, 'groups are not sections here');
    assert.ok(box.contains(container.querySelector('[role="note"]')) && box.contains(container.querySelector(FILTERS)));
    assert.ok((box.textContent ?? '').includes('One action · 1') && (box.textContent ?? '').includes('Several actions · 2'));
  } finally { cleanup(); }
});

test('layout overrides where the Inventory is: "sections" inside a box, "inline" at page level', async () => {
  const boxed = mountWith(page(() => <View>{overview('sections')}</View>));
  await settle();
  try { assert.equal(boxed.container.querySelectorAll(BOX).length, 2, 'explicit sections inside a box'); } finally { boxed.cleanup(); }
  const flat = mountWith(page(() => overview('inline')));
  await settle();
  try {
    assert.equal(flat.container.querySelectorAll(BOX).length, 0, 'explicit inline at page level draws no section boxes');
    assert.ok((flat.container.textContent ?? '').includes('Several actions · 2'));
  } finally { flat.cleanup(); }
});

test('startsWithInventory reads the content as elements: an Inventory alone, in a fragment or array, under banners; nothing else around it', () => {
  const inv = <Inventory><InventoryGroup title="G">{[]}</InventoryGroup></Inventory>;
  const banner = <WarningBanner title="T">b</WarningBanner>;
  assert.equal(startsWithInventory(inv), true);
  assert.equal(startsWithInventory(<>{banner}{inv}</>), true, 'under a banner, in a fragment');
  assert.equal(startsWithInventory([React.cloneElement(banner, { key: 'a' }), React.cloneElement(inv, { key: 'b' })]), true, 'in an array');
  assert.equal(startsWithInventory(<><>{inv}</></>), true, 'in nested fragments');
  assert.equal(startsWithInventory(<View>{inv}</View>), false, 'inside a wrapper element');
  assert.equal(startsWithInventory(<Text>x</Text>), false);
  assert.equal(startsWithInventory(null), false);
  // L1: "starts with" means the Inventory is the page, not just somewhere in it.
  assert.equal(startsWithInventory(<><Text>x</Text>{inv}</>), false, 'other content before it');
  assert.equal(startsWithInventory(<>{banner}<Text>x</Text>{inv}</>), false, 'a banner is not the only thing above it');
  assert.equal(startsWithInventory(<>{inv}<Text>more</Text></>), false, 'content after it');
  assert.equal(startsWithInventory(<>{inv}{React.cloneElement(inv, { key: 'two' })}</>), false, 'two inventories');
  assert.equal(startsWithInventory(<>{banner}</>), false, 'a banner and no Inventory');
});

// `doctor --render`'s `sections-in-one-box`: the browser script runs here against the real components'
// DOM (it reads the viewer's own markers, no layout), so the check and the layout cannot drift apart.
const { INVENTORY_BOX_SCRIPT, inventoryBoxIssues } = await import('../../../cli/render.ts');
const findings = (container: HTMLElement) =>
  Function('document', `return ${INVENTORY_BOX_SCRIPT};`)(container.ownerDocument) as Array<{ box: string; banner: boolean; chips: boolean; groups: number }>;

test('sections-in-one-box: a page drawn the token-page way has no findings', async () => {
  const { container, cleanup } = mountWith(page(() => overview()));
  await settle();
  try { assert.deepEqual(findings(container), []); } finally { cleanup(); }
});

test('sections-in-one-box: banner, chips and several groups inside one page box are reported once, with what is inside', async () => {
  const { container, cleanup } = mountWith(page(() => <View>{overview()}</View>));
  await settle();
  try {
    assert.deepEqual(findings(container), [{ box: 'page', banner: true, chips: true, groups: 2 }]);
    const [issue] = inventoryBoxIssues({ id: 'Buttons', file: 'pages/Buttons.catalog.tsx' }, findings(container));
    assert.equal(issue.id, 'sections-in-one-box');
    assert.equal(issue.severity, 'warning');
    assert.equal(issue.page, 'Buttons');
    assert.match(issue.message, /one page box with a banner, the filter chips, 2 groups/);
    assert.match(issue.fix, /Make the `Inventory` the page.s whole `render`/);
  } finally { cleanup(); }
});

test('sections-in-one-box: several groups in one section box, or the chips in one, are reported; a box of one group is not', async () => {
  const several = mountWith(
    <View>
      {/* A token-style section that holds the whole inventory: the shape this check exists for. */}
      <TokenSections columns={1} sections={[{ title: 'Buttons', render: () => <Inventory layout="inline"><InventoryGroup title="A">{[tile('Button')]}</InventoryGroup><InventoryGroup title="B">{[tile('ButtonGroup')]}</InventoryGroup></Inventory> }]} />
    </View>,
  );
  await settle();
  try {
    assert.deepEqual(findings(several.container), [{ box: 'section', banner: false, chips: true, groups: 2 }]);
  } finally { several.cleanup(); }
  const single = mountWith(page(() => <Inventory><InventoryGroup title="A" description="d">{[tile('Button')]}</InventoryGroup></Inventory>));
  await settle();
  try { assert.deepEqual(findings(single.container), [], 'one group in its own box (no chips to draw)'); } finally { single.cleanup(); }
});

test('sections-in-one-box: an aria-hidden miniature of a page is ignored', async () => {
  const { container, cleanup } = mountWith(<View aria-hidden>{page(() => <View>{overview()}</View>)}</View>);
  await settle();
  try { assert.deepEqual(findings(container), []); } finally { cleanup(); }
});

test('sections-in-one-box: a token gallery that draws several titled groups in its one box is reported, with the tokenSections fix', async () => {
  const { DividedStack } = await import('../DividedStack.tsx');
  const { VariantGroup } = await import('../VariantGroup.tsx');
  const gallery = (groups: number) => (
    <SectionBlock def={{ id: 'Icons', description: 'x', path: 'Icons.tsx', tokenGallery: true, previewWidths: 'full', render: () => (
      <DividedStack>{Array.from({ length: groups }, (_, i) => <VariantGroup key={i} name={`Group ${i}`} desc="d" align="left"><Text>g</Text></VariantGroup>)}</DividedStack>
    ) } as never} />
  );
  const many = mountWith(gallery(2));
  await settle();
  try {
    assert.deepEqual(findings(many.container), [{ box: 'gallery', banner: false, chips: false, groups: 0, sections: 2 }]);
    const [issue] = inventoryBoxIssues({ id: 'Icons' }, findings(many.container) as never);
    assert.match(issue.message, /2 titled sections inside one box/);
    assert.match(issue.fix, /tokenSections/);
  } finally { many.cleanup(); }
  const one = mountWith(gallery(1));
  await settle();
  try { assert.deepEqual(findings(one.container), [], 'one group in the gallery box is a single section'); } finally { one.cleanup(); }
  const component = mountWith(<SectionBlock def={{ id: 'Chip', description: 'x', path: 'Chip.tsx', previewWidths: 'full', render: () => <DividedStack><VariantGroup name="A"><Text>a</Text></VariantGroup><VariantGroup name="B"><Text>b</Text></VariantGroup></DividedStack> } as never} />);
  await settle();
  try { assert.deepEqual(findings(component.container), [], 'a component page keeps its Examples card with several groups'); } finally { component.cleanup(); }
});

test('sections-in-one-box: each part is reported on its own: the chips alone, or several groups alone', async () => {
  // Chips and one group, no banner: a single group whose tiles carry a tag has chips to draw.
  const chipsOnly = mountWith(page(() => <View><Inventory layout="inline"><InventoryGroup title="A" description="d">{[tile('Button', ['Has a label'])]}</InventoryGroup></Inventory></View>));
  await settle();
  try { assert.deepEqual(findings(chipsOnly.container), [{ box: 'page', banner: false, chips: true, groups: 1 }]); } finally { chipsOnly.cleanup(); }
  // Two bare groups, no chips and no banner.
  const groupsOnly = mountWith(page(() => <View><InventoryGroup title="A">{[tile('Button')]}</InventoryGroup><InventoryGroup title="B">{[tile('ButtonGroup')]}</InventoryGroup></View>));
  await settle();
  try { assert.deepEqual(findings(groupsOnly.container), [{ box: 'page', banner: false, chips: false, groups: 2 }]); } finally { groupsOnly.cleanup(); }
  // A banner with one group: the banner belongs at page level.
  const bannerOnly = mountWith(page(() => <View><WarningBanner title="T">Body.</WarningBanner><InventoryGroup title="A">{[tile('Button')]}</InventoryGroup></View>));
  await settle();
  try { assert.deepEqual(findings(bannerOnly.container), [{ box: 'page', banner: true, chips: false, groups: 1 }]); } finally { bannerOnly.cleanup(); }
  // A banner in a box with no inventory is an ordinary page.
  const plain = mountWith(page(() => <View><WarningBanner title="T">Body.</WarningBanner></View>));
  await settle();
  try { assert.deepEqual(findings(plain.container), []); } finally { plain.cleanup(); }
});

test('M2: chips and groups inside an aria-hidden miniature in a box that is not hidden are not the box\'s own', async () => {
  const { container, cleanup } = mountWith(page(() => (
    <View>
      <Text>An overview of its own.</Text>
      <View aria-hidden>{overview()}</View>
    </View>
  )));
  await settle();
  try { assert.deepEqual(findings(container), [], 'the thumbnail\'s banner, chips and two groups are not counted'); } finally { cleanup(); }
});

test('M2: a tile\'s drawing of an overview stays inline inside a sections-layout group', async () => {
  const nested = (
    <Inventory layout="sections">
      <InventoryGroup title="Outer" description="d">{[<InventoryTile key="t" target="#X" specimen={overview()} />]}</InventoryGroup>
    </Inventory>
  );
  const { container, cleanup } = mountWith(nested);
  await settle();
  try {
    assert.equal(container.querySelectorAll(BOX).length, 1, 'only the outer group is a section box; the miniature\'s two groups are not');
  } finally { cleanup(); }
});

test('L4: a filterable Inventory inside a section is reported with a fix that applies to a section', async () => {
  const { container, cleanup } = mountWith(
    <TokenSections columns={1} sections={[{ title: 'Buttons', render: () => <Inventory layout="inline"><InventoryGroup title="A">{[tile('Button', ['x'])]}</InventoryGroup><InventoryGroup title="B">{[tile('ButtonGroup')]}</InventoryGroup></Inventory> }]} />,
  );
  await settle();
  try {
    const [issue] = inventoryBoxIssues({ id: 'Buttons' }, findings(container) as never);
    assert.match(issue.fix, /Move the `Inventory` out of the section/);
    assert.doesNotMatch(issue.fix, /Start the page with/);
  } finally { cleanup(); }
});

test('L5: a VariantGroup with no name is not a titled section; one with a name is', async () => {
  const { VariantGroup } = await import('../VariantGroup.tsx');
  const { DividedStack } = await import('../DividedStack.tsx');
  const gallery = (names: Array<string | undefined>) => (
    <SectionBlock def={{ id: 'Icons', description: 'x', path: 'Icons.tsx', tokenGallery: true, previewWidths: 'full', render: () => (
      <DividedStack>{names.map((name, i) => <VariantGroup key={i} name={name} align="left"><Text>g</Text></VariantGroup>)}</DividedStack>
    ) } as never} />
  );
  const spacing = mountWith(gallery([undefined, undefined, undefined]));
  await settle();
  try { assert.deepEqual(findings(spacing.container), [], 'unnamed groups used for spacing'); } finally { spacing.cleanup(); }
  const named = mountWith(gallery(['A', 'B']));
  await settle();
  try { assert.equal((findings(named.container) as Array<{ sections?: number }>)[0]?.sections, 2); } finally { named.cleanup(); }
});

test('an overview is drawn at page level whatever its previewWidths, with no "Preview" label above it', async () => {
  for (const previewWidths of [undefined, [402, 390, 320], 'full'] as const) {
    const def = { id: 'Buttons', description: 'Start here.', path: 'Buttons.tsx', render: () => overview(), ...(previewWidths ? { previewWidths } : {}) };
    const { container, cleanup } = mountWith(<SectionBlock def={def as never} />);
    await settle();
    try {
      const label = String(previewWidths);
      assert.equal(container.querySelectorAll(BOX).length, 2, `${label}: each group is its own section box`);
      assert.equal(container.querySelectorAll(FILTERS).length, 1, `${label}: one inventory, not one per phone frame`);
      assert.equal(inBox(container.querySelector('[role="note"]')!), false, `${label}: the banner is outside any box`);
      assert.ok(![...container.querySelectorAll('div')].some((el) => el.childNodes.length === 1 && el.textContent === 'Preview'), `${label}: no "Preview" label`);
    } finally { cleanup(); }
  }
});
