import { beforeEach, describe, expect, it } from "vitest";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { DEFAULT_EXECUTION_ROUTE, resolvePiRunPlan } from "@/ai/piAgent/executionRoute";
import { AI_CONFIG_STORAGE_KEY, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { createTeamBoardState, markTeamBoardDiscarded, markTeamBoardReview, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.get(key) ?? null; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, value); }
}

const plan = (level: Parameters<typeof resolveAutonomy>[0], explicitDirective = false, preferred: "pi-agent" | "pi-team" = "pi-agent") =>
  resolvePiRunPlan({ explicitDirective, preferred, autonomy: resolveAutonomy(level) });

describe("실행 계획 결정", () => {
  it("평문 지시는 셀렉트가 고른 Pi 경로로 간다", () => {
    expect(plan("balanced")).toEqual({ route: "pi-agent", readOnly: false, planOnly: false, maxTurns: 16, thinkingLevel: "low" });
    expect(plan("balanced", false, "pi-team").route).toBe("pi-team");
  });
  it("읽기 전용 레벨은 쓰기 없는 Pi 다", () => {
    expect(plan("readonly")).toMatchObject({ readOnly: true, planOnly: false, maxTurns: 4, thinkingLevel: "low" });
  });
  it("확인 레벨은 계획만 세우는 읽기 전용 실행이다", () => {
    // 계획 턴에 쓰기가 열려 있으면 "실행 전에 확인" 약속이 깨진다.
    expect(plan("confirm")).toMatchObject({ readOnly: true, planOnly: true, maxTurns: 6 });
  });
  it("자율·최대 레벨은 더 깊은 추론과 큰 예산을 싣는다", () => {
    expect(plan("autonomous")).toMatchObject({ readOnly: false, maxTurns: 32, thinkingLevel: "medium" });
    expect(plan("max")).toMatchObject({ readOnly: false, maxTurns: 48, thinkingLevel: "high" });
  });
  it("슬래시 노브는 사용자 선택이라 다이얼의 읽기 전용·계획보다 세다", () => {
    expect(plan("readonly", true)).toMatchObject({ readOnly: false, planOnly: false });
    expect(plan("confirm", true)).toMatchObject({ readOnly: false, planOnly: false });
  });
  it("세션은 더 이상 경로가 아니다", () => {
    expect(DEFAULT_EXECUTION_ROUTE).toBe("pi-agent");
  });
});

describe("AI 설정의 경로·적용 방식", () => {
  beforeEach(() => { (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage(); });
  it("옛 blob 은 Pi 에이전트 + 검토 후 적용으로 백필한다", () => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gemini-3.7-flash" }));
    const config = loadAiConfig();
    expect(config.executionRoute).toBe(DEFAULT_EXECUTION_ROUTE);
    expect(config.piApply).toBe("review");
  });
  it("저장한 값은 유지되고 이상한 값은 기본으로", () => {
    saveAiConfig({ ...loadAiConfig(), executionRoute: "pi-team", piApply: "auto" });
    expect(loadAiConfig().executionRoute).toBe("pi-team");
    expect(loadAiConfig().piApply).toBe("auto");
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(AI_CONFIG_STORAGE_KEY)!), executionRoute: "nope", piApply: "later" }));
    expect(loadAiConfig().executionRoute).toBe("pi-agent");
    expect(loadAiConfig().piApply).toBe("review");
  });
  it("삭제된 'session' 저장값도 Pi 에이전트로 떨어진다", () => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "session" }));
    expect(loadAiConfig().executionRoute).toBe("pi-agent");
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
