import * as ts from 'typescript';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import type { ComponentRecord, PropRecord } from './types.ts';

export interface ReadComponentsOptions {
  /** Absolute `paths` entries (e.g. `{ react: ['/abs/path/to/@types/react'] }`), merged on top of
   *  whatever `paths`/`baseUrl` the project's own `tsconfig.json` already declares (see
   *  `readHostTsconfigOptions` below). No `baseUrl` field here: TypeScript 6 deprecates `baseUrl`
   *  (removed in 7), and every entry a caller passes is already absolute. */
  paths?: Record<string, string[]>;
  /** Lowest-priority `paths` fallback — applied only under the host tsconfig's own `paths` and
   *  under `paths` above. `sync` passes `<config.projectRoot>/node_modules/*` here so a component
   *  entry file outside the host's own directory tree (e.g. kit-host's sibling `../starter-kit/`)
   *  still resolves `react`/`react-native` against the *host's* node_modules, instead of whatever
   *  ambient tsconfig.json happens to be nearest that entry file on disk. */
  fallbackPaths?: Record<string, string[]>;
  /** Absolute folders whose type declarations count as "local" for coverage-target options (design
   *  §3 — "Options for coverage"). Omit to record no options at all (e.g. when a caller has no
   *  config to derive folders from). */
  optionRoots?: string[];
}

const COMPONENT_RETURN_HINT = /Element|ReactNode/;
const COMPONENT_TYPE_HINT = /MemoExoticComponent|ForwardRefExoticComponent|NamedExoticComponent|ComponentType|FC</;

/** Finds the nearest `tsconfig.json` above `entryFile` — the project's own config, not this
 *  package's — and reads only its `paths`/`baseUrl`/`jsx`. Without this, an app using `paths`
 *  aliases (e.g. `@/components/...`) would resolve those imports to `any` and the component would
 *  silently vanish from the catalog. Also returns the internal `pathsBasePath`, so `paths` without
 *  `baseUrl` resolve from the tsconfig's folder rather than `process.cwd()`. Note: the shared
 *  fixtures have no tsconfig of their own, so lookup reaches this repository's root
 *  `tsconfig.json` (Task 1); it declares no `paths`, `baseUrl`, or `jsx`, so `options.paths`
 *  alone decides resolution in tests. */
function readHostTsconfigOptions(
  entryFile: string,
): Pick<ts.CompilerOptions, 'baseUrl' | 'paths' | 'jsx'> & { pathsBasePath?: string } {
  const tsconfigPath = ts.findConfigFile(path.dirname(entryFile), ts.sys.fileExists);
  if (!tsconfigPath) return {};
  const { config } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(tsconfigPath));
  const { baseUrl, paths, jsx } = parsed.options;
  const pathsBasePath = (parsed.options as { pathsBasePath?: string }).pathsBasePath;
  return { baseUrl, paths, jsx, pathsBasePath };
}

/** What is a component (design §3): an export whose type has a call signature returning
 *  JSX/ReactNode, or is typed as a Memo/ForwardRef/NamedExotic/ComponentType wrapper.
 *
 *  Builds its own single-entry `ts.Program` — convenient for callers (including every existing
 *  test) that only ever read one file, but costly when read in a loop: `sync` instead uses
 *  `createComponentReader` below to share one program across every component entry file. */
export function readComponents(entryFile: string, options: ReadComponentsOptions = {}): ComponentRecord[] {
  return createComponentReader([entryFile], options)(entryFile);
}

/**
 * Builds one `ts.Program` covering every entry file in `entryFiles` — re-parsing the shared
 * `react`/`react-native` declaration files once instead of once per component (Important: `sync`
 * over the 37-component starter kit took 9.9s with one program per entry; design §3 targets under
 * 2s) — and returns a function that reads a single entry's components from that shared program.
 * Each call still isolates its own entry: an entry whose dependency closure reaches an unreadable
 * file throws just for that entry (the per-entry try/catch in `sync` is unaffected), the same
 * contract `readComponents` has always had.
 */
