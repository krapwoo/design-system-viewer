import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderCatalog } from '../../../test/renderCatalog.tsx';
import { FamilyPage } from '../FamilyPage.tsx';

// A family whose legend has one numbered row and one row with no number at all: `Related` sits
// outside every `inWhole` section, so `numberFor` gives it no number and its legend row must
// render with no pin slot reserved. This is the shape `APPROVED.md` line 21 describes.
//
// `FamilyPage` takes `def: SectionDef`, not `family`/`resolvesAddress` directly — it reads
// `def.family!` and computes `resolvesAddress` itself from `knownAddressIds` plus the family's own
// member ids (see `FamilyPage`'s body in `FamilyPage.tsx`). The plan this test came from assumed
// `family` and `resolvesAddress` were props; they aren't, so the fixture wraps `family` inside
// `def` and callers that need a resolvable name outside the family pass `knownAddressIds` instead.
function familyWithPinlessLegendRow() {
  return {
    id: 'Whole',
    description: 'The whole thing.',
    path: 'Whole.tsx',
    family: {
      whole: 'Whole',
      members: [
        { id: 'Whole', source: 'Whole.tsx', fidelity: 'replicated' as const, relationship: 'Whole', description: 'The whole.' },
        { id: 'Part', source: 'Part.tsx', fidelity: 'replicated' as const, relationship: 'Part', parent: 'Whole', description: 'A part.' },
        { id: 'Related', source: 'Related.tsx', fidelity: 'replicated' as const, relationship: 'Related', description: 'Merely related.' },
      ],
      sections: [
        { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Part'] },
        { label: 'Related', kind: 'blocks' as const, inWhole: false, members: ['Related'] },
      ],
      outline: new Map([['Part', { number: '1', level: 0 }]]),
      anatomy: {
        picture: React.createElement('div', null, 'picture'),
        groups: [
          { label: 'In this picture', items: [{ member: 'Part', description: 'The numbered part.' }] },
          { label: 'No number of their own', items: [{ member: 'Related', description: 'The pinless row.' }] },
        ],
      },
    },
  };
}

test('a legend row with no pin reserves no pin slot, while a numbered row does', () => {
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def: familyWithPinlessLegendRow() } as never),
  );

  const rowOf = (name: string) => {
    const label = [...container.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && (e.textContent || '').trim() === name,
    );
    assert.ok(label, `expected a legend row named ${name}`);
    return label!.closest('div')!.parentElement!;
  };

  // The pin slot is a fixed-width element that exists only to hold a pin. The numbered row has one;
  // the pinless row must not, or its name renders under blank space (APPROVED.md lines 12 and 21).
  const numberedSlots = rowOf('Part').querySelectorAll('[data-testid="legend-pin-slot"]');
  const pinlessSlots = rowOf('Related').querySelectorAll('[data-testid="legend-pin-slot"]');
  assert.equal(numberedSlots.length, 1, 'a numbered legend row keeps its pin slot');
  assert.equal(pinlessSlots.length, 0, 'a legend row with no pin must reserve no slot at all');

  cleanup();
});

test('relatedPages renders a resolvable entry as a link and an unresolvable one as plain text', () => {
  const def = familyWithPinlessLegendRow();
  def.family.relatedPages = [
    { page: 'RealPage', note: 'Why you would go there.' },
    { page: 'GonePage' },
  ];
  // `resolvesAddress` is computed inside `FamilyPage` from `knownAddressIds` plus the family's own
  // member ids (see `FamilyPage`'s body) — there is no `resolvesAddress` prop to pass directly.
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['RealPage']) } as never),
  );

  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#RealPage'), 'a resolvable entry must render as a real link');
  assert.ok(!links.includes('#GonePage'), 'an unresolvable entry must never render as a link');
  assert.ok((container.textContent || '').includes('GonePage'), 'but its name must still be readable as plain text');
  assert.ok((container.textContent || '').includes('Why you would go there.'), 'a note must render when present');

  cleanup();
});

test('a family with no relatedPages and no Related sections renders no Related heading at all', () => {
  const def = familyWithPinlessLegendRow();
  def.family.sections = [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Part'] }];
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def } as never));
  const headings = [...container.querySelectorAll('h2')].map((h) => (h.textContent || '').trim());
  assert.ok(!headings.includes('Related'), 'an empty Related group must render nothing, not an empty heading');
  cleanup();
});

// Derived "Also used by" line: every fixture member above omits `alsoUsedBy` entirely, so none of
// the earlier tests exercise it — these do, reverting the line's own rendering in
// `BelowSpecimensLine` (FamilyPage.tsx) breaks all three.
test('alsoUsedBy renders in the member block, linking a resolvable user and showing its role', () => {
  const def = familyWithPinlessLegendRow();
  def.family.members = def.family.members.map((m) => (m.id === 'Part' ? { ...m, alsoUsedBy: [{ component: 'Dock', role: 'Header icon' }] } : m));
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['Dock']) } as never),
  );
  assert.ok((container.textContent || '').includes('Also used by Dock (Header icon)'), container.textContent || '');
  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#Dock'), 'a resolvable user must render as a real link');
  cleanup();
});

// Important finding 1: `buildCatalogSections` derives `alsoUsedBy` for the whole exactly like any
// other member, but `FamilyPage` renders the whole through its own `WholeBelowLine`, which used to
// take only `name`/`fidelity`/`source` and silently drop the derived value. This pins that the
// whole's line renders too — reverting `WholeBelowLine` back to its three-prop shape breaks it.
test('alsoUsedBy renders on the whole too, not only on parts and related members', () => {
  const def = familyWithPinlessLegendRow();
  def.family.members = def.family.members.map((m) =>
    m.id === 'Whole' ? { ...m, alsoUsedBy: [{ component: 'Dock', role: 'Header icon' }] } : m,
  );
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['Dock']) } as never),
  );
  assert.ok((container.textContent || '').includes('Also used by Dock (Header icon)'), container.textContent || '');
  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#Dock'), 'a resolvable user must render as a real link on the whole too');
  cleanup();
});

test('alsoUsedBy renders an unresolvable user as plain text, never a dead link', () => {
  const def = familyWithPinlessLegendRow();
  def.family.members = def.family.members.map((m) => (m.id === 'Part' ? { ...m, alsoUsedBy: [{ component: 'Ghost' }] } : m));
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def } as never));
  assert.ok((container.textContent || '').includes('Also used by Ghost'), container.textContent || '');
  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(!links.includes('#Ghost'), 'an unresolvable user must never render as a link');
  cleanup();
});

// Regression test for making `alsoUsedBy` optional: a hand-built family (a demo, a fixture) that
// omits the field entirely — every member above does — must still render no "Also used by" line,
// the same as an explicit `[]` would.
test('a hand-built family omitting alsoUsedBy renders no "Also used by" line', () => {
  const def = familyWithPinlessLegendRow();
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def } as never));
  assert.ok(!(container.textContent || '').includes('Also used by'));
  cleanup();
});
