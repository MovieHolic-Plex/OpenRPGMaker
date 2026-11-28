import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { buildIndependentReviewRequest, reviewChanges, reviewMapReferenceRoots, type ReviewInput } from "@/ai/independentReview";
import { extractOriginalContext } from "@/ai/originalContext";
import { defaultAiConfig, AI_CONFIG_STORAGE_KEY, AI_CONFIG_VERSION, loadAiConfig, scrubStoredAiCredentials, chatCompletion, getAiModelDemotion, reportModelDemotion, resetAiModelDemotion, resetAiTransportHealth, type AiConfig, configForLiteModel } from "@/ai/llmClient";
import { createBlankMap } from "@/project/defaults";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import type { Command, Project } from "@/project/types";
import { independentReviewPayload } from "./independentReviewFixture";
import { RETIRED_COMBINED_TOWN_TILESET_ID, startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

describe("independentReviewLinkedMaps", () => {
  isolateTimers();
  function fixture(size = 4) {
    const project = startOnRetiredCombinedTown(createBlankProject());
    for (let i = 0; i < 5; i++) project.maps[`map_${i}`] = { ...createBlankMap(`Map ${i}`, size, size, RETIRED_COMBINED_TOWN_TILESET_ID), id: `map_${i}` };
    return project;
  }
  function commands(project: Project, mapId: string, values: Command[]) {
    const map = project.maps[mapId];
    if (!map) throw new Error("Map fixture is incomplete");
    map.events = [{ id: `event_${mapId}`, x: 1, y: 1, trigger: { kind: "action" }, commands: values }];
  }
  const transfer = (mapId: string, x = 1): Command => ({ kind: "transfer", mapId, x, y: 1 });
  function input(before: Project, after: Project): ReviewInput {
    const changes = reviewChanges(before, after);
    const mapReferenceRoots = [before.startMapId, ...reviewMapReferenceRoots(before, after, changes)];
    return { revision: 1, originalRequest: "Edit only the requested authored value", changes,
      before: [extractOriginalContext(before, { snapshotId: "before", currentMapId: before.startMapId, mapReferenceRoots })],
      after: [extractOriginalContext(after, { snapshotId: "after", currentMapId: before.startMapId, mapReferenceRoots })],
      toolResults: [], acceptance: null, requiredProblems: [], images: [] };
  }
  function expectMaps(review: ReviewInput, mapIds: string[]) {
    for (const side of ["before", "after"] as const) {
      expect.soft(review[side].flatMap(context => context.entries).filter(entry => /^\/maps\/[^/]+$/.test(entry.id))
        .map(entry => entry.id).sort()).toEqual(mapIds.map(id => `/maps/${id}`).sort());
    }
  }
  function delivered(review: ReviewInput) {
    const payload = independentReviewPayload(buildIndependentReviewRequest(defaultAiConfig(), review));
    if (!payload) throw new Error("Review request was not built");
    expect(payload.changes).toEqual(JSON.parse(JSON.stringify(review.changes)));
    return payload;
  }
  describe("review of linked maps", () => {
    it.each(["chain", "star"])("renames only the 20x15 target without expanding unchanged %s links to five 256x256 maps", topology => {
      const before = fixture(256);
      expect(before.testPresets ?? []).toEqual([]);
      const ids = [before.startMapId, ...Array.from({ length: 5 }, (_, i) => `map_${i}`)];
      for (const [i, id] of ids.entries()) commands(before, id,
        topology === "star" && i === 0 ? ids.slice(1).map(id => transfer(id)) : [transfer(ids[i + 1] ?? before.startMapId)]);
      const after = structuredClone(before);
      const target = after.maps[before.startMapId];
      if (!target) throw new Error("Target fixture is incomplete");
      expect([target.width, target.height]).toEqual([20, 15]);
      target.name = "Renamed target";
      const review = input(before, after);
      expect(review.changes.map(change => change.path)).toEqual(["/maps/map_blank_start"]);
      expectMaps(review, [before.startMapId]);
      const payload = delivered(review);
      for (const side of ["before", "after"] as const) expect(payload[side][0]?.entries
        .find(entry => entry.id === `/maps/${before.startMapId}/events/event_${before.startMapId}`)?.value)
        .toMatchObject({ event: before.maps[before.startMapId]?.events[0] });
    });

    it.each(["added", "changed"])("scopes an %s world NPC entity independently of unchanged sibling map references", mode => {
      const before = fixture(256);
      before.world = { entities: Array.from({ length: 5 }, (_, i) => ({ id: `npc_${i}`, type: "character", name: `NPC ${i}`,
        summary: "Existing", origin: "user", refs: [{ kind: "map", id: `map_${i}` }] })), relations: [] };
      const after = structuredClone(before);
      after.world = { ...before.world, entities: mode === "added" ? [{ id: "added", type: "character", name: "Added",
        summary: "New", origin: "user", refs: [{ kind: "map", id: before.startMapId }] }, ...before.world.entities]
        : before.world.entities.map(entity => entity.id === "npc_0" ? { ...entity, summary: "Changed" } : entity).reverse() };
      const review = input(before, after);
      expectMaps(review, mode === "added" ? [before.startMapId] : [before.startMapId, "map_0"]);
      expect(delivered(review).changes).toEqual([{ path: "/world", before: before.world, after: after.world }]);
    });

    it.each(["destination", "coordinates", "nested-coordinates", "insert-dialogue", "duplicate-transfer"])("retains just the affected transfer targets for %s edits", mode => {
      const before = fixture();
      const body = [transfer("map_0"), transfer("map_4")];
      commands(before, before.startMapId, mode === "nested-coordinates" ? [{ kind: "loop", body }] : body);
      commands(before, "map_0", [transfer("map_3")]);
      commands(before, "map_1", [transfer("map_2")]);
      const after = structuredClone(before);
      const revised = [transfer(mode === "destination" ? "map_1" : "map_0", 2), transfer("map_4")];
      commands(after, after.startMapId, mode === "nested-coordinates" ? [{ kind: "loop", body: revised }]
        : mode === "insert-dialogue" ? [{ kind: "text", body: "Added dialogue" }, ...body]
        : mode === "duplicate-transfer" ? [...body, transfer("map_0")] : revised);
      const review = input(before, after);
      expectMaps(review, mode === "insert-dialogue" ? [before.startMapId]
        : mode === "destination" ? [before.startMapId, "map_0", "map_1"] : [before.startMapId, "map_0"]);
      delivered(review);
    });

    it("follows changed common-event calls through cycles, but not through unrelated destination map contents", () => {
      const before = fixture();
      before.commonEvents.push({ id: "old_call", name: "Old", trigger: "none", commands: [transfer("map_0")] },
        { id: "new_call", name: "New", trigger: "none", commands: [{ kind: "callCommonEvent", commonEventId: "nested_call" }] },
        { id: "nested_call", name: "Nested", trigger: "none", commands: [transfer("map_1"), { kind: "callCommonEvent", commonEventId: "new_call" }] });
      commands(before, before.startMapId, [{ kind: "callCommonEvent", commonEventId: "old_call" }, transfer("map_4")]);
      commands(before, "map_0", [transfer("map_3")]);
      commands(before, "map_1", [transfer("map_2")]);
      const after = structuredClone(before);
      commands(after, after.startMapId, [{ kind: "callCommonEvent", commonEventId: "new_call" }, transfer("map_4")]);
      const review = input(before, after);
      expectMaps(review, [before.startMapId, "map_0", "map_1"]);
      for (const side of ["before", "after"] as const) {
        const entries = delivered(review)[side].flatMap(context => context.entries);
        for (const id of ["old_call", "new_call", "nested_call"]) expect(entries.filter(entry => entry.id === `/database/commonEvents/${id}`)).toHaveLength(1);
      }
    });

    it("scopes a changed common-event command without following its unchanged sibling commands", () => {
      const before = fixture();
      before.commonEvents.push({ id: "changed_call", name: "Changed", trigger: "none", commands: [transfer("map_0"), transfer("map_4")] });
      commands(before, before.startMapId, [{ kind: "callCommonEvent", commonEventId: "changed_call" }]);
      const after = structuredClone(before);
      const common = after.commonEvents.find(event => event.id === "changed_call");
      if (!common) throw new Error("Common-event fixture is incomplete");
      common.commands = [transfer("map_0", 2), transfer("map_4")];
      const review = input(before, after);
      expectMaps(review, [before.startMapId, "map_0"]);
      delivered(review);
    });
  });
});

describe("llmClient", () => {
  isolateTimers();
  // 저장된 설정 마이그레이션 회귀 스펙.
  //
  // loadAiConfig 는 평문 apiKey·죽은 baseUrl 을 *무시*하지만, **디스크에는 blob 이 덮어써질
  // 때까지 남는다.** 인증 패널이 "브라우저에는 두지 않습니다" 라고 약속하는데 그게 미래 키에만
  // 적용되면 약속이 아니다 — export·디버그 덤프·raw blob 을 읽는 코드에 그대로 실려 나간다.
  describe("aiConfigMigration", () => {
    isolateTimers();
    let store: Map<string, string>;
    beforeEach(() => {
      store = new Map<string, string>();
      (globalThis as unknown as { localStorage: unknown }).localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
      };
    });
    afterEach(() => {
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    });
    const LEGACY = {
      authMode: "apiKey",
      apiKey: "sk-legacy-LEAK",
      baseUrl: "/api/cliproxy",
      model: "cpen/gpt-5-6-luna",
      providerId: "zai",
      maxTokens: 4096,
    };
    describe("scrubStoredAiCredentials", () => {
      it("평문 키와 죽은 게이트웨이 주소를 디스크에서 지운다", () => {
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(LEGACY));

        const result = scrubStoredAiCredentials();

        expect(result).toMatchObject({ scrubbed: true, hadApiKey: true, hadBaseUrl: true });
        const raw = store.get(AI_CONFIG_STORAGE_KEY) ?? "";
        expect(raw).not.toContain("sk-legacy-LEAK");
        expect(raw).not.toContain("/api/cliproxy");
        const blob = JSON.parse(raw);
        expect(blob.apiKey).toBe("");
        expect(blob.baseUrl).toBe("");
        expect(blob.authMode).toBe("chatgpt");
        expect(blob.configVersion).toBe(AI_CONFIG_VERSION);
      });

      it("사용자가 고른 제공자와 나머지 설정은 보존한다", () => {
        // 지우는 것은 비밀과 죽은 주소뿐이다 — 설정을 초기화하는 함수가 아니다.
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(LEGACY));

        scrubStoredAiCredentials();

        const blob = JSON.parse(store.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
        expect(blob.providerId).toBe("zai");
        expect(blob.maxTokens).toBe(4096);
      });

      it("두 번 불러도 같다 (멱등)", () => {
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(LEGACY));

        const first = scrubStoredAiCredentials();
        const after = store.get(AI_CONFIG_STORAGE_KEY);
        const second = scrubStoredAiCredentials();

        expect(first.scrubbed).toBe(true);
        expect(second.scrubbed).toBe(false);
        expect(store.get(AI_CONFIG_STORAGE_KEY)).toBe(after);
      });

      it("저장값이 없으면 아무것도 쓰지 않는다", () => {
        expect(scrubStoredAiCredentials()).toMatchObject({ scrubbed: false });
        expect(store.has(AI_CONFIG_STORAGE_KEY)).toBe(false);
      });

      it("깨진 blob 은 건드리지 않는다", () => {
        store.set(AI_CONFIG_STORAGE_KEY, "{not json");
        expect(scrubStoredAiCredentials()).toMatchObject({ scrubbed: false });
        expect(store.get(AI_CONFIG_STORAGE_KEY)).toBe("{not json");
      });

      it("키가 없던 설정은 hadApiKey=false 로 보고한다 (헛된 토스트 방지)", () => {
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ authMode: "chatgpt", model: "gpt-5.6-sol" }));
        expect(scrubStoredAiCredentials()).toMatchObject({ scrubbed: true, hadApiKey: false, hadBaseUrl: false });
      });
    });
    describe("loadAiConfig — 제공자는 Antigravity·Codex 둘뿐이다", () => {
      it("사라진 제공자(zai)는 기본 제공자로 마이그레이션한다", () => {
        // zai 는 레지스트리에서 사라진 id 다 — parseOhMyPiProvider 가 기본 제공자로 스냅하고,
        // 모델 선택은 보존한다. 지원되지 않는 조합은 전송 시 명시적으로 거부한다.
        // (Codex 는 사라지지 않았으므로 그 선택은 보존된다 — test/aiAntigravityOnly.test.ts)
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "zai", model: "glm-5.3" }));

        const config = loadAiConfig();

        expect(config.providerId).toBe("google-antigravity");
        expect(config.model).toBe("glm-5.3");
        // 전송 축은 그대로 동반 서비스에 고정된다 — 브라우저에 비밀도 죽은 baseUrl 도 남지 않는다.
        expect(config.authMode).toBe("chatgpt");
        expect(config.baseUrl).toBe("");
        expect(config.apiKey).toBe("");
      });

      it("모르는 제공자는 기본값으로 떨어진다", () => {
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "no-such-provider" }));
        expect(loadAiConfig().providerId).toBe("google-antigravity");
      });

      it("providerId 없는 새 설정은 Antigravity OAuth 를 쓴다", () => {
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ authMode: "chatgpt" }));
        const config = loadAiConfig();
        expect(config.providerId).toBe("google-antigravity");
        expect(config.model).toBe("gemini-4-argon");
      });

      it("providerId 없이 gpt 모델만 남은 옛 blob 도 Antigravity 로 마이그레이션한다", () => {
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ authMode: "chatgpt", model: "gpt-5.6-sol" }));
        const config = loadAiConfig();
        expect(config.providerId).toBe("google-antigravity");
        expect(config.model).toBe("gpt-5.6-sol");
      });
    });
    describe("loadAiConfig — 옛 공장 기본 모델을 새 기본으로 소급한다", () => {
      it("저장된 옛 공장 기본(3.7-flash·3.8-flash)은 새 기본(4-argon)으로 승격한다", () => {
        // 기본 모델 이동 때 상수·카탈로그만 바뀌고 **저장값에는 적용되지 않아**,
        // 그 전에 앱을 켠 사용자는 옛 공장 기본에 그대로 남았다(사용자 보고 2026-10-05 / 2026-10-14).
        for (const legacyModel of ["gemini-3.7-flash", "gemini-3.8-flash"]) {
          store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
            providerId: "google-antigravity",
            model: legacyModel,
            liteModel: legacyModel,
          }));

          const config = loadAiConfig();

          expect(config.model, legacyModel).toBe("gemini-4-argon");
          expect(config.liteModel, legacyModel).toBe("gemini-4-argon");
        }
      });

      it("역할·Ultrabrain 슬롯에 남은 옛 공장 기본도 함께 승격한다", () => {
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
          providerId: "google-antigravity",
          roleModels: {
            writer: { provider: "google-antigravity", model: "gemini-3.7-flash", thinkingLevel: "medium" },
            vision: { provider: "google-antigravity", model: "gemini-3.7-flash-tiered", thinkingLevel: "medium" },
            build: { provider: "google-antigravity", model: "gemini-3.8-flash", thinkingLevel: "medium" },
          },
          ultrabrainModel: "gemini-3.8-flash",
        }));

        const config = loadAiConfig();

        expect(config.roleModels?.writer?.model).toBe("gemini-4-argon");
        expect(config.roleModels?.vision?.model).toBe("gemini-4-argon");
        expect(config.roleModels?.build?.model).toBe("gemini-4-argon");
        expect(config.ultrabrainModel).toBe("gemini-4-argon");
      });

      it("사용자가 직접 고른 모델은 그대로 보존한다", () => {
        for (const kept of ["gemini-9-experimental", "glm-5.3", "gemini-2.5-pro"]) {
          store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "google-antigravity", model: kept }));
          expect(loadAiConfig().model, kept).toBe(kept);
        }
      });

      it("Codex 제공자의 gemini 모델은 건드리지 않는다(제공자가 다르다)", () => {
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-codex", model: "gemini-3.7-flash" }));
        expect(loadAiConfig().model).toBe("gemini-3.7-flash");
      });
    });
  });
  // 모델 조용한 강등 회귀 스펙.
  //
  // 동반 서비스의 resolveModel 은 카탈로그 밖 모델 ID 를 오류가 아니라 제공자 기본 모델로
  // 바꿔 버린다 — **68종 전부에서.** isModelValidForAuthMode 화이트리스트는 openai-codex
  // 하나만 막으므로 나머지 제공자는 무방비였고, 감독이 고른 모델이 아닌 것이 답해도 신호가 없었다.
  //
  // 다행히 응답 본문의 `model` 은 해석된 모델이다(assistantToOpenAI). 서버를 고치지 않고도
  // 요청 모델과 비교하면 강등이 보인다 — 이 스펙이 그 비교를 고정한다.
  describe("aiModelDemotion", () => {
    isolateTimers();
    const CONFIG: AiConfig = {
      authMode: "apiKey",
      baseUrl: "https://example.invalid/v1",
      model: "glm-5.2-ultrafast",
      apiKey: "sk-test",
      maxToolCalls: 8,
      maxTokens: 1024,
    };
    function completion(model: string): Response {
      return new Response(
        JSON.stringify({
          model,
          choices: [{ message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    beforeEach(() => {
      resetAiModelDemotion();
      resetAiTransportHealth();
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      resetAiModelDemotion();
    });
    describe("reportModelDemotion", () => {
      it("요청 모델과 응답 모델이 같으면 아무것도 기록하지 않는다", () => {
        reportModelDemotion("gpt-5.6-sol", "gpt-5.6-sol");
        expect(getAiModelDemotion()).toBeNull();
      });

      it("대소문자만 다른 것은 강등이 아니다", () => {
        reportModelDemotion("GPT-5.6-Sol", "gpt-5.6-sol");
        expect(getAiModelDemotion()).toBeNull();
      });

      it("빈 값은 무시한다", () => {
        reportModelDemotion("", "gpt-5.6-sol");
        reportModelDemotion("gpt-5.6-sol", "   ");
        expect(getAiModelDemotion()).toBeNull();
      });

      it("다르면 요청·응답 모델을 함께 기록한다", () => {
        reportModelDemotion("glm-5.2-ultrafast", "gpt-5.5");
        expect(getAiModelDemotion()).toMatchObject({
          requested: "glm-5.2-ultrafast",
          served: "gpt-5.5",
        });
      });
    });
    describe("실제 응답에서 강등을 잡아낸다", () => {
      it("응답 model 이 요청과 다르면 기록된다 (서버 변경 없이)", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => completion("gpt-5.5")));

        const result = await chatCompletion(CONFIG, { messages: [{ role: "user", content: "hi" }] });

        // 강등된 응답도 쓸 수 있는 응답이다 — 크게 말하되 치명적으로 만들지 않는다.
        expect(result.message.content).toBe("OK");
        expect(getAiModelDemotion()).toMatchObject({
          requested: "glm-5.2-ultrafast",
          served: "gpt-5.5",
        });
      });

      it("응답 model 이 요청과 같으면 기록하지 않는다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => completion("glm-5.2-ultrafast")));

        await chatCompletion(CONFIG, { messages: [{ role: "user", content: "hi" }] });

        expect(getAiModelDemotion()).toBeNull();
      });

      it("응답에 model 필드가 없으면 판단하지 않는다 (지어내지 않는다)", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(
          JSON.stringify({ choices: [{ message: { role: "assistant", content: "OK" } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )));

        await chatCompletion(CONFIG, { messages: [{ role: "user", content: "hi" }] });

        expect(getAiModelDemotion()).toBeNull();
      });
    });
  });
  describe("llmReasoning", () => {
    isolateTimers();
    type ResponseLike = Pick<Response, "body" | "json" | "ok" | "status" | "text">;
    type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<ResponseLike>;
    type FetchMock = ReturnType<typeof vi.fn<FetchStub>>;
    let fetchDescriptor: PropertyDescriptor | undefined;
    let localStorageDescriptor: PropertyDescriptor | undefined;
    beforeEach(() => {
      fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
      localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    });
    afterEach(() => {
      vi.restoreAllMocks();
      if (fetchDescriptor) {
        Object.defineProperty(globalThis, "fetch", fetchDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      if (localStorageDescriptor) {
        Object.defineProperty(globalThis, "localStorage", localStorageDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "localStorage");
      }
    });
    function jsonResponse(payload: unknown): ResponseLike {
      return {
        body: null,
        json: async () => payload,
        ok: true,
        status: 200,
        text: async () => JSON.stringify(payload),
      };
    }
    function stubFetch(response: ResponseLike): FetchMock {
      const fetchMock = vi.fn<FetchStub>(async () => response);
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: fetchMock,
      });
      return fetchMock;
    }
    function sentBody(fetchMock: FetchMock): unknown {
      const init = fetchMock.mock.calls[0]?.[1];
      if (!init) throw new Error("fetch init missing");
      return JSON.parse(String(init.body));
    }
    function streamFromChunks(chunks: readonly string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      let index = 0;
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          const chunk = chunks[index];
          if (chunk) {
            controller.enqueue(encoder.encode(chunk));
            index += 1;
            return;
          }
          controller.close();
        },
      });
    }
    function installLocalStorage(value: unknown): void {
      const store = new Map([[AI_CONFIG_STORAGE_KEY, JSON.stringify(value)]]);
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, nextValue: string) => void store.set(key, nextValue),
          removeItem: (key: string) => void store.delete(key),
          clear: () => store.clear(),
        },
      });
    }
    describe("LLM reasoning 요청", () => {
      it("reasoningEffort high면 요청 본문에 high를 그대로 넣는다(모델 이름으로 깎지 않는다)", async () => {
        const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
        const config = { ...defaultAiConfig(), baseUrl: "https://example.invalid/v1", apiKey: "sk-test",
          model: "openai/gpt-4o",
          reasoningEffort: "high" as const,
        };

        await chatCompletion(config, { messages: [{ role: "user", content: "hi" }] });

        expect(sentBody(fetchMock)).toMatchObject({ reasoning: { effort: "high" } });
      });

      it("medium 설정은 모델 이름과 무관하게 medium 그대로 나간다", async () => {
        // 예전에는 모델 이름에 특정 공급자 문자열이 있으면 medium→low 로 몰래 깎았다. 그 공급자를
        // 쓰지 않으므로 캡을 걷어냈고, 사용자가 고른 값이 그대로 실려야 한다.
        const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
        const config = { ...defaultAiConfig(), baseUrl: "https://example.invalid/v1", apiKey: "sk-test",
          model: "stub-model",
          reasoningEffort: "medium" as const,
        };

        await chatCompletion(config, { messages: [{ role: "user", content: "hi" }] });

        expect(sentBody(fetchMock)).toMatchObject({ reasoning: { effort: "medium" } });
      });

      it("configForLiteModel은 reasoning을 off로 끈다", () => {
        const lite = configForLiteModel({
          ...defaultAiConfig(), authMode: "apiKey", baseUrl: "https://example.invalid/v1", model: "stub-supervisor-model",
          liteModel: "stub-lite-model",
          reasoningEffort: "high",
          // #2535 부터 기본 설정에 역할 모델(deep)이 있어 그 칸을 따른다 — liteModel 경로를 보려고 apiKey + 역할 모델 없음으로 둔다.
          roleModels: undefined,
        });
        expect(lite.reasoningEffort).toBe("off");
      });

      it("reasoningEffort가 off이면 요청 본문에 reasoning 키를 넣지 않는다", async () => {
        // Given: reasoning을 끈 LLM 설정.
        const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
        const config = { ...defaultAiConfig(), baseUrl: "https://example.invalid/v1", apiKey: "sk-test", reasoningEffort: "off" as const };

        // When: 실제 chatCompletion 경로로 요청한다.
        await chatCompletion(config, { messages: [{ role: "user", content: "hi" }] });

        // Then: fetch에 전달된 JSON에는 reasoning 키가 없다.
        expect(sentBody(fetchMock)).not.toHaveProperty("reasoning");
      });
    });
    describe("LLM reasoning 응답 파싱", () => {
      it("비스트리밍 message.reasoning 문자열을 assistant 메시지에 보존한다", async () => {
        // Given: LLM 비스트리밍 응답에 reasoning이 있다.
        stubFetch(jsonResponse({ choices: [{ message: { content: "hi", reasoning: "내가 생각한 것" } }] }));

        // When: 실제 chatCompletion 경로로 파싱한다.
        const result = await chatCompletion(defaultAiConfigWithKey(), { messages: [{ role: "user", content: "hi" }] });

        // Then: assistant 메시지에 reasoning이 남는다.
        expect(result.message.reasoning).toBe("내가 생각한 것");
      });

      it("스트리밍 delta.reasoning을 누적하고 콜백으로 전달한다", async () => {
        // Given: SSE가 reasoning과 content delta를 나눠서 보낸다.
        const response = new Response(
          streamFromChunks([
            'data: {"choices":[{"delta":{"reasoning":"생각"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"답"}}]}\n\n',
            "data: [DONE]\n\n",
          ]),
          { status: 200 }
        );
        const reasoning: string[] = [];
        stubFetch(response);

        // When: 실제 스트리밍 chatCompletion 경로로 파싱한다.
        const result = await chatCompletion(defaultAiConfigWithKey(), {
          messages: [{ role: "user", content: "hi" }],
          stream: true,
          onReasoning: (delta) => reasoning.push(delta),
        });

        // Then: reasoning과 content가 각각 조립된다.
        expect(result.message.reasoning).toBe("생각");
        expect(result.message.content).toBe("답");
        expect(reasoning).toEqual(["생각"]);
      });
    });
    describe("AI reasoning 설정 로드", () => {
      it("저장된 reasoningEffort low를 그대로 읽는다", () => {
        // Given: localStorage에 low 설정이 저장되어 있다.
        installLocalStorage({ reasoningEffort: "low" });

        // When: 설정을 로드한다.
        const config = loadAiConfig();

        // Then: 저장된 reasoning effort를 보존한다.
        expect(config.reasoningEffort).toBe("low");
      });

      it("잘못된 reasoningEffort는 기본(high)으로 되돌린다", () => {
        // "max" 는 #3272 부터 유효한 값이다 — 진짜 잘못된 값으로 본다.
        installLocalStorage({ reasoningEffort: "bogus" });
        const config = loadAiConfig();
        expect(config.reasoningEffort).toBe("high");
      });

      it("기본 reasoningEffort는 high다(공장 기본 Claude Sonnet 5.5 high, 2026-11-23 — 그 전 ChatGPT medium 2026-11-19, Argon medium #2535)", () => {
        const config = defaultAiConfig();
        expect(config.reasoningEffort).toBe("high");
      });
    });
    function defaultAiConfigWithKey(): ReturnType<typeof defaultAiConfig> {
      return { ...defaultAiConfig(), baseUrl: "https://example.invalid/v1", apiKey: "sk-test" };
    }
  });
});
