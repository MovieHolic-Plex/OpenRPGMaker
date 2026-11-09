import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { adventureCompletionProblems } from "@/ai/adventureCompletion";
import { VILLAGE_POOL, isBareVillageRequest, localizeVillagePoolSpec, pickVillageChipset } from "@/ai/villageChipsetPool";
import { VILLAGE_POOL_BUILDER } from "@/ai/v2/builders/villagePool";
import { builderFor } from "@/ai/v2/builders";

function project() {
  const p = createBlankProject();
  ensureBundledTilesets(p);
  return p;
}

describe("테마 없는 마을의 칩셋 풀", () => {
  it("테마·칩셋 낱말이 있으면 풀 밖이고, 마을만 말하면 풀 안이다", () => {
    for (const text of ["조선 마을 만들어 줘", "사막 오아시스 마을", "버들항 마을 만들어 줘", "눈 덮인 마을", "어촌 마을", "숲속 마을", "던전"]) expect(isBareVillageRequest(text), text).toBe(false);
    for (const text of ["마을 하나 만들어 줘", "마을을 만들어줘", "village"]) expect(isBareVillageRequest(text), text).toBe(true);
  });

  it("같은 프로젝트 열쇠는 늘 같은 칩셋을, 열쇠가 다르면 여러 칩셋을 고른다", () => {
    const p = project();
    const picks = Array.from({ length: 200 }, (_, i) => pickVillageChipset(p, `game-${i}`, "마을 하나 만들어 줘"));
    expect(pickVillageChipset(p, "game-7", "마을 하나 만들어 줘")).toEqual(picks[7]);
    const chipsets = new Set(picks.map((pick) => pick?.entry.tilesetId ?? "beodeul_city"));
    expect(chipsets.size).toBe(VILLAGE_POOL.length);
  });

  it("열쇠가 없거나 마을 종류 표가 잡는 요청이면 풀을 끼지 않는다", () => {
    const p = project();
    expect(pickVillageChipset(p, undefined, "마을 하나 만들어 줘")).toBeNull();
    expect(pickVillageChipset(p, "  ", "마을 하나 만들어 줘")).toBeNull();
    for (const text of ["수도원 마을 만들어 줘", "장터 마을 만들어 줘", "엘프 마을 만들어 줘"]) {
      for (let i = 0; i < 30; i += 1) expect(pickVillageChipset(p, `k${i}`, text), text).toBeNull();
    }
  });

  it("풀 칩셋으로 이미 손댄 맵이 있으면 같은 칩셋을 이어 쓴다", () => {
    const p = project();
    const first = Array.from({ length: 80 }, (_, i) => `k${i}`).map((k) => ({ k, pick: pickVillageChipset(p, k, "마을 하나 만들어 줘") })).find((row) => row.pick)!;
    const map = p.maps[p.startMapId]!;
    map.tilesetId = first.pick!.entry.tilesetId;
    map.lowerTiles[0] = map.lowerTiles[0]! + 1;
    expect(pickVillageChipset(p, first.k, "마을 하나 만들어 줘")?.entry.tilesetId).toBe(first.pick!.entry.tilesetId);
  });

  it("이미 손댄 야외 맵이 있으면 칩셋을 바꾸지 않는다", () => {
    const p = project();
    const key = Array.from({ length: 50 }, (_, i) => `k${i}`).find((k) => pickVillageChipset(p, k, "마을 하나 만들어 줘"))!;
    expect(pickVillageChipset(p, key, "마을 하나 만들어 줘")).not.toBeNull();
    const start = p.maps[p.startMapId]!;
    start.lowerTiles[0] = start.lowerTiles[0]! + 1;
    expect(pickVillageChipset(p, key, "마을 하나 만들어 줘")).toBeNull();
  });

  it("v2: 스타일·테마 없는 마을 명세만 풀 빌더로 가고, 말한 스타일은 그대로 둔다", () => {
    const p = project();
    const key = Array.from({ length: 50 }, (_, i) => `k${i}`).find((k) => pickVillageChipset(p, k, "마을 하나 만들어 줘"))!;
    const spec = localizeVillagePoolSpec({ type: "village", name: "시작 마을" }, p, key, "마을 하나 만들어 줘");
    expect(builderFor(spec as never)?.id).toBe(VILLAGE_POOL_BUILDER.id);
    expect(localizeVillagePoolSpec({ type: "village", name: "마을", style: "joseon" }, p, key, "마을 하나 만들어 줘").style).toBe("joseon");
    expect(localizeVillagePoolSpec({ type: "village", name: "마을", theme: "snow" }, p, key, "마을 하나 만들어 줘").style).toBeUndefined();
    expect(localizeVillagePoolSpec({ type: "dungeon", name: "굴" }, p, key, "마을 하나 만들어 줘").style).toBeUndefined();
  });
});

describe("마을 완료 검사", () => {
  it("배치된 집(입구 있는 키트)이 있으면 role 타일이 없어도 마을 구조로 센다", () => {
    const p = project();
    const start = p.maps[p.startMapId]!;
    const ts = p.tilesets[start.tilesetId]!;
    const kit = ts.structureKits!.find((k) => k.kind === "section" && k.parts?.some((part) => part.kind === "entrance"))!;
    const required = { village: true, dungeon: false, party: false, battle: false };
    expect(adventureCompletionProblems(p, required).some((m) => m.includes("건물/벽/지붕 구조"))).toBe(true);
    start.structurePlacements = [{ id: "pl1", kitId: kit.id, x: 1, y: 1, w: kit.width, h: kit.height, before: { lower: [], upper: [] }, afterHash: "" }];
    expect(adventureCompletionProblems(p, required).some((m) => m.includes("건물/벽/지붕 구조"))).toBe(false);
  });
});
