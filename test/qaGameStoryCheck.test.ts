import { describe, expect, it } from "vitest";
import { runGameCheck } from "@/qa/gameCheck";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("qa gameCheck — 회상 스토리 장르 검사", () => {
  it("투명 메멘토와 연출 없는 컷신을 경고하고, @player 이동은 없는 이벤트로 치지 않는다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, r.summary).toBe(true); };
    ok("place_examine_hotspots", { mapId, hotspots: [{ at: { x: 3, y: 3 }, name: "메멘토: 턴테이블", lines: ["바늘"] }] });
    ok("script_cutscene", { mapId, eventId: "ev_intro", x: 6, y: 6, trigger: "auto", once: true, beats: [{ kind: "say", text: "여긴 어디지" }] });
    ok("script_cutscene", { mapId, eventId: "ev_walk", x: 8, y: 6, beats: [{ kind: "moveActor", target: "player", moves: [{ kind: "move", dir: "up" }] }] });
    const report = runGameCheck(ctx.project, { skipAutoPlay: true, briefText: "회상 스토리. 두 주인공 이동 연출, 카메라 이동, 페이드." });
    const codes = report.findings.map((f) => f.code);
    expect(codes).toContain("story-memento-invisible");
    expect(report.findings.some((f) => f.code === "command-missing-reference" && f.message.includes("@player"))).toBe(false);
    // 이동이 있는 컷신이 하나 있으니 「연출 없음」은 아니다.
    expect(codes).not.toContain("story-no-staging");
  });
});
