import { glob } from 'glob';
import { build } from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const external = Object.keys(pkg.dependencies ?? {}).filter((dep) => !dep.startsWith('@fm/'));

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

await build({
  entryPoints: [...pluginFiles, ...moduleFiles],
  bundle: false, // keep each file separate
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  outbase: 'src',
});
