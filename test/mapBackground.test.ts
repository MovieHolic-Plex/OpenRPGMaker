import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { compileCutscene } from "@/editor/cutscene";
import { runTool, type ToolContext } from "@/editor/tools";
import { findOprnPanoramaSet } from "@/assets/oprnPanoramas";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { mapBackgroundFromLayerSet } from "@/project/mapBackground";
import type { Command } from "@/project/types";
import { parseTintColor } from "@/player/screen/tintModel";
import { MAP_BACKGROUND_PREVIEW_STORAGE_KEY, mapBackgroundPreviewEnabled, resetMapBackgroundPreviewForTests, setMapBackgroundPreview, subscribeMapBackgroundPreview, toggleMapBackgroundPreview } from "@/editor/mapBackgroundPreviewState";
import { installFakeDom } from "./fakeDom";
import { COMBINED_TOWN_PANORAMA_WINDOW_TILES } from "@/project/defaults/generatedChipsetTransparency";
import { isPanoramaWindowTile } from "@/project/defaults/chipsetMapping";
import { CAMERA_ZOOM_LIMITS, normalizeCameraZoom, resolveCameraZoom, storeCameraZoom } from "@/project/cameraZoom";
import { MAP_BACKGROUND_LAYER_DEPTH, MAP_LOWER_LAYER_DEPTH } from "@/player/characterDepth";
import { BACKGROUND_FRAMES_PER_SECOND, advanceMapBackgroundScroll, mapBackgroundLayerOffset, mapBackgroundLayout, mapBackgroundTextureKey, syncMapBackgroundLayers, updateMapBackground, resolveMapBackgroundLayers } from "@/player/playSceneMapBackground";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import type { PlaySession } from "@/project/session";
import { isolateTimers } from "./mergedTeardown";

