import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { DS_VIEWER_SECRET_HEADER } from './catalogNavigation';
import {
  autoCheckHelp, bumpLabel, checkedAgoLabel, daysAgoLabel, isAlreadyUpToDateError, resolvePanelPhase, versionOverview, type UpdatePlanView, type UpdateStatusView,
} from './updatePanelState';
import type { UpdateNotice, VersionStatus } from './types';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

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

/** Same shape as `FilesList`, but with no right-hand reason column — the `success` phase's
 *  `status.files` carries plain paths, never a reason (Task 16 Step 2 table: a dedicated,
 *  smaller render here is simplest rather than over-generalizing `FilesList` for one caller). */
function PlainFilesList({ files }: { files: string[] }) {
  return (
    <View style={styles.filesBox}>
      {files.map((path, i) => (
        <View key={path} style={[styles.fileRow, i > 0 && styles.fileRowBorder]}>
          <Text style={styles.filePath}>{path}</Text>
        </View>
      ))}
    </View>
  );
}

const NOTE_BOX_VARIANT = {
  muted: { box: { backgroundColor: CATALOG_COLOR.surfaceMuted }, text: { color: CATALOG_COLOR.text } },
  warn: { box: { backgroundColor: CATALOG_COLOR.warningSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.warningBorder }, text: { color: CATALOG_COLOR.warning } },
  err: { box: { backgroundColor: CATALOG_COLOR.dangerSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.dangerBorder }, text: { color: CATALOG_COLOR.danger } },
  ok: { box: { backgroundColor: CATALOG_COLOR.successSubtle }, text: { color: CATALOG_COLOR.success } },
} as const;

