import { describe, expect, it } from "vitest";
import type { AuditEntry, TurnResult } from "@/ai/assistantSession";
import type { ConstructionAuditRecord } from "@/editor/construction/constructionAudit";
import { buildRegionTaskLogExport, buildRegionTaskMessage, ensureRegionPlacementHarness, formatApprovedPropVocabHint, clippedNoticeText, describeRegionTaskResult, type RegionTaskResult, runRegionTask, serializeRegionTaskLog, type RegionTaskDeps, type RegionTaskSessionLike, pendingApprovalText } from "@/editor/regionTask/runRegionTask";
import { createBlankProject } from "@/project/defaults";
import { declaredIntent } from "./intentFixture";
import { BUILD_PALETTE_GROUP_IDS } from "@/editor/panels/buildPaletteCore";
import { toOpenAiTools } from "@/editor/tools";
import { beginAssistantToolDomainTurn, computeActiveToolDomains } from "@/editor/assistantToolMode";
import { runTool } from "@/editor/tools/toolRunner";
import { approvedVocabulary } from "@/project/tileVocabulary";
import { TILE } from "@/project/defaults/constants";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import type { Project } from "@/project/types";
import { approvedReview } from "./independentReviewFixture";
import { isolateTimers } from "./mergedTeardown";

describe("constructionActivityOutcome", () => {
  isolateTimers();
  const ZERO_DIFF = {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
  } as const;
  const FAILED_CONSTRUCTION = {
    executionOk: false,
    applied: false,
    outcome: "failed",
    requestedEntrypoint: "author_village",
    canonicalRoute: "author_village",
    selectedImplementation: "buildVillageDomain",
    routeChanges: [],
    target: { kind: "existing", mapId: "map_1" },
    counts: { requested: 8, actual: 0 },
    diff: ZERO_DIFF,
    warnings: ["exact count rolled back"],
    activityPersistence: "local",
    projectPersistence: "failed",
  } as const satisfies ConstructionAuditRecord;
  describe("canonical construction activity outcome", () => {
    it("exports a failed canonical call from the audit ledger even without a proposal", () => {
      // Given: a canonical call failed before it could become a proposed change.
      const audit = [{
        kind: "tool",
        name: "author_village",
        args: { target: { kind: "existing", mapId: "map_1" }, houseCount: 8 },
        ok: false,
        summary: "exact count rolled back",
        construction: FAILED_CONSTRUCTION,
      }] as const satisfies readonly AuditEntry[];
      const turn = {
        assistantText: "마을 건설에 실패했습니다.",
        proposedCalls: [],
        stoppedReason: "final",
      } as const satisfies TurnResult;

      // When: the region task builds its top-level exported tool-call list.
      const log = buildRegionTaskLogExport({
        mapId: "map_1",
        mapName: "마을",
        region: { x: 0, y: 0, width: 20, height: 20 },
        instruction: "집 8채 마을을 정확히 지어줘",
        composedMessage: "집 8채 마을을 정확히 지어줘\n[context]",
        result: {
          ok: false,
          applied: false,
          changedCells: 0,
          changedEvents: 0,
          clippedCells: 0,
          proposedCalls: 0,
          assistantText: turn.assistantText,
          error: "exact count rolled back",
        },
        turn,
        uiEvents: [],
        session: {
          sendUserMessage: async () => turn,
          getProposedProject: () => createBlankProject(),
          getAuditEntries: () => audit,
        },
      });

      // Then: failure, route, target, and count survive in the top-level call summary.
      expect(log.toolCalls).toEqual([expect.objectContaining({
        name: "author_village",
        ok: false,
        construction: expect.objectContaining({
          outcome: "failed",
          canonicalRoute: "author_village",
          target: { kind: "existing", mapId: "map_1" },
          counts: { requested: 8, actual: 0 },
        }),
      })]);
    });
  });
});

