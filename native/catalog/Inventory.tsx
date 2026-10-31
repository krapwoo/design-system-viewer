import React, { createContext, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { hashForId } from './catalogNavigation';
import { referenceLinkProps } from './catalogReferences';
import { useMemberTitle } from './memberTitlesContext';
import { useReferenceNavigation } from './referenceNavigationContext';
import { INVENTORY_MIN_TILE_WIDTH, inventoryMaxColumns, inventoryStageSurface, inventoryTargetId, readableName } from './inventoryModel';
import { OverviewThumbnail } from './OverviewThumbnail';
import { SpecimenSurface } from './SpecimenSurface';
import { TokenGrid } from './TokenLayouts';
import { VariantGroup } from './VariantGroup';
import type { SpecimenSurfaceKind } from './types';

const ARIA_HIDDEN = { 'aria-hidden': true } as Record<string, unknown>;
/** Room for a specimen on its stage, so tiles in a row stay level. */
const STAGE_MIN_HEIGHT = 104;
/** Height of the frame a default specimen is scaled into. */
const DEFAULT_SPECIMEN_HEIGHT = 104;

/** The ids of the pages whose own specimen is being drawn as a thumbnail around this point. A tile
 *  whose default specimen is one of them (a tile that targets its own page, or two category pages
 *  that target each other) shows the "No specimen" stage instead of drawing it again forever. */
const ThumbnailPagesContext = createContext<readonly string[]>([]);

/**
 * One group of an inventory on a category overview page: a title with its count (`Shared styles · 6`),
 * a plain-English description of what the group is, then its `InventoryTile`s as flat tiles in the
 * same responsive grid as a `TokenGrid`, 260px at least, up to four across; three or five tiles sit
 * three across. A group with no tiles renders nothing.
 *
 * ```tsx
 * <InventoryGroup title="Shared styles" description="Buttons that take their look from one shared style.">
 *   <InventoryTile target="PrimaryButton" specimen={<Button label="Continue" />} />
 * </InventoryGroup>
 * ```
 */
export function InventoryGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const tiles = React.Children.toArray(children);
  if (tiles.length === 0) return null;
  return (
    <VariantGroup align="left" name={`${title} · ${tiles.length}`} desc={description}>
      {/* A TokenGrid sizes its tiles from its own width, so it must fill the group rather than shrink to fit. */}
      <View style={styles.fill}>
        <TokenGrid minTileWidth={INVENTORY_MIN_TILE_WIDTH} maxColumns={inventoryMaxColumns(tiles.length)}>{tiles}</TokenGrid>
      </View>
    </VariantGroup>
  );
}

/**
 * One member of an inventory: its real specimen on a specimen stage, and under it its title as a link
 * to its page. No card around it, and no card inside it.
 *
 * - `target` is the page id, or a member's id, it stands for; a leading `#` is allowed (`'#Button'`).
 *   The title is the page's, or the member's, own `title`, resolved the way every other link in the
 *   catalog resolves one — never an id. A member that has no title shows a readable name
 *   (`ChatTactileButtonStyle` → `Chat tactile button style`), and so does a page that has none.
 *   `title` overrides the text.
 * - `specimen` is the node drawn on the stage, on `surface`. Every tile in a grid sits on the same grey
 *   specimen stage, so `'auto'` (the default) means that stage here rather than white; pass `'dark'`,
 *   `'white'` or `'transparent'` when the specimen needs it. Omit `specimen` and, when
 *   `target` is a page, that page's own first specimen is drawn, scaled to fit — the same picture its
 *   Overview card shows; a member has no default specimen, so pass one. A page that is already being
 *   drawn this way further up (a tile on its own page, or two pages that target each other) shows
 *   "No specimen" instead of drawing itself again.
 * - Accessibility: the title link is the tile's one tab stop. The specimen is decoration: hidden from
 *   assistive technology and inert, so nothing in it takes focus or a click.
 * - Outside a catalog shell (nothing to resolve against) the link is a plain `#target` anchor; inside
 *   one, a `target` that resolves to nothing shows its title as text, never a dead link.
 */
