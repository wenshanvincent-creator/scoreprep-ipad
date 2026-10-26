export function lowInterline(log: string): number | null {
  const match = /too low interline value of\s+(\d+)\s+pixels/i.exec(log);
  return match ? Number(match[1]) : null;
}
export function recognitionError(code: number | null, log: string): string {
  const lowResolution = lowInterline(log);
  if (lowResolution !== null) {
    return `检测到五线谱线间距仅 ${lowResolution} 像素，图像分辨率不足以识别。请换用原始 PDF，或从原文件重新导出约 300 DPI 的图片；直接放大现有小图无法补回细节。`;
  }
  return `本地识别程序未完成（${code ?? '已中断'}）。`;
}
