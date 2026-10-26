import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { recoverSourceFingerings } from '../src/core/source-marks';
import { recoverMalformedTuplets } from '../src/core/source-rhythm';
import { prepareMusic } from '../src/core/music';

const [reference, layout, observed] = await Promise.all([
  readFile('tests/fixtures/dense-tuplet-study.musicxml', 'utf8'),
  readFile('tests/fixtures/dense-tuplet-layout.xml', 'utf8'),
  readFile('tests/fixtures/dense-tuplet-glyphs.json', 'utf8'),
]);
const glyphs = JSON.parse(observed).glyphs,
  size = { width: 2400, height: 810 };
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const write = (doc: ReturnType<typeof parse>) => new XMLSerializer().serializeToString(doc);
const events = (xml: string) =>
  prepareMusic(xml, 'cello', false).notes.map((n) => [
    n.midi,
    n.quarter,
    n.duration,
    n.sourceFingering,
  ]);

function malformed() {
  const doc = parse(reference);
  for (const finger of Array.from(doc.getElementsByTagName('fingering')))
    finger.parentNode!.removeChild(finger);
  for (const note of Array.from(
    doc.getElementsByTagName('measure')[0].getElementsByTagName('note'),
  ).slice(0, 4)) {
    note.getElementsByTagName('duration')[0].textContent = '10';
    const ratio = doc.createElement('time-modification');
    for (const [tag, number] of [
      ['actual-notes', '3'],
      ['normal-notes', '2'],
    ]) {
      const element = doc.createElement(tag);
      element.textContent = number;
      ratio.appendChild(element);
    }
    note.appendChild(ratio);
  }
  return write(doc);
}

test('source beams and actual OCR repair four false triplet notes while retaining real triplets and quintuplets', () => {
  const marks = recoverSourceFingerings(malformed(), layout, size, glyphs);
  const recovered = recoverMalformedTuplets(marks.xml, layout, size, glyphs, marks.fingerings);
  assert.deepEqual(
    recovered.corrections.map((c) => [c.measure, c.firstNote, c.notes]),
    [['1', 1, 4]],
  );
  assert.deepEqual(events(recovered.xml), events(reference));
  assert.equal(parse(recovered.xml).getElementsByTagName('time-modification').length, 8);
  assert.equal(parse(recovered.xml).getElementsByTagName('tuplet').length, 4);
  assert.equal(
    recoverMalformedTuplets(recovered.xml, layout, size, glyphs, marks.fingerings).xml,
    recovered.xml,
  );
});

test('an unexplained source tuplet numeral prevents repair even with a neighboring open-string zero', () => {
  const marks = recoverSourceFingerings(malformed(), layout, size, glyphs);
  const zero = glyphs.find((g: { text: string; y: number }) => g.text === '0' && g.y < 200);
  const numeral = { ...zero, text: '3', x: zero.x + 30 };
  const recovered = recoverMalformedTuplets(
    marks.xml,
    layout,
    size,
    [...glyphs, numeral],
    marks.fingerings,
  );
  assert.deepEqual(recovered.corrections, []);
  assert.equal(recovered.unresolved.length, 1);
  assert.equal(recovered.xml, marks.xml);
});

test('a subset of a longer printed beam group cannot establish a complete malformed tuplet', () => {
  const doc = parse(layout),
    heads = Array.from(doc.getElementsByTagName('head'));
  const first = heads[0].getAttribute('id'),
    extra = heads[4].getAttribute('id');
  for (const relation of Array.from(doc.getElementsByTagName('relation'))) {
    if (
      relation.getAttribute('source') === first &&
      relation.getElementsByTagName('head-stem').length
    ) {
      const duplicate = relation.cloneNode(true) as typeof relation;
      duplicate.setAttribute('source', extra!);
      doc.documentElement!.appendChild(duplicate);
    }
  }
  const modifiedLayout = write(doc),
    marks = recoverSourceFingerings(malformed(), modifiedLayout, size, glyphs);
  const recovered = recoverMalformedTuplets(
    marks.xml,
    modifiedLayout,
    size,
    glyphs,
    marks.fingerings,
  );
  assert.deepEqual(recovered.corrections, []);
});
