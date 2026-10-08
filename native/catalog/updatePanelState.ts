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
