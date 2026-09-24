// 추격 호러 검사(qa gameCheck/horror) — 2026-09-24 「잿빛 저택의 술래」 도그푸딩 결함을 데이터로 잡는다.
import { describe, expect, it } from "vitest";
import { checkHorror, chaserStepMs } from "@/qa/gameCheck/horror";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

const BRIEF = "직접 쫓아오는 존재. 옷장에 숨으면 놓친다. 어둡고 긴장감 있게. 금고 암호 4자리.";

function horrorProject() {
  const ctx = { project: createBlankProject() };
  ctx.project.system.genre = "horror-chase";
  return ctx;
}

describe("qa gameCheck — 추격 호러", () => {
  it("추격자 한 칸 시간은 걸음 트윈 + 이동 간격이다", () => {
    expect(chaserStepMs({ type: "chase", speed: 3, frequency: 3 })).toBe(960);
    expect(chaserStepMs({ type: "chase", speed: 6, frequency: 8 })).toBe(240);
  });

  it("느린 추격자·가짜 은신·정답 누설·밝은 조명을 짚는다", () => {
    const ctx = horrorProject();
    const mapId = ctx.project.startMapId;
    ctx.project.startPos = { x: 1, y: 1 };
    const chase = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_oni", x: 8, y: 8, pages: [{
      conditions: [], trigger: { kind: "eventTouch" }, graphic: {}, movement: { type: "chase", speed: 3, frequency: 3, sightRange: 12 },
      commands: [{ kind: "killPlayer", message: "붙잡혔다." }] }] } });
    expect(chase.ok, chase.summary).toBe(true);
    const closet = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_closet", x: 3, y: 3, pages: [{
      conditions: [], trigger: { kind: "action" }, graphic: { transparent: true },
      commands: [{ kind: "choices", options: [{ text: "옷장에 숨는다", branch: [{ kind: "text", body: "숨었다" }] }, { text: "[ 7 4 1 9 ] (쪽지의 암호)", branch: [] }] }] }] } });
    expect(closet.ok, closet.summary).toBe(true);
    const codes = checkHorror(ctx.project, BRIEF).map((finding) => finding.code);
    expect(codes).toEqual(expect.arrayContaining(["chaser-too-slow", "horror-no-hiding", "choice-answer-leak", "horror-not-dark", "capture-no-retry", "code-as-choices"]));
    expect(codes).not.toContain("chaser-cannot-reach");
  });

  it("make_chase_scene 으로 만든 추격(속도 6·은신처·체크포인트)은 속도·은신 지적이 없고 실제로 붙잡는다", () => {
    const ctx = horrorProject();
    const mapId = ctx.project.startMapId;
    ctx.project.startPos = { x: 1, y: 1 };
    const result = runTool(ctx, "make_chase_scene", {
      mapId, chaser: { at: { x: 10, y: 8 }, graphic: { query: "monster" }, speed: 6, sightRange: 20 },
      killOnTouch: true, checkpointOnEntry: true, hidingSpots: [{ x: 3, y: 3 }],
    });
    expect(result.ok, result.summary).toBe(true);
    const codes = checkHorror(ctx.project, BRIEF).map((finding) => finding.code);
    expect(codes).not.toContain("chaser-too-slow");
    expect(codes).not.toContain("horror-no-hiding");
    expect(codes).not.toContain("chaser-never-catches");
    expect(codes).not.toContain("capture-no-retry");
  });
});
