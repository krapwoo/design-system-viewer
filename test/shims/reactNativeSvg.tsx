// Stand-in for `react-native-svg` under the render harness. The real package's Node-loadable
// builds are CommonJS (so they `require` the real Flow-source `react-native`, bypassing the
// loader's alias) or extensionless ESM that Node cannot resolve; its web shim is a bundler-only
// `.web.js`. This renders each element as the plain DOM SVG element it becomes in a browser, so a
// test sees the same `<svg>`/`<path>` structure — it does not exercise react-native-svg itself.
import React from 'react';

type SvgProps = Record<string, unknown> & { accessibilityLabel?: string; children?: React.ReactNode };

function element(tag: string) {
  return React.forwardRef<unknown, SvgProps>(function SvgElement({ accessibilityLabel, ...props }, ref) {
    const a11y = accessibilityLabel === undefined ? {} : { 'aria-label': accessibilityLabel, role: 'img' };
    return React.createElement(tag, { ...props, ...a11y, ref });
  });
}

const Svg = element('svg');
export default Svg;
export const Path = element('path');
export const Rect = element('rect');
export const Circle = element('circle');
export const Line = element('line');
export const Polyline = element('polyline');
export const Polygon = element('polygon');
export type PathProps = SvgProps;
