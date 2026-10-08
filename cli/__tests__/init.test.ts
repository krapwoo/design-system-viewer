import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { copyKitIfMissing, initExistingProject, initNewProject } from '../init.ts';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');
const NEW_PROJECT_FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/new-project');

function copyFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-init-'));
  cpSync(FIXTURE_ROOT, dir, { recursive: true });
  return dir;
}

function copyNewProjectFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-new-project-'));
  cpSync(NEW_PROJECT_FIXTURE_ROOT, dir, { recursive: true });
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
  const agentsPath = path.join(projectRoot, 'AGENTS.md');
  const workflowPath = path.join(projectRoot, '.github', 'workflows', 'ds-viewer.yml');

  assert.deepEqual(result.written, [configPath, badgeDraft, buttonDraft, packageJsonPath, gitignorePath, agentsPath, workflowPath]);
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

test('initNewProject installs missing kit packages via the injected installer, copies the real starter kit, and writes config/script/gitignore', async () => {
  const projectRoot = copyNewProjectFixture();
  const installed: string[] = [];
  const result = await initNewProject(projectRoot, {
    installer: (_root, missing) => {
      installed.push(...missing);
    },
  });
  assert.deepEqual(installed.sort(), ['react-native-safe-area-context', 'react-native-svg']);
  assert.ok(existsSync(path.join(projectRoot, 'src/ds/components/Button/index.ts')));
  assert.ok(existsSync(path.join(projectRoot, 'src/ds/tokens/index.ts')));
  assert.ok(existsSync(path.join(projectRoot, 'src/ds/icons/index.ts')));
  assert.ok(existsSync(path.join(projectRoot, 'src/ds/WHEN_TO_USE.md')));
  assert.ok(existsSync(path.join(projectRoot, 'src/ds/components/Button/Button.catalog.tsx')));
  assert.ok(existsSync(path.join(projectRoot, 'src/ds/pages/Colors.catalog.tsx')));
  const config = readFileSync(path.join(projectRoot, 'ds-viewer.config.ts'), 'utf8');
  assert.match(config, /components: \['src\/ds\/components\/\*\/index\.ts'\]/);
  assert.match(config, /pages: \['src\/ds\/pages\/\*\.catalog\.tsx'\]/);
  assert.match(config, /starterKit: \{ version: '\d+\.\d+\.\d+', root: 'src\/ds' \}/);
  const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['ds-viewer'], 'ds-viewer');
  assert.match(packageJson.devDependencies['@krapwoo/ds-viewer'], /^\^\d+\.\d+\.\d+$/);
  assert.equal(readFileSync(path.join(projectRoot, '.gitignore'), 'utf8'), '.ds-viewer/\n');
  assert.ok(result.written.some((f) => f.endsWith('AGENTS.md')));
  assert.equal(readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8').includes('<!-- ds-viewer:start v1 -->'), true);
  assert.ok(result.written.some((f) => f.endsWith(path.join('.github', 'workflows', 'ds-viewer.yml'))));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initNewProject writes the kit\'s own sidebar groupOrder, instead of leaving the sidebar alphabetical', async () => {
  // Controller end-to-end finding E3: a fresh project's sidebar fell back to alphabetical order
  // (Actions, Controls, Feedback, Inputs, …) because `init --new` wrote no `groupOrder` at all,
  // losing the kit's intended order (as kit-host's own config declares, minus the "Viewer" group
  // that only applies to kit-host's own framework-docs pages, which `init --new` never copies).
  const projectRoot = copyNewProjectFixture();
  await initNewProject(projectRoot, { installer: () => {} });
  const config = readFileSync(path.join(projectRoot, 'ds-viewer.config.ts'), 'utf8');
  const groupOrderSection = config.match(/groupOrder: \[([\s\S]*?)\]/)?.[1] ?? '';
  const groups = [...groupOrderSection.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(groups, [
    'Actions', 'Surfaces', 'Inputs', 'Controls', 'Selection', 'Feedback', 'Navigation',
    'Overlays', 'Layout', 'Sub-Parts', 'Recipes', 'Tokens', 'Reference',
  ]);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initNewProject copies the kit into a custom --kit-root', async () => {
  const projectRoot = copyNewProjectFixture();
  await initNewProject(projectRoot, { kitRoot: 'design', installer: () => {} });
  assert.ok(existsSync(path.join(projectRoot, 'design/components/Button/index.ts')));
  assert.ok(!existsSync(path.join(projectRoot, 'src/ds')));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initNewProject never overwrites a kit file the user already edited, on rerun', async () => {
  const projectRoot = copyNewProjectFixture();
  await initNewProject(projectRoot, { installer: () => {} });
  const buttonPath = path.join(projectRoot, 'src/ds/components/Button/Button.tsx');
  writeFileSync(buttonPath, '// user-edited\n');
  const second = await initNewProject(projectRoot, { installer: () => {} });
  assert.ok(!second.written.includes(buttonPath));
  assert.equal(readFileSync(buttonPath, 'utf8'), '// user-edited\n');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initNewProject reports nothing copied on a second run, instead of repeating "Copied the starter kit"', async () => {
  // Controller end-to-end finding E2: a second `init --new` printed "Copied the starter kit into
  // src/ds/." even though every kit file already existed and `copyKitIfMissing` wrote nothing.
  const projectRoot = copyNewProjectFixture();
  const first = await initNewProject(projectRoot, { installer: () => {} });
  assert.ok(first.messages.includes('Copied the starter kit into src/ds/.'));
  const second = await initNewProject(projectRoot, { installer: () => {} });
  assert.ok(!second.messages.some((message) => message.includes('Copied the starter kit')));
  assert.ok(second.messages.includes('Starter kit already present in src/ds/ — nothing copied.'));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('initNewProject stops and installs/writes nothing when a required package is missing', async () => {
  const projectRoot = copyNewProjectFixture();
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  delete packageJson.dependencies['react-dom'];
  writeFileSync(packageJsonPath, JSON.stringify(packageJson));
  let installerCalled = false;
  const result = await initNewProject(projectRoot, { installer: () => { installerCalled = true; } });
  assert.equal(installerCalled, false);
  assert.deepEqual(result.written, []);
  assert.equal(result.exitCode, 1);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('copyKitIfMissing reports the files it already wrote instead of throwing when a nested folder is unreadable', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-copy-unreadable-'));
  const srcDir = path.join(projectRoot, 'src');
  const destDir = path.join(projectRoot, 'dest');
  mkdirSync(path.join(srcDir, 'locked'), { recursive: true });
  writeFileSync(path.join(srcDir, 'readable.txt'), 'ok\n');
  writeFileSync(path.join(srcDir, 'locked', 'secret.txt'), 'nope\n');
  chmodSync(path.join(srcDir, 'locked'), 0o000);

  let written: string[] = [];
  try {
    assert.doesNotThrow(() => {
      written = copyKitIfMissing(srcDir, destDir);
    });
  } finally {
    chmodSync(path.join(srcDir, 'locked'), 0o755);
  }
  assert.ok(written.includes(path.join(destDir, 'readable.txt')), 'the readable file copied before the unreadable folder should still be reported');
  assert.ok(existsSync(path.join(destDir, 'readable.txt')));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('copyKitIfMissing skips a symlinked entry rather than copying through it', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-copy-symlink-'));
  const srcDir = path.join(projectRoot, 'src');
  const destDir = path.join(projectRoot, 'dest');
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(path.join(srcDir, 'real.txt'), 'ok\n');
  symlinkSync(path.join(srcDir, 'real.txt'), path.join(srcDir, 'link.txt'));

  const written = copyKitIfMissing(srcDir, destDir);
  assert.ok(!written.includes(path.join(destDir, 'link.txt')));
  assert.ok(!existsSync(path.join(destDir, 'link.txt')));
  assert.ok(existsSync(path.join(destDir, 'real.txt')));
  rmSync(projectRoot, { recursive: true, force: true });
});
