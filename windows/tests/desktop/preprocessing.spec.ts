import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareMusic } from '../../src/core/music';
let app: ElectronApplication;
test.afterEach(async () => {
  await app?.close();
});

test('small but legible owned score automatically rescales after measured rejection; source survives', async ({}, info) => {
  test.setTimeout(240000);
  const data = await mkdtemp(path.join(tmpdir(), 'scoreprep-preprocess-')),
    file = path.join(data, 'small-cello.png');
  const executablePath = process.env.SCOREPREP_VERIFY_EXE;
  app = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: executablePath ? [`--user-data-dir=${data}`] : [path.resolve('.')],
    env: { ...process.env, SCOREPREP_TEST_DATA: data },
  });
  if (executablePath)
    expect(
      await app.evaluate(({ app }) => ({
        version: app.getVersion(),
        data: app.getPath('userData'),
        packaged: app.isPackaged,
      })),
    ).toEqual({ version: '0.3.1', data, packaged: true });
  const source = await readFile('tests/fixtures/cello-study.png');
  const base64 = await app.evaluate(
    ({ nativeImage }, bytes) =>
      nativeImage
        .createFromBuffer(Buffer.from(bytes, 'base64'))
        .resize({ width: 800, quality: 'best' })
        .toPNG()
        .toString('base64'),
    source.toString('base64'),
  );
  const original = Buffer.from(base64, 'base64');
  await writeFile(file, original);
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, file);
  const page = await app.firstWindow();
  await page.getByRole('button', { name: '＋ 导入乐谱' }).click();
  await expect
    .poll(
      async () => {
        const p = (await page.evaluate(() => window.desktop.list()))[0];
        const state = p?.localRecognition?.state;
        return state === 'ready' || state === 'failed' ? state : 'processing';
      },
      { timeout: 210000 },
    )
    .not.toBe('processing');
  const p = (await page.evaluate(() => window.desktop.list()))[0];
  expect(p.localRecognition?.state, p.localRecognition?.error).toBe('ready');
  const music = prepareMusic(p.localEdition!.musicXML, 'cello', false),
    expected = prepareMusic(
      await readFile('tests/fixtures/cello-study.musicxml', 'utf8'),
      'cello',
      false,
    );
  expect(music.notes.map((n) => [n.midi, n.quarter, n.duration])).toEqual(
    expected.notes.map((n) => [n.midi, n.quarter, n.duration]),
  );
  expect(
    Buffer.compare(await readFile(path.join(data, 'library', p.id, 'original')), original),
  ).toBe(0);
  const jobs = path.join(data, 'library', p.id, 'local-recognition'),
    attempts = await readdir(jobs);
  expect(attempts).toHaveLength(1);
  const recipe = JSON.parse(
    await readFile(path.join(jobs, attempts[0], 'preprocessing.json'), 'utf8'),
  );
  expect(recipe.measuredInterline).toBeLessThan(11);
  expect(recipe.scale).toBeGreaterThan(1);
  await expect(page.locator('.notation-page svg').first()).toBeVisible();
  await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.restore();win.show();win.focus();});
  await page.bringToFront();
  await page.screenshot({ path: info.outputPath('recovered-small-score.png') });
});
