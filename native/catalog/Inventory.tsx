import React, { createContext, useContext, useMemo, useState } from 'react';
import { inventoryLayoutContext, type InventoryLayout } from './inventoryLayoutContext';
export type { InventoryLayout } from './inventoryLayoutContext';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { hashForId } from './catalogNavigation';
import { referenceLinkProps } from './catalogReferences';
import { useMemberTitle } from './memberTitlesContext';
import { useReferenceNavigation } from './referenceNavigationContext';
import {
  inventoryStatusVisible,
  INVENTORY_ALL, inventoryChips, inventoryGrid, inventoryGroupName, inventoryMaxColumns, inventoryShownCount, inventoryStageSurface,
  inventoryTargetId, inventoryTileShown, readableName, sameInventoryFilter, type InventoryFilter, type InventoryFixedSize, type InventoryShape,
} from './inventoryModel';
import { JumpChip } from './JumpRow';
import { chipRow, tokenSectionFrame, tokenSectionStack } from './sectionFrame';
import { StyleBadge } from './PageKindBadge';
import { OverviewThumbnail } from './OverviewThumbnail';
import { SpecimenSurface } from './SpecimenSurface';
import { TokenGrid } from './TokenLayouts';
import { VariantGroup } from './VariantGroup';
import { WarningBanner } from './WarningBanner';
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

/** What the enclosing `Inventory` is showing; with none, everything. */
const InventoryFilterContext = createContext<InventoryFilter>(INVENTORY_ALL);

const LayoutProvider = inventoryLayoutContext.Provider;

/** Marks an inventory group (`data-testid`), for `doctor --render`'s check of how many sit in one box. */
export const INVENTORY_GROUP_ID = 'inventory-group';
/** Marks an inventory's filter chips (`data-testid`). */
export const INVENTORY_FILTERS_ID = 'inventory-filters';

/** Whether a page's rendered content is an `Inventory` and nothing else, under any `WarningBanner`s
 *  above it: the elements say (fragments and arrays are looked through; nothing is rendered to find
 *  out). The page then draws at page level instead of inside one box (`SectionBlock`). Any other
 *  content, before or after it, keeps the page in its one box. */
export function startsWithInventory(content: React.ReactNode): boolean {
  const flat = (node: React.ReactNode): React.ReactNode[] =>
    React.Children.toArray(node).flatMap((child) =>
      React.isValidElement(child) && child.type === React.Fragment ? flat((child.props as { children?: React.ReactNode }).children) : [child]);
  const parts = flat(content);
  let first = 0;
  while (first < parts.length && React.isValidElement(parts[first]) && (parts[first] as React.ReactElement).type === WarningBanner) first++;
  return first === parts.length - 1 && React.isValidElement(parts[first]) && (parts[first] as React.ReactElement).type === Inventory;
}

/** A tile's own `fixedSize`, read off the element the same way. */
function fixedSizeOf(child: React.ReactNode): InventoryFixedSize | undefined {
  return React.isValidElement(child) ? (child.props as { fixedSize?: InventoryFixedSize }).fixedSize : undefined;
}

/** A tile's own `tags`, read off the element: only a tile given to a group directly is seen. */
function tagsOf(child: React.ReactNode): readonly string[] | undefined {
  return React.isValidElement(child) ? (child.props as { tags?: readonly string[] }).tags : undefined;
}

/**
 * One group of an inventory on a category overview page: a title with its count (`Shared styles · 6`),
 * a plain-English description of what the group is, then its `InventoryTile`s as flat tiles in the
 * same responsive grid as a `TokenGrid`, 260px at least, up to four across; three or five tiles sit
 * three across. A group whose tiles are all `fixedSize` (avatars, badges, dots, icons) uses 160px
 * tiles at least, or the widest tile's size plus its inset if that is more, up to six across. A group with no tiles renders nothing. Inside an `Inventory`, a selected filter hides
 * the tiles it does not match, the group's count reads `3 of 12`, and a group left with none draws
 * nothing. In the `'sections'` layout the group is a token-page section: title and description
 * outside, the tiles in the group's own bordered box.
 *
 * ```tsx
 * <InventoryGroup title="Shared styles" description="Buttons that take their look from one shared style.">
 *   <InventoryTile target="PrimaryButton" specimen={<Button label="Continue" />} />
 * </InventoryGroup>
 * ```
 */
