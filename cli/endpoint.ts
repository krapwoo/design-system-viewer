// cli/endpoint.ts
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { DS_VIEWER_SECRET_HEADER } from '../native/catalog/catalogNavigation.ts';
import type { UpdatePlan } from './updatePlan.ts';
import type { VersionStatus } from '../native/catalog/types.ts';

/** A constant-time secret compare (Minor finding, Fable correction pass; controller decision 1
 *  makes this required, not optional) — `!==` on two strings short-circuits at the first
 *  differing byte, which leaks the secret's length and prefix through response-timing one byte at
 *  a time. Buffers of different lengths are rejected before ever reaching `timingSafeEqual`
 *  (which throws, rather than returning `false`, when its two inputs aren't the same length). */
function secretMatches(received: string | string[] | undefined, expected: string): boolean {
  if (typeof received !== 'string') return false;
  const receivedBuf = Buffer.from(received);
  const expectedBuf = Buffer.from(expected);
  return receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf);
}

export type UpdateStatus =
  | { phase: 'idle' }
  | { phase: 'updating'; steps: { label: string; state: 'done' | 'now' | 'todo' }[] }
  | { phase: 'restarting' }
  // Errata 1b: `latest` lets the viewer render the success state after `update.json` has gone
  // back to `null` (current === latest post-reload) without the panel ever needing `update` again.
  | { phase: 'success'; doctorSummary: string; files: string[]; latest: string }
  // `step` says where it stopped, so the viewer can offer the right recovery: retry the whole update
  // (install, or an unexpected failure), or resume from migrate or doctor.
  | { phase: 'failure'; log: string; failedStep: string; step?: 'install' | 'migrate' | 'doctor' | 'other' };

export interface EndpointDeps {
  secret: string;
  /** The viewer's own Metro URL, e.g. `http://localhost:5181` — computed once per `dev` run (Task 18). */
  allowedOrigin: string;
  buildPlan: () => Promise<UpdatePlan | { error: string }>;
  /** Fire-and-forget — must never throw; a failure surfaces only through `getStatus()`'s own
   *  `'failure'` phase, never as a rejected promise this endpoint would have to catch. */
  startUpdate: (plan: UpdatePlan) => void;
  getStatus: () => UpdateStatus;
  /** Clears a finished result (success or failure) back to idle, once the viewer has shown it. */
  dismissStatus?: () => void;
  /** Continues a failed update from its migrate or doctor step (fire-and-forget, like
   *  `startUpdate`). */
  resumeUpdate?: (step: 'migrate' | 'doctor') => void;
  /** The update page's version status (`GET /version`). Optional: without it, the three version
   *  routes answer 404. */
  getVersionStatus?: () => VersionStatus;
  /** **Check now** (`POST /version/check`): asks npm, ignoring the 24-hour cache. One at a time. */
  checkNow?: () => Promise<VersionStatus>;
  /** The update page's switch (`POST /version/auto-check`, body `{ "enabled": boolean }`): saves
   *  your own setting for this project on this computer. */
  setAutoCheck?: (enabled: boolean) => VersionStatus;
}

/** Reads a small JSON request body (the switch's `{ enabled }`); anything over 1 KB is refused. */
function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.setEncoding('utf8');
    // Keep draining past the cap (without storing it) so the handler can still answer 400 —
    // destroying the socket would drop that answer.
    req.on('data', (chunk: string) => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > 1024) {
        tooLarge = true;
        body = '';
      }
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new Error('Body too large.'));
        return;
      }
      try {
        resolve(JSON.parse(body || 'null'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, allowedOrigin: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin });
  res.end(JSON.stringify(body));
}

/** Design §5 "Local endpoint safeguards", every one of them, in the exact order this plan's own
 *  `spikes/cors-endpoint/` spike proved: Origin (including `OPTIONS`) → secret → route. Does not
 *  call `.listen()` itself — Task 18's `dev.ts` owns the real port (`0` → OS-assigned, `127.0.0.1`
 *  only) and this task's own tests each pick their own ephemeral port the same way. */
