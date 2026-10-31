// cli/render.ts — `doctor --render`: open every catalog page in a headless browser and report what
// only a real render shows (console errors, pages that fail to render, the viewer's own [Catalog]
// layout warnings). The browser is resolved from the project; ds-viewer never installs one.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { get as httpGet } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RENDER_WORKSPACE_DIR } from './types.ts';
import type { DoctorIssue } from './doctor.ts';

export interface PageMessage {
  type: string;
  text: string;
}

const OVERFLOW = /is \d+px wide in a \d+px cell/;

/**
 * Turns one page's console output into doctor findings. Console errors and a missing heading are
 * errors. The viewer's own `[Catalog]` warnings are warnings: `render-layout` for an example that
 * overflows its cell, `render-catalog-warning` for anything else. Other console noise (React Native
 * web deprecations, logs) is ignored. `seen` is shared across the whole run, so a warning the
 * catalog logs on every page (a duplicate id, an unknown `composedOf` name) is reported once.
 */
export function issuesFromPage(
  page: { id: string; file?: string },
  messages: readonly PageMessage[],
  hasHeading: boolean,
  seen: Set<string> = new Set(),
): DoctorIssue[] {
  const ref = { page: page.id, ...(page.file ? { file: page.file } : {}) };
  const issues: DoctorIssue[] = [];
  if (!hasHeading) {
    issues.push({ id: 'render-no-heading', severity: 'error', ...ref, message: 'The page rendered without its heading, so it probably failed to render.', fix: 'Open the page in `ds-viewer dev` and check the browser console.' });
  }
  const pageErrors = new Set<string>();
  for (const m of messages) {
    const first = m.text.split('\n')[0];
    if (m.type === 'error' || m.type === 'pageerror') {
      if (pageErrors.has(first)) continue;
      pageErrors.add(first);
      issues.push({ id: 'render-error', severity: 'error', ...ref, message: `Console error while rendering: ${first}`, fix: 'Open the page in `ds-viewer dev` and fix the error in the browser console.' });
    } else if ((m.type === 'warn' || m.type === 'warning') && first.startsWith('[Catalog] ')) {
      const text = first.slice('[Catalog] '.length);
      if (seen.has(text)) continue;
      seen.add(text);
      issues.push(
        OVERFLOW.test(text)
          ? { id: 'render-layout', severity: 'warning', ...ref, message: text, fix: 'Give the page a wider specimenSize; see the README page guide.' }
          : { id: 'render-catalog-warning', severity: 'warning', ...ref, message: text, fix: 'Follow the message; the static doctor rule of the same name has the details.' },
      );
    }
  }
  return issues;
}

export interface IdenticalPair {
  /** The card the two examples share, from its accessible name. */
  card: string;
  names: [string, string];
}

/**
 * Runs in the browser: finds any two examples in the same list card whose specimens render
 * identically. A variant's name is a claim that something differs; two cells that render the same
 * teach the reader nothing and usually mean the difference needs a wider cell (a column count in a
 * cell too narrow to show it) or was never wired up.
 *
 * The fingerprint covers each specimen's whole subtree — tag, box size, colours, radius and text —
 * but never the caption strip that carries the variant's own name, which always differs. Colour is
 * part of it, so a "default vs disabled" pair that differs only in tone is not reported.
 */
export const IDENTICAL_VARIANTS_SCRIPT = `(() => {
  const doc = document;
  const fingerprint = (root) => {
    const out = [];
    const base = root.getBoundingClientRect();
    const walk = (el) => {
      // PhoneFrame renders its example into a same-origin child document, so without reaching in
      // every phone looks like an identical empty box.
      if (el.tagName === 'IFRAME') {
        try {
          const body = el.contentDocument && el.contentDocument.body;
          if (body) { out.push('IFRAME'); walk(body); return; }
        } catch (error) { out.push('IFRAME|unreadable'); return; }
      }
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      out.push([
        el.tagName,
        Math.round(box.width), Math.round(box.height),
        Math.round(box.left - base.left), Math.round(box.top - base.top),
        style.color, style.backgroundColor, style.borderColor, style.borderRadius,
        style.fontSize, style.fontWeight, style.opacity, style.visibility,
        // An icon page's variants are same-sized SVGs that differ only in geometry; a card page's
        // in shadow; a text page's in style, decoration or alignment.
        style.fill, style.stroke, style.boxShadow, style.fontStyle, style.textDecorationLine, style.textAlign,
        el.getAttribute && (el.getAttribute('d') || el.getAttribute('points') || ''),
        el.currentSrc || (el.getAttribute && el.getAttribute('src')) || '',
        el.children.length === 0 ? (el.textContent || '') : '',
        // A field's visible text is its value, not its textContent, which is always empty.
        el.value === undefined ? '' : String(el.value),
        el.placeholder || '', el.disabled ? 'disabled' : '',
      ].join('|'));
      for (const child of el.children) walk(child);
    };
    walk(root);
    return out.join('\\n');
  };
  const pairs = [];
  for (const card of doc.querySelectorAll('[role=list][aria-label]')) {
    // ComparisonList and ComparisonGroups label their card "<page id>: <block title>". Anything
    // else with role=list is a consumer's own component inside a specimen, not a card of examples.
    if (!/^[^:]+: .+/.test(card.getAttribute('aria-label') || '')) continue;
    const cells = [...card.querySelectorAll('[role=listitem]')].filter((c) => c.closest('[role=list]') === card);
    const byPrint = new Map();
    for (const cell of cells) {
      // children[0] is the caption strip (the variant's own name); the specimen follows it.
      const specimen = cell.children.length > 1 ? cell.children[1] : cell.children[0];
      if (!specimen) continue;
      const name = (cell.children[0] ? cell.children[0].textContent : '') || '';
      const print = fingerprint(specimen);
      if (!print.trim()) continue;
      const first = byPrint.get(print);
      if (first === undefined) byPrint.set(print, name);
      else pairs.push({ card: card.getAttribute('aria-label') || '', names: [first, name] });
    }
  }
  return pairs;
})()`;

/** Turns the browser's findings into doctor issues, one per identical pair. */
export function identicalVariantIssues(page: { id: string; file?: string }, pairs: readonly IdenticalPair[]): DoctorIssue[] {
  const ref = { page: page.id, ...(page.file ? { file: page.file } : {}) };
  return pairs.map((pair) => ({
    id: 'identical-variants',
    severity: 'warning' as const,
    ...ref,
    message: `"${pair.names[0]}" and "${pair.names[1]}" render identically in ${pair.card || 'the same card'}.`,
    fix: "Make the difference visible — a wider specimenSize when the cell is too narrow to show it, or the prop the name claims — or drop one of the two examples.",
  }));
}

