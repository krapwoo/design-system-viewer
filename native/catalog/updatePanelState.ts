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
  | { phase: 'failure'; log: string; failedStep: string };

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