export function InventoryGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const filter = useContext(InventoryFilterContext);
  const layout = useContext(inventoryLayoutContext);
  const all = React.Children.toArray(children);
  const tiles = all.filter((tile) => inventoryTileShown(filter, title, tagsOf(tile)));
  if (tiles.length === 0) return null;
  const name = inventoryGroupName(title, tiles.length, all.length);
  const { minTileWidth, maxColumns } = inventoryGrid(tiles.map(fixedSizeOf), CATALOG_SPACE.sm);
  // A TokenGrid sizes its tiles from its own width, so it must fill the group rather than shrink to fit.
  const grid = (
    <View style={styles.fill}>
      <TokenGrid minTileWidth={minTileWidth} maxColumns={inventoryMaxColumns(tiles.length, maxColumns)}>{tiles}</TokenGrid>
    </View>
  );
  if (layout === 'sections') {
    return (
      <View testID={INVENTORY_GROUP_ID}>
        {tokenSectionFrame({ title: name, desc: description, children: grid })}
      </View>
    );
  }
  return <VariantGroup align="left" name={name} desc={description} testID={INVENTORY_GROUP_ID}>{grid}</VariantGroup>;
}

/**
 * A category overview's inventory with filters: its `InventoryGroup`s, under one row of chips that
 * are the numbers. There is a chip for `All N`, one for each group (`Shared styles 12`) and one for
 * each tag a tile declares (`Draws its own shape 13`); pressing one shows exactly those tiles and
 * hides the rest, and pressing it again, or `All`, shows everything. Every count is read from the
 * tiles the groups draw, so no number can disagree with what is below it.
 *
 * - Give a tile `tags={['Draws its own shape']}` to put it in a tag set. A tile may be in several.
 * - A number that filters nothing (a count of zero, a fact about the whole design system) is not a
 *   chip: say it in the `WarningBanner` above, which is where the finding goes.
 * - The chips are buttons that report `aria-pressed`, reachable and pressed from the keyboard, in a
 *   group named "Filter the inventory"; a line beside them, a polite live region, says
 *   `Showing 3 of 12` after every change (drawn only while a filter narrows the list; under All it
 *   is visually hidden but still announced).
 * - Read from the elements, not from rendering: pass `InventoryGroup`s directly, each holding its
 *   `InventoryTile`s directly. A group wrapped in a component of your own is drawn in full and is
 *   neither counted nor filtered; a tile wrapped that way inside a group is counted and filtered as a
 *   tile with no tags. A tile of your own (when `InventoryTile` can't carry what it needs) works
 *   the same as long as it is a direct child and takes its own `tags` prop: the tags are read off
 *   the element. With a single group and no tags there is nothing to choose between, so no
 *   chips are drawn.
 *
 * - Layout follows the token pages. A page whose content is an `Inventory` (directly, or in
 *   a fragment with a `WarningBanner` above it) is drawn at page level, not inside one box: the
 *   banner, then the chips in the same row and place as a token page's jump row, then each group as
 *   its own section (uppercase title and description outside, the tiles in the group's own bordered
 *   box), with a filter that leaves a group empty hiding its whole section. Placed anywhere else
 *   (inside a section or an example, where a box already surrounds it) it stays `'inline'`: chips
 *   and every group in the box it is in. `layout` overrides either way.
 *
 * ```tsx
 * <Inventory>
 *   <InventoryGroup title="Shared styles"><InventoryTile target="PrimaryButton" tags={['Draws its own shape']} /></InventoryGroup>
 *   <InventoryGroup title="Own styles">…</InventoryGroup>
 * </Inventory>
 * ```
 */
