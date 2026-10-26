import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import {
  findFingeringRows,
  findWeakFingeringDigits,
  findSparseFingeringContexts,
  applyFingeringReadings,
} from '../src/core/fingering-rows';
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

test('two independent same-page glyphs can support a weak reading without inventing an OCR probability', async () => {
  const evidence = JSON.parse(await readFile('tests/fixtures/fingering-roles-shape.json', 'utf8'));
  const gs = controlledMisread(),
    rows = findFingeringRows(raw, layout, size, gs);
  // Controlled probability failure exercises the shape branch. The shape
  // distances and exemplar pixels are an actual separate worker receipt.
  const reading = { ...evidence.readings[0], conditionalScore: 0.5, likelihood: 0.0001 };
  const resolved = applyFingeringReadings(gs, rows, [reading]);
  assert.deepEqual(resolved.unresolved, []);
  assert.equal(resolved.adopted[0].method, 'same-page-shape');
  const verified = resolved.glyphs.find((g) => g.fingeringEvidence)!;
  assert.equal(verified.text, '3');
  assert.equal(verified.score, 0);
  const result = recoverSourceFingerings(raw, layout, size, resolved.glyphs);
  assert.deepEqual(events(result.xml), events(reference));
  assert.equal(
    result.fingerings.find((f) => f.measure === '1' && f.note === 1)?.evidence?.method,
    'same-page-shape',
  );
});

test('a true eight or a single repeated exemplar cannot pass same-page shape verification', async () => {
  const evidence = JSON.parse(await readFile('tests/fixtures/fingering-roles-shape.json', 'utf8'));
  const gs = controlledMisread(),
    rows = findFingeringRows(raw, layout, size, gs);
  const genuine = { ...evidence.readings[1], row: 0, mark: 0 };
  assert.ok(genuine.shape.error > 0.03);
  for (const shape of [
    genuine.shape,
    { ...evidence.readings[0].shape, exemplars: evidence.readings[0].shape.exemplars.slice(0, 1) },
    {
      ...evidence.readings[0].shape,
      exemplars: Array(2).fill(evidence.readings[0].shape.exemplars[0]),
    },
  ]) {
    const result = applyFingeringReadings(gs, rows, [{ ...genuine, shape }]);
    assert.deepEqual(result.adopted, []);
    assert.deepEqual(result.unresolved, [{ measure: '1', note: 1, rawText: '8' }]);
  }
});

test('an unknown single character in an otherwise confirmed fingering row can be reread', () => {
  const gs = controlledMisread();
  const first = gs.find((g) => g.text === '8' && g.y < 160)!;
  first.text = '&';
  first.score = 0.1;
  const rows = findFingeringRows(raw, layout, size, gs);
  const resolved = applyFingeringReadings(gs, rows, readings);
  assert.equal(resolved.adopted[0].rawText, '&');
  assert.deepEqual(
    events(recoverSourceFingerings(raw, layout, size, resolved.glyphs).xml),
    events(reference),
  );
});

test('weak alternate heads do not erase a fingering row, while strong heads and extra stems keep it ambiguous', () => {
  const gs = controlledMisread();
  const original = findFingeringRows(raw, layout, size, gs)[0];
  for (const [grade, extraStem, accepted] of [
    [0.75, false, true],
    [0.95, false, false],
    [0.75, true, false],
  ] as const) {
    // Controlled source-detector alternatives on an owned layout. These are
    // not claimed as real recognition results on this independently authored PNG.
    const doc = parse(layout);
    const head = Array.from(doc.getElementsByTagName('head')).find(
      (h) => h.getAttribute('id') === original.heads[0],
    )!;
    const duplicate = head.cloneNode(true) as typeof head;
    duplicate.setAttribute('id', 'alternative-head');
    duplicate.setAttribute('grade', String(grade));
    duplicate.setAttribute('ctx-grade', String(grade));
    duplicate.setAttribute('pitch', String(Number(head.getAttribute('pitch')) + 1));
    head.parentNode!.appendChild(duplicate);
    const link = Array.from(doc.getElementsByTagName('relation'))
      .find(
        (r) =>
          r.getAttribute('source') === head.getAttribute('id') &&
          r.getElementsByTagName('head-stem').length,
      )!
      .cloneNode(true) as typeof head;
    link.setAttribute('source', 'alternative-head');
    if (extraStem) link.setAttribute('target', 'extra-source-stem');
    head.parentNode!.appendChild(link);
    if (extraStem)
      for (const beam of original.beams) {
        const relation = doc.createElement('relation');
        relation.setAttribute('source', beam);
        relation.setAttribute('target', 'extra-source-stem');
        relation.appendChild(doc.createElement('beam-stem'));
        head.parentNode!.appendChild(relation);
      }
    const rows = findFingeringRows(raw, serialize(doc), size, gs);
    if (accepted) {
      assert.deepEqual(rows[0].ambiguousHeads, ['alternative-head']);
      const result = applyFingeringReadings(gs, rows, readings);
      assert.deepEqual(
        events(recoverSourceFingerings(raw, serialize(doc), size, result.glyphs).xml),
        events(reference),
      );
    } else assert.deepEqual(rows, []);
  }
});

