import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("place_examine_hotspots 보이지 않는 조사 지점", () => {
  it("그림도 물건 타일도 없는 칸의 핫스팟을 요약과 경고로 알린다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const res = runTool(ctx, "place_examine_hotspots", {
      mapId,
      hotspots: [
        { at: { x: 3, y: 3 }, name: "메멘토: 낡은 턴테이블", lines: ["바늘이 멈춰 있다."] },
        { at: { x: 5, y: 3 }, name: "보물 상자", lines: ["비어 있다."], graphic: { query: "보물 상자" } },
      ],
    });
    expect(res.ok, res.summary).toBe(true);
    expect(res.summary).toContain("1개는 빈 바닥 위 투명");
    expect(JSON.stringify(res.warnings ?? res.diff)).toContain("메멘토: 낡은 턴테이블");
    expect(JSON.stringify(res.warnings ?? res.diff)).not.toContain("보물 상자,");
  });
});
