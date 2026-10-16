import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { CatalogButton } from './CatalogButton';
import { DS_VIEWER_SECRET_HEADER } from './catalogNavigation';
import {
  acceptsDeliveredStatus, autoCheckHelp, backgroundPlanFetchOutcome, bumpLabel, checkedAgoLabel, resultNote, classifyRejectedFetch, daysAgoLabel, isAlreadyUpToDateError, isRemoteOrigin,
  nextWaitingAttempt, PLAN_FETCH_ERROR, planShowsError, reachabilityNote, recoveredReachabilityState, remoteOriginLocalErrorMessage,
  requestOrUnreachable, resolvePanelPhase, restartReachability, statusPollFailureOutcome, versionOverview,
  type ReachabilityState, type UpdatePlanView, type UpdateStatusView,
} from './updatePanelState';
import type { UpdateNotice, VersionStatus } from './types';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/** The page is open from somewhere other than the machine running the viewer, so every action will
 *  be refused however healthy the server is — see `isRemoteOrigin`. */
function remoteOrigin(endpoint: Endpoint | undefined): boolean {
  if (!endpoint || !isWeb()) return false;
  return isRemoteOrigin(window.location.protocol, window.location.hostname);
}

/** Minor finding, Fable correction pass: bounds the `waiting` poller's own endpoint retry so a hung
 *  request (a firewall `DROP`, not a clean refusal) still counts as a failure instead of blocking
 *  it — and every later retry behind it — forever. */
const PROBE_TIMEOUT_MS = 3000;

/** Minor finding, correction pass 5: a single rejected `/update/status` while `updating` enters
 *  `restarting` even when the server never actually went down (a one-off network hiccup, not a
 *  real restart) — the Metro-origin probe below then never sees a failure, so it never reloads,
 *  and `restarting` is otherwise terminal in-app. Bounds how long the page waits before offering a
 *  manual way out, long enough for a real restart's own install-and-relaunch window. */
const RESTART_RELOAD_TIMEOUT_MS = 15000;

type Endpoint = { baseUrl: string; secret: string };

