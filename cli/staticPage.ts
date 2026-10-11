import * as ts from 'typescript';
import { readFileSync } from 'node:fs';

export interface StaticAxis {
  /** The prop name this axis is bound to (design §4), or undefined for a plain, unbound axis. */
  prop?: string;
  items: { key: string; label: string }[];
}

/** One `ComparisonCell`'s literal-checkable presentation fields, read only when the whole
 *  `comparison` is authored as a direct object literal (never through a `grid()` call, whose
 *  `cell` argument is a function and is never executed — design §4). Each of `surface`/`align`/
 *  `fill` is read independently; a non-literal value on one field leaves only that field unset, the
 *  same per-field leniency `StaticListItem` already uses — a grid cell with an unresolvable
 *  `surface` still reports its resolvable `fill`. */
export interface StaticCell {
  rowKey: string;
  columnKey: string;
  surface?: string;
  align?: string;
  fill?: boolean;
}

export interface StaticComparison {
  rowLabel?: string;
  columnLabel?: string;
  rows: StaticAxis;
  columns: StaticAxis;
  size?: string;
  /** Present only for a direct object-literal `comparison` whose `cells` array is itself a literal
   *  array of object literals — absent for a `grid()` call (cells come from an unevaluated `cell`
   *  function) and for a non-literal `cells` expression (e.g. `.flatMap()`). */
  cells?: StaticCell[];
}

export interface StaticListItem {
  key: string;
  name: string;
  /** From `VariantExample.props` (design §4 "Binding examples to props" — list items use this
   *  existing tag). Only literal string/number/boolean values are kept; a non-literal value (e.g.
   *  a token reference) is simply omitted from this object, not a reason to reject the whole item —
   *  `doctor` only ever needs a tagged prop's *string* value to check against a real option. */
  props?: Record<string, string | number | boolean>;
  group?: string;
  /** `VariantExample.fill`/`.surface`/`.align` (`SpecimenPresentation`), read only when literal —
   *  none of the three are in design §4's original literal-checkable list, so a non-literal value
   *  is simply left unset here rather than making the whole page not checkable. `fill` is read only
   *  from a known `true`/`false` literal; any other expression (a variable, a computed value) stays
   *  unset rather than being misread as `false`. */
  fill?: boolean;
  surface?: string;
  align?: string;
  /** This item's `node`'s own JSX tag name, when `node` is a direct JSX element (self-closing or
   *  with children) — used only by `cli/doctor.ts`'s interactive-preview advisory (design §3) to
   *  tell a direct render of the documented component from a locally-defined wrapper. `node` is
   *  matched by plain tag-name text, not module resolution (design's global constraint: this reader
   *  never resolves imports) — an aliased import (`import { Widget as W }`) is a conservative miss,
   *  never a false positive. Undefined when `node` isn't a direct JSX element at all (a computed
   *  expression, `null`, a conditional, …). */
  nodeDirectComponent?: string;
  /** Only present alongside `nodeDirectComponent` — this JSX element's own attribute values, read
   *  generically (design §3 never knows in advance which prop pair `doctor` will check). See
   *  `StaticAttributeValue`. */
  nodeAttributes?: Record<string, StaticAttributeValue>;
  /** True only when `node` is a JSX element whose tag resolves to a same-file function/arrow
   *  declaration whose own body contains a `useState(`/`React.useState(` call — a confidently
   *  identified, genuinely stateful wrapper (design §3: "do not manufacture a state wrapper," but a
   *  real one the author already wrote must never be reported as an inert, static example).
   *  Undefined (never `false`) for anything else — including a same-file wrapper with no detectable
   *  `useState` call, which stays uncertain rather than asserted inert. */
  nodeStatefulWrapper?: true;
}

/** One `VariantExample`/`ComparisonCell` JSX attribute's literal-checkable shape (design §3, plan
 *  Task 3): a resolvable literal value, a confidently no-op callback (omitted, `undefined`, or an
 *  empty-bodied arrow/function expression — `() => {}`), or `'unknown'` for anything else (an
 *  identifier, a non-empty function body, a call expression, …) — genuinely uncheckable, never
 *  asserted inert. */
export type StaticAttributeValue =
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'no-op-callback' }
  | { kind: 'unknown' };

