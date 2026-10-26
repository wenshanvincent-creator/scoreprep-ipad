import { DOMParser, XMLSerializer, type Element as XmlElement } from '@xmldom/xmldom';
import { instrumentFor, type Instrument } from './instruments';
import { completeEngraving } from './engraving';
import { normalizeVoiceOrder } from './voices';
export interface NotatedNote {
  id: string;
  measureId: string;
  measureIndex: number;
  staff: number;
  midi: number;
  writtenMidi: number;
  quarter: number;
  duration: number;
  sourceFingering: string;
  sourceString: string;
  rest: boolean;
  grace: boolean;
  hand: number;
}
export interface NotatedMeasure {
  id: string;
  index: number;
  label: string;
  start: number;
  duration: number;
  beats: number;
  beatType: number;
}
export interface PreparedMusic {
  xml: string;
  title: string;
  partName: string;
  notes: NotatedNote[];
  measures: NotatedMeasure[];
  missingFingerings: number;
}
export interface TimePoint {
  on?: string[];
  off?: string[];
  qstamp: number;
  tstamp: number;
  tempo?: number;
}
export interface SoundNote {
  id: string;
  midi: number;
  start: number;
  end: number;
  quarter: number;
  endQuarter: number;
  measureIndex: number;
}
export interface PerformanceGroup {
  index: number;
  ids: string[];
  pitches: number[];
  quarter: number;
  seconds: number;
  measureIndex: number;
  occurrence: number;
}
export interface Performance {
  notes: SoundNote[];
  groups: PerformanceGroup[];
  duration: number;
  quarterDuration: number;
}
const elements = (e: XmlElement, name?: string): XmlElement[] =>
  [...Array.from(e.childNodes)].filter(
    (n): n is XmlElement => n.nodeType === 1 && (!name || n.nodeName === name),
  );
const child = (e: XmlElement, name: string) => elements(e, name)[0];
const content = (e: XmlElement, name: string) => child(e, name)?.textContent?.trim() ?? '';
const descendants = (e: XmlElement, name: string) => Array.from(e.getElementsByTagName(name));
const pitchClasses: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function number(e: XmlElement, name: string, fallback: number) {
  const s = content(e, name);
  const value = s === '' ? fallback : Number(s);
  if (!Number.isFinite(value)) throw new Error(`识别结果中 ${name} 的数值无效。`);
  return value;
}
function make(e: XmlElement, name: string, value?: string) {
  const node = e.ownerDocument!.createElement(name);
  if (value !== undefined) node.appendChild(e.ownerDocument!.createTextNode(value));
  return node;
}

