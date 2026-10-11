import { defineConfig } from '@krapwoo/ds-viewer/config';

export default defineConfig({
  name: 'Design System Starter Kit',
  logo: './assets/logo.png',
  components: ['../starter-kit/components/*/index.ts'],
  tokens: ['../starter-kit/tokens/index.ts'],
  pages: ['../starter-kit/pages/*.catalog.tsx'],
  groupOrder: ['Tokens', 'Components', 'Patterns', 'Reference'],
  updateCheck: false,
});
