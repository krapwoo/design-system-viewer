// Assembling one CHANGELOG entry from the `.changes/` notes. Its own module because
// `scripts/release.mjs` does its work at import time (it reads the notes, rewrites files and
// tags), so importing that from a test would cut a release.
/** One note as one markdown bullet.
 *
 *  A note may run to several paragraphs, but only its first line gets the `- ` marker. Every later
 *  line is indented by two spaces so it stays inside that bullet; left at column 0 the paragraphs
 *  render as separate top-level prose, detached from the note they belong to.
 */
export function toBullet(note) {
  const [first, ...rest] = note.split('\n');
  return [`- ${first}`, ...rest.map((line) => (line.trim() ? `  ${line}` : line))].join('\n');
}

/** The full `## <version>` entry for a release, from its notes in order. */
export function changelogEntry(version, notes) {
  return `## ${version}\n\n${notes.map(toBullet).join('\n')}`;
}
