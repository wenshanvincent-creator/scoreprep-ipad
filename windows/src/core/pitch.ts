import { PitchDetector } from 'pitchy';
export const instruments = [
  {
    id: 'cello',
    name: '大提琴',
    notes: [36, 43, 50, 57],
    hint: 'C2 · G2 · D3 · A3，先选一根空弦，再平稳拉奏。',
  },
  { id: 'violin', name: '小提琴', notes: [55, 62, 69, 76], hint: 'G3 · D4 · A4 · E5，空弦调音。' },
  { id: 'viola', name: '中提琴', notes: [48, 55, 62, 69], hint: 'C3 · G3 · D4 · A4，空弦调音。' },
  {
    id: 'bass',
    name: '低音提琴',
    notes: [28, 33, 38, 43],
    hint: 'E1 · A1 · D2 · G2，以下均显示实际发声音高。',
  },
  {
    id: 'guitar',
    name: '吉他',
    notes: [40, 45, 50, 55, 59, 64],
    hint: '标准定弦：E2 · A2 · D3 · G3 · B3 · E4。',
  },
  {
    id: 'ukulele',
    name: '尤克里里',
    notes: [67, 60, 64, 69],
    hint: '高 G 标准定弦：G4 · C4 · E4 · A4。低 G 请用半音模式。',
  },
  {
    id: 'chromatic',
    name: '通用半音 / 管乐',
    notes: [],
    hint: '显示实际发声音高（音乐会音高）；移调乐器请按实际音高对照。',
  },
] as const;
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
