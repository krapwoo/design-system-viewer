// cli/__tests__/endpoint.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createUpdateEndpoint, type EndpointDeps, type UpdateStatus } from '../endpoint.ts';
import { DS_VIEWER_SECRET_HEADER } from '../../native/catalog/catalogNavigation.ts';
import type { UpdatePlan } from '../updatePlan.ts';

const SECRET = 'test-secret';
const ALLOWED_ORIGIN = 'http://localhost:5181';

function samplePlan(overrides: Partial<UpdatePlan> = {}): UpdatePlan {
  return { current: '0.4.0', latest: '0.5.0', breaking: false, summary: [], files: [], dirtyFiles: [], kitFilesDiffering: 0, outsideGitRepo: false, ...overrides };
}

async function withServer(
  depOverrides: Partial<EndpointDeps>,
  run: (baseUrl: string, calls: { buildPlan: number; startUpdate: UpdatePlan[] }) => Promise<void>,
): Promise<void> {
  const calls = { buildPlan: 0, startUpdate: [] as UpdatePlan[] };
  const deps: EndpointDeps = {
    secret: SECRET,
    allowedOrigin: ALLOWED_ORIGIN,
    buildPlan: async () => { calls.buildPlan += 1; return samplePlan(); },
    startUpdate: (plan) => { calls.startUpdate.push(plan); },
    getStatus: () => ({ phase: 'idle' }) as UpdateStatus,
    ...depOverrides,
  };
  const server = createUpdateEndpoint(deps);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`, calls);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('OPTIONS preflight from the correct Origin gets CORS headers for the secret header', async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/plan`, { method: 'OPTIONS', headers: { Origin: ALLOWED_ORIGIN } });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
    assert.match(res.headers.get('access-control-allow-headers') ?? '', new RegExp(DS_VIEWER_SECRET_HEADER, 'i'));
  });
});

test('OPTIONS preflight from the wrong Origin is rejected with no CORS headers', async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/plan`, { method: 'OPTIONS', headers: { Origin: 'http://evil.example' } });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});

test('a request with no Origin header at all is rejected', async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/plan`, { method: 'POST', headers: { [DS_VIEWER_SECRET_HEADER]: SECRET } });
    assert.equal(res.status, 400);
  });
});

test('a request from the wrong Origin is rejected even with the correct secret', async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/plan`, { method: 'POST', headers: { Origin: 'http://evil.example', [DS_VIEWER_SECRET_HEADER]: SECRET } });
    assert.equal(res.status, 403);
  });
});

test('a request from the correct Origin with a missing or wrong secret is rejected', async () => {
  await withServer({}, async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/plan`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN } });
    assert.equal(missing.status, 401);
    const wrong = await fetch(`${baseUrl}/plan`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: 'nope' } });
    assert.equal(wrong.status, 401);
  });
});

test('a same-length wrong secret is rejected too — timingSafeEqual is actually reached, not short-circuited by a length mismatch', async () => {
  await withServer({}, async (baseUrl) => {
    const sameLength = 'x'.repeat(SECRET.length);
    const res = await fetch(`${baseUrl}/plan`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: sameLength } });
    assert.equal(res.status, 401);
  });
});

test('POST /plan with the correct Origin and secret returns the built plan as JSON', async () => {
  await withServer({}, async (baseUrl, calls) => {
    const res = await fetch(`${baseUrl}/plan`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).latest, '0.5.0');
    assert.equal(calls.buildPlan, 1);
  });
});

test('POST /update refuses with the plan\'s dirty-file list — no override', async () => {
  await withServer({ buildPlan: async () => samplePlan({ dirtyFiles: ['package.json'] }) }, async (baseUrl, calls) => {
    const res = await fetch(`${baseUrl}/update`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET } });
    assert.equal(res.status, 409);
    assert.deepEqual((await res.json()).dirtyFiles, ['package.json']);
    assert.deepEqual(calls.startUpdate, []);
  });
});

