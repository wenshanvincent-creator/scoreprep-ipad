import type { Performance } from './core/music';
import type { Instrument } from './core/instruments';
// Demonstration only. Live following never uses this playback clock.
export class ScorePlayback {
  private context: AudioContext;
  private timer?: number;
  private nodes = new Set<OscillatorNode>();
  private generation = 0;
  constructor(
    private performance: Performance,
    private instrument: Instrument,
    private update: (index: number) => void,
    private finished: () => void,
  ) {
    this.context = new AudioContext();
  }
  async start(index = 0, speed = 1, a4 = 440) {
    const generation = ++this.generation;
    await this.context.resume();
    if (generation !== this.generation) return;
    const origin = this.performance.groups[index].seconds,
      start = this.context.currentTime + 0.1;
    let cursor = this.performance.notes.findIndex((n) => n.start >= origin - 1e-6),
      group = index;
    const tick = () => {
      const time = origin + (this.context.currentTime - start) * speed;
      while (
        cursor >= 0 &&
        cursor < this.performance.notes.length &&
        this.performance.notes[cursor].start < time + 0.25 * speed
      ) {
        const n = this.performance.notes[cursor++],
          at = start + (n.start - origin) / speed,
          end = start + (n.end - origin) / speed;
        if (end <= this.context.currentTime) continue;
        const osc = this.context.createOscillator(),
          gain = this.context.createGain();
        osc.type = this.instrument.family === 'wind' ? 'sine' : 'triangle';
        osc.frequency.value = a4 * 2 ** ((n.midi - 69) / 12);
        const attack = Math.min(0.025, (end - at) / 4),
          release = Math.min(0.08, (end - at) / 3),
          volume = this.instrument.family === 'keyboard' ? 0.08 : 0.12;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(volume, at + attack);
        gain.gain.setValueAtTime(volume * 0.7, Math.max(at + attack, end - release));
        gain.gain.linearRampToValueAtTime(0, end);
        osc.connect(gain).connect(this.context.destination);
        this.nodes.add(osc);
        osc.onended = () => {
          this.nodes.delete(osc);
          gain.disconnect();
          osc.disconnect();
        };
        osc.start(at);
        osc.stop(end + 0.01);
      }
      while (
        group + 1 < this.performance.groups.length &&
        this.performance.groups[group + 1].seconds <= time
      )
        group++;
      this.update(group);
      if (time >= this.performance.duration) {
        void this.close();
        this.finished();
      }
    };
    this.context.onstatechange = () => {
      if (this.context.state === 'suspended') {
        void this.close();
        this.finished();
      }
    };
    tick();
    this.timer = window.setInterval(tick, 30);
  }
  async close() {
    this.generation++;
    window.clearInterval(this.timer);
    for (const node of this.nodes) {
      node.onended = null;
      node.stop();
      node.disconnect();
    }
    this.nodes.clear();
    this.context.onstatechange = null;
    if (this.context.state !== 'closed') await this.context.close();
  }
}
