import type { Document, Element } from '@xmldom/xmldom';
import type { NotatedMeasure, NotatedNote } from './music';

const children = (e: Element, name?: string): Element[] =>
  Array.from(e.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && (!name || n.nodeName === name),
  );
const child = (e: Element, name: string) => children(e, name)[0];
const text = (e: Element, name: string) => child(e, name)?.textContent?.trim() ?? '';
interface Entry {
  node: Element;
  note: NotatedNote;
}
interface KeyChange {
  quarter: number;
  staff: number;
  alterations: Map<string, number>;
}

function add(node: Element, name: string, value: string, before: string[]) {
  const element = node.ownerDocument!.createElement(name);
  element.textContent = value;
  node.insertBefore(element, children(node).find((n) => before.includes(n.nodeName)) ?? null);
  return element;
}

function keyAlterations(key: Element): Map<string, number> {
  const result = new Map<string, number>();
  const fifths = text(key, 'fifths');
  if (fifths !== '') {
    const count = Number(fifths),
      order = count > 0 ? 'FCGDAEB' : 'BEADGCF';
    for (let i = 0; i < Math.abs(count); i++)
      result.set(order[i % 7], (result.get(order[i % 7]) ?? 0) + Math.sign(count));
  } else {
    let step = '';
    for (const item of children(key)) {
      if (item.nodeName === 'key-step') step = item.textContent ?? '';
      if (item.nodeName === 'key-alter') result.set(step, Number(item.textContent));
    }
  }
  return result;
}

// Pitch alterations describe sound; MusicXML accidentals describe visible signs.
// Complete missing display data without changing any pitch or musical duration.
function accidentals(
  entries: Entry[],
  changes: KeyChange[],
  keys: Map<number, Map<string, number>>,
) {
  const state = new Map<string, number>();
  const names: Record<number, string> = {
    [-2]: 'flat-flat',
    [-1]: 'flat',
    0: 'natural',
    1: 'sharp',
    2: 'double-sharp',
  };
  const ordered = [...entries].sort((a, b) => a.note.quarter - b.note.quarter);
  let keyIndex = 0;
  changes.sort((a, b) => a.quarter - b.quarter);
  for (let index = 0; index < ordered.length;) {
    const quarter = ordered[index].note.quarter;
    while (keyIndex < changes.length && changes[keyIndex].quarter <= quarter + 1e-6) {
      const change = changes[keyIndex++];
      if (!change.staff) {
        keys.clear();
        state.clear();
      } else {
        for (const key of state.keys()) if (key.startsWith(`${change.staff}:`)) state.delete(key);
      }
      keys.set(change.staff, change.alterations);
    }
    const simultaneous: Entry[] = [];
    while (index < ordered.length && Math.abs(ordered[index].note.quarter - quarter) < 1e-6)
      simultaneous.push(ordered[index++]);
    const values = new Map<string, Set<number>>();
    const pitches = simultaneous
      .filter((entry) => !entry.note.rest)
      .map((entry) => {
        const pitch = child(entry.node, 'pitch')!;
        const step = text(pitch, 'step'),
          alter = Number(text(pitch, 'alter') || 0);
        const key = `${entry.note.staff}:${step}:${text(pitch, 'octave')}`;
        const tied = children(entry.node, 'tie').some((tie) => tie.getAttribute('type') === 'stop');
        const explicit = child(entry.node, 'accidental');
        if (!tied || explicit) {
          const set = values.get(key) ?? new Set<number>();
          set.add(alter);
          values.set(key, set);
        }
        return { ...entry, step, alter, key, tied, explicit };
      });
    for (const entry of pitches) {
      const keySignature = keys.get(entry.note.staff) ?? keys.get(0);
      const previous = state.get(entry.key) ?? keySignature?.get(entry.step) ?? 0;
      if (
        !entry.explicit &&
        !entry.tied &&
        (previous !== entry.alter || (values.get(entry.key)?.size ?? 0) > 1)
      ) {
        const name = names[entry.alter];
        if (!name) throw new Error('识别结果包含当前排版不支持的变音记号。');
        add(entry.node, 'accidental', name, [
          'time-modification',
          'stem',
          'notehead',
          'notehead-text',
          'staff',
          'beam',
          'notations',
          'lyric',
          'play',
          'listen',
        ]);
      }
    }
    for (const [key, alterations] of values)
      state.set(key, alterations.size === 1 ? [...alterations][0] : NaN);
  }
  // A key change after the final note still applies to the next measure.
  for (const change of changes.slice(keyIndex)) {
    if (!change.staff) keys.clear();
    keys.set(change.staff, change.alterations);
  }
}

