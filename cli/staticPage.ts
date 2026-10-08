import * as ts from 'typescript';
import { readFileSync } from 'node:fs';

export interface StaticAxis {
  /** The prop name this axis is bound to (design §4), or undefined for a plain, unbound axis. */
  prop?: string;
  items: { key: string; label: string }[];
}

export interface StaticComparison {
  rowLabel?: string;
  columnLabel?: string;
  rows: StaticAxis;
  columns: StaticAxis;
  size?: string;
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
}

export interface StaticPage {
  file: string;
  /** False when some piece of this page's layout-relevant data (design §4's list: `specimenSize`,
   *  `group`, grid `rows`/`columns`, list items' `key`/`name`/`props`/`group`, `propNotes` keys)
   *  wasn't a literal this reader can resolve. This does NOT mean every field below is absent —
   *  only the specific field(s) that failed to read are left unset; a field that *was* read
   *  successfully is still usable by a caller (e.g. `propNoteKeys` can be present even though
   *  `comparison` is absent because only the comparison wasn't literal). */
  checkable: boolean;
  /** Set only when the file failed to parse (a syntax error) — distinct from `checkable: false`,
   *  which also covers a page that parsed fine but has non-literal layout data. */
  parseError?: string;
  id?: string;
  component?: string;
  group?: string;
  specimenSize?: string;
  tokenGallery?: boolean;
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
  /** None of these four are in design §4's literal-checkable list, so a non-literal value for any
   *  of them is simply left unset here — never a reason to flip `checkable` to false. `cli/explain.ts`
   *  (Task 6) needs them to avoid reporting different geometry than the real viewer for a page that
   *  sets any of them (Important finding: `itemsFill`, `hide.variants`/`hide.states`, and
   *  `fullWidthLabel` were dropped by an earlier draft's `toSectionDef`). */
  previewWidths?: readonly number[] | 'full';
  fullWidthLabel?: string;
  hideVariants?: boolean;
  hideStates?: boolean;
  variantsItemsFill?: boolean;
  statesItemsFill?: boolean;
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
  return pageFiles.map(readStaticPage);
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

  const variants = readSlotItems(findProp(pageObject, 'variants'), consts);
  if (!variants.checkable) page.checkable = false;
  else {
    page.variantsItems = variants.items;
    page.variantsItemsFill = variants.itemsFill;
  }

  const states = readSlotItems(findProp(pageObject, 'states'), consts);
  if (!states.checkable) page.checkable = false;
  else {
    page.statesItems = states.items;
    page.statesItemsFill = states.itemsFill;
  }

  return page;
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
    return {
      rowLabel: rowLabelProp ? stringLiteral(resolve(rowLabelProp.initializer, consts, new Set())) : undefined,
      columnLabel: columnLabelProp ? stringLiteral(resolve(columnLabelProp.initializer, consts, new Set())) : undefined,
      rows,
      columns,
      size: sizeProp ? stringLiteral(resolve(sizeProp.initializer, consts, new Set())) : undefined,
    };
  }
  return undefined;
}

/** A literal array of list-item object literals — `key`/`name` required; `props` (read as a flat
 *  literal map, non-literal values simply omitted) and `group` optional. Each item's `node` field
 *  (always present, always JSX) is never inspected — reading the sibling fields never depends on it. */
function readListItems(node: ts.Expression, consts: Map<string, ts.Expression>): StaticListItem[] | undefined {
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
    items.push({ key, name, group, props: propsProp ? readLiteralProps(propsProp.initializer, consts) : undefined });
  }
  return items;
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

/** A `variants`/`states` field: `{ itemsFill?, items: [...] }`, `items` read by `readListItems`.
 *  Distinguishes "field absent" (always checkable, everything undefined) from "field present but
 *  not literal" (not checkable). `itemsFill` is read only if present and literal — like
 *  `previewWidths`/`fullWidthLabel`, it isn't in design §4's literal-checkable list, so a
 *  non-literal `itemsFill` is simply left unset, never a reason to reject the whole slot. */
function readSlotItems(
  prop: ts.PropertyAssignment | undefined,
  consts: Map<string, ts.Expression>,
): { items?: StaticListItem[]; itemsFill?: boolean; checkable: boolean } {
  if (!prop) return { checkable: true };
  const resolved = resolve(prop.initializer, consts, new Set());
  const itemsProp = ts.isObjectLiteralExpression(resolved) ? findProp(resolved, 'items') : undefined;
  if (!itemsProp) return { checkable: false };
  const items = readListItems(itemsProp.initializer, consts);
  if (!items) return { checkable: false };
  const itemsFillProp = ts.isObjectLiteralExpression(resolved) ? findProp(resolved, 'itemsFill') : undefined;
  const itemsFill = itemsFillProp ? resolve(itemsFillProp.initializer, consts, new Set()).kind === ts.SyntaxKind.TrueKeyword : undefined;
  return { items, itemsFill, checkable: true };
}
