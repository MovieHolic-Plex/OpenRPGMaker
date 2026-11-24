import { describe, expect, it, afterEach, vi } from "vitest";
import { buildEditorReferenceIndex, findEditorReferences, resolveEditorReferenceQuery, type EditorReferenceIndex } from "@/editor/aiAnswerLinks";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { GameEvent, GameMap, Project, ActorParameterKey, EventPage } from "@/project/types";
import { isAiAssistantBridgeConnected, registerAiAssistantBridge, setAiBridgeLastStatus, unregisterAiAssistantBridge, sendAiAssistantMessage, type AiAssistantBridgeHandlers, type AiBridgeTurnResult, whenAiAssistantBridgeSettled } from "@/editor/aiAssistantBridge";
import { bounded, deferred } from "./aiEpochFixture";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import { toOpenAiTools, activeTools, allTools } from "@/editor/tools";
import { ESCALATION_DENYLIST, MAX_CAPABILITY_ESCALATED_TOOLS, capabilityEscalationSchemas, capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { mentionedToolSchemas } from "@/ai/planToolExposure";
import { AiDatabaseGenerationError, artworkPromptFor, buildRecordPrompt, generateDatabaseRecordWithAi, generatedRecordId, parseGeneratedRecord, toolCallsForGeneration } from "@/editor/aiDatabaseGeneration";
import { defaultAiConfig } from "@/ai/llmClient";
import type { ToolResult } from "@/editor/tools/types";
import { referenceMarkerRect } from "@/editor/aiReferenceView";
import { ASSISTANT_DISSOLVE_COVER_MS, ASSISTANT_DISSOLVE_REVEAL_MS, planAssistantViewTransition, remainingCoverMs } from "@/editor/assistantViewTransition";
import { buildWelcomeFreeTextPrompt, buildWelcomeGenrePresetPrompt, welcomeBattleLookLine, welcomeGenrePresetById, welcomeGenrePresetDisplayText } from "@/editor/welcomeGenrePresets";
import { BATTLE_LOOK_PRESET_IDS, BATTLE_LOOK_PRESETS, battleLookMoodGuide } from "@/project/battleLook";
import { interviewBrief } from "./helpers/gameDesignBrief";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize, serialize } from "@/project/io";
import { updateSkillRecord } from "@/editor/databaseRecordMutators";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import { callMapEventTargetStatus } from "@/editor/eventCallTargetStatus";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { cameraLookAtForTarget, filterAssistantOverlayRects, mergeNearbyRects, unoccludedCanvasRect, visibleTileRectFromViewport, type CanvasRect } from "@/editor/cameraFocusViewport";
import { planEditorCameraCenter, viewportCenterWorld, type CameraViewport } from "@/editor/cameraStability";
import { resolveCanvasGestureOwner, type CanvasOwnershipInput } from "@/editor/canvasPointerOwnership";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { normalizeGameDesignBrief, type GameDesignAnswers } from "@/project/gameDesignBrief";
import { interviewPreset, type GameInterview } from "@/project/gameInterview";
import { cinematicInterviewSummary, INTERVIEW_SCENES, SCENE_SLOTS } from "@/editor/cinematicInterviewQuestions";
import { layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { layoutConceptFacilityDoubleRow } from "@/editor/conceptLayoutDoubleRow";
import type { ConceptBundleRecord, ConceptFacilityRecord } from "@/project/types/conceptBundle";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { isolateTimers } from "./mergedTeardown";

describe("aiAnswerLinks", () => {
  isolateTimers();
  function eventNamed(id: string, name: string, x: number, y: number): GameEvent {
    return {
      id,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_page_1`,
          name,
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    };
  }
  function mapWith(id: string, name: string, events: GameEvent[] = []): GameMap {
    const map = createBlankMap(name, 20, 20);
    map.id = id;
    map.events = events;
    return map;
  }
  function projectWith(maps: readonly GameMap[]): Project {
    const project = createBlankProject();
    project.maps = {};
    for (const map of maps) project.maps[map.id] = map;
    const first = maps[0];
    if (first) project.startMapId = first.id;
    return project;
  }
  describe("buildEditorReferenceIndex", () => {
    it("indexes map names and named map events, longest label first", () => {
      const project = projectWith([
        mapWith("map_village", "마을 광장", [eventNamed("ev_hana", "상인 하나", 4, 7)]),
        mapWith("map_house_interior_1", "상인 하나의 집"),
      ]);

      const labels = buildEditorReferenceIndex(project).entries.map((entry) => entry.label);

      expect(labels[0]).toBe("상인 하나의 집");
      expect(labels).toContain("마을 광장");
      expect(labels).toContain("상인 하나");
    });

    it("marks a label shared by several places as ambiguous instead of guessing one", () => {
      const project = projectWith([
        mapWith("map_a", "여관", [eventNamed("ev_1", "주민", 1, 1)]),
        mapWith("map_b", "여관", [eventNamed("ev_2", "주민", 2, 2)]),
      ]);

      const index = buildEditorReferenceIndex(project);
      const inn = index.entries.find((entry) => entry.label === "여관");
      const villager = index.entries.find((entry) => entry.label === "주민");

      expect(inn?.target).toEqual({ kind: "ambiguous", label: "여관", count: 2 });
      expect(villager?.target).toEqual({ kind: "ambiguous", label: "주민", count: 2 });
    });

    it("skips names too short or without letters to be recognizable in prose", () => {
      const project = projectWith([mapWith("map_short", "A"), mapWith("map_digits", "12"), mapWith("map_ok", "동굴")]);

      const labels = buildEditorReferenceIndex(project).entries.map((entry) => entry.label);

      expect(labels).toEqual(["동굴"]);
    });

    it("is stable regardless of map insertion order", () => {
      const first = projectWith([mapWith("map_b", "북쪽 숲"), mapWith("map_a", "남쪽 들")]);
      const second = projectWith([mapWith("map_a", "남쪽 들"), mapWith("map_b", "북쪽 숲")]);

      expect(buildEditorReferenceIndex(first).entries).toEqual(buildEditorReferenceIndex(second).entries);
    });
  });
  describe("findEditorReferences", () => {
    const project = projectWith([
      mapWith("map_village", "마을", [eventNamed("ev_hana", "상인 하나", 4, 7)]),
      mapWith("map_house_interior_1", "상인 하나의 집"),
    ]);
    const index = buildEditorReferenceIndex(project);
    const boundaryIndex: EditorReferenceIndex = {
      entries: [
        { label: "광장", target: { kind: "map", mapId: "map_square" } },
        { label: "마을", target: { kind: "map", mapId: "map_village" } },
        { label: "집", target: { kind: "map", mapId: "map_house" } },
      ],
    };

    it("finds a quoted name in the assistant's own sentence", () => {
      const text = "건물 중에는 우측 하단 마을 구역에 ‘상인 하나의 집’(실내 맵 1채)이 마련되어 있습니다.";

      const spans = findEditorReferences(text, index);
      const labels = spans.map((span) => span.label);

      expect(labels).toContain("상인 하나의 집");
      const house = spans.find((span) => span.label === "상인 하나의 집");
      expect(text.slice(house?.start ?? 0, house?.end ?? 0)).toBe("상인 하나의 집");
      expect(house?.target).toEqual({ kind: "map", mapId: "map_house_interior_1" });
    });

    it("prefers the longest name and never overlaps spans", () => {
      const spans = findEditorReferences("상인 하나의 집에 들어가세요.", index);

      expect(spans).toHaveLength(1);
      expect(spans[0]?.label).toBe("상인 하나의 집");
    });

    it("이름 뒤에 이어진 완전한 조사와 한 번의 보조사 결합을 허용한다", () => {
      const cases = [
        ...[
          "하고", "한테", "께서", "마다", "조차", "밖에", "에서",
          "으로", "에게", "까지", "부터", "처럼", "보다",
        ].map((particle) => ({ sentence: `마을${particle}`, label: "마을" })),
        { sentence: "집에", label: "집" },
        { sentence: "집을", label: "집" },
        { sentence: "집이", label: "집" },
        { sentence: "집에서", label: "집" },
        { sentence: "집에서는", label: "집" },
        { sentence: "집으로도", label: "집" },
        { sentence: "집까지만", label: "집" },
        { sentence: "집하고", label: "집" },
        { sentence: "집한테", label: "집" },
        { sentence: "집께서", label: "집" },
        { sentence: "집마다", label: "집" },
        { sentence: "집조차", label: "집" },
        { sentence: "집밖에", label: "집" },
        { sentence: "집부터", label: "집" },
        { sentence: "집처럼", label: "집" },
        { sentence: "집보다", label: "집" },
        { sentence: "집에게", label: "집" },
        { sentence: "집이에요", label: "집" },
        { sentence: "광장에서", label: "광장" },
        { sentence: "마을.", label: "마을" },
        { sentence: "마을’", label: "마을" },
        { sentence: "마을", label: "마을" },
      ];

      for (const { sentence, label } of cases) {
        expect(findEditorReferences(sentence, boundaryIndex).map((span) => span.label)).toContain(label);
      }
    });

    it("조사 첫 음절로 시작하는 합성어는 거부한다", () => {
      for (const sentence of [
        "마을이장", "마을의사", "마을도서관", "마을과수원", "마을이야기",
        "마을도로", "마을지도", "마을하나", "마을마차",
      ]) {
        expect(findEditorReferences(sentence, index)).toEqual([]);
      }
    });

    it("더 긴 단어의 일부인 이름은 거부한다", () => {
      for (const sentence of [
        "마을길을 깔았습니다", "마을회관을 지었습니다", "새마을 계획",
        "마을길", "마을회관", "새마을", "마을도로를 깔았습니다",
      ]) {
        expect(findEditorReferences(sentence, index)).toEqual([]);
      }
    });

    it("returns spans sorted by position", () => {
      const spans = findEditorReferences("마을 남쪽에 상인 하나의 집이 있습니다. 마을 북쪽은 비었습니다.", index);

      expect(spans.map((span) => span.start)).toEqual([...spans.map((span) => span.start)].sort((a, b) => a - b));
      expect(spans.length).toBeGreaterThanOrEqual(3);
    });

    it("returns nothing for an empty index or empty text", () => {
      expect(findEditorReferences("마을", { entries: [] })).toEqual([]);
      expect(findEditorReferences("", index)).toEqual([]);
    });
  });
  describe("resolveEditorReferenceQuery", () => {
    const project = projectWith([
      mapWith("map_village", "마을 광장", [
        eventNamed("ev_hana", "상인 하나", 4, 7),
        eventNamed("ev_dul", "상인 둘", 8, 9),
      ]),
      mapWith("map_house_interior_1", "상인 하나의 집"),
    ]);
    const index = buildEditorReferenceIndex(project);

    it("정확한 이름은 더 긴 부분 일치보다 우선한다", () => {
      expect(resolveEditorReferenceQuery(index, "상인 하나")).toEqual({
        kind: "found",
        entry: {
          label: "상인 하나",
          target: {
            kind: "event",
            mapId: "map_village",
            eventId: "ev_hana",
            x: 4,
            y: 7,
          },
        },
      });
    });

    it("부분 이름이 한 종류뿐이면 그 이름을 찾는다", () => {
      expect(resolveEditorReferenceQuery(index, "하나의")).toEqual({
        kind: "found",
        entry: expect.objectContaining({ label: "상인 하나의 집" }),
      });
    });

    it("서로 다른 부분 이름이 여럿이면 후보를 모두 보고한다", () => {
      expect(resolveEditorReferenceQuery(index, "상인")).toEqual({
        kind: "ambiguous",
        labels: ["상인 둘", "상인 하나", "상인 하나의 집"],
      });
    });

    it("모르는 이름이나 빈 이름은 찾지 못했다고 보고한다", () => {
      expect(resolveEditorReferenceQuery(index, "없는 이름")).toEqual({ kind: "missing" });
      expect(resolveEditorReferenceQuery(index, "   ")).toEqual({ kind: "missing" });
    });
  });
});

describe("aiAssistantBridge", () => {
  isolateTimers();
  describe("aiAssistantBridge", () => {
    afterEach(() => {
      unregisterAiAssistantBridge();
      vi.unstubAllGlobals();
    });

    it("registers window API and returns send/status/audit from handlers", async () => {
      const windowStub = {
        location: { search: "?aiBridge=0" },
        setTimeout: () => 0,
        clearTimeout: () => undefined,
      };
      vi.stubGlobal("window", windowStub);
      vi.stubGlobal("import", { meta: { env: { DEV: false } } });

      registerAiAssistantBridge({
        send: async (text) => ({
          ok: true,
          status: {
            ready: true,
            turnBusy: false,
            configReady: true,
            lastStatus: "완료",
            bridgeConnected: false,
            panelMounted: true,
          },
          audit: [{ kind: "user", text, at: "t0" }],
          harness: { messages: [] },
          lastAssistantText: "ok",
        }),
        getStatus: () => ({
          ready: true,
          turnBusy: false,
          configReady: true,
          lastStatus: "대기",
          bridgeConnected: false,
          panelMounted: true,
        }),
        getAudit: () => [{ kind: "status", text: "대기" }],
        getHarness: () => ({ messages: [1] }),
        abort: () => undefined,
      });

      setAiBridgeLastStatus("검토 대기");
      expect(window.__oprnAiBridge).toBeDefined();
      expect(window.__oprnAiBridge?.status().lastStatus).toBe("검토 대기");
      expect(window.__oprnAiBridge?.audit()).toEqual([{ kind: "status", text: "대기" }]);
      expect(window.__oprnAiBridge?.harness()).toEqual({ messages: [1] });

      const bridge = window.__oprnAiBridge;
      if (!bridge) throw new Error("Bridge missing");
      const result = await bridge.send("숲을 다듬어줘");
      expect(result).toMatchObject({ ok: true, lastAssistantText: "ok" });
      expect(isAiAssistantBridgeConnected()).toBe(false);
    });

    it("retires old registration sends and abort callbacks before a replacement accepts B", async () => {
      vi.stubGlobal("window", { location: { search: "?aiBridge=0" } });
      const response = deferred<AiBridgeTurnResult>();
      const status = { ready: true, turnBusy: false, configReady: true, lastStatus: "ready", bridgeConnected: false, panelMounted: true };
      const a: AiAssistantBridgeHandlers = { send: () => response.promise, getStatus: () => status,
        getAudit: () => [], getHarness: () => null, abort: vi.fn() };
      registerAiAssistantBridge(a);
      const oldApi = window.__oprnAiBridge;
      if (!oldApi) throw new Error("A bridge missing");
      const pendingA = oldApi.send("A");
      const b: AiAssistantBridgeHandlers = { ...a, send: vi.fn(async text => ({ ok: true, status,
        audit: [{ kind: "user", text }], harness: { owner: "B" } })), abort: vi.fn() };
      registerAiAssistantBridge(b);
      try {
        expect(await bounded(pendingA)).toMatchObject({ ok: false, audit: [], harness: null });
        expect(await sendAiAssistantMessage("B")).toMatchObject({ ok: true, audit: [{ kind: "user", text: "B" }] });
        oldApi.abort(); oldApi.abort();
        expect(b.abort).not.toHaveBeenCalled();
        expect(await oldApi.send("late A")).toMatchObject({ ok: false });
        response.resolve({ ok: true, status, audit: [{ kind: "assistant", text: "A_LATE" }], harness: { owner: "A" } });
        await response.promise;
        expect(b.send).toHaveBeenCalledTimes(1);
        expect(window.__oprnAiBridge?.harness()).toBeNull();
      } finally { response.resolve({ ok: false, status, audit: [], harness: null }); await bounded(pendingA); }
    });

    it.each(["resolve", "reject"])("cleanup prevents a late hello %s from reconnecting or scheduling another poll", async ending => {
      const hello = deferred<Response>();
      const entered = deferred<void>();
      const handled = deferred<void>();
      const schedule = vi.fn(() => 1);
      vi.stubGlobal("window", { location: { search: "?aiBridge=1" }, setTimeout: schedule, clearTimeout: vi.fn() });
      const fetch = vi.fn<typeof globalThis.fetch>(() => { entered.resolve(); return hello.promise.finally(() => handled.resolve()); });
      vi.stubGlobal("fetch", fetch);
      registerAiAssistantBridge({ send: async () => { throw new Error("No send expected"); },
        getStatus: () => ({ ready: true, turnBusy: false, configReady: true, lastStatus: "ready", bridgeConnected: false, panelMounted: true }),
        getAudit: () => [], getHarness: () => null, abort: vi.fn() });
      try {
        await bounded(entered.promise); unregisterAiAssistantBridge();
        if (ending === "resolve") hello.resolve(Response.json({}));
        else hello.reject(new Error("Late owned transport error"));
        await bounded(handled.promise);
        await bounded(whenAiAssistantBridgeSettled());
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(schedule).not.toHaveBeenCalled();
        expect(isAiAssistantBridgeConnected()).toBe(false);
      } finally { hello.resolve(Response.json({})); await bounded(whenAiAssistantBridgeSettled()); }
    });

    it("deduplicates actual HTTP command IDs without replaying a send", async () => {
      const tick = deferred<() => void>();
      const secondPost = deferred<void>();
      let posts = 0;
      const schedule = vi.fn((callback: () => void) => { tick.resolve(callback); return 1; });
      vi.stubGlobal("window", { location: { search: "?aiBridge=1" }, setTimeout: schedule, clearTimeout: vi.fn() });
      vi.stubGlobal("fetch", vi.fn<typeof fetch>(async input => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/hello")) return Response.json({});
        if (path.endsWith("/next")) return Response.json({ command: { id: "same-command", type: "send", text: "A" } });
        if (path.endsWith("/result")) { if (++posts === 2) secondPost.resolve(); return Response.json({}); }
        throw new Error(`Unexpected bridge request ${path}`);
      }));
      const status = { ready: true, turnBusy: false, configReady: true, lastStatus: "ready", bridgeConnected: false, panelMounted: true };
      const send = vi.fn(async (text: string) => ({ ok: true, status, audit: [{ kind: "user", text }], harness: null }));
      registerAiAssistantBridge({ send, getStatus: () => status, getAudit: () => [], getHarness: () => null, abort: vi.fn() });
      try {
        const next = await bounded(tick.promise); next();
        await bounded(secondPost.promise);
        expect(send).toHaveBeenCalledTimes(1);
        expect(posts).toBe(2);
      } finally { unregisterAiAssistantBridge(); await bounded(whenAiAssistantBridgeSettled()); }
    });
  });
});

describe("aiCapabilityEscalation", () => {
  isolateTimers();
  const TITLE_REQUEST = "타이틀 화면 바꿔줘";
  // 선언 없는(폴백) 턴의 도메인 슬라이스 — 코어 + UI 도메인만. 승격은 이 슬라이스 밖의 능력을 되살린다.
  function domainExposedNames(_text: string): Set<string> {
    const domains = computeActiveToolDomains(null);
    return new Set(toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name));
  }
  function names(schemas: readonly { readonly function: { readonly name: string } }[]): string[] {
    return schemas.map((schema) => schema.function.name);
  }
  describe("자연어 능력 승격 리졸버", () => {
    it("finds tools outside an explicitly scoped caller catalog", () => {
      const exposed = domainExposedNames(TITLE_REQUEST);
      // 케이스 전제: 도메인 슬라이스에도, 정확한 이름 언급 승격에도 없다.
      expect(exposed.has("set_title_screen")).toBe(false);
      expect(names(mentionedToolSchemas(TITLE_REQUEST))).not.toContain("set_title_screen");

      expect(names(capabilityEscalationSchemas(TITLE_REQUEST, exposed))).toContain("set_title_screen");
    });

    it("빈 문자열·공백·구두점만 있는 입력은 예외 없이 []", () => {
      for (const text of ["", "   ", "\n\t ", "!!!", " ... ?! ", "---"]) {
        expect(capabilityEscalationSchemas(text, new Set()), JSON.stringify(text)).toEqual([]);
      }
    });

    it("이미 노출된 툴은 다시 반환하지 않는다", () => {
      const exposed = domainExposedNames(TITLE_REQUEST);
      const first = names(capabilityEscalationSchemas(TITLE_REQUEST, exposed));
      expect(first.length).toBeGreaterThan(0);
      const withAll = names(capabilityEscalationSchemas(TITLE_REQUEST, new Set([...exposed, ...first])));
      for (const name of first) expect(withAll).not.toContain(name);
    });

    it("deprecated(supersededBy) 툴은 절대 반환하지 않는다", () => {
      const deprecated = allTools().filter((tool) => tool.deprecated === true && tool.supersededBy);
      expect(deprecated.length).toBeGreaterThan(0);
      const active = new Set(activeTools().map((tool) => tool.name));
      for (const tool of deprecated) {
        const returned = names(capabilityEscalationSchemas(`${tool.name} ${tool.description}`, new Set()));
        expect(returned, tool.name).not.toContain(tool.name);
        for (const name of returned) expect(active.has(name), name).toBe(true);
      }
    });

    it("bounds optional search suggestions without truncating the native catalog", () => {
      for (const text of [TITLE_REQUEST, "속성 상성표 설정하고 세이브 시작 지점도 바꾸고 장비랑 직업도 추가해줘"]) {
        expect(capabilityEscalationSchemas(text, new Set()).length).toBeLessThanOrEqual(MAX_CAPABILITY_ESCALATED_TOOLS);
      }
      const all = toOpenAiTools(activeTools());
      expect(all.length).toBeGreaterThan(128);
      expect(names(all)).toEqual(activeTools().map((tool) => tool.name));
      expect(capabilityEscalationSchemas(TITLE_REQUEST, new Set(names(all)))).toEqual([]);
    });

    // 되돌릴 수 없는 폐기 툴은 어휘가 아무리 맞아도 자동으로 얹히지 않는다.
    it("폐기 툴은 이름·설명을 그대로 던져도 승격되지 않는다", () => {
      const byName = new Map(allTools().map((tool) => [tool.name, tool] as const));
      for (const name of ESCALATION_DENYLIST) {
        const tool = byName.get(name);
        expect(tool, name).toBeDefined();
        const returned = names(capabilityEscalationSchemas(`${name} ${tool!.description}`, new Set()));
        expect(returned, name).not.toContain(name);
      }
    });

    it("부분 재작업 요청이 프로젝트 폐기 툴을 끌어오지 않는다", () => {
      for (const text of ["이 맵 상점 재고를 초기화해줘", "이 맵 처음부터 다시 칠해줘", "여기 지워버리고 다시 깔아줘"]) {
        const returned = names(capabilityEscalationSchemas(text, new Set()));
        expect(returned, text).not.toContain("reset_project");
        expect(returned, text).not.toContain("remove_map");
      }
    });

    it("같은 입력은 같은 순서를 낸다", () => {
      const exposed = domainExposedNames(TITLE_REQUEST);
      expect(names(capabilityEscalationSchemas(TITLE_REQUEST, exposed))).toEqual(
        names(capabilityEscalationSchemas(TITLE_REQUEST, exposed)),
      );
    });
  });
});

describe("aiDatabaseGeneration", () => {
  isolateTimers();
  function projectWith(items: readonly { id: string; name: string }[], enemies: readonly { id: string; name: string }[]): Project {
    return { database: { items, enemies } } as unknown as Project;
  }
  const EMPTY = projectWith([], []);
  describe("parseGeneratedRecord", () => {
    it("코드펜스와 잡담을 걷어내고 허용 필드만 남긴다", () => {
      const raw = "설명입니다\n```json\n{\"name\":\"회복약\",\"price\":120,\"hpRecovery\":{\"flat\":80,\"percentMax\":0},\"bogusField\":1}\n```";

      expect(parseGeneratedRecord("item", raw)).toEqual({
        name: "회복약",
        price: 120,
        hpRecovery: { flat: 80, percentMax: 0 },
      });
    });

    it("적 레코드는 적 필드만 통과시킨다", () => {
      const raw = '{"name":"서슬 늑대","stats":{"maxHp":140,"attack":22},"price":10,"description":"x"}';

      // monsterResourceId 를 빼먹으면 이름 조각으로 고른다 — 도트 몬스터 목록에 한국어 이름(「회색 늑대」)이 생겨 「늑대」가 늑대를 찾는다.
      expect(parseGeneratedRecord("enemy", raw)).toEqual({
        name: "서슬 늑대", stats: { maxHp: 140, attack: 22 }, monsterResourceId: "generated-enemy-wolf-grey",
      });
    });

    it("적 그림은 도트 몬스터 id 만 남긴다 — 목록 밖 id 는 가장 가까운 도트 몬스터로 옮긴다", () => {
      expect(parseGeneratedRecord("enemy", '{"name":"늑대","monsterResourceId":"generated-enemy-wolf-grey"}').monsterResourceId)
        .toBe("generated-enemy-wolf-grey");
      // The name 「늑대」 now matches the catalog's Korean name 「회색 늑대」 before any id fragment does.
      expect(parseGeneratedRecord("enemy", '{"name":"늑대","monsterResourceId":"wolf-dire"}').monsterResourceId)
        .toBe("generated-enemy-wolf-grey");
      expect(parseGeneratedRecord("enemy", '{"name":"늑대","monsterResourceId":"generated-enemy-frost-wolf"}').monsterResourceId)
        .toBe("generated-enemy-wolf-grey");
      expect(parseGeneratedRecord("enemy", '{"name":"늑대","monsterResourceId":"mystery-thing"}').monsterResourceId)
        .toBe("generated-enemy-wolf-grey");
      // Nothing in the id or the name matches: fall back to the slime.
      expect(parseGeneratedRecord("enemy", '{"name":"정체불명","monsterResourceId":"mystery-thing"}').monsterResourceId)
        .toBe("generated-enemy-slime-01");
    });

    it("name 이 없으면 거부한다", () => {
      expect(() => parseGeneratedRecord("item", '{"price":10}')).toThrow(AiDatabaseGenerationError);
    });

    it("JSON 이 아니면 거부한다", () => {
      expect(() => parseGeneratedRecord("item", "만들 수 없습니다")).toThrow(AiDatabaseGenerationError);
    });
  });
  describe("generatedRecordId", () => {
    it("이름을 슬러그로 바꾸고 충돌하면 번호를 올린다", () => {
      expect(generatedRecordId("item", "Hi Potion", [])).toBe("item_ai_hi-potion");
      expect(generatedRecordId("enemy", "Frost Wolf", ["enemy_ai_frost-wolf"])).toBe("enemy_ai_frost-wolf-2");
      expect(generatedRecordId("enemy", "Frost Wolf", ["enemy_ai_frost-wolf", "enemy_ai_frost-wolf-2"]))
        .toBe("enemy_ai_frost-wolf-3");
    });

    it("한글만 있는 이름은 읽을 수 있는 순번 id 로 떨어진다", () => {
      expect(generatedRecordId("item", "회복약", [])).toBe("item_ai_1");
      expect(generatedRecordId("item", "회복약", ["item_ai_1"])).toBe("item_ai_2");
      expect(generatedRecordId("enemy", "서슬 늑대", ["enemy_ai_1", "enemy_ai_2"])).toBe("enemy_ai_3");
    });
  });
  describe("toolCallsForGeneration", () => {
    it("적은 그림 리소스 없이 고른 도트 몬스터 id 를 그대로 가리킨다", () => {
      const calls = toolCallsForGeneration({
        kind: "enemy",
        recordId: "enemy_ai_slime",
        patch: { name: "슬라임", monsterResourceId: "generated-enemy-slime-01" },
      });

      expect(calls).toEqual([{
        name: "upsert_enemy",
        args: { enemy: { name: "슬라임", monsterResourceId: "generated-enemy-slime-01", id: "enemy_ai_slime" } },
      }]);
    });

    it("아이템 그림은 picture 리소스이고 iconResourceId 로 붙는다", () => {
      const calls = toolCallsForGeneration({
        kind: "item",
        recordId: "item_ai_elixir",
        patch: { name: "엘릭서" },
        artwork: { resourceId: "item_ai_elixir_art", dataUrl: "data:image/png;base64,BBB" },
      });

      expect((calls[0]!.args.resource as { kind: string }).kind).toBe("picture");
      expect(calls[1]!.args).toEqual({
        item: { name: "엘릭서", id: "item_ai_elixir", iconResourceId: "item_ai_elixir_art" },
      });
    });

    it("그림 없이도 레코드 한 건만 등록한다", () => {
      const calls = toolCallsForGeneration({ kind: "item", recordId: "item_ai_bread", patch: { name: "빵" } });

      expect(calls).toEqual([{ name: "upsert_item", args: { item: { name: "빵", id: "item_ai_bread" } } }]);
    });
  });
  describe("buildRecordPrompt / artworkPromptFor", () => {
    it("기존 이름을 중복 금지 목록으로 넘긴다", () => {
      const messages = buildRecordPrompt("item", "회복약", ["약초", "빵"]);

      expect(messages[0]!.role).toBe("system");
      expect(String(messages[0]!.content)).toContain("약초, 빵");
      expect(messages[1]).toEqual({ role: "user", content: "회복약" });
    });

    it("그림 프롬프트는 아이템 아이콘이고 투명 배경을 고정한다(도트 저작 모델이 찍는다) — 몬스터 그림은 만들지 않는다", () => {
      expect(artworkPromptFor("item", "엘릭서", "회복")).toContain("inventory item icon");
      expect(artworkPromptFor("item", "엘릭서", "회복")).toContain("transparent background");
    });

    it("적 프롬프트는 도트 몬스터 목록에서 monsterResourceId 를 고르게 한다", () => {
      const system = String(buildRecordPrompt("enemy", "늑대", [])[0]!.content);
      expect(system).toContain("monsterResourceId");
      expect(system).toContain("generated-enemy-wolf-grey");
      expect(system).toContain("generated-enemy-slime-01");
      expect(String(buildRecordPrompt("item", "회복약", [])[0]!.content)).not.toContain("generated-enemy-");
    });
  });
  describe("generateDatabaseRecordWithAi", () => {
    const ok: ToolResult = { ok: true, summary: "적용" };

    it("LLM 응답과 그림을 한 묶음의 툴 호출로 적용한다", async () => {
      const applied: { calls: readonly { name: string; args: Record<string, unknown> }[]; summary: string }[] = [];
      const outcome = await generateDatabaseRecordWithAi(
        { kind: "item", brief: "푸른 엘릭서", config: defaultAiConfig(), withArtwork: true },
        {
          currentProject: () => EMPTY,
          complete: async () => ({
            message: { role: "assistant", content: '{"name":"푸른 엘릭서","price":300}' },
            finishReason: "stop",
          }),
          generateImage: async () => ({
            dataUrl: "data:image/jpeg;base64,RAW",
            mimeType: "image/jpeg",
            model: "gemini-3.1-flash-image",
            provider: "google-antigravity",
          }),
          flattenArtwork: async () => "data:image/png;base64,FLAT",
          applyCalls: (calls, options) => {
            applied.push({ calls, summary: options.summary });
            return calls.map(() => ok);
          },
        },
      );

      expect(outcome.recordId.startsWith("item_ai_")).toBe(true);
      expect(outcome.name).toBe("푸른 엘릭서");
      expect(outcome.resourceId).toBe(`${outcome.recordId}_art`);
      expect(outcome.artworkDataUrl).toBe("data:image/png;base64,FLAT");
      expect(outcome.artworkModel).toBe("gemini-3.1-flash-image");
      expect(applied).toHaveLength(1);
      expect(applied[0]!.calls.map((call) => call.name)).toEqual(["upsert_resource", "upsert_item"]);
      expect(applied[0]!.summary).toBe("AI 아이템 생성: 푸른 엘릭서");
    });

    it("적은 그림을 켜도 이미지를 만들지 않고 고른 도트 몬스터의 정지 그림을 보여 준다", async () => {
      let imageCalls = 0;
      const applied: { calls: readonly { name: string; args: Record<string, unknown> }[]; summary: string }[] = [];
      const outcome = await generateDatabaseRecordWithAi(
        { kind: "enemy", brief: "얼음 늑대", config: defaultAiConfig(), withArtwork: true },
        {
          currentProject: () => EMPTY,
          complete: async () => ({
            message: { role: "assistant", content: '{"name":"서슬 늑대","monsterResourceId":"generated-enemy-wolf-grey","stats":{"maxHp":140}}' },
            finishReason: "stop",
          }),
          generateImage: async () => {
            imageCalls += 1;
            throw new Error("불려서는 안 된다");
          },
          applyCalls: (calls, options) => {
            applied.push({ calls, summary: options.summary });
            return calls.map(() => ok);
          },
        },
      );

      expect(imageCalls).toBe(0);
      expect(outcome.recordId.startsWith("enemy_ai_")).toBe(true);
      expect(outcome.resourceId).toBe("generated-enemy-wolf-grey");
      expect(outcome.artworkDataUrl).toBe("/assets/generated/pixel-enemy-portraits/wolf-grey.png");
      expect(outcome.artworkModel).toBeUndefined();
      expect(applied[0]!.calls.map((call) => call.name)).toEqual(["upsert_enemy"]);
      expect((applied[0]!.calls[0]!.args.enemy as { monsterResourceId?: string }).monsterResourceId).toBe("generated-enemy-wolf-grey");
      expect(applied[0]!.summary).toBe("AI 몬스터 생성: 서슬 늑대");
    });

    it("그림을 끄면 이미지 생성을 호출하지 않는다", async () => {
      let imageCalls = 0;
      const outcome = await generateDatabaseRecordWithAi(
        { kind: "item", brief: "빵", config: defaultAiConfig(), withArtwork: false },
        {
          currentProject: () => EMPTY,
          complete: async () => ({
            message: { role: "assistant", content: '{"name":"딱딱한 빵","price":15}' },
            finishReason: "stop",
          }),
          generateImage: async () => {
            imageCalls += 1;
            throw new Error("불려서는 안 된다");
          },
          applyCalls: (calls) => calls.map(() => ok),
        },
      );

      expect(imageCalls).toBe(0);
      expect(outcome.artworkDataUrl).toBeUndefined();
    });

    it("이미 중단된 요청은 프로젝트에 아무것도 적용하지 않는다", async () => {
      const controller = new AbortController();
      controller.abort();
      let applyCalls = 0;

      await expect(
        generateDatabaseRecordWithAi(
          {
            kind: "item",
            brief: "빵",
            config: defaultAiConfig(),
            withArtwork: true,
            signal: controller.signal,
          },
          {
            currentProject: () => EMPTY,
            complete: async () => ({ message: { role: "assistant", content: '{"name":"빵"}' }, finishReason: "stop" }),
            generateImage: async () => ({
              dataUrl: "data:image/png;base64,RAW",
              mimeType: "image/png",
              model: "gemini-3.1-flash-image",
              provider: "google-antigravity",
            }),
            applyCalls: () => {
              applyCalls += 1;
              return [ok];
            },
          },
        ),
      ).rejects.toBeInstanceOf(AiDatabaseGenerationError);
      expect(applyCalls).toBe(0);
    });

    it("그림 응답 직후 중단돼도 프로젝트에 아무것도 적용하지 않는다", async () => {
      const controller = new AbortController();
      let applyCalls = 0;

      await expect(
        generateDatabaseRecordWithAi(
          {
            kind: "item",
            brief: "푸른 엘릭서",
            config: defaultAiConfig(),
            withArtwork: true,
            signal: controller.signal,
          },
          {
            currentProject: () => EMPTY,
            complete: async () => ({
              message: { role: "assistant", content: '{"name":"푸른 엘릭서"}' },
              finishReason: "stop",
            }),
            generateImage: async () => ({
              dataUrl: "data:image/jpeg;base64,RAW",
              mimeType: "image/jpeg",
              model: "gemini-3.1-flash-image",
              provider: "google-antigravity",
            }),
            flattenArtwork: async () => {
              controller.abort();
              return "data:image/png;base64,FLAT";
            },
            applyCalls: () => {
              applyCalls += 1;
              return [ok];
            },
          },
        ),
      ).rejects.toBeInstanceOf(AiDatabaseGenerationError);
      expect(applyCalls).toBe(0);
    });

    it("툴 적용이 실패하면 오류로 올린다", async () => {
      await expect(
        generateDatabaseRecordWithAi(
          { kind: "item", brief: "빵", config: defaultAiConfig(), withArtwork: false },
          {
            currentProject: () => EMPTY,
            complete: async () => ({ message: { role: "assistant", content: '{"name":"빵"}' }, finishReason: "stop" }),
            applyCalls: () => [{ ok: false, summary: "커밋 거부" }],
          },
        ),
      ).rejects.toThrow(/커밋 거부/);
    });

    it("설명이 비면 LLM 을 부르지 않고 거부한다", async () => {
      let completions = 0;
      await expect(
        generateDatabaseRecordWithAi(
          { kind: "item", brief: "   ", config: defaultAiConfig(), withArtwork: false },
          {
            currentProject: () => EMPTY,
            complete: async () => {
              completions += 1;
              return { message: { role: "assistant", content: "{}" }, finishReason: "stop" };
            },
          },
        ),
      ).rejects.toThrow(AiDatabaseGenerationError);
      expect(completions).toBe(0);
    });

    it("이미 있는 id 와 부딪히면 새 id 를 고른다", async () => {
      const outcome = await generateDatabaseRecordWithAi(
        { kind: "item", brief: "빵", config: defaultAiConfig(), withArtwork: false },
        {
          currentProject: () => projectWith([{ id: "item_ai_bread", name: "빵" }], []),
          complete: async () => ({ message: { role: "assistant", content: '{"name":"Bread"}' }, finishReason: "stop" }),
          applyCalls: (calls) => calls.map(() => ok),
        },
      );

      expect(outcome.recordId).toBe("item_ai_bread-2");
    });
  });
  describe("worldCanon 강제 — 캐논 주입과 금지어 검증", () => {
    const CANON = { name: "화약 없는 왕국", absences: ["총", "화약"] };

    it("캐논이 있으면 시스템 프롬프트에 캐논 블록과 금지 목록이 실린다", () => {
      const messages = buildRecordPrompt("enemy", "늑대", [], CANON);
      expect(String(messages[0]!.content)).toContain("## 이 세계(세계관 고정)");
      expect(String(messages[0]!.content)).toContain("총");
    });

    it("캐논이 없으면 캐논 블록 없이 기존처럼 동작한다", () => {
      const messages = buildRecordPrompt("item", "회복약", ["약초"]);
      expect(String(messages[0]!.content)).not.toContain("## 이 세계(세계관 고정)");
    });

    it("금지어가 든 이름·설명은 거부한다", () => {
      expect(() => parseGeneratedRecord("item", '{"name":"화약 폭탄","price":10}', CANON)).toThrow(/화약/);
      expect(() => parseGeneratedRecord("item", '{"name":"폭탄","description":"화약을 가득 채웠다"}', CANON)).toThrow(/화약/);
      expect(() => parseGeneratedRecord("enemy", '{"name":"총잡이 늑대"}', CANON)).toThrow(/총/);
    });

    it("금지어가 없으면 통과한다", () => {
      expect(parseGeneratedRecord("item", '{"name":"빵","price":10}', CANON)).toEqual({ name: "빵", price: 10 });
    });

    it("적 레코드 원시 description의 금지어도 거부한다 — 스키마에 description이 없어도", () => {
      expect(() => parseGeneratedRecord("enemy", '{"name":"늑대","description":"총을 든 늑대"}', CANON)).toThrow(/총/);
    });

    it("합성어 속 부분일치(화약고)도 잡는다", () => {
      expect(() => parseGeneratedRecord("item", '{"name":"화약고 열쇠","price":10}', CANON)).toThrow(/화약/);
    });
  });
});

