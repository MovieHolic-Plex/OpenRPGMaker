import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCameraControl, applyStoredCameraState, calculateScrollMapPanTarget } from "@/player/playSceneCamera";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject, DEFAULT_EASYRPG_CHARSET_ID, TILE } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";
import { rebindEventFollowCamera, renderTiles } from "@/player/playSceneMapRuntime";
import { store } from "@/project/store";
import { setLayerTileAt, setShadowAt } from "@/project/mapLayers";
import { mapTileSize } from "@/project/tileGeometry";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { isAlwaysAboveCharacterUpperTile } from "@/player/characterDepth";
import { findBlockingRuntimeEventAt, initialRuntimeEventPositions, runtimeEventView } from "@/project/runtimeEventState";
import { event, isMockSprite, mockTileImage, mockSprite, pageWith, renderSceneWith, session, type MockSprite } from "./runtimeEventPageFixtures";
import { isolateTimers } from "./mergedTeardown";

describe("playSceneCamera", () => {
  isolateTimers();
  type CameraListener = () => void;
  class CameraStub {
    width = 320;
    height = 240;
    zoom = 1;
    scrollX = 0;
    scrollY = 0;
    worldView = { centerX: 160, centerY: 120 };
    followTarget: unknown = null;
    stopFollowCalls = 0;
    panCalls: { readonly x: number; readonly y: number; readonly duration: number }[] = [];
    centerCalls: { readonly x: number; readonly y: number }[] = [];
    private readonly listeners: Record<string, CameraListener> = {};

    setZoom(zoom: number): void {
      this.zoom = zoom;
    }

    setBounds(): void {
      return undefined;
    }

    centerOn(x: number, y: number): void {
      this.worldView.centerX = x;
      this.worldView.centerY = y;
      this.centerCalls.push({ x, y });
    }

    startFollow(target: unknown): void {
      this.followTarget = target;
    }

    stopFollow(): void {
      this.stopFollowCalls += 1;
      this.followTarget = null;
    }

    once(eventName: string, listener: CameraListener): void {
      this.listeners[eventName] = listener;
    }

    pan(x: number, y: number, duration: number): void {
      this.worldView.centerX = x;
      this.worldView.centerY = y;
      this.panCalls.push({ x, y, duration });
      this.listeners.camerapancomplete?.();
    }
  }
  function cameraScene(camera = new CameraStub()): PlaySceneContext & { readonly camera: CameraStub } {
    const project = createBlankProject();
    const session = startSession(project);
    const player = { x: 160, y: 120 };
    return {
      camera,
      cameras: { main: camera },
      player,
      eventSprites: new Map(),
      session,
      map: project.maps[project.startMapId],
      eventPositions: {},
      syncRuntimeState: () => undefined,
    } as unknown as PlaySceneContext & { readonly camera: CameraStub };
  }
  describe("playSceneCamera scroll map", () => {
    it("calculates tile-distance pan targets by direction", () => {
      expect(calculateScrollMapPanTarget({ centerX: 160, centerY: 120, direction: "right", distanceTiles: 3, tileSize: 16 })).toEqual({
        x: 208,
        y: 120,
      });
      expect(calculateScrollMapPanTarget({ centerX: 160, centerY: 120, direction: "up", distanceTiles: 2, tileSize: 16 })).toEqual({
        x: 160,
        y: 88,
      });
    });

    it("clamps negative distance to no movement", () => {
      expect(calculateScrollMapPanTarget({ centerX: 10, centerY: 20, direction: "left", distanceTiles: -4, tileSize: 16 })).toEqual({
        x: 10,
        y: 20,
      });
    });
  });
  describe("playSceneCamera camera control", () => {
    it("pans to a tile coordinate and records a fixed camera state", async () => {
      const scene = cameraScene();

      await applyCameraControl(scene, {
        mode: "pan",
        target: { kind: "position", x: 4, y: 5 },
        durationMs: 120,
        wait: true,
        returnToPlayer: false,
      });

      expect(scene.camera.stopFollowCalls).toBe(1);
      expect(scene.camera.panCalls).toEqual([{ x: 72, y: 96, duration: 120 }]);
      expect(scene.session.camera).toMatchObject({ mode: "fixed", target: { kind: "position", x: 4, y: 5 } });
    });

    it("follows an event sprite by id", async () => {
      const scene = cameraScene();
      const npcSprite = { x: 88, y: 104 };
      scene.eventSprites.set("npc", npcSprite as never);

      await applyCameraControl(scene, {
        mode: "follow",
        target: { kind: "event", eventId: "npc" },
        durationMs: 0,
        wait: true,
        returnToPlayer: false,
      });

      expect(scene.camera.followTarget).toBe(npcSprite);
      expect(scene.session.camera).toMatchObject({ mode: "follow", target: { kind: "event", eventId: "npc" } });
    });

    it("returns to player follow after a camera control return", async () => {
      const scene = cameraScene();

      await applyCameraControl(scene, {
        mode: "return",
        target: { kind: "position", x: 0, y: 0 },
        durationMs: 90,
        wait: true,
        returnToPlayer: true,
      });

      expect(scene.camera.panCalls).toEqual([{ x: 160, y: 120, duration: 90 }]);
      expect(scene.camera.followTarget).toBe(scene.player);
      expect(scene.session.camera).toMatchObject({ mode: "follow", target: { kind: "player" } });
    });

    it("a return without an explicit zoom restores the map zoom without carrying it to the next map", async () => {
      const scene = cameraScene();
      scene.map.cameraZoom = 0.72;
      await applyCameraControl(scene, {
        mode: "pan", target: { kind: "position", x: 2, y: 3 }, zoom: 1,
        durationMs: 0, wait: true, returnToPlayer: false,
      });
      expect(scene.camera.zoom).toBe(1);

      await applyCameraControl(scene, {
        mode: "return", target: { kind: "player" },
        durationMs: 0, wait: true, returnToPlayer: true,
      });
      expect(scene.camera.zoom).toBeCloseTo(0.72);
      expect(scene.session.camera?.zoom).toBeUndefined();

      delete scene.map.cameraZoom;
      applyStoredCameraState(scene);
      expect(scene.camera.zoom).toBe(1);
    });

    it("applies and saves fixed camera state across a save round trip", () => {
      const scene = cameraScene();
      scene.session.camera = {
        mode: "fixed",
        target: { kind: "position", x: 2, y: 3 },
        offsetX: 4,
        offsetY: -2,
        zoom: 2,
      };

      applyStoredCameraState(scene);

      expect(scene.camera.zoom).toBe(2);
      expect(scene.camera.centerCalls.at(-1)).toEqual({ x: 44, y: 62 });

      const project = createBlankProject();
      const session = startSession(project);
      session.camera = scene.session.camera;
      const snapshot = createSaveSnapshot(project, session);
      const restored = applySaveSnapshot(project, snapshot);

      expect(restored.camera).toEqual(scene.session.camera);
    });
  });
  // 이벤트 스프라이트를 파괴·재생성하는 갱신 경로(refreshRuntimeEntities)는 카메라를 새
  // 객체에 다시 걸어야 한다. 안 걸면 Phaser 가 파괴된 옛 객체의 x/y 를 계속 읽어 카메라가
  // 그 자리에 영구히 얼어붙는다 — 시간표 변경 한 번으로 그렇게 된다.
  // (여기서는 재바인딩 단위를 직접 시험한다. refreshRuntimeEntities 에서 이 함수를 부르는
  //  한 줄은 코드로 확인했다 — 그 경로 전체는 렌더 하네스가 필요해 e2e 영역이다.)
  describe("이벤트 추적 카메라는 스프라이트 재생성 뒤 다시 걸린다", () => {
    it("새 스프라이트로 재바인딩한다", async () => {
      const scene = cameraScene();
      const oldSprite = { x: 88, y: 104 };
      scene.eventSprites.set("npc", oldSprite as never);
      await applyCameraControl(scene, {
        mode: "follow",
        target: { kind: "event", eventId: "npc" },
        durationMs: 0,
        wait: true,
        returnToPlayer: false,
      });
      expect(scene.camera.followTarget).toBe(oldSprite);

      // renderEventLayer 가 하는 일: 옛 스프라이트를 파괴하고 새 객체로 갈아치운다.
      const newSprite = { x: 200, y: 216 };
      scene.eventSprites.set("npc", newSprite as never);

      rebindEventFollowCamera(scene);

      expect(
        scene.camera.followTarget,
        "카메라가 파괴된 옛 스프라이트를 계속 따라간다 — 그 자리에 얼어붙는다"
      ).toBe(newSprite);
    });

    it("플레이어 추적은 건드리지 않는다 (startFollow 가 러프를 죽인다)", () => {
      const scene = cameraScene();
      scene.camera.startFollow(scene.player);
      scene.session.camera = { mode: "follow", target: { kind: "player" }, zoom: 1 } as never;

      rebindEventFollowCamera(scene);

      expect(scene.camera.followTarget).toBe(scene.player);
      expect(scene.camera.stopFollowCalls, "플레이어 추적을 건드렸다").toBe(0);
    });

    it("고정(fixed) 카메라도 건드리지 않는다", () => {
      const scene = cameraScene();
      scene.session.camera = {
        mode: "fixed",
        target: { kind: "event", eventId: "npc" },
        zoom: 1,
      } as never;

      rebindEventFollowCamera(scene);

      expect(scene.camera.followTarget).toBeNull();
      expect(scene.camera.centerCalls).toEqual([]);
    });
  });
  describe("타일 크기가 섞인 프로젝트의 카메라", () => {
    class BoundsCameraStub extends CameraStub {
      bounds: readonly number[] = [];
      override setBounds(...args: number[]): void {
        this.bounds = args;
      }
    }

    function mixedScene(tileSize: number, density: number) {
      const project = createBlankProject();
      const start = project.maps[project.startMapId]!;
      const other = { ...structuredClone(start), id: "map_32", tileSize: 32, width: 12, height: 8 };
      project.maps = { ...project.maps, map_16b: { ...structuredClone(start), id: "map_16b" }, map_32: other };
      vi.spyOn(store, "getCurrent").mockReturnValue(project);
      const camera = new BoundsCameraStub();
      camera.width = 320 * density;
      camera.height = 240 * density;
      const scene = cameraScene(camera);
      Object.assign(scene, {
        map: tileSize === 32 ? other : start,
        game: { registry: { get: (key: string) => (key === "playPixelDensity" ? density : undefined) } },
      });
      return { scene, camera };
    }

    afterEach(() => vi.restoreAllMocks());

    it("모든 맵이 기준(16px) 칸 수를 보여준다 — 저작 배율은 그 위에 곱해진다", () => {
      const village = mixedScene(16, 2);
      applyStoredCameraState(village.scene);
      expect(village.camera.zoom).toBe(2);

      const dungeon = mixedScene(32, 2);
      applyStoredCameraState(dungeon.scene);
      expect(dungeon.camera.zoom).toBe(1);

      // 저작 1.5 는 도트 게임이라 정수 2 로 보인다(pixelSnappedCameraZoom) — 맵 보기 배율(32px 칸 ×1)은 그 위에 곱한다.
      dungeon.scene.session.camera = { mode: "follow", target: { kind: "player" }, zoom: 1.5 };
      applyStoredCameraState(dungeon.scene);
      expect(dungeon.camera.zoom).toBe(2);
    });

    it("경계는 보이는 세계 크기 기준이다 — 작은 맵은 가운데, 여백은 배율로 나눈 값", () => {
      const { scene, camera } = mixedScene(32, 2);
      applyStoredCameraState(scene);
      // 640x480 캔버스, 배율 1 → 세계 640x480 이 보인다. 맵은 384x256 이라 양옆 128, 위아래 112 여백.
      expect(camera.bounds).toEqual([-128, -112, 640, 480]);
    });
  });
});

