import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { CatalogSearchInput } from './CatalogSearchInput';
import { CatalogButton } from './CatalogButton';
import { hashForId, sortIds } from './catalogNavigation';
import { searchReferenceIndex, type ReferenceEntry } from './catalogReferences';

// react-native-web reads `aria-level`; React Native's own prop types do not declare it (same
// convention `ReferenceDetails.tsx`'s own `HEADING_LEVEL_2` already uses).
const HEADING_LEVEL_2 = { 'aria-level': 2 } as Record<string, unknown>;

function entryKey<TId extends string>(entry: ReferenceEntry<TId>): string {
  return entry.memberId ?? entry.pageId;
}

/** A–Z by displayed title, deterministic id ties — the catalog's own canonical comparator
 *  (`catalogNavigation.ts`'s `sortIds`), never a second, bespoke sort here. `entryKey` is safe as
 *  `sortIds`'s own id: `validateFamily` already enforces that every page id, member id, and alias
 *  shares one catalog-wide-unique namespace. */
function sortedEntries<TId extends string>(entries: readonly ReferenceEntry<TId>[]): ReferenceEntry<TId>[] {
  const byKey = new Map(entries.map((entry) => [entryKey(entry), entry]));
  const labels = new Map(entries.map((entry) => [entryKey(entry), entry.title]));
  return sortIds([...byKey.keys()], labels).map((key) => byKey.get(key)!);
}

/** A modified click (open in a new tab/window) or a non-primary button must reach the browser's
 *  own anchor handling untouched — only a plain primary click/Enter/tap becomes a selection. */
function isModifiedPress(event: unknown): boolean {
  const e = event as { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; button?: number } | null | undefined;
  return Boolean(e?.metaKey || e?.ctrlKey || e?.shiftKey || (typeof e?.button === 'number' && e.button !== 0));
}

