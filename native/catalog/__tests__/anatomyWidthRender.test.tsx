import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { SectionDef } from '../types.ts';

// The anatomy picture's width, mounted: a real `ResizeObserver` stand-in (same one as
// familyPageRender.test.tsx, see its long comment) so react-native-web's `onLayout` fires, with the
// DOM node's `offsetWidth` stubbed to the width being "measured". jsdom has no layout, so this
// proves which layout the measured widths choose and which width the picture is laid out at, never
// browser geometry.
const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
// react-native-web's own `canUseDom` gets cached the same way, at its own first import — reachable
// only through the same dynamic `import()` below, so it also now evaluates with a real `document`
// present. That code checks a bare `instanceof ShadowRoot` with no feature-detection guard — a real
// global in a browser (where `window` is `globalThis`), but not here, where `ShadowRoot` only
// exists as a property of our own `window` object, so the bare identifier throws a `ReferenceError`
// unless it's exposed as a true global too.
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
// The member side panel is a real `Modal`; its focus trap checks a bare `instanceof Node` against
// whichever window `renderCatalog` currently mounted into (`sourceReferencePickerRender.test.tsx`'s
// own precedent).
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });


const { AnatomyPin, AnatomySpecimen } = await import('../Anatomy.tsx');
const { View } = await import('react-native');
const { SectionBlock } = await import('../SectionBlock.tsx');
const { FamilyPage } = await import('../FamilyPage.tsx');
const { GroupPage } = await import('../GroupPage.tsx');
const { buildCatalogSections, defineCatalogPage } = await import('../pageApi.ts');

type ResizeEntry = { target: Element };
type ResizeCallback = (entries: ResizeEntry[]) => void;

class FakeResizeObserver {
  // `useElementLayout` constructs this at most once per process (its own module-level cache), the
  // first time any `onLayout`-bearing node mounts anywhere — capturing that one instance here is
  // the only way a test can ever reach it to fire a synthetic resize.
  static current: FakeResizeObserver | undefined;
  private observed = new Set<Element>();
  constructor(private callback: ResizeCallback) {
    FakeResizeObserver.current = this;
  }
  observe(node: Element) {
    this.observed.add(node);
  }
  unobserve(node: Element) {
    this.observed.delete(node);
  }
  disconnect() {
    this.observed.clear();
  }
  trigger(node: Element) {
    if (this.observed.has(node)) this.callback([{ target: node }]);
  }
}

// Renders exactly like the shared `renderCatalog` helper (a protected file this fix never edits),
// but on a jsdom window that also carries the fake `ResizeObserver` above, so react-native-web's
// own `onLayout` plumbing actually has one to construct.
function renderWithResizeObserver(element: React.ReactElement) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (dom.window as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserver;
  const container = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    documentOf: dom.window.document,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      dom.window.close();
    },
  };
}

function stubOffsetWidth(node: Element, width: number) {
  Object.defineProperty(node, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(node, 'offsetHeight', { value: 10, configurable: true });
}

// Replays a resize for `node` and waits out `UIManager.measure`'s own real `setTimeout(0)` — the
// delay between the fake observer firing and `onLayout` (and the `setState` it causes) actually
// running — inside a single async `act`, so the resulting re-render is already committed by the
// time this resolves.
async function resize(node: Element, width: number) {
  stubOffsetWidth(node, width);
  await act(async () => {
    FakeResizeObserver.current?.trigger(node);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}


const item = (key: string) => ({ key, name: key, node: <span>{`${key} specimen`}</span> });
function page(previewWidths?: SectionDef['previewWidths']): SectionDef<string> {
  return {
    id: 'Frame', title: 'Frame', description: 'd', path: 'Frame.tsx', variants: { items: [item('frame')] },
    ...(previewWidths ? { previewWidths } : {}),
    anatomy: {
      picture: <span data-testid="picture"><AnatomyPin other="Chip" /></span>,
      groups: [{ label: 'Used', items: [{ other: 'Chip', description: 'A chip.' }, { other: 'Toggle', description: 'A toggle.' }] }],
    },
  };
}

/** react-native-web turns each style into atomic classes and injects their rules once, into the
 *  window that was current when it was first imported (the warmup window above) — read one back. */
function cssOf(el: Element, property: string): string {
  const inline = new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`).exec(el.getAttribute('style') || '');
  if (inline) return inline[1].trim();
  const classes = new Set((el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  let found = '';
  for (const sheet of [...warmup.window.document.styleSheets]) {
    for (const rule of [...sheet.cssRules]) {
      const match = /^\.([\w-]+)\s*\{(.*)\}$/s.exec(rule.cssText);
      if (!match || !classes.has(match[1])) continue;
      const declaration = new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+)`).exec(match[2]);
      if (declaration) found = declaration[1].trim();
    }
  }
  return found;
}

