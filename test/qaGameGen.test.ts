import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBrowserSeed, type QaBrief } from "../scripts/qa-game/lib/seed";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } from "../src/editor/welcomeGenrePresets";
import { buildPiRunRequest, buildUltrabrainPlanRequest, PLAN_MAX_TURNS, PLAN_ONLY_PREFIX } from "../src/ai/piAgent/plainTurn";

const brief = JSON.parse(fs.readFileSync("scripts/qa-game/briefs/lighthouse-jrpg.json", "utf8")) as QaBrief;

describe("qa-game gen — 브라우저 「이 기획으로 시작」과 같은 출발점", () => {
  it("시드는 기획을 품고 generationPending 을 지운 채 시작한다", () => {
    const { project, brief: normalized } = buildBrowserSeed(brief);
    expect(project.meta.title).toBe(brief.title);
    expect(project.gameDesignBrief?.presetId).toBe(brief.presetId);
    expect(project.gameDesignBrief).not.toHaveProperty("generationPending");
    expect(Object.keys(project.maps).length).toBeGreaterThan(0);
    const preset = welcomeGenrePresetById(brief.presetId);
    expect(preset).toBeTruthy();
    expect(buildWelcomeGenrePresetPrompt(preset!, normalized).length).toBeGreaterThan(200);
  });

  it("계획 턴·실행 요청은 패널과 같은 빌더에서 나온다", () => {
    const { project } = buildBrowserSeed(brief);
    const brain = { provider: "google-antigravity", model: "gemini-3.8-flash", effort: "high" } as never;
    const plan = buildUltrabrainPlanRequest({ brain, modelTask: "과제", mapIds: [project.startMapId], project, scopedByUser: false });
    expect(plan.readOnly).toBe(true);
    expect(plan.maxTurns).toBe(PLAN_MAX_TURNS);
    expect(plan.task.startsWith(PLAN_ONLY_PREFIX)).toBe(true);
    const run = buildPiRunRequest({
      team: false, planOnly: false, readOnly: false, applyMode: "default", villageContract: undefined,
      brain, deep: { provider: "google-antigravity", model: "gemini-3.7-flash" }, writer: undefined,
      modelTask: "과제", executionTask: "실행 과제", mapIds: [project.startMapId], project, scopedByUser: false, mapBundleMerge: true,
    } as never);
    expect(run.task).toBe("실행 과제");
  });
});