export function Inventory({ children, label = 'Filter the inventory', layout }: { children: React.ReactNode; label?: string; layout?: InventoryLayout }) {
  const [filter, setFilter] = useState<InventoryFilter>(INVENTORY_ALL);
  const inherited = useContext(inventoryLayoutContext);
  const drawn = layout ?? inherited;
  const groups: InventoryShape[] = React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child) || child.type !== InventoryGroup) return [];
    const props = child.props as { title: string; children: React.ReactNode };
    return [{ title: props.title, tiles: React.Children.toArray(props.children).map((tile) => ({ tags: tagsOf(tile) })) }];
  });
  const chips = inventoryChips(groups);
  const total = chips[0].count;
  // Nothing to choose between: one group and no tags is All and that group, the same list twice.
  const filterable = chips.length > 2;
  // A filter whose chip is gone (its tiles were removed) is dropped rather than showing nothing.
  const active = chips.some((chip) => sameInventoryFilter(chip.filter, filter)) ? filter : INVENTORY_ALL;
  const chipButtons = chips.map((chip) => (
    <JumpChip
      key={chip.key}
      title={chip.label}
      qualifier={String(chip.count)}
      accessibilityLabel={`${chip.label}, ${chip.count}`}
      selected={sameInventoryFilter(chip.filter, active)}
      onPress={() => setFilter(sameInventoryFilter(chip.filter, active) ? INVENTORY_ALL : chip.filter)}
    />
  ));
  // Always mounted so a change is announced; only shown while a filter narrows the list
  // ("Showing 17 of 17" says nothing a designer needs to read).
  const status = (
    <Text role="status" aria-live="polite" style={inventoryStatusVisible(active) ? styles.status : styles.statusHidden}>{`Showing ${inventoryShownCount(active, groups)} of ${total}`}</Text>
  );
  // Only groups given directly are counted, so only they read the filter; anything else (a group
  // inside a component of your own) is drawn unfiltered rather than filtered but uncounted.
  const items = React.Children.toArray(children).map((child) =>
    React.isValidElement(child) && child.type === InventoryGroup ? child : (
      <InventoryFilterContext.Provider key={React.isValidElement(child) && child.key !== null ? child.key : undefined} value={INVENTORY_ALL}>{child}</InventoryFilterContext.Provider>
    ));
  return (
    <InventoryFilterContext.Provider value={filterable ? active : INVENTORY_ALL}>
      <LayoutProvider value={drawn}>
        {drawn === 'sections' ? (
          // The token-page layout: the chips are the jump row's own row, and the sections follow it.
          <>
            {filterable ? (
              chipRow({ role: 'group', 'aria-label': label, testID: INVENTORY_FILTERS_ID }, [...chipButtons, React.cloneElement(status, { key: 'status' })])
            ) : null}
            {tokenSectionStack(items)}
          </>
        ) : (
          <View style={styles.inventory}>
            {filterable ? (
              <View testID={INVENTORY_FILTERS_ID} style={styles.filters}>
                <View role="group" aria-label={label} style={styles.chips}>{chipButtons}</View>
                {status}
              </View>
            ) : null}
            {items}
          </View>
        )}
      </LayoutProvider>
    </InventoryFilterContext.Provider>
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
 * - Scale: a `specimen` is drawn the way a page's tile is — laid out at the reference phone width (402px;
 *   the width its page previews at, when `target` is a member of a page that names one; `width`
 *   overrides), measured, and shrunk to fit the tile, never enlarged. A specimen that fills a
 *   screen's width (a row, card, banner, bar) comes out at one scale for every tile of the same width,
 *   page tile or part tile; one whose size does not depend on the screen (an avatar, badge, dot,
 *   icon, a button sized to its label) paints at its own size, so it is drawn at real size. That measuring
 *   needs a DOM: on web only. Elsewhere a tile scales the full cell width (402px by default), so a fixed-size specimen comes
 *   out smaller than real size.
 * - `fill`: the specimen stretches to that width, as a `fill`/`itemsFill` specimen does on its page (a root
 *   with no width of its own, such as a `width: '100%'` panel, needs it; capped at a phone's content width
 *   and centred, as on the page, in a cell no wider than a phone; a wider `width` fills it). Off unless set: the target page's
 *   `fill` belongs to its first specimen, not to this part. Page tiles always follow their page.
 * - `fixedSize` says so for the group: `true`, or that specimen's widest side in px. A group whose tiles
 *   are all `fixedSize` uses narrower tiles and more columns (see `InventoryGroup`). It changes only
 *   the grid; how big the specimen is drawn is always measured.
 * - `tags` puts the tile in named sets (`['Draws its own shape']`) that an enclosing `Inventory` turns
 *   into filter chips. A tile draws nothing for them.
 * - A tile whose page is a style (`pageKind: 'style'`), or that links to a member of one, shows a
 *   small "Style" badge, and its link is named "<title>, style".
 * - Accessibility: the title link is the tile's one tab stop. The specimen is decoration: hidden from
 *   assistive technology and inert, so nothing in it takes focus or a click.
 * - Outside a catalog shell (nothing to resolve against) the link is a plain `#target` anchor; inside
 *   one, a `target` that resolves to nothing shows its title as text, never a dead link.
 */
