// 곁에 서 있던 사람이 주인공에게 다가서는 장면 — 한 걸음이어도 걷기 검사·자리 이탈 판정에 걸리지 않는다.
// 2026-11-11 작은 일 둘째 묶음 walk-up-greet-starter: «3걸음 미만» 과 «제자리로 돌려보내라» 가 차례로 걸려 모델이 미루의 자리를 옮겼다(요청 밖 편집).
import { describe, expect, it } from "vitest";
import { buildEvent } from "@/ai/v2/story/events";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { sceneCraftFindings } from "@/ai/v2/judge/sceneCraft";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import type { EventSpec } from "@/ai/v2/shared/types";

const TASK = "게임을 시작하면 꼬마 미루가 주인공한테 걸어와서 \"어서 와, 기다렸어!\"라고 말하게 해 줘. 한 번만 나오게 해 줘";

describe("곁에 선 사람이 다가서는 시작 장면", () => {
  it("한 걸음 다가서기는 걷기 검사를 지나고, 자리 이탈로 잡히지 않고, 그 사람의 자리도 그대로다", () => {
    const before = buildFixture("starter");
    const ctx = { project: structuredClone(before) };
    const village = Object.values(ctx.project.maps).find((m) => m.name === "잿불 마을")!;
    const post = village.events.find((e) => e.name === "꼬마 미루")!;
    const built = buildEvent(createBuildRun(ctx), { kind: "cutscene", mapId: village.id, when: "game-start", beats: [{ do: "walk", who: "꼬마 미루", to: "주인공" }, { do: "say", who: "꼬마 미루", text: "어서 와, 기다렸어!" }] } as unknown as EventSpec);
    expect(built.ok, built.summary).toBe(true);
    const walk = built.stage!.checks.filter((c) => c.id === "cutscene-walk");
    expect(walk.length).toBe(1);
    expect(walk[0]!.ok, walk[0]!.detail).toBe(true);
    expect(built.stage!.walks[0]!.steps).toBeLessThan(3);
    const after = ctx.project.maps[village.id]!.events.find((e) => e.id === post.id)!;
    expect([after.x, after.y]).toEqual([post.x, post.y]);
    expect(sceneCraftFindings(before, ctx.project, TASK).filter((f) => f.id === "off-post")).toEqual([]);
  });

  it("장면에만 나오는 사람의 짧은 걷기는 여전히 문제다", () => {
    const ctx = { project: buildFixture("starter") };
    const village = Object.values(ctx.project.maps).find((m) => m.name === "잿불 마을")!;
    const built = buildEvent(createBuildRun(ctx), { kind: "cutscene", mapId: village.id, when: "game-start", beats: [{ do: "walk", who: "낯선 전령", to: "주인공" }, { do: "say", who: "낯선 전령", text: "전갈이오." }] } as unknown as EventSpec);
    expect(built.ok, built.summary).toBe(true);
    for (const w of built.stage!.walks) expect(w.besideAlready).toBeUndefined();
  });
});
