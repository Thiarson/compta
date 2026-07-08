import { glob } from 'glob';
import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const external = Object.keys(pkg.dependencies ?? {}).filter((dep) => !dep.startsWith('@compta/'));

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  external,
});

const pluginFiles = await glob('src/plugins/**/*.ts');
const moduleFiles = await glob('src/modules/**/*.ts');
const utilFiles = await glob('src/utils/**/*.ts');
const constantFiles = await glob('src/constants/**/*.ts');

const srcRoot = resolve('src');
const externalizeRelativeImports = {
  name: 'externalize-relative-imports',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^\.\.?\// }, (args) => {
      if (args.kind === 'entry-point') return undefined;
      if (!resolve(args.resolveDir, args.path).startsWith(srcRoot)) return undefined;
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: [...pluginFiles, ...moduleFiles, ...utilFiles, ...constantFiles],
  bundle: true,
  external,
  plugins: [externalizeRelativeImports],
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  outbase: 'src',
});
