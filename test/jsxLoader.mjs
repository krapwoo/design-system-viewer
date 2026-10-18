// Node's --experimental-strip-types removes type annotations but does not transform JSX, so a
// `.tsx` component cannot be imported at all (ERR_UNKNOWN_FILE_EXTENSION). These hooks do three
// things the catalog's own files need: transform TSX through esbuild, resolve the extensionless
// relative imports every file here uses (`./tokens`, `./SectionBlock`), and alias `react-native`
// to `react-native-web` — the same substitution the catalog already runs through in a browser,
// so a test renders the component the consumer actually sees.
//
// React/React DOM/react-native-web are deliberately NOT a root devDependency. `kit-host` and
// `viewer-host` resolve those packages upward into the repo root when the root has them, so if
// the harness installed its own copies, the catalog loaded two different Reacts (root 19.3.1 vs.
// kit-host 19.2.3) and silently rendered nothing (`npm run check:catalog` -> render-failed, no
// sidebar links) even though this harness's own tests passed. The fix is to resolve these
// specifiers straight from `kit-host/node_modules`, the same tree the catalog actually runs
// against, rather than installing a rival copy at the root.
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';

const EXTENSIONS = ['.tsx', '.ts'];

const hostNodeModulesURL = new URL('../kit-host/node_modules/', import.meta.url);
const hostRequire = createRequire(fileURLToPath(hostNodeModulesURL));

const HOST_SPECIFIERS = {
  react: 'react',
  'react/jsx-runtime': 'react/jsx-runtime',
  'react-dom': 'react-dom',
  'react-dom/client': 'react-dom/client',
  'react-native': 'react-native-web',
};

function resolveFromHost(specifier) {
  const hostSpecifier = HOST_SPECIFIERS[specifier];
  try {
    return hostRequire.resolve(hostSpecifier);
  } catch (error) {
    throw new Error(
      `kit-host/node_modules is required by the render harness; run npm ci --prefix kit-host (failed to resolve "${hostSpecifier}": ${error.message})`,
    );
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(HOST_SPECIFIERS, specifier)) {
    return { url: pathToFileURL(resolveFromHost(specifier)).href, shortCircuit: true };
  }

  if (specifier.startsWith('.') && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    const basePath = fileURLToPath(base);
    if (!existsSync(basePath)) {
      for (const ext of EXTENSIONS) {
        if (existsSync(basePath + ext)) {
          return { url: pathToFileURL(basePath + ext).href, format: 'module', shortCircuit: true };
        }
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.tsx') || url.endsWith('.ts')) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    const { code } = await transform(source, {
      loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      jsx: 'automatic',
      target: 'node22',
      sourcefile: url,
    });
    return { format: 'module', source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