/**
 * The width the heading check measures at. 800x600 is Puppeteer's own default viewport, which is
 * what a consumer's smoke check uses unless it says otherwise, so it is the width their catalog is
 * judged at. Every other check here runs at 1280x800, where this class of overlap does not appear
 * at all — which is exactly why issue #51 reached a release.
 */
export const NARROW_VIEWPORT = { width: 800, height: 600 } as const;

export interface HeadOverlap {
  /** The text painted over the heading, so the message names what the reader sees on top of it. */
  other: string;
  /** How much of the heading the other text covers, in px. Both are over 1px by construction. */
  w: number;
  h: number;
}

/**
 * Runs in the browser: finds anything painting on top of the page's own heading.
 *
 * The page head puts the title in a `flex: 1` column beside a non-shrinking pager row. A title
 * that is one unbroken identifier — a Swift type name, say — has no space for the browser's
 * default line breaking to use, so without an explicit break opportunity it keeps its full
 * intrinsic width and paints straight through the column into the pager (issue #51:
 * `TranscriptMediaUnavailableChip` covered the `←` button by 14x22 at an 800px window). The
 * reader sees the title and the control drawn over each other, and the title is the page's own
 * heading, so it is the one thing on the page that must stay readable.
 *
 * Measured the way a consumer's own smoke check measures it: every leaf element that carries
 * text, its rect clipped to each ancestor that handles its own overflow (so a scrolled-away rect
 * is not reported as covering anything), and a pair counted only when it overlaps by more than
 * 1px in BOTH directions — a shared edge or a single-pixel seam between neighbours is not an
 * overlap.
 *
 * Only the heading is checked, not every pair on the page. Host specimens legitimately stack text
 * — a badge over a thumbnail, a caption over a surface — and reporting those would bury the one
 * overlap that is always a defect. The heading's own descendants are skipped for the same reason:
 * a heading's `<Text>` child sits inside its `<View>` by construction.
 */
export const HEAD_OVERLAP_SCRIPT = `(() => {
  const doc = document;
  const CONTAINS = /^(auto|scroll|hidden|clip)$/;
  const heading = doc.querySelector('[role="heading"]');
  if (!heading) return [];
  const clip = (el) => {
    const r = el.getBoundingClientRect();
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (CONTAINS.test(cs.overflowX) || CONTAINS.test(cs.overflowY)) {
        const b = n.getBoundingClientRect();
        if (b.left > x1) x1 = b.left;
        if (b.top > y1) y1 = b.top;
        if (b.right < x2) x2 = b.right;
        if (b.bottom < y2) y2 = b.bottom;
      }
    }
    return { x1: x1, y1: y1, x2: x2, y2: y2 };
  };
  const head = clip(heading);
  if (head.x2 - head.x1 <= 0 || head.y2 - head.y1 <= 0) return [];
  const out = [];
  for (const el of doc.querySelectorAll('*')) {
    if (el.children.length) continue;
    if (el === heading || heading.contains(el)) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const b = clip(el);
    if (b.x2 - b.x1 <= 0 || b.y2 - b.y1 <= 0) continue;
    const w = Math.min(head.x2, b.x2) - Math.max(head.x1, b.x1);
    const h = Math.min(head.y2, b.y2) - Math.max(head.y1, b.y1);
    if (w > 1 && h > 1) out.push({ other: text.slice(0, 40), w: Math.round(w), h: Math.round(h) });
  }
  return out;
})()`;

export function headOverlapIssues(ref: { id: string; file?: string }, overlaps: HeadOverlap[]): DoctorIssue[] {
  return overlaps.map((o) => ({
    id: 'page-head-overlap',
    severity: 'error' as const,
    page: ref.id,
    ...(ref.file ? { file: ref.file } : {}),
    message: `At ${NARROW_VIEWPORT.width}px the page heading is covered by "${o.other}" over ${o.w}x${o.h}px.`,
    fix: 'Let the heading wrap or truncate inside its own column, or move or clip whatever paints over it.',
  }));
}

export interface HeadWordBreak {
  /** The unbroken run the browser had to split, so the message names what the reader sees. */
  word: string;
  /** How many lines the run was spread over. */
  lines: number;
}

/**
 * Runs in the browser, at the narrow viewport: finds a word in the page heading that the browser
 * had to split in the middle. A run of non-space characters wider than its column has no break
 * opportunity, so a heading that wraps (as the viewer's does) cuts it wherever it runs out of room
 * — `TranscriptMediaUnavailableChipFa` / `mily`. It is the same run each time, so it is measured
 * word by word: each run's client rects over more than one line is a mid-word break. Where a
 * browser can legitimately break is not one — after a space, hyphen, slash, dash or zero-width
 * space, and between CJK characters — so words come from `Intl.Segmenter` (word granularity) where
 * the browser has it, else from whitespace, and are then split at those break characters.
 */
export const HEAD_WORD_BREAK_SCRIPT = `(() => {
  const doc = document;
  const heading = doc.querySelector('[role="heading"]');
  if (!heading) return [];
  const out = [];
  // A browser breaks a line between ideographs, kana and Hangul, and after a space, hyphen, slash,
  // dash or zero-width space; only a run with none of those inside it can be split mid-word.
  const BREAK = /[\\s\\-\\/\\u2014\\u2013\\u200B]/;
  const CJK = /[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]/u;
  const spans = (data) => {
    const words = [];
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      for (const seg of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(data)) {
        if (seg.isWordLike) words.push([seg.index, seg.index + seg.segment.length]);
      }
    } else {
      const re = /[^\\s]+/g;
      let m;
      while ((m = re.exec(data))) words.push([m.index, m.index + m[0].length]);
    }
    const runs = [];
    for (const w of words) {
      let start = -1;
      for (let at = w[0]; at < w[1];) {
        const ch = String.fromCodePoint(data.codePointAt(at));
        const next = at + ch.length;
        if (BREAK.test(ch)) { if (start >= 0) runs.push([start, at]); start = -1; }
        else if (CJK.test(ch)) { if (start >= 0) runs.push([start, at]); runs.push([at, next]); start = -1; }
        else if (start < 0) start = at;
        at = next;
      }
      if (start >= 0) runs.push([start, w[1]]);
    }
    return runs;
  };
  const walker = doc.createTreeWalker(heading, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const run of spans(node.data)) {
      const range = doc.createRange();
      range.setStart(node, run[0]);
      range.setEnd(node, run[1]);
      const tops = [];
      for (const r of range.getClientRects()) {
        if (r.width > 0 && !tops.some((t) => Math.abs(t - r.top) < 3)) tops.push(r.top);
      }
      if (tops.length > 1) out.push({ word: node.data.slice(run[0], run[1]).slice(0, 60), lines: tops.length });
    }
  }
  return out;
})()`;