describe("aiReferenceView", () => {
  isolateTimers();
  describe("referenceMarkerRect", () => {
    it("maps map cells to the same share of the picture", () => {
      expect(referenceMarkerRect({ x: 16, y: 10, w: 16, h: 10 }, { width: 64, height: 40 })).toEqual({ left: 0.25, top: 0.25, width: 0.25, height: 0.25 });
    });

    it("keeps a region at the map edge inside the picture", () => {
      const rect = referenceMarkerRect({ x: 60, y: 38, w: 10, h: 10 }, { width: 64, height: 40 });
      expect(rect.left + rect.width).toBe(1);
      expect(rect.top + rect.height).toBe(1);
    });
  });
});

// 조수가 사용자 화면을 갈아 끼울 때의 전환 판정 — 순수 함수라 씬·DOM 없이 검증한다.
// 실제 하드컷 지점: selectEditorMap 이 currentMapId 를 바꾸면 EditScene.redrawWhenViewStateChanges
// 가 한 프레임에 캔버스를 통째로 갈고, 카메라는 새 맵 한가운데로 붙는다(planEditorCameraCenter).
describe("assistantViewTransition", () => {
  isolateTimers();
  const options = { reducedMotion: false, canDissolve: true } as const;
  describe("planAssistantViewTransition — 맵이 바뀔 때만 디졸브한다", () => {
    it("다른 맵으로 옮기면 디졸브다", () => {
      expect(planAssistantViewTransition({ fromMapId: "m1", toMapId: "m2" }, options)).toEqual({
        kind: "dissolve",
        coverMs: ASSISTANT_DISSOLVE_COVER_MS,
        revealMs: ASSISTANT_DISSOLVE_REVEAL_MS,
      });
    });

    it("같은 맵 안의 이동은 잘라 내지 않는다 — 이미 부드러운 팬이 연속성을 갖는다", () => {
      // 여기서 베일을 한 번 더 깜빡이면 팬이 시작하기도 전에 화면이 한 번 죽는다.
      expect(planAssistantViewTransition({ fromMapId: "m1", toMapId: "m1" }, options)).toEqual({ kind: "cut" });
    });

    it("아직 아무 맵도 안 열려 있으면 디졸브할 이전 화면이 없다", () => {
      expect(planAssistantViewTransition({ fromMapId: null, toMapId: "m1" }, options)).toEqual({ kind: "cut" });
    });

    it("동작 줄이기가 켜져 있으면 즉시 전환한다", () => {
      expect(
        planAssistantViewTransition({ fromMapId: "m1", toMapId: "m2" }, { ...options, reducedMotion: true })
      ).toEqual({ kind: "cut" });
    });

    it("덮을 캔버스가 없으면(헤드리스·테스트) 즉시 전환한다", () => {
      expect(
        planAssistantViewTransition({ fromMapId: "m1", toMapId: "m2" }, { ...options, canDissolve: false })
      ).toEqual({ kind: "cut" });
    });
  });
  describe("remainingCoverMs — 이미 떠 있는 베일에서 이어 덮는다", () => {
    it("맨 처음에는 전체 시간을 쓴다", () => {
      expect(remainingCoverMs(130, 0)).toBe(130);
    });

    it("반쯤 걷힌 베일은 남은 만큼만 다시 덮는다 — 튀지 않는다", () => {
      expect(remainingCoverMs(130, 0.5)).toBe(65);
    });

    it("이미 다 덮여 있으면 더 덮지 않는다", () => {
      expect(remainingCoverMs(130, 1)).toBe(0);
    });

    it("범위 밖 입력은 0..1 로 조인다", () => {
      expect(remainingCoverMs(130, -3)).toBe(130);
      expect(remainingCoverMs(130, 42)).toBe(0);
      expect(remainingCoverMs(130, Number.NaN)).toBe(130);
    });
  });
});