async function authedFetch(endpoint: Endpoint, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${endpoint.baseUrl}${path}`, { ...init, headers: { ...init.headers, [DS_VIEWER_SECRET_HEADER]: endpoint.secret } });
}

/** Everything visually shared across phases: the versions row, the file list, a colored note box,
 *  a step list, and a dark log block — one definition each, reused by every `case` below. */
function VersionsHeader({ current, latest, breaking, releasedAt }: { current: string; latest: string; breaking: boolean; releasedAt?: string }) {
  return (
    <View>
      <View style={styles.versionsRow}>
        <Text style={styles.versionsText}>{current}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.versionsText}>{latest}</Text>
        <View style={[styles.pill, breaking && styles.pillMajor]}>
          <Text style={[styles.pillText, breaking && styles.pillTextMajor]}>{bumpLabel(current, latest, breaking)}</Text>
        </View>
      </View>
      <Text style={styles.muted}>{`You’re on ${current}.${releasedAt ? ` ${daysAgoLabel(releasedAt, Date.now())}` : ''}`}</Text>
    </View>
  );
}

function FilesList({ files }: { files: UpdatePlanView['files'] }) {
  return (
    <View style={styles.block}>
      <Text style={styles.h3}>Files that would change</Text>
      <View style={styles.filesBox}>
        {files.map((file, i) => (
          <View key={file.path} style={[styles.fileRow, i > 0 && styles.fileRowBorder]}>
            <Text style={styles.filePath}>{file.path}</Text>
            <Text style={[styles.fileReason, file.dirty && styles.fileReasonDirty]}>{file.dirty ? 'uncommitted' : file.reason}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}


const NOTE_BOX_VARIANT = {
  muted: { box: { backgroundColor: CATALOG_COLOR.surfaceMuted }, text: { color: CATALOG_COLOR.text } },
  warn: { box: { backgroundColor: CATALOG_COLOR.warningSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.warningBorder }, text: { color: CATALOG_COLOR.warning } },
  err: { box: { backgroundColor: CATALOG_COLOR.dangerSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.dangerBorder }, text: { color: CATALOG_COLOR.danger } },
  ok: { box: { backgroundColor: CATALOG_COLOR.successSubtle }, text: { color: CATALOG_COLOR.success } },
} as const;

/** `spinner` is the approved mockup's own `.row .spin` treatment (waiting only) — a leading
 *  `ActivityIndicator`, the same primitive `CatalogButton`'s own `busy` state already uses, so
 *  this isn't a new component or colour. */
function NoteBox({
  variant,
  spinner,
  live,
  hint,
  children,
}: {
  variant: keyof typeof NOTE_BOX_VARIANT;
  spinner?: boolean;
  /** Only the reachability notes (`waiting`/`recovered`/`stuck`) appear, change and disappear with
   *  no user action — `ResultNoteBox` already establishes the `role="status"` pattern for its own
   *  note at :209. Every other `NoteBox` stays silent to a screen reader, same as today. */
  live?: boolean;
  /** Minor finding, Fable correction pass #2: a recovery command (e.g. `npx ds-viewer dev`) used
   *  to render outside this box, so a screen reader announced the problem via `live` but never
   *  the fix sitting right next to it. Rendered inside the same `role="status"` container so both
   *  are announced together. */
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  const v = NOTE_BOX_VARIANT[variant];
  const text = <Text style={[styles.noteBoxText, v.text]}>{children}</Text>;
  return (
    <View style={[styles.noteBox, v.box]} {...(live ? { role: 'status' as const } : {})}>
      {spinner ? (
        <View style={styles.noteBoxRow}>
          <ActivityIndicator size="small" color={CATALOG_COLOR.accent} />
          {text}
        </View>
      ) : (
        text
      )}
      {hint}
    </View>
  );
}

/** `state` is a three-way `'done' | 'now' | 'todo'` (Important finding, Fable correction pass —
 *  the approved mockup's own `updating` state shows a step mid-flight as a distinct spinner-style
 *  icon, `ic now`, never collapsed into the same boolean `done`/not-`done` the `failure` phase's
 *  own two-item list still uses below). `failedStep` marks one step `fail` regardless of its own
 *  `state` — the failure phase's steps list is built fresh, inline, never reusing `status.steps`
 *  from a prior `updating` snapshot. */
function Steps({ steps, failedStep }: { steps: { label: string; state: 'done' | 'now' | 'todo' }[]; failedStep?: string }) {
  return (
    <View style={styles.steps}>
      {steps.map((step) => {
        const failed = failedStep !== undefined && step.label === failedStep;
        const icon = failed ? 'fail' : step.state;
        return (
          <View key={step.label} style={styles.stepRow}>
            <View
              style={[
                styles.stepIcon,
                icon === 'done' && styles.stepIconDone,
                icon === 'now' && styles.stepIconNow,
                icon === 'todo' && styles.stepIconTodo,
                icon === 'fail' && styles.stepIconFail,
              ]}
            >
              <Text style={styles.stepIconGlyph}>{icon === 'done' ? '✓' : icon === 'fail' ? '!' : ''}</Text>
            </View>
            <Text style={failed ? styles.stepLabelFail : icon === 'now' ? styles.stepLabelNow : styles.stepLabel}>
              {/* Errata 10: the in-flight step reads like the mockup's "Applying 1 migration…". */}
              {icon === 'now' && !step.label.endsWith('…') ? `${step.label}…` : step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function LogBlock({ children }: { children: string }) {
  // Real npm logs run to dozens of lines; cap the height so "Copy log" stays in view. The region
  // is keyboard-focusable on web so the overflow can be scrolled without a pointer.
  return (
    <ScrollView
      style={styles.logBox}
      accessibilityLabel="Update log"
      {...(Platform.OS === 'web' ? ({ tabIndex: 0 } as Record<string, unknown>) : {})}
    >
      <Text style={styles.logText}>{children}</Text>
    </ScrollView>
  );
}

/** An inline, code-styled chip for a terminal command (the approved mockup's own `code.cmd`) —
 *  used wherever this panel's copy names a recovery command (Minor finding, Fable correction
 *  pass: the plan previously rendered every such command as plain muted text). */
function Code({ children }: { children: string }) {
  return <Text style={styles.code}>{children}</Text>;
}

/** Replaces this page's normal content for `waiting`/`stuck` (approved mockup states 1 and
 *  "Edge"): the version line stays, but the action goes unavailable rather than offering a press
 *  that cannot work (decision 3), except `stuck`'s own `Reconnect`. */
function ReachabilityOverride({
  reachability,
  header,
  actionLabel,
  onReconnect,
}: {
  reachability: ReachabilityState;
  header: React.ReactNode;
  actionLabel: string;
  onReconnect: () => void;
}) {
  const note = reachabilityNote(reachability.phase);
  return (
    <>
      {header}
      <NoteBox
        variant={note.variant}
        spinner={note.spinner}
        live
        hint={note.hint && <Text style={styles.muted}>{note.hint.prefix}<Code>{note.hint.command}</Code></Text>}
      >
        {note.bold ? <Text style={styles.noteBoxBold}>{note.bold}</Text> : null}
        {note.text}
      </NoteBox>
      <View style={styles.actions}>
        {reachability.phase === 'stuck' ? (
          <CatalogButton label="Reconnect" variant="secondary" onPress={onReconnect} />
        ) : (
          <CatalogButton label={actionLabel} disabled />
        )}
      </View>
    </>
  );
}



/**
 * The result of the last update, as a note at the top of the update page (approved mockup
 * 2026-10-11): a bold header, a description, one detail line, and a bottom-left button in the
 * note's colour. The rest of the page stays usable below it.
 */
function ResultNoteBox({
  status,
  current,
  latest,
  busy,
  onAction,
}: {
  status: Extract<UpdateStatusView, { phase: 'success' | 'failure' }>;
  current: string;
  latest?: string;
  /** Named for its one legitimate "already running" caller (`noteBusy`/`starting`), but also true
   *  while the panel is reachability-unavailable (decision 3) — a press can't work for either
   *  reason, so the button renders the same flat-grey/muted-text treatment
   *  `CatalogButton.disabled` already uses for both (Minor finding, Fable correction pass #2),
   *  rather than the full-colour fill at reduced opacity that used to read as merely pressed. */
  busy: boolean;
  onAction: (kind: 'dismiss' | 'retry' | 'resume') => void;
}) {
  const [showLog, setShowLog] = useState(false);
  const note = resultNote(status, current, latest);
  const ok = note.tone === 'ok';
  const tone = ok ? CATALOG_COLOR.success : CATALOG_COLOR.danger;
  return (
    <View style={[styles.resultNote, ok ? styles.resultNoteOk : styles.resultNoteErr]} role="status">
      <Text style={[styles.resultTitle, { color: tone }]}>{note.title}</Text>
      <Text style={[styles.resultDescription, { color: tone }]}>{note.description}</Text>
      <Text style={[styles.resultDetail, { color: tone }]}>
        {note.command ? (
          <>
            {'You can also run '}
            <Code>{note.command}</Code>
            {' in your terminal.'}
          </>
        ) : (
          note.detail
        )}
      </Text>
      <View style={styles.resultRow}>
        <Pressable
          onPress={() => onAction(note.action.kind)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => [
            styles.resultButton,
            busy ? styles.resultButtonDisabled : { backgroundColor: tone },
            pressed && !busy && styles.resultButtonPressed,
          ]}
        >
          <Text style={[styles.resultButtonText, busy && styles.resultButtonTextDisabled]}>{note.action.label}</Text>
        </Pressable>
        {note.hasLog && status.phase === 'failure' && (
          <Pressable onPress={() => setShowLog((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showLog }}>
            <Text style={[styles.resultLink, { color: tone }]}>{showLog ? 'Hide log' : 'Show log'}</Text>
          </Pressable>
        )}
      </View>
      {showLog && status.phase === 'failure' && <LogBlock>{status.log}</LogBlock>}
    </View>
  );
}

/**
 * The update page when no newer version is known (approved mockup
 * docs/design/2026-10-10-ds-viewer-update-page-always-approved.html, states 3, 4, 6, 7 and 8): the
 * installed version and which situation applies, when it last checked, the automatic-check
 * switch, and **Check now**. Without an endpoint (a static build) it shows the status only.
 */
function VersionDetails({
  status,
  endpoint,
  onStatus,
  onCheck,
  onUnreachable,
  onReachable,
}: {
  status: VersionStatus;
  endpoint?: Endpoint;
  onStatus: (next: VersionStatus) => void;
  /** Called as Check now starts (clears an update result note). */
  onCheck?: () => void;
  /** `authedFetch` itself rejected (the endpoint socket is gone) — the page-wide reachability flow
   *  takes over; this component shows nothing further for the attempt that triggered it. */
  onUnreachable?: () => void;
  /** The endpoint answered, whatever it said — clears a reachability note left over from an
   *  earlier unreachable attempt, same as every other endpoint call on this page. */
  onReachable?: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [justChecked, setJustChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const live = Boolean(endpoint) && isWeb();
  const overview = versionOverview(status, justChecked, Date.now());
  const help = autoCheckHelp(status.autoCheck);

  const checkNow = async () => {
    if (!endpoint || checking) return;
    onCheck?.();
    setChecking(true);
    setJustChecked(false);
    setLocalError(undefined);
    // `requestOrUnreachable` separates a rejected fetch (the endpoint socket is gone) from an
    // actual response (401/409/502 included) — only the former goes to the shared reachability
    // flow below; a real HTTP response keeps this `try` block's existing handling untouched.
    const outcome = await requestOrUnreachable(() => authedFetch(endpoint, '/version/check', { method: 'POST' }));
    if (outcome.kind === 'unreachable') {
      // Critical finding, Fable correction pass (C4): a rejected `Origin` (no CORS headers at
      // all) rejects `fetch` the same way a dead socket does — self-healing is meaningless for a
      // page that can never use the endpoint, so this must keep the preserved remote-origin/
      // tunnel message below instead of entering the page-wide reachability flow.
      if (classifyRejectedFetch(remoteOrigin(endpoint)) === 'remote-origin') {
        setLocalError(remoteOriginLocalErrorMessage());
      } else {
        onUnreachable?.();
      }
      setChecking(false);
      return;
    }
    try {
      const res = outcome.response;
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as VersionStatus;
      // A newer version moves the whole page into the update flow (the parent re-renders with it).
      setJustChecked(next.lastOutcome === 'ok' && !next.update);
      onStatus(next);
      onReachable?.();
    } catch {
      setLocalError(remoteOrigin(endpoint)
        // The endpoint only answers its own origin, and it can install packages and restart the
        // server — so saying "restart the viewer" here would send the reader after a fault that
        // isn't there. The page itself is fine over a tunnel; only its actions are local.
        ? remoteOriginLocalErrorMessage()
        : 'Couldn’t reach the viewer’s local server. If this keeps happening, restart npx ds-viewer dev.');
    } finally {
      setChecking(false);
    }
  };

  const setAutoCheck = async (enabled: boolean) => {
    if (!endpoint || saving) return;
    setSaving(true);
    setLocalError(undefined);
    const outcome = await requestOrUnreachable(() => authedFetch(endpoint, '/version/auto-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }));
    if (outcome.kind === 'unreachable') {
      // Same reasoning as `checkNow` above.
      if (classifyRejectedFetch(remoteOrigin(endpoint)) === 'remote-origin') {
        setLocalError(remoteOriginLocalErrorMessage());
      } else {
        onUnreachable?.();
      }
      setSaving(false);
      return;
    }
    try {
      if (!outcome.response.ok) throw new Error(String(outcome.response.status));
      onStatus((await outcome.response.json()) as VersionStatus);
      onReachable?.();
    } catch {
      setLocalError('Couldn’t save the setting. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const unreachable = status.lastOutcome === 'unreachable';
  return (
    <>
      <View style={styles.versionsRow}>
        <Text style={styles.versionsText}>{status.current}</Text>
        {overview.pill === 'latest' && (
          <View style={[styles.pill, styles.pillSuccess]}>
            <Text style={[styles.pillText, styles.pillTextSuccess]}>Latest</Text>
          </View>
        )}
        {overview.pill === 'off' && (
          <View style={[styles.pill, styles.pillOff]}>
            <Text style={[styles.pillText, styles.pillTextOff]}>Checks off</Text>
          </View>
        )}
      </View>
      <Text style={styles.muted}>{overview.line}</Text>
      {overview.note && (
        <NoteBox variant={overview.note.variant}>
          {overview.note.bold ? <Text style={styles.noteBoxBold}>{overview.note.bold}</Text> : null}
          {overview.note.text}
        </NoteBox>
      )}
      {!unreachable && (
        <View style={styles.facts}>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Last checked</Text>
            <Text style={styles.factValue}>{checkedAgoLabel(status.lastCheckedAt, Date.now())}</Text>
          </View>
          <View style={styles.factRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>Check for updates automatically</Text>
              <Text style={styles.switchHelp}>{help.text}</Text>
            </View>
            <Switch
              value={status.autoCheck.enabled}
              onValueChange={setAutoCheck}
              disabled={!live || help.locked || saving || checking}
              // React Native web passes only the label to the real input (no description), so the
              // helper text rides in the accessible name: a screen reader hears why it's on or off.
              accessibilityLabel={`Check for updates automatically. ${help.text}`}
              trackColor={{ false: '#c9c9c9', true: CATALOG_COLOR.accent }}
              thumbColor="#ffffff"
              // The approved mockup's 44 × 26 switch; React Native web's default is 40 × 20, below
              // the 24px minimum hit target.
              style={styles.switch}
              {...({ activeThumbColor: '#ffffff' } as Record<string, unknown>)}
            />
          </View>
        </View>
      )}
      {localError && <NoteBox variant="err">{localError}</NoteBox>}
      {live && (
        <View style={styles.actions}>
          <CatalogButton
            variant="secondary"
            busy={checking}
            onPress={checkNow}
            label={checking ? 'Checking…' : overview.action === 'retry' ? 'Try again' : 'Check now'}
          />
          {unreachable && !checking && <Text style={styles.muted}>or run <Code>npm view @krapwoo/ds-viewer version</Code></Text>}
        </View>
      )}
    </>
  );
}

/**
 * Design §5's update page (`#ds-viewer-update`), approved mockup direction "C · Update page".
 * Fetches `/update/status` once on mount, then `/plan` — `resolvePanelPhase` (Task 15) picks which
 * of the mockup's 10 states to render from those two pieces of data, polled (never pushed) at a
 * plain interval while an update is in flight.
 *
 * Errata 1c: `update` is `UpdateNotice | null` — `update.json` becomes `null` once latest equals
 * current, which is exactly what happens the moment a successful update's reload lands on the new
 * version. When `update` is `null`, the plan is never fetched; the panel shows the success state
 * read from `status` alone when one is in flight/just finished, else a plain up-to-date note.
 */
export function UpdatePanel({
  update,
  versionStatus,
  onVersionStatus,
  endpoint,
  appName,
  headingRef,
}: {
  update: UpdateNotice | null;
  /** When present, the no-update view shows the version, the switch and **Check now**. */
  versionStatus?: VersionStatus | null;
  onVersionStatus?: (next: VersionStatus) => void;
  endpoint?: Endpoint;
  appName: string;
  headingRef?: React.Ref<View>;
}) {
  const [status, setStatus] = useState<UpdateStatusView>({ phase: 'idle' });
  // Critical finding, Fable correction pass (C6): mirrors `status`, read instead of a value
  // assigned inside a `setStatus` updater — updaters run during React's render phase, not at
  // dispatch, so a read-after-write inside one can see stale or re-invoked state.
  const statusRef = useRef<UpdateStatusView>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const [planResult, setPlanResult] = useState<UpdatePlanView | { error: string } | undefined>(undefined);
  // Critical finding, Fable correction pass: while this is true, the endpoint's own `/update` POST
  // is in flight (re-planning before it can even start) — **Update now** must disable itself for
  // that whole window, not just once the server reports `'updating'`, or a second click fires a
  // second `POST /update` the endpoint's own `starting` flag would otherwise have to refuse.
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Important finding, Fable correction pass (I4): the catalog is a single-page app, so a probe
  // started before the user navigates away can still resolve after this component unmounts — set
  // once, on unmount, and checked after every `await` below before any state is dispatched or the
  // page is reloaded out from under whatever's there now.
  const cancelledRef = useRef(false);
  useEffect(() => () => {
    cancelledRef.current = true;
  }, []);

  // The page-wide reachability flow (approved `.hermes-task/approved-unreachable-states.html`):
  // shared by every endpoint call below and by `VersionDetails`' own calls, since the two UI modes
  // are never visible at once. `undefined` means "nothing wrong" — the same convention
  // `UpdateStatusView`'s `idle` phase already uses for "nothing in flight".
  const [reachability, setReachability] = useState<ReachabilityState | undefined>(undefined);
  const reachabilityRef = useRef<ReachabilityState | undefined>(undefined);
  useEffect(() => {
    reachabilityRef.current = reachability;
  }, [reachability]);

  // Critical finding, Fable correction pass (C4): a page that can never use the endpoint at all
  // (a tunnel, or a plain `127.0.0.1` the endpoint's own Origin check rejects) gets no
  // self-healing — see `routeUnreachable` below. Kept apart from `reachability` because the two
  // conditions are mutually exclusive and need entirely different, non-retrying treatment.
  const [remoteOriginError, setRemoteOriginError] = useState(false);

  // Called by `routeUnreachable` below for a rejected fetch this page can actually recover from.
  // Final slice: a stable endpoint address means the `waiting` poller's own direct endpoint retry
  // (below) is the whole recovery mechanism, so this just advances the bounded attempt counter —
  // no origin probe, no reload, no marker.
  const markUnreachable = useCallback(() => {
    if (!isWeb()) return;
    setReachability((prev) => nextWaitingAttempt(prev ?? { phase: 'waiting', attempts: 0 }));
  }, []);

  // Critical finding, Fable correction pass (C4): the one place every rejected-fetch call site on
  // this page routes through. `cli/endpoint.ts` answers a rejected `Origin` with no CORS headers
  // at all, so the browser blocks the response and `fetch` rejects exactly like a dead socket —
  // without this check first, that rejection used to enter the reachability flow and reload, then
  // sit there "still not answering" forever, for a page that was never going to be able to act
  // regardless.
  const routeUnreachable = useCallback(() => {
    if (classifyRejectedFetch(remoteOrigin(endpoint)) === 'remote-origin') {
      setRemoteOriginError(true);
      return;
    }
    markUnreachable();
  }, [endpoint, markUnreachable]);

  // Important finding, Fable correction pass #2: a background poll (`fetchStatus`/`fetchPlan`,
  // both run unprompted on mount and on a plain interval) must never latch `remoteOriginError` —
  // that replaces the whole page with a red error for every non-`localhost` page (a tunnel, LAN
  // address, reverse proxy, or plain `127.0.0.1`) the instant it loads, something the user never
  // triggered. Only a user-initiated call (`startUpdate`, `dismissResult`, `resumeResult`, and
  // `VersionDetails`' own handlers, which already own their local copy of the message) may show
  // that error, via `routeUnreachable` above. A genuinely unreachable endpoint (not a
  // remote-origin refusal) still enters the reachability flow either way.
  // Correction pass 3: reports back whether it actually did anything (`true` once it has entered
  // the reachability flow, `false` when it declined to for a remote-origin page) — a background
  // caller that can't just swallow a refusal (`fetchPlan` below) needs to know so it can apply its
  // own fallback instead of leaving required state unset.
  const routeUnreachableInBackground = useCallback((): boolean => {
    if (classifyRejectedFetch(remoteOrigin(endpoint)) === 'remote-origin') return false;
    markUnreachable();
    return true;
  }, [endpoint, markUnreachable]);

  // Called by any endpoint call on this page that got a real response — clears a reachability
  // note left over from an earlier unreachable attempt (a no-op the vast majority of the time).
  const markReachable = useCallback(() => {
    if (!isWeb()) return;
    // Important finding, Fable correction pass (I2): computed from the ref, not from inside the
    // `setReachability` updater — a re-invoked updater could otherwise read the state it just set
    // on a prior invocation and settle back on "nothing to recover," silently losing the approved
    // "Reconnected." note.
    const next = recoveredReachabilityState(reachabilityRef.current);
    if (next) setReachability(next);
  }, []);

  // "Recovered: … auto-dismissing" (approved design) — a plain timeout, cleared on unmount or on
  // leaving the state early (e.g. another unreachable attempt right after recovering).
  useEffect(() => {
    if (reachability?.phase !== 'recovered') return;
    const timeout = setTimeout(() => setReachability(undefined), 3000);
    return () => clearTimeout(timeout);
  }, [reachability?.phase]);

  // Part 3 (final slice): one explicit, user-initiated reload — the only reload left anywhere in
  // this flow. Restarts the bounded cycle first so that if `window.location.reload()` turns out
  // to be a no-op (some embedded webviews block it), the page falls back to retrying the endpoint
  // in place instead of sitting on `stuck` with a press that silently did nothing.
  const reconnect = useCallback(() => {
    if (!isWeb()) return;
    setReachability(restartReachability());
    window.location.reload();
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!endpoint || !isWeb()) return;
    const outcome = await requestOrUnreachable(() => authedFetch(endpoint, '/update/status'));
    if (outcome.kind === 'unreachable') {
      // Errata 2a: a failed poll while an update was in flight or already restarting means "still
      // restarting," not unreachable — the dedicated restart-handoff effect below already owns
      // that recovery, so this page-wide flow only takes over for every other phase.
      const fallback = statusPollFailureOutcome(statusRef.current.phase);
      if (fallback) {
        setStatus(fallback);
      } else {
        routeUnreachableInBackground();
      }
      return;
    }
    try {
      // Critical finding, Fable correction pass (C1): a delivered-but-unusable response (a stale
      // secret on a reused port answers 401 `text/plain`, with CORS headers, so it's delivered and
      // `.json()` rejects) is not "unreachable" — the endpoint answered — so it must not enter the
      // reachability flow; fall back the same way a failed poll mid-update already does.
      if (!outcome.response.ok) throw new Error(String(outcome.response.status));
      const next = (await outcome.response.json()) as UpdateStatusView;
      // Correction pass 4 (Critical): once restarted, this poll reaches the server on the same
      // reused address and succeeds before Metro has served the new bundle — only the Metro-origin
      // reload poller below may move the page out of `restarting`.
      if (acceptsDeliveredStatus(statusRef.current.phase, next.phase)) setStatus(next);
      markReachable();
    } catch {
      const fallback = statusPollFailureOutcome(statusRef.current.phase);
      if (fallback) setStatus(fallback);
    }
  }, [endpoint, routeUnreachableInBackground, markReachable]);

  // Part 4 (final slice): returns whether the endpoint was actually reached, so a caller that's
  // about to claim "Reconnected. Everything below is current." (the waiting poller's success
  // branch, below) can gate that claim on this fetch having actually succeeded, instead of
  // assuming it did just because an earlier call in the same tick did.
  // Correction pass 5 (Important): also returns the plan it just stored, taken from the fetch
  // itself rather than left for the caller to read back from a ref — a ref filled in by a passive
  // effect only updates once React flushes effects after this render, which is always later than
  // the very next line of an async caller, so that read would deterministically see the prior
  // plan, never this one.
  const fetchPlan = useCallback(async (): Promise<{ reached: boolean; result?: UpdatePlanView | { error: string } }> => {
    if (!endpoint || !isWeb()) return { reached: true };
    // Important finding, Fable correction pass: an unhandled rejection here (the endpoint
    // unreachable, CORS-blocked, or mid-restart) previously left `planResult` `undefined` forever
    // — the panel sat on "Checking…" with no way out. The same error shape `buildUpdatePlan`
    // itself returns on failure drives the existing `offline` phase. A genuinely unreachable
    // endpoint (the socket itself is gone) now goes through the shared reachability flow instead.
    const outcome = await requestOrUnreachable(() => authedFetch(endpoint, '/plan', { method: 'POST' }));
    if (outcome.kind === 'unreachable') {
      // Correction pass 3: a remote-origin page's refusal leaves `routeUnreachableInBackground`
      // reporting `false` — apply the same offline plan-error outcome the `catch` below already
      // shows for every other plan failure, rather than leaving `planResult` (and the panel) stuck
      // on `undefined`/"Checking…" forever.
      const fallback = backgroundPlanFetchOutcome(routeUnreachableInBackground());
      if (fallback) setPlanResult(fallback);
      return { reached: false };
    }
    try {
      // Critical finding, Fable correction pass (C1): see `fetchStatus` above — a delivered 401
      // (stale secret) must fall back to the pre-existing offline plan-error note, with a working
      // **Try again**, instead of hanging forever on a rejected `.json()`.
      if (!outcome.response.ok) throw new Error(String(outcome.response.status));
      const result = (await outcome.response.json()) as UpdatePlanView | { error: string };
      setPlanResult(result);
      markReachable();
      return { reached: true, result };
    } catch {
      setPlanResult(PLAN_FETCH_ERROR);
      return { reached: true, result: PLAN_FETCH_ERROR };
    }
  }, [endpoint, routeUnreachableInBackground, markReachable]);

  useEffect(() => {
    // Errata 1c: never call `fetchPlan` when there is no update to plan for.
    fetchStatus().then(() => {
      if (update) fetchPlan();
    });
  }, [fetchStatus, fetchPlan, update]);

  // Final slice: with a stable endpoint address, this direct retry is the whole recovery
  // mechanism — no origin probe, no reload. A restart lands on the same port and secret, so this
  // keeps failing only while the viewer is actually down, and succeeds the moment it's back.
  useEffect(() => {
    if (!isWeb() || !endpoint || reachability?.phase !== 'waiting') return;
    // Important finding, Fable correction pass (I4): stacked probes (if one tick's probe is still
    // in flight when the next fires) are refused rather than piling up.
    let inFlight = false;
    const interval = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        // Minor finding, Fable correction pass #2: this retry sits behind the `inFlight` latch
        // above with no timeout of its own — a hung request (a firewall `DROP` on the stale port,
        // not a clean refusal) would otherwise pin `inFlight` forever, blocking every later probe
        // and never reaching `stuck`.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
        let outcome: Awaited<ReturnType<typeof requestOrUnreachable>>;
        try {
          outcome = await requestOrUnreachable(() => authedFetch(endpoint, '/update/status', { signal: controller.signal }));
        } finally {
          clearTimeout(timeout);
        }
        if (cancelledRef.current) return;
        if (outcome.kind === 'ok' && outcome.response.ok) {
          // Important finding, Fable correction pass #2: `markReachable` only flips the
          // reachability phase to `recovered` — it never refreshes `status` or re-runs
          // `fetchPlan`, so the note's "Everything below is current" was false by construction,
          // and a page still waiting on its first plan (`planResult === undefined` at mount)
          // was left stranded on "Checking…" with no way out. Feed the response through, and
          // refresh the plan too, *before* calling `markReachable` — so the claim is true by
          // the time it's shown.
          try {
            setStatus((await outcome.response.json()) as UpdateStatusView);
          } catch {
            // The regular poll (once `phase` leaves `waiting`) retries `/update/status` on its
            // own; `markReachable` below still ends the reachability flow cleanly.
          }
          // Part 4: a delivered status does not, by itself, make "Everything below is current"
          // true — the plan refresh it's paired with must also have actually reached the
          // endpoint. Without this gate, a plan fetch that failed right after a successful status
          // poll still showed the recovered note while the endpoint was gone, tore the poller
          // down, and could strand the panel on "Checking…" with no button.
          const planOutcome = update ? await fetchPlan() : { reached: true };
          if (cancelledRef.current) return;
          // Minor finding, correction pass 4: `/plan` answers 200 with an `{ error }` body for the
          // offline case, so a reached-but-erroring plan still leaves this reached — showing
          // "Reconnected. Everything below is current." directly above the red offline note it
          // contradicts. Suppress the note instead of changing the gate above: leave the page on
          // its `offline` state (with a working **Try again**) rather than reporting a reachability
          // failure, which would distort the waiting poller's own bounded-attempt counter.
          // Correction pass 5 (Important): `planShowsError` reads `planOutcome.result` — the value
          // this very `fetchPlan()` call just stored — never a ref a passive effect fills in later.
          if (planOutcome.reached) {
            if (planShowsError(planOutcome.result)) setReachability(undefined);
            else markReachable();
          }
          return;
        }
        setReachability((prev) => (prev && prev.phase === 'waiting' ? nextWaitingAttempt(prev) : prev));
      } finally {
        inFlight = false;
      }
    }, 500);
    return () => clearInterval(interval);
  }, [reachability?.phase, endpoint, markReachable, fetchPlan, update]);

  // A finished update (success or failure) shows as a note at the top; the page under it behaves
  // as if idle, so Check now, the switch and a newer update all keep working.
  const result = status.phase === 'success' || status.phase === 'failure' ? status : undefined;
  const phase = resolvePanelPhase(result ? { phase: 'idle' } : status, planResult);
  const [noteBusy, setNoteBusy] = useState(false);
  const dismissResult = useCallback(async () => {
    if (!endpoint || !isWeb()) return;
    // Important finding, Fable correction pass (I3): routed through the same reachability flow as
    // every other endpoint call, instead of silently swallowing a rejected fetch with **Got it**
    // left doing nothing visible.
    const outcome = await requestOrUnreachable(() => authedFetch(endpoint, '/update/dismiss', { method: 'POST' }));
    if (outcome.kind === 'unreachable') {
      routeUnreachable();
      return;
    }
    try {
      if (!outcome.response.ok) throw new Error(String(outcome.response.status));
      setStatus((await outcome.response.json()) as UpdateStatusView);
      markReachable();
    } catch {
      // The note stays; the next status poll or reload settles it.
    }
  }, [endpoint, routeUnreachable, markReachable]);

  // Important finding, Fable correction pass (I3): **Finish migration** / **Rerun doctor** had no
  // guard at all — a rejected fetch here did nothing visible. Routed through the same reachability
  // flow as every other endpoint call.
  const resumeResult = useCallback(async () => {
    if (!endpoint || !isWeb()) return;
    const outcome = await requestOrUnreachable(() => authedFetch(endpoint, '/update/resume', { method: 'POST' }));
    if (outcome.kind === 'unreachable') {
      routeUnreachable();
      return;
    }
    markReachable();
    await fetchStatus();
  }, [endpoint, routeUnreachable, markReachable, fetchStatus]);

  // Polls `/update/status` at a plain interval while an update is in flight — design §5 never
  // asks for push/websocket progress, only "the panel shows progress."
  useEffect(() => {
    clearInterval(pollRef.current);
    if (phase === 'updating' || phase === 'restarting') pollRef.current = setInterval(fetchStatus, 700);
    return () => clearInterval(pollRef.current);
  }, [phase, fetchStatus]);

  // Minor finding, correction pass 5: offers a manual way out of `restarting` once it's held for
  // longer than a real restart should take — the one case the bounded Metro-origin probe below
  // cannot resolve on its own (the server never actually went down, so it never sees a failure).
  const [restartTimedOut, setRestartTimedOut] = useState(false);
  useEffect(() => {
    if (phase !== 'restarting') {
      setRestartTimedOut(false);
      return;
    }
    const timeout = setTimeout(() => setRestartTimedOut(true), RESTART_RELOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [phase]);

  // Restart handoff step 4 (design §5): once the server reports "restarting", Metro itself (not
  // this endpoint — the endpoint's own process is about to exit) is polled on the *page's own
  // origin* until it answers again, then the page reloads onto the new version. Errata 2b: reload
  // only once at least one probe has already failed, so the old Metro answering briefly (before
  // it actually goes down) can't cause a reload loop back onto the old version.
  useEffect(() => {
    if (phase !== 'restarting' || !isWeb()) return;
    let hadFailure = false;
    const interval = setInterval(() => {
      fetch(window.location.origin, { method: 'HEAD' })
        .then((res) => {
          // Important finding, Fable correction pass (I4): the catalog is a single-page app — a
          // probe started before the user navigated away can still resolve after unmount.
          if (cancelledRef.current) return;
          if (res.ok && hadFailure) {
            clearInterval(interval);
            window.location.reload();
          }
        })
        .catch(() => {
          hadFailure = true; // still restarting — keep polling.
        });
    }, 500);
    return () => clearInterval(interval);
  }, [phase]);

  const startUpdate = useCallback(async () => {
    if (!endpoint) return;
    setStarting(true);
    // Critical finding, Fable correction pass (C2): `try`/`finally` so a rejection from
    // `fetchPlan()`/`fetchStatus()` below can never leave **Update now** disabled on "Starting…"
    // until a manual reload.
    try {
      // Important finding, Fable correction pass: a failed `POST /update` must not leave the panel
      // stuck mid-click with no way forward — a genuinely unreachable endpoint now goes through the
      // shared reachability flow instead of the offline plan-error text.
      const outcome = await requestOrUnreachable(() => authedFetch(endpoint, '/update', { method: 'POST' }));
      if (outcome.kind === 'unreachable') {
        routeUnreachable();
        return;
      }
      // A non-202 (409 dirty/already-running, or 502 "couldn't prepare") means a file was dirtied
      // — or the plan went stale — after this panel's own `ready` plan was fetched; re-fetching the
      // plan surfaces the `dirty`/`offline` phase instead of silently staying on `ready` forever
      // (Minor finding, Fable correction pass).
      if (outcome.response.status !== 202) {
        await fetchPlan();
      } else {
        await fetchStatus();
      }
    } finally {
      setStarting(false);
    }
  }, [endpoint, fetchPlan, fetchStatus, routeUnreachable]);

  const plan = planResult && !('error' in planResult) ? planResult : undefined;

  // The breadcrumb and heading render for every phase (Important finding, Fable correction pass:
  // the approved mockup's own `frame()` always renders `<crumb>{appName} / DS Viewer</crumb>` and
  // the title "Update DS Viewer" above the 512px column — this plan previously rendered neither,
  // which also left `check:catalog`'s own "every page has a heading" check with nothing to find
  // once the footer link existed). `content` is computed per phase below, then wrapped once.
  let content: React.ReactNode = null;

  // Takes priority over every other phase below — it replaces whichever of the two UI modes
  // (an update pending, or just the installed version) was about to render, since neither can be
  // trusted while the endpoint itself is unreachable. Never shown mid-restart: that recovery is
  // already owned by the dedicated restart-handoff effect above (see `fetchStatus`).
  const reachabilityOverride = reachability && reachability.phase !== 'recovered' && phase !== 'updating' && phase !== 'restarting';

  if (remoteOriginError) {
    // Critical finding, Fable correction pass (C4): a page that can never use the endpoint gets
    // no self-healing at all — just the preserved remote-origin/tunnel message, with nothing to
    // retry (there is nothing a reload or a probe could fix here).
    content = (
      <>
        {update ? (
          <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        ) : versionStatus ? (
          <View style={styles.versionsRow}><Text style={styles.versionsText}>{versionStatus.current}</Text></View>
        ) : null}
        <NoteBox variant="err">{remoteOriginLocalErrorMessage()}</NoteBox>
      </>
    );
  } else if (reachabilityOverride && reachability) {
    content = (
      <ReachabilityOverride
        reachability={reachability}
        header={update ? (
          <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        ) : versionStatus ? (
          // Minor finding, Fable correction pass: without `versionStatus` there's no version to
          // show at all — fall back to the note-only layout instead of an empty 2xl row.
          <View style={styles.versionsRow}><Text style={styles.versionsText}>{versionStatus.current}</Text></View>
        ) : null}
        actionLabel={update ? 'Update now' : 'Check now'}
        onReconnect={reconnect}
      />
    );
  } else if (!update) {
    // Errata 1c: no update known (disabled, offline, or genuinely up to date). `status` still
    // reflects a just-finished update read from the (surviving) endpoint across the reload.
    content = versionStatus ? (
        <VersionDetails
          status={versionStatus}
          endpoint={endpoint}
          onStatus={onVersionStatus ?? (() => {})}
          onCheck={result ? dismissResult : undefined}
          onUnreachable={markUnreachable}
          onReachable={markReachable}
        />
      ) : (
        <NoteBox variant="ok">You’re already up to date.</NoteBox>
      );
  } else if (result?.phase === 'failure') {
    // The failure note's own button is the recovery; don't offer Update now twice.
    content = <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />;
  } else if (phase === 'ready' && plan) {
    content = (
      <>
        <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        {update.summary.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.h3}>What’s new</Text>
            {update.summary.map((line) => (
              <Text key={line} style={styles.bullet}>{`•  ${line}`}</Text>
            ))}
          </View>
        )}
        <FilesList files={plan.files} />
        {plan.kitFilesDiffering > 0 && (
          <Text style={styles.muted}>
            {`${plan.kitFilesDiffering} starter-kit file${plan.kitFilesDiffering === 1 ? '' : 's'} differ from ${update.latest}’s kit. ` +
              'They’re yours and are never changed. Compare with npx ds-viewer kit diff <Component>.'}
          </Text>
        )}
        {plan.outsideGitRepo && (
          <Text style={styles.muted}>Not a git repository, so uncommitted changes couldn’t be checked.</Text>
        )}
        <View style={styles.actions}>
          <CatalogButton label="Update now" onPress={startUpdate} disabled={starting} />
          {starting ? <Text style={styles.muted}>Starting…</Text> : <Text style={styles.muted}>or run <Code>npx ds-viewer update</Code></Text>}
        </View>
      </>
    );
  } else if (phase === 'checking') {
    content = (
      <>
        <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        <NoteBox variant="muted">Checking what this update would change…</NoteBox>
        {update.summary.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.h3}>What’s new</Text>
            {update.summary.map((line) => (
              <Text key={line} style={styles.bullet}>{`•  ${line}`}</Text>
            ))}
          </View>
        )}
      </>
    );
  } else if (phase === 'dirty' && plan) {
    content = (
      <>
        <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        <NoteBox variant="warn">
          <Text style={styles.noteBoxBold}>{`${plan.dirtyFiles.length} file${plan.dirtyFiles.length === 1 ? '' : 's'} ${plan.dirtyFiles.length === 1 ? 'has' : 'have'} uncommitted changes.`}</Text>
          {' Commit or stash them, then check again.'}
        </NoteBox>
        <FilesList files={plan.files} />
        <View style={styles.actions}>
          <CatalogButton label="Update now" disabled />
          <CatalogButton label="Check again" variant="secondary" onPress={fetchPlan} />
        </View>
      </>
    );
  } else if (phase === 'offline') {
    content = isAlreadyUpToDateError(planResult!) ? (
      <>
        <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        <NoteBox variant="ok">You’re already up to date.</NoteBox>
      </>
    ) : (
      <>
        <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        <NoteBox variant="err">
          <Text style={styles.noteBoxBold}>Couldn’t prepare the update.</Text>
          {' You may be offline, or npm didn’t respond. Nothing was changed.'}
        </NoteBox>
        <View style={styles.actions}>
          <CatalogButton label="Try again" variant="secondary" onPress={fetchPlan} />
          <Text style={styles.muted}>or run <Code>npx ds-viewer update</Code></Text>
        </View>
      </>
    );
  } else if (phase === 'updating' && status.phase === 'updating') {
    content = (
      <>
        <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        <Text style={[styles.h3, styles.block]}>Updating</Text>
        <Steps steps={status.steps} />
        <Text style={styles.muted}>Keep this tab open. The viewer restarts on its own when the update finishes.</Text>
      </>
    );
  } else if (phase === 'restarting') {
    content = (
      <>
        <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        <NoteBox variant="muted">
          <Text style={styles.noteBoxBold}>{`Restarting the viewer on ${update.latest}…`}</Text>
          {' This page reloads by itself.'}
        </NoteBox>
        <Text style={styles.muted}>If it doesn’t come back, run <Code>npx ds-viewer dev</Code> in your terminal.</Text>
        {restartTimedOut && (
          <View style={styles.actions}>
            <CatalogButton label="Reload" variant="secondary" onPress={() => isWeb() && window.location.reload()} />
          </View>
        )}
      </>
    );

  }

  const recoveredNote = reachability?.phase === 'recovered' ? reachabilityNote('recovered') : undefined;

  return (
    <View style={styles.wrap}>
      <Text style={styles.crumb}>{`${appName} / DS Viewer`}</Text>
      {/* react-native-web reads `aria-level`; React Native's own prop types do not declare it —
       *  the same cast `SectionBlock.tsx`'s own heading target already uses. */}
      <View ref={headingRef} tabIndex={-1} role="heading" {...({ 'aria-level': 1 } as Record<string, unknown>)} style={styles.headingTarget}>
        <Text style={styles.title}>DS Viewer updates</Text>
      </View>
      {result && (
        <ResultNoteBox
          status={result}
          current={update?.current ?? versionStatus?.current ?? ''}
          latest={update?.latest}
          // Important finding, Fable correction pass (I3): disabled while unreachable (or on a
          // page that can never be) — otherwise the calm reachability note and a live, enabled
          // **Retry update** / **Finish migration** / **Rerun doctor** show together, for the
          // panel's most consequential buttons, contradicting decision 3.
          busy={noteBusy || starting || remoteOriginError || Boolean(reachability && reachability.phase !== 'recovered')}
          onAction={async (kind) => {
            if (!endpoint) return;
            setNoteBusy(true);
            try {
              if (kind === 'dismiss') await dismissResult();
              else if (kind === 'retry') await startUpdate();
              else await resumeResult();
            } finally {
              setNoteBusy(false);
            }
          }}
        />
      )}
      {recoveredNote && (
        // Minor finding, Fable correction pass: reads `variant`/`spinner` from the same
        // `reachabilityNote('recovered')` the copy comes from, instead of hardcoding `variant="ok"`
        // separately, so the approved copy and its treatment have one source.
        <NoteBox variant={recoveredNote.variant} spinner={recoveredNote.spinner} live>
          {recoveredNote.text}
        </NoteBox>
      )}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: CATALOG_LAYOUT.updateContentMaxWidth },
  resultNote: { borderRadius: CATALOG_RADIUS.md, padding: 14, marginTop: 12, marginBottom: 18, gap: 4 },
  resultNoteOk: { backgroundColor: CATALOG_COLOR.successSubtle },
  resultNoteErr: { backgroundColor: CATALOG_COLOR.dangerSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.dangerBorder },
  resultTitle: { ...CATALOG_TEXT.heading3 },
  resultDescription: { ...CATALOG_TEXT.caption },
  resultDetail: { ...CATALOG_TEXT.caption },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.md, marginTop: 8 },
  // The catalog's smallest control size (the major banner's close button), filled in the note's colour.
  resultButton: { height: 32, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resultButtonPressed: { opacity: 0.8 },
  // Minor finding, Fable correction pass #2: the same flat-grey treatment `CatalogButton.disabled`
  // uses, so "unavailable" doesn't read as merely "pressed" (the note's own full-colour fill at
  // reduced opacity).
  resultButtonDisabled: { backgroundColor: CATALOG_COLOR.controlDisabled },
  resultButtonText: { ...CATALOG_TEXT.captionStrong, color: '#ffffff' },
  resultButtonTextDisabled: { color: CATALOG_COLOR.controlDisabledText },
  resultLink: { ...CATALOG_TEXT.captionStrong, textDecorationLine: 'underline' },
  crumb: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  headingTarget: { marginTop: 4, marginBottom: 6 },
  title: { ...CATALOG_TEXT.pageTitle, color: CATALOG_COLOR.text },
  code: {
    ...CATALOG_TEXT.codeSmall,
    backgroundColor: CATALOG_COLOR.surfaceMuted,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  versionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  versionsText: { ...CATALOG_TEXT.heading1, color: CATALOG_COLOR.text },
  arrow: { ...CATALOG_TEXT.heading1, color: CATALOG_COLOR.textMuted },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: CATALOG_COLOR.accentSubtle },
  pillMajor: { backgroundColor: CATALOG_COLOR.warningSubtle },
  pillSuccess: { backgroundColor: CATALOG_COLOR.successSubtle },
  pillText: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.accent },
  pillTextMajor: { color: CATALOG_COLOR.warning },
  pillTextSuccess: { color: CATALOG_COLOR.success },
  pillOff: { backgroundColor: CATALOG_COLOR.chip },
  pillTextOff: { color: CATALOG_COLOR.textMuted },
  facts: { marginTop: 18, borderTopWidth: 1, borderTopColor: CATALOG_COLOR.border },
  factRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: CATALOG_SPACE.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  factLabel: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted },
  factValue: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.text },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text },
  switch: { width: 44, height: 26 },
  switchHelp: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  muted: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginTop: 4 },
  block: { marginTop: 18 },
  h3: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.text, marginBottom: 8 },
  bullet: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.text, marginVertical: 2 },
  filesBox: { borderWidth: 1, borderColor: CATALOG_COLOR.border, borderRadius: CATALOG_RADIUS.md },
  fileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12 },
  fileRowBorder: { borderTopWidth: 1, borderTopColor: CATALOG_COLOR.border },
  filePath: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.text },
  fileReason: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  fileReasonDirty: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.warning },
  actions: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.md, marginTop: 20 },
  noteBox: { borderRadius: CATALOG_RADIUS.md, padding: 12, marginTop: 18 },
  noteBoxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noteBoxText: { ...CATALOG_TEXT.body, flexShrink: 1 },
  noteBoxBold: { ...CATALOG_TEXT.bodyStrong },
  steps: { marginTop: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  stepIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepIconDone: { backgroundColor: CATALOG_COLOR.successSubtle },
  // The mockup's own `.ic.now` is a CSS-animated half-ring spinner (`border-right-color:
  // transparent`); a static accent-colored ring reads clearly enough here without introducing
  // this file's first animation for a step that is, in practice, on screen for a few seconds.
  stepIconNow: { borderWidth: 2, borderColor: CATALOG_COLOR.accent },
  stepIconTodo: { borderWidth: 2, borderColor: CATALOG_COLOR.borderStrong },
  stepIconFail: { backgroundColor: CATALOG_COLOR.dangerSubtle },
  stepIconGlyph: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  stepLabel: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted },
  stepLabelNow: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text },
  stepLabelFail: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text },
  logBox: { backgroundColor: '#1d1d1f', borderRadius: CATALOG_RADIUS.md, padding: 12, marginTop: 8, maxHeight: 240 },
  logText: { ...CATALOG_TEXT.codeSmall, color: '#e8e8e8' },
});
