import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';
import { readSourceLayout } from './layout-evidence';

export interface FingeringShapeEvidence {
  method: 'same-page-shape';
  text: string;
  error: number;
  nextError: number;
  visibleFraction?: number;
  ignoredStaffBand?: boolean;
  exemplars: {
    digit: string;
    score: number;
    error: number;
    glyph: { x: number; y: number; width: number; height: number };
  }[];
}
export interface GlyphInkEvidence {
  inkRuns?: [number, number, number][];
  inkScale?: number;
  occludedRuns?: [number, number, number][];
}
export interface GlyphObservation extends GlyphInkEvidence {
  text: string;
  score: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fingeringEvidence?: FingeringShapeEvidence;
  proposalOnly?: boolean;
  view?: string;
}
export function confirmedFingeringShape(e: FingeringShapeEvidence | undefined, digit: string) {
  return (
    !!e &&
    e.method === 'same-page-shape' &&
    e.text === digit &&
    (e.visibleFraction === undefined || e.visibleFraction >= 0.6) &&
    e.error <= 0.03 &&
    e.nextError - e.error >= 0.01 &&
    e.exemplars.length === 2 &&
    e.exemplars.every((p) => p.digit === digit && p.score >= 0.85) &&
    new Set(e.exemplars.map((p) => `${p.glyph.x},${p.glyph.y}`)).size === 2
  );
}
export function confirmedFingeringGlyph(g: GlyphObservation) {
  return (
    /^[0-5]$/.test(g.text) &&
    !g.proposalOnly &&
    (g.score >= 0.85 || confirmedFingeringShape(g.fingeringEvidence, g.text))
  );
}
export function withoutStaffFragments(glyphs: GlyphObservation[]) {
  const originals = glyphs.filter(
    (g) => !g.proposalOnly && /^[0-9]$/.test(g.text) && g.score >= 0.85,
  );
  return originals.length === 1
    ? glyphs.filter((g) => !(g.proposalOnly && g.view?.startsWith('top-staff-line')))
    : glyphs;
}
type Layout = ReturnType<typeof readSourceLayout>;
const children = (e: Element, tag?: string): Element[] =>
  Array.from(e.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && (!tag || n.nodeName === tag),
  );
const child = (e: Element, tag: string) => children(e, tag)[0];
const text = (e: Element, tag: string) => child(e, tag)?.textContent?.trim() ?? '';

