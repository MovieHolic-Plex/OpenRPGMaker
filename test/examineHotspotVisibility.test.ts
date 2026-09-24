import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("place_examine_hotspots 보이지 않는 조사 지점", () => {
  it("그림 생략은 보석 표식, 투명 명시는 빈 바닥 경고", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const res = runTool(ctx, "place_examine_hotspots", {
      mapId,
      hotspots: [
        { at: { x: 3, y: 3 }, name: "메멘토: 낡은 턴테이블", lines: ["바늘이 멈춰 있다."] },
        { at: { x: 4, y: 3 }, name: "숨은 쪽지", lines: ["글씨"], graphic: { transparent: true } },
        { at: { x: 5, y: 3 }, name: "보물 상자", lines: ["비어 있다."], graphic: { query: "보물 상자" } },
      ],
    });
    expect(res.ok, res.summary).toBe(true);
    expect(res.summary).toContain("1개는 빈 바닥 위 투명");
    const notes = JSON.stringify(res.warnings ?? res.diff);
    expect(notes).toContain("보석 표식");
    expect(notes).toContain("메멘토: 낡은 턴테이블");
    expect(notes).toContain("숨은 쪽지");
    expect(notes).not.toContain("보물 상자,");
    const turntable = ctx.project.maps[mapId]!.events.find((event) => event.pages?.[0]?.name === "메멘토: 낡은 턴테이블");
    expect(turntable?.pages?.[0]?.graphic?.sprite?.id).toBe("tex_easyrpg_charset_object2");
  });
});
