`dev` and `doctor` now check for a newer version at most once a day (never with `--ci`), cached
across projects; disable with `updateCheck: false` or `DS_VIEWER_NO_UPDATE_CHECK=1`.