export function sourceNotes(doc: ReturnType<DOMParser['parseFromString']>, layout: Layout) {
  const result = [];
  const measures = Array.from(doc.getElementsByTagName('measure'));
  for (const measure of measures) {
    for (const [index, node] of children(measure, 'note').entries()) {
      const pitch = child(node, 'pitch');
      if (!pitch) continue;
      const comment = Array.from(node.childNodes).find(
        (c) => c.nodeType === 8 && /imgpos:/.test(c.textContent ?? ''),
      );
      const point = comment?.textContent?.match(/imgpos:\s*([\d.]+),\s*([\d.]+)/);
      if (!point) continue;
      const raw = { x: Number(point[1]), y: Number(point[2]) },
        source = layout.locate(raw);
      if (!source) continue;
      const diatonic = Number(text(pitch, 'octave')) * 7 + 'CDEFGAB'.indexOf(text(pitch, 'step'));
      const position = source.clef.middle - diatonic;
      const y = source.middleY + (position * source.spacing) / 2;
      let pool = layout.heads.filter(
        (h) =>
          h.staff === source.staff.id &&
          h.position === position &&
          h.grade >= 0.85 &&
          Math.abs(h.x - raw.x) <= source.spacing * 1.75 &&
          Math.abs(h.y - y) < source.spacing * 0.6,
      );
      // A nearby orphan interpretation must not win over a resolved source stem.
      if (pool.some((h) => h.stemIds.length)) pool = pool.filter((h) => h.stemIds.length);
      pool.sort((a, b) => Math.abs(a.x - raw.x) - Math.abs(b.x - raw.x));
      const head =
        pool[0] &&
        (!pool[1] ||
          Math.abs(pool[1].x - raw.x) - Math.abs(pool[0].x - raw.x) >= source.spacing * 0.25)
          ? pool[0]
          : undefined;
      result.push({
        node,
        measure,
        noteIndex: index,
        raw,
        source,
        diatonic,
        head,
        x: head?.x ?? raw.x,
        y: head?.y ?? y,
        projectedY: y,
      });
    }
  }
  // Attention may lag behind consecutive repetitions. Register a single melodic
  // voice against independently detected heads in printed order, allowing missed
  // or extra detections. Chords/multiple voices retain the conservative lookup.
  for (const staff of layout.staves) {
    const row = result.filter((n) => n.source.staff.id === staff.id);
    if (
      !row.length ||
      row.some((n) => child(n.node, 'chord')) ||
      new Set(row.map((n) => text(n.node, 'voice') || '1')).size !== 1
    )
      continue;
    const heads = layout.heads
      .filter((h) => h.staff === staff.id && h.grade >= 0.85)
      .sort((a, b) => a.x - b.x);
    const diatonics = heads.map((h) => {
      const clef = layout.clefs
        .filter((c) => c.staff === staff.id && c.x < h.x && c.grade >= 0.65)
        .sort((a, b) => b.x - a.x)[0];
      return clef ? clef.middle - h.position : NaN;
    });
    const width = heads.length + 1,
      costs = new Float64Array((row.length + 1) * width).fill(Infinity);
    const suffix = new Float64Array(costs.length).fill(Infinity);
    const distance = (i: number, j: number) => {
      const dx = Math.abs(heads[j].x - row[i].raw.x) / row[i].source.spacing;
      return diatonics[j] === row[i].diatonic && dx <= 3 ? dx : Infinity;
    };
    costs[0] = 0;
    for (let i = 0; i <= row.length; i++)
      for (let j = 0; j <= heads.length; j++) {
        if (!i && !j) continue;
        const at = i * width + j;
        costs[at] = Math.min(
          i ? costs[at - width] + 3 : Infinity,
          j ? costs[at - 1] + 1 : Infinity,
          i && j ? costs[at - width - 1] + distance(i - 1, j - 1) : Infinity,
        );
      }
    suffix[suffix.length - 1] = 0;
    for (let i = row.length; i >= 0; i--)
      for (let j = heads.length; j >= 0; j--) {
        if (i === row.length && j === heads.length) continue;
        const at = i * width + j;
        suffix[at] = Math.min(
          i < row.length ? suffix[at + width] + 3 : Infinity,
          j < heads.length ? suffix[at + 1] + 1 : Infinity,
          i < row.length && j < heads.length ? suffix[at + width + 1] + distance(i, j) : Infinity,
        );
      }
    const optimum = costs[costs.length - 1];
    row.forEach((note, i) => {
      const possible: number[] = [];
      let canSkip = false;
      for (let j = 0; j <= heads.length; j++) {
        const at = i * width + j;
        if (Math.abs(costs[at] + 3 + suffix[at + width] - optimum) < 1e-6) canSkip = true;
        if (
          j < heads.length &&
          Math.abs(costs[at] + distance(i, j) + suffix[at + width + 1] - optimum) < 1e-6
        )
          possible.push(j);
      }
      // Only a head common to every optimal registration can become evidence.
      note.head = !canSkip && possible.length === 1 ? heads[possible[0]] : undefined;
      note.x = note.head?.x ?? note.raw.x;
      note.y = note.head?.y ?? note.projectedY;
    });
  }
  // One head cannot establish the ownership of two language-model note tokens.
  const uses = new Map<string, number>();
  for (const note of result)
    if (note.head) uses.set(note.head.id, (uses.get(note.head.id) ?? 0) + 1);
  for (const note of result)
    if (note.head && uses.get(note.head.id)! > 1) {
      note.head = undefined;
      note.x = note.raw.x;
      note.y = note.projectedY;
    }
  return result;
}

/** Geometry and tuplet protection shared by recognition and verification.
 * Passing a glyph here proposes an owner; it does not confirm its text. */
