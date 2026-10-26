import FFT from 'fft.js';
import { PitchDetector } from 'pitchy';
import type { PerformanceGroup } from './music';
export interface AudioObservation {
  rms: number;
  midi: number | null;
  chroma: number[];
  onset: boolean;
  time: number;
}
export class ScoreAudioFeatures {
  private fft = new FFT(8192);
  private spectrum = this.fft.createComplexArray();
  private windowed = new Float32Array(8192);
  private detector = PitchDetector.forFloat32Array(8192);
  private previousRMS = 0;
  private previousChroma = new Array<number>(12).fill(0);
  private lastAttack = -Infinity;
  constructor() {
    this.detector.minVolumeDecibels = -45;
    this.detector.clarityThreshold = 0.93;
  }
  process(input: Float32Array, sampleRate: number, time: number, a4 = 440): AudioObservation {
    let energy = 0;
    for (let i = 0; i < input.length; i++) {
      energy += input[i] * input[i];
      this.windowed[i] = input[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (input.length - 1)));
    }
    const rms = Math.sqrt(energy / input.length),
      [frequency, clarity] = this.detector.findPitch(input, sampleRate);
    const midi =
      clarity > 0.9 && frequency >= 27 && frequency <= 4200
        ? 69 + 12 * Math.log2(frequency / a4)
        : null;
    this.fft.realTransform(this.spectrum, this.windowed);
    const chroma = new Array<number>(12).fill(0);
    for (
      let bin = Math.ceil((35 * 8192) / sampleRate);
      bin < Math.min(4096, Math.floor((4200 * 8192) / sampleRate));
      bin++
    ) {
      const amplitude = Math.hypot(this.spectrum[bin * 2], this.spectrum[bin * 2 + 1]);
      const before = Math.hypot(this.spectrum[(bin - 1) * 2], this.spectrum[(bin - 1) * 2 + 1]),
        after = Math.hypot(this.spectrum[(bin + 1) * 2], this.spectrum[(bin + 1) * 2 + 1]);
      if (amplitude < before || amplitude < after) continue;
      const pitch = 69 + 12 * Math.log2((bin * sampleRate) / 8192 / a4),
        nearest = Math.round(pitch);
      if (Math.abs(pitch - nearest) < 0.48)
        chroma[((nearest % 12) + 12) % 12] += Math.sqrt(amplitude);
    }
    const norm = Math.hypot(...chroma);
    if (norm) for (let i = 0; i < 12; i++) chroma[i] /= norm;
    const flux = chroma.reduce((sum, v, i) => sum + Math.max(0, v - this.previousChroma[i]), 0);
    const onset =
      rms > 0.005 &&
      time - this.lastAttack > 0.16 &&
      (rms > this.previousRMS * 1.8 || (flux > 0.55 && rms > this.previousRMS * 1.12));
    if (onset) this.lastAttack = time;
    this.previousRMS = rms;
    this.previousChroma = chroma;
    return { rms, midi, chroma, onset, time };
  }
}
export interface FollowingPosition {
  index: number;
  status: 'waiting' | 'following' | 'uncertain';
  tempo: number | null;
  confidence: number;
}
// A monotonic, onset-aware local alignment. No clock advances the score without
// matching input; explicit measure clicks establish a new alignment anchor.
export class ScoreFollower {
  private index = 0;
  private started = false;
  private pending = -1;
  private stable = 0;
  private lastMatchTime = 0;
  private tempo: number | null = null;
  private lastAdvance = -Infinity;
  constructor(
    private groups: PerformanceGroup[],
    private polyphonic = false,
  ) {}
  reset(index: number) {
    this.index = Math.max(0, Math.min(this.groups.length - 1, index));
    this.started = false;
    this.pending = -1;
    this.stable = 0;
    this.lastMatchTime = 0;
    this.tempo = null;
    this.lastAdvance = -Infinity;
  }
  private distance(o: AudioObservation, g: PerformanceGroup) {
    if (!this.polyphonic && g.pitches.length === 1 && o.midi !== null)
      return Math.min(1, Math.abs(o.midi - g.pitches[0]) / 2);
    const target = new Array<number>(12).fill(0);
    for (const pitch of g.pitches) target[((pitch % 12) + 12) % 12] = 1;
    const norm = Math.hypot(...target);
    return 1 - target.reduce((sum, v, i) => sum + v * o.chroma[i], 0) / norm;
  }
  update(o: AudioObservation): FollowingPosition {
    const current = this.groups[this.index];
    if (!current) return { index: 0, status: 'waiting', tempo: null, confidence: 0 };
    if (o.rms < 0.005) {
      this.stable = 0;
      this.pending = -1;
      return { index: this.index, status: 'waiting', tempo: this.tempo, confidence: 0 };
    }
    const currentDistance = this.distance(o, current);
    let best = this.index,
      bestScore = currentDistance;
    if (this.started)
      for (let next = this.index + 1; next < Math.min(this.groups.length, this.index + 4); next++) {
        const samePitches = this.groups[next].pitches.join(',') === current.pitches.join(',');
        if (samePitches && !o.onset && this.pending !== next) continue;
        if (o.time - this.lastAdvance < 0.12) continue;
        const score = this.distance(o, this.groups[next]) + 0.045 * (next - this.index - 1);
        if (
          score < bestScore - 0.05 ||
          (best === this.index && samePitches && (o.onset || this.pending === next) && score < 0.26)
        ) {
          best = next;
          bestScore = score;
        }
      }
    if (bestScore > 0.34) {
      this.pending = -1;
      this.stable = 0;
      return {
        index: this.index,
        status: 'uncertain',
        tempo: this.tempo,
        confidence: Math.max(0, 1 - bestScore),
      };
    }
    if (this.pending === best) this.stable++;
    else {
      this.pending = best;
      this.stable = 1;
    }
    if (this.stable >= 2 && (!this.started || best !== this.index)) {
      if (this.started) {
        const quarters = this.groups[best].quarter - current.quarter,
          seconds = o.time - this.lastMatchTime;
        if (quarters > 0 && seconds > 0.08) {
          const measured = (60 * quarters) / seconds;
          this.tempo = this.tempo === null ? measured : this.tempo * 0.65 + measured * 0.35;
        }
      }
      this.index = best;
      this.started = true;
      this.lastMatchTime = o.time;
      this.lastAdvance = o.time;
    }
    return {
      index: this.index,
      status: this.started ? 'following' : 'waiting',
      tempo: this.tempo,
      confidence: Math.max(0, 1 - bestScore),
    };
  }
}
