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
test('real Windows window: source, preparation, cello tuner, transport and saved restart', async ({}, testInfo) => {
  const data = await mkdtemp(path.join(tmpdir(), 'scoreprep-desktop-'));
  app = await electron.launch({
    args: [appPath],
    env: { ...process.env, SCOREPREP_TEST_DATA: data },
  });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByRole('heading', { name: '让注意力留在乐谱上' })).toBeVisible();
  await page.getByRole('button', { name: '打开示例练习 →' }).click();
  await expect(page.locator('canvas')).toHaveJSProperty('width', 2100);
  await page.screenshot({ path: testInfo.outputPath('01-reader.png'), fullPage: true });
  const p = (await page.evaluate(() => window.desktop.list()))[0];
  const bytes = await readFile(path.join(data, 'library', p.id, 'original'));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(p.originalSHA256);
  await page.getByRole('button', { name: '准备练习', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存设置', exact: true })).toBeVisible();
  await page.getByLabel('乐谱名称').fill('大提琴 Windows 验证');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '← 原谱', exact: true }).click();
  await page.getByRole('button', { name: '开始练习 →' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('乐器', { exact: true })).toHaveValue('cello');
  await expect(page.getByRole('button', { name: /^C2/ })).toBeVisible();
  // The tuner remains idle until the explicit listening action.
  expect(await page.evaluate(() => document.querySelector('.pitch-hz')?.textContent)).toBe(
    '点击开始监听',
  );
  await page.screenshot({ path: testInfo.outputPath('02-cello-tuner.png'), fullPage: true });
  await page.getByRole('button', { name: '跳过调音' }).click();
  await expect(page.getByText('预备拍 ·', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Ⅱ 暂停' }).click();
  const paused = await page.locator('.beat-strip').innerText();
  await page.waitForTimeout(250);
  expect(await page.locator('.beat-strip').innerText()).toBe(paused);
  await page.getByLabel('速度', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: '▶ 继续' }).click();
  await expect(page.getByText('正在练习', { exact: true })).toBeVisible({ timeout: 6000 });
  await page.screenshot({ path: testInfo.outputPath('03-practice.png'), fullPage: true });
  await page.getByRole('button', { name: 'Ⅱ 暂停' }).click();
  await page.getByLabel('跳至', { exact: true }).selectOption('2');
  await expect(page.locator('.current-line')).toContainText('第 3–4 小节');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(800, 900));
  await page.screenshot({ path: testInfo.outputPath('04-narrow-practice.png'), fullPage: true });
  expect(errors).toEqual([]);
  await app.close();
  app = await electron.launch({
    args: [appPath],
    env: { ...process.env, SCOREPREP_TEST_DATA: data },
  });
  const reopened = await app.firstWindow();
  await reopened.getByRole('button', { name: /大提琴 Windows 验证/ }).click();
  await expect(reopened.getByRole('heading', { name: '大提琴 Windows 验证' })).toBeVisible();
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
  await expect(page.getByRole('button', { name: '♮ 调音器' })).toBeVisible();
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as any).capturedTracks = [];
    navigator.mediaDevices.getUserMedia = async (c) => {
      const stream = await original(c);
      (window as any).capturedTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.getByRole('button', { name: '♮ 调音器' }).click();
  expect(await page.evaluate(() => (window as any).capturedTracks.length)).toBe(0);
  await page.getByRole('button', { name: /^C2/ }).click();
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止监听' })).toBeVisible();
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
  await page.getByRole('button', { name: '♮ 调音器' }).click();
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止监听' })).toBeVisible();
  await page.evaluate(() =>
    (window as any).capturedTracks.at(-1).dispatchEvent(new Event('ended')),
  );
  await expect(page.getByRole('alert')).toContainText('麦克风已断开');
  await page.getByRole('button', { name: '关闭调音器' }).click();
  await page.getByRole('button', { name: '♮ 调音器' }).click();
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
  await page.getByRole('button', { name: '打开示例练习 →' }).click();
  await page.getByRole('button', { name: '开始练习 →' }).click();
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止监听' })).toBeVisible();
  await page.getByRole('button', { name: '调好，开始练习 →' }).click();
  await expect(page.getByRole('button', { name: 'Ⅱ 暂停' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).capturedTracks.every((t: MediaStreamTrack) => t.readyState === 'ended'),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: '← 原谱' }).click();
  await page.getByRole('button', { name: '♮ 调音器' }).click();
  await app.evaluate(({ session }) => {
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
  });
  await page.getByRole('button', { name: '开始监听', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('麦克风未获授权');
});
