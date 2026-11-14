// Stand-in for `react-native-safe-area-context` under the render harness: a browser has no device
// insets, so every edge is 0 — what the package's own web build reports before a provider measures.
// (Its Node-loadable builds are CommonJS or extensionless ESM; see `reactNativeSvg.tsx`.)
export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
