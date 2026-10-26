import createModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import { prepareMusic, compilePerformance, type TimePoint } from './core/music';
const moduleReady = createModule();
self.onmessage = async (
  event: MessageEvent<{
    xml: string;
    instrument: string;
    width: number;
    scale: number;
    fingerings: boolean;
  }>,
) => {
  let toolkit: VerovioToolkit | undefined;
  try {
    const v = event.data,
      music = prepareMusic(v.xml, v.instrument, v.fingerings);
    toolkit = new VerovioToolkit(await moduleReady);
    toolkit.setOptions({
      inputFrom: 'musicxml',
      pageWidth: (Math.max(760, v.width) * 100) / v.scale,
      pageHeight: 2400,
      scale: v.scale,
      adjustPageHeight: true,
      breaks: 'auto',
      footer: 'none',
      header: 'none',
      svgViewBox: true,
    });
    if (!toolkit.loadData(music.xml) || !toolkit.getPageCount())
      throw new Error('识别谱无法排版。');
    const performance = compilePerformance(toolkit.renderToTimemap() as TimePoint[], music);
    const pages = Array.from({ length: toolkit.getPageCount() }, (_, i) =>
      toolkit!.renderToSVG(i + 1),
    );
    self.postMessage({ pages, performance, music });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  } finally {
    toolkit?.destroy();
  }
};
