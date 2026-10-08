// Spike: the 0.4 plan's Task 18 restart (performRestart + dev()'s detached Expo spawn),
// reproduced faithfully on a real Expo/Metro in kit-host. Usage:
//   node restart-spike.mjs <gen> <port> <workspace> [--fixed]
// gen 0 = original `dev`; after Metro answers it runs performRestart, which re-spawns gen 1.
// gen 1 = restarted `dev`; it serves until signalled.
// --fixed removes dev()'s original signal listeners before adding the forwarders.
import { spawn } from 'node:child_process';
import net from 'node:net';

const [gen, portArg, workspace] = process.argv.slice(2);
const port = Number(portArg);
const fixed = process.argv.includes('--fixed');
const log = (m) => console.error(`[spike gen${gen} pid${process.pid} pgid?] ${m}`);

async function waitForHttp() {
  for (let i = 0; i < 600; i += 1) {
    try {
      const r = await fetch(`http://localhost:${port}/`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
function probePortFree(p) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port: p }, () => { s.destroy(); resolve(false); });
    s.on('error', () => resolve(true));
  });
}
async function waitForPortFree(p) {
  for (let a = 0; a < 50; a += 1) { if (await probePortFree(p)) return true; await new Promise((r) => setTimeout(r, 100)); }
  return false;
}

// --- dev(), as planned (Task 18 Step 5) ---
const child = spawn('npx', ['expo', 'start', '--web', '--host', 'localhost', '--port', String(port)], {
  cwd: workspace, stdio: 'inherit', detached: true,
});
log(`spawned expo pid ${child.pid} (detached)`);
child.on('exit', (code, sig) => { log(`expo exited code=${code} sig=${sig}`); process.exitCode = code ?? 0; });
for (const signal of (fixed ? ['SIGTERM', 'SIGINT', 'SIGHUP'] : ['SIGTERM', 'SIGINT'])) {
  process.on(signal, () => {
    log(`dev() handler got ${signal}`);
    try { process.kill(-child.pid, signal); } catch {}
    process.exit(0);
  });
}

const t0 = Date.now();
const up = await waitForHttp();
log(`metro answered=${up} after ${Date.now() - t0}ms`);
if (gen === '1') { log('RESTARTED_OK'); }
else {
  // --- performRestart, as planned (Task 18 Step 3) ---
  const tk = Date.now();
  try { process.kill(-child.pid, 'SIGTERM'); } catch (e) { log(`group kill failed ${e.code}`); }
  await new Promise((r) => { if (child.exitCode !== null || child.signalCode) r(); else child.once('exit', () => r()); });
  log(`old child exit observed after ${Date.now() - tk}ms`);
  const free = await waitForPortFree(port);
  log(`port free=${free} after ${Date.now() - tk}ms`);
  if (fixed) { for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.removeAllListeners(s); process.on('SIGHUP', (s) => { log('forwarding SIGHUP'); newChild.kill(s); }); }
  const newChild = spawn(process.execPath, [...process.execArgv, process.argv[1], '1', String(port), workspace, ...(fixed ? ['--fixed'] : [])], { stdio: 'inherit' });
  log(`spawned gen1 pid ${newChild.pid}`);
  const forward = (s) => { log(`forwarding ${s}`); newChild.kill(s); };
  process.on('SIGINT', forward);
  process.on('SIGTERM', forward);
  const code = await new Promise((r) => newChild.on('exit', (c) => r(c ?? 0)));
  log(`gen1 exited ${code}`);
  process.exit(code);
}
