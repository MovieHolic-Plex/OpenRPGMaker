import { describe, expect, it } from "vitest";
import { buildGameDesignExecution } from "@/project/gameDesignExecution";
import { gameDesignBriefContext, GAME_PRESET_IDS } from "@/project/gameDesignBrief";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById, welcomeGenrePresetDisplayText } from "@/editor/welcomeGenrePresets";
import { interviewBrief } from "./helpers/gameDesignBrief";

describe("internal interview execution handoff", () => {
  it("derives a complete dependency graph for every saved preset without mutating the authored brief", () => {
    for (const id of GAME_PRESET_IDS) {
      const brief = interviewBrief(id);
      const original = structuredClone(brief);
      const plan = buildGameDesignExecution(brief);
      const seen = new Set<string>();
      for (const task of plan.tasks) {
        expect(seen.has(task.id)).toBe(false);
        expect(task.dependsOn.every(id => seen.has(id))).toBe(true);
        expect(task.action.length).toBeGreaterThan(0);
        expect(task.output.length).toBeGreaterThan(0);
        expect(task.acceptance.length).toBeGreaterThan(0);
        expect(task.requirements.every(slot => brief.answers[slot])).toBe(true);
        seen.add(task.id);
      }
      expect(seen.has("F03")).toBe(true);
      expect(brief).toEqual(original);
    }
  });
  it("automatically supplies model-only tasks while keeping the human display free of the contract", () => {
    const brief = interviewBrief();
    const preset = welcomeGenrePresetById(brief.presetId)!;
    const task = buildWelcomeGenrePresetPrompt(preset, brief);
    const display = welcomeGenrePresetDisplayText(preset, brief);
    expect(task).toContain('"id":"P03"');
    expect(task).toContain("검증 증거 없이 done/pass로 처리하지 않는다");
    expect(display).not.toContain('"id":"P03"');
    expect(display).not.toContain("조수 내부 제작 계약");
    expect(gameDesignBriefContext(undefined)).toBe("");
  });
  it("rebuilds from the latest edited summary, preserves recommendation provenance and scopes execution to the current request", () => {
    const brief = interviewBrief();
    brief.answers.detail.source = "recommended";
    brief.summary = "인물의 외형은 미정. 첫 대화 한 장면만 만든다.";
    const first = buildGameDesignExecution(brief);
    brief.summary = "첫 포획까지만, 공포 연출은 빼기.";
    const next = buildGameDesignExecution(brief);
    expect(first.requirements.summary).not.toEqual(next.requirements.summary);
    expect(next.requirements.summary).toBe(brief.summary);
    expect(next.requirements.answers.detail.source).toBe("recommended");
    expect(gameDesignBriefContext(brief)).toContain("읽기 전용·기획 상담·무관한 요청에서는 제작을 시작하지 않는다");
  });
});