// 조수가 전투 화면 꾸미기(system.battleLook)를 알고 고르게 하는 지시(2026-10-02).
// 없던 때는 도구 한 줄 설명·첫 제작 지시 어디에도 이 칸이 없어 어떤 게임이든 기본 「도트 창」 그대로였다.
describe("battleLookAssistant", () => {
  isolateTimers();
  describe("전투 화면 꾸미기 — 조수 지시", () => {
    it("set_project_settings 한 줄 설명과 preset 설명이 꾸미기와 분위기 짝을 싣는다", () => {
      const tool = activeTools().find((entry) => entry.name === "set_project_settings")!;
      expect(tool.description).toContain("battle.look");
      const battle = (tool.parameters as { properties: Record<string, { properties: Record<string, { properties: Record<string, { description?: string }> }> }> }).properties.battle!;
      const preset = battle.properties.look!.properties.preset!;
      for (const id of BATTLE_LOOK_PRESET_IDS) expect(preset.description).toContain(`${id}(${BATTLE_LOOK_PRESETS[id].label})=`);
    });

    it("「전투 화면」 요청이면 set_project_settings 가 첫 라운드에 붙는다", () => {
      for (const request of ["전투 화면을 화려하게 꾸며줘", "전투 화면 바꿔줘", "전투창 디자인 바꿔줘"]) {
        expect(capabilityEscalatedToolNames(request, new Set()), request).toContain("set_project_settings");
      }
    });

    it("모험 JRPG 첫 제작 지시(기획 있음·없음)에 프리셋 고르기 줄이 붙고 측면 스킨 id 를 준다", () => {
      const jrpg = welcomeGenrePresetById("adventure-jrpg")!;
      for (const prompt of [buildWelcomeGenrePresetPrompt(jrpg, interviewBrief("adventure-jrpg")), buildWelcomeGenrePresetPrompt(jrpg)]) {
        expect(prompt).toContain("battle.look.preset");
        expect(prompt).toContain(battleLookMoodGuide());
      }
      expect(welcomeBattleLookLine()).toMatch(/battle\.uiStyle: retro2003/u);
    });

    it("몬스터 대치(측면 아님) 장르에는 붙이지 않는다", () => {
      const monster = welcomeGenrePresetById("monster-collect")!;
      expect(buildWelcomeGenrePresetPrompt(monster, interviewBrief("monster-collect"))).not.toContain("battle.look");
    });

    it("자유 문장은 턴제 전투를 말할 때만 붙인다", () => {
      expect(buildWelcomeFreeTextPrompt("용사가 마왕을 쓰러뜨리는 짧은 RPG")).toContain("battle.look.preset");
      expect(buildWelcomeFreeTextPrompt("바닷가 마을에서 농사짓고 이웃과 친해지는 생활 게임")).not.toContain("battle.look");
    });
  });
});

