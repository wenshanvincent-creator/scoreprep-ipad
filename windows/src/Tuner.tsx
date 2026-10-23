import React, { useEffect, useRef, useState } from 'react';
import { Microphone } from './audio';
import { frequencyFor, instruments, noteName, reading } from './core/pitch';
export function Tuner({ onClose, onContinue }: { onClose: () => void; onContinue?: () => void }) {
  const [instrument, setInstrument] = useState(() => localStorage.getItem('instrument') ?? 'cello');
  const [a4, setA4] = useState(() => Number(localStorage.getItem('a4') ?? 440));
  const [a4Text, setA4Text] = useState(String(a4));
  const [manual, setManual] = useState<number | null>(null),
    [pitch, setPitch] = useState<{ hz: number; clarity: number } | null>(null);
  const [listening, setListening] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(''),
    [reference, setReference] = useState(false);
  const mic = useRef(new Microphone()),
    tone = useRef<AudioContext | null>(null),
    mounted = useRef(true),
    operation = useRef(0);
  const preset = instruments.find((i) => i.id === instrument) ?? instruments[0];
  const value = pitch ? reading(pitch.hz, a4, preset.notes, manual) : null;
  const target = manual ?? value?.target ?? preset.notes[0] ?? 69;
  useEffect(() => {
    const unsubscribe = window.desktop.onAudioInterrupted(() => void stopAll());
    const previous = document.activeElement as HTMLElement;
    const hidden = () => {
      if (document.hidden) void stopAll();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void leave(false);
    };
    document.addEventListener('visibilitychange', hidden);
    document.addEventListener('keydown', escape);
    document.querySelector<HTMLElement>('[data-tuner-heading]')?.focus();
    return () => {
      mounted.current = false;
      operation.current++;
      unsubscribe();
      void mic.current.stop();
      void tone.current?.close();
      document.removeEventListener('visibilitychange', hidden);
      document.removeEventListener('keydown', escape);
      previous?.focus();
    };
  }, []);
  const stopTone = async () => {
    const ctx = tone.current;
    tone.current = null;
    if (ctx && ctx.state !== 'closed') await ctx.close();
    if (mounted.current) setReference(false);
  };
  const stopAll = async () => {
    operation.current++;
    await Promise.all([mic.current.stop(), stopTone()]);
    if (mounted.current) {
      setListening(false);
      setPitch(null);
    }
  };
  const leave = async (proceed: boolean) => {
    await stopAll();
    if (proceed) onContinue?.();
    else onClose();
  };
  const start = async () => {
    setBusy(true);
    setError('');
    setPitch(null);
    try {
      await stopTone();
      const started = await mic.current.start(
        device,
        (p) => {
          if (mounted.current) setPitch(p);
        },
        (message) => {
          if (mounted.current) {
            setError(message);
            setListening(false);
            setPitch(null);
          }
        },
      );
      if (mounted.current && started) {
        setListening(true);
        setDevices(
          (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'),
        );
      }
    } catch (e) {
      await mic.current.stop();
      if (mounted.current)
        setError(
          (e as Error).name === 'NotAllowedError'
            ? '麦克风未获授权。请在 Windows「隐私和安全性 → 麦克风」中允许桌面应用访问，然后重新监听。'
            : `无法使用麦克风：${(e as Error).message}`,
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const playReference = async () => {
    if (reference) {
      await stopTone();
      return;
    }
    const ticket = operation.current + 1;
    await stopAll();
    if (ticket !== operation.current || !mounted.current) return;
    const ctx = new AudioContext();
    tone.current = ctx;
    try {
      await ctx.resume();
      if (ticket !== operation.current || tone.current !== ctx || !mounted.current) return;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.frequency.value = frequencyFor(target, a4);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + 2.7);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 3);
      osc.onended = () => {
        if (tone.current === ctx) void stopTone();
      };
      setReference(true);
    } catch (e) {
      if (ticket === operation.current && mounted.current) {
        await stopTone();
        setError(`参考音无法播放：${(e as Error).message}`);
      }
    }
  };
  return (
    <div className="modal-backdrop">
      <section
        className="tuner modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tuner-title"
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            const all = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input,select',
              ),
            ];
            if (!e.shiftKey && document.activeElement === all.at(-1)) {
              e.preventDefault();
              all[0]?.focus();
            } else if (e.shiftKey && document.activeElement === all[0]) {
              e.preventDefault();
              all.at(-1)?.focus();
            }
          }
        }}
      >
        <div className="modal-top">
          <div>
            <span className="eyebrow">练习前 · 调音</span>
            <h2 id="tuner-title" data-tuner-heading tabIndex={-1}>
              {preset.notes.length ? '先让每根弦就位' : '确认练习音高'}
            </h2>
          </div>
          <button aria-label="关闭调音器" onClick={() => void leave(false)}>
            ✕
          </button>
        </div>
        <div className="row tuner-select">
          <label>
            乐器
            <select
              aria-label="乐器"
              value={preset.id}
              onChange={(e) => {
                setInstrument(e.target.value);
                localStorage.setItem('instrument', e.target.value);
                setManual(null);
                setPitch(null);
                void stopTone();
              }}
            >
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              标准 A4 <small className="muted">Hz</small>
            </span>
            <input
              aria-label="标准 A4 Hz"
              type="number"
              min={415}
              max={466}
              step={1}
              value={a4Text}
              onBlur={() => {
                if (+a4Text < 415 || +a4Text > 466) {
                  setA4Text(String(a4));
                  setError('标准音高范围为 415–466 Hz。');
                }
              }}
              onChange={(e) => {
                setA4Text(e.target.value);
                const n = +e.target.value;
                if (n >= 415 && n <= 466) {
                  setA4(n);
                  localStorage.setItem('a4', String(n));
                  void stopTone();
                }
              }}
            />
          </label>
        </div>
        <p className="hint">{preset.hint}</p>
        <div className="strings" aria-label="目标琴弦">
          <button
            className={manual === null ? 'selected' : ''}
            onClick={() => {
              setManual(null);
              void stopTone();
            }}
          >
            自动
          </button>
          {preset.notes.map((midi, index) => (
            <button
              key={index}
              className={manual === midi ? 'selected' : ''}
              onClick={() => {
                setManual(midi);
                void stopTone();
              }}
            >
              <strong>{noteName(midi)}</strong>
              <small>{frequencyFor(midi, a4).toFixed(1)} Hz</small>
            </button>
          ))}
        </div>
        <div className={`tuning-display ${value && Math.abs(value.cents) <= 5 ? 'in-tune' : ''}`}>
          <div className="note">{value ? value.detected : '—'}</div>
          <div className="pitch-hz">
            {value ? `${value.hz.toFixed(1)} Hz` : listening ? '等待持续单音…' : '点击开始监听'}
          </div>
          <div className="meter">
            <span className="center-mark" />
            {value && (
              <span
                className="needle"
                style={{ left: `${50 + Math.max(-50, Math.min(50, value.cents)) * 0.82}%` }}
              />
            )}
            <div className="meter-labels">
              <span>偏低 −50</span>
              <span>0</span>
              <span>+50 偏高</span>
            </div>
          </div>
          <p className="tuning-status" aria-live="polite">
            {value
              ? Math.abs(value.cents) <= 5
                ? `已调准 · ${noteName(value.target)}`
                : `${value.cents < 0 ? '偏低' : '偏高'} ${Math.abs(value.cents).toFixed(0)} 音分 · 目标 ${noteName(value.target)}`
              : preset.notes.length
                ? '一次只奏一根弦，保持声音平稳'
                : '一次只奏一个持续单音'}
          </p>
        </div>
        {devices.length > 0 && (
          <label className="device">
            输入设备
            <select
              aria-label="输入设备"
              disabled={busy}
              value={device}
              onChange={(e) => {
                setDevice(e.target.value);
                void stopAll();
              }}
            >
              <option value="">系统默认麦克风</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || '麦克风'}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="tuner-actions">
          <div className="row">
            <button
              className={listening ? '' : 'primary'}
              disabled={busy}
              onClick={() => (listening ? void stopAll() : void start())}
            >
              {busy ? '正在连接…' : listening ? '停止监听' : '开始监听'}
            </button>
            <button disabled={busy} onClick={() => void playReference()}>
              {reference ? '停止参考音' : `参考音 ${noteName(target)}`}
            </button>
            <span className="muted">本机分析，不上传录音</span>
          </div>
          {reference && (
            <p className="hint">正在播放参考音。播放结束后点击「开始监听」继续调音。</p>
          )}
          {onContinue && (
            <footer className="modal-footer">
              <button onClick={() => void leave(true)}>跳过调音</button>
              <button className="primary" onClick={() => void leave(true)}>
                调好，开始练习 →
              </button>
            </footer>
          )}
        </div>
      </section>
    </div>
  );
}
