import { DOMParser } from '@xmldom/xmldom';
import { readSourceLayout } from './layout-evidence';
import {
  sourceNotes,
  sourceGlyphOwners,
  confirmedFingeringShape,
  confirmedFingeringGlyph,
  withoutStaffFragments,
  type GlyphObservation,
  type FingeringShapeEvidence,
} from './source-marks';

export interface FingeringRow {
  heads: string[];
  beams: string[];
  marks: { measure: string; note: number; glyph: GlyphObservation }[];
  verificationOnly?: true;
  ambiguousHeads?: string[];
  context?: { head: string; glyph: GlyphObservation }[];
}
export interface FingeringReading {
  row: number;
  mark: number;
  text: string;
  conditionalScore: number;
  likelihood: number;
  shape?: FingeringShapeEvidence;
  partialShape?: FingeringShapeEvidence;
  contrastReadings?: {
    threshold: number;
    text: string;
    conditionalScore: number;
    likelihood: number;
  }[];
  unrestrictedReadings?: { psm: number; text: string; confidence: number }[];
}
const key = (g: GlyphObservation) => [g.x, g.y, g.width, g.height].join(',');

/** Establish a fingering role before restricting the OCR alphabet. Distinct
 * anchored melody stems must own similarly sized numerals. Weak alternative
 * head interpretations on those stems remain recorded; an extra source stem,
 * a strong unassigned head or a supported tuplet prevents a restricted reading.
 * This is mark-role evidence, not permission to repair any rhythm or note.
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
    const stems = new Set(group.map((n) => n.head!.stemIds[0]));
    const extraHeads = heads.filter((h) => !group.some((n) => n.head!.id === h.id));
    if (
      stems.size !== group.length ||
      new Set(group.map((n) => n.source.staff.id)).size !== 1 ||
      extraHeads.some((h) => h.grade >= 0.85 || h.stemIds.some((s) => !stems.has(s)))
    )
      continue;
    const ratios = group.map((n) =>
      Number(n.node.getElementsByTagName('actual-notes')[0]?.textContent || 0),
    );
    if (
      group.some(
        (n) =>
          n.node.getElementsByTagName('chord').length ||
          n.node.getElementsByTagName('tuplet').length,
      ) ||
      (ratios[0] > 1 && ratios.every((n) => n === ratios[0]) && group.length % ratios[0] === 0)
    )
      continue;
    const marks: FingeringRow['marks'] = [];
    let eligible = true;
    for (const n of group) {
      const nearby = withoutStaffFragments(
        glyphs.filter(
          (g) =>
            [...g.text].length === 1 &&
            (/^[0-9]$/.test(g.text) || g.score < 0.85) &&
            Math.abs(g.x + g.width / 2 - n.x) <= n.source.spacing * 0.85 &&
            n.y - (g.y + g.height / 2) >= n.source.spacing * 0.75 &&
            n.y - (g.y + g.height / 2) <= n.source.spacing * 8,
        ),
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
    const known = marks.filter(
      (m) => /^[0-5]$/.test(m.glyph.text) && m.glyph.score >= 0.75 && !m.glyph.proposalOnly,
    );
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
    if (tuplet || marks.every((m) => confirmedFingeringGlyph(m.glyph))) continue;
    result.push({
      heads: group.map((n) => n.head!.id),
      beams: beamIds,
      marks,
      ...(extraHeads.length ? { ambiguousHeads: extraHeads.map((h) => h.id) } : {}),
    });
  }
  return result;
}

/** A weak digit outside a full row may only be corroborated as the same digit
 * by independent page glyphs. It cannot receive a restricted-alphabet answer. */
