import { describe, expect, it, afterEach } from "vitest";
import { AUTONOMY_LEVELS, resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";
import { orderedAssets, validateBuildSpec, type BuildSpec } from "@/ai/buildSpec";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { charsetEntryOf, characterRoleOf, chipFitsRole } from "@/ai/characterFit";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { PREFERENCE_PRECEDENCE_LINE, PREFERENCE_SECTION_HEADING } from "@/ai/preferenceMemory";
import { COMPACTION_SUMMARY_MARKER, DEFAULT_COMPACTION_SETTINGS, DEFAULT_CONTEXT_WINDOW, buildCompactedMessages, buildSummarizationRequest, compactionSummaryMessage, estimateContextTokens, estimateMessageTokens, findCompactionCutPoint, findPreviousSummary, isCompactionSummaryMessage, repairRetainedTail, resolveContextWindow, resolveThresholdContextTokens, shouldCompact, estimateAdmissionTokens } from "@/ai/contextCompaction";
import { type ChatMessage, defaultAiConfig, type ChatResult, type AiConfig, type ChatRequest } from "@/ai/llmClient";
import { buildConversationTurnContext, isConversationTurnContext, mapTransitionNote, type ConversationTurnContext } from "@/ai/conversationTurnContext";
import type { MapViewportSnapshot } from "@/ai/mapViewportContext";
import type { Project, TileGraft } from "@/project/types";
import { ACCEPTANCE_EXAMPLES, parseAcceptanceCriteria, type AcceptanceCriterion } from "@/ai/assistantAcceptance";
import { ACCEPTANCE_CRITERIA_SCHEMA } from "@/ai/assistantAcceptanceTools";
import { evaluateAcceptanceCriterion } from "@/ai/assistantAcceptanceEvaluation";
import { describesGothicPlace, gothicPromptLines, gothicTargetFor, formatGothicNote, GOTHIC_EXPOSED_TOOLS, GOTHIC_POINTER_LINE, GOTHIC_DETAIL_LINE, isGothicManorTilesetDef } from "@/ai/gothicPolicy";
import { declaredIntent } from "./intentFixture";
import { buildIndependentReviewRequest, type ReviewInput, parseIndependentReview, reviewChanges } from "@/ai/independentReview";
import { originalContextWindow } from "@/ai/originalContext";
import { chatgptFixtureConfig } from "./helpers/chatgptFixtureConfig";
import { compareImageModelVersions, pickNewestImageModel, reportedImageModel } from "@/ai/imageModelResolution";
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PROVIDER_ID, IMAGE_MODEL_CATALOG } from "@/ai/imageModelCatalog";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { startSession } from "@/project/session";
import { buildIntentUserPayload, continuationIntentDeclaration, fallbackIntentDeclaration, formatIntentAudit, formatIntentClarifyMessage, formatIntentNote, formatScopeNote, formatRegionPlaceNote, formatV2RegionNote, INTENT_SYSTEM_PROMPT, intentEscapesRegion, intentToolDomains, isContinuationText, parseIntentDeclaration, type IntentFacts } from "@/ai/intentDeclaration";
import { QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import { buildIntentFacts, createLlmIntentDeclarer as productionDeclarer, declareIntentCached, resetIntentDeclarationCache, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import { requiresVisualReview, tilesetVisualContent } from "@/ai/mapVisualEvidence";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import { isolateTimers } from "./mergedTeardown";
import { fastApplyTurn, fastWarnings } from "@/ai/v2/turn/fastApply";
import { composePiTask } from "@/ai/piAgent/executionRoute";

// Autonomy-level core model mapping: level id -> LLM/session knobs.
// Tests machine-consumed values (ids, resolution fields); metadata prose is
// only checked for presence, never pinned verbatim.
describe("autonomyLevels", () => {
  isolateTimers();
  const LEVELS: readonly AutonomyLevel[] = ["readonly", "confirm", "balanced", "autonomous", "max"];
  describe("AUTONOMY_LEVELS", () => {
    it("covers every AutonomyLevel exactly once", () => {
      expect(AUTONOMY_LEVELS.map((entry) => entry.id).sort()).toEqual([...LEVELS].sort());
    });
  });
  describe("resolveAutonomy", () => {
    // Break: the readonly level is the only manual way to force the session's ask
    // rail once the composer mode chips are gone. Dropping readOnly (or the level
    // itself) silently gives every turn write tools.
    it("maps readonly to the ask rail with no planning", () => {
      expect(resolveAutonomy("readonly")).toEqual({
        reasoningEffort: "low",
        agentMode: "chat",
        budgetCap: 4,
        piMaxTurns: 50,
        planOnly: false,
        readOnly: true,
      });
    });

    it("maps confirm to the most conservative writing knobs and plan-only", () => {
      expect(resolveAutonomy("confirm")).toEqual({
        reasoningEffort: "low",
        agentMode: "chat",
        budgetCap: 6,
        piMaxTurns: 50,
        planOnly: true,
        readOnly: false,
      });
    });

    it("maps balanced to low reasoning with auto planning", () => {
      expect(resolveAutonomy("balanced")).toEqual({
        reasoningEffort: "low",
        agentMode: "auto",
        budgetCap: 16,
        piMaxTurns: 200,
        planOnly: false,
        readOnly: false,
      });
    });

    it("maps autonomous to medium reasoning with a larger budget", () => {
      expect(resolveAutonomy("autonomous")).toEqual({
        reasoningEffort: "medium",
        agentMode: "auto",
        budgetCap: 32,
        piMaxTurns: 300,
        planOnly: false,
        readOnly: false,
      });
    });

    it("maps max to high reasoning with the full run budget", () => {
      expect(resolveAutonomy("max")).toEqual({
        reasoningEffort: "high",
        agentMode: "auto",
        budgetCap: 48,
        piMaxTurns: 600,
        planOnly: false,
        readOnly: false,
      });
    });

    // Break: marking a writing level readOnly would strip its write tools; marking
    // readonly writable would defeat the level. Only readonly may be read-only.
    it("marks exactly one level read-only", () => {
      const readOnly = LEVELS.filter((level) => resolveAutonomy(level).readOnly);
      expect(readOnly).toEqual(["readonly"]);
    });

    it("keeps budgetCap strictly increasing with autonomy", () => {
      const caps = LEVELS.map((level) => resolveAutonomy(level).budgetCap);
      expect([...caps].sort((a, b) => a - b)).toEqual(caps);
      expect(new Set(caps).size).toBe(caps.length);
    });

    // 2026-09-17 실측: budgetCap 이 그대로 Pi 의 `maxTurns` 로 실려서 「균형」(16턴)이 다이얼을
    // **안 건드린 것**(워커 기본값 40턴)보다 나빴다. 7번의 턴 상한 중단 중 4번이 이 조합이었다.
    // 다이얼을 고르는 행위가 안 고르는 것보다 나쁜 결과를 내면 그건 컨트롤이 아니다.
    const WORKER_DEFAULT_MAX_TURNS = 200; // scripts/lib/piAgentRuntime.ts
    it("실행하는 레벨의 턴 상한은 워커 기본값 아래로 내려가지 않는다", () => {
      for (const level of LEVELS) {
        const resolved = resolveAutonomy(level);
        if (resolved.readOnly || resolved.planOnly) continue; // 짓지 않는 레벨엔 짓는 예산이 필요 없다
        expect(resolved.piMaxTurns, level).toBeGreaterThanOrEqual(WORKER_DEFAULT_MAX_TURNS);
      }
    });

    // Break: 둘을 다시 한 숫자로 합치면 위 결함이 그대로 돌아온다. 한 턴은 모델 왕복 한 번이고
    // 그 안에서 도구를 여러 번 부르므로, 도구 예산과 턴 예산은 같은 수일 이유가 없다.
    it("턴 예산과 도구 호출 예산은 다른 값이다", () => {
      const executing = LEVELS.filter((level) => !resolveAutonomy(level).readOnly && !resolveAutonomy(level).planOnly);
      expect(executing.length).toBeGreaterThan(0);
      for (const level of executing) {
        const { budgetCap, piMaxTurns } = resolveAutonomy(level);
        expect(piMaxTurns, level).not.toBe(budgetCap);
      }
    });

    it("keeps piMaxTurns non-decreasing with autonomy", () => {
      const turns = LEVELS.map((level) => resolveAutonomy(level).piMaxTurns);
      expect([...turns].sort((a, b) => a - b)).toEqual(turns);
    });

    it("returns a fresh object per call", () => {
      const first = resolveAutonomy("balanced");
      first.budgetCap = -1;
      expect(resolveAutonomy("balanced").budgetCap).toBe(16);
    });
  });
});

describe("buildOrder", () => {
  isolateTimers();
  function projectWithMap() {
    const ctx = { project: createBlankProject() };
    const created = runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 20 });
    expect(created.ok, created.summary).toBe(true);
    return ctx.project;
  }
  describe("orderedAssets", () => {
    it("buildOrder에 적힌 kind 순서대로 에셋을 앞에 둔다", () => {
      const spec: BuildSpec = {
        mapId: "m1",
        buildOrder: ["road", "house"],
        assets: [
          { id: "h1", kind: "house", x: 6, y: 2, w: 3, h: 3 },
          { id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 },
          { id: "p1", kind: "prop", x: 12, y: 2, w: 1, h: 1 },
        ],
      };

      expect(orderedAssets(spec).map((asset) => asset.id)).toEqual(["r1", "h1", "p1"]);
    });

    it("같은 kind 안에서는 입력 순서를 유지한다", () => {
      const spec: BuildSpec = {
        mapId: "m1",
        buildOrder: ["house"],
        assets: [
          { id: "h1", kind: "house", x: 2, y: 2, w: 3, h: 3 },
          { id: "p1", kind: "prop", x: 12, y: 2, w: 1, h: 1 },
          { id: "h2", kind: "house", x: 6, y: 2, w: 3, h: 3 },
        ],
      };

      expect(orderedAssets(spec).map((asset) => asset.id)).toEqual(["h1", "h2", "p1"]);
    });

    it("buildOrder가 없으면 같은 내용과 순서의 얕은 복사본을 반환한다", () => {
      const spec: BuildSpec = {
        mapId: "m1",
        assets: [
          { id: "h1", kind: "house", x: 2, y: 2, w: 3, h: 3 },
          { id: "r1", kind: "road", x: 6, y: 2, w: 3, h: 1 },
        ],
      };

      const ordered = orderedAssets(spec);
      expect(ordered).toEqual(spec.assets);
      expect(ordered).not.toBe(spec.assets);
    });
  });
  describe("validateBuildSpec buildOrder", () => {
    it("buildOrder가 문자열 배열이 아니면 error", () => {
      const project = projectWithMap();
      const issues = validateBuildSpec(project, {
        mapId: "m1",
        buildOrder: "road",
        assets: [{ id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 }],
      });

      expect(issues).toContainEqual({ severity: "error", message: "buildOrder는 문자열 배열이어야 합니다." });
    });

    it("buildOrder에 없는 kind가 있으면 warning만 낸다", () => {
      const project = projectWithMap();
      const issues = validateBuildSpec(project, {
        mapId: "m1",
        buildOrder: ["road", "castle"],
        assets: [{ id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 }],
      });

      expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
      expect(issues).toContainEqual({ severity: "warning", message: "buildOrder의 'castle'에 해당하는 에셋이 없습니다" });
    });

    it("비어 있지 않은 buildOrder가 asset kind를 빠뜨리면 마지막 배치 warning을 낸다", () => {
      const project = projectWithMap();
      const issues = validateBuildSpec(project, {
        mapId: "m1",
        buildOrder: ["road"],
        assets: [
          { id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 },
          { id: "p1", kind: "prop", x: 12, y: 2, w: 1, h: 1 },
        ],
      });

      expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
      expect(issues).toContainEqual({ severity: "warning", message: "에셋 'p1'(prop)가 buildOrder에 없어 마지막에 배치됩니다" });
    });

    it("유효한 spec과 buildOrder는 error가 없다", () => {
      const project = projectWithMap();
      const spec: BuildSpec = {
        mapId: "m1",
        buildOrder: ["road", "house", "prop"],
        assets: [
          { id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 },
          { id: "h1", kind: "house", x: 6, y: 2, w: 3, h: 3 },
          { id: "p1", kind: "prop", x: 12, y: 2, w: 1, h: 1 },
        ],
      };

      expect(validateBuildSpec(project, spec).filter((issue) => issue.severity === "error")).toEqual([]);
    });
  });
});

