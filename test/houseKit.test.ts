import { describe, expect, it } from "vitest";
import { HOUSE_DOOR_CHARSET_TEXTURE, HOUSE_DOOR_FRAME_WAIT_MS, HOUSE_DOOR_OPEN_SE, houseDoorFrameIndex, createHouseInteriorMap, resolveHouseInteriorScale } from "@/editor/houseInteriors";
import { seCatalogResourceIds } from "@/assets/seCatalogRuntime";
import { VR } from "@/editor/interiorRoomPipeline";
import { rectHouseHeight, stampFootprintHouseKit, stampRectHouseKit } from "@/editor/houseKit";
import { INTERIOR_ROOM_TILESET_ID as INTERIOR_HOUSE_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import type { GameMap, MapTreeNode } from "@/project/types";

// 하네싱 골든 테스트 — 키트 전개 결과가 사용자 기준 집(fable-village 연습04)의
// 실데이터와 "셀 단위로" 일치해야 한다. 정본: docs/knowledge/images/2026-07-08-house-harness-design.png
const E = TILE.EMPTY;
const G = 270; // 풀

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

    expect(map.upperTiles[6 * map.width + 3]).toBe(87);
    expect(map.upperTiles[6 * map.width + 9]).toBe(87);
    for (const x of [5, 6, 7]) expect(map.upperTiles[6 * map.width + x]).toBe(E);
  });

  it("다층 직사각 집은 층마다 한 줄만 창문을 배치해 층 사이를 분리한다", () => {
    const map = freshMap();
    const result = stampRectHouseKit(map, { x: 2, y: 2, width: 10, stories: 2, roofBodyRows: 1, kitId: "blue-stone" });
    expect(result.ok, result.reason).toBe(true);

    for (const y of [6, 8]) {
      expect(map.upperTiles[y * map.width + 3], `window left y=${y}`).toBe(87);
      expect(map.upperTiles[y * map.width + 9], `window right y=${y}`).toBe(87);
      for (const x of [6, 7, 8]) expect(map.upperTiles[y * map.width + x], `door skip (${x},${y})`).toBe(E);
    }
    for (const x of [3, 9]) expect(map.upperTiles[7 * map.width + x], `floor separator x=${x}`).toBe(E);
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
    map.upperTiles[6 * map.width + 3] = 260;
    const result = stampRectHouseKit(map, { x: 2, y: 2, width: 10, stories: 1, roofBodyRows: 1, kitId: "blue-stone" });
    expect(result.ok, result.reason).toBe(true);
    expect(map.upperTiles[6 * map.width + 3]).toBe(260);
    expect(map.upperTiles[6 * map.width + 9]).toBe(87);
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

describe("build_house_kit AI 툴", () => {
  it("에이전트 채팅 경로(runTool)로 하네싱 집을 짓는다", async () => {
    const { runTool } = await import("@/editor/tools");
    const project = createBlankProject();
    const ctx = { project };
    const mapId = project.startMapId;
    project.maps[mapId].lowerTiles.fill(G);
    const result = runTool(ctx, "build_house_kit", {
      mapId,
      kitId: "blue-stone",
      wings: [{ x: 2, y: 2, w: 6, h: 6 }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.summary).toContain("집 키트");
    const map = ctx.project.maps[mapId];
    expect(map.lowerTiles[3 * map.width + 7]).toBe(407); // 몸통행 우측 끝
    expect(map.upperTiles[2 * map.width + 2]).toBe(356); // NW 대각
    expect(map.upperTiles[6 * map.width + 6]).toBe(87); // 기본 창문
    // 문 외형은 이벤트 스프라이트가 담당한다 — 문 칸에 문 타일(116/146)을 겹쳐 깔지 않는다.
    expect(map.lowerTiles[7 * map.width + 4]).not.toBe(146);
    expect(map.lowerTiles[6 * map.width + 4]).not.toBe(116);
    expect(map.lowerTiles[7 * map.width + 4]).not.toBe(TILE.EMPTY); // 벽은 남아 구멍이 아니다
    const data = result.data as { interiorMapId: string; doorEventId: string; exitEventId: string };
    expect(data.interiorMapId).toMatch(/^map_house_interior_/);
    expect(data.doorEventId).toMatch(/^ev_house_door_/);
    const interior = ctx.project.maps[data.interiorMapId];
    expect(interior.tilesetId).toBe(INTERIOR_HOUSE_TILESET_ID);
    expect(interior.width).toBe(20);
    expect(interior.height).toBe(20); // 천장 정본 v2: +1행(벽 위 천장) + 수평 벽 3행 갭
    expect(treeContains(ctx.project.mapTree, data.interiorMapId)).toBe(true);
    const door = map.events.find((event) => event.id === data.doorEventId);
    const entry = (result.data as { entry?: { x: number; y: number }; exit?: { x: number; y: number } }).entry
      ?? { x: 10, y: 15 };
    const exitPt = (result.data as { exit?: { x: number; y: number } }).exit ?? { x: 10, y: 16 };
    expect(door?.pages?.[0]?.commands.at(-1)).toMatchObject({ kind: "transfer", mapId: data.interiorMapId, x: entry.x, y: entry.y });
    const exit = interior.events.find((event) => event.id === data.exitEventId);
    expect(exit?.x).toBe(exitPt.x);
    expect(exit?.y).toBe(exitPt.y);
    expect(exit?.pages?.[0]?.trigger.kind).toBe("playerTouch");
    expect(exit?.pages?.[0]?.commands.map((command) => command.kind)).toEqual(["playAudio", "transfer"]);
    expect(exit?.pages?.[0]?.commands[0]).toMatchObject({ kind: "playAudio", loop: false });
    expect(exit?.pages?.[0]?.commands[1]).toEqual({ kind: "transfer", mapId, x: 4, y: 8, fade: "black" });
  });

  it("windows:false 인자로 창문 자동 배치를 끈다", async () => {
    const { runTool } = await import("@/editor/tools");
    const project = createBlankProject();
    const ctx = { project };
    const mapId = project.startMapId;
    project.maps[mapId].lowerTiles.fill(G);
    const result = runTool(ctx, "build_house_kit", {
      mapId,
      kitId: "bright-plaster",
      windows: false,
      wings: [{ x: 2, y: 2, w: 10, h: 6 }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(countUpper(ctx.project.maps[mapId], 85)).toBe(0);
  });

  it("알 수 없는 키트는 학습되지 않은 재질로 거부한다", async () => {
    const { runTool } = await import("@/editor/tools");
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "build_house_kit", {
      mapId: ctx.project.startMapId,
      kitId: "thatched",
      wings: [{ x: 2, y: 2, w: 6, h: 6 }],
    });
    expect(result.ok).toBe(false);
  });

  it("interior:false는 내부 맵과 문 이벤트를 만들지 않는다", async () => {
    const { runTool } = await import("@/editor/tools");
    const project = createBlankProject();
    const ctx = { project };
    const mapId = project.startMapId;
    const beforeMapCount = Object.keys(project.maps).length;
    const result = runTool(ctx, "build_house_kit", {
      mapId,
      kitId: "blue-stone",
      interior: false,
      wings: [{ x: 2, y: 2, w: 6, h: 6 }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(Object.keys(ctx.project.maps)).toHaveLength(beforeMapCount);
    expect(result.data).not.toHaveProperty("interiorMapId");
    expect(ctx.project.maps[mapId].events.some((event) => event.id.startsWith("ev_house_door_"))).toBe(false);
  });

  it("문 앞 침엽수는 지면으로 정리하고 내부 복귀 transfer를 통행 가능하게 유지한다", async () => {
    const { runTool } = await import("@/editor/tools");
    const project = createBlankProject();
    const mapId = "map_mist_forest";
    const map = createBlankMap("안개 숲", 32, 30);
    map.id = mapId;
    map.lowerTiles.fill(G);
    map.upperTiles.fill(E);
    project.maps = { [mapId]: map };
    project.startMapId = mapId;
    project.startPos = { x: 1, y: 1 };
    project.mapTree = { mapId, children: [] };
    const front = { x: 20, y: 22 };
    map.lowerTiles[front.y * map.width + front.x] = 290;
    map.upperTiles[front.y * map.width + front.x] = 260;
    const ctx = { project };

    const result = runTool(ctx, "build_house_kit", {
      mapId,
      kitId: "blue-stone",
      wings: [{ x: 18, y: 15, w: 6, h: 7 }],
    });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const built = ctx.project.maps[mapId];
    expect((result.data as { doorAt: { x: number; y: number } }).doorAt).toEqual({ x: 20, y: 21 });
    expect(built.lowerTiles[front.y * built.width + front.x]).toBe(G);
    expect(built.upperTiles[front.y * built.width + front.x]).toBe(E);
    expect(result.diff?.warnings).toContain("문 앞 (20,22) 통행 확보 — 지면으로 정리");
    expect(projectLint(ctx.project).some((issue) => issue.code === "transfer-impassable")).toBe(false);
  });

  it("문 앞이 맵 밖이면 남쪽 여유 안내와 함께 실패한다", async () => {
    const { runTool } = await import("@/editor/tools");
    const project = createBlankProject();
    const result = runTool({ project }, "build_house_kit", {
      mapId: project.startMapId,
      kitId: "blue-stone",
      wings: [{ x: 2, y: 9, w: 6, h: 6 }],
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]).toMatchObject({ code: "house-door-front-out-of-bounds", message: "문 앞이 맵 밖입니다 — 남쪽에 여유를 두세요" });
  });
});

function treeContains(node: MapTreeNode, mapId: string): boolean {
  return node.mapId === mapId || node.children.some((child) => treeContains(child, mapId));
}


describe("house interior — L cottage (reference plan)", () => {
  it("1층 dwelling/manor resolves to cottage-l with kitchen·bedroom·living rooms", () => {
    expect(resolveHouseInteriorScale({ stories: 1, program: "dwelling" }, 1)).toBe("cottage-l");
    expect(resolveHouseInteriorScale({ stories: 1, program: "manor", ownerName: "촌장 로안" }, 1)).toBe("cottage-l");
    expect(resolveHouseInteriorScale({ stories: 2, program: "manor" }, 1)).toBe("mansion");
    // exterior templateId "l" alone does NOT select cottage-l (only cottage-l|l-cottage aliases)
    expect(resolveHouseInteriorScale({ stories: 1, templateId: "l" }, 1)).not.toBe("mansion");

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
    expect(result.map.width).toBe(20);
    expect(result.map.height).toBe(20); // 천장 정본 v2: +1행(벽 위 천장) + 수평 벽 3행 갭
    const upper = result.map.upperTiles;
    const lower = result.map.lowerTiles;
    const at = (x: number, y: number) => lower[y * result.map.width + x]!;
    // room floor samples (rugs may cover some wood cells — accept floor material set)
    const floorMats = new Set([12, 13, 42, 43, 72, 73, 102, 103, 139, 279, 280, 281, 309, 310, 311, 339, 340, 341, 108, 109, 110, 138, 139, 140, 168, 169, 170]);
    expect(at(3, 3)).toBe(12); // kitchen stone
    expect(floorMats.has(at(13, 4))).toBe(true); // bedroom interior cell
    expect(floorMats.has(at(5, 11))).toBe(true); // living interior cell
    // SE region under bedroom (outside living w=12 → x>=14) has no walk floor materials
    const seFloorMats = new Set([12, 13, 42, 43, 72, 73, 102, 103, 139]);
    let seFloor = 0;
    for (let y = 8; y <= 13; y += 1) {
      for (let x = 14; x <= 19; x += 1) {
        if (seFloorMats.has(at(x, y))) seFloor += 1;
      }
    }
    expect(seFloor).toBe(0);
    expect(upper.some((t) => t === VR.STOVE_TOP)).toBe(true);
    expect(lower.some((t) => t === VR.STOVE_BOT)).toBe(true);
    expect(upper.some((t) => t === VR.BED_L || t === VR.BED_V_HEAD)).toBe(true);
    expect(upper.some((t) => t === VR.TABLE_L || t === VR.SQUARE_TABLE)).toBe(true);
  });
});

