export class Microphone {
  private generation = 0;
  private stream?: MediaStream;
  private context?: AudioContext;
  private timer?: number;
  private worker?: Worker;
  async start(
    deviceId: string,
    onPitch: (value: { hz: number; clarity: number } | null) => void,
    onFailure: (message: string) => void,
    pipeline?: { create: () => Worker; init: unknown; receive: (data: any) => void },
  ) {
    const generation = ++this.generation;
    await this.release();
    if (generation !== this.generation) return false;
    await window.desktop.microphone(true);
    if (generation !== this.generation) return false;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    this.stream = stream;
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    try {
      await context.resume();
      if (generation !== this.generation) return false;
      const source = context.createMediaStreamSource(stream),
        analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      source.connect(analyser);
      const worker =
        pipeline?.create() ??
        new Worker(new URL('./pitch.worker.ts', import.meta.url), { type: 'module' });
      if (pipeline) worker.postMessage(pipeline.init);
      this.worker = worker;
      let pending = false;
      worker.onmessage = (event) => {
        pending = false;
        if (generation === this.generation) {
          if (pipeline) pipeline.receive(event.data);
          else onPitch(event.data);
        }
      };
      worker.onerror = () => {
        onFailure('音高分析未能启动，请重新打开调音器。');
        void this.stop();
      };
      this.timer = window.setInterval(() => {
        if (pending) return;
        const input = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(input);
        pending = true;
        worker.postMessage({ input, sampleRate: context.sampleRate, time: context.currentTime }, [
          input.buffer,
        ]);
      }, 85);
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          onFailure('麦克风已断开，请检查输入设备后重新监听。');
          void this.stop();
        };
        track.onmute = () => {
          onFailure('麦克风输入已中断，请重新监听。');
          void this.stop();
        };
      });
      context.onstatechange = () => {
        if (context.state === 'suspended') {
          onFailure('音频输入已暂停，请重新监听。');
          void this.stop();
        }
      };
      return true;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }
  reset(index: number) {
    this.worker?.postMessage({ reset: index });
  }
  async stop() {
    this.generation++;
    await this.release();
  }
  private async release() {
    window.clearInterval(this.timer);
    this.worker?.terminate();
    this.worker = undefined;
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.onmute = null;
      track.stop();
    });
    this.stream = undefined;
    const context = this.context;
    this.context = undefined;
    const disarmed = window.desktop.microphone(false);
    if (context) {
      context.onstatechange = null;
      await context.close();
    }
    await disarmed;
  }
}
