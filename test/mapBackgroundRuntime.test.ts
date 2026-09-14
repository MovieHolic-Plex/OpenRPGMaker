import { describe, expect, it, vi } from "vitest";
import { MAP_BACKGROUND_LAYER_DEPTH, MAP_LOWER_LAYER_DEPTH } from "@/player/characterDepth";
import {
  BACKGROUND_FRAMES_PER_SECOND,
  advanceMapBackgroundScroll,
  mapBackgroundLayout,
  mapBackgroundTextureKey,
  syncMapBackgroundLayers,
  updateMapBackground,
} from "@/player/playSceneMapBackground";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

/**
 * 맵 배경(패럴랙스) 렌더 계약.
 *
 * 잠그는 것: (1) 하층 타일 **아래** depth, (2) 화면 고정 배치가 카메라 배율에서도 뷰포트를
 * 정확히 덮는가, (3) 스크롤 속도 단위가 프레임당 px 인가, (4) 그림이 아직 없을 때 로드를 한 번만
 * 걸고 완료되면 붙이는가, (5) 반복을 끈 축은 한 장만 그려지고 스크롤이 UV 가 아니라 위치를
 * 옮기는가, (6) 명령 「먼 배경 변경」 이 그 맵의 저작을 이기는가.
 */
const SOURCE = { width: 640, height: 480 };

type StubSprite = {
  texture: { key: string };
  width: number;
  height: number;
  visible: boolean;
  alpha: number;
  depth: number;
  scrollFactorX: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  tilePositionX: number;
  tilePositionY: number;
  setTexture(key: string): void;
  setSize(width: number, height: number): void;
  setPosition(x: number, y: number): void;
  setVisible(value: boolean): void;
  setOrigin(x: number, y: number): void;
  setScrollFactor(value: number): void;
  setDepth(value: number): void;
  setTilePosition(x: number, y: number): void;
  setAlpha(value: number): void;
};

function createSprite(key: string): StubSprite {
  return {
    texture: { key },
    width: 320,
    height: 240,
    visible: true,
    alpha: 1,
    depth: 0,
    scrollFactorX: 1,
    originX: 0.5,
    originY: 0.5,
    x: 0,
    y: 0,
    tilePositionX: 0,
    tilePositionY: 0,
    setTexture(next) {
      this.texture = { key: next };
    },
    setSize(width, height) {
      this.width = width;
      this.height = height;
    },
    setPosition(x, y) {
      this.x = x;
      this.y = y;
    },
    setVisible(value) {
      this.visible = value;
    },
    setOrigin(x, y) {
      this.originX = x;
      this.originY = y;
    },
    setScrollFactor(value) {
      this.scrollFactorX = value;
    },
    setDepth(value) {
      this.depth = value;
    },
    setTilePosition(x, y) {
      this.tilePositionX = x;
      this.tilePositionY = y;
    },
    setAlpha(value) {
      this.alpha = value;
    },
  };
}