/** A hint, not a warning: the page reads, the heading is just ugly. */
export function headWordBreakIssues(ref: { id: string; file?: string }, breaks: HeadWordBreak[]): DoctorIssue[] {
  return breaks.slice(0, 1).map((b) => ({
    id: 'heading-breaks-word',
    severity: 'hint' as const,
    page: ref.id,
    ...(ref.file ? { file: ref.file } : {}),
    message: `At ${NARROW_VIEWPORT.width}px the page heading breaks inside "${b.word}" (over ${b.lines} lines).`,
    fix: 'Give the page a human `title`.',
  }));
}

export interface ClippedSpecimen {
  /** The cell's own caption, so the message names the example the reader is looking at. */
  name: string;
  /** How far outside its cell the content paints, in px, on the worst side. */
  overflow: number;
  side: 'left' | 'right';
}

/**
 * Runs in the browser: finds specimen content that paints outside its cell and cannot be reached.
 *
 * A cell is the width the page gives an example. Content wider than it is either clipped — the
 * reader sees a cut-off component and no indication anything is missing — or drawn over its
 * neighbour. Either way the page is showing something other than the component.
 *
 * Scrollable content is deliberately not reported, and so is content a component clips itself:
 * both are decisions the specimen made, not width the page failed to give it. `PillRow`'s "Many
 * pills (scrollable)" paints 220px outside its cell at 1280 and is correct; a shimmer sweep or a
 * carousel that hides its own overflow is equally deliberate.
 *
 * The containment walk stops at the cell. Looking past it was wrong: `ComparisonGroups` wraps every
 * grouped card in a horizontal `ScrollView`, which react-native-web renders as `overflow-x: auto`,
 * so a walk to the document root found that scroller above every grouped cell and exempted all of
 * them — the rule covered plain list blocks only, while its calibration claimed the whole corpus.
 * What matters is whether the *specimen* contains its own overflow, which is a question about the
 * ancestors inside the cell.
 *
 * Only horizontal crossings are measured. A cell's width is what the page allocates and what
 * `specimenSize` controls; its height grows with content.
 */
export const CLIPPED_SPECIMEN_SCRIPT = `(() => {
  const doc = document;
  const CONTAINS = /^(auto|scroll|hidden|clip)$/;
  const out = [];
  for (const card of doc.querySelectorAll('[role=list][aria-label]')) {
    if (!/^[^:]+: .+/.test(card.getAttribute('aria-label') || '')) continue;
    for (const cell of card.querySelectorAll('[role=listitem]')) {
      if (cell.closest('[role=list]') !== card) continue;
      const box = cell.getBoundingClientRect();
      if (box.width < 2) continue;
      let worst = 0;
      let side = 'right';
      for (const el of cell.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const over = Math.max(box.left - r.left, r.right - box.right);
        if (over <= worst) continue;
        // Invisible content, including anything inside an invisible or offscreen wrapper: an exit
        // animation mid-flight, or a visually-hidden node parked at a large negative offset.
        let hidden = false;
        let contained = false;
        for (let p = el; p && p !== cell; p = p.parentElement) {
          const style = getComputedStyle(p);
          if (style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') { hidden = true; break; }
          // Anything between the content and the cell that handles its own overflow — scrolling it
          // or clipping it — is the specimen's own decision, not the page denying it width.
          if (p !== el && CONTAINS.test(style.overflowX)) { contained = true; break; }
        }
        if (hidden || contained) continue;
        worst = over;
        side = box.left - r.left >= r.right - box.right ? 'left' : 'right';
      }
      if (worst > 1) {
        const caption = cell.children[0] ? (cell.children[0].textContent || '') : '';
        out.push({ name: caption.trim(), overflow: Math.round(worst), side });
      }
    }
  }
  return out;
})()`;

/** Turns the browser's findings into doctor issues, one per clipped example. */
export function clippedSpecimenIssues(page: { id: string; file?: string }, clipped: readonly ClippedSpecimen[]): DoctorIssue[] {
  const ref = { page: page.id, ...(page.file ? { file: page.file } : {}) };
  return clipped.map((c) => ({
    id: 'specimen-clipped',
    severity: 'warning' as const,
    ...ref,
    message: `${c.name ? `"${c.name}"` : 'An example'} paints ${c.overflow}px past the ${c.side} of its cell, where it is cut off rather than scrollable.`,
    fix: 'Give the page a wider specimenSize, stack the blocks so the example gets the full row, or drop `itemsFill` if the example is a small instance that should sit centered.',
  }));
}

/** The contrast ratio below which a specimen's text can count as illegible. Deliberately far under
 *  WCAG's 3:1: platform colours such as iOS tertiary label grey or system yellow are faint by design.
 *  The mistake this check exists for is content drawn for the other appearance (white on light, black
 *  on dark), which sits at about 1.0–1.2:1. It also has to be extreme text (see the script). */
export const SPECIMEN_CONTRAST_MIN = 1.5;

export interface IllegibleSpecimen {
  /** The example's name: its caption, or `row × column` in a comparison grid. */
  name: string;
  /** The worst text in the cell, shortened. */
  text: string;
  /** Its contrast ratio against the background actually behind it, rounded down to one decimal so a
   *  reported ratio never reads as the 1.5 threshold it is under. */
  ratio: number;
  /** Which appearance the text was drawn for: `light` is near-white text, `dark` near-black. */
  kind: 'light' | 'dark';
}

/**
 * Runs in the browser: for each specimen cell, the contrast of every visible text node against the
 * background actually behind it. The background is composited bottom-up: from the text's element up
 * through its ancestors (past the cell, up to the page) until an opaque colour, each translucent
 * colour laid over what is beneath it, on white when nothing opaque is found. A text node is
 * skipped when it is hidden on purpose (`visibility: hidden`, `display: none`, `opacity: 0`, fully
 * transparent text, zero size, or positioned outside its cell), sits inside an image, an `svg` or a
 * `canvas`, sits in a disabled control (`disabled` or `aria-disabled`; a disabled control is exempt
 * from contrast rules), or has a gradient or image behind it (the colour behind it is not one
 * colour, so no ratio is claimed). One finding per cell: the worst text, when below
 * ${SPECIMEN_CONTRAST_MIN}:1 and when it is achromatic and extreme once composited onto its
 * background: near-white (luminance >= 0.8, channel spread <= 24) on a background of luminance >= 0.6,
 * or near-black (luminance <= 0.05, spread <= 24) on a background of luminance <= 0.1. Anything else
 * is a faithful platform colour that is faint by design (placeholder grey, a yellow warning glyph).
 *
 * A cell is a `listitem` of a variants/states card (its second child is the specimen; the first is
 * the caption, which is the viewer's own text and not measured) or a `cell` of a comparison grid.
 */
