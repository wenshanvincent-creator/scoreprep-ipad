import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { atomicJSON } from '../electron/atomic-json';

test(
  'a real transient Windows file lock does not abort an atomic project update',
  { skip: process.platform !== 'win32' },
  async () => {
    const folder = await mkdtemp(path.join(tmpdir(), 'scoreprep-file-lock-')),
      file = path.join(folder, 'project.json');
    await writeFile(file, '{"state":"queued"}');
    const lock = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '$stream=[IO.File]::Open($env:SCOREPREP_LOCK_FILE,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read); try { [Console]::WriteLine("locked"); Start-Sleep -Milliseconds 180 } finally { $stream.Dispose() }',
      ],
      { windowsHide: true, env: { ...process.env, SCOREPREP_LOCK_FILE: file } },
    );
    const closed = new Promise<void>((resolve, reject) => {
      lock.once('error', reject);
      lock.once('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`Lock helper exited ${code}`)),
      );
    });
    await new Promise<void>((resolve, reject) => {
      lock.stdout.once('data', (chunk) =>
        String(chunk).includes('locked') ? resolve() : reject(new Error(String(chunk))),
      );
      lock.once('error', reject);
      lock.once('close', () => reject(new Error('Lock helper closed before acquiring the file')));
    });
    await atomicJSON(file, { state: 'running' });
    await closed;
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { state: 'running' });
  },
);