test('POST /update with a clean plan starts the update and returns 202', async () => {
  await withServer({}, async (baseUrl, calls) => {
    const res = await fetch(`${baseUrl}/update`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET } });
    assert.equal(res.status, 202);
    assert.equal(calls.startUpdate.length, 1);
    assert.equal(calls.startUpdate[0].latest, '0.5.0');
  });
});

test('POST /update is refused while one is already running — "one update at a time"', async () => {
  await withServer({ getStatus: () => ({ phase: 'updating', steps: [] }) }, async (baseUrl, calls) => {
    const res = await fetch(`${baseUrl}/update`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET } });
    assert.equal(res.status, 409);
    assert.deepEqual(calls.startUpdate, []);
    assert.equal(calls.buildPlan, 0); // never even re-plans once one is already in flight.
  });
});

test('two concurrent POST /update requests: only the first starts the update, the second is refused — "one update at a time" during re-planning, not just once status is "updating"', async () => {
  let buildPlanCalls = 0;
  await withServer(
    {
      buildPlan: async () => {
        buildPlanCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return samplePlan();
      },
    },
    async (baseUrl, calls) => {
      const post = () => fetch(`${baseUrl}/update`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET } });
      const first = post();
      const second = await new Promise<Response>((resolve) => setTimeout(() => resolve(post()), 10));
      const firstRes = await first;
      const statuses = [firstRes.status, second.status].sort();
      assert.deepEqual(statuses, [202, 409]);
      // `startUpdate` runs via `setImmediate`, scheduled only after the 202 response is already
      // written — give it a turn of the event loop before counting calls, the same gap `fetch`'s
      // own promise resolution doesn't reliably wait out on its own.
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(calls.startUpdate.length, 1);
      assert.equal(buildPlanCalls, 1); // the second request never re-plans either — refused before that.
    },
  );
});

test('a rejected buildPlan answers 502 and does not leave later updates refused', async () => {
  let attempt = 0;
  await withServer(
    {
      buildPlan: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('npm exploded');
        return samplePlan();
      },
    },
    async (baseUrl, calls) => {
      const post = () => fetch(`${baseUrl}/update`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET } });
      assert.equal((await post()).status, 502);
      assert.equal((await post()).status, 202);
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(calls.startUpdate.length, 1);
    },
  );
});

test('GET /update/status requires the secret and returns getStatus() verbatim', async () => {
  await withServer({ getStatus: () => ({ phase: 'restarting' }) }, async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/update/status`, { headers: { Origin: ALLOWED_ORIGIN } });
    assert.equal(unauthorized.status, 401);
    const ok = await fetch(`${baseUrl}/update/status`, { headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET } });
    assert.deepEqual(await ok.json(), { phase: 'restarting' });
  });
});

test('an unknown route is 404', async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/nope`, { method: 'GET', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET } });
    assert.equal(res.status, 404);
  });
});

test('a request whose Host header does not match 127.0.0.1:<port> is rejected (DNS-rebinding defence)', async () => {
  await withServer({}, async (baseUrl) => {
    const url = new URL(`${baseUrl}/plan`);
    const status = await new Promise<number>((resolve, reject) => {
      // `fetch` treats `Host` as a forbidden header it will not let JS override — a raw
      // `http.request` is the only way to actually send a mismatched one, the same way a
      // DNS-rebound attacker page would via a browser that resolved its own hostname to this
      // loopback address.
      const req = http.request(
        { hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET, Host: 'evil.example' } },
        (res) => resolve(res.statusCode ?? 0),
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 400);
  });
});

test('POST /update replies 202 before startUpdate ever runs, even if startUpdate throws synchronously', async () => {
  await withServer({ startUpdate: () => { throw new Error('boom'); } }, async (baseUrl) => {
    // If `startUpdate` ran before the response was sent (as it did before this fix), its
    // synchronous throw would reject the request handler before `res.end()` was ever called,
    // and this `fetch` would hang/error instead of cleanly observing 202 (Critical finding, Fable
    // correction pass).
    const res = await fetch(`${baseUrl}/update`, { method: 'POST', headers: { Origin: ALLOWED_ORIGIN, [DS_VIEWER_SECRET_HEADER]: SECRET } });
    assert.equal(res.status, 202);
  });
});