export const SPECIMEN_CONTRAST_SCRIPT = `(() => {
  const doc = document;
  const MIN = ${SPECIMEN_CONTRAST_MIN};
  const parse = (value) => {
    const m = /^rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:[,\\s/]+([\\d.]+%?))?\\s*\\)$/.exec((value || '').trim());
    if (!m) return null;
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a };
  };
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  const ratioOf = (a, b) => {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  // The ancestor walk only knows the text's ancestors. Content a sibling paints behind the text (an
  // ImageBackground's image, an absolutely positioned scrim) sits above the first opaque ancestor
  // background in the stack at the text's centre but is not an ancestor, so the colour behind the
  // text is unknown and no ratio is claimed.
  const paints = (c) => {
    const style = getComputedStyle(c);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
    if (/^(img|picture|video|canvas|svg)$/i.test(c.localName)) return true;
    if (style.backgroundImage && style.backgroundImage !== 'none') return true;
    const bg = parse(style.backgroundColor);
    return Boolean(bg && bg.a > 0);
  };
  const paintedBehind = (el, range, settledEl) => {
    if (!doc.elementsFromPoint) return false;
    const box = range.getBoundingClientRect();
    const stack = doc.elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    for (const c of stack) {
      if (c === settledEl) break;
      if (c.contains(el) || el.contains(c)) continue;
      if (paints(c)) return true;
    }
    return false;
  };
  // elementsFromPoint only answers for points inside the viewport, so the cell is scrolled into
  // view once, before anything is measured: scrolling per text node would leave rootBox stale. Only
  // the cell itself is brought into view, never the clipping boxes inside it that text sits in.
  const worstIn = (root) => {
    const view = doc.defaultView;
    let rootBox = root.getBoundingClientRect();
    if (view && root.scrollIntoView && (rootBox.top < 0 || rootBox.bottom > view.innerHeight || rootBox.left < 0 || rootBox.right > view.innerWidth)) {
      root.scrollIntoView({ block: 'center', inline: 'center' });
      rootBox = root.getBoundingClientRect();
    }
    let worst = null;
    const walker = doc.createTreeWalker(root, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.nodeValue || '').replace(/\\s+/g, ' ').trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el || el.closest('svg, img, canvas, video, picture, iframe, script, style, noscript')) continue;
      const range = doc.createRange();
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      if (box.right <= rootBox.left || box.left >= rootBox.right || box.bottom <= rootBox.top || box.top >= rootBox.bottom) continue;
      let hidden = false;
      let unknown = false;
      let opacity = 1;
      const layers = [];
      let settled = false;
      let settledEl = null;
      for (let p = el; p; p = p.parentElement) {
        if (p.hasAttribute('disabled') || p.getAttribute('aria-disabled') === 'true') { hidden = true; break; }
        const style = getComputedStyle(p);
        if (style.display === 'none' || style.visibility === 'hidden') { hidden = true; break; }
        const o = parseFloat(style.opacity);
        if (o === 0) { hidden = true; break; }
        if (!isNaN(o)) opacity *= o;
        if (settled) continue;
        if (style.backgroundImage && style.backgroundImage !== 'none') { unknown = true; break; }
        const bg = parse(style.backgroundColor);
        if (!bg || bg.a === 0) continue;
        layers.push(bg);
        if (bg.a >= 0.999) { settled = true; settledEl = p; }
      }
      if (hidden || unknown) continue;
      const fg = parse(getComputedStyle(el).color);
      if (!fg) continue;
      fg.a *= opacity;
      if (fg.a < 0.05) continue;
      let behind = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = layers.length - 1; i >= 0; i--) behind = over(layers[i], behind);
      const shown = over(fg, behind);
      const ratio = ratioOf(shown, behind);
      if (ratio >= MIN) continue;
      const lf = luminance(shown), lb = luminance(behind);
      const spread = Math.max(shown.r, shown.g, shown.b) - Math.min(shown.r, shown.g, shown.b);
      const kind = spread > 24 ? null : lf >= 0.8 && lb >= 0.6 ? 'light' : lf <= 0.05 && lb <= 0.1 ? 'dark' : null;
      if (!kind) continue;
      if (paintedBehind(el, range, settledEl)) continue;
      if (!worst || ratio < worst.ratio) worst = { text: text.length > 40 ? text.slice(0, 39) + '\\u2026' : text, ratio, kind };
    }
    return worst;
  };
  const out = [];
  const report = (name, worst) => {
    if (worst) out.push({ name: (name || '').trim(), text: worst.text, ratio: Math.floor(worst.ratio * 10) / 10, kind: worst.kind });
  };
  // elementsFromPoint skips pointer-events: none elements, which is how a React Native scrim
  // (pointerEvents="none") is drawn. react-native-web writes that as a class rule marked
  // !important, so the override needs the extra specificity of an id to win. It is removed after.
  const probe = doc.createElement('style');
  probe.id = 'ds-viewer-contrast-probe';
  probe.textContent = '*:not(#ds-viewer-contrast-probe){pointer-events:auto!important}';
  (doc.head || doc.documentElement).appendChild(probe);
  try {
    for (const card of doc.querySelectorAll('[role=list][aria-label]')) {
      if (!/^[^:]+: .+/.test(card.getAttribute('aria-label') || '')) continue;
      for (const cell of card.querySelectorAll('[role=listitem]')) {
        if (cell.closest('[role=list]') !== card || cell.children.length < 2) continue;
        report(cell.children[0].textContent, worstIn(cell.children[1]));
      }
    }
    for (const table of doc.querySelectorAll('[role=table]')) {
      const header = table.querySelector('[role=row]');
      for (const cell of table.querySelectorAll('[role=cell]')) {
        const row = cell.closest('[role=row]');
        if (!row) continue;
        const index = Array.prototype.indexOf.call(row.children, cell);
        const rowName = row.querySelector('[role=rowheader]');
        const columnName = header && header.children[index];
        report([rowName && rowName.textContent, columnName && columnName.textContent].filter(Boolean).join(' \\u00d7 '), worstIn(cell));
      }
    }
  } finally {
    probe.remove();
  }
  return out;
})()`;

