import type { AutoCheckSource, VersionStatus } from './types.ts';

/** The same shape as `cli/updatePlan.ts`'s `UpdatePlan` — duplicated, not imported: `native/catalog/`
 *  is the published package root and never imports from `cli/` (the reverse is normal: `cli/`
 *  already imports `native/catalog/` throughout). The endpoint's `POST /plan` response is this
 *  exact shape (confirmed by `cli/endpoint.ts`, Task 12, which forwards `cli/updatePlan.ts`'s own
 *  `UpdatePlan` verbatim as JSON). */
export interface UpdatePlanView {
  current: string;
  latest: string;
  breaking: boolean;
  summary: string[];
  releasedAt?: string;
  files: { path: string; reason: string; dirty: boolean }[];
  dirtyFiles: string[];
  kitFilesDiffering: number;
  outsideGitRepo: boolean;
}

/** The same shape as `cli/endpoint.ts`'s `UpdateStatus`, same reason as above. `updating`'s each
 *  step carries a three-way `state`, not a boolean `done` (Important finding, Fable correction
 *  pass: the approved mockup's own `updating` state shows one step mid-flight — `ic now`, a
 *  distinct icon from both `done` and the not-yet-reached `todo` — which a boolean cannot
 *  represent). `success` also carries the changed files' paths and the version just installed
 *  (Errata 1b: `update.json` becomes `null` once latest equals current, so `success` must carry
 *  its own `latest` rather than relying on the now-gone `update` prop) — Task 16's `ready` phase
 *  has `plan.files`/`plan.latest` to show the same values, but `plan` is gone by the time
 *  `success` renders (the page has reloaded onto the new version), so the result itself must carry
 *  them. */
export type UpdateStatusView =
  | { phase: 'idle' }
  | { phase: 'updating'; steps: { label: string; state: 'done' | 'now' | 'todo' }[] }
  | { phase: 'restarting' }
  | { phase: 'success'; doctorSummary: string; files: string[]; latest: string }
  | { phase: 'failure'; log: string; failedStep: string; step?: 'install' | 'migrate' | 'doctor' | 'other' };

export type UpdatePhase = 'checking' | 'ready' | 'dirty' | 'offline' | 'updating' | 'restarting' | 'success' | 'failure';

/** Minor finding, Fable correction pass: every `{ error }` previously mapped to the same
 *  `'offline'` phase regardless of *which* error — including `buildUpdatePlan`'s own "Already on
 *  the latest version" message, which is not an offline/failure condition at all. `UpdatePanel`
 *  (Task 16) still only needs one phase to key its `switch` on; it reads `result.error` itself,
 *  directly, to pick between the two copies the mockup's `offline` state and a plain "you're
 *  already up to date" note both need. */
export function phaseFromPlanResult(result: UpdatePlanView | { error: string }): 'ready' | 'dirty' | 'offline' {
  if ('error' in result) return 'offline';
  return result.dirtyFiles.length > 0 ? 'dirty' : 'ready';
}

/** `true` only for `buildUpdatePlan`'s own "Already on the latest version (…)." message — never a
 *  real failure, so `UpdatePanel`'s `offline` phase shows a plain up-to-date note instead of the
 *  "Couldn't prepare the update" error copy for this one case. */
export function isAlreadyUpToDateError(result: UpdatePlanView | { error: string }): boolean {
  return 'error' in result && result.error.startsWith('Already on the latest version');
}

/** The one function `UpdatePanel.tsx` calls to decide which of the mockup's 10 states to render.
 *  `status` (from the endpoint's own `/update/status`, authoritative once an update has started)
 *  always wins over `planResult` — a plan fetched before an update began is stale the moment one
 *  starts, and the mockup itself never shows plan content and progress content at once. While
 *  `status.phase` is `'idle'` and no plan has resolved yet (`planResult === undefined`), the panel
 *  is still in the mockup's own `'checking'` state. */
export function resolvePanelPhase(status: UpdateStatusView, planResult: UpdatePlanView | { error: string } | undefined): UpdatePhase {
  if (status.phase !== 'idle') return status.phase;
  if (planResult === undefined) return 'checking';
  return phaseFromPlanResult(planResult);
}

