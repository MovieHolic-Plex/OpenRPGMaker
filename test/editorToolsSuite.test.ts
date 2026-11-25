import { describe, expect, it, beforeEach, vi } from "vitest";
import * as authoring from "@/ai/actionArenaAuthoring";
import { getTool, toOpenAiTools } from "@/editor/tools/toolRegistry";
import { _resetEditActivityForTest, getEditActivityEntries, unlabeledEditActivityCount } from "@/editor/editActivityLog";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyToolSequenceToStore, applyToolToStore, applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { applyRegionProjectWithHistory } from "@/editor/regionTask/runRegionTask";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import { declaredIntent } from "./intentFixture";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import type { EventPage, GameEvent, GameMap } from "@/project/types";
import { constructionRevealTimingLabel, discardConstructionLogs, offerConstructionLogs, planConstructionReveal } from "@/editor/agentConstructionReveal";
import { mergeConstructionLogs, type ConstructionLog } from "@/editor/tools/constructionLog";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { compileSimplePage } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { isolateTimers } from "./mergedTeardown";

describe("actionArenaAuthoring", () => {
  isolateTimers();
  describe("actionArenaAuthoring", () => {
    isolateTimers();
    describe("structured action arena recipe selection", () => {
      it("selects the arena recipe only for declared action creation targets", () => {
        expect(authoring.selectActionArenaAuthoringRecipe({
          mode: "create", clarify: null, actionCombat: { targets: [{ mapId: "arena" }] },
        })).toBe(authoring.ACTION_ARENA_AUTHORING_RECIPE);
        expect(authoring.selectActionArenaAuthoringRecipe({
          mode: "create", clarify: null, actionCombat: { targets: [{ newMapName: "Training field" }] },
        })).toBe(authoring.ACTION_ARENA_AUTHORING_RECIPE);
      });

      it("does not route questions, small modifications, undeclared combat, or clarification", () => {
        for (const mode of ["question", "modify", "other"] as const) {
          expect(authoring.selectActionArenaAuthoringRecipe({
            mode, clarify: null, actionCombat: { targets: [{ mapId: "arena" }] },
          })).toBeNull();
        }
        expect(authoring.selectActionArenaAuthoringRecipe({ mode: "create", clarify: null })).toBeNull();
        expect(authoring.selectActionArenaAuthoringRecipe({
          mode: "create", clarify: "Which map?", actionCombat: { targets: [{ mapId: "arena" }] },
        })).toBeNull();
        expect(authoring.selectActionArenaAuthoringRecipe({
          mode: "create", clarify: null, actionCombat: { targets: [] },
        })).toBeNull();
      });

      it("exposes real tool dependencies in prerequisite order without unrelated quotas", () => {
        const recipe = authoring.ACTION_ARENA_AUTHORING_RECIPE;
        const ids = recipe.steps.map((step) => step.id);
        expect(ids.indexOf("inspect")).toBeLessThan(ids.indexOf("terrain-start"));
        expect(ids.indexOf("enemy")).toBeLessThan(ids.indexOf("troop"));
        expect(ids.indexOf("troop")).toBeLessThan(ids.indexOf("spawn"));
        expect(ids.indexOf("combat-proof")).toBeLessThan(ids.indexOf("decoration"));
        expect(recipe.guide).toEqual({ tool: "place_npc", option: "action-controls", count: 1 });
        for (const step of recipe.steps) {
          for (const name of step.tools) {
            expect(getTool(name), name).toBeDefined();
          }
        }
        expect(recipe.steps.find((step) => step.id === "combat-proof")?.tools).toContain("run_action_combat_test");
        expect(recipe.steps.flatMap((step) => step.tools)).not.toEqual(expect.arrayContaining(["define_quest", "author_boss_phases"]));
      });
    });
  });
  // AI 적용 경로의 행위 라벨 회귀 테스트.
  //
  // 2026-08-29 실측: `applyChangesetToStore.ts` 의 `store.replace` 3곳과
  // `runRegionTask.ts` 의 1곳이 change descriptor 없이 호출되고 있었다. 그래서 **AI 로 만든
  // 편집 전량**이 기본값 `{ scope: "project" }` + 라벨 없음 + `origin: "human"` 으로 떨어졌다.
  //
  // 이게 왜 치명적인가: 이 프로젝트의 실제 작업은 대부분 채팅/영역 AI 로 이뤄진다.
  // 즉 손편집을 계측해 놓고 정작 주 경로를 비워 둔 상태였고, 고치려던 증상
  // (「무엇을 고쳤는지 기록에 없다」)이 AI 쪽에 그대로 남아 있었다.
  //
  // 이 파일은 (1) AI/툴 적용이 라벨을 남기고 (2) origin 으로 사람과 구분되며
  // (3) 무엇이 몇 개 바뀌었는지 필드로 남는 것을 고정한다.
  describe("aiApplyActivityLabels", () => {
    isolateTimers();
    function mapId(): string {
      return store.getCurrent().startMapId;
    }
    beforeEach(() => {
      _resetEventDraftVaultForTest();
      store.replaceProject(createBlankProject());
      resetMapEditHistory();
      _resetEditActivityForTest();
    });
    describe("단일 툴 적용", () => {
      it("툴 이름과 요약을 라벨로 남기고 origin 을 tool 로 표시한다", () => {
        const result = applyToolToStore("paint_tiles", {
          mapId: mapId(), layer: "lower", mode: "cells", tile: 5, cells: [{ x: 1, y: 1 }],
        });
        expect(result.ok, result.summary).toBe(true);

        const entry = getEditActivityEntries()[0];
        expect(entry, "적용 기록이 있어야 한다").toBeDefined();
        // 핵심: 어떤 툴이었는지 라벨에 있어야 한다. 예전에는 라벨 자체가 없었다.
        expect(entry!.label).toContain("paint_tiles");
        // 핵심: 사람 손편집과 구분돼야 한다.
        expect(entry!.origin).toBe("tool");
        expect(unlabeledEditActivityCount()).toBe(0);
      });

      it("무엇이 몇 개 바뀌었는지 필드로 남긴다", () => {
        applyToolToStore("paint_tiles", {
          mapId: mapId(), layer: "lower", mode: "cells", tile: 5, cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
        });
        const fields = getEditActivityEntries()[0]?.fields ?? [];
        const paths = fields.map((field) => field.path);
        expect(paths).toContain("tilesChanged");
        expect(paths).toContain("tools");
        // 변경 없는 축(0)은 싣지 않는다 — 0 이 스무 줄이면 정작 바뀐 축을 못 찾는다.
        expect(paths).not.toContain("mapsRemoved");
      });

      it("실패한 툴은 기록을 남기지 않는다", () => {
        const result = applyToolToStore("paint_tiles", {
          mapId: "존재하지-않는-맵", layer: "lower", mode: "cells", tile: 5, cells: [{ x: 1, y: 1 }],
        });
        expect(result.ok).toBe(false);
        expect(getEditActivityEntries()).toHaveLength(0);
      });
    });
    describe("툴 묶음 적용", () => {
      it("에이전트 경로는 origin 을 ai 로, 사람 툴 묶음은 tool 로 남긴다", () => {
        const calls = [
          { name: "paint_tiles", args: { mapId: mapId(), layer: "lower", mode: "cells", tile: 6, cells: [{ x: 3, y: 3 }] } },
        ];

        applyToolSequenceToStore(calls, { source: "agent", agentName: "claude-opus-5" });
        const agentEntry = getEditActivityEntries()[0]!;
        expect(agentEntry.origin).toBe("ai");
        expect(agentEntry.label).toContain("AI 적용");
        // 어느 에이전트였는지도 남아야 한다 — 모델을 바꿔 가며 쓰면 그게 조사 단서다.
        expect(agentEntry.label).toContain("claude-opus-5");

        _resetEditActivityForTest();
        applyToolSequenceToStore(
          [{ name: "paint_tiles", args: { mapId: mapId(), layer: "lower", mode: "cells", tile: 6, cells: [{ x: 4, y: 3 }] } }],
          { source: "human" },
        );
        expect(getEditActivityEntries()[0]!.origin).toBe("tool");
      });
    });
    describe("영역 작업 적용", () => {
      it("라벨을 AI 소행으로 남긴다", () => {
        const proposed = structuredClone(store.getCurrent());
        proposed.maps[mapId()]!.lowerTiles[0] = 9;

        applyRegionProjectWithHistory(proposed, "아이들이 놀고있다", mapId());

        const entry = getEditActivityEntries()[0]!;
        expect(entry.origin).toBe("ai");
        // 지시문이 그대로 남아야 한다 — "무엇을 시켰더니 이렇게 됐다" 가 조사의 출발점이다.
        expect(entry.label).toContain("아이들이 놀고있다");
        expect(unlabeledEditActivityCount()).toBe(0);
      });
    });
    describe("완료 조건", () => {
      it("AI 경로를 전부 돌려도 라벨 없는 mutation 이 0 이다", () => {
        applyToolToStore("paint_tiles", { mapId: mapId(), layer: "lower", mode: "cells", tile: 5, cells: [{ x: 1, y: 1 }] });
        applyToolSequenceToStore(
          [{ name: "paint_tiles", args: { mapId: mapId(), layer: "lower", mode: "cells", tile: 5, cells: [{ x: 2, y: 2 }] } }],
          { source: "agent" },
        );
        const proposed = structuredClone(store.getCurrent());
        proposed.maps[mapId()]!.lowerTiles[5] = 3;
        applyRegionProjectWithHistory(proposed, "집들을 만들어라", mapId());

        expect(unlabeledEditActivityCount()).toBe(0);
        // origin 이 human 인 엔트리가 섞이면 오귀속이다 — AI 작업이 사람 편집으로 보인다.
        expect(getEditActivityEntries().every((entry) => entry.origin !== "human")).toBe(true);
      });
    });
  });
  // 2026-08-23 실측 회귀: "엔딩 조건도 하나 걸어줘" 요청에서 define_ending 이 도메인 스코핑·노출 상한에
  // 밀려 모델에 노출되지 않았고, 모델은 사용자에게 "엔딩을 정의하는 기능이 없습니다"라고 보고했다.
  // 있는 기능을 없다고 말하게 만드는 노출 누락은 툴콜 실패보다 나쁘다 — 사용자가 제품 한계로 오해한다.
  //
  // 2026-09-03: 문장 키워드 스캔은 없다. 어떤 툴이 필요한지는 의도 선언(모델)이 tools 로 말하고,
  // 이 가드는 「선언한 툴·도메인이 실제 노출 목록(40 상한·핀·트림)을 통과하는가」만 고정한다.
  describe("aiEndingToolExposure", () => {
    isolateTimers();
    /**
     * 모델이 **실제로** 받는 도메인 슬라이스(선언 툴 강제 노출은 세션이 따로 얹는다 — assistantSessionIntent.test).
     * 노출 누락은 상한 트림에서만 재현되므로 반드시 `toOpenAiTools` 를 지나야 한다.
     */
    function exposedNames(intent: IntentDeclaration): string[] {
      const domains = computeActiveToolDomains(intent);
      return toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
    }
    describe("선언에 맞는 툴 노출", () => {
      it("엔딩 툴을 선언하면 event 도메인이 열려 define_ending 이 노출된다", () => {
        const intent = declaredIntent({ tools: ["define_ending"] });
        expect(computeActiveToolDomains(intent).has("event")).toBe(true);
        expect(exposedNames(intent)).toContain("define_ending");
      });

      it("상성표 툴을 선언하면 set_type_chart 가 노출된다", () => {
        expect(exposedNames(declaredIntent({ tools: ["set_type_chart"] }))).toContain("set_type_chart");
      });

      it("컷신·회상 선언은 script_cutscene 과 프리셋을 함께 노출한다", () => {
        const names = exposedNames(declaredIntent({ tools: ["script_cutscene", "script_cutscene_preset"] }));
        expect(names).toContain("script_cutscene");
        expect(names).toContain("script_cutscene_preset");
      });

      it("참조 id 조회 툴은 어떤 선언에서도 노출된다(core)", () => {
        for (const intent of [declaredIntent({ mode: "question" }), declaredIntent({ tools: ["define_ending"] }), null]) {
          const names = toOpenAiTools(undefined, { domains: computeActiveToolDomains(intent) }).map((tool) => tool.function.name);
          expect(names).toContain("get_database_records");
          expect(names).toContain("tile_query");
        }
      });

      it("타일 시공만 선언한 턴은 컷신 툴을 끌어오지 않는다(과잉 노출 방지)", () => {
        const names = exposedNames(declaredIntent({ space: "outdoor", tools: ["paint_road"] }));
        expect(names).not.toContain("script_cutscene");
        expect(names).toContain("paint_road");
      });

      it("선언한 툴이 없으면 코어 + UI 도메인만 열린다 — 문장의 어미(켜지면·넓어지면)로 도메인이 열리는 경로는 없다", () => {
        const domains = computeActiveToolDomains(declaredIntent({ mode: "question", tools: [] }));
        expect([...domains].sort()).toEqual(["core", "map"]);
      });
    });
  });
  describe("aiGateCommitRejection", () => {
    isolateTimers();
    function page(commands: EventPage["commands"]): EventPage {
      return {
        id: "page_1",
        name: "본문",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      };
    }
    function eventWith(id: string, commands: EventPage["commands"]): GameEvent {
      return { id, x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page(commands)] };
    }
    describe("커밋 게이트 반려 사유", () => {
      it("선재 오류는 사유에서 빼고, 이 변경이 새로 만든 오류만 전량 보고한다", async () => {
        vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "");
        vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "");
        vi.stubEnv("VITE_LEGACY_DB_URL", "");
        try {
          // baseline: 시작 위치가 이미 맵 밖이다(선재 blocking 오류).
          const before = createBlankProject();
          before.startPos = { x: 9999, y: 9999 };
          store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
          store.replaceProject(before);
          resetMapEditHistory();
          const base = captureProposalBase(store.getCurrent());

          // 제안: 선재 오류를 그대로 두고, transfer 목적지가 맵 밖인 이벤트 두 개를 새로 만든다.
          const proposed = structuredClone(before);
          const mapId = proposed.startMapId;
          proposed.maps[mapId].events.push(
            eventWith("ev_bad_1", [{ kind: "transfer", mapId, x: 500, y: 500 }]),
            eventWith("ev_bad_2", [{ kind: "transfer", mapId, x: 600, y: 600 }]),
          );

          const result = await applyProposedProject(proposed, {
            base,
            baseline: new AuthoredProjectBaseline(before),
            source: "agent",
            summary: "이벤트 추가",
            toolNames: ["upsert_event"],
          });

          expect(result.ok).toBe(false);
          if (result.ok) throw new Error("게이트가 통과했다");
          const reasons = (result.issues ?? []).join("\n");
          expect(result.issues?.length).toBe(2);
          expect(reasons).toContain("500");
          expect(reasons).toContain("600");
          // 선재 오류(시작 위치)는 이 반려의 사유가 아니다.
          expect(reasons).not.toContain("시작 위치");
          expect(result.issue).toBe(result.issues?.[0]);
          // 반려 시 저장소는 그대로다.
          expect(store.getCurrent().maps[mapId].events).toHaveLength(before.maps[mapId].events.length);
        } finally {
          vi.unstubAllEnvs();
        }
      });
    });
  });
});

