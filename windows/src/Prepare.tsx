import React, { useState } from 'react';
import {
  addArea,
  compile,
  defaultTiming,
  validateTiming,
  type Area,
  type Project,
  type Timing,
  type PulseUnit,
} from './core/model';
import { Score, Source } from './Score';
function TimingEditor({
  segments,
  onChange,
  onSave,
}: {
  segments: Timing[];
  onChange: (segments: Timing[]) => void;
  onSave: (segments: Timing[]) => void;
}) {
  const [error, setError] = useState('');
  const change = (index: number, edit: (timing: Timing) => void) => {
    const next = structuredClone(segments);
    edit(next[index]);
    onChange(next);
  };
  return (
    <div className="timing-editor">
      <p className="hint">
        按实际演奏填写四分音符总数；反复通过下方阅读顺序安排。6/8 一小节 = 3 个四分音符。
      </p>
      {segments.map((t, i) => (
        <fieldset key={i}>
          <legend>时值段 {i + 1}</legend>
          <label>
            四分音符总数
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={t.quarterBeats}
              onChange={(e) =>
                change(i, (t) => {
                  t.quarterBeats = +e.target.value;
                })
              }
            />
          </label>
          <div className="row">
            <label>
              拍号分子
              <input
                type="number"
                min={1}
                max={32}
                value={t.meter.numerator}
                onChange={(e) =>
                  change(i, (t) => {
                    t.meter.numerator = +e.target.value;
                  })
                }
              />
            </label>
            <label>
              拍号分母
              <select
                value={t.meter.denominator}
                onChange={(e) =>
                  change(i, (t) => {
                    t.meter.denominator = +e.target.value;
                  })
                }
              >
                {[1, 2, 4, 8, 16, 32].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <label>
              速度
              <input
                type="number"
                min={20}
                max={300}
                value={t.tempo.bpm}
                onChange={(e) =>
                  change(i, (t) => {
                    t.tempo.bpm = +e.target.value;
                  })
                }
              />
            </label>
            <label>
              每拍单位
              <select
                value={t.tempo.pulse}
                onChange={(e) =>
                  change(i, (t) => {
                    t.tempo.pulse = e.target.value as PulseUnit;
                  })
                }
              >
                <option value="quarter">♩ 四分音符</option>
                <option value="eighth">♪ 八分音符</option>
                <option value="dottedQuarter">♩. 附点四分音符</option>
              </select>
            </label>
          </div>
          <label>
            起始拍位（四分音符，0 = 小节开头）
            <input
              type="number"
              min={0}
              step={0.25}
              value={t.startingBarPhase}
              onChange={(e) =>
                change(i, (t) => {
                  t.startingBarPhase = +e.target.value;
                })
              }
            />
          </label>
          {segments.length > 1 && (
            <button onClick={() => onChange(segments.filter((_, j) => j !== i))}>
              移除此时值段
            </button>
          )}
        </fieldset>
      ))}
      <div className="row">
        <button onClick={() => onChange([...segments, defaultTiming()])}>＋ 变拍 / 变速段</button>
        <button
          className="primary"
          onClick={() => {
            try {
              segments.forEach(validateTiming);
              onSave(segments);
              setError('');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          确认时值
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Prepare({
  project,
  source,
  onSaved,
  onBack,
}: {
  project: Project;
  source: Source;
  onSaved: (p: Project) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(project)),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string | null>(project.systems[0]?.id ?? null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [full, setFull] = useState(false);
  const [timingDrafts, setTimingDrafts] = useState<Record<string, Timing[]>>({});
  const pendingTiming = Object.keys(timingDrafts).length > 0;
  const edit = (p: Project) => {
    setDraft(p);
    setDirty(true);
  };
  const area = draft.systems.find((a) => a.id === selected);
  const add = (bounds: Area['bounds']) => {
    const a: Area = {
      id: crypto.randomUUID(),
      pageIndex: page,
      bounds,
      label: `第 ${draft.systems.length + 1} 行`,
    };
    edit(addArea(draft, a));
    setSelected(a.id);
  };
  const save = async () => {
    setBusy(true);
    try {
      const p = await window.desktop.save(draft);
      setDraft(p);
      setDirty(false);
      setError('');
      onSaved(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="prepare">
      <header className="toolbar">
        <button
          onClick={() => {
            if (!dirty || confirm('尚有未保存的修改，离开准备界面？')) onBack();
          }}
        >
          ← 原谱
        </button>
        <h2>准备练习</h2>
        <span className="muted">
          {pendingTiming ? '请先确认已修改的时值' : dirty ? '尚未保存' : '已保存'}
        </span>
        <button className="primary" disabled={busy || pendingTiming} onClick={() => void save()}>
          {busy ? '保存中…' : '保存设置'}
        </button>
      </header>
      <div className="prepare-grid">
        <section className="paper-panel">
          <div className="row page-controls">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              上一页
            </button>
            <span>
              第 {page + 1} / {draft.pageCount} 页
            </span>
            <button disabled={page + 1 === draft.pageCount} onClick={() => setPage(page + 1)}>
              下一页
            </button>
          </div>
          <p className="hint">在原谱上拖出一行；或用「整页区域」后输入边界数值。</p>
          <button
            className="small"
            onClick={() => {
              add({ x: 0, y: 0, width: 1, height: 1 });
              setFull(true);
            }}
          >
            ＋ 整页区域
          </button>
          <Score
            source={source}
            page={page}
            areas={draft.systems}
            onCrop={add}
            onSelect={(id) => {
              setSelected(id);
              setFull(true);
            }}
          />
        </section>
        <aside className="preparation-controls">
          <label>
            乐谱名称
            <input
              value={draft.title}
              maxLength={200}
              onChange={(e) => edit({ ...draft, title: e.target.value })}
            />
          </label>
          <h3>
            阅读区域 <span className="muted">{draft.systems.length}</span>
          </h3>
          <div className="area-list">
            {draft.systems.map((a, i) => (
              <button
                key={a.id}
                className={selected === a.id ? 'selected' : ''}
                onClick={() => {
                  setSelected(a.id);
                  setPage(a.pageIndex);
                }}
              >
                <span>
                  {i + 1} · {a.label}
                </span>
                <small>{a.timing ? '时值已确认' : '待确认时值'}</small>
              </button>
            ))}
          </div>
          {area && (
            <section className="area-settings">
              <label>
                区域名称
                <input
                  value={area.label}
                  onChange={(e) =>
                    edit({
                      ...draft,
                      systems: draft.systems.map((a) =>
                        a.id === area.id ? { ...a, label: e.target.value } : a,
                      ),
                    })
                  }
                />
              </label>
              <button className="small" onClick={() => setFull(!full)}>
                {full ? '收起边界' : '调整区域边界'}
              </button>
              {full && (
                <div className="bounds">
                  {(['x', 'y', 'width', 'height'] as const).map((key, i) => (
                    <label key={key}>
                      {['左边', '上边', '宽度', '高度'][i]} %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={+(area.bounds[key] * 100).toFixed(2)}
                        onChange={(e) =>
                          edit({
                            ...draft,
                            systems: draft.systems.map((a) =>
                              a.id === area.id
                                ? { ...a, bounds: { ...a.bounds, [key]: +e.target.value / 100 } }
                                : a,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              <TimingEditor
                key={area.id}
                segments={timingDrafts[area.id] ?? area.timing ?? [defaultTiming()]}
                onChange={(segments) => {
                  setTimingDrafts((prev) => ({ ...prev, [area.id]: segments }));
                  setDirty(true);
                }}
                onSave={(timing) => {
                  setTimingDrafts((prev) => {
                    const next = { ...prev };
                    delete next[area.id];
                    return next;
                  });
                  edit({
                    ...draft,
                    systems: draft.systems.map((a) => (a.id === area.id ? { ...a, timing } : a)),
                  });
                }}
              />
              <button
                className="danger-link"
                onClick={() => {
                  setTimingDrafts((prev) => {
                    const next = { ...prev };
                    delete next[area.id];
                    return next;
                  });
                  const sections = draft.sections.filter((s) => !s.systemIDs.includes(area.id));
                  edit({
                    ...draft,
                    systems: draft.systems.filter((a) => a.id !== area.id),
                    sections,
                    readingOrder: draft.readingOrder.filter((o) =>
                      sections.some((s) => s.id === o.sectionID),
                    ),
                  });
                  setSelected(null);
                }}
              >
                移除此阅读区域
              </button>
            </section>
          )}
          <h3>实际演奏顺序</h3>
          <p className="hint">同一段落可以重复出现，每次都独立计时。</p>
          {draft.readingOrder.map((o, i) => (
            <div className="order-item" key={o.id}>
              <span>
                {i + 1}. {draft.sections.find((s) => s.id === o.sectionID)?.name}
              </span>
              <button
                className="icon-button"
                aria-label={`上移第 ${i + 1} 段`}
                disabled={i === 0}
                onClick={() => {
                  const order = [...draft.readingOrder];
                  [order[i - 1], order[i]] = [order[i], order[i - 1]];
                  edit({ ...draft, readingOrder: order });
                }}
              >
                ↑
              </button>
              <button
                className="icon-button"
                aria-label={`重复第 ${i + 1} 段`}
                onClick={() => {
                  const order = [...draft.readingOrder];
                  order.splice(i + 1, 0, { ...o, id: crypto.randomUUID() });
                  edit({ ...draft, readingOrder: order });
                }}
              >
                ＋
              </button>
              <button
                className="icon-button"
                aria-label={`移除第 ${i + 1} 段`}
                onClick={() =>
                  edit({ ...draft, readingOrder: draft.readingOrder.filter((x) => x.id !== o.id) })
                }
              >
                ×
              </button>
            </div>
          ))}
          {draft.sections.length > 0 && (
            <label>
              追加已有段落
              <select
                value=""
                onChange={(e) =>
                  edit({
                    ...draft,
                    readingOrder: [
                      ...draft.readingOrder,
                      { id: crypto.randomUUID(), sectionID: e.target.value },
                    ],
                  })
                }
              >
                <option value="" disabled>
                  选择段落…
                </option>
                {draft.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={() => {
              try {
                const t = compile(draft);
                setError(
                  `设置可用：${t.spans.length} 行，共 ${t.duration.toFixed(1)} 秒（原速，不含预备拍）。`,
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            检查练习设置
          </button>
          {error && (
            <p className="notice" role="status">
              {error}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