export function InventoryTile({ target, specimen, surface = 'auto', title, width, fill }: { target: string; specimen?: React.ReactNode; surface?: SpecimenSurfaceKind; title?: string; tags?: string[]; fixedSize?: InventoryFixedSize; width?: number; fill?: boolean }) {
  const navigation = useReferenceNavigation();
  const titleOf = useMemberTitle(navigation);
  const id = inventoryTargetId(target);
  const link = navigation ? referenceLinkProps(navigation, id) : undefined;
  const resolved = navigation?.resolve(id);
  const label = title ?? inventoryTitle(id, resolved, titleOf, navigation?.page?.bind(navigation));
  const drawing = useContext(ThumbnailPagesContext);
  const page = resolved && resolved.memberId === undefined ? navigation?.page?.(resolved.pageId) : undefined;
  // A member of a style page (one of the styles it documents) is a style too.
  const isStyle = resolved !== undefined && navigation?.page?.(resolved.pageId)?.pageKind === 'style';
  const thumbnail = page?.source && resolved && !drawing.includes(resolved.pageId) ? { source: page.source, pageId: resolved.pageId } : undefined;
  const href = link ? hashForId(link.memberId ?? link.pageId) : navigation ? undefined : hashForId(id);
  // One stage for the whole grid: 'auto' would leave a tile white unless its specimen blends with white,
  // so tiles side by side would sit on different backgrounds.
  const stage = inventoryStageSurface(surface);
  // A part is drawn the way its page's own tile is: laid out at the width its page previews at (the
  // reference phone width unless `width` or that page says otherwise), measured and scaled to fit.
  const partWidth = width ?? (resolved ? navigation?.page?.(resolved.pageId)?.source?.width : undefined);
  // It stretches to that width only when asked: the page's own `fill` describes the page's first
  // specimen, not this part (a badge on a row's page is not filled because the row is).
  const part = useMemo(
    () => (specimen === undefined ? undefined : { node: specimen, surface: stage, ...(partWidth !== undefined && { width: partWidth }), ...(fill && { fill: true }) }),
    [specimen, stage, partWidth, fill],
  );
  return (
    <View style={styles.tile}>
      {/* A miniature is never the page's layout: an overview drawn in a tile stays inline, whatever group it sits in. */}
      <inventoryLayoutContext.Provider value="inline">
      <View ref={makeInert} {...ARIA_HIDDEN} style={[styles.inert, { pointerEvents: 'none' } as object]}>
        {part ? (
          <OverviewThumbnail source={part} height={DEFAULT_SPECIMEN_HEIGHT} />
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
      </inventoryLayoutContext.Provider>
      <View style={styles.titleRow}>
        {href === undefined ? <Text style={styles.title}>{label}</Text> : <InventoryLink label={label} accessibleName={isStyle ? `${label}, style` : undefined} href={href} onPress={link?.onPress} />}
        {isStyle ? <StyleBadge decorative /> : null}
      </View>
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

function InventoryLink({ label, accessibleName, href, onPress }: { label: string; accessibleName?: string; href: string; onPress?: (event?: never) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibleName ?? label}
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
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: CATALOG_SPACE.sm },
  inventory: { gap: CATALOG_SPACE.xl },
  filters: { gap: CATALOG_SPACE.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.sm },
  status: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  // Visually hidden, still read: off-screen, 1px, clipped.
  statusHidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  inert: { alignSelf: 'stretch' },
  stage: { minHeight: STAGE_MIN_HEIGHT, padding: CATALOG_SPACE.md, alignItems: 'center', justifyContent: 'center' },
  empty: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  title: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  link: { color: CATALOG_COLOR.accent, textDecorationLine: 'none' },
  linkHovered: { textDecorationLine: 'underline' },
});
