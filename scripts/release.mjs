#!/usr/bin/env node
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const bump = process.argv[2];
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: npm run release <patch|minor|major>');
  process.exit(1);
}

const packageJsonPath = path.resolve('package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const [major, minor, patch] = packageJson.version.split('.').map(Number);
const nextVersion =
  bump === 'major' ? `${major + 1}.0.0` : bump === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;

const changesDir = path.resolve('.changes');
const noteFiles = readdirSync(changesDir).filter((file) => file.endsWith('.md') && file !== 'README.md');
if (noteFiles.length === 0) {
  console.error('No notes found under .changes/ — add one per user-visible PR before releasing.');
  process.exit(1);
}
const notes = noteFiles.map((file) => readFileSync(path.join(changesDir, file), 'utf8').trim()).sort();

const changelogPath = path.resolve('CHANGELOG.md');
const existingChangelog = readFileSync(changelogPath, 'utf8');
// The first two paragraphs are the title and its description (see CHANGELOG.md, Task 15 Step 2) —
// splitting after only the title would insert the new version entry between them.
const paragraphs = existingChangelog.split('\n\n');
const header = paragraphs.slice(0, 2);
const rest = paragraphs.slice(2);
const entry = `## ${nextVersion}\n\n${notes.map((note) => `- ${note}`).join('\n')}`;
writeFileSync(changelogPath, [...header, entry, ...rest].join('\n\n'));

packageJson.version = nextVersion;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

for (const file of noteFiles) rmSync(path.join(changesDir, file));

execSync('git add package.json CHANGELOG.md .changes', { stdio: 'inherit' });
execSync(`git commit -m "chore: release v${nextVersion}"`, { stdio: 'inherit' });
execSync(`git tag v${nextVersion}`, { stdio: 'inherit' });

console.log(`Tagged v${nextVersion}. Push with: git push origin main v${nextVersion}`);