interface Finger {
  finger: number;
  string: number;
  position: number;
  cost: number;
  previous: number;
}
function candidates(note: NotatedNote, profile: Instrument): Finger[] {
  const result: Finger[] = [];
  if (!profile.strings.length) return result;
  profile.strings.forEach((open, stringIndex) => {
    const distance = note.midi - open,
      string = profile.strings.length - stringIndex;
    if (distance === 0)
      for (let position = 0; position <= 16; position++)
        result.push({ finger: 0, string, position, cost: position * 0.01, previous: -1 });
    if (profile.family === 'guitar') {
      for (let position = 0; position <= 12; position++) {
        const finger = distance - position;
        if (finger >= 1 && finger <= 4)
          result.push({ finger, string, position, cost: position * 0.18, previous: -1 });
      }
    } else if (profile.id === 'cello') {
      for (let position = -1; position <= 16; position++)
        for (let finger = 1; finger <= 4; finger++)
          if (distance === position + finger + 1)
            result.push({
              finger,
              string,
              position,
              cost: Math.max(0, position) * 0.28 + (position < 0 ? 0.6 : 0),
              previous: -1,
            });
    } else if (profile.id === 'bass') {
      for (let position = 0; position <= 18; position++)
        for (const [finger, offset] of [
          [1, 1],
          [2, 2],
          [4, 3],
        ])
          if (distance === position + offset)
            result.push({ finger, string, position, cost: position * 0.28, previous: -1 });
    } else {
      for (let position = 0; position <= 14; position++)
        for (const [finger, offset] of [
          [1, 1],
          [1, 2],
          [2, 3],
          [2, 4],
          [3, 5],
          [3, 6],
          [4, 7],
        ])
          if (distance === position + offset)
            result.push({
              finger,
              string,
              position,
              cost: position * 0.28 + (finger === 1 && offset === 1 ? 0.2 : 0),
              previous: -1,
            });
    }
  });
  return result.filter(
    (f) =>
      (!note.sourceFingering || Number(note.sourceFingering) === f.finger) &&
      (!note.sourceString || Number(note.sourceString) === f.string),
  );
}
function recommendStrings(notes: NotatedNote[], profile: Instrument): Map<string, Finger> {
  const result = new Map<string, Finger>(),
    lanes = new Map<number, NotatedNote[]>();
  for (const note of notes)
    if (!note.rest && !note.grace) {
      const lane = lanes.get(note.staff) ?? [];
      lane.push(note);
      lanes.set(note.staff, lane);
    }
  type Shape = { fingers: Finger[]; position: number; cost: number; previous: number };
  for (const lane of lanes.values()) {
    lane.sort((a, b) => a.quarter - b.quarter || a.midi - b.midi);
    const groups: NotatedNote[][] = [];
    for (const n of lane) {
      if (groups.at(-1)?.[0].quarter === n.quarter) groups.at(-1)!.push(n);
      else groups.push([n]);
    }
    let layers: Shape[][] = [],
      sequence: NotatedNote[][] = [];
    const finish = () => {
      if (!layers.length) return;
      let index = layers
        .at(-1)!
        .reduce((best, f, i, all) => (f.cost < all[best].cost ? i : best), 0);
      for (let i = layers.length - 1; i >= 0; i--) {
        const shape = layers[i][index];
        sequence[i].forEach((n, j) => result.set(n.id, shape.fingers[j]));
        index = shape.previous;
      }
      layers = [];
      sequence = [];
    };
    for (const group of groups) {
      const shapes: Shape[] = [];
      if (profile.family === 'keyboard') {
        const left = group[0].staff > 1;
        const assign = (index: number, chosen: Finger[]) => {
          if (index === group.length) {
            const position =
              group.reduce(
                (sum, n, i) => sum + n.midi + (left ? 1 : -1) * (chosen[i].finger - 1) * 2,
                0,
              ) / group.length;
            const span = group.at(-1)!.midi - group[0].midi;
            shapes.push({
              fingers: chosen,
              position,
              cost: Math.max(0, span - 9) * 0.7,
              previous: -1,
            });
            return;
          }
          const note = group[index];
          for (let f = 1; f <= 5; f++) {
            if (note.sourceFingering && Number(note.sourceFingering) !== f) continue;
            if (index) {
              const prior = chosen[index - 1].finger,
                interval = note.midi - group[index - 1].midi;
              if (left ? f >= prior : f <= prior) continue;
              if (interval > Math.abs(f - prior) * 3 + 2) continue;
            }
            assign(index + 1, [
              ...chosen,
              { finger: f, string: 0, position: 0, cost: 0, previous: -1 },
            ]);
          }
        };
        if (group.length <= 5 && group.at(-1)!.midi - group[0].midi <= 12) assign(0, []);
      } else if (profile.strings.length) {
        const sets = group.map((n) => candidates(n, profile));
        const assign = (index: number, chosen: Finger[]) => {
          if (shapes.length > 2000) return;
          if (index === group.length) {
            shapes.push({
              fingers: chosen,
              position: chosen.find((f) => f.finger !== 0)?.position ?? 0,
              cost: chosen.reduce((sum, f) => sum + f.cost, 0),
              previous: -1,
            });
            return;
          }
          for (const f of sets[index]) {
            if (chosen.some((p) => p.string === f.string)) continue;
            if (f.finger !== 0 && chosen.some((p) => p.finger !== 0 && p.position !== f.position))
              continue;
            if (
              profile.family === 'bowed' &&
              chosen.length &&
              Math.abs(chosen.at(-1)!.string - f.string) !== 1
            )
              continue;
            assign(index + 1, [...chosen, f]);
          }
        };
        if (group.length <= profile.strings.length) assign(0, []);
      }
      if (!shapes.length) {
        finish();
        continue;
      }
      const prior = layers.at(-1);
      if (prior)
        for (const shape of shapes) {
          let best = Infinity;
          prior.forEach((p, i) => {
            const value =
              p.cost +
              Math.abs(p.position - shape.position) * (profile.family === 'keyboard' ? 0.6 : 3.5) +
              Math.abs(p.fingers[0].string - shape.fingers[0].string) * 0.45;
            if (value < best) {
              best = value;
              shape.previous = i;
            }
          });
          shape.cost += best;
        }
      layers.push(shapes);
      sequence.push(group);
    }
    finish();
  }
  return result;
}

