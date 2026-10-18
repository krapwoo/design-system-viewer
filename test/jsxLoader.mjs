// Node's --experimental-strip-types removes type annotations but does not transform JSX, so a
// `.tsx` component cannot be imported at all (ERR_UNKNOWN_FILE_EXTENSION). These hooks do three
// things the catalog's own files need: transform TSX through esbuild, resolve the extensionless
// relative imports every file here uses (`./tokens`, `./SectionBlock`), and alias `react-native`
// to `react-native-web` — the same substitution the catalog already runs through in a browser,
// so a test renders the component the consumer actually sees.
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { transform } from 'esbuild';

const EXTENSIONS = ['.tsx', '.ts'];

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') return nextResolve('react-native-web', context);

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