export interface StaticPage {
  file: string;
  /** False when some piece of this page's layout-relevant data (design §4's list plus the public
   *  `maxColumns` cap: `specimenSize`, `group`, grid `rows`/`columns`, slots' `maxColumns`, list
   *  items' `key`/`name`/`props`/`group`, `propNotes` keys) wasn't a literal this reader can resolve.
   *  This does NOT mean every field below is absent — only the specific field(s) that failed to
   *  read are left unset; a field that *was* read successfully is still usable by a caller (e.g.
   *  `propNoteKeys` can be present even though `comparison` is absent because only the comparison
   *  wasn't literal). */
  checkable: boolean;
  /** Set only when the file failed to parse (a syntax error) — distinct from `checkable: false`,
   *  which also covers a page that parsed fine but has non-literal layout data. */
  parseError?: string;
  id?: string;
  component?: string;
  group?: string;
  specimenSize?: string;
  tokenGallery?: boolean;
  /** `tokenSections`' titles, in order (a non-literal title reads as ""), and `tokenColumns` when
   *  literal. A page with sections counts as a token gallery with examples. */
  tokenSectionTitles?: string[];
  /** Per section, whether `wide: true` is set literally (same order as the titles). */
  tokenSectionWide?: boolean[];
  tokenColumns?: number;
  /** Whether the page object has its own `whenToUse`/`a11y` property at all — a presence check
   *  only (design's literal-data list never requires these two to be literal, only that `doctor`
   *  can tell whether they were authored), so these are read with a plain property lookup, never
   *  `resolve()`'d to a value. Used by `doctor`'s `missing-guidance-or-a11y` warning. */
  hasWhenToUse?: boolean;
  hasA11y?: boolean;
  /** Whether the page has its own `render` property at all (presence only, same reasoning as
   *  `hasWhenToUse` — design never requires its *value* to be literal). `cli/explain.ts` (Task 6)
   *  uses this to decide whether an otherwise-empty page would show a Preview block in the viewer. */
  hasRender?: boolean;
  /** `hide.accessibility === true`, literally — when set, `missing-guidance-or-a11y` never fires
   *  for the missing-a11y half, since the viewer never shows that box anyway. */
  hidesAccessibility?: boolean;
  /** Present keys of `propNotes`, regardless of whether the page's `propNotes` could be read in
   *  full — only the keys (prop names) matter to `doctor`'s `propnotes-prop-removed` rule. */
  propNoteKeys?: string[];
  comparison?: StaticComparison;
  variantsItems?: StaticListItem[];
  statesItems?: StaticListItem[];
  /** None of the first four fields below are in design §4's original literal-checkable list, so a
   *  non-literal value is simply left unset here. `maxColumns` is the exception: it changes the
   *  list geometry `cli/explain.ts` reports, so a non-literal or out-of-range cap makes the page not
   *  checkable rather than letting the CLI drift from the viewer. */
  previewWidths?: readonly number[] | 'full';
  fullWidthLabel?: string;
  hideVariants?: boolean;
  hideStates?: boolean;
  variantsItemsFill?: boolean;
  statesItemsFill?: boolean;
  /** Literal `VariantSlot.maxColumns` values. Unlike `itemsFill`, a non-literal cap makes the page
   *  not checkable because `explain` would otherwise report different list geometry than the viewer. */
  variantsMaxColumns?: 1 | 2 | 3 | 4 | 5;
  statesMaxColumns?: 1 | 2 | 3 | 4 | 5;
  /** Whether the page has its own `composedOf` property at all (presence only — same reasoning as
   *  `hasWhenToUse`). `cli/doctor.ts`'s missing-composition advisory only ever suggests against a
   *  page whose `composedOf` could actually be read; a page that authors one non-literally (e.g.
   *  built with `.map()`) is given the same "never a partial read" benefit of the doubt as any
   *  other not-literally-checkable field, rather than risk a false "missing" claim. */
  hasComposedOf?: boolean;
  /** `ComposedOfEntry.component` names only (design §4: never role/relationship, which `doctor`'s
   *  comparison against `ComponentRecord.composedOfCandidates` never needs) — present only when
   *  `composedOf` is itself a literal array of object literals, each with a literal `component`. */
  composedOf?: { component: string }[];
  /** `CatalogPageInput.intentionalStaticPreview.reason`, literal only — a non-literal reason is
   *  left unset (not fabricated, not a "not checkable" penalty, same leniency as `whenToUse`/`a11y`
   *  presence checks: this never affects `page.checkable`). */
  intentionalStaticPreviewReason?: string;
}

const TRANSPILE_OPTIONS: ts.TranspileOptions = {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
};

/** Reads every page file's literal-checkable fields (design §4 "Static checking"). Never imports
 *  the file and never builds a `ts.Program` across files — no module resolution happens at all, so
 *  this cannot fail because of an unresolved import, a missing `node_modules`, or a stale type.
 *  One broken file never stops the rest (Global Constraints, Error-handling rule): each file is
 *  read independently. */
export function readStaticPages(pageFiles: string[]): StaticPage[] {
  // Error-handling rule (design, Global Constraints): one broken file never stops the rest of a
  // read. `readStaticPage` already guards its own `readFileSync` call, but an unexpected throw
  // from deeper in its AST walk (e.g. a pathological same-file `const` chain overflowing the call
  // stack) must be caught per file too, not just per-read, or it aborts every other page in the
  // same `doctor`/`explain` run.
  return pageFiles.map((file) => {
    try {
      return readStaticPage(file);
    } catch (error) {
      return { file, checkable: false, parseError: (error as Error).message };
    }
  });
}

