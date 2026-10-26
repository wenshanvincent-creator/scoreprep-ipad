import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  powerMonitor,
  protocol,
  session,
} from 'electron';
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { validateProject, type Project } from '../src/core/model';
import { LocalRecognizer } from './recognizer';
import { prepareMusic } from '../src/core/music';
import { instrumentFor } from '../src/core/instruments';
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'scoreprep',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);
// Test data isolation is available only in an unpackaged development build.
if (!app.isPackaged && process.env.SCOREPREP_TEST_DATA)
  app.setPath('userData', path.resolve(process.env.SCOREPREP_TEST_DATA));
let win: BrowserWindow;
let microphoneArmed = false;
let recognizer: LocalRecognizer;
const root = () => path.join(app.getPath('userData'), 'library');
const validID = (id: unknown): string => {
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new Error('项目编号无效。');
  return id;
};
const folder = (id: unknown) => path.join(root(), validID(id));
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
async function atomicJSON(file: string, value: unknown) {
  const temp = file + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2));
  await rename(temp, file);
}
async function load(id: unknown): Promise<Project> {
  return JSON.parse(await readFile(path.join(folder(id), 'project.json'), 'utf8'));
}
async function store(p: Project) {
  validateProject(p);
  p.updatedAt = new Date().toISOString();
  await atomicJSON(path.join(folder(p.id), 'project.json'), p);
  return p;
}
async function create(bytes: Buffer, filename: string, exercise = false, instrument = 'cello') {
  const ext = path.extname(filename).toLowerCase();
  const mediaType =
    ext === '.pdf'
      ? 'application/pdf'
      : ['.jpg', '.jpeg'].includes(ext)
        ? 'image/jpeg'
        : ext === '.png'
          ? 'image/png'
          : '';
  if (!mediaType) throw new Error('请选择 PDF、PNG 或 JPEG 原谱。');
  let pageCount = 1;
  if (mediaType === 'application/pdf') pageCount = (await PDFDocument.load(bytes)).getPageCount();
  else if (nativeImage.createFromBuffer(bytes).isEmpty()) throw new Error('图片无法读取。');
  if (pageCount < 1 || pageCount > 20) throw new Error('本版支持 1–20 页的原谱。');
  const id = randomUUID();
  const p: Project = {
    id,
    title: exercise ? '大提琴练习' : path.basename(filename, ext),
    sourceFilename: path.basename(filename),
    mediaType,
    pageCount,
    originalSHA256: sha(bytes),
    systems: [],
    sections: [],
    readingOrder: [],
    updatedAt: new Date().toISOString(),
  };
  p.instrument = instrumentFor(instrument).id;
  const imports = path.join(app.getPath('userData'), 'imports');
  await mkdir(imports, { recursive: true });
  const staging = path.join(imports, id);
  await mkdir(staging);
  await writeFile(path.join(staging, 'original'), bytes);
  validateProject(p);
  await atomicJSON(path.join(staging, 'project.json'), p);
  // Publish the complete project at once; library polling must never see a
  // directory before its source and metadata have both been written.
  await rename(staging, folder(id));
  return recognizer.enqueue(id);
}
function handle(name: string, fn: (...args: any[]) => unknown) {
  ipcMain.handle(name, (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      !event.senderFrame.url.startsWith(
        pathToFileURL(path.join(__dirname, 'renderer', 'index.html')).href,
      )
    )
      throw new Error('不受信任的调用。');
    return fn(...args);
  });
}
app.whenReady().then(async () => {
  await mkdir(root(), { recursive: true });
  const runtime = app.isPackaged
    ? path.join(process.resourcesPath, 'recognizer')
    : path.resolve(__dirname, '../.runtime/extracted/Audiveris');
  recognizer = new LocalRecognizer(runtime, root(), load, store, (p, xml) => {
    prepareMusic(xml, p.instrument ?? 'cello', false);
  });
  protocol.handle('scoreprep', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'source' || request.method !== 'GET')
        return new Response(null, { status: 404 });
      const p = await load(url.pathname.slice(1));
      return new Response(await readFile(path.join(folder(p.id), 'original')), {
        headers: {
          'Content-Type': p.mediaType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) =>
    callback(
      wc === win?.webContents &&
        wc.mainFrame.url.startsWith('file:') &&
        win.isVisible() &&
        microphoneArmed &&
        permission === 'media' &&
        'mediaTypes' in details &&
        !!details.mediaTypes?.length &&
        details.mediaTypes.every((type) => type === 'audio'),
    ),
  );
  session.defaultSession.setPermissionCheckHandler(
    (wc, permission, _origin, details) =>
      wc === win?.webContents &&
      microphoneArmed &&
      permission === 'media' &&
      details.mediaType === 'audio',
  );
  win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 760,
    minHeight: 600,
    show: false,
    backgroundColor: '#F2F4F6',
    title: 'ScorePrep',
    icon: path.join(__dirname, 'renderer', 'app-icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  const interruptAudio = () => {
    microphoneArmed = false;
    win.webContents.send('audio:interrupted');
  };
  win.on('hide', interruptAudio);
  win.on('minimize', interruptAudio);
  powerMonitor.on('suspend', interruptAudio);
  handle('microphone:arm', (armed: boolean) => {
    microphoneArmed = armed === true && win.isVisible() && !win.isMinimized();
  });
  handle('library:list', async () => {
    const dirs = await readdir(root(), { withFileTypes: true });
    const projects = await Promise.all(
      dirs.filter((d) => d.isDirectory()).map((d) => load(d.name)),
    );
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });
  handle('library:import', async (instrument: string) => {
    const choice = await dialog.showOpenDialog(win, {
      title: '导入原谱',
      properties: ['openFile'],
      filters: [{ name: '乐谱 PDF / 图片', extensions: ['pdf', 'png', 'jpg', 'jpeg'] }],
    });
    if (choice.canceled) return null;
    const file = choice.filePaths[0];
    return create(await readFile(file), path.basename(file), false, instrument);
  });
  handle('library:exercise', async () =>
    create(
      await readFile(path.join(__dirname, 'renderer', 'exercise.png')),
      'cello-study.png',
      true,
      'cello',
    ),
  );
  handle('library:save', async (incoming: Project) => {
    const current = await load(incoming.id);
    return store({ ...current, instrument: instrumentFor(incoming.instrument ?? 'cello').id });
  });
  handle('library:recognize', (id: string) => recognizer.enqueue(validID(id)));
  for (const entry of await readdir(root(), { withFileTypes: true }))
    if (entry.isDirectory()) {
      const p = await load(entry.name);
      if (p.localRecognition?.state === 'queued' || p.localRecognition?.state === 'running') {
        p.localRecognition = { state: 'queued', phase: '等待识别' };
        await store(p);
        await recognizer.enqueue(p.id);
      }
    }
  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.show();
});
app.on('before-quit', () => recognizer?.close());
app.on('window-all-closed', () => app.quit());
