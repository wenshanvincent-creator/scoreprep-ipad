import React, { useEffect, useMemo, useState } from 'react';
import type { Project } from './core/model';
import { compile } from './core/model';
import { Prepare } from './Prepare';
import { Practice } from './Practice';
import { Score, Source } from './Score';
import { Tuner } from './Tuner';
import { Recognition } from './Recognition';
function Settings({ onClose }: { onClose: () => void }) {
  const [url, setURL] = useState(''),
    [token, setToken] = useState(''),
    [saved, setSaved] = useState(false),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void window.desktop
      .settings()
      .then((s) => {
        setURL(s.url);
        setSaved(s.hasToken);
      })
      .catch((e) => setStatus(e.message));
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        className="modal settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="modal-top">
          <h2 id="settings-title">云端识别设置</h2>
          <button onClick={onClose} aria-label="关闭设置">
            ✕
          </button>
        </div>
        <p className="hint">填写现有 ScorePrep 私有识别服务。访问凭据由 Windows 加密保存。</p>
        <label>
          服务地址
          <input
            type="url"
            placeholder="https://your-worker.example"
            value={url}
            onChange={(e) => setURL(e.target.value)}
          />
        </label>
        <label>
          访问凭据
          <input
            type="password"
            autoComplete="off"
            placeholder={saved ? '已保存，留空可保留' : 'Bearer token'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <div className="modal-footer">
          <button onClick={onClose}>关闭</button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void window.desktop
                .saveSettings(url, token)
                .then((s) => {
                  setSaved(s.hasToken);
                  setToken('');
                  setStatus('已保存');
                })
                .catch((e) => setStatus(e.message))
                .finally(() => setBusy(false));
            }}
          >
            保存设置
          </button>
        </div>
        {status && (
          <p role="status" className="notice">
            {status}
          </p>
        )}
      </section>
    </div>
  );
}
export default function App() {
  const [projects, setProjects] = useState<Project[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [mode, setMode] = useState<'read' | 'prepare' | 'practice' | 'recognize' | 'edition'>('read'),
    [page, setPage] = useState(0),
    [settings, setSettings] = useState(false),
    [tuning, setTuning] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const project = projects.find((p) => p.id === selected);
  const source = useMemo(() => (project ? new Source(project) : null), [project?.id]);
  useEffect(() => () => source?.close(), [source]);
  useEffect(() => {
    void window.desktop
      .list()
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, []);
  const saved = (p: Project) => setProjects((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
  const open = (p: Project) => {
    setSelected(p.id);
    setMode('read');
    setPage(0);
    setError('');
  };
  const create = (exercise: boolean) => {
    setBusy(true);
    setError('');
    void (exercise ? window.desktop.exercise() : window.desktop.importScore())
      .then((p) => {
        if (p) {
          saved(p);
          open(p);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };
  const practice = () => {
    try {
      compile(project!);
      setMode('practice');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className={`app ${mode === 'practice' ? 'practicing' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">♩</span>
          <div>
            <strong>ScorePrep</strong>
            <small>读谱 · 调音 · 练习</small>
          </div>
        </div>
        <button className="primary import-button" disabled={busy} onClick={() => create(false)}>
          ＋ 导入原谱
        </button>
        <span className="sidebar-label">
          我的乐谱 <span>{projects.length}</span>
        </span>
        <nav className="library" aria-label="乐谱库">
          {projects.map((p) => (
            <button
              key={p.id}
              className={p.id === selected ? 'active' : ''}
              onClick={() => open(p)}
            >
              <span className="score-icon">♬</span>
              <span>
                <strong>{p.title}</strong>
                <small>
                  {p.pageCount} 页 ·{' '}
                  {p.systems.length ? `${p.systems.length} 个阅读区域` : '尚未准备'}
                </small>
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button disabled={mode === 'practice'} onClick={() => setTuning(true)}>
            ♮ 调音器
          </button>
          <button onClick={() => setSettings(true)}>设置</button>
          <small>ScorePrep Windows · 0.2</small>
        </div>
      </aside>
      <main>
        {error && (
          <div className="app-error" role="alert">
            {error}
            <button onClick={() => setError('')} aria-label="关闭错误提示">
              ×
            </button>
          </div>
        )}
        {!project || !source ? (
          <div className="welcome">
            <div className="welcome-symbol">♩</div>
            <span className="eyebrow">SCOREPREP / WINDOWS</span>
            <h1>让注意力留在乐谱上</h1>
            <p>
              导入原谱，安排阅读顺序。
              <br />
              调好音，再跟随当前行与下一行开始练习。
            </p>
            <div className="row">
              <button className="primary" disabled={busy} onClick={() => create(false)}>
                导入 PDF 或图片
              </button>
              <button disabled={busy} onClick={() => create(true)}>
                打开示例练习 →
              </button>
            </div>
            <small className="muted">支持 PDF、PNG 和 JPEG · 原文件保存在本机</small>
          </div>
        ) : mode === 'prepare' ? (
          <Prepare
            key={project.id}
            project={project}
            source={source}
            onSaved={saved}
            onBack={() => setMode('read')}
          />
        ) : mode === 'practice' ? (
          <Practice
            key={project.id}
            project={project}
            source={source}
            onBack={() => setMode('read')}
          />
        ) : mode === 'recognize' || mode === 'edition' ? (
          <Recognition
            key={`${project.id}/${mode}`}
            project={project}
            source={source}
            onSaved={saved}
            onClose={() => setMode('read')}
            acceptedOnly={mode === 'edition'}
          />
        ) : (
          <div className="reader">
            <header className="toolbar">
              <div className="reader-title">
                <h1>{project.title}</h1>
                <small>{project.sourceFilename} · 原谱</small>
              </div>
              <button onClick={() => setMode('prepare')}>准备练习</button>
              <button className="primary" onClick={practice}>
                开始练习 →
              </button>
            </header>
            <div className="reader-subbar">
              <div className="row">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  ←
                </button>
                <span>
                  第 {page + 1} / {project.pageCount} 页
                </span>
                <button disabled={page + 1 === project.pageCount} onClick={() => setPage(page + 1)}>
                  →
                </button>
              </div>
              <div className="row">
                {project.recognizedEdition && (
                  <button onClick={() => setMode('edition')}>已核对识别谱</button>
                )}
                <button onClick={() => setMode('recognize')}>
                  {project.pendingRecognition ? '继续识别 / 核对' : '云端识别'}
                </button>
              </div>
            </div>
            <div className="reader-paper">
              <Score source={source} page={page} />
            </div>
            <p className="reader-caption">
              {project.systems.length
                ? `${project.systems.length} 个阅读区域 · ${project.readingOrder.length} 段演奏顺序`
                : '先在「准备练习」划出阅读区域并确认时值。'}
            </p>
          </div>
        )}
      </main>
      {settings && <Settings onClose={() => setSettings(false)} />}{' '}
      {tuning && <Tuner onClose={() => setTuning(false)} />}
    </div>
  );
}
