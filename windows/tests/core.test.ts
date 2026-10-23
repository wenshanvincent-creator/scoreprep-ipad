import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, validateJob, type Timing, type Project } from '../src/core/model';
import { PulsePlanner, Transport } from '../src/core/transport';
import { frequencyFor, LocalPitch, reading } from '../src/core/pitch';
function segment(
  quarterBeats: number,
  bpm = 60,
  phase = 0,
  pulse: Timing['tempo']['pulse'] = 'quarter',
): Timing {
  return {
    quarterBeats,
    meter: {
      numerator: pulse === 'dottedQuarter' ? 6 : 4,
      denominator: pulse === 'dottedQuarter' ? 8 : 4,
    },
    tempo: { bpm, pulse },
    startingBarPhase: phase,
  };
}
function project(timings: Timing[][]): Project {
  return {
    id: 'test',
    title: 'exercise',
    sourceFilename: 'owned.png',
    pageCount: 1,
    mediaType: 'image/png',
    originalSHA256: 'abc',
    updatedAt: '',
    systems: timings.map((timing, i) => ({
      id: String(i),
      pageIndex: 0,
      label: `Line ${i + 1}`,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      timing,
    })),
    sections: [{ id: 'section', name: 'Exercise', systemIDs: timings.map((_, i) => String(i)) }],
    readingOrder: [{ id: 'first', sectionID: 'section' }],
  };
}
const close = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
test('pickup, compound pulse, line focus and final endpoint share one timeline', () => {
  const timeline = compile(
      project([[segment(5, 60, 3)], [segment(4)], [segment(6, 60, 0, 'dottedQuarter')]]),
    ),
    t = new Transport(timeline);
  t.start(10, 1);
  const clicks = new PulsePlanner(timeline).pulses(t, 0, 17);
  assert.deepEqual(
    clicks.map((c) => c.elapsed),
    Array.from({ length: 16 }, (_, i) => i),
  );
  assert.deepEqual(
    clicks.filter((c) => c.countIn).map((c) => c.elapsed),
    [0, 1, 2],
  );
  assert.deepEqual(
    clicks.filter((c) => c.downbeat).map((c) => c.elapsed),
    [0, 4, 8, 12, 14],
  );
  assert.equal(t.snapshot(18).index, 1);
  assert.equal(t.snapshot(22).index, 2);
  assert.equal(t.snapshot(26).phase, 'finished');
});
test('continuous explicit pulse survives nondividing bars and repeated A–B cycles', () => {
  const bar = { ...segment(4, 60, 0, 'dottedQuarter'), meter: { numerator: 4, denominator: 4 } };
  const timeline = compile(project([[bar], [bar]])),
    t = new Transport(timeline),
    planner = new PulsePlanner(timeline);
  t.start(0, 1);
  close(t.lead, 8 / 3);
  const clicks = planner.pulses(t, 0, 8);
  assert.equal(clicks.length, 8);
  clicks.forEach((c, i) => close(c.elapsed, i));
  t.seek(0);
  t.setLoop({ first: 0, last: 0 }, 0);
  t.start(10, 0);
  const looped = planner.pulses(t, 0, 8.1);
  assert.equal(looped.length, 9);
  looped.forEach((c, i) => close(c.elapsed, i));
});
test('pause and speed preserve position; seek outside loop clears it', () => {
  const t = new Transport(compile(project([[segment(4)], [segment(4)]])));
  t.start(10, 0);
  t.pause(11.5);
  close(t.snapshot(40).position, 1.5);
  t.setSpeed(2, 40);
  t.resume(50);
  close(t.snapshot(51).position, 3.5);
  close(t.hostTime(4), 51.25);
  t.setLoop({ first: 0, last: 0 }, 51);
  t.seek(1);
  assert.equal(t.loop, null);
  assert.equal(t.snapshot(100).phase, 'paused');
  close(t.snapshot(100).position, 4);
});
test('tempo changes and terminal fractional display never add a final click', () => {
  const timeline = compile(project([[segment(0.5, 30), segment(0.25, 120)]])),
    t = new Transport(timeline),
    planner = new PulsePlanner(timeline);
  t.start(0, 0);
  assert.deepEqual(
    planner.pulses(t, 0, 2).map((c) => c.elapsed),
    [0],
  );
  close(planner.display(t, 1.0625)!.progress, 0.85);
});
test('repeated occurrences have independent IDs; unconfirmed timing cannot start', () => {
  const p = project([[segment(4)]]);
  p.readingOrder.push({ id: 'repeat', sectionID: 'section' });
  const t = compile(p);
  assert.notEqual(t.spans[0].id, t.spans[1].id);
  close(t.duration, 8);
  delete p.systems[0].timing;
  assert.throws(() => compile(p), /时值/);
});
test('worker results must match original hash and page order', () => {
  const p = project([[segment(4)]]);
  const job = {
    schemaVersion: 1,
    id: '12345678-1234-1234-1234-123456789abc',
    state: 'succeeded',
    completedPages: 1,
    engineRevision: 'test',
    originalSHA256: 'abc',
    pages: [{ sourcePageIndex: 0, state: 'succeeded', musicXML: '<score/>' }],
  };
  assert.equal(validateJob(job, p), job);
  assert.throws(() => validateJob({ ...job, originalSHA256: 'other' }, p));
  assert.throws(() => validateJob({ ...job, pages: [{ ...job.pages[0], sourcePageIndex: 1 }] }, p));
});
function signal(hz: number, rate: number, harmonics: number[] = [0.3]) {
  return Float32Array.from({ length: 8192 }, (_, i) =>
    harmonics.reduce(
      (sum, amp, n) => sum + amp * Math.sin((2 * Math.PI * hz * (n + 1) * i) / rate),
      0,
    ),
  );
}
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