// SkillRecord.movePriority — strict 턴제의 기술 우선도(퀵어택류) + gen1 동속 랜덤 타이브레이크.
// 계약 3개를 못박는다:
//  (1) 우선도는 속도보다 먼저 비교된다 (느린 쪽이 +1 기술로 선공)
//  (2) 동속 랜덤은 battleModel === "gen1" 에서만 rng 를 소비한다 — rm2k3 은 기존
//      "아군 우선 → index 순" 결정적 정렬 그대로 (battleStrictRuntime.test.ts 계약 보존)
//  (3) 필드는 normalize/뮤테이터 화이트리스트를 왕복 생존한다 (skillSystem 소실 전례 방지)
describe("battleStrictPriority", () => {
  isolateTimers();
  function strictProject(): Project {
    return deserialize(JSON.stringify(strictFixture));
  }
  function setActorParam(project: Project, actorId: string, key: ActorParameterKey, value: number): void {
    const actor = project.database.actors.find((record) => record.id === actorId);
    if (!actor) throw new Error(`missing actor: ${actorId}`);
    actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
  }
  function tankEnemy(project: Project, agility: number): void {
    const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
    if (!enemy) throw new Error("missing enemy_training_slime");
    enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, agility };
  }
  function givePrioritySkill(project: Project, movePriority: number): void {
    const skill = project.database.skills.find((record) => record.id === "skill_fire");
    if (!skill) throw new Error("missing skill_fire");
    skill.movePriority = movePriority;
    // 우선도만 검증한다 — MP 부족으로 커맨드가 거부되지 않게 코스트를 비운다.
    skill.mpCost = { flat: 0, percentMax: 0 };
  }
  // rng 시퀀스 스크립트. 소진되면 fallback 상수를 돌려준다(정렬 뒤 데미지 롤용).
  function scriptedRng(values: readonly number[], fallback = 0.5): () => number {
    let cursor = 0;
    return () => (cursor < values.length ? values[cursor++]! : fallback);
  }
  describe("strict movePriority + gen1 tie-break", () => {
    // 우선도 케이스는 actor_mage 를 쓴다 — skill_fire 를 배운 유일한 액터라
    // battleSkillUseFailure("notLearned") 로 커맨드가 거부되지 않는다(runtime.ts:701).
    it("느린 액터가 movePriority +1 기술로 빠른 적보다 먼저 행동한다", () => {
      const project = strictProject();
      setActorParam(project, "actor_mage", "agility", 1);
      tankEnemy(project, 50);
      givePrioritySkill(project, 1);

      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { actor_mage: 1 }, experience: {}, partyActorIds: ["actor_mage"] },
        rng: () => 0.99,
      });
      runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

      expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
        .toEqual(["actor_mage", "enemy_training_slime"]);
    });

    it("우선도 0 대조군: 같은 셋업에서 기술에 우선도가 없으면 빠른 적이 선공한다", () => {
      const project = strictProject();
      setActorParam(project, "actor_mage", "agility", 1);
      tankEnemy(project, 50);
      givePrioritySkill(project, 0);

      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { actor_mage: 1 }, experience: {}, partyActorIds: ["actor_mage"] },
        rng: () => 0.99,
      });
      runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

      expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
        .toEqual(["enemy_training_slime", "actor_mage"]);
    });

    it("gen1: 동속 타이브레이크가 rng 로 갈린다 (적이 선공할 수 있다)", () => {
      const project = strictProject();
      project.system.battleModel = "gen1";
      setActorParam(project, "actor_warrior", "agility", 20);
      tankEnemy(project, 20);

      // 큐 구성 순서 = [액터 롤, (chooseEnemyAction), 적 롤]. enemy_training_slime 의 행동
      // 패턴이 단일이라 chooseEnemyAction 은 rng 를 소비하지 않는다 — 첫 두 값이 그대로
      // 타이브레이크다. 액터 0.1 < 적 0.9 → 내림차순이라 적이 먼저.
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { actor_warrior: 1 }, experience: {}, partyActorIds: ["actor_warrior"] },
        rng: scriptedRng([0.1, 0.9]),
      });
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
        .toEqual(["enemy_training_slime", "actor_warrior"]);
    });

    it("rm2k3(기본): 동속에서 rng 를 소비하지 않고 아군 우선 정렬을 유지한다", () => {
      const project = strictProject();
      setActorParam(project, "actor_warrior", "agility", 20);
      tankEnemy(project, 20);

      // gen1 케이스와 같은 rng 스크립트를 줘도 결과가 갈리면 안 된다 — 타이브레이크가
      // rng 를 읽지 않음을 행동으로 증명한다(아군 우선 계약 유지).
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { actor_warrior: 1 }, experience: {}, partyActorIds: ["actor_warrior"] },
        rng: scriptedRng([0.1, 0.9]),
      });
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
        .toEqual(["actor_warrior", "enemy_training_slime"]);
    });

    it("movePriority 는 직렬화 왕복과 에디터 뮤테이터를 생존한다", () => {
      const project = strictProject();
      givePrioritySkill(project, 1);

      const roundTripped = deserialize(serialize(project));
      expect(roundTripped.database.skills.find((skill) => skill.id === "skill_fire")?.movePriority).toBe(1);

      updateSkillRecord(roundTripped.database, "skill_fire", { movePriority: 3 });
      expect(roundTripped.database.skills.find((skill) => skill.id === "skill_fire")?.movePriority).toBe(3);

      // 클램프(-7~7) + 기본값 0 은 직렬화에서 생략된다(레거시 바이트 보존 관례).
      updateSkillRecord(roundTripped.database, "skill_fire", { movePriority: 99 });
      expect(roundTripped.database.skills.find((skill) => skill.id === "skill_fire")?.movePriority).toBe(7);
      updateSkillRecord(roundTripped.database, "skill_fire", { movePriority: 0 });
      expect(serialize(roundTripped)).not.toContain("movePriority");
    });
  });
});

