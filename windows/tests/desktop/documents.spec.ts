import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
let app: ElectronApplication;
test.afterEach(async () => {
  await app?.close();
});
test('actual bundled CPU recognizer: image import opens playable reflow, tuning, demo and offline restart', async ({}, info) => {
  test.setTimeout(180000);
  const data = await mkdtemp(path.join(tmpdir(), 'scoreprep-local-'));
  app = await electron.launch({
    args: [path.resolve('.')],
    env: { ...process.env, SCOREPREP_TEST_DATA: data },
  });
  const source = path.resolve('../Fixtures/RecognitionReplay/original.png');
  await app.evaluate(({ dialog }, source) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
  }, source);
  const page = await app.firstWindow(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByLabel('导入乐器').selectOption('piano');
  await page.getByRole('button', { name: '＋ 导入乐谱' }).click();
  await expect(page.getByRole('status').filter({ hasText: /识别/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath('01-recognizing.png') });
  await expect(page.locator('.notation-page svg').first()).toBeVisible({ timeout: 120000 });
  await expect(page.getByLabel('谱面乐器')).toHaveValue('piano');
  await expect(page.locator('.notation-page .measure')).toHaveCount(8);
  await expect(page.getByRole('button', { name: '准备练习' })).toHaveCount(0);
  const p = (await page.evaluate(() => window.desktop.list()))[0];
  const original = await readFile(path.join(data, 'library', p.id, 'original'));
  expect(createHash('sha256').update(original).digest('hex')).toBe(p.originalSHA256);
  expect(p.localEdition?.engine).toBe('Audiveris');
  expect(p.localRecognition?.state).toBe('ready');
  await page.screenshot({ path: info.outputPath('02-reflow.png'), fullPage: true });
  await page.locator('[id="measure-4"]').click();
  await expect(page.locator('.following-status')).toContainText('第 5 小节');
  await page.getByRole('button', { name: '合成试听' }).click();
  await expect(page.getByRole('button', { name: '停止试听' })).toBeVisible();
  await page.getByRole('button', { name: '停止试听' }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '关闭调音器' }).click();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(800, 900));
  await expect(page.locator('.notation-page svg').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('03-narrow.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await app.close();
  app = await electron.launch({
    args: [path.resolve('.')],
    env: { ...process.env, SCOREPREP_TEST_DATA: data },
  });
  const reopened = await app.firstWindow();
  await reopened.route('https://**', (route) => route.abort());
  await reopened.route('http://**', (route) => route.abort());
  await reopened.getByRole('button', { name: /original/ }).click();
  await expect(reopened.locator('.notation-page svg').first()).toBeVisible();
  await expect(reopened.getByRole('button', { name: '合成试听' })).toBeEnabled();
});
test('two-page PDF auto-recognizes every page and preserves exact source bytes', async ({}, info) => {
  test.setTimeout(180000);
  const data = await mkdtemp(path.join(tmpdir(), 'scoreprep-local-pdf-')),
    file = path.join(data, 'two-page.pdf');
  const pdf = await PDFDocument.create(),
    image = await pdf.embedPng(await readFile('../Fixtures/RecognitionReplay/original.png'));
  for (let i = 0; i < 2; i++) {
    const page = pdf.addPage([image.width / 2, image.height / 2]);
    page.drawImage(image, { x: 0, y: 0, width: image.width / 2, height: image.height / 2 });
  }
  const bytes = await pdf.save();
  await writeFile(file, bytes);
  app = await electron.launch({
    args: [path.resolve('.')],
    env: { ...process.env, SCOREPREP_TEST_DATA: data },
  });
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, file);
  const page = await app.firstWindow();
  await page.getByLabel('导入乐器').selectOption('piano');
  await page.getByRole('button', { name: '＋ 导入乐谱' }).click();
  await expect(page.locator('.notation-page svg').first()).toBeVisible({ timeout: 150000 });
  await expect(page.locator('.notation-page .measure')).toHaveCount(16);
  const p = (await page.evaluate(() => window.desktop.list()))[0];
  expect(p.pageCount).toBe(2);
  expect(
    Buffer.compare(
      Buffer.from(bytes),
      await readFile(path.join(data, 'library', p.id, 'original')),
    ),
  ).toBe(0);
  await page.screenshot({ path: info.outputPath('04-pdf-digital-score.png'), fullPage: true });
});
