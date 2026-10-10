#!/usr/bin/env node
// Prints one version's CHANGELOG.md section (its bullets, without the heading). Used by
// .github/workflows/release.yml as the GitHub release body, which the viewer's update page reads
// back as "What's new" (cli/updateCheck.ts → extractSummaryBullets).
//
//   node scripts/changelogSection.mjs 0.4.5
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The body under `## <version>`, up to the next `## ` heading, trimmed; undefined when absent. */
export function changelogSection(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return body || undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const version = process.argv[2];
  const section = version && changelogSection(readFileSync('CHANGELOG.md', 'utf8'), version);
  if (!section) {
    console.error(`CHANGELOG.md has no entry for ${version ?? '(no version given)'}.`);
    process.exit(1);
  }
  console.log(section);
}
