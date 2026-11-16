import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * WHY THIS IS A SOURCE SCAN AND NOT A TYPECHECK.
 *
 * `native/catalog` ships as TypeScript SOURCE, not as `.d.ts` — see the `files` list in
 * package.json. A consumer therefore compiles these files with ITS OWN compiler options, and
 * `skipLibCheck` does not cover them because they are not declaration files.
 *
 * Expo's `tsconfig.base` sets `lib: ["DOM", "ESNext"]`, with no `DOM.Iterable`. Under that lib a
 * `NodeList`, `HTMLCollection` or `DOMTokenList` has no `[Symbol.iterator]`, so iterating one
 * directly is `TS2488` in the consumer's build — in a file the consumer did not write and cannot
 * edit. Skiffr hit exactly this on 0.29.0 and 0.30.0: `npx tsc --noEmit` exited 2 on
 * `OverviewThumbnail.tsx`, and the only fix available to the app was to widen its own `lib`.
 *
 * No check in this repository typechecks `native/catalog` under a consumer-like lib. The generated
 * `.ds-viewer*` configs under `viewer-host` do include it with Expo's options, but no script or CI
 * step ever runs `tsc` on them, and `doctor`'s program-based check collects diagnostics only for
 * page files. On top of that this repo builds on TypeScript 6, where the old code typechecks
 * clean — the break appears only on the TypeScript 5.x that Expo ships. A type-level test here
 * would pass while consumers still broke, which is why the rule is a scan over the shipped text.
 *
 * `Array.from(...)` is the fix, and it is already the convention elsewhere in this directory
 * (`Anatomy.tsx`). It costs one array on a path that then measures every element it found, and it
 * works under every lib setting.
 *
 * WHAT THIS SCAN CANNOT SEE, said out loud so nobody trusts it further than it goes. It reads text,
 * not types: a DOM collection reached through a helper's return value, a property, or an aliased
 * import is invisible to it. The stronger guard is the shipped surface compiled with
 * `lib: ["DOM", "ESNext"]` on a pinned TypeScript 5.x, which catches every form; that needs a
 * second pinned compiler, so it is a separate change rather than a bigger regex here.
 */

const CATALOG_DIR = fileURLToPath(new URL('..', import.meta.url));

/** Every shipped source file: `__tests__` is excluded from the package, so it is excluded here. */
function shippedSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) shippedSources(full, out);
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Blank out comments and string bodies in ONE pass, so prose about `querySelectorAll` is not read
 * as code. One pass rather than a sequence of replaces: stripping either quote kind before the
 * other lets an apostrophe inside a double-quoted string swallow the real code after it on the
 * same line, which is a silent false negative.
 */
export function code(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (two === '//') {
      while (i < source.length && source[i] !== '\n') { out += ' '; i += 1; }
    } else if (two === '/*') {
      while (i < source.length && source.slice(i, i + 2) !== '*/') { out += source[i] === '\n' ? '\n' : ' '; i += 1; }
      out += '  '; i += 2;
    } else if (source[i] === "'" || source[i] === '"' || source[i] === '`') {
      const quote = source[i];
      out += quote; i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') { out += ' '; i += 1; }
        if (i < source.length) { out += source[i] === '\n' ? '\n' : ' '; i += 1; }
      }
      if (i < source.length) { out += quote; i += 1; }
    } else {
      out += source[i]; i += 1;
    }
  }
  return out;
}

/**
 * The accessors that yield something iterable only under `lib: DOM.Iterable`.
 *
 * `.children` is deliberately NOT here: `specimenSurfaceStyle.ts` walks a `LayoutBox` tree whose
 * `children` is a plain array, and `SpecimenSurface.tsx` spreads the same shape. Flagging those
 * would make this test cry wolf on correct code, and a regex cannot tell a `LayoutBox` from an
 * `Element`. The rule covers what it can prove from the text alone.
 */
const DOM_RE = new RegExp(
  String.raw`(?:querySelectorAll|getElementsByTagName|getElementsByClassName|getElementsByName)\s*\(` +
    String.raw`|\.(?:childNodes|classList|attributes)\b` +
    String.raw`|\bnew\s+(?:URLSearchParams|Headers|FormData)\b`,
);

/** True when the expression reaches a DOM collection that is not already wrapped in `Array.from`. */
function unwrapped(expression: string): boolean {
  if (!DOM_RE.test(expression)) return false;
  let rest = expression;
  for (;;) {
    const at = rest.indexOf('Array.from(');
    if (at === -1) break;
    let depth = 0;
    let end = at + 'Array.from'.length;
    for (; end < rest.length; end += 1) {
      if (rest[end] === '(') depth += 1;
      else if (rest[end] === ')') { depth -= 1; if (depth === 0) { end += 1; break; } }
    }
    rest = `${rest.slice(0, at)} ${rest.slice(end)}`;
  }
  return DOM_RE.test(rest);
}

