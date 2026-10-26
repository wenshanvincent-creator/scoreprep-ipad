import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { findFingeringRows, applyFingeringReadings } from '../src/core/fingering-rows';
import { recoverSourceFingerings, type GlyphObservation } from '../src/core/source-marks';
import { prepareMusic } from '../src/core/music';
const [reference, layout, observations, receipt, trueEight] = await Promise.all([
  readFile('tests/fixtures/fingering-roles-study.musicxml', 'utf8'),
  readFile('tests/fixtures/fingering-roles-layout.xml', 'utf8'),
  readFile('tests/fixtures/fingering-roles-glyphs.json', 'utf8'),
  readFile('tests/fixtures/fingering-roles-readings.json', 'utf8'),
  readFile('tests/fixtures/fingering-roles-true-eight.json', 'utf8'),
]);
const glyphs: GlyphObservation[] = JSON.parse(observations).glyphs,
  readings = JSON.parse(receipt).readings,
  size = { width: 2400, height: 1069 };
const parse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const serialize = (d: ReturnType<typeof parse>) => new XMLSerializer().serializeToString(d);
const raw = (() => {
  const doc = parse(reference);
  for (const f of Array.from(doc.getElementsByTagName('fingering'))) f.parentNode!.removeChild(f);
  return serialize(doc);
})();
function controlledMisread() {
  const gs = structuredClone(glyphs);
  const first = gs.find((g) => g.text === '3' && g.y < 160)!;
  assert.ok(first);
  first.text = '8';
  first.score = 0.95;
  return gs;
}
const events = (s: string) =>
  prepareMusic(s, 'cello', false).notes.map((n) => [
    n.midi,
    n.quarter,
    n.duration,
    n.sourceFingering,
  ]);

test('an independently complete fingering row admits an actual pixel rereading and preserves all true tuplets', () => {
  const gs = controlledMisread(),
    rows = findFingeringRows(raw, layout, size, gs);
  assert.deepEqual(
    rows.map((r) => r.marks.map((m) => [m.measure, m.note])),
    [
      [
        ['1', 1],
        ['1', 2],
        ['1', 3],
        ['1', 4],
      ],
    ],
  );
  const resolved = applyFingeringReadings(gs, rows, readings);
  assert.deepEqual(resolved.unresolved, []);
  assert.equal(resolved.adopted[0].rawText, '8');
  assert.equal(resolved.adopted[0].text, '3');
  const result = recoverSourceFingerings(raw, layout, size, resolved.glyphs);
  assert.deepEqual(events(result.xml), events(reference));
  assert.equal(parse(result.xml).getElementsByTagName('time-modification').length, 16);
});

test('incomplete printed rows and missing beam links cannot authorize a constrained alphabet', () => {
  const gs = controlledMisread();
  assert.deepEqual(
    findFingeringRows(
      raw,
      layout,
      size,
      gs.filter((g) => !(g.y < 160 && g.text === '1')),
    ),
    [],
  );
  const doc = parse(layout);
  for (const r of Array.from(doc.getElementsByTagName('relation')))
    if (r.getElementsByTagName('beam-stem').length) r.parentNode!.removeChild(r);
  assert.deepEqual(findFingeringRows(raw, serialize(doc), size, gs), []);
});

test('an eight-like numeral in a real octuplet remains protected even when aligned to a fingered note', () => {
  const gs = controlledMisread(),
    first = gs.find((g) => g.text === '3' && g.y > 740)!;
  assert.ok(first);
  first.text = '8';
  first.score = 0.95;
  const rows = findFingeringRows(raw, layout, size, gs);
  assert.equal(
    rows.some((r) => r.marks.some((m) => m.measure === '4')),
    false,
  );
  assert.equal(parse(raw).getElementsByTagName('actual-notes').item(15)?.textContent, '8');
});

test('conditional certainty with negligible absolute pixel evidence must abstain and remain unresolved', () => {
  const gs = controlledMisread(),
    rows = findFingeringRows(raw, layout, size, gs);
  const genuine = JSON.parse(trueEight).readings[0];
  assert.ok(genuine.likelihood < 0.01);
  const result = applyFingeringReadings(gs, rows, [{ ...genuine, conditionalScore: 0.999 }]);
  assert.deepEqual(result.adopted, []);
  assert.deepEqual(result.glyphs, gs);
  assert.deepEqual(result.unresolved, [{ measure: '1', note: 1, rawText: '8' }]);
});
