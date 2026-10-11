import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame } from '@krapwoo/ds-viewer';
import { Banner } from '../components/Banner';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { ButtonGroup } from '../components/ButtonGroup';
import { Checkbox } from '../components/Checkbox';
import { Dialog } from '../components/Dialog';
import { Dock } from '../components/Dock';
import { PillRow, type PillRowItem } from '../components/PillRow';
import { ProgressDots } from '../components/ProgressDots';
import { Radio } from '../components/Radio';
import { Shimmer, SkeletonGroup } from '../components/Shimmer';
import { Switch } from '../components/Switch';
import { TextArea } from '../components/TextArea';
import { TopNav } from '../components/TopNav';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../tokens';

const styles = StyleSheet.create({
  cardTitle: { ...DS_TYPOGRAPHY.labelMd, color: DS_SEMANTIC.text.regular },
  cardBody: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, marginTop: DS_SPACING[200] },
  shimmerLines: { flex: 1, gap: DS_SPACING[400] },
  // Report-an-issue recipe — the BottomSheet's own scrollable content area, so no separate
  // ScrollView is needed here the way SavedTrips' own scroll needs one (BottomSheet already
  // scrolls its `children` past a height cap).
  reportContent: { gap: DS_SPACING[600] },
  reportSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // External field label for controls that have no label prop of their own (PillRow) — controls
  // that DO own a label (Dropdown, InputField) use theirs instead of this.
  recipeFieldLabel: { ...DS_TYPOGRAPHY.labelXs, color: DS_SEMANTIC.text.muted, marginBottom: DS_SPACING[200] },
  radioGroup: { gap: DS_SPACING[600], alignItems: 'flex-start' },
  dialogActions: { marginTop: DS_SPACING[800] },
});

// Report-issue recipe's line picker — a PillRow, not a Dropdown, specifically because this lives
// inside a BottomSheet: Dropdown opens its own BottomSheet, and stacking two sheets traps the user
// between backdrops (see BottomSheet's `useInsideBottomSheetWarning`).
const REPORT_LINE_PILLS: PillRowItem[] = [
  { id: '4', label: '4 Train' },
  { id: '6', label: '6 Train' },
  { id: 'q', label: 'Q Train' },
];
// Issue-type category — a PillRow (not SegmentedToggle): this is a data choice being filled into
// the report, not a view/mode switch. SegmentedToggle is for "which mode is this screen in right
// now" (e.g. Map vs List); a form's own answer belongs on Pill/Radio instead.
const REPORT_ISSUE_TYPE_PILLS: PillRowItem[] = [
  { id: 'delay', label: 'Delay' },
  { id: 'crowding', label: 'Crowding' },
  { id: 'safety', label: 'Safety' },
];

