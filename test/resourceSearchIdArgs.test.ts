// 검색 id(backdrop:…)를 리소스 칸에 넣어도 받아 준다 — 2026-09-24 꿈 세계 dream-6.
import { describe, expect, it } from "vitest";
import { stripResourceSearchIdPrefixes } from "@/editor/tools/resourceSearchIdArgs";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { searchResources } from "@/assets/resourceSearch";

describe("backdrop 검색 id", () => {
  it("리소스 칸의 backdrop: 접두만 걷는다", () => {
    expect(stripResourceSearchIdPrefixes({ backgroundResourceId: "backdrop:x", title: "backdrop:x", presentation: { backgroundResourceId: "backdrop:y" } }))
      .toEqual({ backgroundResourceId: "x", title: "backdrop:x", presentation: { backgroundResourceId: "y" } });
  });

  it("set_title_screen 이 검색 결과 id 를 그대로 받아 배경을 건다", () => {
    const hit = searchResources("backdrop", "sky")[0]!;
    expect(hit.id.startsWith("backdrop:")).toBe(true);
    expect(hit.resourceId).toBe(hit.id.slice("backdrop:".length));
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "set_title_screen", { title: "잠의 서랍", backgroundResourceId: hit.id });
    expect(result.ok, result.summary + JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.system.titleScreen?.backgroundResourceId).toBe(hit.resourceId);
  });
});
