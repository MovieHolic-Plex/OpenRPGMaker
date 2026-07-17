import { describe, expect, it } from "vitest";
import { stampFootprintHouseKit, stampRectHouseKit, MIXABLE_HOUSE_KIT_IDS, ALL_HOUSE_KIT_IDS } from "@/editor/houseKit";
import { createBlankMap, TILE } from "@/project/defaults";
import { HOUSE_TEMPLATES } from "@/editor/tools/village/constants";
import { applyRoofDeck } from "@/editor/tools/village/houses";
import { roadComponentNotes } from "@/editor/tools/village/audit";
import type { GameMap } from "@/project/types";

// 형태 카탈로그(2026-07-17, 30종+) 계약 테스트 — 모든 템플릿이 실제로 시공 가능해야 하고,
// 신규 지오메트리(A자 피라미드·낮은 벽·옥상 데크·estate 분리 헛간)가 규약대로 전개돼야 한다.

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

  it("aframe-stone은 랜덤 믹스 목록에 없다 (지오메트리 종속 킷)", () => {
    expect(ALL_HOUSE_KIT_IDS).toContain("aframe-stone");
    expect(MIXABLE_HOUSE_KIT_IDS).not.toContain("aframe-stone");
  });
});

describe("A자 지붕 (aframe-stone)", () => {
  it("홀수 폭 7: 꼭짓점 374 + 행마다 좁아지는 사선 캡 354/355 + 처마 405", () => {
    const map = freshMap();
    const result = stampFootprintHouseKit(map, {
      kitId: "aframe-stone",
      stories: 1,
      wings: [{ x: 4, y: 4, w: 7, h: 7 }],
      windows: false,
    });
    expect(result.ok, result.reason).toBe(true);
    // 피라미드 3행 + 처마(y=7) + 벽 3행(y=8..10).
    expect(upperAt(map, 7, 4)).toBe(374); // 꼭짓점(중앙 x=7)
    expect(upperAt(map, 6, 5)).toBe(354); // 사선 캡 좌
    expect(upperAt(map, 8, 5)).toBe(355); // 사선 캡 우
    expect(upperAt(map, 5, 6)).toBe(354);
    expect(upperAt(map, 9, 6)).toBe(355);
    expect(lowerAt(map, 7, 6)).toBe(404); // 내부 채움
    expect(lowerAt(map, 4, 6)).toBe(G); // 사선 바깥은 잔디 그대로 (삼각 실루엣)
    expect(lowerAt(map, 4, 7)).toBe(405); // 처마는 벽 전체 폭
    expect(lowerAt(map, 10, 7)).toBe(405);
    expect(lowerAt(map, 4, 8)).toBe(12); // 석벽 상단 좌
    expect(result.doorAt).toEqual({ x: 7, y: 10 });
  });

  it("짝수 폭 8: 꼭짓점은 사선 캡 쌍(354+355)", () => {
    const map = freshMap();
    const result = stampFootprintHouseKit(map, {
      kitId: "aframe-stone",
      stories: 1,
      wings: [{ x: 4, y: 4, w: 8, h: 7 }],
      windows: false,
    });
    expect(result.ok, result.reason).toBe(true);
    expect(upperAt(map, 7, 4)).toBe(354);
    expect(upperAt(map, 8, 4)).toBe(355);
  });

  it("날개 높이가 폭 규약과 다르면 이유를 밝히고 거부한다", () => {
    const map = freshMap();
    const result = stampFootprintHouseKit(map, {
      kitId: "aframe-stone",
      stories: 1,
      wings: [{ x: 4, y: 4, w: 7, h: 9 }],
      windows: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("h=7");
  });

  it("rect 스탬프도 지원한다 (roofBodyRows 무시, 폭 종속 높이)", () => {
    const map = freshMap();
    const result = stampRectHouseKit(map, { x: 3, y: 3, width: 7, stories: 1, roofBodyRows: 1, kitId: "aframe-stone", windows: false });
    expect(result.ok, result.reason).toBe(true);
    expect(result.height).toBe(7); // floor(6/2)=3 + 처마 1 + 벽 3
    expect(upperAt(map, 6, 3)).toBe(374);
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
    // 사이 마당(y9..y10)은 잔디 그대로.
    expect(lowerAt(map, 6, 9)).toBe(G);
    expect(lowerAt(map, 6, 10)).toBe(G);
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