function ReportIssueDemo() {
  const [visible, setVisible] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [issueType, setIssueType] = useState('delay');
  const [line, setLine] = useState('4');
  const [details, setDetails] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [notify, setNotify] = useState(true);

  const requestClose = () => setConfirmDiscard(true);
  const discard = () => {
    setConfirmDiscard(false);
    setVisible(false);
  };

  return (
    <PhoneFrame>
      {!visible && <Button label="Report an issue" onPress={() => setVisible(true)} />}
      <BottomSheet
        visible={visible}
        onDismiss={requestClose}
        header={
          <TopNav
            title="Report an issue"
            trailing={
              <Button variant="secondary" size="small" showIcon showLabel={false} iconName="clear" accessibilityLabel="Close" onPress={requestClose} />
            }
          />
        }
        footer={
          <Dock>
            <Button label="Submit report" onPress={() => setVisible(false)} />
          </Dock>
        }
      >
        <View style={styles.reportContent}>
          <ProgressDots active={1} total={3} />
          <Banner
            variant="info"
            title="Delays reported near 14 St"
            description="Other riders flagged a signal problem in the last 10 minutes."
          />
          <View>
            <Text style={styles.recipeFieldLabel}>Issue type</Text>
            <PillRow
              pills={REPORT_ISSUE_TYPE_PILLS.map((p) => ({ ...p, variant: p.id === issueType ? 'selected' : 'not_selected', onPress: () => setIssueType(p.id) }))}
              showAddPill={false}
            />
          </View>
          <View>
            <Text style={styles.recipeFieldLabel}>Line</Text>
            <PillRow
              pills={REPORT_LINE_PILLS.map((p) => ({ ...p, variant: p.id === line ? 'selected' : 'not_selected', onPress: () => setLine(p.id) }))}
              showAddPill={false}
            />
          </View>
          <TextArea value={details} onChangeText={setDetails} placeholder="Describe what happened" />
          <Checkbox checked={urgent} onChange={setUrgent} label="This needs urgent attention" />
          <View style={styles.radioGroup}>
            <Radio selected={visibility === 'public'} onPress={() => setVisibility('public')} label="Share publicly" />
            <Radio selected={visibility === 'anonymous'} onPress={() => setVisibility('anonymous')} label="Report anonymously" />
          </View>
          <Switch value={notify} onValueChange={setNotify} label="Notify me when resolved" style={styles.reportSwitchRow} />
          <View>
            <Text style={styles.cardTitle}>Recent reports near you</Text>
            {/* Last line ~70% of the others' width — see ShimmerProps.variant's `'text'` doc.
                SkeletonGroup so the two lines announce as one "Loading" region, not two. */}
            <SkeletonGroup style={styles.shimmerLines}>
              <Shimmer variant="text" width={200} />
              <Shimmer variant="text" width={140} />
            </SkeletonGroup>
          </View>
        </View>
      </BottomSheet>
      <Dialog visible={confirmDiscard} onDismiss={() => setConfirmDiscard(false)}>
        <Text style={styles.cardTitle}>Discard this report?</Text>
        <Text style={styles.cardBody}>Your answers won't be saved.</Text>
        <View style={styles.dialogActions}>
          <ButtonGroup>
            <Button label="Keep editing" variant="tertiary" onPress={() => setConfirmDiscard(false)} />
            <Button label="Discard" onPress={discard} />
          </ButtonGroup>
        </View>
      </Dialog>
    </PhoneFrame>
  );
}

export default defineCatalogPage({
  group: 'Patterns',
  composedOf: [
    { component: 'BottomSheet', role: "Holds the whole report flow, opened from the Report an issue button.", relationship: 'built-in' },
    { component: 'TopNav', role: "The sheet header with a Close button.", relationship: 'built-in' },
    { component: 'ProgressDots', role: "The step indicator.", relationship: 'built-in' },
    { component: 'Banner', role: "The Delays reported near 14 St service alert.", relationship: 'built-in' },
    { component: 'PillRow', role: "The issue-type and line pickers.", relationship: 'built-in' },
    { component: 'TextArea', role: "Free-text details.", relationship: 'built-in' },
    { component: 'Checkbox', role: "Marks the report urgent.", relationship: 'built-in' },
    { component: 'Radio', role: "Chooses between sharing publicly and reporting anonymously.", relationship: 'built-in' },
    { component: 'Switch', role: "Notify me when resolved.", relationship: 'built-in' },
    { component: 'SkeletonGroup', role: "Groups the loading lines for Recent reports near you into one loading region.", relationship: 'built-in' },
    { component: 'Shimmer', role: "The loading lines themselves.", relationship: 'built-in' },
    { component: 'Dock', role: "The sheet footer holding Submit report.", relationship: 'built-in' },
    { component: 'Dialog', role: "Confirms discarding the report on close.", relationship: 'built-in' },
    { component: 'ButtonGroup', role: "The dialog's Keep editing and Discard buttons.", relationship: 'built-in' },
    { component: 'Button', role: "Report an issue, Close, Submit report, and the dialog's actions.", relationship: 'built-in' },
  ],
  description: 'A composed real screen — a "report an issue" flow opened from a BottomSheet, combining a step indicator, a service-alert banner, a Pill-based issue-type and line picker (a data choice, not a view switch, so Pill rather than SegmentedToggle), free-text and toggle inputs, and a loading skeleton for recent reports. Dismissing with unsaved changes opens a confirmation Dialog.',
  tokenGallery: true,
  fullWidthLabel: 'Preview',
  render: () => <ReportIssueDemo />,
});
