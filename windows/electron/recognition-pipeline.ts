import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { unzipSync, strFromU8 } from 'fflate';
import { prepareRecognitionImage } from './image-preprocess';
import { lowInterline, recognitionError } from './recognition-error';
import { recoverClefInterpretation } from '../src/core/layout-evidence';
import { recoverAnticipatedAccidentals } from '../src/core/source-accidentals';
import { recoverSourceFingerings, type GlyphObservation } from '../src/core/source-marks';
import { recoverMalformedTuplets } from '../src/core/source-rhythm';
import { recoverFingeringOrnaments } from '../src/core/source-ornaments';
import { instrumentFor } from '../src/core/instruments';
import {
  findFingeringRows,
  findWeakFingeringDigits,
  findSparseFingeringContexts,
  applyFingeringReadings,
  type FingeringReading,
} from '../src/core/fingering-rows';

export interface NeuralRuntime {
  python: string;
  worker: string;
}
export type RunRecognitionProcess = (
  executable: string,
  args: string[],
  logFile: string,
  environment?: NodeJS.ProcessEnv,
) => Promise<{ code: number | null; log: string }>;
interface WorkerResult {
  state: string;
  sourceSHA256: string;
  sourceUnchanged: boolean;
  error?: string;
  pages?: { file: string; width: number; height: number; sha256: string }[];
  musicXML?: string;
  glyphs?: string;
  comparisonXML?: string;
  file?: string;
  readings?: FingeringReading[];
  maskedFingerings?: ReturnType<typeof recoverSourceFingerings>['fingerings'];
}

