import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import createModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
test('bundled WASM preserves actual cloud homr two-staff output, pitches and quarter durations', async () => {
  const xml = await readFile('../backend/fixtures/observed-homr/homr-observed.musicxml', 'utf8');
  const expected = JSON.parse(
    await readFile('../backend/fixtures/observed-homr/quality-report.json', 'utf8'),
  ).expected.pitchedEvents;
  const toolkit = new VerovioToolkit(await createModule());
  try {
    toolkit.setOptions({ inputFrom: 'musicxml-hum', pageWidth: 2100, pageHeight: 2970, scale: 45 });
    assert.ok(toolkit.loadData(xml));
    const mei = toolkit.getMEI();
    const events: unknown[] = [];
    for (const [index, match] of [
      ...mei.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g),
    ].entries())
      for (const staff of match[1].matchAll(/<staff\b[^>]*\bn="(\d+)"[^>]*>([\s\S]*?)<\/staff>/g)) {
        let onset = 0;
        for (const note of staff[2].matchAll(/<note\b([^>]*?)\/>/g)) {
          const attr = Object.fromEntries(
            [...note[1].matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
          );
          assert.equal(attr.dur, '4');
          events.push([
            0,
            index,
            staff[1],
            String(onset++),
            '1',
            attr.pname.toUpperCase(),
            0,
            +attr.oct,
          ]);
        }
      }
    assert.deepEqual(events, expected);
    assert.equal(events.length, 64);
    assert.ok(toolkit.renderToSVG(1).includes('<svg'));
  } finally {
    toolkit.destroy();
  }
});
