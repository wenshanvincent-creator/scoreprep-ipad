import { readFile, writeFile, copyFile, access, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { unzipSync } from 'fflate';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../.runtime/neural', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const receiptFile = path.join(root, 'runtime-receipt.json');
let receipt;
try {
  receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
} catch {
  throw new Error(
    'Prepare the isolated neural runtime with recognition/package_runtime.py before packaging.',
  );
}
const workers = ['worker.py', 'engine.py', 'glyphs.py', 'requirements.txt'];
for (const entry of receipt.files)
  if (
    !workers.includes(entry.file) &&
    hash(await readFile(path.join(root, entry.file))) !== entry.sha256
  )
    throw new Error(`Neural runtime file changed: ${entry.file}`);
for (const name of workers) {
  const source = fileURLToPath(new URL(`../recognition/${name}`, import.meta.url)),
    bytes = await readFile(source),
    entry = receipt.files.find((f) => f.file === name);
  if (!entry) throw new Error(`Neural runtime inventory is incomplete: ${name}`);
  await copyFile(source, path.join(root, name));
  entry.sha256 = hash(bytes);
}
const archive = fileURLToPath(new URL('../.runtime/homr-ab369ac-source.zip', import.meta.url));
try {
  await access(archive);
} catch {
  await new Promise((resolve, reject) => {
    const child = spawn(
      'curl.exe',
      [
        '-L',
        '--fail',
        '--show-error',
        '-o',
        archive,
        'https://codeload.github.com/liebharc/homr/zip/ab369ac54277afab582afa4725441f7cbba76593',
      ],
      { windowsHide: true, stdio: 'inherit' },
    );
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Source download exited ${code}`)),
    );
  });
}
const source = await readFile(archive);
if (hash(source) !== '23c81d6783c995866c256dba403bfa374639aeb20df64b738a0fc0034d160315')
  throw new Error('homr source archive SHA-256 mismatch');
const entries = unzipSync(source);
const assets = {
  'sources/homr-ab369ac-source.zip': source,
  'notices/homr-AGPL-3.txt': entries[Object.keys(entries).find((n) => n.endsWith('/LICENSE'))],
  'notices/homr-LICENSE-FAQ.md':
    entries[Object.keys(entries).find((n) => n.endsWith('/LICENSE_FAQ.md'))],
};
for (const name of ['NOTICE.md', 'LICENSE.txt', 'README.md', 'package_runtime.py'])
  assets[`sources/recognition/${name}`] = await readFile(
    fileURLToPath(new URL(`../recognition/${name}`, import.meta.url)),
  );
for (const [file, bytes] of Object.entries(assets)) {
  if (!bytes) throw new Error(`Missing corresponding source notice: ${file}`);
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), bytes);
  const entry = receipt.files.find((f) => f.file === file);
  if (entry) entry.sha256 = hash(bytes);
  else receipt.files.push({ file, sha256: hash(bytes) });
}
await writeFile(receiptFile, JSON.stringify(receipt, null, 2));
console.log(`Portable Python ${receipt.python} neural runtime verified; worker code synchronized.`);