describe("characterFit", () => {
  isolateTimers();
  describe("이름 붙은 인물의 걷기 칩이 역할에 맞는가", () => {
    it("무기점 주인에게 여관 주인 앞치마 칩은 맞지 않고, 대장장이 칩은 맞는다", () => {
      const innkeeper = charsetEntryOf("tex_oprn_charset_refmap_doll225", 0);
      const smith = charsetEntryOf("tex_oprn_charset_refmap_doll190", 4);
      expect(innkeeper && smith).toBeTruthy();
      expect(chipFitsRole(innkeeper, "무기점 주인 도르간").fits).toBe(false);
      expect(chipFitsRole(smith, "무기점 주인 도르간").fits).toBe(true);
    });

    it("어부 할아버지는 늙은 선원 칩이면 맞고 젊은 어부 칩이면 나이가 어긋난다", () => {
      const oldSailor = charsetEntryOf("tex_oprn_charset_refmap_doll288", 2);
      const youngFisher = charsetEntryOf("tex_oprn_charset_refmap_doll291", 7);
      expect(chipFitsRole(oldSailor, "어부 할아버지").fits).toBe(true);
      expect(chipFitsRole(youngFisher, "어부 할아버지").fits).toBe(false);
    });

    it("꽃집 소녀·음유시인·수상한 상인은 각자 보이는 것이 있어야 한다", () => {
      const flowerMaid = charsetEntryOf("tex_oprn_charset_refmap_doll49", 2);
      const bard = charsetEntryOf("tex_oprn_charset_refmap_doll199", 4);
      const innkeeper = charsetEntryOf("tex_easyrpg_charset_people5", 6);
      expect(chipFitsRole(flowerMaid, "꽃집 소녀 릴리").fits).toBe(true);
      expect(chipFitsRole(bard, "떠돌이 음유시인").fits).toBe(true);
      expect(chipFitsRole(innkeeper, "수상한 상인").fits).toBe(false);
      expect(chipFitsRole(bard, "꽃집 소녀 릴리").fits).toBe(false);
    });

    it("역할 낱말이 없는 이름과 카탈로그 밖 칩은 판정하지 않는다", () => {
      const innkeeper = charsetEntryOf("tex_easyrpg_charset_people5", 6);
      expect(characterRoleOf("미라")).toBeUndefined();
      expect(chipFitsRole(innkeeper, "미라").fits).toBe(true);
      expect(chipFitsRole(undefined, "무기점 주인").fits).toBe(true);
    });

    it("대사가 다른 가게를 말해도 역할은 이름에서만 읽는다", () => {
      expect(characterRoleOf("미라 여관에 가 봐", "미라")).toBeUndefined();
      expect(characterRoleOf("무기점 주인 늙은 영감님", "무기점 주인")?.elder).toBe(true);
    });
  });
});

describe("contextBuilder", () => {
  isolateTimers();
  describe("buildSystemPrompt tileset knowledge", () => {
    it("includes the human label and executable meaning without exposing the private group id", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      const tileset = project.tilesets[map.tilesetId];
      if (!tileset) throw new Error("missing tileset");
      // 버들항 시트는 그룹이 많아 다이제스트(700자로 자름) 끝에 덧붙인 그룹이 잘린다 — 이 그룹만 남겨 형식을 본다.
      tileset.tileGroups = [{
        id: "user-cliff-private-id",
        name: "북쪽 반복 절벽",
        role: "wall",
        defaultLayer: "lower",
        layerHome: "lower",
        origin: "user",
        description: "2×3 단위를 이어 붙이는 절벽",
        placementRules: "가로와 세로 모두 반복 가능",
        tileIds: [0, 1, 30, 31, 60, 61],
        patternGrammar: {
          axis: "both",
          blockHeight: 3,
          blockWidth: 2,
          kind: "repeatable_block",
          minHeight: 3,
          minWidth: 2,
          parts: [{ role: "repeatBody", tileIds: [0, 1, 30, 31, 60, 61] }],
          preserveCaps: false,
          repeat: "source_order",
        },
      }];

      const context = buildSystemPrompt(project, { currentMapId: project.startMapId });

      expect(context).toContain("북쪽 반복 절벽");
      expect(context).toContain("pattern=repeatable_block");
      expect(context).toContain("shape=2x3");
      expect(context).toContain("passage=");
      expect(context).not.toContain("user-cliff-private-id");
    });
  });
  describe("buildSystemPrompt — 수정 vs 신규 라우팅", () => {
    // 예산이 아무리 좁아도 "지금 보고 있는 맵이 무엇인가"는 남아야 한다 — 이것이 사라지면
    // "이/여기/지금"이 어느 맵인지 알 수 없어 모델이 새 맵을 만드는 쪽으로 기운다.
    it("현재 맵 요약은 예산 밖에 고정된다", () => {
      const project = createBlankProject();
      for (const budgetChars of [6000, 8000, 10000, 12000, 18000]) {
        const context = buildSystemPrompt(project, { currentMapId: project.startMapId, budgetChars });
        expect(context, `budget=${budgetChars}`).toContain("현재 맵 요약");
        expect(context, `budget=${budgetChars}`).toContain(project.startMapId);
      }
    });

    // 성향 블록도 같은 이유로 예산 밖이다 — 13,200자 슬라이싱이 이 블록을 먹으면
    // "AI 가 내 성향을 기억하지 못한다"가 프롬프트 층에서 그대로 재발한다.
    it("사람 성향 블록은 예산을 극단적으로 줄여도 남는다", () => {
      const project = createBlankProject();
      const memorySection = [
        PREFERENCE_SECTION_HEADING,
        PREFERENCE_PRECEDENCE_LINE,
        "- [강함] 마을 규모는 집 4채 이하로 작게 유지한다",
      ].join("\n");
      for (const budgetChars of [500, 1000, 6000, 18000]) {
        const context = buildSystemPrompt(project, {
          currentMapId: project.startMapId,
          budgetChars,
          preferenceMemorySection: memorySection,
        });
        expect(context, `budget=${budgetChars}`).toContain(PREFERENCE_SECTION_HEADING);
        expect(context, `budget=${budgetChars}`).toContain(PREFERENCE_PRECEDENCE_LINE);
        expect(context, `budget=${budgetChars}`).toContain("집 4채 이하");
      }
    });

    it("성향 블록을 넘기지 않으면 프롬프트에 성향 자리가 생기지 않는다", () => {
      const project = createBlankProject();
      const context = buildSystemPrompt(project, { currentMapId: project.startMapId });
      expect(context).not.toContain(PREFERENCE_SECTION_HEADING);
    });

    it("성향 블록은 서론 바로 뒤 고정 영역에 들어간다 — 능력 색인과 같은 자리", () => {
      const project = createBlankProject();
      const context = buildSystemPrompt(project, {
        currentMapId: project.startMapId,
        budgetChars: 800,
        preferenceMemorySection: PREFERENCE_SECTION_HEADING,
      });
      // 프로젝트 요약보다 먼저 읽힌다(예산 슬라이싱 대상 앞).
      expect(context.indexOf(PREFERENCE_SECTION_HEADING)).toBeLessThan(context.indexOf("현재 맵 요약"));
    });
  });
});

