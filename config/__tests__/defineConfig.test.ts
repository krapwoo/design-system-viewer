import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineConfig } from '../index.ts';

test('defineConfig returns its argument unchanged', () => {
  const config = { name: 'App', components: ['src/components/*/index.ts'], tokens: ['src/tokens/index.ts'] };
  assert.equal(defineConfig(config), config);
});

test('defineConfig accepts every documented field', () => {
  const config = defineConfig({
    name: 'App',
    logo: './assets/logo.png',
    components: ['src/components/*/index.ts'],
    exclude: ['src/components/_internal/**'],
    tokens: ['src/tokens/index.ts'],
    pages: ['src/pages/*.catalog.tsx'],
    groupOrder: ['Actions', 'Tokens'],
    starterKit: { version: '0.1.0' },
    updateCheck: false,
    doctor: { strict: true },
  });
  assert.equal(config.name, 'App');
  assert.equal(config.doctor?.strict, true);
});
