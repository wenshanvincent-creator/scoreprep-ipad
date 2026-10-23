export type PulseUnit = 'quarter' | 'eighth' | 'dottedQuarter';
export const pulseQuarters: Record<PulseUnit, number> = {
  quarter: 1,
  eighth: 0.5,
  dottedQuarter: 1.5,
};
export interface Timing {
  quarterBeats: number;
  meter: { numerator: number; denominator: number };
  tempo: { bpm: number; pulse: PulseUnit };
  startingBarPhase: number;
}
export interface Area {
  id: string;
  pageIndex: number;
  bounds: { x: number; y: number; width: number; height: number };
  label: string;
  timing?: Timing[];
}
export interface Section {
  id: string;
  name: string;
  systemIDs: string[];
}
export interface Occurrence {
  id: string;
  sectionID: string;
}
export interface RecognitionPage {
  sourcePageIndex: number;
  state: string;
  musicXML?: string;
  musicXMLSHA256?: string;
  error?: string;
}
export interface RecognitionJob {
  schemaVersion: number;
  id: string;
  state: string;
  completedPages: number;
  engineRevision: string;
  engineName?: string;
  originalSHA256: string;
  pages: RecognitionPage[];
  error?: string;
}
export interface Project {
  id: string;
  title: string;
  sourceFilename: string;
  pageCount: number;
  mediaType: string;
  originalSHA256: string;
  systems: Area[];
  sections: Section[];
  readingOrder: Occurrence[];
  pendingRecognition?: RecognitionJob;
  recognizedEdition?: RecognitionJob;
  updatedAt: string;
}
export interface Span {
  id: string;
  label: string;
  area: Area;
  start: number;
  end: number;
  segments: Timing[];
}
export interface Timeline {
  spans: Span[];
  duration: number;
}
export const barQuarters = (t: Timing) => (t.meter.numerator * 4) / t.meter.denominator;
export const segmentDuration = (t: Timing) =>
  ((t.quarterBeats / pulseQuarters[t.tempo.pulse]) * 60) / t.tempo.bpm;
export const defaultTiming = (): Timing => ({
  quarterBeats: 16,
  meter: { numerator: 4, denominator: 4 },
  tempo: { bpm: 80, pulse: 'quarter' },
  startingBarPhase: 0,
});
export function validateTiming(t: Timing) {
  if (
    !Number.isFinite(t.quarterBeats) ||
    t.quarterBeats <= 0 ||
    t.quarterBeats > 10000 ||
    !Number.isFinite(t.tempo?.bpm) ||
    t.tempo.bpm < 20 ||
    t.tempo.bpm > 300 ||
    !(t.tempo.pulse in pulseQuarters) ||
    !Number.isInteger(t.meter?.numerator) ||
    t.meter.numerator < 1 ||
    t.meter.numerator > 32 ||
    ![1, 2, 4, 8, 16, 32].includes(t.meter.denominator) ||
    !Number.isFinite(t.startingBarPhase) ||
    t.startingBarPhase < 0 ||
    t.startingBarPhase >= barQuarters(t)
  )
    throw new Error('请检查时值、拍号、速度和起始拍位。');
}
export function validateProject(p: Project) {
  if (
    !p ||
    typeof p.title !== 'string' ||
    !p.title.trim() ||
    p.title.length > 200 ||
    !Array.isArray(p.systems) ||
    !Array.isArray(p.sections) ||
    !Array.isArray(p.readingOrder)
  )
    throw new Error('乐谱项目格式不正确。');
  const ids = new Set<string>();
  for (const a of p.systems) {
    const b = a.bounds;
    if (
      ids.has(a.id) ||
      typeof a.id !== 'string' ||
      typeof a.label !== 'string' ||
      !Number.isInteger(a.pageIndex) ||
      a.pageIndex < 0 ||
      a.pageIndex >= p.pageCount ||
      !b ||
      ![b.x, b.y, b.width, b.height].every(Number.isFinite) ||
      b.x < 0 ||
      b.y < 0 ||
      b.width <= 0 ||
      b.height <= 0 ||
      b.x + b.width > 1.000001 ||
      b.y + b.height > 1.000001
    )
      throw new Error('阅读区域超出原谱页面或编号重复。');
    ids.add(a.id);
    if (a.timing) {
      if (!a.timing.length) throw new Error('请填写区域时值。');
      a.timing.forEach(validateTiming);
    }
  }
  const sectionIDs = new Set<string>();
  for (const s of p.sections) {
    if (sectionIDs.has(s.id) || !s.systemIDs.length || !s.systemIDs.every((id) => ids.has(id)))
      throw new Error('段落引用了不存在的阅读区域。');
    sectionIDs.add(s.id);
  }
  const occurrences = new Set<string>();
  for (const o of p.readingOrder) {
    if (occurrences.has(o.id) || !sectionIDs.has(o.sectionID))
      throw new Error('阅读顺序中的段落不存在或编号重复。');
    occurrences.add(o.id);
  }
}
export function compile(p: Project): Timeline {
  validateProject(p);
  if (!p.readingOrder.length) throw new Error('先添加阅读区域和练习顺序。');
  const spans: Span[] = [];
  let cursor = 0;
  for (const occurrence of p.readingOrder) {
    const section = p.sections.find((s) => s.id === occurrence.sectionID)!;
    section.systemIDs.forEach((id, offset) => {
      const area = p.systems.find((a) => a.id === id)!;
      if (!area.timing?.length) throw new Error(`请先确认「${area.label}」的时值。`);
      const start = cursor;
      cursor += area.timing.reduce((sum, t) => sum + segmentDuration(t), 0);
      spans.push({
        id: `${occurrence.id}/${offset}`,
        label: `${section.name} · ${area.label}`,
        area,
        start,
        end: cursor,
        segments: area.timing,
      });
    });
  }
  return { spans, duration: cursor };
}
export function addArea(p: Project, area: Area): Project {
  const id = crypto.randomUUID();
  return {
    ...p,
    systems: [...p.systems, area],
    sections: [...p.sections, { id, name: area.label, systemIDs: [area.id] }],
    readingOrder: [...p.readingOrder, { id: crypto.randomUUID(), sectionID: id }],
  };
}
export function validateJob(value: RecognitionJob, p: Project): RecognitionJob {
  const states = ['queued', 'running', 'succeeded', 'failed', 'skipped'];
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !/^[0-9a-f-]{36}$/i.test(value.id) ||
    !states.includes(value.state) ||
    value.originalSHA256 !== p.originalSHA256 ||
    !Array.isArray(value.pages) ||
    value.pages.length !== p.pageCount ||
    value.pages.some((page, i) => page.sourcePageIndex !== i || !states.includes(page.state)) ||
    value.completedPages !== value.pages.filter((page) => page.state === 'succeeded').length ||
    (value.state === 'succeeded' &&
      value.pages.some((page) => page.state !== 'succeeded' || !page.musicXML))
  )
    throw new Error('识别结果与原文件、页数或任务格式不一致。');
  return value;
}
