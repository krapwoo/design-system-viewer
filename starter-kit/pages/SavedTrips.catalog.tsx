import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame } from '@krapwoo/ds-viewer';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Dock } from '../components/Dock';
import { Dropdown } from '../components/Dropdown';
import { EmptyState } from '../components/EmptyState';
import { List } from '../components/List';
import { ListItem } from '../components/ListItem';
import { Loading } from '../components/Loading';
import { PillRow, type PillRowItem } from '../components/PillRow';
import { SearchField } from '../components/SearchField';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedToggle } from '../components/SegmentedToggle';
import { Surface } from '../components/Surface';
import { Toast } from '../components/Toast';
import { Tooltip } from '../components/Tooltip';
import { TopNav } from '../components/TopNav';
import { UnderlineTabs } from '../components/UnderlineTabs';
import { Icon } from '../icons/Icon.native';
import { DS_ICON_SIZE, DS_MOTION_DURATION, DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../tokens';

const styles = StyleSheet.create({
  // Saved trips recipe — fills PhoneFrame edge-to-edge (like dropdownFrameContent), with a
  // fixed TopNav header and Dock footer around a scrollable middle, the same fixed-header/
  // scrollable-body/fixed-footer shape a real screen would use.
  savedTripsScreen: { flex: 1, alignSelf: 'stretch' },
  // A fixed cap (not `flex: 1`) — sidesteps a web-only flexbox quirk where a `flex: 1` ScrollView
  // nested inside PhoneFrame's own fixed height doesn't actually shrink to the space left after
  // TopNav/Dock, and grows PhoneFrame itself past its intended 480px instead of scrolling.
  savedTripsScroll: { maxHeight: 320 },
  savedTripsScrollContent: { padding: DS_SPACING[800], gap: DS_SPACING[600] },
  // Shared by SavedTrips' small inline rows — the "Updating arrival times…" loading row and each
  // list row's trailing badge+button cluster (identical layout, one key).
  savedTripsInlineRow: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[300] },
  savedTripsLoadingText: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted },
  // Floats over the top of the screen — same top/left/right inset Toast's own catalog demo uses —
  // instead of sitting inline in the flex flow and pushing the Dock down. A column with a small
  // gap, since back-to-back removals stack one toast per removal (newest on top).
  savedTripsToastOverlay: { position: 'absolute', top: DS_SPACING[800], left: DS_SPACING[600], right: DS_SPACING[600], zIndex: 20, gap: DS_SPACING[300] },
  // Map mode's stand-in — a real map isn't in scope for this recipe, just enough to show the
  // SegmentedToggle actually switches the screen's content, not just its own thumb.
  savedTripsMapPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: DS_SPACING[400], paddingVertical: DS_SPACING[2400] },
  savedTripsMapPlaceholderText: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted },
});

const SAVED_TRIPS_INITIAL = [
  { id: 'uptown', title: 'Uptown & The Bronx', subtitle: '4 min · Subway', iconName: 'subway' as const, badgeVariant: 'positive' as const, badgeLabel: 'On time' },
  { id: 'downtown', title: 'Downtown & Brooklyn', subtitle: '12 min · Train', iconName: 'train' as const, badgeVariant: 'warning' as const, badgeLabel: 'Delayed' },
  { id: 'airport', title: 'Airport Express', subtitle: '22 min · Train', iconName: 'train' as const, badgeVariant: 'neutral' as const, badgeLabel: 'Scheduled' },
];
const SAVED_TRIPS_SORT_OPTIONS = [
  { value: 'arrival', label: 'Arrival time' },
  { value: 'distance', label: 'Distance' },
  { value: 'name', label: 'Name' },
];
// How long the "Trip removed" toast stays up before auto-dismissing, same as a real snackbar —
// matches Toast's own doc comment ("expected to go away on its own or via its own action").
const SAVED_TRIPS_TOAST_MS = 3000;

