import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE } from './tokens';
import { SPECIMEN_SURFACE_WIDTH_STYLE } from './specimenSurfaceStyle';
import type { SpecimenSurfaceKind } from './types';

/**
 * The catalog-owned background directly behind a live component specimen — shared by
 * `ComparisonList`, `ComparisonGroups`, `ComparisonGrid`, and `SectionBlock`'s component preview,
 * so a page's `specimenSurface` renders identically everywhere a specimen appears. Purely a fixed
 * backdrop: it never reads the wrapped component's own colors, never adds a border, and is never
 * used for token galleries/sections (those keep their existing full-width presentation). Always
 * stretches to its parent's width (see `specimenSurfaceStyle.ts`) rather than shrink-wrapping to
 * its content, centering that content itself — so a percentage-width specimen resolves against
 * the real comparison-cell width instead of collapsing to 0px.
 */
export function SpecimenSurface({
  surface = 'neutral',
  style,
  children,
}: {
  surface?: SpecimenSurfaceKind;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return <View style={[styles.base, SURFACE_FILL[surface], style]}>{children}</View>;
}

// 'dark' reuses CATALOG_COLOR.text (the catalog's own darkest token) rather than adding a new
// background-specific color — the catalog chrome has no existing dark-surface token to reach for.
const SURFACE_FILL: Record<SpecimenSurfaceKind, ViewStyle> = {
  neutral: { backgroundColor: CATALOG_COLOR.surfaceMuted },
  white: { backgroundColor: CATALOG_COLOR.surface },
  dark: { backgroundColor: CATALOG_COLOR.text },
  transparent: { backgroundColor: 'transparent' },
};

const styles = StyleSheet.create({
  base: {
    ...SPECIMEN_SURFACE_WIDTH_STYLE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CATALOG_RADIUS.sm,
    padding: CATALOG_SPACE.md,
  },
});
