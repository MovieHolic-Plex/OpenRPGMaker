import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_EXECUTION_ROUTE, resolveExecutionRoute } from "@/ai/piAgent/executionRoute";
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

describe("실행 경로 결정", () => {
  it("기본은 선택한 경로, 질문·계획·선택 영역은 기존 조수", () => {
    expect(resolveExecutionRoute({ text: "집 지어", composerMode: "do", preferred: "pi-team" })).toEqual({ route: "pi-team", reason: null });
    expect(resolveExecutionRoute({ text: "집 지어", composerMode: "do", preferred: "session" })).toEqual({ route: "session", reason: null });
    expect(resolveExecutionRoute({ text: "이벤트 몇 개?", composerMode: "ask", preferred: "pi-agent" }).route).toBe("session");
    expect(resolveExecutionRoute({ text: "이벤트 몇 개?", composerMode: "ask", preferred: "pi-agent" }).reason).toMatch(/질문/);
    expect(resolveExecutionRoute({ text: "이벤트 몇 개?", composerMode: "ask", preferred: "session" }).reason).toBeNull();
    expect(resolveExecutionRoute({ text: "마을 계획", composerMode: "plan", preferred: "pi-team" }).route).toBe("session");
    expect(resolveExecutionRoute({ text: "여기 고쳐", composerMode: "do", preferred: "pi-agent", selectionTaskActive: true }).route).toBe("session");
  });
  it("/pi 는 언제나 명시적 Pi 경로", () => {
    expect(resolveExecutionRoute({ text: "/pi team 마을", composerMode: "ask", preferred: "session" }).route).toBe("pi-agent");
    expect(resolveExecutionRoute({ text: "/pixel", composerMode: "do", preferred: "session" }).route).toBe("session");
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
