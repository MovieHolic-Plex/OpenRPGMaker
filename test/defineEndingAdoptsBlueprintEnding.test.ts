import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { blueprintEndingId } from "@/project/gameBlueprint";

// 2026-11-16 pf4 은행 r5a-river: build_blueprint_path 가 먼저 청사진 엔딩(ending_xbbs3u)을 만들고, 모델의 define_ending 이 같은 이름의 ending_mill 을 더해
// 보스의 두 페이지가 서로 다른 엔딩을 불렀다. 같은 맺음이면 경로가 만든 엔딩을 그 자리에서 고쳐 쓴다.
describe("define_ending 은 청사진 경로가 만든 같은 맺음의 엔딩을 고쳐 쓴다", () => {
  const boss = (endingId: string) => ({ id: "ev_boss", name: "두꺼비", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [{ id: "p0", trigger: { kind: "action" }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, conditions: [], commands: [{ kind: "triggerEnding", endingId }] }] });

  it("경로 먼저 · define_ending 나중(r5a-river 순서) — 엔딩은 하나, 이미 부르던 곳은 새 id 를 부른다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const made = blueprintEndingId("다시 도는 물레방아");
    expect(runTool(ctx, "define_ending", { id: made, name: "다시 도는 물레방아", conditions: [], epilogue: [{ kind: "say", text: "물길이 열렸다." }], presentation: { finalTitle: "다시 도는 물레방아", credits: "물레방아가 멈춘 날" } }).ok).toBe(true);
    ctx.project.maps[ctx.project.startMapId]!.events.push(boss(made) as never);
    const result = runTool(ctx, "define_ending", { id: "ending_mill", name: "다시 도는 물레방아", conditions: [], epilogue: [{ kind: "say", text: "두꺼비가 사라지자 물길이 다시 열렸다." }] });
    expect(result.ok).toBe(true);
    expect(result.summary).toContain(`replaced the ending ${made}`);
    const endings = ctx.project.endings ?? [];
    expect(endings.map((e) => e.id)).toEqual(["ending_mill"]);
    // 모델이 보낸 칸은 모델 것, 안 보낸 칸(크레딧)은 경로가 지은 것.
    expect(JSON.stringify(endings[0]!.epilogue)).toContain("두꺼비가 사라지자");
    expect(endings[0]!.presentation?.credits).toBe("물레방아가 멈춘 날");
    const calls = JSON.stringify(ctx.project.maps[ctx.project.startMapId]!.events.find((e) => e.id === "ev_boss")!.pages);
    expect(calls).toContain('"endingId":"ending_mill"');
    expect(calls).not.toContain(made);
  });

  it("이름이 다른 엔딩은 따로 더한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    runTool(ctx, "define_ending", { id: blueprintEndingId("다시 도는 물레방아"), name: "다시 도는 물레방아", conditions: [] });
    runTool(ctx, "define_ending", { id: "ending_bad", name: "물에 잠긴 마을", conditions: [] });
    expect((ctx.project.endings ?? []).map((e) => e.id).sort()).toEqual([blueprintEndingId("다시 도는 물레방아"), "ending_bad"].sort());
  });
});
