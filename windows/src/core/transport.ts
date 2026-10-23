import { barQuarters, pulseQuarters, segmentDuration, type Timeline, type Timing } from './model';
export interface Loop {
  first: number;
  last: number;
}
export interface Snapshot {
  elapsed: number;
  position: number;
  index: number;
  upcoming: number | null;
  phase: 'ready' | 'paused' | 'countingIn' | 'playing' | 'finished';
  remaining: number;
}
export interface Click {
  elapsed: number;
  index: number;
  countIn: boolean;
  downbeat: boolean;
  beat: number;
}
interface Region {
  start: number;
  end: number;
  coordinate: number;
  index: number;
  timing: Timing;
  seconds: number;
}
const eps = 1e-9;
export class Transport {
  speed = 1;
  loop: Loop | null = null;
  lead = 0;
  entry = 0;
  private anchor = 0;
  private offset = 0;
  private activity: 'ready' | 'paused' | 'running' = 'ready';
  constructor(readonly timeline: Timeline) {}
  snapshot(now: number): Snapshot {
    const elapsed =
      this.offset + (this.activity === 'running' ? Math.max(0, now - this.anchor) * this.speed : 0);
    const remaining = Math.max(0, this.lead - elapsed);
    let position = this.entry + Math.max(0, elapsed - this.lead);
    if (this.loop) {
      const lo = this.timeline.spans[this.loop.first].start,
        hi = this.timeline.spans[this.loop.last].end;
      if (position >= hi) position = lo + ((position - hi) % (hi - lo));
    } else position = Math.min(position, this.timeline.duration);
    let index = this.timeline.spans.findIndex((s) => position >= s.start && position < s.end);
    if (index < 0) index = this.timeline.spans.length - 1;
    const finished = !this.loop && position >= this.timeline.duration;
    const phase = finished
      ? 'finished'
      : this.activity === 'ready'
        ? 'ready'
        : this.activity === 'paused'
          ? 'paused'
          : remaining > 0
            ? 'countingIn'
            : 'playing';
    return {
      elapsed,
      position,
      index,
      upcoming:
        this.loop && index === this.loop.last
          ? this.loop.first
          : index + 1 < this.timeline.spans.length
            ? index + 1
            : null,
      phase,
      remaining: remaining / this.speed,
    };
  }
  start(now: number, bars = 1) {
    const s = this.snapshot(now);
    this.entry =
      s.phase === 'finished' ? this.timeline.spans[this.loop?.first ?? 0].start : s.position;
    const region = new PulsePlanner(this.timeline).region(this.entry);
    const t = region.timing;
    const phase =
      (t.startingBarPhase +
        ((this.entry - region.start) / region.seconds) * pulseQuarters[t.tempo.pulse]) %
      barQuarters(t);
    this.lead =
      bars > 0
        ? (((bars - 1) * barQuarters(t) + (phase < eps ? barQuarters(t) : phase)) /
            pulseQuarters[t.tempo.pulse]) *
          region.seconds
        : 0;
    this.offset = 0;
    this.anchor = now;
    this.activity = 'running';
  }
  pause(now: number) {
    if (this.activity === 'running') {
      this.offset = this.snapshot(now).elapsed;
      this.activity = 'paused';
    }
  }
  resume(now: number) {
    if (this.activity === 'paused') {
      this.anchor = now;
      this.activity = 'running';
    }
  }
  setSpeed(value: number, now: number) {
    if (!Number.isFinite(value) || value < 0.25 || value > 2)
      throw new Error('速度范围为 0.25–2 倍。');
    this.offset = this.snapshot(now).elapsed;
    this.anchor = now;
    this.speed = value;
  }
  seek(index: number) {
    if (!this.timeline.spans[index]) throw new Error('练习区域不存在。');
    if (this.loop && (index < this.loop.first || index > this.loop.last)) this.loop = null;
    this.move(this.timeline.spans[index].start);
  }
  setLoop(loop: Loop | null, now: number) {
    if (
      loop &&
      (!this.timeline.spans[loop.first] ||
        !this.timeline.spans[loop.last] ||
        loop.first > loop.last)
    )
      throw new Error('A 点应在 B 点之前。');
    const p = this.snapshot(now).position;
    this.loop = loop;
    this.move(
      loop && (p < this.timeline.spans[loop.first].start || p >= this.timeline.spans[loop.last].end)
        ? this.timeline.spans[loop.first].start
        : p,
    );
  }
  private move(position: number) {
    this.entry = position;
    this.offset = 0;
    this.lead = 0;
    this.activity = 'paused';
  }
  hostTime(elapsed: number) {
    return this.anchor + (elapsed - this.offset) / this.speed;
  }
}
export class PulsePlanner {
  readonly regions: Region[] = [];
  readonly longest: number;
  constructor(readonly timeline: Timeline) {
    let coordinate = 0;
    timeline.spans.forEach((span, index) => {
      let cursor = span.start;
      span.segments.forEach((timing, i) => {
        const end = i === span.segments.length - 1 ? span.end : cursor + segmentDuration(timing);
        this.regions.push({
          start: cursor,
          end,
          coordinate,
          index,
          timing,
          seconds: 60 / timing.tempo.bpm,
        });
        coordinate += timing.quarterBeats / pulseQuarters[timing.tempo.pulse];
        cursor = end;
      });
    });
    this.longest = Math.max(...this.regions.map((r) => r.seconds));
  }
  region(at: number) {
    return (
      this.regions.find((r) => at >= r.start && at < r.end) ?? this.regions[this.regions.length - 1]
    );
  }
  coordinate(at: number) {
    const r = this.region(at);
    return r.coordinate + (at - r.start) / r.seconds;
  }
  origin(t: Transport) {
    const r = this.region(t.entry);
    return t.lead > 0
      ? t.lead / r.seconds
      : ((r.timing.startingBarPhase +
          ((t.entry - r.start) / r.seconds) * pulseQuarters[r.timing.tempo.pulse]) %
          barQuarters(r.timing)) /
          pulseQuarters[r.timing.tempo.pulse];
  }
  pulses(t: Transport, lower: number, upper: number): Click[] {
    const result: Click[] = [],
      origin = this.origin(t),
      entryRegion = this.region(t.entry);
    const append = (elapsed: number, r: Region, phase: number, countIn: boolean) => {
      if (elapsed >= lower - eps && elapsed < upper - eps) {
        const barPhase =
          ((phase % barQuarters(r.timing)) + barQuarters(r.timing)) % barQuarters(r.timing);
        result.push({
          elapsed,
          index: r.index,
          countIn,
          downbeat: barPhase < eps || barQuarters(r.timing) - barPhase < eps,
          beat: 1 + (barPhase * r.timing.meter.denominator) / 4,
        });
      }
    };
    if (t.lead > 0 && lower < t.lead)
      for (
        let n = Math.max(0, Math.ceil(lower / entryRegion.seconds - eps));
        n < Math.ceil(origin);
        n++
      ) {
        const at = n * entryRegion.seconds;
        if (at < t.lead - eps)
          append(at, entryRegion, n * pulseQuarters[entryRegion.timing.tempo.pulse], true);
      }
    const music = (from: number, to: number, elapsedStart: number, pulseStart: number) => {
      for (const r of this.regions) {
        const start = Math.max(from, r.start, from + lower - elapsedStart),
          end = Math.min(to, r.end, from + upper - elapsedStart);
        if (start >= end - eps) continue;
        const base = pulseStart + this.coordinate(start) - this.coordinate(from);
        for (let n = Math.ceil(base - eps); ; n++) {
          const at = start + (n - base) * r.seconds;
          if (at >= end - eps) break;
          append(
            elapsedStart + at - from,
            r,
            r.timing.startingBarPhase +
              ((at - r.start) / r.seconds) * pulseQuarters[r.timing.tempo.pulse],
            false,
          );
        }
      }
    };
    const firstEnd = t.loop ? this.timeline.spans[t.loop.last].end : this.timeline.duration;
    music(t.entry, firstEnd, t.lead, origin);
    if (t.loop) {
      const from = this.timeline.spans[t.loop.first].start,
        duration = firstEnd - from,
        repeatsAt = t.lead + firstEnd - t.entry;
      const pulseStart = origin + this.coordinate(firstEnd) - this.coordinate(t.entry),
        advance = this.coordinate(firstEnd) - this.coordinate(from);
      for (
        let cycle = Math.max(0, Math.floor((lower - repeatsAt) / duration));
        cycle < Math.ceil((upper - repeatsAt) / duration);
        cycle++
      )
        music(from, firstEnd, repeatsAt + cycle * duration, pulseStart + cycle * advance);
    }
    return result.sort((a, b) => a.elapsed - b.elapsed);
  }
  display(t: Transport, elapsed: number) {
    const nearby = this.pulses(
      t,
      Math.max(0, elapsed - this.longest * 2),
      elapsed + this.longest * 2,
    );
    const click = nearby.filter((c) => c.elapsed <= elapsed + eps).at(-1);
    if (!click) return null;
    let next = nearby.find((c) => c.elapsed > elapsed + eps)?.elapsed;
    if (next === undefined) {
      const coordinate =
        this.origin(t) + this.coordinate(this.timeline.duration) - this.coordinate(t.entry);
      next =
        t.lead +
        this.timeline.duration -
        t.entry +
        (Math.ceil(coordinate - eps) - coordinate) * this.regions.at(-1)!.seconds;
    }
    return {
      click,
      progress: Math.min(
        1,
        Math.max(0, (elapsed - click.elapsed) / Math.max(eps, next - click.elapsed)),
      ),
    };
  }
}
