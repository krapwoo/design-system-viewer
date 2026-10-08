import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initExistingProject } from '../init.ts';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');

function copyFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-init-'));
  cpSync(FIXTURE_ROOT, dir, { recursive: true });
  return dir;
}

test('initExistingProject writes the config, missing drafts, the script, the devDependency, and .gitignore', async () => {
  const projectRoot = copyFixture();
  unlinkSync(path.join(projectRoot, 'ds-viewer.config.ts'));
  unlinkSync(path.join(projectRoot, 'src/components/Button/Button.catalog.tsx'));

  const result = await initExistingProject(projectRoot, { yes: true });

  const configPath = path.join(projectRoot, 'ds-viewer.config.ts');
  const badgeDraft = path.join(projectRoot, 'src/components/Badge/Badge.catalog.tsx');
  const buttonDraft = path.join(projectRoot, 'src/components/Button/Button.catalog.tsx');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const gitignorePath = path.join(projectRoot, '.gitignore');

  assert.deepEqual(result.written, [configPath, badgeDraft, buttonDraft, packageJsonPath, gitignorePath]);
  // Both catalog pages are missing *before* this run writes anything (Button's was just deleted
  // above; Badge never had one) — the coverage line counts pre-existing pages, not this run's
  // own writes, so it reads "0 with examples" even though both now have a draft.
  assert.ok(result.messages.includes('2 components · 0 with catalog pages'));
  assert.ok(result.messages.includes('Next: npm install, then npm run ds-viewer dev'));

  assert.match(readFileSync(configPath, 'utf8'), /components: \["src\/components\/\*\/index\.ts"\]/);
  assert.match(readFileSync(badgeDraft, 'utf8'), /Needs examples — fill in variants and states for Badge\./);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  assert.deepEqual(packageJson.scripts, { 'ds-viewer': 'ds-viewer' });
  assert.match(packageJson.devDependencies['@krapwoo/ds-viewer'], /^\^\d+\.\d+\.\d+$/);
  assert.equal(readFileSync(gitignorePath, 'utf8'), '.ds-viewer/\n');

  rmSync(projectRoot, { recursive: true, force: true });
});

test('initExistingProject counts components that already have a catalog page as "with catalog pages"', async () => {
  const projectRoot = copyFixture();
  // The fixture's Button already ships Button.catalog.tsx (Task 9) — Badge has none.
  const result = await initExistingProject(projectRoot, { yes: true });
  assert.ok(result.messages.includes('2 components · 1 with catalog pages'));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initExistingProject writes nothing on a second --yes run (idempotence)', async () => {
  const projectRoot = copyFixture();
  const first = await initExistingProject(projectRoot, { yes: true });
  assert.ok(first.written.length > 0);
  const second = await initExistingProject(projectRoot, { yes: true });
  assert.deepEqual(second.written, []);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initExistingProject treats a CRLF .gitignore\'s existing entry as already present', async () => {
  const projectRoot = copyFixture();
  writeFileSync(path.join(projectRoot, '.gitignore'), 'node_modules/\r\n.ds-viewer/\r\n');
  const result = await initExistingProject(projectRoot, { yes: true });
  const gitignorePath = path.join(projectRoot, '.gitignore');
  assert.ok(!result.written.includes(gitignorePath));
  assert.equal(readFileSync(gitignorePath, 'utf8'), 'node_modules/\r\n.ds-viewer/\r\n');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initExistingProject exits with an error when stdin is non-interactive and --yes was not passed', async () => {
  const projectRoot = copyFixture();
  const result = await initExistingProject(projectRoot, {});
  assert.deepEqual(result.written, []);
  assert.equal(result.exitCode, 1);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initExistingProject warns when a component folder is inside an Expo Router "app/" directory', async () => {
  const projectRoot = copyFixture();
  mkdirSync(path.join(projectRoot, 'app/Widget'), { recursive: true });
  writeFileSync(path.join(projectRoot, 'app/Widget/Widget.tsx'), 'export function Widget() { return null; }\n');
  writeFileSync(path.join(projectRoot, 'app/Widget/index.ts'), "export { Widget } from './Widget';\n");

  const result = await initExistingProject(projectRoot, { yes: true });
  assert.ok(
    result.messages.includes('Warning: app/Widget is inside an Expo Router "app/" directory; its .catalog.tsx file will become a route.'),
  );

  rmSync(projectRoot, { recursive: true, force: true });
});

test('initExistingProject stops and writes nothing when a required package is missing', async () => {
  const projectRoot = copyFixture();
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  delete packageJson.dependencies['react-dom'];
  writeFileSync(packageJsonPath, JSON.stringify(packageJson));

  const result = await initExistingProject(projectRoot, { yes: true });
  assert.deepEqual(result.written, []);
  assert.ok(result.messages.some((message) => message.startsWith('Missing react-dom.')));

  rmSync(projectRoot, { recursive: true, force: true });
});

test('initExistingProject emits both *.ts and *.tsx index globs when a detected folder uses index.tsx', async () => {
  const projectRoot = copyFixture();
  unlinkSync(path.join(projectRoot, 'ds-viewer.config.ts'));
  mkdirSync(path.join(projectRoot, 'src/components/Toast'), { recursive: true });
  writeFileSync(path.join(projectRoot, 'src/components/Toast/Toast.tsx'), 'export function Toast() { return null; }\n');
  writeFileSync(path.join(projectRoot, 'src/components/Toast/index.tsx'), "export { Toast } from './Toast';\n");

  const result = await initExistingProject(projectRoot, { yes: true });
  const configPath = path.join(projectRoot, 'ds-viewer.config.ts');
  assert.ok(result.written.includes(configPath));
  const configContents = readFileSync(configPath, 'utf8');
  assert.match(configContents, /"src\/components\/\*\/index\.ts"/);
  assert.match(configContents, /"src\/components\/\*\/index\.tsx"/);

  rmSync(projectRoot, { recursive: true, force: true });
});

test('initExistingProject asks for confirmation and writes nothing when declined', async () => {
  const projectRoot = copyFixture();
  const result = await initExistingProject(projectRoot, { confirm: () => false });
  assert.deepEqual(result.written, []);
  assert.ok(result.messages.includes('Aborted: no files written.'));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initExistingProject proceeds when the injected confirmation answers yes', async () => {
  const projectRoot = copyFixture();
  unlinkSync(path.join(projectRoot, 'ds-viewer.config.ts'));
  let promptedWith = '';
  const result = await initExistingProject(projectRoot, {
    confirm: (message) => {
      promptedWith = message;
      return true;
    },
  });
  assert.match(promptedWith, /Badge/);
  assert.ok(result.written.length > 0);
  rmSync(projectRoot, { recursive: true, force: true });
});