function NoteBox({ variant, children }: { variant: keyof typeof NOTE_BOX_VARIANT; children: React.ReactNode }) {
  const v = NOTE_BOX_VARIANT[variant];
  return (
    <View style={[styles.noteBox, v.box]}>
      <Text style={[styles.noteBoxText, v.text]}>{children}</Text>
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

/** The `success` phase's content, shared between the `update === null` path (Errata 1c — the
 *  normal case, since `update.json` becomes `null` once latest equals current) and the defensive
 *  `update` still non-null path. Reads `status.latest`/`status.files`/`status.doctorSummary`,
 *  never `update.latest`/`plan.files` — `plan` is gone by the time this renders (the page has
 *  reloaded onto the new version). */
function SuccessContent({ status }: { status: Extract<UpdateStatusView, { phase: 'success' }> }) {
  return (
    <>
      <View style={styles.versionsRow}>
        <Text style={styles.versionsText}>{status.latest}</Text>
        <View style={[styles.pill, styles.pillSuccess]}>
          <Text style={[styles.pillText, styles.pillTextSuccess]}>Updated</Text>
        </View>
      </View>
      <NoteBox variant="ok">
        <Text style={styles.noteBoxBold}>{`Updated to ${status.latest}.`}</Text>
        {' Changes are not committed — review them in your editor.'}
      </NoteBox>
      <View style={styles.block}>
        <Text style={styles.h3}>Changed</Text>
        <PlainFilesList files={status.files} />
      </View>
      <View style={styles.block}>
        <Text style={styles.h3}>Doctor</Text>
        <Text style={styles.muted}>{status.doctorSummary}</Text>
      </View>
    </>
  );
}

/** The `failure` phase's headline/body copy, keyed off which step failed — `runUpdate`/
 *  `performUpdate` each name their own distinct recovery command (Important finding, Fable
 *  correction pass: one hardcoded headline/body for every failure was wrong for two of the
 *  three). */
function failureCopy(failedStep: string, current: string): { headline: string; body: React.ReactNode } {
  if (/install/i.test(failedStep)) {
    return {
      headline: 'The update stopped while installing.',
      body: <>Your files weren’t migrated. Recover with <Code>npx ds-viewer update</Code> in your terminal.</>,
    };
  }
  if (/migrat/i.test(failedStep)) {
    return {
      headline: 'The update installed, but migrating failed.',
      body: <>Recover with <Code>{`npx ds-viewer migrate --from ${current}`}</Code> in your terminal.</>,
    };
  }
  return {
    headline: 'The update installed and migrated, but doctor failed to run.',
    body: <>Recover with <Code>npx ds-viewer doctor</Code> in your terminal.</>,
  };
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
}: {
  status: VersionStatus;
  endpoint?: Endpoint;
  onStatus: (next: VersionStatus) => void;
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
    setChecking(true);
    setJustChecked(false);
    setLocalError(undefined);
    try {
      const res = await authedFetch(endpoint, '/version/check', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as VersionStatus;
      // A newer version moves the whole page into the update flow (the parent re-renders with it).
      setJustChecked(next.lastOutcome === 'ok' && !next.update);
      onStatus(next);
    } catch {
      setLocalError('Couldn’t reach the viewer’s local server. If this keeps happening, restart npx ds-viewer dev.');
    } finally {
      setChecking(false);
    }
  };

  const setAutoCheck = async (enabled: boolean) => {
    if (!endpoint || saving) return;
    setSaving(true);
    setLocalError(undefined);
    try {
      const res = await authedFetch(endpoint, '/version/auto-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onStatus((await res.json()) as VersionStatus);
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
          <Pressable
            onPress={checkNow}
            disabled={checking}
            accessibilityRole="button"
            accessibilityState={{ disabled: checking, busy: checking }}
            style={[styles.secondaryButton, styles.buttonRow, checking && styles.busyButton]}
          >
            {checking && <ActivityIndicator size="small" color={CATALOG_COLOR.textMuted} />}
            <Text style={[styles.secondaryButtonText, checking && styles.busyButtonText]}>
              {checking ? 'Checking…' : overview.action === 'retry' ? 'Try again' : 'Check now'}
            </Text>
          </Pressable>
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
  const [planResult, setPlanResult] = useState<UpdatePlanView | { error: string } | undefined>(undefined);
  // Critical finding, Fable correction pass: while this is true, the endpoint's own `/update` POST
  // is in flight (re-planning before it can even start) — **Update now** must disable itself for
  // that whole window, not just once the server reports `'updating'`, or a second click fires a
  // second `POST /update` the endpoint's own `starting` flag would otherwise have to refuse.
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchStatus = useCallback(async () => {
    if (!endpoint || !isWeb()) return;
    try {
      const res = await authedFetch(endpoint, '/update/status');
      setStatus((await res.json()) as UpdateStatusView);
    } catch {
      // Errata 2a: the endpoint's own process exits mid-restart — a failed poll while an update
      // was in flight or already restarting means "still restarting," not "idle again."
      setStatus((prev) => (prev.phase === 'updating' || prev.phase === 'restarting' ? { phase: 'restarting' } : prev));
    }
  }, [endpoint]);

  const fetchPlan = useCallback(async () => {
    if (!endpoint || !isWeb()) return;
    // Important finding, Fable correction pass: an unhandled rejection here (the endpoint
    // unreachable, CORS-blocked, or mid-restart) previously left `planResult` `undefined` forever
    // — the panel sat on "Checking…" with no way out. The same error shape `buildUpdatePlan`
    // itself returns on failure drives the existing `offline` phase.
    try {
      const res = await authedFetch(endpoint, '/plan', { method: 'POST' });
      setPlanResult((await res.json()) as UpdatePlanView | { error: string });
    } catch {
      setPlanResult({ error: "Couldn't prepare the update. You may be offline, or npm didn't respond. Nothing was changed." });
    }
  }, [endpoint]);

  useEffect(() => {
    // Errata 1c: never call `fetchPlan` when there is no update to plan for.
    fetchStatus().then(() => {
      if (update) fetchPlan();
    });
  }, [fetchStatus, fetchPlan, update]);

  const phase = resolvePanelPhase(status, planResult);

  // Polls `/update/status` at a plain interval while an update is in flight — design §5 never
  // asks for push/websocket progress, only "the panel shows progress."
  useEffect(() => {
    clearInterval(pollRef.current);
    if (phase === 'updating' || phase === 'restarting') pollRef.current = setInterval(fetchStatus, 700);
    return () => clearInterval(pollRef.current);
  }, [phase, fetchStatus]);

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
    try {
      const res = await authedFetch(endpoint, '/update', { method: 'POST' });
      // A non-202 (409 dirty/already-running, or 502 "couldn't prepare") means a file was dirtied
      // — or the plan went stale — after this panel's own `ready` plan was fetched; re-fetching the
      // plan surfaces the `dirty`/`offline` phase instead of silently staying on `ready` forever
      // (Minor finding, Fable correction pass).
      if (res.status !== 202) {
        await fetchPlan();
        return;
      }
      await fetchStatus();
    } catch {
      // Important finding, Fable correction pass: same reasoning as `fetchPlan` above — a failed
      // `POST /update` must not leave the panel stuck mid-click with no way forward.
      setPlanResult({ error: "Couldn't prepare the update. You may be offline, or npm didn't respond. Nothing was changed." });
    } finally {
      setStarting(false);
    }
  }, [endpoint, fetchPlan, fetchStatus]);

  const plan = planResult && !('error' in planResult) ? planResult : undefined;

  // The breadcrumb and heading render for every phase (Important finding, Fable correction pass:
  // the approved mockup's own `frame()` always renders `<crumb>{appName} / DS Viewer</crumb>` and
  // the title "Update DS Viewer" above the 512px column — this plan previously rendered neither,
  // which also left `check:catalog`'s own "every page has a heading" check with nothing to find
  // once the footer link existed). `content` is computed per phase below, then wrapped once.
  let content: React.ReactNode = null;

  if (!update) {
    // Errata 1c: no update known (disabled, offline, or genuinely up to date). `status` still
    // reflects a just-finished update read from the (surviving) endpoint across the reload.
    content =
      status.phase === 'success' ? (
        <SuccessContent status={status} />
      ) : versionStatus ? (
        <VersionDetails status={versionStatus} endpoint={endpoint} onStatus={onVersionStatus ?? (() => {})} />
      ) : (
        <NoteBox variant="ok">You’re already up to date.</NoteBox>
      );
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
          <Pressable
            onPress={startUpdate}
            disabled={starting}
            accessibilityRole="button"
            accessibilityState={{ disabled: starting }}
            style={[styles.primaryButton, starting && styles.disabledButton]}
          >
            <Text style={[styles.primaryButtonText, starting && styles.disabledButtonText]}>Update now</Text>
          </Pressable>
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
          <Pressable
            disabled
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={[styles.primaryButton, styles.disabledButton]}
          >
            <Text style={[styles.primaryButtonText, styles.disabledButtonText]}>Update now</Text>
          </Pressable>
          <Pressable onPress={fetchPlan} accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Check again</Text>
          </Pressable>
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
          <Pressable onPress={fetchPlan} accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Try again</Text>
          </Pressable>
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
      </>
    );
  } else if (phase === 'success' && status.phase === 'success') {
    content = <SuccessContent status={status} />;
  } else if (phase === 'failure' && status.phase === 'failure') {
    const { headline, body } = failureCopy(status.failedStep, update.current);
    const failedLabel = `${status.failedStep} failed`;
    content = (
      <>
        <VersionsHeader current={update.current} latest={update.latest} breaking={update.breaking} releasedAt={update.releasedAt} />
        <NoteBox variant="err">
          <Text style={styles.noteBoxBold}>{headline}</Text>
          {' '}
          {body}
        </NoteBox>
        <Steps
          steps={[
            { label: `Downloaded ${update.latest}`, state: 'done' },
            { label: failedLabel, state: 'todo' },
          ]}
          failedStep={failedLabel}
        />
        <LogBlock>{status.log}</LogBlock>
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              if (isWeb()) navigator.clipboard?.writeText(status.log);
            }}
            accessibilityRole="button"
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Copy log</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.crumb}>{`${appName} / DS Viewer`}</Text>
      {/* react-native-web reads `aria-level`; React Native's own prop types do not declare it —
       *  the same cast `SectionBlock.tsx`'s own heading target already uses. */}
      <View ref={headingRef} tabIndex={-1} role="heading" {...({ 'aria-level': 1 } as Record<string, unknown>)} style={styles.headingTarget}>
        <Text style={styles.title}>DS Viewer updates</Text>
      </View>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: CATALOG_LAYOUT.updateContentMaxWidth },
  crumb: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
  headingTarget: { marginTop: 4, marginBottom: 6 },
  title: { fontSize: CATALOG_TYPE.pageTitle, fontWeight: '800', color: CATALOG_COLOR.text },
  code: {
    fontFamily: 'Menlo, monospace',
    fontSize: CATALOG_TYPE.sm,
    backgroundColor: CATALOG_COLOR.surfaceMuted,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  versionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  versionsText: { fontSize: 22, fontWeight: '800', color: CATALOG_COLOR.text },
  arrow: { fontSize: 22, color: CATALOG_COLOR.textMuted },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: CATALOG_COLOR.accentSubtle },
  pillMajor: { backgroundColor: CATALOG_COLOR.warningSubtle },
  pillSuccess: { backgroundColor: CATALOG_COLOR.successSubtle },
  pillText: { fontSize: CATALOG_TYPE.sm, fontWeight: '700', color: CATALOG_COLOR.accent },
  pillTextMajor: { color: CATALOG_COLOR.warning },
  pillTextSuccess: { color: CATALOG_COLOR.success },
  pillOff: { backgroundColor: CATALOG_COLOR.chip },
  pillTextOff: { color: CATALOG_COLOR.textMuted },
  facts: { marginTop: 18, borderTopWidth: 1, borderTopColor: CATALOG_COLOR.border },
  factRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: CATALOG_SPACE.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  factLabel: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
  factValue: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.text },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: CATALOG_TYPE.md, fontWeight: '700', color: CATALOG_COLOR.text },
  switch: { width: 44, height: 26 },
  switchHelp: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
  buttonRow: { flexDirection: 'row', gap: CATALOG_SPACE.sm },
  busyButton: { borderColor: CATALOG_COLOR.border },
  busyButtonText: { color: CATALOG_COLOR.textMuted },
  muted: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, marginTop: 4 },
  block: { marginTop: 18 },
  h3: { fontSize: CATALOG_TYPE.panelHeading, textTransform: 'uppercase', letterSpacing: 0.5, color: CATALOG_COLOR.text, marginBottom: 8 },
  bullet: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.text, marginVertical: 2 },
  filesBox: { borderWidth: 1, borderColor: CATALOG_COLOR.border, borderRadius: CATALOG_RADIUS.md },
  fileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12 },
  fileRowBorder: { borderTopWidth: 1, borderTopColor: CATALOG_COLOR.border },
  filePath: { fontFamily: 'Menlo, monospace', fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.text },
  fileReason: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
  fileReasonDirty: { color: CATALOG_COLOR.warning, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.md, marginTop: 20 },
  primaryButton: { height: CATALOG_LAYOUT.controlSize, paddingHorizontal: 18, borderRadius: 22, backgroundColor: CATALOG_COLOR.text, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: CATALOG_TYPE.md },
  secondaryButton: { height: CATALOG_LAYOUT.controlSize, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: CATALOG_COLOR.borderStrong, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontWeight: '700', fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.text },
  disabledButton: { backgroundColor: '#e6e6e6', borderColor: '#e6e6e6' },
  disabledButtonText: { color: '#8a8a8a' },
  noteBox: { borderRadius: CATALOG_RADIUS.md, padding: 12, marginTop: 18 },
  noteBoxText: { fontSize: CATALOG_TYPE.md },
  noteBoxBold: { fontWeight: '700' },
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
  stepIconGlyph: { fontSize: 12, fontWeight: '800', color: CATALOG_COLOR.text },
  stepLabel: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
  stepLabelNow: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.text, fontWeight: '700' },
  stepLabelFail: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.text, fontWeight: '700' },
  logBox: { backgroundColor: '#1d1d1f', borderRadius: CATALOG_RADIUS.md, padding: 12, marginTop: 8, maxHeight: 240 },
  logText: { color: '#e8e8e8', fontSize: 12, fontFamily: 'Menlo, monospace' },
});
