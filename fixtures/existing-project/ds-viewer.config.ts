import { defineConfig } from '@krapwoo/ds-viewer/config';

export default defineConfig({
  name: 'Fixture App',
  components: ['src/components/*/index.ts'],
  tokens: ['src/tokens/index.ts'],
  pages: ['src/pages/*.catalog.tsx'],
  groupOrder: ['Components', 'Tokens'],
});