export function findWeakFingeringDigits(
  xml: string,
  layoutXML: string,
  size: { width: number; height: number },
  glyphs: GlyphObservation[],
  rows: FingeringRow[],
) {
  const used = new Set(rows.flatMap((r) => r.marks.map((m) => key(m.glyph))));
  const weak = glyphs.filter(
    (g) => /^[0-5]$/.test(g.text) && !confirmedFingeringGlyph(g) && !used.has(key(g)),
  );
  if (!weak.length) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const layout = readSourceLayout(layoutXML, size);
  const weakKeys = new Set(weak.map(key));
  const { proposals } = sourceGlyphOwners(
    doc,
    layout,
    glyphs.filter(
      (g) =>
        weakKeys.has(key(g)) ||
        confirmedFingeringGlyph(g) ||
        (!g.proposalOnly && /^[0-9]$/.test(g.text) && g.score >= 0.85),
    ),
  );
  const result: FingeringRow[] = [];
  for (const [note, proposed] of proposals) {
    if (
      !note.head ||
      proposed.length !== 1 ||
      !weakKeys.has(key(proposed[0])) ||
      note.node.getElementsByTagName('fingering').length
    )
      continue;
    result.push({
      heads: [note.head.id],
      beams: note.head.beamIds,
      verificationOnly: true,
      marks: [
        {
          measure: note.measure.getAttribute('number')!,
          note: note.noteIndex + 1,
          glyph: proposed[0],
        },
      ],
    });
  }
  return result;
}

/** Sparse annotations need not label every note in a beam group. Confirm the
 * printed numeric line from at least three already assigned source digits on
 * the same staff, including 0/1, before rereading a same-size glyph in that line.
 * Existing tuplets and ambiguous per-note ownership remain excluded. */