function readStaticPage(file: string): StaticPage {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    return { file, checkable: false, parseError: (error as Error).message };
  }
  // `transpileModule` parses a single file with no module resolution at all — its `diagnostics`
  // are syntactic only (it never type-checks), which is exactly "fails to parse" (design §4's
  // error rule) and nothing more; a semantic/type error in a page file is out of this reader's
  // scope (it never had enough information — no resolved `node_modules` — to find one anyway).
  const { diagnostics } = ts.transpileModule(text, TRANSPILE_OPTIONS);
  if (diagnostics && diagnostics.length > 0) {
    return { file, checkable: false, parseError: ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n') };
  }
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const imports = importedNames(sourceFile, '@krapwoo/ds-viewer');
  const defineCatalogPageNames = localNamesFor(imports, 'defineCatalogPage');
  const gridNames = localNamesFor(imports, 'grid');

  const call = defaultExportCall(sourceFile);
  if (!call || !ts.isIdentifier(call.expression) || !defineCatalogPageNames.has(call.expression.text) || call.arguments.length !== 1) {
    // Not a recognized `defineCatalogPage(...)` default export — e.g. a hand-written object, or a
    // shadowed/renamed import this reader can't trace. Not a parse error: the file is valid
    // TypeScript, just not literal-checkable.
    return { file, checkable: false };
  }
  const consts = topLevelConsts(sourceFile);
  const pageObject = resolve(call.arguments[0], consts, new Set());
  if (!ts.isObjectLiteralExpression(pageObject)) return { file, checkable: false };

  const page: StaticPage = { file, checkable: true };
  const idProp = findProp(pageObject, 'id');
  const componentProp = findProp(pageObject, 'component');
  const groupProp = findProp(pageObject, 'group');
  const specimenSizeProp = findProp(pageObject, 'specimenSize');
  const tokenGalleryProp = findProp(pageObject, 'tokenGallery');
  if (idProp) page.id = stringLiteral(resolve(idProp.initializer, consts, new Set()));
  if (componentProp) page.component = stringLiteral(resolve(componentProp.initializer, consts, new Set()));
  if (groupProp) page.group = stringLiteral(resolve(groupProp.initializer, consts, new Set()));
  if (specimenSizeProp) page.specimenSize = stringLiteral(resolve(specimenSizeProp.initializer, consts, new Set()));
  if (tokenGalleryProp) page.tokenGallery = resolve(tokenGalleryProp.initializer, consts, new Set()).kind === ts.SyntaxKind.TrueKeyword;
  const tokenSectionsProp = findProp(pageObject, 'tokenSections');
  if (tokenSectionsProp) {
    const list = resolve(tokenSectionsProp.initializer, consts, new Set());
    const items = ts.isArrayLiteralExpression(list) ? list.elements.map((element) => resolve(element, consts, new Set())) : [list];
    const field = (item: ts.Node, name: string) => (ts.isObjectLiteralExpression(item) ? findProp(item, name) : undefined);
    page.tokenSectionTitles = items.map((item) => {
      const title = field(item, 'title');
      return (title && stringLiteral(resolve(title.initializer, consts, new Set()))) ?? '';
    });
    page.tokenSectionWide = items.map((item) => {
      const wide = field(item, 'wide');
      return wide ? resolve(wide.initializer, consts, new Set()).kind === ts.SyntaxKind.TrueKeyword : false;
    });
    if (page.tokenSectionTitles.length > 0) page.tokenGallery = true;
  }
  const tokenColumnsProp = findProp(pageObject, 'tokenColumns');
  if (tokenColumnsProp) {
    const value = resolve(tokenColumnsProp.initializer, consts, new Set());
    if (ts.isNumericLiteral(value)) page.tokenColumns = Number(value.text);
  }
  page.hasWhenToUse = findProp(pageObject, 'whenToUse') !== undefined;
  page.hasA11y = findProp(pageObject, 'a11y') !== undefined;
  page.hasRender = findProp(pageObject, 'render') !== undefined;
  const hideProp = findProp(pageObject, 'hide');
  if (hideProp) {
    const hideObject = resolve(hideProp.initializer, consts, new Set());
    const literalBool = (name: string) => {
      const prop = ts.isObjectLiteralExpression(hideObject) ? findProp(hideObject, name) : undefined;
      return prop ? resolve(prop.initializer, consts, new Set()).kind === ts.SyntaxKind.TrueKeyword : false;
    };
    page.hidesAccessibility = literalBool('accessibility');
    page.hideVariants = literalBool('variants');
    page.hideStates = literalBool('states');
  }

  const previewWidthsProp = findProp(pageObject, 'previewWidths');
  if (previewWidthsProp) {
    const resolved = resolve(previewWidthsProp.initializer, consts, new Set());
    if (ts.isStringLiteral(resolved) && resolved.text === 'full') {
      page.previewWidths = 'full';
    } else if (ts.isArrayLiteralExpression(resolved) && resolved.elements.every(ts.isNumericLiteral)) {
      page.previewWidths = resolved.elements.map((element) => Number((element as ts.NumericLiteral).text));
    }
    // Anything else (a function call, a non-literal expression) is simply left unset — `previewWidths`
    // isn't in design §4's literal-checkable list, so it's never a reason to flip `checkable`.
  }
  const fullWidthLabelProp = findProp(pageObject, 'fullWidthLabel');
  if (fullWidthLabelProp) page.fullWidthLabel = stringLiteral(resolve(fullWidthLabelProp.initializer, consts, new Set()));

  const propNotesProp = findProp(pageObject, 'propNotes');
  if (propNotesProp) {
    const resolved = resolve(propNotesProp.initializer, consts, new Set());
    if (ts.isObjectLiteralExpression(resolved)) {
      page.propNoteKeys = resolved.properties.filter(ts.isPropertyAssignment).map((p) => propertyName(p.name));
    } else {
      page.checkable = false;
    }
  }

  const comparisonProp = findProp(pageObject, 'comparison');
  if (comparisonProp) {
    const comparison = readComparison(comparisonProp.initializer, consts, gridNames);
    if (comparison) page.comparison = comparison;
    else page.checkable = false;
  }

  const variants = readSlotItems(findProp(pageObject, 'variants'), consts, page.component, sourceFile);
  if (!variants.checkable) page.checkable = false;
  else {
    page.variantsItems = variants.items;
    page.variantsItemsFill = variants.itemsFill;
    page.variantsMaxColumns = variants.maxColumns;
  }

  const states = readSlotItems(findProp(pageObject, 'states'), consts, page.component, sourceFile);
  if (!states.checkable) page.checkable = false;
  else {
    page.statesItems = states.items;
    page.statesItemsFill = states.itemsFill;
    page.statesMaxColumns = states.maxColumns;
  }

  const composedOfProp = findProp(pageObject, 'composedOf');
  page.hasComposedOf = composedOfProp !== undefined;
  if (composedOfProp) page.composedOf = readComposedOf(composedOfProp.initializer, consts);

  const intentionalStaticPreviewProp = findProp(pageObject, 'intentionalStaticPreview');
  if (intentionalStaticPreviewProp) {
    const resolved = resolve(intentionalStaticPreviewProp.initializer, consts, new Set());
    if (ts.isObjectLiteralExpression(resolved)) {
      const reasonProp = findProp(resolved, 'reason');
      if (reasonProp) page.intentionalStaticPreviewReason = stringLiteral(resolve(reasonProp.initializer, consts, new Set()));
    }
  }

  return page;
}

