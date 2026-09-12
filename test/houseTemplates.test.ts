import { describe, expect, it } from "vitest";
import { stampFootprintHouseKit, stampRectHouseKit, MIXABLE_HOUSE_KIT_IDS, ALL_HOUSE_KIT_IDS } from "@/editor/houseKit";
import { createBlankMap, TILE } from "@/project/defaults";
import { HOUSE_TEMPLATES } from "@/editor/tools/village/constants";
import { applyRoofDeck } from "@/editor/tools/village/houses";
import { roadComponentNotes } from "@/editor/tools/village/audit";
import type { GameMap } from "@/project/types";

// 형태 카탈로그(2026-07-17, 30종+) 계약 테스트 — 모든 템플릿이 실제로 시공 가능해야 하고,
// 신규 지오메트리(계단식 2층·낮은 벽·옥상 데크·estate 분리 헛간)가 규약대로 전개돼야 한다.

const E = TILE.EMPTY;
const G = 270; // 풀

function freshMap(width = 40, height = 40): GameMap {
  const map = createBlankMap("템플릿 검증", width, height);
  map.lowerTiles.fill(G);
  map.upperTiles.fill(E);
  return map;
}

function upperAt(map: GameMap, x: number, y: number): number {
  return map.upperTiles[y * map.width + x] ?? E;
}

function lowerAt(map: GameMap, x: number, y: number): number {
  return map.lowerTiles[y * map.width + x] ?? E;
}

describe("집 형태 카탈로그", () => {
  it("템플릿은 30종 이상이고 id가 유일하다", () => {
    expect(HOUSE_TEMPLATES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(HOUSE_TEMPLATES.map((template) => template.id)).size).toBe(HOUSE_TEMPLATES.length);
  });

  it("모든 템플릿이 빈 맵에 시공 성공한다 (열 구간 최소 높이 규약 위반 없음)", () => {
    for (const template of HOUSE_TEMPLATES) {
      const map = freshMap();
      const result = stampFootprintHouseKit(map, {
        kitId: template.kitId ?? "bright-plaster",
        stories: template.stories ?? 1,
        ...(template.lowWall ? { lowWall: true } : {}),
        wings: template.wingsAt(4, 4),
        windows: false,
      });
      expect(result.ok, `${template.id}: ${result.reason ?? ""}`).toBe(true);
      expect(result.doorAt, template.id).toBeDefined();
      // 문은 템플릿 bbox 최하단 행(외부에 면한 벽 하단)에 있어야 한다.
      expect(result.doorAt!.y, template.id).toBe(4 + template.h - 1);
    }
  });

  it("모든 템플릿의 날개가 선언된 w×h 바운딩 박스 안에 있다", () => {
    for (const template of HOUSE_TEMPLATES) {
      for (const wing of template.wingsAt(0, 0)) {
        expect(wing.x >= 0 && wing.y >= 0, template.id).toBe(true);
        expect(wing.x + wing.w <= template.w, `${template.id} 날개 폭 초과`).toBe(true);
        expect(wing.y + wing.h <= template.h, `${template.id} 날개 높이 초과`).toBe(true);
      }
    }
  });

  it("모든 공개 킷이 랜덤 믹스 목록에 들어 있다 (지오메트리 종속 킷 없음)", () => {
    // 2026-09-11: A자(피라미드) 킷 삭제로 ALL 과 MIXABLE 이 같아졌다.
    expect(MIXABLE_HOUSE_KIT_IDS).toEqual(ALL_HOUSE_KIT_IDS);
  });
});

