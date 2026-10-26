import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { recoverSourceFingerings, sourceNotes } from '../src/core/source-marks';
import { readSourceLayout } from '../src/core/layout-evidence';
import { prepareMusic } from '../src/core/music';

const [source, layout, reference, observationJSON] = await Promise.all([
  readFile('tests/fixtures/cello-homr.musicxml', 'utf8'),
  readFile('tests/fixtures/cello-layout.xml', 'utf8'),
  readFile('tests/fixtures/cello-study.musicxml', 'utf8'),
  readFile('tests/fixtures/cello-glyphs.json', 'utf8'),
]);
const observations = JSON.parse(observationJSON).glyphs,
  size = { width: 2400, height: 530 };
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const write = (doc: ReturnType<typeof parse>) => new XMLSerializer().serializeToString(doc);
const musicalEvents = (xml: string) =>
  prepareMusic(xml, 'cello', false).notes.map((n) => [
    n.midi,
    n.quarter,
    n.duration,
    n.sourceFingering,
  ]);

test('actual OCR observations recover all 16 original fingerings on their correct notes without recommendations', () => {
  const recovered = recoverSourceFingerings(source, layout, size, observations);
  assert.equal(recovered.fingerings.length, 16);
  assert.deepEqual(recovered.conflicts, []);
  assert.deepEqual(musicalEvents(recovered.xml), musicalEvents(reference));
  const again = recoverSourceFingerings(recovered.xml, layout, size, observations);
  assert.equal(again.xml, recovered.xml);
});

test('an OCR disagreement cannot replace an existing printed fingering', () => {
  const doc = parse(source),
    first = doc.getElementsByTagName('note')[0];
  const notations = doc.createElement('notations'),
    technical = doc.createElement('technical'),
    finger = doc.createElement('fingering');
  finger.textContent = '2';
  technical.appendChild(finger);
  notations.appendChild(technical);
  first.appendChild(notations);
  const recovered = recoverSourceFingerings(write(doc), layout, size, observations);
  assert.match(recovered.conflicts.join(' '), /原有指法/);
  assert.equal(
    parse(recovered.xml).getElementsByTagName('note')[0].getElementsByTagName('fingering')[0]
      .textContent,
    '2',
  );
});

test('a numeral supporting an existing tuplet is retained as a tuplet rather than inserted as a fingering', () => {
  const doc = parse(source);
  for (const node of Array.from(doc.getElementsByTagName('note')).slice(0, 3)) {
    const modification = doc.createElement('time-modification'),
      actual = doc.createElement('actual-notes'),
      normal = doc.createElement('normal-notes');
    actual.textContent = '3';
    normal.textContent = '2';
    modification.appendChild(actual);
    modification.appendChild(normal);
    node.appendChild(modification);
  }
  const glyph = {
    ...observations.find(
      (g: { text: string; x: number }) => g.text === '0' && g.x > 500 && g.x < 600,
    ),
    text: '3',
  };
  const input = write(doc),
    recovered = recoverSourceFingerings(input, layout, size, [glyph]);
  assert.equal(recovered.protectedTupletNumerals, 1);
  assert.equal(recovered.xml, input);
  assert.equal(parse(recovered.xml).getElementsByTagName('time-modification').length, 3);
});

test('ordered registration separates repeated pitches when attention lags, and abstains on equal alternatives', () => {
  // Synthetic geometry isolates the observed attention-lag failure. It is not
  // presented as an actual recognition receipt or an independent music reference.
  const geometry = `<sheet><picture width="200" height="200"/><staff id="1" left="0" right="200"><lines>${[80, 90, 100, 110, 120].map((y) => `<line><point x="0" y="${y}"/><point x="200" y="${y}"/></line>`).join('')}</lines></staff><clef staff="1" shape="F_CLEF" pitch="-2" grade="1"><bounds x="10" y="80" w="10" h="40"/></clef>${[100, 120].map((x, i) => `<head id="h${i}" staff="1" pitch="4" grade="1"><bounds x="${x - 5}" y="115" w="10" h="10"/></head>`).join('')}</sheet>`;
  const note = (x: number) =>
    `<note><pitch><step>G</step><octave>2</octave></pitch><voice>1</voice><!-- imgpos: ${x}, 120 --></note>`;
  const layout = readSourceLayout(geometry, { width: 200, height: 200 });
  const ordered = sourceNotes(
    parse(
      `<score-partwise><part><measure>${note(98)}${note(108)}</measure></part></score-partwise>`,
    ),
    layout,
  );
  assert.deepEqual(
    ordered.map((n) => n.head?.id),
    ['h0', 'h1'],
  );
  const ambiguous = sourceNotes(
    parse(`<score-partwise><part><measure>${note(110)}</measure></part></score-partwise>`),
    layout,
  );
  assert.equal(ambiguous[0].head, undefined);
  const footer = recoverSourceFingerings(
    `<score-partwise><part><measure>${note(98)}${note(108)}</measure></part></score-partwise>`,
    geometry,
    { width: 200, height: 200 },
    [{ text: '1', score: 1, x: 118, y: 176, width: 4, height: 10 }],
  );
  assert.deepEqual(footer.fingerings, []);
});