describe("callMapEventWarnings", () => {
  isolateTimers();
  function page(overrides: Partial<EventPage> = {}): EventPage {
    return {
      id: "page-1",
      name: "\uac80\uc0ac \ud398\uc774\uc9c0",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
      ...overrides,
    };
  }
  function gameEvent(id: string, pages: EventPage[]): GameEvent {
    return { id, x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages };
  }
  function transferCommand(mapId: string) {
    return { kind: "transfer" as const, mapId, x: 5, y: 5, fade: "black" as const };
  }
  function callCommand(targetId: string) {
    return { kind: "callMapEvent" as const, eventId: targetId };
  }
  describe("callMapEvent \uc8fd\uc740 \ub300\uc0c1 \uacbd\uace0", () => {
    it("\uacbd\uace0: \ub300\uc0c1 \uc774\ubca4\ud2b8 \ud398\uc774\uc9c0\uac00 \ube44\uc5b4 \uc788\uc73c\uba74 callMapEvent \uba85\ub839\uc5d0 \uacbd\uace0\ub97c \ub0b4\ub09c\ub2e4", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const target = gameEvent("ev_target", [page({ id: "p1", commands: [] })]);
      const caller = gameEvent("ev_caller", [page({ id: "p1", commands: [callCommand("ev_target")] })]);
      project.maps[mapId].events = [caller, target];

      const result = validateEventDraftBody(project, mapId, caller);
      expect(result.issues).toContainEqual(expect.objectContaining({
        severity: "warning",
        code: "callMapEvent.target-inert",
        commandPath: [0],
      }));
    });

    it("\uacbd\uace0: \ube44\uc5b4 \uc788\ub294 \ud398\uc774\uc9c0\uac00 \uc788\ub294 \ub300\uc0c1 \uc774\ubca4\ud2b8\uc5d0\uc11c \ub3c5 \uacbd\uace0\ub97c \ub0b4\ub0b8\ub2e4", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const target = gameEvent("ev_target", [page({ id: "p1", commands: [] })]);
      const caller = gameEvent("ev_caller", [page({ id: "p1", commands: [callCommand("ev_target")] })]);
      project.maps[mapId].events = [caller, target];

      const result = validateEventDraftBody(project, mapId, target);
      expect(result.issues).toContainEqual(expect.objectContaining({
        severity: "warning",
        code: "callMapEvent.target-page-empty",
      }));
    });

    it("\uc0dd\uc540 \uc788\ub294 \ub300\uc0c1\uc73c\ub85c \uc798 \ubd80\ub974\uba74 \uacbd\uace0\uac00 \uc5c6\ub2e4", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const target = gameEvent("ev_target", [page({ id: "p1", commands: [
        { kind: "text", body: "\uc548\ub155" },
      ] })]);
      const caller = gameEvent("ev_caller", [page({ id: "p1", commands: [callCommand("ev_target")] })]);
      project.maps[mapId].events = [caller, target];

      const result = validateEventDraftBody(project, mapId, caller);
      expect(result.issues.filter((issue) => issue.code.startsWith("callMapEvent."))).toEqual([]);
    });

    it("\uc804\uc774 \ubaa9\uc801 \ub9f5\uc774 \uc0ac\ub77c\uc84c\uc73c\uba74 transfer-target-missing \uacbd\uace0\ub97c \ub0b4\ub0b8\ub2e4", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const target = gameEvent("ev_target", [page({ id: "p1", commands: [transferCommand("map_ghost")] })]);
      const caller = gameEvent("ev_caller", [page({ id: "p1", commands: [callCommand("ev_target")] })]);
      project.maps[mapId].events = [caller, target];

      const result = validateEventDraftBody(project, mapId, caller);
      expect(result.issues).toContainEqual(expect.objectContaining({
        severity: "warning",
        code: "callMapEvent.transfer-target-missing",
      }));
    });

    it("\ud310\uc815 \ud568\uc218\uac00 \uc8fd\uc740 \ub300\uc0c1\uacfc \uc0b4\uc544\uc788\ub294 \ub300\uc0c1\uc744 \uad6c\ubd84\ud55c\ub2e4", () => {
      const project = createBlankProject();
      const dead = gameEvent("ev_dead", [page({ id: "p1", commands: [] })]);
      const alive = gameEvent("ev_alive", [page({ id: "p1", commands: [{ kind: "wait", ms: 100 }] })]);
      project.maps[project.startMapId].events = [dead, alive];

      expect(callMapEventTargetStatus(project, dead).callable).toBe(false);
      expect(callMapEventTargetStatus(project, alive).callable).toBe(true);
      expect(callMapEventTargetStatus(project, undefined).callable).toBe(true);
    });
  });
});