function ResultRow<TId extends string>({
  entry, label, onSelect,
}: {
  entry: ReferenceEntry<TId>;
  label: string;
  onSelect: (entry: ReferenceEntry<TId>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={(event) => {
        if (isModifiedPress(event)) return; // let the browser open it in a new tab/window
        (event as { preventDefault?: () => void } | undefined)?.preventDefault?.();
        onSelect(entry);
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="link"
      // A real `<a href="#Id">` on web — Enter activates it, and copy/modified-click work exactly
      // as every other catalog link already does (`CatalogSidebar.tsx`'s own `NavItem`).
      {...({ href: hashForId(entryKey(entry)) } as Record<string, unknown>)}
      style={({ pressed }) => [styles.row, (pressed || hovered) && styles.rowHover, focused && styles.focusRing]}
    >
      <Text style={styles.rowTitle}>{label}</Text>
      <Text style={styles.rowMeta}>{entry.component ? `${entry.component} · ${entry.source ?? entry.path}` : (entry.source ?? entry.path)}</Text>
      {entry.source && entry.source !== entry.path ? <Text style={styles.rowMeta}>{`Implementation: ${entry.path}`}</Text> : null}
    </Pressable>
  );
}

export interface SourceReferencePickerProps<TId extends string = string> {
  /** Controlled — the parent (its Task 2B `CatalogShell` caller) owns open/close state. */
  visible: boolean;
  /** The catalog-wide index to search (`catalogReferences.ts`'s own `buildReferenceIndex`). */
  entries: readonly ReferenceEntry<TId>[];
  /** Escape, the native request-close (Android back / RNW's own Escape handling), or the explicit
   *  Close control — dismissal with no selection. */
  onDismiss: () => void;
  /** A plain click/Enter/tap on one result. This leaf never closes itself or navigates on
   *  selection — the parent owns what happens next (closing the picker, updating the route, and
   *  focusing the destination); see this file's own module doc comment. */
  onSelect: (entry: ReferenceEntry<TId>) => void;
  /** Durable, visibly associated label for the search field (`CatalogSearchInput`'s own
   *  `accessibilityLabel`). @default 'Search source references' */
  searchLabel?: string;
}

/**
 * #60's catalog-wide Source reference picker (plan Task 2, "the accepted A access model"): a
 * controlled modal searching every registered page/member address (`ReferenceEntry[]`), never a
 * page-local member search. Built entirely from existing catalog primitives (`Modal`,
 * `CatalogSearchInput`, `CatalogButton`, the same link/row conventions `CatalogSidebar.tsx`
 * already uses) and catalog tokens — no new dependency, theme, or layout system.
 *
 * This component owns none of the application's navigation/history: `onSelect` only reports a
 * choice, and closing (`visible`) stays fully under the parent's control, so selecting never
 * races this component's own close against whatever focus move the parent makes afterwards. Its
 * real `CatalogShell` caller, wiring `visible`/`onSelect` to an actual route change, is Task 2B —
 * this file and its own self-catalog demo are available infrastructure, not yet adopted product
 * behavior. Keyboard focus trapping and restoring the initiating control on cancellation reuse
 * `Modal`'s own built-in behavior (react-native-web's `ModalFocusTrap`) rather than a second,
 * hand-built dialog engine.
 */
export function SourceReferencePicker<TId extends string = string>({
  visible, entries, onDismiss, onSelect, searchLabel = 'Search source references',
}: SourceReferencePickerProps<TId>) {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const focusSearch = useCallback(() => searchInputRef.current?.focus(), []);
  // Let Modal capture the trigger before moving focus inside. Mount-time autoFocus would
  // instead make its focus-restoration effect remember the search field that is being removed.
  // A member row's own title is just its id (`buildReferenceIndex`'s own convention) — this looks
  // up the family's displayed title for the "<id> — in <family title>" line below, the same
  // wording `CatalogSidebar.tsx`'s own `MemberResultItem` already uses for a member search hit.
  const pageTitleByPageId = useMemo(
    () => new Map(entries.filter((entry) => entry.memberId === undefined).map((entry) => [entry.pageId, entry.title])),
    [entries],
  );
  const trimmedQuery = query.trim();
  const results = useMemo(
    () => sortedEntries(trimmedQuery ? searchReferenceIndex(entries, trimmedQuery) : entries),
    [entries, trimmedQuery],
  );
  return (
    <Modal visible={visible} transparent animationType="none" accessibilityLabel="Source reference" onRequestClose={onDismiss} onShow={focusSearch}>
      <View style={styles.scrim}>
        <View style={styles.dialog}>
          <View style={styles.headerRow}>
            <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Source reference</Text>
            <CatalogButton label="Close" variant="secondary" accessibilityLabel="Close source reference picker" onPress={onDismiss} />
          </View>
          <Text style={styles.searchLabel}>{searchLabel}</Text>
          <CatalogSearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, component, alias, or path"
            accessibilityLabel={searchLabel}
            inputRef={searchInputRef}
          />
          <ScrollView style={styles.list} accessibilityRole="list">
            {entries.length === 0 ? (
              <Text style={styles.empty}>No source references are registered.</Text>
            ) : results.length === 0 ? (
              <Text style={styles.empty}>{`No matches for "${trimmedQuery}".`}</Text>
            ) : (
              results.map((entry) => {
                const label = entry.memberId
                  ? `${entry.title} — in ${pageTitleByPageId.get(entry.pageId) ?? entry.pageId}`
                  : entry.title;
                return <View key={entryKey(entry)} role="listitem"><ResultRow entry={entry} label={label} onSelect={onSelect} /></View>;
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // No existing catalog token covers a scrim or a modal dialog's own bounds — both are
  // component-local, the same way `OverlayDemo.catalog.tsx`'s own demo scrim already is.
  scrim: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: CATALOG_SPACE.xl,
  },
  dialog: {
    width: '100%', maxWidth: 480, maxHeight: '80%',
    backgroundColor: CATALOG_COLOR.surface, borderRadius: CATALOG_RADIUS.card,
    padding: CATALOG_LAYOUT.panelPadding, gap: CATALOG_SPACE.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: CATALOG_SPACE.md },
  heading: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.text },
  searchLabel: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  list: { marginTop: CATALOG_SPACE.xs },
  row: { paddingVertical: CATALOG_SPACE.sm, paddingHorizontal: CATALOG_SPACE.sm, borderRadius: CATALOG_RADIUS.control, gap: 2, minHeight: CATALOG_LAYOUT.controlSize },
  rowHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  rowTitle: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text },
  // A real source path never truncates and may have no spaces to wrap at — `wordBreak` isn't in
  // the installed (React Native, not RNW) `TextStyle` type, the same cast `ReferenceDetails.tsx`'s
  // own `mono` style already needs.
  rowMeta: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.textMuted, wordBreak: 'break-word' } as TextStyle,
  empty: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, paddingVertical: CATALOG_SPACE.md },
});