export function findSparseFingeringContexts(
  xml: string,
  layoutXML: string,
  size: { width: number; height: number },
  glyphs: GlyphObservation[],
  rows: FingeringRow[],
) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const layout = readSourceLayout(layoutXML, size);
  const known = [
    ...sourceGlyphOwners(doc, layout, glyphs.filter(confirmedFingeringGlyph)).proposals,
  ].filter(([n, gs]) => n.head && gs.length === 1);
  const used = new Set(rows.flatMap((r) => r.marks.map((m) => key(m.glyph))));
  const candidates = glyphs.filter(
    (g) =>
      [...g.text].length === 1 &&
      (/^[0-9]$/.test(g.text) || g.score < 0.85) &&
      !confirmedFingeringGlyph(g) &&
      !used.has(key(g)),
  );
  const result: FingeringRow[] = [];
  for (const [note, proposed] of sourceGlyphOwners(doc, layout, candidates).proposals) {
    if (
      !note.head ||
      proposed.length !== 1 ||
      note.node.getElementsByTagName('time-modification').length ||
      note.node.getElementsByTagName('fingering').length ||
      note.node.getElementsByTagName('chord').length
    )
      continue;
    const glyph = proposed[0];
    const context = known.filter(
      ([n, gs]) =>
        n.source.staff.id === note.source.staff.id &&
        Math.min(gs[0].height, glyph.height) / Math.max(gs[0].height, glyph.height) >= 0.75,
    );
    if (
      context.length < 3 ||
      new Set(context.map(([, gs]) => gs[0].text)).size < 2 ||
      !context.some(([, gs]) => /^[01]$/.test(gs[0].text))
    )
      continue;
    const ys = context.map(([, gs]) => gs[0].y + gs[0].height / 2),
      y = glyph.y + glyph.height / 2;
    if (
      y < Math.min(...ys) - note.source.spacing * 2 ||
      y > Math.max(...ys) + note.source.spacing * 2
    )
      continue;
    // A source tuplet near the queried glyph has priority over a numeric line.
    if (
      Array.from(layout.document.getElementsByTagName('tuplet')).some((t) => {
        const b = t.getElementsByTagName('bounds')[0];
        if (!b || t.getAttribute('staff') !== note.source.staff.id) return false;
        const x = (Number(b.getAttribute('x')) + Number(b.getAttribute('w')) / 2) / layout.sx;
        const ty = (Number(b.getAttribute('y')) + Number(b.getAttribute('h')) / 2) / layout.sy;
        return (
          Math.abs(x - glyph.x - glyph.width / 2) <= note.source.spacing &&
          Math.abs(ty - y) <= note.source.spacing
        );
      })
    )
      continue;
    result.push({
      heads: [note.head.id],
      beams: note.head.beamIds,
      marks: [{ measure: note.measure.getAttribute('number')!, note: note.noteIndex + 1, glyph }],
      context: context.map(([n, gs]) => ({ head: n.head!.id, glyph: gs[0] })),
    });
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
    if (confirmedFingeringGlyph(mark.glyph)) continue;
    const verificationOnly = rows[reading.row].verificationOnly;
    const shape = reading.shape;
    const corroboratedShape = shape && confirmedFingeringShape(shape, shape.text);
    const partialShape = reading.partialShape;
    const verifiedShape = corroboratedShape
      ? shape
      : partialShape &&
          partialShape.text === shape?.text &&
          confirmedFingeringShape(partialShape, partialShape.text)
        ? partialShape
        : undefined;
    const ctc =
      !verificationOnly &&
      /^[0-5]$/.test(reading.text) &&
      reading.conditionalScore >= 0.9 &&
      reading.likelihood >= 0.01 &&
      (!corroboratedShape || shape.text === reading.text);
    const contrast = reading.contrastReadings;
    const contrastCTC =
      !verificationOnly &&
      contrast?.length === 2 &&
      (!corroboratedShape || shape.text === contrast[0].text) &&
      contrast.every(
        (r) =>
          /^[0-5]$/.test(r.text) &&
          r.text === contrast[0].text &&
          r.conditionalScore >= 0.9 &&
          r.likelihood >= 0.01,
      ) &&
      contrast
        .map((r) => r.threshold)
        .sort((a, b) => a - b)
        .join(',') === '190,220';
    const textReadings = reading.unrestrictedReadings;
    const independentText =
      !verificationOnly &&
      textReadings?.length === 2 &&
      textReadings.every(
        (r) => /^[0-5]$/.test(r.text) && r.text === textReadings[0].text && r.confidence >= 90,
      ) &&
      textReadings
        .map((r) => r.psm)
        .sort((a, b) => a - b)
        .join(',') === '10,13' &&
      (!corroboratedShape || shape.text === textReadings[0].text);
    if (
      !ctc &&
      !contrastCTC &&
      !independentText &&
      (!verifiedShape ||
        !/^[0-5]$/.test(verifiedShape.text) ||
        (verificationOnly && verifiedShape.text !== mark.glyph.text))
    )
      continue;
    const digit = ctc
      ? reading.text
      : contrastCTC
        ? contrast![0].text
        : independentText
          ? textReadings![0].text
          : verifiedShape!.text;
    resolved.set(key(mark.glyph), {
      ...mark.glyph,
      text: digit,
      proposalOnly: false,
      // Shape error is not an OCR probability. Keep its separate evidence and
      // require explicit verification instead of manufacturing a confidence.
      score: ctc
        ? reading.conditionalScore
        : contrastCTC
          ? Math.min(...contrast!.map((r) => r.conditionalScore))
          : independentText
            ? Math.min(...textReadings!.map((r) => r.confidence)) / 100
            : 0,
      ...(!ctc && !contrastCTC && !independentText ? { fingeringEvidence: verifiedShape } : {}),
    });
    adopted.push({
      ...reading,
      adoptedText: digit,
      method: ctc
        ? 'conditional-ctc'
        : contrastCTC
          ? 'contrast-ctc'
          : independentText
            ? 'unrestricted-text'
            : 'same-page-shape',
      measure: mark.measure,
      note: mark.note,
      rawText: mark.glyph.text,
      rawScore: mark.glyph.score,
      heads: rows[reading.row].heads,
      beams: rows[reading.row].beams,
      ...(rows[reading.row].context ? { context: rows[reading.row].context } : {}),
      ...(rows[reading.row].ambiguousHeads
        ? { ambiguousHeads: rows[reading.row].ambiguousHeads }
        : {}),
    });
  }
  const pending = (row: FingeringRow) =>
    row.marks
      .filter((mark) => !confirmedFingeringGlyph(mark.glyph) && !resolved.has(key(mark.glyph)))
      .map((mark) => ({ measure: mark.measure, note: mark.note, rawText: mark.glyph.text }));
  const unresolved = rows.filter((r) => !r.verificationOnly).flatMap(pending);
  const unverified = rows.filter((r) => r.verificationOnly).flatMap(pending);
  return { glyphs: glyphs.map((g) => resolved.get(key(g)) ?? g), adopted, unresolved, unverified };
}
