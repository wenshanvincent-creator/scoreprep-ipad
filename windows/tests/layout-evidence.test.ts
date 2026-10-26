import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { recoverClefInterpretation } from '../src/core/layout-evidence';
import { prepareMusic } from '../src/core/music';

const [source, layout, reference] = await Promise.all([
  readFile('tests/fixtures/cello-homr.musicxml', 'utf8'),
  readFile('tests/fixtures/cello-layout.xml', 'utf8'),
  readFile('tests/fixtures/cello-study.musicxml', 'utf8'),
]);
const size = { width: 2400, height: 530 };
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const serialize = (doc: ReturnType<typeof parse>) => new XMLSerializer().serializeToString(doc);
function misreadTreble(shiftPitches: boolean) {
  const doc = parse(source),
    clef = doc.getElementsByTagName('clef')[0];
  clef.getElementsByTagName('sign')[0].textContent = 'G';
  clef.getElementsByTagName('line')[0].textContent = '2';
  if (shiftPitches)
    for (const pitch of Array.from(doc.getElementsByTagName('pitch')).slice(0, 8)) {
      const step = pitch.getElementsByTagName('step')[0],
        octave = pitch.getElementsByTagName('octave')[0];
      const diatonic = Number(octave.textContent) * 7 + 'CDEFGAB'.indexOf(step.textContent!) + 8;
      step.textContent = 'CDEFGAB'[diatonic % 7];
      octave.textContent = String(Math.floor(diatonic / 7));
    }
  return serialize(doc);
}
const events = (xml: string) =>
  prepareMusic(xml, 'cello', false).notes.map((n) => [n.midi, n.quarter, n.duration]);

test('source tenor-to-bass clef and all 16 actual homr note events remain untouched', () => {
  const result = recoverClefInterpretation(source, layout, size);
  assert.deepEqual(result.corrections, []);
  assert.deepEqual(result.unresolved, []);
  assert.equal(result.xml, source);
  const clefs = Array.from(parse(result.xml).getElementsByTagName('clef'));
  assert.deepEqual(
    clefs.map((c) => c.getElementsByTagName('sign')[0].textContent),
    ['C', 'F'],
  );
  assert.deepEqual(events(result.xml), events(reference));
});

test('a wrong treble interpretation is recovered from independent source geometry, not instrument selection', () => {
  const wrong = misreadTreble(true);
  assert.notDeepEqual(events(wrong), events(reference));
  const result = recoverClefInterpretation(wrong, layout, size);
  assert.equal(result.corrections.length, 1);
  assert.equal(result.corrections[0].from, 'G2');
  assert.equal(result.corrections[0].to, 'C4');
  assert.equal(result.corrections[0].diatonicShift, -8);
  assert.equal(result.corrections[0].notes, 8);
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(events(result.xml), events(reference));
});

test('when pitches already agree with source geometry only the wrong clef metadata changes', () => {
  const result = recoverClefInterpretation(misreadTreble(false), layout, size);
  assert.equal(result.corrections.length, 1);
  assert.equal(result.corrections[0].diatonicShift, 0);
  assert.equal(result.corrections[0].to, 'C4');
  assert.deepEqual(events(result.xml), events(reference));
});

test('sparse or missing source anchors cannot authorize a whole passage transposition', () => {
  const wrong = misreadTreble(true),
    sparse = parse(layout);
  for (const head of Array.from(sparse.getElementsByTagName('head')).slice(5))
    head.parentNode!.removeChild(head);
  const weak = recoverClefInterpretation(wrong, serialize(sparse), size);
  assert.equal(weak.xml, wrong);
  assert.equal(weak.corrections.length, 0);
  assert.ok(weak.unresolved.length);
  const missing = parse(wrong),
    firstNote = missing.getElementsByTagName('note')[0];
  for (const comment of Array.from(firstNote.childNodes).filter((n) => n.nodeType === 8))
    firstNote.removeChild(comment);
  const noPosition = recoverClefInterpretation(serialize(missing), layout, size);
  assert.equal(noPosition.corrections.length, 0);
  assert.ok(noPosition.unresolved.length);
});