export function createComponentReader(entryFiles: string[], options: ReadComponentsOptions = {}): (entryFile: string) => ComponentRecord[] {
  const host = readHostTsconfigOptions(entryFiles[0] ?? process.cwd());
  const compilerOptions: ts.CompilerOptions = {
    jsx: host.jsx ?? ts.JsxEmit.ReactJSX,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    allowJs: false,
    noEmit: true,
    baseUrl: host.baseUrl,
    paths: { ...options.fallbackPaths, ...host.paths, ...options.paths },
    // `pathsBasePath` is @internal: it tells the compiler which folder `paths` are relative to when
    // the host tsconfig has `paths` but no `baseUrl` (the TypeScript 6 idiom).
    ...(host.pathsBasePath ? ({ pathsBasePath: host.pathsBasePath } as ts.CompilerOptions) : {}),
  };
  // The TypeScript API never throws on an unreadable file (ts.sys.readFile swallows EACCES), so
  // record files that exist but cannot be read; a per-entry reachability check below (`entryFile`
  // may be any of `entryFiles`, sharing this one program) decides whether a given entry is affected.
  const unreadable: string[] = [];
  const compilerHost = ts.createCompilerHost(compilerOptions);
  const baseReadFile = compilerHost.readFile.bind(compilerHost);
  compilerHost.readFile = (fileName: string) => {
    try {
      return readFileSync(fileName, 'utf8');
    } catch {
      if (existsSync(fileName)) unreadable.push(fileName);
      return baseReadFile(fileName);
    }
  };
  const program = ts.createProgram(entryFiles, compilerOptions, compilerHost);
  const checker = program.getTypeChecker();

  return (entryFile: string): ComponentRecord[] => {
    if (unreadable.length > 0) {
      const reachable = unreadableFilesReachableFrom(program, entryFile, unreadable, compilerOptions, compilerHost);
      if (reachable.length > 0) throw new Error(`Cannot read ${reachable[0]}`);
    }
    const sourceFile = program.getSourceFile(entryFile);
    if (!sourceFile) return [];
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) return [];

    const records: ComponentRecord[] = [];
    for (const exportSymbol of checker.getExportsOfModule(moduleSymbol)) {
      const resolved = exportSymbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exportSymbol) : exportSymbol;
      const declaration = resolved.valueDeclaration;
      if (!declaration) continue;
      const type = checker.getTypeOfSymbolAtLocation(resolved, declaration);
      if (!isComponentType(checker, type)) continue;
      records.push(readComponentRecord(checker, exportSymbol.getName(), type, declaration, options.optionRoots ?? []));
    }
    return records.sort((a, b) => a.name.localeCompare(b.name));
  };
}

/** Which of `unreadable`'s files (if any) `entryFile` actually depends on — a BFS over module
 *  specifiers starting at `entryFile`, using the same resolution the shared program used. Needed
 *  because `unreadable` is collected once for the whole shared program (`createComponentReader`
 *  above): without this, one broken file anywhere would fail every entry instead of just the
 *  entry(ies) that import it. */
function unreadableFilesReachableFrom(
  program: ts.Program,
  entryFile: string,
  unreadable: string[],
  compilerOptions: ts.CompilerOptions,
  host: ts.ModuleResolutionHost,
): string[] {
  const unreadableSet = new Set(unreadable);
  const visited = new Set<string>();
  const hits: string[] = [];
  const queue = [entryFile];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    if (unreadableSet.has(file)) {
      hits.push(file);
      continue; // An unreadable file has no source text to find further imports in.
    }
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;
    for (const specifier of moduleSpecifiersOf(sourceFile)) {
      const resolved = ts.resolveModuleName(specifier, file, compilerOptions, host).resolvedModule;
      if (resolved) queue.push(resolved.resolvedFileName);
    }
  }
  return hits;
}

/** Every `import`/`export … from` module specifier in a source file — `SourceFile.imports` would
 *  give this directly, but it's internal-only (absent from the public .d.ts). A plain AST walk
 *  only runs here, on the rare path where some file turned out unreadable. */
function moduleSpecifiersOf(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return specifiers;
}

