import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import createModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import {
  prepareMusic,
  compilePerformance,
  type PerformanceGroup,
  type TimePoint,
} from '../src/core/music';
import { ScoreAudioFeatures, ScoreFollower } from '../src/core/following';
import { resolveFingeringTuplets } from '../src/core/omr';
import { DOMParser } from '@xmldom/xmldom';
test('actual cello OMR: constrained fingering-3 repair restores quarters; genuine triplets stay intact', async () => {
  const source = await readFile('tests/fixtures/cello-study.musicxml', 'utf8'),
    observed = await readFile('tests/fixtures/cello-audiveris.musicxml', 'utf8');
  assert.throws(() => prepareMusic(observed, 'cello'), /时值与拍号不符/);
  const resolved = resolveFingeringTuplets(observed);
  assert.equal(resolved.corrections, 2);
  const actual = prepareMusic(resolved.xml, 'cello'),
    expected = prepareMusic(source, 'cello');
  assert.deepEqual(
    actual.notes.map((n) => [n.midi, n.quarter, n.duration]),
    expected.notes.map((n) => [n.midi, n.quarter, n.duration]),
  );
  const digits = (xml: string) =>
    Array.from(
      new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('fingering'),
    ).map((n) => n.textContent);
  assert.deepEqual(digits(actual.xml), digits(source));
  const valid = observed.replace('<beats>4</beats>', '<beats>3</beats>');
  assert.equal(resolveFingeringTuplets(valid).corrections, 0);
});
const note = (step: string, octave = 3, finger = '') =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><type>quarter</type>${finger ? `<notations><technical><fingering>${finger}</fingering></technical></notations>` : ''}</note>`;
const xml = (body: string) =>
  `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Cello</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
const attributes =
  '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>C</sign><line>4</line></clef></attributes>';
test('cello bass-clef rendering preserves pitches, source fingering and a low-position recommendation', () => {
  const source = xml(
      `<measure number="1">${attributes}${note('D', 3, '4')}${note('E')}${note('F')}${note('G')}</measure>`,
    ),
    prepared = prepareMusic(source, 'cello');
  assert.deepEqual(
    prepared.notes.map((n) => n.midi),
    [50, 52, 53, 55],
  );
  assert.match(prepared.xml, /<sign>F<\/sign><line>4<\/line>/);
  assert.equal(prepared.notes[0].sourceFingering, '4');
  assert.match(prepared.xml, /<fingering>4<\/fingering>/);
  assert.equal((prepared.xml.match(/<fingering>/g) ?? []).length, 4);
  assert.equal(prepareMusic(source, 'cello', false).xml.match(/<fingering>/g)?.length, 1);
});
test('notation timing handles actual pickup, compound beat and repeated passages', async () => {
  const module = await createModule(),
    toolkit = new VerovioToolkit(module);
  try {
    const prepared = prepareMusic(
      await readFile('../Fixtures/Practice/pickup-and-pulse.musicxml', 'utf8'),
      'piano',
    );
    toolkit.setOptions({ inputFrom: 'musicxml' });
    assert.ok(toolkit.loadData(prepared.xml));
    const performance = compilePerformance(toolkit.renderToTimemap() as TimePoint[], prepared);
    assert.equal(performance.quarterDuration, 15);
    assert.equal(performance.duration, 13);
    const repeated = prepareMusic(
      xml(
        `<measure number="1">${attributes}<barline location="left"><repeat direction="forward"/></barline>${note('C')}${note('D')}${note('E')}${note('F')}</measure><measure number="2">${note('G')}${note('A')}${note('B')}${note('C', 4)}<barline location="right"><repeat direction="backward"/></barline></measure>`,
      ),
      'cello',
    );
    assert.ok(toolkit.loadData(repeated.xml));
    const repeat = compilePerformance(toolkit.renderToTimemap() as TimePoint[], repeated);
    assert.equal(repeat.groups.length, 16);
    assert.deepEqual(
      repeat.groups.map((g) => g.measureIndex),
      [...Array(4).fill(0), ...Array(4).fill(1), ...Array(4).fill(0), ...Array(4).fill(1)],
    );
    assert.equal(new Set(repeat.groups.map((g) => g.occurrence)).size, 4);
  } finally {
    toolkit.destroy();
  }
});
const groups = (pitches: number[][]): PerformanceGroup[] =>
  pitches.map((pitches, index) => ({
    index,
    ids: [`note-${index}`],
    pitches,
    quarter: index,
    seconds: index,
    measureIndex: Math.floor(index / 4),
    occurrence: 1,
  }));
function signal(pitches: number[], time: number, volume = 0.18) {
  return Float32Array.from(
    { length: 8192 },
    (_, i) =>
      pitches.reduce((sum, midi) => {
        const phase = 2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * (i / 48000 + time);
        return (
          sum + volume * (Math.sin(phase) + 0.6 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase))
        );
      }, 0) / Math.max(1, pitches.length),
  );
}
test('actual harmonic PCM: slow playing, silence, repeated attacks, wrong notes and manual return', () => {
  const features = new ScoreAudioFeatures(),
    follower = new ScoreFollower(groups([[36], [38], [38], [43]]));
  let time = 0,
    position: any;
  const play = (pitches: number[], frames: number) => {
    for (let i = 0; i < frames; i++) {
      time += 0.085;
      position = follower.update(features.process(signal(pitches, time), 48000, time));
    }
  };
  play([36], 20);
  assert.equal(position.index, 0);
  assert.equal(position.status, 'following');
  play([], 30);
  assert.equal(position.index, 0);
  assert.equal(position.status, 'waiting');
  play([38], 20);
  assert.equal(position.index, 1);
  play([38], 40);
  assert.equal(position.index, 1, 'a sustained note cannot advance a repeated pitch');
  play([47], 10);
  assert.equal(position.index, 1, 'wrong pitch cannot advance');
  play([], 4);
  play([38], 5);
  assert.equal(position.index, 2, 'new attack advances one repeated note');
  play([43], 5);
  assert.equal(position.index, 3);
  follower.reset(0);
  play([36], 5);
  assert.equal(position.index, 0);
});
test('polyphonic PCM follows a changed piano chord and waits during silence', () => {
  const features = new ScoreAudioFeatures(),
    follower = new ScoreFollower(
      groups([
        [60, 64, 67],
        [62, 65, 69],
      ]),
      true,
    );
  let position: any,
    time = 0;
  const play = (pitches: number[], frames: number) => {
    for (let i = 0; i < frames; i++) {
      time += 0.085;
      position = follower.update(features.process(signal(pitches, time), 48000, time));
    }
  };
  play([60, 64, 67], 8);
  assert.equal(position.index, 0);
  assert.equal(position.status, 'following');
  play([], 25);
  assert.equal(position.index, 0);
  play([62, 65, 69], 8);
  assert.equal(position.index, 1);
});
