export type AudioPreviewPhase = "empty" | "ready" | "loading" | "playing" | "paused" | "stopped" | "ended" | "error" | "unavailable";
export type AudioPreviewState = {
  readonly phase: AudioPreviewPhase;
  readonly current: number;
  readonly duration: number | null;
  readonly error: string;
  readonly requested: boolean;
};
export type AudioPreviewSettings = {
  readonly volume: number;
  readonly tempo: number;
  readonly pan: number;
  readonly fade: number;
};
export const AUDIO_PREVIEW_DEFAULTS: AudioPreviewSettings = { volume: 100, tempo: 100, pan: 0, fade: 0 };

// This ownership is editor-only. It never imports or stops the gameplay engine.
let active: AudioPreviewSession | undefined;

export class AudioPreviewSession {
  private media: HTMLAudioElement | undefined;
  private cleanup: (() => void) | undefined;
  private context: AudioContext | undefined;
  private source: MediaElementAudioSourceNode | undefined;
  private panner: StereoPannerNode | undefined;
  private url: string | null = null;
  private unavailable = "";
  private loop = false;
  private disposed = false;
  private request = 0;
  private intent = false;
  private frame = 0;
  private fadeElapsed = 0;
  private lastPosition = 0;
  private fadeSeconds = 0;
  private state: AudioPreviewState = { phase: "empty", current: 0, duration: null, error: "", requested: false };
  private settings: AudioPreviewSettings = AUDIO_PREVIEW_DEFAULTS;
  private readonly listeners = new Set<(state: AudioPreviewState) => void>();

  constructor(private readonly host: HTMLElement) {}

