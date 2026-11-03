import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Popover } from './Popover';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

const ARIA_HIDDEN = { 'aria-hidden': true } as Record<string, unknown>;

/** The accessible name of the page-head badge, which opens the explanation. */
export const STYLE_BADGE_LABEL = 'Style — what this means';

/** The explanation the badge opens, one short paragraph each: what a style is, how it differs from
 *  a component, and how to read the page. Platform-neutral, with SwiftUI examples. */
export const STYLE_EXPLAINER: ReadonlyArray<{ heading: string; text: string }> = [
  { heading: 'What a style is', text: 'A reusable look applied to views that already exist, such as a SwiftUI ButtonStyle, ViewModifier or TextRenderer, or a shared background.' },
  { heading: 'How it differs from a component', text: "You don't place a style on a screen by itself; you apply it, as in .buttonStyle(Pill()). Changing it changes every view that uses it." },
  { heading: 'How to read this page', text: 'The specimens show the style applied to sample content. Look at what the style does, not at the sample.' },
];

// The pill's own height: its text line, 3px of padding above and below, and its 1px border. The
// button form is at least 24px tall, the least size WCAG 2.2 (2.5.8) allows a pointer target.
const BADGE_PADDING_Y = 3;
const BADGE_HEIGHT = CATALOG_TEXT.microLabel.lineHeight + 2 * BADGE_PADDING_Y + 2;
const BUTTON_BADGE_HEIGHT = Math.max(BADGE_HEIGHT, 24);

/** The button's hit area is a full control (44px) around the 24px pill, which stays centred in it. */
const HIT_SIZE = CATALOG_LAYOUT.controlSize;

/** The offset that centres the button's hit area on the first line of a page title, so a title that
 *  wraps keeps the badge beside its first line. It is negative: the 44px area is taller than the
 *  34px line, and the title's 5px bottom margin takes up what hangs below, so the page head does
 *  not grow. The page head's cell applies it (`styleTitleRow`); the button itself carries no
 *  margin, so it sits true wherever it is placed. */
export const STYLE_BADGE_TITLE_OFFSET = (CATALOG_TEXT.pageTitle.lineHeight - HIT_SIZE) / 2;

/** The small "Style" pill on a page that documents a style (`pageKind: 'style'`) and on an
 *  `InventoryTile` whose page is one. The word is the signal, never colour alone, and the pill is
 *  the same neutral look as the OS-component badge. On a page head it is a button (`onPress`) with a
 *  44px hit area that opens the explanation (`buttonRef` is the element the popover anchors to); on
 *  a tile it is `decorative`. */
export function StyleBadge({ decorative = false, onPress, open = false, buttonRef, pillRef }: { decorative?: boolean; onPress?: () => void; open?: boolean; buttonRef?: React.Ref<View>; pillRef?: React.Ref<View> }) {
  const [focused, setFocused] = useState(false);
  if (onPress) {
    return (
      <Pressable
        // Cast: a consumer's copy of the React types is not this package's, and their `Ref<View>`s differ.
        ref={buttonRef as never}
        onPress={onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={STYLE_BADGE_LABEL}
        accessibilityState={{ expanded: open }}
        {...({ 'aria-expanded': open, 'aria-haspopup': 'dialog' } as Record<string, unknown>)}
        style={styles.hit}
      >
        {/* The ring is drawn on the pill, not on the 44px area around it. */}
        <View ref={pillRef as never} style={[styles.badge, styles.button, focused && styles.focusRing]}>
          <Text style={styles.badgeText}>Style</Text>
        </View>
      </Pressable>
    );
  }
  return (
    // `decorative` hides it from assistive technology, where the name beside it already says "style".
    <View style={styles.badge} {...(decorative ? ARIA_HIDDEN : {})}>
      <Text style={styles.badgeText}>Style</Text>
    </View>
  );
}

/** The page-head badge and the popover it opens: the page's own `styleNote` when it has one, then
 *  what a style is, how it differs from a component, and how to read the page. Pressing the badge
 *  again, Escape, a press outside or scrolling closes it. */
export function StyleBadgeButton({ note }: { note?: string }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<View>(null);
  const pillRef = useRef<View>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <StyleBadge buttonRef={anchorRef} pillRef={pillRef} onPress={() => setOpen((was) => !was)} open={open} />
      {open ? (
        <Popover anchorRef={anchorRef} placeRef={pillRef} label="About styles" onClose={close}>
          {note ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>About this style</Text>
              <Text style={styles.sectionText}>{note}</Text>
            </View>
          ) : null}
          {STYLE_EXPLAINER.map((part) => (
            <View key={part.heading} style={styles.section}>
              <Text style={styles.sectionHeading}>{part.heading}</Text>
              <Text style={styles.sectionText}>{part.text}</Text>
            </View>
          ))}
        </Popover>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: CATALOG_SPACE.sm,
    paddingVertical: BADGE_PADDING_Y,
    borderRadius: CATALOG_RADIUS.control,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    backgroundColor: CATALOG_COLOR.surface,
  },
  hit: { minWidth: HIT_SIZE, minHeight: HIT_SIZE, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: BUTTON_BADGE_HEIGHT, justifyContent: 'center' },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing } as object,
  badgeText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.text },
  section: { gap: CATALOG_SPACE.xs },
  sectionHeading: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  sectionText: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.text },
});