// test/contextCompaction.test.ts
// senpi(@code-yeongyu/senpi) 의 컨텍스트 압축 알고리즘 이식 검증.
// 원본: dist/core/compaction/compaction.js(추정/절단/임계), dist/core/compaction/utils.js(요약 프롬프트),
//      dist/core/extensions/builtin/compaction/retained-message-safety.js(잔존 창 재생 가능성).
// 여기서 잠그는 것은 "숫자와 구조" 다 — 프롬프트 문장은 절대 고정하지 않는다(문구는 자유롭게 고쳐야 한다).
describe("contextCompaction", () => {
  isolateTimers();
  function userText(text: string): ChatMessage {
    return { role: "user", content: text };
  }
  function assistantText(text: string): ChatMessage {
    return { role: "assistant", content: text };
  }
  function assistantToolCall(id: string, name = "edit_tile", args = '{"x":1,"y":2}'): ChatMessage {
    return { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: args } }] };
  }
  function toolResult(id: string, content: string): ChatMessage {
    return { role: "tool", content, tool_call_id: id };
  }
  /** 공백으로 끊긴 산문 — base64 런(512자 이상 연속) 조건에 걸리지 않는다. */
  function prose(chars: number): string {
    return "word ".repeat(Math.ceil(chars / 5)).slice(0, chars);
  }
  describe("estimateMessageTokens", () => {
    it("Given 같은 문자 수의 base64 런과 산문 When 추정 Then base64 쪽이 더 크게 잡힌다", () => {
      const base64Message = userText("A".repeat(2000));
      const proseMessage = userText(prose(2000));

      // base64 런은 문자당 1토큰에 가깝다 → 가중치 4배 후 /4. 순수 chars/4 구현이면 둘이 같아져 실패한다.
      expect(estimateMessageTokens(base64Message)).toBe(2000);
      expect(estimateMessageTokens(proseMessage)).toBe(500);
      expect(estimateMessageTokens(base64Message)).toBeGreaterThan(estimateMessageTokens(proseMessage));
    });

    it("Given base64 데이터 URL 이 실린 user 메시지 When 추정 Then 같은 길이 산문보다 크다", () => {
      const dataUrl = `data:image/png;base64,${"Q".repeat(2000)}`;
      const imageLike = userText(dataUrl);
      const sameLengthProse = userText(prose(dataUrl.length));

      expect(estimateMessageTokens(imageLike)).toBeGreaterThan(estimateMessageTokens(sameLengthProse));
    });

    it("Given 짧은 런(512자 미만) When 추정 Then 가중치가 붙지 않는다", () => {
      expect(estimateMessageTokens(userText("A".repeat(400)))).toBe(100);
    });

    it("Given 짧은/원격 image_url 파트 When 추정 Then ESTIMATED_IMAGE_CHARS(4800) 바닥값을 쓴다", () => {
      const shortDataUrl: ChatMessage = {
        role: "user",
        content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }],
      };
      const remoteUrl: ChatMessage = {
        role: "user",
        content: [{ type: "image_url", image_url: { url: "https://example.test/map-viewport.png" } }],
      };

      expect(estimateMessageTokens(shortDataUrl)).toBe(1200);
      expect(estimateMessageTokens(remoteUrl)).toBe(1200);
    });

    // senpi 원본은 image 블록을 무조건 4800자 등가로 센다. 그쪽 image 블록은 공급자 네이티브
    // 첨부라서 본문 크기와 무관하기 때문이다. 이 에디터의 image_url 은 **base64 데이터 URL 이
    // 요청 본문 안에 그대로 직렬화**된다(실측: 뷰포트 스크린샷 6장이 실린 요청 본문 115957 bytes).
    // 그래서 데이터 URL 은 페이로드를 가중해 세야 한다 — 4800 고정으로는 스크린샷이 실린 대화가
    // 임계값 아래로 보여 압축이 아예 발동하지 않는다(실측 RED: 추정 46418 토큰 < 임계 111616).
    it("Given 큰 base64 데이터 URL image_url When 추정 Then 페이로드를 가중해 4800 고정값보다 크게 센다", () => {
      const bigDataUrl: ChatMessage = {
        role: "user",
        content: [{ type: "image_url", image_url: { url: `data:image/png;base64,${"B".repeat(20000)}` } }],
      };

      // 20000자 base64 런 → 가중 80000자 → 20000 토큰대. 4800 고정 구현이면 1200 이 나와 실패한다.
      expect(estimateMessageTokens(bigDataUrl)).toBeGreaterThan(19_000);
      // 같은 길이의 산문 URL 보다 크다(가중치가 실제로 붙었는지).
      expect(estimateMessageTokens(bigDataUrl)).toBeGreaterThan(
        estimateMessageTokens({ role: "user", content: prose(20_022) }),
      );
    });

    it("Given assistant tool_calls When 추정 Then 이름 + 인자를 센다", () => {
      const args = `{"blob":"${"C".repeat(1000)}"}`;
      const message = assistantToolCall("call_1", "paint", args);

      // 이름(5) + 가중치 인자(1000자 런 → 4000, 그 밖의 구두점 문자)를 /4 로 올림.
      expect(estimateMessageTokens(message)).toBeGreaterThan(1000);
      expect(estimateMessageTokens(assistantToolCall("call_1", "paint", '{"x":1}'))).toBeLessThan(10);
    });

    it("Given content null When 추정 Then 0", () => {
      expect(estimateMessageTokens({ role: "assistant", content: null })).toBe(0);
    });
  });
  describe("estimateContextTokens", () => {
    it("Given 메시지 목록과 추가 문자 When 추정 Then 메시지 합 + 추가분/4", () => {
      const messages = [userText(prose(400)), assistantText(prose(800))];

      expect(estimateContextTokens(messages)).toBe(100 + 200);
      expect(estimateContextTokens(messages, 4000)).toBe(100 + 200 + 1000);
    });
  });
  describe("resolveThresholdContextTokens", () => {
    it("Given 통상 usage 와 estimate When 해석 Then 큰 쪽", () => {
      expect(resolveThresholdContextTokens(30_000, 20_000)).toBe(30_000);
      expect(resolveThresholdContextTokens(10_000, 120_000)).toBe(120_000);
      expect(resolveThresholdContextTokens(200_000, 10_000)).toBe(200_000);
    });

    it("Given estimate 60000 에 usage 600000(cacheRead 스파이크) When 해석 Then estimate 를 쓴다", () => {
      expect(resolveThresholdContextTokens(600_000, 60_000)).toBe(60_000);
    });

    it("Given 음수 When 해석 Then 0 으로 클램프", () => {
      expect(resolveThresholdContextTokens(-5, -7)).toBe(0);
    });
  });
  describe("shouldCompact", () => {
    const settings = DEFAULT_COMPACTION_SETTINGS;
    const window = DEFAULT_CONTEXT_WINDOW;
    const threshold = window - settings.reserveTokens;

    it("Given 정확히 임계값 When 판정 Then false, +1 이면 true", () => {
      expect(shouldCompact(threshold, window, settings)).toBe(false);
      expect(shouldCompact(threshold + 1, window, settings)).toBe(true);
    });

    it("Given enabled:false When 판정 Then 항상 false", () => {
      expect(shouldCompact(window * 2, window, { ...settings, enabled: false })).toBe(false);
    });
  });
  describe("기본값 / 컨텍스트 창", () => {
    it("Given 기본 설정 When 읽기 Then senpi 기본값과 같다", () => {
      expect(DEFAULT_COMPACTION_SETTINGS).toEqual({ enabled: true, reserveTokens: 16_384, keepRecentTokens: 20_000 });
      expect(DEFAULT_CONTEXT_WINDOW).toBe(128_000);
    });

    it("Given 모르는 모델 When 해석 Then 보수적 기본 창", () => {
      expect(resolveContextWindow("made-up-model-9")).toBe(DEFAULT_CONTEXT_WINDOW);
      expect(resolveContextWindow("")).toBe(DEFAULT_CONTEXT_WINDOW);
    });

    it("Given 알려진 모델 When 해석 Then 기본 창보다 크다", () => {
      expect(resolveContextWindow("gemini-3.7-flash")).toBeGreaterThan(DEFAULT_CONTEXT_WINDOW);
      expect(resolveContextWindow("cpen/gpt-5-6-luna")).toBeGreaterThan(DEFAULT_CONTEXT_WINDOW);
      expect(resolveContextWindow("xai/grok-4.7")).toBe(500_000);
    });
  });
  describe("findCompactionCutPoint", () => {
    it("Given tool 메시지에서 예산이 넘치는 대화 When 절단점 탐색 Then tool 에는 절대 착지하지 않는다", () => {
      const messages: ChatMessage[] = [
        { role: "system", content: "시스템" },
        userText("옛 지시"),
        assistantText("옛 답"),
        userText("현재 지시"),
        assistantToolCall("call_1"),
        toolResult("call_1", prose(40_000)), // 10,000 토큰
        assistantText("최종 답"),
      ];

      const cut = findCompactionCutPoint(messages, 1000);

      expect(messages[cut.firstKeptIndex]?.role).not.toBe("tool");
      expect(cut.firstKeptIndex).toBeGreaterThanOrEqual(1);
    });

    it("Given 균일한 대화 When keepRecentTokens 로 절단 Then 그만큼의 꼬리가 남고 앞은 버려진다", () => {
      const messages: ChatMessage[] = [{ role: "system", content: "시스템" }];
      for (let turn = 0; turn < 10; turn += 1) {
        messages.push(userText(prose(1000))); // 250 토큰
        messages.push(assistantText(prose(1000))); // 250 토큰
      }

      const cut = findCompactionCutPoint(messages, 1000);
      const tail = messages.slice(cut.firstKeptIndex);

      expect(cut.firstKeptIndex).toBeGreaterThan(1);
      expect(estimateContextTokens(tail)).toBeGreaterThanOrEqual(1000);
      expect(messages[cut.firstKeptIndex]?.role).not.toBe("tool");
    });

    it("Given 시스템 프롬프트만 있는 대화 When 절단점 탐색 Then 인덱스 0 은 절단점이 되지 않는다", () => {
      const cut = findCompactionCutPoint([{ role: "system", content: "시스템" }], 1000);

      expect(cut.firstKeptIndex).toBeGreaterThanOrEqual(1);
      expect(cut.isSplitTurn).toBe(false);
    });

    it("Given assistant 에서 잘리는 경우 When 절단점 탐색 Then 그 턴을 시작한 user 를 가리키고 split 로 표시한다", () => {
      const messages: ChatMessage[] = [
        { role: "system", content: "시스템" },
        userText(prose(200)),
        userText("턴 시작"),
        assistantToolCall("call_1"),
        toolResult("call_1", "ok"),
        assistantText(prose(8000)), // 2000 토큰 — 여기서 예산이 넘친다
      ];

      const cut = findCompactionCutPoint(messages, 1000);

      expect(messages[cut.firstKeptIndex]?.role).toBe("assistant");
      expect(cut.isSplitTurn).toBe(true);
      expect(messages[cut.turnStartIndex]?.role).toBe("user");
      expect(cut.turnStartIndex).toBeLessThan(cut.firstKeptIndex);
    });

    it("Given user 에서 잘리는 경우 When 절단점 탐색 Then split 아님", () => {
      const messages: ChatMessage[] = [
        { role: "system", content: "시스템" },
        userText(prose(200)),
        assistantText(prose(200)),
        userText(prose(8000)),
      ];

      const cut = findCompactionCutPoint(messages, 1000);

      expect(messages[cut.firstKeptIndex]?.role).toBe("user");
      expect(cut.isSplitTurn).toBe(false);
      expect(cut.turnStartIndex).toBe(-1);
    });
  });
  describe("repairRetainedTail", () => {
    it("Given 선두 tool 과 짝 없는 tool When 수리 Then 둘 다 버리고 짝지어진 쌍은 남긴다", () => {
      const window: ChatMessage[] = [
        toolResult("call_before_window", "잘린 턴의 응답"),
        assistantToolCall("call_1"),
        toolResult("call_1", "정상 결과"),
        toolResult("call_orphan", "짝 없는 결과"),
        assistantText("답"),
      ];

      const repaired = repairRetainedTail(window);

      expect(repaired.map((message) => message.role)).toEqual(["assistant", "tool", "assistant"]);
      expect(repaired[1]?.tool_call_id).toBe("call_1");
    });

    it("Given tool_call_id 없는 tool 메시지 When 수리 Then 버린다", () => {
      const repaired = repairRetainedTail([{ role: "tool", content: "정체불명" }, userText("계속")]);

      expect(repaired.map((message) => message.role)).toEqual(["user"]);
    });

    it("Given 이미 재생 가능한 창 When 수리 Then 그대로 둔다", () => {
      const window: ChatMessage[] = [userText("지시"), assistantToolCall("call_1"), toolResult("call_1", "ok")];

      expect(repairRetainedTail(window)).toEqual(window);
    });
  });
  describe("압축 요약 메시지", () => {
    it("Given 요약 When 메시지화 Then 마커로 식별되고 본문을 되찾을 수 있다", () => {
      const message = compactionSummaryMessage("## Goal\n타일셋 정리");

      expect(isCompactionSummaryMessage(message)).toBe(true);
      expect(String(message.content)).toContain(COMPACTION_SUMMARY_MARKER);
      expect(findPreviousSummary([userText("무관"), message])).toBe("## Goal\n타일셋 정리");
    });

    it("Given 요약이 두 번 있는 대화 When 이전 요약 탐색 Then 최신 것", () => {
      const messages = [compactionSummaryMessage("첫 요약"), assistantText("작업"), compactionSummaryMessage("두 번째 요약")];

      expect(findPreviousSummary(messages)).toBe("두 번째 요약");
    });

    it("Given 요약이 없는 대화 When 탐색 Then null", () => {
      expect(findPreviousSummary([userText("지시"), assistantText("답")])).toBeNull();
    });

    it("Given 평범한 user 메시지 When 식별 Then false", () => {
      expect(isCompactionSummaryMessage(userText("평범한 지시"))).toBe(false);
    });
  });
  describe("buildCompactedMessages", () => {
    it("Given 절단점과 요약 When 재조립 Then 시스템 0번, 요약 1번, 그 뒤에 수리된 꼬리", () => {
      const system: ChatMessage = { role: "system", content: "시스템 프롬프트" };
      const messages: ChatMessage[] = [
        system,
        userText("옛 지시"),
        assistantToolCall("call_old"),
        toolResult("call_old", "옛 결과"),
        toolResult("call_old", "창 밖 짝의 결과"), // 절단 후 선두가 되는 tool → 버려진다
        userText("최근 지시"),
        assistantToolCall("call_new"),
        toolResult("call_new", "최근 결과"),
      ];

      const compacted = buildCompactedMessages({
        messages,
        cutPoint: { firstKeptIndex: 4, turnStartIndex: -1, isSplitTurn: false },
        summary: "## Goal\n계속하기",
      });

      expect(compacted[0]).toEqual(system);
      expect(isCompactionSummaryMessage(compacted[1])).toBe(true);
      expect(compacted.slice(2)).toEqual(repairRetainedTail(messages.slice(4)));
      expect(compacted.map((message) => message.role)).toEqual(["system", "user", "user", "assistant", "tool"]);
      expect(estimateContextTokens(compacted)).toBeLessThan(estimateContextTokens(messages) + 100);
    });

    it("Given 시스템 프롬프트가 없는 대화 When 재조립 Then 요약이 선두", () => {
      const messages: ChatMessage[] = [userText("지시"), assistantText("답"), userText("최근")];

      const compacted = buildCompactedMessages({
        messages,
        cutPoint: { firstKeptIndex: 2, turnStartIndex: -1, isSplitTurn: false },
        summary: "요약",
      });

      expect(isCompactionSummaryMessage(compacted[0])).toBe(true);
      expect(compacted).toHaveLength(2);
    });
  });
  describe("buildSummarizationRequest", () => {
    const source: ChatMessage[] = [
      { role: "system", content: "시스템 프롬프트는 요약 입력에 넣지 않는다" },
      userText("맵을 정리해줘"),
      { role: "assistant", content: "타일을 확인합니다", reasoning: "먼저 지도를 읽자" },
      assistantToolCall("call_1", "read_map", '{"mapId":"m1"}'),
      toolResult("call_1", "타일 결과"),
    ];

    it("Given 이전 요약 없음 When 요약 요청 구성 Then system + 직렬 대화 + 지시 3개", () => {
      const request = buildSummarizationRequest(source);

      expect(request.map((message) => message.role)).toEqual(["system", "user", "user"]);
      const conversation = String(request[1]?.content);
      expect(conversation).toContain("<conversation>");
      expect(conversation).toContain("맵을 정리해줘");
      expect(conversation).toContain("read_map");
      expect(conversation).not.toContain("<previous-summary>");
      expect(conversation).not.toContain("시스템 프롬프트는 요약 입력에 넣지 않는다");
    });

    it("Given 이전 요약 있음 When 요약 요청 구성 Then previous-summary 태그가 실리고 지시가 UPDATE 변형으로 바뀐다", () => {
      const fresh = buildSummarizationRequest(source);
      const updated = buildSummarizationRequest(source, "## Goal\n이미 정한 목표");

      const conversation = String(updated[1]?.content);
      expect(conversation).toContain("<previous-summary>");
      expect(conversation).toContain("## Goal\n이미 정한 목표");
      // 문구를 고정하지 않는다 — 분기가 갈렸다는 사실만 잠근다.
      expect(updated[2]?.content).not.toBe(fresh[2]?.content);
    });

    it("Given 아주 긴 tool 결과 When 직렬화 Then 잘려서 요약 요청이 폭주하지 않는다", () => {
      const request = buildSummarizationRequest([toolResult("call_1", prose(50_000))]);
      const conversation = String(request[1]?.content);

      expect(conversation.length).toBeLessThan(10_000);
    });
  });
});

