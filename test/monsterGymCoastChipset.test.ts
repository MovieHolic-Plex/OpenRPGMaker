// test/monsterGymCoastChipset.test.ts
// 계약: 체육관 내부 + 해변·항구 칩셋(생성 자산)은 블록마다 이름 있는 그룹으로 노출되고,
// 블록의 층·통행이 타일셋 priority/passability 로 그대로 내려가며, 새 프로젝트·기존 프로젝트 모두
// 번들 타일셋과 참고문서를 받는다.
//
// 시트는 scripts/content/build-monster-gym-coast.py 가 만든다. 매니페스트와 그룹 라벨이
// 어긋나면 블록이 그룹 없이 남아 AI 배치 도구가 그 부품을 이름으로 집을 수 없다.

import { describe, expect, it } from "vitest";
import {
  MONSTER_GYM_COAST_MANIFEST,
  MONSTER_GYM_COAST_TEXTURE_KEY,
  scarloxyChipsetGroupSeeds,
} from "@/assets/scarloxyPack";
import { bundledChipsetFrameCount, bundledEasyRpgTilesetId } from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";

const COLUMNS = 30;
const ROWS = 32;
const KIT_START = 480;
const TILESET_ID = bundledEasyRpgTilesetId(MONSTER_GYM_COAST_TEXTURE_KEY);
const CATEGORY_ID = "monster-gym-coast-v1";
type Block = (typeof MONSTER_GYM_COAST_MANIFEST.blocks)[number];

const block = (name: string): Block => MONSTER_GYM_COAST_MANIFEST.blocks.find((entry) => entry.name === name)!;
const cell = (b: Block, dx = 0, dy = 0) => (b.row + dy) * COLUMNS + b.col + dx;
function blockCells(b: Block): number[] {
  const cells: number[] = [];
  for (let dy = 0; dy < b.h; dy += 1) for (let dx = 0; dx < b.w; dx += 1) cells.push(cell(b, dx, dy));
  return cells;
}
const SOLID = { up: false, down: false, left: false, right: false };
const OPEN = { up: true, down: true, left: true, right: true };

function freshTileset() {
  const project = createBlankProject();
  ensureTilesetHarnesses(project);
  return project.tilesets[TILESET_ID]!;
}

