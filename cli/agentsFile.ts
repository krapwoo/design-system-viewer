import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const START_MARKER = '<!-- ds-viewer:start v1 -->';
const END_MARKER = '<!-- ds-viewer:end -->';

// Design §4's four numbered lines, verbatim — no heading added: the design names only these four
// lines as the section's content.
const SECTION_BODY = [
  "1. When you add or change a component's props or a token, update its \`*.catalog.tsx\` in the same change.",
  "2. Bind examples to props (\`prop\` on grid axes, \`props\` on list items) so drift is detected.",
  '3. Never invent grid cells or groups; author only combinations that exist.',
  "4. Run \`npx ds-viewer doctor\` before finishing and fix every error. Use \`npx ds-viewer explain <Page>\` to check layout; see the README's page-authoring guide.",
].join('\n');

/** Design §4 "AGENTS.md section", §1 Ownership, §2 step 3. Appends between the exact markers,
 *  creating the file when absent — never touches a byte outside them, and never runs at all once
 *  the start marker is already present, even if the rest of the file looks nothing like what this
 *  function would have written (design: "An AGENTS.md without the markers counts as missing the
 *  section" — the converse is also true: a file WITH the marker is never rewritten in 0.3). */
export function ensureAgentsFileSection(projectRoot: string): string[] {
  const agentsPath = path.join(projectRoot, 'AGENTS.md');
  const existing = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : '';
  if (existing.includes(START_MARKER)) return [];
  const separator = existing === '' ? '' : existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  writeFileSync(agentsPath, `${existing}${separator}${START_MARKER}\n${SECTION_BODY}\n${END_MARKER}\n`);
  return [agentsPath];
}
