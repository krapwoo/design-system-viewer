Catalog and CLI fixes for long page titles, comparison grids, anatomy pins and family members:
- A long page title with no spaces (a component id such as `KanbanBoardManagementView`) now wraps inside its own column on family and group pages too, instead of running underneath the ← → pager on a narrow window.
- A comparison grid takes its page's `variants.axis` as its heading only when that names one of the grid's own axes, so a Shape × Pose grid is no longer headed "Expression".
- `doctor` has a new `comparison-hides-variants` warning for a page or member whose `variants` are replaced by a grid that doesn't cover their axis.
- On web, when neither the page nor the catalog sets `previewWidths`, an anatomy picture keeps its pins inside the picture column instead of overlapping the legend beside it.
- `explain <Page>` (human and `--json`) and `explain --all` report each family or group member's own blocks under `members`, and flag a member whose two blocks may sit side by side under `memberPlacement`.
- `layout-diff` compares those members too; an older snapshot without them still diffs without inventing changes.