test('a standalone weak digit needs same-text corroboration, never a constrained alphabet change', async () => {
  const evidence = JSON.parse(await readFile('tests/fixtures/fingering-roles-shape.json', 'utf8'));
  for (const [digit, accepted] of [
    ['3', true],
    ['2', false],
  ] as const) {
    const gs = structuredClone(glyphs);
    const first = gs.find((g) => g.text === '3' && g.y < 160)!;
    first.text = digit;
    first.score = 0.4;
    const rows = findWeakFingeringDigits(raw, layout, size, gs, []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].verificationOnly, true);
    const result = applyFingeringReadings(gs, rows, [evidence.readings[0]]);
    assert.deepEqual(result.unresolved, []);
    assert.equal(result.unverified.length, accepted ? 0 : 1);
    assert.equal(result.adopted.length, accepted ? 1 : 0);
    if (accepted)
      assert.deepEqual(
        events(recoverSourceFingerings(raw, layout, size, result.glyphs).xml),
        events(reference),
      );
  }
  // A weak observation of the actual 3 tuplet sign still belongs to its tuplet.
  const gs = structuredClone(glyphs);
  gs.find((g) => g.text === '3' && g.y > 380 && g.y < 390)!.score = 0.4;
  assert.deepEqual(findWeakFingeringDigits(raw, layout, size, gs, []), []);
});

test('faint strokes need two agreeing contrast views with absolute evidence; one view cannot change a digit', async () => {
  const receipt = JSON.parse(await readFile('tests/fixtures/fingering-faint-zero.json', 'utf8'));
  const gs = structuredClone(glyphs);
  const zero = gs.find((g) => g.text === '0' && g.y > 100 && g.y < 200)!;
  zero.text = 'n';
  zero.score = 0.2;
  const rows = findFingeringRows(raw, layout, size, gs);
  const reading = { ...receipt.readings[0], row: 0, mark: 3 };
  assert.ok(reading.likelihood < 0.01);
  const result = applyFingeringReadings(gs, rows, [reading]);
  assert.equal(result.adopted[0].method, 'contrast-ctc');
  assert.deepEqual(
    events(recoverSourceFingerings(raw, layout, size, result.glyphs).xml),
    events(reference),
  );
  for (const contrastReadings of [
    reading.contrastReadings.slice(0, 1),
    [reading.contrastReadings[0], reading.contrastReadings[0]],
    [reading.contrastReadings[0], { ...reading.contrastReadings[1], text: '1' }],
    [reading.contrastReadings[0], { ...reading.contrastReadings[1], likelihood: 0.0001 }],
  ])
    assert.deepEqual(
      applyFingeringReadings(gs, rows, [{ ...reading, contrastReadings }]).adopted,
      [],
    );
});

test('sparse numeric context needs three same-staff source digits and cannot override a strong literal letter', () => {
  const gs = controlledMisread();
  gs.find((g) => g.text === '8' && g.y < 160)!.text = '&';
  gs.find((g) => g.text === '&')!.score = 0.2;
  const rows = findSparseFingeringContexts(raw, layout, size, gs, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].context!.length, 3);
  const result = applyFingeringReadings(gs, rows, readings);
  assert.deepEqual(
    events(recoverSourceFingerings(raw, layout, size, result.glyphs).xml),
    events(reference),
  );
  assert.deepEqual(
    findSparseFingeringContexts(
      raw,
      layout,
      size,
      gs.filter((g) => !(g.y < 160 && g.text === '1')),
      [],
    ),
    [],
  );
  const literal = gs.find((g) => g.text === '&')!;
  literal.text = 'A';
  literal.score = 0.99;
  assert.deepEqual(findSparseFingeringContexts(raw, layout, size, gs, []), []);
  assert.deepEqual(findFingeringRows(raw, layout, size, gs), []);
});

