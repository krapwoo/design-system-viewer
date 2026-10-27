import { defineConfig } from '@krapwoo/ds-viewer/config';

// DS Viewer's own building blocks (CatalogShell, SectionBlock, UpdatePanel, the catalog's own
// colours/spacing/type…), documented for people working on ds-viewer itself. Kept out of the
// starter-kit catalog (kit-host), which shows only what a project using the kit gets.
// Run with `npm run viewer:dev`; CI checks it with the starter kit.
export default defineConfig({
  name: 'DS Viewer internals',
  logo: './assets/logo.png',
  components: ['../native/catalog/*.tsx'],
  tokens: ['../native/catalog/tokens.ts'],
  pages: ['viewer-pages/*.catalog.tsx'],
  groupOrder: ['Tokens', 'Components'],
  // Fixture usage data (invented, see the `_fixture` note inside), so this catalog shows its own
  // Overview page and "Appears in" blocks. Every key names a real page here.
  usage: 'usage.fixture.json',
  updateCheck: false,
});