function isComponentType(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (type.getCallSignatures().some((sig) => COMPONENT_RETURN_HINT.test(checker.typeToString(sig.getReturnType())))) return true;
  return COMPONENT_TYPE_HINT.test(checker.typeToString(type));
}

function readComponentRecord(
  checker: ts.TypeChecker,
  name: string,
  type: ts.Type,
  declaration: ts.Declaration,
  optionRoots: string[],
): ComponentRecord {
  const sourceFile = declaration.getSourceFile();
  const signature = type.getCallSignatures()[0];
  const propsType =
    signature && signature.parameters.length > 0 ? checker.getTypeOfSymbolAtLocation(signature.parameters[0], declaration) : undefined;
  const implementationDefaults = defaultsFromImplementation(declaration);

  const props: PropRecord[] = [];
  if (propsType) {
    const branches = propsType.isUnion() ? propsType.types : [propsType];
    for (const merged of mergeUnionProps(checker, branches)) {
      const { symbol: prop, declaration: propDeclaration, branchCount } = merged;
      const propFile = propDeclaration?.getSourceFile().fileName ?? '';
      // A prop declared in `node_modules` (e.g. `value` from react-native's `TextInputProps`) is
      // never listed individually — `inheritedFrom` below (design §3) summarises the whole
      // extended type as one row instead.
      if (propFile.includes('node_modules')) continue;
      const propType = propDeclaration ? checker.getTypeOfSymbolAtLocation(prop, propDeclaration) : checker.getAnyType();
      const jsDocDefault = prop.getJsDocTags().find((tag) => tag.name === 'default');
      const baseDesc = joinWrappedLines(ts.displayPartsToString(prop.getDocumentationComment(checker)));
      const isPartial = branchCount < branches.length;
      props.push({
        name: prop.getName(),
        type: displayTypeString(checker, prop, propType),
        // A prop present in only some branches is never required overall — the caller can always
        // pick a branch that omits it — regardless of whether it's required within the branch(es)
        // it does appear in (that's `merged.requiredInEvery`, checked only when `!isPartial`).
        required: !isPartial && merged.requiredInEvery,
        default: implementationDefaults.get(prop.getName()) ?? (jsDocDefault ? ts.displayPartsToString(jsDocDefault.text) : undefined),
        desc: isPartial ? `${baseDesc} Only with some variants of this prop's type.`.trim() : baseDesc,
        options: readOptions(checker, propType, propFile, optionRoots),
      });
    }
  }
  const inheritedFrom = propsType ? nodeModulesHeritageNames(checker, propsType.isUnion() ? propsType.types : [propsType]) : [];
  return { name, file: path.relative(process.cwd(), sourceFile.fileName), props, inheritedFrom };
}

/** Design §3 — "Type column: keeps alias names, not expanded unions." An optional prop's type
 *  (as read via its symbol) includes `undefined` — printed as `"T | undefined"` when `T` has no
 *  alias of its own (e.g. `label?: string`), but when `T` is itself an alias whose own definition
 *  already includes `undefined` (react-native's `StyleProp<T>`, React's `ReactNode`), the type as
 *  declared is simply `T` with no added union member, and `checker.typeToString` already prints
 *  just the alias name (e.g. `"StyleProp<ViewStyle>"`) — no `| undefined` to strip. Dropping a
 *  trailing/leading `undefined` segment as *text*, rather than calling `checker.getNonNullableType`
 *  on the type and re-printing that, is what keeps the alias in both cases: `getNonNullableType`
 *  rebuilds a fresh, unaliased union once it has to remove a member nested inside an alias's own
 *  definition (`StyleProp`/`ReactNode`), even though the printed string never needed that member
 *  removed in the first place. */
