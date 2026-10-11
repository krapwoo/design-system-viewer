import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readComponents } from '../props.ts';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');
const TYPE_ROOT = path.resolve(import.meta.dirname, '../../kit-host/node_modules');
const RESOLVE_OPTIONS = {
  paths: {
    react: [path.join(TYPE_ROOT, '@types/react')],
    'react/*': [path.join(TYPE_ROOT, '@types/react/*')],
    'react-native': [path.join(TYPE_ROOT, 'react-native')],
    'react-native/*': [path.join(TYPE_ROOT, 'react-native/*')],
  },
};

test('readComponents reads a React.memo component\'s props, defaults, and JSDoc', () => {
  const entryFile = path.join(FIXTURE_ROOT, 'src/components/Button/index.ts');
  const [button] = readComponents(entryFile, RESOLVE_OPTIONS);
  assert.equal(button.name, 'Button');
  assert.deepEqual(
    button.props.map((p) => [p.name, p.required, p.default, p.desc]),
    [
      ['label', false, "'Button'", 'Button label.'],
      ['onPress', true, undefined, 'Called when pressed.'],
    ],
  );
  assert.deepEqual(button.inheritedFrom, []);
});

test('readComponents prints an optional prop\'s non-nullable type, not "T | undefined"', () => {
  const entryFile = path.join(FIXTURE_ROOT, 'src/components/Button/index.ts');
  const [button] = readComponents(entryFile, RESOLVE_OPTIONS);
  const label = button.props.find((p) => p.name === 'label');
  assert.equal(label?.type, 'string');
});

test('readComponents reads a plain function component with a required prop', () => {
  const entryFile = path.join(FIXTURE_ROOT, 'src/components/Badge/index.ts');
  const [badge] = readComponents(entryFile, RESOLVE_OPTIONS);
  assert.equal(badge.name, 'Badge');
  assert.deepEqual(badge.props.map((p) => [p.name, p.required, p.desc]), [['label', true, "The badge's text."]]);
});

test('readComponents returns nothing for an entry file with no component exports', () => {
  const entryFile = path.join(FIXTURE_ROOT, 'src/tokens/index.ts');
  assert.deepEqual(readComponents(entryFile, RESOLVE_OPTIONS), []);
});

