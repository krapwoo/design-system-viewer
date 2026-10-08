import { defineConfig } from '@krapwoo/ds-viewer/config';

export default defineConfig({
  name: 'Design System Starter Kit',
  logo: './assets/logo.png',
  components: ['../starter-kit/components/*/index.ts'],
  tokens: ['../starter-kit/tokens/index.ts'],
  pages: ['../starter-kit/pages/*.catalog.tsx', 'viewer-pages/*.catalog.tsx'],
  groupOrder: [
    'Actions', 'Surfaces', 'Inputs', 'Controls', 'Selection', 'Feedback', 'Navigation',
    'Overlays', 'Layout', 'Sub-Parts', 'Recipes', 'Tokens', 'Reference', 'Viewer',
  ],
  updateCheck: false,
});