describe("monster gym & coast chipset", () => {
  it("부품 블록은 아래 반쪽 안에 있고 서로 겹치지 않는다", () => {
    expect(bundledChipsetFrameCount(MONSTER_GYM_COAST_TEXTURE_KEY)).toBe(960);
    const claimed = new Map<number, string>();
    for (const b of MONSTER_GYM_COAST_MANIFEST.blocks) {
      expect(b.row, b.name).toBeGreaterThanOrEqual(MONSTER_GYM_COAST_MANIFEST.baseRows);
      expect(b.col + b.w, b.name).toBeLessThanOrEqual(COLUMNS);
      expect(b.row + b.h, b.name).toBeLessThanOrEqual(ROWS);
      for (const c of blockCells(b)) {
        expect(claimed.get(c), b.name + " 가 " + c + " 칸에서 겹친다").toBeUndefined();
        claimed.set(c, b.name);
      }
    }
  });

  it("사막/설원 그룹을 그대로 잇고, 모든 부품 칸이 한국어 이름의 그룹에 든다", () => {
    const all = scarloxyChipsetGroupSeeds(MONSTER_GYM_COAST_TEXTURE_KEY);
    const wilds = scarloxyChipsetGroupSeeds("tex_scarloxy_chipset_wilds");
    expect(all.slice(0, wilds.length)).toEqual(wilds);
    const seeds = all.slice(wilds.length);
    const owner = new Map<number, (typeof seeds)[number]>();
    for (const seed of seeds) {
      expect(seed.name).not.toBe(seed.key);
      for (const tile of seed.tileIds) {
        expect(tile, seed.key).toBeGreaterThanOrEqual(KIT_START);
        expect(owner.has(tile), seed.key + " 가 " + tile + " 를 다시 가진다").toBe(false);
        owner.set(tile, seed);
      }
    }
    for (const b of MONSTER_GYM_COAST_MANIFEST.blocks) {
      for (const c of blockCells(b)) {
        expect(owner.get(c)?.defaultLayer, b.name).toBe(b.layer);
      }
    }
    expect(owner.size).toBe(MONSTER_GYM_COAST_MANIFEST.blocks.reduce((sum, b) => sum + b.w * b.h, 0));
  });

  it("새 프로젝트의 타일셋이 블록의 층·통행을 칸마다 갖는다", () => {
    const tileset = freshTileset();
    expect(tileset.image).toEqual({ type: "bundled", id: MONSTER_GYM_COAST_TEXTURE_KEY });
    expect(tileset.count).toBe(960);
    expect(tileset.passability.length).toBe(960);
    const names = (tileset.tileGroups ?? []).map((group) => group.name);
    for (const name of ["체육관 바닥 · 풀", "관장 단상 · 불", "관장 단상 · 불 계단", "배지 조각상 · 물 머리", "바다 해안(파도)", "등대", "부두 판자 · 가로", "사막 지형"]) {
      expect(names, name).toContain(name);
    }
    // 바닥은 1층 통행, 벽은 1층 막힘
    expect(tileset.priority[cell(block("gym-floor-grass"))]).toBe("lower");
    expect(tileset.passability[cell(block("gym-floor-grass"))]).toEqual(OPEN);
    expect(tileset.passability[cell(block("gym-wall-fire"), 0, 1)]).toEqual(SOLID);
    // 단상: 3층, 몸통 막힘, 아래 가운데 계단만 통행
    const podium = block("leader-podium-water");
    expect(tileset.priority[cell(podium)]).toBe("upper");
    expect(tileset.passability[cell(podium, 1, 0)]).toEqual(SOLID);
    expect(tileset.passability[cell(podium, 0, 1)]).toEqual(SOLID);
    expect(tileset.passability[cell(podium, 1, 1)]).toEqual(OPEN);
    // 조각상: 머리 통행, 받침 막힘
    const statue = block("badge-statue-grass");
    expect(tileset.passability[cell(statue, 0, 0)]).toEqual(OPEN);
    expect(tileset.passability[cell(statue, 0, 1)]).toEqual(SOLID);
    // 해안: 가운데(젖은 모래) 통행, 둘레 막힘. 모래 경계는 전부 통행
    const shore = block("shore-sea");
    expect(tileset.passability[cell(shore, 1, 1)]).toEqual(OPEN);
    expect(tileset.passability[cell(shore, 0, 1)]).toEqual(SOLID);
    expect(tileset.passability[cell(block("sand-wet-edge"), 0, 0)]).toEqual(OPEN);
    // 퍼즐: 차단기 닫힘 막힘 / 열림·스위치 통행
    expect(tileset.passability[cell(block("barrier-closed"))]).toEqual(SOLID);
    expect(tileset.passability[cell(block("barrier-open"))]).toEqual(OPEN);
    expect(tileset.passability[cell(block("floor-switch-off"))]).toEqual(OPEN);
    expect(tileset.priority[cell(block("starfish"))]).toBe("upper");
  });

  it("타일셋이 없는 기존 프로젝트도 로드 보정으로 받는다", () => {
    const project = createBlankProject();
    delete project.tilesets[TILESET_ID];
    expect(ensureBundledTilesets(project)).toBe(true);
    expect(project.tilesets[TILESET_ID]?.image).toEqual({ type: "bundled", id: MONSTER_GYM_COAST_TEXTURE_KEY });
    expect(project.tilesets[TILESET_ID]?.referenceDocuments?.map((c) => c.id)).toContain(CATEGORY_ID);
  });

  it("새 프로젝트와 참고문서가 빠진 기존 프로젝트 모두 배치 지침을 갖는다", () => {
    const fresh = createBlankProject();
    expect(fresh.tilesets[TILESET_ID]?.referenceDocuments?.map((c) => c.id)).toContain(CATEGORY_ID);
    const old = createBlankProject();
    old.tilesets[TILESET_ID]!.referenceDocuments = [];
    expect(ensureBundledTilesets(old)).toBe(true);
    expect(old.tilesets[TILESET_ID]?.referenceDocuments?.map((c) => c.id)).toEqual([CATEGORY_ID]);
    expect(ensureBundledTilesets(old)).toBe(false);
  });

  it("참고문서의 칸 사전 번호가 매니페스트와 같고, 예제 배열이 이 시트 번호만 쓴다", () => {
    const category = createBlankProject().tilesets[TILESET_ID]!.referenceDocuments!.find((c) => c.id === CATEGORY_ID)!;
    const doc = (id: string) => category.documents.find((d) => d.id === id)!.markdown;
    const dictionary = doc("gym-coast-dictionary");
    for (const b of MONSTER_GYM_COAST_MANIFEST.blocks) {
      expect(dictionary, b.name).toContain("| " + b.name + " |");
      expect(dictionary, b.name).toContain("| " + cell(b) + "~");
    }
    for (const [id, w, h] of [["gym-coast-example-gym", 14, 15], ["gym-coast-example-beach", 24, 16]] as const) {
      const arrays = [...doc(id).matchAll(/\x60\x60\x60json\n(.+)\n\x60\x60\x60/gu)].map((m) => JSON.parse(m[1]!) as number[][]);
      expect(arrays.length, id).toBe(2);
      for (const rows of arrays) {
        expect(rows.length, id).toBe(h);
        for (const row of rows) {
          expect(row.length, id).toBe(w);
          for (const tile of row) expect(tile, id).toBeLessThan(960);
        }
      }
      // 1층은 빈 칸이 없다
      expect(arrays[0]!.flat().every((tile) => tile >= 0), id).toBe(true);
    }
    for (const image of category.images) expect(image.dataUrl.startsWith("/assets/monster-gym-coast/references/"), image.id).toBe(true);
  });
});
