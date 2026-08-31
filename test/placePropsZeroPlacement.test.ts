import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import type { Project } from "@/project/types";

// 라이브 QA 사고: fill_region 이 '키큰 풀'로 덮은 영역에 place_props 로 침엽수를 220개 요청하면
// 0그루가 놓이는데도 ok=true 로 끝나, 나무 한 그루 없는 "빽빽한 숲"이 완성으로 보고됐다.

function preparedProject(): { readonly ctx: { project: Project }; readonly mapId: string } {
  const project = createBlankProject();
  const ctx = { project };
  const mapId = project.startMapId;
  expect(runTool(ctx, "resize_map", { mapId, width: 100, height: 100 }).ok).toBe(true);
  return { ctx, mapId };
}

const FOREST = { x: 65, y: 5, w: 30, h: 30 };

describe("place_props zero placement", () => {
  it("fails with an actionable message when the region leaves no room", () => {
    const { ctx, mapId } = preparedProject();
    expect(runTool(ctx, "fill_region", { mapId, rect: FOREST, material: "키큰 풀" }).ok).toBe(true);

    const result = runTool(ctx, "place_props", {
      mapId,
      area: FOREST,
      material: "침엽수",
      count: 220,
      packing: "dense",
      minGap: 0,
      seed: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("placement-zero");
    expect(`${result.summary}`).toMatch(/한 개도 놓지 못했습니다/);
    expect(`${result.summary}`).toMatch(/tile_erase/);
  });

  it("still succeeds on an open region and reports partial placement as success", () => {
    const { ctx, mapId } = preparedProject();

    const result = runTool(ctx, "place_props", {
      mapId,
      area: FOREST,
      material: "침엽수",
      count: 220,
      packing: "dense",
      minGap: 0,
      seed: 5,
    });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    const data = result.data as { readonly placed: number };
    expect(data.placed).toBeGreaterThan(0);
  });
});
