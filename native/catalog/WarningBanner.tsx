import React, { useId } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

/** `'warning'` (the default) is the viewer's amber attention colour, the one its own update notice
 *  uses; `'info'` is the same banner in its accent blue, for a note that is not a caution. */
export type WarningBannerTone = 'warning' | 'info';

const TONES = {
  warning: { background: CATALOG_COLOR.warningSubtle, border: CATALOG_COLOR.warningBorder, text: CATALOG_COLOR.warning },
  info: { background: CATALOG_COLOR.accentSubtle, border: CATALOG_COLOR.focusRing, text: CATALOG_COLOR.accent },
} as const;

/**
 * A short note that asks for attention on a page, such as "These pages are being replaced" on a
 * category overview. A titled box in the viewer's attention colours; it has no dismiss control, so
 * it is for something that stays true while the page does. It is announced as a note named by its
 * title (`role="note"`), not as an alert: it is not an event that interrupts.
 *
 * `children` is the body: text, or your own `Text`/`View` elements (a bare string is styled for
 * you).
 *
 * ```tsx
 * <WarningBanner title="Legacy buttons">Use the pages under Buttons for new work.</WarningBanner>
 * ```
 */
export function WarningBanner({ title, children, tone = 'warning' }: { title: string; children: React.ReactNode; tone?: WarningBannerTone }) {
  const titleId = useId();
  const colors = TONES[tone];
  return (
    <View
      role="note"
      {...({ 'aria-labelledby': titleId } as Record<string, unknown>)}
      style={[styles.banner, { backgroundColor: colors.background, borderColor: colors.border }]}
    >
      <Text nativeID={titleId} style={[styles.title, { color: colors.text }]}>{title}</Text>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={[styles.body, { color: colors.text }]}>{children}</Text>
      ) : (
        <View>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: CATALOG_RADIUS.md,
    padding: CATALOG_SPACE.lg,
    gap: CATALOG_SPACE.xs,
  },
  title: { ...CATALOG_TEXT.label },
  body: { ...CATALOG_TEXT.body },
});
