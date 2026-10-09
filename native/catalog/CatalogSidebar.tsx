import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import type { ImageSourcePropType, LayoutChangeEvent, NativeSyntheticEvent, ImageLoadEventData } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { logoLayout } from './logoLayout';
import { filterGroups, hashForId, UPDATE_PAGE_ID } from './catalogNavigation';
import type { NavGroup } from './types';
import { CatalogSearchInput } from './CatalogSearchInput';

function webLinkProps(id: string, active: boolean) {
  return active ? { href: hashForId(id), 'aria-current': 'page' } : { href: hashForId(id) };
}

/** One nav link. Hover via onHoverIn/onHoverOut (react-native-web fires them; native never does);
 *  keyboard focus draws the catalog focus ring because react-native-web removes the browser's. */
function NavItem<TId extends string>({ id, label, active, onPress }: { id: TId; label: string; active: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      // Web-only props React Native's types do not declare, passed through a cast:
      // • aria-current — react-native-web ignores `accessibilityState` (native-only), so the open
      //   page needs aria-current on web.
      // • href — renders a real <a href="#Id">. react-native-web leaves keyboard activation of
      //   role="link" to the browser, which only fires click on Enter for genuine anchors.
      {...(webLinkProps(id, active) as Record<string, unknown>)}
      style={({ pressed }) => [
        styles.item,
        (pressed || hovered) && styles.itemHover,
        active && styles.itemActive,
        focused && styles.focusRing,
      ]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

function FooterLink({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      {...({ href: hashForId(UPDATE_PAGE_ID), ...(active ? { 'aria-current': 'page' } : null) } as Record<string, unknown>)}
      style={({ pressed }) => [
        styles.footerLink,
        (pressed || hovered) && styles.footerLinkHover,
        active && styles.footerLinkActive,
        focused && styles.focusRing,
      ]}
    >
      <View style={styles.footerDot} />
      <Text style={[styles.footerLabel, active && styles.footerLabelActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Catalog navigation: app name, caption, a filter field, and one link per page under grouped
 * headings. Selecting a link opens that page (CatalogShell owns which page is shown). The filter
 * narrows this list only and never changes the open page.
 */
export function CatalogSidebar<TId extends string>({
  logo,
  logoImageSource,
  caption,
  groups,
  labels,
  active,
  onPress,
  footer,
}: {
  logo: string;
  /** Optional logo image, validated and bundled by `cli/workspace.ts` from the project's `logo`
   *  config field. Visual spec: docs/design/2026-10-08-ds-viewer-sidebar-logo-approved.html
   *  ("C · Adaptive", approved 2026-10-08) — a mark (aspect ratio ≤ 2) sits beside the name; a
   *  wordmark (> 2) replaces the name text, carrying it as its own accessible label instead. */
  logoImageSource?: ImageSourcePropType;
  caption: string;
  groups: NavGroup<TId>[];
  /** Display titles by page id (`SectionDef.title`); pages without one show their id. */
  labels?: ReadonlyMap<string, string>;
  active: string | undefined;
  onPress: (id: TId) => void;
  /** The quiet update-notice link below the nav list (design §5's footer line), or `undefined`
   *  when there is no update to show. `active` is true while the update page itself is open — it
   *  gets the same active styling a selected nav item would. */
  footer?: { label: string; active: boolean; onPress: () => void };
}) {
  const [query, setQuery] = useState('');
  // A bundled local image (the only kind `cli/workspace.ts` ever produces — see its doc comment
  // above) already carries its own `width`/`height` on the required module object, both on native
  // and on react-native-web (confirmed by reading `AssetRegistry`/Metro's asset plugin output) — no
  // need to wait for a load event for the common case. `onLoad` below is kept only as a fallback for
  // a source with no static dimensions (e.g. a bare `{ uri }`); the mock prober stops rendering as
  // soon as either resolves an aspect.
  const staticSource = typeof logoImageSource === 'object' && logoImageSource !== null && !Array.isArray(logoImageSource)
    ? (logoImageSource as { width?: number; height?: number })
    : undefined;
  const staticAspect = staticSource?.width && staticSource?.height ? staticSource.width / staticSource.height : undefined;
  const [loadedAspect, setLoadedAspect] = useState<number | undefined>(undefined);
  const [logoFailed, setLogoFailed] = useState(false);
  const [nameWrapped, setNameWrapped] = useState(false);
  const filtered = filterGroups(groups, query, labels);

  const logoAspect = staticAspect ?? loadedAspect;
  const attemptingLogo = Boolean(logoImageSource) && !logoFailed;
  const header = attemptingLogo ? logoLayout(logoAspect) : 'text';

  // Fallback only (see the comment above `staticSource`) — and native-only in practice: on web,
  // `ImageLoader.load`'s `onLoad` fires after `HTMLImageElement.decode()` resolves, by which point
  // Chrome has already nulled the underlying DOM event's `target`, so `native.source` below reads
  // `undefined` on react-native-web (confirmed empirically — `event.target` reads non-null only
  // when read synchronously inside `onload`, before any `await`) and this handler never sets
  // `loadedAspect` there. Native's real `Image` reports `source.{width,height}` on its `onLoad`
  // nativeEvent instead, which this still reads correctly. Kept rather than removed (Minor finding,
  // Fable's implementation review) because a non-bundled source with no static dimensions (e.g. a
  // bare `{ uri }`) is still possible on native, even though `cli/workspace.ts` only ever generates
  // a bundled `require()` today.
  const onLogoLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const native = e.nativeEvent as unknown as { source?: { width: number; height: number } };
    const width = native.source?.width;
    const height = native.source?.height;
    if (width && height) setLoadedAspect(width / height);
  };
  const onLogoError = () => setLogoFailed(true);
  // Wrap detection for the "mark" row: the name Text's own measured height, not `onTextLayout`
  // (react-native-web's `Text` doesn't implement it) and not a character-count heuristic (wraps at
  // a different length per name). More than one line of `CATALOG_TYPE.brand` means it wrapped.
  const NAME_LINE_HEIGHT = Math.round(CATALOG_TYPE.brand * 1.3);
  const onNameLayout = (e: LayoutChangeEvent) => {
    setNameWrapped(e.nativeEvent.layout.height > NAME_LINE_HEIGHT * 1.5);
  };

  return (
    <View role="navigation" aria-label="Catalog pages" style={styles.sidebar}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {/* Invisible — exists only so a configured logo's `onLoad`/`onError` can fire at all
              while `header` is still `'text'` (the aspect isn't known yet). Once `logoAspect`
              resolves (or the image fails), `header` switches and this prober stops rendering. */}
          {attemptingLogo && logoAspect === undefined && (
            <Image source={logoImageSource} style={styles.logoProbe} onLoad={onLogoLoad} onError={onLogoError} />
          )}
          {header === 'wordmark' && (
            <>
              <Image
                source={logoImageSource}
                accessibilityRole="image"
                accessibilityLabel={logo}
                resizeMode="contain"
                style={[styles.wordmark, { width: Math.min(CATALOG_LAYOUT.logoWordmarkHeight * (logoAspect ?? 0), 228) }]}
                onLoad={onLogoLoad}
                onError={onLogoError}
              />
              <Text style={[styles.subtitle, styles.subtitleAfterWordmark]}>{caption}</Text>
            </>
          )}
          {header === 'mark' && (
            <View style={[styles.inlineHeader, nameWrapped && styles.inlineHeaderTop]}>
              <Image source={logoImageSource} resizeMode="contain" style={styles.mark} onLoad={onLogoLoad} onError={onLogoError} />
              <View style={styles.inlineText}>
                <Text style={styles.logo} onLayout={onNameLayout}>{logo}</Text>
                <Text style={styles.subtitle}>{caption}</Text>
              </View>
            </View>
          )}
          {header === 'text' && (
            <>
              <Text style={styles.logo}>{logo}</Text>
              <Text style={styles.subtitle}>{caption}</Text>
            </>
          )}
        </View>

        <CatalogSearchInput value={query} onChangeText={setQuery} placeholder="Filter components…" />

        {filtered.length === 0 && <Text style={styles.empty}>No matches</Text>}
        {filtered.map((group) => (
          <View key={group.label}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.ids.map((id) => (
              <NavItem key={id} id={id} label={labels?.get(id) ?? id} active={active === id} onPress={() => onPress(id)} />
            ))}
          </View>
        ))}
      </ScrollView>
      {footer && (
        <View style={styles.footerContainer}>
          <FooterLink label={footer.label} active={footer.active} onPress={footer.onPress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: CATALOG_LAYOUT.sidebarWidth,
    backgroundColor: CATALOG_COLOR.surface,
    borderRightWidth: 1,
    borderRightColor: CATALOG_COLOR.borderHairline,
  },
  scroll: { flex: 1 },
  content: {
    paddingTop: CATALOG_LAYOUT.sidebarPaddingTop,
    paddingHorizontal: CATALOG_LAYOUT.sidebarPaddingX,
    paddingBottom: CATALOG_LAYOUT.sidebarPaddingTop,
  },
  header: { marginBottom: 20 },
  logo: { fontSize: CATALOG_TYPE.brand, fontWeight: '800', color: CATALOG_COLOR.text },
  subtitle: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, marginTop: 2 },
  subtitleAfterWordmark: { marginTop: CATALOG_LAYOUT.logoCaptionGap },
  mark: { width: CATALOG_LAYOUT.logoMark, height: CATALOG_LAYOUT.logoMark },
  wordmark: { height: CATALOG_LAYOUT.logoWordmarkHeight, alignSelf: 'flex-start' },
  logoProbe: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  inlineHeader: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.md },
  inlineHeaderTop: { alignItems: 'flex-start' },
  inlineText: { flex: 1, minWidth: 0 },
  empty: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, paddingHorizontal: CATALOG_LAYOUT.navItemPaddingX, paddingVertical: 8 },
  footerContainer: {
    borderTopWidth: 1,
    borderTopColor: CATALOG_COLOR.borderHairline,
    paddingHorizontal: CATALOG_LAYOUT.sidebarPaddingX,
    paddingTop: 10,
    paddingBottom: 14,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CATALOG_SPACE.sm,
    minHeight: CATALOG_LAYOUT.controlSize,
    paddingHorizontal: 10,
    borderRadius: CATALOG_RADIUS.sm,
  },
  footerLinkHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  footerLinkActive: { backgroundColor: CATALOG_COLOR.accentSubtle },
  footerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: CATALOG_COLOR.accent, flexShrink: 0 },
  footerLabel: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
  footerLabelActive: { color: CATALOG_COLOR.accent, fontWeight: '700' },
  groupLabel: {
    fontSize: CATALOG_TYPE.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
    marginTop: 22,
    marginBottom: 7,
    marginHorizontal: 8,
  },
  item: {
    minHeight: CATALOG_LAYOUT.controlSize,
    justifyContent: 'center',
    paddingVertical: CATALOG_LAYOUT.navItemPaddingY,
    paddingHorizontal: CATALOG_LAYOUT.navItemPaddingX,
    borderRadius: CATALOG_RADIUS.sm,
  },
  itemHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  itemActive: { backgroundColor: CATALOG_COLOR.accentSubtle },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  label: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
  labelActive: { color: CATALOG_COLOR.accent, fontWeight: '700' },
});
