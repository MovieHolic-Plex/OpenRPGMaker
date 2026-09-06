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
  it.each(["corrected", "duplicate", "omitted"] as const)("routes duplicate gold through one bounded repair: %s", async repair => {
    const rewards = [{ target: { eventName: "Chief" }, oneTime: true, grants: [
      { kind: "item", id: "item_potion", count: 2 }, { kind: "gold", count: 20 },
      { kind: "monster", id: "species_leafling", count: 1 },
    ] }];
    const invalid = { mode: "modify", npcRewards: [{ ...rewards[0], grants: [...rewards[0].grants, { kind: "gold", count: 20 }] }] };
    const requests: ChatRequest[] = [];
    const declarer = createLlmIntentDeclarer({ getConfig: () => CONFIG, chat: async (_config, request) => {
      requests.push(request);
      return reply(JSON.stringify(requests.length === 1 || repair === "duplicate" ? invalid
        : repair === "omitted" ? { mode: "modify" } : { mode: "create", npcRewards: rewards }));
    } });
    const facts = { ...FACTS, userText: "Make Chief give 20 gold, two potions and one Leafling once." };
    const outcome = await declarer(facts);
    expect(requests).toHaveLength(2);
    const echoed = requests[1].messages[2].content;
    if (typeof echoed !== "string") throw new Error("Expected original raw declaration in repair request");
    expect(JSON.parse(echoed)).toEqual(invalid);
    expect(outcome.intent.mode).toBe("modify");
    if (repair === "corrected") {
      expect(outcome.intent.npcRewards).toEqual(rewards);
      expect(outcome.error).toBeUndefined();
    } else {
      expect(outcome.intent.npcRewards).toHaveProperty("invalidReason");
      expect(outcome.error).toBeDefined();
    }
  });

  it.each([false, true])("preserves exact reference-free gold through admission/cache, shape repair=%s", async repair => {
    const rewards = [{ target: { eventName: "Chief" }, grants: [{ kind: "gold", count: 20 }], oneTime: true }];
    const requests: ChatRequest[] = [];
    const declarer = createLlmIntentDeclarer({
      getConfig: () => CONFIG,
      chat: async (_config, request) => {
        requests.push(request);
        return reply(JSON.stringify({ mode: requests.length === 1 ? "modify" : "create", npcRewards:
          repair && requests.length === 1 ? [{ ...rewards[0], grants: [{ kind: "gold", count: 20, id: null }] }] : rewards }));
      },
    });
    const first = await declareIntentCached(declarer, FACTS);
    expect(first.intent.npcRewards).toEqual(rewards);
    expect(first.intent.mode).toBe("modify");
    expect(first.error).toBeUndefined();
    expect((await declareIntentCached(declarer, FACTS)).intent.npcRewards).toEqual(rewards);
    expect(requests).toHaveLength(repair ? 2 : 1);
  });

  it("does not shape-repair or coerce the captured localized item declaration", async () => {
    const rewards = [{ target: { eventName: "촌장" }, grants: [{ kind: "item", name: "골드", count: 20 }], oneTime: true }];
    let calls = 0;
    const declarer = createLlmIntentDeclarer({ getConfig: () => CONFIG, chat: async () => {
      calls++;
      return reply(JSON.stringify({ mode: "modify", npcRewards: rewards }));
    } });
    expect((await declarer(FACTS)).intent.npcRewards).toEqual(rewards);
    expect(calls).toBe(1);
  });

  it("repairs an invalid reward declaration before returning an executable intent", async () => {
    const rewards = [{ target: { eventId: "npc_reward" }, grants: [{ kind: "item", id: "item_potion", count: 5 }], oneTime: true }];
    const responses = [
      { mode: "modify", npcRewards: [{ ...rewards[0], target: { eventId: "npc_reward", eventName: "Reward" } }] },
      { mode: "modify", npcRewards: rewards },
    ];
    const requests: ChatRequest[] = [];
    const declarer = createLlmIntentDeclarer({
      getConfig: () => CONFIG,
      chat: async (_config, request) => {
        requests.push(request);
        return reply(JSON.stringify(responses[requests.length - 1]));
      },
    });
    const outcome = await declarer(FACTS);
    expect(outcome.intent.npcRewards).toEqual(rewards);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.messages.map((message) => message.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(outcome.error).toBeUndefined();
  });

  it.each(["invalid", "omitted", "network"] as const)("keeps an invalid reward contract blocking when repair is %s", async (repair) => {
    let calls = 0;
    const invalid = { mode: "modify", npcRewards: [{ target: {}, grants: [] }] };
    const declarer = createLlmIntentDeclarer({
      getConfig: () => CONFIG,
      chat: async () => {
        calls++;
        if (calls === 2 && repair === "network") throw new Error("repair unavailable");
        return reply(JSON.stringify(calls === 2 && repair === "omitted" ? { mode: "modify" } : invalid));
      },
    });
    const outcome = await declarer(FACTS);
    expect(calls).toBe(2);
    expect(outcome.intent.npcRewards).toHaveProperty("invalidReason");
    expect(outcome.error).toBeDefined();
  });

  it("does not cache an invalid reward declaration after its repair attempt", async () => {
    let calls = 0;
    const valid = [{ target: { eventId: "npc_reward" }, grants: [{ kind: "item", id: "item_potion", count: 5 }] }];
    const declarer = createLlmIntentDeclarer({
      getConfig: () => CONFIG,
      chat: async () => reply(JSON.stringify({
        mode: "modify",
        npcRewards: ++calls <= 2 ? [{ target: {}, grants: [] }] : valid,
      })),
    });
    expect((await declareIntentCached(declarer, FACTS)).intent.npcRewards).toHaveProperty("invalidReason");
    expect((await declareIntentCached(declarer, FACTS)).intent.npcRewards).toEqual(valid);
    expect(calls).toBe(3);
  });

  it("carries request reward contracts through the actual JSON consumer and cache without final commands", async () => {
    const npcRewards = [{
      target: { eventName: "Mira", mapId: "map_start" },
      grants: [{ kind: "monster", name: "Leafling", count: 1 }, { kind: "item", name: "Potion", count: 2 }],
      oneTime: true, choices: [0],
    }];
    let calls = 0;
    const declarer = createLlmIntentDeclarer({
      getConfig: () => CONFIG,
      chat: async () => {
        calls++;
        return reply(JSON.stringify({ mode: "modify", npcRewards }));
      },
    });
    const facts = { ...FACTS, userText: "Make Mira offer Leafling and two potions once, using the first choice." };
    const first = await declareIntentCached(declarer, facts);
    const continued = await declareIntentCached(declarer, facts);
    expect(first.intent.npcRewards).toEqual(npcRewards);
    expect(continued.intent.npcRewards).toEqual(npcRewards);
    expect(calls).toBe(1);
    const invalid = createLlmIntentDeclarer({
      getConfig: () => CONFIG,
      chat: async () => reply(JSON.stringify({ mode: "modify", npcRewards: [{ target: { eventName: "Mira" }, grants: [] }] })),
    });
    const outcome = await invalid(facts);
    expect(outcome.intent.source).toBe("llm");
    expect(outcome.intent.npcRewards).toHaveProperty("invalidReason");
  });

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
