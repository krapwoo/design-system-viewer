// cli/kitRoot.ts
import path from 'node:path';
import { globBaseFolder } from './glob.ts';

/** Design decision 6 (brief): `starterKit.root` when the config sets it (every config `init --new`
 *  writes from 0.4 on); otherwise inferred from the first `components` glob's base folder's own
 *  parent — `globBaseFolder('src/ds/components/*\/index.ts')` is `'src/ds/components'`, and the kit
 *  root is always that folder's parent, since the starter kit's own fixed internal layout (design
 *  §1) is `<kit root>/components`, `<kit root>/tokens`, `<kit root>/icons`. Returns `undefined` for
 *  a project with no `starterKit` at all — an existing (non-kit) project has no kit root to find,
 *  and `kit diff`/`update`'s kit-diff count both treat that as "0 kit files, nothing to compare." */
export function resolveKitRoot(config: { starterKit?: { version: string; root?: string }; components: string[] }): string | undefined {
  if (!config.starterKit) return undefined;
  if (config.starterKit.root) return config.starterKit.root;
  if (config.components.length === 0) return undefined;
  const base = globBaseFolder(config.components[0]);
  return path.dirname(base).split(path.sep).join('/');
}
