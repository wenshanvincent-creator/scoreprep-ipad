import type { Document, Element } from '@xmldom/xmldom';
const children = (e: Element) =>
  Array.from(e.childNodes).filter((n): n is Element => n.nodeType === 1);
const value = (e: Element, name: string) =>
  children(e)
    .find((n) => n.nodeName === name)
    ?.textContent?.trim() ?? '';

/** Serialize explicit MusicXML onsets into contiguous voice/staff lanes.
 * homr interleaves hands with short backups; the direct engraver misaligns that
 * legal ordering. Pitches, durations, chord membership and attached marks stay
 * intact. Timed controls and cross-staff voices retain their input form.
 */
export function normalizeVoiceOrder(doc: Document) {
  for (const measure of Array.from(doc.getElementsByTagName('measure'))) {
    type Attack = {
      onset: number;
      duration: number;
      notes: Element[];
      voice: string;
      staff: string;
    };
    const lanes = new Map<string, Attack[]>(),
      headers: Element[] = [],
      endings: Element[] = [];
    let cursor = 0,
      attack: Attack | undefined,
      eligible = true;
    const voiceStaffs = new Map<string, Set<string>>();
    for (const e of children(measure)) {
      if (e.nodeName === 'backup' || e.nodeName === 'forward') {
        cursor += Number(value(e, 'duration')) * (e.nodeName === 'backup' ? -1 : 1);
      } else if (e.nodeName === 'note') {
        const voice = value(e, 'voice') || '1',
          staff = value(e, 'staff') || '1';
        const staffs = voiceStaffs.get(voice) ?? new Set<string>();
        staffs.add(staff);
        voiceStaffs.set(voice, staffs);
        if (children(e).some((n) => n.nodeName === 'chord')) {
          if (!attack) {
            eligible = false;
            break;
          }
          attack.notes.push(e);
        } else {
          attack = {
            onset: cursor,
            duration: Number(value(e, 'duration') || 0),
            notes: [e],
            voice,
            staff,
          };
          const key = `${staff}:${voice}`,
            lane = lanes.get(key) ?? [];
          lane.push(attack);
          lanes.set(key, lane);
          cursor += attack.duration;
        }
      } else if (e.nodeName === 'barline') {
        if (e.getAttribute('location') === 'middle') eligible = false;
        (e.getAttribute('location') === 'left' ? headers : endings).push(e);
      } else {
        if (Math.abs(cursor) > 1e-6) eligible = false;
        headers.push(e);
      }
    }
    if (!eligible || lanes.size < 2 || [...voiceStaffs.values()].some((s) => s.size > 1)) continue;
    const output: Element[] = [...headers];
    const move = (tag: string, duration: number, lane?: Attack) => {
      const e = doc.createElement(tag),
        d = doc.createElement('duration');
      d.textContent = String(duration);
      e.appendChild(d);
      if (lane)
        for (const [name, text] of [
          ['voice', lane.voice],
          ['staff', lane.staff],
        ]) {
          const child = doc.createElement(name);
          child.textContent = text;
          e.appendChild(child);
        }
      output.push(e);
    };
    cursor = 0;
    for (const lane of lanes.values()) {
      if (cursor) move('backup', cursor);
      cursor = 0;
      for (const a of lane.sort((a, b) => a.onset - b.onset)) {
        if (a.onset < cursor - 1e-6) {
          eligible = false;
          break;
        }
        if (a.onset > cursor + 1e-6) move('forward', a.onset - cursor, a);
        output.push(...a.notes);
        cursor = a.onset + a.duration;
      }
      if (!eligible) break;
    }
    if (!eligible) continue;
    output.push(...endings);
    const comments = Array.from(measure.childNodes).filter((n) => n.nodeType === 8);
    while (measure.firstChild) measure.removeChild(measure.firstChild);
    for (const node of [...comments, ...output]) measure.appendChild(node);
  }
}
