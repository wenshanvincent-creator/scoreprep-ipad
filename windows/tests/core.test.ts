import { test } from 'node:test';
import assert from 'node:assert/strict';
const close = (a:number,b:number,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance);
import { frequencyFor, LocalPitch, reading } from '../src/core/pitch';
function signal(hz:number,rate:number,harmonics:number[]=[.3]){return Float32Array.from({length:8192},(_,i)=>harmonics.reduce((sum,amp,n)=>sum+amp*Math.sin(2*Math.PI*hz*(n+1)*i/rate),0));}
test('all four cello strings including low C2 track cents with a stronger second harmonic', () => {
  for (const rate of [44100, 48000])
    for (const midi of [36, 43, 50, 57])
      for (const cents of [-23, 0, 19]) {
        const hz = frequencyFor(midi) * 2 ** (cents / 1200),
          result = new LocalPitch().detect(signal(hz, rate, [0.11, 0.28, 0.13, 0.06]), rate);
        assert.ok(result);
        const note = reading(result.hz, 440, [36, 43, 50, 57], midi);
        close(note.cents, cents, 0.6);
      }
});
test('silence, weak input and deterministic noise show no tuning success', () => {
  const pitch = new LocalPitch();
  assert.equal(pitch.detect(new Float32Array(8192), 48000), null);
  assert.equal(pitch.detect(signal(220, 48000, [0.00001]), 48000), null);
  let seed = 7;
  const noise = Float32Array.from({ length: 8192 }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 2 ** 32 - 0.5) * 0.2;
  });
  assert.equal(pitch.detect(noise, 48000), null);
});
test('manual target reports the wrong octave; A4 calibration uses the real target frequency', () => {
  const wrongOctave = reading(frequencyFor(48), 440, [36, 43, 50, 57], 36);
  close(wrongOctave.cents, 1200);
  assert.equal(wrongOctave.detected, 'C3');
  const calibrated = reading(frequencyFor(57, 442), 442, [36, 43, 50, 57], 57);
  close(calibrated.cents, 0);
  close(calibrated.targetHz, 221);
});
