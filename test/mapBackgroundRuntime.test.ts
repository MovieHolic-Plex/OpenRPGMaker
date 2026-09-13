import { describe, expect, it, vi } from "vitest";
import { MAP_BACKGROUND_LAYER_DEPTH, MAP_LOWER_LAYER_DEPTH } from "@/player/characterDepth";
import {
  BACKGROUND_FRAMES_PER_SECOND,
  advanceMapBackgroundScroll,
  mapBackgroundLayout,
  mapBackgroundTextureKey,
  syncMapBackgroundLayer,
  updateMapBackground,
} from "@/player/playSceneMapBackground";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

/**
 * 맵 배경(패럴랙스) 렌더 계약.
 *
 * 여기서 잠그는 것은 넷이다: (1) 하층 타일 **아래** depth, (2) 화면 고정 배치가 카메라
 * 배율에서도 뷰포트를 정확히 덮는가, (3) 스크롤 속도 단위가 프레임당 px 인가,
 * (4) 그림이 아직 없을 때 로드를 한 번만 걸고 완료되면 붙이는가.
 */
type StubLayer = {
  width: number;
  height: number;
  visible: boolean;
  depth: number;
  scrollFactorX: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  tilePositionX: number;
  tilePositionY: number;
  textureKey: string;
  setTexture(key: string): void;
  setSize(width: number, height: number): void;
  setPosition(x: number, y: number): void;
  setVisible(value: boolean): void;
  setOrigin(x: number, y: number): void;
  setScrollFactor(value: number): void;
  setDepth(value: number): void;
  setTilePosition(x: number, y: number): void;
};

function createLayer(key: string, x: number, y: number, width: number, height: number): StubLayer {
  return {
    width,
    height,
    visible: true,
    depth: 0,
    scrollFactorX: 1,
    originX: 0.5,
    originY: 0.5,
    x,
    y,
    tilePositionX: 0,
    tilePositionY: 0,
    textureKey: key,
    setTexture(next) {
      this.textureKey = next;
    },
    setSize(nextWidth, nextHeight) {
      this.width = nextWidth;
      this.height = nextHeight;
    },
    setPosition(nextX, nextY) {
      this.x = nextX;
      this.y = nextY;
    },
    setVisible(value) {
      this.visible = value;
    },
    setOrigin(originX, originY) {
      this.originX = originX;
      this.originY = originY;
    },
    setScrollFactor(value) {
      this.scrollFactorX = value;
    },
    setDepth(value) {
      this.depth = value;
    },
    setTilePosition(nextX, nextY) {
      this.tilePositionX = nextX;
      this.tilePositionY = nextY;
    },
  };
}

