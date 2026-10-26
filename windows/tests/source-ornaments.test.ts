import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { recoverFingeringOrnaments } from '../src/core/source-ornaments';
import { recoverSourceFingerings } from '../src/core/source-marks';
import { prepareMusic } from '../src/core/music';

const [raw, comparison, layout, reference, maskJSON, glyphJSON] = await Promise.all([
  readFile('tests/fixtures/trill-fingering-homr.musicxml', 'utf8'),
  readFile('tests/fixtures/trill-fingering-comparison.musicxml', 'utf8'),
  readFile('tests/fixtures/trill-fingering-layout.xml', 'utf8'),
  readFile('tests/fixtures/trill-fingering-study.musicxml', 'utf8'),
  readFile('tests/fixtures/trill-fingering-masks.json', 'utf8'),
  readFile('tests/fixtures/trill-fingering-glyphs.json', 'utf8'),
]);
const masks = JSON.parse(maskJSON).fingerings,
  glyphs = JSON.parse(glyphJSON).glyphs,
  size = { width: 2400, height: 604 };
const parse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const write = (doc: ReturnType<typeof parse>) => new XMLSerializer().serializeToString(doc);
const events = (s: string) =>
  prepareMusic(s, 'cello', false).notes.map((n) => [
    n.midi,
    n.quarter,
    n.duration,
    n.sourceFingering,
  ]);
const trillLocations = (s: string) =>
  Array.from(parse(s).getElementsByTagName('measure')).flatMap((m) =>
    Array.from(m.getElementsByTagName('note')).flatMap((n, i) =>
      n.getElementsByTagName('trill-mark').length ? [[m.getAttribute('number'), i + 1]] : [],
    ),
  );

test('actual comparison inference retains two genuine trills with fingerings and removes only the false one', () => {
  assert.deepEqual(trillLocations(raw), [
    ['1', 1],
    ['1', 4],
    ['2', 2],
  ]);
  const result = recoverFingeringOrnaments(raw, comparison, layout, size, masks);
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(
    result.corrections.map((c) => [c.measure, c.note]),
    [['1', 4]],
  );
  assert.deepEqual(trillLocations(result.xml), trillLocations(reference));
  const marked = recoverSourceFingerings(result.xml, layout, size, glyphs);
  assert.equal(marked.fingerings.length, 3);
  assert.deepEqual(events(marked.xml), events(reference));
  assert.equal(
    recoverFingeringOrnaments(result.xml, comparison, layout, size, masks).xml,
    result.xml,
  );
});

test('a comparison that changes a pitch cannot remove any original ornaments', () => {
  const doc = parse(comparison);
  doc.getElementsByTagName('pitch')[0].getElementsByTagName('octave')[0].textContent = '3';
  const result = recoverFingeringOrnaments(raw, write(doc), layout, size, masks);
  assert.equal(result.xml, raw);
  assert.equal(result.corrections.length, 0);
  assert.match(result.unresolved[0], /音符或节奏/);
});

test('matching event counts without a shared source head or confirmed fingering do not authorize removal', () => {
  const doc = parse(comparison),
    node = doc.getElementsByTagName('note')[3];
  for (const c of Array.from(node.childNodes).filter((c) => c.nodeType === 8)) node.removeChild(c);
  const result = recoverFingeringOrnaments(raw, write(doc), layout, size, masks);
  assert.equal(result.xml, raw);
  assert.match(result.unresolved[0], /定位不一致/);
  const weak = masks.map((m: (typeof masks)[number]) => ({ ...m, score: 0.1 }));
  assert.equal(recoverFingeringOrnaments(raw, comparison, layout, size, weak).xml, raw);
});
