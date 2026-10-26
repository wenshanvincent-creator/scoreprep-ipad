import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Project } from '../src/core/model';
import { recognizeLocalDocument, type NeuralRuntime } from './recognition-pipeline';
export const recognizerVersion = 'homr-ab369ac + Audiveris-5.11.0';
export class LocalRecognizer {
  private pending: string[] = [];
  private running = false;
  private closed = false;
  private process: ChildProcess | null = null;
  constructor(
    private runtime: string,
    private neural: NeuralRuntime,
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
    this.kill(this.process);
  }
  private kill(process: ChildProcess | null) {
    if (process?.pid)
      spawn('taskkill.exe', ['/PID', String(process.pid), '/T', '/F'], {
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
      const state = path.join(this.root, '..', 'recognizer-state'),
        tessdata = path.join(state, 'AudiverisLtd', 'audiveris', 'config', 'tessdata');
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
      const xml = await recognizeLocalDocument({
        source: filename,
        sourceSHA256: p.originalSHA256,
        job,
        state,
        audiveris: this.runtime,
        neural: this.neural,
        instrument: p.instrument ?? 'cello',
        run: (file, args, log, env) => this.run(file, args, log, env),
        phase: async (phase) => {
          if (this.closed) throw new Error('识别已停止。');
          const current = await this.load(id);
          current.localRecognition = { state: 'running', phase };
          await this.store(current);
        },
        validate: (xml) => this.validate(p, xml),
      });
      if (this.closed) return;
      const current = await this.load(id);
      current.instrument = p.instrument;
      current.localEdition = {
        musicXML: xml,
        engine: 'homr + Audiveris',
        engineVersion: recognizerVersion,
        originalSHA256: p.originalSHA256,
        recognizedAt: new Date().toISOString(),
      };
      current.localRecognition = { state: 'ready', phase: '' };
      await this.store(current);
    } catch (error) {
      if (this.closed) return;
      const current = await this.load(id),
        unavailable = (error as NodeJS.ErrnoException).code === 'ENOENT';
      current.localRecognition = {
        state: 'failed',
        phase: '',
        error: unavailable ? '本地识别组件缺失，请重新安装完整版本。' : (error as Error).message,
      };
      await this.store(current);
    }
  }
  private async run(
    file: string,
    args: string[],
    logFile: string,
    environment?: NodeJS.ProcessEnv,
  ) {
    if (this.closed) throw new Error('识别已停止。');
    let log = '';
    try {
      const code = await new Promise<number | null>((resolve, reject) => {
        const proc = spawn(file, args, {
          windowsHide: true,
          env: { ...process.env, ...environment },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        this.process = proc;
        let timedOut = false;
        const timer = setTimeout(
          () => {
            timedOut = true;
            this.kill(proc);
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
          if (this.process === proc) this.process = null;
          reject(error);
        });
        proc.once('close', (value) => {
          clearTimeout(timer);
          if (this.process === proc) this.process = null;
          if (timedOut) reject(new Error('本地识别超时。'));
          else resolve(value);
        });
      });
      return { code, log };
    } finally {
      await writeFile(logFile, log);
    }
  }
}
