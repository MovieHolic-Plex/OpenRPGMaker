// test/monsterCaveChipset.test.ts
// 계약: 몬스터 동굴 칩셋(생성 자산)은 블록마다 층·통행이 맞는 이름 있는 그룹으로 노출되고, 47칸 블롭
// 네 세트는 8방 오토타일로 칠해지며, 새 프로젝트·기존 프로젝트 모두 번들 타일셋과 참고문서를 받는다.
//
// 시트와 매니페스트는 scripts/content/build-monster-cave.py, 참고문서는
// scripts/content/prepare-monster-cave-references.mjs 가 만든다.

import { describe, expect, it } from "vitest";
import { MONSTER_CAVE_MANIFEST, MONSTER_CAVE_TEXTURE_KEY, scarloxyChipsetGroupSeeds } from "@/assets/scarloxyPack";
import { bundledEasyRpgTilesetId } from "@/assets/bundled";
import { createBlankProject, createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { MONSTER_CAVE_AUTOTILE_PREFIX, reduceBlobMask } from "@/project/defaults/monsterCaveAutotiles";
import { MONSTER_CAVE_REFERENCE_ID } from "@/project/defaults/monsterCaveReferences";
import { autotileVariantForMask } from "@/project/defaults/autotileEngine";
import { tilePassability } from "@/project/collision";
import { passageMarkForTile } from "@/project/tilesetPassage";

const COLUMNS = 30;
const TILESET_ID = bundledEasyRpgTilesetId(MONSTER_CAVE_TEXTURE_KEY);
const block = (name: string) => MONSTER_CAVE_MANIFEST.blocks.find((entry) => entry.name === name)!;
const tileOf = (name: string, dx = 0, dy = 0) => (block(name).row + dy) * COLUMNS + block(name).col + dx;

function blockCells(entry: (typeof MONSTER_CAVE_MANIFEST.blocks)[number]): number[] {
  const count = entry.kind === "blob" ? 47 : entry.w * entry.h;
  return Array.from({ length: count }, (_, i) => (entry.row + Math.floor(i / entry.w)) * COLUMNS + entry.col + (i % entry.w));
}

function loadedTileset() {
  const project = createBlankProject();
  ensureTilesetHarnesses(project);
  return project.tilesets[TILESET_ID]!;
}

describe("monster cave chipset", () => {
  it("블록은 30×16 시트 안에 있고 서로 겹치지 않으며, 블롭 네 세트는 47칸씩이다", () => {
    const claimed = new Map<number, string>();
    for (const entry of MONSTER_CAVE_MANIFEST.blocks) {
      expect(entry.col + entry.w, entry.name).toBeLessThanOrEqual(COLUMNS);
      expect(entry.row + entry.h, entry.name).toBeLessThanOrEqual(16);
      for (const cell of blockCells(entry)) {
        expect(claimed.get(cell), `${entry.name} 가 ${cell} 칸에서 겹친다`).toBeUndefined();
        claimed.set(cell, entry.name);
      }
    }
    for (const [key, blob] of Object.entries(MONSTER_CAVE_MANIFEST.blobs)) {
      expect(new Set(Object.values(blob.masks)).size, key).toBe(47);
      expect(blob.masks["255"], key).toBeDefined();
    }
  });

  it("모든 블록 칸이 한국어 이름 그룹에 속하고, 그룹의 층·통행이 매니페스트와 같다", () => {
    const seeds = scarloxyChipsetGroupSeeds(MONSTER_CAVE_TEXTURE_KEY);
    const seedOf = new Map<number, (typeof seeds)[number]>();
    for (const seed of seeds) {
      expect(seed.name).not.toBe(seed.key);
      for (const tile of seed.tileIds) {
        expect(seedOf.has(tile), `${tile} 가 두 그룹에 든다`).toBe(false);
        seedOf.set(tile, seed);
      }
    }
    for (const entry of MONSTER_CAVE_MANIFEST.blocks) {
      for (const cell of blockCells(entry)) {
        const seed = seedOf.get(cell);
        expect(seed, `${entry.name} ${cell}`).toBeDefined();
        expect(seed!.defaultLayer, entry.name).toBe(entry.layer);
      }
    }
    // 소품은 3층, 바닥 장식은 흙에 구운 1층.
    expect(seedOf.get(tileOf("push-boulder"))?.defaultLayer).toBe("upper");
    expect(seedOf.get(tileOf("puddle"))?.defaultLayer).toBe("lower");
    expect(seedOf.get(tileOf("puddle"))?.passage).toBe("passable");
  });

  it("로드된 타일셋의 통행: 벽·물·앞면 막힘, 흙·자갈·계단 통과, 사다리·굴은 아랫칸만, 고지대 테두리는 막힘", () => {
    const tileset = loadedTileset();
    expect(tileset.count).toBe(480);
    const open = (tile: number) => tilePassability(tileset, tile, -1).up;
    const body = (key: "wall" | "high" | "water" | "gravel") => MONSTER_CAVE_MANIFEST.blobs[key].masks["255"]!;
    expect(open(tileOf("floor-dirt"))).toBe(true);
    expect(open(body("gravel"))).toBe(true);
    expect(open(body("high"))).toBe(true);
    expect(open(body("wall"))).toBe(false);
    expect(open(body("water"))).toBe(false);
    expect(open(MONSTER_CAVE_MANIFEST.blobs.high.masks["0"]!)).toBe(false);
    expect(open(tileOf("cliff-face", 1, 0))).toBe(false);
    expect(open(tileOf("ladder-up", 0, 0))).toBe(false);
    expect(open(tileOf("ladder-up", 0, 1))).toBe(true);
    expect(open(tileOf("tunnel-dark", 0, 1))).toBe(true);
    expect(open(tileOf("stairs-up", 1, 0))).toBe(true);
    // 소품: 3층 × 가 흙 위에서 칸을 막고, 큰 석순 윗칸은 ★(캐릭터 위, 통과).
    expect(tilePassability(tileset, tileOf("floor-dirt"), tileOf("push-boulder")).up).toBe(false);
    expect(passageMarkForTile(tileset, tileOf("stalagmite-tall", 0, 0))).toBe("star");
    expect(passageMarkForTile(tileset, tileOf("stalagmite-tall", 0, 1))).toBe("x");
  });

  it("블롭 네 세트가 8방 오토타일 그룹이고 대각은 양옆 직교가 이어졌을 때만 모양을 바꾼다", () => {
    const tileset = loadedTileset();
    const groups = (tileset.autotileGroups ?? []).filter((group) => group.id.startsWith(MONSTER_CAVE_AUTOTILE_PREFIX));
    expect(groups.map((group) => group.id.slice(MONSTER_CAVE_AUTOTILE_PREFIX.length)).sort()).toEqual(["gravel", "high", "wall", "water"]);
    for (const group of groups) {
      const key = group.id.slice(MONSTER_CAVE_AUTOTILE_PREFIX.length) as "wall";
      const masks = MONSTER_CAVE_MANIFEST.blobs[key].masks;
      expect(group.neighborhood).toBe(8);
      for (let mask = 0; mask < 256; mask += 1) {
        expect(autotileVariantForMask(group, mask), `${key} ${mask}`).toBe(masks[String(reduceBlobMask(mask))]);
      }
    }
    // N+E 만 이어지고 NE 대각이 비면 볼록 모서리 칸, NE 까지 이어지면 다른 칸.
    const water = groups.find((group) => group.id.endsWith("water"))!;
    expect(autotileVariantForMask(water, 1 | 2)).not.toBe(autotileVariantForMask(water, 1 | 2 | 16));
    // 대각만 이어진 것은 대각이 없는 것과 같다.
    expect(autotileVariantForMask(water, 16)).toBe(autotileVariantForMask(water, 0));
    // 두 번 적용해도 바뀌지 않는다.
    expect(ensureTilesetHarnesses({ tilesets: { [TILESET_ID]: tileset } })).toBe(false);
  });

  it("새 프로젝트와 참고문서가 빠진 기존 프로젝트 모두 배치 지침을 갖는다", () => {
    const fresh = createBlankProject();
    expect(fresh.tilesets[TILESET_ID]?.image).toEqual({ type: "bundled", id: MONSTER_CAVE_TEXTURE_KEY });
    expect(fresh.tilesets[TILESET_ID]?.referenceDocuments?.map((c) => c.id)).toContain(MONSTER_CAVE_REFERENCE_ID);
    const old = createBlankProject();
    old.tilesets[TILESET_ID]!.referenceDocuments = [];
    expect(ensureBundledTilesets(old)).toBe(true);
    expect(old.tilesets[TILESET_ID]?.referenceDocuments?.map((c) => c.id)).toEqual([MONSTER_CAVE_REFERENCE_ID]);
    const demo = createScarloxyPokemonDemoProject();
    delete demo.tilesets[TILESET_ID];
    expect(ensureBundledTilesets(demo)).toBe(true);
    expect(demo.tilesets[TILESET_ID]?.referenceDocuments?.map((c) => c.id)).toEqual([MONSTER_CAVE_REFERENCE_ID]);
  });

  it("참고문서의 칸 사전·마스크 표·완성 예제가 매니페스트 번호를 쓴다", () => {
    const category = createBlankProject().tilesets[TILESET_ID]!.referenceDocuments!.find((c) => c.id === MONSTER_CAVE_REFERENCE_ID)!;
    const doc = (id: string) => category.documents.find((d) => d.id === id)!.markdown;
    for (const entry of MONSTER_CAVE_MANIFEST.blocks) {
      expect(doc("monster-cave-dictionary"), entry.name).toContain(`| ${entry.name} |`);
      expect(doc("monster-cave-dictionary"), entry.name).toContain(`| ${entry.row * COLUMNS + entry.col}~`);
    }
    const edgeRows = doc("monster-cave-edges").split("\n");
    for (const [key, blob] of Object.entries(MONSTER_CAVE_MANIFEST.blobs)) {
      for (const [mask, tile] of Object.entries(blob.masks)) {
        expect(edgeRows.some((row) => row.startsWith(`| ${mask} |`) && row.endsWith(`| ${tile} |`)), `${key} ${mask}→${tile}`).toBe(true);
      }
    }
    // 완성 예제 1층 배열: 모든 칸이 이 시트의 블록 칸이고, 입구 칸은 통과 가능하다.
    const example = doc("monster-cave-example");
    const fence = /## 1층\n```json\n([\s\S]*?)\n```/u.exec(example);
    expect(fence).not.toBeNull();
    const lower = JSON.parse(fence![1]!) as number[][];
    expect(lower).toHaveLength(20);
    const known = new Set(MONSTER_CAVE_MANIFEST.blocks.flatMap(blockCells));
    for (const row of lower) for (const tile of row) expect(known.has(tile), String(tile)).toBe(true);
    const tileset = loadedTileset();
    expect(tilePassability(tileset, lower[19]![11]!, -1).up).toBe(true);
    for (const image of category.images) expect(image.dataUrl.startsWith("/assets/monster-cave/references/"), image.id).toBe(true);
  });
});

