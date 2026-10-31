// Mounted check of `CatalogMember.title`: a titled member is named by its title in its heading, the
// anatomy legend and the links that point at it, while its code line keeps the id. Same warm-up as
// `familyPageRender.test.tsx` (react-dom / react-native-web decide `canUseDOM` at first import).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { FamilyPage } = await import('../FamilyPage.tsx');

function titledFamily() {
  return {
    id: 'Whole',
    description: 'The whole thing.',
    path: 'Whole.tsx',
    family: {
      whole: 'Whole',
      members: [
        { id: 'Whole', source: 'Whole.tsx:1', fidelity: 'replicated' as const, relationship: 'Whole', description: 'The whole.' },
        { id: 'BotAvatarView', title: 'Bot avatar', component: 'Avatar', source: 'Bot.tsx:7', fidelity: 'replicated' as const, relationship: 'Part', parent: 'Whole', description: 'The avatar.', alsoUsedBy: [{ component: 'PlainSheet' }] },
        { id: 'PlainSheet', source: 'Sheet.tsx:3', fidelity: 'replicated' as const, relationship: 'Part', parent: 'Whole', description: 'Untitled.', related: 'Wraps BotAvatarView', alsoUsedBy: [{ component: 'BotAvatarView' }] },
      ],
      sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['BotAvatarView', 'PlainSheet'] }],
      outline: new Map([['BotAvatarView', { number: '1', level: 0 }], ['PlainSheet', { number: '2', level: 0 }]]),
      anatomy: {
        picture: React.createElement('div', null, 'picture'),
        groups: [{ label: 'In this picture', items: [{ member: 'BotAvatarView', description: 'Shows who is talking.' }] }],
      },
    },
  };
}

const headings = (container: HTMLElement) => [...container.querySelectorAll('[role="heading"]')].map((h) => (h.textContent || '').trim());
const links = (container: HTMLElement) => [...container.querySelectorAll('a')].map((a) => (a.textContent || '').trim());

test('a titled member is headed by its title; an untitled one by its id', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: titledFamily() } as never));
  const names = headings(container);
  assert.ok(names.some((name) => name.startsWith('Bot avatar')), `headings: ${names.join(' | ')}`);
  assert.ok(!names.some((name) => name.startsWith('BotAvatarView')), 'the id is not the heading');
  assert.ok(names.some((name) => name.startsWith('PlainSheet')));
  cleanup();
});

test('the code line of a titled member still names its id and component', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: titledFamily() } as never));
  const text = container.textContent || '';
  assert.ok(text.includes('BotAvatarView · Avatar · Bot.tsx:7'), 'titled member: id, component, then source');
  assert.ok(text.includes('Sheet.tsx:3') && !text.includes('PlainSheet · Sheet.tsx:3'), 'an untitled member\'s code line is unchanged');
  cleanup();
});

test('the anatomy legend, related text and Also used by name a titled member by its title', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: titledFamily() } as never));
  const names = links(container);
  assert.ok(names.filter((name) => name === 'Bot avatar').length >= 3, `links: ${names.join(' | ')}`);
  assert.ok(!names.includes('BotAvatarView'), 'no link is labelled with the id');
  // Untitled members keep their id as the label.
  assert.ok(names.includes('PlainSheet'));
  cleanup();
});

test('MemberTitlesProvider leaves the family whole out: the whole is named by its page title', async () => {
  const { MemberTitlesProvider, useMemberTitle } = await import('../memberTitlesContext.ts');
  function Name({ id }: { id: string }) {
    const titleOf = useMemberTitle();
    return React.createElement('span', null, titleOf(id));
  }
  const members = [{ id: 'Whole', title: 'Ignored' }, { id: 'Part', title: 'Part title' }];
  const { container, cleanup } = renderCatalog(
    React.createElement(MemberTitlesProvider, { members, whole: 'Whole' }, React.createElement(Name, { id: 'Whole' }), React.createElement(Name, { id: 'Part' })),
  );
  assert.deepEqual([...container.querySelectorAll('span')].map((s) => s.textContent), ['Whole', 'Part title']);
  cleanup();
});

test('MemberTitlesProvider names a member\'s component by its title, by the same rule as memberTitleMap', async () => {
  const { MemberTitlesProvider, useMemberTitle } = await import('../memberTitlesContext.ts');
  function Name({ id }: { id: string }) {
    const titleOf = useMemberTitle();
    return React.createElement('span', null, titleOf(id));
  }
  const members = [
    { id: 'A', title: 'Alpha', component: 'AView' },
    { id: 'B', title: 'Bee', component: 'Other' },
    { id: 'Other', title: 'Other title' },
    { id: 'C', title: 'Cee', component: 'Shared' },
    { id: 'D', title: 'Dee', component: 'Shared' },
    { id: 'E', title: 'Eee', component: 'ThePage' },
  ];
  const ids = ['AView', 'Other', 'Shared', 'ThePage'];
  const { container, cleanup } = renderCatalog(
    React.createElement(MemberTitlesProvider, { members, pageId: 'ThePage' }, ...ids.map((id) => React.createElement(Name, { id, key: id }))),
  );
  assert.deepEqual([...container.querySelectorAll('span')].map((s) => s.textContent), ['Alpha', 'Other title', 'Shared', 'ThePage']);
  cleanup();
});

test('under the shell, MemberTitlesProvider keeps the catalog-wide decision for a component that is another page', async () => {
  const { MemberTitlesContext, MemberTitlesProvider, useMemberTitle } = await import('../memberTitlesContext.ts');
  const { memberTitleMap } = await import('../familyModel.ts');
  function Name({ id }: { id: string }) {
    const titleOf = useMemberTitle();
    return React.createElement('span', null, titleOf(id));
  }
  // `action` is drawn by `Button`, which is also a page: the catalog-wide map leaves `Button` alone.
  const members = [{ id: 'action', title: 'Action button', component: 'Button' }];
  const pages = [{ id: 'Card', family: { members } }, { id: 'Button' }];
  const outer = memberTitleMap(pages as never);
  assert.equal(outer.get('Button'), undefined, 'precondition: the shell map skips a page name');
  const { container, cleanup } = renderCatalog(
    React.createElement(MemberTitlesContext.Provider, { value: outer },
      React.createElement(MemberTitlesProvider, { members, pageId: 'Card' }, React.createElement(Name, { id: 'Button' }), React.createElement(Name, { id: 'action' }))),
  );
  assert.deepEqual([...container.querySelectorAll('span')].map((s) => s.textContent), ['Button', 'Action button']);
  cleanup();
});
