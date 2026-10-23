import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  powerMonitor,
  protocol,
  safeStorage,
  session,
} from 'electron';
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { validateProject, validateJob, type Project, type RecognitionJob } from '../src/core/model';
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
async function create(bytes: Buffer, filename: string, exercise = false) {
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
    title: exercise ? '弱起与复合拍练习' : path.basename(filename, ext),
    sourceFilename: path.basename(filename),
    mediaType,
    pageCount,
    originalSHA256: sha(bytes),
    systems: [],
    sections: [],
    readingOrder: [],
    updatedAt: new Date().toISOString(),
  };
  if (exercise) {
    for (const [i, [y, height, quarterBeats, phase]] of [
      [0.1, 0.25, 5, 3],
      [0.38, 0.26, 4, 0],
      [0.66, 0.27, 6, 0],
    ].entries()) {
      const areaID = randomUUID(),
        sectionID = randomUUID();
      p.systems.push({
        id: areaID,
        pageIndex: 0,
        bounds: { x: 0.02, y, width: 0.96, height },
        label: ['弱起与第 1 小节', '第 2 小节', '第 3–4 小节 · 6/8'][i],
        timing: [
          {
            quarterBeats,
            meter: { numerator: i === 2 ? 6 : 4, denominator: i === 2 ? 8 : 4 },
            tempo: { bpm: 60, pulse: i === 2 ? 'dottedQuarter' : 'quarter' },
            startingBarPhase: phase,
          },
        ],
      });
      p.sections.push({ id: sectionID, name: `段落 ${i + 1}`, systemIDs: [areaID] });
      p.readingOrder.push({ id: randomUUID(), sectionID });
    }
  }
  await mkdir(folder(id), { recursive: true });
  await writeFile(path.join(folder(id), 'original'), bytes);
  return store(p);
}
interface PrivateSettings {
  url: string;
  encryptedToken: string;
}
async function privateSettings(): Promise<PrivateSettings> {
  try {
    return JSON.parse(await readFile(path.join(app.getPath('userData'), 'worker.json'), 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { url: '', encryptedToken: '' };
    throw e;
  }
}
function workerURL(value: string) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    (u.protocol !== 'https:' &&
      !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))
  )
    throw new Error('云端识别地址需为 HTTPS；本机测试可使用 localhost。');
  return u.toString().replace(/\/$/, '');
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
  handle('library:import', async () => {
    const choice = await dialog.showOpenDialog(win, {
      title: '导入原谱',
      properties: ['openFile'],
      filters: [{ name: '乐谱 PDF / 图片', extensions: ['pdf', 'png', 'jpg', 'jpeg'] }],
    });
    if (choice.canceled) return null;
    const file = choice.filePaths[0];
    return create(await readFile(file), path.basename(file));
  });
  handle('library:exercise', async () =>
    create(
      await readFile(path.join(__dirname, 'renderer', 'exercise.png')),
      'practice-exercise.png',
      true,
    ),
  );
  handle('library:save', async (incoming: Project) => {
    const current = await load(incoming.id);
    return store({
      ...current,
      title: incoming.title,
      systems: incoming.systems,
      sections: incoming.sections,
      readingOrder: incoming.readingOrder,
    });
  });
  handle('worker:settings', async () => {
    const s = await privateSettings();
    return { url: s.url, hasToken: !!s.encryptedToken };
  });
  handle('worker:settings-save', async (url: string, token: string) => {
    const current = await privateSettings();
    const parsed = workerURL(url);
    if (typeof token !== 'string' || token.length > 8192) throw new Error('凭据格式无效。');
    if (current.url !== parsed && !token.trim()) throw new Error('更换地址时请重新输入访问凭据。');
    let encryptedToken = current.encryptedToken;
    if (token.trim()) {
      if (!(await safeStorage.isAsyncEncryptionAvailable()))
        throw new Error('Windows 凭据加密不可用，未保存。');
      encryptedToken = (await safeStorage.encryptStringAsync(token.trim())).toString('base64');
    }
    await atomicJSON(path.join(app.getPath('userData'), 'worker.json'), {
      url: parsed,
      encryptedToken,
    });
    return { url: parsed, hasToken: !!encryptedToken };
  });
  handle('worker:recognize', async (id: string, submit: boolean) => {
    const p = await load(id),
      settings = await privateSettings();
    if (!settings.url || !settings.encryptedToken)
      throw new Error('请先在设置中填写云端识别地址和凭据。');
    const bytes = await readFile(path.join(folder(id), 'original'));
    if (bytes.length > 20 * 1024 * 1024 || p.pageCount > 8)
      throw new Error('云端识别最多 8 页、20 MiB；原谱仍可正常阅读和手工准备。');
    const { result: token } = await safeStorage.decryptStringAsync(
      Buffer.from(settings.encryptedToken, 'base64'),
    );
    if (!submit && !p.pendingRecognition) throw new Error('没有可继续查询的识别任务。');
    const response = await fetch(
      `${workerURL(settings.url)}/v1/jobs${submit ? '' : '/' + validID(p.pendingRecognition!.id)}`,
      {
        method: submit ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: submit
          ? JSON.stringify({ mediaType: p.mediaType, contentBase64: bytes.toString('base64') })
          : undefined,
        signal: AbortSignal.timeout(120000),
        redirect: 'error',
      },
    );
    if (!response.ok)
      throw new Error(`识别服务 ${response.status}：${(await response.text()).slice(0, 500)}`);
    const job = validateJob((await response.json()) as RecognitionJob, p);
    for (const page of job.pages)
      if (page.musicXML && page.musicXMLSHA256 && sha(page.musicXML) !== page.musicXMLSHA256)
        throw new Error('识别页面内容校验失败。');
    const current = await load(id);
    // A query already in flight must not restore a result the musician discarded.
    if (!submit && current.pendingRecognition?.id !== job.id) return current;
    return store({ ...current, pendingRecognition: job });
  });
  handle('worker:review', async (id: string, accept: boolean) => {
    const p = await load(id);
    if (accept) {
      if (p.pendingRecognition?.state !== 'succeeded') throw new Error('识别尚未完成。');
      p.recognizedEdition = p.pendingRecognition;
    }
    delete p.pendingRecognition;
    return store(p);
  });
  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.show();
});
app.on('window-all-closed', () => app.quit());