describe("regionAiPlacementHarness", () => {
  isolateTimers();
  const MAP_ID = "map_region_harness";
  const REGION = { x: 2, y: 2, width: 12, height: 10 };
  // 이 하네스는 합본 마을 칩셋(237 나무 상자·침엽수 그룹·TILE.GRASS)을 겨눈다 — 기본 칩셋이 beodeul_city 로 바뀐 뒤(PR #2335) 직접 넣는다.
  function makeMapProject() {
    const context = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
    const created = runTool(context, "create_map", { id: MAP_ID, name: "하네스", width: 20, height: 16, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID });
    expect(created.ok).toBe(true);
    context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
    context.project.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
    return context;
  }
  describe("region AI placement harness", () => {
    // author_house 는 도구 정리로 지워졌다(드리프트 브리프의 제거 목록) — 노출 확인에서 그 이름만 뺐다.
    it("multi-domain region declaration keeps place_props/place_npc exposed", () => {
      const project = makeMapProject().project;
      const tileset = project.tilesets[project.maps[MAP_ID].tilesetId];
      ensureRegionPlacementHarness(tileset);
      const msg = buildRegionTaskMessage("집과 나무 1개, npc 배치", "하네스", MAP_ID, REGION, tileset);
      const intent = declaredIntent({ space: "outdoor", useSelection: true, tools: ["place_props", "place_npc"] });
      beginAssistantToolDomainTurn(intent);
      const domains = computeActiveToolDomains(intent);
      const tools = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
      expect(domains.has("tile")).toBe(true);
      expect(domains.has("event")).toBe(true);
      expect(tools).toContain("place_props");
      expect(tools).toContain("place_npc");
      // 재료 라벨 예시(사실)는 footer 에 남는다 — 그룹 id 는 노출하지 않는다.
      expect(msg).toMatch(/침엽수|나무/);
      expect(msg).not.toContain(BUILD_PALETTE_GROUP_IDS.tree);
    });

    it("ensureRegionPlacementHarness approves tree group so place_props succeeds", () => {
      const context = makeMapProject();
      const tileset = context.project.tilesets[context.project.maps[MAP_ID].tilesetId];
      // 번들 트리 그룹은 source:"bundled-default"로 이미 시드 승인되어 있다(2026-07-11).
      // ensureRegionPlacementHarness는 이를 origin:"user"(영구 합의)로 승격한다.
      expect(approvedVocabulary(tileset).groups.some((group) => group.id === BUILD_PALETTE_GROUP_IDS.tree)).toBe(true);
      expect(tileset.tileGroups?.find((entry) => entry.id === BUILD_PALETTE_GROUP_IDS.tree)?.origin).not.toBe("user");
      ensureRegionPlacementHarness(tileset);
      expect(tileset.tileGroups?.find((entry) => entry.id === BUILD_PALETTE_GROUP_IDS.tree)?.origin).toBe("user");
      expect(approvedVocabulary(tileset).groups.some((group) => group.id === BUILD_PALETTE_GROUP_IDS.tree)).toBe(true);
      expect(formatApprovedPropVocabHint(tileset)).toMatch(/침엽수|나무/);
      expect(formatApprovedPropVocabHint(tileset)).not.toContain(BUILD_PALETTE_GROUP_IDS.tree);
      expect(formatApprovedPropVocabHint(tileset)).not.toContain("마을 소품");

      const props = runTool(context, "place_props", {
        mapId: MAP_ID,
        area: { x: 4, y: 4, w: 8, h: 6 },
        material: "침엽수",
        count: 1,
        seed: 7,
      });
      expect(props.ok).toBe(true);
      const upper = context.project.maps[MAP_ID].upperTiles.filter((tile) => tile >= 0 && tile !== TILE.EMPTY).length;
      const lowerDiff = context.project.maps[MAP_ID].lowerTiles.filter((tile) => tile !== TILE.GRASS).length;
      expect(upper + lowerDiff).toBeGreaterThan(0);
    });

    it("place_props wood-box places tile 237 (not random small-props)", () => {
      const context = makeMapProject();
      const tileset = context.project.tilesets[context.project.maps[MAP_ID].tilesetId];
      ensureRegionPlacementHarness(tileset);
      const result = runTool(context, "place_props", {
        mapId: MAP_ID,
        area: { x: 5, y: 5, w: 4, h: 3 },
        material: "나무 상자",
        count: 2,
        seed: 3,
        minGap: 1,
      });
      expect(result.ok).toBe(true);
      const woodTiles = context.project.maps[MAP_ID].upperTiles.filter((tile) => tile === 237).length;
      expect(woodTiles).toBeGreaterThanOrEqual(1);
      expect(woodTiles).toBeLessThanOrEqual(2);
    });

    it("place_npc without graphic uses villager charset, not transparent", () => {
      const context = makeMapProject();
      const result = runTool(context, "place_npc", {
        mapId: MAP_ID,
        x: 10,
        y: 10,
        name: "주민",
        pages: [{ lines: ["안녕하세요."] }],
      });
      expect(result.ok).toBe(true);
      const event = context.project.maps[MAP_ID].events.find((entry) => entry.pages?.[0]?.name === "주민" || entry.id.startsWith("ev_npc"));
      expect(event).toBeTruthy();
      const graphic = event?.pages?.[0]?.graphic;
      expect(graphic).toBeTruthy();
      expect(graphic && "transparent" in graphic ? graphic.transparent : false).not.toBe(true);
      expect(graphic && "sprite" in graphic ? graphic.sprite : null).toMatchObject({ type: "bundled" });
    });

    it("make_villager without graphic uses villager charset", () => {
      const context = makeMapProject();
      const result = runTool(context, "make_villager", {
        mapId: MAP_ID,
        name: "농부",
        home: { x: 8, y: 8 },
        dialogue: [{ text: "밭일이 한창이야." }],
      });
      expect(result.ok).toBe(true);
      const event = context.project.maps[MAP_ID].events.find((entry) => entry.pages?.[0]?.name === "농부");
      const graphic = event?.pages?.[0]?.graphic;
      expect(graphic && "transparent" in graphic ? graphic.transparent : false).not.toBe(true);
      expect(graphic && "sprite" in graphic ? (graphic.sprite as { id?: string }).id : "").toContain("charset");
    });
  });
});