function createScene(options: {
  background?: { imageId: string; scrollX?: number; scrollY?: number; loopX?: boolean; loopY?: boolean };
  /** 이벤트 명령 「먼 배경 변경」 이 세션에 남긴 기록. */
  override?: { mapId: string; value: string };
  loadedTextures?: readonly string[];
  zoom?: number;
  source?: { width: number; height: number };
} = {}) {
  const textures = new Set<string>(options.loadedTextures ?? []);
  const source = options.source ?? SOURCE;
  const queued: Array<{ key: string; url: string }> = [];
  const handlers = new Map<string, () => void>();
  const sprites: StubSprite[] = [];
  const camera = { width: 320, height: 240, zoom: options.zoom ?? 1 };
  /** 세션 스텁 — 명령이 살아 있는 중에 기록을 갈아끼울 수 있어야 한다. */
  const session: { m2Runtime?: unknown } = {};
  const setOverride = (override: { mapId: string; value: string } | null): void => {
    session.m2Runtime = override ? { map: { parallax_override: override } } : undefined;
  };
  setOverride(options.override ?? null);
  const scene = {
    map: { id: "m1", background: options.background },
    session,
    cameras: { main: camera },
    textures: {
      exists: (key: string) => textures.has(key),
      get: (key: string) => ({
        getSourceImage: () => {
          if (!textures.has(key)) throw new Error(`missing texture ${key}`);
          return { ...source };
        },
      }),
    },
    load: {
      image: (key: string, url: string) => {
        queued.push({ key, url });
      },
      once: (event: string, handler: () => void) => {
        handlers.set(event, handler);
      },
      off: (event: string) => {
        handlers.delete(event);
      },
      on: () => undefined,
      start: () => undefined,
      isLoading: () => false,
    },
    add: {
      tileSprite: (_x: number, _y: number, width: number, height: number, key: string) => {
        const sprite = createSprite(key);
        sprite.width = width;
        sprite.height = height;
        sprites.push(sprite);
        return sprite;
      },
    },
  };
  /** 파일 로더가 끝난 것처럼 만든다 — 모듈은 완료 이벤트로만 텍스처를 붙인다. */
  const finishLoad = (key: string): void => {
    textures.add(key);
    handlers.get(`filecomplete-image-${key}`)?.();
  };
  return {
    scene: scene as unknown as PlaySceneContext,
    queued,
    sprites,
    finishLoad,
    setOverride,
    sprite: () => sprites[0],
  };
}

/** 런타임 모듈은 전역 store 에서 프로젝트를 읽는다 — 읽기 전용 스냅숏으로 세워 준다. */
async function withProject(run: () => void | Promise<void>): Promise<void> {
  const release = store.beginReadOnlyProjectSnapshot(createBlankProject());
  try {
    await run();
  } finally {
    release();
  }
}

