import { test, expect, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { prepareMusic } from '../../src/core/music';
import { launchDesktop } from './launch';
let app: ElectronApplication;
test.afterEach(async () => {
  await app?.close();
});

test('automatic source-mark reconciliation preserves real trills and original fingerings', async ({}, info) => {
  test.setTimeout(180000);
  const data = await mkdtemp(path.join(tmpdir(), 'scoreprep-marks-'));
  app = await launchDesktop(data);
  const source = path.resolve('tests/fixtures/trill-fingering-study.png');
  await app.evaluate(({ dialog }, source) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
  }, source);
  const page = await app.firstWindow();
  await page.route('https://**', (route) => route.abort());
  await page.route('http://**', (route) => route.abort());
  await page.getByRole('button', { name: '＋ 导入乐谱' }).click();
  await expect(page.locator('.notation-page svg').first()).toBeVisible({ timeout: 150000 });
  const project = (await page.evaluate(() => window.desktop.list()))[0];
  expect(project.localRecognition?.state, project.localRecognition?.error).toBe('ready');
  const actual = prepareMusic(project.localEdition!.musicXML, 'cello', false),
    expected = prepareMusic(
      await readFile('tests/fixtures/trill-fingering-study.musicxml', 'utf8'),
      'cello',
      false,
    );
  expect(actual.notes.map((n) => [n.midi, n.quarter, n.duration, n.sourceFingering])).toEqual(
    expected.notes.map((n) => [n.midi, n.quarter, n.duration, n.sourceFingering]),
  );
  const doc = new DOMParser().parseFromString(project.localEdition!.musicXML, 'application/xml');
  expect(doc.getElementsByTagName('trill-mark').length).toBe(2);
  await expect(page.locator('.notation-page .trill')).toHaveCount(2);
  await page.screenshot({
    path: info.outputPath('source-trills-and-fingerings.png'),
    fullPage: true,
  });
});
