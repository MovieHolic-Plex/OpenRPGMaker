import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { registerCompletedHouse } from "@/editor/tools/houseProtection";
import { serialize } from "@/project/io";
import { completedHouseProject, houseMap, HOUSE_RECT, mutateProject } from "./fixtures/completedHouse";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";

function emptyContext() {
  const project = completedHouseProject();
  const map = houseMap(project);
  delete map.layoutPlan;
  map.lowerTiles.fill(240);
  map.upperTiles.fill(-1);
  return { project };
}

describe("completed house transaction invariant", () => {
  it.each([false, true])("rolls back maps, events and tree additions atomically (dryRun=%s)", (dryRun) => {
    const ctx = { project: completedHouseProject() };
    const before = serialize(ctx.project);
    const original = ctx.project;
    const result = mutateProject(ctx, (draft) => {
      const map = houseMap(draft);
      map.upperTiles[3 * map.width + 3] = -1;
      map.events.push({ id: "new_event", x: 1, y: 1, trigger: { kind: "action" }, commands: [] });
      draft.maps.new_map = { ...structuredClone(map), id: "new_map", events: [] };
      draft.mapTree.children.push({ mapId: "new_map", children: [] });
    }, dryRun);
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(result.ok).toBe(false);
    expect(ctx.project).toBe(original);
    expect(serialize(ctx.project)).toBe(before);
  });

  it("catches tree-repair spillover into a protected house on the map a tool edits, and leaves trees on other maps alone", () => {
    // 나무 짝 보정(밑동 290 위에 수관 260)은 합본 마을 칩셋의 것이라 집 맵을 그 칩셋 위에 둔다. 기본 칩셋(버들항)에서는 보정이 돌지 않고,
    // 픽스처가 깐 TILE.GRASS(240)는 버들항에서 벽이라 create_map 이 start-position 경고만 냈다.
    const withOrphanTrunk = () => {
      const project = completedHouseProject();
      withRetiredEasyRpgTilesets(project);
      const map = houseMap(project);
      map.tilesetId = RETIRED_COMBINED_TOWN_TILESET_ID;
      map.lowerTiles[7 * map.width + 3] = 290; // repair would put a canopy on the protected upper cell (3,6)
      return { project };
    };
    // 실행기는 도구가 타일을 바꾼 맵에서만 나무를 보정한다(toolRunner — «Event/DB/name edits must not normalize trees in this or any other map»).
    // 그 맵에서 보정이 집 안으로 넘치면 쓰기 전체를 되돌린다.
    const sameMap = withOrphanTrunk();
    const before = serialize(sameMap.project);
    const blocked = mutateProject(sameMap, (draft) => {
      const map = houseMap(draft);
      map.lowerTiles[12 * map.width + 12] = 241;
    });
    expect(blocked.issues?.[0]?.code).toBe("protected-house-write");
    expect(blocked.ok).toBe(false);
    expect(serialize(sameMap.project)).toBe(before);
    // 다른 맵을 만드는 도구는 집 맵의 나무를 건드리지 않는다 — 넘칠 보정이 없으니 도구는 성공하고 집 맵의 칸은 그대로다.
    const otherMap = withOrphanTrunk();
    const house = houseMap(otherMap.project);
    const lower = [...house.lowerTiles], upper = [...house.upperTiles];
    const created = runTool(otherMap, "create_map", { id: "elsewhere", name: "Elsewhere", width: 10, height: 10 });
    expect(created.ok, created.summary).toBe(true);
    expect(otherMap.project.maps.elsewhere).toBeDefined();
    expect(houseMap(otherMap.project).lowerTiles).toEqual(lower);
    expect(houseMap(otherMap.project).upperTiles).toEqual(upper);
  });

  it("does not allow removing metadata and then destroying the house", () => {
    const ctx = { project: completedHouseProject() };
    const before = serialize(ctx.project);
    const result = mutateProject(ctx, (draft) => {
      const map = houseMap(draft);
      delete map.layoutPlan;
      map.upperTiles.fill(-1);
      map.lowerTiles.fill(240);
    });
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("rejects new overlapping house geometry even with identical tile IDs", () => {
    const ctx = { project: completedHouseProject() };
    const before = serialize(ctx.project);
    const result = mutateProject(ctx, (draft) => {
      houseMap(draft).layoutPlan?.regions.push({ id: "new_house", role: "house", label: "Overlap", ...HOUSE_RECT });
    });
    expect(result.issues?.[0]?.code).toBe("house-overlap");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("rejects overlap between two newly recorded houses, including only their ridge", () => {
    const ctx = emptyContext();
    const before = serialize(ctx.project);
    const result = mutateProject(ctx, (draft) => {
      houseMap(draft).layoutPlan = { version: 1, kind: "new", regions: [
        { id: "a", role: "house", label: "A", x: 2, y: 2, w: 4, h: 4 },
        { id: "b", role: "house", label: "B", x: 2, y: 6, w: 4, h: 4 },
      ] };
    });
    expect(result.issues?.[0]?.code).toBe("house-overlap");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("allows unrelated edits and safe dry-run without changing the original project", () => {
    const ctx = { project: completedHouseProject() };
    const before = serialize(ctx.project);
    const args = { mapId: ctx.project.startMapId, x: 12, y: 10, w: 2, h: 2, fill: "empty" };
    expect(runTool(ctx, "clear_region", args, { dryRun: true }).ok).toBe(true);
    expect(serialize(ctx.project)).toBe(before);
    expect(runTool(ctx, "clear_region", args).ok).toBe(true);
    expect(houseMap(ctx.project).lowerTiles[10 * houseMap(ctx.project).width + 12]).toBe(-1);
  });

  // 2026-09-24 감성 스토리 r3: 집이 등록된 중복·고아 맵을 remove_map 으로 지우려 했지만 집 보호가
  // 막아 12개 unreachable 맵이 정리되지 못했다. 집 보호는 살아 있는 맵의 셀 편집을 막는다 —
  // 맵 통째 삭제는 시작맵 가드·무결성 왕복·(에디터) 맵 파괴 승인의 소관이다.
  it("집이 있는 별도 맵을 remove_map 으로 지운다", () => {
    const ctx = { project: completedHouseProject() };
    const created = runTool(ctx, "create_map", { id: "map_village", name: "마을", width: 12, height: 10 });
    expect(created.ok, created.summary).toBe(true);
    const village = ctx.project.maps.map_village!;
    registerCompletedHouse(ctx.project, village, { label: "강가 집", x: 2, y: 2, w: 5, h: 5 });

    const removed = runTool(ctx, "remove_map", { mapId: "map_village" });

    expect(removed.ok, JSON.stringify(removed.issues)).toBe(true);
    expect(ctx.project.maps.map_village).toBeUndefined();
  });
});