// 조수가 맵 배경(파노라마)과 회상 흐름 연출을 한 번에 쓸 수 있는가 — 2026-09-27.
//
// 이전에는 도구 칸이 있어도 조수가 제대로 쓸 수 없었다: fit 칸이 스키마에 없어 1920×1080 세트가 구석만
// 확대됐고, 세트를 층별로 손으로 조립해야 했고, 창 타일 규칙을 몰라 배경이 검게 가려진 채 「성공」 했고,
// 컷신에는 배경 비트가 없어 날것의 명령 id(m2-069)를 알아야 했다.
describe("mapBackgroundAssistantTools", () => {
  isolateTimers();
  function context(): { ctx: ToolContext; mapId: string } {
    const ctx: ToolContext = { project: createBlankProject() };
    return { ctx, mapId: ctx.project.startMapId };
  }
  describe("set_map_properties.background — 조수용 배경", () => {
    // CraftPix sets (oga-craftpix-*) left with the 2026-10-07 copyright purge; the OPRN panoramas (oprnPanoramas.ts) replace them.
    it("layerSet 한 칸이 층 순서·cover·층별 깊이·구름 흐름을 채운다", () => {
      const { ctx, mapId } = context();
      const result = runTool(ctx, "set_map_properties", {
        mapId,
        background: { layerSet: "oprn-sky-day", showInEmptyCells: true },
        clearForBackground: { x: 0, y: 0, width: 5, height: 3 },
      });
      expect(result.ok, result.summary).toBe(true);
      const background = ctx.project.maps[mapId]!.background!;
      const ids = findOprnPanoramaSet("oprn-sky-day")!.layers.map((layer) => layer.id);
      expect([background.imageId, ...(background.layers ?? []).map((layer) => layer.imageId)]).toEqual(ids);
      expect(background.fit).toBe("cover");
      expect(background.layers?.every((layer) => layer.fit === "cover")).toBe(true);
      expect(background.cameraFollow).toBeUndefined();
      const follows = (background.layers ?? []).map((layer) => layer.cameraFollow ?? 0);
      expect(follows.at(-1)).toBe(0.25);
      expect([...follows].sort((a, b) => a - b)).toEqual(follows);
      // 구름 층만 흐른다.
      for (const layer of background.layers ?? []) {
        expect((layer.scrollX ?? 0) > 0).toBe(/clouds/.test(layer.imageId));
      }
      expect(background.showInEmptyCells).toBe(true);
      expect(result.summary).toContain("하늘 자리 15칸 비움");
      expect(result.summary).toContain("층별 깊이 0/10/25%");
      expect((result.diff?.warnings ?? []).join(" ")).not.toContain("0칸");
    });

    it("배경이 보일 칸이 없으면 성공 대신 경고로 알려 준다", () => {
      const { ctx, mapId } = context();
      const map = ctx.project.maps[mapId]!;
      map.lowerTiles.fill(240);
      const result = runTool(ctx, "set_map_properties", { mapId, background: { layerSet: "oprn-sunset", showInEmptyCells: false } });
      expect(result.ok, result.summary).toBe(true);
      expect((result.diff?.warnings ?? []).join(" ")).toContain("showInEmptyCells");
    });

    it("fit 을 받는다 — 예전 스키마는 additionalProperties:false 로 거절했다", () => {
      const { ctx, mapId } = context();
      const result = runTool(ctx, "set_map_properties", {
        mapId,
        background: { imageId: "oprn-pano-sky-day", fit: "cover" },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps[mapId]!.background?.fit).toBe("cover");
    });

    it("없는 세트는 id 목록과 함께 거절한다", () => {
      const { ctx, mapId } = context();
      const result = runTool(ctx, "set_map_properties", { mapId, background: { layerSet: "no-such-set" } });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("oprn-sky-day");
    });

    it("세트 펴기 규칙은 편집기와 도구가 같은 함수를 쓴다", () => {
      const expanded = mapBackgroundFromLayerSet(["a-sky", "a-clouds", "a-rocks"], { cloudDrift: 0.4 });
      expect(expanded).toEqual({
        imageId: "a-sky",
        fit: "cover",
        layers: [
          { imageId: "a-clouds", fit: "cover", cameraFollow: 0.35, scrollX: 0.4 },
          { imageId: "a-rocks", fit: "cover", cameraFollow: 0.7 },
        ],
      });
      expect(mapBackgroundFromLayerSet([])).toBeUndefined();
    });
  });
  describe("script_cutscene background 비트", () => {
    const parallax = (commands: readonly Command[]) =>
      commands.filter((command): command is Extract<Command, { kind: "m2Command" }> =>
        command.kind === "m2Command" && command.commandId === "m2-069-change-parallax-back");

    it("흐름 배율 명령으로 컴파일되고, 끝(건너뛰기 착지 뒤)에서 같은 상태를 즉시 다시 건다", () => {
      const commands = compileCutscene([
        { kind: "tint", value: "160,120,70,0.28", durationMs: 1000 },
        { kind: "background", flowPercent: 0, durationMs: 2500, wait: true },
        { kind: "say", speaker: "나", text: "그날도 구름이 멈춰 있었다." },
      ]);
      const [transition, settle] = parallax(commands);
      expect(transition?.fields).toEqual({ resourceId: "", flowPercent: 0, flowDurationMs: 2500 });
      expect(settle?.fields).toEqual({ resourceId: "", flowPercent: 0, flowDurationMs: 0 });
      // wait:true 는 전환이 끝날 때까지 기다린다.
      const index = commands.indexOf(transition!);
      expect(commands[index + 1]).toEqual({ kind: "wait", ms: 2500 });
    });

    it("범위 밖 흐름 배율은 컴파일 전에 거절한다", () => {
      expect(() => compileCutscene([{ kind: "background", flowPercent: 900 }])).toThrow(/flowPercent/);
    });

    it("script_cutscene 도구로 이벤트에 들어간다", () => {
      const { ctx, mapId } = context();
      const result = runTool(ctx, "script_cutscene", {
        mapId,
        eventId: "ev_flashback",
        x: 1,
        y: 1,
        trigger: "auto",
        once: true,
        beats: [
          { kind: "background", flowPercent: 0, durationMs: 2000 },
          { kind: "say", speaker: "나", text: "기억이 흐려진다." },
        ],
      });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_flashback")!;
      const commands = event.pages?.flatMap((page) => page.commands) ?? [];
      expect(parallax(commands).length).toBeGreaterThanOrEqual(1);
    });
  });
  describe("회상 색조 이름", () => {
    it("sepia 는 흰색으로 떨어지지 않는다 — 조수 시험에서 value:\"sepia\" 가 화면을 하얗게 바랬다", () => {
      const tint = parseTintColor("sepia");
      expect([tint.r, tint.g, tint.b]).toEqual([160, 115, 60]);
    });
  });
});

describe("mapBackgroundPreviewState", () => {
  isolateTimers();
  /**
   * 맵 배경 미리보기 토글 상태.
   *
   * 기본값이 «꺼짐» 인 것이 계약이다 — 빈 칸 체커가 "바닥 없음" 신호를 계속 말해야 한다
   * (2026-08-27 결정). 캔버스는 이 모듈을 구독해 다시 그리므로, 구독이 안 불리면 토글이
   * 아무 일도 안 한 것처럼 보인다.
   */
  describe("맵 배경 미리보기 상태", () => {
    let restoreDom: () => void;

    let store: Map<string, string>;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      });
      resetMapBackgroundPreviewForTests();
    });

    afterEach(() => {
      resetMapBackgroundPreviewForTests();
      vi.unstubAllGlobals();
      restoreDom();
    });

    it("기본값은 꺼짐이다", () => {
      expect(mapBackgroundPreviewEnabled()).toBe(false);
      expect(globalThis.localStorage.getItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY)).toBeNull();
    });

    it("토글은 구독자에게 알리고 저장한다", () => {
      const seen: boolean[] = [];
      const off = subscribeMapBackgroundPreview((enabled) => seen.push(enabled));
      try {
        toggleMapBackgroundPreview();
        expect(mapBackgroundPreviewEnabled()).toBe(true);
        expect(seen).toEqual([true]);
        expect(globalThis.localStorage.getItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY)).toBe("1");

        toggleMapBackgroundPreview();
        expect(mapBackgroundPreviewEnabled()).toBe(false);
        expect(seen).toEqual([true, false]);
        expect(globalThis.localStorage.getItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY)).toBeNull();
      } finally {
        off();
      }
    });

    it("같은 값으로 다시 설정하면 알리지 않는다", () => {
      const listener = vi.fn();
      const off = subscribeMapBackgroundPreview(listener);
      try {
        setMapBackgroundPreview(false);
        expect(listener).not.toHaveBeenCalled();
        setMapBackgroundPreview(true);
        setMapBackgroundPreview(true);
        expect(listener).toHaveBeenCalledTimes(1);
      } finally {
        off();
      }
    });

    it("구독을 해제하면 더는 알리지 않는다", () => {
      const listener = vi.fn();
      subscribeMapBackgroundPreview(listener)();
      setMapBackgroundPreview(true);
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe("mapBackgroundRuntime", () => {
  isolateTimers();
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
    tileScaleX: number;
    tileScaleY: number;
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
      tileScaleX: 1,
      tileScaleY: 1,
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
      setTileScale(x, y) {
        this.tileScaleX = x;
        this.tileScaleY = y === undefined ? x : y;
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
    background?: {
      imageId: string;
      scrollX?: number;
      scrollY?: number;
      loopX?: boolean;
      loopY?: boolean;
      cameraFollow?: number;
      layers?: Array<{ imageId: string; scrollX?: number; cameraFollow?: number }>;
    };
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
    const camera: { width: number; height: number; zoom: number; scrollX?: number; scrollY?: number } = {
      width: 320,
      height: 240,
      zoom: options.zoom ?? 1,
    };
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
      // EasyRPG backdrops were purged on 2026-10-07 (retiredAssets.ts); load a shipped OPRN panorama instead.
      await withProject(async () => {
        const stub = createScene({ background: { imageId: "oprn-pano-sky-day", scrollX: 2 } });
        syncMapBackgroundLayers(stub.scene);

        expect(stub.sprites).toHaveLength(0);
        expect(stub.queued).toHaveLength(1);
        expect(stub.queued[0]!.url).toContain("oprn-pano-sky-day.png");

        // 같은 그림을 다시 실으라고 해도 로더에 두 번 넣지 않는다.
        syncMapBackgroundLayers(stub.scene);
        expect(stub.queued).toHaveLength(1);

        stub.finishLoad(stub.queued[0]!.key);
        // 로드 완료는 `Promise.all` 을 거쳐 돌아온다 — 붙는 시점은 마이크로태스크 두 번 뒤다.
        await Promise.resolve();
        await Promise.resolve();
        const sprite = stub.sprite();
        expect(sprite).toBeDefined();
        expect(sprite!.texture.key).toBe(mapBackgroundTextureKey("oprn-pano-sky-day"));
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

    it("같은 배경 객체의 속도를 그 자리에서 고쳐도 다음 프레임이 그 속도를 쓴다", async () => {
      await withProject(() => {
        const background = { imageId: "easyrpg-backdrop-sky1", scrollX: 1 };
        const stub = createScene({
          background,
          loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
        });
        syncMapBackgroundLayers(stub.scene);
        updateMapBackground(stub.scene, 1000);
        expect(stub.sprite()!.tilePositionX).toBe(60);
        background.scrollX = 2;
        updateMapBackground(stub.scene, 1000);
        expect(stub.sprite()!.tilePositionX).toBe(180);
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
  /**
   * 층마다 다른 깊이(카메라 따라가기)와 이벤트 명령의 흐름 배율 — 회상 파노라마 연출(2026-09-27).
   *
   * 잠그는 것: 깊이 0 은 예전처럼 카메라를 보지 않는다, 깊이가 다른 두 층은 같은 카메라 이동에
   * 다른 거리를 간다, 흐름 배율 명령은 전환 시간 동안 서서히 바뀐다, 다른 맵의 명령은 무시한다.
   */
  describe("맵 배경 시차(깊이)와 흐름 배율", () => {
    it("깊이 0 은 카메라를 무시하고, 깊이 값만큼 카메라 스크롤을 따라간다", () => {
      expect(mapBackgroundLayerOffset(10, 500, 0)).toBe(10);
      expect(mapBackgroundLayerOffset(10, 500, 0.5)).toBe(260);
      expect(mapBackgroundLayerOffset(10, 500, 1)).toBe(510);
      expect(mapBackgroundLayerOffset(10, Number.NaN, 1)).toBe(10);
    });

    it("같은 카메라 이동에 먼 층은 조금, 가까운 층은 많이 움직인다", async () => {
      await withProject(() => {
        const stub = createScene({
          background: {
            imageId: "easyrpg-backdrop-sky1",
            layers: [
              { imageId: "easyrpg-backdrop-dawn1", cameraFollow: 0.2 },
              { imageId: "easyrpg-backdrop-sky1", cameraFollow: 0.8 },
            ],
          },
          loadedTextures: [
            mapBackgroundTextureKey("easyrpg-backdrop-sky1"),
            mapBackgroundTextureKey("easyrpg-backdrop-dawn1"),
          ],
        });
        // 맵에 들어온 순간의 카메라가 기준점이다 — 절대 좌표가 아니라 거기서 움직인 만큼만 민다.
        const camera = stub.scene.cameras.main as unknown as { scrollX: number; scrollY: number };
        camera.scrollX = 400;
        camera.scrollY = 240;
        syncMapBackgroundLayers(stub.scene);
        expect(stub.sprites.map((sprite) => sprite.tilePositionX)).toEqual([0, 0, 0]);
        camera.scrollX = 500;
        updateMapBackground(stub.scene, 16);
        expect(stub.sprites.map((sprite) => sprite.tilePositionX)).toEqual([0, 20, 80]);
        expect(stub.sprites.map((sprite) => sprite.tilePositionY)).toEqual([0, 0, 0]);
      });
    });

    it("흐름 배율 명령은 전환 시간 동안 저작 속도에서 목표까지 서서히 바뀐다", async () => {
      await withProject(() => {
        const stub = createScene({
          background: { imageId: "easyrpg-backdrop-sky1", scrollX: 1 },
          loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
        });
        syncMapBackgroundLayers(stub.scene);
        updateMapBackground(stub.scene, 1000);
        expect(stub.sprite()!.tilePositionX).toBe(60);

        const session = stub.scene.session as unknown as { m2Runtime?: unknown };
        session.m2Runtime = { map: { parallax_flow: { mapId: "m1", x: 0, y: 0, value: "0|2000" } } };
        updateMapBackground(stub.scene, 0);
        updateMapBackground(stub.scene, 1000);
        // 1초 지난 시점의 배율은 0.5 — 이 1초 동안 60 × 0.5 = 30px.
        expect(stub.sprite()!.tilePositionX).toBeCloseTo(90);
        updateMapBackground(stub.scene, 1000);
        updateMapBackground(stub.scene, 1000);
        // 전환이 끝나면 멈춘다.
        expect(stub.sprite()!.tilePositionX).toBeCloseTo(90);
        expect(stub.scene.mapBackgroundFlow?.current).toBe(0);
      });
    });

    it("다른 맵에 적힌 흐름 배율 명령은 이 맵의 속도를 바꾸지 않는다", async () => {
      await withProject(() => {
        const stub = createScene({
          background: { imageId: "easyrpg-backdrop-sky1", scrollX: 1 },
          loadedTextures: [mapBackgroundTextureKey("easyrpg-backdrop-sky1")],
        });
        const session = stub.scene.session as unknown as { m2Runtime?: unknown };
        session.m2Runtime = { map: { parallax_flow: { mapId: "map_other", x: 0, y: 0, value: "0|0" } } };
        syncMapBackgroundLayers(stub.scene);
        updateMapBackground(stub.scene, 1000);
        expect(stub.sprite()!.tilePositionX).toBe(60);
      });
    });
  });
  /**
   * 프로젝트 기본 카메라 배율(2026-09-22).
   *
   * 왜 필요한가: 줌은 원래 연출 상태(session.camera.zoom, 이벤트 명령 m2-201)로만
   * 존재했다. 그래서 고해상도 배경을 1:1 로 쓰려면 맵마다 auto 이벤트를 심어
   * 줌을 걸어야 했고 새 맵에서는 1 로 돌아갔다. 기본값은 프로젝트가 정하고
   * 연출은 그 위에 일시적으로 덮어쓰는 구조가 맞다.
   */
  describe("프로젝트 기본 카메라 배율", () => {
    it("1(클래식)은 생략해 저장하지 않는다 — 였 JSON 바이트가 유지된다", () => {
      expect(normalizeCameraZoom(1)).toBeUndefined();
      expect(normalizeCameraZoom(undefined)).toBeUndefined();
      expect(normalizeCameraZoom("4")).toBeUndefined();
      expect(normalizeCameraZoom(Number.NaN)).toBeUndefined();
    });

    it("범위를 넘으면 클램프하고 상한은 런타임과 같다", () => {
      expect(normalizeCameraZoom(999)).toBe(CAMERA_ZOOM_LIMITS.max);
      expect(normalizeCameraZoom(0.01)).toBe(CAMERA_ZOOM_LIMITS.min);
      expect(normalizeCameraZoom(4.5)).toBe(4.5);
    });

    it("저작이 없으면 1 이 효욨 배율이다", () => {
      expect(resolveCameraZoom(undefined)).toBe(1);
      expect(resolveCameraZoom({})).toBe(1);
      expect(resolveCameraZoom({ cameraZoom: 4.5 })).toBe(4.5);
    });

    it("store 함수는 1 을 쓰면 필드를 지운다", () => {
      const system: { cameraZoom?: number } = {};
      storeCameraZoom(system as never, 4.5);
      expect(system.cameraZoom).toBe(4.5);
      storeCameraZoom(system as never, 1);
      expect("cameraZoom" in system).toBe(false);
    });
  });
  /**
   * RM2K 파노라마 창 계약(2026-09-22).
   *
   * 왜: 이전에는 하층 타일이 없는 칸이 전부 뚫린 창이 되어 배경이 다 보였다. RM2K 방식은
   * 반대다 — 배경은 레이어 뒤에 있고, 완전 투명 타일(파노라마 창)을 깐 칸에서만 비친다.
   * 빈 칸은 가려진다(playSceneMapRuntime 의 renderEmptyCellCover).
   */
  describe("RM2K 파노라마 창", () => {
    it("창 타일은 완전 투명이며 소수다", () => {
      expect(COMBINED_TOWN_PANORAMA_WINDOW_TILES.length).toBeGreaterThan(0);
      expect(COMBINED_TOWN_PANORAMA_WINDOW_TILES.length).toBeLessThan(20);
    });

    it("창 타일은 지형(잔디·밑동)과 겹치지 않는다 — 실수로 지형을 창으로 만들지 않았다", () => {
      const windows = new Set(COMBINED_TOWN_PANORAMA_WINDOW_TILES);
      for (const ground of [240, 241, 290, 291, 292, 293, 0, 16]) {
        expect(windows.has(ground), '지형 ' + String(ground) + ' 이 창 목록에 있다').toBe(false);
      }
    });

    it("isPanoramaWindowTile 이 목록과 일치한다", () => {
      for (const tile of COMBINED_TOWN_PANORAMA_WINDOW_TILES) {
        expect(isPanoramaWindowTile(tile)).toBe(true);
      }
      expect(isPanoramaWindowTile(240)).toBe(false);
      expect(isPanoramaWindowTile(-1)).toBe(false);
    });
  });
});

describe("mapBackgroundSaveRestore", () => {
  isolateTimers();
  function mkSession(project = createBlankProject()): PlaySession {
    return {
      switches: {},
      selfSwitches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      monsterInstances: {},
      monsterParty: [],
      monsterBox: [],
      classOverrides: {},
      actorSkillIds: {},
      actorExperience: {},
      actorLevels: {},
      actorVitals: {},
      eventLocations: {},
      erasedEventIds: [],
      npcTravelStates: {},
      followers: [],
      followerTrail: [],
      actorEquipment: {},
      actorRows: {},
      currentMapId: project.startMapId,
      x: project.startPos.x,
      y: project.startPos.y,
      lighting: { ambient: 0, sources: [] },
      mapOverrides: {},
      flags: {},
      audio: {},
      pictures: {},
      playTimeSeconds: 0,
    };
  }
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length(): number {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }
    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
  }
  function firstLayer(session: PlaySession, mapId: string, authoredImageId: string): string | undefined {
    const layers = resolveMapBackgroundLayers({
      map: { id: mapId, background: { imageId: authoredImageId } } as PlaySceneContext["map"],
      session,
    });
    return layers[0]?.imageId;
  }
  describe("세이브/로드 — 먼 배경 변경", () => {
    it("그 맵의 그림과 멈춘 흐름이 저장을 지나 다시 그려진다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      const map = ensureM2Runtime(session).map;
      map.parallax_override = { mapId: project.startMapId, x: 0, y: 0, value: "sky-dusk" };
      map.parallax_flow = { mapId: project.startMapId, x: 0, y: 0, value: "0|1500" };
      map.encounter_rate = { mapId: "", x: 0, y: 0, value: "12" };
      map.tileset_override = { mapId: "", x: 0, y: 0, value: "other-town" };

      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
      const raw = storage.getItem(saveSlotKey(1)) ?? "";
      expect(raw).toContain("sky-dusk");
      expect(raw).toContain("0|1500");
      expect(raw).not.toContain("encounter_rate");
      expect(raw).not.toContain("tileset_override");

      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;
      expect(read.snapshot.session.mapBackground).toEqual({
        override: { mapId: project.startMapId, value: "sky-dusk" },
        flow: { mapId: project.startMapId, value: "0|1500" },
      });
      const restored = applySaveSnapshot(project, read.snapshot);
      expect(restored.m2Runtime?.map.parallax_override).toEqual({ mapId: project.startMapId, x: 0, y: 0, value: "sky-dusk" });
      expect(restored.m2Runtime?.map.parallax_flow).toEqual({ mapId: project.startMapId, x: 0, y: 0, value: "0|1500" });
      expect(restored.m2Runtime?.map.encounter_rate).toBeUndefined();
      expect(firstLayer(restored, project.startMapId, "authored-sky")).toBe("sky-dusk");
      expect(firstLayer(restored, "other-map", "authored-sky")).toBe("authored-sky");
    });

    it("저작 속도와 빈 그림은 적지 않아 불러오면 맵 배경 그대로다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      const map = ensureM2Runtime(session).map;
      map.parallax_override = { mapId: project.startMapId, x: 0, y: 0, value: "  " };
      map.parallax_flow = { mapId: project.startMapId, x: 0, y: 0, value: "100|800" };

      const snapshot = createSaveSnapshot(project, session);
      expect(snapshot.session.mapBackground).toBeUndefined();
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.m2Runtime?.map.parallax_override).toBeUndefined();
      expect(restored.m2Runtime?.map.parallax_flow).toBeUndefined();
      expect(firstLayer(restored, project.startMapId, "authored-sky")).toBe("authored-sky");
    });

    it("필드가 없는 옛 세이브와 깨진 배경 기록은 슬롯을 손상으로 보지 않는다", () => {
      const project = createBlankProject();
      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, mkSession(project)))).toEqual({ ok: true });
      const key = saveSlotKey(1);
      const legacy = JSON.parse(storage.getItem(key) ?? "{}") as { session: Record<string, unknown> };
      delete legacy.session.mapBackground;
      legacy.session.mapBackground = {
        override: { mapId: "", value: "  legacy-sky  " },
        flow: { mapId: project.startMapId, value: "not-a-flow" },
        extra: true,
      };
      storage.setItem(key, JSON.stringify(legacy));

      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;
      expect(read.snapshot.session.mapBackground).toEqual({ override: { mapId: "", value: "legacy-sky" } });
      const restored = applySaveSnapshot(project, read.snapshot);
      expect(firstLayer(restored, "anywhere", "authored-sky")).toBe("legacy-sky");
      expect(restored.m2Runtime?.map.parallax_flow).toBeUndefined();

      legacy.session.mapBackground = "nope";
      storage.setItem(key, JSON.stringify(legacy));
      const dropped = readSaveSlot(storage, 1);
      expect(dropped.kind).toBe("present");
      if (dropped.kind !== "present") return;
      expect(dropped.snapshot.session.mapBackground).toBeUndefined();
      expect(firstLayer(applySaveSnapshot(project, dropped.snapshot), project.startMapId, "authored-sky")).toBe("authored-sky");
    });
  });
});