function displayTypeString(checker: ts.TypeChecker, prop: ts.Symbol, propType: ts.Type): string {
  const printed = checker.typeToString(propType, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
  if (!(prop.flags & ts.SymbolFlags.Optional)) return printed;
  const kept = splitTopLevelUnion(printed).filter((part) => part !== 'undefined' && part !== 'null');
  if (kept.length === 0) return printed;
  // A single remaining part that is itself wrapped in one outer pair of parentheses (e.g. the
  // `(() => void)` TypeScript prints around an arrow type that was a union member) no longer needs
  // those parentheses once it is the only part left — `(t: string) => void`, not `((t: string) =>
  // void)`.
  if (kept.length === 1) return unwrapOuterParens(kept[0]);
  return kept.join(' | ');
}

/** Splits a printed type's top-level ` | ` union members — skipping any `|` nested inside
 *  `<...>`, `(...)`, `{...}`, or `[...]` (e.g. the one inside `RecursiveArray<Falsy | ViewStyle>`)
 *  — so `displayTypeString` can drop a top-level `undefined`/`null` member without disturbing a
 *  union that appears only as part of a deeper type argument. An arrow type's `=>` prints a `>`
 *  that is not a closing bracket, so it must not decrement `depth`: skip it whenever the previous
 *  character was `=` (otherwise `(() => void) | undefined` goes to depth -1 at the arrow and the
 *  top-level ` | ` before `undefined` is read as nested, never splitting it off). */
function splitTopLevelUnion(typeString: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < typeString.length; i++) {
    const ch = typeString[i];
    if (ch === '<' || ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === '>' || ch === ')' || ch === '}' || ch === ']') {
      if (ch === '>' && typeString[i - 1] === '=') continue;
      depth -= 1;
    } else if (depth === 0 && typeString.startsWith(' | ', i)) {
      parts.push(typeString.slice(start, i));
      start = i + 3;
    }
  }
  parts.push(typeString.slice(start));
  return parts;
}

/** Strips one outer `(...)` pair from `part` when it wraps the whole string — not just any
 *  leading `(`, e.g. `(a) => (b)` has balanced outer parens only around `a`, not around the whole
 *  expression, so this walks depth to confirm the first `(` closes at the very last character. */
function unwrapOuterParens(part: string): string {
  if (part[0] !== '(' || part[part.length - 1] !== ')') return part;
  let depth = 0;
  for (let i = 0; i < part.length; i++) {
    const ch = part[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i === part.length - 1 ? part.slice(1, -1) : part;
    }
  }
  return part;
}

/** Design §3 — "Inherited props declared in `node_modules` ... are summarised as one row: 'plus
 *  all TextInput props'." Reads each branch's own `extends` heritage clause(s) — not the flattened
 *  property list `mergeUnionProps` builds for the table above — because a `node_modules` interface
 *  like react-native's `TextInputProps` itself extends several more `node_modules` interfaces
 *  (`ViewProps`, `TouchableWithoutFeedbackProps`, ...), each declared in its own file; grouping by
 *  every inherited *property*'s own declaration file (the previous approach) reported one noisy
 *  entry per ancestor file instead of the one name the component's own Props type actually names.
 *  A `forwardRef` component's props type is `OwnProps & RefAttributes<T>` (an intersection, not an
 *  interface) — `heritageInterfaceDeclarations` unwraps that to reach `OwnProps`'s own declaration. */
function nodeModulesHeritageNames(checker: ts.TypeChecker, branches: readonly ts.Type[]): string[] {
  const names = new Set<string>();
  for (const branch of branches) {
    for (const declaration of heritageInterfaceDeclarations(branch)) {
      const declarationFile = declaration.getSourceFile().fileName;
      if (declarationFile.includes('node_modules')) {
        // `declaration` was pulled in directly by the branch itself (e.g. `type Props =
        // TextInputProps & {...}`), not named in a *local* interface's own `extends` clause —
        // report its own name. Walking its `heritageClauses` below (as the `extends
        // TextInputProps` case does) would instead report TextInputProps's own ancestors, e.g.
        // "View"/"TouchableWithoutFeedback".
        if (!isReactOnlyFile(declarationFile)) names.add(declaration.name.getText().replace(/Props$/, ''));
        continue;
      }
      for (const clause of declaration.heritageClauses ?? []) {
        for (const typeNode of clause.types) {
          // `getTypeAtLocation` on the whole `ExpressionWithTypeArguments` node (not just its
          // `.expression`) is required for `resolveUtilityTypeSource` below to see `Omit`/`Pick`'s
          // actual instantiated type arguments — on `.expression` alone they come back as the
          // utility type's own unbound generic parameters ("T", "K"), not `TextInputProps`.
          const heritageType = resolveUtilityTypeSource(checker.getTypeAtLocation(typeNode));
          const heritageDeclaration = (heritageType.aliasSymbol ?? heritageType.symbol)?.declarations?.[0];
          if (!heritageDeclaration) continue;
          const file = heritageDeclaration.getSourceFile().fileName;
          if (!file.includes('node_modules')) continue;
          // `@types/react` itself (e.g. `Attributes`, reached through a `forwardRef` component's
          // own `RefAttributes<T>`) is not a meaningful "inherited from" fact — every component
          // already uses React. A host-type package's own heritage (e.g. react-native's `View`,
          // reached through `TextInputProps`) is still reported as before.
          if (isReactOnlyFile(file)) continue;
          const rawName = (heritageType.aliasSymbol ?? heritageType.symbol)?.getName() ?? typeNode.expression.getText();
          names.add(rawName.replace(/Props$/, ''));
        }
      }
    }
  }
  return [...names];
}

