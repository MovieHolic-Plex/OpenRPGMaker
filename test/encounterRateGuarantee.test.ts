import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import type { GameMap, Project } from "@/project/types";

// 라이브 QA 사고: AI가 인카운터 테이블·사냥터까지 다 깔았는데 맵 encounterRate 가 0으로 남아
// playSceneMovement 의 `rate <= 0` 게이트에 막혀 "몬스터가 나와야함" 요구가 조용히 실패했다.
// 테이블을 세우는 툴은 발생률까지 같이 보장해야 한다.

function mapOf(project: Project, mapId: string): GameMap {
  const map = project.maps[mapId];
  if (map === undefined) throw new Error(`Missing test map: ${mapId}`);
  return map;
}

function preparedProject(): { readonly project: Project; readonly mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  mapOf(project, mapId).encounterRate = 0;
  return { project, mapId };
}

const ENTRY = { troopId: "troop_slime", weight: 1 };

describe("set_encounter_table keeps the table alive", () => {
  it("lifts a zero encounter rate so the table can actually fire", () => {
    const { project, mapId } = preparedProject();
    const ctx = { project };

    const result = runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY] });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    const map = mapOf(ctx.project, mapId);
    expect(map.encounterTable).toHaveLength(1);
    expect(map.encounterRate ?? 0).toBeGreaterThan(0);
    expect(result.summary).toMatch(/인카운터율/);
  });

  it("keeps an author-chosen rate instead of overwriting it", () => {
    const { project, mapId } = preparedProject();
    mapOf(project, mapId).encounterRate = 7;
    const ctx = { project };

    expect(runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY] }).ok).toBe(true);

    expect(mapOf(ctx.project, mapId).encounterRate).toBe(7);
  });

  it("honors an explicit rate, including an explicit zero", () => {
    const { project, mapId } = preparedProject();
    const ctx = { project };

    expect(runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY], encounterRate: 40 }).ok).toBe(true);
    expect(mapOf(ctx.project, mapId).encounterRate).toBe(40);

    expect(runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY], encounterRate: 0 }).ok).toBe(true);
    expect(mapOf(ctx.project, mapId).encounterRate).toBe(0);

    const rejected = runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY], encounterRate: -3 });
    expect(rejected.ok).toBe(false);
  });

  it("leaves the rate alone when the table is cleared", () => {
    const { project, mapId } = preparedProject();
    const ctx = { project };

    expect(runTool(ctx, "set_encounter_table", { mapId, entries: [] }).ok).toBe(true);

    const map = mapOf(ctx.project, mapId);
    expect(map.encounterTable).toBeUndefined();
    expect(map.encounterRate ?? 0).toBe(0);
  });
});

describe("make_hunting_ground keeps the table alive", () => {
  it("lifts a zero encounter rate alongside the field spawn", () => {
    const { project, mapId } = preparedProject();
    const ctx = { project };

    const result = runTool(ctx, "make_hunting_ground", {
      mapId,
      area: { x: 2, y: 2, w: 6, h: 6 },
      troopId: "troop_slime",
    });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    const map = mapOf(ctx.project, mapId);
    expect(map.fieldSpawns ?? []).toHaveLength(1);
    expect(map.encounterTable ?? []).toHaveLength(1);
    expect(map.encounterRate ?? 0).toBeGreaterThan(0);
  });
});