/** A literal array of `ComposedOfEntry`-shaped object literals, read down to just `component`
 *  (design §4: role/relationship are authored prose `doctor` never needs for its missing-
 *  composition comparison). Undefined — not an empty array — for anything that isn't itself a
 *  literal array, or whose element isn't an object literal with a literal `component`: `doctor`
 *  must never mistake "couldn't read this" for "author declared no composition here". */
function readComposedOf(node: ts.Expression, consts: Map<string, ts.Expression>): { component: string }[] | undefined {
  const resolved = resolve(node, consts, new Set());
  if (!ts.isArrayLiteralExpression(resolved)) return undefined;
  const entries: { component: string }[] = [];
  for (const element of resolved.elements) {
    const resolvedElement = resolve(element, consts, new Set());
    if (!ts.isObjectLiteralExpression(resolvedElement)) return undefined;
    const component = propertyStringLiteral(resolvedElement, 'component', consts);
    if (component === undefined) return undefined;
    entries.push({ component });
  }
  return entries;
}

/** Local name -> imported name, for every named import from `moduleSpecifier`. */
function importedNames(sourceFile: ts.SourceFile, moduleSpecifier: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== moduleSpecifier) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      names.set(element.name.text, element.propertyName ? element.propertyName.text : element.name.text);
    }
  }
  return names;
}

function localNamesFor(imports: Map<string, string>, importedName: string): Set<string> {
  const locals = new Set<string>();
  for (const [local, imported] of imports) if (imported === importedName) locals.add(local);
  return locals;
}

function defaultExportCall(sourceFile: ts.SourceFile): ts.CallExpression | undefined {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals && ts.isCallExpression(statement.expression)) {
      return statement.expression;
    }
  }
  return undefined;
}

function topLevelConsts(sourceFile: ts.SourceFile): Map<string, ts.Expression> {
  const consts = new Map<string, ts.Expression>();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) consts.set(declaration.name.text, declaration.initializer);
    }
  }
  return consts;
}

/** Unwraps `as`/parenthesized/`satisfies` expressions and chases a same-file top-level `const`
 *  reference to its own initializer (same pattern as `cli/tokens.ts`'s `readExpression`) — returns
 *  the resolved expression node itself, not a value, so callers can pattern-match on its kind
 *  (array/object literal, call expression, …). `seen` guards a reference cycle. */
