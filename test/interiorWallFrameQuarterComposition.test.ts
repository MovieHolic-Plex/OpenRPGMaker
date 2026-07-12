import { describe, expect, it } from "vitest";
import { supportsChipsetQuarterComposition } from "@/editor/tilesetImage";
import { createBlankProject } from "@/project/defaults";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";

type MapView = {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: number[];
};

type InteriorCornerFixture = {
  readonly center: number;
  readonly east?: number;
  readonly north?: number;
  readonly south?: number;
  readonly west?: number;
  readonly northEast?: number;
  readonly northWest?: number;
  readonly southEast?: number;
  readonly southWest?: number;
};

function mapWithInteriorCorner(fixture: InteriorCornerFixture): MapView {
  return {
    width: 3,
    height: 3,
    lowerTiles: [
      fixture.northWest ?? 430, fixture.north ?? 430, fixture.northEast ?? 430,
      fixture.west ?? 430, fixture.center, fixture.east ?? 430,
      fixture.southWest ?? 430, fixture.south ?? 430, fixture.southEast ?? 430,
    ],
  };
}

// RM2k3 쿼터(8×8 미니타일) 합성 — 셀의 쿼터마다 v/h/d 이웃의 어둠 덩어리 여부로
// 소스를 고른다. 중앙 쿼터와 저장 타일과 동일한 쿼터는 생략(underlay 노출).
describe("interior dark-wall quarter composition (RM2k3 minitile)", () => {
  it("allows the Interior tileset through production quarter-render gates", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;

    expect(supportsChipsetQuarterComposition(tileset)).toBe(true);
  });

  it("cross junction — 사방이 벽, 대각만 열림 → 368 오목 쿼터 ×4 (여관 (8,7) 케이스)", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({
        center: 428,
        north: 428, south: 428, west: 397, east: 397,
        northWest: 72, northEast: 72, southWest: 72, southEast: 72,
      }),
      tileset,
      1,
      1,
    );

    expect(composition).toEqual({
      underlayTile: 428,
      sources: [
        { quarter: "nw", tile: 368, offsetX: 0, offsetY: 0 },
        { quarter: "ne", tile: 368, offsetX: 8, offsetY: 0 },
        { quarter: "sw", tile: 368, offsetX: 0, offsetY: 8 },
        { quarter: "se", tile: 368, offsetX: 8, offsetY: 8 },
      ],
    });
  });

  it("1줄 가로 밴드 — 위/아래가 열림 → 397 위 절반 + 457 아래 절반(상하 2등분)", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({ center: 397, west: 397, east: 397, north: 72, south: 72 }),
      tileset,
      1,
      1,
    );

    // 위 절반(397)은 저장 타일과 동일해 생략 — 아래 절반만 457로 덮는다.
    expect(composition).toEqual({
      underlayTile: 397,
      sources: [
        { quarter: "sw", tile: 457, offsetX: 0, offsetY: 8 },
        { quarter: "se", tile: 457, offsetX: 8, offsetY: 8 },
      ],
    });
  });

  it("1열 세로 기둥(방|벽|방) — 426 왼 절반 + 428 오른 절반(좌우 2등분)", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({ center: 428, north: 428, south: 428, west: 72, east: 72 }),
      tileset,
      1,
      1,
    );

    // 오른 절반(428)은 저장 타일과 동일해 생략 — 왼 절반만 426으로 덮는다.
    expect(composition).toEqual({
      underlayTile: 428,
      sources: [
        { quarter: "nw", tile: 426, offsetX: 0, offsetY: 0 },
        { quarter: "sw", tile: 426, offsetX: 0, offsetY: 8 },
      ],
    });
  });

  it("남쪽 void 코너 — 포스트와 트림이 만나는 대각 열림 → 368 랩 쿼터 하나 (골드 (1,11) 관례)", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({ center: 430, north: 428, east: 397, northEast: 72 }),
      tileset,
      1,
      1,
    );

    expect(composition).toEqual({
      underlayTile: 430,
      sources: [{ quarter: "ne", tile: 368, offsetX: 8, offsetY: 0 }],
    });
  });

  it("문 받침 257 — 라벨 타일은 원시 픽셀을 노출하지 않고 항상 4쿼터 전체 합성(시트 원본 복원 후 관례)", () => {
    // 시트 복원(2026-07-12)으로 257의 실제 픽셀은 돌벽 변형이다 — 렌더는 절대 원시 픽셀을 쓰면 안 된다.
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({ center: 257, north: 396, west: 397, northWest: 72 }),
      tileset,
      1,
      1,
    );

    expect(composition).toEqual({
      underlayTile: 427,
      sources: [
        { quarter: "nw", tile: 368, offsetX: 0, offsetY: 0 },
        { quarter: "ne", tile: 427, offsetX: 8, offsetY: 0 },
        { quarter: "sw", tile: 427, offsetX: 0, offsetY: 8 },
        { quarter: "se", tile: 427, offsetX: 8, offsetY: 8 },
      ],
    });
  });

  it("캡 조인트 233 — 사방이 어둠이어도 null 폴백 없이 어둠 몸통 4쿼터를 합성한다", () => {
    // 구 동작: 전 쿼터 중앙 → 생략 → null → 원시 픽셀(덧그린 그림자) 노출.
    // 시트 복원 후 233 픽셀은 빈칸이므로 라벨 타일은 항상 전체 합성해야 한다.
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({ center: 233 }),
      tileset,
      1,
      1,
    );

    expect(composition).toEqual({
      underlayTile: 427,
      sources: [
        { quarter: "nw", tile: 427, offsetX: 0, offsetY: 0 },
        { quarter: "ne", tile: 427, offsetX: 8, offsetY: 0 },
        { quarter: "sw", tile: 427, offsetX: 0, offsetY: 8 },
        { quarter: "se", tile: 427, offsetX: 8, offsetY: 8 },
      ],
    });
  });

  it("does not repaint a normal one-sided post (저장 428과 동일 쿼터뿐 → null)", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({ center: 428, east: 72 }),
      tileset,
      1,
      1,
    );
    expect(composition).toBeNull();
  });

  it("does not invent quarters on deep void (열린 이웃 없음 — map (5,3))", () => {
    // Layout like interior blank: west edge 426, south beam 457, SW diagonal 456.
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({
        center: 430,
        west: 426,
        south: 457,
        southWest: 456,
      }),
      tileset,
      1,
      1,
    );

    expect(composition).toBeNull();
  });

  it("does not invent quarters on deep void (map (9,3))", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({
        center: 430,
        east: 428,
        south: 457,
        southEast: 458,
      }),
      tileset,
      1,
      1,
    );

    expect(composition).toBeNull();
  });
});
