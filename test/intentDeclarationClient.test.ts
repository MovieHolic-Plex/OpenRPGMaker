// 의도 선언 LLM 어댑터 — 한 번 호출·JSON 하나·실패는 중립 폴백·짧은 캐시.
import { afterEach, describe, expect, it } from "vitest";
import type { IntentFacts } from "@/ai/intentDeclaration";
import {
  buildIntentFacts,
  createLlmIntentDeclarer,
  declareIntentCached,
  resetIntentDeclarationCache,
  type IntentDeclarer,
} from "@/ai/intentDeclarationClient";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";

const CONFIG: AiConfig = {
  authMode: "apiKey",
  agentMode: "auto",
  baseUrl: "x",
  model: "main-model",
  liteModel: "lite-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 512,
} as AiConfig;

const FACTS: IntentFacts = {
  userText: "여관 지어줘",
  currentMap: { id: "map_start", name: "시작 맵" },
  selection: null,
  maps: [{ id: "map_start", name: "시작 맵" }],
  facilityLabels: ["여관"],
  toolNames: ["place_concept", "place_npc"],
  hasActivePlan: false,
};

function reply(content: string): ChatResult {
  return { message: { role: "assistant", content }, finishReason: "stop" } as ChatResult;
}

afterEach(() => resetIntentDeclarationCache());

describe("createLlmIntentDeclarer", () => {
  it("lite 모델·json_object·낮은 온도로 한 번 부르고 선언을 돌려준다", async () => {
    const requests: { config: AiConfig; req: ChatRequest }[] = [];
    const declarer = createLlmIntentDeclarer({
      getConfig: () => CONFIG,
      chat: async (config, req) => {
        requests.push({ config, req });
        return reply(JSON.stringify({ mode: "create", space: "interior", facility: "여관", tools: ["place_concept"], summary: "여관" }));
      },
    });
    const outcome = await declarer(FACTS);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.config.model).toBe("lite-model");
    expect(requests[0]!.req.response_format).toEqual({ type: "json_object" });
    expect(requests[0]!.req.temperature).toBeLessThanOrEqual(0.2);
    expect(requests[0]!.req.messages[1]!.content).toContain("여관 지어줘");
    expect(outcome.intent).toMatchObject({ mode: "create", space: "interior", facility: "여관", source: "llm" });
    expect(outcome.error).toBeUndefined();
  });

  it("모델이 형식을 어기면 중립 폴백으로 떨어지고 사유를 남긴다", async () => {
    const declarer = createLlmIntentDeclarer({ getConfig: () => CONFIG, chat: async () => reply("네 알겠습니다") });
    const outcome = await declarer(FACTS);
    expect(outcome.intent.source).toBe("fallback");
    expect(outcome.intent.clarify).toBeNull();
    expect(outcome.error).toBeTruthy();
  });

  it("호출이 던지거나 시간을 넘기면 폴백이다", async () => {
    const throwing = createLlmIntentDeclarer({ getConfig: () => CONFIG, chat: async () => { throw new Error("네트워크 없음"); } });
    expect((await throwing(FACTS)).error).toBe("네트워크 없음");
    const hanging = createLlmIntentDeclarer({
      getConfig: () => CONFIG,
      timeoutMs: 20,
      chat: (_config, req) => new Promise((_resolve, reject) => {
        req.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    });
    const outcome = await hanging(FACTS);
    expect(outcome.intent.source).toBe("fallback");
    expect(outcome.error).toMatch(/시간 초과/);
  });

  it("빈 문장은 부르지 않고, 진행 중 계획이 있을 때의 「계속」은 모델 없이 continuation 이다", async () => {
    let calls = 0;
    const declarer = createLlmIntentDeclarer({ getConfig: () => CONFIG, chat: async () => { calls += 1; return reply("{}"); } });
    expect((await declarer({ ...FACTS, userText: "   " })).intent.source).toBe("empty");
    expect((await declarer({ ...FACTS, userText: "계속", hasActivePlan: true })).intent.source).toBe("continuation");
    expect(calls).toBe(0);
    // 계획이 없을 때의 「계속」은 모델이 읽는다.
    await declarer({ ...FACTS, userText: "계속" });
    expect(calls).toBe(1);
  });
});

describe("declareIntentCached", () => {
  it("같은 문장·같은 사실은 한 번만 부른다(러너와 세션이 연달아 읽는다)", async () => {
    let calls = 0;
    const declarer: IntentDeclarer = async (facts) => {
      calls += 1;
      return { intent: { ...(await createLlmIntentDeclarer({ getConfig: () => CONFIG, chat: async () => reply(JSON.stringify({ mode: "create", tools: [], summary: facts.userText })) })(facts)).intent }, elapsedMs: 5 };
    };
    const first = await declareIntentCached(declarer, FACTS);
    const second = await declareIntentCached(declarer, FACTS);
    expect(calls).toBe(1);
    expect(first.intent.mode).toBe("create");
    expect(second.elapsedMs).toBe(0);
    await declareIntentCached(declarer, { ...FACTS, userText: "다른 문장" });
    expect(calls).toBe(2);
  });

  it("폴백(모델 실패)은 캐시하지 않아 다음 호출이 다시 시도한다", async () => {
    let calls = 0;
    const declarer = createLlmIntentDeclarer({ getConfig: () => CONFIG, chat: async () => { calls += 1; return reply("not json"); } });
    await declareIntentCached(declarer, FACTS);
    await declareIntentCached(declarer, FACTS);
    expect(calls).toBe(2);
  });
});

describe("buildIntentFacts", () => {
  it("코드가 아는 사실만 모은다 — 열린 맵·선택·맵 목록·개념 시설 라벨·활성 툴 이름", () => {
    const project = createBlankProject();
    const startMapId = project.startMapId!;
    const facts = buildIntentFacts({
      project,
      userText: "여관 지어줘",
      currentMapId: startMapId,
      selection: { mapId: startMapId, x: 1, y: 1, width: 5, height: 5 },
      hasActivePlan: false,
    });
    expect(facts.currentMap?.id).toBe(startMapId);
    expect(facts.selection?.width).toBe(5);
    expect(facts.maps.map((map) => map.id)).toContain(startMapId);
    expect(facts.facilityLabels).toContain("여관");
    expect(facts.toolNames).toContain("place_concept");
    expect(facts.toolNames).toContain("author_house");
  });
});
