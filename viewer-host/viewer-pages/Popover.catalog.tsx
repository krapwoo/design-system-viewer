import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { defineCatalogPage, Popover, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT } from '@krapwoo/ds-viewer';

// The trigger owns `open` and the anchor, as a page head's badge does: pressing it again closes it.
function PopoverDemo({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<View>(null);
  return (
    <>
      <Pressable
        ref={anchor as never}
        accessibilityRole="button"
        accessibilityLabel="About this example"
        accessibilityState={{ expanded: open }}
        {...({ 'aria-expanded': open, 'aria-haspopup': 'dialog' } as Record<string, unknown>)}
        onPress={() => setOpen((was) => !was)}
        style={{ minHeight: 44, minWidth: 44, paddingHorizontal: CATALOG_SPACE.md, justifyContent: 'center' }}
      >
        <Text style={{ ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.accent }}>About ›</Text>
      </Pressable>
      {open ? <Popover anchorRef={anchor} label="About this example" onClose={() => setOpen(false)}>{children}</Popover> : null}
    </>
  );
}

const paragraph = (text: string) => <Text key={text} style={{ ...CATALOG_TEXT.caption, color: CATALOG_COLOR.text }}>{text}</Text>;

export default defineCatalogPage({
  component: 'Popover',
  group: 'Components',
  source: '../native/catalog/Popover.tsx',
  specimenSize: 'regular',
  hide: { props: true },
  standalone: 'It is the panel only: the control that opens it keeps the `open` state and the anchor ref, as the Style badge on a page head does.',
  description: "A small panel anchored to the control that opened it, for a short explanation that should not take the reader off the page (a side panel is for more). Mount it while it is open: `{open ? <Popover anchorRef={ref} label=\"…\" onClose={…}>…</Popover> : null}`. It opens below the anchor, flips above near the bottom of the window, shifts sideways near an edge so it never overflows (at most 320px wide, and never wider than the window less 12px each side), and closes itself through `onClose` on Escape, a press outside, focus leaving, scrolling and resizing. A second press on the control is the control's own toggle.",
  whenToUse: 'A sentence or three that explains a control or a badge in place. Anything longer, or with its own controls, belongs in a side panel (`Notes and API`).',
  a11y: '`role="dialog"` named by `label`, not modal: nothing behind it is inert. Focus moves into it on open and returns to the anchor on close unless the reader moved it. Escape closes it; Tab or Shift+Tab closes it and carries on from the anchor. In a short window the panel scrolls inside itself. One popover is open at a time: opening another closes it. It fades in with opacity only, and appears at once under reduced motion. The trigger should be a button with `aria-expanded` and `aria-haspopup="dialog"` and a 44px hit area.',
  variants: {
    items: [
      { key: 'short', name: 'A short explanation', node: <PopoverDemo>{[paragraph('A popover explains one thing in place.'), paragraph('Press the button again, press Escape, or press anywhere else to close it.')]}</PopoverDemo> },
    ],
  },
});
