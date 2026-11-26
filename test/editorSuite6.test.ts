import { describe, expect, it, beforeEach } from "vitest";
import { HOUSE_DOOR_CHARSET_TEXTURE, HOUSE_DOOR_FRAME_WAIT_MS, HOUSE_DOOR_OPEN_SE, houseDoorFrameIndex, createHouseInteriorMap, resolveHouseInteriorProgram, resolveHouseInteriorScale, wallMaterialForKit, buildHouseInteriorPlan, type HouseInteriorProgram, type HouseInteriorScale } from "@/editor/houseInteriors";
import { seCatalogResourceIds } from "@/assets/seCatalogRuntime";
import { VR, INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline, reachableOpenCells, type InteriorRoomPlan, type RoomSpec } from "@/editor/interiorRoomPipeline";
import { rectHouseHeight, stampFootprintHouseKit, stampRectHouseKit } from "@/editor/houseKit";
import { createBlankProject, TILE } from "@/project/defaults";
import type { GameMap, Project, MapId, TilesetDef } from "@/project/types";
import baseline from "./fixtures/interiorRoomDemoRooms.baseline.json";
import { createVillagerRoomMap } from "@/editor/villagerRoomKit";
import { isolateTimers } from "./mergedTeardown";
import { LOCATION_DOUBLE_CLICK_MS, LOCATION_OPEN_EVENT_CLICK_COUNT, locationClickCount, resolveLocationOverlapPointer } from "@/editor/locationPointerPriority";
import { listDatabaseResourceOptions, type DatabaseResourcePickerKind } from "@/editor/resourceOptions";
import { editorState, type TileClipboard } from "@/editor/editorState";
import { redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { pasteGhostLiftSteps, pasteStampLiftField, pasteGhostPieces } from "@/editor/pastePreviewGhost";
import type { ReliefData } from "@/project/relief/types";
import { store } from "@/project/store";
import { filterProps, groupProps, recommendProps, propsForTileset } from "@/editor/propRecommendations";

describe("interiorRoomPipeline", () => {
  isolateTimers();
  describe("houseKit", () => {
    isolateTimers();
    // 하네싱 골든 테스트 — 키트 전개 결과가 사용자 기준 집(fable-village 연습04)의
    // 실데이터와 "셀 단위로" 일치해야 한다. 정본: docs/knowledge/images/2026-07-08-house-harness-design.png
    const E = TILE.EMPTY;
    const G = 270;   // 풀

    function freshMap(): GameMap {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      map.lowerTiles.fill(G);
      map.upperTiles.fill(E);
      return map;
    }
    function row(map: GameMap, layer: "lower" | "upper", y: number, x0: number, x1: number): number[] {
      const arr = layer === "lower" ? map.lowerTiles : map.upperTiles;
      return Array.from({ length: x1 - x0 + 1 }, (_, i) => arr[y * map.width + (x0 + i)]);
    }
    function countUpper(map: GameMap, tile: number): number {
      return map.upperTiles.filter((entry) => entry === tile).length;
    }
    describe("house kit — 하네싱 골든", () => {
      it("파랑+석벽 키트(폭6·1층·몸통1행)가 연습04 기준 집을 셀 단위로 재현한다", () => {
        const map = freshMap();
        const result = stampRectHouseKit(map, { x: 2, y: 2, width: 6, stories: 1, roofBodyRows: 1, kitId: "blue-stone", windows: false });
        expect(result.ok, result.reason).toBe(true);
        expect(result.height).toBe(6);

        // 연습04 실데이터 (x2..7, y2..7):
        expect(row(map, "lower", 2, 2, 7)).toEqual([G, 406, 406, 406, 406, G]); // 최상행: 좌우 1칸 인셋
        expect(row(map, "upper", 2, 2, 7)).toEqual([356, E, E, E, E, 357]); // 인셋 모서리 = 상위 대각
        expect(row(map, "lower", 3, 2, 7)).toEqual([406, 406, 406, 406, 406, 407]); // 몸통행: 우측 끝만 407
        expect(row(map, "lower", 4, 2, 7)).toEqual([467, 467, 467, 467, 467, 467]); // 처마: 벽과 같은 폭
        expect(row(map, "upper", 4, 2, 7)).toEqual([386, E, E, E, E, 387]); // 처마 끝 대각(처마 위에 겹침)
        expect(row(map, "lower", 5, 2, 7)).toEqual([15, 16, 16, 16, 16, 17]); // 벽 상단
        expect(row(map, "lower", 6, 2, 7)).toEqual([45, 46, 46, 46, 46, 47]); // 벽 중단
        expect(row(map, "lower", 7, 2, 7)).toEqual([75, 76, 76, 76, 76, 77]); // 벽 하단
        expect(result.doorAt).toEqual({ x: 5, y: 7 });
      });

      it("밝은오렌지+회벽 키트는 연습08 규칙(용마루 위 한 줄·트림·오버행 처마)을 지킨다", () => {
        const map = freshMap();
        const result = stampRectHouseKit(map, { x: 2, y: 2, width: 6, stories: 1, roofBodyRows: 2, kitId: "bright-plaster", windows: false });
        expect(result.ok, result.reason).toBe(true);

        // 용마루 행(2026-07-17 교정): 불투명 용마루 374는 하위, 양끝 투명 캡만 상위.
        expect(row(map, "upper", 2, 2, 7)).toEqual([354, E, E, E, E, 355]);
        expect(row(map, "lower", 2, 2, 7)).toEqual([G, 374, 374, 374, 374, G]);
        // 몸통 2행: 인셋 + 좌우 바깥 열 사선 트림(불투명 — 하위).
        for (const y of [3, 4]) {
          expect(row(map, "lower", y, 2, 7)).toEqual([376, 404, 404, 404, 404, 377]);
          expect(row(map, "upper", y, 2, 7)).toEqual([E, E, E, E, E, E]);
        }
        // 처마: 벽 폭(몸통보다 +1 오버행), 트림 하단 캡이 처마 위에 겹침.
        expect(row(map, "lower", 5, 2, 7)).toEqual([405, 405, 405, 405, 405, 405]);
        expect(row(map, "upper", 5, 2, 7)).toEqual([384, E, E, E, E, 385]);
        // 흰 회벽 3행.
        expect(row(map, "lower", 6, 2, 7)).toEqual([12, 13, 13, 13, 13, 14]);
        expect(row(map, "lower", 7, 2, 7)).toEqual([42, 43, 43, 43, 43, 44]);
        expect(row(map, "lower", 8, 2, 7)).toEqual([72, 73, 73, 73, 73, 74]);
      });

      it("2층은 벽 중단 행만 세로 반복한다 (상단/하단은 1행 고정)", () => {
        const map = freshMap();
        const result = stampRectHouseKit(map, { x: 2, y: 2, width: 5, stories: 2, roofBodyRows: 1, kitId: "blue-stone" });
        expect(result.ok, result.reason).toBe(true);
        expect(result.height).toBe(1 + 1 + 1 + (2 + 3)); // 지붕 3행 + 벽 5행(상1+중3+하1)

        expect(row(map, "lower", 5, 2, 6)).toEqual([15, 16, 16, 16, 17]); // 상단 1행
        for (const y of [6, 7, 8]) expect(row(map, "lower", y, 2, 6)).toEqual([45, 46, 46, 46, 47]); // 중단 ×3
        expect(row(map, "lower", 9, 2, 6)).toEqual([75, 76, 76, 76, 77]); // 하단 1행
      });

      it("상위 마감은 빈 칸에만 얹는다 — 이웃 오브젝트를 덮지 않는다", () => {
        const map = freshMap();
        map.upperTiles[2 * map.width + 2] = 260; // 좌상 모서리 자리에 기존 나무 꼭대기
        const result = stampRectHouseKit(map, { x: 2, y: 2, width: 6, stories: 1, roofBodyRows: 1, kitId: "blue-stone" });
        expect(result.ok).toBe(true);
        expect(map.upperTiles[2 * map.width + 2]).toBe(260); // 보존
        expect(map.upperTiles[2 * map.width + 7]).toBe(357); // 빈 쪽은 정상 마감
      });

      it("경계를 벗어나면 시공을 거부한다", () => {
        const map = freshMap();
        const result = stampRectHouseKit(map, {
          x: map.width - 3,
          y: 2,
          width: 6,
          stories: 1,
          roofBodyRows: 1,
          kitId: "blue-stone",
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain("경계");
      });

      it("풋프린트 painter가 연습08 ㄱ자 기준 집을 셀 단위로 재현한다", () => {
        const map = freshMap();
        // 연습08 질량: 좌날개 x3..7 rows3..9 + 우날개 x8..12 rows3..12.
        const result = stampFootprintHouseKit(map, {
          kitId: "bright-plaster",
          windows: false,
          wings: [
            { x: 3, y: 3, w: 5, h: 7 },
            { x: 8, y: 3, w: 5, h: 10 },
          ],
        });
        expect(result.ok, result.reason).toBe(true);

        // 연습08 기준 형태 + 2026-07-17 레이어 교정: 불투명 사선(374/376/377)은 하위로.
        expect(row(map, "upper", 2, 2, 13)).toEqual([E, 354, E, E, E, E, E, E, E, E, 355, E]);
        expect(row(map, "lower", 2, 2, 13)).toEqual([G, G, 374, 374, 374, 374, 374, 374, 374, 374, G, G]);
        for (const y of [3, 4, 5]) {
          expect(row(map, "lower", y, 2, 13)).toEqual([G, 376, 404, 404, 404, 404, 404, 404, 404, 404, 377, G]);
          expect(row(map, "upper", y, 2, 13)).toEqual([E, E, E, E, E, E, E, E, E, E, E, E]);
        }
        expect(row(map, "lower", 6, 2, 13)).toEqual([G, 405, 405, 405, 405, 405, 376, 404, 404, 404, 377, G]);
        expect(row(map, "upper", 6, 2, 13)).toEqual([E, 384, E, E, E, E, E, E, E, E, E, E]);
        expect(row(map, "lower", 7, 2, 13)).toEqual([G, 12, 13, 13, 13, 14, 376, 404, 404, 404, 377, G]);
        expect(row(map, "upper", 7, 2, 13)).toEqual([E, E, E, E, E, E, E, E, E, E, E, E]);
        expect(row(map, "lower", 8, 2, 13)).toEqual([G, 42, 43, 43, 43, 44, 376, 404, 404, 404, 377, G]);
        expect(row(map, "lower", 9, 2, 13)).toEqual([G, 72, 73, 73, 73, 74, 405, 405, 405, 405, 405, G]);
        expect(row(map, "upper", 9, 2, 13)).toEqual([E, E, E, E, E, E, 384, E, E, E, 385, E]);
        expect(row(map, "lower", 10, 2, 13)).toEqual([G, G, G, G, G, G, 12, 13, 13, 13, 14, G]);
        expect(row(map, "lower", 11, 2, 13)).toEqual([G, G, G, G, G, G, 42, 43, 43, 43, 44, G]);
        expect(row(map, "lower", 12, 2, 13)).toEqual([G, G, G, G, G, G, 72, 73, 73, 73, 74, G]);
      });

      it("풋프린트 painter가 연습04 직사각 파랑 기준 집도 재현한다", () => {
        const map = freshMap();
        const result = stampFootprintHouseKit(map, { kitId: "blue-stone", windows: false, wings: [{ x: 2, y: 2, w: 6, h: 6 }] });
        expect(result.ok, result.reason).toBe(true);
        expect(row(map, "lower", 2, 2, 7)).toEqual([G, 406, 406, 406, 406, G]);
        expect(row(map, "upper", 2, 2, 7)).toEqual([356, E, E, E, E, 357]);
        expect(row(map, "lower", 3, 2, 7)).toEqual([406, 406, 406, 406, 406, 407]);
        expect(row(map, "lower", 4, 2, 7)).toEqual([467, 467, 467, 467, 467, 467]);
        expect(row(map, "upper", 4, 2, 7)).toEqual([386, E, E, E, E, 387]);
        expect(row(map, "lower", 5, 2, 7)).toEqual([15, 16, 16, 16, 16, 17]);
        expect(row(map, "lower", 6, 2, 7)).toEqual([45, 46, 46, 46, 46, 47]);
        expect(row(map, "lower", 7, 2, 7)).toEqual([75, 76, 76, 76, 76, 77]);
        expect(result.doorAt).toEqual({ x: 4, y: 7 });
      });

      it("ㅁ자(안마당 링) 평면 — 안마당을 향한 북쪽 날개 벽과 남쪽 외벽이 함께 생긴다", () => {
        const map = freshMap();
        const result = stampFootprintHouseKit(map, {
          kitId: "bright-plaster",
          wings: [
            { x: 2, y: 2, w: 16, h: 6 }, // 북쪽 날개 (rows2..7)
            { x: 2, y: 8, w: 4, h: 7 }, // 서쪽 날개 (rows8..14)
            { x: 14, y: 8, w: 4, h: 7 }, // 동쪽 날개
            { x: 2, y: 10, w: 16, h: 5 }, // 남쪽 날개 (rows10..14)
          ],
        });
        expect(result.ok, result.reason).toBe(true);
        // 안마당(x6..13): y8은 잔디, y9는 남쪽 날개의 용마루 줄(374 하위 — 2026-07-17 교정).
        for (let x = 6; x <= 13; x += 1) {
          expect(map.lowerTiles[8 * map.width + x], `courtyard(${x},8)`).toBe(G);
          expect(map.lowerTiles[9 * map.width + x], `ridge(${x},9)`).toBe(374);
        }
        // 북쪽 날개의 안마당 쪽 벽(하단 행 y=7)과 남쪽 외벽(y=14)이 존재.
        expect(map.lowerTiles[7 * map.width + 8]).toBe(73);
        expect(map.lowerTiles[14 * map.width + 8]).toBe(73);
      });

      it("rectHouseHeight는 층수·지붕 몸통 행수에 따라 결정된다", () => {
        expect(rectHouseHeight({ stories: 1, roofBodyRows: 1, kitId: "blue-stone" })).toBe(6);
        expect(rectHouseHeight({ stories: 2, roofBodyRows: 2, kitId: "bright-plaster" })).toBe(9);
      });
    });
    describe("house kit — 창문 자동 배치", () => {
      it("1층 풋프린트 집은 중단 행에 spacing 규칙대로 창문을 찍고 문 열±1은 비운다", () => {
        const map = freshMap();
        const result = stampFootprintHouseKit(map, { kitId: "blue-stone", wings: [{ x: 2, y: 2, w: 10, h: 6 }] });
        expect(result.ok, result.reason).toBe(true);
        expect(result.doorAt).toEqual({ x: 6, y: 7 });

        // Window slots follow windowSlotsInRun/placeWindowsOnWallRuns (src/editor/houseKit.ts): centred in each wall run beside the door,
        // upper floors aligned to the ground-floor windows and door column. Behaviour as of 0d4f13e7c8; the old columns (3, 9) predate it.
        expect(map.upperTiles[6 * map.width + 4]).toBe(87);
        expect(map.upperTiles[6 * map.width + 9]).toBe(87);
        for (const x of [5, 6, 7]) expect(map.upperTiles[6 * map.width + x]).toBe(E);
      });

      it("다층 직사각 집은 층마다 한 줄만 창문을 배치해 층 사이를 분리한다", () => {
        const map = freshMap();
        const result = stampRectHouseKit(map, { x: 2, y: 2, width: 10, stories: 2, roofBodyRows: 1, kitId: "blue-stone" });
        expect(result.ok, result.reason).toBe(true);

        // Window slots follow windowSlotsInRun/placeWindowsOnWallRuns (src/editor/houseKit.ts): centred in each wall run beside the door,
        // upper floors aligned to the ground-floor windows and door column. Behaviour as of 0d4f13e7c8; the old columns (3, 9) predate it.
        expect(result.doorAt).toEqual({ x: 7, y: 9 });
        for (const y of [6, 8]) {
          expect(map.upperTiles[y * map.width + 4], `window left y=${y}`).toBe(87);
          expect(map.upperTiles[y * map.width + 10], `window right y=${y}`).toBe(87);
        }
        for (const x of [6, 7, 8]) expect(map.upperTiles[8 * map.width + x], `door skip (${x},8)`).toBe(E);
        // The upper floor puts a window over the door column.
        expect(map.upperTiles[6 * map.width + 7], "upper window over the door").toBe(87);
        for (const x of [4, 10]) expect(map.upperTiles[7 * map.width + x], `floor separator x=${x}`).toBe(E);
      });

      it("windows:false면 창문 타일을 추가하지 않는다", () => {
        const map = freshMap();
        const result = stampRectHouseKit(map, { x: 2, y: 2, width: 10, stories: 1, roofBodyRows: 1, kitId: "blue-stone", windows: false });
        expect(result.ok, result.reason).toBe(true);
        expect(countUpper(map, 87)).toBe(0);
      });

      it("키트별 창문 타일을 사용한다", () => {
        const blue = freshMap();
        const bright = freshMap();
        expect(stampRectHouseKit(blue, { x: 2, y: 2, width: 10, stories: 1, roofBodyRows: 1, kitId: "blue-stone" }).ok).toBe(true);
        expect(stampRectHouseKit(bright, { x: 2, y: 2, width: 10, stories: 1, roofBodyRows: 1, kitId: "bright-plaster" }).ok).toBe(true);

        expect(countUpper(blue, 87)).toBeGreaterThan(0);
        expect(countUpper(blue, 85)).toBe(0);
        expect(countUpper(bright, 85)).toBeGreaterThan(0);
        expect(countUpper(bright, 87)).toBe(0);
      });

      it("창문 위치의 상위 레이어에 기존 값이 있으면 덮지 않는다", () => {
        const map = freshMap();
        // Occupy the left window slot (column 4 per windowSlotsInRun, see the first window case).
        map.upperTiles[6 * map.width + 4] = 260;
        const result = stampRectHouseKit(map, { x: 2, y: 2, width: 10, stories: 1, roofBodyRows: 1, kitId: "blue-stone" });
        expect(result.ok, result.reason).toBe(true);
        expect(map.upperTiles[6 * map.width + 4]).toBe(260);
        expect(map.upperTiles[6 * map.width + 10]).toBe(87);
      });

      it("문 이벤트 옵션은 Object1 그래픽과 열림 프레임→transfer 명령을 만든다", () => {
        const map = freshMap();
        map.events = [];
        const result = stampFootprintHouseKit(map, {
          kitId: "bright-plaster",
          windows: false,
          wings: [{ x: 2, y: 2, w: 6, h: 6 }],
          doorEvent: { eventId: "ev_house_door", interiorMapId: "map_inside", name: "민재의 집 문" },
        });
        expect(result.ok, result.reason).toBe(true);
        expect(result.doorAt).toEqual({ x: 4, y: 7 });

        const door = map.events.find((event) => event.id === "ev_house_door");
        expect(door?.x).toBe(4);
        expect(door?.y).toBe(7);
        const page = door?.pages?.[0];
        // 열린 문 기본값: 문 스프라이트는 below 장식, 전이는 문 앞 발판이 맡는다.
        expect(page?.trigger.kind).toBe("playerTouch");
        expect(page?.priority).toBe("below");
        expect(page?.graphic.sprite?.id).toBe(HOUSE_DOOR_CHARSET_TEXTURE);
        expect(page?.graphic.pattern).toBe(houseDoorFrameIndex("bright-plaster", 0));
        expect(page?.commands.map((command) => command.kind)).toEqual([
          "playAudio",
          "setEventGraphicPattern",
          "wait",
          "setEventGraphicPattern",
          "wait",
          "setEventGraphicPattern",
          "wait",
          "transfer",
        ]);
        // 문 열림 효과음은 첫 프레임과 같은 틱에, 원샷(loop:false = SE 채널)으로 울린다.
        expect(page?.commands[0]).toEqual({ kind: "playAudio", resourceId: HOUSE_DOOR_OPEN_SE, loop: false });
        expect(seCatalogResourceIds()).toContain(HOUSE_DOOR_OPEN_SE);
        expect(page?.commands[1]).toMatchObject({ kind: "setEventGraphicPattern", eventId: "ev_house_door", pattern: houseDoorFrameIndex("bright-plaster", 0) });
        expect(page?.commands[2]).toEqual({ kind: "wait", ms: HOUSE_DOOR_FRAME_WAIT_MS });
        expect(page?.commands[3]).toMatchObject({ kind: "setEventGraphicPattern", pattern: houseDoorFrameIndex("bright-plaster", 1) });
        expect(page?.commands[5]).toMatchObject({ kind: "setEventGraphicPattern", pattern: houseDoorFrameIndex("bright-plaster", 2) });
        expect(page?.commands[7]).toMatchObject({ kind: "transfer", mapId: "map_inside", x: 10, y: 15 });
      });
    });
    // Removed describe "author_house single": author_house was removed from the tool registry on purpose.

    describe("house interior — L cottage (reference plan)", () => {
      it("1층 dwelling/manor resolves to cottage-l with kitchen·bedroom·living rooms", () => {
        expect(resolveHouseInteriorScale({ stories: 1, program: "dwelling" }, 1)).toBe("cottage-l");
        expect(resolveHouseInteriorScale({ stories: 1, program: "manor", ownerName: "촌장 로안" }, 1)).toBe("cottage-l");
        expect(resolveHouseInteriorScale({ stories: 2, program: "manor" }, 1)).toBe("mansion");
        // cottage-l|l-cottage aliases don't exist in the catalog; real L-shaped exteriors use id "l".
        expect(resolveHouseInteriorScale({ stories: 1, templateId: "l" }, 1)).toBe("cottage-l");

        const result = createHouseInteriorMap({
          id: "map_l_cottage_test",
          name: "L형 민가",
          returnMapId: "map_out",
          returnX: 1,
          returnY: 2,
          exitEventId: "ev_exit",
          seed: 77,
          exterior: {
            stories: 1,
            program: "manor",
            ownerName: "촌장 로안",
            kitId: "blue-stone",
            footprintArea: 48,
            templateId: "l",
          },
        });
        expect(result.scale).toBe("cottage-l");
        expect(result.program).toBe("manor");
        expect(result.map.width).toBeLessThanOrEqual(34);
        expect(result.map.height).toBeLessThanOrEqual(35);
        const upper = result.map.upperTiles;
        const lower = result.map.lowerTiles;
        // Topology varies with the seed; verify functional rooms and materials, not old coordinates.
        const plan = result.map.roomHarnessPlan!.plan as { rooms: {w:number;h:number;theme:string}[] };
        expect(plan.rooms).toHaveLength(3);
        expect(plan.rooms.reduce((area,r)=>area+r.w*r.h,0)).toBeLessThanOrEqual(100);
        expect(lower.includes(12)).toBe(true);
        expect(lower.some(t=>[72,73,102,103].includes(t))).toBe(true);
        expect(lower.some((t) => t === VR.STOVE_TOP)).toBe(true);
        expect(lower.some((t) => t === VR.STOVE_BOT)).toBe(true);
        expect(upper.some((t) => t === VR.BED_L || t === VR.BED_V_HEAD)).toBe(true);
        expect(upper.some((t) => t === VR.TABLE_L || t === VR.SQUARE_TABLE)).toBe(true);
      });

      it("maps every house kit to an interior wall material", () => {
        expect(wallMaterialForKit("blue-stone")).toBe("stone-brick");
        expect(wallMaterialForKit("slate-wood")).toBe("stone-brick");
        expect(wallMaterialForKit("bright-plaster")).toBe("cream");
        expect(wallMaterialForKit("amber-wood")).toBe("cream");
        expect(wallMaterialForKit("timber-hall")).toBe("cream");
      });

      it("maps catalog template families to interior scale", () => {
        expect(resolveHouseInteriorScale({ templateId: "l" }, 1)).toBe("cottage-l");
        // L-family keeps the L plan even for shop/inn (branch order: family before program).
        expect(resolveHouseInteriorScale({ stories: 1, templateId: "l-mirror", program: "shop" }, 1)).toBe("cottage-l");
        expect(resolveHouseInteriorScale({ stories: 1, templateId: "l-wide", program: "inn" }, 1)).toBe("cottage-l");
        expect(resolveHouseInteriorScale({ stories: 1, templateId: "l-deep" }, 1)).toBe("cottage-l");
        expect(resolveHouseInteriorScale({ templateId: "cottage-low" }, 1)).toBe("cottage2");
        expect(resolveHouseInteriorScale({ templateId: "hut-low" }, 1)).toBe("cottage2");
        expect(resolveHouseInteriorScale({ templateId: "barn-low" }, 1)).toBe("cottage2");
        expect(resolveHouseInteriorScale({ templateId: "rect-2f-slim" }, 1)).toBe("cottage3");
      });

      it("defaults program to dwelling for a plain owner across seeds", () => {
        expect(resolveHouseInteriorProgram({ ownerName: "민재" }, 1)).toBe("dwelling");
        expect(resolveHouseInteriorProgram({ ownerName: "민재" }, 4)).toBe("dwelling");
      });

      it("preserves explicit program passthrough", () => {
        expect(resolveHouseInteriorProgram({ program: "shop", ownerName: "민재" }, 1)).toBe("shop");
        expect(resolveHouseInteriorProgram({ program: "workshop" }, 4)).toBe("workshop");
      });

      it("preserves ownerName shop/inn/manor heuristics", () => {
        expect(resolveHouseInteriorProgram({ ownerName: "마을 상점" }, 1)).toBe("shop");
        expect(resolveHouseInteriorProgram({ ownerName: "여관 주인" }, 1)).toBe("inn");
        expect(resolveHouseInteriorProgram({ ownerName: "촌장 로안" }, 1)).toBe("manor");
      });
    });
  });
  // interiorRoomPipelineParity.test.ts
  // 실내 방 파이프라인 특성화 핀(characterization pin) — 데모 플랜 7개의 lower/upper 타일 배열이
  // 커밋된 베이스라인 픽스처와 완전히 같아야 한다. 카탈로그 리팩터가 생성 결과를 바꾸지 않는다는 증거.
  describe("interiorRoomPipelineParity", () => {
    isolateTimers();
    type BaselineRoom = {
      readonly index: number;
      readonly theme: string;
      readonly name: string;
      readonly seed: number;
      readonly width: number;
      readonly height: number;
      readonly lowerTiles: readonly number[];
      readonly upperTiles: readonly number[];
      readonly eventCount: number;
    };
    const rooms = baseline.rooms as readonly BaselineRoom[];
    describe("runInteriorRoomPipeline 베이스라인 패리티", () => {
      it("베이스라인이 데모 플랜 전체를 담고 있다", () => {
        expect(rooms.length).toBe(INTERIOR_ROOM_DEMO_PLANS.length);
      });

      for (const fixture of rooms) {
        it(`#${fixture.index} ${fixture.theme} — ${fixture.name} 타일 배열이 베이스라인과 동일`, () => {
          const plan = INTERIOR_ROOM_DEMO_PLANS[fixture.index]!;
          expect(plan.name).toBe(fixture.name);
          expect(plan.seed).toBe(fixture.seed);
          const { map } = runInteriorRoomPipeline(plan);
          expect(map.width).toBe(fixture.width);
          expect(map.height).toBe(fixture.height);
          expect(map.events.length).toBe(fixture.eventCount);
          expect(map.lowerTiles).toEqual(fixture.lowerTiles);
          expect(map.upperTiles).toEqual(fixture.upperTiles);
        });
      }
    });
  });
  describe("villageInteriorShell", () => {
    isolateTimers();
    const SCALES: readonly HouseInteriorScale[] = ["cottage2", "cottage3", "cottage-l", "mansion"];
    const PROGRAMS: readonly HouseInteriorProgram[] = ["dwelling", "shop", "inn", "workshop", "study", "manor"];
    const FLOORS = ["ground", "upper"] as const;
    interface StockHouse {
      readonly plan: InteriorRoomPlan;
      readonly floor: (typeof FLOORS)[number];
      readonly map: GameMap;
      readonly ok: boolean;
      readonly warnings: readonly string[];
    }
    // The outline is deliberately varied (generateHouseTopology keeps different graph/outline solutions; house-form rules #2416),
    // so these tests check what a house interior must always be rather than one rectangle. Plans are built the way the live
    // caller does (runDirectRoomDraft: no project binding) and then painted by the real interior pipeline.
    function stockHouses(): StockHouse[] {
      const houses: StockHouse[] = [];
      for (const scale of SCALES) for (const program of PROGRAMS) for (const floor of FLOORS) for (const seed of [1, 2, 3]) {
        const plan = buildHouseInteriorPlan({ mapId: `m_${scale}_${program}_${floor}_${seed}` as never, name: "x", seed, scale, program, floor });
        const built = runInteriorRoomPipeline(plan);
        houses.push({ plan, floor, map: built.map, ok: built.ok, warnings: built.warnings });
      }
      return houses;
    }
    const HOUSES = stockHouses();
    const roomsOf = (plan: InteriorRoomPlan): readonly RoomSpec[] => plan.rooms ?? [];
    const inFootprint = (plan: InteriorRoomPlan, x: number, y: number): boolean =>
      roomsOf(plan).some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    const lowerAt = (map: GameMap, x: number, y: number): number =>
      x < 0 || y < 0 || x >= map.width || y >= map.height ? VR.VOID : map.lowerTiles[y * map.width + x]!;
    const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    describe("stock house interiors — shell invariants (varied outlines allowed)", () => {
      it("sweeps all 144 stock plans and the pipeline accepts each one", () => {
        expect(HOUSES).toHaveLength(SCALES.length * PROGRAMS.length * FLOORS.length * 3);
        for (const house of HOUSES) expect(house.ok, `${house.plan.mapId}: ${house.warnings.join(" / ")}`).toBe(true);
      });

      it("(a) closes the shell — no floor cell touches the void except through the front door", () => {
        for (const { plan, map } of HOUSES) {
          for (const room of roomsOf(plan)) for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
            for (const [dx, dy] of NEIGHBOURS) {
              if (x === plan.door.x && y === plan.door.y && dy === 1) continue;
              expect(lowerAt(map, x + dx, y + dy), `${plan.mapId}: (${x},${y}) opens to the void toward (${x + dx},${y + dy})`).not.toBe(VR.VOID);
            }
          }
        }
      });

      it("(b) connects the interior floor — every room is walkable from the door (furniture-sized nooks may be full)", () => {
        for (const { plan, map } of HOUSES) {
          // Floor connectivity, not furniture clearance: the pipeline's own reachability check also walks the floor layer only.
          const floorOnly: GameMap = { ...map, upperTiles: map.upperTiles.map(() => -1) };
          const reach = reachableOpenCells(floorOnly, new Array<boolean>(map.width * map.height).fill(true), plan.door);
          for (const room of roomsOf(plan)) {
            let reached = false;
            for (let y = room.y; y < room.y + room.h && !reached; y += 1) for (let x = room.x; x < room.x + room.w && !reached; x += 1) reached = reach.has(y * map.width + x);
            expect(reached, `${plan.mapId}: room ${room.id} is cut off from the door`).toBe(true);
          }
        }
      });

      it("(c) has exactly one entrance, on the outer wall (ground: south face; upper: the stair landing on the footprint edge)", () => {
        for (const { plan, floor } of HOUSES) {
          const { x, y } = plan.door;
          expect(inFootprint(plan, x, y), `${plan.mapId}: door (${x},${y}) is not on the floor`).toBe(true);
          const outward = floor === "ground" ? [[0, 1] as const] : NEIGHBOURS;
          expect(outward.some(([dx, dy]) => !inFootprint(plan, x + dx, y + dy)), `${plan.mapId}: door (${x},${y}) is not on an outer wall`).toBe(true);
          // Inner doors are partitions between rooms, never a second way out.
          for (const inner of plan.innerDoors ?? []) {
            expect(inner.x === x && inner.y === y, `${plan.mapId}: inner door duplicates the entrance`).toBe(false);
            expect(NEIGHBOURS.some(([dx, dy]) => inFootprint(plan, inner.x + dx, inner.y + dy)), `${plan.mapId}: inner door (${inner.x},${inner.y}) touches no room`).toBe(true);
          }
        }
      });

      it("(d) roofs the footprint — every north edge has a ceiling and a two-row wall face above it", () => {
        for (const { plan, map } of HOUSES) {
          for (const room of roomsOf(plan)) for (let x = room.x; x < room.x + room.w; x += 1) {
            for (let y = room.y; y < room.y + room.h; y += 1) {
              if (inFootprint(plan, x, y - 1)) continue;
              for (let k = 1; k <= 3; k += 1) {
                expect(lowerAt(map, x, y - k), `${plan.mapId}: no roof above (${x},${y}) at row ${y - k}`).not.toBe(VR.VOID);
              }
            }
          }
        }
      });
    });
  });
  describe("villagerRoomKit", () => {
    isolateTimers();
    describe("villagerRoomKit re-export", () => {
      it("builds bedroom via pipeline", () => {
        const map = createVillagerRoomMap("bedroom");
        expect(map.upperTiles).toContain(VR.BED_L);
        expect(map.events?.some((e) => e.pages?.[0]?.name === "입구")).toBe(true);
      });
    });
  });
});

// 로케이션과 이벤트가 겹칠 때의 클릭 소유권 (2026-09-12 적대적 리뷰 후속).
describe("locationPointerPriority", () => {
  isolateTimers();
  const base = { locationLayerEnabled: true, eventIdAtPoint: "ev_npc", altKey: false, clickCount: 1 };
  describe("location vs event pointer priority", () => {
    it("레이어가 꺼져 있으면 판정에 끼어들지 않는다", () => {
      expect(resolveLocationOverlapPointer({ ...base, locationLayerEnabled: false, altKey: true, clickCount: 2 }))
        .toEqual({ kind: "draw" });
    });

    it("겹치는 이벤트가 없으면 언제나 그리기다", () => {
      expect(resolveLocationOverlapPointer({ ...base, eventIdAtPoint: null, altKey: true, clickCount: 3 }))
        .toEqual({ kind: "draw" });
    });

    it("한 번 클릭은 그리기다 — 면을 칠하려는 사람이 NPC 때문에 막히지 않는다", () => {
      expect(resolveLocationOverlapPointer(base)).toEqual({ kind: "draw" });
    });

    it("Alt+클릭은 이벤트를 연다", () => {
      expect(resolveLocationOverlapPointer({ ...base, altKey: true })).toEqual({ kind: "openEvent", eventId: "ev_npc" });
    });

    it("더블클릭은 이벤트를 연다", () => {
      expect(resolveLocationOverlapPointer({ ...base, clickCount: LOCATION_OPEN_EVENT_CLICK_COUNT }))
        .toEqual({ kind: "openEvent", eventId: "ev_npc" });
    });
  });
  describe("same-tile click counting", () => {
    const trace = (x: number, y: number, at: number) => ({ mapId: "map_a", x, y, at });

    it("첫 클릭은 1이다", () => {
      expect(locationClickCount(null, trace(4, 5, 1000))).toBe(1);
    });

    it("같은 칸을 창 안에 두 번 누르면 2다", () => {
      expect(locationClickCount(trace(4, 5, 1000), trace(4, 5, 1000 + LOCATION_DOUBLE_CLICK_MS))).toBe(2);
    });

    it("다른 칸이면 다시 1이다", () => {
      expect(locationClickCount(trace(4, 5, 1000), trace(5, 5, 1100))).toBe(1);
    });

    it("창을 넘기면 1로 돌아간다", () => {
      expect(locationClickCount(trace(4, 5, 1000), trace(4, 5, 1001 + LOCATION_DOUBLE_CLICK_MS))).toBe(1);
    });

    it("시계가 뒤로 가도 더블클릭으로 오독하지 않는다", () => {
      expect(locationClickCount(trace(4, 5, 5000), trace(4, 5, 1000))).toBe(1);
    });

    it("다른 맵의 같은 좌표는 다른 클릭이다 — loc1 과 같은 함정", () => {
      expect(locationClickCount({ mapId: "map_a", x: 4, y: 5, at: 1000 }, { mapId: "map_b", x: 4, y: 5, at: 1050 }))
        .toBe(1);
    });
  });
});

describe("openingStillCatalog", () => {
  isolateTimers();
  function ids(kind: DatabaseResourcePickerKind, project: Project): string[] {
    return listDatabaseResourceOptions(kind, project).map(entry => entry.id);
  }
  function withUploads(): Project {
    const project = createBlankProject();
    project.assets.uploaded["backdrop_img_0001"] = {
      id: "backdrop_img_0001", name: "AI 배경화", kind: "backdrop", dataUrl: "data:image/png;base64,AAAA", meta: {},
    };
    project.assets.uploaded["title_img_0001"] = {
      id: "title_img_0001", name: "AI 타이틀", kind: "title", dataUrl: "data:image/png;base64,AAAA", meta: {},
    };
    project.assets.uploaded["picture-upload"] = {
      id: "picture-upload", name: "업로드 그림", kind: "picture", dataUrl: "data:image/png;base64,AAAA", meta: {},
    };
    return project;
  }
  describe("시네마틱 스틸 카탈로그", () => {
    it("전체화면 아트를 아이템 아이콘보다 먼저 제안한다", () => {
      const still = ids("still", createBlankProject());
      expect(still).toContain("oprn-pano-sky-day");
      expect(still).toContain("oprn-still-corridor");
      expect(still.slice(0, 40).filter(id => id.startsWith("cc0-jetrel-"))).toEqual([]);
    });

    it("기존 저장본의 아이콘 참조를 계속 허용한다", () => {
      const project = createBlankProject();
      const legacyIcon = ids("image", project).find(id => id.startsWith("cc0-jetrel-"));
      expect(legacyIcon).toBeTruthy();
      expect(ids("still", project)).toContain(legacyIcon);
    });

    it("아이콘/이미지 카탈로그는 그대로 둔다", () => {
      const project = createBlankProject();
      const image = ids("image", project);
      expect(image.length).toBeGreaterThan(400);
      expect(image).not.toContain("oprn-pano-sky-day");
      expect(image).not.toContain("oprn-still-corridor");
      expect(ids("icon", project)).not.toContain("oprn-pano-sky-day");
    });

    it("AI 생성·업로드 스틸을 아이콘보다 앞에 둔다", () => {
      const still = ids("still", withUploads());
      const firstIcon = still.findIndex(id => id.startsWith("cc0-jetrel-"));
      expect(firstIcon).toBeGreaterThan(0);
      for (const id of ["backdrop_img_0001", "title_img_0001", "picture-upload"]) {
        expect(still).toContain(id);
        expect(still.indexOf(id)).toBeLessThan(firstIcon);
      }
    });

    it("음악·영상 카탈로그를 스틸로 끌어오지 않는다", () => {
      const still = ids("still", withUploads());
      expect(still.some(id => id.startsWith("cc0-bgm-"))).toBe(false);
      expect(still.some(id => id.startsWith("cc0-se-"))).toBe(false);
    });
  });
});

describe("pastePreviewGhost", () => {
  isolateTimers();
  describe("mapClipboardRelief", () => {
    isolateTimers();
    function mapId(): MapId {
      return store.getCurrent().startMapId;
    }
    function currentMap(): GameMap {
      const map = store.getCurrent().maps[mapId()];
      if (!map) throw new Error("missing map");
      return map;
    }
    function levelAt(map: GameMap, x: number, y: number): number {
      return map.relief?.levels[y * map.width + x] ?? 0;
    }
    function rampAt(map: GameMap, x: number, y: number): number {
      return map.relief?.ramps?.[y * map.width + x] ?? 0;
    }
    function putRelief(relief: ReliefData): void {
      store.update((project) => {
        const map = project.maps[mapId()];
        if (map) map.relief = relief;
      });
    }
    beforeEach(() => {
      store.replace(createBlankProject());
      resetMapEditHistory();
      editorState.set({
        currentMapId: null,
        tool: "select",
        layer: "lower",
        selection: null,
        clipboard: null,
      });
    });
    describe("영역 복사/붙여넣기 — 높이", () => {
      it("언덕·경사로·벽 장식을 붙여넣고, 한 번의 되돌리기와 다시 실행으로 돌아온다", () => {
        const id = mapId();
        const map = currentMap();
        const levels = new Array(map.width * map.height).fill(0);
        const ramps = new Array(map.width * map.height).fill(0);
        levels[1 * map.width + 2] = 3;
        ramps[1 * map.width + 2] = 1;
        levels[1 * map.width + 3] = 4;
        putRelief({
          width: map.width,
          height: map.height,
          levels,
          ramps,
          style: "dirt",
          wallDecor: [
            { x: 2, y: 1, row: 1, tile: 7 },
            { x: 0, y: 0, row: 1, tile: 9 },
          ],
        });
        resetMapEditHistory();

        selectTileRegion(id, { mapId: id, x: 2, y: 1, width: 2, height: 1 });
        expect(copySelection(id)).toBe(true);
        expect(pasteClipboard(id, 6, 4)).toBe(true);

        const pasted = currentMap();
        expect(levelAt(pasted, 6, 4)).toBe(3);
        expect(levelAt(pasted, 7, 4)).toBe(4);
        expect(rampAt(pasted, 6, 4)).toBe(1);
        expect(rampAt(pasted, 7, 4)).toBe(0);
        expect(levelAt(pasted, 2, 1)).toBe(3);
        expect(pasted.relief?.style).toBe("dirt");
        expect(pasted.relief?.wallDecor).toEqual(expect.arrayContaining([
          { x: 0, y: 0, row: 1, tile: 9 },
          { x: 6, y: 4, row: 1, tile: 7 },
        ]));
        expect(pasted.relief?.wallDecor?.some((decor) => decor.x === 2 && decor.y === 1)).toBe(true);

        expect(undoMapEdit()).toBe(true);
        const undone = currentMap();
        expect(levelAt(undone, 6, 4)).toBe(0);
        expect(rampAt(undone, 6, 4)).toBe(0);
        expect(undone.relief?.wallDecor?.some((decor) => decor.x === 6 && decor.y === 4)).toBe(false);
        expect(levelAt(undone, 2, 1)).toBe(3);

        expect(redoMapEdit()).toBe(true);
        expect(levelAt(currentMap(), 6, 4)).toBe(3);
        expect(rampAt(currentMap(), 6, 4)).toBe(1);
      });

      it("평지를 붙이거나 영역을 지우면 그 칸의 언덕만 내리고, 맵이 평지가 되면 relief 를 뺀다", () => {
        const id = mapId();
        const map = currentMap();
        const levels = new Array(map.width * map.height).fill(0);
        levels[5 * map.width + 5] = 2;
        levels[5 * map.width + 6] = 2;
        putRelief({ width: map.width, height: map.height, levels, wallDecor: [{ x: 5, y: 5, row: 1, tile: 4 }] });
        resetMapEditHistory();

        selectTileRegion(id, { mapId: id, x: 0, y: 0, width: 1, height: 1 });
        expect(copySelection(id)).toBe(true);
        expect(editorState.get().clipboard?.relief?.levels).toEqual([0]);
        expect(pasteClipboard(id, 5, 5)).toBe(true);

        const flattened = currentMap();
        expect(levelAt(flattened, 5, 5)).toBe(0);
        expect(levelAt(flattened, 6, 5)).toBe(2);
        expect(flattened.relief?.wallDecor?.some((decor) => decor.x === 5) ?? false).toBe(false);

        selectTileRegion(id, { mapId: id, x: 6, y: 5, width: 1, height: 1 });
        expect(clearSelectionRegion(id)).toBe(true);
        expect(currentMap().relief).toBeUndefined();
      });

      it("높이가 없는 옛 클립보드는 목적지 언덕을 그대로 둔다", () => {
        const id = mapId();
        const map = currentMap();
        const levels = new Array(map.width * map.height).fill(0);
        levels[4 * map.width + 4] = 2;
        putRelief({ width: map.width, height: map.height, levels });
        const legacy: TileClipboard = {
          width: 1,
          height: 1,
          lower: { tiles: [map.lowerTiles[0] ?? 0], stacks: [[]] },
          upper: { tiles: [-1], stacks: [[]] },
        };
        editorState.set({ clipboard: legacy });
        expect(pasteClipboard(id, 4, 4)).toBe(true);
        expect(levelAt(currentMap(), 4, 4)).toBe(2);
      });

      it("붙여넣기 고스트는 스탬프 높이로 들리고, 평지 스탬프는 땅바닥에 둔다", () => {
        const raised: TileClipboard = {
          width: 3,
          height: 3,
          lower: { tiles: Array(9).fill(1), stacks: Array.from({ length: 9 }, () => []) },
          upper: { tiles: Array(9).fill(-1), stacks: Array.from({ length: 9 }, () => []) },
          relief: { levels: Array(9).fill(3) },
        };
        const field = pasteStampLiftField(raised);
        expect(field).not.toBeNull();
        // 렌더가 그리는 들림이다. 한 줄짜리 능선은 깎여 0이 되므로, 살아남는 고원의 가운데를 본다.
        expect(pasteGhostLiftSteps(field, 1, 1)).toBe(3);
        expect(pasteStampLiftField(raised)).toBe(field);

        const flat: TileClipboard = {
          width: 1,
          height: 1,
          lower: { tiles: [1], stacks: [[]] },
          upper: { tiles: [-1], stacks: [[]] },
          relief: { levels: [0] },
        };
        expect(pasteStampLiftField(flat)).toBeNull();
        expect(pasteGhostLiftSteps(null, 0, 0)).toBe(0);

        const legacy: TileClipboard = {
          width: 1,
          height: 1,
          lower: { tiles: [1], stacks: [[]] },
          upper: { tiles: [-1], stacks: [[]] },
        };
        expect(pasteStampLiftField(legacy)).toBeNull();
      });
    });
  });
  describe("pastePreviewGhost", () => {
    isolateTimers();
    function clipboard(patch: Partial<TileClipboard> = {}): TileClipboard {
      return {
        width: 1,
        height: 1,
        lower: { tiles: [-1], stacks: [[]] },
        upper: { tiles: [-1], stacks: [[]] },
        ...patch,
      };
    }
    describe("paste preview ghost pieces", () => {
      it("draws layer 1, its stack, layer 2, shadow, layer 3, its stack, then layer 4", () => {
        const pieces = pasteGhostPieces(clipboard({
          lower: { tiles: [10], stacks: [[11, 12]], overlay: [20] },
          upper: { tiles: [30], stacks: [[31]], overlay: [40] },
          shadow: [0b0101],
        }), 0);
        expect(pieces).toEqual([
          { draw: "composed", tile: 10, alpha: 0.4 },
          { draw: "composed", tile: 11, alpha: 0.4 },
          { draw: "composed", tile: 12, alpha: 0.4 },
          { draw: "raw", tile: 20, alpha: 0.4 },
          { draw: "shadow", bits: 0b0101, alpha: 0.2 },
          { draw: "composed", tile: 30, alpha: 0.55 },
          { draw: "composed", tile: 31, alpha: 0.55 },
          { draw: "raw", tile: 40, alpha: 0.55 },
        ]);
      });

      it("skips empty cells and clipsboards that only stored layers 1 and 3", () => {
        expect(pasteGhostPieces(clipboard(), 0)).toEqual([]);
        expect(pasteGhostPieces(clipboard({
          lower: { tiles: [3], stacks: [[]] },
          upper: { tiles: [-1], stacks: [[]] },
        }), 0)).toEqual([{ draw: "composed", tile: 3, alpha: 0.4 }]);
      });

      it("masks shadow bits to the four quarters the map stores", () => {
        const pieces = pasteGhostPieces(clipboard({ shadow: [0b1111_0001] }), 0);
        expect(pieces).toEqual([{ draw: "shadow", bits: 0b0001, alpha: 0.2 }]);
      });
    });
  });
});

describe("propRecommendations", () => {
  isolateTimers();
  function fixture() {
    const tileset: TilesetDef = { id: "props", name: "Props", image: { type: "uploaded", id: "props-image" }, kind: "custom", tileSize: 32, tilesPerRow: 4, count: 8,
      passability: Array(8).fill("o"), priority: Array(8).fill("upper"), terrain: Array(8).fill(0),
      structureKits: [
        { id: "chair-red", kind: "section", name: "붉은 의자", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [1] }], ai: { description: "의자", placementRules: "", tags: ["의자"] } },
        { id: "chair-blue", kind: "section", name: "푸른 의자", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [2] }], ai: { description: "의자", placementRules: "", tags: ["의자"] } },
        { id: "statue", kind: "section", name: "광장 석상", width: 1, height: 2, rows: [{ tiles: [-1], upperTiles: [3] }, { tiles: [-1], upperTiles: [4] }] },
        { id: "broken", kind: "section", name: "손상된 기물", width: 1, height: 1, rows: [{ tiles: [8] }] },
        { id: "wrong-size", kind: "section", name: "16px 기물", tileSize: 16, width: 1, height: 1, rows: [{ tiles: [2] }] },
      ] };
    const map = { id: "map", name: "광장", tilesetId: tileset.id, tileSize: 32, width: 10, height: 10, locations: [] } as unknown as GameMap;
    return { map, tileset };
  }
  describe("map prop recommendations", () => {
    it("uses valid native cells from the map's own chipset and ranks place matches first", () => {
      const { map, tileset } = fixture();
      const entries = recommendProps(map, tileset);
      expect(entries.map(entry => entry.choice.id)).toEqual(["statue", "chair-red", "chair-blue"]);
      expect(entries[0]!.choice.stamp).toMatchObject({ width: 1, height: 2, source: { tilesetId: "props", tileSize: 32 }, cells: [{ dx: 0, dy: 0, layer: "upper", tile: 3 }, { dx: 0, dy: 1, layer: "upper", tile: 4 }] });
      expect(propsForTileset(tileset)).toBe(propsForTileset(tileset));
    });
    it("keeps color variants from filling the first recommendations", () => {
      const { map, tileset } = fixture();
      map.name = "새 맵";
      expect(recommendProps(map, tileset).map(entry => entry.choice.id)).toEqual(["chair-red", "statue", "chair-blue"]);
    });
    it("refuses foreign chipsets, mismatched tile sizes, and objects too large for the map", () => {
      const { map, tileset } = fixture();
      expect(recommendProps({ ...map, tilesetId: "other" }, tileset)).toEqual([]);
      expect(recommendProps({ ...map, tileSize: 16 }, tileset)).toEqual([]);
      expect(recommendProps({ ...map, height: 1 }, tileset).map(entry => entry.choice.id)).toEqual(["chair-red", "chair-blue"]);
    });
    it("groups objects by type and searches the whole catalog before paging", () => {
      const { map, tileset } = fixture();
      tileset.structureKits!.push(...Array.from({ length: 8 }, (_, index) => ({
        id: `workbench-${index}`, kind: "section" as const, name: `작업대 ${index}`, width: 1, height: 1, rows: [{ tiles: [5] }],
        ai: { description: "대장간 제작", placementRules: "", tags: ["대장간"] },
      })));
      const entries = recommendProps(map, tileset);
      expect(filterProps(entries, "seating", "").map(entry => entry.choice.id)).toEqual(["chair-red", "chair-blue"]);
      expect(filterProps(entries, "tables", "대장간 작업대 7").map(entry => entry.choice.id)).toEqual(["workbench-7"]);
      expect(entries.slice(0, 6).some(entry => entry.choice.id === "workbench-7")).toBe(false);
      expect(filterProps(entries, undefined, "작업대 7").map(entry => entry.choice.id)).toEqual(["workbench-7"]);
      expect(filterProps(entries, "beds", "의자")).toEqual([]);
    });
    it("keeps pedestals out of beds and uses the object name before ambiguous ids", () => {
      const { tileset } = fixture();
      tileset.structureKits!.push(
        { id: "key-pedestal", kind: "section", name: "열쇠 받침대", width: 1, height: 1, rows: [{ tiles: [5] }], ai: { description: "", placementRules: "", tags: ["JRPG 장치"] } },
        { id: "flower-bed", kind: "section", name: "꽃 화분", width: 1, height: 1, rows: [{ tiles: [6] }] },
      );
      const choices = propsForTileset(tileset);
      expect(choices.find(choice => choice.id === "key-pedestal")?.category).toBe("devices");
      expect(choices.find(choice => choice.id === "flower-bed")?.category).toBe("plants");
    });

    it("groups bundled props by manifest order and searches catalog fields across groups", () => {
      const { map, tileset } = fixture();
      for (const id of ["anchor_decor", "bed_double", "birch_tree"]) {
        tileset.structureKits!.push({
          id: `bd-object:${id}`, kind: "section", name: "이전 저장 이름", width: 1, height: 1,
          rows: [{ tiles: [-1], upperTiles: [7] }],
          ai: { description: "", placementRules: "", tags: ["이전 저장 태그"] },
        });
      }
      const entries = recommendProps(map, tileset);
      const { groups, ungrouped } = groupProps(entries);
      expect(groups.map(({ group, entries }) => [group.id, entries.map(({ choice }) => choice.name)])).toEqual([
        ["nature", ["자작나무"]], ["indoor", ["더블 침대"]], ["harbor", ["닻 장식"]],
      ]);
      expect(ungrouped.map(({ choice }) => choice.id)).toEqual(["statue", "chair-red", "chair-blue"]);
      expect(filterProps(entries, undefined, "자작").map(({ choice }) => choice.id)).toEqual(["bd-object:birch_tree"]);
      expect(filterProps(entries, undefined, "OR_DEC").map(({ choice }) => choice.id)).toEqual(["bd-object:anchor_decor"]);
      expect(filterProps(entries, undefined, "ARBO").map(({ choice }) => choice.id)).toEqual(["bd-object:anchor_decor"]);
      expect(filterProps(entries, undefined, "닻 항구")).toEqual([]);
      expect(groupProps(filterProps(entries, undefined, "버들항 기본 기물")).groups.map(({ group }) => group.id))
        .toEqual(["nature", "indoor", "harbor"]);
      expect(groupProps(filterProps(entries, undefined, "이전 저장 태그"))).toEqual({ groups: [], ungrouped: [] });
    });
  });
});