export function createUpdateEndpoint(deps: EndpointDeps): http.Server {
  // Critical finding, Fable correction pass: the "one update at a time" refusal only ever checked
  // `getStatus()`, which doesn't become `'updating'` until `startUpdate` runs — but `buildPlan`
  // (re-downloading the tarball) can take seconds, and the panel leaves **Update now** enabled
  // throughout, so a second click during that window passed the same check twice. This flag closes
  // exactly that window: set synchronously before the plan is even (re-)built, reset on every path
  // that does *not* hand the plan to `startUpdate` — the 502/409 refusals below. Once `startUpdate`
  // is actually called, `getStatus()` already reports `'updating'` (set synchronously inside it, by
  // every real caller), so resetting this flag right after is safe and lets a later retry (after a
  // `'failure'`, in the same process) through again.
  let starting = false;
  let checking = false;
  return http.createServer(async (req, res) => {
    // Controller decision 1 (required, not optional): reject a request whose `Host` header is not
    // this very socket's own `127.0.0.1:<port>` — a DNS-rebinding defence, since `req.socket`'s own
    // `localPort` is the port the OS actually accepted this connection on, never spoofable the way
    // `Origin` (an ordinary request header) technically is from a non-browser client. Checked before
    // everything else, including `OPTIONS`.
    if (req.headers.host !== `127.0.0.1:${req.socket.localPort}`) {
      res.writeHead(400).end('Invalid Host header.');
      return;
    }

    const origin = req.headers.origin;

    if (req.method === 'OPTIONS') {
      // The browser's own preflight never attaches the app's custom header to itself — checking
      // the secret here would make every state-changing request fail cross-origin before it ever
      // got the chance to send one.
      if (origin !== deps.allowedOrigin) {
        res.writeHead(403).end();
        return;
      }
      res.writeHead(204, {
        'Access-Control-Allow-Origin': deps.allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, GET',
        'Access-Control-Allow-Headers': `${DS_VIEWER_SECRET_HEADER}, Content-Type`,
      });
      res.end();
      return;
    }

    if (origin === undefined) {
      res.writeHead(400).end('Missing Origin header.');
      return;
    }
    if (origin !== deps.allowedOrigin) {
      res.writeHead(403).end('Origin rejected.');
      return;
    }
    if (!secretMatches(req.headers[DS_VIEWER_SECRET_HEADER], deps.secret)) {
      res.writeHead(401).end('Missing or wrong secret.');
      return;
    }

    if (req.method === 'POST' && req.url === '/plan') {
      const plan = await deps.buildPlan();
      sendJson(res, 200, plan, deps.allowedOrigin);
      return;
    }

    if (req.method === 'POST' && req.url === '/update') {
      // "Runs one update at a time; further start requests are refused while one runs" (design
      // §5) — checked before even building a fresh plan, so a second click never re-downloads
      // anything while the first update is still in flight.
      const status = deps.getStatus();
      if (starting || status.phase === 'updating' || status.phase === 'restarting') {
        sendJson(res, 409, { error: 'An update is already running.' }, deps.allowedOrigin);
        return;
      }
      starting = true;
      let plan: Awaited<ReturnType<EndpointDeps['buildPlan']>>;
      try {
        plan = await deps.buildPlan();
      } catch (error) {
        // A rejected plan must not leave `starting` stuck, or every later Update now is refused.
        starting = false;
        sendJson(res, 502, { error: (error as Error).message }, deps.allowedOrigin);
        return;
      }
      if ('error' in plan) {
        starting = false;
        sendJson(res, 502, { error: plan.error }, deps.allowedOrigin);
        return;
      }
      // "Refuses with the plan's dirty-file list ... the panel offers no override" (design §5) —
      // this is the one, authoritative refusal: even if the panel's own UI somehow let a dirty
      // plan through, the endpoint itself still never starts.
      if (plan.dirtyFiles.length > 0) {
        starting = false;
        sendJson(res, 409, { error: 'dirty-files', dirtyFiles: plan.dirtyFiles }, deps.allowedOrigin);
        return;
      }
      // Sends 202 *before* ever calling `startUpdate` — install/migrate/doctor run as real child
      // processes that can take seconds (Critical finding, Fable correction pass: calling
      // `startUpdate` first, synchronously, blocked this response until the whole update finished,
      // so the browser's `POST /update` saw a connection reset instead of 202, and every
      // `/update/status` poll during the install went unanswered). `setImmediate` defers the actual
      // work to the next turn of the event loop, after this response has already been written.
      sendJson(res, 202, { started: true }, deps.allowedOrigin);
      // Errata 3: `startUpdate` is wrapped here too — a synchronous throw inside `setImmediate`'s
      // callback would otherwise become an unhandled exception on the whole process, since there is
      // no request/response left at that point to carry the error back to.
      setImmediate(() => {
        try {
          deps.startUpdate(plan);
        } catch (error) {
          console.warn('Update could not start: ' + (error as Error).message);
        } finally {
          starting = false;
        }
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/update/dismiss' && deps.dismissStatus) {
      const phase = deps.getStatus().phase;
      if (starting || phase === 'updating' || phase === 'restarting') {
        sendJson(res, 409, { error: 'An update is running.' }, deps.allowedOrigin);
        return;
      }
      deps.dismissStatus();
      sendJson(res, 200, deps.getStatus(), deps.allowedOrigin);
      return;
    }

    if (req.method === 'POST' && req.url === '/update/resume' && deps.resumeUpdate) {
      const status = deps.getStatus();
      const step = status.phase === 'failure' ? status.step : undefined;
      if (starting || (step !== 'migrate' && step !== 'doctor')) {
        sendJson(res, 409, { error: 'There is no failed migrate or doctor step to resume.' }, deps.allowedOrigin);
        return;
      }
      // Same reasoning as POST /update: answer first, then run the work on the next tick.
      starting = true;
      sendJson(res, 202, { started: true }, deps.allowedOrigin);
      setImmediate(() => {
        try {
          deps.resumeUpdate!(step);
        } catch (error) {
          console.warn('Update could not resume: ' + (error as Error).message);
        } finally {
          starting = false;
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/update/status') {
      sendJson(res, 200, deps.getStatus(), deps.allowedOrigin);
      return;
    }

    if (req.method === 'GET' && req.url === '/version' && deps.getVersionStatus) {
      sendJson(res, 200, deps.getVersionStatus(), deps.allowedOrigin);
      return;
    }

    if (req.method === 'POST' && req.url === '/version/check' && deps.checkNow) {
      if (checking) {
        sendJson(res, 409, { error: 'A check is already running.' }, deps.allowedOrigin);
        return;
      }
      checking = true;
      try {
        sendJson(res, 200, await deps.checkNow(), deps.allowedOrigin);
      } catch (error) {
        sendJson(res, 502, { error: (error as Error).message }, deps.allowedOrigin);
      } finally {
        checking = false;
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/version/auto-check' && deps.setAutoCheck) {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        body = undefined;
      }
      const enabled = (body as { enabled?: unknown } | null)?.enabled;
      if (typeof enabled !== 'boolean') {
        sendJson(res, 400, { error: 'Expected { "enabled": true | false }.' }, deps.allowedOrigin);
        return;
      }
      try {
        sendJson(res, 200, deps.setAutoCheck(enabled), deps.allowedOrigin);
      } catch (error) {
        sendJson(res, 500, { error: (error as Error).message }, deps.allowedOrigin);
      }
      return;
    }

    res.writeHead(404).end('Not found.');
  });
}
