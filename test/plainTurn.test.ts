import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildPiRunRequest, normalizePiThinkingLevel, prefersCallerThinking, classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import type { PiAgentThinkingLevel } from "@/ai/piAgent/protocol";
import { DEFAULT_MODEL, defaultAiConfig } from "@/ai/llmClient";
import { modelForRole } from "@/ai/modelRoles";
import { createBlankProject } from "@/project/defaults";
import { chatgptFixtureConfig } from "./helpers/chatgptFixtureConfig";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { GENRE_PRESET_BRIEF_PREFIX } from "@/ai/genrePresetBrief";
import { feasibleModifiers, pickWidenModifier } from "@/ai/vagueWiden";
import { WIDEN_MODIFIERS } from "@/ai/vagueWidenCatalog";
import { resetWidenHistory } from "@/ai/vagueWidenHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { fixedDeclarer } from "./intentFixture";
import { isolateTimers } from "./mergedTeardown";

// 자율성 다이얼 → 실행 루프의 사고 강도, 그리고 공급자가 거부하는 강도의 정규화.
//
// 2026-09-26 실측이 잡으려는 것 둘: (1) 다이얼을 낮춰도 실행 턴이 역할 기본값(high)으로 돌아
// 턴당 ~2.9s 를 계속 태우는 회귀, (2) google-antigravity 에 "off" 가 실려 스트림 error
// `Supported efforts: minimal, low, medium, high` 로 실행이 첫 호출에서 죽는 회귀.
describe("piAgentThinkingLevel", () => {
  isolateTimers();
  const brain = { providerId: "google-antigravity", model: "gemini-3.8-flash", reasoningEffort: "high" } as const;
  const deep = { provider: "google-antigravity", model: "gemini-3.8-flash", thinkingLevel: "high" } as const;
  const writer = { provider: "google-antigravity", model: "gemini-3.8-flash", thinkingLevel: "medium" } as const;
  function runRequest(extra: {
    readonly planOnly?: boolean;
    readonly readOnly?: boolean;
    readonly deep?: Parameters<typeof buildPiRunRequest>[0]["deep"];
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
    it("floors GPT-6.2 Sol building turns at medium and preserves high", () => {
      const sol = { provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "medium" } as const;
      expect(runRequest({ deep: sol, callerThinkingLevel: "low", preferCallerThinking: true }).thinkingLevel).toBe("medium");
      expect(runRequest({ deep: sol, callerThinkingLevel: "high", preferCallerThinking: true }).thinkingLevel).toBe("high");
      expect(runRequest({ deep: sol, callerThinkingLevel: "low", preferCallerThinking: true, readOnly: true }).thinkingLevel).toBe("low");
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
      expect(prefersCallerThinking({ ...derived, provider: "google-antigravity" }, derived)).toBe(false);
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
  describe("provider-specific defaults", () => {
    it("uses medium for the ChatGPT Sol profile and keeps explicit legacy role values", () => {
      // ChatGPT 로 저장된 설정으로 잰다 — 공장 기본은 Claude 다(2026-11-23). roleModels 가 없을 때의 폴백은 ChatGPT 만 medium 이상으로 올린다.
      const config = chatgptFixtureConfig();
      expect(modelForRole({ ...config, roleModels: undefined }, "deep").thinkingLevel).toBe("medium");
      expect(modelForRole({ ...config, roleModels: { deep: { ...deep } } }, "deep").thinkingLevel).toBe("high");
      expect(DEFAULT_MODEL).toBe("gemini-4-argon");
    });
  });
});

// 장르 프리셋 첫 요청은 의도 선언(모델 호출)을 건너뛴다 — 답이 정해진 판정에 10~24초와 30초 실패 창을 쓰지 않는다.
describe("plainTurnGenrePreset", () => {
  isolateTimers();
  const input = (text: string, piTeam: boolean, autonomy = resolveAutonomy("balanced")) => {
    const declarer = vi.fn(() => { throw new Error("프리셋 요청에서 의도 선언을 불렀다"); });
    const project = createBlankProject();
    return { declarer, run: () => classifyPlainPiTurn({ project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, autonomy, declarer, piTeam }) };
  };
  describe("장르 프리셋 첫 요청", () => {
    it.each([true, false])("의도 선언 없이 쓰기 실행으로 분류한다 (팀=%s)", async (piTeam) => {
      // 「몬스터 수집」 프리셋은 2026-10-14 자유도 감사 #3·#5 부터 몬스터 칩셋 캠페인 경로(단독·도구 좁힘)로 먼저 빠진다 — 일반 장르로 본다.
      const { declarer, run } = input(`${GENRE_PRESET_BRIEF_PREFIX} 연애 시뮬레이션\n\n기획…`, piTeam);
      const out = await run();
      expect(declarer).not.toHaveBeenCalled();
      expect(out.mode).toBe(piTeam ? "team" : "single");
      expect(out.plan).toMatchObject({ readOnly: false, routineEdit: false });
      // 도구를 좁히지 않는다 — 게임 전체 저작은 DB·시스템·맵 도구를 모두 쓴다.
      expect(out.initialToolNames).toBeUndefined();
    });

    it("읽기 전용 다이얼이면 여전히 단독 읽기 턴이다", async () => {
      const { declarer, run } = input(`${GENRE_PRESET_BRIEF_PREFIX} 몬스터 수집`, true, resolveAutonomy("readonly"));
      const out = await run();
      expect(declarer).not.toHaveBeenCalled();
      expect(out.mode).toBe("single");
      expect(out.plan.readOnly).toBe(true);
    });
  });
});

describe("vagueWiden", () => {
  isolateTimers();
  const classify = (text: string, intent: Partial<IntentDeclaration>, project = createBlankProject()) => classifyPlainPiTurn({
    project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, piTeam: false,
    autonomy: resolveAutonomy("balanced"), declarer: () => fixedDeclarer(intent), widenRandom: () => 0,
  });
  describe("vague create requests widen instead of asking", () => {
    beforeEach(() => { resetWidenHistory(); resetIntentDeclarationCache(); });

    it("builds a feasible scene at once instead of returning the clarify question", async () => {
      const result = await classify("집 지어줘", { mode: "create", space: "unclear", widenSubject: "house", clarify: "실내인가요 야외인가요?", clarifyOptions: ["실내", "야외"] });
      expect(result.clarify).toBeUndefined();
      expect(result.widen?.startLine).toContain("다른 느낌이면 말해 주세요");
      expect(result.intentNote).toContain(result.widen!.label);
    });

    it("still asks when the declaration is ambiguous without a widen subject", async () => {
      const result = await classify("방 만들어줘", { mode: "create", space: "unclear", clarify: "실내인가요 야외인가요?", clarifyOptions: ["실내", "야외"] });
      expect(result.clarify).toContain("실내인가요");
      expect(result.widen).toBeUndefined();
    });

    it("does not pick a random scene when the user attached a picture — the memo says to build from the picture", async () => {
      const project = createBlankProject();
      const result = await classifyPlainPiTurn({
        project, text: "마을 하나 만들어줘", currentMapId: project.startMapId, selection: null, hasActivePlan: false, piTeam: false,
        autonomy: resolveAutonomy("balanced"), declarer: () => fixedDeclarer({ mode: "create", widenSubject: "village" }), widenRandom: () => 0,
        hasUserImages: true,
      });
      expect(result.widen).toBeUndefined();
      expect(result.intentNote).toContain("[붙인 그림]");
      expect(result.intentNote).not.toContain("[넓힌 요청]");
    });

    it("does not repeat a scene already used in the same project", async () => {
      const first = await classify("마을 만들어줘", { mode: "create", widenSubject: "village" });
      const second = await classify("마을 만들어줘 ", { mode: "create", widenSubject: "village" });
      expect(second.widen?.id).not.toBe(first.widen?.id);
    });
  });
  describe("widen feasibility filter", () => {
    it("drops a scene whose landmark kit the project does not have", () => {
      const project = createBlankProject();
      expect(feasibleModifiers(project, "village").map((m) => m.id)).toContain("village-windmill-hill");
      const tileset = project.tilesets.beodeul_city!;
      tileset.structureKits = tileset.structureKits?.filter((kit) => kit.id !== "bd-windmill");
      expect(feasibleModifiers(project, "village").map((m) => m.id)).not.toContain("village-windmill-hill");
    });

    it("offers nothing when the scene tileset is missing", () => {
      const project = createBlankProject();
      delete (project.tilesets as Record<string, unknown>).beodeul_city;
      expect(feasibleModifiers(project, "dungeon")).toEqual([]);
      expect(pickWidenModifier([], [])).toBeNull();
    });

    it("reuses the least recently used scene once every feasible one was used", () => {
      const villages = WIDEN_MODIFIERS.filter((m) => m.subject === "village");
      const history = villages.map((m) => m.id);
      expect(pickWidenModifier(villages, history)?.id).toBe(history[0]);
    });
  });
});
