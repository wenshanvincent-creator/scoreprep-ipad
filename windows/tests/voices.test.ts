import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import createModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import { prepareMusic, compilePerformance, type TimePoint } from '../src/core/music';
import { normalizeVoiceOrder } from '../src/core/voices';

const source = () => readFile('../backend/fixtures/recognition-study.musicxml', 'utf8');
const observed = async () =>
  JSON.parse(await readFile('../Fixtures/RecognitionReplay/job.json', 'utf8')).pages[0]
    .musicXML as string;
const module = createModule();
async function rendered(xml: string) {
  const music = prepareMusic(xml, 'piano', false),
    toolkit = new VerovioToolkit(await module);
  try {
    toolkit.setOptions({ inputFrom: 'musicxml' });
    assert.ok(toolkit.loadData(music.xml));
    const performance = compilePerformance(toolkit.renderToTimemap() as TimePoint[], music);
    return {
      events: performance.notes
        .map((n) => JSON.stringify([n.midi, n.quarter, n.endQuarter]))
        .sort(),
      parsed: music.notes
        .map((n) => JSON.stringify([n.staff, n.writtenMidi, n.quarter, n.duration]))
        .sort(),
      groups: performance.groups.length,
      duration: performance.quarterDuration,
    };
  } finally {
    toolkit.destroy();
  }
}
test('actual interleaved piano OMR renders and plays both hands at the independent source onsets', async () => {
  const expected = await rendered(await source()),
    actual = await rendered(await observed());
  assert.equal(expected.events.length, 64);
  assert.equal(expected.groups, 32);
  assert.equal(expected.duration, 32);
  assert.deepEqual(actual, expected);
});

test('voice serialization retains genuine chord tones, source fingerings and is idempotent', async () => {
  const addChord = (xml: string) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const first = doc.getElementsByTagName('note')[0];
    const extra = new DOMParser().parseFromString(
      '<note><chord/><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff><notations><technical><fingering>3</fingering></technical></notations></note>',
      'application/xml',
    ).documentElement!;
    extra.getElementsByTagName('duration')[0].textContent =
      first.getElementsByTagName('duration')[0].textContent;
    first.parentNode!.insertBefore(doc.importNode(extra, true), first.nextSibling);
    const mark = new DOMParser().parseFromString(
      '<notations><technical><fingering>1</fingering></technical></notations>',
      'application/xml',
    ).documentElement!;
    first.appendChild(doc.importNode(mark, true));
    return new XMLSerializer().serializeToString(doc);
  };
  const raw = addChord(await observed()),
    expected = addChord(await source());
  assert.deepEqual(await rendered(raw), await rendered(expected));
  const doc = new DOMParser().parseFromString(raw, 'application/xml');
  normalizeVoiceOrder(doc);
  const serialize = () => new XMLSerializer().serializeToString(doc);
  const once = serialize();
  assert.deepEqual(
    Array.from(doc.getElementsByTagName('fingering'))
      .map((n) => n.textContent)
      .sort(),
    ['1', '3'],
  );
  normalizeVoiceOrder(doc);
  assert.equal(serialize(), once);
});