// 조수 채팅 독은 캔버스 위에 떠 있는 유리 카드다(.ai-chat-panel.chat-dock-glass, inset 12px auto auto 12px,
// width clamp(360px,38vw,520px)). 캔버스 전체 중앙에 대상을 맞추면 그 카드 뒤로 들어간다.
// 여기서 검증하는 것은 "가림을 뺀 실제 보이는 사각형" 기하학뿐 — Phaser/DOM 없이 순수 계산이다.
describe("cameraFocusViewport", () => {
  isolateTimers();
  const CANVAS: CanvasRect = { x: 0, y: 0, width: 1133, height: 700 };
  // 실측 독: 좌상단에서 12px 띄우고 폭 420, 높이 640.
  const GLASS: CanvasRect = { x: 12, y: 12, width: 420, height: 640 };
  describe("unoccludedCanvasRect", () => {
    it("좌측 유리 카드는 왼쪽 변만 깎는다 — 카드 오른쪽 끝(432)이 새 좌표", () => {
      expect(unoccludedCanvasRect(CANVAS, [GLASS])).toEqual({ x: 432, y: 0, width: 701, height: 700 });
    });

    it("600×500 캔버스에서도 실제 카드 뒤가 아닌 오른쪽 영역에 대상을 놓는다", () => {
      const canvas: CanvasRect = { x: 0, y: 0, width: 600, height: 500 };
      const card: CanvasRect = { x: 12, y: 12, width: 360, height: 460 };
      const unoccluded = unoccludedCanvasRect(canvas, [card]);
      const canvasCenterX = canvas.x + canvas.width / 2;
      const canvasCenterY = canvas.y + canvas.height / 2;

      const containsCanvasCenter =
        canvasCenterX >= unoccluded.x &&
        canvasCenterX < unoccluded.x + unoccluded.width &&
        canvasCenterY >= unoccluded.y &&
        canvasCenterY < unoccluded.y + unoccluded.height;
      expect(containsCanvasCenter).toBe(false);
      expect(unoccluded.x).toBeGreaterThanOrEqual(372);

      const targetWorldX = 1000;
      const targetWorldY = 800;
      const zoom = 2;
      const lookAt = cameraLookAtForTarget({ targetWorldX, targetWorldY, canvas, unoccluded, zoom });
      const targetScreenX = canvasCenterX + (targetWorldX - lookAt.x) * zoom;
      const targetScreenY = canvasCenterY + (targetWorldY - lookAt.y) * zoom;
      expect(targetScreenX).toBeCloseTo(unoccluded.x + unoccluded.width / 2, 10);
      expect(targetScreenY).toBeCloseTo(unoccluded.y + unoccluded.height / 2, 10);

      const targetIsBehindCard =
        targetScreenX >= card.x &&
        targetScreenX < card.x + card.width &&
        targetScreenY >= card.y &&
        targetScreenY < card.y + card.height;
      expect(targetIsBehindCard).toBe(false);
    });

    it("남는 폭이 minSpanPx 아래면 그 가림은 무시한다 — 화면을 다 먹은 경우 계산이 무의미하다", () => {
      const wide: CanvasRect = { x: 0, y: 0, width: 1000, height: 700 };
      expect(unoccludedCanvasRect(CANVAS, [wide], 240)).toEqual(CANVAS);
    });

    it("가림이 없거나 캔버스와 겹치지 않으면 캔버스 그대로다", () => {
      expect(unoccludedCanvasRect(CANVAS, [])).toEqual(CANVAS);
      expect(unoccludedCanvasRect(CANVAS, [{ x: 2000, y: 0, width: 300, height: 700 }])).toEqual(CANVAS);
    });
  });
  describe("cameraLookAtForTarget", () => {
    it("가시 중앙과 캔버스 중앙의 차이를 줌으로 나눈 만큼 lookAt 을 옮긴다", () => {
      const unoccluded = unoccludedCanvasRect(CANVAS, [GLASS]);
      const zoom = 2;
      const targetWorldX = 1000;
      const targetWorldY = 800;
      const lookAt = cameraLookAtForTarget({ targetWorldX, targetWorldY, canvas: CANVAS, unoccluded, zoom });

      const canvasCenterX = CANVAS.x + CANVAS.width / 2;
      const canvasCenterY = CANVAS.y + CANVAS.height / 2;
      const unoccludedCenterX = unoccluded.x + unoccluded.width / 2;
      const unoccludedCenterY = unoccluded.y + unoccluded.height / 2;

      // 왕복 검증: 카메라 중심은 캔버스 중앙에 대응하므로 대상의 화면 좌표가 가시 중앙에 떨어져야 한다.
      expect(canvasCenterX + (targetWorldX - lookAt.x) * zoom).toBeCloseTo(unoccludedCenterX, 10);
      expect(canvasCenterY + (targetWorldY - lookAt.y) * zoom).toBeCloseTo(unoccludedCenterY, 10);
    });

    it("줌이 0 이하면 1 로 취급한다", () => {
      const unoccluded = unoccludedCanvasRect(CANVAS, [GLASS]);
      const zeroZoom = cameraLookAtForTarget({ targetWorldX: 10, targetWorldY: 20, canvas: CANVAS, unoccluded, zoom: 0 });
      const oneZoom = cameraLookAtForTarget({ targetWorldX: 10, targetWorldY: 20, canvas: CANVAS, unoccluded, zoom: 1 });
      expect(zeroZoom).toEqual(oneZoom);
    });
  });
  describe("filterAssistantOverlayRects", () => {
    it("캔버스 전체를 덮는 inset:0 패널은 버린다 — 투명 호스트라 가림이 아니다", () => {
      expect(filterAssistantOverlayRects(CANVAS, [CANVAS])).toEqual([]);
    });

    it("입력줄·기록 카드는 남긴다", () => {
      const bar: CanvasRect = { x: 480, y: 580, width: 640, height: 110 };
      const log: CanvasRect = { x: 480, y: 160, width: 640, height: 400 };
      expect(filterAssistantOverlayRects(CANVAS, [CANVAS, bar, log])).toEqual([bar, log]);
    });
  });
  describe("mergeNearbyRects + 캡슐 가림", () => {
    it("오른쪽 아래 입력줄과 그 위 기록 카드를 한 덩어리로 합쳐 오른쪽을 깎는다", () => {
      const bar: CanvasRect = { x: 481, y: 576, width: 640, height: 110 };
      const log: CanvasRect = { x: 481, y: 160, width: 640, height: 400 };
      const merged = mergeNearbyRects([bar, log]);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({ x: 481, y: 160, width: 640, height: 526 });

      const unoccluded = unoccludedCanvasRect(CANVAS, merged);
      expect(unoccluded.x).toBe(0);
      expect(unoccluded.width).toBe(481);
      expect(unoccluded.height).toBe(700);
    });

    it("오른쪽 아래 캡슐+기록이 캔버스 높이의 60%를 못 넘어도 오른쪽을 깎는다", () => {
      const canvas: CanvasRect = { x: 0, y: 0, width: 1613, height: 957 };
      const bar: CanvasRect = { x: 961, y: 835, width: 640, height: 110 };
      const log: CanvasRect = { x: 961, y: 535, width: 640, height: 280 };
      const unoccluded = unoccludedCanvasRect(canvas, mergeNearbyRects([bar, log]));
      expect(unoccluded.x).toBe(0);
      expect(unoccluded.width).toBe(961);
      expect(unoccluded.height).toBe(957);
    });
  });
  describe("visibleTileRectFromViewport", () => {
    it("부분 타일을 버리지 않고 분수 타일로 남기며 좌측 깎임을 반영한다", () => {
      const unoccluded = unoccludedCanvasRect(CANVAS, [GLASS]);
      const rect = visibleTileRectFromViewport({
        worldView: { x: 100, y: 64, width: 1133 / 2, height: 700 / 2 },
        canvas: CANVAS,
        unoccluded,
        zoom: 2,
        tileSize: 32,
      });
      expect(rect).not.toBeNull();
      // 월드 x = 100 + 432/2 = 316 → 타일 9.875, 폭 = 701/2/32 = 10.953125
      expect(rect?.x).toBeCloseTo(316 / 32, 10);
      expect(rect?.width).toBeCloseTo(701 / 2 / 32, 10);
      expect(rect?.y).toBeCloseTo(2, 10);
      expect(rect?.height).toBeCloseTo(700 / 2 / 32, 10);
    });

    it("뷰포트 크기가 비정상이면 null", () => {
      expect(
        visibleTileRectFromViewport({
          worldView: { x: 0, y: 0, width: 0, height: 300 },
          canvas: CANVAS,
          unoccluded: CANVAS,
          zoom: 1,
          tileSize: 32,
        })
      ).toBeNull();
      expect(
        visibleTileRectFromViewport({
          worldView: { x: 0, y: 0, width: Number.NaN, height: 300 },
          canvas: CANVAS,
          unoccluded: CANVAS,
          zoom: 1,
          tileSize: 32,
        })
      ).toBeNull();
    });
  });
});

