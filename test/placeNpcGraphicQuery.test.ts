// 실사용 감사 로그(2026-07-04) 회귀: place_npc가 graphic.query="people1"로 실패했고
// 실패 요약에 원인이 없어 추적이 어려웠다. 시트명 질의 해석 + 실패 요약 원인 포함을 고정한다.
import { describe, expect, it } from "vitest";
import { resolveGraphicQuery } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

describe("place_npc graphic.query", () => {
  it("resolveGraphicQuery('people1')가 people1 시트 그래픽을 만든다", () => {
    const graphic = resolveGraphicQuery("people1");
    expect(graphic.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_people1" });
  });

  it("감사 로그의 place_npc 호출이 이제 성공한다", () => {
    const project = createBlankProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "place_npc", {
      mapId: project.startMapId,
      x: 2,
      y: 2,
      id: "npc_garden_1",
      name: "정원사 로빈",
      graphic: { query: "people1" },
      movement: "random",
      pages: [{ text: "아름다운 정원이군요." }],
    });
    expect(result.ok, result.summary).toBe(true);
  });

  it("그래픽 해석 실패 시 요약에 원인 메시지가 포함된다", () => {
    const project = createBlankProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "place_npc", {
      mapId: project.startMapId,
      x: 2,
      y: 2,
      id: "npc_fail",
      name: "실패 NPC",
      graphic: { query: "존재하지않는그래픽xyz" },
      pages: [{ text: "..." }],
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("실행 실패:");
    expect(result.summary).toContain("charset");
  });
});
