// test/monsterInteriorChipset.test.ts
// 계약: 몬스터 실내 칩셋(회복 센터·도구 상점·주인공 집·연구소)은 블록마다 이름 있는 그룹으로 노출되고,
// 새 프로젝트·기존 프로젝트 모두 번들 타일셋과 배치 지침을 받는다.
//
// 시트는 scripts/content/build-monster-interior.py, 참고문서는 prepare-monster-interior-references.mjs 가 만든다.
// 매니페스트·그룹 라벨·문서가 어긋나면 블록이 그룹 없이 남거나, 문서가 없는 칸 번호를 가르친다.

import { describe, expect, it } from "vitest";
import {
  MONSTER_INTERIOR_MANIFEST,
  MONSTER_INTERIOR_TEXTURE_KEY,
  scarloxyChipsetGroupSeeds,
} from "@/assets/scarloxyPack";
import { bundledChipsetFrameCount, bundledEasyRpgTilesetId } from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";

const COLUMNS = 30;
const ROWS = 16;
const TILESET_ID = bundledEasyRpgTilesetId(MONSTER_INTERIOR_TEXTURE_KEY);
const CATEGORY_ID = "monster-interior-v1";
// 밟는 칸·벽 칸(불투명, 1층)과 가구(투명 가장자리, 3층).
const LOWER_KINDS = new Set(["floor", "rug", "mat", "stairs", "frame", "wall"]);
const WALKABLE_KINDS = new Set(["floor", "rug", "mat", "stairs"]);

type Block = (typeof MONSTER_INTERIOR_MANIFEST.blocks)[number];

function blockCells(block: Block): number[] {
  const cells: number[] = [];
  for (let row = block.row; row < block.row + block.h; row += 1) {
    for (let col = block.col; col < block.col + block.w; col += 1) cells.push(row * COLUMNS + col);
  }
  return cells;
}

function block(name: string): Block {
  const found = MONSTER_INTERIOR_MANIFEST.blocks.find((entry) => entry.name === name);
  if (!found) throw new Error(`manifest has no block ${name}`);
  return found;
}

