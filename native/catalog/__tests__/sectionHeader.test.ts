import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// SectionBlock.tsx imports react-native, so it can't run under `node --test` directly — same
// constraint as the source-assertion tests in comparison.test.ts and the ones further down in
// ReferenceDetails. These are structural checks on the source, not a rendered layout measurement:
// controller real-browser verification (at the reproduced 800px host width) confirms the visual
// effect — that an unbroken page title (e.g. `TranscriptVideoPreviewPlayerView`) now wraps inside
// its own column instead of extending into the pager buttons.

// Controller-reproduced: `titlebar`'s `titleText` column (`flex: 1`) sits beside `pager`
// (`flexShrink: 0`). `headingTarget` (the heading's own focus target, `alignSelf: 'flex-start'`)
// sizes to its Text child's intrinsic content width. A page title with no spaces (an unbroken
// identifier) has no line-breaking opportunity for the browser's default word wrapping, so both
// `headingTarget` and the `titleText` column it sits in keep a content-based automatic minimum
// width equal to that identifier's full, unbroken length — wide enough to push past `titleText`'s
// own column and into the non-shrinking pager, regardless of the column's narrower available
// width. `ReferenceDetails.tsx`'s own `mono` style documents the same root cause for a source path
// and fixes it the same way: `wordBreak: 'break-word'` gives the browser a breakpoint inside the
// unbroken run itself, so the title wraps inside its column instead of overflowing it.
test('SectionBlock\'s title style lets an unbroken identifier break inside its own column instead of overflowing into the pager', () => {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../SectionBlock.tsx');
  const source = readFileSync(sourcePath, 'utf8');
  const title = source.match(/\btitle:\s*\{([^}]*)\}/)?.[1];
  assert.ok(title, 'title style declaration not found');
  assert.match(
    title,
    /wordBreak:\s*'break-word'/,
    'title must declare wordBreak: \'break-word\' so an unbroken identifier (no spaces) can wrap inside titleText\'s column instead of extending, at its full intrinsic width, into the pager',
  );
});

// `wordBreak` isn't declared on React Native's own `TextStyle` (react-native-web's own
// `Text/types.js` declares it; a browser applies any CSS property name it recognizes regardless —
// same caveat `ReferenceDetails.tsx`'s own `mono` style documents), so this call is cast to
// `TextStyle` the same way, and that cast must stay in place for `npm run typecheck` to pass.
test('SectionBlock\'s title style is cast to TextStyle, the same way ReferenceDetails\' mono style is, so the unchecked wordBreak property still type-checks', () => {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../SectionBlock.tsx');
  const source = readFileSync(sourcePath, 'utf8');
  assert.match(
    source,
    /title:\s*\{[^}]*wordBreak:\s*'break-word'[^}]*\}\s*as\s*TextStyle/,
    'the title style literal must be cast `as TextStyle`, matching ReferenceDetails.tsx\'s mono style',
  );
});
