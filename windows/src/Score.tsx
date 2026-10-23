import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Area, Project } from './core/model';
pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
export class Source {
  private images = new Map<number, Promise<HTMLCanvasElement>>();
  private doc?: Promise<pdfjs.PDFDocumentProxy>;
  private closed = false;
  constructor(readonly project: Project) {}
  page(index: number) {
    if (!this.images.has(index)) this.images.set(index, this.render(index));
    return this.images.get(index)!;
  }
  private async render(index: number) {
    const url = `scoreprep://source/${this.project.id}`,
      canvas = document.createElement('canvas');
    if (this.project.mediaType === 'application/pdf') {
      this.doc ??= fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => pdfjs.getDocument({ data: new Uint8Array(data) }).promise);
      const doc = await this.doc;
      if (this.closed) throw new Error('原谱已关闭。');
      const page = await doc.getPage(index + 1),
        natural = page.getViewport({ scale: 1 }),
        viewport = page.getViewport({ scale: Math.min(2, 1800 / natural.width) });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
    } else {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 2400 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }
  close() {
    this.closed = true;
    void this.doc?.then((doc) => doc.loadingTask.destroy());
    this.images.clear();
  }
}
export function Score({
  source,
  page,
  area,
  onCrop,
  areas,
  onSelect,
}: {
  source: Source;
  page: number;
  area?: Area;
  onCrop?: (bounds: Area['bounds']) => void;
  areas?: Area[];
  onSelect?: (id: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    surface = useRef<HTMLDivElement>(null),
    origin = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Area['bounds'] | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void source
      .page(page)
      .then((image) => {
        if (!active || !canvas.current) return;
        const c = canvas.current,
          b = area?.bounds ?? { x: 0, y: 0, width: 1, height: 1 };
        c.width = Math.max(1, Math.round(image.width * b.width));
        c.height = Math.max(1, Math.round(image.height * b.height));
        c.getContext('2d')!.drawImage(
          image,
          image.width * b.x,
          image.height * b.y,
          image.width * b.width,
          image.height * b.height,
          0,
          0,
          c.width,
          c.height,
        );
        setLoading(false);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [source, page, area]);
  const point = (e: React.PointerEvent) => {
    const r = surface.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };
  const rectangle = (end: { x: number; y: number }) => ({
    x: Math.min(origin.current!.x, end.x),
    y: Math.min(origin.current!.y, end.y),
    width: Math.abs(end.x - origin.current!.x),
    height: Math.abs(end.y - origin.current!.y),
  });
  return (
    <div
      className={`score-surface ${onCrop ? 'croppable' : ''}`}
      ref={surface}
      onPointerDown={(e) => {
        if (!onCrop || loading || e.button !== 0) return;
        origin.current = point(e);
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraft(null);
      }}
      onPointerMove={(e) => {
        if (origin.current) setDraft(rectangle(point(e)));
      }}
      onPointerUp={(e) => {
        if (!origin.current) return;
        const b = rectangle(point(e));
        origin.current = null;
        setDraft(null);
        if (b.width > 0.02 && b.height > 0.01) onCrop?.(b);
      }}
      onPointerCancel={() => {
        origin.current = null;
        setDraft(null);
      }}
    >
      <canvas ref={canvas} aria-label={area ? area.label : `原谱第 ${page + 1} 页`} />
      {loading && <p className="canvas-message">正在读取原谱…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!area &&
        areas
          ?.filter((a) => a.pageIndex === page)
          .map((a, i) => (
            <button
              key={a.id}
              className="area-box"
              style={{
                left: `${a.bounds.x * 100}%`,
                top: `${a.bounds.y * 100}%`,
                width: `${a.bounds.width * 100}%`,
                height: `${a.bounds.height * 100}%`,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelect?.(a.id)}
              aria-label={`选择 ${a.label}`}
            >
              <span>
                {i + 1} · {a.label}
              </span>
            </button>
          ))}
      {draft && (
        <div
          className="crop-draft"
          style={{
            left: `${draft.x * 100}%`,
            top: `${draft.y * 100}%`,
            width: `${draft.width * 100}%`,
            height: `${draft.height * 100}%`,
          }}
        />
      )}
    </div>
  );
}
