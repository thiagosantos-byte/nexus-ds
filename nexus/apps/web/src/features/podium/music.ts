import type { Phase } from "./model";
const assets = {
  bed: new URL("./audio/anticipation.mp3", import.meta.url).href,
  reveal: new URL("./audio/reveal.mp3", import.meta.url).href,
  victory: new URL("./audio/victory.mp3", import.meta.url).href,
};
/** Optional local soundtrack. No oscillator beeps, streaming service or model calls. */
export class CeremonyMusic {
  private context = new AudioContext();
  private master = this.context.createGain();
  private bedGain = this.context.createGain();
  private buffers = new Map<string, AudioBuffer>();
  private sources = new Set<AudioBufferSourceNode>();
  private bed: AudioBufferSourceNode | null = null;
  private phase = -1;
  private disposed = false;
  private abort = new AbortController();
  constructor() {
    this.master.connect(this.context.destination);
    this.bedGain.connect(this.master);
    this.volume(25);
  }
  async prepare() {
    // Called directly from a click so browser audio policies are respected.
    await this.context.resume();
    await Promise.all(
      Object.entries(assets).map(async ([key, url]) => {
        const response = await fetch(url, { signal: this.abort.signal });
        if (!response.ok) throw new Error("Soundtrack unavailable");
        const buffer = await this.context.decodeAudioData(
          await response.arrayBuffer(),
        );
        if (!this.disposed) this.buffers.set(key, buffer);
      }),
    );
  }
  volume(value: number) {
    this.master.gain.setTargetAtTime(
      Math.max(0, Math.min(100, value)) / 100,
      this.context.currentTime,
      0.06,
    );
  }
  private play(key: string, offset = 0, loop = false) {
    const buffer = this.buffers.get(key);
    if (!buffer || this.disposed || (!loop && offset >= buffer.duration))
      return null;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(loop ? this.bedGain : this.master);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
    };
    this.sources.add(source);
    source.start(0, loop ? offset % buffer.duration : Math.max(0, offset));
    return source;
  }
  sync(phase: Phase, elapsed: number, winnerStart: number) {
    if (this.disposed || this.phase === phase.start || this.buffers.size !== 3)
      return;
    this.phase = phase.start;
    if (["intro", "reveal", "suspense"].includes(phase.kind)) {
      if (!this.bed) this.bed = this.play("bed", elapsed / 1000, true);
      this.bedGain.gain.setTargetAtTime(
        phase.kind === "suspense" ? 0.95 : 0.65,
        this.context.currentTime,
        0.35,
      );
      if (phase.kind === "reveal")
        this.play("reveal", Math.max(0, elapsed - phase.start) / 1000);
    } else {
      this.bedGain.gain.setTargetAtTime(0, this.context.currentTime, 0.2);
      if (phase.kind === "winner" || !this.sources.size)
        this.play("victory", Math.max(0, elapsed - winnerStart) / 1000);
    }
  }
  async resume() {
    if (!this.disposed) await this.context.resume();
  }
  pause() {
    if (!this.disposed) void this.context.suspend().catch(() => {});
  }
  dispose() {
    this.disposed = true;
    this.abort.abort();
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
      source.disconnect();
    }
    this.sources.clear();
    this.bed = null;
    if (this.context.state !== "closed")
      void this.context.close().catch(() => {});
  }
}
