`update` no longer treats a `package.json`/`package-lock.json` as uncommitted when the only
difference from the last commit is a previously-finished bump to the version already installed —
it now offers the regular **Update now** instead of refusing.