function SavedTripsDemo() {
  const [tab, setTab] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('arrival');
  const [pills, setPills] = useState<PillRowItem[]>([
    { id: 'subway', label: 'Subway', variant: 'selected', iconName: 'subway' },
    { id: 'train', label: 'Train', variant: 'not_selected', iconName: 'train' },
    { id: 'ferry', label: 'Ferry', variant: 'not_selected', iconName: 'ferry' },
  ]);
  const [showFilterTip, setShowFilterTip] = useState(false);
  const [trips, setTrips] = useState(SAVED_TRIPS_INITIAL);
  // Toasts only appear right after a real action (removing a trip) and auto-dismiss — they never
  // sit statically in the initial render, since that's not what Toast is for. Each removal gets its
  // OWN stacked toast on its own 3s clock (newest on top), so removing a second trip while the
  // first toast is still up never cuts the first one short — the earlier single-toast version
  // reused one `visible` boolean, which couldn't restart its timer for a back-to-back removal.
  // `visible: false` plays Toast's own exit animation; the entry is dropped from the array only
  // after that animation has had time to run.
  const [toasts, setToasts] = useState<
    Array<{ key: number; trip: (typeof SAVED_TRIPS_INITIAL)[number]; visible: boolean }>
  >([]);
  const nextToastKey = useRef(0);
  const toastTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  // Timers are scheduled per-removal (in event handlers, not an effect), so unmount cleanup is one
  // sweep here rather than per-timer effect returns.
  useEffect(() => () => toastTimers.current.forEach(clearTimeout), []);

  const hideToast = (key: number) => {
    setToasts((prev) => prev.map((t) => (t.key === key ? { ...t, visible: false } : t)));
    // Drop the entry once Toast's exit animation (it exits at DS_MOTION_DURATION.fast) has played.
    toastTimers.current.push(
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.key !== key)), DS_MOTION_DURATION.fast),
    );
  };
  const removeTrip = (id: string) => {
    const removed = trips.find((t) => t.id === id);
    if (!removed) return;
    setTrips((prev) => prev.filter((t) => t.id !== id));
    const key = nextToastKey.current++;
    setToasts((prev) => [{ key, trip: removed, visible: true }, ...prev]);
    toastTimers.current.push(setTimeout(() => hideToast(key), SAVED_TRIPS_TOAST_MS));
  };
  const undoRemove = (key: number, trip: (typeof SAVED_TRIPS_INITIAL)[number]) => {
    setTrips((prev) => [...prev, trip]);
    hideToast(key);
  };

  return (
    <PhoneFrame>
      <View style={styles.savedTripsScreen}>
        <TopNav
          title="Saved trips"
          trailing={
            <Tooltip visible={showFilterTip} label="Filter by mode" placement="bottom" align="right">
              <Button
                variant="secondary"
                size="small"
                showIcon
                showLabel={false}
                iconName="menu"
                accessibilityLabel="Filters"
                onPress={() => setShowFilterTip((v) => !v)}
              />
            </Tooltip>
          }
        />
        <Surface tone="muted">
          <ScrollView style={styles.savedTripsScroll} contentContainerStyle={styles.savedTripsScrollContent}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search stations" />
            <SegmentedToggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'list', label: 'List', iconName: 'menu' },
                { value: 'map', label: 'Map', iconName: 'map' },
              ]}
            />
            {viewMode === 'map' ? (
              <View style={styles.savedTripsMapPlaceholder}>
                <Icon name="map" size={DS_ICON_SIZE.xl} color={DS_SEMANTIC.text.muted} />
                <Text style={styles.savedTripsMapPlaceholderText}>Map view</Text>
              </View>
            ) : (
              <>
                <UnderlineTabs
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'nearby', label: 'Nearby' },
                    { value: 'favorites', label: 'Favorites' },
                  ]}
                />
                {tab === 'favorites' ? (
                  <EmptyState
                    iconName="waypoints"
                    title="No favorites yet"
                    description="Star a trip to see it here."
                    action={{ label: 'Browse trips', onPress: () => setTab('all') }}
                    secondaryAction={{ label: 'Not now', onPress: () => {} }}
                  />
                ) : (
                  <>
                    <PillRow
                      pills={pills.map((p) => ({ ...p, onPress: () => setPills((prev) => prev.map((x) => ({ ...x, variant: x.id === p.id ? 'selected' : 'not_selected' }))) }))}
                      showAddPill={false}
                    />
                    <View style={styles.savedTripsInlineRow}>
                      <Loading size={14} />
                      <Text style={styles.savedTripsLoadingText}>Updating arrival times…</Text>
                    </View>
                    {/* Dropdown's own `label` prop, not a hand-rolled Text above it — the component
                        already owns the labeled-field pattern (PillRow, which has no label prop, is
                        the case where an external label is legitimately the only option). */}
                    <Dropdown label="Sort by" value={sortBy} onChange={setSortBy} options={SAVED_TRIPS_SORT_OPTIONS} />
                    <SectionHeader title="Nearby stations" />
                    {trips.length > 0 ? (
                      <List>
                        {trips.map((trip) => (
                          <ListItem
                            key={trip.id}
                            title={trip.title}
                            subtitle={trip.subtitle}
                            leading={<Avatar iconName={trip.iconName} size={40} />}
                            trailing={
                              <View style={styles.savedTripsInlineRow}>
                                <Badge variant={trip.badgeVariant} label={trip.badgeLabel} />
                                <Button
                                  variant="ghost"
                                  size="small"
                                  showIcon
                                  showLabel={false}
                                  iconName="clear"
                                  accessibilityLabel={`Remove ${trip.title}`}
                                  onPress={() => removeTrip(trip.id)}
                                />
                              </View>
                            }
                          />
                        ))}
                      </List>
                    ) : (
                      <EmptyState
                        iconName="waypoints"
                        title="No nearby trips"
                        description="Removed trips you save will show up here again."
                      />
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </Surface>
        {/* Absolutely positioned over the top of the screen (not inline in the flex flow — a real
            toast floats over content, it doesn't push the Dock down) — same placement Toast's own
            catalog demo uses. One Toast per pending removal, stacked newest-on-top; each entry
            stays in the array (with `visible: false`) through its own exit animation instead of
            being yanked out of the tree mid-motion. */}
        <View style={styles.savedTripsToastOverlay} pointerEvents="box-none">
          {toasts.map((t) => (
            <Toast
              key={t.key}
              visible={t.visible}
              message={`${t.trip.title} removed`}
              action={{ label: 'Undo', onPress: () => undoRemove(t.key, t.trip) }}
            />
          ))}
        </View>
        <Dock>
          <Button label="Plan a new trip" onPress={() => {}} />
        </Dock>
      </View>
    </PhoneFrame>
  );
}

export default defineCatalogPage({
  group: 'Recipes',
  description: 'A composed real screen — a saved-trips list with a search bar, tab switcher, mode filter pills, a sort Dropdown, and a bottom action bar. Switch to the "Favorites" tab (or remove every row) to see the EmptyState alternative to the list; tap the header icon to see its Tooltip; tap a row\'s trailing × to see the Toast, which only appears after that real action and auto-dismisses (or Undo) — remove two rows back-to-back and each removal gets its own stacked toast on its own clock.',
  tokenGallery: true,
  fullWidthLabel: 'Preview',
  render: () => <SavedTripsDemo />,
});
