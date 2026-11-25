// JRPG 마법사 시작 — 레시피 이름이 게임 제목이 되던 것, JRPG 저작 요령, simulate_battle 파티 지정(2026-09-24 도그푸딩).
import { describe, expect, it, vi } from "vitest";
import { applyWelcomeGenreSystemPresetPlan } from "@/editor/welcomeGenreSystemPresetAction";
import { buildWelcomeGenrePresetPrompt, UNNAMED_GAME_TITLE, welcomeGenrePresetById, welcomeGenreSystemPresetPlanById } from "@/editor/welcomeGenrePresets";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { interviewBrief } from "./helpers/gameDesignBrief";
// createBlankProject() 는 호출마다 약 80MB 를 새로 만든다(test/support/blankProject.ts 머리말) — 이 파일의 느린 케이스는 한 케이스에 그것을 여러 번 부르거나 부르는 제품 함수를 돌려
// CI(4코어 호스티드 러너)에서 11~15초가 걸려 기본 15초 제한에 걸리거나 닿을 듯하다. 판정은 그대로 두고 제한만 이 파일의 다른 무거운 시험과 같이 넓힌다.
vi.setConfig({ testTimeout: 120_000 });

const jrpgBrief = () => interviewBrief("adventure-jrpg");

describe("JRPG 마법사 시작", () => {
  it("인터뷰로 시작한 게임은 레시피 이름 대신 임시 제목을 쓰고, 조수에게 제목을 짓게 한다", async () => {
    const adoptProject = vi.fn(async () => undefined);
    const plan = welcomeGenreSystemPresetPlanById("adventure-jrpg");
    const result = await applyWelcomeGenreSystemPresetPlan(plan, { adoptProject, focusStartMap: vi.fn() }, jrpgBrief());
    expect(result.project.meta.title).toBe(UNNAMED_GAME_TITLE);
    expect(JSON.stringify(result.project.system.opening)).not.toContain("시스템 프리셋");
    if (result.project.system.titleScreen) expect(result.project.system.titleScreen.title).toBe(UNNAMED_GAME_TITLE);
    const prompt = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("adventure-jrpg")!, jrpgBrief());
    expect(prompt).toContain("set_project_settings({title})");
    expect(prompt).toContain("턴제 JRPG 저작 요령");
    expect(prompt).toContain("upsert_equipment");
  });

  it("simulate_battle 이 partyActorIds 로 합류가 끝난 파티를 잰다", () => {
    const ctx = { project: createBlankProject() };
    const troopId = ctx.project.database.troops[0]!.id;
    const actors = ctx.project.database.actors.slice(0, 3).map((actor) => actor.id);
    const result = runTool(ctx, "simulate_battle", { troopId, heroLevel: 1, n: 2, seed: 1, partyActorIds: actors });
    expect(result.ok, result.summary).toBe(true);
    expect((result.data as { participatingActorIds: string[] }).participatingActorIds.length).toBeGreaterThan(1);
    const missing = runTool(ctx, "simulate_battle", { troopId, heroLevel: 1, partyActorIds: ["actor_nobody"] });
    expect(missing.ok).toBe(false);
  });
});
