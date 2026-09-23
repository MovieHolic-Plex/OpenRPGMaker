import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { setUploadedAssetResolver } from "@/project/persistence/assetAccessors";
/** @vitest-environment happy-dom */
// 업로드한 캐릭터셋(charset)도 번들 캐릭터셋과 **같은 투명색 파이프라인**을 타야 한다.
// 원본 RM2000 캐릭셋은 배경이 단색(청록/마젠타)이고 알파가 없다 — 색상 키를 안 빼면
// 편집 맵과 인게임에서 스프라이트 주위에 배경 사각형이 그대로 남는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureBundledProjectTextures,
  ensureUploadedCharsetTextures,
  loadBundledAssets,
  rawCharsetTextureKey,
  registerUploadedCharsetTextures,
} from "@/assets/bundled";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { createBlankProject } from "@/project/defaults";
import type { Project, UploadedAsset } from "@/project/types";

const SHEET_WIDTH = RESOURCE_SLICING.charset.sheetWidth;
const SHEET_HEIGHT = RESOURCE_SLICING.charset.sheetHeight;
const CHARSET_ID = "charset_img_uploaded";
const CHARSET_DATA_URL = "data:image/png;base64,AAAA";
/** 좌상단 청록 배경 + 스프라이트 픽셀 한 개. 색상 키는 좌상단 픽셀을 기준으로 잡힌다. */
const TEAL_BACKGROUND_PIXELS = [31, 139, 139, 255, 31, 139, 139, 255, 200, 40, 40, 255];

type FakeTexture = {
  readonly frames: number[];
  add(frame: number, sourceIndex: number, x: number, y: number, width: number, height: number): void;
  getFrameNames(): string[];
  getSourceImage(): object;
};

function uploadedCharset(overrides: Partial<UploadedAsset> = {}): UploadedAsset {
  return {
    id: CHARSET_ID,
    name: "teal-charset",
    kind: "charset",
    dataUrl: CHARSET_DATA_URL,
    meta: {
      tileSize: 24,
      frames: 96,
      frameWidth: 24,
      frameHeight: 32,
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
    },
    ...overrides,
  } as UploadedAsset;
}

function projectWithUploadedCharset(asset: UploadedAsset = uploadedCharset()): Project {
  const project = createBlankProject();
  project.assets.uploaded[asset.id] = asset;
  return project;
}

function sourceImage(width = SHEET_WIDTH, height = SHEET_HEIGHT): HTMLImageElement {
  const image = document.createElement("img");
  Object.defineProperties(image, {
    naturalWidth: { value: width },
    naturalHeight: { value: height },
  });
  return image;
}

function fakeScene() {
  const queued: { readonly key: string; readonly url: string }[] = [];
  const textures = new Map<string, FakeTexture>();
  const loaderOnce = new Map<string, (() => void)[]>();
  const started: number[] = [];
  const addTexture = (key: string, source: object): FakeTexture => {
    const texture: FakeTexture = {
      frames: [],
      add(frame) {
        texture.frames.push(frame);
      },
      getFrameNames: () => texture.frames.map(String),
      getSourceImage: () => source,
    };
    textures.set(key, texture);
    return texture;
  };
  const anims = new Set<string>();
  const scene = {
    anims: {
      exists: (key: string): boolean => anims.has(key),
      create: (config: { key: string }) => { anims.add(config.key); },
    },
    load: {
      image(key: string, url: string) {
        queued.push({ key, url });
      },
      on() {},
      once(event: string, listener: () => void) {
        const listeners = loaderOnce.get(event) ?? [];
        listeners.push(listener);
        loaderOnce.set(event, listeners);
      },
      start() {
        started.push(started.length);
      },
    },
    textures: {
      exists: (key: string): boolean => textures.has(key),
      get: (key: string): FakeTexture | undefined => textures.get(key),
      addCanvas: (key: string, canvas: object): FakeTexture => addTexture(key, canvas),
    },
  };
  return {
    scene: scene as unknown as Phaser.Scene,
    queued,
    textures,
    started,
    addTexture,
    completeLoad(): void {
      for (const listener of loaderOnce.get("complete") ?? []) listener();
      loaderOnce.delete("complete");
    },
  };
}

let capturedPixels: Uint8ClampedArray[];

beforeEach(() => {
  capturedPixels = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    const pixels = new Uint8ClampedArray(TEAL_BACKGROUND_PIXELS);
    capturedPixels.push(pixels);
    return {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: pixels })),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
});

afterEach(() => {
  setUploadedAssetResolver(null);
  vi.restoreAllMocks();
});