describe("맵 배경 렌더", () => {
  it("배경 레이어는 하층 타일보다 아래 depth 에 놓인다", () => {
    expect(MAP_BACKGROUND_LAYER_DEPTH).toBeLessThan(MAP_LOWER_LAYER_DEPTH);
  });

  it("화면 고정 배치는 어떤 배율에서도 뷰포트를 정확히 덮는다", () => {
    expect(mapBackgroundLayout({ width: 320, height: 240, zoom: 1 })).toEqual({ x: 0, y: 0, width: 320, height: 240 });
    // 배율 2: 뷰포트가 덮는 월드 영역은 절반이고, 좌상단을 화면 0 에 맞추려면 1/4 만큼 밀어야 한다.
    expect(mapBackgroundLayout({ width: 320, height: 240, zoom: 2 })).toEqual({ x: 80, y: 60, width: 160, height: 120 });
    expect(mapBackgroundLayout({ width: 320, height: 240, zoom: 0.5 })).toEqual({ x: -160, y: -120, width: 640, height: 480 });
    // 무효 배율은 1 로 본다 — 0 으로 나누면 배치가 NaN 이 되어 배경이 통째로 사라진다.
    expect(mapBackgroundLayout({ width: 320, height: 240, zoom: 0 })).toEqual({ x: 0, y: 0, width: 320, height: 240 });
  });

  it("반복을 끈 축은 그림 한 장까지만 그린다", () => {
    const camera = { width: 320, height: 240, zoom: 1 };
    // 그림이 화면보다 크면 어차피 화면이 다 덮인다.
    expect(mapBackgroundLayout(camera, { width: 640, height: 480 }, { x: false, y: false })).toMatchObject({
      width: 320,
      height: 240,
    });
    // 그림이 화면보다 작으면 그 폭까지만 — 남는 자리는 카메라 배경이 비친다.
    expect(mapBackgroundLayout(camera, { width: 120, height: 90 }, { x: false, y: false })).toMatchObject({
      width: 120,
      height: 90,
    });
    // 축별로 따로 판정한다.
    expect(mapBackgroundLayout(camera, { width: 120, height: 90 }, { x: false, y: true })).toMatchObject({
      width: 120,
      height: 240,
    });
  });

  it("스크롤 속도는 프레임당 px 다 — 1초에 60프레임만큼 움직인다", () => {
    expect(BACKGROUND_FRAMES_PER_SECOND).toBe(60);
    expect(advanceMapBackgroundScroll(0, 2, 1000)).toBe(120);
    expect(advanceMapBackgroundScroll(10, -1, 500)).toBe(10 - 30);
    expect(advanceMapBackgroundScroll(37, 0, 1000)).toBe(37);
    expect(advanceMapBackgroundScroll(37, 3, 0)).toBe(37);
  });

  it("텍스처 키는 리소스 id 를 그대로 쓰지 않고 안전 문자로 접는다", () => {
    const key = mapBackgroundTextureKey("easyrpg-backdrop-sky1");
    expect(key).toContain("easyrpg-backdrop-sky1");
    expect(mapBackgroundTextureKey("a/b:c")).toBe(mapBackgroundTextureKey("a_b_c"));
  });

  it("저작된 배경 그림을 로드해 하층 타일 아래 화면 고정 레이어로 붙인다", async () => {
    await withProject(async () => {
      const stub = createScene({ background: { imageId: "easyrpg-backdrop-sky1", scrollX: 2 } });
      syncMapBackgroundLayers(stub.scene);

      expect(stub.sprites).toHaveLength(0);
      expect(stub.queued).toHaveLength(1);
      expect(stub.queued[0]!.url).toContain("Sky1.png");

      // 같은 그림을 다시 실으라고 해도 로더에 두 번 넣지 않는다.
      syncMapBackgroundLayers(stub.scene);
      expect(stub.queued).toHaveLength(1);

      stub.finishLoad(stub.queued[0]!.key);
      // 로드 완료는 `Promise.all` 을 거쳐 돌아온다 — 붙는 시점은 마이크로태스크 두 번 뒤다.
      await Promise.resolve();
      await Promise.resolve();
      const sprite = stub.sprite();
      expect(sprite).toBeDefined();
      expect(sprite!.texture.key).toBe(mapBackgroundTextureKey("easyrpg-backdrop-sky1"));
      expect(sprite!.depth).toBe(MAP_BACKGROUND_LAYER_DEPTH);
      expect(sprite!.scrollFactorX).toBe(0);
      expect(sprite!.originX).toBe(0);
      expect(sprite!.originY).toBe(0);
      expect(sprite!.visible).toBe(true);
      expect(sprite!.width).toBe(320);
      expect(sprite!.height).toBe(240);
    });
  });

  it("이미 실린 그림은 다시 로드하지 않고 그 자리에서 붙인다", async () => {
    await withProject(() => {
      const stub = createScene({
        background: { imageId: "easyrpg-backdrop-sky1" },
        loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
      });
      syncMapBackgroundLayers(stub.scene);
      expect(stub.queued).toHaveLength(0);
      expect(stub.sprite()?.visible).toBe(true);
    });
  });

  it("배경 저작이 없으면 스프라이트를 만들지 않고, 있었다면 감춘다", async () => {
    await withProject(() => {
      const none = createScene();
      syncMapBackgroundLayers(none.scene);
      expect(none.sprites).toHaveLength(0);

      const stub = createScene({
        background: { imageId: "easyrpg-backdrop-sky1" },
        loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
      });
      syncMapBackgroundLayers(stub.scene);
      stub.scene.map = { id: "m1" } as unknown as PlaySceneContext["map"];
      syncMapBackgroundLayers(stub.scene);
      expect(stub.sprite()?.visible).toBe(false);
    });
  });

  it("풀리지 않는 그림 id 는 경고를 남기고 스프라이트를 만들지 않는다", async () => {
    await withProject(() => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      try {
        const stub = createScene({ background: { imageId: "no-such-backdrop" } });
        syncMapBackgroundLayers(stub.scene);
        expect(stub.sprites).toHaveLength(0);
        expect(warn.mock.calls.some((call) => String(call[0]).includes("no-such-backdrop"))).toBe(true);
      } finally {
        warn.mockRestore();
      }
    });
  });

  it("매 프레임 저작한 속도만큼 그림을 민다 — 감춰져 있으면 아무 일도 없다", async () => {
    await withProject(() => {
      const stub = createScene({
        background: { imageId: "easyrpg-backdrop-sky1", scrollX: 2, scrollY: -0.5 },
        loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
      });
      syncMapBackgroundLayers(stub.scene);
      updateMapBackground(stub.scene, 1000);
      const sprite = stub.sprite()!;
      expect(sprite.tilePositionX).toBe(120);
      expect(sprite.tilePositionY).toBe(-30);
      // 반복 축은 UV 로 흐르고 스프라이트는 화면에 고정된다.
      expect(sprite.x).toBe(0);

      sprite.visible = false;
      updateMapBackground(stub.scene, 1000);
      expect(sprite.tilePositionX).toBe(120);
    });
  });

  it("반복을 끈 축은 UV 대신 위치로 흐르고, 그림은 화면을 떠난다", async () => {
    await withProject(() => {
      const stub = createScene({
        background: { imageId: "easyrpg-backdrop-sky1", scrollX: 2, loopX: false },
        loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
      });
      syncMapBackgroundLayers(stub.scene);
      updateMapBackground(stub.scene, 1000);
      const sprite = stub.sprite()!;
      // 양수 속도 = 그림이 왼쪽으로. 반복 축이었다면 x 는 0 이고 UV 만 밀렸다.
      expect(sprite.x).toBe(-120);
      expect(sprite.y).toBe(0);
    });
  });

  it("이벤트 명령 「먼 배경 변경」 은 그 맵의 저작 배경을 이긴다", async () => {
    await withProject(() => {
      const stub = createScene({
        background: { imageId: "easyrpg-backdrop-dawn1" },
        override: { mapId: "m1", value: "easyrpg-backdrop-sky1" },
        loadedTextures: [
          mapBackgroundTextureKey("easyrpg-backdrop-dawn1"),
          mapBackgroundTextureKey("easyrpg-backdrop-sky1"),
        ],
      });
      syncMapBackgroundLayers(stub.scene);
      expect(stub.sprite()?.texture.key).toBe(mapBackgroundTextureKey("easyrpg-backdrop-sky1"));
    });
  });

  it("다른 맵에 기록된 「먼 배경 변경」 은 이 맵을 바꾸지 않는다", async () => {
    await withProject(() => {
      const stub = createScene({
        background: { imageId: "easyrpg-backdrop-dawn1" },
        override: { mapId: "map_other", value: "easyrpg-backdrop-sky1" },
        loadedTextures: [
          mapBackgroundTextureKey("easyrpg-backdrop-dawn1"),
          mapBackgroundTextureKey("easyrpg-backdrop-sky1"),
        ],
      });
      syncMapBackgroundLayers(stub.scene);
      expect(stub.sprite()?.texture.key).toBe(mapBackgroundTextureKey("easyrpg-backdrop-dawn1"));
    });
  });

  it("맵을 안 적은 예전 세이브의 기록은 모든 맵에 적용한다", async () => {
    await withProject(() => {
      const stub = createScene({
        override: { mapId: "", value: "easyrpg-backdrop-sky1" },
        loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
      });
      syncMapBackgroundLayers(stub.scene);
      expect(stub.sprite()?.visible).toBe(true);
      expect(stub.sprite()?.texture.key).toBe(mapBackgroundTextureKey("easyrpg-backdrop-sky1"));
    });
  });

  it("맵을 다시 싣지 않고 명령이 들어와도 다음 프레임에 배경이 바뀐다", async () => {
    await withProject(() => {
      const stub = createScene({
        background: { imageId: "easyrpg-backdrop-dawn1" },
        loadedTextures: [
          mapBackgroundTextureKey("easyrpg-backdrop-dawn1"),
          mapBackgroundTextureKey("easyrpg-backdrop-sky1"),
        ],
      });
      syncMapBackgroundLayers(stub.scene);
      expect(stub.sprite()?.texture.key).toBe(mapBackgroundTextureKey("easyrpg-backdrop-dawn1"));

      // 명령이 세션에 기록된 직후의 프레임 — loadMap 은 부르지 않는다.
      stub.setOverride({ mapId: "m1", value: "easyrpg-backdrop-sky1" });
      updateMapBackground(stub.scene, 16);
      expect(stub.sprites).toHaveLength(1);
      expect(stub.sprite()?.texture.key).toBe(mapBackgroundTextureKey("easyrpg-backdrop-sky1"));
    });
  });
});
