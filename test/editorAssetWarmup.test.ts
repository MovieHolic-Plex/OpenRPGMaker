/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const colorKeyWarms: string[] = [];
vi.mock("@/assets/transparentColorKeyBackground", () => ({
  transparentColorKeyDataUrl: async (path: string) => {
    colorKeyWarms.push(path);
    if (blockColorKeyWarms) await new Promise<void>((resolve) => colorKeyResolvers.push(resolve));
    return "data:image/png;base64,";
  },
}));

import {
  editorWarmupColorKeyPaths,
  editorWarmupUrls,
  resetEditorAssetWarmup,
  scheduleEditorAssetWarmup,
  warmEditorPickerAssets,
} from "@/assets/editorAssetWarmup";
import {
  listBundledPlayAssetPaths,
  resetBundledPlayAssetWarmup,
  warmBundledPlayAssets,
} from "@/assets/bundledAssetWarmup";
import {
  imageWarmCount,
  resetImageWarmCache,
  warmImageUrl,
} from "@/assets/imageWarmQueue";

type FakeImage = {
  src: string;
  complete: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  decoding: string;
  fetchPriority: string;
};

const originalImage = globalThis.Image;
const originalIdle = (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;
let created: FakeImage[] = [];
let blockColorKeyWarms = false;
let colorKeyResolvers: Array<() => void> = [];

function installFakeImage(): void {
  class StubImage {
    src = "";
    complete = false;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = "";
    fetchPriority = "";
    constructor() {
      created.push(this as unknown as FakeImage);
    }
  }
  (globalThis as { Image: unknown }).Image = StubImage;
}

function settleAll(): void {
  for (const image of created) image.onload?.();
}

// 워밍이 실제로 끝날 때까지 "지금까지 만들어진 Image 전부 onload + 마이크로태스크 양보"를 반복한다.
// 새 Image 가 생기는지로 종료를 추정하면 색키 워밍 루프와 엇갈려 이른 종료로 보이고, 남은 워밍은
// 2초 로드 상한으로 끝나 테스트가 시간에 의지하게 된다.
async function drain(pending: Promise<void>): Promise<void> {
  let settled = false;
  void pending.then(() => {
    settled = true;
  });
  for (let guard = 0; guard < 20_000 && !settled; guard += 1) {
    settleAll();
    await Promise.resolve();
  }
  await pending;
}

describe("editorAssetWarmup", () => {
  beforeEach(() => {
    created = [];
    colorKeyWarms.length = 0;
    blockColorKeyWarms = false;
    colorKeyResolvers = [];
    installFakeImage();
  });

  afterEach(async () => {
    for (const resolve of colorKeyResolvers.splice(0)) resolve();
    await Promise.resolve();
    resetBundledPlayAssetWarmup();
    resetEditorAssetWarmup();
    resetImageWarmCache();
    (globalThis as { Image: unknown }).Image = originalImage;
    if (originalIdle === undefined) {
      delete (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;
      return;
    }
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = originalIdle;
  });

  it("picker tier covers faceset and chipset catalogs as root-absolute urls", () => {
    const urls = editorWarmupUrls("picker");
    expect(urls).toContain("/assets/easyrpg/faceset/Actor1/00.png");
    expect(urls).toContain("/assets/easyrpg-chipset-interior-transparent.png");
    expect(urls.every((url) => url.startsWith("/"))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });

  // 차량은 그림 자체가 아니라 색키 처리 결과다 — 캐시 키가 경로 문자열이므로 피커가 넘기는 형태와
  // 같은 상대 경로로 워밍해야 한다. 앞에 "/" 가 붙으면 캐시가 톨려 워밍이 무효해진다.
  it("warms charsets through the color-key cache using the picker's own path keys", async () => {
    const charsetPaths = editorWarmupColorKeyPaths();
    expect(charsetPaths).toContain("assets/easyrpg/charset/Actor1.png");
    expect(charsetPaths.every((path) => !path.startsWith("/"))).toBe(true);
    expect(editorWarmupUrls("picker")).not.toContain("/assets/easyrpg/charset/Actor1.png");

    const pending = warmEditorPickerAssets();
    await drain(pending);
    expect(new Set(colorKeyWarms)).toEqual(new Set(charsetPaths));
    expect(colorKeyWarms.length).toBe(charsetPaths.length);
  });

  it("library tier covers the cc0 icon catalog and is disjoint from the picker tier", () => {
    const library = editorWarmupUrls("library");
    const picker = new Set(editorWarmupUrls("picker"));
    expect(library).toContain("/assets/cc0/jetrel/icons/apple.png");
    expect(library.some((url) => picker.has(url))).toBe(false);
  });

  it("caps total in-flight requests across concurrent warm callers", async () => {
    const picker = warmEditorPickerAssets();
    const play = warmBundledPlayAssets();
    expect(created.length + colorKeyWarms.length).toBe(6);
    expect(editorWarmupUrls("picker").length).toBeGreaterThan(6);
    expect(listBundledPlayAssetPaths().length).toBeGreaterThan(6);
    await drain(Promise.all([picker, play]).then(() => undefined));
  });

  it("shares the global image budget with picker color-key loads", async () => {
    blockColorKeyWarms = true;
    const pending = warmEditorPickerAssets();
    expect(colorKeyWarms).toHaveLength(6);
    expect(created).toHaveLength(0);
    for (const resolve of colorKeyResolvers.splice(0)) resolve();
    blockColorKeyWarms = false;
    await drain(pending);
  });

  it("deduplicates relative and root-absolute forms of one url", async () => {
    const relative = warmImageUrl("assets/easyrpg-chipset-interior-transparent.png");
    const absolute = warmImageUrl("/assets/easyrpg-chipset-interior-transparent.png");
    expect(absolute).toBe(relative);
    expect(created).toHaveLength(1);
    expect(created[0]?.src).toBe("/assets/easyrpg-chipset-interior-transparent.png");
    await drain(relative);
  });

  it("requests every picker url exactly once across concurrent callers", async () => {
    const expected = editorWarmupUrls("picker");
    const first = warmEditorPickerAssets();
    const second = warmEditorPickerAssets();
    expect(second).toBe(first);
    await drain(first);
    await second;
    const requested = created.map((image) => image.src);
    expect(new Set(requested)).toEqual(new Set(expected));
    expect(requested.length).toBe(expected.length);
  });

  it("marks warm loads as low priority async decodes", async () => {
    const pending = warmImageUrl("assets/easyrpg-chipset-interior-transparent.png", { priority: "low" });
    expect(created[0]?.fetchPriority).toBe("low");
    expect(created[0]?.decoding).toBe("async");
    await drain(pending);
  });

  it("defers the background warm to an idle callback", async () => {
    const idleCallbacks: Array<() => void> = [];
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = (callback: () => void) => {
      idleCallbacks.push(callback);
      return 1;
    };
    scheduleEditorAssetWarmup();
    expect(created.length).toBe(0);
    expect(idleCallbacks.length).toBe(1);
    idleCallbacks[0]?.();
    expect(created.length + colorKeyWarms.length).toBeGreaterThan(0);
  });

  // 부팅 배경 워밍은 색키만 한다. 낱장 얼굴·칩셋·CC0 아이콘(1500장 이상)은 프로젝트 배경 작업과
  // 겹쳐 렉을 만들었으므로 이벤트 편집기 모달의 warmEditorPickerAssets() 가 앞당길 때만 받는다.
  it("boot background warm only touches charset color keys, not faceset/chipset/icon images", async () => {
    const idleCallbacks: Array<() => void> = [];
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = (callback: () => void) => {
      idleCallbacks.push(callback);
      return 1;
    };
    scheduleEditorAssetWarmup();
    idleCallbacks[0]?.();
    for (let guard = 0; guard < 2_000; guard += 1) {
      settleAll();
      await Promise.resolve();
    }
    expect(new Set(colorKeyWarms)).toEqual(new Set(editorWarmupColorKeyPaths()));
    expect(created).toHaveLength(0);
  });

  it("skips the background warm under data saver", () => {
    let idleCalls = 0;
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = () => {
      idleCalls += 1;
      return 1;
    };
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
    try {
      scheduleEditorAssetWarmup();
      expect(idleCalls).toBe(0);
      expect(imageWarmCount()).toBe(0);
    } finally {
      Reflect.deleteProperty(navigator, "connection");
    }
  });
});