const OVERFLOW_X_AUTO = 'r-overflowX-lltvgl';
const widthClass = (el: Element | null) => (el?.className.split(/\s+/) ?? []).find((c) => c.startsWith('r-width-'));
const hasClass = (el: Element, name: string) => el.className.split(/\s+/).includes(name);

async function mountPage(def: SectionDef<string>, card: number, picture = 266) {
  const view = renderWithResizeObserver(React.createElement(SectionBlock as never, { def } as never));
  const cardNode = view.container.querySelector('[data-testid="anatomy-body"]')!;
  const pictureWrapper = view.container.querySelector('[data-testid="anatomy-picture-measure"]')!;
  await resize(pictureWrapper, picture);
  await resize(cardNode, card);
  const q = (id: string) => view.container.querySelector(`[data-testid="${id}"]`);
  return { ...view, q, cardNode, pictureWrapper, stacked: () => q('anatomy-columns') !== null };
}

test('the picture frame is the first previewWidths entry plus the pin margin, whatever its own measured width', async () => {
  for (const [widths, expected] of [[[402, 320], '462px'], [[320, 402], '380px']] as const) {
    const view = await mountPage(page(widths), 1000);
    assert.equal((view.pictureWrapper as HTMLElement).style.width, expected, `previewWidths ${widths}`);
    const frame = view.pictureWrapper as HTMLElement;
    assert.equal(frame.style.paddingLeft, '30px');
    assert.equal(frame.style.paddingRight, '30px', 'an equal margin on both sides keeps the content box exactly the preview width');
    assert.equal((view.pictureWrapper as HTMLElement).style.alignItems, 'center', 'a picture narrower than the frame (no width of its own) centres too');
    view.cleanup();
  }
});

test('an AnatomySpecimen as the picture root fills the frame\'s content box exactly, so it is centred and its pin column lands in the right margin', async () => {
  const def = page([402]);
  const picture = <AnatomySpecimen pins={<AnatomyPin other="Chip" />}><span>chip</span></AnatomySpecimen>;
  const view = await mountPage({ ...def, anatomy: { ...def.anatomy!, picture } } as SectionDef<string>, 1100);
  const frame = view.pictureWrapper as HTMLElement;
  const specimen = view.q('anatomy-specimen') as HTMLElement;
  // Border-box frame: the content box is width minus both paddings. jsdom has no layout, so the
  // equality of these styles is what proves the specimen spans the content box with no offset.
  const px = (value: string) => Number.parseFloat(value);
  const contentBox = px(frame.style.width) - px(frame.style.paddingLeft) - px(frame.style.paddingRight);
  assert.equal(contentBox, px(specimen.style.width), 'the specimen is exactly as wide as the frame\'s content box');
  assert.equal(frame.style.paddingLeft, frame.style.paddingRight, 'no side offset, so it is centred in the frame');
  view.cleanup();
});

test('the anatomy width falls back to the catalog\'s defaultPreviewWidths, like the specimens, on a standalone, family and group page', async () => {
  const wrapperOf = (container: HTMLElement) => container.querySelector('[data-testid="anatomy-picture-measure"]') as HTMLElement;
  const standalone = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: page(), defaultPreviewWidths: [402] } as never));
  assert.equal(wrapperOf(standalone.container).style.width, '462px');
  standalone.cleanup();
  const own = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: page([320]), defaultPreviewWidths: [402] } as never));
  assert.equal(wrapperOf(own.container).style.width, '380px', 'the page\'s own previewWidths wins over the default');
  own.cleanup();

  const familyDef = { ...page(), anatomy: undefined, family: {
    whole: 'Frame', outline: new Map(), sections: [],
    members: [{ id: 'Frame', source: 'f:1', path: 'f:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'w' }],
    anatomy: page().anatomy,
  } } as unknown as SectionDef<string>;
  const family = renderWithResizeObserver(React.createElement(FamilyPage as never, { def: familyDef, defaultPreviewWidths: [360] } as never));
  assert.equal(wrapperOf(family.container).style.width, '420px');
  family.cleanup();

  const widgets = defineCatalogPage({
    id: 'Widgets', group: 'Components', description: 'A group.',
    members: [{
      id: 'Embedded', source: 'e:1', fidelity: 'documentation-only' as const, relationship: 'Top-level', description: 'd',
      anatomy: { picture: React.createElement('div'), groups: [{ label: 'In', items: [{ other: 'Chip', description: 'c' }] }] },
    }],
  });
  const { sections } = buildCatalogSections([{ ...widgets, file: 'fixtures/Widgets.catalog.tsx' }], []);
  const group = renderWithResizeObserver(React.createElement(GroupPage as never, { def: sections[0], defaultPreviewWidths: [320] } as never));
  assert.equal(wrapperOf(group.container).style.width, '380px');
  group.cleanup();
});