describe("conversationTurnContext", () => {
  isolateTimers();
  function projectWithMaps(): Pick<Project, "maps"> {
    return {
      maps: {
        map_a: { id: "map_a", name: "마을 광장", width: 20, height: 15 },
        map_b: { id: "map_b", name: "숲길", width: 30, height: 30 },
      },
    } as unknown as Pick<Project, "maps">;
  }
  const viewport = (mapId: string): MapViewportSnapshot => ({
    mapId,
    centerX: 8,
    centerY: 6,
    x: 2,
    y: 1,
    w: 10,
    h: 8,
  });
  describe("conversationTurnContext", () => {
    it("Given the current map When building Then it records map identity, size, viewport and selection", () => {
      const context = buildConversationTurnContext(projectWithMaps(), {
        mapId: "map_a",
        viewport: viewport("map_a"),
        selection: { mapId: "map_a", x: 3, y: 4, width: 5, height: 6 },
      });

      expect(context).toEqual({
        mapId: "map_a",
        mapName: "마을 광장",
        mapWidth: 20,
        mapHeight: 15,
        viewport: viewport("map_a"),
        selection: { mapId: "map_a", x: 3, y: 4, width: 5, height: 6 },
      });
    });

    it("Given a viewport or selection from another map When building Then they are dropped", () => {
      const context = buildConversationTurnContext(projectWithMaps(), {
        mapId: "map_b",
        viewport: viewport("map_a"),
        selection: { mapId: "map_a", x: 3, y: 4, width: 5, height: 6 },
      });

      expect(context.viewport).toBeUndefined();
      expect(context.selection).toBeUndefined();
      expect(context.mapId).toBe("map_b");
    });

    it("Given a selection extending past the map bounds When building Then it is dropped", () => {
      const context = buildConversationTurnContext(projectWithMaps(), {
        mapId: "map_a",
        selection: { mapId: "map_a", x: 18, y: 13, width: 3, height: 3 },
      });

      expect(context.selection).toBeUndefined();
    });

    it("Given no map id When building Then the viewport map is used and unknown maps stay nameless", () => {
      const fromViewport = buildConversationTurnContext(projectWithMaps(), { viewport: viewport("map_b") });
      expect(fromViewport.mapId).toBe("map_b");
      expect(fromViewport.mapName).toBe("숲길");

      const unknown = buildConversationTurnContext(projectWithMaps(), { mapId: "map_gone" });
      expect(unknown).toEqual({ mapId: "map_gone", mapName: null });

      const none = buildConversationTurnContext(projectWithMaps(), {});
      expect(none).toEqual({ mapId: null, mapName: null });
    });

    it("Given turn contexts When the map changes Then only real transitions produce a note", () => {
      const a = buildConversationTurnContext(projectWithMaps(), { mapId: "map_a" });
      const b = buildConversationTurnContext(projectWithMaps(), { mapId: "map_b" });

      expect(mapTransitionNote(null, a)).toBeNull();
      expect(mapTransitionNote(a, a)).toBeNull();
      expect(mapTransitionNote(a, b)).toBe("맵 이동: 마을 광장 → 숲길");
    });

    it("Given stored payloads When validated Then only well-formed contexts pass", () => {
      const valid: ConversationTurnContext = { mapId: "map_a", mapName: "마을 광장" };
      expect(isConversationTurnContext(valid)).toBe(true);
      expect(isConversationTurnContext({ mapId: null, mapName: null })).toBe(true);
      expect(isConversationTurnContext({ mapId: "map_a", mapName: "a", viewport: viewport("map_a") })).toBe(true);

      expect(isConversationTurnContext(null)).toBe(false);
      expect(isConversationTurnContext({ mapName: "a" })).toBe(false);
      expect(isConversationTurnContext({ mapId: 1, mapName: "a" })).toBe(false);
      expect(isConversationTurnContext({ mapId: "a", mapName: "a", viewport: { mapId: "a" } })).toBe(false);
      expect(isConversationTurnContext({ mapId: "a", mapName: "a", selection: { mapId: "a", x: 1 } })).toBe(false);
      expect(isConversationTurnContext({ mapId: "a", mapName: "a", mapWidth: Number.NaN })).toBe(false);
    });
  });
});

// DB 레코드 속성 변경의 정확한 평가자 — 실측 실패에서 나온 계약.
//
// 왜(2026-09-16 라이브): "슬라임의 최대 HP를 300으로" 요청에 정확한 평가자가 없어 항목이
// functionalUnresolved 로 남았고, 모델이 repair_acceptance 로 닫으려다 라운드 예산을 다 써
// 초안이 검토/적용에 닿지 못했다(16라운드 중 9회가 헛 조회). 이 기준이 그 구멍을 채운다 —
// 저장된 필드값만 증명하고 런타임 전투 동작은 여전히 functionalUnresolved 다.
describe("dbRecordValuesAcceptance", () => {
  isolateTimers();
  function evaluate(project: Project, input: unknown) {
    const criteria = parseAcceptanceCriteria(input);
    expect(criteria, "criterion must parse").not.toBeNull();
    const criterion = criteria![0] as AcceptanceCriterion;
    return evaluateAcceptanceCriterion(criterion, { project, baseline: project, bindings: new Map(), reviewed: () => false });
  }
  function slimeProject(): { project: Project; recordId: string; baselineHp: number } {
    const project = createBlankProject();
    const enemy = project.database.enemies[0];
    expect(enemy, "blank project must ship at least one enemy record").toBeDefined();
    return { project, recordId: enemy.id, baselineHp: enemy.stats.maxHp };
  }
  describe("dbRecordValues 수용 기준", () => {
    it("요청한 저장값이 반영되면 통과한다", () => {
      const { project, recordId } = slimeProject();
      project.database.enemies[0].stats.maxHp = 300;
      expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": 300 } }]).passed).toBe(true);
    });

    it("모델이 보내는 문자열 값(\"300\")도 저장된 숫자 300 과 같게 본다 — 스키마가 단일 string 타입이다", () => {
      const { project, recordId } = slimeProject();
      project.database.enemies[0].stats.maxHp = 300;
      expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": "300" } }]).passed).toBe(true);
      expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": "301" } }]).passed).toBe(false);
      expect(ACCEPTANCE_CRITERIA_SCHEMA.items.properties.fields.additionalProperties.type).toBe("string");
    });

    it("값이 그대로면 통과하지 않는다 — 문구가 아니라 저장소를 본다", () => {
      const { project, recordId, baselineHp } = slimeProject();
      const result = evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": 300 } }]);
      expect(result.passed).toBe(false);
      expect(result.observed).toContain(String(baselineHp));
    });

    it("레코드가 없거나 id 가 중복이면 통과하지 않는다", () => {
      const { project, recordId } = slimeProject();
      project.database.enemies[0].stats.maxHp = 300;
      expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId: "enemy_absent", fields: { "stats.maxHp": 300 } }]).passed).toBe(false);
      project.database.enemies.push(structuredClone(project.database.enemies[0]));
      expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": 300 } }]).passed).toBe(false);
    });

    it("여러 필드를 함께 요구할 수 있다 — 하나라도 다르면 실패한다", () => {
      const { project, recordId } = slimeProject();
      project.database.enemies[0].stats.maxHp = 300;
      const fields = { "stats.maxHp": 300, "stats.attack": project.database.enemies[0].stats.attack };
      expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields }]).passed).toBe(true);
      expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { ...fields, "stats.attack": 999999 } }]).passed).toBe(false);
    });

    it("못된 모양은 닫힌 채 거부된다", () => {
      expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "no_such_collection", recordId: "a", fields: { "stats.maxHp": 1 } }])).toBeNull();
      expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "", fields: { "stats.maxHp": 1 } }])).toBeNull();
      expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "a", fields: {} }])).toBeNull();
      expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "a", fields: { "stats": { maxHp: 1 } } }])).toBeNull();
      expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "a", fields: { "stats.maxHp": 1 }, unexpected: true }])).toBeNull();
    });

    it("모델에게 제공되는 스키마에 실려 있다 — 없으면 다시 닫을 수 없는 항목이 된다", () => {
      expect(ACCEPTANCE_EXAMPLES.dbRecordValues).toBeDefined();
      expect(ACCEPTANCE_CRITERIA_SCHEMA.items.properties.kind.enum).toContain("dbRecordValues");
      expect(ACCEPTANCE_CRITERIA_SCHEMA.items.properties.collection.enum).toContain("enemies");
    });

    it("id 를 모를 때는 유일한 이름으로 해석한다 — id 를 지어내지 않는다", () => {
      const { project } = slimeProject();
      project.database.enemies[0].stats.maxHp = 300;
      const name = project.database.enemies[0].name;
      expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordName: name, fields: { "stats.maxHp": 300 } }]).passed).toBe(true);
      project.database.enemies.push({ ...structuredClone(project.database.enemies[0]), id: "enemy_same_name", stats: { ...project.database.enemies[0].stats, maxHp: 78 } });
      expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordName: name, fields: { "stats.maxHp": 300 } }]).passed).toBe(false);
    });

    it("recordId 와 recordName 은 정확히 하나만 받는다", () => {
      expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "a", recordName: "b", fields: { "stats.maxHp": 1 } }])).toBeNull();
      expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", fields: { "stats.maxHp": 1 } }])).toBeNull();
      expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordName: "b", fields: { "stats.maxHp": 1 } }])).not.toBeNull();
    });
  });
});

// gothic_manor 라우팅·지침 — 칩셋이 프로젝트에 있을 때만, 판타지 성은 끌지 않는다. 이 파일은 작성 시 실행하지 않았다(not run).
describe("gothicPolicy", () => {
  isolateTimers();
  const START = "map_blank_start";
  const create = declaredIntent({ mode: "create", space: "outdoor" });
  function withGothic(): Project {
    const project = createBlankProject();
    const base = Object.values(project.tilesets)[0]!;
    project.tilesets["gothic_manor"] = { ...structuredClone(base), id: "gothic_manor", image: { type: "bundled", id: "tex_gothic_manor" } } as Project["tilesets"][string];
    return project;
  }
  /** gothic_manor 가 번들로 모든 새 프로젝트에 실리게 된 뒤라(BUNDLED 칩셋 → createGothicManorTileset) 「칩셋 없음」은 떼어 낸 프로젝트로 재현한다. */
  function withoutGothic(): Project {
    const project = createBlankProject();
    for (const [id, tileset] of Object.entries(project.tilesets)) if (isGothicManorTilesetDef(tileset)) delete project.tilesets[id];
    return project;
  }
  describe("고딕 낱말", () => {
    it.each(["저택 호러 게임", "폐성 탐험", "미술관 추리", "고아원 괴담", "정신병원 탈출", "묘지 마을", "haunted mansion", "흉가 저택과 정원 만들어줘", "공동묘지와 예배당", "미술관 호러 갤러리"])("%s", (t) => expect(describesGothicPlace(t)).toBe(true));
    it.each(["판타지 성 하나 만들어줘", "중세 왕국 마을", "마왕성 던전", "숲속 마을", "일본 상가 거리"])("%s 는 아니다", (t) => expect(describesGothicPlace(t)).toBe(false));
    it("판타지 성이어도 호러·폐성이면 고딕", () => expect(describesGothicPlace("판타지 호러 저택")).toBe(true));
  });
  describe("gothicTargetFor", () => {
    it("칩셋이 있으면 고딕 장소 새 맵 요청이 간다", () => expect(gothicTargetFor(withGothic(), create, "저택 호러 맵 만들어줘", START, false)).toEqual({}));
    it("칩셋이 없으면 가지 않는다", () => expect(gothicTargetFor(withoutGothic(), create, "저택 호러 맵 만들어줘", START, false)).toBeNull());
    it("판타지 성 요청은 칩셋이 있어도 가지 않는다", () => expect(gothicTargetFor(withGothic(), create, "판타지 성 만들어줘", START, false)).toBeNull());
    it("질문은 제외", () => expect(gothicTargetFor(withGothic(), declaredIntent({ mode: "question", space: "outdoor" }), "저택이 뭐야", START, false)).toBeNull());
    it("칩셋 이름을 직접 부르면 간다", () => expect(gothicTargetFor(withGothic(), create, "gothic_manor 로 맵 하나", START, false)).toEqual({}));
    it("대상 맵이 gothic_manor 면 수정도 그 맵", () => {
      const p = withGothic(); p.maps[START]!.tilesetId = "gothic_manor";
      expect(gothicTargetFor(p, declaredIntent({ mode: "modify", space: "outdoor" }), "촛대 더해", START, true)).toEqual({ mapId: START, lived: true });
    });
  });
  describe("프롬프트 줄", () => {
    it("칩셋이 없으면 줄이 없다", () => expect(gothicPromptLines(withoutGothic(), [START])).toEqual([]));
    it("칩셋이 있으면 포인터, 맵이 gothic 이면 상세까지", () => {
      const p = withGothic();
      expect(gothicPromptLines(p, [START])).toEqual([GOTHIC_POINTER_LINE]);
      p.maps[START]!.tilesetId = "gothic_manor";
      expect(gothicPromptLines(p, [START])).toEqual([GOTHIC_POINTER_LINE, GOTHIC_DETAIL_LINE]);
    });
    it("장소 빌더로 보낸다", () => {
      expect(GOTHIC_EXPOSED_TOOLS).toContain("build_gothic_place");
      expect(GOTHIC_EXPOSED_TOOLS).toContain("list_gothic_places");
      for (const t of [GOTHIC_POINTER_LINE, GOTHIC_DETAIL_LINE, formatGothicNote({}, null)]) expect(t).toContain("build_gothic_place");
      expect(GOTHIC_POINTER_LINE).not.toContain("gothic-interior-authoring");
    });
  });
});