describe("agentConstructionRevealSynthetic", () => {
  isolateTimers();
  const map = { id: "map_town", width: 4, height: 3, tilesetId: "ts" } as unknown as GameMap;
  function log(extra: Partial<ConstructionLog> = {}): ConstructionLog {
    return {
      mapId: "map_town", width: 4, height: 3, toolName: "author_beodeul_town", elapsedMs: 1400, planClasses: { 1: "road" },
      steps: [
        { kind: "plan", label: "큰길", cells: [0, 1], plan: [1, 1] },
        { kind: "paint", label: "길", cells: [0, 1], lower: [5, 5], upper: [-1, -1] },
        { kind: "stamp", label: "집 1/1", cells: [5], lower: [3], upper: [9], major: true, rect: { x: 1, y: 1, w: 1, h: 1 } },
      ],
      ...extra,
    } as ConstructionLog;
  }
  describe("construction reveal: real logs only (qa1124 mockup v4)", () => {
    it("never replays a synthetic (column-ordered) log — those tools get the changed-cell highlight", () => {
      discardConstructionLogs();
      offerConstructionLogs([log({ toolName: "author_dungeon", synthetic: true })]);
      expect(planConstructionReveal(undefined, map, undefined)).toBeNull();
    });

    it("still replays a real builder log and discloses real vs replay seconds", () => {
      discardConstructionLogs();
      offerConstructionLogs([log()]);
      const plan = planConstructionReveal(undefined, map, undefined);
      expect(plan).not.toBeNull();
      expect(plan!.frames.map((frame) => frame.step.kind)).toEqual(["plan", "paint", "stamp"]);
      expect(plan!.durationMs).toBeGreaterThan(plan!.log.elapsedMs);
      expect(constructionRevealTimingLabel(plan!)).toBe(`실제 1.4초 · 재생 ${(plan!.durationMs / 1000).toFixed(1)}초`);
    });

    it("drops synthetic logs when a real log covers the same map in one checkpoint", () => {
      const real = log();
      const synthetic = log({ toolName: "stamp_object", synthetic: true, steps: [{ kind: "stamp", label: "stamp_object · 물체", cells: [11], lower: [1], upper: [2] }] });
      const merged = mergeConstructionLogs([real, synthetic]);
      expect(merged).toHaveLength(1);
      expect(merged[0]!.synthetic).toBeUndefined();
      expect(merged[0]!.steps).toEqual(real.steps);
    });
  });
});