describe("playSceneExtraLayers", () => {
  isolateTimers();
  type Made = { kind: "image" | "rect"; x: number; y: number; frame?: string; depth?: number; w?: number; alpha?: number };
  function sceneFor(map: ReturnType<typeof createBlankProject>["maps"][string], project: ReturnType<typeof createBlankProject>) {
    const made: Made[] = [];
    const obj = (m: Made) => {
      made.push(m);
      const o = { ...m, visible: true, setOrigin: () => o, setDepth: (d: number) => { m.depth = d; return o; }, play: () => o, setVisible: () => o, destroy: () => undefined };
      return o;
    };
    const scene = {
      map, session: startSession(project), eventPositions: {},
      tileLayer: { removeAll: () => undefined, add: () => undefined },
      upperTileLayer: { removeAll: () => undefined, add: () => undefined },
      eventSprites: new Map(),
      runtimeDom: { clearEventMarkers: () => undefined, upsertEventMarker: () => undefined, syncMissingResourceError: () => undefined },
      missingResources: new Set<string>(),
      add: {
        image: (x: number, y: number, _t: string, frame: string) => obj({ kind: "image", x, y, frame }),
        sprite: (x: number, y: number, _t: string, frame: string) => obj({ kind: "image", x, y, frame }),
        rectangle: (x: number, y: number, w: number, _h: number, _c: number, alpha: number) => obj({ kind: "rect", x, y, w, alpha }),
      },
      runEvent: async () => undefined, syncRuntimeState: () => undefined,
    };
    return { scene, made };
  }
  describe("게임 화면 — 2층·그림자·4층", () => {
    it("깊이: 2층 = y*2+0.01, 그림자 = y*2+0.02, 4층 = 3층 값+0.01", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      const tileset = project.tilesets[map.tilesetId];
      const size = mapTileSize(map);
      const o = [...Array(tileset.count).keys()].filter((t) => passageMarkForTile(tileset, t) === "o");
      const [A, B, C] = [o[1], o[2], o[3]];
      map.upperTiles.fill(-1);
      const y = 2, i = y * map.width + 1;
      setLayerTileAt(map, 2, i, A);
      setLayerTileAt(map, 3, i, B);
      setLayerTileAt(map, 4, i, C);
      setShadowAt(map, i, 0b0001);
      store.replace(project);
      const { scene, made } = sceneFor(map, project);
      renderTiles(scene as never);
      const at = (frame: string) => made.filter((m) => m.frame === frame && m.x === 1 * size && m.y === y * size);
      expect(at(`tile_${A}`).at(-1)?.depth).toBeCloseTo(y * 2 + 0.01);
      expect(at(`tile_${C}`).at(-1)!.depth!).toBeCloseTo(at(`tile_${B}`).at(-1)!.depth! + 0.01);
      const shade = made.filter((m) => m.kind === "rect" && m.alpha === 0.5);
      expect(shade).toHaveLength(1);
      expect(shade[0]).toMatchObject({ x: 1 * size, y: y * size, w: size / 2 });
      expect(shade[0].depth).toBeCloseTo(y * 2 + 0.02);
    });

    it("2층만 바뀌어도 다시 그린다(tilesHash)", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      store.replace(project);
      const { scene, made } = sceneFor(map, project);
      renderTiles(scene as never);
      const first = made.length;
      expect(made.some((m) => m.frame === "tile_1" && m.x === 0 && m.y === 0)).toBe(false);
      setLayerTileAt(map, 2, 0, 1);
      renderTiles(scene as never);
      expect(made.length).toBeGreaterThan(first * 2 - 1);
      // 두 번째 그리기에서 (0,0) 에 2층 타일 1 이 새로 그려졌다.
      const second = made.slice(first);
      expect(second.some((m) => m.kind === "image" && m.frame === "tile_1" && m.x === 0 && m.y === 0)).toBe(true);
    });
  });
});

