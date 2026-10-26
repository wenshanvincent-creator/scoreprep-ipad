import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';
import { sourceNotes, confirmedFingeringShape, type recoverSourceFingerings } from './source-marks';
import { readSourceLayout } from './layout-evidence';

type Fingering = ReturnType<typeof recoverSourceFingerings>['fingerings'][number];
const children = (e: Element) =>
  Array.from(e.childNodes).filter((n): n is Element => n.nodeType === 1);
const normalize = (e: Element): unknown => [
  e.nodeName,
  Array.from(e.attributes)
    .map((a) => [a.name, a.value])
    .sort(),
  children(e).length ? children(e).map(normalize) : e.textContent?.trim(),
];
const coreNoteTags = new Set([
  'pitch',
  'unpitched',
  'rest',
  'chord',
  'grace',
  'duration',
  'voice',
  'type',
  'dot',
  'staff',
  'time-modification',
  'tie',
]);

function musicalCore(doc: ReturnType<DOMParser['parseFromString']>) {
  return JSON.stringify(
    Array.from(doc.getElementsByTagName('part')).map((part) =>
      children(part)
        .filter((m) => m.nodeName === 'measure')
        .map((measure) => [
          measure.getAttribute('number'),
          children(measure).flatMap((e) => {
            if (e.nodeName === 'note')
              return [
                [
                  'note',
                  children(e)
                    .filter((n) => coreNoteTags.has(n.nodeName))
                    .map(normalize),
                  Array.from(e.getElementsByTagName('tied')).map(normalize),
                ],
              ];
            return ['attributes', 'backup', 'forward', 'barline'].includes(e.nodeName)
              ? [normalize(e)]
              : [];
          }),
        ]),
    ),
  );
}

/** A second inference sees only the confirmed fingering glyphs removed. Accept
 * removal of a trill at those occurrences only if all musical events/context
 * agree. Original pitches, rhythm, other markings and source positions are kept.
 */
export function recoverFingeringOrnaments(
  xml: string,
  comparisonXML: string,
  layoutXML: string,
  size: { width: number; height: number },
  maskedFingerings: Fingering[],
) {
  const parser = new DOMParser(),
    doc = parser.parseFromString(xml, 'application/xml'),
    comparison = parser.parseFromString(comparisonXML, 'application/xml');
  const result = {
    xml,
    corrections: [] as { measure: string; note: number; digit: string }[],
    unresolved: [] as string[],
  };
  if (musicalCore(doc) !== musicalCore(comparison)) {
    result.unresolved.push('去除指法后的对照识别改变了音符或节奏，未采用该结果。');
    return result;
  }
  const measures = Array.from(doc.getElementsByTagName('measure')),
    otherMeasures = Array.from(comparison.getElementsByTagName('measure'));
  const layout = readSourceLayout(layoutXML, size),
    anchors = new Map(sourceNotes(doc, layout).map((n) => [n.node, n.head])),
    otherAnchors = new Map(sourceNotes(comparison, layout).map((n) => [n.node, n.head]));
  for (const mask of maskedFingerings) {
    if (
      !/^[0-5]$/.test(mask.digit) ||
      (mask.score < 0.85 && !confirmedFingeringShape(mask.evidence, mask.digit))
    )
      continue;
    const index = measures.findIndex((m) => m.getAttribute('number') === mask.measure);
    if (index < 0) continue;
    const node = children(measures[index]).filter((n) => n.nodeName === 'note')[mask.note - 1],
      other = children(otherMeasures[index]).filter((n) => n.nodeName === 'note')[mask.note - 1];
    if (!node || !other || other.getElementsByTagName('trill-mark').length) continue;
    const trills = Array.from(node.getElementsByTagName('trill-mark'));
    if (trills.length !== 1) continue;
    const head = anchors.get(node),
      otherHead = otherAnchors.get(other);
    if (!head || !otherHead || head.id !== otherHead.id) {
      result.unresolved.push(`第 ${mask.measure} 小节第 ${mask.note} 音的装饰音定位不一致。`);
      continue;
    }
    trills[0].parentNode!.removeChild(trills[0]);
    result.corrections.push({ measure: mask.measure, note: mask.note, digit: mask.digit });
  }
  if (result.corrections.length) result.xml = new XMLSerializer().serializeToString(doc);
  return result;
}
