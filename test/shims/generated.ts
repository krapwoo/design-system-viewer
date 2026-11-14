// Stand-in for `@krapwoo/ds-viewer/generated`. In a real host that module is written by `ds-viewer
// sync` into `.ds-viewer/` (Metro aliases it); in this repo it resolves to a bare `.d.ts`, and the
// harness must not depend on a prior sync. Empty inventories are what a project with nothing scanned
// yet produces, and are enough for the Manifest page to render its (empty) JSON dump.
export const components: unknown[] = [];
export const tokens: unknown[] = [];