test('readComponents records options only for a 2+-member string-literal union declared inside optionRoots', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-options-'));
  const componentsDir = path.join(projectRoot, 'components', 'Widget');
  const iconsDir = path.join(projectRoot, 'icons');
  mkdirSync(componentsDir, { recursive: true });
  mkdirSync(iconsDir, { recursive: true });
  writeFileSync(path.join(componentsDir, 'Widget.types.ts'), "export type Variant = 'primary' | 'ghost';\n");
  writeFileSync(path.join(iconsDir, 'IconName.ts'), "export type IconName = 'home' | 'pin' | 'bell';\n");
  writeFileSync(
    path.join(componentsDir, 'Widget.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      "import type { Variant } from './Widget.types';",
      "import type { IconName } from '../../icons/IconName';",
      '',
      'export interface WidgetProps {',
      '  variant?: Variant;',
      "  size?: 'small';",
      '  icon?: IconName;',
      '}',
      '',
      'export function Widget({ variant, size, icon }: WidgetProps) {',
      '  return <Text>{variant}{size}{icon}</Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(componentsDir, 'index.ts'), "export { Widget } from './Widget';\nexport type { WidgetProps } from './Widget';\n");

  const entryFile = path.join(componentsDir, 'index.ts');
  const [widget] = readComponents(entryFile, { ...RESOLVE_OPTIONS, optionRoots: [path.join(projectRoot, 'components')] });
  assert.deepEqual(
    widget.props.map((p) => [p.name, p.options]),
    [
      ['variant', ['primary', 'ghost']],
      ['size', undefined],
      ['icon', undefined],
    ],
  );
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents skips a union declared in another component\'s folder (e.g. a sibling Icon component\'s IconName)', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-sibling-options-'));
  const root = path.join(projectRoot, 'components');
  mkdirSync(path.join(root, 'Widget'), { recursive: true });
  mkdirSync(path.join(root, 'Icon'), { recursive: true });
  writeFileSync(path.join(root, 'Icon', 'Icon.types.ts'), "export type IconName = 'home' | 'pin' | 'bell';\n");
  writeFileSync(path.join(root, 'Widget', 'Widget.types.ts'), "export type Variant = 'primary' | 'ghost';\n");
  writeFileSync(
    path.join(root, 'Widget', 'Widget.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      "import type { Variant } from './Widget.types';",
      "import type { IconName } from '../Icon/Icon.types';",
      'export interface WidgetProps { variant?: Variant; icon?: IconName; }',
      'export function Widget({ variant, icon }: WidgetProps) { return <Text>{variant}{icon}</Text>; }',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(root, 'Widget', 'index.ts'), "export { Widget } from './Widget';\nexport type { WidgetProps } from './Widget';\n");
  const [widget] = readComponents(path.join(root, 'Widget', 'index.ts'), { ...RESOLVE_OPTIONS, optionRoots: [root], componentRoots: [root] });
  assert.deepEqual(widget.props.map((p) => [p.name, p.options]), [['variant', ['primary', 'ghost']], ['icon', undefined]]);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents does not report a forwardRef component\'s inherited "ref" as a react prop', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-forwardref-'));
  const componentsDir = path.join(projectRoot, 'components', 'Field');
  mkdirSync(componentsDir, { recursive: true });
  writeFileSync(
    path.join(componentsDir, 'Field.tsx'),
    [
      "import React from 'react';",
      "import { TextInput, type TextInputProps } from 'react-native';",
      '',
      'export interface FieldProps extends TextInputProps {',
      '  label: string;',
      '}',
      '',
      "export const Field = React.forwardRef<TextInput, FieldProps>(function Field({ label, ...rest }, ref) {",
      '  return <TextInput ref={ref} placeholder={label} {...rest} />;',
      '});',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(componentsDir, 'index.ts'), "export { Field } from './Field';\n");

  const [field] = readComponents(path.join(componentsDir, 'index.ts'), RESOLVE_OPTIONS);
  assert.ok(!field.props.some((p) => p.name === 'ref'), 'ref should not be listed as a regular prop');
  assert.ok(!field.inheritedFrom.includes('react'), 'inherited "react" props (ref) should not be reported');
  assert.ok(field.inheritedFrom.includes('TextInput'), 'TextInput\'s own inherited props should still be reported');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents reports the intersected node_modules type\'s own name, not its ancestors', () => {
  // `type Props = TextInputProps & {...}` pulls TextInputProps in directly as an intersection
  // member, not via a local interface's own `extends` clause — walking its heritage clauses (as
  // the `extends TextInputProps` case does) would instead report TextInputProps's own ancestors
  // ("View", "TouchableWithoutFeedback") (Fable's review, cli/props.ts:270-301).
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-intersection-'));
  const componentsDir = path.join(projectRoot, 'components', 'Field');
  mkdirSync(componentsDir, { recursive: true });
  writeFileSync(
    path.join(componentsDir, 'Field.tsx'),
    [
      "import React from 'react';",
      "import { TextInput, type TextInputProps } from 'react-native';",
      '',
      'type FieldProps = TextInputProps & {',
      '  label: string;',
      '};',
      '',
      'export function Field({ label, ...rest }: FieldProps) {',
      '  return <TextInput placeholder={label} {...rest} />;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(componentsDir, 'index.ts'), "export { Field } from './Field';\n");

  const [field] = readComponents(path.join(componentsDir, 'index.ts'), RESOLVE_OPTIONS);
  assert.deepEqual(field.inheritedFrom, ['TextInput']);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents resolves `extends Omit<NodeModulesType, ...>` to the omitted type\'s own name', () => {
  // `Omit<TextInputProps, 'value'>`'s own declaration lives in typescript's lib, under
  // `node_modules`, so without resolving to its first type argument the heritage name read back
  // was "Omit" (Fable's review, cli/props.ts:270-301: '"plus all Omit props"').
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-omit-'));
  const componentsDir = path.join(projectRoot, 'components', 'Field');
  mkdirSync(componentsDir, { recursive: true });
  writeFileSync(
    path.join(componentsDir, 'Field.tsx'),
    [
      "import React from 'react';",
      "import { TextInput, type TextInputProps } from 'react-native';",
      '',
      "export interface FieldProps extends Omit<TextInputProps, 'value'> {",
      '  label: string;',
      '}',
      '',
      'export function Field({ label, ...rest }: FieldProps) {',
      '  return <TextInput placeholder={label} {...rest} />;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(componentsDir, 'index.ts'), "export { Field } from './Field';\n");

  const [field] = readComponents(path.join(componentsDir, 'index.ts'), RESOLVE_OPTIONS);
  assert.deepEqual(field.inheritedFrom, ['TextInput']);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents merges props across a union of object types, tagging branch-only props', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-union-'));
  const componentsDir = path.join(projectRoot, 'components', 'Card');
  mkdirSync(componentsDir, { recursive: true });
  writeFileSync(
    path.join(componentsDir, 'Card.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      '',
      'interface BaseCardProps {',
      '  /** The card\'s heading. */',
      '  title: string;',
      '}',
      '',
      'type CardProps = (BaseCardProps & { href: string }) | (BaseCardProps & { onPress: () => void });',
      '',
      'export function Card(props: CardProps) {',
      '  return <Text>{props.title}</Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(componentsDir, 'index.ts'), "export { Card } from './Card';\n");

  const [card] = readComponents(path.join(componentsDir, 'index.ts'), RESOLVE_OPTIONS);
  assert.deepEqual(
    card.props.map((p) => [p.name, p.required]),
    [
      ['title', true],
      ['href', false],
      ['onPress', false],
    ],
  );
  assert.equal(card.props.find((p) => p.name === 'title')?.desc, 'The card\'s heading.');
  assert.match(card.props.find((p) => p.name === 'href')?.desc ?? '', /Only with some variants of this prop's type\./);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents keeps an optional prop\'s alias name when the alias\'s own definition already includes `undefined`', () => {
  // `StyleLike<T>` mirrors react-native's `StyleProp<T>`: a generic alias whose own expansion
  // already contains `undefined`/`null`, so making the prop optional never adds a fresh top-level
  // `| undefined` — `checker.getNonNullableType` then has to tear the alias open to drop that
  // nested `undefined`, losing the alias name (design §3: "Type column: keeps alias names").
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-alias-'));
  const componentsDir = path.join(projectRoot, 'components', 'Surface');
  mkdirSync(componentsDir, { recursive: true });
  writeFileSync(
    path.join(componentsDir, 'Surface.tsx'),
    [
      "import React from 'react';",
      "import { Text, type ReactNode } from 'react';",
      '',
      "type Falsy = false | '' | null | undefined;",
      'type StyleLike<T> = T | Falsy;',
      '',
      'export interface SurfaceProps {',
      '  containerStyle?: StyleLike<{ color: string }>;',
      '  children?: ReactNode;',
      '}',
      '',
      'export function Surface({ children }: SurfaceProps) {',
      '  return <Text>{children}</Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(componentsDir, 'index.ts'), "export { Surface } from './Surface';\n");

  const [surface] = readComponents(path.join(componentsDir, 'index.ts'), RESOLVE_OPTIONS);
  assert.equal(surface.props.find((p) => p.name === 'containerStyle')?.type, 'StyleLike<{ color: string; }>');
  assert.equal(surface.props.find((p) => p.name === 'children')?.type, 'ReactNode');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents strips `| undefined` from an optional prop whose type contains an arrow function', () => {
  // `splitTopLevelUnion` walks the printed type counting `<`/`(`/`{`/`[` as depth; an arrow's `=>`
  // was previously miscounted as a closing `>`, so the union split never saw the top-level ` | `
  // and the `undefined` member survived (Fable's review, cli/props.ts:250).
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-arrow-'));
  const componentsDir = path.join(projectRoot, 'components', 'Arrow');
  mkdirSync(componentsDir, { recursive: true });
  writeFileSync(
    path.join(componentsDir, 'Arrow.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      '',
      'export interface ArrowProps {',
      '  onPress?: () => void;',
      '  link?: { label: string; onPress: () => void };',
      '  cb?: ((t: string) => void) | null;',
      '}',
      '',
      'export function Arrow({ onPress }: ArrowProps) {',
      '  return <Text onPress={onPress}>Arrow</Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(componentsDir, 'index.ts'), "export { Arrow } from './Arrow';\n");

  const [arrow] = readComponents(path.join(componentsDir, 'index.ts'), RESOLVE_OPTIONS);
  assert.equal(arrow.props.find((p) => p.name === 'onPress')?.type, '() => void');
  assert.equal(arrow.props.find((p) => p.name === 'link')?.type, '{ label: string; onPress: () => void; }');
  assert.equal(arrow.props.find((p) => p.name === 'cb')?.type, '(t: string) => void');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents joins a multi-line JSDoc paragraph\'s hard-wrapped source lines with single spaces', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-jsdoc-wrap-'));
  const componentsDir = path.join(projectRoot, 'components', 'Wrapped');
  mkdirSync(componentsDir, { recursive: true });
  writeFileSync(
    path.join(componentsDir, 'Wrapped.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      '',
      'export interface WrappedProps {',
      '  /** Disabled state, dimmed icon and text, a step past the hint tone, so it reads as',
      '   * inactive rather than merely empty. Forces the field non-editable regardless',
      '   * of the editable prop.',
      '   *',
      '   * A second paragraph that must stay on its own line.',
      '   */',
      '  disabled?: boolean;',
      '}',
      '',
      'export function Wrapped({ disabled }: WrappedProps) {',
      '  return <Text>{disabled}</Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(componentsDir, 'index.ts'), "export { Wrapped } from './Wrapped';\n");

  const [wrapped] = readComponents(path.join(componentsDir, 'index.ts'), RESOLVE_OPTIONS);
  assert.equal(
    wrapped.props.find((p) => p.name === 'disabled')?.desc,
    'Disabled state, dimmed icon and text, a step past the hint tone, so it reads as inactive rather than merely empty. Forces the field non-editable regardless of the editable prop.\n\nA second paragraph that must stay on its own line.',
  );
  rmSync(projectRoot, { recursive: true, force: true });
});

// Guided intelligence design §4 / plan Task 3 — `ComponentRecord.composedOfCandidates`: optional,
// additive source evidence of another known component actually rendered as JSX inside this
// component's own implementation. Never a role/relationship claim — just `{ component, file, line }`.
test('readComponents records a composedOfCandidate for a component rendered through an import alias and a barrel re-export', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-composed-alias-'));
  const root = path.join(projectRoot, 'components');
  mkdirSync(path.join(root, 'Icon'), { recursive: true });
  mkdirSync(path.join(root, 'shared'), { recursive: true });
  mkdirSync(path.join(root, 'Widget'), { recursive: true });
  writeFileSync(path.join(root, 'Icon', 'Icon.tsx'), "import React from 'react';\nimport { View } from 'react-native';\nexport function Icon() { return <View />; }\n");
  writeFileSync(path.join(root, 'Icon', 'index.ts'), "export { Icon } from './Icon';\n");
  // A barrel that re-exports Icon under a different name — the alias chain a real design system
  // often has (`shared/index.ts` fronting several components' own folders).
  writeFileSync(path.join(root, 'shared', 'index.ts'), "export { Icon as SharedIcon } from '../Icon';\n");
  writeFileSync(
    path.join(root, 'Widget', 'Widget.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      "import { SharedIcon as Ico } from '../shared';",
      '',
      'export function Widget() {',
      '  return <Text><Ico /></Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(root, 'Widget', 'index.ts'), "export { Widget } from './Widget';\n");

  const [widget] = readComponents(path.join(root, 'Widget', 'index.ts'), RESOLVE_OPTIONS);
  // Canonical identity ("Icon") comes from the real export, not either local alias ("SharedIcon"/"Ico").
  assert.deepEqual(widget.composedOfCandidates?.map((c) => c.component), ['Icon']);
  const candidate = widget.composedOfCandidates?.[0];
  assert.equal(candidate?.file, path.relative(process.cwd(), path.join(root, 'Widget', 'Widget.tsx')));
  assert.equal(candidate?.line, 6);
  // A react-native primitive (`Text`) is also rendered here, but it lives under node_modules — not
  // a "known canonical component export" of this project — so it must never become a candidate.
  assert.ok(!widget.composedOfCandidates?.some((c) => c.component === 'Text'));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents never promotes a type-only import of a component to a composedOfCandidate', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-composed-typeonly-'));
  const root = path.join(projectRoot, 'components');
  mkdirSync(path.join(root, 'Badge'), { recursive: true });
  mkdirSync(path.join(root, 'Widget'), { recursive: true });
  writeFileSync(path.join(root, 'Badge', 'Badge.tsx'), "import React from 'react';\nimport { View } from 'react-native';\nexport function Badge() { return <View />; }\n");
  writeFileSync(path.join(root, 'Badge', 'index.ts'), "export { Badge } from './Badge';\n");
  writeFileSync(
    path.join(root, 'Widget', 'Widget.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      "import type { Badge } from '../Badge';",
      '',
      '// Used only as a type position — never rendered — so it must never become a candidate.',
      'export function Widget({ ref }: { ref?: typeof Badge }) {',
      '  return <Text>{String(Boolean(ref))}</Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(root, 'Widget', 'index.ts'), "export { Widget } from './Widget';\n");

  const [widget] = readComponents(path.join(root, 'Widget', 'index.ts'), RESOLVE_OPTIONS);
  assert.deepEqual(widget.composedOfCandidates ?? [], []);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents never promotes an ordinary import that is referenced but never rendered as JSX', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-composed-unrendered-'));
  const root = path.join(projectRoot, 'components');
  mkdirSync(path.join(root, 'Badge'), { recursive: true });
  mkdirSync(path.join(root, 'Widget'), { recursive: true });
  writeFileSync(path.join(root, 'Badge', 'Badge.tsx'), "import React from 'react';\nimport { View } from 'react-native';\nexport function Badge() { return <View />; }\n");
  writeFileSync(path.join(root, 'Badge', 'index.ts'), "export { Badge } from './Badge';\n");
  writeFileSync(
    path.join(root, 'Widget', 'Widget.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      "import { Badge } from '../Badge';",
      '',
      '// Badge is a real value import, used as a value — but never written as a JSX tag anywhere.',
      'export function Widget() {',
      '  const cached = Badge;',
      '  return <Text>{String(Boolean(cached))}</Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(root, 'Widget', 'index.ts'), "export { Widget } from './Widget';\n");

  const [widget] = readComponents(path.join(root, 'Widget', 'index.ts'), RESOLVE_OPTIONS);
  assert.deepEqual(widget.composedOfCandidates ?? [], []);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents does not attribute a same-file helper\'s own JSX to an unrelated exported component', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-composed-helper-'));
  const root = path.join(projectRoot, 'components');
  mkdirSync(path.join(root, 'Icon'), { recursive: true });
  mkdirSync(path.join(root, 'Widget'), { recursive: true });
  writeFileSync(path.join(root, 'Icon', 'Icon.tsx'), "import React from 'react';\nimport { View } from 'react-native';\nexport function Icon() { return <View />; }\n");
  writeFileSync(path.join(root, 'Icon', 'index.ts'), "export { Icon } from './Icon';\n");
  writeFileSync(
    path.join(root, 'Widget', 'Widget.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      "import { Icon } from '../Icon';",
      '',
      '// `renderIcon` is its own, non-exported helper — its JSX belongs to it, not to Widget below,',
      '// even though Widget calls it (as a function, never as a JSX tag of its own).',
      'function renderIcon() {',
      '  return <Icon />;',
      '}',
      '',
      'export function Widget() {',
      '  return <Text>{renderIcon()}</Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(root, 'Widget', 'index.ts'), "export { Widget } from './Widget';\n");

  const [widget] = readComponents(path.join(root, 'Widget', 'index.ts'), RESOLVE_OPTIONS);
  assert.deepEqual(widget.composedOfCandidates ?? [], []);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents does not attribute a nested named helper\'s own JSX to the component that merely calls it', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-composed-nested-helper-'));
  const root = path.join(projectRoot, 'components');
  mkdirSync(path.join(root, 'Icon'), { recursive: true });
  mkdirSync(path.join(root, 'Widget'), { recursive: true });
  writeFileSync(path.join(root, 'Icon', 'Icon.tsx'), "import React from 'react';\nimport { View } from 'react-native';\nexport function Icon() { return <View />; }\n");
  writeFileSync(path.join(root, 'Icon', 'index.ts'), "export { Icon } from './Icon';\n");
  writeFileSync(
    path.join(root, 'Widget', 'Widget.tsx'),
    [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      "import { Icon } from '../Icon';",
      '',
      'export function Widget() {',
      "  // `renderIcon` is a named helper nested inside Widget's own body — its JSX belongs to it,",
      '  // not to Widget, even though Widget calls it (as a function, never as a JSX tag of its own).',
      '  function renderIcon() {',
      '    return <Icon />;',
      '  }',
      '  return <Text>{renderIcon()}</Text>;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(root, 'Widget', 'index.ts'), "export { Widget } from './Widget';\n");

  const [widget] = readComponents(path.join(root, 'Widget', 'index.ts'), RESOLVE_OPTIONS);
  assert.deepEqual(widget.composedOfCandidates ?? [], []);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('readComponents leaves a dynamic/unresolved JSX tag uncertain, never a composedOfCandidate', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-composed-dynamic-'));
  const root = path.join(projectRoot, 'components');
  mkdirSync(path.join(root, 'Icon'), { recursive: true });
  mkdirSync(path.join(root, 'Badge'), { recursive: true });
  mkdirSync(path.join(root, 'Widget'), { recursive: true });
  writeFileSync(path.join(root, 'Icon', 'Icon.tsx'), "import React from 'react';\nimport { View } from 'react-native';\nexport function Icon() { return <View />; }\n");
  writeFileSync(path.join(root, 'Icon', 'index.ts'), "export { Icon } from './Icon';\n");
  writeFileSync(path.join(root, 'Badge', 'Badge.tsx'), "import React from 'react';\nimport { View } from 'react-native';\nexport function Badge() { return <View />; }\n");
  writeFileSync(path.join(root, 'Badge', 'index.ts'), "export { Badge } from './Badge';\n");
  writeFileSync(
    path.join(root, 'Widget', 'Widget.tsx'),
    [
      "import React from 'react';",
      "import { Icon } from '../Icon';",
      "import { Badge } from '../Badge';",
      '',
      'export function Widget({ useIcon }: { useIcon: boolean }) {',
      '  const Comp = useIcon ? Icon : Badge;',
      '  return <Comp />;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(path.join(root, 'Widget', 'index.ts'), "export { Widget } from './Widget';\n");

  const [widget] = readComponents(path.join(root, 'Widget', 'index.ts'), RESOLVE_OPTIONS);
  assert.deepEqual(widget.composedOfCandidates ?? [], []);
  rmSync(projectRoot, { recursive: true, force: true });
});