/** True for a declaration file under `@types/react` that is not also under `@types/react-native`
 *  (react-native's own `@types` package path contains `react` as a substring). */
function isReactOnlyFile(file: string): boolean {
  return /[/\\]@types[/\\]react[/\\]/.test(file) && !/[/\\]@types[/\\]react-native[/\\]/.test(file);
}

/** `Omit<T, K>`/`Pick<T, K>` of a node_modules type prints its own alias symbol ("Omit"/"Pick")
 *  rather than `T`'s name — resolve to `T` (the type's first alias type argument) instead, so
 *  `extends Omit<TextInputProps, 'value'>` reports "TextInput", not "Omit" (Fable's review,
 *  cli/props.ts:270-301). */
function resolveUtilityTypeSource(type: ts.Type): ts.Type {
  const aliasName = type.aliasSymbol?.getName();
  if ((aliasName === 'Omit' || aliasName === 'Pick') && type.aliasTypeArguments?.[0]) {
    return type.aliasTypeArguments[0];
  }
  return type;
}

/** Every `InterfaceDeclaration` backing `type` — itself if `type` is one, or (recursing) each
 *  constituent of an intersection, so a `forwardRef` component's `OwnProps & RefAttributes<T>`
 *  still reaches `OwnProps`'s own heritage clause. */
function heritageInterfaceDeclarations(type: ts.Type): ts.InterfaceDeclaration[] {
  if (type.isIntersection()) return type.types.flatMap(heritageInterfaceDeclarations);
  return (type.symbol?.declarations ?? []).filter(ts.isInterfaceDeclaration);
}

/** Design §3, finding 4: a JSDoc paragraph hard-wrapped in source (`getDocumentationComment`
 *  preserves each line break verbatim) must read as running text — join lines within a paragraph
 *  with a single space, but keep a blank-line paragraph break as its own line break. */
function joinWrappedLines(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .join('\n\n');
}

interface MergedProp {
  symbol: ts.Symbol;
  declaration?: ts.Declaration;
  /** How many of the union's branches declare this prop — used to mark it "only with …" when it is
   *  fewer than every branch, and to require it only when every branch does. */
  branchCount: number;
  requiredInEvery: boolean;
}

/**
 * Design §3 — "Unions of object types (e.g. `CardProps` as two intersections) are merged into one
 * table; a prop present in only some members is marked 'only with …'." `getPropertiesOfType` on a
 * union type alone returns only the members every branch shares, silently dropping a prop unique to
 * one branch — so each branch is read with its own `getPropertiesOfType` call and merged by name
 * here instead. A non-union `propsType` is treated as a single-branch "union", so this is also the
 * only code path for ordinary props — no behavior changes there (`branchCount` is always 1 of 1).
 */
