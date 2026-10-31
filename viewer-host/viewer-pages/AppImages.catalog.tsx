import React from 'react';
import { Image } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';

// The worked example for README "Using the app's own images": a page requires a PNG that lives
// outside this project's folder (here `kit-host/assets/logo.png`, standing in for an app's
// `App/Assets/…`). This project's own `metro.config.js` adds that folder to `watchFolders`, and the
// generated workspace config keeps it — so the require bundles, and `npm run check:catalog` proves it:
// an image that did not load would fail the page, because it is reported as a console error below.
export default defineCatalogPage({
  id: 'AppImages',
  title: 'App images',
  group: 'Components',
  source: 'viewer-pages/AppImages.catalog.tsx',
  standalone: 'A worked example for the README, not a part of the viewer: it documents no component.',
  description: "A page showing an image from outside the catalog's own folder, the way an app's own icon or brand mark is shown. See the README section \"Using the app's own images\".",
  render: () => (
    <Image
      accessibilityLabel="The app's own mark, bundled from outside this project"
      source={require('../../kit-host/assets/logo.png')}
      style={{ width: 64, height: 64 }}
      onError={() => console.error('AppImages: the image outside the catalog folder did not load.')}
    />
  ),
});
