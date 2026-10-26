import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
const version = '5.11.0';
const digest = '5f1b4e96a12c53c7da426814b76e599363c4181e291855996e0a6878dda95f71';
const url = `https://github.com/Audiveris/audiveris/releases/download/${version}/Audiveris-${version}-windowsConsole-x86_64.msi`;
const root = fileURLToPath(new URL('../.runtime', import.meta.url)),
  archive = path.join(root, 'Audiveris.msi'),
  target = path.join(root, 'extracted');
await mkdir(root, { recursive: true });
const run = (file, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${path.basename(file)} exited ${code}`)),
    );
  });
try {
  await access(archive);
} catch {
  await run('curl.exe', ['-L', '--fail', '--show-error', '-o', archive, url]);
}
if (
  createHash('sha256')
    .update(await readFile(archive))
    .digest('hex') !== digest
)
  throw new Error(
    'Audiveris MSI checksum mismatch. Remove the incomplete .runtime/Audiveris.msi and run this command again.',
  );
try {
  await access(path.join(target, 'Audiveris', 'Audiveris.exe'));
} catch {
  await run('msiexec.exe', ['/a', archive, '/qn', `TARGETDIR=${target}`]);
}
const config = path.join(target, 'Audiveris', 'app', 'Audiveris.cfg');
let text = await readFile(config, 'utf8');
text = text.replace('-Xmx8G', '-Xmx3G');
if (!text.includes('ActiveProcessorCount')) text += '\njava-options=-XX:ActiveProcessorCount=2\n';
await writeFile(config, text);
await writeFile(
  path.join(root, 'runtime-receipt.json'),
  JSON.stringify(
    {
      engine: 'Audiveris',
      version,
      url,
      sha256: digest,
      configurationChanges: ['maximum Java heap 3 GiB', 'two active processors'],
      source: `https://github.com/Audiveris/audiveris/tree/${version}`,
    },
    null,
    2,
  ),
);
console.log(`Audiveris ${version} CPU runtime ready.`);

const englishURL = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata/4.1.0/eng.traineddata';
const english = path.join(root, 'eng-complete.traineddata');
try {
  await access(english);
} catch {
  await run('curl.exe', ['-L', '--fail', '--show-error', '-o', english, englishURL]);
}
if (
  createHash('sha256')
    .update(await readFile(english))
    .digest('hex') !== 'daa0c97d651c19fba3b25e81317cd697e9908c8208090c94c3905381c23fc047'
)
  throw new Error('English OCR checksum mismatch');
await writeFile(path.join(target, 'Audiveris', 'eng.traineddata'), await readFile(english));
const source = path.join(root, 'Audiveris-5.11.0-source.zip');
try {
  await access(source);
} catch {
  await run('curl.exe', [
    '-L',
    '--fail',
    '--show-error',
    '-o',
    source,
    'https://github.com/Audiveris/audiveris/archive/refs/tags/5.11.0.zip',
  ]);
}
if (
  createHash('sha256')
    .update(await readFile(source))
    .digest('hex') !== '5f63cd1bdc7f48a9afadfa616ab9f2d4c923b7d7dbff46712e2b3ef65e896616'
)
  throw new Error('Audiveris source checksum mismatch');
const engine = path.join(target, 'Audiveris'),
  { readdir, copyFile } = await import('node:fs/promises');
const inventory = [];
for (const name of await readdir(path.join(engine, 'app')))
  if (name.endsWith('.jar')) {
    const bytes = await readFile(path.join(engine, 'app', name));
    inventory.push({
      file: `app/${name}`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    const entries = unzipSync(bytes);
    for (const [entry, content] of Object.entries(entries))
      if (/\/(license|notice|copying)/i.test(entry) && !entry.endsWith('/')) {
        const destination = path.join(engine, 'notices', name, entry);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, content);
      }
  }
await mkdir(path.join(engine, 'sources'), { recursive: true });
await copyFile(source, path.join(engine, 'sources', 'Audiveris-5.11.0-source.zip'));
await writeFile(
  path.join(engine, 'sources', 'runtime-inventory.json'),
  JSON.stringify(
    {
      engine: 'Audiveris 5.11.0',
      source: 'Audiveris-5.11.0-source.zip',
      sourceSHA256: '5f63cd1bdc7f48a9afadfa616ab9f2d4c923b7d7dbff46712e2b3ef65e896616',
      englishOCR: {
        url: englishURL,
        sha256: 'daa0c97d651c19fba3b25e81317cd697e9908c8208090c94c3905381c23fc047',
      },
      java: 'Azul Zulu25.34+17 CRaC CA, OpenJDK 25.0.3+9 LTS; upstream bundled runtime, legal notices in runtime/legal',
      jars: inventory,
    },
    null,
    2,
  ),
);
await import('./sync-neural-runtime.mjs');