function mergeUnionProps(checker: ts.TypeChecker, branches: readonly ts.Type[]): MergedProp[] {
  const order: string[] = [];
  const byName = new Map<string, MergedProp>();
  for (const branch of branches) {
    for (const prop of checker.getPropertiesOfType(branch)) {
      const propName = prop.getName();
      const requiredHere = !(prop.flags & ts.SymbolFlags.Optional);
      const existing = byName.get(propName);
      if (existing) {
        existing.branchCount += 1;
        existing.requiredInEvery = existing.requiredInEvery && requiredHere;
      } else {
        order.push(propName);
        byName.set(propName, {
          symbol: prop,
          declaration: prop.valueDeclaration ?? (prop.declarations ?? [])[0],
          branchCount: 1,
          requiredInEvery: requiredHere,
        });
      }
    }
  }
  return order.map((propName) => byName.get(propName)!);
}

/**
 * Coverage-target options (design §3 — "Options for coverage"): recorded only when the prop's
 * non-nullable type (optional props include `undefined`, hence `getNonNullableType`) is a union of
 * 2 or more string literals, AND that union is declared inside one of `optionRoots` — checked
 * against the union's alias symbol's declaration file (a named type like `Variant`), or the prop's
 * own declaration file for an inline union with no alias. A single string literal is never
 * options; an out-of-root union (e.g. a 44-member `IconName` from `icons/`) is skipped.
 */
function readOptions(checker: ts.TypeChecker, propType: ts.Type, propDeclarationFile: string, optionRoots: string[]): string[] | undefined {
  if (optionRoots.length === 0) return undefined;
  const nonNullable = checker.getNonNullableType(propType);
  if (!nonNullable.isUnion() || nonNullable.types.length < 2 || !nonNullable.types.every((t) => t.isStringLiteral())) {
    return undefined;
  }
  const aliasDeclaration = nonNullable.aliasSymbol?.declarations?.[0];
  const declarationFile = aliasDeclaration ? aliasDeclaration.getSourceFile().fileName : propDeclarationFile;
  const isLocal = optionRoots.some((root) => declarationFile === root || declarationFile.startsWith(`${root}${path.sep}`));
  if (!isLocal) return undefined;
  return nonNullable.types.map((t) => (t as ts.StringLiteralType).value);
}

/** Finds the real implementation function behind a `React.memo(Impl)` / `forwardRef(function
 *  Name(...) {})` wrapper and reads each destructured parameter's default initializer as source
 *  text (design §3: "shown as source text"). Resolving the *value* of a non-literal default
 *  — e.g. a token reference — is deferred past 0.1; see the plan's covering note. */
function defaultsFromImplementation(declaration: ts.Declaration): Map<string, string> {
  const defaults = new Map<string, string>();
  const startNode = ts.isVariableDeclaration(declaration) && declaration.initializer ? declaration.initializer : declaration;
  const fn = resolveFunctionLike(startNode, new Set());
  const firstParam = fn?.parameters[0];
  if (!firstParam || !ts.isObjectBindingPattern(firstParam.name)) return defaults;
  for (const element of firstParam.name.elements) {
    if (!ts.isBindingElement(element) || !element.initializer) continue;
    const key = ts.isIdentifier(element.propertyName ?? element.name) ? (element.propertyName ?? element.name).getText() : undefined;
    if (key) defaults.set(key, element.initializer.getText());
  }
  return defaults;
}

function resolveFunctionLike(node: ts.Node, seen: Set<ts.Node>): ts.FunctionLikeDeclaration | undefined {
  if (seen.has(node)) return undefined;
  seen.add(node);
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return node;
  if (ts.isCallExpression(node)) {
    for (const arg of node.arguments) {
      const found = resolveFunctionLike(arg, seen);
      if (found) return found;
    }
    return undefined;
  }
  if (ts.isIdentifier(node)) {
    const target = findDeclarationInFile(node);
    return target ? resolveFunctionLike(target, seen) : undefined;
  }
  return undefined;
}

/** Resolves a bare identifier (e.g. `ButtonImpl` in `React.memo(ButtonImpl)`) to its declaration
 *  within the same source file by name — avoids needing a second `TypeChecker` pass just for this. */
function findDeclarationInFile(identifier: ts.Identifier): ts.Node | undefined {
  const sourceFile = identifier.getSourceFile();
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === identifier.text) {
      found = node;
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === identifier.text &&
      node.initializer
    ) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}