// 선택 영역 하드 클립이 제안을 전부 버렸을 때 사실을 먼저 말한다.
// 2026-09-03 적대적 리뷰 15: 툴은 「25/25칸 채움」, 맵은 0칸, 조수는 「채웠습니다」, 시스템 줄은 「바뀐 것이 없습니다」.
describe("regionTaskClipNotice", () => {
  isolateTimers();
  function result(overrides: Partial<RegionTaskResult>): RegionTaskResult {
    return {
      ok: true,
      applied: false,
      changedCells: 0,
      changedEvents: 0,
      mapsAdded: 0,
      clippedCells: 0,
      proposedCalls: 1,
      assistantText: "",
      ...overrides,
    } as RegionTaskResult;
  }
  describe("영역 밖 클립 안내", () => {
    it("변경 0칸이 클립 때문이면 차단한 칸 수와 해제 방법을 말한다", () => {
      const text = describeRegionTaskResult(result({ clippedCells: 25 }));
      expect(text).toContain("25칸");
      expect(text).toContain("영역 밖");
      expect(text).toMatch(/해제|다시 선택/u);
    });

    it("모델 문장 앞에 「맵은 바뀌지 않았다」 사실을 박는다", () => {
      const text = clippedNoticeText("오른쏙 옆에 물을 채웠습니다.", result({ clippedCells: 25 }));
      expect(text.startsWith("맵은 바뀌지 않았습니다")).toBe(true);
      expect(text).toContain("25칸");
      expect(text).toContain("오른쏙 옆에 물을 채웠습니다.");
    });

    it("적용됐거나 클립이 없으면 모델 문장을 그대로 둔다", () => {
      expect(clippedNoticeText("했습니다.", result({ applied: true, changedCells: 3 }))).toBe("했습니다.");
      expect(clippedNoticeText("했습니다.", result({}))).toBe("했습니다.");
    });
  });
});

