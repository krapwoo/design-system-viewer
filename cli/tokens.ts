import * as ts from 'typescript';
import path from 'node:path';

export type TokenValue = string | number | boolean | { [key: string]: TokenValue } | 'computed — see source';

export interface TokenModuleRecord {
  file: string;
  exports: Record<string, TokenValue>;
}

/** Reads every exported `const` in each file as literal data. Nested object literals stay nested
 *  (design §3: "keeps shadow, typography, and motion entries as objects instead of flattening
 *  them"); anything that isn't a literal — a function call, an identifier reference, `Date.now()`
 *  — is reported as `'computed — see source'` rather than guessed at. */
export function readTokenModules(entryFiles: string[]): TokenModuleRecord[] {
  const program = ts.createProgram(entryFiles, {
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    allowJs: false,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const records: TokenModuleRecord[] = [];
  for (const entryFile of entryFiles) {
    const sourceFile = program.getSourceFile(entryFile);
    if (!sourceFile) continue;
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) continue;
    // Every top-level `const` in the file, exported or not — a same-file reference (`export const
    // a = palette.blue`) can point at an internal, unexported helper object like `palette`.
    const topLevelConsts = new Map<string, ts.Expression>();
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) topLevelConsts.set(declaration.name.text, declaration.initializer);
      }
    }
    const exportsRecord: Record<string, TokenValue> = {};
    for (const exportSymbol of checker.getExportsOfModule(moduleSymbol)) {
      const resolved = exportSymbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exportSymbol) : exportSymbol;
      const declaration = resolved.valueDeclaration;
      if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer) continue;
      exportsRecord[exportSymbol.getName()] = readExpression(declaration.initializer, topLevelConsts, new Set());
    }
    records.push({ file: path.relative(process.cwd(), entryFile), exports: exportsRecord });
  }
  return records;
}

function readExpression(node: ts.Expression, consts: Map<string, ts.Expression>, seen: Set<string>): TokenValue {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) {
    return readExpression(node.expression, consts, seen);
  }
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, TokenValue> = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = property.name.getText().replace(/^['"]|['"]$/g, '');
      result[name] = readExpression(property.initializer, consts, seen);
    }
    return result;
  }
  // A same-file reference to another top-level const (design §3: "references to other tokens are
  // resolved statically") — e.g. `palette` in `export const a = palette.blue`. `seen` guards
  // against a reference cycle (e.g. `const a = a`).
  if (ts.isIdentifier(node)) {
    if (seen.has(node.text)) return 'computed — see source';
    const target = consts.get(node.text);
    return target ? readExpression(target, consts, new Set(seen).add(node.text)) : 'computed — see source';
  }
  if (ts.isPropertyAccessExpression(node)) {
    const base = readExpression(node.expression, consts, seen);
    if (typeof base === 'object' && base !== null && node.name.text in base) return base[node.name.text];
    return 'computed — see source';
  }
  return 'computed — see source';
}
