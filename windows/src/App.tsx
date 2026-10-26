import { useEffect, useState } from 'react';
import type { Project } from './core/model';
import { instrumentProfiles } from './core/instruments';
import { Notation } from './Notation';
import { Tuner } from './Tuner';
export default function App() {
  const [projects, setProjects] = useState<Project[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [instrument, setInstrument] = useState(
      () => localStorage.getItem('import-instrument') ?? 'cello',
    );
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [tuning, setTuning] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const project = projects.find((p) => p.id === selected);
  const saved = (p: Project) => setProjects((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void window.desktop
        .list()
        .then((ps) => {
          if (active) setProjects(ps);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const create = (exercise = false) => {
    setBusy(true);
    setError('');
    void (exercise ? window.desktop.exercise() : window.desktop.importScore(instrument))
      .then((p) => {
        if (p) {
          saved(p);
          setSelected(p.id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className={`app local-app ${collapsed ? 'library-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <strong>ScorePrep</strong>
        </div>
        <select
          aria-label="导入乐器"
          value={instrument}
          onChange={(e) => {
            setInstrument(e.target.value);
            localStorage.setItem('import-instrument', e.target.value);
          }}
        >
          {instrumentProfiles.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <button className="primary import-button" disabled={busy} onClick={() => create()}>
          ＋ 导入乐谱
        </button>
        <nav className="library" aria-label="乐谱库">
          {projects.map((p) => (
            <button
              key={p.id}
              className={p.id === selected ? 'active' : ''}
              onClick={() => {
                setSelected(p.id);
                setError('');
                if (!p.localEdition && !p.localRecognition)
                  void window.desktop
                    .recognize(p.id)
                    .then(saved)
                    .catch((e) => setError(e.message));
              }}
            >
              <span>
                <strong>{p.title}</strong>
                <small>
                  {p.localRecognition?.state === 'running' || p.localRecognition?.state === 'queued'
                    ? '正在识别…'
                    : p.localRecognition?.state === 'failed'
                      ? '识别未完成'
                      : p.localEdition
                        ? '可演奏'
                        : `${p.pageCount} 页`}
                </small>
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            onClick={() => {
              setSelected(null);
              setTuning(true);
            }}
          >
            调音器
          </button>
          <small>Windows · 0.3</small>
        </div>
      </aside>
      <main>
        <button
          className="library-toggle"
          aria-label={collapsed ? '显示乐谱库' : '收起乐谱库'}
          onClick={() => setCollapsed(!collapsed)}
        >
          ☰
        </button>
        {error && (
          <div role="alert" className="app-error">
            {error}
          </div>
        )}
        {!project ? (
          <div className="flow-state welcome-flow">
            <h1>导入乐谱</h1>
            <p>PDF、PNG 或 JPEG</p>
            <button className="primary" disabled={busy} onClick={() => create()}>
              选择文件
            </button>
            <button disabled={busy} onClick={() => create(true)}>
              打开大提琴示例
            </button>
          </div>
        ) : project.localEdition ? (
          <Notation key={project.id} project={project} onSaved={saved} />
        ) : (
          <div className="flow-state">
            <h1>{project.title}</h1>
            {project.localRecognition?.state === 'failed' ? (
              <>
                <p role="alert">{project.localRecognition.error}</p>
                <button
                  onClick={() =>
                    void window.desktop
                      .recognize(project.id)
                      .then(saved)
                      .catch((e) => setError(e.message))
                  }
                >
                  重新识别
                </button>
                <button onClick={() => create()}>换一份乐谱</button>
              </>
            ) : (
              <>
                <div className="spinner" />
                <p role="status">{project.localRecognition?.phase || '正在准备本地识别…'}</p>
              </>
            )}
          </div>
        )}
      </main>
      {tuning && <Tuner initialInstrument={instrument} onClose={() => setTuning(false)} />}
    </div>
  );
}
