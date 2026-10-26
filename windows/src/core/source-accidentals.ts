import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';
import { readSourceLayout } from './layout-evidence';
import { sourceNotes } from './source-marks';

const elements = (e: Element, name: string) =>
  Array.from(e.childNodes).filter((n): n is Element => n.nodeType === 1 && n.nodeName === name);
const alter = (e: Element) =>
  Number(e.getElementsByTagName('pitch')[0].getElementsByTagName('alter')[0]?.textContent || 0);

/** Recover an accidental anticipated from the next occurrence of the same pitch.
 * Both surrounding printed accidentals, the carried pitch, three distinct source
 * heads and the physical measure boundary must agree. No key/meter/target-note
 * guessing or instrument-specific pitch preference enters the decision.
 */
export function recoverAnticipatedAccidentals(
  xml: string,
  layoutXML: string,
  size: { width: number; height: number },
) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml'),
    layout = readSourceLayout(layoutXML, size),
    notes = sourceNotes(doc, layout);
  const bar = (n: (typeof notes)[number]) => {
    if (!n.head) return;
    const matches = layout.bars.filter(
      (b) => b.staffIds.includes(n.head!.staff) && n.head!.x > b.left && n.head!.x < b.right,
    );
    return matches.length === 1 ? matches[0] : undefined;
  };
  const mark = (id: string) => {
    const found = layout.accidentals.filter((a) => a.headIds.includes(id));
    const value = found[0]?.value;
    return found.length === 1 &&
      value !== undefined &&
      found[0].grade >= 0.85 &&
      found[0].linkGrade >= 0.65
      ? { ...found[0], value }
      : undefined;
  };
  const corrections: {
    measure: string;
    note: number;
    from: number;
    to: number;
    sourceHead: string;
    precedingMark: string;
    followingMark: string;
  }[] = [];
  for (const n of notes) {
    if (
      !n.head ||
      n.node.getElementsByTagName('accidental').length ||
      n.node.getElementsByTagName('tie').length ||
      n.node.getElementsByTagName('tied').length ||
      layout.accidentals.some((a) => a.headIds.includes(n.head!.id))
    )
      continue;
    const all = elements(n.measure, 'note');
    if (
      elements(n.measure, 'backup').length ||
      elements(n.measure, 'forward').length ||
      all.some((p) => elements(p, 'chord').length) ||
      new Set(all.map((p) => p.getElementsByTagName('voice')[0]?.textContent || '1')).size !== 1
    )
      continue;
    const lane = notes.filter(
      (p) =>
        p.measure === n.measure &&
        p.source.staff.id === n.source.staff.id &&
        p.diatonic === n.diatonic,
    );
    const index = lane.indexOf(n),
      before = lane[index - 1],
      after = lane[index + 1];
    if (!before?.head || !after?.head || before.x >= n.x || after.x <= n.x) continue;
    const left = mark(before.head.id),
      right = mark(after.head.id),
      physicalBar = bar(n);
    if (
      !left ||
      !right ||
      left.value === right.value ||
      alter(before.node) !== left.value ||
      alter(n.node) !== right.value ||
      !physicalBar ||
      bar(before)?.id !== physicalBar.id ||
      bar(after)?.id !== physicalBar.id
    )
      continue;
    // Every occurrence between the literal signs must be accounted for. A
    // missing note or unresolved accidental prevents a carried-pitch repair.
    const sourceHeads = layout.heads.filter((h) => {
      const source = layout.locate(h);
      return (
        h.staff === n.head!.staff &&
        h.x >= before.x &&
        h.x <= after.x &&
        source &&
        source.clef.middle - h.position === n.diatonic
      );
    });
    if (
      sourceHeads.length !== 3 ||
      sourceHeads.some((h) => ![before.head!.id, n.head!.id, after.head!.id].includes(h.id)) ||
      layout.accidentals.some(
        (a) =>
          a.staff === n.head!.staff &&
          a.position === n.head!.position &&
          a.x > before.x &&
          a.x < after.x &&
          a.id !== right.id,
      )
    )
      continue;
    const pitch = n.node.getElementsByTagName('pitch')[0];
    let value = pitch.getElementsByTagName('alter')[0];
    if (!value) {
      value = doc.createElement('alter');
      pitch.insertBefore(value, pitch.getElementsByTagName('octave')[0]);
    }
    value.textContent = String(left.value);
    corrections.push({
      measure: n.measure.getAttribute('number')!,
      note: n.noteIndex + 1,
      from: right.value,
      to: left.value,
      sourceHead: n.head.id,
      precedingMark: left.id,
      followingMark: right.id,
    });
  }
  return {
    xml: corrections.length ? new XMLSerializer().serializeToString(doc) : xml,
    corrections,
  };
}
