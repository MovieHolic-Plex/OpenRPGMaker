// 파라메트릭 집 스탬프(2026-07-20, kind:"house") — 스키마 유니언·정본 전개·선반/도구 접점.
import { describe, expect, it } from "vitest";
import { BUILTIN_HOUSE_STRUCTURE_KITS, builtinHouseStructureKitsFor } from "@/editor/harnessSuggestion/builtinHouseStructureKits";
import {
  expandHouseStructureKit,
  paletteStampFromKit,
  structureKitRepeatable,
  structureKitSignature,
  structureKitSize,
} from "@/editor/harnessSuggestion/structureKitModel";
import { CHIMNEY_TILE } from "@/editor/houseKit";
import { createEmptyToolProject, runTool } from "@/editor/tools";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

const GRASS = 240;

// runTool은 커밋 시 context.project를 재할당한다 — 항상 context를 통해 읽을 것.
function townContext(): { context: { project: Project }; mapId: string } {
  const project = createEmptyToolProject("집 스탬프 테스트");
  const context = { project };
  const created = runTool(context, "create_map", { name: "스탬프맵", width: 24, height: 20 });
  expect(created.ok).toBe(true);
  const mapId = Object.keys(context.project.maps)[0]!;
  context.project.maps[mapId]!.lowerTiles.fill(GRASS);
  context.project.maps[mapId]!.upperTiles.fill(-1);
  return { context, mapId };
}

describe("HouseStructureKitDef — 파라메트릭 전개", () => {
  it("내장 킷 6종이 combined_town 타일셋에서만 노출된다", () => {
    expect(BUILTIN_HOUSE_STRUCTURE_KITS).toHaveLength(6);
    expect(builtinHouseStructureKitsFor({ id: DEFAULT_TILESET_ID })).toHaveLength(6);
    expect(builtinHouseStructureKitsFor({ id: "easyrpg_chipset_interior" })).toHaveLength(0);
  });

  it("전개 셀에 벽·지붕·문 타일이 실리고 크기는 날개 bbox", () => {
    const kit = BUILTIN_HOUSE_STRUCTURE_KITS.find((entry) => entry.houseKitId === "blue-stone")!;
    expect(structureKitSize(kit)).toEqual({ width: 9, height: 8 });
    expect(structureKitRepeatable(kit)).toBe(false);

    const cells = expandHouseStructureKit(kit);
    expect(cells.length).toBeGreaterThan(40);
    const doorTiles = cells.filter((cell) => cell.tile === 116 || cell.tile === 146);
    expect(doorTiles).toHaveLength(2);
    // 내장 킷은 굴뚝 포함
    expect(cells.some((cell) => cell.layer === "upper" && cell.tile === CHIMNEY_TILE)).toBe(true);

    const stamp = paletteStampFromKit(kit);
    expect(stamp).toMatchObject({ width: 9, height: 8, kitId: kit.id });
    expect(stamp.cells).toEqual(cells);
  });

  it("서명이 결정적이고 킷마다 다르다(중복 등록 차단 규약)", () => {
    const signatures = BUILTIN_HOUSE_STRUCTURE_KITS.map((kit) => structureKitSignature(kit));
    expect(new Set(signatures).size).toBe(signatures.length);
    expect(structureKitSignature(BUILTIN_HOUSE_STRUCTURE_KITS[0]!)).toBe(structureKitSignature(BUILTIN_HOUSE_STRUCTURE_KITS[0]!));
  });
});

describe("stamp_structure_kit — 집 킷 시공", () => {
  it("내장 집 킷을 origin에 1회 시공하고 repeat는 무시한다(한 채 완결 단위)", () => {
    const { context, mapId } = townContext();
    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_house_blue-stone",
      origin: { x: 3, y: 2 },
      repeat: 3,
    });
    expect(result.ok).toBe(true);
    expect((result.data as { repeat: number }).repeat).toBe(1);

    const map = context.project.maps[mapId]!;
    // 문 타일(남쪽 벽 중앙): x = 3+4 = 7, y = 2+7 = 9
    expect(map.lowerTiles[9 * map.width + 7]).toBe(146);
    expect(map.lowerTiles[8 * map.width + 7]).toBe(116);
    // repeat 무시 — 두 번째 채가 있을 자리(x=12 이후 열)는 잔디 그대로
    expect(map.lowerTiles[9 * map.width + 3 + 9 + 4]).toBe(GRASS);
  });
});
