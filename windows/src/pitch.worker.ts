import { LocalPitch } from './core/pitch';
const detector = new LocalPitch();
self.onmessage = (event: MessageEvent<{ input: Float32Array; sampleRate: number }>) =>
  self.postMessage(detector.detect(event.data.input, event.data.sampleRate));