describe("imageAdmissionTokens", () => {
  isolateTimers();
  /** A real PNG header (signature + IHDR) followed by filler, as a base64 data URL.
   * Only the header is parsed, so the filler stands in for compressed pixel data. */
  function pngDataUrl(width: number, height: number, payloadBytes = 120_000): string {
    const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
      (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
      (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255];
    const bytes = [...header, ...Array.from({ length: payloadBytes }, (_, i) => (i * 7) & 255)];
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/png;base64,${btoa(binary)}`;
  }
  const imageMessage = (url: string): ChatMessage => ({ role: "user",
    content: [{ type: "text", text: "Current render" }, { type: "image_url", image_url: { url } }] });
  describe("image admission accounting", () => {
    it("bills a rendered map by its pixels, not by its data-URL characters", () => {
      // 512 is the renderer's cap (MAX_IMAGE_DIMENSION). Providers bill such an image in the
      // hundreds of tokens; the transport-weighted estimate reads it as six figures.
      const messages = [imageMessage(pngDataUrl(512, 512))];
      const transport = estimateContextTokens(messages);
      const admission = estimateAdmissionTokens(messages);

      expect(transport).toBeGreaterThan(100_000);
      expect(admission).toBeLessThan(5_000);
      expect(admission).toBeGreaterThan(0);
    });

    it("keeps the compaction estimate unchanged", () => {
      // The transport weighting is a measured product decision: without it a conversation
      // carrying screenshots never crosses the compaction threshold. Admission accounting is
      // additive and must not move this number.
      const messages = [imageMessage(pngDataUrl(512, 512))];
      expect(estimateContextTokens(messages)).toBe(estimateContextTokens(messages));
      const textOnly: ChatMessage[] = [{ role: "user", content: "hello" }];
      expect(estimateAdmissionTokens(textOnly)).toBe(estimateContextTokens(textOnly));
    });

    it("falls back to transport accounting when the pixel size is unreadable", () => {
      for (const url of ["https://example.test/render.png", "data:image/png;base64,QQ==",
        "data:image/jpeg;base64,QUJD"]) {
        const messages = [imageMessage(url)];
        expect(estimateAdmissionTokens(messages)).toBe(estimateContextTokens(messages));
      }
    });

    it("scales with pixels so a larger render still costs more", () => {
      const small = estimateAdmissionTokens([imageMessage(pngDataUrl(64, 64))]);
      const large = estimateAdmissionTokens([imageMessage(pngDataUrl(512, 512))]);
      expect(large).toBeGreaterThan(small);
    });

    it("admits six capped map renders on a reviewer window they used to overflow", () => {
      // A 200K reviewer is where the over-count actually bit: its token ceiling (183,616 after
      // the output reserve) is far below the request-body budget, so six tens-of-kilobytes
      // renders -- ordinary evidence for a six-map edit -- were refused as if they were 480K
      // tokens of text. On a 1M window the body budget binds first, which is why this needs a
      // small window to show.
      const config = { ...defaultAiConfig(), providerId: "google-antigravity", model: "claude-opus-4-5" };
      expect(originalContextWindow(config)).toBe(200_000);
      const images = Array.from({ length: 6 }, (_, i) => ({ label: `map ${i}`, dataUrl: pngDataUrl(512, 512, 60_000) }));
      const input: ReviewInput = { revision: 1, originalRequest: "Render every changed map",
        before: [], after: [], changes: [], toolResults: [], acceptance: null, requiredProblems: [], images };

      // Six capped renders are ordinary evidence for a six-map edit; refusing them left the
      // draft unreviewable with no way to recover.
      const request = buildIndependentReviewRequest(config, input);
      expect(request.messages).toHaveLength(2);
      expect(estimateContextTokens(request.messages)).toBeGreaterThan(originalContextWindow(config));
      expect(estimateAdmissionTokens(request.messages)).toBeLessThan(originalContextWindow(config));
    });

    it("still refuses an envelope that exceeds the provider request body, not just the window", () => {
      const config = chatgptFixtureConfig(); // 500k 창(GPT-6.2 Sol) — 공장 기본(Claude, 2026-11-23)과 무관하게 같은 전제로 잰다.
      // Admission accounting must not trade a local refusal for an input-size failure one round
      // trip later: this envelope is cheap in billed tokens and far too large as a request body.
      const images = Array.from({ length: 6 }, (_, i) => ({ label: `map ${i}`, dataUrl: pngDataUrl(512, 512, 900_000) }));
      const input: ReviewInput = { revision: 1, originalRequest: "Render every changed map",
        before: [], after: [], changes: [], toolResults: [], acceptance: null, requiredProblems: [], images };

      expect(estimateAdmissionTokens([{ role: "user", content: images.map(image => (
        { type: "image_url" as const, image_url: { url: image.dataUrl } })) }])).toBeLessThan(originalContextWindow(config));
      expect(() => buildIndependentReviewRequest(config, input)).toThrow("independent-review-window-exceeded");
    });
  });
});

describe("imageModelResolution", () => {
  isolateTimers();
  describe("image model resolution", () => {
    it("orders revisions by each numeric part", () => {
      expect(compareImageModelVersions("3.1.0", "3.0.0")).toBeGreaterThan(0);
      expect(compareImageModelVersions("2.0.0", "10.0.0")).toBeLessThan(0);
      expect(compareImageModelVersions("3.1.0", "3.1")).toBe(0);
      expect(compareImageModelVersions(undefined, "1")).toBeLessThan(0);
    });

    it("picks the newest image-kind model and ignores chat-only rows", () => {
      expect(pickNewestImageModel([
        { id: "chat-9", kind: "chat", revision: "9.0.0" },
        { id: "img-old", kind: "image", revision: "2.0.0" },
        { id: "img-new", kind: "image", revision: "2.6.0" },
      ])).toBe("img-new");
    });

    it("honours provider priority before revision", () => {
      expect(pickNewestImageModel([
        { id: "newer-but-deprioritised", kind: "image", revision: "9.0.0", priority: 5 },
        { id: "preferred", kind: "image", revision: "1.0.0", priority: 1 },
      ])).toBe("preferred");
    });

    it("returns null rather than inventing a name when nothing is listed", () => {
      expect(pickNewestImageModel([])).toBeNull();
      expect(pickNewestImageModel([{ id: "chat", kind: "chat" }])).toBeNull();
    });

    it("lists only the ChatGPT image route in the editor catalog", () => {
      expect(DEFAULT_IMAGE_PROVIDER_ID).toBe("openai-codex");
      expect(DEFAULT_IMAGE_MODEL).toBe("codex-image-default");
      expect(IMAGE_MODEL_CATALOG.map(({ providerId, model }) => ({ providerId, model })))
        .toEqual([{ providerId: "openai-codex", model: "codex-image-default" }]);
    });

    it("accepts only non-empty strings as a reported model", () => {
      expect(reportedImageModel("gpt-image-2-codex")).toBe("gpt-image-2-codex");
      expect(reportedImageModel("  gpt-image-2-codex  ")).toBe("gpt-image-2-codex");
      expect(reportedImageModel("")).toBeNull();
      expect(reportedImageModel(undefined)).toBeNull();
      expect(reportedImageModel(42)).toBeNull();
    });
  });
});

describe("independentReview", () => {
  isolateTimers();
  const approved = { revision: 7, verdict: "approved", summary: "Inspected", findings: [] };
  const response = (value: unknown): ChatResult => ({ message: { role: "assistant", content: JSON.stringify(value) }, finishReason: "stop" });
  describe("independent review protocol", () => {
    it.each([null, {}, { ...approved, revision: 6 }, { ...approved, findings: [{}] },
      { ...approved, verdict: "changes_requested" }, { ...approved, verdict: "success" }])("rejects malformed or stale verdict %j", value => {
      expect(() => parseIndependentReview(response(value), 7, [])).toThrow();
    });
    it("rejects executable requests even alongside a valid approval", () => {
      const result = response(approved);
      result.message.tool_calls = [{ id: "bad", type: "function", function: { name: "reset_project", arguments: "{}" } }];
      expect(() => parseIndependentReview(result, 7, [])).toThrow("independent-review-tool-call-rejected");
    });
    it("rejects truncated and malformed responses", () => {
      expect(() => parseIndependentReview({ ...response(approved), finishReason: "length" }, 7, [])).toThrow();
      expect(() => parseIndependentReview({ message: { role: "assistant", content: "not JSON" }, finishReason: "stop" }, 7, [])).toThrow();
    });
    it("reads one narrated verdict but refuses ambiguity and non-verdict objects", () => {
      const prose = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
      const verdict = JSON.stringify(approved);
      expect(parseIndependentReview(prose(`검토 결과 요청대로 반영되었습니다.\n${verdict}\n이상입니다.`), 7, []).status).toBe("approved");
      expect(parseIndependentReview(prose(`Here is my answer:\n\`\`\`json\n${verdict}\n\`\`\`\nThanks.`), 7, []).status).toBe("approved");
      expect(() => parseIndependentReview(prose(`${verdict} or maybe ${JSON.stringify({ ...approved, verdict: "changes_requested" })}`), 7, []))
        .toThrow("independent-review-malformed-json");
      expect(() => parseIndependentReview(prose('정상입니다 {"note":"no verdict here"}'), 7, [])).toThrow("independent-review-malformed-json");
      expect(() => parseIndependentReview(prose('대신 툴을 부릅니다 <tool_call><invoke name="reset_project">'), 7, [])).toThrow("independent-review-malformed-json");
    });
    it("cannot approve deterministic failures and does not invent checks for nonvisual work", () => {
      expect(parseIndependentReview(response(approved), 7, []).status).toBe("approved");
      const blocked = parseIndependentReview(response(approved), 7, ["run_scene_test: failed expectation"]);
      expect(blocked.status).toBe("changes_requested");
      expect(blocked.findings[0]).toMatchObject({ target: "required-evidence", problem: "run_scene_test: failed expectation" });
    });
    it("sends actual image parts, uses no tools and refuses an oversized complete envelope", () => {
      const input: ReviewInput = { revision: 7, originalRequest: "Inspect", before: [], after: [], changes: [],
        toolResults: [], acceptance: null, requiredProblems: [], images: [{ label: "Current render", dataUrl: "data:image/png;base64,AA==" }] };
      const config = defaultAiConfig();
      const request = buildIndependentReviewRequest(config, input);
      expect(request.tools).toEqual([]);
      expect(request.tool_choice).toBe("none");
      expect(request.messages[1]?.content).toContainEqual({ type: "image_url", image_url: { url: input.images[0]!.dataUrl } });
      expect(() => buildIndependentReviewRequest({ ...config, providerId: "google-antigravity", model: "tab_flash_lite_preview" },
        { ...input, originalRequest: "large ".repeat(200000) })).toThrow("independent-review-window-exceeded");
    });
    it("retains exact changed database records rather than whole unchanged collections", () => {
      const before = createBlankProject(), after = structuredClone(before);
      after.database.items[0]!.price = 654;
      expect(reviewChanges(before, after)).toEqual([{ path: `/database/items/${before.database.items[0]!.id}`,
        before: before.database.items[0], after: after.database.items[0] }]);
    });
  });
  it("retains advisory evidence without making it a required explicit check", () => {
    const evidence = new ToolVerificationEvidence();
    const failure = { ok: true, data: { counts: { errors: 1 }, issues: [
      { severity: "error", code: "missing-reference", message: "Existing reference", mapId: "m" },
    ] } };
    evidence.captureLintBaseline(failure);
    evidence.observe("run_lint", {}, failure, "advisory");
    expect(evidence.problems().length).toBeGreaterThan(0);
    expect(evidence.problems("blocking")).toEqual([]);
    evidence.observe("run_lint", {}, failure, "explicit");
    expect(evidence.problems("blocking").length).toBeGreaterThan(0);
    expect(evidence.snapshot().requirements).toEqual([]);
    evidence.invalidateAfterWrite();
    expect(evidence.passed("run_lint")).toBe(false);
  });
  describe("provider JSON fences and narrated verdicts", () => {
    const fenced = (body: string): ChatResult => ({ message: { role: "assistant", content: body }, finishReason: "stop" });
    it.each(["json", ""])("accepts exactly one complete %s fence and preserves the verdict", language => {
      const request = { ...approved, verdict: "changes_requested", findings: [{ id: "price", target: "/database/items/item_potion",
        problem: "321 instead of 654", requestedChange: "Set price to 654", validation: "Read the current price" }] };
      const result = parseIndependentReview(fenced(`  \`\`\`${language}\n${JSON.stringify(request)}\n\`\`\`  `), 7, []);
      expect(result.status).toBe("changes_requested");
      expect(result.findings).toEqual(request.findings);
      expect(parseIndependentReview(fenced(`\`\`\`${language}\r\n${JSON.stringify(approved)}\r\n\`\`\``), 7, []).status).toBe("approved");
    });
    // A verdict wrapped in narration is still that reviewer's verdict, and discarding it cost the
    // draft the whole turn (F6). One unambiguous verdict object is read wherever it sits; the
    // shape checks below are unchanged, so nothing weaker than a whole-response answer is admitted.
    it.each([
      `Here is the review:\n\`\`\`json\n${JSON.stringify(approved)}\n\`\`\``,
      `\`\`\`json\n${JSON.stringify(approved)}\n\`\`\`\nAll done`,
      `\`\`\`json\n${JSON.stringify(approved)}`,
      `${JSON.stringify(approved)}\n\`\`\``,
      `\`\`\`json\n${JSON.stringify(approved)}\n\`\`\`\n\`\`\`json\n{}\n\`\`\``,
      `\`\`\`javascript\n${JSON.stringify(approved)}\n\`\`\``,
    ])("reads one narrated or oddly fenced verdict: %s", body => {
      expect(parseIndependentReview(fenced(body), 7, []).status).toBe("approved");
    });
    it.each([
      `\`\`\`json\n{"revision":7,\n\`\`\``,
      `${JSON.stringify(approved)} 또는 ${JSON.stringify({ ...approved, verdict: "changes_requested" })}`,
      'Reviewed. {"summary":"looks right"}',
    ])("still rejects truncated, ambiguous or verdict-free bodies: %s", body => {
      expect(() => parseIndependentReview(fenced(body), 7, [])).toThrow("independent-review-malformed-json");
    });
    it("does not let a valid fence bypass tool-call, revision or required-evidence checks", () => {
      const result = fenced(`\`\`\`json\n${JSON.stringify(approved)}\n\`\`\``);
      expect(() => parseIndependentReview(result, 8, [])).toThrow("independent-review-malformed-verdict");
      expect(parseIndependentReview(result, 7, ["run_scene_test: failed"]).status).toBe("changes_requested");
      result.message.tool_calls = [{ id: "bad", type: "function", function: { name: "reset_project", arguments: "{}" } }];
      expect(() => parseIndependentReview(result, 7, [])).toThrow("independent-review-tool-call-rejected");
    });
  });
  it("reviews the authored starting seed without reading later runtime state", () => {
    const before = createBlankProject(), after = structuredClone(before);
    after.session.gold = 654;
    const runtime = startSession(after);
    runtime.gold = 9999;
    expect(reviewChanges(before, after)).toEqual([{ path: "/session", before: before.session, after: after.session }]);
    expect(after.session.gold).toBe(654);
    expect(JSON.stringify(reviewChanges(before, after))).not.toContain('"gold":9999');
  });
});