describe("계단식 2층 (날개별 층수)", () => {
  it("2층 본채 앞 1층 날개가 붙어도 시공된다", () => {
    const map = freshMap();
    const result = stampFootprintHouseKit(map, {
      kitId: "blue-stone",
      wings: [
        { x: 4, y: 4, w: 5, h: 12, stories: 2 },
        { x: 3, y: 10, w: 7, h: 6, stories: 1 },
      ],
      windows: false,
    });
    expect(result.ok, result.reason).toBe(true);
    // 좌우로 넓어진 1층 날개가 본채보다 아래까지 내려와 "위층이 드러나는" 실루엣을 만든다.
    expect(lowerAt(map, 3, 15)).not.toBe(G);
    expect(lowerAt(map, 3, 4)).toBe(G); // 2층 본채 위쪽 바깥은 잔디
  });

  it("날개 층수를 선언하지 않으면 계획 층수를 쓴다", () => {
    const map = freshMap();
    const result = stampFootprintHouseKit(map, {
      kitId: "blue-stone",
      stories: 2,
      wings: [{ x: 4, y: 4, w: 6, h: 9 }],
      windows: false,
    });
    expect(result.ok, result.reason).toBe(true);
  });

  it("1층 날개 높이가 1층 최소치보다 낮으면 이유를 밝히고 거부한다", () => {
    const map = freshMap();
    const result = stampFootprintHouseKit(map, {
      kitId: "blue-stone",
      wings: [
        { x: 4, y: 4, w: 5, h: 12, stories: 2 },
        { x: 3, y: 10, w: 7, h: 4, stories: 1 },
      ],
      windows: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("최소");
  });

  // 2026-09-11 사용자 실측: 층수가 다른 두 날개가 가로로 맞닿으면, 왼쪽 날개의 윗층
  // 벽(중단 행)과 오른쪽 날개의 아래 벽(상단 행)이 같은 행에서 만나 역할이 같아진다.
  // 역할 연속으로 런을 재면 좌측 끝 타일이 오른쪽 덩어리의 왼쪽 모서리에 붙는다.
  it("층이 다른 두 날개가 맞닿아도 각 덩어리가 자기 좌우 모서리로 마감된다", () => {
    const map = freshMap();
    const result = stampFootprintHouseKit(map, {
      kitId: "bright-plaster",
      windows: false,
      wings: [
        { x: 3, y: 3, w: 5, h: 12, stories: 2 }, // 왼쪽 2층 본채 (x3..7)
        { x: 8, y: 6, w: 4, h: 9, stories: 1 },  // 오른쪽 1층 날개 (x8..11)
      ],
    });
    expect(result.ok, result.reason).toBe(true);
    // 벽 밴드가 실제로 겹치는 행 y=12: 왼쪽은 2층 중단 행, 오른쪽은 1층 상단 행.
    // 왼쪽 덩어리는 좌 모서리(42)로 시작해 우 모서리(44)로 끝나고,
    // 오른쪽 덩어리는 좌 모서리(12)로 시작해 우 모서리(14)로 끝나야 한다.
    const rowAt = (y: number, x0: number, x1: number): number[] =>
      Array.from({ length: x1 - x0 + 1 }, (_, i) => lowerAt(map, x0 + i, y));
    expect(rowAt(12, 2, 12)).toEqual([G, 42, 43, 43, 43, 44, 12, 13, 13, 14, G]);
    // 아래 행은 두 덩어리가 같은 역할(하단)이어도 각자 좌우 모서리로 마감된다.
    expect(rowAt(14, 2, 12)).toEqual([G, 72, 73, 73, 73, 74, 72, 73, 73, 74, G]);
  });
});

describe("낮은 벽 (lowWall)", () => {
  it("벽 밴드가 상단+하단 2행뿐이고 창이 없다", () => {
    const map = freshMap();
    const result = stampFootprintHouseKit(map, {
      kitId: "bright-plaster",
      stories: 1,
      lowWall: true,
      wings: [{ x: 4, y: 4, w: 6, h: 5 }],
      windows: { spacing: 1 },
    });
    expect(result.ok, result.reason).toBe(true);
    // 벽 = y7(상단)·y8(하단)만: 지붕 3행(y4..y6) + 벽 2행.
    expect(lowerAt(map, 4, 7)).toBe(12);
    expect(lowerAt(map, 4, 8)).toBe(72);
    expect(map.upperTiles.filter((tile) => tile === 85).length).toBe(0); // 창 없음
    expect(result.doorAt).toEqual({ x: 6, y: 8 });
  });
});

describe("estate — 울타리 필지 안 본채+헛간", () => {
  it("본채와 분리 헛간이 각각 완결된 건물로 서고 문은 본채에 난다", () => {
    const template = HOUSE_TEMPLATES.find((entry) => entry.id === "estate-shed-r")!;
    const map = freshMap();
    const result = stampFootprintHouseKit(map, {
      kitId: "bright-plaster",
      stories: 1,
      wings: template.wingsAt(4, 4),
      windows: false,
    });
    expect(result.ok, result.reason).toBe(true);
    // 헛간(x7..x10, y4..y8): 벽 하단 y8, 처마 y5.
    expect(lowerAt(map, 7, 8)).toBe(72);
    expect(lowerAt(map, 7, 5)).toBe(405);
    // 본채(x4..x10, y11..y17): 문은 본채 하단(y17).
    expect(result.doorAt!.y).toBe(17);
    // 사이 마당: y9는 잔디, y10은 본채 용마루 줄(374 하위 — 2026-07-17 교정).
    expect(lowerAt(map, 6, 9)).toBe(G);
    expect(lowerAt(map, 6, 10)).toBe(374);
  });
});

describe("옥상 데크 (rooftop-deck)", () => {
  function stampDeckHouse(map: GameMap): { doorAt: { x: number; y: number } } {
    const template = HOUSE_TEMPLATES.find((entry) => entry.id === "rooftop-deck")!;
    const result = stampFootprintHouseKit(map, {
      kitId: "blue-stone",
      stories: 1,
      wings: template.wingsAt(4, 4),
      windows: false,
    });
    expect(result.ok, result.reason).toBe(true);
    applyRoofDeck(map, { x: 4, y: 4, w: template.w, h: template.h }, result.doorAt!);
    return { doorAt: result.doorAt! };
  }

  it("지붕 몸통 안쪽에 판자(199), 벽면에 사다리(322) 기둥이 놓인다", () => {
    const map = freshMap();
    stampDeckHouse(map);
    // bbox(4,4,7,8): 처마 y8, 데크 행 y5..y7, 데크 열 x5..x8.
    expect(upperAt(map, 5, 5)).toBe(199);
    expect(upperAt(map, 8, 7)).toBe(199);
    expect(upperAt(map, 4, 6)).toBe(E); // 좌측 테두리 열은 지붕 그대로
    // 사다리 열(x8): 처마(y8)→벽(y9..y11)→지면(y12).
    for (let y = 8; y <= 12; y += 1) expect(upperAt(map, 8, y)).toBe(322);
  });

  it("옥상 판자는 도로 성분으로 집계되지 않는다 (다리 판정은 하위=물일 때만)", () => {
    const map = freshMap();
    stampDeckHouse(map);
    const notes = roadComponentNotes(map, { x: 0, y: 0, w: map.width, h: map.height });
    expect(notes).toEqual([]);
  });
});
