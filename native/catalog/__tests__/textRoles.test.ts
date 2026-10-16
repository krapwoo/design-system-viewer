import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Typography properties that must come from a `CATALOG_TEXT` role instead of being set directly. */
const FORBIDDEN_PROPS = new Set(['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontStyle', 'fontFamily']);

export interface TypographyViolation {
  file: string;
  line: number;
  property: string;
}

/** Walks a source file's AST and reports every object-literal property assignment that sets a
 *  forbidden typography property directly, rather than regex-matching so multi-line style
 *  objects are caught reliably. */
export function scanSourceForTypographyViolations(fileName: string, sourceText: string): TypographyViolation[] {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const violations: TypographyViolation[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      FORBIDDEN_PROPS.has(node.name.text)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push({ file: fileName, line: line + 1, property: node.name.text });
    } else if (ts.isShorthandPropertyAssignment(node) && FORBIDDEN_PROPS.has(node.name.text)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push({ file: fileName, line: line + 1, property: node.name.text });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return violations;
}

/** Every `.ts`/`.tsx` file under `dir`, excluding `__tests__` and `tokens.ts` (the one file
 *  allowed to define the typography roles themselves). */
function listScannableFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listScannableFiles(full));
      continue;
    }
    if (entry.name === 'tokens.ts') continue;
    if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith('.d.ts')) continue;
    result.push(full);
  }
  return result;
}

function scanCatalogDirectory(rootDir: string): TypographyViolation[] {
  const violations: TypographyViolation[] = [];
  for (const file of listScannableFiles(rootDir)) {
    violations.push(...scanSourceForTypographyViolations(path.relative(rootDir, file), fs.readFileSync(file, 'utf8')));
  }
  return violations;
}

test('the scanner reports every raw typography property in a planted fixture', () => {
  const fixture = `
    const styles = {
      label: {
        fontSize: 13,
        fontWeight: '800',
        color: '#000',
      },
      caption: { letterSpacing: 0.4, lineHeight: 18 },
      italic: { 'fontStyle': 'italic' },
    };
    const fontFamily = 'Menlo, monospace';
    const mono = { fontFamily };
  `;
  const violations = scanSourceForTypographyViolations('fixture.ts', fixture);
  assert.equal(violations.length, 6, JSON.stringify(violations));
  assert.ok(violations.some((v) => v.property === 'fontSize'));
  assert.ok(violations.some((v) => v.property === 'fontWeight'));
  assert.ok(violations.some((v) => v.property === 'letterSpacing'));
  assert.ok(violations.some((v) => v.property === 'lineHeight'));
  assert.ok(violations.some((v) => v.property === 'fontStyle'));
  assert.ok(violations.some((v) => v.property === 'fontFamily'));
});

test('no file under native/catalog sets fontSize, fontWeight, lineHeight or letterSpacing directly', () => {
  const root = path.join(import.meta.dirname, '..');
  const violations = scanCatalogDirectory(root);
  const report = violations.map((v) => `${v.file}:${v.line} sets \`${v.property}\` directly — use a CATALOG_TEXT role instead`).join('\n');
  assert.equal(violations.length, 0, `${violations.length} violation(s):\n${report}`);
});
