import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PDFDocument, StandardFonts } from 'pdf-lib';
let app: ElectronApplication;
test.afterEach(async () => {
  await app?.close();
});
test('PDF bytes survive import; page-two drag crop and confirmed timing persist', async ({}, testInfo) => {
  const data = await mkdtemp(path.join(tmpdir(), 'scoreprep-pdf-')),
    file = path.join(data, 'owned-two-page.pdf');
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= 2; n++) {
    const p = pdf.addPage([300, 400]);
    p.drawText(`Owned score page ${n}`, { x: 20, y: 350, size: 18, font });
    for (let y = 150; y < 300; y += 35)
      for (let line = 0; line < 5; line++)
        p.drawLine({
          start: { x: 20, y: y + line * 4 },
          end: { x: 280, y: y + line * 4 },
          thickness: 0.5,
        });
  }
  const original = await pdf.save();
  await writeFile(file, original);
  app = await electron.launch({
    args: [path.resolve('.')],
    env: { ...process.env, SCOREPREP_TEST_DATA: data },
  });
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, file);
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: '＋ 导入原谱' }).click();
  await expect(page.locator('canvas')).toHaveJSProperty('height', 800);
  await expect(page.getByText('第 1 / 2 页')).toBeVisible();
  const p = (await page.evaluate(() => window.desktop.list()))[0];
  expect(
    createHash('sha256')
      .update(await readFile(path.join(data, 'library', p.id, 'original')))
      .digest('hex'),
  ).toBe(createHash('sha256').update(original).digest('hex'));
  await page.getByRole('button', { name: '准备练习', exact: true }).click();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('aria-label', '原谱第 2 页');
  await expect(page.getByText('正在读取原谱…')).toHaveCount(0);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.04, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.96, box.y + box.height * 0.6, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByLabel('四分音符总数')).toBeVisible();
  await page.getByLabel('四分音符总数').fill('8');
  await expect(page.getByRole('button', { name: '保存设置', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '确认时值', exact: true }).click();
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  const saved = (await page.evaluate(() => window.desktop.list()))[0];
  expect(saved.systems).toHaveLength(1);
  expect(saved.systems[0].pageIndex).toBe(1);
  expect(saved.systems[0].bounds.x).toBeCloseTo(0.04, 2);
  expect(saved.systems[0].bounds.y).toBeCloseTo(0.2, 2);
  expect(saved.systems[0].bounds.height).toBeCloseTo(0.4, 2);
  expect(saved.systems[0].timing?.[0].quarterBeats).toBe(8);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('06-pdf-prepare.png'), fullPage: true });
});
test('authenticated worker contract: encrypted credentials, visible error, resume, actual homr engraving and review', async ({}, testInfo) => {
  const data = await mkdtemp(path.join(tmpdir(), 'scoreprep-recognition-')),
    source = path.resolve('../Fixtures/RecognitionReplay/original.png'),
    original = await readFile(source),
    xml = await readFile('../backend/fixtures/observed-homr/homr-observed.musicxml', 'utf8'),
    hash = createHash('sha256').update(original).digest('hex'),
    token = 'contract-test-' + randomUUID(),
    id = randomUUID();
  let acceptedBody: any,
    queries = 0;
  const server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401).end('missing token');
      return;
    }
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      acceptedBody = JSON.parse(Buffer.concat(chunks).toString());
    } else if (++queries === 1) {
      res.writeHead(503).end('Contract: service temporarily unavailable');
      return;
    }
    const done = req.method !== 'POST';
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        schemaVersion: 1,
        id,
        state: done ? 'succeeded' : 'queued',
        completedPages: done ? 1 : 0,
        engineName: 'Contract replay (no inference)',
        engineRevision: 'fixture',
        originalSHA256: hash,
        pages: [
          {
            sourcePageIndex: 0,
            state: done ? 'succeeded' : 'queued',
            ...(done
              ? { musicXML: xml, musicXMLSHA256: createHash('sha256').update(xml).digest('hex') }
              : {}),
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    app = await electron.launch({
      args: [path.resolve('.')],
      env: { ...process.env, SCOREPREP_TEST_DATA: data },
    });
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, source);
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '＋ 导入原谱' }).click();
    await expect(page.getByRole('button', { name: '云端识别', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    const address = server.address() as { port: number };
    await page.getByLabel('服务地址').fill(`http://127.0.0.1:${address.port}`);
    await page.getByLabel('访问凭据').fill(token);
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('已保存');
    expect(await readFile(path.join(data, 'worker.json'), 'utf8')).not.toContain(token);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '云端识别', exact: true }).click();
    await page.getByRole('button', { name: '上传原谱并识别' }).click();
    await expect(page.getByRole('alert')).toContainText('503');
    await expect(page.getByRole('button', { name: '继续查询' })).toBeVisible();
    expect(Buffer.from(acceptedBody.contentBase64, 'base64')).toEqual(original);
    expect(acceptedBody.mediaType).toBe('image/png');
    await page.getByRole('button', { name: '继续查询' }).click();
    await expect(page.locator('.engraved-page svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.getByLabel('已对照原谱核对本页音符、节奏和声部')).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath('07-original-and-homr.png'),
      fullPage: true,
    });
    await page.getByLabel('已对照原谱核对本页音符、节奏和声部').check();
    await page.getByRole('button', { name: '保存核对后的识别谱（1/1）' }).click();
    await expect(page.getByRole('button', { name: '已核对识别谱' })).toBeVisible();
    const p = (await page.evaluate(() => window.desktop.list()))[0];
    expect(p.recognizedEdition?.id).toBe(id);
    expect(p.pendingRecognition).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain(token);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
