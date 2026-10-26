import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import createModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import { prepareMusic, compilePerformance, type TimePoint } from '../src/core/music';

const document = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const score = (body: string) =>
  `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Original engraving study</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
const attributes = (beats = '4', unit = 4, fifths = 0) =>
  `<attributes><divisions>12</divisions><key><fifths>${fifths}</fifths></key><time><beats>${beats}</beats><beat-type>${unit}</beat-type></time><clef><sign>F</sign><line>4</line></clef></attributes>`;
function note(
  step: string,
  alter = 0,
  duration = 3,
  type = '16th',
  extra = '',
  staff = 1,
  voice = 1,
  octave = 3,
) {
  // Reproduce homr's pitch-only alteration and missing engraving metadata.
  return `<note><pitch><step>${step}</step><octave>${octave}</octave>${alter ? `<alter>${alter}</alter>` : ''}</pitch><duration>${duration}</duration><voice>${voice}</voice><type>${type}</type><staff>${staff}</staff>${extra}</note>`;
}
const svgGroups = (svg: string, name: string) =>
  Array.from(document(svg).getElementsByTagName('g')).filter(
    (g) => g.getAttribute('class') === name,
  );

test('pitch-only chromatic OMR gains visible signs and grouped beams without changing music or printed fingering', async () => {
  const pitches: [string, number][] = [
    ['F', 1],
    ['F', 0],
    ['F', 0],
    ['F', 1],
    ['G', 0],
    ['G', 1],
    ['G', 1],
    ['G', 0],
    ['A', -1],
    ['A', -1],
    ['A', 0],
    ['B', -2],
    ['B', -2],
    ['B', 0],
    ['C', 2],
    ['C', 0],
  ];
  const source = score(
    `<measure number="1">${attributes('4', 4, 1)}${pitches
      .map(([step, alter], index) =>
        note(
          step,
          alter,
          3,
          '16th',
          index === 1
            ? '<notations><technical><fingering>3</fingering></technical><articulations><staccato/></articulations></notations>'
            : '',
          1,
          1,
          index >= 14 ? 4 : 3,
        ),
      )
      .join('')}</measure>`,
  );
  const music = prepareMusic(source, 'cello', false),
    doc = document(music.xml);
  assert.deepEqual(
    music.notes.map((n) => [n.midi, n.quarter, n.duration]),
    [54, 53, 53, 54, 55, 56, 56, 55, 56, 56, 57, 57, 57, 59, 62, 60].map((midi, i) => [
      midi,
      i / 4,
      1 / 4,
    ]),
  );
  assert.deepEqual(
    Array.from(doc.getElementsByTagName('accidental')).map((n) => n.textContent),
    [
      'natural',
      'sharp',
      'sharp',
      'natural',
      'flat',
      'natural',
      'flat-flat',
      'natural',
      'double-sharp',
      'natural',
    ],
  );
  assert.equal(doc.getElementsByTagName('fingering')[0].textContent, '3');
  assert.equal(doc.getElementsByTagName('staccato').length, 1);
  const toolkit = new VerovioToolkit(await createModule());
  try {
    toolkit.setOptions({ inputFrom: 'musicxml' });
    assert.ok(toolkit.loadData(music.xml));
    const svg = toolkit.renderToSVG(1);
    assert.equal(
      svgGroups(svg, 'accid').filter((g) => g.getElementsByTagName('use').length).length,
      10,
    );
    assert.equal(svgGroups(svg, 'beam').length, 4);
    assert.equal(svgGroups(svg, 'flag').length, 0);
    const performance = compilePerformance(toolkit.renderToTimemap() as TimePoint[], music);
    assert.equal(performance.groups.length, 16);
    assert.equal(performance.quarterDuration, 4);
  } finally {
    toolkit.destroy();
  }
  // Re-opening an already completed score must not duplicate its engraving.
  assert.equal(prepareMusic(music.xml, 'cello', false).xml, music.xml);
});

test('compound pulse groups and genuine triplets remain distinct while generated beams preserve durations', () => {
  const triplet = (index: number) =>
    note(
      ['C', 'D', 'E'][index],
      0,
      4,
      'eighth',
      `<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes><normal-type>eighth</normal-type></time-modification>${index === 0 ? '<notations><tuplet type="start" number="1" bracket="yes"/></notations>' : index === 2 ? '<notations><tuplet type="stop" number="1"/></notations>' : ''}`,
    );
  const source =
    score(`<measure number="1">${attributes('6', 8)}${Array.from({ length: 6 }, () => note('D', 0, 6, 'eighth')).join('')}</measure>
    <measure number="2">${attributes()}${[0, 1, 2].map(triplet).join('')}${['F', 'G', 'A'].map((s) => note(s, 0, 12, 'quarter')).join('')}</measure>`);
  const music = prepareMusic(source, 'cello', false),
    doc = document(music.xml);
  assert.deepEqual(
    music.measures.map((m) => m.duration),
    [3, 4],
  );
  assert.deepEqual(
    Array.from(doc.getElementsByTagName('beam')).map((n) => n.textContent),
    ['begin', 'continue', 'end', 'begin', 'continue', 'end', 'begin', 'continue', 'end'],
  );
  assert.equal(doc.getElementsByTagName('time-modification').length, 3);
  assert.equal(doc.getElementsByTagName('tuplet').length, 2);
  assert.deepEqual(
    music.notes.slice(6, 9).map((n) => n.duration),
    [1 / 3, 1 / 3, 1 / 3],
  );
});

test('piano accidental carry is chronological across voices and independent between staves', () => {
  const voice1 =
    note('F', 1, 12, 'quarter') +
    note('G', 0, 12, 'quarter') +
    note('F', 0, 12, 'quarter') +
    note('A', 0, 12, 'quarter');
  const voice2 =
    note('D', 0, 12, 'quarter', '', 1, 2) +
    note('F', 1, 12, 'quarter', '', 1, 2) +
    note('G', 0, 12, 'quarter', '', 1, 2) +
    note('A', 0, 12, 'quarter', '', 1, 2);
  const staff2 = [1, 1, 0, 1].map((alter) => note('F', alter, 12, 'quarter', '', 2, 3, 2)).join('');
  const music = prepareMusic(
    score(
      `<measure number="1">${attributes()}${voice1}<backup><duration>48</duration></backup>${voice2}<backup><duration>48</duration></backup>${staff2}</measure>`,
    ),
    'piano',
    false,
  );
  const signs = Array.from(document(music.xml).getElementsByTagName('note')).map(
    (n) => n.getElementsByTagName('accidental')[0]?.textContent ?? '',
  );
  assert.deepEqual(signs, [
    'sharp',
    '',
    'natural',
    '',
    '',
    '',
    '',
    '',
    'sharp',
    '',
    'natural',
    'sharp',
  ]);
});

test('existing courtesy signs, hidden signs, source beams and cross-bar ties retain their notation', () => {
  const explicit =
    '<accidental parentheses="yes" cautionary="yes">sharp</accidental><beam number="1">begin</beam>';
  const hidden = '<accidental print-object="no">natural</accidental><beam number="1">end</beam>';
  const source =
    score(`<measure number="1">${attributes()}${note('F', 1, 6, 'eighth', explicit)}${note('F', 0, 6, 'eighth', hidden)}${note('G', 0, 24, 'half')}${note('F', 1, 12, 'quarter', '<tie type="start"/>')}</measure>
    <measure number="2">${note('F', 1, 12, 'quarter', '<tie type="stop"/>')}${note('F', 1, 12, 'quarter')}${note('G', 0, 24, 'half')}</measure>`);
  const music = prepareMusic(source, 'cello', false),
    doc = document(music.xml);
  const raw = document(source),
    serialize = new XMLSerializer();
  assert.deepEqual(
    Array.from(doc.getElementsByTagName('beam')).map((n) => serialize.serializeToString(n)),
    Array.from(raw.getElementsByTagName('beam')).map((n) => serialize.serializeToString(n)),
  );
  assert.equal(doc.getElementsByTagName('accidental')[0].getAttribute('parentheses'), 'yes');
  assert.equal(doc.getElementsByTagName('accidental')[1].getAttribute('print-object'), 'no');
  const notes = Array.from(doc.getElementsByTagName('note'));
  assert.equal(notes[4].getElementsByTagName('accidental').length, 0);
  assert.equal(notes[5].getElementsByTagName('accidental')[0].textContent, 'sharp');
});
