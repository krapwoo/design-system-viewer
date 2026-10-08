// Dev-only harness — not part of the reusable template. Hosts the template's two worked catalog
// examples so they can be browsed with `expo start --web`, mirroring how metro-native previews its
// own `?ds=1` catalog. New projects consuming the template drop one of these into their own Expo
// app instead.
//
//   http://localhost:5181/                   → CatalogExample ("Native App DS Template")
//   http://localhost:5181/?catalog=framework → CatalogFrameworkExample ("Design System DS Catalog")
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CatalogExample } from '../native/catalog/CatalogExample';
import { CatalogFrameworkExample } from '../native/catalog/CatalogFrameworkExample';

const isFrameworkCatalog =
  typeof window !== 'undefined' && window.location.search.includes('catalog=framework');

export default function App() {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = isFrameworkCatalog ? 'Design System DS Catalog' : 'Native App DS Template';
    }
  }, []);

  // CatalogShell no longer provides safe-area insets itself (Task 12 Step 4); Dock needs them.
  return <SafeAreaProvider>{isFrameworkCatalog ? <CatalogFrameworkExample /> : <CatalogExample />}</SafeAreaProvider>;
}