export function prepareMusic(
  xml: string,
  instrumentId: string,
  showRecommendations = true,
): PreparedMusic {
  if (/<!ENTITY/i.test(xml)) throw new Error('识别结果包含不支持的 XML 实体。');
  const doc = new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') throw new Error(`识别谱格式错误：${message}`);
    },
  }).parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (!root || root.nodeName !== 'score-partwise')
    throw new Error('本地识别未生成完整的 MusicXML 乐谱。');
  const profile = instrumentFor(instrumentId),
    parts = elements(root, 'part');
  if (parts.length !== 1) throw new Error('这份识别结果包含多个乐器声部，请导入对应乐器的分谱。');
  normalizeVoiceOrder(doc);
  const part = parts[0],
    notes: NotatedNote[] = [],
    measures: NotatedMeasure[] = [];
  let divisions = 1,
    beats = 4,
    beatType = 4,
    transpose = profile.transpose,
    scoreQuarter = 0;
  const title =
    doc.getElementsByTagName('work-title')[0]?.textContent?.trim() ||
    doc.getElementsByTagName('movement-title')[0]?.textContent?.trim() ||
    '';
  const partName = doc.getElementsByTagName('part-name')[0]?.textContent?.trim() || '';
  elements(part, 'measure').forEach((measure, measureIndex) => {
    const measureId = `measure-${measureIndex}`;
    measure.setAttribute('id', measureId);
    let cursor = 0,
      extent = 0,
      previousOnset = 0;
    for (const node of elements(measure)) {
      if (node.nodeName === 'attributes') {
        divisions = number(node, 'divisions', divisions);
        if (divisions <= 0) throw new Error('识别结果的时值单位无效。');
        const time = child(node, 'time');
        if (time) {
          const raw = content(time, 'beats');
          beats = raw.split('+').reduce((sum, v) => sum + Number(v), 0);
          beatType = number(time, 'beat-type', beatType);
          if (!(beats > 0 && beatType > 0)) throw new Error('识别未能确定拍号。');
        }
        const shift = child(node, 'transpose');
        if (shift)
          transpose = number(shift, 'chromatic', 0) + number(shift, 'octave-change', 0) * 12;
        if (profile.id === 'cello')
          for (const clef of elements(node, 'clef')) {
            for (const c of elements(clef)) clef.removeChild(c);
            clef.appendChild(make(clef, 'sign', 'F'));
            clef.appendChild(make(clef, 'line', '4'));
          }
      } else if (node.nodeName === 'backup' || node.nodeName === 'forward') {
        cursor += ((node.nodeName === 'backup' ? -1 : 1) * number(node, 'duration', 0)) / divisions;
        if (cursor < -1e-6) throw new Error(`第 ${measureIndex + 1} 小节的声部时序无法还原。`);
        extent = Math.max(extent, cursor);
      } else if (node.nodeName === 'note') {
        const id = `note-${measureIndex}-${notes.length}`,
          chord = !!child(node, 'chord'),
          grace = !!child(node, 'grace'),
          rest = !!child(node, 'rest');
        const duration = grace ? 0 : number(node, 'duration', NaN) / divisions;
        if (!Number.isFinite(duration) || duration < 0)
          throw new Error(`第 ${measureIndex + 1} 小节有无法还原的音符时值。`);
        const onset = chord ? previousOnset : cursor;
        const pitch = child(node, 'pitch');
        if (!rest && !pitch) throw new Error('当前识别结果包含无确定音高的音符。');
        const writtenMidi = pitch
          ? 12 * (number(pitch, 'octave', 4) + 1) +
            (pitchClasses[content(pitch, 'step')] ?? NaN) +
            number(pitch, 'alter', 0)
          : 0;
        if (!rest && (!Number.isInteger(writtenMidi) || writtenMidi < 0 || writtenMidi > 127))
          throw new Error('识别结果中有无法还原的音高。');
        node.setAttribute('id', id);
        notes.push({
          id,
          measureId,
          measureIndex,
          staff: number(node, 'staff', 1),
          midi: writtenMidi + transpose,
          writtenMidi,
          quarter: scoreQuarter + onset,
          duration,
          sourceFingering: descendants(node, 'fingering')[0]?.textContent?.trim() ?? '',
          sourceString: descendants(node, 'string')[0]?.textContent?.trim() ?? '',
          rest,
          grace,
          hand: number(node, 'staff', 1),
        });
        extent = Math.max(extent, onset + duration);
        if (!chord) {
          previousOnset = cursor;
          cursor += duration;
        }
      }
    }
    if (!(extent > 0)) throw new Error(`第 ${measureIndex + 1} 小节没有完整的音乐时值。`);
    const full = (beats * 4) / beatType;
    if (
      extent > full + 1e-6 ||
      (extent < full - 1e-6 &&
        measureIndex !== 0 &&
        measureIndex !== elements(part, 'measure').length - 1 &&
        measure.getAttribute('implicit') !== 'yes')
    )
      throw new Error(
        `第 ${measureIndex + 1} 小节的识别时值与拍号不符，软件未能完整还原这一小节。`,
      );
    measures.push({
      id: measureId,
      index: measureIndex,
      label: measure.getAttribute('number') || String(measureIndex + 1),
      start: scoreQuarter,
      duration: extent,
      beats,
      beatType,
    });
    scoreQuarter += extent;
  });
  if (!notes.some((n) => !n.rest)) throw new Error('没有识别到可演奏的音符。');
  const recommendations = showRecommendations
    ? recommendStrings(notes, profile)
    : new Map<string, Finger>();
  let missingFingerings = 0;
  for (const note of notes)
    if (!note.rest && !note.sourceFingering && showRecommendations) {
      const f = recommendations.get(note.id);
      if (!f) {
        if (profile.strings.length || profile.family === 'keyboard') missingFingerings++;
        continue;
      }
      const node =
        doc.getElementById(note.id) ??
        Array.from(doc.getElementsByTagName('note')).find((n) => n.getAttribute('id') === note.id)!;
      let notations = child(node, 'notations');
      if (!notations) {
        notations = make(node, 'notations');
        node.appendChild(notations);
      }
      let technical = child(notations, 'technical');
      if (!technical) {
        technical = make(node, 'technical');
        notations.appendChild(technical);
      }
      technical.appendChild(make(node, 'fingering', String(f.finger)));
      if (f.string && !note.sourceString)
        technical.appendChild(make(node, 'string', String(f.string)));
    }
  for (const print of Array.from(doc.getElementsByTagName('print')))
    print.parentNode?.removeChild(print);
  completeEngraving(doc, notes, measures);
  return {
    xml: new XMLSerializer().serializeToString(doc),
    title,
    partName,
    notes,
    measures,
    missingFingerings,
  };
}

