# Change notes

Add one Markdown file here per pull request that changes user-visible behavior — a single
sentence describing the change, written as it should appear in `CHANGELOG.md` (e.g.
`add-dev-port-scan.md`: "`dev` now picks the first free port starting at 5181 instead of failing
when 5181 is busy."). `npm run release <patch|minor|major>` collects every file here, appends them
to `CHANGELOG.md` under the new version heading, deletes them, and tags the release. PRs with no
user-visible change (tests, docs, refactors) do not need a note.
