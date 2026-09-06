import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareCinematicUpload } from "@/editor/cinematicMediaImport";
import { IMAGE_IMPORT_MAX_BYTES } from "@/editor/panels/resourceManagerImageImport";
import { mediaImportRuleFor } from "@/editor/panels/resourceManagerMediaImport";
import { store } from "@/project/store";

type UploadKind = Parameters<typeof prepareCinematicUpload>[1];

const readers: ControlledReader[] = [];
const images: ControlledImage[] = [];
const media: ControlledMedia[] = [];

class ControlledReader {
  readyState = 0;
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  blob!: Blob;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() { readers.push(this); }
  readAsDataURL(blob: Blob): void {
    this.blob = blob;
    this.readyState = 1;
  }
  complete(result: string | ArrayBuffer | null): void {
    this.result = result;
    this.readyState = 2;
    this.onload?.();
  }
  abort = vi.fn(() => {
    this.readyState = 2;
    this.onabort?.();
  });
}

class ControlledImage {
  src = "";
  naturalWidth = 320;
  naturalHeight = 240;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { images.push(this); }
  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }
}

class ControlledMedia {
  src = "";
  preload = "";
  muted = false;
  readyState = 0;
  duration = 3;
  videoWidth = 640;
  videoHeight = 360;
  onloadedmetadata: (() => void) | null = null;
  onloadeddata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  load = vi.fn();
  pause = vi.fn();
  play = vi.fn();
  constructor(readonly tag: string) { media.push(this); }
  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }
}

function fileFor(kind: UploadKind): File {
  if (kind === "image") return new File(["image bytes"], "scene.gif", { type: "image/gif" });
  if (kind === "video") return new File(["video bytes"], "scene.webm", { type: "video/webm" });
  return new File(["audio bytes"], "voice.ogg", { type: "audio/ogg" });
}

async function completeRead(): Promise<string> {
  const reader = readers.at(-1)!;
  const bytes = Buffer.from(await reader.blob.arrayBuffer());
  const dataUrl = `data:${reader.blob.type};base64,${bytes.toString("base64")}`;
  reader.complete(dataUrl);
  return dataUrl;
}

function completeDecode(kind: UploadKind): void {
  if (kind === "image") images.at(-1)!.onload?.();
  else {
    const target = media.at(-1)!;
    target.readyState = 2;
    target.onloadeddata?.();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  readers.length = 0;
  images.length = 0;
  media.length = 0;
  vi.stubGlobal("FileReader", ControlledReader);
  vi.stubGlobal("Image", ControlledImage);
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag !== "audio" && tag !== "video") throw new Error(`Unexpected native resource: ${tag}`);
      return new ControlledMedia(tag);
    },
  });
  // Preserve real store behavior; preparation must never access it.
  vi.spyOn(store, "getCurrent");
  vi.spyOn(store, "update");
});

