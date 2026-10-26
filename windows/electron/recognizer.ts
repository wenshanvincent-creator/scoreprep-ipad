import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Project } from '../src/core/model';
import { resolveFingeringTuplets } from '../src/core/omr';
import { instrumentFor } from '../src/core/instruments';
export const recognizerVersion = '5.11.0';
export class LocalRecognizer {
  private pending: string[] = [];
  private running = false;
  private closed = false;
  private process: ChildProcess | null = null;
  constructor(
    private runtime: string,
    private root: string,
    private load: (id: string) => Promise<Project>,
    private store: (p: Project) => Promise<Project>,
    private validate: (p: Project, xml: string) => void,
  ) {}
  async enqueue(id: string) {
    if (this.pending.includes(id)) return this.load(id);
    const p = await this.load(id);
    if (p.localRecognition?.state === 'running') return p;
    p.localRecognition = { state: 'queued', phase: '等待识别' };
    await this.store(p);
    this.pending.push(id);
    void this.next();
    return this.load(id);
  }
  close() {
    this.closed = true;
    this.pending = [];
    const pid = this.process?.pid;
    if (pid)
      spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
  }
  private async next() {
    if (this.running || this.closed) return;
    const id = this.pending.shift();
    if (!id) return;
    this.running = true;
    try {
      await this.recognize(id);
    } finally {
      this.running = false;
      void this.next();
    }
  }
  private async recognize(id: string) {
    const p = await this.load(id),
      folder = path.join(this.root, id),
      job = path.join(folder, 'local-recognition', randomUUID());
    try {
      await mkdir(job, { recursive: true });
      const state = path.join(this.root, '..', 'recognizer-state');
      await mkdir(state, { recursive: true });
      const tessdata = path.join(state, 'AudiverisLtd', 'audiveris', 'config', 'tessdata');
      await mkdir(tessdata, { recursive: true });
      await copyFile(
        path.join(this.runtime, 'eng.traineddata'),
        path.join(tessdata, 'eng.traineddata'),
      );
      const filename = path.join(
        job,
        p.mediaType === 'application/pdf'
          ? 'source.pdf'
          : p.mediaType === 'image/jpeg'
            ? 'source.jpg'
            : 'source.png',
      );
      await writeFile(filename, await readFile(path.join(folder, 'original')));
      p.localRecognition = { state: 'running', phase: '正在识别乐谱' };
      await this.store(p);
      let log = '';
      const code = await new Promise<number | null>((resolve, reject) => {
        const proc = spawn(
          path.join(this.runtime, 'Audiveris.exe'),
          [
            '-batch',
            '-transcribe',
            '-export',
            '-swap',
            '-constant',
            'org.audiveris.omr.sheet.ProcessingSwitches.fingerings=true',
            '-constant',
            'org.audiveris.omr.sheet.ProcessingSwitches.pluckings=true',
            '-output',
            job,
            filename,
          ],
          {
            windowsHide: true,
            env: {
              ...process.env,
              APPDATA: state,
              LOCALAPPDATA: state,
              'ProgramFiles(x86)': process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        this.process = proc;
        const timer = setTimeout(
          () => {
            if (proc.pid)
              spawn('taskkill.exe', ['/PID', String(proc.pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore',
              });
            reject(new Error('本地识别超时。'));
          },
          20 * 60 * 1000,
        );
        const collect = (chunk: Buffer) => {
          log += chunk.toString('utf8');
        };
        proc.stdout.on('data', collect);
        proc.stderr.on('data', collect);
        proc.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        proc.once('exit', (value) => {
          clearTimeout(timer);
          this.process = null;
          resolve(value);
        });
      });
      await writeFile(path.join(job, 'recognizer.log'), log);
      if (code !== 0) throw new Error(`本地识别程序未完成（${code ?? '已中断'}）。`);
      const outputs = await this.findOutputs(job);
      if (!outputs.length)
        throw new Error('没有生成可演奏乐谱。图片可能缺少完整谱表，或识别程序未能还原谱面。');
      outputs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const scores = [];
      for (const output of outputs) {
        const bytes = await readFile(output);
        let xml: string;
        if (output.endsWith('.mxl')) {
          const files = unzipSync(bytes);
          const container = files['META-INF/container.xml'];
          if (!container) throw new Error('识别导出文件缺少乐谱索引。');
          const doc = new DOMParser().parseFromString(strFromU8(container), 'application/xml');
          const name = doc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
          if (!name || !files[name]) throw new Error('识别导出文件中没有 MusicXML。');
          xml = strFromU8(files[name]);
        } else xml = bytes.toString('utf8');
        scores.push(new DOMParser().parseFromString(xml, 'application/xml'));
      }
      const combined = scores[0],
        target = combined.getElementsByTagName('part')[0];
      if (scores.some((s) => s.getElementsByTagName('part').length !== 1))
        throw new Error('请导入单个乐器的分谱。');
      for (const score of scores.slice(1))
        for (const measure of Array.from(
          score.getElementsByTagName('part')[0].getElementsByTagName('measure'),
        ))
          target.appendChild(combined.importNode(measure, true));
      if (scores.length > 1)
        Array.from(target.getElementsByTagName('measure')).forEach((m, i) =>
          m.setAttribute('number', String(i + 1)),
        );
      const raw = new XMLSerializer().serializeToString(combined);
      const resolved =
        instrumentFor(p.instrument ?? 'cello').family === 'wind'
          ? { xml: raw, corrections: 0 }
          : resolveFingeringTuplets(raw);
      const xml = resolved.xml;
      await writeFile(
        path.join(job, 'interpretation.json'),
        JSON.stringify({ fingeringTupletsResolved: resolved.corrections }),
      );
      this.validate(p, xml);
      const current = await this.load(id);
      current.instrument = p.instrument;
      current.localEdition = {
        musicXML: xml,
        engine: 'Audiveris',
        engineVersion: recognizerVersion,
        originalSHA256: p.originalSHA256,
        recognizedAt: new Date().toISOString(),
      };
      current.localRecognition = { state: 'ready', phase: '' };
      await this.store(current);
    } catch (error) {
      const current = await this.load(id);
      const unavailable = (error as NodeJS.ErrnoException).code === 'ENOENT';
      current.localRecognition = {
        state: 'failed',
        phase: '',
        error: unavailable ? '本地识别组件缺失，请重新安装完整版本。' : (error as Error).message,
      };
      await this.store(current);
    }
  }
  private async findOutputs(folder: string): Promise<string[]> {
    const result: string[] = [];
    for (const e of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, e.name);
      if (e.isDirectory()) result.push(...(await this.findOutputs(file)));
      else if (/\.(mxl|musicxml)$/.test(e.name)) result.push(file);
    }
    return result;
  }
}