// 에이전틱 개선(2026-07-04) 회귀 테스트.
// - 사용자 제한은 출력 토큰 예산 하나(기본 200000) — 예산 소진 시 token-budget으로 정지.
// - SimplePage 별칭(showText/text/messages)이 대사로 컴파일된다(조용한 유실 방지).
// - place_npc는 통행 불가/점유 좌표를 근처 통행 가능 칸으로 자동 조정한다.
describe("aiAgentic", () => {
  isolateTimers();
  function toolCallResult(name: string, completionTokens: number): ChatResult {
    return {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id: `call_${Math.trunc(completionTokens)}`, type: "function", function: { name, arguments: "{}" } }],
      },
      finishReason: "tool_calls",
      usage: { completion_tokens: completionTokens },
    };
  }
  describe("출력 토큰 예산", () => {
    it("누적 출력 토큰이 maxTokens를 넘으면 token-budget으로 멈춘다", async () => {
      let rounds = 0;
      const session = new AssistantSession(createBlankProject(), {
        config: { ...defaultAiConfig(), apiKey: "sk", maxTokens: 10240 },
        chat: async (cfg, req) => {
          // 플래너(tool 없음)는 예산 집계 밖 또는 direct 로 패스 — 실행 루프만 카운트.
          const hasTools = Array.isArray((req as { tools?: unknown }).tools) && ((req as { tools: unknown[] }).tools?.length ?? 0) > 0;
          if (!hasTools) {
            return {
              message: { role: "assistant", content: JSON.stringify({ action: "direct", reason: "lookup" }) },
              finishReason: "stop",
              usage: { completion_tokens: 20 },
            };
          }
          rounds += 1;
          return toolCallResult("get_project_summary", 6000);
        },
      });
      const result = await session.sendUserMessage("계속 조회해", () => {});
      expect(result.stoppedReason).toBe("token-budget");
      expect(rounds).toBe(2); // 6000 + 6000 = 12000 ≥ 10240
    });

    it("예산 안에서 최종 응답하면 final로 끝난다", async () => {
      const session = new AssistantSession(createBlankProject(), {
        config: { ...defaultAiConfig(), apiKey: "sk" },
        chat: async () => ({
          message: { role: "assistant", content: "완료" },
          finishReason: "stop",
          usage: { completion_tokens: 100 },
        }),
      });
      const result = await session.sendUserMessage("안녕", () => {});
      expect(result.stoppedReason).toBe("final");
    });
  });
  describe("SimplePage 대사 별칭", () => {
    const graphic = { transparent: true as const };

    it("showText 배열이 text 커맨드로 컴파일된다 (감사 로그 유실 케이스)", () => {
      const page = compileSimplePage("p0", "현자 노인", { showText: ["첫 줄", "둘째 줄"] }, graphic);
      const texts = page.commands.filter((command) => command.kind === "text");
      expect(texts).toHaveLength(2);
    });

    it("text 단일 문자열과 messages 배열도 대사가 된다", () => {
      expect(compileSimplePage("p1", "n", { text: "한 줄" }, graphic).commands.filter((c) => c.kind === "text")).toHaveLength(1);
      expect(compileSimplePage("p2", "n", { messages: ["a", "b", "c"] }, graphic).commands.filter((c) => c.kind === "text")).toHaveLength(3);
    });

    it("lines가 있으면 lines가 우선한다", () => {
      const page = compileSimplePage("p3", "n", { lines: ["본문"], showText: ["무시"] }, graphic);
      const texts = page.commands.filter((command) => command.kind === "text" && "body" in command);
      expect(texts).toHaveLength(1);
    });
  });
  describe("place_npc 자동 착지", () => {
    it("이미 점유된 좌표에 배치하면 인근 통행 가능 칸으로 조정된다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const first = runTool(context, "place_npc", {
        mapId, x: 2, y: 2, id: "npc_a", name: "갑", pages: [{ lines: ["안녕"] }],
      });
      expect(first.ok, first.summary).toBe(true);

      const second = runTool(context, "place_npc", {
        mapId, x: 2, y: 2, id: "npc_b", name: "을", pages: [{ lines: ["반가워"] }],
      });
      expect(second.ok, second.summary).toBe(true);
      const data = second.data as { x: number; y: number; adjusted: boolean };
      expect(data.adjusted).toBe(true);
      expect(`${data.x},${data.y}`).not.toBe("2,2");
      expect(second.summary).toContain("자동 조정");
    });

    it("반경 3칸 내에 통행 가능 칸이 없으면 여전히 실패한다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const map = context.project.maps[mapId];
      const tileset = context.project.tilesets[map.tilesetId];
      // 전 타일을 통행 불가로 만들어 조정 불가 상황을 강제한다.
      for (let index = 0; index < tileset.passability.length; index += 1) {
        tileset.passability[index] = { up: false, down: false, left: false, right: false };
      }
      const result = runTool(context, "place_npc", {
        mapId, x: 5, y: 5, id: "npc_c", name: "병", pages: [{ lines: ["..."] }],
      });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("통행 가능 칸이 없습니다");
    });
  });
});
