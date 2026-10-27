import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as ts from 'typescript';
import {
  writeWorkspace, workspacePath, clearDevLock, liveDevLock, writeDevLock, missingWorkspaceFiles, WORKSPACE_DEFINING_FILES,
  readEndpointRecord, writeEndpointRecord,
} from '../workspace.ts';
import { repairWorkspaceIfMissing } from '../dev.ts';
import { DEFAULT_WORKSPACE_DIR, RENDER_WORKSPACE_DIR } from '../types.ts';
import type { ResolvedConfig } from '../types.ts';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');

function copyFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-workspace-'));
  cpSync(FIXTURE_ROOT, dir, { recursive: true });
  return dir;
}

function baseConfig(projectRoot: string): ResolvedConfig {
  return {
    name: 'Fixture App',
    components: ['src/components/*/index.ts'],
    tokens: ['src/tokens/index.ts'],
    updateCheck: true,
    doctor: { strict: false },
    projectRoot,
    configPath: path.join(projectRoot, 'ds-viewer.config.ts'),
  };
}

test('writeWorkspace writes package.json, app.json, tsconfig.json, metro.config.js, and entry.tsx', () => {
  const projectRoot = copyFixture();
  const workspace = writeWorkspace(baseConfig(projectRoot));
  assert.equal(workspace, path.join(projectRoot, '.ds-viewer'));

  assert.deepEqual(JSON.parse(readFileSync(path.join(workspace, 'package.json'), 'utf8')), {
    name: 'ds-viewer-workspace',
    private: true,
    main: 'entry.tsx',
  });
  assert.deepEqual(JSON.parse(readFileSync(path.join(workspace, 'app.json'), 'utf8')), {
    expo: { name: 'Fixture App', slug: 'ds-viewer-workspace', platforms: ['web'] },
  });

  assert.deepEqual(JSON.parse(readFileSync(path.join(workspace, 'tsconfig.json'), 'utf8')), {
    include: ['../src/components/**/*', '../src/tokens/**/*'],
  });

  const metroConfig = readFileSync(path.join(workspace, 'metro.config.js'), 'utf8');
  assert.match(metroConfig, /config\.projectRoot = workspace;/);
  assert.match(metroConfig, /unstable_serverRoot: workspace/);
  assert.match(metroConfig, /@krapwoo\/ds-viewer\/generated/);
  // Minor: a project's metro.config.js exporting a function or Promise (both valid for Metro)
  // would otherwise make `config.projectRoot = workspace;` above mutate a non-object obscurely.
  assert.match(metroConfig, /typeof config !== 'object'/);

  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.match(entry, /appName=\{"Fixture App"\}/);
  assert.match(entry, /buildCatalogSections\(pages, components, \[\]\)/);
  assert.match(entry, /registerRootComponent\(App\)/);
  assert.doesNotMatch(entry, /SafeAreaProvider/, 'react-native-safe-area-context is not installed in the fixture — no import or wrapping');

  assert.ok(!existsSync(path.join(workspace, 'babel.config.js')), 'no project babel.config.js — none should be written');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace extends the project\'s own tsconfig.json when one exists', () => {
  const projectRoot = copyFixture();
  writeFileSync(path.join(projectRoot, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
  const workspace = writeWorkspace(baseConfig(projectRoot));
  assert.deepEqual(JSON.parse(readFileSync(path.join(workspace, 'tsconfig.json'), 'utf8')), {
    extends: '../tsconfig.json',
    include: ['../src/components/**/*', '../src/tokens/**/*'],
  });
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace imports and wraps the viewer in SafeAreaProvider when react-native-safe-area-context is installed', () => {
  const projectRoot = copyFixture();
  const safeAreaDir = path.join(projectRoot, 'node_modules', 'react-native-safe-area-context');
  mkdirSync(safeAreaDir, { recursive: true });
  writeFileSync(path.join(safeAreaDir, 'package.json'), '{"name":"react-native-safe-area-context"}\n');

  const workspace = writeWorkspace(baseConfig(projectRoot));
  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.match(entry, /import \{ SafeAreaProvider \} from 'react-native-safe-area-context';/);
  assert.match(entry, /<SafeAreaProvider><CatalogShell/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace re-exports the project\'s own babel.config.js when one exists', () => {
  const projectRoot = copyFixture();
  writeFileSync(path.join(projectRoot, 'babel.config.js'), "module.exports = { presets: ['babel-preset-expo'] };\n");
  const workspace = writeWorkspace(baseConfig(projectRoot));
  const babelConfig = readFileSync(path.join(workspace, 'babel.config.js'), 'utf8');
  assert.equal(babelConfig, "module.exports = require('../babel.config.js');\n");
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace watches every configured glob\'s base folder, including ones outside projectRoot', () => {
  const projectRoot = copyFixture();
  const config = {
    ...baseConfig(projectRoot),
    components: ['../starter-kit/components/*/index.ts'],
    tokens: ['../starter-kit/tokens/index.ts'],
    pages: ['viewer-pages/*.catalog.tsx'],
  };
  const workspace = writeWorkspace(config);
  const metroConfig = readFileSync(path.join(workspace, 'metro.config.js'), 'utf8');
  assert.match(metroConfig, /EXTRA_WATCH_FOLDERS = \["\.\.\/starter-kit\/components","\.\.\/starter-kit\/tokens","viewer-pages"\]/);
  assert.match(metroConfig, /extraWatchFolders\.map/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace still watches a same-root project\'s own folders (0.1 behavior unchanged)', () => {
  const projectRoot = copyFixture();
  const workspace = writeWorkspace(baseConfig(projectRoot));
  const metroConfig = readFileSync(path.join(workspace, 'metro.config.js'), 'utf8');
  assert.match(metroConfig, /EXTRA_WATCH_FOLDERS = \["src\/components","src\/tokens"\]/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace makes a validated logo available to the generated entry', () => {
  const projectRoot = copyFixture();
  mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  writeFileSync(path.join(projectRoot, 'assets', 'logo.png'), '');
  const workspace = writeWorkspace({ ...baseConfig(projectRoot), logo: './assets/logo.png' });
  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.match(entry, /require\("\.\.\/assets\/logo\.png"\)/);
  assert.match(entry, /logoImageSource=\{logoSource\}/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace emits a syntactically valid require() for a logo file name containing a single quote', () => {
  // The user's own file name, not guaranteed quote-free text (Minor finding, Fable's
  // implementation review, cli/workspace.ts:65): a single-quoted literal built by string
  // interpolation breaks the generated entry's syntax the moment the logo file name itself
  // contains a `'`.
  const projectRoot = copyFixture();
  mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  writeFileSync(path.join(projectRoot, 'assets', "it's.png"), '');
  const workspace = writeWorkspace({ ...baseConfig(projectRoot), logo: "./assets/it's.png" });
  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  const { diagnostics } = ts.transpileModule(entry, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  // Message text only, not the raw `ts.Diagnostic[]` — each diagnostic holds a full `SourceFile`
  // with parent back-references, so a failing `assert.deepEqual` on the array itself would try to
  // walk and print that whole (effectively circular) AST.
  assert.deepEqual((diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
  assert.match(entry, /require\("\.\.\/assets\/it's\.png"\)/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace omits logoImageSource entirely when no logo is configured', () => {
  const projectRoot = copyFixture();
  const workspace = writeWorkspace(baseConfig(projectRoot));
  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.doesNotMatch(entry, /logoImageSource/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace\'s generated metro config only watches extra folders that exist on disk, so a missing pages folder does not break every bundle', () => {
  const projectRoot = copyFixture();
  // `viewer-pages` is configured but never created — the real bug (a config's `pages`/`components`/
  // `tokens` glob pointing at a folder that doesn't exist yet) that made every Metro bundle request
  // return HTTP 500, because Metro refuses to watch a nonexistent folder.
  const config = { ...baseConfig(projectRoot), pages: ['viewer-pages/*.catalog.tsx'] };
  const workspace = writeWorkspace(config);
  const metroConfig = readFileSync(path.join(workspace, 'metro.config.js'), 'utf8');
  assert.match(metroConfig, /extraWatchFolders\.map\(\(f\) => path\.resolve\(projectRoot, f\)\)\.filter\(\(f\) => fs\.existsSync\(f\)\)/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('entry.tsx always imports update.json and defaults updateEndpoint to undefined', () => {
  const projectRoot = copyFixture();
  const workspace = writeWorkspace(baseConfig(projectRoot));
  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.match(entry, /import updateNotice from '\.\/update\.json';/);
  assert.match(entry, /const updateEndpoint = undefined;/);
  assert.match(entry, /import versionStatus from '\.\/version\.json';/);
  assert.match(entry, /update=\{updateNotice\} versionStatus=\{versionStatus\} updateEndpoint=\{updateEndpoint\}/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('entry.tsx bakes in the endpoint base URL and secret when given one', () => {
  const projectRoot = copyFixture();
  const workspace = writeWorkspace(baseConfig(projectRoot), { baseUrl: 'http://127.0.0.1:54321', secret: 'abc123' });
  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.match(entry, /const updateEndpoint = \{"baseUrl":"http:\/\/127\.0\.0\.1:54321","secret":"abc123"\};/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a run with no endpoint of its own inlines none, so its pages make no endpoint calls', () => {
  // The shell polls /version from every page, so a throwaway server (`--no-update-endpoint`, used
  // by `doctor --render`) must not inherit another server's endpoint: every page would call it
  // from the wrong origin. Two dev servers share this directory, so the last writer decides.
  const projectRoot = copyFixture();
  const withEndpoint = writeWorkspace(baseConfig(projectRoot), { baseUrl: 'http://127.0.0.1:54321', secret: 'abc' });
  assert.match(readFileSync(path.join(withEndpoint, 'entry.tsx'), 'utf8'), /"baseUrl":"http:\/\/127\.0\.0\.1:54321"/);
  const without = writeWorkspace(baseConfig(projectRoot));
  assert.match(readFileSync(path.join(without, 'entry.tsx'), 'utf8'), /const updateEndpoint = undefined;/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a run can own a different generated directory, and nothing of it lands in the default one', () => {
  // Two dev servers share one project root: `doctor --render` starts its own beside whatever the
  // developer has open. Before this, the second one's files replaced the first one's.
  const projectRoot = copyFixture();
  const own = writeWorkspace({ ...baseConfig(projectRoot), workspaceDir: RENDER_WORKSPACE_DIR }, { baseUrl: 'http://127.0.0.1:1', secret: 's' });
  assert.equal(path.basename(own), RENDER_WORKSPACE_DIR);
  assert.ok(existsSync(path.join(own, 'entry.tsx')));
  // The default directory was never created by that call.
  assert.equal(existsSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR)), false);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('workspacePath resolves inside the run\'s own directory, defaulting to .ds-viewer', () => {
  assert.equal(workspacePath({ projectRoot: '/p' }, 'generated'), path.join('/p', DEFAULT_WORKSPACE_DIR, 'generated'));
  assert.equal(workspacePath({ projectRoot: '/p', workspaceDir: RENDER_WORKSPACE_DIR }, 'update.json'), path.join('/p', RENDER_WORKSPACE_DIR, 'update.json'));
});

test('a live dev lock is reported, so a second dev can refuse the workspace', () => {
  const projectRoot = copyFixture();
  const config = { projectRoot };
  assert.equal(liveDevLock(config), undefined, 'no lock yet');

  // This test's own process is certainly alive, so it stands in for the other server.
  writeDevLock(config, { pid: process.pid, port: 5181 });
  assert.deepEqual(liveDevLock(config, process.pid + 1), { pid: process.pid, port: 5181 });

  // A process never finds itself: `dev` re-reads the lock it just wrote.
  assert.equal(liveDevLock(config, process.pid), undefined);

  clearDevLock(config);
  assert.equal(liveDevLock(config, process.pid + 1), undefined, 'cleared');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a lock left behind by a crashed dev never blocks the next one', () => {
  const projectRoot = copyFixture();
  const config = { projectRoot };
  // A pid that cannot be running: the kernel reserves 0, and `process.kill(0, 0)` targets this
  // process's own group rather than a process, so use an unused high pid instead.
  let deadPid = 999_999;
  while (true) {
    try { process.kill(deadPid, 0); deadPid += 1; } catch { break; }
  }
  writeDevLock(config, { pid: deadPid, port: 5181 });
  assert.equal(liveDevLock(config), undefined, 'a dead owner owns nothing');

  // A half-written lock is ignored rather than throwing.
  writeFileSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR, 'dev-lock.json'), '{ "pid": ');
  assert.equal(liveDevLock(config), undefined);
  writeFileSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR, 'dev-lock.json'), '{}');
  assert.equal(liveDevLock(config), undefined, 'a lock with no pid owns nothing');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('each workspace directory has its own lock, so a render check never collides', () => {
  const projectRoot = copyFixture();
  writeDevLock({ projectRoot }, { pid: process.pid, port: 5181 });
  // The render check owns `.ds-viewer-render`, so it sees no owner and proceeds.
  assert.equal(liveDevLock({ projectRoot, workspaceDir: RENDER_WORKSPACE_DIR }, process.pid + 1), undefined);
  assert.ok(liveDevLock({ projectRoot }, process.pid + 1));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a workspace that has lost its defining files reports exactly which, and writing it again restores them', () => {
  // The failure this exists for (issue #41): something outside the server removes the workspace's
  // files while it is serving, and Metro then blames the *project's* package.json with
  // "Cannot resolve entry file" — a file the developer never touched and which is perfectly fine.
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  writeWorkspace(config);
  assert.deepEqual(missingWorkspaceFiles(config), [], 'a freshly written workspace is intact');

  // The observed shape of the failure: every defining file gone, `generated/` left behind.
  for (const name of WORKSPACE_DEFINING_FILES) rmSync(workspacePath(config, name), { force: true });
  assert.deepEqual(missingWorkspaceFiles(config).sort(), [...WORKSPACE_DEFINING_FILES].sort());

  writeWorkspace(config);
  assert.deepEqual(missingWorkspaceFiles(config), [], 'writeWorkspace is idempotent, so it is also the repair');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a single lost file is reported on its own, not as a wholesale failure', () => {
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  writeWorkspace(config);
  rmSync(workspacePath(config, 'entry.tsx'), { force: true });
  assert.deepEqual(missingWorkspaceFiles(config), ['entry.tsx']);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a workspace that was never written reports every file rather than throwing', () => {
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  assert.equal(missingWorkspaceFiles(config).length, WORKSPACE_DEFINING_FILES.length);
  rmSync(projectRoot, { recursive: true, force: true });
});

const ENDPOINT = { baseUrl: 'http://127.0.0.1:54321', secret: 'test-secret' };
const VERSION_STATUS = { current: '1.0.0', latest: '1.0.0', behind: false } as never;

test('a repair writes back exactly what the server originally wrote, endpoint included', () => {
  // The defect this pins (found in review): the repair rebuilt the endpoint from Metro's port,
  // so a repaired entry.tsx pointed the catalog at the wrong server — the update panel broke
  // while the server reported a successful repair.
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  writeWorkspace(config, ENDPOINT);
  const original = readFileSync(workspacePath(config, 'entry.tsx'), 'utf8');

  for (const name of WORKSPACE_DEFINING_FILES) rmSync(workspacePath(config, name), { force: true });
  const result = repairWorkspaceIfMissing({
    config, updateEndpoint: ENDPOINT, versionStatus: () => VERSION_STATUS, sync: () => {}, reclaimLock: () => {}, log: () => {},
  });

  assert.equal(result.repaired, true);
  assert.equal(readFileSync(workspacePath(config, 'entry.tsx'), 'utf8'), original, 'a repaired entry.tsx must be byte-identical to the original');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a repair also restores the files entry.tsx imports, not just the five it watches', () => {
  // The observed failure empties the whole workspace root. entry.tsx imports ./update.json and
  // ./version.json unconditionally, so restoring it without them leaves Metro unable to resolve
  // its imports — a repair that reports success over a catalog that is still broken.
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  writeWorkspace(config, ENDPOINT);
  for (const name of [...WORKSPACE_DEFINING_FILES, 'update.json', 'version.json']) {
    rmSync(workspacePath(config, name), { force: true });
  }

  repairWorkspaceIfMissing({ config, updateEndpoint: ENDPOINT, versionStatus: () => VERSION_STATUS, sync: () => {}, reclaimLock: () => {}, log: () => {} });

  // Contents, not just existence: an empty file satisfies `existsSync` and then fails Metro's
  // JSON import at runtime, which is the failure this repair exists to prevent.
  assert.deepEqual(JSON.parse(readFileSync(workspacePath(config, 'version.json'), 'utf8')), VERSION_STATUS);
  assert.equal(JSON.parse(readFileSync(workspacePath(config, 'update.json'), 'utf8')), null);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a repair writes into the run\'s own workspace directory, not the default one', () => {
  // A server given --workspace-dir owns that directory; repairing into `.ds-viewer` instead would
  // write over whatever is there — possibly another server's live workspace.
  const projectRoot = copyFixture();
  const config = { ...baseConfig(projectRoot), workspaceDir: '.ds-viewer-second' };
  writeWorkspace(config, ENDPOINT);
  for (const name of [...WORKSPACE_DEFINING_FILES, 'update.json', 'version.json']) {
    rmSync(workspacePath(config, name), { force: true });
  }

  repairWorkspaceIfMissing({
    config, updateEndpoint: ENDPOINT, versionStatus: () => VERSION_STATUS, sync: () => {}, reclaimLock: () => {}, log: () => {},
  });

  assert.ok(existsSync(path.join(projectRoot, '.ds-viewer-second', 'entry.tsx')));
  assert.ok(existsSync(path.join(projectRoot, '.ds-viewer-second', 'update.json')));
  assert.equal(existsSync(path.join(projectRoot, '.ds-viewer', 'entry.tsx')), false, 'the default directory must be left alone');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('an intact workspace is left alone and reports no repair', () => {
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  writeWorkspace(config, ENDPOINT);
  let logged = 0;
  const result = repairWorkspaceIfMissing({
    config, updateEndpoint: ENDPOINT, versionStatus: () => VERSION_STATUS, sync: () => { throw new Error('must not sync an intact workspace'); }, reclaimLock: () => { throw new Error('must not touch the lock of an intact workspace'); }, log: () => { logged += 1; },
  });
  assert.deepEqual(result, { missing: [], repaired: false });
  assert.equal(logged, 0, 'an intact workspace says nothing');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readEndpointRecord returns undefined when nothing has been written yet', () => {
  const projectRoot = copyFixture();
  assert.equal(readEndpointRecord({ projectRoot }), undefined);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeEndpointRecord then readEndpointRecord round-trips the port and secret', () => {
  const projectRoot = copyFixture();
  writeEndpointRecord({ projectRoot }, { port: 54321, secret: 'a'.repeat(32) });
  assert.deepEqual(readEndpointRecord({ projectRoot }), { port: 54321, secret: 'a'.repeat(32) });
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readEndpointRecord treats a corrupt record as absent rather than throwing', () => {
  const projectRoot = copyFixture();
  mkdirSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR), { recursive: true });
  writeFileSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR, 'endpoint.json'), '{ "port": ');
  assert.equal(readEndpointRecord({ projectRoot }), undefined);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readEndpointRecord treats a record missing a field as absent', () => {
  const projectRoot = copyFixture();
  mkdirSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR), { recursive: true });
  writeFileSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR, 'endpoint.json'), JSON.stringify({ port: 54321 }));
  assert.equal(readEndpointRecord({ projectRoot }), undefined);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readEndpointRecord treats a secret shorter than 32 characters as absent', () => {
  // Minor finding, correction pass 4: `bindEndpointServer` never writes a secret this short, but
  // a hand-written record (e.g. `{"secret":""}`) would otherwise be reused verbatim and
  // `secretMatches` compares two zero-length buffers as equal, authenticating every request.
  const projectRoot = copyFixture();
  mkdirSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR), { recursive: true });
  writeFileSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR, 'endpoint.json'), JSON.stringify({ port: 54321, secret: '' }));
  assert.equal(readEndpointRecord({ projectRoot }), undefined);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeEndpointRecord writes the file with mode 0600', () => {
  const projectRoot = copyFixture();
  writeEndpointRecord({ projectRoot }, { port: 54321, secret: 'abc123' });
  const mode = statSync(path.join(projectRoot, DEFAULT_WORKSPACE_DIR, 'endpoint.json')).mode & 0o777;
  assert.equal(mode, 0o600);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeEndpointRecord tightens a pre-existing record left with looser permissions', () => {
  // `writeFileSync`'s `mode` option applies only when the file is created, so a record written
  // by an older version (or left loose by anything else) would keep those permissions across
  // every later rewrite — the secret inside it would stay world-readable. Only the explicit
  // `chmodSync` closes that, and the creation-path test above cannot see it.
  const projectRoot = copyFixture();
  writeEndpointRecord({ projectRoot }, { port: 54321, secret: 'abc123' });
  const recordPath = path.join(projectRoot, DEFAULT_WORKSPACE_DIR, 'endpoint.json');
  chmodSync(recordPath, 0o644);
  writeEndpointRecord({ projectRoot }, { port: 54322, secret: 'def456' });
  assert.equal(statSync(recordPath).mode & 0o777, 0o600);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a repair re-asserts this server\'s ownership of the directory', () => {
  // The observed failure removes dev-lock.json too. Without it a second `dev` is no longer
  // refused, so a repair that restored the files but not the lock would quietly give up the
  // protection in #39 — two servers back to clobbering one directory.
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  writeWorkspace(config, ENDPOINT);
  writeDevLock(config, { pid: process.pid, port: 5182 });
  for (const name of [...WORKSPACE_DEFINING_FILES, 'update.json', 'version.json', 'dev-lock.json']) {
    rmSync(workspacePath(config, name), { force: true });
  }
  assert.equal(liveDevLock(config, process.pid + 1), undefined, 'the lock really is gone');

  repairWorkspaceIfMissing({
    config, updateEndpoint: ENDPOINT, versionStatus: () => VERSION_STATUS, sync: () => {},
    reclaimLock: () => writeDevLock(config, { pid: process.pid, port: 5182 }), log: () => {},
  });

  assert.ok(liveDevLock(config, process.pid + 1), 'a second dev must still be refused after a repair');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a repair restores the endpoint record, so a restart keeps reusing this address', () => {
  // Found by fabricating issue #41's observed state against a live server: the repair brought the
  // catalog back to 200 but left `endpoint.json` deleted. Nothing breaks while that server runs —
  // it holds the endpoint in memory — so the loss is invisible until the next `dev`, which finds
  // no record, picks a fresh port and secret, and leaves an already-open page calling an address
  // nobody answers. That is exactly the defect 0.9.1's stored record fixed.
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  const endpoint = { baseUrl: 'http://127.0.0.1:54321', secret: 'a-sufficiently-long-test-secret-value' };
  writeWorkspace(config, endpoint);
  writeEndpointRecord(config, { port: 54321, secret: endpoint.secret });

  // #41's shape: everything the failure takes, the endpoint record included.
  for (const name of WORKSPACE_DEFINING_FILES) rmSync(workspacePath(config, name), { force: true });
  rmSync(workspacePath(config, 'endpoint.json'), { force: true });

  const result = repairWorkspaceIfMissing({
    config, updateEndpoint: endpoint, versionStatus: () => VERSION_STATUS, sync: () => {}, reclaimLock: () => {}, log: () => {},
  });

  assert.equal(result.repaired, true);
  assert.deepEqual(
    readEndpointRecord(config),
    { port: 54321, secret: endpoint.secret },
    'the repair must restore the port and secret the server is actually serving, so a restart reuses them',
  );
  assert.equal(statSync(workspacePath(config, 'endpoint.json')).mode & 0o777, 0o600, 'a restored record must be as private as the original');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a repair leaves an existing endpoint record alone, even one that disagrees with it', () => {
  // The repair fills a gap; it does not assert ownership of a record that is already there. The
  // deliberately different port is what makes this a test: writing the live endpoint back over an
  // identical record is byte-identical and proves nothing, so the stored record here names a
  // different port than the endpoint passed in. A record that disagrees belongs to something else
  // — a second `dev` that took this directory — and `reclaimLock` already refuses to take a
  // directory another pid owns, so stamping this server's address over its record would undo that
  // protection one file across.
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  const endpoint = { baseUrl: 'http://127.0.0.1:54321', secret: 'a-sufficiently-long-test-secret-value' };
  writeWorkspace(config, endpoint);
  const other = { port: 61999, secret: 'a-different-and-equally-long-secret!!' };
  writeEndpointRecord(config, other);

  for (const name of WORKSPACE_DEFINING_FILES) rmSync(workspacePath(config, name), { force: true });
  repairWorkspaceIfMissing({
    config, updateEndpoint: endpoint, versionStatus: () => VERSION_STATUS, sync: () => {}, reclaimLock: () => {}, log: () => {},
  });

  assert.deepEqual(readEndpointRecord(config), other, 'an existing record must survive a repair untouched, even when it names a different address');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('a repair without an endpoint writes no record at all', () => {
  // A render check runs `--no-update-endpoint`: there is no address to remember, and inventing one
  // would hand the next run a port nothing listens on.
  const projectRoot = copyFixture();
  const config = baseConfig(projectRoot);
  writeWorkspace(config);
  for (const name of WORKSPACE_DEFINING_FILES) rmSync(workspacePath(config, name), { force: true });

  repairWorkspaceIfMissing({
    config, updateEndpoint: undefined, versionStatus: () => VERSION_STATUS, sync: () => {}, reclaimLock: () => {}, log: () => {},
  });

  assert.equal(existsSync(workspacePath(config, 'endpoint.json')), false, 'no endpoint means no record to restore');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('entry.tsx imports usage and passes it to the shell only when a usage path is configured', () => {
  const projectRoot = copyFixture();
  const without = readFileSync(path.join(writeWorkspace(baseConfig(projectRoot)), 'entry.tsx'), 'utf8');
  assert.doesNotMatch(without, /usage/);

  const withUsage = readFileSync(path.join(writeWorkspace({ ...baseConfig(projectRoot), usage: 'build/usage.json' }), 'entry.tsx'), 'utf8');
  assert.match(withUsage, /^import usage from '\.\/generated\/usage\.json';$/m);
  assert.match(withUsage, /<CatalogShell [^\n]* usage=\{usage\} \/>/);
  // The only differences are those two additions: with no usage the generated entry is unchanged.
  assert.equal(withUsage.replace("import usage from './generated/usage.json';\n", '').replace(' usage={usage}', ''), without);
  rmSync(projectRoot, { recursive: true, force: true });
});
