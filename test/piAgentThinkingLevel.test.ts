// 자율성 다이얼 → 실행 루프의 사고 강도, 그리고 공급자가 거부하는 강도의 정규화.
//
// 2026-09-26 실측이 잡으려는 것 둘: (1) 다이얼을 낮춰도 실행 턴이 역할 기본값(high)으로 돌아
// 턴당 ~2.9s 를 계속 태우는 회귀, (2) google-antigravity 에 "off" 가 실려 스트림 error
// `Supported efforts: minimal, low, medium, high` 로 실행이 첫 호출에서 죽는 회귀.
import { describe, expect, it } from "vitest";
import { buildPiRunRequest, normalizePiThinkingLevel, prefersCallerThinking } from "@/ai/piAgent/plainTurn";
import type { PiAgentThinkingLevel } from "@/ai/piAgent/protocol";
import { DEFAULT_MODEL, defaultAiConfig } from "@/ai/llmClient";
import { modelForRole } from "@/ai/modelRoles";
import { createBlankProject } from "@/project/defaults";

const brain = { providerId: "google-antigravity", model: "gemini-3.8-flash", reasoningEffort: "high" } as const;
const deep = { provider: "google-antigravity", model: "gemini-3.8-flash", thinkingLevel: "high" } as const;
const writer = { provider: "google-antigravity", model: "gemini-3.8-flash", thinkingLevel: "medium" } as const;

function runRequest(extra: {
  readonly planOnly?: boolean;
  readonly team?: boolean;
  readonly callerThinkingLevel?: PiAgentThinkingLevel;
  readonly preferCallerThinking?: boolean;
} = {}) {
  const project = createBlankProject();
  return buildPiRunRequest({
    team: false, planOnly: false, readOnly: false, applyMode: "default",
    brain, deep, writer,
    modelTask: "과제", executionTask: "실행 과제",
    mapIds: [project.startMapId], project, scopedByUser: false, mapBundleMerge: false,
    ...extra,
  });
}

describe("실행 루프의 사고 강도는 자율성 다이얼이 정한다", () => {
  it("preferCallerThinking 이 붙은 다이얼 값이 역할 기본값을 이긴다", () => {
    expect(runRequest({ callerThinkingLevel: "low", preferCallerThinking: true }).thinkingLevel).toBe("low");
  });
  it("preferCallerThinking 없이는 역할 값이 그대로 이긴다(옛 호출자 무변화)", () => {
    expect(runRequest().thinkingLevel).toBe("high");
    expect(runRequest({ callerThinkingLevel: "low" }).thinkingLevel).toBe("high");
    expect(runRequest({ preferCallerThinking: true }).thinkingLevel).toBe("high");
  });
  it("다이얼을 싣지 않은 계획 턴은 Ultrabrain 강도로 돈다 — 계획을 몰래 낮추지 않는다", () => {
    expect(runRequest({ planOnly: true }).thinkingLevel).toBe("high");
    expect(runRequest({ planOnly: true, callerThinkingLevel: "low" }).thinkingLevel).toBe("high");
  });
  it("다이얼을 실은 계획 턴·팀 턴도 Ultrabrain 강도를 지킨다", () => {
    // 패널은 planOnly 턴에도 preferCallerThinking + callerThinkingLevel 을 같이 싣는다(runPiCommand 의 실행 턴 요청).
    // 자율성 「확인」이 planOnly + low 이니, brainRun 을 안 보면 Ultrabrain 계획이 high → low 로 조용히 떨어진다.
    expect(runRequest({ planOnly: true, callerThinkingLevel: "low", preferCallerThinking: true }).thinkingLevel).toBe("high");
    expect(runRequest({ team: true, callerThinkingLevel: "low", preferCallerThinking: true }).thinkingLevel).toBe("high");
  });
});

describe("다이얼을 끄는 것은 «사용자가 Deep 역할을 실제로 바꾼 경우» 만이다", () => {
  // 설정 모달의 collect() 는 어느 컨트롤을 바꿔도 역할 3개를 전부 쓴다 — 「저장값이 있나」로 다이얼을 끄면
  // 설정을 한 번이라도 만진 사용자는 전원 다이얼을 잃는다(2026-09-26 리뷰 실측).
  const config = defaultAiConfig();
  const derived = modelForRole({ ...config, roleModels: undefined }, "deep");
  it("저장값이 없으면 다이얼이 이긴다", () => {
    expect(prefersCallerThinking(undefined, derived)).toBe(true);
  });
  it("폴백과 똑같은 저장값은 다이얼을 끄지 않는다", () => {
    expect(prefersCallerThinking({ ...derived }, derived)).toBe(true);
  });
  it("사고 강도·모델·공급자를 바꾼 저장값은 다이얼보다 이긴다", () => {
    expect(prefersCallerThinking({ ...derived, thinkingLevel: "high" }, derived)).toBe(false);
    expect(prefersCallerThinking({ ...derived, model: "gemini-3.7-flash" }, derived)).toBe(false);
    expect(prefersCallerThinking({ ...derived, provider: "openai-codex" }, derived)).toBe(false);
  });
});

describe("공급자가 거부하는 사고 강도는 요청을 만들 때 낮춘다", () => {
  it("antigravity 의 off 는 minimal 로, 다른 값·다른 공급자는 그대로", () => {
    expect(normalizePiThinkingLevel("google-antigravity", "off")).toBe("minimal");
    expect(normalizePiThinkingLevel("google-antigravity", "high")).toBe("high");
    expect(normalizePiThinkingLevel("openai-codex", "off")).toBe("off");
    expect(normalizePiThinkingLevel(undefined, undefined)).toBeUndefined();
  });
  it("다이얼이 off 를 실어도 antigravity 요청에는 minimal 이 실린다", () => {
    expect(runRequest({ callerThinkingLevel: "off", preferCallerThinking: true }).thinkingLevel).toBe("minimal");
  });
});

describe("측정이 비싸다고 밝힌 기본값", () => {
  it("deep 역할 폴백은 low, 기본 모델은 3.8-flash", () => {
    // 턴당 2.9s(high) → 2.1s(low). 명시 저장값은 폴백을 쓰지 않으므로 그대로 high 다.
    const config = defaultAiConfig();
    expect(modelForRole(config, "deep").thinkingLevel).toBe("low");
    expect(modelForRole({ ...config, roleModels: { deep: { ...deep } } }, "deep").thinkingLevel).toBe("high");
    expect(DEFAULT_MODEL).toBe("gemini-3.8-flash");
    expect(config.liteModel).toBe("gemini-3.8-flash");
  });
});
