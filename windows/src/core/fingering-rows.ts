import { DOMParser } from '@xmldom/xmldom';
import { readSourceLayout } from './layout-evidence';
import {
  sourceNotes,
  confirmedFingeringShape,
  type GlyphObservation,
  type FingeringShapeEvidence,
} from './source-marks';

export interface FingeringRow {
  heads: string[];
  beams: string[];
  marks: { measure: string; note: number; glyph: GlyphObservation }[];
}
export interface FingeringReading {
  row: number;
  mark: number;
  text: string;
  conditionalScore: number;
  likelihood: number;
  shape?: FingeringShapeEvidence;
}
const key = (g: GlyphObservation) => [g.x, g.y, g.width, g.height].join(',');

/** Establish a fingering role before restricting the OCR alphabet. Every head
 * in a complete source beam group must own exactly one similarly sized numeral.
 * A supported tuplet numeral must never receive a fingering-only reading.
 */
export function findFingeringRows(
  xml: string,
  layoutXML: string,
  size: { width: number; height: number },
  glyphs: GlyphObservation[],
) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml'),
    layout = readSourceLayout(layoutXML, size),
    notes = sourceNotes(doc, layout),
    groups = new Map<string, typeof notes>();
  for (const n of notes) {
    if (!n.head || n.head.stemIds.length !== 1 || !n.head.beamIds.length) continue;
    const id = n.head.beamIds.slice().sort().join(',');
    const group = groups.get(id) ?? [];
    group.push(n);
    groups.set(id, group);
  }
  const result: FingeringRow[] = [];
  for (const group of groups.values()) {
    if (group.length < 3 || group.length > 8) continue;
    group.sort((a, b) => a.x - b.x);
    const beamIds = group[0].head!.beamIds.slice().sort(),
      heads = layout.heads.filter((h) => h.beamIds.some((id) => beamIds.includes(id)));
    if (heads.length !== group.length || new Set(group.map((n) => n.source.staff.id)).size !== 1)
      continue;
    const marks: FingeringRow['marks'] = [];
    let eligible = true;
    for (const n of group) {
      const nearby = glyphs.filter(
        (g) =>
          /^[0-9]$/.test(g.text) &&
          g.score >= 0.3 &&
          Math.abs(g.x + g.width / 2 - n.x) <= n.source.spacing * 0.85 &&
          n.y - (g.y + g.height / 2) >= n.source.spacing * 0.75 &&
          n.y - (g.y + g.height / 2) <= n.source.spacing * 8,
      );
      if (nearby.length !== 1) {
        eligible = false;
        break;
      }
      const glyph = nearby[0],
        ratio = n.node.getElementsByTagName('actual-notes')[0]?.textContent?.trim();
      if (ratio === glyph.text) {
        eligible = false;
        break;
      }
      marks.push({ measure: n.measure.getAttribute('number')!, note: n.noteIndex + 1, glyph });
    }
    if (!eligible || new Set(marks.map((m) => key(m.glyph))).size !== group.length) continue;
    const heights = marks.map((m) => m.glyph.height);
    if (Math.min(...heights) / Math.max(...heights) < 0.75) continue;
    const known = marks.filter((m) => /^[0-5]$/.test(m.glyph.text) && m.glyph.score >= 0.75);
    if (
      known.length < 2 ||
      !known.some((m) => /^[01]$/.test(m.glyph.text) && m.glyph.score >= 0.85)
    )
      continue;
    const spacing = group[0].source.spacing,
      x0 = Math.min(...marks.map((m) => m.glyph.x)),
      x1 = Math.max(...marks.map((m) => m.glyph.x + m.glyph.width)),
      y0 = Math.min(...marks.map((m) => m.glyph.y)),
      y1 = Math.max(...marks.map((m) => m.glyph.y + m.glyph.height));
    const tuplet = Array.from(layout.document.getElementsByTagName('tuplet')).some((t) => {
      const b = t.getElementsByTagName('bounds')[0];
      if (!b || t.getAttribute('staff') !== group[0].source.staff.id) return false;
      const x = (Number(b.getAttribute('x')) + Number(b.getAttribute('w')) / 2) / layout.sx,
        y = (Number(b.getAttribute('y')) + Number(b.getAttribute('h')) / 2) / layout.sy;
      return x >= x0 - spacing && x <= x1 + spacing && y >= y0 - spacing && y <= y1 + spacing;
    });
    if (tuplet || marks.every((m) => /^[0-5]$/.test(m.glyph.text) && m.glyph.score >= 0.85))
      continue;
    result.push({ heads: group.map((n) => n.head!.id), beams: beamIds, marks });
  }
  return result;
}

export function applyFingeringReadings(
  glyphs: GlyphObservation[],
  rows: FingeringRow[],
  readings: FingeringReading[],
) {
  const resolved = new Map<string, GlyphObservation>(),
    adopted = [];
  for (const reading of readings) {
    const mark = rows[reading.row]?.marks[reading.mark];
    if (!mark) continue;
    if (/^[0-5]$/.test(mark.glyph.text) && mark.glyph.score >= 0.85) continue;
    const ctc =
      /^[0-5]$/.test(reading.text) && reading.conditionalScore >= 0.9 && reading.likelihood >= 0.01;
    const shape = reading.shape;
    if (
      !ctc &&
      (!shape || !/^[0-5]$/.test(shape.text) || !confirmedFingeringShape(shape, shape.text))
    )
      continue;
    const digit = ctc ? reading.text : shape!.text;
    resolved.set(key(mark.glyph), {
      ...mark.glyph,
      text: digit,
      // Shape error is not an OCR probability. Keep its separate evidence and
      // require explicit verification instead of manufacturing a confidence.
      score: ctc ? reading.conditionalScore : 0,
      ...(!ctc ? { fingeringEvidence: shape } : {}),
    });
    adopted.push({
      ...reading,
      adoptedText: digit,
      method: ctc ? 'conditional-ctc' : 'same-page-shape',
      measure: mark.measure,
      note: mark.note,
      rawText: mark.glyph.text,
      rawScore: mark.glyph.score,
      heads: rows[reading.row].heads,
      beams: rows[reading.row].beams,
    });
  }
  const unresolved = rows.flatMap((row) =>
    row.marks
      .filter(
        (mark) =>
          (!/^[0-5]$/.test(mark.glyph.text) || mark.glyph.score < 0.85) &&
          !resolved.has(key(mark.glyph)),
      )
      .map((mark) => ({ measure: mark.measure, note: mark.note, rawText: mark.glyph.text })),
  );
  return { glyphs: glyphs.map((g) => resolved.get(key(g)) ?? g), adopted, unresolved };
}
