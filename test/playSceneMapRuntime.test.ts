import { describe, expect, it } from "vitest";
import { handleAction } from "@/player/playSceneMovement";
import { syncRuntimeState, renderTiles } from "@/player/playSceneMapRuntime";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import type { CharacterFootprint, EventPage, GameEvent } from "@/project/types";
import type { Dir } from "@/player/input";
import { mockSprite, mockTileImage, type MockTileImage } from "./runtimeEventPageFixtures";
import { characterDepth, characterSpriteY, isAlwaysAboveCharacterUpperTile, mapUpperTileDepth, MAP_UPPER_LAYER_DEPTH } from "@/player/characterDepth";
import { TILE } from "@/project/defaults";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { startOnRetiredCombinedTown, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

// 조사 연타 디바운스가 **이벤트 단위**인지, 그리고 디버그 스냅샷이 두 사각을 실어 보내는지.
// 2차 스펙 docs/superpowers/specs/2026-08-30-character-body-vs-passage-rect-design.md §10.
//
// 판별 규칙: 디바운스 테스트는 **정면 칸을 바꾸면서 대상 이벤트는 그대로 두는** 회전을 쓴다.
// 정면 칸도 대상도 같이 바뀌는 회전은 타일 키와 이벤트 키가 같은 답을 내므로 아무것도 못 가른다.
describe("actionDebounceFootprint", () => {
  isolateTimers();
  type ActionScene = Parameters<typeof handleAction>[0];
  function actionPage(id: string, footprint?: CharacterFootprint, passRows?: number): EventPage {
    return {
      id,
      name: "기본",
      conditions: [],
      graphic: { direction: "down", pattern: 0, sprite: { type: "bundled", id: "easyrpg-charset-actor1" } },
      trigger: { kind: "action" },
      priority: "below",
      overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "hi" }],
      ...(footprint ? { footprint } : {}),
      ...(passRows === undefined ? {} : { passRows }),
    };
  }
  /** 지정한 이벤트들을 얹은 씬. runEvent 호출을 이벤트 id 순서로 기록한다. */
  function sceneWith(
    events: readonly GameEvent[],
    player: { readonly x: number; readonly y: number; readonly facing: Dir }
  ): { readonly scene: ActionScene; readonly ran: string[] } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    map.events = [...events];
    store.replace(project);
    const ran: string[] = [];
    const scene = {
      map,
      session: startSession(project),
      eventPositions: initialRuntimeEventPositions(map.events),
      pageMoveRouteKeys: new Set<string>(),
      pageMoveRouteEventIds: new Set<string>(),
      autonomousNPCs: new Map(),
      registerAutonomousMover: () => undefined,
      tileX: player.x,
      tileY: player.y,
      facing: player.facing,
      lastActionTargetKey: "",
      eventSprites: new Map(events.map((event) => [event.id, mockSprite(0, 0, "tex_easyrpg_charset_actor1")])),
      runEvent: async (eventId: string) => {
        ran.push(eventId);
      },
    } as unknown as ActionScene;
    return { scene, ran };
  }
  describe("조사 연타 디바운스는 이벤트 단위다", () => {
    // 3x3 몸(앵커 (10,10) ⇒ x 9..11, y 8..10) 안에 플레이어가 서서 방향만 바꾼다.
    // 정면 칸은 (11,9) → (10,8) 로 달라지지만 대상은 같은 골렘이다.
    function golemScene(facing: Dir) {
      return sceneWith(
        [{ id: "ev_golem", x: 10, y: 10, trigger: { kind: "action" }, commands: [], pages: [actionPage("p0", { width: 3, height: 3 }, 1)] }],
        { x: 10, y: 9, facing }
      );
    }

    it("몸 안에서 방향만 바꿔도 같은 이벤트는 다시 발동하지 않는다", () => {
      const { scene, ran } = golemScene("right");

      expect(handleAction(scene)).toBe(true);
      expect(ran).toEqual(["ev_golem"]);

      // 정면 칸이 (11,9) → (10,8) 로 바뀐다. 타일 키였다면 여기서 두 번째 실행이 났다.
      scene.facing = "up";
      expect(handleAction(scene)).toBe(true);
      expect(ran).toEqual(["ev_golem"]);
    });

    it("서로 다른 이벤트로 방향을 바꾸면 각각 발동한다", () => {
      const { scene, ran } = sceneWith(
        [
          { id: "ev_left", x: 9, y: 10, trigger: { kind: "action" }, commands: [], pages: [actionPage("p0")] },
          { id: "ev_up", x: 10, y: 9, trigger: { kind: "action" }, commands: [], pages: [actionPage("p0")] },
        ],
        { x: 10, y: 10, facing: "left" }
      );

      expect(handleAction(scene)).toBe(true);
      scene.facing = "up";
      expect(handleAction(scene)).toBe(true);

      expect(ran).toEqual(["ev_left", "ev_up"]);
    });

    it("1x1 이벤트를 같은 방향으로 연타하면 한 번만 발동한다 — 항등", () => {
      const { scene, ran } = sceneWith(
        [{ id: "ev_sign", x: 11, y: 10, trigger: { kind: "action" }, commands: [], pages: [actionPage("p0")] }],
        { x: 10, y: 10, facing: "right" }
      );

      expect(handleAction(scene)).toBe(true);
      expect(handleAction(scene)).toBe(true);

      expect(ran).toEqual(["ev_sign"]);
    });
  });
  describe("__oprnDebug 스냅샷이 두 사각을 실어 보낸다", () => {
    /** runtimeDom 대역 — syncRuntimeState 가 넘긴 상태를 잡아 둔다. */
    function captureScene(events: readonly GameEvent[]) {
      const { scene } = sceneWith(events, { x: 10, y: 10, facing: "down" });
      let captured: { events: Record<string, Record<string, unknown>> } | null = null;
      const withDom = scene as unknown as Record<string, unknown>;
      withDom.runtimeDom = {
        // 넓은 디버그 스냅샷은 export-QA 부트에서만 만들어진다. `instrumented` 가 false 면
        // syncRuntimeState 가 보이는 HUD 만 갱신하고 반환해 관측할 사각이 아예 없다.
        instrumented: true,
        syncRuntimeState: (state: { events: Record<string, Record<string, unknown>> }) => {
          captured = state;
        },
        syncVisibleHud: () => undefined,
        syncAudioState: () => undefined,
        syncPictureLayer: () => undefined,
      };
      // Phaser always supplies a game registry, even when no dialogue host is mounted.
      withDom.game = { registry: new Map() };
      withDom.getMapId = () => scene.map.id;
      withDom.inputEnabled = true;
      withDom.running = false;
      withDom.runtimeTimers = new Map();
      syncRuntimeState(scene as never);
      if (!captured) throw new Error("syncRuntimeState 가 상태를 넘기지 않았다");
      return captured as { events: Record<string, Record<string, unknown>> };
    }

    it("3x3 + passRows 1 이면 몸 사각과 통행 사각이 다르게 실린다", () => {
      const state = captureScene([
        { id: "ev_golem", x: 10, y: 10, trigger: { kind: "action" }, commands: [], pages: [actionPage("p0", { width: 3, height: 3 }, 1)] },
      ]);

      expect(state.events.ev_golem).toMatchObject({
        footprint: { width: 3, height: 3 },
        passRows: 1,
        bodyRect: { left: 9, right: 11, top: 8, bottom: 10 },
        passRect: { left: 9, right: 11, top: 10, bottom: 10 },
      });
    });

    it("발자국 저작이 없으면 두 사각이 앵커 한 칸으로 같다 — 항등", () => {
      const state = captureScene([
        { id: "ev_sign", x: 4, y: 6, trigger: { kind: "action" }, commands: [], pages: [actionPage("p0")] },
      ]);

      expect(state.events.ev_sign).toMatchObject({
        footprint: { width: 1, height: 1 },
        passRows: 1,
        bodyRect: { left: 4, right: 4, top: 6, bottom: 6 },
        passRect: { left: 4, right: 4, top: 6, bottom: 6 },
      });
    });
  });
});