describe("regionTaskLogExport", () => {
  isolateTimers();
  const MAP_ID = "map_region_log";
  const REGION: RegionRect = { x: 1, y: 1, width: 4, height: 4 };
  function baseProject(): Project {
    const context = { project: createBlankProject() };
    expect(runTool(context, "create_map", { id: MAP_ID, name: "로그맵", width: 12, height: 12 }).ok).toBe(true);
    context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
    context.project.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
    return context.project;
  }
  describe("region task log export", () => {
    it("buildRegionTaskLogExport serializes audit and ui events", () => {
      const log = buildRegionTaskLogExport({
        mapId: MAP_ID,
        mapName: "로그맵",
        region: REGION,
        instruction: "나무 2개",
        composedMessage: "나무 2개\n\n[컨텍스트]",
        result: {
          ok: true,
          applied: true,
          changedCells: 4,
          changedEvents: 0,
          clippedCells: 0,
          proposedCalls: 1,
          assistantText: "완료",
        },
        turn: {
          assistantText: "완료",
          proposedCalls: [
            {
              name: "place_props",
              args: { mapId: MAP_ID, count: 2 },
              summary: "소품 2",
              result: { ok: true, summary: "소품 2" },
              destructive: false,
            },
          ],
          stoppedReason: "final",
        },
        uiEvents: [{ at: "2026-01-01T00:00:00.000Z", type: "tool_call", text: "place_props", toolName: "place_props", toolOk: true }],
        session: {
          async sendUserMessage() {
            return { assistantText: "", proposedCalls: [], stoppedReason: "final" };
          },
          getProposedProject: () => baseProject(),
          getAuditEntries: () => [{ kind: "user", text: "나무 2개", at: "2026-01-01T00:00:00.000Z" }],
          getHarnessSnapshot: () => ({
            model: "test-model",
            maxTokens: 1024,
            messages: [{ role: "user", content: "나무 2개" }],
            audit: [],
          }),
        },
      });
      expect(log.kind).toBe("region-task-log");
      expect(log.toolCalls).toHaveLength(1);
      expect(log.audit[0]?.kind).toBe("user");
      expect(log.harness?.model).toBe("test-model");
      const json = serializeRegionTaskLog(log);
      expect(json).toContain("region-task-log");
      expect(json).toContain("place_props");
    });

    it("runRegionTask attaches log with uiEvents from onEvent stream", async () => {
      const base = baseProject();
      const proposed = structuredClone(base);
      // mark a cell change inside region so apply happens
      proposed.maps[MAP_ID].upperTiles[2 * 12 + 2] = TILE.TREE;

      const turn: TurnResult = {
        assistantText: "영역 완료",
        proposedCalls: [],
        stoppedReason: "final",
        review: approvedReview,
      };
      const session: RegionTaskSessionLike = {
        async sendUserMessage(_text, onEvent) {
          onEvent?.({ type: "status", text: "진행" });
          onEvent?.({
            type: "tool_call",
            name: "place_props",
            args: { mapId: MAP_ID, count: 1 },
            result: { ok: true, summary: "배치" },
          });
          return turn;
        },
        getProposedProject: () => proposed,
        getAuditEntries: () => [{ kind: "tool", name: "place_props", args: {}, ok: true, summary: "배치" }],
        getHarnessSnapshot: () => ({ model: "lite", maxTokens: 512, messages: [], audit: [] }),
      };
      const deps: RegionTaskDeps = {
        getProject: () => base,
        applyProject: () => undefined,
        createSession: () => session,
      };
      const result = await runRegionTask(
        { mapId: MAP_ID, region: REGION, instruction: "나무" },
        deps,
      );
      expect(result.ok).toBe(true);
      expect(result.log).toBeDefined();
      expect(result.log?.uiEvents.some((event) => event.type === "tool_call" && event.toolName === "place_props")).toBe(true);
      expect(result.log?.audit.some((entry) => entry.kind === "tool")).toBe(true);
      expect(result.log?.harness?.model).toBe("lite");
    });
  });
});

