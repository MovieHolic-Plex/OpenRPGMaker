// 조수 채팅의 실행 계획 — 루프는 Pi 하나다(2026-09-11).
//
// 예전에는 경로 enum(session | pi-agent | pi-team)이 «어느 루프로 가는가» 를 답했다. 조수 세션을
// deprecated 하면서 남은 결정은 둘뿐이다: «이 실행이 무엇을 해도 되는가»(자율성 다이얼 →
// readOnly·planOnly·턴 상한·추론)와 «몇 명이 도는가»(`AiConfig.piTeam`).
import { beforeEach, describe, expect, it } from "vitest";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { DEFAULT_PI_TEAM, resolvePiRunPlan } from "@/ai/piAgent/executionRoute";
import { AI_CONFIG_STORAGE_KEY, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { createTeamBoardState, markTeamBoardDiscarded, markTeamBoardReview, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { plainPiCommand } from "@/editor/panels/aiPiAgentCommand";

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.get(key) ?? null; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, value); }
}

describe("자율성 다이얼 → Pi 실행 계획", () => {
  it("읽기 전용은 쓰기 없이 답만 한다", () => {
    // Break: readOnly 가 꺼지면 질문 턴이 프로젝트를 바꾼다 — 다이얼이 「읽기 전용」인데 실행되면
    // 사용자가 고른 유일한 안전장치가 사라진다.
    expect(resolvePiRunPlan(resolveAutonomy("readonly"))).toEqual({
      readOnly: true, planOnly: false, maxTurns: 4, thinkingLevel: "low",
    });
  });
  it("계획(확인) 턴은 실행도 막는다", () => {
    // 계획만 세우는데 쓰기 툴이 살아 있으면 "계획" 이 곧 실행이 된다(Pi 에는 세션 플래너가 없다).
    const plan = resolvePiRunPlan(resolveAutonomy("confirm"));
    expect(plan.readOnly).toBe(true);
    expect(plan.planOnly).toBe(true);
    expect(plan.maxTurns).toBe(6);
  });
  it("실행 레벨은 예산·추론이 단조 증가한다", () => {
    const balanced = resolvePiRunPlan(resolveAutonomy("balanced"));
    const autonomous = resolvePiRunPlan(resolveAutonomy("autonomous"));
    const max = resolvePiRunPlan(resolveAutonomy("max"));
    expect([balanced.readOnly, balanced.planOnly]).toEqual([false, false]);
    expect([balanced.maxTurns, autonomous.maxTurns, max.maxTurns]).toEqual([16, 32, 48]);
    expect([balanced.thinkingLevel, autonomous.thinkingLevel, max.thinkingLevel]).toEqual(["low", "medium", "high"]);
  });
});

describe("평문 지시는 팀 비트만 고른다", () => {
  it("단독은 현재 맵이 범위, 팀은 후보 맵 없음", () => {
    expect(plainPiCommand("  집 지어  ", "single", "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], task: "집 지어" });
    expect(plainPiCommand("집 지어", "team", "map_a")).toEqual({ mode: "team", mapIds: [], task: "집 지어" });
  });
  it("현재 맵이 없으면 범위가 비고 지시는 그대로다", () => {
    expect(plainPiCommand("map_a 집 지어", "single", null)).toEqual({ mode: "single", mapIds: [], task: "map_a 집 지어" });
  });
});

describe("AI 설정의 팀·적용 방식", () => {
  beforeEach(() => { (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage(); });

  it("옛 blob 은 팀 꺼짐 + 검토 후 적용으로 백필한다", () => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gemini-3.7-flash" }));
    const config = loadAiConfig();
    expect(config.piTeam).toBe(DEFAULT_PI_TEAM);
    expect(config.piApply).toBe("review");
  });
  it("팀 비트와 적용 방식은 저장되고 이상한 값은 기본으로 돌아간다", () => {
    saveAiConfig({ ...loadAiConfig(), piTeam: true, piApply: "auto" });
    expect(loadAiConfig().piTeam).toBe(true);
    expect(loadAiConfig().piApply).toBe("auto");
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(AI_CONFIG_STORAGE_KEY)!), piTeam: "yes", piApply: "later" }));
    expect(loadAiConfig().piTeam).toBe(false);
    expect(loadAiConfig().piApply).toBe("review");
  });
  it("경로 enum 시절의 `pi-team` 은 팀 비트로 승격한다", () => {
    // 옛 키를 버리면 사용자가 켜 둔 팀이 조용히 사라진다. `session`·`pi-agent` 는 둘 다 «Pi» 다.
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "pi-team" }));
    expect(loadAiConfig().piTeam).toBe(true);
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "session" }));
    expect(loadAiConfig().piTeam).toBe(false);
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "pi-agent" }));
    expect(loadAiConfig().piTeam).toBe(false);
  });
});

describe("검토 대기 단계", () => {
  it("검토 → 버림 / 검토 칩", () => {
    let state = createTeamBoardState("single", "x");
    state = reduceTeamBoard(state, { type: "start", provider: "p", model: "m", toolCount: 1 });
    state = markTeamBoardReview(state, ["타일 12", "이벤트 +1"]);
    expect(state.phase).toBe("검토 대기"); expect(state.reviewChips).toEqual(["타일 12", "이벤트 +1"]);
    const discarded = markTeamBoardDiscarded(state);
    expect(discarded.phase).toBe("버림"); expect(discarded.applied).toMatch(/그대로/);
  });
});