function resolve(node: ts.Expression, consts: Map<string, ts.Expression>, seen: Set<string>): ts.Expression {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) {
    return resolve(node.expression, consts, seen);
  }
  if (ts.isIdentifier(node) && !seen.has(node.text)) {
    const target = consts.get(node.text);
    if (target) return resolve(target, consts, new Set(seen).add(node.text));
  }
  return node;
}

function stringLiteral(node: ts.Expression): string | undefined {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
}

/** `true`/`false` only from a known `true`/`false` literal; any other expression (a variable, a
 *  computed value) stays `undefined` rather than being misread as `false`. Unlike the page's own
 *  `hide.*`/`tokenGallery`/`itemsFill`/`wide` booleans — which intentionally treat "not literally
 *  `true`" as `false`, since those already default to `false` when omitted — `fill`'s own default
 *  is inherited (`SpecimenPresentation.fill` defaults to the slot's `itemsFill`, not to `false`),
 *  so a non-literal value here must stay honestly unknown instead of claiming "not filling". */
function literalBooleanOrUnknown(node: ts.Expression, consts: Map<string, ts.Expression>): boolean | undefined {
  const resolved = resolve(node, consts, new Set());
  if (resolved.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (resolved.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function propertyName(name: ts.PropertyName): string {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText();
}

function findProp(obj: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
  const prop = obj.properties.find((p) => ts.isPropertyAssignment(p) && propertyName(p.name) === name);
  return prop as ts.PropertyAssignment | undefined;
}

function propertyStringLiteral(obj: ts.ObjectLiteralExpression, name: string, consts: Map<string, ts.Expression>): string | undefined {
  const prop = findProp(obj, name);
  return prop ? stringLiteral(resolve(prop.initializer, consts, new Set())) : undefined;
}

/** A literal array of `{ key, label }` object literals — each element may itself be a same-file
 *  const reference. Undefined (not literal) for anything else: a `.map()`/other call, a spread, a
 *  cross-file import. */
function readAxisItemArray(node: ts.Expression, consts: Map<string, ts.Expression>): { key: string; label: string }[] | undefined {
  const resolved = resolve(node, consts, new Set());
  if (!ts.isArrayLiteralExpression(resolved)) return undefined;
  const items: { key: string; label: string }[] = [];
  for (const element of resolved.elements) {
    const resolvedElement = resolve(element, consts, new Set());
    if (!ts.isObjectLiteralExpression(resolvedElement)) return undefined;
    const key = propertyStringLiteral(resolvedElement, 'key', consts);
    const label = propertyStringLiteral(resolvedElement, 'label', consts);
    if (key === undefined || label === undefined) return undefined;
    items.push({ key, label });
  }
  return items;
}

/** A `GridAxis` (design §4): a plain literal array, or `{ prop, items }` (`items` itself read by
 *  `readAxisItemArray`). Undefined for anything else. */
function readAxis(node: ts.Expression, consts: Map<string, ts.Expression>): StaticAxis | undefined {
  const resolved = resolve(node, consts, new Set());
  if (ts.isArrayLiteralExpression(resolved)) {
    const items = readAxisItemArray(resolved, consts);
    return items ? { items } : undefined;
  }
  if (ts.isObjectLiteralExpression(resolved)) {
    const propProp = findProp(resolved, 'prop');
    const itemsProp = findProp(resolved, 'items');
    if (!propProp || !itemsProp) return undefined;
    const prop = stringLiteral(resolve(propProp.initializer, consts, new Set()));
    const items = readAxisItemArray(itemsProp.initializer, consts);
    if (prop === undefined || !items) return undefined;
    return { prop, items };
  }
  return undefined;
}

/** A literal array of `ComparisonCell`-shaped object literals: `rowKey`/`columnKey` required
 *  (string literals only), `surface`/`align`/`fill` read the same per-field-lenient way
 *  `readListItems` reads them. `node`/`unavailableReason` are never inspected — design §4 never
 *  evaluates a cell's specimen node. Undefined (no cell metadata at all, not "every field unset")
 *  for anything that isn't itself a literal array, or whose element isn't itself an object literal
 *  with literal `rowKey`/`columnKey` — a `.flatMap()`-built `cells` array (the starter kit's own
 *  convention for a `grid()`-free literal comparison) stays unrepresented rather than guessed at. */
function readComparisonCells(node: ts.Expression, consts: Map<string, ts.Expression>): StaticCell[] | undefined {
  const resolved = resolve(node, consts, new Set());
  if (!ts.isArrayLiteralExpression(resolved)) return undefined;
  const cells: StaticCell[] = [];
  for (const element of resolved.elements) {
    const resolvedElement = resolve(element, consts, new Set());
    if (!ts.isObjectLiteralExpression(resolvedElement)) return undefined;
    const rowKey = propertyStringLiteral(resolvedElement, 'rowKey', consts);
    const columnKey = propertyStringLiteral(resolvedElement, 'columnKey', consts);
    if (rowKey === undefined || columnKey === undefined) return undefined;
    const surface = propertyStringLiteral(resolvedElement, 'surface', consts);
    const align = propertyStringLiteral(resolvedElement, 'align', consts);
    const fillProp = findProp(resolvedElement, 'fill');
    const fill = fillProp ? literalBooleanOrUnknown(fillProp.initializer, consts) : undefined;
    cells.push({ rowKey, columnKey, surface, align, fill });
  }
  return cells;
}

/** A page's `comparison` field: either a direct `ComparisonDef`-shaped object literal, or (the
 *  starter kit's own convention since Task 1/2) a call to this package's own `grid()` helper — the
 *  one call shape this reader specially recognizes, reading its `rows`/`columns` arguments and
 *  skipping its `cell` argument entirely (design §4: "Specimen nodes and `cell(...)` functions are
 *  not evaluated"). `gridNames` is the set of local identifiers that import resolved to `grid` from
 *  `@krapwoo/ds-viewer` — a page's own unrelated local function named `grid` is never matched. */
function readComparison(node: ts.Expression, consts: Map<string, ts.Expression>, gridNames: Set<string>): StaticComparison | undefined {
  const resolved = resolve(node, consts, new Set());
  if (ts.isCallExpression(resolved) && ts.isIdentifier(resolved.expression) && gridNames.has(resolved.expression.text)) {
    const [rowLabelArg, columnLabelArg, rowsArg, columnsArg, , sizeArg] = resolved.arguments;
    const rows = rowsArg && readAxis(rowsArg, consts);
    const columns = columnsArg && readAxis(columnsArg, consts);
    if (!rows || !columns) return undefined;
    return {
      rowLabel: rowLabelArg ? stringLiteral(resolve(rowLabelArg, consts, new Set())) : undefined,
      columnLabel: columnLabelArg ? stringLiteral(resolve(columnLabelArg, consts, new Set())) : undefined,
      rows,
      columns,
      size: sizeArg ? stringLiteral(resolve(sizeArg, consts, new Set())) : undefined,
    };
  }
  if (ts.isObjectLiteralExpression(resolved)) {
    const rowsProp = findProp(resolved, 'rows');
    const columnsProp = findProp(resolved, 'columns');
    if (!rowsProp || !columnsProp) return undefined;
    const rows = readAxis(rowsProp.initializer, consts);
    const columns = readAxis(columnsProp.initializer, consts);
    if (!rows || !columns) return undefined;
    const rowLabelProp = findProp(resolved, 'rowLabel');
    const columnLabelProp = findProp(resolved, 'columnLabel');
    const sizeProp = findProp(resolved, 'size');
    const cellsProp = findProp(resolved, 'cells');
    return {
      rowLabel: rowLabelProp ? stringLiteral(resolve(rowLabelProp.initializer, consts, new Set())) : undefined,
      columnLabel: columnLabelProp ? stringLiteral(resolve(columnLabelProp.initializer, consts, new Set())) : undefined,
      rows,
      columns,
      size: sizeProp ? stringLiteral(resolve(sizeProp.initializer, consts, new Set())) : undefined,
      cells: cellsProp ? readComparisonCells(cellsProp.initializer, consts) : undefined,
    };
  }
  return undefined;
}

/** A literal array of list-item object literals — `key`/`name` required; `props` (read as a flat
 *  literal map, non-literal values simply omitted) and `group` optional. Each item's `node` field
 *  (always present, always JSX) is never inspected — reading the sibling fields never depends on it. */
function readListItems(
  node: ts.Expression,
  consts: Map<string, ts.Expression>,
  componentName: string | undefined,
  sourceFile: ts.SourceFile,
): StaticListItem[] | undefined {
  const resolved = resolve(node, consts, new Set());
  if (!ts.isArrayLiteralExpression(resolved)) return undefined;
  const items: StaticListItem[] = [];
  for (const element of resolved.elements) {
    const resolvedElement = resolve(element, consts, new Set());
    if (!ts.isObjectLiteralExpression(resolvedElement)) return undefined;
    const key = propertyStringLiteral(resolvedElement, 'key', consts);
    const name = propertyStringLiteral(resolvedElement, 'name', consts);
    if (key === undefined || name === undefined) return undefined;
    const group = propertyStringLiteral(resolvedElement, 'group', consts);
    const propsProp = findProp(resolvedElement, 'props');
    const fillProp = findProp(resolvedElement, 'fill');
    const fill = fillProp ? literalBooleanOrUnknown(fillProp.initializer, consts) : undefined;
    const surface = propertyStringLiteral(resolvedElement, 'surface', consts);
    const align = propertyStringLiteral(resolvedElement, 'align', consts);
    const nodeProp = findProp(resolvedElement, 'node');
    const nodeExample = nodeProp ? readNodeExample(nodeProp.initializer, consts, componentName, sourceFile) : {};
    items.push({
      key, name, group, props: propsProp ? readLiteralProps(propsProp.initializer, consts) : undefined, fill, surface, align,
      ...nodeExample,
    });
  }
  return items;
}

/** Generic, additive reading of one item's own `node:` JSX (design §3, plan Task 3) — used only by
 *  `cli/doctor.ts`'s interactive-preview advisory. Never evaluates `node`; only reads its literal
 *  AST shape. `node` matching `componentName` by plain tag-name text (not module resolution — this
 *  reader never resolves imports) means "a direct instance of the documented component": its own
 *  JSX attributes are read generically (`nodeAttributes`). Any other JSX tag is checked only for
 *  whether it's a confidently-identified, genuinely stateful same-file wrapper
 *  (`nodeStatefulWrapper`) — never asserted one way or the other when that can't be confirmed.
 *  Anything that isn't a direct JSX element at all (`null`, a conditional, a function call, …)
 *  leaves every field unset. */
function readNodeExample(
  node: ts.Expression,
  consts: Map<string, ts.Expression>,
  componentName: string | undefined,
  sourceFile: ts.SourceFile,
): Pick<StaticListItem, 'nodeDirectComponent' | 'nodeAttributes' | 'nodeStatefulWrapper'> {
  const resolved = resolve(node, consts, new Set());
  let element: ts.JsxSelfClosingElement | ts.JsxOpeningElement | undefined;
  if (ts.isJsxSelfClosingElement(resolved)) element = resolved;
  else if (ts.isJsxElement(resolved)) element = resolved.openingElement;
  if (!element || !ts.isIdentifier(element.tagName)) return {};
  const tagText = element.tagName.text;
  if (componentName !== undefined && tagText === componentName) {
    const nodeAttributes: Record<string, StaticAttributeValue> = {};
    for (const attribute of element.attributes.properties) {
      // Skips a spread attribute ({...rest}) and a namespaced name (xml:lang) — unreadable,
      // never a reason to reject the whole item.
      if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) continue;
      nodeAttributes[attribute.name.text] = readJsxAttributeValue(attribute, consts);
    }
    return { nodeDirectComponent: tagText, nodeAttributes };
  }
  return { nodeStatefulWrapper: sameFileWrapperHasUseState(sourceFile, tagText) ? true : undefined };
}

/** One JSX attribute's value, as a `StaticAttributeValue`. A shorthand attribute (`disabled`, no
 *  `initializer` at all — equivalent to `disabled={true}`) is a literal `true`. */
function readJsxAttributeValue(attribute: ts.JsxAttribute, consts: Map<string, ts.Expression>): StaticAttributeValue {
  if (!attribute.initializer) return { kind: 'literal', value: true };
  if (ts.isStringLiteral(attribute.initializer)) return { kind: 'literal', value: attribute.initializer.text };
  if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) return { kind: 'unknown' };
  const resolved = resolve(attribute.initializer.expression, consts, new Set());
  if (ts.isStringLiteral(resolved) || ts.isNoSubstitutionTemplateLiteral(resolved)) return { kind: 'literal', value: resolved.text };
  if (ts.isNumericLiteral(resolved)) return { kind: 'literal', value: Number(resolved.text) };
  if (resolved.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true };
  if (resolved.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false };
  if (ts.isIdentifier(resolved) && resolved.text === 'undefined') return { kind: 'no-op-callback' };
  if ((ts.isArrowFunction(resolved) || ts.isFunctionExpression(resolved)) && isEmptyFunctionBody(resolved.body)) {
    return { kind: 'no-op-callback' };
  }
  return { kind: 'unknown' };
}

function isEmptyFunctionBody(body: ts.ConciseBody): boolean {
  return ts.isBlock(body) && body.statements.length === 0;
}

/** True only when `sourceFile` declares a top-level function (declaration, or a `const`/`let`
 *  initialized with a function/arrow expression) named `tagName` whose own body contains a call to
 *  a *source-backed* React `useState`/`React.useState` — a confidently-identified, genuinely
 *  stateful wrapper. Walking only that one function's own body (never the whole file) keeps this
 *  scoped the same way `cli/props.ts`'s composedOfCandidate reader scopes its own JSX walk to one
 *  implementation. */
function sameFileWrapperHasUseState(sourceFile: ts.SourceFile, tagName: string): boolean {
  const bindings = reactUseStateBindings(sourceFile);
  for (const statement of sourceFile.statements) {
    let body: ts.ConciseBody | undefined;
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === tagName) body = statement.body;
    else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) && declaration.name.text === tagName && declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        ) {
          body = declaration.initializer.body;
        }
      }
    }
    if (body && containsUseStateCall(body, bindings)) return true;
  }
  return false;
}

