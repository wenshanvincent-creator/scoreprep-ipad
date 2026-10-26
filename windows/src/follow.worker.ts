import { ScoreAudioFeatures, ScoreFollower } from './core/following';
import type { PerformanceGroup } from './core/music';
const features = new ScoreAudioFeatures();
let follower: ScoreFollower;
let a4 = 440;
self.onmessage = (
  event: MessageEvent<{
    groups?: PerformanceGroup[];
    polyphonic?: boolean;
    a4?: number;
    reset?: number;
    input?: Float32Array;
    sampleRate?: number;
    time?: number;
  }>,
) => {
  const v = event.data;
  if (v.groups) {
    follower = new ScoreFollower(v.groups, !!v.polyphonic);
    a4 = v.a4 ?? 440;
  }
  if (v.reset !== undefined) follower?.reset(v.reset);
  if (v.input && follower)
    self.postMessage(follower.update(features.process(v.input, v.sampleRate!, v.time!, a4)));
};