/** The panel's `"Released N days ago."` line — floors to whole days, never "23 hours ago" (the
 *  mockup's own example, "Released 2 days ago.", is always a whole number of days). */
export function daysAgoLabel(releasedAt: string, nowMs: number): string {
  const days = Math.floor((nowMs - Date.parse(releasedAt)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Released today.';
  if (days === 1) return 'Released 1 day ago.';
  return `Released ${days} days ago.`;
}

/** "Last checked" on the update page. */
export function checkedAgoLabel(at: string | undefined, nowMs: number): string {
  if (!at) return 'Never';
  const minutes = Math.floor((nowMs - Date.parse(at)) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export interface VersionOverview {
  pill?: 'latest' | 'off';
  line: string;
  note?: { variant: 'ok' | 'err'; bold?: string; text: string };
  /** **Check now**, or **Try again** after npm didn't answer. */
  action: 'check' | 'retry';
}

/** The update page when no newer version is known: which of "latest", "checks off", "not checked
 *  yet" and "couldn't reach npm" applies. Only a check that actually answered may say "latest".
 *  `justChecked` is true right after **Check now** found nothing newer. */
export function versionOverview(status: VersionStatus, justChecked: boolean, nowMs: number): VersionOverview {
  if (status.lastOutcome === 'unreachable') {
    const last = status.lastCheckedAt ? ` The last successful check, ${checkedAgoLabel(status.lastCheckedAt, nowMs).toLowerCase()}, found no newer version.` : '';
    return { line: `You’re on ${status.current}.`, action: 'retry', note: { variant: 'err', bold: 'Couldn’t reach npm.', text: ` You may be offline.${last}` } };
  }
  if (status.lastOutcome === 'not-run') {
    if (!status.autoCheck.enabled) {
      return { pill: 'off', line: `You’re on ${status.current}. Automatic checks are off, so this can’t tell whether a newer version exists.`, action: 'check' };
    }
    return { line: `You’re on ${status.current}. Not checked yet: automatic checks run when the viewer starts.`, action: 'check' };
  }
  // Turned off after a check answered (approved mockup state 7b); a fresh Check now still wins.
  if (!status.autoCheck.enabled && !justChecked) {
    return { pill: 'off', line: `You’re on ${status.current}. Automatic checks are off.`, action: 'check' };
  }
  return {
    pill: 'latest',
    line: 'You’re on the latest version.',
    action: 'check',
    ...(justChecked ? { note: { variant: 'ok' as const, text: 'Checked just now. No newer version.' } } : {}),
  };
}

/** The switch's helper text: where the setting in effect comes from. Only CI's environment
 *  variable locks the switch. */
export function autoCheckHelp(autoCheck: { enabled: boolean; source: AutoCheckSource }): { text: string; locked: boolean } {
  if (autoCheck.source === 'env') return { text: 'Off in this environment (DS_VIEWER_NO_UPDATE_CHECK=1).', locked: true };
  if (autoCheck.source === 'personal') {
    return { text: autoCheck.enabled ? 'Once a day, when the viewer starts. Saved for you on this computer.' : 'Turned off by you on this computer.', locked: false };
  }
  if (!autoCheck.enabled) {
    return { text: 'Off for this project (updateCheck: false in ds-viewer.config.ts). Turning it on here applies to you only.', locked: false };
  }
  return { text: 'Once a day, when the viewer starts.', locked: false };
}

/** The update's size pill. Breaking updates are always "Major" (the CLI decides that); otherwise
 *  a change in the second number is "Minor" and anything smaller "Patch". */
export function bumpLabel(current: string, latest: string, breaking: boolean): 'Major' | 'Minor' | 'Patch' {
  if (breaking) return 'Major';
  const parts = (v: string) => /^(\d+)\.(\d+)\.(\d+)/.exec(v)?.slice(1, 4).map(Number);
  const a = parts(current);
  const b = parts(latest);
  if (!a || !b) return 'Minor';
  return a[0] === b[0] && a[1] === b[1] ? 'Patch' : 'Minor';
}

export interface ResultNote {
  tone: 'ok' | 'err';
  title: string;
  description: string;
  detail: string;
  /** The terminal fallback, shown as code inside `detail` (failures only). */
  command?: string;
  /** At most two words. `dismiss` clears the note; `retry` runs the whole update again; `resume`
   *  continues from the failed migrate or doctor step. */
  action: { label: string; kind: 'dismiss' | 'retry' | 'resume' };
  hasLog: boolean;
}

/** The note shown at the top of the update page after an update finished (approved mockup
 *  2026-10-11): a header, a description, one detail line, and a bottom-left button. */
export function resultNote(
  status: Extract<UpdateStatusView, { phase: 'success' | 'failure' }>,
  current: string,
  latest?: string,
): ResultNote {
  if (status.phase === 'success') {
    return {
      tone: 'ok',
      title: `Updated to ${status.latest}`,
      description: "The changes aren't committed yet, so review them in your editor.",
      // Doctor's own summary line continues after an em dash with component counts; the note keeps
      // only the error and warning counts.
      detail: `Changed: ${status.files.join(', ') || 'nothing'} · Doctor: ${status.doctorSummary.split(' — ')[0]}`,
      action: { label: 'Got it', kind: 'dismiss' },
      hasLog: false,
    };
  }
  const failure = (title: string, description: string, command: string, action: ResultNote['action']): ResultNote => ({
    tone: 'err', title, description, detail: `You can also run ${command} in your terminal.`, command, action, hasLog: true,
  });
  switch (status.step) {
    case 'migrate':
      return failure(
        'The update installed, but migrating failed',
        `Your package is on ${latest ?? 'the new version'}, but your files still match ${current}.`,
        `npx ds-viewer migrate --from ${current}`,
        { label: 'Finish migration', kind: 'resume' },
      );
    case 'doctor':
      return failure(
        'The update installed, but doctor failed to run',
        'The update itself is done. Only the page check is missing.',
        'npx ds-viewer doctor',
        { label: 'Rerun doctor', kind: 'resume' },
      );
    case 'install':
      return failure(
        'The update stopped while installing',
        'Nothing was migrated. Retrying starts again from the download.',
        'npx ds-viewer update',
        { label: 'Retry update', kind: 'retry' },
      );
    default:
      return failure(
        'The update stopped',
        'Something unexpected went wrong. Retrying starts again from the download.',
        'npx ds-viewer update',
        { label: 'Retry update', kind: 'retry' },
      );
  }
}

/** Whether a page at this protocol and hostname can use the viewer's local endpoint. The endpoint
 *  allows exactly `http://localhost:<dev port>` — it installs packages and restarts the server —
 *  so a tunnel, a LAN address or a reverse proxy is refused before the secret is read. Comparing
 *  the page's origin with the endpoint's would be wrong: the endpoint is always on its own port. */
export function isRemoteOrigin(protocol: string, hostname: string): boolean {
  return !(protocol === 'http:' && hostname === 'localhost');
}

/** `VersionDetails`' own near-miss message, when the endpoint answered with a non-ok status (not
 *  a rejected fetch) and the page is open from a tunnelled/remote origin. Pulled out as its own
 *  function only so a test can pin it exactly — the approved design leaves this condition alone
 *  ("Keep the existing distinct remote-origin/tunnel message exactly as is"). */
export function remoteOriginLocalErrorMessage(): string {
  return 'This page is open from another address, and the viewer only takes actions from the machine it runs on. Open the catalog on that machine, or run npx ds-viewer update there.';
}

/** The result of one endpoint call, classified the one way that matters for self-healing: did
 *  `fetch` itself reject (the socket is simply gone — *unreachable*, see the implementation
 *  brief), or did it resolve with a response at all, however unhappy (401/409/502 included — the
 *  endpoint answered, so the caller's existing status/body handling is unchanged and untouched by
 *  this module). Every endpoint call on the update page routes through this one function so "one
 *  condition has one treatment" instead of each call site re-deriving it. */
export type EndpointOutcome = { kind: 'ok'; response: Response } | { kind: 'unreachable' };

export async function requestOrUnreachable(doFetch: () => Promise<Response>): Promise<EndpointOutcome> {
  try {
    return { kind: 'ok', response: await doFetch() };
  } catch {
    return { kind: 'unreachable' };
  }
}

/** Critical finding, Fable correction pass: `cli/endpoint.ts` answers a rejected `Origin` with
 *  403 and *no* CORS headers, so the browser blocks the response and the page's own `fetch`
 *  rejects — exactly like a genuinely dead socket. Without this check, that rejection was routed
 *  straight into the page-wide reachability flow, which reloads and then polls forever for a
 *  server that was never down; self-healing is meaningless for a page that can never use the
 *  endpoint in the first place (a tunnel, or `isRemoteOrigin`'s own `127.0.0.1` case). Every call
 *  site with a rejected fetch must check this *before* calling into the reachability flow, and
 *  keep showing `remoteOriginLocalErrorMessage()` instead. */
export function classifyRejectedFetch(isRemoteOriginPage: boolean): 'remote-origin' | 'unreachable' {
  return isRemoteOriginPage ? 'remote-origin' : 'unreachable';
}

/** The pre-existing offline plan-error outcome (`fetchPlan`'s own `catch`) — pulled out so the one
 *  other place that needs it (below) can't drift from this wording. */
export const PLAN_FETCH_ERROR: { error: string } = { error: "Couldn't prepare the update. You may be offline, or npm didn't respond. Nothing was changed." };

/** Correction pass 3: a background `fetchPlan` whose fetch was rejected routes through
 *  `routeUnreachableInBackground`, which refuses to act for a remote-origin page (it must never
 *  latch the page-wide `remoteOriginError` state for a call the user didn't make — correction pass
 *  #2). That refusal used to be the end of it: `planResult` stayed `undefined` forever, and
 *  `resolvePanelPhase` reads that as `'checking'` with no button and no way out. `handled` is
 *  whatever that route reports back — `true` once it has entered the reachability flow (which owns
 *  the page from there), `false` when it declined to act. Only the `false` case needs anything
 *  here: fall back to the exact same plan-error note (and working **Try again**) the pre-existing
 *  `catch` already shows for every other kind of plan failure. */
export function backgroundPlanFetchOutcome(handled: boolean): { error: string } | undefined {
  return handled ? undefined : PLAN_FETCH_ERROR;
}

/** Critical finding, Fable correction pass: the restart-handoff rule ("a failed `/update/status`
 *  poll while an update was already in flight or restarting means 'still restarting,' not
 *  unreachable") used to be decided by reading a value assigned inside the very `setStatus`
 *  updater that decided it — updaters run during React's render phase, not at dispatch, so under
 *  any pending update the read could see stale or re-invoked state. Pulled out as a pure function
 *  of the *already-committed* phase (read from a ref, never from inside an updater) so the
 *  decision is both correct and independently testable. `undefined` means "not mid-update": the
 *  caller must still classify the failure itself (unreachable vs. remote-origin, vs. a delivered
 *  but unusable response). */
export function statusPollFailureOutcome(currentPhase: UpdateStatusView['phase']): UpdateStatusView | undefined {
  return currentPhase === 'updating' || currentPhase === 'restarting' ? { phase: 'restarting' } : undefined;
}

/** Correction pass 4 (Critical): a stable endpoint address means the restarted server answers the
 *  already-open page's poll *before* Metro has served the new bundle — same host, same pinned
 *  Metro origin, same reused secret, so the poll succeeds and would otherwise accept the delivered
 *  `{ phase: 'success' }` onto the still-old page. `restarting` must be terminal for the page: only
 *  the Metro-origin reload poller (which owns the actual reload) may leave it, by delivering
 *  `'restarting'` right back — every other delivered phase while `restarting` is stale and must be
 *  ignored. */
export function acceptsDeliveredStatus(current: UpdateStatusView['phase'], next: UpdateStatusView['phase']): boolean {
  return current !== 'restarting' || next === 'restarting';
}

/** Correction pass 5 (Important): whether a just-fetched plan is the offline error note rather
 *  than a usable plan — `/plan` answers 200 with an `{ error }` body for that case, so a reached
 *  plan fetch alone doesn't mean "Everything below is current." Takes the plan straight from the
 *  fetch that produced it, never from a ref a passive effect fills in later, so this reads the
 *  value that was actually just stored. */
export function planShowsError(result?: UpdatePlanView | { error: string }): boolean {
  return result !== undefined && 'error' in result && !isAlreadyUpToDateError(result);
}

/** The approved design's unreachable-recovery states (`waiting`/`stuck` replace this page's normal
 *  content; `recovered` is a transient banner over content that's already current). Never
 *  `'ok'`/absent here — the panel represents "nothing wrong" as no `ReachabilityState` at all, the
 *  same way `UpdateStatusView`'s `idle` phase represents nothing in flight.
 *
 *  Final slice: a stable endpoint address (`cli/dev.ts` now reuses its port and secret across
 *  restarts) means an ordinary restart recovers through the `waiting` poller's own direct endpoint
 *  retry alone — no reload is needed, so there is no `reconnecting` phase anymore, and nothing in
 *  this module ever calls `window.location.reload()`. The only reload left is the user's own
 *  explicit press of **Reconnect** on `stuck`, handled entirely in `UpdatePanel.tsx`. */
export type ReachabilityPhase = 'waiting' | 'recovered' | 'stuck';

export interface ReachabilityState {
  phase: ReachabilityPhase;
  /** Consecutive failed endpoint retries while `waiting` — the bound `nextWaitingAttempt` gives up
   *  at. Meaningless (and left unchanged) for every other phase. */
  attempts: number;
}

/** ~20 seconds of 500ms retries (the same interval the existing restart flow already polls at) —
 *  long enough for someone to actually type `npx ds-viewer dev`, short enough that the page
 *  doesn't spin forever before offering the manual `Reconnect`. */
export const REACHABILITY_MAX_ATTEMPTS = 40;

/** One more failed attempt while `waiting`: advances the bounded counter and gives up once it
 *  reaches `REACHABILITY_MAX_ATTEMPTS`, exactly as the approved design's "Edge · Still not back"
 *  state requires. The caller (the `waiting` poller) only calls this when its own direct retry
 *  against the endpoint has already failed; a retry that succeeds recovers in place and never
 *  reaches this function at all. */
export function nextWaitingAttempt(current: ReachabilityState): ReachabilityState {
  const attempts = current.attempts + 1;
  return { phase: attempts >= REACHABILITY_MAX_ATTEMPTS ? 'stuck' : 'waiting', attempts };
}

/** The manual **Reconnect** button on the gave-up state: starts the same bounded cycle over from
 *  zero, exactly like the first time an endpoint call found the viewer unreachable. `UpdatePanel.tsx`
 *  pairs this with its own, separate `window.location.reload()` — one press, one reload, initiated
 *  by the user, so no marker or loop guard is needed here or anywhere else. */
export function restartReachability(): ReachabilityState {
  return { phase: 'waiting', attempts: 0 };
}

/** Called on every endpoint call that actually succeeds. Most of the time there was nothing to
 *  recover from (`current` is `undefined`) and this is a no-op — the ordinary case, which must not
 *  show a "Reconnected" banner on every routine poll. Otherwise the panel shows the approved
 *  design's auto-dismissing `recovered` note while its normal content — already current, since the
 *  endpoint itself just answered — resumes underneath. */
export function recoveredReachabilityState(current: ReachabilityState | undefined): ReachabilityState | undefined {
  if (current === undefined) return undefined;
  return { phase: 'recovered', attempts: 0 };
}

export interface ReachabilityNote {
  variant: 'muted' | 'ok';
  spinner: boolean;
  bold?: string;
  text: string;
  /** A recovery command to render in `Code`, split from its lead-in text so the component can
   *  place the two in separate `Text`/`Code` nodes. */
  hint?: { prefix: string; command: string };
}

/** The exact approved copy (`.hermes-task/approved-unreachable-states.html`) for each reachability
 *  phase — never invent wording beyond this. */
export function reachabilityNote(phase: ReachabilityPhase): ReachabilityNote {
  switch (phase) {
    case 'waiting':
      return {
        variant: 'muted',
        spinner: true,
        bold: 'The viewer isn’t running.',
        text: ' Nothing was changed. This page reconnects by itself as soon as it’s back.',
        hint: { prefix: 'Start it with ', command: 'npx ds-viewer dev' },
      };
    case 'recovered':
      return { variant: 'ok', spinner: false, text: 'Reconnected. Everything below is current.' };
    case 'stuck':
      return {
        variant: 'muted',
        spinner: false,
        bold: 'The viewer still isn’t answering.',
        text: ' Nothing was changed.',
        hint: { prefix: 'or start it with ', command: 'npx ds-viewer dev' },
      };
  }
}
