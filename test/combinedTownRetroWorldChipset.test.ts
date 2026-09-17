import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import {
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  bundledChipsetFrameCount,
  bundledChipsetSheetHeight,
  findBundledImageAsset,
} from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults/blankProject";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import {
  composeCombinedTownRetroWorldTileset,
  isCombinedTownHalfTile,
  isCombinedTownRetroWorldTileset,
} from "@/project/defaults/combinedTownRetroWorld";
import {
  COMBINED_TOWN_RETRO_WORLD_NAME,
  COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY,
  COMBINED_TOWN_RETRO_WORLD_TILE_COUNT,
  COMBINED_TOWN_RETRO_WORLD_TILESET_ID,
  DEFAULT_TILESET_ID,
  RETRO_WORLD_TILE_OFFSET,
} from "@/project/defaults/constants";
import { defaultTilesets, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { ensureTilesetHarnesses, isCombinedTownTileset, RETRO_WORLD_TEXTURE_KEY } from "@/project/tilesetHarness";
import { supportsChipsetTileAnimation } from "@/editor/tilesetImage";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { TilesetDef } from "@/project/types";

const SHEET_PATH = "public/assets/easyrpg-chipset-combined-town-retro-world-transparent.png";
const TOWN_PATH = "public/assets/easyrpg-chipset-combined-town-transparent.png";
const RETRO_PATH = "public/assets/easyrpg-chipset-retro-world-transparent.png";
/** retro_World.png 팔레트 0번 — 원본 -transparent.png 에는 이 색이 알파 없이 남아 있다(실측 14,853픽셀). */
const RETRO_KEY = [224, 103, 191] as const;
const HALF_BYTES = 480 * 256 * 4;

const readPng = (path: string): PNG => PNG.sync.read(readFileSync(path));

describe("합본 마을 + 레트로 월드맵 혼합 칩셋 — 시트", () => {
  it("480×512 RGBA 이고 위 반쪽은 합본 마을과 바이트 단위로 같다", () => {
    const sheet = readPng(SHEET_PATH);
    const town = readPng(TOWN_PATH);
    expect([sheet.width, sheet.height]).toEqual([480, 512]);
    expect(Buffer.compare(sheet.data.subarray(0, HALF_BYTES), town.data)).toBe(0);
  });

  it("아래 반쪽은 레트로 월드맵의 키 색만 알파 0 으로 뚫고 나머지 픽셀은 그대로다", () => {
    const sheet = readPng(SHEET_PATH);
    const retro = readPng(RETRO_PATH);
    const bottom = sheet.data.subarray(HALF_BYTES);
    let keyed = 0;
    let leakedKey = 0;
    for (let offset = 0; offset < retro.data.length; offset += 4) {
      const isKey = retro.data[offset] === RETRO_KEY[0] && retro.data[offset + 1] === RETRO_KEY[1] && retro.data[offset + 2] === RETRO_KEY[2];
      if (isKey) {
        keyed += 1;
        expect(bottom[offset + 3]).toBe(0);
        continue;
      }
      expect(bottom.subarray(offset, offset + 4)).toEqual(retro.data.subarray(offset, offset + 4));
      if (bottom[offset + 3] > 0 && bottom[offset] === RETRO_KEY[0] && bottom[offset + 1] === RETRO_KEY[1] && bottom[offset + 2] === RETRO_KEY[2]) leakedKey += 1;
    }
    // 원본은 투명 픽셀이 0개였다 — 뚫린 픽셀이 없다면 키 처리가 통째로 빠진 것이다.
    expect(keyed).toBeGreaterThan(10_000);
    expect(leakedKey).toBe(0);
  });
});

describe("합본 마을 + 레트로 월드맵 혼합 칩셋 — 번들 등록", () => {
  it("번들 칩셋 목록에 확장 시트 칸 수로 등록된다", () => {
    const asset = findBundledImageAsset(COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY);
    expect(asset).toMatchObject({ path: SHEET_PATH.replace("public/", ""), name: COMBINED_TOWN_RETRO_WORLD_NAME });
    expect(BUNDLED_EASYRPG_CHIPSET_ASSETS.some((entry) => entry.textureKey === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY)).toBe(true);
    expect(bundledChipsetFrameCount(COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY)).toBe(COMBINED_TOWN_RETRO_WORLD_TILE_COUNT);
    expect(bundledChipsetSheetHeight(COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY)).toBe(512);
    // 원본 둘은 그대로 480칸이다 — 혼합 칩셋은 덧붙이는 것이고 원본을 바꾸지 않는다.
    expect(bundledChipsetFrameCount(RETRO_WORLD_TEXTURE_KEY)).toBe(480);
    expect(bundledChipsetSheetHeight(RETRO_WORLD_TEXTURE_KEY)).toBe(256);
  });

  it("자료 보관함 프로필의 세로 크기가 실제 시트와 같다", () => {
    const project = createBlankProject();
    const profile = project.resourceProfiles.find((entry) => entry.assetId === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY);
    expect(profile).toMatchObject({ kind: "chipset", imageWidth: 480, imageHeight: 512, tileWidth: 16, tileHeight: 16 });
  });
});

describe("합본 마을 + 레트로 월드맵 혼합 칩셋 — 타일셋 정의", () => {
  const project = createBlankProject();
  // 스토어가 프로젝트를 열 때 하는 정규화와 같다 — 비교 대상(단독 레트로 월드맵)은 이 상태가 정본이다.
  ensureTilesetHarnesses(project);
  const mixed = project.tilesets[COMBINED_TOWN_RETRO_WORLD_TILESET_ID]!;
  const town = project.tilesets[DEFAULT_TILESET_ID]!;
  const retro = project.tilesets.easyrpg_chipset_retro_world!;

  it("새 프로젝트에 960칸 custom 타일셋으로 들어 있다", () => {
    expect(mixed).toMatchObject({
      name: COMBINED_TOWN_RETRO_WORLD_NAME,
      image: { type: "bundled", id: COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY },
      kind: "custom",
      tileSize: 16,
      tilesPerRow: 30,
      count: 960,
    });
    expect(mixed.passability).toHaveLength(960);
    expect(mixed.priority).toHaveLength(960);
    expect(mixed.terrain).toHaveLength(960);
    expect(mixed.tileMeta).toHaveLength(960);
  });

  it("위 480칸은 합본 마을 정의와 칸별로 같다(통행·레이어·지형·라벨·그룹)", () => {
    expect(mixed.passability.slice(0, 480)).toEqual(town.passability);
    expect(mixed.priority.slice(0, 480)).toEqual(town.priority);
    expect(mixed.terrain.slice(0, 480)).toEqual(town.terrain);
    expect(mixed.tileMeta!.slice(0, 480)).toEqual(town.tileMeta);
    expect(mixed.tileGroups).toEqual(town.tileGroups);
    // 합본 마을이 런타임 폴백으로 받는 내장 오토타일을 이 타일셋은 데이터로 지닌다.
    expect(mixed.autotileGroups).toEqual([...autotileGroupsForTileset(town)]);
    expect(mixed.autotileGroups!.length).toBeGreaterThan(0);
    for (const group of mixed.autotileGroups!) {
      for (const tile of group.memberTileIds) expect(isCombinedTownHalfTile(tile)).toBe(true);
    }
  });

  it("아래 480칸은 레트로 월드맵 정의를 +480 으로 옮긴 것이다", () => {
    expect(mixed.passability.slice(480)).toEqual(retro.passability);
    expect(mixed.priority.slice(480)).toEqual(retro.priority);
    expect(mixed.terrain.slice(480)).toEqual(retro.terrain);
    expect(mixed.tileMeta!.slice(480)).toEqual(retro.tileMeta);
    // 레트로 월드맵 시맨틱 라벨이 실제로 옮겨 왔는지 — 빈 메타만 960개면 조립이 헛돈 것이다.
    const labelled = mixed.tileMeta!.slice(480).filter((meta) => meta.label.trim().length > 0).length;
    expect(labelled).toBeGreaterThan(400);
    expect(mixed.tileMeta![RETRO_WORLD_TILE_OFFSET + 240]!.label).toBe(retro.tileMeta![240]!.label);
  });

  it("합본 마을 전용 판정에는 걸리지 않고 혼합 칩셋 판정에만 걸린다", () => {
    expect(isCombinedTownTileset(mixed)).toBe(false);
    expect(isCombinedTownRetroWorldTileset(mixed)).toBe(true);
    expect(isCombinedTownRetroWorldTileset(town)).toBe(false);
    expect(isCombinedTownRetroWorldTileset(retro)).toBe(false);
  });

  it("생성 직후와 로드 후가 같다 — 하네스 재적용이 정의를 흔들지 않는다(멱등)", () => {
    const fresh = createBlankProject().tilesets[COMBINED_TOWN_RETRO_WORLD_TILESET_ID]!;
    const before = JSON.stringify(fresh);
    expect(ensureTilesetHarnesses({ tilesets: { [fresh.id]: fresh } })).toBe(false);
    expect(JSON.stringify(fresh)).toBe(before);
    expect(JSON.stringify(mixed)).toBe(before);
  });

  it("옛 저장본에 없으면 ensureBundledTilesets 가 채워 넣고, 두 번째부터는 손대지 않는다", () => {
    const legacy = { tilesets: defaultTilesets() };
    delete legacy.tilesets[COMBINED_TOWN_RETRO_WORLD_TILESET_ID];
    expect(ensureBundledTilesets(legacy)).toBe(true);
    expect(legacy.tilesets[COMBINED_TOWN_RETRO_WORLD_TILESET_ID]?.count).toBe(960);
    const once = JSON.stringify(legacy.tilesets[COMBINED_TOWN_RETRO_WORLD_TILESET_ID]);
    // 반환값은 보지 않는다 — 다른 번들 칩셋의 하네스가 내용 변화 없이 true 를 돌려주는 일이 있다(별건).
    ensureBundledTilesets(legacy);
    expect(JSON.stringify(legacy.tilesets[COMBINED_TOWN_RETRO_WORLD_TILESET_ID])).toBe(once);
  });

  it("물 애니는 합본 마을 반쪽만 돈다 — 레트로 월드맵 반쪽은 단독 시트와 같이 정지", () => {
    expect(supportsChipsetTileAnimation(mixed, 120)).toBe(true);
    expect(supportsChipsetTileAnimation(mixed, 0)).toBe(true);
    expect(supportsChipsetTileAnimation(mixed, RETRO_WORLD_TILE_OFFSET + 120)).toBe(false);
    expect(supportsChipsetTileAnimation(retro, 120)).toBe(false);
  });

  it("generate_map 이 합본 마을 프로필(settlement)로 이 타일셋에 맵을 만든다 — 생성 결과는 위 반쪽 번호만 쓴다", () => {
    // generateMap.test 의 번들 순회는 Tibo(프로필 없음, 별건)에서 먼저 멈추므로 여기서 직접 확인한다.
    const ctx: ToolContext = { project: createEmptyToolProject() };
    ensureBundledTilesets(ctx.project);
    const result = runTool(ctx, "generate_map", {
      id: "map_mixed",
      name: "혼합 칩셋 마을",
      theme: "village",
      tilesetId: COMBINED_TOWN_RETRO_WORLD_TILESET_ID,
      width: 20,
      height: 16,
      seed: 7,
      border: "wall",
    });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { mapId: string; generationProfile: string };
    expect(data.generationProfile).toBe(COMBINED_TOWN_RETRO_WORLD_TILESET_ID);
    const map = ctx.project.maps[data.mapId]!;
    expect(map.tilesetId).toBe(COMBINED_TOWN_RETRO_WORLD_TILESET_ID);
    expect(map.lowerTiles.every((tile) => isCombinedTownHalfTile(tile))).toBe(true);
    expect(map.upperTiles.every((tile) => tile === -1 || isCombinedTownHalfTile(tile))).toBe(true);
    expect(new Set(map.lowerTiles).size).toBeGreaterThanOrEqual(2);
  });

  it("480칸 규격이 아닌 원본으로는 조립을 거절한다", () => {
    const broken: TilesetDef = { ...town, count: 479, passability: town.passability.slice(0, 479) };
    expect(() => composeCombinedTownRetroWorldTileset(broken, retro)).toThrow(/480칸/);
    expect(() => composeCombinedTownRetroWorldTileset(town, broken)).toThrow(/480칸/);
  });
});
