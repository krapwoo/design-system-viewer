import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discoverAllPageFiles, discoverPages, resolvePageId, writePageIndex } from '../pageIndex.ts';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');

test('discoverPages finds a component\'s catalog page and every standalone page, sorted', () => {
  const found = discoverPages({
    projectRoot: FIXTURE_ROOT,
    components: [
      { name: 'Button', entryFile: path.join(FIXTURE_ROOT, 'src/components/Button/index.ts') },
      { name: 'Badge', entryFile: path.join(FIXTURE_ROOT, 'src/components/Badge/index.ts') },
    ],
    standalonePageGlobs: ['src/pages/*.catalog.tsx'],
  });
  assert.deepEqual(found, [
    path.join(FIXTURE_ROOT, 'src/components/Button/Button.catalog.tsx'),
    path.join(FIXTURE_ROOT, 'src/pages/Overview.catalog.tsx'),
  ]);
});

test('writePageIndex writes one import per page, resolving each one\'s id from component/stem, in order', () => {
  const generatedDir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-pageindex-'));
  mkdirSync(generatedDir, { recursive: true });
  const pageFiles = [
    path.join(FIXTURE_ROOT, 'src/components/Button/Button.catalog.tsx'),
    path.join(FIXTURE_ROOT, 'src/pages/Overview.catalog.tsx'),
  ];
  const outFile = writePageIndex(generatedDir, pageFiles);
  assert.equal(outFile, path.join(generatedDir, 'pages.ts'));
  const content = readFileSync(outFile, 'utf8');
  const expectedImport0 = path.relative(generatedDir, pageFiles[0].replace(/\.tsx$/, '')).split(path.sep).join('/');
  const expectedImport1 = path.relative(generatedDir, pageFiles[1].replace(/\.tsx$/, '')).split(path.sep).join('/');
  const expectedFile0 = path.relative(process.cwd(), pageFiles[0]);
  const expectedFile1 = path.relative(process.cwd(), pageFiles[1]);
  assert.equal(
    content,
    `import page0 from '${expectedImport0.startsWith('.') ? expectedImport0 : `./${expectedImport0}`}';\n` +
      `import page1 from '${expectedImport1.startsWith('.') ? expectedImport1 : `./${expectedImport1}`}';\n\n` +
      `const resolved0 = { ...page0, id: page0.id ?? page0.component ?? "Button", file: ${JSON.stringify(expectedFile0)} };\n` +
      `const resolved1 = { ...page1, id: page1.id ?? page1.component ?? "Overview", file: ${JSON.stringify(expectedFile1)} };\n\n` +
      `export default [resolved0, resolved1];\n`,
  );
  rmSync(generatedDir, { recursive: true, force: true });
});

test('resolvePageId prefers id, then component, then the file\'s own stem', () => {
  assert.equal(resolvePageId({ id: 'Explicit', component: 'Button' }, '/x/Button.catalog.tsx'), 'Explicit');
  assert.equal(resolvePageId({ component: 'Button' }, '/x/Button.catalog.tsx'), 'Button');
  assert.equal(resolvePageId({}, '/x/Colors.catalog.tsx'), 'Colors');
});

test('discoverAllPageFiles finds every *.catalog.tsx in a component folder, even one with no matching current export', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-discoverall-'));
  const folder = path.join(dir, 'Button');
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, 'Button.catalog.tsx'), '');
  writeFileSync(path.join(folder, 'OldName.catalog.tsx'), ''); // the component was renamed; this is the orphan.
  const files = discoverAllPageFiles({ componentFolders: [folder], standalonePageGlobs: [], projectRoot: dir });
  assert.deepEqual(files.map((f) => path.basename(f)).sort(), ['Button.catalog.tsx', 'OldName.catalog.tsx']);
  rmSync(dir, { recursive: true, force: true });
});
