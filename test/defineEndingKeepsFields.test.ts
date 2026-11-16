// define_ending 을 이미 있는 id 로 다시 부르면 안 보낸 칸은 그대로다(2026-11-11 작은 일 기준선:
// generate_art{target:"ending"} 가 그림만 걸려고 id·name·presentation 으로 불렀다가 conditions 필수에 걸려 41번 중 27번 거절됐다).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

function withEnding() {
  const ctx = { project: createBlankProject() };
  const made = runTool(ctx, "define_ending", {
    id: "ending_a", name: "봄", priority: 3,
    conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
    epilogue: [{ kind: "say", speaker: "나", text: "끝났다." }],
    presentation: { tone: "warm", finalTitle: "봄" },
  });
  expect(made.ok, made.summary).toBe(true);
  return ctx;
}
const ending = (ctx: { project: ReturnType<typeof createBlankProject> }, id = "ending_a") => ctx.project.endings!.find((e) => e.id === id)!;

describe("define_ending — 다시 부르기", () => {
  it("id·name 만 보내면 아무것도 바뀌지 않는다", () => {
    const ctx = withEnding();
    const before = JSON.stringify(ending(ctx));
    expect(runTool(ctx, "define_ending", { id: "ending_a", name: "봄" }).ok).toBe(true);
    expect(JSON.stringify(ending(ctx))).toBe(before);
  });

  it("presentation 만 보내면 조건·우선순위·에필로그는 그대로다(빈 epilogue 는 안 보낸 것)", () => {
    const ctx = withEnding();
    expect(runTool(ctx, "define_ending", { id: "ending_a", name: "봄", epilogue: [], presentation: { tone: "dark" } }).ok).toBe(true);
    const e = ending(ctx);
    expect(e.presentation?.tone).toBe("dark");
    expect(e.conditions).toHaveLength(1);
    expect(e.priority).toBe(3);
    expect(e.epilogue).toHaveLength(1);
  });

  // 2026-11-16 확인 빌드 r6 P9: 다섯 값을 정한 뒤 배경 하나만 다시 보내자 제목·윗글·크레딧·tone 이 지워졌다(엔딩 화면 «끝» · 크레딧 없음).
  it("presentation 은 칸마다 합친다 — 한 칸만 보내면 나머지 칸은 그대로다", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "define_ending", { id: "ending_cat", name: "미케, 집으로", presentation: { tone: "warm", kicker: "상점가의 미케", finalTitle: "미케, 집으로", credits: "만든 이\n도윤", badge: "HAPPY ENDING" } }).ok).toBe(true);
    const again = runTool(ctx, "define_ending", { id: "ending_cat", name: "미케, 집으로", presentation: { tone: "dark" } });
    expect(again.ok, again.summary).toBe(true);
    expect(ending(ctx, "ending_cat").presentation).toEqual({ tone: "dark", kicker: "상점가의 미케", finalTitle: "미케, 집으로", credits: "만든 이\n도윤", badge: "HAPPY ENDING" });
    // 무엇을 그대로 두었는지 결과 글이 말한다(모델이 읽는 글 — 영어).
    expect(again.summary).toContain("presentation: kept kicker, finalTitle, credits, badge from before");
    // 빈 글은 안 보낸 것이다 — 스키마 칸을 빈 값으로 채워 보내도 앞의 글이 남는다. null 은 그 칸을 지운다.
    expect(runTool(ctx, "define_ending", { id: "ending_cat", name: "미케, 집으로", presentation: { kicker: "", credits: null } }).ok).toBe(true);
    expect(ending(ctx, "ending_cat").presentation).toEqual({ tone: "dark", kicker: "상점가의 미케", finalTitle: "미케, 집으로", badge: "HAPPY ENDING" });
    // 새 엔딩의 빈 칸은 그냥 없는 칸이다.
    expect(runTool(ctx, "define_ending", { id: "ending_new", name: "새벽", presentation: { tone: "warm", kicker: "" } }).ok).toBe(true);
    expect(ending(ctx, "ending_new").presentation).toEqual({ tone: "warm" });
  });

  it("보낸 칸은 바꾼다 — conditions:[] 는 조건을 없앤다", () => {
    const ctx = withEnding();
    expect(runTool(ctx, "define_ending", { id: "ending_a", name: "봄", conditions: [], priority: 0 }).ok).toBe(true);
    expect(ending(ctx).conditions).toHaveLength(0);
    expect(ending(ctx).priority).toBe(0);
  });

  it("새 엔딩은 conditions 없이도 만든다(조건 없는 엔딩)", () => {
    const ctx = withEnding();
    expect(runTool(ctx, "define_ending", { id: "ending_b", name: "겨울" }).ok).toBe(true);
    expect(ending(ctx, "ending_b").conditions).toEqual([]);
    expect(ending(ctx, "ending_b").priority).toBe(0);
  });
});