/** This file's own top-level `import ... from 'react'` bindings relevant to recognizing a genuine
 *  `useState` call — never a type-checker resolution, only the same-file import syntax, matching
 *  this reader's existing "never resolves imports across files" contract. `namedUseState` holds
 *  every local name bound to the real named `useState` export (an alias, e.g. `import { useState as
 *  useReactState }`, included); `reactNamespace` holds every local name bound to the whole `react`
 *  module (a default or `* as` import) that a `React.useState(...)` call could be written through.
 *  A locally-defined `useState` (no matching import) or an unrelated object's own `.useState` method
 *  binds to neither set and so is never counted — left uncheckable, never asserted stateful. */
function reactUseStateBindings(sourceFile: ts.SourceFile): { namedUseState: Set<string>; reactNamespace: Set<string> } {
  const namedUseState = new Set<string>();
  const reactNamespace = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'react') continue;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) reactNamespace.add(clause.name.text);
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) reactNamespace.add(clause.namedBindings.name.text);
    else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if ((element.propertyName ?? element.name).text === 'useState') namedUseState.add(element.name.text);
      }
    }
  }
  return { namedUseState, reactNamespace };
}

function containsUseStateCall(node: ts.Node, bindings: { namedUseState: Set<string>; reactNamespace: Set<string> }): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const isNamedUseState = ts.isIdentifier(callee) && bindings.namedUseState.has(callee.text);
      const isReactNamespaceUseState =
        ts.isPropertyAccessExpression(callee) && callee.name.text === 'useState' &&
        ts.isIdentifier(callee.expression) && bindings.reactNamespace.has(callee.expression.text);
      if (isNamedUseState || isReactNamespaceUseState) {
        found = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function readLiteralProps(node: ts.Expression, consts: Map<string, ts.Expression>): Record<string, string | number | boolean> | undefined {
  const resolved = resolve(node, consts, new Set());
  if (!ts.isObjectLiteralExpression(resolved)) return undefined;
  const result: Record<string, string | number | boolean> = {};
  for (const property of resolved.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const value = resolve(property.initializer, consts, new Set());
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) result[propertyName(property.name)] = value.text;
    else if (ts.isNumericLiteral(value)) result[propertyName(property.name)] = Number(value.text);
    else if (value.kind === ts.SyntaxKind.TrueKeyword) result[propertyName(property.name)] = true;
    else if (value.kind === ts.SyntaxKind.FalseKeyword) result[propertyName(property.name)] = false;
    // Anything else (e.g. a token reference) is skipped, not a reason to reject the whole item —
    // `props` tags are only ever compared against a prop's string options (design §4).
  }
  return result;
}