/** Turns the browser's findings into doctor warnings, one per illegible cell. */
export function illegibleSpecimenIssues(page: { id: string; file?: string }, found: readonly IllegibleSpecimen[]): DoctorIssue[] {
  const ref = { page: page.id, ...(page.file ? { file: page.file } : {}) };
  return found.map((f) => ({
    id: 'specimen-text-illegible',
    severity: 'warning' as const,
    ...ref,
    message: `Text '${f.text}' in '${page.id}'${f.name ? ` · ${f.name}` : ''} is ${f.kind} text on a ${f.kind} background (${(Math.floor(f.ratio * 10) / 10).toFixed(1)}:1).`,
    fix: "Set the item's `surface`, or give the sample text a colour that follows the scheme.",
  }));
}

/** How far off the stage's centre an anatomy picture's specimen may sit, in px. */
export const ANATOMY_CENTRE_TOLERANCE = 6;
/** How far past the specimen's right edge a pin may sit, in px — the pin column is
 *  `ANATOMY_PIN_GUTTER` (30) wide, and a 22px pin fits inside it with room to spare. */
export const ANATOMY_PIN_REACH = 48;
/** Pins whose vertical gap is at most this belong to one column; a bigger gap starts a new run. */
export const ANATOMY_PIN_RUN_GAP = 12;

export type AnatomyFinding =
  | { kind: 'off-centre'; stage: number; offset: number }
  | { kind: 'pin-far'; stage: number; pin: string; distance: number }
  | { kind: 'pin-outside'; stage: number; pin: string; where: 'opposite' | 'above' | 'below' }
  | { kind: 'pin-over-legend'; stage: number; pin: string }
  | { kind: 'pin-cut-off'; stage: number; pin: string };

/**
 * Runs in the browser: measures each anatomy picture the way it is drawn at the default desktop
 * width. The picture's stage is the box `AnatomyBox` gives it; the specimen is what
 * `AnatomySpecimen` drew (its pin wrapper when it has pins, otherwise its content's own children);
 * a pin is every `anatomy-pin` in the stage — the ones passed through `AnatomySpecimen`'s `pins`
 * prop and the ones an author placed in the specimen's children or on an overlay of their own. The
 * ↗ badge a pin carries is not a pin.
 *
 * Reported: a specimen whose horizontal centre is more than 6px off its stage's centre (an
 * unwrapped picture, or one pushed aside by its own margins; skipped when the stage scrolls
 * sideways, where the stage's width is not the picture's), a pin more than 48px past the
 * specimen's pin side (the right in left-to-right text, the left in right-to-left), a pin on the
 * other side of the specimen or whose centre is above or below it, and a pin extending past its stage's box (cut
 * off), and a pin overlapping the legend (the side-by-side `anatomy-legend`, found from the stage
 * through `anatomy-card`; a stacked picture has none, its clipping is the cut-off check). A picture with no `AnatomySpecimen` has no
 * specimen to measure and is skipped here — the static `anatomy-picture-not-specimen` rule reports it.
 */
export const ANATOMY_PICTURE_SCRIPT = `(() => {
  const doc = document;
  const out = [];
  const stages = doc.querySelectorAll('[data-testid="anatomy-stage"]');
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const wrapper = stage.querySelector('[data-testid="anatomy-specimen"]');
    if (!wrapper) continue;
    const stageBox = stage.getBoundingClientRect();
    const pinsWrapper = stage.querySelector('[data-testid="anatomy-specimen-pins"]');
    const pinList = Array.from(stage.querySelectorAll('[data-testid="anatomy-pin"]'));
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    const extend = (r) => {
      if (r.left < left) left = r.left;
      if (r.right > right) right = r.right;
      if (r.top < top) top = r.top;
      if (r.bottom > bottom) bottom = r.bottom;
    };
    if (pinsWrapper) {
      const box = pinsWrapper.getBoundingClientRect();
      // The wrapper pads itself to hold a tall pin column; the pin layer is exactly the specimen.
      const layer = pinsWrapper.querySelector('[data-testid="anatomy-pin-layer"]');
      const lr = layer ? layer.getBoundingClientRect() : box;
      extend({ left: box.left, right: box.right, top: lr.top, bottom: lr.bottom });
    } else {
      const root = wrapper.children[0];
      for (const el of root ? root.children : []) {
        // A pin among the specimen's children is measured against the specimen, never part of it.
        if (pinList.indexOf(el) >= 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1) continue;
        extend(r);
      }
    }
    if (!isFinite(left) || !isFinite(right)) continue;
    const scrolls = stage.scrollWidth > stage.clientWidth + 1;
    const offset = Math.abs((left + right) / 2 - (stageBox.left + stageBox.right) / 2);
    if (!scrolls && offset > ${ANATOMY_CENTRE_TOLERANCE}) out.push({ kind: 'off-centre', stage: i, offset: Math.round(offset) });
    const rtl = getComputedStyle(stage).direction === 'rtl';
    const card = stage.closest('[data-testid="anatomy-card"]');
    // Only the side-by-side legend: stacked, the columns sit below the stage and the cut-off check covers it.
    const legend = card ? card.querySelector('[data-testid="anatomy-legend"]') : null;
    const legendBox = legend ? legend.getBoundingClientRect() : null;
    // The pins beside the specimen sit in runs: neighbours at most ${ANATOMY_PIN_RUN_GAP}px apart vertically. A run of
    // two or more is a column; one taller than the specimen must overhang it, so it is judged as a whole (its
    // centre against the specimen). A single pin, or a column that fits, is judged per pin. Runs keep a far-off
    // stray pin from merging into the correct pins and dragging the column's centre towards the specimen.
    const beside = [];
    for (const el of pinList) {
      const box = el.getBoundingClientRect();
      if ((rtl ? left - box.right : box.left - right) > ${ANATOMY_PIN_REACH}) continue;
      if (rtl ? box.left > right : box.right < left) continue;
      beside.push({ el, top: box.top, bottom: box.bottom });
    }
    beside.sort((a, b) => a.top - b.top);
    const runOf = new Map();
    let run = [];
    let runBottom = -Infinity;
    const closeRun = () => {
      if (run.length >= 2) {
        const colTop = run[0].top;
        const colBottom = Math.max(...run.map((p) => p.bottom));
        const colCentre = (colTop + colBottom) / 2;
        const tall = colBottom - colTop > bottom - top;
        const colWhere = colBottom < top || colTop > bottom ? (colCentre < top ? 'above' : 'below') : colCentre < top - 1 ? 'above' : colCentre > bottom + 1 ? 'below' : null;
        for (const p of run) runOf.set(p.el, { tall, colWhere });
      }
      run = [];
      runBottom = -Infinity;
    };
    for (const p of beside) {
      if (run.length && p.top - runBottom > ${ANATOMY_PIN_RUN_GAP}) closeRun();
      run.push(p);
      if (p.bottom > runBottom) runBottom = p.bottom;
    }
    closeRun();
    for (const el of pinList) {
      const box = el.getBoundingClientRect();
      const text = (el.textContent || '').replace('\u2197', '').trim() || '\u2197';
      const distance = rtl ? left - box.right : box.left - right;
      const centre = (box.top + box.bottom) / 2;
      const col = runOf.get(el);
      const tall = Boolean(col && col.tall);
      const colWhere = col ? col.colWhere : null;
      if (box.top < stageBox.top - 0.5 || box.bottom > stageBox.bottom + 0.5) { out.push({ kind: 'pin-cut-off', stage: i, pin: text }); continue; }
      if (distance > ${ANATOMY_PIN_REACH}) out.push({ kind: 'pin-far', stage: i, pin: text, distance: Math.round(distance) });
      else if (rtl ? box.left > right : box.right < left) out.push({ kind: 'pin-outside', stage: i, pin: text, where: 'opposite' });
      else if (tall && colWhere) out.push({ kind: 'pin-outside', stage: i, pin: text, where: colWhere });
      else if (!tall && centre < top - 1) out.push({ kind: 'pin-outside', stage: i, pin: text, where: 'above' });
      else if (!tall && centre > bottom + 1) out.push({ kind: 'pin-outside', stage: i, pin: text, where: 'below' });
      else if (legendBox && box.right > legendBox.left + 1 && box.left < legendBox.right - 1 && box.bottom > legendBox.top && box.top < legendBox.bottom) {
        out.push({ kind: 'pin-over-legend', stage: i, pin: text });
      }
    }
  }
  return out;
})()`;