describe("monster interior chipset", () => {
  it("블록은 480칸 시트 안에 있고 서로 겹치지 않는다", () => {
    expect(bundledChipsetFrameCount(MONSTER_INTERIOR_TEXTURE_KEY)).toBe(COLUMNS * ROWS);
    const claimed = new Map<number, string>();
    for (const entry of MONSTER_INTERIOR_MANIFEST.blocks) {
      expect(entry.col + entry.w, entry.name).toBeLessThanOrEqual(COLUMNS);
      expect(entry.row + entry.h, entry.name).toBeLessThanOrEqual(ROWS);
      for (const cell of blockCells(entry)) {
        expect(claimed.get(cell), `${entry.name} 가 ${cell} 칸에서 겹친다`).toBeUndefined();
        claimed.set(cell, entry.name);
      }
    }
    // 이름 붙은 한 칸은 모두 어떤 블록 안에 있다.
    for (const [name, tile] of Object.entries(MONSTER_INTERIOR_MANIFEST.tiles)) {
      expect(claimed.has(tile), name).toBe(true);
    }
  });

  it("모든 블록이 한국어 이름 그룹을 갖고, 층·통행이 종류 규칙을 따른다", () => {
    const seeds = scarloxyChipsetGroupSeeds(MONSTER_INTERIOR_TEXTURE_KEY);
    const seedOf = new Map<number, (typeof seeds)[number]>();
    for (const seed of seeds) {
      expect(seed.name, seed.key).not.toBe(seed.key);
      for (const tile of seed.tileIds) seedOf.set(tile, seed);
    }
    for (const entry of MONSTER_INTERIOR_MANIFEST.blocks) {
      for (const cell of blockCells(entry)) {
        const seed = seedOf.get(cell);
        expect(seed, `${entry.name} ${cell}`).toBeDefined();
        // 가구를 1층에 두면 투명 가장자리가 검게 보이고, 밟는 칸을 3층에 두면 캐릭터 위에 그려진다.
        expect(seed!.defaultLayer, entry.name).toBe(LOWER_KINDS.has(entry.kind) ? "lower" : "upper");
        expect(seed!.passage, entry.name).toBe(WALKABLE_KINDS.has(entry.kind) ? "passable" : "solid");
      }
    }
    for (const name of ["접수 카운터", "회복 기계", "PC 단말", "계산대", "침대", "스타터 볼 받침대", "나무 마루", "흰 타일", "실내 벽 틀"]) {
      expect(seeds.map((seed) => seed.name), name).toContain(name);
    }
  });

  it("새 프로젝트가 480칸 타일셋을 칸 규칙·배치 지침과 함께 갖는다", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[TILESET_ID];
    expect(tileset?.image).toEqual({ type: "bundled", id: MONSTER_INTERIOR_TEXTURE_KEY });
    expect(tileset?.count).toBe(480);
    const counter = block("reception-counter");
    const counterTile = counter.row * COLUMNS + counter.col;
    expect(tileset?.priority[counterTile]).toBe("upper");
    expect(tileset?.passability[counterTile]).toEqual({ up: false, down: false, left: false, right: false });
    const mat = MONSTER_INTERIOR_MANIFEST.tiles["door-mat-tile"]!;
    expect(tileset?.priority[mat]).toBe("lower");
    expect(tileset?.passability[mat]).toEqual({ up: true, down: true, left: true, right: true });
    const frame = MONSTER_INTERIOR_MANIFEST.tiles["frame-top"]!;
    expect(tileset?.passability[frame]).toEqual({ up: false, down: false, left: false, right: false });
    expect(tileset?.referenceDocuments?.map((category) => category.id)).toContain(CATEGORY_ID);
  });

  it("타일셋이 없거나 지침이 빠진 기존 프로젝트도 로드 보정으로 받는다", () => {
    const missing = createBlankProject();
    delete missing.tilesets[TILESET_ID];
    expect(ensureBundledTilesets(missing)).toBe(true);
    expect(missing.tilesets[TILESET_ID]?.referenceDocuments?.map((category) => category.id)).toEqual([CATEGORY_ID]);

    const stripped = createBlankProject();
    stripped.tilesets[TILESET_ID]!.referenceDocuments = [];
    expect(ensureBundledTilesets(stripped)).toBe(true);
    expect(stripped.tilesets[TILESET_ID]?.referenceDocuments?.map((category) => category.id)).toEqual([CATEGORY_ID]);
  });

  it("참고문서의 칸 사전과 예제 배열이 매니페스트와 같은 번호를 쓴다", () => {
    const category = createBlankProject().tilesets[TILESET_ID]!.referenceDocuments!.find((entry) => entry.id === CATEGORY_ID)!;
    const doc = (id: string) => category.documents.find((entry) => entry.id === id)!.markdown;
    const dictionary = doc("monster-interior-dictionary");
    for (const entry of MONSTER_INTERIOR_MANIFEST.blocks) {
      expect(dictionary, entry.name).toContain(`| ${entry.name} |`);
      expect(dictionary, entry.name).toContain(`| ${entry.row * COLUMNS + entry.col}~`);
    }
    // 방 네 개의 전체 배열이 실려 있고, 배열의 칸은 전부 시트 안 번호다.
    const examples = doc("monster-interior-examples");
    for (const title of ["몬스터 회복 센터", "도구 상점", "주인공 집", "연구소"]) expect(examples).toContain(`## ${title}`);
    const fence = "```";
    const arrays = [...examples.matchAll(new RegExp(`${fence}json\n(.+)\n${fence}`, "g"))].map((match) => JSON.parse(match[1]!) as number[][]);
    expect(arrays).toHaveLength(8);
    for (const grid of arrays) for (const tile of grid.flat()) expect(tile === -1 || (tile >= 0 && tile < 480), String(tile)).toBe(true);
    // 그림은 번들 JSON 에 바이트로 넣지 않고 /assets 경로를 쓴다.
    for (const image of category.images) expect(image.dataUrl.startsWith("/assets/monster-interior/references/"), image.id).toBe(true);
  });
});
