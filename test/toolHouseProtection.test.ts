import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { registerCompletedHouse } from "@/editor/tools/houseProtection";
import { serialize } from "@/project/io";
import { completedHouseProject, houseMap, HOUSE_RECT, mutateProject } from "./fixtures/completedHouse";

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

  it("catches global tree-repair spillover even when the tool edits another map", () => {
    const ctx = { project: completedHouseProject() };
    const map = houseMap(ctx.project);
    map.lowerTiles[7 * map.width + 3] = 290; // repair would overwrite protected upper at (3,6)
    const before = serialize(ctx.project);
    const result = runTool(ctx, "create_map", { id: "elsewhere", name: "Elsewhere", width: 10, height: 10 });
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
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
