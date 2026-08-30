// test/scarloxyIndoorFurnitureBlocks.test.ts
// 계약: Scarloxy 실내 치프셋은 가구를 **의미 단위 그룹**으로 노출한다.
//
// 실측 근거(2026-08-30): 실내 치프셋 블록이 `indoor-all` 하나뿐이라 침대·소파·모니터·창문이
// 전부 한 그룹(role=terrain, 통행 가능)으로 묶였다. 그 상태에서는 "침대만 놓아라" 같은 요청을
// 도구 어휘로 표현할 수 없어 AI 실내 저작이 불가능했다.

import { describe, expect, it } from "vitest";
import { SCARLOXY_PACK_MANIFEST, scarloxyChipsetGroupSeeds } from "@/assets/scarloxyPack";
import { createScarloxyPokemonDemoProject } from "@/project/defaults";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { projectLint } from "@/project/lint/projectLint";

const INDOOR_TEXTURE = "tex_scarloxy_chipset_indoor";
const EXPECTED_FURNITURE = [
  "bed-mint",
  "counter-wood",
  "wall-window",
  "bed-lavender",
  "cabinet-white",
  "wall-screen",
  "sofa-yellow",
  "sofa-mint",
] as const;

const indoorChipset = () => {
  const chipset = SCARLOXY_PACK_MANIFEST.chipsets.find((entry) => entry.file.includes("indoor"));
  if (!chipset) throw new Error("indoor chipset missing from manifest");
  return chipset;
};

describe("scarloxy indoor chipset exposes furniture as separate groups", () => {
  it("매니페스트가 가구 블록 8개를 갖고, 뭉뚱그린 indoor-all 은 없다", () => {
    const names = indoorChipset().blocks.map((block) => block.name);
    expect(names).toEqual([...EXPECTED_FURNITURE]);
    expect(names).not.toContain("indoor-all");
  });

  it("블록은 시트 안에 있고 서로 겹치지 않는다", () => {
    const claimed = new Map<string, string>();
    for (const block of indoorChipset().blocks) {
      expect(block.col).toBeGreaterThanOrEqual(0);
      expect(block.row).toBeGreaterThanOrEqual(0);
      expect(block.w).toBeGreaterThan(0);
      expect(block.h).toBeGreaterThan(0);
      for (let row = block.row; row < block.row + block.h; row += 1) {
        for (let col = block.col; col < block.col + block.w; col += 1) {
          const cell = `${col},${row}`;
          expect(claimed.get(cell)).toBeUndefined();
          claimed.set(cell, block.name);
        }
      }
    }
  });

  it("그룹 시드가 가구 이름별로 갈리고 전부 상층·통행 불가 프롭이다", () => {
    const seeds = scarloxyChipsetGroupSeeds(INDOOR_TEXTURE);
    expect(seeds.map((seed) => seed.key)).toEqual([...EXPECTED_FURNITURE]);
    for (const seed of seeds) {
      expect(seed.role).toBe("prop");
      expect(seed.defaultLayer).toBe("upper");
      expect(seed.passage).toBe("solid");
      expect(seed.repeatability).toBe("fixed");
      expect(seed.tileIds.length).toBeGreaterThan(0);
      expect(seed.name).not.toBe(seed.key); // 한국어 라벨이 붙어 있다
    }
  });

  it("포켓몬 데모 타일셋에 8개 그룹이 실제로 붙고 프로젝트 무결성이 유지된다", () => {
    const project = createScarloxyPokemonDemoProject();
    ensureTilesetHarnesses(project);
    const tileset = Object.values(project.tilesets)
      .find((entry) => entry.image.type === "bundled" && entry.image.id === INDOOR_TEXTURE);
    expect(tileset).toBeDefined();
    expect((tileset?.tileGroups ?? []).length).toBe(EXPECTED_FURNITURE.length);

    expect(collectProjectReferenceIssues(project)).toEqual([]);
    expect(projectLint(project).filter((issue) => issue.severity === "error")).toEqual([]);
  });
});
