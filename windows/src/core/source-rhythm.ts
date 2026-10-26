import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';
import { readSourceLayout } from './layout-evidence';
import { sourceNotes, type GlyphObservation, recoverSourceFingerings } from './source-marks';
const children = (e: Element, tag?: string): Element[] =>
  Array.from(e.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && (!tag || n.nodeName === tag),
  );
const child = (e: Element, tag: string) => children(e, tag)[0];
const text = (e: Element, tag: string) => child(e, tag)?.textContent?.trim() ?? '';
const beats: Record<string, number> = { eighth: 0.5, '16th': 0.25, '32nd': 0.125, '64th': 0.0625 };

/** Resolve a malformed model tuplet only with an independently complete source
 * beam group and image-confirmed non-tuplet numerals. Meter fullness is not used.
 */
export function recoverMalformedTuplets(
  xml: string,
  layoutXML: string,
  size: { width: number; height: number },
  glyphs: GlyphObservation[],
  fingerings: ReturnType<typeof recoverSourceFingerings>['fingerings'],
) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml'),
    layout = readSourceLayout(layoutXML, size);
  const notes = sourceNotes(doc, layout),
    byNode = new Map(notes.map((n) => [n.node, n]));
  const result = {
    xml,
    corrections: [] as {
      measure: string;
      firstNote: number;
      notes: number;
      actual: number;
      normal: number;
      sourceBeams: string[];
    }[],
    unresolved: [] as { measure: string; firstNote: number; reason: string }[],
  };
  let divisions = 1;
  const measures = Array.from(doc.getElementsByTagName('measure'));
  for (const [measureIndex, measure] of measures.entries()) {
    for (const attr of children(measure, 'attributes'))
      divisions = Number(text(attr, 'divisions') || divisions);
    const all = children(measure, 'note');
    if (
      children(measure, 'backup').length ||
      children(measure, 'forward').length ||
      new Set(all.map((n) => text(n, 'voice') || '1')).size !== 1 ||
      new Set(all.map((n) => text(n, 'staff') || '1')).size !== 1
    )
      continue;
    for (let first = 0; first < all.length;) {
      const modification = child(all[first], 'time-modification');
      if (!modification) {
        first++;
        continue;
      }
      const actual = Number(text(modification, 'actual-notes')),
        normal = Number(text(modification, 'normal-notes'));
      let end = first + 1;
      while (end < all.length) {
        const m = child(all[end], 'time-modification');
        if (
          !m ||
          Number(text(m, 'actual-notes')) !== actual ||
          Number(text(m, 'normal-notes')) !== normal
        )
          break;
        end++;
      }
      const group = all.slice(first, end),
        start = first;
      first = end;
      const type = text(group[0], 'type'),
        unit = beats[type],
        duration = unit * divisions,
        level = unit ? Math.log2(1 / unit) : 0;
      const continues = (node: Element | undefined) => {
        const m = node && child(node, 'time-modification');
        return (
          m &&
          Number(text(m, 'actual-notes')) === actual &&
          Number(text(m, 'normal-notes')) === normal &&
          (text(node!, 'voice') || '1') === (text(group[0], 'voice') || '1') &&
          (text(node!, 'staff') || '1') === (text(group[0], 'staff') || '1')
        );
      };
      if (
        (start === 0 &&
          continues(
            measures[measureIndex - 1] && children(measures[measureIndex - 1], 'note').at(-1),
          )) ||
        (end === all.length &&
          continues(measures[measureIndex + 1] && children(measures[measureIndex + 1], 'note')[0]))
      )
        continue;
      if (
        !(actual > 1 && normal > 0) ||
        group.length % actual === 0 ||
        !unit ||
        !Number.isInteger(duration) ||
        group.some(
          (n) =>
            text(n, 'type') !== type ||
            ['chord', 'rest', 'grace', 'dot', 'tie'].some((t) => child(n, t)) ||
            n.getElementsByTagName('tuplet').length ||
            Math.abs(Number(text(n, 'duration')) - (duration * normal) / actual) > 1e-6,
        )
      )
        continue;
      const anchors = group.map((n) => byNode.get(n));
      if (
        anchors.some((n) => !n?.head) ||
        new Set(anchors.map((n) => n!.source.staff.id)).size !== 1
      )
        continue;
      const ids = anchors.map((n) => n!.head!.beamIds.slice().sort());
      const sourceGroup = layout.heads.filter((h) => h.beamIds.some((id) => ids[0].includes(id)));
      if (
        ids[0].length !== level ||
        ids.some((b) => b.join(',') !== ids[0].join(',')) ||
        anchors.some((n) => n!.head!.stemIds.length !== 1) ||
        new Set(anchors.map((n) => n!.head!.stemIds[0])).size !== group.length ||
        sourceGroup.length !== group.length ||
        sourceGroup.some((h) => !anchors.some((n) => n!.head!.id === h.id))
      )
        continue;
      const source = anchors[0]!.source,
        spacing = source.spacing,
        x0 = Math.min(...anchors.map((n) => n!.x)),
        x1 = Math.max(...anchors.map((n) => n!.x));
      const y0 = Math.min(...anchors.map((n) => n!.y)) - spacing * 6,
        y1 = Math.max(...anchors.map((n) => n!.y)) + spacing * 6;
      const nearby = glyphs.filter(
        (g) =>
          g.score >= 0.75 &&
          g.x + g.width / 2 >= x0 - spacing / 2 &&
          g.x + g.width / 2 <= x1 + spacing / 2 &&
          g.y + g.height / 2 >= y0 &&
          g.y + g.height / 2 <= y1,
      );
      // Preserve a matching numerator and any other numeral not independently
      // associated as a source fingering, including repeated duplet signs.
      if (
        nearby.some(
          (g) =>
            g.text === String(actual) ||
            (/^[2-9]$/.test(g.text) &&
              !fingerings.some(
                (f) =>
                  f.digit === g.text &&
                  Math.abs(f.glyph.x - g.x) < 1e-6 &&
                  Math.abs(f.glyph.y - g.y) < 1e-6,
              )),
        )
      ) {
        result.unresolved.push({
          measure: measure.getAttribute('number')!,
          firstNote: start + 1,
          reason: '原图数字与不完整连音组的关系未能确定。',
        });
        continue;
      }
      const sourceTuplet = Array.from(layout.document.getElementsByTagName('tuplet')).some((t) => {
        const b = child(t, 'bounds');
        if (!b || t.getAttribute('staff') !== source.staff.id) return false;
        const x = (Number(b.getAttribute('x')) + Number(b.getAttribute('w')) / 2) / layout.sx;
        const y = (Number(b.getAttribute('y')) + Number(b.getAttribute('h')) / 2) / layout.sy;
        return x >= x0 - spacing / 2 && x <= x1 + spacing / 2 && y >= y0 && y <= y1;
      });
      const label = measure.getAttribute('number')!;
      const mark = fingerings.some(
        (f) =>
          f.measure === label &&
          f.note >= start + 1 &&
          f.note <= end &&
          ['0', '1'].includes(f.digit),
      );
      if (sourceTuplet || !mark) {
        result.unresolved.push({
          measure: label,
          firstNote: start + 1,
          reason: '源符梁组与连音数量不一致，证据不足以修改时值。',
        });
        continue;
      }
      for (const node of group) {
        child(node, 'duration')!.textContent = String(duration);
        node.removeChild(child(node, 'time-modification')!);
      }
      result.corrections.push({
        measure: label,
        firstNote: start + 1,
        notes: group.length,
        actual,
        normal,
        sourceBeams: ids[0],
      });
    }
  }
  if (result.corrections.length) result.xml = new XMLSerializer().serializeToString(doc);
  return result;
}
