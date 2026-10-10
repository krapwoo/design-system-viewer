/**
 * Automatic cell fill for `specimenSurface: 'auto'` (the default): decides whether an example
 * blends into its white comparison cell, so that one cell can turn gray. Kept free of any runtime
 * import so `node --test` can assert on it directly (see `__tests__/specimenFill.test.ts`).
 *
 * The rule looks only at the example's largest painted box (the element with a background that
 * covers the most area): if that box is near-white (every channel close to 255, so pale tints
 * don't count) and has no visible border, the example's edges
 * vanish against the white cell. A shadow alone doesn't count as an edge. Small boxes (under a
 * tenth of the cell) and text-only examples never trigger it.
 */

export interface Rgba { r: number; g: number; b: number; a: number }

/** One element inside an example, as measured in the browser. */
export interface PaintedBox {
  area: number;
  background: Rgba | null;
  /** The top border's colour when its width is above 0, else null. */
  border: Rgba | null;
}

/** A fill is near-white when every channel (after compositing over the white cell) is at least
 *  this. #fafafa and #f8f8f8 qualify; #f4f4f4 already reads as gray, and pale tints such as a
 *  positive banner's rgb(240, 255, 244) read as colour, even when they're as bright as white. */
const NEAR_WHITE_CHANNEL = 247;
/** At or above this, a border draws the edge itself (#e4e4e4 is 1.27:1). */
const VISIBLE_BORDER_CONTRAST = 1.2;
/** A box smaller than this share of the cell is a detail, not the example's body. */
const MIN_AREA_SHARE = 0.1;

/** Parses a computed CSS colour (`rgb(…)`/`rgba(…)`). Fully transparent or unknown values are null. */
export function parseCssColor(value: string): Rgba | null {
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(value.trim());
  if (!match) return null;
  const alphaText = match[4];
  const a = alphaText === undefined ? 1 : alphaText.endsWith('%') ? Number(alphaText.slice(0, -1)) / 100 : Number(alphaText);
  if (!(a > 0)) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a };
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** True when every channel of `color`, composited over white, is at least `NEAR_WHITE_CHANNEL`. */
export function isNearWhite(color: Rgba): boolean {
  const over = (c: number) => color.a * c + (1 - color.a) * 255;
  return Math.min(over(color.r), over(color.g), over(color.b)) >= NEAR_WHITE_CHANNEL;
}

/** WCAG contrast ratio against white, after compositing a translucent colour over the white cell. */
export function contrastWithWhite(color: Rgba): number {
  const over = (c: number) => color.a * c + (1 - color.a) * 255;
  const luminance = 0.2126 * channel(over(color.r)) + 0.7152 * channel(over(color.g)) + 0.0722 * channel(over(color.b));
  return 1.05 / (luminance + 0.05);
}

/** True when the example's body is near-white with no visible border, so it vanishes on a white cell. */
export function blendsIntoCell(boxes: readonly PaintedBox[], cellArea: number): boolean {
  let largest: PaintedBox | undefined;
  for (const box of boxes) {
    if (!box.background || box.area < cellArea * MIN_AREA_SHARE) continue;
    if (!largest || box.area > largest.area) largest = box;
  }
  if (!largest?.background) return false;
  if (!isNearWhite(largest.background)) return false;
  return !(largest.border && contrastWithWhite(largest.border) >= VISIBLE_BORDER_CONTRAST);
}

/** Minimal DOM shapes, so this file needs no DOM lib types. */
interface MeasurableElement {
  getBoundingClientRect(): { width: number; height: number };
  querySelectorAll(selector: string): ArrayLike<MeasurableElement>;
}
type ComputedStyleReader = (element: MeasurableElement) => {
  backgroundColor: string;
  borderTopColor: string;
  borderTopWidth: string;
  visibility: string;
  opacity: string;
};

/** Measures every element inside `cell` (up to `limit`) in the browser. */
export function measurePaintedBoxes(cell: MeasurableElement, readStyle: ComputedStyleReader, limit = 300): { boxes: PaintedBox[]; cellArea: number } {
  const cellRect = cell.getBoundingClientRect();
  const elements = cell.querySelectorAll('*');
  const boxes: PaintedBox[] = [];
  for (let i = 0; i < Math.min(elements.length, limit); i++) {
    const element = elements[i];
    const style = readStyle(element);
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    const rect = element.getBoundingClientRect();
    boxes.push({
      area: rect.width * rect.height,
      background: parseCssColor(style.backgroundColor),
      border: parseFloat(style.borderTopWidth) > 0 ? parseCssColor(style.borderTopColor) : null,
    });
  }
  return { boxes, cellArea: cellRect.width * cellRect.height };
}
