`init` now writes a SHA-pinned `.github/workflows/ds-viewer.yml` that installs dependencies (npm, pnpm, or yarn — detected from the project's lockfile) and runs `doctor --ci` on every pull request.
