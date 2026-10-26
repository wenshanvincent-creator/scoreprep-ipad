import { nativeImage } from 'electron';

export interface PreparedImage {
  png: Buffer;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  scale: number;
  method: 'resize-best';
}

// Adapt a measured small staff to the recognizer's working scale. Preserve the
// imported bytes and avoid expanding severely undersampled notation or huge images.
export function prepareRecognitionImage(bytes: Buffer, interline: number): PreparedImage | null {
  if (!(interline > 0 && interline < 11)) return null;
  const scale = Math.min(3, 24 / interline);
  if (interline * scale < 16) return null;
  const source = nativeImage.createFromBuffer(bytes);
  if (source.isEmpty()) throw new Error('图片无法读取。');
  const { width: sourceWidth, height: sourceHeight } = source.getSize();
  const width = Math.round(sourceWidth * scale),
    height = Math.round(sourceHeight * scale);
  if (width * height > 32_000_000) return null;
  const image = source.resize({ width, height, quality: 'best' });
  return {
    png: image.toPNG(),
    sourceWidth,
    sourceHeight,
    width,
    height,
    scale,
    method: 'resize-best',
  };
}
