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
