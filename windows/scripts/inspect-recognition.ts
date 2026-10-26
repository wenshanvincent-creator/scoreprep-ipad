// Developer quality check. Generated notation and reports may contain private
// scores: use an ignored output directory, never repository fixtures by default.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import createModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import {
  prepareMusic,
  compilePerformance,
  type NotatedNote,
  type TimePoint,
} from '../src/core/music';

const [input, output, reference] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    'Usage: node --import tsx scripts/inspect-recognition.ts INPUT NEW_OUTPUT [REFERENCE]',
  );
const bytes = await readFile(input);
await mkdir(output);
const report: Record<string, unknown> = {
  sha256: createHash('sha256').update(bytes).digest('hex'),
  structuralValidation: 'failed',
  musicalAccuracy: 'not-evaluated',
};
let toolkit: VerovioToolkit | undefined;
try {
  // No recommended fingerings: inspection must expose marks the engine retained.
  const music = prepareMusic(bytes.toString('utf8'), 'cello', false);
  report.structuralValidation = 'passed';
  report.measures = music.measures.length;
  report.pitchedNotes = music.notes.filter((n) => !n.rest).length;
  report.sourceFingerings = music.notes.filter((n) => n.sourceFingering).length;
  if (reference) {
    const expected = prepareMusic(await readFile(reference, 'utf8'), 'cello', false);
    const signature = (n: NotatedNote) =>
      JSON.stringify([
        n.measureIndex,
        n.staff,
        n.writtenMidi,
        n.quarter,
        n.duration,
        n.rest,
        n.grace,
      ]);
    const remaining = [...music.notes];
    let exactEvents = 0,
      preservedFingerings = 0;
    for (const note of expected.notes) {
      const index = remaining.findIndex((n) => signature(n) === signature(note));
      if (index < 0) continue;
      const match = remaining.splice(index, 1)[0];
      exactEvents++;
      if (note.sourceFingering && match.sourceFingering === note.sourceFingering)
        preservedFingerings++;
    }
    report.reference = {
      expectedEvents: expected.notes.length,
      recognizedEvents: music.notes.length,
      exactEvents,
      missingOrChangedEvents: expected.notes.length - exactEvents,
      extraOrChangedEvents: remaining.length,
      expectedFingerings: expected.notes.filter((n) => n.sourceFingering).length,
      preservedFingerings,
    };
    report.musicalAccuracy = 'compared-to-reference';
  }
  toolkit = new VerovioToolkit(await createModule());
  toolkit.setOptions({
    inputFrom: 'musicxml',
    pageWidth: 2200,
    pageHeight: 2400,
    scale: 45,
    adjustPageHeight: true,
    breaks: 'auto',
    footer: 'none',
    header: 'none',
    svgViewBox: true,
  });
  if (!toolkit.loadData(music.xml) || !toolkit.getPageCount()) throw new Error('Engraving failed');
  const performance = compilePerformance(toolkit.renderToTimemap() as TimePoint[], music);
  report.performanceEvents = performance.notes.length;
  report.performanceSeconds = performance.duration;
  report.pages = toolkit.getPageCount();
  for (let i = 1; i <= toolkit.getPageCount(); i++)
    await writeFile(path.join(output, `page-${i}.svg`), toolkit.renderToSVG(i));
  await writeFile(path.join(output, 'view.musicxml'), music.xml);
} catch (error) {
  report.error = (error as Error).message;
  process.exitCode = 1;
} finally {
  toolkit?.destroy();
  await writeFile(path.join(output, 'inspection.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