test('beside the legend the picture column is half the box: stage and legend share one 50% width', async () => {
  const view = await mountPage(page([402]), 1020);
  assert.equal(view.stacked(), false, 'half of 1020 holds the 402 picture, its two 30px margins and its padding');
  assert.ok(view.q('anatomy-stage')!.className.split(/\s+/).some((c) => c.startsWith('r-alignSelf-')), 'the stage stretches to the row height so the picture centres vertically');
  const stageWidth = widthClass(view.q('anatomy-stage'));
  assert.ok(stageWidth, 'the stage has a width');
  assert.equal(widthClass(view.q('anatomy-legend')), undefined, 'the legend sets no width of its own');
  const legendClasses = view.q('anatomy-legend')!.className.split(/\s+/);
  assert.ok(legendClasses.some((c) => c.startsWith('r-flexGrow-')), 'the legend grows into the half the stage leaves');
  assert.ok(legendClasses.some((c) => c.startsWith('r-flexBasis-')), 'the legend sets its own flex basis (flex: 0 + width collapsed it to 1px in a browser)');
  view.cleanup();
});

test('the box stacks as soon as half of it cannot hold the preview width', async () => {
  const view = await mountPage(page([402]), 1019);
  assert.equal(view.stacked(), true);
  assert.equal(view.q('anatomy-legend'), null);
  assert.equal(widthClass(view.q('anatomy-stage')), undefined, 'stacked, the stage spans the box rather than taking half');
  assert.equal((view.pictureWrapper as HTMLElement).style.width, '462px', 'stacked, the picture keeps its real width and pin margins');
  // And back to side by side, without remounting the picture.
  const pictureNode = view.pictureWrapper.firstElementChild;
  await resize(view.cardNode, 1100);
  assert.equal(view.stacked(), false);
  assert.equal(view.pictureWrapper.firstElementChild === pictureNode, true);
  view.cleanup();
});

test('a 402-wide picture in a 390px viewport stacks and scrolls inside its own stage, never the page', async () => {
  const view = await mountPage(page([402]), 342);
  assert.equal(view.stacked(), true);
  assert.equal((view.pictureWrapper as HTMLElement).style.width, '462px');
  assert.equal(hasClass(view.q('anatomy-stage')!, OVERFLOW_X_AUTO), true, 'the stage is the scroller');
  view.cleanup();
});

test('without previewWidths the layout is the old measured one: side by side at 700 with a 266 picture, no fixed width', async () => {
  const view = await mountPage(page(), 700);
  assert.equal(view.stacked(), false);
  assert.equal((view.pictureWrapper as HTMLElement).style.width, '');
  assert.equal(hasClass(view.q('anatomy-stage')!, OVERFLOW_X_AUTO), false);
  assert.equal(widthClass(view.q('anatomy-legend')), undefined, 'the legend keeps its flexible share');
  view.cleanup();
  // The same card with a preview width of 402 stacks (350 < 402 + 60 + 48).
  const fixed = await mountPage(page([402]), 700);
  assert.equal(fixed.stacked(), true);
  fixed.cleanup();
});