  subscribe(listener: (state: AudioPreviewState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }

  select(url: string | null, unavailable = "", loop = false): void {
    if (this.disposed || (url === this.url && this.unavailable === unavailable && this.loop === loop)) return;
    this.release();
    this.url = url;
    this.unavailable = unavailable;
    this.loop = loop;
    this.update({ phase: unavailable ? "unavailable" : url ? "ready" : "empty", current: 0, duration: null, error: unavailable });
    if (url && !unavailable) this.mount();
  }

  private update(patch: Partial<AudioPreviewState>): void {
    this.state = { ...this.state, ...patch, requested: this.intent };
    for (const listener of this.listeners) listener(this.state);
  }

  private mount(resumeAt = 0): void {
    if (!this.url) return;
    const media = document.createElement("audio");
    media.preload = "metadata";
    media.loop = this.loop;
    media.hidden = true;
    media.dataset.editorAudioPreview = "true";
    // Native playback does not require CORS. Only the requested pan route does.
    if (this.settings.pan !== 0) media.crossOrigin = "anonymous";
    media.src = this.url;
    if (resumeAt > 0) media.currentTime = resumeAt;
    media.playbackRate = this.settings.tempo / 100;
    media.volume = this.settings.volume / 100;
    this.media = media;
    this.host.replaceChildren(media);
    const handlers: [string, () => void][] = [];
    const on = (name: string, handler: () => void): void => {
      const guarded = (): void => { if (this.media === media && !this.disposed) handler(); };
      handlers.push([name, guarded]);
      media.addEventListener(name, guarded);
    };
    const timing = (): void => {
      this.update({ current: media.currentTime, duration: Number.isFinite(media.duration) && media.duration > 0 ? media.duration : null });
      this.applyVolume();
    };
    on("loadedmetadata", () => { if (resumeAt > 0) { media.currentTime = resumeAt; this.lastPosition = resumeAt; } timing(); });
    on("durationchange", timing);
    on("timeupdate", timing);
    on("loadstart", () => { if (this.state.phase === "ready" || this.intent) this.update({ phase: "loading" }); });
    on("canplay", () => { if (!this.intent && this.state.phase === "loading") this.update({ phase: media.currentTime > 0 ? "paused" : "ready" }); });
    on("waiting", () => { if (this.intent) this.update({ phase: "loading" }); });
    on("stalled", () => { if (this.intent) this.update({ phase: "loading" }); });
    on("playing", () => {
      if (!this.intent) { media.pause(); return; }
      this.update({ phase: "playing", error: "" });
      this.animateFade();
    });
    on("pause", () => {
      cancelAnimationFrame(this.frame);
      if (media.paused && this.state.phase !== "stopped" && this.state.phase !== "error" && this.state.phase !== "ended" && !media.ended) {
        this.intent = false;
        this.update({ phase: "paused" });
      }
    });
    on("ended", () => {
      this.intent = false;
      cancelAnimationFrame(this.frame);
      this.update({ phase: "ended", current: media.currentTime });
    });
    on("error", () => this.fail(media.error?.message || "음원을 불러올 수 없습니다. 파일·코덱 또는 CORS 설정을 확인하세요."));
    this.cleanup = () => { for (const [name, handler] of handlers) media.removeEventListener(name, handler); };
  }

  async play(): Promise<void> {
    if (this.disposed) return;
    if (this.state.phase === "error" && this.settings.pan !== 0) { this.release(); this.mount(); }
    const media = this.media;
    if (!media || this.disposed) return;
    if (active && active !== this) active.stop();
    active = this;
    const request = ++this.request;
    this.intent = true;
    if (this.state.phase === "ended" || media.ended) media.currentTime = 0;
    if (media.currentTime === 0) {
      this.fadeElapsed = 0;
      this.lastPosition = 0;
      this.fadeSeconds = this.settings.fade;
    }
    this.update({ phase: "loading", error: "" });
    this.applyVolume();
    try {
      if (this.settings.pan !== 0) {
        if (!this.context) {
          this.context = new AudioContext();
          this.source = this.context.createMediaElementSource(media);
          this.panner = this.context.createStereoPanner();
          this.source.connect(this.panner);
          this.panner.connect(this.context.destination);
        }
        if (this.panner) this.panner.pan.value = this.settings.pan / 100;
        await this.context.resume();
        if (request !== this.request || this.media !== media) return;
      }
      await media.play();
      // A fulfilled play promise is NOT a playing event.
    } catch (error) {
      if (request !== this.request || this.media !== media || this.disposed) return;
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  pause(): void {
    this.intent = false;
    ++this.request;
    this.media?.pause();
    if (this.state.phase === "loading") this.update({ phase: "paused" });
  }

  stop(): void {
    this.intent = false;
    ++this.request;
    cancelAnimationFrame(this.frame);
    if (this.media) {
      this.update({ phase: "stopped", current: 0 });
      this.media.pause();
      this.media.currentTime = 0;
    }
    if (active === this) active = undefined;
  }

  seek(seconds: number): void {
    if (!this.media || this.state.duration === null || !Number.isFinite(seconds)) return;
    const next = Math.max(0, Math.min(this.state.duration, seconds));
    this.lastPosition = next;
    this.media.currentTime = next;
    this.update({ current: next, ...(this.state.phase === "ended" ? { phase: "paused" } : {}) });
  }

  configure(settings: AudioPreviewSettings): void {
    const panChanged = settings.pan !== this.settings.pan;
    this.settings = settings;
    if (!this.media) return;
    this.media.playbackRate = settings.tempo / 100;
    this.applyVolume();
    if (panChanged && settings.pan !== 0 && !this.panner) {
      const position = this.media.currentTime;
      const playing = this.intent;
      const fade = { seconds: this.fadeSeconds, elapsed: this.fadeElapsed };
      this.release();
      this.mount(position);
      this.fadeSeconds = fade.seconds;
      this.fadeElapsed = fade.elapsed;
      this.lastPosition = position;
      if (playing) void this.play();
    } else if (this.panner) {
      this.panner.pan.value = settings.pan / 100;
    }
    // Reset also restores the no-CORS native route after a pan loading failure.
    if (panChanged && settings.pan === 0 && this.state.phase === "error") {
      this.release();
      this.mount();
      this.update({ phase: "ready", error: "", current: 0 });
    }
  }

  private applyVolume(): void {
    if (!this.media) return;
    const current = this.media.currentTime;
    const delta = current - this.lastPosition;
    if (this.intent && !this.media.seeking) {
      this.fadeElapsed += delta >= 0 ? delta : this.loop && Number.isFinite(this.media.duration) ? this.media.duration + delta : 0;
    }
    this.lastPosition = current;
    const fade = this.fadeSeconds > 0 ? Math.max(0, Math.min(1, this.fadeElapsed / this.fadeSeconds)) : 1;
    this.media.volume = this.settings.volume / 100 * fade;
  }

  private animateFade(): void {
    cancelAnimationFrame(this.frame);
    this.applyVolume();
    if (this.media && this.state.phase === "playing" && this.fadeElapsed < this.fadeSeconds) {
      this.frame = requestAnimationFrame(() => this.animateFade());
    }
  }

  private fail(error: string): void {
    this.intent = false;
    this.update({ phase: "error", error });
    this.media?.pause();
    cancelAnimationFrame(this.frame);
  }

  private release(): void {
    ++this.request;
    this.intent = false;
    cancelAnimationFrame(this.frame);
    this.cleanup?.();
    this.cleanup = undefined;
    if (this.media) {
      this.media.pause();
      this.media.removeAttribute("src");
      this.media.load();
      this.media.remove();
      this.media = undefined;
    }
    this.source?.disconnect();
    this.panner?.disconnect();
    if (this.context) void this.context.close().catch((error: unknown) => console.error("Editor preview context cleanup failed", error instanceof Error ? error.message : String(error)));
    this.context = undefined;
    this.source = undefined;
    this.panner = undefined;
    this.fadeSeconds = 0;
    if (active === this) active = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.release();
    this.listeners.clear();
  }
}