export function InventoryTile({ target, specimen, surface = 'auto', title }: { target: string; specimen?: React.ReactNode; surface?: SpecimenSurfaceKind; title?: string }) {
  const navigation = useReferenceNavigation();
  const titleOf = useMemberTitle(navigation);
  const id = inventoryTargetId(target);
  const link = navigation ? referenceLinkProps(navigation, id) : undefined;
  const resolved = navigation?.resolve(id);
  const label = title ?? inventoryTitle(id, resolved, titleOf, navigation?.page?.bind(navigation));
  const drawing = useContext(ThumbnailPagesContext);
  const page = resolved && resolved.memberId === undefined ? navigation?.page?.(resolved.pageId) : undefined;
  const thumbnail = page?.source && resolved && !drawing.includes(resolved.pageId) ? { source: page.source, pageId: resolved.pageId } : undefined;
  const href = link ? hashForId(link.memberId ?? link.pageId) : navigation ? undefined : hashForId(id);
  // One stage for the whole grid: 'auto' would leave a tile white unless its specimen blends with white,
  // so tiles side by side would sit on different backgrounds.
  const stage = inventoryStageSurface(surface);
  return (
    <View style={styles.tile}>
      <View ref={makeInert} {...ARIA_HIDDEN} style={[styles.inert, { pointerEvents: 'none' } as object]}>
        {specimen !== undefined ? (
          <SpecimenSurface surface={stage} style={styles.stage}>{specimen}</SpecimenSurface>
        ) : thumbnail ? (
          <ThumbnailPagesContext.Provider value={[...drawing, thumbnail.pageId]}>
            <OverviewThumbnail source={thumbnail.source} height={DEFAULT_SPECIMEN_HEIGHT} />
          </ThumbnailPagesContext.Provider>
        ) : (
          <SpecimenSurface surface={stage} style={styles.stage}>
            <Text style={styles.empty}>No specimen</Text>
          </SpecimenSurface>
        )}
      </View>
      {href === undefined ? <Text style={styles.title}>{label}</Text> : <InventoryLink label={label} href={href} onPress={link?.onPress} />}
    </View>
  );
}

/** The title shown for `id`: a titled member's or a page's title, else a readable name of the id. */
function inventoryTitle(
  id: string,
  resolved: { pageId: string; memberId?: string } | undefined,
  titleOf: (name: string) => string,
  pageOf: ((pageId: string) => { title: string } | undefined) | undefined,
): string {
  if (resolved?.memberId !== undefined) {
    const own = titleOf(resolved.memberId);
    return own !== resolved.memberId ? own : readableName(resolved.memberId);
  }
  const pageTitle = resolved ? pageOf?.(resolved.pageId)?.title : undefined;
  // A page with no title of its own is given its id as one; a tile never shows an id.
  if (pageTitle) return pageTitle === resolved?.pageId ? readableName(pageTitle) : pageTitle;
  const named = titleOf(id);
  return named !== id ? named : readableName(id);
}

function makeInert(node: View | null): void {
  // `inert` is not a React Native prop; it removes the subtree from focus and clicks in one step.
  (node as unknown as Element | null)?.setAttribute?.('inert', '');
}

function InventoryLink({ label, href, onPress }: { label: string; href: string; onPress?: (event?: never) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress as never}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      {...({ href } as Record<string, unknown>)}
    >
      <Text style={[styles.title, styles.link, hovered && styles.linkHovered]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%' },
  tile: { gap: CATALOG_SPACE.sm },
  inert: { alignSelf: 'stretch' },
  stage: { minHeight: STAGE_MIN_HEIGHT, padding: CATALOG_SPACE.md, alignItems: 'center', justifyContent: 'center' },
  empty: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  title: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  link: { color: CATALOG_COLOR.accent, textDecorationLine: 'none' },
  linkHovered: { textDecorationLine: 'underline' },
});