export function sourceGlyphOwners(
  doc: ReturnType<DOMParser['parseFromString']>,
  layout: Layout,
  glyphs: GlyphObservation[],
) {
  const notes = sourceNotes(doc, layout);
  const result = {
    conflicts: [] as string[],
    protectedTupletNumerals: 0,
  };
  const proposals = new Map<(typeof notes)[number], GlyphObservation[]>();
  const lowerEdges = new Map<string, number>();
  for (const head of layout.heads.filter((h) => h.grade >= 0.85))
    lowerEdges.set(head.staff, Math.max(lowerEdges.get(head.staff) ?? -Infinity, head.y));
  for (const glyph of glyphs) {
    const x = glyph.x + glyph.width / 2,
      y = glyph.y + glyph.height / 2;
    const candidates = notes
      .flatMap((note) => {
        const spacing = note.source.spacing;
        if (
          y > (lowerEdges.get(note.source.staff.id) ?? -Infinity) + spacing * 3 ||
          Math.abs(note.x - x) > spacing * 0.85 ||
          Math.abs(note.y - y) < spacing * 0.75 ||
          Math.abs(note.y - y) > spacing * 8
        )
          return [];
        return [
          {
            note,
            cost: (Math.abs(note.x - x) / spacing) * 4 + (Math.abs(note.y - y) / spacing) * 0.1,
          },
        ];
      })
      .sort((a, b) => a.cost - b.cost);
    if (!candidates.length) continue;
    // A numeral agreeing with an existing tuplet is not a new fingering.
    if (
      candidates.some(
        (c) =>
          text(child(c.note.node, 'time-modification') ?? c.note.node, 'actual-notes') ===
          glyph.text,
      )
    ) {
      result.protectedTupletNumerals++;
      continue;
    }
    const best = candidates[0];
    if (candidates[1] && candidates[1].cost - best.cost < 0.8) {
      result.conflicts.push(`数字 ${glyph.text} 的音符归属不明确。`);
      continue;
    }
    const proposed = proposals.get(best.note) ?? [];
    proposed.push(glyph);
    proposals.set(best.note, proposed);
  }
  for (const [note, glyphs] of proposals) proposals.set(note, withoutStaffFragments(glyphs));
  return { ...result, proposals };
}

export function recoverSourceFingerings(
  xml: string,
  layoutXML: string,
  sourceSize: { width: number; height: number },
  glyphs: GlyphObservation[],
) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const layout = readSourceLayout(layoutXML, sourceSize);
  const { proposals, conflicts, protectedTupletNumerals } = sourceGlyphOwners(
    doc,
    layout,
    glyphs.filter(confirmedFingeringGlyph),
  );
  const result = {
    xml,
    fingerings: [] as {
      measure: string;
      note: number;
      digit: string;
      score: number;
      glyph: { x: number; y: number; width: number; height: number } & GlyphInkEvidence;
      evidence?: FingeringShapeEvidence;
    }[],
    conflicts,
    protectedTupletNumerals,
  };
  let added = 0;
  for (const [note, proposed] of proposals) {
    const label = `第 ${note.measure.getAttribute('number')} 小节第 ${note.noteIndex + 1} 音`;
    if (proposed.length !== 1) {
      result.conflicts.push(`${label} 有多个待区分的数字。`);
      continue;
    }
    const glyph = proposed[0],
      existing = Array.from(note.node.getElementsByTagName('fingering'));
    if (
      existing.length &&
      (existing.length !== 1 || existing[0].textContent?.trim() !== glyph.text)
    ) {
      result.conflicts.push(`${label} 的原有指法与字形识别冲突。`);
      continue;
    }
    if (!existing.length) {
      const ensure = (parent: Element, tag: string) => {
        let node = child(parent, tag);
        if (!node) {
          node = doc.createElement(tag);
          parent.appendChild(node);
        }
        return node;
      };
      ensure(ensure(ensure(note.node, 'notations'), 'technical'), 'fingering').textContent =
        glyph.text;
      added++;
    }
    result.fingerings.push({
      measure: note.measure.getAttribute('number')!,
      note: note.noteIndex + 1,
      digit: glyph.text,
      score: glyph.score,
      glyph: {
        x: glyph.x,
        y: glyph.y,
        width: glyph.width,
        height: glyph.height,
        ...(glyph.inkRuns ? { inkRuns: glyph.inkRuns, inkScale: glyph.inkScale } : {}),
        ...(glyph.occludedRuns ? { occludedRuns: glyph.occludedRuns } : {}),
      },
      ...(glyph.fingeringEvidence ? { evidence: glyph.fingeringEvidence } : {}),
    });
  }
  if (added) result.xml = new XMLSerializer().serializeToString(doc);
  return result;
}