/** Turns the browser's findings into doctor issues. Anything that isn't a known finding is ignored. */
export function anatomyPictureIssues(page: { id: string; file?: string }, findings: readonly unknown[]): DoctorIssue[] {
  const ref = { page: page.id, ...(page.file ? { file: page.file } : {}) };
  const fix = "Draw the picture with AnatomySpecimen and pass its pins through the `pins` prop (position: 'absolute', right: 0), so it is centred like the variant cells with the pins beside it.";
  const issues: DoctorIssue[] = [];
  for (const f of findings as AnatomyFinding[]) {
    if (!f || typeof f !== 'object') continue;
    const where = `anatomy picture ${f.stage + 1}`;
    if (f.kind === 'off-centre') {
      issues.push({ id: 'anatomy-picture-geometry', severity: 'warning', ...ref, message: `The specimen in ${where} sits ${f.offset}px off the centre of its stage (more than ${ANATOMY_CENTRE_TOLERANCE}px).`, fix });
    } else if (f.kind === 'pin-far') {
      issues.push({ id: 'anatomy-picture-geometry', severity: 'warning', ...ref, message: `Pin "${f.pin}" in ${where} is ${f.distance}px from the specimen's edge (more than ${ANATOMY_PIN_REACH}px).`, fix });
    } else if (f.kind === 'pin-outside') {
      const side = f.where === 'opposite' ? 'on the wrong side of' : f.where === 'above' ? 'above' : 'below';
      issues.push({ id: 'anatomy-picture-geometry', severity: 'warning', ...ref, message: `Pin "${f.pin}" in ${where} sits ${side} the specimen.`, fix });
    } else if (f.kind === 'pin-cut-off') {
      issues.push({ id: 'anatomy-picture-geometry', severity: 'warning', ...ref, message: `Pin "${f.pin}" in ${where} is cut off by the picture area.`, fix });
    } else if (f.kind === 'pin-over-legend') {
      issues.push({ id: 'anatomy-picture-geometry', severity: 'warning', ...ref, message: `Pin "${f.pin}" in ${where} overlaps the legend column.`, fix });
    }
  }
  return issues;
}

/** How the headless browser is launched. On a CI runner (`CI` set) Chrome's own sandbox is turned
 *  off: GitHub's current Ubuntu images restrict the unprivileged user namespaces that sandbox needs,
 *  so a launch with it fails and every `--render` run would end `render-unavailable`. A developer's
 *  machine keeps the sandbox. */
export function launchOptions(env: Record<string, string | undefined>): { headless: boolean; args?: string[] } {
  const ci = env.CI !== undefined && env.CI !== '' && env.CI !== '0' && env.CI.toLowerCase() !== 'false';
  return ci ? { headless: true, args: ['--no-sandbox'] } : { headless: true };
}

/** The project's own puppeteer, or `undefined` when it isn't installed. */
export function loadProjectPuppeteer(projectRoot: string): unknown | undefined {
  try {
    return createRequire(path.join(path.resolve(projectRoot), 'package.json'))('puppeteer');
  } catch {
    return undefined;
  }
}

export const RENDER_UNAVAILABLE: DoctorIssue = {
  id: 'render-unavailable',
  severity: 'error',
  message: "`doctor --render` needs a headless browser, and puppeteer isn't installed in this project.",
  fix: 'npm install --save-dev puppeteer (then run doctor --render again).',
};

const DEV_START_TIMEOUT_MS = 120_000;
const FIRST_LOAD_TIMEOUT_MS = 300_000;
const PAGE_TIMEOUT_MS = 120_000;
const SETTLE_MS = 900;
/** After a viewport change, long enough for react-native-web to reflow before anything is measured. */
const RESIZE_SETTLE_MS = 250;

/** Stops `dev` and everything it started (Expo/Metro): the whole process tree on Windows, the
 *  whole process group elsewhere (Expo stops through dev's own signal handler). Releases the pipes
 *  so this process can exit. `os` is injectable for tests. */
