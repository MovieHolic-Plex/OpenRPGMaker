/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawMapTileLayers } from "@/editor/mapTileDraw";
import { DEFAULT_TRUNK_BACKING_TILE } from "@/editor/tileLayerPolicy";
import { setTileBackingOverride } from "@/editor/runtimeTileMetadata";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import type { GameMap, TilesetDef } from "@/project/types";

// 캔버스 공유 렌더러가 **투명 칩의 받침**을 깔아야 한다.
//
// 왜 테스트가 필요한가(2026-09-12 실측): 나무 밑동(290~293)은 하위에 앉고 칩에 투명
// 픽셀이 있어, 받침 없이 그리면 그 자리가 검게 뚫린다. 편집기 캔버스(Phaser)와 런타임은
// `tileBackingTile` 로 잔디를 깔았지만, 이 캔버스 렌더러만 빠져 있었다 — 맵 썸네일·
// 스크린샷·미니맵·구운 마을 전경에 검은 사각형이 남았다(마을 40×40 에서 6,641픽셀).
// 정책 함수 단위 테스트(`tileLayerPolicy.test.ts`)는 정책만 보고 렌더를 안 보므로
// 이 결함을 못 잡는다.

const CONIFER_TRUNK = 290;
const CONIFER_CANOPY = 260;
const GRASS = 240;

type Draw = { readonly tile: number; readonly x: number; readonly y: number };

let draws: Draw[];

beforeEach(() => {
  draws = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    const context = {
      imageSmoothingEnabled: true,
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      // 소스 x = (tile % 30) * 16 이므로 그 역산으로 어떤 타일을 그렸는지 되읽는다.
      drawImage: vi.fn((_image: unknown, sx: number, sy: number, sw: number) => {
        draws.push({ tile: Math.floor(sy / 16) * 30 + Math.floor(sx / 16), x: sw, y: sy });
      }),
    };
    void this;
    return context as unknown as CanvasRenderingContext2D;
  });
});
afterEach(() => { vi.restoreAllMocks(); });

function mapWith(lower: number[], upper: number[]): GameMap {
  return {
    id: "map_backing",
    name: "backing",
    width: 2,
    height: 1,
    tileSize: 16,
    tilesetId: "easyrpg_chipset_combined_town",
    lowerTiles: lower,
    upperTiles: upper,
    events: [],
  } as unknown as GameMap;
}

/** 그려진 타일 id 목록(그린 순서). */
function drawnTiles(): number[] {
  return draws.map((draw) => draw.tile);
}

describe("공유 캔버스 렌더러 — 투명 칩 받침", () => {
  const tileset = defaultTileset() as TilesetDef;

  it("나무 밑동(하위)을 그릴 때 잔디 받침을 먼저 깐다", () => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawMapTileLayers(context, document.createElement("canvas"), mapWith([CONIFER_TRUNK, GRASS], [-1, -1]), tileset, 1);

    const tiles = drawnTiles();
    // 밑동 칸: 받침(잔디) → 밑동 순서. 받침이 없으면 검은 사각형이 남는다.
    expect(tiles[0]).toBe(DEFAULT_TRUNK_BACKING_TILE);
    expect(tiles[1]).toBe(CONIFER_TRUNK);
    // 잔디 칸은 받침이 필요 없다 — 한 번만 그린다.
    expect(tiles.filter((tile) => tile === GRASS).length).toBe(2);
  });

  it("상위 레이어는 받침을 깔지 않는다 — 아래 지면이 이미 있다", () => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawMapTileLayers(context, document.createElement("canvas"), mapWith([GRASS, GRASS], [-1, CONIFER_CANOPY]), tileset, 1);
    // 하위 잔디 2칸 + 상위 수관 1칸 = 3. 수관에 받침이 붙으면 4가 된다.
    expect(drawnTiles().length).toBe(3);
  });

  it("받침을 끄면(사용자 확정) 깔지 않는다", () => {
    const custom = defaultTileset() as TilesetDef;
    // 실제 편집기 경로와 같은 API 로 끈다 — 손으로 메타를 쓰면 `tileMetaOrigin` 이
    // user 가 아니어서 정책이 무시하고, 테스트가 제품과 다른 길을 걷는다.
    setTileBackingOverride(custom, CONIFER_TRUNK, "none");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawMapTileLayers(context, document.createElement("canvas"), mapWith([CONIFER_TRUNK, GRASS], [-1, -1]), custom, 1);
    // 밑동 칸은 받침 없이 밑동만 — 첫 draw 가 밑동이어야 한다.
    expect(drawnTiles()[0]).toBe(CONIFER_TRUNK);
  });
});
