import createModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
self.onmessage = async (event: MessageEvent<string>) => {
  let toolkit: VerovioToolkit | undefined;
  try {
    toolkit = new VerovioToolkit(await createModule());
    toolkit.setOptions({
      inputFrom: 'musicxml-hum',
      pageWidth: 2100,
      pageHeight: 2970,
      scale: 45,
      adjustPageHeight: true,
      footer: 'none',
    });
    if (!toolkit.loadData(event.data) || !toolkit.getPageCount())
      throw new Error('识别谱无法排版，请保留原谱并检查识别结果。');
    const pages = Array.from({ length: toolkit.getPageCount() }, (_, i) =>
      toolkit!.renderToSVG(i + 1),
    );
    self.postMessage({ pages });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  } finally {
    toolkit?.destroy();
  }
};
