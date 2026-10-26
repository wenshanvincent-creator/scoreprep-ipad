import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
const appPath = path.resolve('.');
let app: ElectronApplication;
test.afterEach(async () => {
  await app?.close();
});
test('synthetic cello C2 passes the desktop capture path; reference, hide and exit release input', async ({}, testInfo) => {
  const data = await mkdtemp(path.join(tmpdir(), 'scoreprep-mic-')),
    wave = path.join(data, 'cello-C2.wav'),
    rate = 48000,
    seconds = 3;
  const wav = Buffer.alloc(44 + rate * seconds * 2);
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
  const hz = 440 * 2 ** ((36 - 69) / 12) * 2 ** (-15 / 1200);
  for (let i = 0; i < rate * seconds; i++)
    wav.writeInt16LE(
      Math.round(
        32767 *
          (0.11 * Math.sin((2 * Math.PI * hz * i) / rate) +
            0.28 * Math.sin((4 * Math.PI * hz * i) / rate) +
            0.13 * Math.sin((6 * Math.PI * hz * i) / rate)),
      ),
      44 + i * 2,
    );
  await writeFile(wave, wav);
  app = await electron.launch({
    args: [
      appPath,
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${wave}`,
    ],
    env: { ...process.env, SCOREPREP_TEST_DATA: data },
  });
  const page = await app.firstWindow();
  await expect(page.getByRole('button', { name: '调音器' })).toBeVisible();
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as any).capturedTracks = [];
    navigator.mediaDevices.getUserMedia = async (c) => {
      const stream = await original(c);
      (window as any).capturedTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.evaluate(()=>{(window as any).interruptions=[];document.addEventListener('visibilitychange',()=>{(window as any).interruptions.push({type:'visibility',hidden:document.hidden,time:Date.now()});});window.desktop.onAudioInterrupted(()=>{(window as any).interruptions.push({type:'main',time:Date.now()});});});
  await page.getByRole('button', { name: '调音器' }).click();
  expect(await page.evaluate(() => (window as any).capturedTracks.length)).toBe(0);
  await page.getByRole('button', { name: /^C2/ }).click();
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止监听' })).toBeVisible().catch(async e=>{console.log(await page.evaluate(()=>({interruptions:(window as any).interruptions,visibility:document.visibilityState,tracks:(window as any).capturedTracks.map((t:MediaStreamTrack)=>t.readyState)})));throw e;});
  await expect(page.locator('.note')).toHaveText('C2');
  await expect(page.locator('.tuning-status')).toHaveText(/偏低 1[45] 音分/);
  await page.screenshot({ path: testInfo.outputPath('05-cello-low-C-input.png'), fullPage: true });
  await page.getByRole('button', { name: '参考音 C2' }).click();
  expect(
    await page.evaluate(() =>
      (window as any).capturedTracks.every((t: MediaStreamTrack) => t.readyState === 'ended'),
    ),
  ).toBe(true);
  await expect(page.getByRole('button', { name: '停止参考音' })).toBeVisible();
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止监听' })).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).capturedTracks.every((t: MediaStreamTrack) => t.readyState === 'ended'),
      ),
    )
    .toBe(true);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore());
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止监听' })).toBeVisible();
  await page.getByRole('button', { name: '关闭调音器' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).capturedTracks.every((t: MediaStreamTrack) => t.readyState === 'ended'),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: '调音器' }).click();
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止监听' })).toBeVisible();
  await page.evaluate(() =>
    (window as any).capturedTracks.at(-1).dispatchEvent(new Event('ended')),
  );
  await expect(page.getByRole('alert')).toContainText('麦克风已断开');
  await page.getByRole('button', { name: '关闭调音器' }).click();
  await page.getByRole('button', { name: '调音器' }).click();
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as any).originalCapture = original;
    navigator.mediaDevices.getUserMedia = async (c) => {
      const stream = await original(c);
      await new Promise<void>((resolve) => {
        (window as any).finishPendingCapture = resolve;
      });
      return stream;
    };
  });
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).finishPendingCapture))
    .toBe('function');
  await page.getByRole('button', { name: '关闭调音器' }).click();
  await page.evaluate(() => {
    (window as any).finishPendingCapture();
    navigator.mediaDevices.getUserMedia = (window as any).originalCapture;
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).capturedTracks.every((t: MediaStreamTrack) => t.readyState === 'ended'),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: '调音器', exact:true }).click();
  await app.evaluate(({ session }) => {
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
  });
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('麦克风未获授权');
});
