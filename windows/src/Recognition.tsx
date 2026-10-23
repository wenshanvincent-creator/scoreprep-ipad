import React, { useEffect, useState } from 'react';
import type { Project, RecognitionJob } from './core/model';
import { Score, Source } from './Score';
function cleanSVG(svg: string) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('排版结果格式不正确。');
  doc.querySelectorAll('script,foreignObject,iframe,object,embed').forEach((e) => e.remove());
  doc.querySelectorAll('*').forEach((e) => {
    for (const a of [...e.attributes])
      if (
        /^on/i.test(a.name) ||
        ((a.localName === 'href' || a.name === 'src') && !a.value.startsWith('#'))
      )
        e.removeAttribute(a.name);
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}
export function Engraving({ xml, onReady }: { xml: string; onReady?: () => void }) {
  const [pages, setPages] = useState<string[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    setPages([]);
    setError('');
    const worker = new Worker(new URL('./engrave.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      try {
        if (event.data.error) throw new Error(event.data.error);
        setPages(event.data.pages.map(cleanSVG));
        onReady?.();
      } catch (e) {
        setError((e as Error).message);
      }
    };
    worker.onerror = () => setError('排版程序无法启动。原谱仍可使用。');
    worker.postMessage(xml);
    return () => worker.terminate();
  }, [xml]);
  return (
    <div className="engraving">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : pages.length ? (
        pages.map((svg, i) => (
          <div className="engraved-page" key={i} dangerouslySetInnerHTML={{ __html: svg }} />
        ))
      ) : (
        <p className="notice">正在排版识别谱…</p>
      )}
    </div>
  );
}
export function Recognition({
  project,
  source,
  onSaved,
  onClose,
  acceptedOnly = false,
}: {
  project: Project;
  source: Source;
  onSaved: (p: Project) => void;
  onClose: () => void;
  acceptedOnly?: boolean;
}) {
  const [p, setProject] = useState(project),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [reviewed, setReviewed] = useState<number[]>([]),
    [rendered, setRendered] = useState<number[]>([]),
    [polling, setPolling] = useState(true);
  const job: RecognitionJob | undefined = acceptedOnly ? p.recognizedEdition : p.pendingRecognition;
  useEffect(() => {
    if (acceptedOnly || !job || !['queued', 'running'].includes(job.state) || !polling) return;
    let active = true;
    const timer = setTimeout(() => {
      void window.desktop
        .recognize(p.id, false)
        .then((next) => {
          if (active) {
            setProject(next);
            onSaved(next);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setPolling(false);
          }
        });
    }, 2000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [job, polling]);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const next = await window.desktop.recognize(p.id, !job);
      setProject(next);
      onSaved(next);
      setPolling(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const review = async (accept: boolean) => {
    setBusy(true);
    try {
      const next = await window.desktop.review(p.id, accept);
      onSaved(next);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="recognition">
      <header className="toolbar">
        <button onClick={onClose}>← 原谱</button>
        <h2>{acceptedOnly ? '已保存的识别谱' : '云端识别与核对'}</h2>
        {!acceptedOnly && !job && (
          <button className="primary" disabled={busy} onClick={() => void submit()}>
            {busy ? '正在提交…' : '上传原谱并识别'}
          </button>
        )}
      </header>
      {!job && (
        <div className="empty-panel">
          <h3>把扫描原谱转为可重排的乐谱</h3>
          <p>原文件会上传到你配置的私有识别服务，结果需逐页核对后保存。原谱始终保留。</p>
          <p className="muted">云端识别最多 8 页、20 MiB。请先在设置中填写服务地址与凭据。</p>
        </div>
      )}
      {job && (
        <>
          <div className="recognition-status">
            <strong>
              {acceptedOnly
                ? '已人工核对并保存'
                : job.state === 'succeeded'
                  ? '识别完成，核对后保存'
                  : ['failed', 'skipped'].includes(job.state)
                    ? '识别未完成'
                    : `识别中 · ${job.completedPages} / ${job.pages.length} 页`}
            </strong>
            <span className="muted">{job.engineName ?? '远程识别服务'}</span>
            {!polling && ['queued', 'running'].includes(job.state) && (
              <button disabled={busy} onClick={() => void submit()}>
                继续查询
              </button>
            )}
          </div>
          {job.error && (
            <p className="error" role="alert">
              {job.error}
            </p>
          )}
          <div className="row page-controls">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              上一页
            </button>
            <span>
              原谱第 {page + 1} / {p.pageCount} 页
            </span>
            <button disabled={page + 1 === p.pageCount} onClick={() => setPage(page + 1)}>
              下一页
            </button>
          </div>
          <div className="comparison">
            <section>
              <h3>原谱</h3>
              <Score source={source} page={page} />
            </section>
            <section>
              <h3>
                识别谱 <span className="muted">{acceptedOnly ? '已核对' : '待人工核对'}</span>
              </h3>
              {job.pages[page]?.musicXML ? (
                <Engraving
                  key={page}
                  xml={job.pages[page].musicXML!}
                  onReady={() => setRendered((prev) => [...new Set([...prev, page])])}
                />
              ) : (
                <p className="notice">{job.pages[page]?.error ?? '该页尚无识别结果'}</p>
              )}
              {!acceptedOnly && job.state === 'succeeded' && (
                <label className="check">
                  <input
                    type="checkbox"
                    disabled={!rendered.includes(page)}
                    checked={reviewed.includes(page)}
                    onChange={(e) =>
                      setReviewed((prev) =>
                        e.target.checked ? [...prev, page] : prev.filter((i) => i !== page),
                      )
                    }
                  />
                  已对照原谱核对本页音符、节奏和声部
                </label>
              )}
            </section>
          </div>
          {!acceptedOnly && (
            <footer className="review-footer">
              <button disabled={busy} onClick={() => void review(false)}>
                放弃此识别结果
              </button>
              <button
                className="primary"
                disabled={busy || job.state !== 'succeeded' || reviewed.length !== p.pageCount}
                onClick={() => void review(true)}
              >
                保存核对后的识别谱（{reviewed.length}/{p.pageCount}）
              </button>
            </footer>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
