// test/systemPromptEnvelope.test.ts
// 공용 프롬프트 봉투 계약. 이 파일이 지키는 것은 "모든 AI 표면이 같은 지점에서 정책·성향을 받는다"다.
// 순서 단정이 중요하다 — 고정 블록(성향·정책)이 본문 뒤에 오면 상위에서 프롬프트가 잘릴 때
// 통째로 사라지고, 그게 원래의 "AI 가 기억하지 못한다" 증상이다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildPreferenceMemorySection,
  PREFERENCE_PRECEDENCE_LINE,
  upsertPreferenceFact,
} from "@/ai/preferenceMemory";
import { AGENT_UX_POLICY_LINES } from "@/ai/promptPolicies";
import { composeSystemPrompt, type AiSurface } from "@/ai/systemPromptEnvelope";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const BODY = "## 채널 고유 지침\n- 이 채널만의 규칙";

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  });
});

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("조립 순서", () => {
  it("성향 → 정책 → 본문 순으로 붙는다", () => {
    const prompt = composeSystemPrompt({
      surface: "chat",
      body: BODY,
      includePolicy: true,
      includeMemory: true,
      memorySection: "## 사용자 성향\n- [강함] 작게",
    });
    const memoryAt = prompt.indexOf("## 사용자 성향");
    const policyAt = prompt.indexOf("## UX 응답 정책");
    const bodyAt = prompt.indexOf("## 채널 고유 지침");
    expect(memoryAt).toBeGreaterThanOrEqual(0);
    expect(memoryAt).toBeLessThan(policyAt);
    expect(policyAt).toBeLessThan(bodyAt);
  });

  it("블록 사이는 빈 줄 하나로 구분된다", () => {
    const prompt = composeSystemPrompt({
      surface: "chat",
      body: "본문",
      includeMemory: true,
      memorySection: "성향",
    });
    expect(prompt).toBe("성향\n\n본문");
  });
});

describe("표면별 포함 규칙", () => {
  it("본문만 넘기면 본문 그대로다 — 봉투가 조용히 무언가를 덧붙이지 않는다", () => {
    expect(composeSystemPrompt({ surface: "structure-kit", body: BODY })).toBe(BODY);
  });

  it("정책을 켜면 AGENT_UX_POLICY_LINES 가 한 글자도 변형되지 않고 들어간다", () => {
    const prompt = composeSystemPrompt({ surface: "chat", body: BODY, includePolicy: true });
    expect(prompt).toContain(AGENT_UX_POLICY_LINES);
  });

  it("성향을 켜도 기억이 비어 있으면 아무것도 붙지 않는다", () => {
    expect(composeSystemPrompt({ surface: "chat", body: BODY, includeMemory: true })).toBe(BODY);
  });

  it("성향을 켜면 저장된 성향이 우선순위 문장과 함께 들어간다", () => {
    upsertPreferenceFact({ text: "마을은 작게 유지한다", scope: "global", strength: "strong" });
    const prompt = composeSystemPrompt({ surface: "chat", body: BODY, includeMemory: true });
    expect(prompt).toContain("마을은 작게 유지한다");
    expect(prompt).toContain(PREFERENCE_PRECEDENCE_LINE);
    expect(prompt.startsWith(buildPreferenceMemorySection())).toBe(true);
  });

  it("JSON 전용 표면처럼 성향을 끄면 저장돼 있어도 안 붙는다", () => {
    upsertPreferenceFact({ text: "마을은 작게 유지한다", scope: "global", strength: "strong" });
    const prompt = composeSystemPrompt({ surface: "tileset-analysis", body: BODY });
    expect(prompt).not.toContain("마을은 작게 유지한다");
    expect(prompt).not.toContain("## UX 응답 정책");
  });

  it("프로젝트 조회 키를 넘기면 그 프로젝트 성향만 실린다", () => {
    upsertPreferenceFact({ text: "이 게임은 호러다", scope: "project", projectScopeKey: "local:A::m1" });
    upsertPreferenceFact({ text: "남의 게임 설정", scope: "project", projectScopeKey: "local:B::m1" });
    const prompt = composeSystemPrompt({
      surface: "chat",
      body: BODY,
      includeMemory: true,
      projectScopeKey: "local:A::m1",
    });
    expect(prompt).toContain("이 게임은 호러다");
    expect(prompt).not.toContain("남의 게임 설정");
  });

  it("주입된 memorySection 이 localStorage 조회를 이긴다(테스트/호출부 주입 경로)", () => {
    upsertPreferenceFact({ text: "저장된 성향", scope: "global" });
    const prompt = composeSystemPrompt({
      surface: "region",
      body: BODY,
      includeMemory: true,
      memorySection: "주입된 성향",
    });
    expect(prompt).toContain("주입된 성향");
    expect(prompt).not.toContain("저장된 성향");
  });
});

describe("경계값", () => {
  it("본문이 비면 고정 블록만 남는다", () => {
    const prompt = composeSystemPrompt({ surface: "chat", body: "   ", includePolicy: true });
    expect(prompt).toBe(AGENT_UX_POLICY_LINES);
  });

  it("모두 비면 빈 문자열이다", () => {
    expect(composeSystemPrompt({ surface: "chat", body: "", includePolicy: false, includeMemory: true })).toBe("");
  });

  it("모든 표면 식별자가 동일하게 처리된다 — 표면은 어휘일 뿐 분기가 아니다", () => {
    const surfaces: AiSurface[] = ["chat", "region", "cluster", "event-command", "structure-kit", "tileset-analysis"];
    const prompts = surfaces.map((surface) => composeSystemPrompt({ surface, body: BODY, includePolicy: true }));
    expect(new Set(prompts).size).toBe(1);
  });
});