describe("characterDepthYSort", () => {
  isolateTimers();
  // 칸 번호(260 침엽수 수관 ★·234 탁자 ×·443 다리 ○)는 합본 마을·월드 칩셋 것이다 — 2026-10-07 저작권 정리로 새 프로젝트에서 빠진
  // 그 칩셋을 들고 있는 옛 저장본을 재현한다.

  describe("map upper tile depth (furniture y-sort vs ★ canopy)", () => {
    it("keeps ★ canopy above same-priority characters and y-sorts solid upper furniture", () => {
      const project = startOnRetiredCombinedTown(createBlankProject());
      const tileset = project.tilesets[project.maps[project.startMapId].tilesetId];
      // 260 침엽수 수관 ★ / 234 가로 탁자 × (솔리드 upper)
      expect(passageMarkForTile(tileset, 260)).toBe("star");
      expect(passageMarkForTile(tileset, 234)).toBe("x");

      expect(isAlwaysAboveCharacterUpperTile(tileset, 260)).toBe(true);
      expect(isAlwaysAboveCharacterUpperTile(tileset, 234)).toBe(false);

      expect(mapUpperTileDepth(tileset, 260, 3)).toBe(MAP_UPPER_LAYER_DEPTH);

      const tableDepth = mapUpperTileDepth(tileset, 234, 3);
      const playerNorth = characterDepth("same", characterSpriteY(2));
      const playerSouth = characterDepth("same", characterSpriteY(4));
      expect(tableDepth).toBe(characterDepth("same", characterSpriteY(3)));
      // 북쪽에서 보면 탁자가 위, 남쪽(앞)에서는 캐릭터가 위.
      expect(tableDepth).toBeGreaterThan(playerNorth);
      expect(playerSouth).toBeGreaterThan(tableDepth);
    });

    it("keeps a directional ○ bridge below characters, preserving ★ and × behavior", () => {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const ts = project.tilesets.easyrpg_chipset_world!;
      ts.priority[443] = "lower";
      ts.passability[443] = { up: false, down: false, left: true, right: true };
      expect(passageMarkForTile(ts, 443)).toBe("o");
      for (const priority of ["below", "same", "above"] as const) {
        expect(mapUpperTileDepth(ts, 443, 36)).toBeLessThan(characterDepth(priority, characterSpriteY(36)));
      }
      expect(isAlwaysAboveCharacterUpperTile(ts, 443)).toBe(false);
      ts.passability[443] = { up: false, down: false, left: false, right: false };
      expect(mapUpperTileDepth(ts, 443, 36)).toBe(characterDepth("same", characterSpriteY(36)));
    });

    it("routes solid upper furniture to root (y-sort) and ★ canopy to upperTileLayer", () => {
      const project = startOnRetiredCombinedTown(createBlankProject());
      const map = project.maps[project.startMapId];
      map.lowerTiles.fill(TILE.GRASS);
      map.upperTiles.fill(-1);
      map.upperTiles[2 * map.width + 2] = 234; // solid table
      const ts = project.tilesets[map.tilesetId];
      ts.passability[235] = { up: false, down: false, left: true, right: true };
      ts.priority[235] = "lower";
      map.upperTiles[3 * map.width + 3] = 235;
      map.upperTiles[1 * map.width + 1] = 260; // tree canopy ★
      store.replace(project);

      const lowerKids: MockTileImage[] = [];
      const upperKids: MockTileImage[] = [];
      const rootKids: MockTileImage[] = [];
      const scene = {
        map,
        session: startSession(project),
        eventPositions: {},
        tileLayer: {
          removeAll: () => undefined,
          add: (image: unknown) => {
            lowerKids.push(image as MockTileImage);
          },
        },
        upperTileLayer: {
          removeAll: () => undefined,
          add: (image: unknown) => {
            upperKids.push(image as MockTileImage);
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
          image: (x: number, y: number) => {
            const img = mockTileImage();
            img.x = x;
            img.y = y;
            rootKids.push(img);
            return img;
          },
          sprite: (x: number, y: number) => {
            const sprite = mockSprite(x, y);
            rootKids.push(sprite);
            return sprite;
          },
        },
        runEvent: async () => undefined,
        syncRuntimeState: () => undefined,
      };

      renderTiles(scene);

      const floorDepth = mapUpperTileDepth(ts, 235, 3);
      expect(rootKids.some(img => img.depth === floorDepth)).toBe(true);
      expect(floorDepth).toBeLessThan(characterDepth("below", characterSpriteY(3)));
      const canopy = upperKids.find((img) => img.depth === MAP_UPPER_LAYER_DEPTH);
      expect(canopy).toBeTruthy();

      const tableDepth = characterDepth("same", characterSpriteY(2));
      const table = rootKids.find((img) => img.depth === tableDepth);
      expect(table).toBeTruthy();
      expect(upperKids.some((img) => img.depth === tableDepth)).toBe(false);
    });
  });
});

describe("interiorFireRendering", () => {
  isolateTimers();
  for (const layer of ["lower", "upper"] as const) it(`animates interior fire on the ${layer} layer but leaves the cold hearth static`, () => {
    // 불 타일 124(폭포 띠 애니)·식은 화덕 463 은 EasyRPG 실내 칩셋 번호다 — 옛 저장본이 들고 있는 그 정의를 되살린다.
    const project = withRetiredEasyRpgTilesets(createBlankProject());
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Map missing");
    map.tilesetId = "easyrpg_chipset_interior";
    map.lowerTiles.fill(72);
    map.upperTiles.fill(-1);
    map.events = [];
    const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
    tiles[map.width + 1] = 124;
    tiles[map.width + 2] = 463;
    store.replace(project);
    const played: string[] = [];
    const staticFrames: (string | number | undefined)[] = [];
    renderTiles({
      map, session: startSession(project), eventPositions: {},
      tileLayer: { removeAll() {}, add() {} },
      upperTileLayer: { removeAll() {}, add() {} },
      eventSprites: new Map(),
      runtimeDom: { clearEventMarkers() {}, upsertEventMarker() {}, syncMissingResourceError() {} },
      missingResources: new Set(),
      add: {
        image(_x, _y, _texture, frame) { staticFrames.push(frame); return mockTileImage(); },
        sprite(x, y, texture) {
          const sprite = mockSprite(x, y, texture);
          sprite.play = key => { played.push(key); return sprite; };
          return sprite;
        },
      },
      async runEvent() {}, syncRuntimeState() {},
    });
    expect(played).toContain("tex_easyrpg_chipset_interior:chipset_waterfall_124_4fps");
    expect(staticFrames).toContain("tile_463");
    expect(staticFrames).not.toContain("tile_124");
  });
});