afterEach(() => {
  try {
    expect(store.getCurrent).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

describe("prepareCinematicUpload", () => {
  it.each(["png", "jpeg", "gif", "webp"])("preserves %s payload bytes without canvas conversion", async (format) => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
    const file = new File([bytes], `scene.${format}`, { type: `image/${format}` });
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const promise = prepareCinematicUpload(file, "image", controller.signal);
    const dataUrl = await completeRead();
    expect(images[0].src).toBe(dataUrl);
    completeDecode("image");
    const asset = await promise;
    expect(asset).toMatchObject({
      name: "scene",
      kind: "picture",
      dataUrl,
      meta: { width: 320, height: 240 },
    });
    expect(asset.id.startsWith("picture_img")).toBe(true);
    expect(Buffer.from(asset.dataUrl.split(",")[1], "base64")).toEqual(Buffer.from(bytes));
    expect(images[0].src).toBe("");
    expect(images[0].onload).toBeNull();
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it.each([
    ["scene.gif", "", "image/gif"],
    ["scene.webp", "application/octet-stream", "image/webp"],
    ["scene.jpg", "image/jpg", "image/jpeg"],
  ])("canonicalizes the header for %s without changing bytes", async (name, type, mime) => {
    const promise = prepareCinematicUpload(new File(["original"], name, { type }), "image", new AbortController().signal);
    const dataUrl = await completeRead();
    completeDecode("image");
    expect((await promise).dataUrl).toBe(dataUrl);
    expect(dataUrl).toBe(`data:${mime};base64,${Buffer.from("original").toString("base64")}`);
  });

  it.each([
    ["video", "scene.webm", "video/webm"],
    ["video", "scene.mp4", "video/mp4"],
    ["video", "scene.m4v", "video/mp4"],
    ["video", "scene.ogv", "video/ogg"],
    ["audio", "voice.wav", "audio/wav"],
    ["audio", "voice.mp3", "audio/mpeg"],
    ["audio", "voice.ogg", "audio/ogg"],
  ] as const)("prepares %s %s after decodable data without playback", async (kind, name, mime) => {
    const promise = prepareCinematicUpload(new File(["payload"], name, { type: mime }), kind, new AbortController().signal);
    const dataUrl = await completeRead();
    const target = media[0];
    expect(target.tag).toBe(kind);
    target.readyState = 1;
    target.onloadedmetadata?.();
    expect(target.pause).not.toHaveBeenCalled();
    expect(target.src).toBe(dataUrl);
    completeDecode(kind);
    const asset = await promise;
    expect(asset.kind).toBe(kind === "video" ? "movie" : "sound");
    expect(asset.id.startsWith(kind === "video" ? "movie" : "se")).toBe(true);
    expect(asset.dataUrl).toBe(dataUrl);
    expect(asset.meta).toEqual(kind === "video" ? { width: 640, height: 360 } : {});
    expect(target.play).not.toHaveBeenCalled();
    expect(target.pause).toHaveBeenCalledOnce();
    expect(target.src).toBe("");
    expect(target.onloadeddata).toBeNull();
    expect(target.load).toHaveBeenCalledTimes(2);
  });

  it("accepts a decoded video whose duration is not yet known", async () => {
    const promise = prepareCinematicUpload(fileFor("video"), "video", new AbortController().signal);
    const accepted = expect(promise).resolves.toMatchObject({
      kind: "movie",
      meta: { width: 640, height: 360 },
    });
    await completeRead();
    media[0].duration = Number.POSITIVE_INFINITY;
    completeDecode("video");
    await accepted;
    expect(media[0].src).toBe("");
  });

  it.each(["image", "video", "audio"] as const)("rejects empty and oversized %s before reading", async (kind) => {
    const source = fileFor(kind);
    await expect(prepareCinematicUpload(new File([], source.name, { type: source.type }), kind, new AbortController().signal))
      .rejects.toBeInstanceOf(RangeError);
    const limit = kind === "image" ? IMAGE_IMPORT_MAX_BYTES : mediaImportRuleFor(kind === "video" ? "movie" : "sound")!.maxBytes;
    Object.defineProperty(source, "size", { value: limit + 1 });
    await expect(prepareCinematicUpload(source, kind, new AbortController().signal)).rejects.toBeInstanceOf(RangeError);
    expect(readers).toHaveLength(0);
  });

  it.each(["image", "video", "audio"] as const)("accepts the exact %s size boundary", async (kind) => {
    const source = fileFor(kind);
    const limit = kind === "image" ? IMAGE_IMPORT_MAX_BYTES : mediaImportRuleFor(kind === "video" ? "movie" : "sound")!.maxBytes;
    Object.defineProperty(source, "size", { value: limit });
    const controller = new AbortController();
    const promise = prepareCinematicUpload(source, kind, controller.signal);
    expect(readers).toHaveLength(1);
    const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
  });

  it.each([
    ["image", "scene.svg", "image/svg+xml"],
    ["video", "scene.avi", "video/x-msvideo"],
    ["audio", "voice.mid", "audio/midi"],
    ["video", "scene.webm", "image/png"],
    ["audio", "voice.ogg", "video/ogg"],
  ] as const)("rejects unsupported %s format %s before reading", async (kind, name, type) => {
    await expect(prepareCinematicUpload(new File(["x"], name, { type }), kind, new AbortController().signal))
      .rejects.toBeInstanceOf(TypeError);
    expect(readers).toHaveLength(0);
  });

  it("propagates native read errors", async () => {
    const promise = prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal);
    const error = new DOMException("read failed", "NotReadableError");
    const rejection = expect(promise).rejects.toBe(error);
    readers[0].error = error;
    readers[0].readyState = 2;
    readers[0].onerror?.();
    await rejection;
    expect(readers[0].abort).not.toHaveBeenCalled();
    expect(readers[0].onerror).toBeNull();
    expect(images).toHaveLength(0);
  });

  it("propagates synchronous read failures and removes the deadline", async () => {
    const error = new Error("read failed");
    vi.spyOn(ControlledReader.prototype, "readAsDataURL").mockImplementationOnce(() => { throw error; });
    await expect(prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal)).rejects.toBe(error);
  });

  it.each([null, "", "data:image/gif;base64,", "data:text/plain;base64,eA=="])("rejects an unusable reader result", async (result) => {
    const promise = prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal);
    const rejection = expect(promise).rejects.toMatchObject({ name: "NotReadableError" });
    readers[0].complete(result);
    await rejection;
    expect(images).toHaveLength(0);
  });

  it.each(["image", "video", "audio"] as const)("rejects %s decoder failures and releases native resources", async (kind) => {
    const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
    const rejection = expect(promise).rejects.toMatchObject({ name: "EncodingError" });
    await completeRead();
    const target = kind === "image" ? images[0] : media[0];
    target.onerror?.();
    await rejection;
    expect(target.src).toBe("");
    expect(target.onerror).toBeNull();
  });

  it.each(["image", "video", "audio"] as const)("rejects invalid %s dimensions or duration", async (kind) => {
    const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
    const rejection = expect(promise).rejects.toMatchObject({ name: "EncodingError" });
    await completeRead();
    if (kind === "image") images[0].naturalWidth = 0;
    else if (kind === "video") media[0].videoHeight = 0;
    else media[0].duration = Number.NaN;
    completeDecode(kind);
    await rejection;
  });

  it("rejects pre-aborted work without allocating native resources", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(prepareCinematicUpload(fileFor("image"), "image", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(readers).toHaveLength(0);
  });

  it("aborts a pending reader and ignores its late completion", async () => {
    const controller = new AbortController();
    const promise = prepareCinematicUpload(fileFor("image"), "image", controller.signal);
    const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
    expect(readers[0].abort).toHaveBeenCalledOnce();
    readers[0].complete("data:image/gif;base64,eA==");
    expect(images).toHaveLength(0);
  });

  it.each(["image", "video", "audio"] as const)("cancels pending %s decoding", async (kind) => {
    const controller = new AbortController();
    const promise = prepareCinematicUpload(fileFor(kind), kind, controller.signal);
    const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await completeRead();
    controller.abort();
    await rejection;
    expect((kind === "image" ? images[0] : media[0]).src).toBe("");
    completeDecode(kind);
  });

  it("rejects cancellation between the final native event and async return", async () => {
    const controller = new AbortController();
    const promise = prepareCinematicUpload(fileFor("video"), "video", controller.signal);
    const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await completeRead();
    completeDecode("video");
    controller.abort();
    await rejection;
  });

  it.each(["read", "image", "video", "audio"] as const)("bounds stalled %s preparation without polling", async (stage) => {
    const kind = stage === "read" ? "image" : stage;
    const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
    const rejection = expect(promise).rejects.toMatchObject({ name: "TimeoutError" });
    if (stage !== "read") await completeRead();
    vi.advanceTimersByTime(15_000);
    await rejection;
    if (stage === "read") expect(readers[0].abort).toHaveBeenCalledOnce();
    else expect((kind === "image" ? images[0] : media[0]).src).toBe("");
  });
});
