import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';

interface Point {
  x: number;
  y: number;
}
interface Clef {
  sign: string;
  line: number;
  middle: number;
  x: number;
  staff: string;
  grade: number;
}
interface Staff {
  id: string;
  lines: Point[][];
  left: number;
  right: number;
}
interface Head extends Point {
  id: string;
  staff: string;
  position: number;
  grade: number;
}
interface AnchoredNote {
  node: Element;
  point: Point;
  diatonic: number;
}
interface Segment {
  clef: Element;
  model: Clef;
  notes: AnchoredNote[];
  missingPositions: number;
}
export interface ClefRecovery {
  xml: string;
  corrections: {
    from: string;
    to: string;
    diatonicShift: number;
    notes: number;
    supportingHeads: number;
    matchedHeads: number;
    sourceStaves: string[];
  }[];
  unresolved: string[];
}

const children = (e: Element, tag?: string): Element[] =>
  Array.from(e.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && (!tag || n.nodeName === tag),
  );
const child = (e: Element, tag: string) => children(e, tag)[0];
const value = (e: Element, tag: string) => child(e, tag)?.textContent?.trim() ?? '';
const parse = (xml: string) =>
  new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') throw new Error(`识别定位文件无效：${message}`);
    },
  }).parseFromString(xml, 'application/xml');
const ref: Record<string, number> = { G: 32, F: 24, C: 28 };
const code = (clef: Clef) => `${clef.sign}${clef.line}`;