export function stopDev(
  child: ChildProcess,
  os: { platform?: NodeJS.Platform; spawnSync?: typeof spawnSync; kill?: (pid: number, signal: NodeJS.Signals) => void } = {},
): void {
  const platform = os.platform ?? process.platform;
  if (child.pid) {
    try {
      if (platform === 'win32') (os.spawnSync ?? spawnSync)('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else (os.kill ?? ((pid, signal) => process.kill(pid, signal)))(-child.pid, 'SIGTERM');
    } catch {
      // Already exited.
    }
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}

/** The last few KB of dev's output, so a failed start can say why. */
function outputTail(): { push: (data: unknown) => void; text: () => string } {
  let tail = '';
  return {
    push: (data) => {
      tail = (tail + String(data)).slice(-4000);
    },
    text: () => {
      const lines = tail.trim().split('\n').slice(-8).join('\n');
      return lines ? `\n${lines}` : '';
    },
  };
}

/** Starts the project's own `dev` in its own process group. `onSpawn` receives the child at once,
 *  so a signal during startup can still stop it. */
/** Polls `http://localhost:<port>/` until it answers, so a caller never navigates to a port Metro
 *  has not bound yet. Any HTTP reply counts — the page's own content is checked afterwards. */
async function waitForServer(port: number, timeoutMs = DEV_START_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const answered = await new Promise<boolean>((resolve) => {
      const request = httpGet({ host: 'localhost', port, path: '/', timeout: 2000 }, () => resolve(true));
      request.on('error', () => resolve(false));
      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
    });
    if (answered) return;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for the catalog to answer on port ${port}.`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function startDev(projectRoot: string, onSpawn: (child: ChildProcess) => void, pinnedPort?: number): Promise<{ child: ChildProcess; port: number }> {
  const main = path.join(path.dirname(fileURLToPath(import.meta.url)), 'main.js');
  return new Promise((resolve, reject) => {
    // Its own workspace directory and no update endpoint: this server exists to render pages, and
    // every file it generates would otherwise overwrite the ones an already-running `dev` is
    // serving — including that developer's endpoint, pointing their open catalog at a port that
    // dies with this check.
    const child = spawn(process.execPath, [main, 'dev', '--no-update-endpoint', '--workspace-dir', RENDER_WORKSPACE_DIR, ...(pinnedPort ? ['--port', String(pinnedPort)] : [])], {
      cwd: projectRoot,
      env: { ...process.env, CI: '1', DS_VIEWER_NO_UPDATE_CHECK: '1' },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    onSpawn(child);
    const output = outputTail();
    let done = false;
    const fail = (message: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stopDev(child);
      reject(new Error(`${message}${output.text()}`));
    };
    const timer = setTimeout(() => fail('Timed out waiting for ds-viewer dev to start.'), DEV_START_TIMEOUT_MS);
    // Read continuously (so Metro's output never fills the pipe) and keep the tail for errors.
    child.stderr?.on('data', output.push);
    child.stdout?.on('data', (data) => {
      output.push(data);
      const match = String(data).match(/Starting the catalog at http:\/\/localhost:(\d+)/);
      if (match && !done) {
        done = true;
        clearTimeout(timer);
        // `dev` prints that line before it spawns Expo, so the port is known well before Metro is
        // listening on it. Resolving here raced the bundler: the first navigation could land on a
        // port nothing was bound to yet. Wait for the server to actually answer.
        const port = Number(match[1]);
        waitForServer(port)
          .then(() => resolve({ child, port }))
          .catch((error: Error) => fail(`${error.message} `));
      }
    });
    child.on('exit', (code) => fail(`ds-viewer dev exited early (code ${code}).`));
  });
}

type Browser = { newPage: () => Promise<any>; close: () => Promise<void> };

const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 } as const;

/** A sidebar href's page id; a malformed escape falls back to the raw text (like `idFromHash`). */
function idFromHref(href: string): string {
  const raw = href.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Opens every sidebar page and returns its findings. `files` maps page ids to project-relative
 *  page files, for the findings' `file`. `log` receives progress lines (stderr in the CLI). `deps`
 *  replaces the browser, dev process control and exit for tests. */
export async function renderCheck(
  projectRoot: string,
  options: {
    files?: ReadonlyMap<string, string>;
    log?: (line: string) => void;
    /** Wait after each page loads before reading it (lets deferred effects log). @default 900 */
    settleMs?: number;
    /**
     * Pin the render server to this port instead of letting it take the first free one from 5181.
     * Worth setting when something else is already using that range — another project's catalog,
     * or a second `dev` — because the check's server and anything else on its port cannot both
     * win, and the check has no way to tell a stranger's server from its own.
     */
    port?: number;
    deps?: {
      puppeteer?: unknown;
      startDev?: (projectRoot: string, onSpawn: (child: ChildProcess) => void, port?: number) => Promise<{ child: ChildProcess; port: number }>;
      stopDev?: (child: ChildProcess) => void;
      exit?: (code: number) => void;
    };
  } = {},
): Promise<DoctorIssue[]> {
  projectRoot = path.resolve(projectRoot);
  const deps = options.deps ?? {};
  const puppeteer = (deps.puppeteer ?? loadProjectPuppeteer(projectRoot)) as { launch: (o: object) => Promise<Browser> } | undefined;
  if (!puppeteer) return [RENDER_UNAVAILABLE];
  const stop = deps.stopDev ?? ((child: ChildProcess) => stopDev(child));
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const log = options.log ?? (() => {});
  // Set as soon as dev is spawned, before it's ready, so a signal during startup still stops it.
  let devChild: ChildProcess | undefined;
  let port = 0;
  let browser: Browser | undefined;
  // Ctrl-C or a CI cancel must still stop Metro: `dev` runs in its own process group, so the
  // terminal's signal never reaches it. Registered before the browser launches, so it runs ahead
  // of puppeteer's own handler.
  const handlers = (Object.keys(SIGNAL_EXIT_CODES) as (keyof typeof SIGNAL_EXIT_CODES)[]).map((signal) => {
    const handler = () => {
      if (devChild) stop(devChild);
      exit(SIGNAL_EXIT_CODES[signal]);
    };
    process.on(signal, handler);
    return [signal, handler] as const;
  });
  try {
    // The browser first: a missing browser download shouldn't start Metro for nothing.
    try {
      browser = await puppeteer.launch(launchOptions(process.env));
    } catch (error) {
      return [{ ...RENDER_UNAVAILABLE, message: `Couldn't start the headless browser: ${(error as Error).message.split('\n')[0]}`, fix: 'npx puppeteer browsers install chrome' }];
    }
    ({ port } = await (deps.startDev ?? startDev)(projectRoot, (child) => {
      devChild = child;
    }, options.port));
    const home = await browser.newPage();
    const deadline = Date.now() + FIRST_LOAD_TIMEOUT_MS;
    for (;;) {
      try {
        await home.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0', timeout: FIRST_LOAD_TIMEOUT_MS });
        break;
      } catch (error) {
        if (!String(error).includes('ERR_CONNECTION_REFUSED') || Date.now() > deadline) throw error;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    // Runs in the browser; `document` is typed loosely because the CLI compiles without DOM types.
    const readHrefs = (): Promise<string[]> => home.evaluate(() => {
      const doc = (globalThis as unknown as { document: { querySelectorAll: (s: string) => ArrayLike<{ getAttribute: (n: string) => string | null }> } }).document;
      return [...new Set(Array.from(doc.querySelectorAll('a[href^="#"]')).map((a) => a.getAttribute('href') ?? ''))];
    });
    // The server answers before the bundle has run, and a workspace Metro has never bundled before
    // (a fresh `.ds-viewer-render`) is slow the first time. Keep asking until the sidebar is there,
    // rather than reading once and calling an empty page a failed render.
    let hrefs = await readHrefs();
    while (hrefs.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      hrefs = await readHrefs();
    }
    await home.close();
    const ids = hrefs.map(idFromHref).filter(Boolean);
    if (ids.length === 0) {
      return [{ id: 'render-failed', severity: 'error', message: 'The catalog rendered no sidebar links, so it probably failed to render at all.', fix: 'Run `ds-viewer dev` and check the browser console.' }];
    }
    log(`Rendering ${ids.length} pages…`);
    const seen = new Set<string>();
    const issues: DoctorIssue[] = [];
    for (const id of ids) {
      // One page failing (a navigation timeout) is that page's finding; the others still run.
      let page: { close: () => Promise<void> } & Record<string, any> | undefined;
      try {
        page = await browser.newPage();
        await page!.setViewport({ width: 1280, height: 800 });
        const messages: PageMessage[] = [];
        page!.on('console', (m: { type: () => string; text: () => string }) => messages.push({ type: m.type(), text: m.text() }));
        page!.on('pageerror', (e: unknown) => messages.push({ type: 'pageerror', text: String(e) }));
        await page!.goto(`http://localhost:${port}/#${encodeURIComponent(id)}`, { waitUntil: 'networkidle0', timeout: PAGE_TIMEOUT_MS });
        await new Promise((r) => setTimeout(r, options.settleMs ?? SETTLE_MS));
        const hasHeading: boolean = await page!.evaluate(() => {
          const doc = (globalThis as unknown as { document: { querySelector: (s: string) => { textContent: string | null } | null } }).document;
          return Boolean(doc.querySelector('[role="heading"]')?.textContent?.trim());
        });
        issues.push(...issuesFromPage({ id, file: options.files?.get(id) }, messages, hasHeading, seen));
        // Advisory: a script failure (a detached child document mid-navigation, an element whose
        // `value` getter throws) must not become this page's render-error, so it has its own catch
        // rather than falling into the one below.
        let identical: IdenticalPair[] | undefined;
        try {
          identical = (await page!.evaluate(IDENTICAL_VARIANTS_SCRIPT)) as IdenticalPair[] | undefined;
        } catch {
          identical = undefined;
        }
        if (Array.isArray(identical)) issues.push(...identicalVariantIssues({ id, file: options.files?.get(id) }, identical));
        // Advisory for the same reason as the pass above, and kept separate so one failing script
        // does not cost the other its findings.
        let clipped: ClippedSpecimen[] | undefined;
        try {
          clipped = (await page!.evaluate(CLIPPED_SPECIMEN_SCRIPT)) as ClippedSpecimen[] | undefined;
        } catch {
          clipped = undefined;
        }
        if (Array.isArray(clipped)) issues.push(...clippedSpecimenIssues({ id, file: options.files?.get(id) }, clipped));
        // Advisory and separate, like the passes around it.
        let illegible: IllegibleSpecimen[] | undefined;
        try {
          illegible = (await page!.evaluate(SPECIMEN_CONTRAST_SCRIPT)) as IllegibleSpecimen[] | undefined;
        } catch {
          illegible = undefined;
        }
        if (Array.isArray(illegible)) issues.push(...illegibleSpecimenIssues({ id, file: options.files?.get(id) }, illegible));
        // At the default desktop width, like the passes above, and advisory for the same reason.
        let anatomy: unknown[] | undefined;
        try {
          anatomy = (await page!.evaluate(ANATOMY_PICTURE_SCRIPT)) as unknown[] | undefined;
        } catch {
          anatomy = undefined;
        }
        if (Array.isArray(anatomy)) issues.push(...anatomyPictureIssues({ id, file: options.files?.get(id) }, anatomy));
        // Last, because it is the only check that changes the viewport: the overlap it guards
        // appears only at a narrow width, and every check above is calibrated at 1280. Advisory
        // like the two passes above — a failing script must not cost this page its other findings.
        let headOverlaps: HeadOverlap[] | undefined;
        try {
          await page!.setViewport({ width: NARROW_VIEWPORT.width, height: NARROW_VIEWPORT.height });
          await new Promise((r) => setTimeout(r, RESIZE_SETTLE_MS));
          headOverlaps = (await page!.evaluate(HEAD_OVERLAP_SCRIPT)) as HeadOverlap[] | undefined;
        } catch {
          headOverlaps = undefined;
        }
        if (Array.isArray(headOverlaps)) issues.push(...headOverlapIssues({ id, file: options.files?.get(id) }, headOverlaps));
        // Still at the narrow width, and separate so a failure in one script keeps the other's findings.
        let wordBreaks: HeadWordBreak[] | undefined;
        try {
          wordBreaks = (await page!.evaluate(HEAD_WORD_BREAK_SCRIPT)) as HeadWordBreak[] | undefined;
        } catch {
          wordBreaks = undefined;
        }
        if (Array.isArray(wordBreaks)) issues.push(...headWordBreakIssues({ id, file: options.files?.get(id) }, wordBreaks));
        await page!.close();
      } catch (error) {
        // A stuck page's tab is closed, so it doesn't keep loading next to the remaining pages.
        await page?.close().catch(() => {});
        const file = options.files?.get(id);
        issues.push({ id: 'render-error', severity: 'error', page: id, ...(file ? { file } : {}), message: `Couldn't open the page: ${(error as Error).message.split('\n')[0]}`, fix: 'Open the page in `ds-viewer dev`; it may be very slow to load or stuck.' });
      }
    }
    log(`Checked ${ids.length} pages.`);
    return issues;
  } catch (error) {
    return [{ id: 'render-failed', severity: 'error', message: `Couldn't render the catalog: ${(error as Error).message}`, fix: "Run `ds-viewer dev` to see why the catalog doesn't start." }];
  } finally {
    for (const [signal, handler] of handlers) process.off(signal, handler);
    if (browser) await browser.close().catch(() => {});
    if (devChild) stop(devChild);
  }
}
