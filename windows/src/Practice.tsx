import React, { useEffect, useRef, useState } from 'react';
import { PracticeAudio } from './audio';
import type { Snapshot } from './core/transport';
import { compile, type Project } from './core/model';
import { Score, Source } from './Score';
import { Tuner } from './Tuner';
export function Practice({
  project,
  source,
  onBack,
}: {
  project: Project;
  source: Source;
  onBack: () => void;
}) {
  const [timeline] = useState(() => compile(project)),
    [snapshot, setSnapshot] = useState<Snapshot>({
      elapsed: 0,
      position: 0,
      index: 0,
      upcoming: 1,
      phase: 'ready',
      remaining: 0,
    }),
    [tuning, setTuning] = useState(true),
    [speed, setSpeed] = useState(1),
    [bars, setBars] = useState(1),
    [audible, setAudible] = useState(true),
    [loop, setLoop] = useState(false),
    [first, setFirst] = useState(0),
    [last, setLast] = useState(timeline.spans.length - 1),
    [message, setMessage] = useState('');
  const audio = useRef<PracticeAudio | null>(null);
  useEffect(() => {
    const engine = new PracticeAudio(timeline, setSnapshot, () =>
      setMessage('音频已中断，点击继续恢复。'),
    );
    audio.current = engine;
    setSnapshot(engine.snapshot());
    const unsubscribe = window.desktop.onAudioInterrupted(() => {
      engine.pause();
      setMessage('窗口已隐藏或系统进入休眠，点击继续恢复。');
    });
    const hidden = () => {
      if (document.hidden) {
        engine.pause();
        setMessage('已暂停，回到窗口后点击继续。');
      }
    };
    const deviceChange = () => {
      engine.pause();
      setMessage('音频设备已变化，请确认输出后继续。');
    };
    const keyboard = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !(e.target as HTMLElement).closest('input,select,button,[role="dialog"]')
      ) {
        e.preventDefault();
        const s = engine.snapshot();
        if (['playing', 'countingIn'].includes(s.phase)) engine.pause();
        else if (s.phase === 'paused') void engine.resume().catch((e) => setMessage(e.message));
      }
    };
    document.addEventListener('visibilitychange', hidden);
    navigator.mediaDevices.addEventListener('devicechange', deviceChange);
    document.addEventListener('keydown', keyboard);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', hidden);
      navigator.mediaDevices.removeEventListener('devicechange', deviceChange);
      document.removeEventListener('keydown', keyboard);
      void engine.close();
    };
  }, [timeline]);
  const current = timeline.spans[snapshot.index],
    next = snapshot.upcoming === null ? null : timeline.spans[snapshot.upcoming];
  const running = ['playing', 'countingIn'].includes(snapshot.phase),
    beat = audio.current?.planner.display(audio.current.transport, snapshot.elapsed);
  const applyLoop = (enabled: boolean, a: number, b: number) => {
    try {
      audio.current!.loop(a, b, enabled);
      setLoop(enabled);
      setFirst(a);
      setLast(b);
      setMessage('');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <div className="practice">
      <header className="toolbar">
        <button onClick={onBack}>← 原谱</button>
        <h2>{project.title}</h2>
        <button
          onClick={() => {
            audio.current?.pause();
            setTuning(true);
          }}
        >
          调音器
        </button>
      </header>
      <div className="practice-top">
        <span className="eyebrow">
          {snapshot.phase === 'countingIn'
            ? `预备拍 · ${snapshot.remaining.toFixed(1)} 秒`
            : snapshot.phase === 'finished'
              ? '本次练习完成'
              : snapshot.phase === 'paused'
                ? '已暂停'
                : snapshot.phase === 'ready'
                  ? '准备就绪'
                  : '正在练习'}
        </span>
        <span>
          第 {snapshot.index + 1} / {timeline.spans.length} 行
        </span>
      </div>
      <section className="current-line">
        <div className="line-label">
          <strong>当前 · {current.label}</strong>
          <span>
            {current.segments.map((t) => `${t.meter.numerator}/${t.meter.denominator}`).join(' → ')}
          </span>
        </div>
        <Score source={source} page={current.area.pageIndex} area={current.area} />
      </section>
      <div className="beat-strip">
        <span
          className={`beat-dot ${beat?.click.downbeat ? 'downbeat' : ''}`}
          style={{ opacity: running ? 1 - (beat?.progress ?? 0) * 0.7 : 0.35 }}
        />
        <span>
          {running && beat
            ? `${beat.click.countIn ? '预备' : '第'} ${Number(beat.click.beat.toFixed(2))} 拍`
            : '节拍'}
        </span>
        <div className="line-progress">
          <i
            style={{
              width: `${Math.max(0, Math.min(100, ((snapshot.position - current.start) / (current.end - current.start)) * 100))}%`,
            }}
          />
        </div>
        <span>
          {snapshot.position.toFixed(1)} / {timeline.duration.toFixed(1)} 秒
        </span>
      </div>
      <section className="upcoming-line">
        <div className="line-label">
          <span>下一行{loop && snapshot.index === last ? ' · 回到 A' : ''}</span>
        </div>
        {next ? (
          <Score source={source} page={next.area.pageIndex} area={next.area} />
        ) : (
          <p className="end-message">这是最后一行</p>
        )}
      </section>
      <footer className="transport">
        <div className="row">
          <button
            className="primary play-button"
            onClick={() => {
              setMessage('');
              if (running) audio.current!.pause();
              else if (snapshot.phase === 'paused')
                void audio.current!.resume().catch((e) => setMessage(e.message));
              else setTuning(true);
            }}
          >
            {running ? 'Ⅱ 暂停' : snapshot.phase === 'paused' ? '▶ 继续' : '▶ 开始练习'}
          </button>
          <label>
            速度
            <select
              aria-label="速度"
              value={speed}
              onChange={(e) => {
                const n = +e.target.value;
                audio.current!.speed(n);
                setSpeed(n);
              }}
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </label>
          <label>
            预备拍
            <select
              aria-label="预备拍"
              disabled={running}
              value={bars}
              onChange={(e) => setBars(+e.target.value)}
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} 小节
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={audible}
              onChange={(e) => {
                setAudible(e.target.checked);
                audio.current!.sound(e.target.checked);
              }}
            />
            节拍器
          </label>
          <label>
            跳至
            <select
              aria-label="跳至"
              value={snapshot.index}
              onChange={(e) => {
                audio.current!.seek(+e.target.value);
                setLoop(!!audio.current!.transport.loop);
              }}
            >
              {timeline.spans.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row loop-controls">
          <label className="check">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => applyLoop(e.target.checked, first, last)}
            />
            A–B 循环
          </label>
          <label>
            A
            <select value={first} onChange={(e) => applyLoop(loop, +e.target.value, last)}>
              {timeline.spans.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {s.area.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            B
            <select value={last} onChange={(e) => applyLoop(loop, first, +e.target.value)}>
              {timeline.spans.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {s.area.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </footer>
      {tuning && (
        <Tuner
          onClose={() => setTuning(false)}
          onContinue={() => {
            setTuning(false);
            void audio.current!.start(bars).catch((e) => setMessage(e.message));
          }}
        />
      )}
    </div>
  );
}