export function compilePerformance(points: TimePoint[], music: PreparedMusic): Performance {
  const lookup = new Map(music.notes.map((n) => [n.id, n])),
    active = new Map<string, SoundNote>(),
    notes: SoundNote[] = [],
    groups: PerformanceGroup[] = [];
  let duration = 0,
    quarterDuration = 0,
    occurrence = 0,
    lastMeasure = -1,
    lastNotatedQuarter = -1;
  for (const p of points) {
    const seconds = p.tstamp / 1000;
    duration = Math.max(duration, seconds);
    quarterDuration = Math.max(quarterDuration, p.qstamp);
    for (const id of p.off ?? []) {
      const note = active.get(id);
      if (note) {
        note.end = seconds;
        note.endQuarter = p.qstamp;
        active.delete(id);
      }
    }
    const on = (p.on ?? [])
      .map((id) => ({ id, note: lookup.get(id.replace(/-rend\d+$/, '')) }))
      .filter((v): v is { id: string; note: NotatedNote } => !!v.note && !v.note.rest);
    if (!on.length) continue;
    const measureIndex = on[0].note.measureIndex;
    if (measureIndex !== lastMeasure || on[0].note.quarter <= lastNotatedQuarter) {
      occurrence++;
      lastMeasure = measureIndex;
    }
    lastNotatedQuarter = on[0].note.quarter;
    const group: PerformanceGroup = {
      index: groups.length,
      ids: on.map((v) => v.note.id),
      pitches: [...new Set(on.map((v) => v.note.midi))],
      quarter: p.qstamp,
      seconds,
      measureIndex,
      occurrence,
    };
    groups.push(group);
    for (const v of on) {
      const n = v.note,
        note = {
          id: n.id,
          midi: n.midi,
          start: seconds,
          end: seconds,
          quarter: p.qstamp,
          endQuarter: p.qstamp,
          measureIndex: n.measureIndex,
        };
      notes.push(note);
      active.set(v.id, note);
    }
  }
  if (!groups.length || active.size) throw new Error('识别谱的演奏时间线未能完整生成。');
  return { notes, groups, duration, quarterDuration };
}