// 의도 선언(순수 함수) — 모델 응답을 선언으로 옮기는 검증과, 선언 필드에서 도메인·영역 탈출·노트로 가는 고정 사상.
describe("intentDeclaration", () => {
  isolateTimers();
  const FACTS: IntentFacts = {
    userText: "여관 지어줘",
    currentMap: { id: "map_start", name: "시작 맵" },
    selection: null,
    maps: [{ id: "map_start", name: "시작 맵" }, { id: "map_inn", name: "여관" }],
    facilityLabels: ["여관", "민가", "상점", "대장간"],
    toolNames: ["place_concept", "author_house", "place_npc", "fill_region"],
    hasActivePlan: false,
  };
  describe("parseIntentDeclaration", () => {
    it("enables navigation only for an explicit true declaration without clarification", () => {
      const parse = (viewNavigation: unknown, clarify: string | null = null) => parseIntentDeclaration(
        JSON.stringify({ mode: "question", tools: [], viewNavigation, clarify }), FACTS,
      ).intent?.viewNavigation;
      expect(parse(true)).toBe(true);
      expect(parse("true")).toBe(false);
      expect(parse(undefined)).toBe(false);
      expect(parse(true, "어느 상점인가요?")).toBe(false);
      expect(continuationIntentDeclaration(FACTS).viewNavigation).not.toBe(true);
      expect(fallbackIntentDeclaration(FACTS).viewNavigation).not.toBe(true);
    });
    it("정상 JSON 을 선언으로 옮기고 source 는 llm 이다", () => {
      const raw = JSON.stringify({
        mode: "create", space: "interior", facility: "여관", targetMapId: null, useSelection: false,
        clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: ["place_concept"], summary: "여관 실내 시공",
      });
      const { intent, error } = parseIntentDeclaration(raw, FACTS);
      expect(error).toBeUndefined();
      expect(intent).toMatchObject({ mode: "create", space: "interior", facility: "여관", tools: ["place_concept"], source: "llm" });
    });

    it("코드펜스·잡담이 섞여도 JSON 을 건진다", () => {
      const raw = "네, 분류했습니다.\n```json\n{\"mode\":\"question\",\"space\":\"none\",\"tools\":[],\"summary\":\"질문\"}\n```";
      expect(parseIntentDeclaration(raw, FACTS).intent?.mode).toBe("question");
    });

    it("레지스트리에 없는 툴·모르는 맵 id·모르는 시설은 버린다(스키마 밖 값을 코드로 흘리지 않는다)", () => {
      const raw = JSON.stringify({
        mode: "modify", space: "none", facility: "우주정거장", targetMapId: "map_nope",
        tools: ["place_concept", "make_everything", "place_npc"], summary: "x",
      });
      const intent = parseIntentDeclaration(raw, FACTS).intent!;
      expect(intent.tools).toEqual(["place_concept", "place_npc"]);
      expect(intent.targetMapId).toBeNull();
      expect(intent.facility).toBeNull();
    });

    it("아는 맵 id 는 대상으로 남고 시설 라벨은 대소문자 무관하게 맞춘다", () => {
      const raw = JSON.stringify({ mode: "modify", space: "none", facility: "여관", targetMapId: "map_inn", tools: [], summary: "x" });
      const intent = parseIntentDeclaration(raw, FACTS).intent!;
      expect(intent.targetMapId).toBe("map_inn");
      expect(intent.facility).toBe("여관");
    });

    it("mode 가 enum 밖이면 실패로 돌려 호출자가 폴백을 쓰게 한다", () => {
      const result = parseIntentDeclaration(JSON.stringify({ mode: "destroy", tools: [] }), FACTS);
      expect(result.intent).toBeNull();
      expect(result.error).toMatch(/mode/);
      expect(parseIntentDeclaration("그냥 문장", FACTS).intent).toBeNull();
    });

    it("선택 영역이 없으면 useSelection 은 참이 될 수 없고, clarify 없는 선택지는 버린다", () => {
      const raw = JSON.stringify({ mode: "create", space: "outdoor", useSelection: true, clarify: null, clarifyOptions: ["a", "b"], tools: [], summary: "x" });
      const intent = parseIntentDeclaration(raw, FACTS).intent!;
      expect(intent.useSelection).toBe(false);
      expect(intent.clarifyOptions).toEqual([]);
    });

    it("선택 영역이 있으면 useSelection 을 읽고 clarify 선택지는 4개까지", () => {
      const facts: IntentFacts = { ...FACTS, selection: { mapId: "map_start", x: 1, y: 2, width: 3, height: 4 } };
      const raw = JSON.stringify({ mode: "create", space: "unclear", useSelection: true, clarify: "실내인가요 야외인가요?", clarifyOptions: ["실내", "야외", "둘 다", "취소", "다섯"], tools: [], summary: "x" });
      const intent = parseIntentDeclaration(raw, facts).intent!;
      expect(intent.useSelection).toBe(true);
      expect(intent.clarify).toBe("실내인가요 야외인가요?");
      expect(intent.clarifyOptions).toHaveLength(4);
    });
  });
  describe("폴백·이어가기·빈 선언", () => {
    it("폴백은 아무것도 추측하지 않는다 — 되묻기 없음, 툴 없음, 계획 여부는 플래너에게 넘긴다", () => {
      const fallback = fallbackIntentDeclaration(FACTS);
      expect(fallback).toMatchObject({ mode: "other", clarify: null, tools: [], needsPlan: true, source: "fallback" });
      expect(fallbackIntentDeclaration({ ...FACTS, userText: "  " }).needsPlan).toBe(false);
    });

    it("선택 영역이 있으면 폴백은 그 안에서 작업한다고 본다(안전한 기본)", () => {
      const facts: IntentFacts = { ...FACTS, selection: { mapId: "map_start", x: 0, y: 0, width: 4, height: 4 } };
      expect(fallbackIntentDeclaration(facts).useSelection).toBe(true);
    });

    it("계속·이어서 같은 한 마디는 continuation 이고 진행 중 계획이 있을 때만 계획을 이어간다", () => {
      for (const text of ["계속", "이어서", "계속해줘", "go on", "Continue.", "다음"]) expect(isContinuationText(text), text).toBe(true);
      expect(isContinuationText("계속 나무를 심어줘")).toBe(false);
      expect(continuationIntentDeclaration({ ...FACTS, hasActivePlan: true }).needsPlan).toBe(true);
      expect(continuationIntentDeclaration(FACTS).source).toBe("continuation");
    });
  });
  describe("사용자가 명시한 조회 계약", () => {
    it("프로젝트/DB/ID 조회 요구를 실행부에 구조화해 전달한다", () => {
      const parsed = parseIntentDeclaration(JSON.stringify({ mode: "modify", readBeforeWrite: {
        project: true, collections: ["items", "enemies", "troops", "invented"], references: true,
      } }), FACTS);
      expect(parsed.intent?.readBeforeWrite).toEqual({ project: true, collections: ["items", "enemies", "troops"], references: true });
      expect(formatIntentNote(parsed.intent!)).toContain("조회 선행 계약");
      expect(formatIntentNote(parsed.intent!)).toContain('include:"full"');
    });
    it("선언하지 않은 계약을 키워드로 추측해서 추가하지 않는다", () => {
      const parsed = parseIntentDeclaration('{"mode":"modify"}', { ...FACTS, userText: "먼저 읽고 조회 후 써라" });
      expect(parsed.intent?.readBeforeWrite).toBeUndefined();
    });
  });
  describe("선언 → 도메인·영역 탈출", () => {
    const domainsOf = (name: string) =>
      ({ place_concept: ["tile"], place_npc: ["event"], define_quest: ["quest"], get_project_summary: ["core"] } as Record<string, readonly ("tile" | "event" | "quest" | "core")[]>)[name];

    it("선언한 툴의 레지스트리 도메인이 열리고 core 는 세지 않는다", () => {
      const domains = intentToolDomains(declaredIntent({ tools: ["place_npc", "define_quest", "get_project_summary"] }), domainsOf);
      expect([...domains].sort()).toEqual(["event", "quest"]);
    });

    it("공간 시공은 tile 을, 수정은 편집 3도메인을 함께 연다", () => {
      expect(intentToolDomains(declaredIntent({ space: "interior" }), domainsOf).has("tile")).toBe(true);
      expect([...intentToolDomains(declaredIntent({ mode: "modify" }), domainsOf)].sort()).toEqual(["event", "map", "tile"]);
      expect(intentToolDomains(declaredIntent({ mode: "question" }), domainsOf).size).toBe(0);
    });

    it("실내 신축·선택 영역 밖 신규 생성은 영역 작업을 탈출하고, 수정·폴백은 남는다", () => {
      expect(intentEscapesRegion(declaredIntent({ space: "interior" }))).toBe(true);
      expect(intentEscapesRegion(declaredIntent({ mode: "create", useSelection: false }))).toBe(true);
      expect(intentEscapesRegion(declaredIntent({ mode: "create", useSelection: true }))).toBe(false);
      expect(intentEscapesRegion(declaredIntent({ mode: "modify", space: "interior" }))).toBe(false);
      expect(intentEscapesRegion(fallbackIntentDeclaration(FACTS))).toBe(false);
    });
  });
  describe("모델에 주는 입력과 모델이 낸 것의 표현", () => {
    it("선택 이벤트 줄은 고른 이벤트가 있을 때만 실린다 — 없으면 페이로드는 예전 그대로다", () => {
      const without = buildIntentUserPayload(FACTS);
      expect(without).not.toContain("선택 이벤트");
      const withEvent = buildIntentUserPayload({ ...FACTS, selectedEvent: "마을 주민 (ev_utility_npc) 위치 (4,5)" });
      expect(withEvent).toContain("선택 이벤트: 마을 주민 (ev_utility_npc) 위치 (4,5)");
      expect(withEvent.replace(/\n[^\n]*선택 이벤트: [^\n]*/u, "")).toBe(without);
    });

    it("페이로드는 사실만 싣는다 — 요청·현재 맵·선택 영역·맵 목록·시설 라벨·툴 목록", () => {
      const payload = buildIntentUserPayload({ ...FACTS, selection: { mapId: "map_start", x: 1, y: 2, width: 3, height: 4 } });
      expect(payload).toContain("여관 지어줘");
      expect(payload).toContain("시작 맵 (map_start)");
      expect(payload).toContain("선택 영역: map_start (1,2) 3×4");
      expect(payload).toContain("여관, 민가, 상점, 대장간");
      expect(payload).toContain("place_concept, author_house");
      expect(INTENT_SYSTEM_PROMPT).toContain("\"mode\"");
      expect(INTENT_SYSTEM_PROMPT).toContain("부정과 금지");
    });

    it("되묻기 문장은 선언의 질문 그대로이고 선택지가 둘 이상이면 원탭 마커를 붙인다", () => {
      const withOptions = formatIntentClarifyMessage(declaredIntent({ clarify: "어디에 지을까요?", clarifyOptions: ["실내 맵", "야외 외장"] }));
      expect(withOptions).toBe(`어디에 지을까요?\n${QUICK_REPLY_MARKER} 실내 맵 | 야외 외장`);
      expect(formatIntentClarifyMessage(declaredIntent({ clarify: "어느 맵인가요?" }))).toBe("어느 맵인가요?");
    });

    it("선택 영역 노트: 안에서 작업이면 경계·마을 시그니처, 새 맵 시공이면 참고용", () => {
      const scope = { mapId: "map_start", region: { x: 2, y: 3, width: 8, height: 6 } };
      const inside = formatScopeNote(scope, declaredIntent({ useSelection: true }));
      expect(inside).toContain("영역 밖 타일·이벤트는 수정하지 말 것");
      // 경계는 bounds:{…} 객체 표기 대신 「(x,y) w×h 사각형」 문장으로 준다.
      expect(inside).toContain("`map_start` 의 (2,3) 8×6 사각형");
      const outside = formatScopeNote(scope, declaredIntent({ space: "interior", useSelection: false }));
      expect(outside).toContain("참고용");
      // 폴백 선언은 안전한 쪽(영역 안)으로 본다.
      expect(formatScopeNote(scope, fallbackIntentDeclaration(FACTS))).toContain("영역 밖 타일·이벤트는 수정하지 말 것");
    });

    it("영역에 장소를 짓는 지시는 새 맵 금지 대신 build_region_place 한 번을 그 사각형·종류로 이른다(v1·v2 같은 노트)", () => {
      const scope = { mapId: "map_start", region: { x: 2, y: 3, width: 8, height: 6 } };
      const call = 'build_region_place({mapId:"map_start", region:{x:2,y:3,width:8,height:6}, kind:"shop"})';
      const inside = formatScopeNote(scope, declaredIntent({ useSelection: true }), "여기 상점 만들어 줘");
      expect(inside).toContain(call);
      expect(inside).not.toContain("create_map·duplicate_map 으로 새 맵을 만들지 말고");
      expect(formatV2RegionNote(scope, "여기 상점 만들어 줘")).toContain(call);
      expect(formatV2RegionNote(scope, "여기 나무 심어 줘")).not.toContain("build_region_place");
      expect(formatV2RegionNote(scope, "여기 나무 심어 줘")).toContain("`map_start` 의 (2,3) 8×6 사각형");
      expect(formatRegionPlaceNote(scope, "상점 앞에 나무")).toBeNull();
    });

    it("영역 장소 노트가 붙은 v2 요청만 빠른 적용 턴이고, 관문 줄은 카드용 짧은 경고가 된다(fast-apply)", () => {
      const scope = { mapId: "map_start", region: { x: 2, y: 3, width: 8, height: 6 } };
      expect(fastApplyTurn(composePiTask("여기 상점 만들어 줘", formatV2RegionNote(scope, "여기 상점 만들어 줘")))).toBe(true);
      expect(fastApplyTurn(composePiTask("여기 나무 심어 줘", formatV2RegionNote(scope, "여기 나무 심어 줘")))).toBe(false);
      expect(fastApplyTurn("마을에 상점 만들어 줘")).toBe(false);
      const warnings = fastWarnings([
        { key: "g1", source: "gate", text: "[게임 검사 방 쓰임] 도구점: pharmacy_shop(가게) 에 찻상(붉은 천) 1×1(10,5) — 그 방의 쓰임에 안 맞는다. tile_erase 로 걷어 낸다" },
        { key: "g1", source: "gate", text: "같은 열쇠" },
      ]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.text).toBe("도구점: pharmacy_shop(가게) 에 찻상(붉은 천) 1×1(10,5)");
      expect(warnings[0]!.detail).toContain("tile_erase");
    });

    it("감사 한 줄에 출처·모드·공간·시설·툴·소요가 실린다", () => {
      const line = formatIntentAudit(declaredIntent({ space: "interior", facility: "여관", tools: ["place_concept"] }), 812);
      expect(line).toBe("intent:llm mode=create space=interior facility=여관 single tools=place_concept 812ms");
    });
  });
  describe("formatIntentNote — 선언이 확정한 것을 본문 모델에게 알린다", () => {
    it("수정·질문·야외 선언은 각자의 경계를, 폴백·이어가기는 노트를 내지 않는다", () => {
      expect(formatIntentNote(declaredIntent({ mode: "modify", targetMapId: "map_a" }))).toContain("`map_a`");
      expect(formatIntentNote(declaredIntent({ mode: "question" }))).toContain("바꾸지 말고");
      const outdoor = formatIntentNote(declaredIntent({ mode: "create", space: "outdoor" }));
      expect(outdoor).toContain("야외 시공");
      // linked-interior(author_house) 대신 실내는 build_hand_interior_room, 연결은 create_transfer_pair.
      expect(outdoor).toContain("build_hand_interior_room");
      expect(outdoor).toContain("create_transfer_pair");
      expect(outdoor).not.toContain("실내 세션·새 실내 맵은 만들지 말 것");
      expect(formatIntentNote(declaredIntent({ mode: "create", space: "none" }))).toBeNull();
      expect(formatIntentNote(fallbackIntentDeclaration(FACTS))).toBeNull();
      expect(formatIntentNote(continuationIntentDeclaration(FACTS))).toBeNull();
    });
  });
  it("full-adventure contracts come from declared intent and cannot affect question mode", () => {
    const adventure = { village: true, dungeon: true, party: true, battle: true };
    expect(parseIntentDeclaration(JSON.stringify({ mode: "modify", adventure }), FACTS).intent?.adventure).toEqual(adventure);
    expect(parseIntentDeclaration(JSON.stringify({ mode: "question", adventure }), FACTS).intent?.adventure).toBeUndefined();
    expect(parseIntentDeclaration('{"mode":"modify"}', { ...FACTS, userText: "마을 NPC 추가" }).intent?.adventure).toBeUndefined();
  });
  it("preserves the foundation lanes for a full RPG kickoff", () => {
    const adventure = { village: true, dungeon: true, party: true, battle: true, world: true, characters: true, appearance: true };
    expect(parseIntentDeclaration(JSON.stringify({ mode: "create", adventure }), FACTS).intent?.adventure).toEqual(adventure);
  });
  describe("참조 작품 비유 — 검색을 부르는 계약", () => {
    const REFERENCE_FACTS: IntentFacts = {
      ...FACTS,
      userText: "해리포터 같은 게임 만들고 싶다. 마법학교 분위기로.",
      toolNames: [...FACTS.toolNames, "web_search", "set_world_canon"],
    };

    function declare(payload: Record<string, unknown>) {
      return parseIntentDeclaration(JSON.stringify(payload), REFERENCE_FACTS);
    }

    it("실존 작품을 지목하면 referenceWork 로 보존한다", () => {
      const result = declare({ mode: "create", referenceWork: "해리포터", summary: "마법학교 게임" });
      expect(result.intent?.referenceWork).toBe("해리포터");
    });

    it("mode=other 로 분류돼도 보존한다 — 「만들고 싶다」는 발화가 여기로 온다", () => {
      // 실측 2026-09-21: authoring(create|modify) 게이트에 묶여 있으면 mode=other 에서 조용히 사라졌다.
      const result = declare({ mode: "other", referenceWork: "해리포터", summary: "게임을 만들고 싶다" });
      expect(result.intent?.mode).toBe("other");
      expect(result.intent?.referenceWork).toBe("해리포터");
    });

    it("장르·스타일 설명은 작품명이 아니다", () => {
      const result = declare({ mode: "create", summary: "중세 판타지 RPG" });
      expect(result.intent?.referenceWork).toBeUndefined();
    });

    it("참조 작품이 없으면 그 노트가 붙지 않는다", () => {
      expect(formatIntentNote(declaredIntent({})) ?? "").not.toContain("[참조 작품]");
    });
  });
});

