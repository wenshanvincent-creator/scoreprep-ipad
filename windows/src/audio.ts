import { PulsePlanner, Transport, type Snapshot } from './core/transport';
import type { Timeline } from './core/model';
export class PracticeAudio {
  readonly transport: Transport;
  readonly planner: PulsePlanner;
  private context: AudioContext;
  private sources = new Set<OscillatorNode>();
  private timer?: number;
  private cursor = 0;
  private generation = 0;
  audible = true;
  constructor(
    timeline: Timeline,
    private update: (snapshot: Snapshot) => void,
    private interrupted: () => void,
  ) {
    this.transport = new Transport(timeline);
    this.planner = new PulsePlanner(timeline);
    this.context = new AudioContext({ latencyHint: 'interactive' });
    this.context.onstatechange = () => {
      if (
        this.context.state === 'suspended' &&
        ['playing', 'countingIn'].includes(this.transport.snapshot(this.context.currentTime).phase)
      ) {
        this.pause();
        this.interrupted();
      }
    };
  }
  get now() {
    return this.context.currentTime;
  }
  snapshot() {
    return this.transport.snapshot(this.now);
  }
  async start(bars: number) {
    this.cancel();
    const generation = this.generation;
    await this.context.resume();
    if (generation !== this.generation) return;
    this.transport.start(this.now + 0.08, bars);
    this.cursor = 0;
    this.run();
  }
  pause() {
    this.transport.pause(this.now);
    this.cancel();
    this.update(this.snapshot());
  }
  async resume() {
    this.cancel();
    const generation = this.generation;
    await this.context.resume();
    if (generation !== this.generation) return;
    this.transport.resume(this.now + 0.04);
    this.cursor = this.snapshot().elapsed;
    this.run();
  }
  speed(value: number) {
    this.cancel();
    this.transport.setSpeed(value, this.now);
    this.cursor = this.snapshot().elapsed;
    if (['playing', 'countingIn'].includes(this.snapshot().phase)) this.run();
    else this.update(this.snapshot());
  }
  seek(index: number) {
    this.cancel();
    this.transport.seek(index);
    this.update(this.snapshot());
  }
  loop(first: number, last: number, enabled: boolean) {
    this.cancel();
    this.transport.setLoop(enabled ? { first, last } : null, this.now);
    this.update(this.snapshot());
  }
  sound(value: boolean) {
    this.audible = value;
    this.cancel();
    this.cursor = this.snapshot().elapsed;
    if (['playing', 'countingIn'].includes(this.snapshot().phase)) this.run();
  }
  private run() {
    const tick = () => {
      const s = this.snapshot();
      if (s.phase === 'finished') {
        this.cancel();
        this.update(s);
        return;
      }
      const lower = Math.max(s.elapsed, this.cursor),
        upper = s.elapsed + 0.15 * this.transport.speed;
      if (this.audible)
        for (const pulse of this.planner.pulses(this.transport, lower, upper)) {
          const at = this.transport.hostTime(pulse.elapsed);
          if (at < this.now - 0.003) continue;
          const oscillator = this.context.createOscillator(),
            gain = this.context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = pulse.downbeat ? 1500 : 1000;
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(0.16, at + 0.002);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
          oscillator.connect(gain).connect(this.context.destination);
          this.sources.add(oscillator);
          oscillator.onended = () => {
            this.sources.delete(oscillator);
            gain.disconnect();
          };
          oscillator.start(at);
          oscillator.stop(at + 0.05);
        }
      this.cursor = upper;
      this.update(s);
    };
    tick();
    this.timer = window.setInterval(tick, 25);
  }
  private cancel() {
    this.generation++;
    window.clearInterval(this.timer);
    this.timer = undefined;
    for (const node of this.sources) {
      node.stop();
      node.disconnect();
    }
    this.sources.clear();
  }
  async close() {
    this.cancel();
    this.context.onstatechange = null;
    await this.context.close();
  }
}
export class Microphone {
  private generation = 0;
  private stream?: MediaStream;
  private context?: AudioContext;
  private timer?: number;
  private worker?: Worker;
  async start(
    deviceId: string,
    onPitch: (value: { hz: number; clarity: number } | null) => void,
    onFailure: (message: string) => void,
  ) {
    const generation = ++this.generation;
    await this.release();
    if (generation !== this.generation) return false;
    await window.desktop.microphone(true);
    if (generation !== this.generation) return false;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    this.stream = stream;
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    try {
      await context.resume();
      if (generation !== this.generation) return false;
      const source = context.createMediaStreamSource(stream),
        analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      source.connect(analyser);
      const worker = new Worker(new URL('./pitch.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      let pending = false;
      worker.onmessage = (event) => {
        pending = false;
        if (generation === this.generation) onPitch(event.data);
      };
      worker.onerror = () => {
        onFailure('音高分析未能启动，请重新打开调音器。');
        void this.stop();
      };
      this.timer = window.setInterval(() => {
        if (pending) return;
        const input = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(input);
        pending = true;
        worker.postMessage({ input, sampleRate: context.sampleRate }, [input.buffer]);
      }, 85);
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          onFailure('麦克风已断开，请检查输入设备后重新监听。');
          void this.stop();
        };
        track.onmute = () => {
          onFailure('麦克风输入已中断，请重新监听。');
          void this.stop();
        };
      });
      context.onstatechange = () => {
        if (context.state === 'suspended') {
          onFailure('音频输入已暂停，请重新监听。');
          void this.stop();
        }
      };
      return true;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }
  async stop() {
    this.generation++;
    await this.release();
  }
  private async release() {
    window.clearInterval(this.timer);
    this.worker?.terminate();
    this.worker = undefined;
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.onmute = null;
      track.stop();
    });
    this.stream = undefined;
    const context = this.context;
    this.context = undefined;
    const disarmed = window.desktop.microphone(false);
    if (context) {
      context.onstatechange = null;
      await context.close();
    }
    await disarmed;
  }
}
