// 칩셋 표면 계약(tilesetSurface) — 번들마다 선언한 길 칸이 실제로 풀리고, 선언한 «새 길 재료»로 깐 칸을 길로 읽는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { SURFACES, tilesetSurface } from "@/project/tilesetSurface";
import type { ToolContext } from "@/editor/tools/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { isRoadCell, roadMaterial, surfaceKind } from "@/ai/v2/place/surface";

describe("칩셋 표면 계약", () => {
  it("선언한 번들 칩셋마다 길 칸이 있고, 까는 재료의 오토타일 묶음은 모두 길 칸이다", () => {
    const project = createBlankProject();
    for (const [id, decl] of Object.entries(SURFACES)) {
      const tileset = project.tilesets[id];
      expect(tileset, id).toBeDefined();
      const surface = tilesetSurface(tileset);
      expect(surface.declared, id).toBe(true);
      expect(surface.road.size, id).toBeGreaterThan(0);
      expect(surface.lay.length, id).toBe(decl.lay?.length ?? 0);
      for (const { material, tiles } of surface.lay) expect([...tiles].every((t) => surface.road.has(t)), `${id} ${material}`).toBe(true);
    }
  }, 60_000);

  it("선언한 재료로 깐 길을 길로 읽는다(깔기와 읽기가 같은 선언)", () => {
    for (const id of ["snow_north", "pirate_isles", "sf_station", "wasteland_ruins", "wizarding_world"]) {
      const project = createBlankProject();
      const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
      const run = createBuildRun(ctx);
      const mapId = (run.call("create_map", { name: `표면 ${id}`, width: 16, height: 12, tilesetId: id }).data as { mapId: string }).mapId;
      for (const { material } of tilesetSurface(run.ctx.project.tilesets[id]).lay) {
        const res = run.call("fill_region", { mapId, material, rect: { x: 2, y: 5, w: 10, h: 2 }, _exactCells: true });
        expect(res.ok, `${id} ${material}: ${String(res.summary)}`).toBe(true);
        const map = run.ctx.project.maps[mapId]!;
        for (let x = 2; x < 12; x++) expect(isRoadCell(run.ctx.project, map, x, 5), `${id} ${material} (${x},5)`).toBe(true);
        expect(roadMaterial(run.ctx.project, map), id).toBeDefined();
        expect(surfaceKind(run.ctx.project, map, 4, 5)).toBe("road");
        expect(surfaceKind(run.ctx.project, map, 4, 1)).not.toBe("road");
      }
    }
  }, 180_000);

  it("선언 없는 칩셋은 꼬리표·이름표의 길 낱말로 읽는다(물·벽·풀 이름표는 뺀다)", () => {
    const meta = [{ label: "풀밭" }, { label: "흙길" }, { label: "돌", tags: ["road"] }, { label: "물가 길" }, { label: "성벽길" }].map((m) => ({ description: "", ...m }));
    const surface = tilesetSurface({ id: "user_upload", tileMeta: meta, autotileGroups: [] });
    expect(surface.declared).toBe(false);
    expect([...surface.road].sort()).toEqual([1, 2]);
    expect(surface.lay).toEqual([]);
  });
});