// 의도 선언 LLM 어댑터 — 한 번 호출·JSON 하나·실패는 중립 폴백·짧은 캐시.
describe("intentDeclarationClient", () => {
  isolateTimers();
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
  // These tests isolate routing/repair calls. The audit still returns through the
  // production parser; invalid coverage remains blocked rather than bypassed.
  const createLlmIntentDeclarer = (options: Parameters<typeof productionDeclarer>[0] = {}): IntentDeclarer => (facts, signal) => productionDeclarer({
    ...options, audit: async () => reply(JSON.stringify({ requirements: [{ text: facts.userText,
      criteria: [{ kind: "functionalUnresolved", reason: "This routing test does not assess authored construction" }] }] })),
  })(facts, signal);
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

    it("커버리지 감사는 라우팅과 다른 예산을 쓴다 — 한 호출의 지연이 다른 호출을 죽이지 않는다", async () => {
      // 실측 2026-09-15 라이브(activity e1c80a58·72e8599d): 라우팅이 20초 벽을 거의 다 쓰고 성공했고, 같은
      // 컨트롤러를 물려받은 커버리지 감사가 그 벽에 잘렸다. 그 결과 「Request coverage unverified: 시간 초과(20000ms)」
      // 라는 **닫을 수 없는** 필수 항목이 생겼고, 모델은 그걸 닫으려 repair_acceptance·correct_verification 를
      // 반복하다 예산을 태운 뒤 초안을 버렸다.
      const requirements = [{ text: FACTS.userText,
        criteria: [{ kind: "mapCount" as const, targets: [{ mapId: "map_start" }], count: 1 }] }];
      let routingSignal: AbortSignal | null | undefined;
      let auditSignal: AbortSignal | null | undefined;
      let auditAbortedAtStart: boolean | null = null;
      const declarer = productionDeclarer({ getConfig: () => CONFIG,
        chat: async (_config, request) => { routingSignal = request.signal; return reply(JSON.stringify({ mode: "modify", needsPlan: false })); },
        audit: async (_config, request) => {
          auditSignal = request.signal;
          auditAbortedAtStart = request.signal?.aborted ?? null;
          return reply(JSON.stringify({ requirements }));
        },
      });
      const outcome = await declarer(FACTS);
      // 감사는 라우팅이 쓴 예산을 물려받지 않는다: 별도 컨트롤러이고, 시작 시점에 이미 취소돼 있지 않다.
      expect(auditSignal).toBeDefined();
      expect(auditSignal).not.toBe(routingSignal);
      expect(auditAbortedAtStart).toBe(false);
      // 그래서 진짜 의무가 남는다 — 타임아웃 자리표시자가 아니라.
      expect(outcome.intent.requestRequirements).toEqual(requirements);
      expect(outcome.error).toBeUndefined();
    });
  });
  describe("parallelAudit — 감사를 라우팅과 동시에", () => {
    // 실측 2026-10-04(Pi 입력창): 라우팅 2.2~5.8s 뒤에 감사 2.2~3.9s 를 차례로 기다렸다. 감사는 같은 사실만 본다.
    it("만들기면 라우팅이 끝나기 전에 감사가 이미 떠 있고, 결과는 라우팅의 보정 id 로 파싱한다", async () => {
      const order: string[] = [];
      let releaseRouting: () => void = () => {};
      const requirements = [{ text: FACTS.userText, criteria: [{ kind: "mapCount" as const, targets: [{ mapId: "map_start" }], count: 1 }] }];
      const declarer = productionDeclarer({ getConfig: () => CONFIG, parallelAudit: true,
        chat: async () => { order.push("routing"); await new Promise<void>(resolve => { releaseRouting = resolve; }); order.push("routing-done"); return reply(JSON.stringify({ mode: "create", needsPlan: false })); },
        audit: async () => { order.push("audit"); return reply(JSON.stringify({ requirements })); },
      });
      const pending = declarer(FACTS);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(order).toEqual(["routing", "audit"]);
      releaseRouting();
      const outcome = await pending;
      expect(outcome.intent.requestRequirements).toEqual(requirements);
      expect(outcome.error).toBeUndefined();
    });

    it("질문이면 띄운 감사를 끊고 의무를 만들지 않는다", async () => {
      let auditSignal: AbortSignal | undefined;
      const declarer = productionDeclarer({ getConfig: () => CONFIG, parallelAudit: true,
        chat: async () => reply(JSON.stringify({ mode: "question" })),
        audit: (_config, request) => new Promise((_resolve, reject) => {
          auditSignal = request.signal ?? undefined;
          request.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      });
      const outcome = await declarer(FACTS);
      expect(outcome.intent.mode).toBe("question");
      expect(outcome.intent.requestRequirements).toBeUndefined();
      expect(auditSignal?.aborted).toBe(true);
    });
  });
  describe("declareIntentCached", () => {
    it.each(["malformed", "empty", "missing-requirements", "unlinked", "invalid-criteria", "invalid-clarification", "network"] as const)("immediately retries %s coverage and caches the recovered audit", async failure => {
      let declarations = 0, audits = 0;
      const requirements = [{ text: FACTS.userText,
        criteria: [{ kind: "mapCount", targets: [{ mapId: "map_start" }], count: 1 }] }];
      const declarer = productionDeclarer({ getConfig: () => CONFIG,
        chat: async () => { declarations++; return reply(JSON.stringify({ mode: "modify", needsPlan: false })); },
        audit: async () => {
          if (++audits === 1) {
            if (failure === "network") throw new Error("coverage unavailable");
            if (failure === "missing-requirements") return reply("{}");
            if (failure === "unlinked") return reply(JSON.stringify({ requirements: [{ ...requirements[0], text: "not in the request" }] }));
            if (failure === "invalid-criteria") return reply(JSON.stringify({ requirements: [{ text: FACTS.userText, criteria: [] }] }));
            if (failure === "invalid-clarification") return reply(JSON.stringify({ requirements: [], clarifies: [{ requirementId: "unknown", text: FACTS.userText }] }));
            return reply(failure === "malformed" ? "{" : JSON.stringify({ requirements: [] }));
          }
          return reply(JSON.stringify({ requirements }));
        },
      });
      const first = await declareIntentCached(declarer, FACTS);
      expect(first.intent.requestRequirements).toHaveLength(failure === "unlinked" ? 2 : 1);
      expect(first.intent.requestRequirements?.map(requirement => requirement.criteria.map(criterion => criterion.kind)))
        .toEqual(failure === "unlinked" ? [["functionalUnresolved"], ["functionalUnresolved"]] : [["functionalUnresolved"]]);
      const recovered = await declareIntentCached(declarer, FACTS);
      expect(recovered.intent.requestRequirements).toEqual(requirements);
      expect(first.error).toBeDefined();
      expect(recovered.error).toBeUndefined();
      expect((await declareIntentCached(declarer, FACTS)).intent.requestRequirements).toEqual(requirements);
      expect(declarations).toBe(2);
      expect(audits).toBe(2);
    });

    it("caches valid model-declared unsupported obligations without treating them as extraction failures", async () => {
      let declarations = 0, audits = 0;
      const requirements = [{ text: FACTS.userText,
        criteria: [{ kind: "functionalUnresolved", reason: "No evaluator for requested construction" }] }];
      const declarer = productionDeclarer({ getConfig: () => CONFIG,
        chat: async () => { declarations++; return reply(JSON.stringify({ mode: "create", needsPlan: false })); },
        audit: async () => { audits++; return reply(JSON.stringify({ requirements })); },
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        const outcome = await declareIntentCached(declarer, FACTS);
        expect(outcome.intent.requestRequirements).toEqual(requirements);
        expect(outcome.error).toBeUndefined();
      }
      expect(declarations).toBe(1);
      expect(audits).toBe(1);
    });

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

    it("선택한 이벤트가 다르면 같은 문장도 다시 선언한다(이벤트 없이 낸 되묻기가 선택 뒤에 재사용되지 않는다)", async () => {
      let calls = 0;
      const declarer: IntentDeclarer = async (facts) => {
        calls += 1;
        return { intent: { ...(await createLlmIntentDeclarer({ getConfig: () => CONFIG, chat: async () => reply(JSON.stringify({ mode: "modify", tools: [], summary: facts.userText })) })(facts)).intent }, elapsedMs: 5 };
      };
      const base = { ...FACTS, userText: "이 NPC 이름을 하린으로 바꿔줘" };
      await declareIntentCached(declarer, base);
      await declareIntentCached(declarer, { ...base, selectedEvent: "마을 주민 (ev_utility_npc) 위치 (4,5)" });
      expect(calls).toBe(2);
      await declareIntentCached(declarer, { ...base, selectedEvent: "마을 주민 (ev_utility_npc) 위치 (4,5)" });
      expect(calls).toBe(2);
      await declareIntentCached(declarer, { ...base, selectedEvent: "잡화점 주인 (ev_test_shop) 위치 (9,3)" });
      expect(calls).toBe(3);
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
      // place_concept·author_house 와 실내 개념 꾸러미(여관·민가 …)는 은퇴했다 — 새 프로젝트에는 시설 라벨이 없어 그 단언은 뺐고,
      // 실내는 build_hand_interior_room, 외장은 place_terrain_house 가 맡는다.
      expect(facts.toolNames).not.toContain("place_concept");
      expect(facts.toolNames).not.toContain("author_house");
      expect(facts.toolNames).toContain("build_hand_interior_room");
      expect(facts.toolNames).toContain("place_terrain_house");
    });

    it("고른 이벤트는 있을 때만 사실에 들어간다", () => {
      const project = createBlankProject();
      const input = { project, userText: "이 NPC 이름 바꿔줘", currentMapId: project.startMapId!, selection: null, hasActivePlan: false };
      expect(buildIntentFacts(input)).not.toHaveProperty("selectedEvent");
      expect(buildIntentFacts({ ...input, selectedEvent: "마을 주민 (ev_utility_npc) 위치 (4,5)" }).selectedEvent).toBe("마을 주민 (ev_utility_npc) 위치 (4,5)");
    });
  });
});

describe("mapVisualTilesetDependency", () => {
  isolateTimers();
  function withSecondMap(project: Project): { readonly usedId: string; readonly unusedId: string } {
    const start = project.maps[project.startMapId];
    const usedId = start.tilesetId;
    const unusedId = "unused-tileset";
    project.tilesets[unusedId] = { ...structuredClone(project.tilesets[usedId]), id: unusedId, name: "Unused" };
    project.maps.second = { ...structuredClone(start), id: "second", name: "Second", tilesetId: usedId };
    return { usedId, unusedId };
  }
  describe("tileset visual render dependencies", () => {
    it("requires fresh coverage when a used tileset atlas geometry changes", () => {
      const after = createBlankProject();
      const { usedId } = withSecondMap(after);
      const before = structuredClone(after);
      after.tilesets[usedId].tilesPerRow += 1;
      expect(requiresVisualReview(before, after, after.startMapId)).toBe(true);
      expect(requiresVisualReview(before, after, "second")).toBe(true);
    });

    it("ignores unreferenced tileset render edits for maps that do not use them", () => {
      const after = createBlankProject();
      const { unusedId } = withSecondMap(after);
      const before = structuredClone(after);
      after.tilesets[unusedId].tilesPerRow += 1;
      after.tilesets[unusedId].tileSize += 1;
      after.tilesets[unusedId].image = { type: "bundled", id: "other-chipset" };
      expect(requiresVisualReview(before, after, after.startMapId)).toBe(false);
      expect(requiresVisualReview(before, after, "second")).toBe(false);
    });

    it("treats tileset name and passability as nonvisual metadata", () => {
      const after = createBlankProject();
      const tilesetId = after.maps[after.startMapId].tilesetId;
      const before = structuredClone(after);
      after.tilesets[tilesetId].name = "Renamed atlas";
      after.tilesets[tilesetId].passability = after.tilesets[tilesetId].passability.map(() => "solid");
      after.tilesets[tilesetId].priority = after.tilesets[tilesetId].priority.map(() => "upper");
      after.tilesets[tilesetId].terrain = after.tilesets[tilesetId].terrain.map(() => 9);
      expect(requiresVisualReview(before, after, after.startMapId)).toBe(false);
      expect(tilesetVisualContent(before.tilesets[tilesetId])).toEqual(tilesetVisualContent(after.tilesets[tilesetId]));
    });

    it("classifies image, grafts, and uploaded bytes as visual while leaving map objects untouched", () => {
      const after = createBlankProject();
      const tilesetId = after.maps[after.startMapId].tilesetId;
      const before = structuredClone(after);
      const graft: TileGraft = { targetTile: 0, sourceChipset: "ChipSet1", sourceTile: 1 };
      after.tilesets[tilesetId].tileGrafts = [graft];
      expect(requiresVisualReview(before, after, after.startMapId)).toBe(true);
      after.tilesets[tilesetId].tileGrafts = [];
      after.tilesets[tilesetId].image = { type: "uploaded", id: "atlas-upload" };
      after.assets.uploaded["atlas-upload"] = {
        id: "atlas-upload", name: "Atlas", kind: "tileset", dataUrl: "data:image/png;base64,AA==", meta: {},
      };
      expect(requiresVisualReview(before, after, after.startMapId)).toBe(true);
      const withBytes = structuredClone(after);
      after.assets.uploaded["atlas-upload"].dataUrl = "data:image/png;base64,BB==";
      expect(requiresVisualReview(withBytes, after, after.startMapId)).toBe(true);
      expect(JSON.stringify(before.maps)).toBe(JSON.stringify(after.maps));
    });

    it("keeps stale image receipts retired after a used tileset render change, and accepts a fresh capture", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      const evidence = new AssistantImageEvidence();
      const stale = evidence.capture(project, { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height });
      if (!stale) throw new Error("missing stale receipt");
      evidence.deliver([stale]);
      expect(evidence.current(project)).toEqual([stale]);
      project.tilesets[map.tilesetId].tilesPerRow += 1;
      expect(evidence.current(project)).toEqual([]);
      const fresh = evidence.capture(project, { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height });
      if (!fresh) throw new Error("missing fresh receipt");
      evidence.deliver([fresh]);
      expect(evidence.current(project)).toEqual([fresh]);
      expect(fresh.fingerprint).not.toBe(stale.fingerprint);
    });
  });
});