function lineY(points: Point[], x: number) {
  const right = points.findIndex((p) => p.x >= x);
  if (right <= 0) return points[right === 0 ? 0 : points.length - 1].y;
  const a = points[right - 1],
    b = points[right];
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

function modelClef(node: Element): Clef | undefined {
  const sign = value(node, 'sign'),
    line = Number(value(node, 'line'));
  // Octave clefs need explicit sounding/written-pitch interpretation. Abstain
  // here rather than applying a normal-clef displacement to one of them.
  if (!(sign in ref) || Number(value(node, 'clef-octave-change') || 0)) return;
  return { sign, line, middle: ref[sign] + 2 * (3 - line), x: 0, staff: '', grade: 1 };
}

/** Reconcile a model clef with independently detected source glyphs and heads.
 * Image coordinates must refer to the same source raster, before Audiveris's
 * recorded resize. No instrument, expected notes, bar count or target key is used.
 */
export function recoverClefInterpretation(
  xml: string,
  layoutXML: string,
  sourceSize: { width: number; height: number },
): ClefRecovery {
  const layout = parse(layoutXML),
    picture = layout.getElementsByTagName('picture')[0];
  if (!picture || !(sourceSize.width > 0 && sourceSize.height > 0))
    throw new Error('识别定位缺少原图尺寸。');
  const sx = Number(picture.getAttribute('width')) / sourceSize.width,
    sy = Number(picture.getAttribute('height')) / sourceSize.height;
  if (!(sx > 0 && sy > 0)) throw new Error('识别定位的图像尺寸无效。');
  const staves: Staff[] = Array.from(layout.getElementsByTagName('staff'))
    .filter((s) => child(s, 'lines'))
    .map((s) => ({
      id: s.getAttribute('id')!,
      left: Number(s.getAttribute('left')) / sx,
      right: Number(s.getAttribute('right')) / sx,
      lines: children(child(s, 'lines')!, 'line').map((line) =>
        children(line, 'point').map((p) => ({
          x: Number(p.getAttribute('x')) / sx,
          y: Number(p.getAttribute('y')) / sy,
        })),
      ),
    }))
    .filter((s) => s.lines.length === 5);
  const clefs: Clef[] = Array.from(layout.getElementsByTagName('clef'))
    .filter((c) => c.hasAttribute('shape'))
    .flatMap((c) => {
      const shape = c.getAttribute('shape')!,
        bounds = child(c, 'bounds');
      if (!['F_CLEF', 'G_CLEF', 'C_CLEF'].includes(shape) || !bounds) return [];
      const sign = shape[0],
        position = Number(c.getAttribute('pitch'));
      return [
        {
          sign,
          line: 3 - position / 2,
          middle: ref[sign] + position,
          x: (Number(bounds.getAttribute('x')) + Number(bounds.getAttribute('w')) / 2) / sx,
          staff: c.getAttribute('staff')!,
          grade: Number(c.getAttribute('ctx-grade') || c.getAttribute('grade')),
        },
      ];
    });
  const heads: Head[] = Array.from(layout.getElementsByTagName('head'))
    .filter((h) => child(h, 'bounds'))
    .map((h) => {
      const bounds = child(h, 'bounds')!;
      return {
        id: h.getAttribute('id')!,
        staff: h.getAttribute('staff')!,
        position: Number(h.getAttribute('pitch')),
        grade: Number(h.getAttribute('ctx-grade') || h.getAttribute('grade')),
        x: (Number(bounds.getAttribute('x')) + Number(bounds.getAttribute('w')) / 2) / sx,
        y: (Number(bounds.getAttribute('y')) + Number(bounds.getAttribute('h')) / 2) / sy,
      };
    });
  const locate = (point: Point) => {
    const staff = staves
      .filter((s) => point.x >= s.left && point.x <= s.right)
      .sort(
        (a, b) =>
          Math.abs(lineY(a.lines[2], point.x) - point.y) -
          Math.abs(lineY(b.lines[2], point.x) - point.y),
      )[0];
    if (!staff) return;
    const clef = clefs
      .filter((c) => c.staff === staff.id && c.x < point.x && c.grade >= 0.65)
      .sort((a, b) => b.x - a.x)[0];
    if (!clef) return;
    const spacing = (lineY(staff.lines[4], point.x) - lineY(staff.lines[0], point.x)) / 4;
    return { staff, clef, spacing };
  };
  const doc = parse(xml),
    active = new Map<string, Segment>(),
    segments: Segment[] = [];
  for (const measure of Array.from(doc.getElementsByTagName('measure'))) {
    for (const node of children(measure)) {
      if (node.nodeName === 'attributes') {
        for (const clef of children(node, 'clef')) {
          const staff = clef.getAttribute('number') || '1',
            model = modelClef(clef);
          if (!model) {
            active.delete(staff);
            continue;
          }
          const segment: Segment = { clef, model, notes: [], missingPositions: 0 };
          segments.push(segment);
          active.set(staff, segment);
        }
      } else if (node.nodeName === 'note' && child(node, 'pitch')) {
        const segment = active.get(value(node, 'staff') || '1');
        if (!segment) continue;
        const comment = Array.from(node.childNodes).find(
          (c) => c.nodeType === 8 && /imgpos:/.test(c.textContent ?? ''),
        );
        const match = comment?.textContent?.match(/imgpos:\s*([\d.]+),\s*([\d.]+)/);
        if (!match) {
          segment.missingPositions++;
          continue;
        }
        const pitch = child(node, 'pitch')!;
        segment.notes.push({
          node,
          point: { x: Number(match[1]), y: Number(match[2]) },
          diatonic: Number(value(pitch, 'octave')) * 7 + 'CDEFGAB'.indexOf(value(pitch, 'step')),
        });
      }
    }
  }
  const result: ClefRecovery = { xml, corrections: [], unresolved: [] };
  for (const segment of segments) {
    const located = segment.notes.map((note) => ({ ...note, source: locate(note.point) }));
    const targets = new Set(located.map((n) => (n.source ? code(n.source.clef) : 'unknown')));
    if (targets.size !== 1 || targets.has('unknown') || segment.missingPositions) {
      if (located.some((n) => n.source && code(n.source.clef) !== code(segment.model)))
        result.unresolved.push(`谱号 ${code(segment.model)} 缺少一致的图像定位证据。`);
      continue;
    }
    const target = located[0]?.source?.clef;
    if (!target || code(target) === code(segment.model)) continue;
    const votes = new Map<number, Set<string>>(),
      used = new Set<string>();
    for (const note of located) {
      const { staff, clef, spacing } = note.source!;
      const nearby = heads
        .filter(
          (h) =>
            h.staff === staff.id &&
            h.grade >= 0.85 &&
            Math.abs(h.x - note.point.x) <= spacing &&
            Math.abs(h.y - note.point.y) <= spacing * 2,
        )
        .map((h) => ({
          h,
          distance:
            ((h.x - note.point.x) / (spacing / 2)) ** 2 + ((h.y - note.point.y) / spacing) ** 2,
        }))
        .sort((a, b) => a.distance - b.distance);
      const best = nearby[0];
      if (!best || used.has(best.h.id) || (nearby[1] && nearby[1].distance - best.distance < 0.75))
        continue;
      used.add(best.h.id);
      const shift = clef.middle - best.h.position - note.diatonic;
      const vote = votes.get(shift) ?? new Set<string>();
      vote.add(best.h.id);
      votes.set(shift, vote);
    }
    const expectedShift = target.middle - segment.model.middle;
    const winner = [...votes]
      .filter(([shift]) => shift === 0 || shift === expectedShift)
      .sort((a, b) => b[1].size - a[1].size)[0];
    // These are classifier-grade and evidence-count filters, not calibrated
    // probabilities. No single nearest note can trigger an entire passage edit.
    if (!winner || winner[1].size < 6 || winner[1].size / used.size < 0.9) {
      result.unresolved.push(
        `谱号 ${code(segment.model)} 与图像 ${code(target)} 冲突，符头证据不足。`,
      );
      continue;
    }
    const shift = winner[0];
    for (const note of segment.notes) {
      const pitch = child(note.node, 'pitch')!,
        diatonic = note.diatonic + shift;
      child(pitch, 'step')!.textContent = 'CDEFGAB'[((diatonic % 7) + 7) % 7];
      child(pitch, 'octave')!.textContent = String(Math.floor(diatonic / 7));
    }
    child(segment.clef, 'sign')!.textContent = target.sign;
    child(segment.clef, 'line')!.textContent = String(target.line);
    result.corrections.push({
      from: code(segment.model),
      to: code(target),
      diatonicShift: shift,
      notes: segment.notes.length,
      supportingHeads: winner[1].size,
      matchedHeads: used.size,
      sourceStaves: [...new Set(located.map((n) => n.source!.staff.id))],
    });
  }
  if (result.corrections.length) result.xml = new XMLSerializer().serializeToString(doc);
  return result;
}
