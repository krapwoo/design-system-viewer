Two blocks stack by default, and share a row only when sharing costs nothing.

Side by side used to be taken whenever it saved 120px of height. That is how `Banner` ended up drawing five full-width banners in a 462px column: the saving was real, and the specimens were half the width the component is ever used at.

Stacked is now the default, and a split has to earn the space. Two things earn it:

- **A single tall specimen.** One specimen taller than the column is wide leaves a long empty strip beside it — an open `Dropdown` is 738px tall in a 462px column — and the other block fits there for free.
- **Both blocks still fit one row.** Specimens small enough that each block is a single row at half width lose nothing by sharing it.

Deliberately stricter than "the same number of rows as a full row would give": with the default three-column cap a block can already be two rows at full width, and two wrapped rows staying two wrapped rows is not a reason to halve every specimen on the page. That looser rule was written first, and a rendered pass caught it — `EmptyState` and `Shimmer` kept sharing a row when they should not have.

Both blocks must still keep their minimum width in half a row, and the result must still save real height; side by side that saves nothing is just a narrower page.

Across the starter kit this changes three pages and leaves the rest alone: `Banner` (specimens 540px → 555px), `EmptyState` (540px → 1110px) and `Shimmer` (270px → 555px) now stack, while `Dropdown` and `TextArea` keep sharing their row.
