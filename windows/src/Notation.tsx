import { useEffect, useRef, useState } from 'react';
import type { Project } from './core/model';
import { instrumentFor, instrumentProfiles as instruments } from './core/instruments';
import type { PreparedMusic, Performance } from './core/music';
import type { FollowingPosition } from './core/following';
import { Microphone } from './audio';
import { ScorePlayback } from './playback';
import { Tuner } from './Tuner';
interface Edition {
  pages: string[];
  music: PreparedMusic;
  performance: Performance;
}
export function Notation({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (p: Project) => void;
}) {
  const [edition, setEdition] = useState<Edition | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(50),
    [width, setWidth] = useState(1000),
    [fingers, setFingers] = useState(true);
  const [tuning, setTuning] = useState<'only' | 'practice' | null>(null),
    [mode, setMode] = useState<'idle' | 'listening' | 'demo'>('idle');
  const [position, setPosition] = useState<FollowingPosition>({
      index: 0,
      status: 'waiting',
      tempo: null,
      confidence: 0,
    }),
    [speed, setSpeed] = useState(1),
    [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState('');
  const surface = useRef<HTMLDivElement>(null),
    mic = useRef(new Microphone()),
    playback = useRef<ScorePlayback | null>(null),
    generation = useRef(0),
    mounted = useRef(true),
    lastMeasure = useRef(-1);
  const profile = instrumentFor(project.instrument ?? 'cello');
  const stop = async () => {
    generation.current++;
    await Promise.all([mic.current.stop(), playback.current?.close()]);
    playback.current = null;
    if (mounted.current) {
      setMode('idle');
      setBusy(false);
    }
  };
  useEffect(() => {
    const node = surface.current!;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver((entries) => {
      clearTimeout(timer);
      timer = setTimeout(() => setWidth(Math.round(entries[0].contentRect.width)), 200);
    });
    observer.observe(node.parentElement!);
    const unsubscribe = window.desktop.onAudioInterrupted(() => void stop());
    const hidden = () => {
      if (document.hidden) void stop();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      mounted.current = false;
      observer.disconnect();
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', hidden);
      void stop();
    };
  }, []);
  useEffect(() => {
    void stop();
    setLoading(true);
    setError('');
    const worker = new Worker(new URL('./engrave.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      if (e.data.error) {
        setError(e.data.error);
        setEdition(null);
      } else {
        setEdition(e.data);
        setPosition(previous=>({...previous,index:Math.min(previous.index,e.data.performance.groups.length-1),status:'waiting'}));
        lastMeasure.current = -1;
      }
      setLoading(false);
    };
    worker.onerror = () => {
      setError('乐谱排版组件未能启动。');
      setLoading(false);
    };
    worker.postMessage({
      xml: project.localEdition!.musicXML,
      instrument: profile.id,
      width: width - 48,
      scale,
      fingerings: fingers,
    });
    return () => worker.terminate();
  }, [project.localEdition?.musicXML, profile.id, width, scale, fingers]);
  const group = edition?.performance.groups[position.index];
  useEffect(() => {
    const node = surface.current;
    if (!node || !edition) return;
    node
      .querySelectorAll('.played-note,.active-measure')
      .forEach((e) => e.classList.remove('played-note', 'active-measure'));
    group?.ids.forEach((id) => node.querySelector(`[id="${id}"]`)?.classList.add('played-note'));
    const measure = node.querySelector(`[id="measure-${group?.measureIndex}"]`);
    measure?.classList.add('active-measure');
    if (mode !== 'idle' && group && lastMeasure.current !== group.measureIndex) {
      lastMeasure.current = group.measureIndex;
      const rect = measure?.getBoundingClientRect(),
        bounds = node.getBoundingClientRect();
      if (rect && (rect.bottom > bounds.bottom - 70 || rect.top < bounds.top + 20))
        measure?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [group, edition, mode]);
  const listen = async () => {
    if (!edition) return;
    await stop();
    const operation = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const started = await mic.current.start(
        device,
        () => {},
        (message) => {
          setError(message);
          setMode('idle');
        },
        {
          create: () =>
            new Worker(new URL('./follow.worker.ts', import.meta.url), { type: 'module' }),
          init: {
            groups: edition.performance.groups,
            polyphonic: profile.family === 'keyboard' || profile.family === 'guitar',
            a4: Number(localStorage.getItem('a4') ?? 440),
            reset: position.index,
          },
          receive: (value: FollowingPosition) => setPosition(value),
        },
      );
      if (started && operation === generation.current) {
        setMode('listening');
        setDevices(
          (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'),
        );
      }
    } catch (e) {
      await mic.current.stop();
      if (operation === generation.current) setError(`无法开始跟谱：${(e as Error).message}`);
    } finally {
      if (mounted.current && operation === generation.current) setBusy(false);
    }
  };
  const demo = async () => {
    if (!edition) return;
    await stop();
    setError('');
    const player = new ScorePlayback(
      edition.performance,
      profile,
      (index) => setPosition({ index, status: 'following', tempo: null, confidence: 1 }),
      () => setMode('idle'),
    );
    playback.current = player;
    setMode('demo');
    try {
      await player.start(position.index, speed, Number(localStorage.getItem('a4') ?? 440));
    } catch (e) {
      await stop();
      setError((e as Error).message);
    }
  };
  const seek = (measure: number) => {
    if (!edition) return;
    const matches = edition.performance.groups.filter(
      (g, i, all) =>
        g.measureIndex === measure && (i === 0 || all[i - 1].occurrence !== g.occurrence),
    );
    if (!matches.length) return;
    const target = matches.find((g) => g.occurrence >= (group?.occurrence ?? 0)) ?? matches[0];
    if (mode === 'demo') void stop();
    mic.current.reset(target.index);
    setPosition({ index: target.index, status: 'waiting', tempo: null, confidence: 0 });
    lastMeasure.current = measure;
  };
  return (
    <section className="notation-workspace">
      <header className="toolbar">
        <h1>{project.title}</h1>
        <select
          aria-label="谱面乐器"
          value={profile.id}
          disabled={mode !== 'idle' || busy}
          onChange={(e) =>
            void window.desktop
              .save({ ...project, instrument: e.target.value })
              .then(onSaved)
              .catch((e) => setError(e.message))
          }
        >
          {instruments.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <button disabled={busy} onClick={() => void stop().then(() => setTuning('only'))}>
          调音
        </button>
        <button
          disabled={loading || !edition || busy}
          onClick={() => (mode === 'demo' ? void stop() : void demo())}
        >
          {mode === 'demo' ? '停止试听' : '合成试听'}
        </button>
        <button
          className="primary"
          disabled={loading || !edition || busy}
          onClick={() =>
            mode === 'listening' ? void stop() : void stop().then(() => setTuning('practice'))
          }
        >
          {busy ? '连接麦克风…' : mode === 'listening' ? '停止跟谱' : '开始练习'}
        </button>
      </header>
      <div className="notation-options">
        <label>
          谱面大小{' '}
          <input
            aria-label="谱面大小"
            type="range"
            min="35"
            max="70"
            step="5"
            value={scale}
            disabled={mode !== 'idle'}
            onChange={(e) => setScale(+e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={fingers}
            disabled={mode !== 'idle'}
            onChange={(e) => setFingers(e.target.checked)}
          />{' '}
          推荐指法
        </label>
        <label>
          试听速度{' '}
          <select
            aria-label="试听速度"
            value={speed}
            disabled={mode === 'demo'}
            onChange={(e) => setSpeed(+e.target.value)}
          >
            {[0.5, 0.75, 1, 1.25].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        {devices.length > 0 && (
          <select
            aria-label="跟谱输入设备"
            value={device}
            disabled={mode !== 'idle' || busy}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="">系统默认麦克风</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || '麦克风'}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && (
        <div role="alert" className="app-error">
          {error}
        </div>
      )}
      <div
        className="notation-pages"
        ref={surface}
        onClick={(e) => {
          const measure = (e.target as Element).closest('.measure');
          const id = measure?.id.match(/^measure-(\d+)$/);
          if (id) seek(+id[1]);
        }}
      >
        {loading ? (
          <div className="flow-state" role="status">
            正在排版…
          </div>
        ) : (
          edition?.pages.map((svg, i) => (
            <div className="notation-page" key={i} dangerouslySetInnerHTML={{ __html: svg }} />
          ))
        )}
      </div>
      <footer className="following-status" role="status">
        <span className={`status-dot ${mode === 'listening' ? 'on' : ''}`} />
        <span>
          {mode === 'demo'
            ? '合成试听'
            : mode === 'listening'
              ? position.status === 'following'
                ? '正在跟谱'
                : position.status === 'uncertain'
                  ? '等待匹配音符'
                  : '等待演奏'
              : '点击小节可从该处开始'}
        </span>
        {group && <span>第 {edition!.music.measures[group.measureIndex].label} 小节</span>}
        {mode === 'listening' && position.tempo !== null && (
          <span>♩ {Math.round(position.tempo)}</span>
        )}
      </footer>
      {tuning && (
        <Tuner
          initialInstrument={profile.id}
          onClose={() => setTuning(null)}
          onContinue={
            tuning === 'practice'
              ? () => {
                  setTuning(null);
                  void listen();
                }
              : undefined
          }
        />
      )}
    </section>
  );
}