/** A `variants`/`states` field: `{ itemsFill?, maxColumns?, items: [...] }`, `items` read by
 *  `readListItems`. Distinguishes "field absent" (always checkable, everything undefined) from
 *  "field present but not literal" (not checkable). `itemsFill` is read only if present and
 *  literal — like `previewWidths`/`fullWidthLabel`, it isn't in the original literal-checkable
 *  list, so a non-literal `itemsFill` is simply left unset. `maxColumns` does affect the geometry
 *  `explain` reports, so it must be a literal integer from 1–5 or the page is not checkable. */
function readSlotItems(
  prop: ts.PropertyAssignment | undefined,
  consts: Map<string, ts.Expression>,
  componentName: string | undefined,
  sourceFile: ts.SourceFile,
): { items?: StaticListItem[]; itemsFill?: boolean; maxColumns?: 1 | 2 | 3 | 4 | 5; checkable: boolean } {
  if (!prop) return { checkable: true };
  const resolved = resolve(prop.initializer, consts, new Set());
  const itemsProp = ts.isObjectLiteralExpression(resolved) ? findProp(resolved, 'items') : undefined;
  if (!itemsProp) return { checkable: false };
  const items = readListItems(itemsProp.initializer, consts, componentName, sourceFile);
  if (!items) return { checkable: false };
  const itemsFillProp = ts.isObjectLiteralExpression(resolved) ? findProp(resolved, 'itemsFill') : undefined;
  const itemsFill = itemsFillProp ? resolve(itemsFillProp.initializer, consts, new Set()).kind === ts.SyntaxKind.TrueKeyword : undefined;
  const maxColumnsProp = ts.isObjectLiteralExpression(resolved) ? findProp(resolved, 'maxColumns') : undefined;
  let maxColumns: 1 | 2 | 3 | 4 | 5 | undefined;
  if (maxColumnsProp) {
    const value = resolve(maxColumnsProp.initializer, consts, new Set());
    if (!ts.isNumericLiteral(value)) return { checkable: false };
    const parsed = Number(value.text);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return { checkable: false };
    maxColumns = parsed as 1 | 2 | 3 | 4 | 5;
  }
  return { items, itemsFill, maxColumns, checkable: true };
}