test('verified page pixels resolve a constrained-probability disagreement without copying the wrong digit', async () => {
  const e = JSON.parse(await readFile('tests/fixtures/fingering-roles-shape.json', 'utf8'));
  const gs = controlledMisread(),
    rows = findFingeringRows(raw, layout, size, gs);
  const result = applyFingeringReadings(gs, rows, [
    { ...e.readings[0], text: '2', conditionalScore: 0.99, likelihood: 0.9 },
  ]);
  assert.equal(result.adopted[0].adoptedText, '3');
  assert.equal(result.adopted[0].method, 'same-page-shape');
  assert.deepEqual(
    events(recoverSourceFingerings(raw, layout, size, result.glyphs).xml),
    events(reference),
  );
});

test('two unrestricted OCR readings can corroborate a digit but retain actual 8 and letter A', async () => {
  const e = JSON.parse(await readFile('tests/fixtures/fingering-unrestricted-text.json', 'utf8'));
  const gs = controlledMisread(),
    rows = findFingeringRows(raw, layout, size, gs);
  const reading = {
    row: 0,
    mark: 0,
    text: '3',
    conditionalScore: 0.5,
    likelihood: 0.0001,
    unrestrictedReadings: e.readings[0],
  };
  const result = applyFingeringReadings(gs, rows, [reading]);
  assert.equal(result.adopted[0].method, 'unrestricted-text');
  assert.deepEqual(
    events(recoverSourceFingerings(raw, layout, size, result.glyphs).xml),
    events(reference),
  );
  for (const unrestrictedReadings of [
    e.readings[1],
    e.letterReadings[0],
    e.readings[0].slice(0, 1),
    [e.readings[0][0], e.readings[0][0]],
    [e.readings[0][0], { ...e.readings[0][1], confidence: 89 }],
    [e.readings[0][0], { ...e.readings[0][1], text: '2' }],
  ])
    assert.deepEqual(
      applyFingeringReadings(gs, rows, [{ ...reading, unrestrictedReadings }]).adopted,
      [],
    );
});

test('a weak staff-separation fragment cannot hide an original numeral or become a source fingering', () => {
  const gs = controlledMisread();
  const first = gs.find((g) => g.text === '8' && g.y < 160)!;
  gs.push({
    ...first,
    x: first.x + 4,
    y: first.y + 12,
    width: 3,
    height: 10,
    text: '1',
    score: 0.94,
    proposalOnly: true,
    view: 'top-staff-line-separated',
  });
  const rows = findFingeringRows(raw, layout, size, gs);
  const result = applyFingeringReadings(gs, rows, readings);
  assert.equal(result.unresolved.length, 0);
  assert.deepEqual(
    events(recoverSourceFingerings(raw, layout, size, result.glyphs).xml),
    events(reference),
  );
});

test('staff-occluded shape evidence needs sufficient visible ink and the full comparison to agree', async () => {
  const e = JSON.parse(await readFile('tests/fixtures/fingering-roles-shape.json', 'utf8'));
  const gs = controlledMisread(),
    rows = findFingeringRows(raw, layout, size, gs);
  const reading = {
    ...e.readings[0],
    conditionalScore: 0.5,
    likelihood: 0.0001,
    shape: { ...e.readings[0].shape, error: 0.04 },
    partialShape: { ...e.readings[0].shape, visibleFraction: 0.7, ignoredStaffBand: true },
  };
  const result = applyFingeringReadings(gs, rows, [reading]);
  assert.equal(result.adopted[0].method, 'same-page-shape');
  assert.deepEqual(
    events(recoverSourceFingerings(raw, layout, size, result.glyphs).xml),
    events(reference),
  );
  for (const partialShape of [
    { ...reading.partialShape, visibleFraction: 0.59 },
    { ...reading.partialShape, text: '2' },
    { ...reading.partialShape, error: 0.04 },
  ])
    assert.deepEqual(applyFingeringReadings(gs, rows, [{ ...reading, partialShape }]).adopted, []);
});