describe("runtimeEventPageGraphics", () => {
  isolateTimers();
  describe("runtime event page graphics", () => {
    it("exposes movement, animation, and transparent graphic controls to NPC runtime views", () => {
      const events = [
        event("controlled-npc", 2, 3, [
          pageWith({
            priority: "above",
            trigger: { kind: "eventTouch" },
            graphic: {
              sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
              transparent: true,
            },
            movement: {
              type: "random",
              speed: 5,
              frequency: 6,
            },
            animationType: "fixedGraphic",
            overlapForbidden: false,
          }),
        ]),
      ];
      const positions = initialRuntimeEventPositions(events);
      const view = runtimeEventView(events[0], session(), positions);

      expect(view.sprite).toBeUndefined();
      expect(view.transparent).toBe(true);
      expect(view.movement).toEqual({ type: "random", speed: 5, frequency: 6 });
      expect(view.animationType).toBe("fixedGraphic");
      expect(view.overlapForbidden).toBe(false);
      expect(findBlockingRuntimeEventAt(events, session(), positions, 2, 3)).toBeUndefined();
    });

    it("does not render or report missing sprite resources for transparent NPC pages", () => {
      const scene = renderSceneWith({
        graphic: {
          sprite: { type: "bundled", id: "tex_tiles_default" },
          transparent: true,
        },
      });

      renderTiles(scene);

      expect(scene.eventSprites.has("npc")).toBe(false);
      expect(scene.missingResources.has("tex_tiles_default")).toBe(false);
    });

    it("renders missing event graphics with the EasyRPG People1 fallback texture", () => {
      const scene = renderSceneWith({
        graphic: {
          sprite: { type: "bundled", id: "missing-event-character" },
        },
      });

      renderTiles(scene);

      const sprite = scene.eventSprites.get("npc");
      expect(sprite?.texture).toMatchObject({ key: DEFAULT_EASYRPG_CHARSET_ID });
      expect(scene.missingResources.has("missing-event-character")).toBe(true);
    });

    it("renders character sprites on the root display list with lower-screen sprites above upper-screen sprites", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      map.lowerTiles.fill(-1);
      map.upperTiles.fill(-1);
      map.events = [
        event("upper", 1, 1, [pageWith({ graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } } })]),
        event("lower", 1, 2, [pageWith({ graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } } })]),
      ];
      store.replace(project);
      const tileLayerChildren: unknown[] = [];
      const upperTileLayerChildren: unknown[] = [];
      const scene = {
        map,
        session: startSession(project),
        eventPositions: initialRuntimeEventPositions(map.events),
        tileLayer: {
          removeAll: () => undefined,
          add: (image: unknown) => {
            tileLayerChildren.push(image);
          },
        },
        upperTileLayer: {
          removeAll: () => undefined,
          add: (image: unknown) => {
            upperTileLayerChildren.push(image);
          },
        },
        eventSprites: new Map<string, MockSprite>(),
        runtimeDom: {
          clearEventMarkers: () => undefined,
          upsertEventMarker: () => undefined,
          syncMissingResourceError: () => undefined,
        },
        missingResources: new Set<string>(),
        add: {
          image: () => mockTileImage(),
          sprite: (x: number, y: number) => mockSprite(x, y),
        },
        runEvent: async () => undefined,
        syncRuntimeState: () => undefined,
      };

      renderTiles(scene);

      const upper = scene.eventSprites.get("upper");
      const lower = scene.eventSprites.get("lower");
      expect(upper?.origin).toEqual([0.5, 1]);
      expect(lower?.origin).toEqual([0.5, 1]);
      expect(upper?.y).toBe(32);
      expect(lower?.y).toBe(48);
      expect(lower?.depth).toBeGreaterThan(upper?.depth ?? Number.POSITIVE_INFINITY);
      expect(tileLayerChildren.some((child) => isMockSprite(child))).toBe(false);
      expect(upperTileLayerChildren.some((child) => isMockSprite(child))).toBe(false);
    });

    it("routes map upper tiles into upperTileLayer (★ above same-priority characters)", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      map.lowerTiles.fill(TILE.GRASS);
      map.upperTiles.fill(-1);
      // 260(침엽수 수관)은 옛 EasyRPG 합본 마을 번호였다 — 기본 타일셋이 버들항이 된 뒤(2026-10-07)에는 그 번호가 ★ 가 아니다.
      // 지금 기본 타일셋에서 「늘 캐릭터 위」로 판정되는 첫 칸을 쓴다.
      const tileset = project.tilesets[map.tilesetId]!;
      const starTile = Array.from({ length: tileset.count }, (_, i) => i).find((tile) => isAlwaysAboveCharacterUpperTile(tileset, tile));
      if (starTile === undefined) throw new Error(`no always-above upper tile in ${map.tilesetId}`);
      map.upperTiles[1 * map.width + 1] = starTile;
      store.replace(project);
      const lowerKids: unknown[] = [];
      const upperKids: unknown[] = [];
      const scene = {
        map,
        session: startSession(project),
        eventPositions: {},
        tileLayer: {
          removeAll: () => undefined,
          add: (image: unknown) => {
            lowerKids.push(image);
          },
        },
        upperTileLayer: {
          removeAll: () => undefined,
          add: (image: unknown) => {
            upperKids.push(image);
          },
        },
        eventSprites: new Map(),
        runtimeDom: {
          clearEventMarkers: () => undefined,
          upsertEventMarker: () => undefined,
          syncMissingResourceError: () => undefined,
        },
        missingResources: new Set<string>(),
        add: {
          image: () => mockTileImage(),
          sprite: () => mockSprite(0, 0),
        },
        runEvent: async () => undefined,
        syncRuntimeState: () => undefined,
      };
      renderTiles(scene);
      expect(upperKids.length).toBeGreaterThan(0);
      expect(lowerKids.length).toBeGreaterThan(0);
    });
  });
});
