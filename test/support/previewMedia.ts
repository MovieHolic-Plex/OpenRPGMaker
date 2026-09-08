import { vi } from "vitest";

/** Browser decoding is unavailable in happy-dom; preserve the media event boundary. */
export function installPreviewMedia() {
  const paused = new WeakMap<HTMLMediaElement, boolean>();
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (this: HTMLMediaElement) { return paused.get(this) ?? true; });
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    paused.set(this, false);
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    if (paused.get(this) !== false) return;
    paused.set(this, true);
    this.dispatchEvent(new Event("pause"));
  });
  const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  return { play, pause, load };
}

export function previewMedia(host: ParentNode = document): HTMLAudioElement {
  const media = host.querySelector("audio");
  if (!(media instanceof HTMLAudioElement)) throw new Error("Selected preview media missing");
  return media;
}

export function mediaMetadata(media: HTMLAudioElement, duration: number): void {
  Object.defineProperty(media, "duration", { value: duration, configurable: true });
  media.dispatchEvent(new Event("loadedmetadata"));
}

export function mediaEvent(media: HTMLAudioElement, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { media.removeEventListener(name, done); reject(new Error(`Missing media event: ${name}`)); }, 2000);
    function done(): void { clearTimeout(timeout); resolve(); }
    media.addEventListener(name, done, { once: true });
  });
}
