import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Project } from '../../src/core/model';
let app: ElectronApplication;
test.afterEach(async () => {
  await app?.close();
});
test('saved owned score follows real capture PCM, waits through silence and resets on a bar click', async ({}, info) => {
  const data = await mkdtemp(path.join(tmpdir(), 'scoreprep-follow-')),
    id = randomUUID(),
    folder = path.join(data, 'library', id),
    wave = path.join(data, 'performance.wav');
  await mkdir(folder, { recursive: true });
  const original = await readFile('../Fixtures/Practice/pickup-and-pulse.png'),
    musicXML = await readFile('../Fixtures/Practice/pickup-and-pulse.musicxml', 'utf8'),
    hash = createHash('sha256').update(original).digest('hex');
  const p: Project = {
    id,
    title: '跟谱音频验证',
    sourceFilename: 'owned-pickup.png',
    pageCount: 1,
    mediaType: 'image/png',
    originalSHA256: hash,
    systems: [],
    sections: [],
    readingOrder: [],
    updatedAt: new Date().toISOString(),
    instrument: 'piano',
    localRecognition: { state: 'ready', phase: '' },
    localEdition: {
      musicXML,
      engine: 'owned source fixture',
      engineVersion: '1',
      originalSHA256: hash,
      recognizedAt: new Date().toISOString(),
    },
  };
  await writeFile(path.join(folder, 'original'), original);
  await writeFile(path.join(folder, 'project.json'), JSON.stringify(p));
  const rate = 48000,
    seconds = 20,
    wav = Buffer.alloc(44 + rate * seconds * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < rate * seconds; i++) {
    const time = i / rate,
      pitches = time < 3 ? [55, 67] : time < 6 ? [] : [60, 72];
    const sample = pitches.reduce((sum, midi) => {
      const phase = 2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * time;
      return sum + 0.12 * Math.sin(phase) + 0.06 * Math.sin(2 * phase);
    }, 0);
    wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  await writeFile(wave, wav);
  app = await electron.launch({
    args: [
      path.resolve('.'),
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${wave}`,
    ],
    env: { ...process.env, SCOREPREP_TEST_DATA: data },
  });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: /跟谱音频验证/ }).click();
  await expect(page.locator('.notation-page svg').first()).toBeVisible();
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as any).tracks = [];
    navigator.mediaDevices.getUserMedia = async (c) => {
      const stream = await original(c);
      (window as any).tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '跳过调音' }).click();
  await expect(page.getByRole('button', { name: '停止跟谱' })).toBeVisible();
  await expect(page.locator('.following-status')).toContainText('正在跟谱');
  await expect(page.locator('.following-status')).toContainText('第 0 小节');
  await expect(page.locator('.following-status')).toContainText('等待演奏', { timeout: 6000 });
  await expect(page.locator('.following-status')).toContainText('第 0 小节');
  await expect(page.locator('.following-status')).toContainText('第 1 小节', { timeout: 8000 });
  await page.screenshot({ path: info.outputPath('05-live-following.png') });
  await page.locator('[id="measure-0"]').click();
  await expect(page.locator('.following-status')).toContainText('第 0 小节');
  await page.getByRole('button', { name: '停止跟谱' }).click();
  expect(
    await page.evaluate(() =>
      (window as any).tracks.every((t: MediaStreamTrack) => t.readyState === 'ended'),
    ),
  ).toBe(true);
});
