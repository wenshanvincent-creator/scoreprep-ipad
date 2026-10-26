import { build as bundle } from 'esbuild';
import { build } from 'vite';
import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const output = path.resolve('dist'),
  expected = fileURLToPath(new URL('../dist', import.meta.url));
if (output !== expected) throw new Error('Build must run from windows/');
await rm(output, { recursive: true, force: true });
await mkdir('public', { recursive: true });
await copyFile('../Fixtures/Practice/pickup-and-pulse.png', 'public/exercise.png');
await copyFile('../ScoreApp/Assets.xcassets/AppIcon.appiconset/AppIcon.png', 'public/app-icon.png');
await bundle({
  entryPoints: ['electron/main.ts'],
  outfile: 'dist/main.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
await copyFile('electron/preload.cjs', 'dist/preload.cjs');
await build();
await mkdir('dist/notices', { recursive: true });
await copyFile('../backend/notices/verovio-LGPL-3.txt', 'dist/notices/verovio-LGPL-3.txt');
await copyFile('../backend/notices/verovio-GPL-3.txt', 'dist/notices/verovio-GPL-3.txt');
await copyFile('../LICENSE', 'dist/notices/ScorePrep-MIT.txt');
await copyFile('THIRD_PARTY.md', 'dist/notices/THIRD_PARTY.md');
for (const name of [
  'react',
  'react-dom',
  'pdf-lib',
  'pitchy',
  'fflate',
  'fft.js',
  '@xmldom/xmldom',
]) {
  await mkdir(`dist/notices/${name}`, { recursive: true });
  const { readdir } = await import('node:fs/promises');
  for (const file of await readdir(`node_modules/${name}`))
    if (/^(license|copying|notice)/i.test(file))
      await cp(`node_modules/${name}/${file}`, `dist/notices/${name}/${file}`, { recursive: true });
}

await cp('notices', 'dist/notices', { recursive: true });