function layoutSheet(bytes: Buffer) {
  const files = unzipSync(bytes),
    names = Object.keys(files).filter((n) => /^sheet#\d+\/sheet#\d+\.xml$/.test(n));
  if (names.length !== 1) throw new Error('当前页面的识别定位不完整。');
  return strFromU8(files[names[0]]);
}

export async function recognizeLocalDocument(options: {
  source: string;
  sourceSHA256: string;
  job: string;
  state: string;
  audiveris: string;
  neural: NeuralRuntime;
  instrument: string;
  run: RunRecognitionProcess;
  phase: (text: string) => Promise<void>;
  validate: (xml: string) => void;
}) {
  const { source, job, run, neural } = options;
  const worker = async (
    mode: string,
    input: string,
    folder: string,
    expectedHash: string,
    args: string[] = [],
  ) => {
    const process = await run(
      neural.python,
      ['-I', '-B', '-X', 'utf8', neural.worker, mode, input, folder, ...args],
      `${folder}.launch.log`,
    );
    let result: WorkerResult;
    try {
      result = JSON.parse(await readFile(path.join(folder, 'result.json'), 'utf8'));
    } catch {
      throw new Error(
        `本地识别组件未能启动（${process.code ?? '已中断'}）。${process.log.slice(-500)}`,
      );
    }
    if (process.code !== 0 || result.state !== 'finished')
      throw new Error(result.error || '本地识别组件未能完成。');
    if (!result.sourceUnchanged || result.sourceSHA256 !== expectedHash)
      throw new Error('识别页面的来源校验不一致。');
    return result;
  };
  await options.phase('正在准备乐谱页面');
  const pageFolder = path.join(job, 'pages'),
    document = await worker('pages', source, pageFolder, options.sourceSHA256);
  const pages = document.pages!;
  const scores: string[] = [],
    reports = [];
  for (const [index, page] of pages.entries()) {
    const label = `第 ${index + 1}/${pages.length} 页`,
      input = path.join(pageFolder, page.file),
      folder = path.join(job, `page-${index + 1}`),
      size = { width: page.width, height: page.height };
    await mkdir(folder);
    const aud = async (image: string, output: string) => {
      await mkdir(output);
      const result = await run(
        path.join(options.audiveris, 'Audiveris.exe'),
        [
          '-batch',
          '-transcribe',
          '-export',
          '-swap',
          '-constant',
          'org.audiveris.omr.sheet.ProcessingSwitches.fingerings=true',
          '-constant',
          'org.audiveris.omr.sheet.ProcessingSwitches.pluckings=true',
          '-output',
          output,
          image,
        ],
        path.join(output, 'recognizer.log'),
        {
          APPDATA: options.state,
          LOCALAPPDATA: options.state,
          'ProgramFiles(x86)': process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
        },
      );
      return { ...result, archive: path.join(output, `${path.parse(image).name}.omr`) };
    };
    await options.phase(`正在定位${label}的谱线与符号`);
    let evidence = await aud(input, path.join(folder, 'layout'));
    const spacing = lowInterline(evidence.log);
    if (evidence.code !== 0 && spacing !== null) {
      const original = await readFile(input),
        prepared = prepareRecognitionImage(original, spacing);
      if (!prepared) throw new Error(recognitionError(evidence.code, evidence.log));
      const preparedFile = path.join(folder, 'scaled.png');
      await writeFile(preparedFile, prepared.png);
      const { png, ...recipe } = prepared;
      await writeFile(
        path.join(folder, 'preprocessing.json'),
        JSON.stringify(
          {
            sourceSHA256: page.sha256,
            measuredInterline: spacing,
            ...recipe,
          },
          null,
          2,
        ),
      );
      const binaryFolder = path.join(folder, 'contrast');
      const { createHash } = await import('node:crypto');
      const binary = await worker(
        'binarize',
        preparedFile,
        binaryFolder,
        createHash('sha256').update(prepared.png).digest('hex'),
      );
      evidence = await aud(
        path.join(binaryFolder, binary.file!),
        path.join(folder, 'adapted-layout'),
      );
    }
    if (evidence.code !== 0) throw new Error(recognitionError(evidence.code, evidence.log));
    const layout = layoutSheet(await readFile(evidence.archive));
    await options.phase(`正在识别${label}的音符与原谱指法`);
    const neuralFolder = path.join(folder, 'neural'),
      recognized = await worker('recognize', input, neuralFolder, page.sha256, [
        '--layout',
        evidence.archive,
      ]),
      raw = await readFile(path.join(neuralFolder, recognized.musicXML!), 'utf8');
    const observations: { sourceSHA256: string; resizeScale: number; glyphs: GlyphObservation[] } =
      JSON.parse(await readFile(path.join(neuralFolder, recognized.glyphs!), 'utf8'));
    if (observations.sourceSHA256 !== page.sha256) throw new Error('原谱标记的来源校验不一致。');
    const interpret = (xml: string) => {
      const clefs = recoverClefInterpretation(xml, layout, size);
      if (clefs.unresolved.length) throw new Error(clefs.unresolved.join('\n'));
      const accidentals = recoverAnticipatedAccidentals(clefs.xml, layout, size);
      const fingerings = recoverSourceFingerings(
        accidentals.xml,
        layout,
        size,
        observations.glyphs,
      );
      return { clefs, accidentals, fingerings };
    };
    let interpreted = interpret(raw);
    // Already source-supported rhythm corrections can disambiguate mark roles.
    // The final edition is still rebuilt and checked after all mark evidence.
    const markContextRhythm = recoverMalformedTuplets(
      interpreted.accidentals.xml,
      layout,
      size,
      observations.glyphs,
      interpreted.fingerings.fingerings,
    );
    const rows =
      instrumentFor(options.instrument).family === 'wind'
        ? []
        : findFingeringRows(markContextRhythm.xml, layout, size, observations.glyphs);
    if (instrumentFor(options.instrument).family !== 'wind') {
      rows.push(
        ...findSparseFingeringContexts(
          markContextRhythm.xml,
          layout,
          size,
          observations.glyphs,
          rows,
        ),
      );
      rows.push(
        ...findWeakFingeringDigits(markContextRhythm.xml, layout, size, observations.glyphs, rows),
      );
    }
    let conditionalFingerings: ReturnType<typeof applyFingeringReadings>['adopted'] = [];
    let unresolvedFingerings: ReturnType<typeof applyFingeringReadings>['unresolved'] = [];
    let unverifiedFingeringDigits: ReturnType<typeof applyFingeringReadings>['unverified'] = [];
    if (rows.length) {
      await options.phase(`正在核对${label}的指法数字`);
      const requests = path.join(folder, 'fingering-rows.json');
      await writeFile(
        requests,
        JSON.stringify({
          sourceSHA256: page.sha256,
          scale: observations.resizeScale,
          rows,
          prototypes: interpreted.fingerings.fingerings,
        }),
      );
      const result = await worker(
        'fingerings',
        input,
        path.join(folder, 'fingering-rows'),
        page.sha256,
        ['--fingerings', requests, '--text-runtime', options.audiveris],
      );
      const resolved = applyFingeringReadings(observations.glyphs, rows, result.readings!);
      observations.glyphs = resolved.glyphs;
      conditionalFingerings = resolved.adopted;
      unresolvedFingerings = resolved.unresolved;
      unverifiedFingeringDigits = resolved.unverified;
      interpreted = interpret(raw);
    }
    const doc = new DOMParser().parseFromString(raw, 'application/xml'),
      measures = Array.from(doc.getElementsByTagName('measure'));
    const masks = interpreted.fingerings.fingerings.filter(
      (f) =>
        measures
          .find((m) => m.getAttribute('number') === f.measure)
          ?.getElementsByTagName('note')
          [f.note - 1]?.getElementsByTagName('trill-mark').length,
    );
    let ornaments: ReturnType<typeof recoverFingeringOrnaments> | undefined;
    if (masks.length) {
      await options.phase(`正在核对${label}的指法与装饰音`);
      const maskFile = path.join(folder, 'fingering-masks.json');
      await writeFile(maskFile, JSON.stringify({ sourceSHA256: page.sha256, fingerings: masks }));
      const comparisonFolder = path.join(folder, 'comparison'),
        comparison = await worker('compare', input, comparisonFolder, page.sha256, [
          '--masks',
          maskFile,
        ]);
      ornaments = recoverFingeringOrnaments(
        raw,
        await readFile(path.join(comparisonFolder, comparison.comparisonXML!), 'utf8'),
        layout,
        size,
        comparison.maskedFingerings!,
      );
      if (ornaments.unresolved.length) throw new Error(ornaments.unresolved.join('\n'));
      interpreted = interpret(ornaments.xml);
    }
    const rhythm = recoverMalformedTuplets(
      interpreted.fingerings.xml,
      layout,
      size,
      observations.glyphs,
      interpreted.fingerings.fingerings,
    );
    const report = {
      page: index,
      sourceSHA256: page.sha256,
      clefs: interpreted.clefs.corrections,
      accidentals: interpreted.accidentals.corrections,
      fingerings: interpreted.fingerings.fingerings,
      fingeringConflicts: interpreted.fingerings.conflicts,
      conditionalFingerings,
      unresolvedFingerings,
      unverifiedFingeringDigits,
      markContextRhythm: markContextRhythm.corrections,
      ornaments: ornaments?.corrections ?? [],
      rhythm: rhythm.corrections,
      unresolvedRhythm: rhythm.unresolved,
    };
    await writeFile(path.join(folder, 'interpretation.json'), JSON.stringify(report, null, 2));
    if (unresolvedFingerings.length)
      throw new Error(
        `未能可靠读取${label}第 ${unresolvedFingerings[0].measure} 小节的原谱指法数字。`,
      );
    if (rhythm.unresolved.length)
      throw new Error(`未能可靠确定${label}第 ${rhythm.unresolved[0].measure} 小节的连音时值。`);
    await writeFile(path.join(folder, 'edition.musicxml'), rhythm.xml);
    options.validate(rhythm.xml);
    scores.push(rhythm.xml);
    reports.push(report);
  }
  const parsed = scores.map((s) => new DOMParser().parseFromString(s, 'application/xml'));
  if (parsed.some((s) => s.getElementsByTagName('part').length !== 1))
    throw new Error('请导入单个乐器的分谱。');
  const combined = parsed[0],
    target = combined.getElementsByTagName('part')[0];
  for (const score of parsed.slice(1))
    for (const m of Array.from(
      score.getElementsByTagName('part')[0].getElementsByTagName('measure'),
    ))
      target.appendChild(combined.importNode(m, true));
  if (parsed.length > 1)
    Array.from(target.getElementsByTagName('measure')).forEach((m, i) =>
      m.setAttribute('number', String(i + 1)),
    );
  const name = combined.getElementsByTagName('part-name')[0];
  if (name?.textContent?.trim() === 'Voice')
    name.textContent = instrumentFor(options.instrument).name;
  const xml = new XMLSerializer().serializeToString(combined);
  options.validate(xml);
  await writeFile(
    path.join(job, 'interpretation.json'),
    JSON.stringify({ pages: reports }, null, 2),
  );
  return xml;
}
