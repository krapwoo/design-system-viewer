import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * A whole app screen inside a `PhoneFrame`: `header` pinned to the top, `footer` to the bottom,
 * and the children in a body between them that scrolls instead of pushing the footer off the
 * device. `floating` is a layer over the top of the screen for toasts; it adds no inset of its
 * own, so the app positions its content. `bodyWrapper` lets the app put its own surface or
 * context provider around the scrolling body; give its root `flex: 1, minHeight: 0`.
 */
export function PhoneScreen({
  header,
  footer,
  floating,
  bodyWrapper,
  scroll = true,
  contentContainerStyle,
  children,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  floating?: React.ReactNode;
  bodyWrapper?: (body: React.ReactNode) => React.ReactNode;
  /** Scroll the body (default), or lay it out to fit. */
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const body = scroll ? (
    <ScrollView style={styles.flex} contentContainerStyle={contentContainerStyle}>{children}</ScrollView>
  ) : (
    <View style={[styles.flex, contentContainerStyle]}>{children}</View>
  );
  return (
    <View style={styles.screen}>
      {header}
      <View style={styles.flex}>{bodyWrapper ? bodyWrapper(body) : body}</View>
      {footer}
      {floating ? (
        <View style={styles.floating} pointerEvents="box-none">{floating}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills the device; `minHeight: 0` lets a flex child shrink below its content on the web.
  screen: { flex: 1, alignSelf: 'stretch', minHeight: 0 },
  flex: { flex: 1, minHeight: 0 },
  floating: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
});
