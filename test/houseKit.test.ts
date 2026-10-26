import { describe, expect, it } from "vitest";
import { HOUSE_DOOR_CHARSET_TEXTURE, HOUSE_DOOR_FRAME_WAIT_MS, HOUSE_DOOR_OPEN_SE, houseDoorFrameIndex, createHouseInteriorMap, resolveHouseInteriorProgram, resolveHouseInteriorScale, wallMaterialForKit } from "@/editor/houseInteriors";
import { seCatalogResourceIds } from "@/assets/seCatalogRuntime";
import { VR } from "@/editor/interiorRoomPipeline";
import { rectHouseHeight, stampFootprintHouseKit, stampRectHouseKit } from "@/editor/houseKit";
import { createBlankProject, TILE } from "@/project/defaults";
import type { GameMap } from "@/project/types";

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
