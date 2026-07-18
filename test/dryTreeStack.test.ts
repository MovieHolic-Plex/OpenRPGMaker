// 마른나무(261) 세로 스택 허용 회귀 — 2026-07-16 사용자 버그 리포트.
// 261은 상위 레이어 수관이라 위아래로 연속 배치할 수 있어야 한다(체인 끝은 291).
import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";

describe("dry-tree vertical stack", () => {
  function projectWithStack(tiles: readonly (readonly [number, number, number])[]) {
    const ctx: ToolContext = { project: createEmptyToolProject("마른나무 스택") };
    const made = runTool(ctx, "create_map", { name: "스택 맵", width: 12, height: 12 });
    const mapId = (made.data as { mapId: string }).mapId;
    const map = ctx.project.maps[mapId]!;
    for (const [tile, x, y] of tiles) map.upperTiles[y * map.width + x] = tile;
    return ctx.project;
  }

  it("261을 세로로 이어 붙여도 (체인 끝 291) 하드 위반이 아니다", () => {
    const project = projectWithStack([
      [261, 5, 3],
      [261, 5, 4],
      [261, 5, 5],
      [291, 5, 6],
    ]);
    const violations = validateClusterRules(project).filter((v) => v.rule.id.includes("dry_tree"));
    expect(violations, JSON.stringify(violations.map((v) => v.coords))).toHaveLength(0);
  });

  it("체인이 291로 끝나지 않으면 여전히 위반이다", () => {
    const project = projectWithStack([
      [261, 5, 3],
      [261, 5, 4],
    ]);
    const violations = validateClusterRules(project).filter((v) => v.rule.id.includes("dry_tree"));
    expect(violations.length).toBeGreaterThan(0);
  });
});
