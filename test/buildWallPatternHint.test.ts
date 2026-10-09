// 2026-09-24 추격 호러 도그푸딩: 실내 칩셋의 패턴 없는 벽으로 build_wall 을 8번 반복했다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

describe("build_wall 패턴 없는 벽 재료", () => {
  it("쓸 수 있는 경로(place_concept)를 짚고 같은 재료 재시도를 막는다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const set = runTool(ctx, "set_map_properties", { mapId, tilesetId: "easyrpg_chipset_interior" });
    expect(set.ok, set.summary).toBe(true);
    const result = runTool(ctx, "build_wall", { mapId, rect: { x: 0, y: 0, w: 20, h: 2 }, material: "크림 회벽" });
    expect(result.ok).toBe(false);
    const text = [result.summary, ...(result.issues ?? []).map((issue) => issue.message)].join(" ");
    expect(text).toContain("place_concept");
    expect(text).toContain("같은 재료로 다시 부르지 마세요");
    expect(text).not.toContain("T1b 위저드");
  });
});
