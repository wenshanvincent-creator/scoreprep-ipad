import { PitchDetector } from 'pitchy';
import { instrumentProfiles } from './instruments';
export const instruments = [
  ...instrumentProfiles.map((i) => ({
    id: i.id,
    name: i.name,
    notes: i.strings,
    hint: i.strings.length
      ? '按空弦实际音高调音。'
      : '使用音乐会音高调音，吹奏或弹奏一个持续单音。',
  })),
  {
    id: 'ukulele',
    name: '尤克里里',
    notes: [67, 60, 64, 69],
    hint: '高 G 标准定弦：G4 · C4 · E4 · A4。',
  },
  { id: 'chromatic', name: '通用半音', notes: [], hint: '显示实际发声音高。' },
];
export const noteName = (midi: number) =>
  ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][((midi % 12) + 12) % 12] +
  (Math.floor(midi / 12) - 1);
export const frequencyFor = (midi: number, a4 = 440) => a4 * 2 ** ((midi - 69) / 12);
export const centsBetween = (hz: number, target: number) => 1200 * Math.log2(hz / target);
export function reading(hz: number, a4: number, notes: readonly number[], manual: number | null) {
  const midi = 69 + 12 * Math.log2(hz / a4),
    nearest = Math.round(midi);
  const target =
    manual ??
    (notes.length
      ? notes.reduce((a, b) => (Math.abs(a - midi) <= Math.abs(b - midi) ? a : b))
      : nearest);
  return {
    hz,
    detected: noteName(nearest),
    target,
    cents: centsBetween(hz, frequencyFor(target, a4)),
    targetHz: frequencyFor(target, a4),
  };
}
export class LocalPitch {
  private detector = PitchDetector.forFloat32Array(8192);
  private samples: number[] = [];
  constructor() {
    this.detector.minVolumeDecibels = -45;
    this.detector.clarityThreshold = 0.93;
  }
  reset() {
    this.samples = [];
  }
  detect(input: Float32Array, sampleRate: number): { hz: number; clarity: number } | null {
    const [hz, clarity] = this.detector.findPitch(input, sampleRate);
    if (clarity < 0.9 || hz < 27 || hz > 2200) {
      this.reset();
      return null;
    }
    this.samples.push(hz);
    if (this.samples.length > 3) this.samples.shift();
    // A short median rejects bow attacks without hiding a sustained octave change.
    const stable = [...this.samples].sort((a, b) => a - b)[Math.floor(this.samples.length / 2)];
    return { hz: stable, clarity };
  }
}
