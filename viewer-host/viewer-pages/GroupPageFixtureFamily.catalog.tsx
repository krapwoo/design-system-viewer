import { defineCatalogPage } from '@krapwoo/ds-viewer';

// #63 R5: a tiny, made-up family whose own `inWhole` section lists an id defined on the
// `GroupPage` demo page instead of its own `members` — `FixtureExternalPart` there, whose own
// `parent` equals this family's whole (`GroupPageFixtureFamily`), exactly as A5 requires. This
// page exists only to give that external part a real family to point back to; see
// `GroupPage.catalog.tsx`'s own `FixtureExternalPart` member for the other half of the link.
export default defineCatalogPage({
  id: 'GroupPageFixtureFamily',
  group: 'Components',
  title: 'Group page fixture family',
  description: 'A made-up family, just to show an external part (defined on GroupPage, the group page demo) linking back here — swap for your own members/whole/sections.',
  source: 'your/components/GroupPageFixtureFamily.tsx',
  standalone: 'A test fixture with no specimens by design: the GroupPage demo needs a real family for its external part to link back to.',
  whole: 'GroupPageFixtureFamily',
  sections: [
    { label: 'Parts', kind: 'blocks', inWhole: true, members: ['FixtureOwnPart', 'FixtureExternalPart'] },
  ],
  members: [
    {
      id: 'GroupPageFixtureFamily', source: 'GroupPageFixtureFamily.tsx:1', fidelity: 'documentation-only',
      relationship: 'Whole', description: 'The whole fixture family — swap for a real view and its own parts.',
    },
    {
      id: 'FixtureOwnPart', source: 'GroupPageFixtureFamily.tsx:10', fidelity: 'documentation-only',
      relationship: 'Part', parent: 'GroupPageFixtureFamily', description: 'An ordinary part, defined on this page like any other.',
    },
  ],
});