test('a family page lays its anatomy picture out at the page\'s preview width too', async () => {
  const def = { ...page([360]), anatomy: undefined, family: {
    whole: 'Frame', outline: new Map(), sections: [],
    members: [{ id: 'Frame', source: 'f:1', path: 'f:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'w' }],
    anatomy: page([360]).anatomy,
  } } as unknown as SectionDef<string>;
  const view = renderWithResizeObserver(React.createElement(FamilyPage as never, { def } as never));
  const wrapper = view.container.querySelector('[data-testid="anatomy-picture-measure"]') as HTMLElement;
  assert.equal(wrapper.style.width, '420px');
  view.cleanup();
});

test('a group member\'s own anatomy uses that member\'s previewWidths and numbers its others after its parts', async () => {
  const widgets = defineCatalogPage({
    id: 'Widgets', group: 'Components', description: 'A group.',
    members: [
      {
        id: 'Embedded', source: 'e:1', fidelity: 'documentation-only' as const, relationship: 'Top-level', description: 'd', previewWidths: [320],
        anatomy: {
          picture: React.createElement('div', null, React.createElement(AnatomyPin, { member: 'EmbeddedPart' }), React.createElement(AnatomyPin, { other: 'Chip' })),
          groups: [{ label: 'In', items: [{ member: 'EmbeddedPart', description: 'p' }, { other: 'Chip', description: 'c' }] }],
        },
      },
      { id: 'EmbeddedPart', source: 'e:2', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'Embedded', description: 'p' },
    ],
  });
  const { sections } = buildCatalogSections([{ ...widgets, file: 'fixtures/Widgets.catalog.tsx' }], []);
  // `Chip` resolves to a page, so it is numbered as a part; an unresolved name would stay unnumbered.
  const navigation = { resolve: (name: string) => (name === 'Chip' ? { pageId: 'Chip' } : undefined), open: () => {}, page: () => ({ title: 'Chip' }) };
  const view = renderWithResizeObserver(React.createElement(GroupPage as never, { def: sections[0], navigation } as never));
  const wrapper = view.container.querySelector('[data-testid="anatomy-picture-measure"]') as HTMLElement;
  assert.equal(wrapper.style.width, '380px');
  assert.ok(view.container.querySelector('[role="img"][aria-label="Part 2, opens Chip"]'), 'its own part is 1, so the other is 2');
  view.cleanup();
});

test('AnatomySpecimen draws its children at the anatomy preview width, through the variant cells\' centring', async () => {
  const def = page([402]);
  const withSpecimen = { ...def, anatomy: { ...def.anatomy!, picture: <View><AnatomySpecimen><span data-testid="chip">chip</span></AnatomySpecimen><AnatomyPin other="Chip" /></View> } } as SectionDef<string>;
  const view = await mountPage(withSpecimen, 1100);
  const specimen = view.q('anatomy-specimen') as HTMLElement;
  assert.ok(specimen, 'expected the anatomy specimen box');
  assert.equal(specimen.style.width, '402px', 'the specimen box is exactly the preview width');
  // SpecimenContent (non-fill) is a centring row: its justify-content class is the variant cells' one.
  const content = specimen.firstElementChild as HTMLElement;
  const centred = content.style.justifyContent === 'center';
  assert.ok(centred, `its content is centred like a variant cell (got ${content.style.justifyContent || content.className})`);
  view.cleanup();
});

test('AnatomySpecimen outside an anatomy with a preview width adds no width', async () => {
  const view = await mountPage({ ...page(), anatomy: { ...page().anatomy!, picture: <AnatomySpecimen><span>chip</span></AnatomySpecimen> } } as SectionDef<string>, 700);
  assert.equal((view.q('anatomy-specimen') as HTMLElement).style.width, '');
  view.cleanup();
});

test('AnatomySpecimen pins ride on the specimen\'s own right edge, in a gutter-wide column', async () => {
  const def = page([402]);
  const picture = <AnatomySpecimen pins={<AnatomyPin other="Chip" />}><span>chip</span></AnatomySpecimen>;
  const view = await mountPage({ ...def, anatomy: { ...def.anatomy!, picture } } as SectionDef<string>, 1100);
  const layer = view.q('anatomy-pin-layer') as HTMLElement;
  assert.ok(layer, 'expected the pin column');
  assert.ok((layer.textContent || '').includes('↗'), 'the pin renders inside the column (no page resolves here, so it is the bare ↗ pin)');
  const classes = layer.className.split(/\s+/);
  // Exactly the physical `left: 100%` (the frame's margin is the physical padding on the same side).
  assert.equal(cssOf(layer, 'left'), '100%', `the column is placed from the specimen's left edge, got ${classes.join(' ')}`);
  assert.ok(classes.some((c) => c.startsWith('r-position-')), 'the column is absolutely positioned');
  // The column and the specimen share one wrapper, so it follows the specimen, not the frame.
  assert.equal(layer.parentElement!.firstElementChild!.textContent, 'chip');
  view.cleanup();
});

test('AnatomySpecimen without pins renders its children directly, as before', async () => {
  const def = page([402]);
  const view = await mountPage({ ...def, anatomy: { ...def.anatomy!, picture: <AnatomySpecimen><span>chip</span></AnatomySpecimen> } } as SectionDef<string>, 1100);
  assert.equal(view.q('anatomy-pin-layer'), null);
  view.cleanup();
});