/** The text between the `(` at `open` and its matching `)`, so a chained call in a head survives. */
function balanced(body: string, open: number): string {
  let depth = 0;
  for (let i = open; i < body.length; i += 1) {
    if (body[i] === '(') depth += 1;
    else if (body[i] === ')') { depth -= 1; if (depth === 0) return body.slice(open + 1, i); }
  }
  return body.slice(open + 1);
}

/** Every way shipped code could iterate a DOM collection and break a consumer's build. */
export function offendingLines(body: string): string[] {
  const found: string[] = [];
  const say = (what: string, text: string) => found.push(`${what}: ${text.replace(/\s+/g, ' ').trim().slice(0, 80)}`);

  // Names bound to a DOM collection, so a later `for…of name` is caught as well.
  const aliases = new Set<string>();
  for (const m of body.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
    if (unwrapped(m[2])) aliases.add(m[1]);
  }
  const iterates = (expression: string) =>
    unwrapped(expression) || aliases.has(expression.trim().replace(/[);\s]+$/, ''));

  // `for (const x of …)` and `for await (const x of …)`, multi-line heads and chained calls included.
  for (const m of body.matchAll(/\bfor\s*(?:await\s*)?\(/g)) {
    const head = balanced(body, m.index + m[0].length - 1);
    const of = head.search(/\bof\b/);
    if (of !== -1 && iterates(head.slice(of + 2))) say('for…of', `for (… of ${head.slice(of + 2)})`);
  }
  // Spread, array destructuring and `yield*` are all TS2488 under the same lib.
  for (const m of body.matchAll(/\.\.\.\s*([^,)\]\n]+)/g)) if (iterates(m[1])) say('spread', m[0]);
  for (const m of body.matchAll(/(?:const|let|var)\s*\[[^\]]*\]\s*=\s*([^;\n]+)/g)) if (iterates(m[1])) say('destructuring', m[0]);
  for (const m of body.matchAll(/yield\s*\*\s*([^;\n]+)/g)) if (iterates(m[1])) say('yield*', m[0]);
  return found;
}

test('shipped catalog source never iterates a DOM collection directly (needs lib: DOM.Iterable in the consumer)', () => {
  const offenders: string[] = [];
  for (const file of shippedSources(CATALOG_DIR)) {
    for (const hit of offendingLines(code(readFileSync(file, 'utf8')))) {
      offenders.push(`${file.slice(CATALOG_DIR.length)} — ${hit}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Wrap these in Array.from(...): a consumer on Expo's lib ["DOM", "ESNext"] fails with TS2488 in a file it cannot edit.\n${offenders.join('\n')}`,
  );
});

test('the scan reads the shipped files, and recognises every form that breaks a consumer', () => {
  const files = shippedSources(CATALOG_DIR);
  // A scan that silently found nothing would pass the test above for the wrong reason.
  assert.ok(files.length > 20, `expected the catalog's shipped sources, found ${files.length}`);
  assert.ok(files.some((f) => f.endsWith('OverviewThumbnail.tsx')), 'OverviewThumbnail.tsx should be in scope');

  const flags = (snippet: string) => offendingLines(code(snippet)).length;

  // The shape this file used to contain, and the fixed shape beside it.
  assert.equal(flags(`for (const el of surface.querySelectorAll('*')) { el.getBoundingClientRect(); }`), 1);
  assert.equal(flags(`for (const el of Array.from(surface.querySelectorAll('*'))) { el.x; }`), 0);

  // Forms an earlier draft of this test missed. Each one is TS2488 on TypeScript 5.x.
  assert.equal(flags(`const nodes = el.querySelectorAll('*');\nfor (const n of nodes) n.x;`), 1, 'via an intermediate variable');
  assert.equal(flags(`for (const el of root(0).querySelectorAll('*')) el.x;`), 1, 'chained call in the head');
  assert.equal(flags(`for await (const n of el.childNodes) n.x;`), 1, 'for await');
  assert.equal(flags(`const [first, second] = root.querySelectorAll('x');`), 1, 'array destructuring');
  assert.equal(flags(`function* g() { yield* el.childNodes; }`), 1, 'yield*');
  assert.equal(flags(`for (const p of new URLSearchParams(q)) p;`), 1, 'URLSearchParams and friends');
  assert.equal(flags(`const all = [...root.querySelectorAll('a')];`), 1, 'spread');
  assert.equal(flags(`const all = Array.from(root.querySelectorAll('a'));`), 0);

  // A plain array named `children` is not a DOM collection, and must not be flagged.
  assert.equal(flags(`for (const child of box.children) walk(child, false);`), 0);
  assert.equal(flags(`const kids = [...box.children];`), 0);

  // Prose and string literals are not code — including an apostrophe inside a double-quoted string
  // earlier on the SAME line, which an earlier draft let swallow the code after it.
  assert.equal(flags(`// for (const el of node.querySelectorAll('*')) {`), 0);
  assert.equal(flags(`const hint = 'for (const el of x.querySelectorAll("*"))';`), 0);
  assert.equal(flags(`const a = "it's fine"; for (const el of x.querySelectorAll('*')) {}`), 1, 'an apostrophe must not hide later code');
});
