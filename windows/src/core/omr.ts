import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';
// Audiveris can confuse a printed fingering 3 with a tuplet numeral. Resolve
// only the observed, metrically impossible four-equally-spaced-quarter pattern.
// A valid triplet, a bracketed group, or a different rhythm is left untouched.
export function resolveFingeringTuplets(xml: string): { xml: string; corrections: number } {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  let divisions = 1,
    beats = 4,
    unit = 4,
    corrections = 0;
  const direct = (e: Element, name: string) =>
    Array.from(e.childNodes).filter((n): n is Element => n.nodeType === 1 && n.nodeName === name);
  const text = (e: Element, name: string) => direct(e, name)[0]?.textContent?.trim() ?? '';
  const globalFingerings = document.getElementsByTagName('fingering').length;
  if (globalFingerings < 3) return { xml, corrections };
  for (const measure of Array.from(document.getElementsByTagName('measure'))) {
    for (const attributes of direct(measure, 'attributes')) {
      divisions = Number(text(attributes, 'divisions') || divisions);
      const time = direct(attributes, 'time')[0];
      if (time) {
        beats = Number(text(time, 'beats'));
        unit = Number(text(time, 'beat-type'));
      }
    }
    const notes = direct(measure, 'note');
    if (
      beats !== 4 ||
      unit !== 4 ||
      notes.length !== 4 ||
      direct(measure, 'backup').length ||
      direct(measure, 'forward').length
    )
      continue;
    if (
      notes.some(
        (n) =>
          text(n, 'type') !== 'quarter' ||
          ['rest', 'chord', 'grace', 'dot', 'tie'].some((tag) => direct(n, tag).length),
      )
    )
      continue;
    const voices = new Set(notes.map((n) => text(n, 'voice')));
    if (voices.size !== 1) continue;
    const extent = notes.reduce((sum, n) => sum + Number(text(n, 'duration')) / divisions, 0);
    if (Math.abs(extent - 3) > 1e-6) continue;
    const x = notes.map((n) => Number(n.getAttribute('default-x'))),
      gaps = x.slice(1).map((v, i) => v - x[i]);
    if (!gaps.every((g) => g > 0) || Math.max(...gaps) / Math.min(...gaps) > 1.15) continue;
    if (!notes.some((n) => n.getElementsByTagName('fingering').length)) continue;
    const start = notes.findIndex((n) =>
      Array.from(n.getElementsByTagName('tuplet')).some((t) => t.getAttribute('type') === 'start'),
    );
    if (start < 0 || start + 2 >= notes.length) continue;
    const triplet = notes.slice(start, start + 3),
      middle = triplet[1];
    if (middle.getElementsByTagName('fingering').length) continue;
    if (
      !triplet.every((n) => {
        const modification = direct(n, 'time-modification')[0];
        return (
          modification &&
          text(modification, 'actual-notes') === '3' &&
          text(modification, 'normal-notes') === '2' &&
          Math.abs(Number(text(n, 'duration')) / divisions - 2 / 3) < 1e-6
        );
      })
    )
      continue;
    const tuplets = triplet.flatMap((n) => Array.from(n.getElementsByTagName('tuplet')));
    if (
      tuplets.length !== 2 ||
      tuplets.some((t) => t.getAttribute('bracket') === 'yes') ||
      tuplets[1].getAttribute('type') !== 'stop'
    )
      continue;
    for (const n of triplet) {
      direct(n, 'duration')[0].textContent = String(divisions);
      for (const node of [
        ...direct(n, 'time-modification'),
        ...Array.from(n.getElementsByTagName('tuplet')),
      ])
        node.parentNode!.removeChild(node);
    }
    let notations = direct(middle, 'notations')[0];
    if (!notations) {
      notations = document.createElement('notations');
      middle.appendChild(notations);
    }
    let technical = direct(notations, 'technical')[0];
    if (!technical) {
      technical = document.createElement('technical');
      notations.appendChild(technical);
    }
    const fingering = document.createElement('fingering');
    fingering.textContent = '3';
    technical.appendChild(fingering);
    corrections++;
  }
  return { xml: corrections ? new XMLSerializer().serializeToString(document) : xml, corrections };
}
