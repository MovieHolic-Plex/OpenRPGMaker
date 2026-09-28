// test/monsterTownKitChipset.test.ts
// 계약: 몬스터 마을 부품 칩셋(생성 자산)은 블록마다 이름 있는 그룹으로 노출되고,
// 새 프로젝트·기존 프로젝트 모두 번들 타일셋으로 받는다.
//
// 이 시트는 scripts/content/build-monster-town-kit.py 가 만든다. 매니페스트와 그룹 라벨이
// 어긋나면 블록이 그룹 없이 남아 AI 배치 도구가 그 부품을 이름으로 집을 수 없다.

import { describe, expect, it } from "vitest";
import {
  MONSTER_TOWN_KIT_MANIFEST,
  MONSTER_TOWN_KIT_TEXTURE_KEY,
  scarloxyChipsetGroupSeeds,
} from "@/assets/scarloxyPack";
import { bundledEasyRpgTilesetId } from "@/assets/bundled";
import { createBlankProject, createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";

const COLUMNS = 30;
// 위 16행은 초원 마을 시트 그대로, 아래 16행이 부품이다.
const ROWS = 32;
const KIT_START = 480;
const TILESET_ID = bundledEasyRpgTilesetId(MONSTER_TOWN_KIT_TEXTURE_KEY);

function blockCells(block: (typeof MONSTER_TOWN_KIT_MANIFEST.blocks)[number]): number[] {
  const cells: number[] = [];
  for (let row = block.row; row < block.row + block.h; row += 1) {
    for (let col = block.col; col < block.col + block.w; col += 1) cells.push(row * COLUMNS + col);
  }
  return cells;
}

describe("monster town kit chipset", () => {
  it("부품 블록은 아래 반쪽 안에 있고 서로 겹치지 않는다", () => {
    const claimed = new Map<number, string>();
    for (const block of MONSTER_TOWN_KIT_MANIFEST.blocks) {
      expect(block.row, block.name).toBeGreaterThanOrEqual(MONSTER_TOWN_KIT_MANIFEST.baseRows);
      expect(block.col + block.w, block.name).toBeLessThanOrEqual(COLUMNS);
      expect(block.row + block.h, block.name).toBeLessThanOrEqual(ROWS);
      for (const cell of blockCells(block)) {
        expect(claimed.get(cell), `${block.name} 가 ${cell} 칸에서 겹친다`).toBeUndefined();
        claimed.set(cell, block.name);
      }
    }
  });

  it("초원 마을 그룹을 그대로 잇고, 부품은 한국어 이름의 상위 레이어 그룹이다", () => {
    const all = scarloxyChipsetGroupSeeds(MONSTER_TOWN_KIT_TEXTURE_KEY);
    const grassland = scarloxyChipsetGroupSeeds("tex_scarloxy_chipset_grassland");
    expect(all.slice(0, grassland.length)).toEqual(grassland);
    const seeds = all.slice(grassland.length);
    for (const seed of seeds) {
      for (const tile of seed.tileIds) expect(tile, seed.key).toBeGreaterThanOrEqual(KIT_START);
    }
    const grouped = new Set(seeds.flatMap((seed) => seed.tileIds));
    for (const block of MONSTER_TOWN_KIT_MANIFEST.blocks) {
      for (const cell of blockCells(block)) expect(grouped.has(cell), block.name).toBe(true);
    }
    for (const seed of seeds) {
      expect(seed.name).not.toBe(seed.key);
      // 조각은 가장자리가 투명하다 — 하위에 깔면 투명 픽셀 아래가 검게 보인다.
      expect(seed.defaultLayer, seed.key).toBe("upper");
    }
    // 두 풀숲 변형은 한 그룹, 통행 가능.
    const grass = seeds.find((seed) => seed.key === "tall-grass");
    expect(grass?.passage).toBe("passable");
    expect(grass?.tileIds.length).toBe(2);
    // 건물은 통행 불가.
    for (const key of ["item-shop", "research-lab", "cave-entrance"]) {
      expect(seeds.find((seed) => seed.key === key)?.passage, key).toBe("solid");
    }
  });

  it("새 프로젝트가 960칸 타일셋을 그룹·통행 규칙과 함께 갖는다", () => {
    const project = createBlankProject();
    ensureTilesetHarnesses(project);
    const tileset = project.tilesets[TILESET_ID];
    expect(tileset?.image).toEqual({ type: "bundled", id: MONSTER_TOWN_KIT_TEXTURE_KEY });
    expect(tileset?.count).toBe(960);
    expect(tileset?.passability.length).toBe(960);
    const names = (tileset?.tileGroups ?? []).map((group) => group.name);
    expect(names).toContain("도구 상점");
    expect(names).toContain("조우 풀숲");
    expect(names).toContain("초원 지형");
    const shop = MONSTER_TOWN_KIT_MANIFEST.blocks.find((block) => block.name === "item-shop")!;
    const shopTile = shop.row * COLUMNS + shop.col;
    expect(tileset?.priority[shopTile]).toBe("upper");
    expect(tileset?.passability[shopTile]).toEqual({ up: false, down: false, left: false, right: false });
  });

  it("부품 타일셋이 없는 기존 프로젝트도 로드 보정으로 받는다", () => {
    const project = createScarloxyPokemonDemoProject();
    delete project.tilesets[TILESET_ID];
    expect(ensureBundledTilesets(project)).toBe(true);
    expect(project.tilesets[TILESET_ID]?.image).toEqual({ type: "bundled", id: MONSTER_TOWN_KIT_TEXTURE_KEY });
  });

  it("새 프로젝트와 참고문서가 빠진 기존 프로젝트 모두 배치 지침을 갖는다", () => {
    const fresh = createBlankProject();
    expect(fresh.tilesets[TILESET_ID]?.referenceDocuments?.map((c) => c.id)).toContain("monster-town-kit-v1");
    const old = createBlankProject();
    old.tilesets[TILESET_ID]!.referenceDocuments = [];
    expect(ensureBundledTilesets(old)).toBe(true);
    expect(old.tilesets[TILESET_ID]?.referenceDocuments?.map((c) => c.id)).toEqual(["monster-town-kit-v1"]);
  });

  it("참고문서의 칸 사전 번호가 매니페스트와 같다", () => {
    const category = createBlankProject().tilesets[TILESET_ID]!.referenceDocuments!.find((c) => c.id === "monster-town-kit-v1")!;
    const dictionary = category.documents.find((d) => d.id === "monster-town-dictionary")!.markdown;
    for (const block of MONSTER_TOWN_KIT_MANIFEST.blocks) {
      expect(dictionary, block.name).toContain(`| ${block.name} |`);
      expect(dictionary, block.name).toContain(`| ${block.row * COLUMNS + block.col}~`);
    }
  });
});