function createScene(options: {
  background?: { imageId: string; scrollX?: number; scrollY?: number };
  /** 이벤트 명령 「먼 배경 변경」 이 세션에 남긴 기록. */
  override?: { mapId: string; value: string };
  loadedTextures?: readonly string[];
  zoom?: number;
} = {}) {
  const textures = new Set<string>(options.loadedTextures ?? []);
  const queued: Array<{ key: string; url: string }> = [];
  const handlers = new Map<string, () => void>();
  const layers: StubLayer[] = [];
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
    textures: { exists: (key: string) => textures.has(key) },
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
      tileSprite: (x: number, y: number, width: number, height: number, key: string) => {
        const layer = createLayer(key, x, y, width, height);
        layers.push(layer);
        return layer;
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
    camera,
    queued,
    layers,
    finishLoad,
    setOverride,
    layer: () => layers[0],
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
    expect(mapBackgroundLayout({ width: 320, height: 240, zoom: 1 })).toEqual({
      x: 0,
      y: 0,
      width: 320,
      height: 240,
    });
    // 배율 2: 뷰포트가 덮는 월드 영역은 절반이고, 좌상단을 화면 0 에 맞추려면 1/4 만큼 밀어야 한다.
    expect(mapBackgroundLayout({ width: 320, height: 240, zoom: 2 })).toEqual({
      x: 80,
      y: 60,
      width: 160,
      height: 120,
    });
    expect(mapBackgroundLayout({ width: 320, height: 240, zoom: 0.5 })).toEqual({
      x: -160,
      y: -120,
      width: 640,
      height: 480,
    });
    // 무효 배율은 1 로 본다 — 0 으로 나누면 배치가 NaN 이 되어 배경이 통째로 사라진다.
    expect(mapBackgroundLayout({ width: 320, height: 240, zoom: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 320,
      height: 240,
    });
  });

  it("스크롤 속도는 프레임당 px 다 — 1초에 60프레임만큼 움직인다", () => {
    expect(BACKGROUND_FRAMES_PER_SECOND).toBe(60);
    expect(advanceMapBackgroundScroll(0, 2, 1000)).toBe(120);
    expect(advanceMapBackgroundScroll(10, -1, 500)).toBe(10 - 30);
    // 0 속도·0 시간은 위상을 건드리지 않는다.
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
      syncMapBackgroundLayer(stub.scene);

      expect(stub.layers).toHaveLength(0);
      expect(stub.queued).toHaveLength(1);
      expect(stub.queued[0]!.url).toContain("Sky1.png");

      // 같은 그림을 다시 실으라고 해도 로더에 두 번 넣지 않는다.
      syncMapBackgroundLayer(stub.scene);
      expect(stub.queued).toHaveLength(1);

      stub.finishLoad(stub.queued[0]!.key);
      // 로드 완료는 약속으로 돌아온다 — 붙는 시점은 마이크로태스크 한 뒤다.
      await Promise.resolve();
      const layer = stub.layer();
      expect(layer).toBeDefined();
      expect(layer!.textureKey).toBe(mapBackgroundTextureKey("easyrpg-backdrop-sky1"));
      expect(layer!.depth).toBe(MAP_BACKGROUND_LAYER_DEPTH);
      expect(layer!.scrollFactorX).toBe(0);
      expect(layer!.originX).toBe(0);
      expect(layer!.originY).toBe(0);
      expect(layer!.visible).toBe(true);
      expect(layer!.width).toBe(320);
      expect(layer!.height).toBe(240);
    });
  });

  it("이미 실린 그림은 다시 로드하지 않고 그 자리에서 붙인다", async () => {
    await withProject(() => {
      const stub = createScene({
        background: { imageId: "easyrpg-backdrop-sky1" },
        loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
      });
      syncMapBackgroundLayer(stub.scene);
      expect(stub.queued).toHaveLength(0);
      expect(stub.layer()?.visible).toBe(true);
    });
  });

  it("배경 저작이 없으면 레이어를 만들지 않고, 있었다면 감춘다", async () => {
    await withProject(() => {
      const none = createScene();
      syncMapBackgroundLayer(none.scene);
      expect(none.layers).toHaveLength(0);

      const stub = createScene({
        background: { imageId: "easyrpg-backdrop-sky1" },
        loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
      });
      syncMapBackgroundLayer(stub.scene);
      stub.scene.map = { id: "m1" } as unknown as PlaySceneContext["map"];
      syncMapBackgroundLayer(stub.scene);
      expect(stub.layer()?.visible).toBe(false);
    });
  });

  it("풀리지 않는 그림 id 는 경고를 남기고 레이어를 만들지 않는다", async () => {
    await withProject(() => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      try {
        const stub = createScene({ background: { imageId: "no-such-backdrop" } });
        syncMapBackgroundLayer(stub.scene);
        expect(stub.layers).toHaveLength(0);
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
      syncMapBackgroundLayer(stub.scene);
      updateMapBackground(stub.scene, 1000);
      const layer = stub.layer()!;
      expect(layer.tilePositionX).toBe(120);
      expect(layer.tilePositionY).toBe(-30);

      layer.visible = false;
      updateMapBackground(stub.scene, 1000);
      expect(layer.tilePositionX).toBe(120);
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
      syncMapBackgroundLayer(stub.scene);
      expect(stub.layer()?.textureKey).toBe(mapBackgroundTextureKey("easyrpg-backdrop-sky1"));
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
      syncMapBackgroundLayer(stub.scene);
      expect(stub.layer()?.textureKey).toBe(mapBackgroundTextureKey("easyrpg-backdrop-dawn1"));
    });
  });

  it("맵을 안 적은 예전 세이브의 기록은 모든 맵에 적용한다", async () => {
    await withProject(() => {
      const stub = createScene({
        override: { mapId: "", value: "easyrpg-backdrop-sky1" },
        loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
      });
      syncMapBackgroundLayer(stub.scene);
      expect(stub.layer()?.visible).toBe(true);
      expect(stub.layer()?.textureKey).toBe(mapBackgroundTextureKey("easyrpg-backdrop-sky1"));
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
      syncMapBackgroundLayer(stub.scene);
      expect(stub.layer()?.textureKey).toBe(mapBackgroundTextureKey("easyrpg-backdrop-dawn1"));

      // 명령이 세션에 기록된 직후의 프레임 — loadMap 은 부르지 않는다.
      stub.setOverride({ mapId: "m1", value: "easyrpg-backdrop-sky1" });
      updateMapBackground(stub.scene, 16);
      expect(stub.layers).toHaveLength(1);
      expect(stub.layer()?.textureKey).toBe(mapBackgroundTextureKey("easyrpg-backdrop-sky1"));
    });
  });
});