describe("uploaded charset transparency", () => {
  it("loads persisted monster art and uses the full image for field events", () => {
    const asset = uploadedCharset({ kind: "monster" });
    const project = projectWithUploadedCharset(asset);
    const { scene, queued } = fakeScene();
    loadBundledAssets(scene, project);
    expect(queued).toContainEqual({ key: asset.id, url: CHARSET_DATA_URL });
    expect(resolveEventSpriteTexture(project, asset.id, 0)).toEqual({ texture: asset.id, frame: "__BASE", fitSize: 32 });
  });
  it.each(["preload", "late"])("loads file-backed charsets after SQLite reopen (%s)", (phase) => {
    const ref = { sha256: "a".repeat(64), mime: "image/png", bytes: 100, extension: "png" };
    const url = "/__oprn/assets/" + ref.sha256 + ".png";
    setUploadedAssetResolver({ url: () => url, bytes: async () => new Uint8Array() });
    const project = projectWithUploadedCharset(uploadedCharset({ dataUrl: undefined, ref }));
    const { scene, queued } = fakeScene();
    if (phase === "preload") loadBundledAssets(scene, project);
    else ensureUploadedCharsetTextures(scene, project);
    expect(queued).toContainEqual({ key: rawCharsetTextureKey(CHARSET_ID), url });
  });
  it("queues an uploaded charset under the raw key so the color key can be applied before use", () => {
    const { scene, queued } = fakeScene();

    loadBundledAssets(scene, projectWithUploadedCharset());

    // 원본은 raw 키로만 실린다 — 최종 키(asset.id)는 색상 키를 뺀 캔버스가 차지해야 한다.
    expect(queued).toContainEqual({ key: rawCharsetTextureKey(CHARSET_ID), url: CHARSET_DATA_URL });
    expect(queued.some((file) => file.key === CHARSET_ID)).toBe(false);
  });

  it("registers the uploaded charset as a color-keyed canvas with all 96 frames", () => {
    const harness = fakeScene();
    harness.addTexture(rawCharsetTextureKey(CHARSET_ID), sourceImage());

    registerUploadedCharsetTextures(harness.scene, projectWithUploadedCharset());

    const texture = harness.textures.get(CHARSET_ID);
    expect(texture).toBeDefined();
    expect(texture?.frames).toHaveLength(RESOURCE_SLICING.charset.count);
    // 좌상단 청록 배경은 알파 0, 스프라이트 픽셀은 그대로.
    const pixels = capturedPixels.at(-1);
    expect(pixels?.[3]).toBe(0);
    expect(pixels?.[7]).toBe(0);
    expect(pixels?.[11]).toBe(255);
  });

  it("skips a charset sheet whose dimensions are not the 288x256 grid", () => {
    const harness = fakeScene();
    harness.addTexture(rawCharsetTextureKey(CHARSET_ID), sourceImage(100, 100));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    registerUploadedCharsetTextures(harness.scene, projectWithUploadedCharset());

    expect(harness.textures.has(CHARSET_ID)).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it("loads a charset imported after scene boot and registers it when the loader finishes", () => {
    const harness = fakeScene();
    const project = projectWithUploadedCharset();

    ensureUploadedCharsetTextures(harness.scene, project);

    // 실행 중인 씬에 뒤늦게 실린다 — 이게 없으면 방금 등록한 캐릭셋 이벤트가 빈 칸으로 보인다.
    expect(harness.queued).toContainEqual({ key: rawCharsetTextureKey(CHARSET_ID), url: CHARSET_DATA_URL });
    expect(harness.started).toHaveLength(1);

    harness.addTexture(rawCharsetTextureKey(CHARSET_ID), sourceImage());
    harness.completeLoad();

    expect(harness.textures.get(CHARSET_ID)?.frames).toHaveLength(RESOURCE_SLICING.charset.count);
  });

  it("does not re-queue a charset that is already loaded", () => {
    const harness = fakeScene();
    const project = projectWithUploadedCharset();
    harness.addTexture(CHARSET_ID, sourceImage());

    ensureUploadedCharsetTextures(harness.scene, project);

    expect(harness.queued).toHaveLength(0);
    expect(harness.started).toHaveLength(0);
  });

  it("does not re-queue a charset whose load is still in flight", () => {
    const harness = fakeScene();
    const project = projectWithUploadedCharset();

    ensureUploadedCharsetTextures(harness.scene, project);
    ensureUploadedCharsetTextures(harness.scene, project);

    expect(harness.queued).toHaveLength(1);
    expect(harness.started).toHaveLength(1);
  });

  // 실측 2026-09-23: 조수가 새 프로젝트 맵을 숲마을 칩셋(tex_forest_harmony)으로 바꾸자 편집 캔버스가
  // Phaser 의 "빠진 텍스처" 빗금(__MISSING)으로만 그려졌다. preload 는 부팅 때 쓰던 칩셋만 싣는다.
  it("loads a bundled chipset the project starts using after scene boot and registers its frames", () => {
    const harness = fakeScene();
    const project = createBlankProject();
    const tileset = Object.values(project.tilesets)[0]!;
    (tileset as { textureKey: string }).textureKey = "tex_forest_harmony";
    let redrawn = 0;

    ensureBundledProjectTextures(harness.scene, project, () => { redrawn += 1; });

    expect(harness.queued.map((entry) => entry.key)).toContain("tex_forest_harmony");
    expect(harness.started).toHaveLength(1);

    harness.addTexture("tex_forest_harmony", sourceImage(480, 608));
    harness.completeLoad();

    expect(harness.textures.get("tex_forest_harmony")!.frames.length).toBeGreaterThan(1140);
    expect(redrawn).toBe(1);
  });

  it("does not queue bundled textures that are already loaded or in flight", () => {
    const harness = fakeScene();
    const project = createBlankProject();
    const tileset = Object.values(project.tilesets)[0]!;
    (tileset as { textureKey: string }).textureKey = "tex_forest_harmony";

    ensureBundledProjectTextures(harness.scene, project);
    ensureBundledProjectTextures(harness.scene, project);
    expect(harness.queued.filter((entry) => entry.key === "tex_forest_harmony")).toHaveLength(1);

    const loaded = fakeScene();
    loaded.addTexture("tex_forest_harmony", sourceImage(480, 608));
    ensureBundledProjectTextures(loaded.scene, project);
    expect(loaded.queued.map((entry) => entry.key)).not.toContain("tex_forest_harmony");
  });
});
