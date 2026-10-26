import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { recoverAnticipatedAccidentals } from '../src/core/source-accidentals';
import { prepareMusic } from '../src/core/music';

const [reference, layout] = await Promise.all([
  readFile('tests/fixtures/accidental-carry-study.musicxml', 'utf8'),
  readFile('tests/fixtures/accidental-carry-layout.xml', 'utf8'),
]);
const size = { width: 2400, height: 577 };
const parse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const write = (doc: ReturnType<typeof parse>) => new XMLSerializer().serializeToString(doc);
const events = (xml: string) =>
  prepareMusic(xml, 'cello', false).notes.map((n) => [n.midi, n.quarter, n.duration]);
function anticipated() {
  const doc = parse(reference);
  doc.getElementsByTagName('note')[4].getElementsByTagName('alter')[0].textContent = '1';
  return write(doc);
}

test('literal surrounding signs recover an anticipated accidental and preserve octave and bar resets', () => {
  const wrong = anticipated();
  assert.notDeepEqual(events(wrong), events(reference));
  const result = recoverAnticipatedAccidentals(wrong, layout, size);
  assert.deepEqual(
    result.corrections.map((c) => [c.measure, c.note, c.from, c.to]),
    [['1', 5, 1, 0]],
  );
  assert.deepEqual(events(result.xml), events(reference));
  assert.equal(recoverAnticipatedAccidentals(reference, layout, size).xml, reference);
  assert.equal(recoverAnticipatedAccidentals(result.xml, layout, size).xml, result.xml);
});

test('missing sign evidence, an explicit contrary accidental and ties leave the pitch unchanged', () => {
  const wrong = anticipated(),
    doc = parse(layout),
    natural = Array.from(doc.getElementsByTagName('alter')).find(
      (n) => n.getAttribute('shape') === 'NATURAL',
    )!;
  natural.parentNode!.removeChild(natural);
  assert.equal(recoverAnticipatedAccidentals(wrong, write(doc), size).xml, wrong);
  const marked = parse(wrong),
    sign = marked.createElement('accidental');
  sign.textContent = 'sharp';
  marked.getElementsByTagName('note')[4].appendChild(sign);
  const explicit = write(marked);
  assert.equal(recoverAnticipatedAccidentals(explicit, layout, size).xml, explicit);
  for (const tag of ['tie', 'tied']) {
    const doc = parse(wrong),
      tie = doc.createElement(tag);
    tie.setAttribute('type', 'stop');
    doc.getElementsByTagName('note')[4].appendChild(tie);
    const tied = write(doc);
    assert.equal(recoverAnticipatedAccidentals(tied, layout, size).xml, tied);
  }
});

test('the source measure boundary prevents carrying an accidental across a model-merged bar', () => {
  const doc = parse(layout),
    first = doc.getElementsByTagName('stack')[0];
  first.setAttribute('right', '1500');
  const following = first.cloneNode(true) as typeof first;
  following.setAttribute('id', 'extra');
  following.setAttribute('left', '1500');
  following.setAttribute('right', '2348');
  first.parentNode!.appendChild(following);
  const wrong = anticipated();
  assert.equal(recoverAnticipatedAccidentals(wrong, write(doc), size).xml, wrong);
});
