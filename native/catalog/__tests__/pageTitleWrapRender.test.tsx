// Fix T: a long unbroken page title (a component id) must wrap inside its own column and never run
// underneath the ← → pager, on every header that has a pager. jsdom has no layout engine, so this
// asserts the styles that make the browser wrap and keep the pager's space, on the standalone page
// head (`SectionBlock`) and the family/group head (`FamilyPage`/`GroupPage`).
//
// Which assertion catches what: only the family and group `word-break` check fails without the fix
// (those titles were missing `wordBreak`; `SectionBlock`'s already had it). The standalone case, the
// `min-width`/`flex` checks (react-native-web's base View already sets `min-width: 0`) and the
// pager's `flex-shrink: 0` are regression guards — they pass today and pin the rules the wrap
// relies on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

// Same warm-up as familyPageRender.test.tsx: react-native-web caches `canUseDom` at first import.
const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { FamilyPage } = await import('../FamilyPage.tsx');
const { GroupPage } = await import('../GroupPage.tsx');
const { SectionBlock } = await import('../SectionBlock.tsx');
const { StyleSheet } = await import('react-native');

// jsdom doesn't apply react-native-web's injected stylesheet, so read the rules it generated for an
// element's atomic classes directly: property -> value, across every class on the element.
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

const LONG_ID = 'KanbanBoardManagementView';
const pager = { previousId: 'A', nextId: 'B', onNavigate: () => {}, labelOf: (id: string) => id };

function member(id: string, extra: Record<string, unknown> = {}) {
  return { id, source: `${id}.tsx`, fidelity: 'replicated' as const, relationship: id, description: `${id}.`, ...extra };
}

const standalone = { id: LONG_ID, description: 'A page.', path: 'X.tsx' };
const family = {
  id: LONG_ID, description: 'A family.', path: 'X.tsx',
  family: { whole: LONG_ID, members: [member(LONG_ID)], sections: [], outline: new Map() },
};
const group = {
  id: LONG_ID, description: 'A group.', path: 'X.tsx',
  family: { kind: 'group', whole: LONG_ID, members: [member('One')], sections: [], outline: new Map(), topLevel: [{ member: member('One'), parts: [] }] },
};

const cases: Array<[string, () => React.ReactElement]> = [
  ['standalone page', () => React.createElement(SectionBlock as never, { def: standalone, pager } as never)],
  ['family page', () => React.createElement(FamilyPage as never, { def: family, pager } as never)],
  ['group page', () => React.createElement(GroupPage as never, { def: group, pager } as never)],
];

for (const [name, element] of cases) {
  test(`${name}: a long title wraps in its own column and the pager keeps its space`, () => {
    const { container, cleanup } = renderCatalog(element());
    try {
      const heading = container.querySelector('[role="heading"]') as HTMLElement;
      assert.ok(heading, 'expected the page heading');
      const titleText = heading.parentElement as HTMLElement;
      const titlebar = titleText.parentElement as HTMLElement;
      const title = heading.firstElementChild as HTMLElement;
      assert.equal(title.textContent, LONG_ID);
      assert.equal(declared(title)['word-break'], 'break-word', 'an unbroken title must be allowed to break (fails on family/group without the fix)');

      // Guard: the base View already sets this, so it passes without `minWidth: 0` too.
      assert.equal(declared(titleText)['min-width'], '0px', 'the title column can shrink below its content width');
      assert.match(declared(titleText).flex ?? '', /^1\b/, 'the title column takes the leftover space and shrinks with it');

      const pagerEl = titlebar.lastElementChild as HTMLElement;
      assert.notEqual(pagerEl, titleText, 'the pager is a sibling of the title column');
      assert.equal(declared(pagerEl)['flex-shrink'], '0', 'the pager never shrinks, so it keeps its own space');
    } finally { cleanup(); }
  });
}
