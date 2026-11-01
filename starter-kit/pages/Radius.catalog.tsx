import { defineCatalogPage, type TokenEntry } from '@krapwoo/ds-viewer';
import { DS_RADIUS, DS_RADIUS_STEPS, DS_RADIUS_USE } from '../tokens';

// Where DS_RADIUS is declared, for each tile's "Details ›" panel: a path from the kit's root (the
// folder `init` copies it into), with no line number, which would drift the day scales.ts changes.
const RADIUS_SOURCE = 'tokens/scales.ts';

// One entry per step of DS_RADIUS, read from the kit's own token source: the value is DS_RADIUS[step],
// never retyped here. `provenance: 'named'` because these are real exported tokens, so the page makes
// no "no tokens yet" claim. The tile shows the step, its value and a corner drawn from that value;
// "Details ›" holds the source, the expression and the "when to use this" note from DS_RADIUS_USE.
const radiusEntries: TokenEntry[] = DS_RADIUS_STEPS.map((step) => ({
  id: step,
  name: step,
  kind: 'radius',
  source: RADIUS_SOURCE,
  expression: `DS_RADIUS.${step}`,
  role: DS_RADIUS_USE[step],
  value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: DS_RADIUS[step], unit: 'px' } } },
}));

export default defineCatalogPage({
  group: 'Tokens',
  description: 'The corner-radius scale, each step with its value and a Details › panel holding its source and the "when to use this" note from DS_RADIUS_USE. Reference steps directly — DS_RADIUS.medium, never a raw 12 — the key union is typo-safe by itself.',
  tokenDefinition: {
    kind: 'radius',
    sections: [{ id: 'scale', title: 'Corner radius scale', entries: radiusEntries }],
  },
});
