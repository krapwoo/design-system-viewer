import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { SidePanel } from './SidePanel';
import { SidePanelTrigger } from './SidePanelTrigger';
import { CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

// At most one token's details are open at a time, across the whole page: opening one closes any
// other. A module-level store (not a provider) so it holds wherever the components are mounted.
// Keyed on a per-instance counter value, not `useId`, which is only unique within one React root.
type InstanceKey = number;
let openKey: InstanceKey | null = null;
let nextKey = 0;
const listeners = new Set<() => void>();
function setOpenKey(next: InstanceKey | null) {
  if (openKey === next) return;
  openKey = next;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const getServerOpen = () => false;

export interface TokenDetailsProps {
  /** The panel heading and the token this opens, e.g. `8pt`. Names the trigger: "Details for 8pt". */
  title: string;
  /** What kind of token this is, shown above the heading, e.g. `Corner radius`. */
  kicker?: string;
  /** The token's source expression, in monospace. */
  expression?: string;
  /** Where the token is defined, one `path:line`. */
  source?: string;
  /** Every place the token is used (`path:line` or a file name), listed in full under "Used at N sites". */
  usages?: readonly string[];
  /** Usage text for when only an aggregate is known (no per-site list). */
  usageSummary?: string;
  /** Anything extra, rendered last. */
  children?: React.ReactNode;
}

/** A token's "Details ›" link and the side panel it opens: the token's source expression, source
 *  location and usages, kept out of its tile so the tile shows only its value and specimen. The
 *  panel's content mounts only once opened. */
export function TokenDetails({ title, kicker, expression, source, usages, usageSummary, children }: TokenDetailsProps) {
  // Each instance subscribes to its own boolean, so opening or closing re-renders only the (at most
  // two) instances whose answer changes, not every token on the page.
  const [key] = useState<InstanceKey>(() => nextKey++);
  const getOpen = useCallback(() => openKey === key, [key]);
  const open = useSyncExternalStore(subscribe, getOpen, getServerOpen);
  const close = useCallback(() => { if (openKey === key) setOpenKey(null); }, [key]);
  // An unmounted token must not leave the shared slot pointing at it.
  useEffect(() => close, [close]);
  return (
    <>
      <SidePanelTrigger label="Details" accessibilityLabel={`Details for ${title}`} open={open} onPress={() => setOpenKey(key)} />
      {open ? (
        <SidePanel kicker={kicker ?? 'Token details'} title={title} onClose={close}>
          <View style={styles.stack}>
            {expression ? <TokenDetailsFact label="Expression" value={expression} /> : null}
            {source ? <TokenDetailsFact label="Source" value={source} /> : null}
            {usages && usages.length > 0 ? (
              <View style={styles.fact}>
                <Text style={styles.factLabel}>{`Used at ${usages.length} ${usages.length === 1 ? 'site' : 'sites'}`}</Text>
                {usages.map((usage, index) => <Text key={`${index}:${usage}`} style={styles.mono}>{usage}</Text>)}
              </View>
            ) : null}
            {usageSummary ? (
              <View style={styles.fact}>
                {usages && usages.length > 0 ? null : <Text style={styles.factLabel}>Usage</Text>}
                <Text style={styles.text}>{usageSummary}</Text>
              </View>
            ) : null}
            {children}
          </View>
        </SidePanel>
      ) : null}
    </>
  );
}

function TokenDetailsFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.mono}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: CATALOG_SPACE.lg },
  fact: { gap: CATALOG_SPACE.xs },
  factLabel: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.textMuted },
  // Long paths and expressions wrap at their '/'s instead of overflowing the panel, as `ReferenceDetails`' `mono` does.
  mono: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.text, wordBreak: 'break-word' } as TextStyle,
  text: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.text },
});