const beamLevels: Record<string, number> = {
  eighth: 1,
  '16th': 2,
  '32nd': 3,
  '64th': 4,
  '128th': 5,
  '256th': 6,
  '512th': 7,
  '1024th': 8,
};

function beamRun(run: Entry[]) {
  if (run.length < 2) return;
  const levels = run.map((e) => beamLevels[text(e.node, 'type')]);
  run.forEach((entry, index) => {
    for (let level = 1; level <= levels[index]; level++) {
      const left = index > 0 && levels[index - 1] >= level;
      const right = index + 1 < run.length && levels[index + 1] >= level;
      const value =
        left && right
          ? 'continue'
          : right
            ? 'begin'
            : left
              ? 'end'
              : index === run.length - 1
                ? 'backward hook'
                : 'forward hook';
      add(entry.node, 'beam', value, ['notations', 'lyric', 'play', 'listen']).setAttribute(
        'number',
        String(level),
      );
    }
  });
}

function beams(entries: Entry[], measure: NotatedMeasure, groups: number[]) {
  const lanes = new Map<string, Entry[]>();
  for (const entry of entries) {
    if (child(entry.node, 'chord')) continue;
    const laneId = `${entry.note.staff}:${text(entry.node, 'voice') || '1'}`;
    const lane = lanes.get(laneId) ?? [];
    lane.push(entry);
    lanes.set(laneId, lane);
  }
  for (const lane of lanes.values()) {
    // Explicit source beams (including intentional breaks) take precedence.
    if (lane.some((e) => children(e.node, 'beam').length || child(e.node, 'lyric'))) continue;
    lane.sort((a, b) => a.note.quarter - b.note.quarter);
    let run: Entry[] = [],
      group = -1;
    for (const entry of lane) {
      const local = entry.note.quarter - measure.start;
      let boundary = 0,
        currentGroup = 0;
      while (currentGroup < groups.length - 1 && local >= boundary + groups[currentGroup] - 1e-6)
        boundary += groups[currentGroup++];
      const end = boundary + groups[currentGroup];
      const eligible =
        !entry.note.rest &&
        !entry.note.grace &&
        !child(entry.node, 'cue') &&
        !!beamLevels[text(entry.node, 'type')] &&
        local + entry.note.duration <= end + 1e-6;
      const previous = run.at(-1);
      if (
        !eligible ||
        group !== currentGroup ||
        (previous &&
          Math.abs(previous.note.quarter + previous.note.duration - entry.note.quarter) > 1e-6)
      ) {
        beamRun(run);
        run = [];
      }
      group = currentGroup;
      if (eligible) run.push(entry);
    }
    beamRun(run);
  }
}

export function completeEngraving(doc: Document, notes: NotatedNote[], measures: NotatedMeasure[]) {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const keys = new Map<number, Map<string, number>>();
  let divisions = 1,
    grouping: number[] = [1, 1, 1, 1];
  Array.from(doc.getElementsByTagName('measure')).forEach((measure, index) => {
    const entries: Entry[] = [],
      changes: KeyChange[] = [];
    let cursor = measures[index].start;
    for (const node of children(measure)) {
      if (node.nodeName === 'attributes') {
        divisions = Number(text(node, 'divisions') || divisions);
        for (const key of children(node, 'key'))
          changes.push({
            quarter: cursor,
            staff: Number(key.getAttribute('number') || 0),
            alterations: keyAlterations(key),
          });
        const time = child(node, 'time');
        if (time) {
          const raw = text(time, 'beats'),
            unit = Number(text(time, 'beat-type'));
          const count = raw.split('+').map(Number),
            total = count.reduce((a, b) => a + b, 0);
          grouping =
            count.length > 1
              ? count.map((n) => (n * 4) / unit)
              : unit >= 8 && total % 3 === 0
                ? Array(total / 3).fill(12 / unit)
                : Array(total).fill(4 / unit);
        }
      } else if (node.nodeName === 'backup' || node.nodeName === 'forward') {
        cursor +=
          (Number(text(node, 'duration')) / divisions) * (node.nodeName === 'backup' ? -1 : 1);
      } else if (node.nodeName === 'note') {
        const note = byId.get(node.getAttribute('id')!)!;
        entries.push({ node, note });
        if (!child(node, 'chord')) cursor = note.quarter + note.duration;
      }
    }
    accidentals(entries, changes, keys);
    beams(entries, measures[index], grouping);
  });
}