describe("cameraStability", () => {
  isolateTimers();
  /**
   * Phaser Camera.centerOn(x, y) 의 역연산:
   *   scrollX = x - width / 2
   * 리사이즈 후 centerOn(focal) 을 적용했을 때 새 뷰포트의 중심이 focal 과 일치하는지(= 중심 보존) 검증.
   */
  function centerOnScroll(focal: { x: number; y: number }, width: number, height: number, _zoom: number) {
    return {
      scrollX: focal.x - width / 2,
      scrollY: focal.y - height / 2,
    };
  }
  describe("cameraStability — viewport center preservation on resize", () => {
    it("computes the viewport center world point at zoom 1", () => {
      const center = viewportCenterWorld({ scrollX: 100, scrollY: 50, width: 800, height: 600, zoom: 1 });
      expect(center).toEqual({ x: 500, y: 350 });
    });

    it("uses Phaser 3.90 centerOn inverse independently of zoom", () => {
      const center = viewportCenterWorld({ scrollX: 0, scrollY: 0, width: 800, height: 600, zoom: 2 });
      // Phaser scales around the viewport center, not the scroll origin.
      expect(center).toEqual({ x: 400, y: 300 });
    });

    it("guards zoom<=0 against divide-by-zero by treating it as 1", () => {
      const center = viewportCenterWorld({ scrollX: 10, scrollY: 20, width: 400, height: 200, zoom: 0 });
      expect(center).toEqual({ x: 210, y: 120 });
      expect(Number.isFinite(center.x)).toBe(true);
      expect(Number.isFinite(center.y)).toBe(true);
    });

    it("preserves the exact center when the viewport shrinks (AI panel opens on the side)", () => {
      // 리사이즈 전: scroll 100, 폭 1200 → 중심 700
      const before: CameraViewport = { scrollX: 100, scrollY: 80, width: 1200, height: 600, zoom: 1 };
      const focal = viewportCenterWorld(before);
      expect(focal).toEqual({ x: 700, y: 380 });

      // 사이드 패널이 열려 폭이 800 로 줄었다고 가정. centerOn(focal) 후 새 scroll:
      const after = centerOnScroll(focal, 800, 600, 1);
      const afterCenter = viewportCenterWorld({ scrollX: after.scrollX, scrollY: after.scrollY, width: 800, height: 600, zoom: 1 });
      expect(afterCenter).toEqual(focal);
    });

    it("preserves the center across an asymmetric width-only shrink", () => {
      const before: CameraViewport = { scrollX: 240, scrollY: 0, width: 960, height: 540, zoom: 1 };
      const focal = viewportCenterWorld(before);

      const after = centerOnScroll(focal, 640, 540, 1);
      const afterCenter = viewportCenterWorld({ scrollX: after.scrollX, scrollY: after.scrollY, width: 640, height: 540, zoom: 1 });
      expect(afterCenter).toEqual(focal);
      expect(Math.abs(afterCenter.x - focal.x)).toBeLessThan(1e-9);
    });

    it("preserves the center at zoom 2 across a resize", () => {
      const before: CameraViewport = { scrollX: 0, scrollY: 0, width: 1600, height: 1000, zoom: 2 };
      const focal = viewportCenterWorld(before); // (400, 250)

      const after = centerOnScroll(focal, 1000, 600, 2);
      const afterCenter = viewportCenterWorld({ scrollX: after.scrollX, scrollY: after.scrollY, width: 1000, height: 600, zoom: 2 });
      expect(afterCenter).toEqual(focal);
    });
  });
  describe("planEditorCameraCenter — 줌만 바뀔 때는 보고 있던 점을 유지한다", () => {
    const map = { mapWidthPx: 40 * 16, mapHeightPx: 30 * 16 };

    it("맵이 바뀌었거나 이전 중심이 없으면 맵 한가운데다", () => {
      expect(planEditorCameraCenter({
        ...map,
        previousCenter: null,
        preserveLookAt: false,
        devFocusWorld: null,
      })).toEqual({ x: 320, y: 240 });

      expect(planEditorCameraCenter({
        ...map,
        previousCenter: { x: 80, y: 64 },
        preserveLookAt: false,
        devFocusWorld: null,
      })).toEqual({ x: 320, y: 240 });
    });

    it("같은 맵에서 줌만 바뀌면 이전 look-at 을 그대로 쓴다 — 맵 중앙으로 붙지 않는다", () => {
      expect(planEditorCameraCenter({
        ...map,
        previousCenter: { x: 80, y: 64 },
        preserveLookAt: true,
        devFocusWorld: null,
      })).toEqual({ x: 80, y: 64 });
    });

    it("개발용 focus 쿼리가 있으면 보존보다 앞선다", () => {
      expect(planEditorCameraCenter({
        ...map,
        previousCenter: { x: 80, y: 64 },
        preserveLookAt: true,
        devFocusWorld: { x: 8.5 * 16, y: 4.5 * 16 },
      })).toEqual({ x: 136, y: 72 });
    });
  });
});

