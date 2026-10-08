// cli/update.ts
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUpdatePlan, type BuildPlanOptions, type UpdatePlan } from './updatePlan.ts';
import { detectPackageManager, installUpgradeCommand, platformCommand } from './packageManager.ts';
import { readOwnVersion } from './packageVersion.ts';
import { lastSummaryLine } from './doctor.ts';
import type { ResolvedConfig } from './types.ts';

type ExecImpl = (command: string, args: string[], options: { cwd: string; encoding: 'utf8' }) => string;

export interface UpdateRunOptions {
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  confirm?: (message: string) => Promise<boolean> | boolean;
  buildPlan?: (config: ResolvedConfig, currentVersion: string, options?: BuildPlanOptions) => Promise<UpdatePlan | { error: string }>;
  execImpl?: ExecImpl;
  /** Test-only — production always reads this CLI's own installed version. */
  currentVersion?: string;
}

function formatPlanHuman(plan: UpdatePlan): string {
  const lines = [`${plan.current} → ${plan.latest}${plan.breaking ? ' (major — includes breaking changes)' : ''}`];
  if (plan.summary.length > 0) lines.push('', "What's new:", ...plan.summary.map((line) => `  - ${line}`));
  lines.push('', 'Files that would change:', ...plan.files.map((f) => `  ${f.path} (${f.dirty ? 'uncommitted' : f.reason})`));
  if (plan.kitFilesDiffering > 0) {
    lines.push('', `${plan.kitFilesDiffering} kit file${plan.kitFilesDiffering === 1 ? '' : 's'} differ from the installed kit's version. Compare with npx ds-viewer kit diff <Component>.`);
  }
  if (plan.outsideGitRepo) lines.push('', '(Not a git repository — dirty-file detection was skipped; every file above is treated as not dirty.)');
  return lines.join('\n');
}

async function defaultConfirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.log('Non-interactive stdin: rerun with --yes to accept.');
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(message);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

function installedMainJs(projectRoot: string): string {
  return path.join(projectRoot, 'node_modules', '@krapwoo', 'ds-viewer', 'dist', 'cli', 'main.js');
}

/** Design §5 "`npx ds-viewer update`", steps 1-6. */
export async function runUpdate(config: ResolvedConfig, options: UpdateRunOptions = {}): Promise<{ output: string; exitCode: number }> {
  const currentVersion = options.currentVersion ?? readOwnVersion(path.dirname(fileURLToPath(import.meta.url)));
  const plan = await (options.buildPlan ?? buildUpdatePlan)(config, currentVersion);
  if ('error' in plan) return { output: plan.error, exitCode: 1 };

  const planText = formatPlanHuman(plan);
  if (options.dryRun) return { output: planText, exitCode: 0 };

  // Step 2: refuses on any dirty planned file, unless --force — checked before the confirmation
  // prompt, so a script passing --yes without --force still gets refused instead of silently
  // overwriting uncommitted work.
  if (!options.force && plan.dirtyFiles.length > 0) {
    return {
      output: `${planText}\n\nRefusing: the following files have uncommitted changes:\n${plan.dirtyFiles.map((f) => `  ${f}`).join('\n')}\n\nCommit or stash them, or rerun with --force.`,
      exitCode: 1,
    };
  }

  if (!options.yes) {
    const proceed = await (options.confirm ?? defaultConfirm)(`${planText}\n\nUpdate to ${plan.latest}? [y/N] `);
    if (!proceed) return { output: 'Aborted: nothing was changed.', exitCode: 0 };
  }

  const execImpl: ExecImpl = options.execImpl ?? ((cmd, args, opts) => {
    const run = platformCommand(cmd, args);
    return execFileSync(run.command, run.args, { ...opts, encoding: 'utf8', shell: run.shell }) as unknown as string;
  });
  const { command, args } = installUpgradeCommand(detectPackageManager(config.projectRoot), '@krapwoo/ds-viewer', plan.latest);
  try {
    execImpl(command, args, { cwd: config.projectRoot, encoding: 'utf8' });
  } catch (error) {
    return { output: `The update stopped while installing.\n${(error as Error).message}\n\nRecover with: npx ds-viewer update`, exitCode: 1 };
  }

  // Step 4: "Re-runs the newly installed binary" — the freshly-installed package's own
  // `dist/cli/main.js`, never the one that is already running this process.
  try {
    execImpl('node', [installedMainJs(config.projectRoot), 'migrate', '--from', currentVersion], { cwd: config.projectRoot, encoding: 'utf8' });
  } catch (error) {
    return {
      output: `Installed ${plan.latest}, but migrate failed.\n${(error as Error).message}\n\nRecover with: npx ds-viewer migrate --from ${currentVersion}`,
      exitCode: 1,
    };
  }

  // M6 (Minor, Fable correction pass): the doctor step wasn't wrapped in try/catch — a crash here
  // rejected `runUpdate` itself, losing the "installed and migrated successfully" context and
  // leaving `main` to print only the raw error, mirroring `performUpdate`'s own identical guard.
  let doctorOutput: string;
  try {
    doctorOutput = execImpl('node', [installedMainJs(config.projectRoot), 'doctor'], { cwd: config.projectRoot, encoding: 'utf8' });
  } catch (error) {
    return {
      output: `Installed and migrated to ${plan.latest}, but doctor failed to run.\n${(error as Error).message}\n\nRecover with: npx ds-viewer doctor`,
      exitCode: 1,
    };
  }
  // I5 (Important, raised from Minor by the controller): only the report's own last summary line —
  // the mockup's success page shows one line, not the whole doctor report.
  return { output: `Updated to ${plan.latest}. Changes are not committed — review them in your editor.\n\n${lastSummaryLine(doctorOutput)}`, exitCode: 0 };
}