/**
 * 승인 대기 턴이 "아직 반영되지 않았다" 를 먼저 말하는지 고정한다.
 *
 * 2026-08-29 실측 두 건이 근거다.
 *  - 15:41: 턴이 stoppedReason "final" / applied:false 로 끝났는데 모델의 마지막 말은
 *    "시공했습니다" 였다. 사용자는 반영된 줄 알고 맵을 봤고 아무것도 없었다.
 *  - 15:44: max-tool-calls 로 잘려 assistantText 가 빈 채 313칸이 대기로 남았다.
 *    화면에는 아무 말도 없었다.
 * 게이트 자체는 그대로 둔다(영역 작업은 승인 카드가 계약이다). 말만 사실로 바꾼다.
 */
describe("regionTaskPendingNotice", () => {
  isolateTimers();
  const CHANGED = { changedCells: 313, changedEvents: 0, mapsAdded: 0 } as const;
  function baseResult(overrides: Partial<RegionTaskResult>): RegionTaskResult {
    return {
      ok: true,
      applied: false,
      changedCells: 0,
      changedEvents: 0,
      clippedCells: 0,
      proposedCalls: 0,
      assistantText: "",
      ...overrides,
    } as RegionTaskResult;
  }
  describe("승인 대기 안내", () => {
    it("모델이 '시공했습니다' 라고 단정해도 미반영 사실이 앞에 온다", () => {
      const text = pendingApprovalText("숲을 시공했습니다.", CHANGED);
      expect(text.startsWith("아직 맵에 반영되지 않았습니다")).toBe(true);
      expect(text).toContain("313칸 타일");
      expect(text).toContain("[적용]");
      // 모델 문장을 지우지는 않는다 — 무엇을 하려 했는지는 여전히 정보다.
      expect(text).toContain("숲을 시공했습니다.");
    });

    it("모델이 침묵한 턴(예산 소진)에도 대기 규모를 말한다", () => {
      const text = pendingApprovalText("", CHANGED);
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).toContain("313칸 타일");
      expect(text).not.toContain("\n\n");
    });

    it("이벤트·맵 추가도 규모에 함께 센다", () => {
      const text = pendingApprovalText("", { changedCells: 12, changedEvents: 3, mapsAdded: 1 });
      expect(text).toContain("12칸 타일");
      expect(text).toContain("이벤트 3건");
      expect(text).toContain("맵 1개 추가");
    });

    it("바뀐 칸이 없으면 대기 규모를 꾸며내지 않는다", () => {
      const text = pendingApprovalText("검토했습니다.", { changedCells: 0, changedEvents: 0, mapsAdded: 0 });
      expect(text).toContain("바뀐 칸이 없어 적용할 것이 없습니다");
      expect(text).not.toContain("칸 타일");
    });

    it("한 줄 요약도 대기를 '반영되지 않았다'로 말한다", () => {
      const summary = describeRegionTaskResult(baseResult({
        ...CHANGED,
        pending: { settled: false } as RegionTaskResult["pending"],
      }));
      expect(summary).toContain("승인 대기");
      expect(summary).toContain("아직 반영되지 않았습니다");
    });

    it("변경을 만들고 반영하지 않은 결과를 '변경이 없다'로 뒤집어 말하지 않는다", () => {
      // 이전 판은 두 문구가 뒤집혀 있어 313칸이 남아도 "적용할 변경이 없습니다" 라고 답했다.
      const discarded = describeRegionTaskResult(baseResult(CHANGED));
      expect(discarded).toContain("313칸 타일");
      expect(discarded).not.toContain("적용할 변경이 없습니다");

      const empty = describeRegionTaskResult(baseResult({}));
      expect(empty).toBe("이 영역에서 바뀐 것이 없습니다.");
    });
  });
});