// test/canvasPointerOwnership.test.ts
// 캔버스 포인터 제스처 소유권 판정 순수 모듈 단위 테스트.
//
// 판정 5조항 및 경계 조건(우클릭 도구 무관, select 도구 맵 밖/안, selection/stamp/초점 유예, 스페이스 무장)을 고정한다.
describe("canvasPointerOwnership", () => {
  isolateTimers();
  function baseInput(overrides: Partial<CanvasOwnershipInput> = {}): CanvasOwnershipInput {
    return {
      pointer: { button: 0, buttons: 1 },
      pastePreviewActive: false,
      panArmed: false,
      tool: "paint",
      selectionActive: false,
      paletteStampActive: false,
      deferCameraFocus: false,
      tileInMapBounds: true,
      ...overrides,
    };
  }
  describe("resolveCanvasGestureOwner", () => {
    describe("0. 붙여넣기 미리보기 활성 (scene)", () => {
      it("pastePreviewActive 가 참이면 버튼(0, 1, 2, 3, 4)이나 도구와 무관하게 항상 scene", () => {
        expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 0, buttons: 1 } }))).toBe("scene");
        expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 1, buttons: 4 } }))).toBe("scene");
        expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 2, buttons: 2 } }))).toBe("scene");
        expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 3, buttons: 8 } }))).toBe("scene");
        expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, pointer: { button: 4, buttons: 16 } }))).toBe("scene");
        expect(resolveCanvasGestureOwner(baseInput({ pastePreviewActive: true, tool: "pan", panArmed: true }))).toBe("scene");
      });
    });

    describe("1. 가운데 버튼 (pan)", () => {
      it("button이 1이면 도구와 무관하게 항상 pan", () => {
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 1, buttons: 4 } }))).toBe("pan");
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 1, buttons: 0 }, tool: "paint" }))).toBe("pan");
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 1, buttons: 0 }, tool: "select" }))).toBe("pan");
      });

      it("buttons에 4(가운데 버튼)가 켜져 있으면 button이 0이어도 pan", () => {
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 4 } }))).toBe("pan");
      });
    });

    describe("2. 오른쪽 버튼 (region)", () => {
      it("button이 2이면 도구 및 맵 경계와 무관하게 항상 region", () => {
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 2, buttons: 2 }, tool: "paint" }))).toBe("region");
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 2, buttons: 2 }, tool: "pan" }))).toBe("region");
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 2, buttons: 2 }, tool: "select", tileInMapBounds: false }))).toBe("region");
      });

      it("buttons에 2(우클릭)가 켜져 있으면 region", () => {
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 2 } }))).toBe("region");
      });

      it("가운데 버튼보다 오른쪽 버튼이 뒤에 평가되지만 둘 다 명확히 분기된다", () => {
        // button이 1이면 1조항에서 pan
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 1, buttons: 2 } }))).toBe("pan");
      });
    });

    describe("3. 왼쪽 버튼 + (tool === 'pan' || panArmed)", () => {
      it("tool이 pan이고 button이 0(왼쪽)이면 pan", () => {
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 1 }, tool: "pan" }))).toBe("pan");
      });

      it("스페이스 팬 무장(panArmed === true) 상태이고 button이 0(왼쪽)이면 어떤 도구여도 pan", () => {
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 1 }, tool: "paint", panArmed: true }))).toBe("pan");
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 0, buttons: 1 }, tool: "select", panArmed: true }))).toBe("pan");
      });

      it("button이 3 또는 4(보조 마우스 버튼)이면 tool이 pan이거나 panArmed여도 null 반환", () => {
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 3, buttons: 8 }, tool: "pan" }))).toBeNull();
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 4, buttons: 16 }, tool: "pan" }))).toBeNull();
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 3, buttons: 8 }, tool: "paint", panArmed: true }))).toBeNull();
        expect(resolveCanvasGestureOwner(baseInput({ pointer: { button: 4, buttons: 16 }, tool: "paint", panArmed: true }))).toBeNull();
      });
    });

    describe("4. 왼쪽 버튼 + select 도구 + 맵 밖 드래그", () => {
      it("select 도구 + 맵 밖(!tileInMapBounds) + 다른 간섭이 없으면 pan", () => {
        expect(
          resolveCanvasGestureOwner(
            baseInput({
              pointer: { button: 0, buttons: 1 },
              tool: "select",
              tileInMapBounds: false,
              selectionActive: false,
              paletteStampActive: false,
              deferCameraFocus: false,
            }),
          ),
        ).toBe("pan");
      });

      it("button이 3 또는 4(보조 마우스 버튼)이면 select 도구 + 맵 밖이어도 null 반환", () => {
        expect(
          resolveCanvasGestureOwner(
            baseInput({
              pointer: { button: 3, buttons: 8 },
              tool: "select",
              tileInMapBounds: false,
              selectionActive: false,
              paletteStampActive: false,
              deferCameraFocus: false,
            }),
          ),
        ).toBeNull();
        expect(
          resolveCanvasGestureOwner(
            baseInput({
              pointer: { button: 4, buttons: 16 },
              tool: "select",
              tileInMapBounds: false,
              selectionActive: false,
              paletteStampActive: false,
              deferCameraFocus: false,
            }),
          ),
        ).toBeNull();
      });

      it("select 도구여도 맵 안(tileInMapBounds === true)이면 null (오버레이 소유)", () => {
        expect(
          resolveCanvasGestureOwner(
            baseInput({
              pointer: { button: 0, buttons: 1 },
              tool: "select",
              tileInMapBounds: true,
              selectionActive: false,
              paletteStampActive: false,
              deferCameraFocus: false,
            }),
          ),
        ).toBeNull();
      });

      it("선택 활성(selectionActive === true)이면 맵 밖이어도 null", () => {
        expect(
          resolveCanvasGestureOwner(
            baseInput({
              pointer: { button: 0, buttons: 1 },
              tool: "select",
              tileInMapBounds: false,
              selectionActive: true,
            }),
          ),
        ).toBeNull();
      });

      it("팔레트 스탬프 활성(paletteStampActive === true)이면 맵 밖이어도 null", () => {
        expect(
          resolveCanvasGestureOwner(
            baseInput({
              pointer: { button: 0, buttons: 1 },
              tool: "select",
              tileInMapBounds: false,
              paletteStampActive: true,
            }),
          ),
        ).toBeNull();
      });

      it("초점 유예(deferCameraFocus === true) 중이면 맵 밖이어도 null", () => {
        expect(
          resolveCanvasGestureOwner(
            baseInput({
              pointer: { button: 0, buttons: 1 },
              tool: "select",
              tileInMapBounds: false,
              deferCameraFocus: true,
            }),
          ),
        ).toBeNull();
      });
    });

    describe("5. 그 외 (null — 오버레이 소유)", () => {
      it("paint / fill / erase 등 일반 도구에서 맵 안 좌클릭은 null", () => {
        expect(resolveCanvasGestureOwner(baseInput({ tool: "paint", tileInMapBounds: true }))).toBeNull();
        expect(resolveCanvasGestureOwner(baseInput({ tool: "fill", tileInMapBounds: true }))).toBeNull();
        expect(resolveCanvasGestureOwner(baseInput({ tool: "erase", tileInMapBounds: true }))).toBeNull();
        expect(resolveCanvasGestureOwner(baseInput({ tool: "event", tileInMapBounds: true }))).toBeNull();
        expect(resolveCanvasGestureOwner(baseInput({ tool: "eyedropper", tileInMapBounds: true }))).toBeNull();
      });

      it("paint 도구에서 맵 밖 좌클릭도 null", () => {
        expect(resolveCanvasGestureOwner(baseInput({ tool: "paint", tileInMapBounds: false }))).toBeNull();
      });
    });
  });
});

describe("cinematicInterview", () => {
  isolateTimers();
  function mixedBrief() {
    const answers: GameDesignAnswers = {};
    for (const q of INTERVIEW_SCENES[0]!.questions) answers[SCENE_SLOTS[q.id]!] = {
      question: q.title, label: q.label, text: q.options[0]!.label, source: "user",
    };
    const interview: GameInterview = { version: 1, genre: "romance", secondary: "monster", concept: "사용자의 세계", protagonist: "약사", notes: "교감 중심", choiceIds: {},
      blend: { question: "두 장르를 어떻게 잇나요?", label: "장르의 연결", text: "생물의 성장 사건이 관계를 바꾼다", source: "recommended" } };
    return normalizeGameDesignBrief({ version: 1, presetId: interviewPreset(interview.genre, interview.secondary), answers,
      summary: cinematicInterviewSummary(interview, answers), interview });
  }
  describe("cinematic interview persistence and internal handoff", () => {
    it("roundtrips author genre, mixture and protagonist through the real project serializer", () => {
      const project = createNewProjectSeed("monster-collect");
      project.gameDesignBrief = mixedBrief();
      const loaded = deserialize(serialize(project));
      expect(loaded.gameDesignBrief).toEqual(project.gameDesignBrief);
      expect(loaded.system.monsterCollection).toBe(true);
      const brief = loaded.gameDesignBrief!;
      const preset = welcomeGenrePresetById(brief.presetId)!;
      expect(buildWelcomeGenrePresetPrompt(preset, brief)).toContain("약사");
      expect(buildWelcomeGenrePresetPrompt(preset, brief)).toContain("F03");
      expect(welcomeGenrePresetDisplayText(preset, brief)).not.toContain("F03");
      expect(welcomeGenrePresetDisplayText(preset, brief)).toMatch(/^관계·연애 \+ 몬스터 수집·육성 · 확정한 게임 기획/u);
    });
    it("rejects lost blend answers and engine/genre mismatches instead of silently dropping them", () => {
      const brief = mixedBrief();
      expect(() => normalizeGameDesignBrief({ ...brief, presetId: "story-cutscene" })).toThrow();
      expect(() => normalizeGameDesignBrief({ ...brief, interview: { ...brief.interview, blend: undefined } })).toThrow();
      expect(() => normalizeGameDesignBrief({ ...brief, interview: { ...brief.interview, secondary: "romance" } })).toThrow();
    });
  });
});

describe("conceptDoubleRowLayout", () => {
  isolateTimers();
  describe("place_concept double-row 도면", () => {
    // Removed it "모르는 layout 은 invalid-plan": place_concept was removed from the tool registry on purpose.

    // Removed it "double-row 는 복도 북쪽과 남쪽에": place_concept was removed from the tool registry on purpose.

    it("BUILTIN에 없는 장소는 theme이 placeId 그대로, 복도는 corridor다", () => {
      const bundle: ConceptBundleRecord = {
        id: "t",
        label: "T",
        facilities: [{ id: "f", label: "F", placeIds: ["living", "corridor"] }],
        places: [
          { id: "living", label: "거실", role: "room", size: "m" },
          { id: "corridor", label: "복도", role: "walkway" },
        ],
        things: [],
      };
      const facility: ConceptFacilityRecord = bundle.facilities[0]!;
      for (const layout of [layoutConceptFacility(bundle, facility), layoutConceptFacilityDoubleRow(bundle, facility)]) {
        const living = layout.rooms.find((room) => room.placeId === "living")!;
        const walkway = layout.rooms.find((room) => room.role === "walkway")!;
        expect(living.theme).toBe("living");
        expect(walkway.theme).toBe("corridor");
      }
    });
  });
  describe("row/double-row legacy walkway contract", () => {
    it.each([
      [{ id: "passage", label: "Hall" }, "walkway"],
      [{ id: "passage", label: "corridor" }, "walkway"],
      [{ id: "corridor", label: "연결" }, "walkway"],
      [{ id: "hall", label: "홀" }, "room"],
      [{ id: "hall", label: "Hall", role: "entrance" }, "entrance"],
      [{ id: "hall", label: "Hall", role: "room" }, "room"],
    ] as const)("%j resolves to %s in both layouts", (place, role) => {
      const bundle: ConceptBundleRecord = {
        id: "test", label: "Test", facilities: [{ id: "f", label: "F", placeIds: [place.id] }],
        places: [{ ...place }], things: [],
      };
      for (const layout of [layoutConceptFacility(bundle, bundle.facilities[0]!), layoutConceptFacilityDoubleRow(bundle, bundle.facilities[0]!)]) {
        expect(layout.rooms.find((room) => room.placeId === place.id)?.role).toBe(role);
      }
    });
  });
});

describe("createDefaultGameEvent", () => {
  isolateTimers();
  describe("createDefaultGameEvent", () => {
    it("creates events without a default charset graphic", () => {
      const event = createDefaultGameEvent(3, 4);
      expect(event.sprite).toBeUndefined();
      expect(event.pages?.[0]?.graphic).toEqual({});
      expect(event.x).toBe(3);
      expect(event.y).toBe(4);
      expect(event.commands).toEqual([]);
    });
  });
});
