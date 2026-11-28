import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_WORK_STRIP_MAX_VISIBLE, aiWorkCardCount, beginAiWorkCard, getAiWorkStripElement, resetAiWorkStripForTest } from "@/editor/panels/aiWorkStrip";
import type { ChangePreviewInput } from "@/editor/panels/aiChangePreview";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement, renderWithFakeDom } from "./fakeDom";
import { REGION_SURFACE_MAX_TOOL_CALLS, TILESET_ANALYSIS_MAX_TOKENS, isAssistantEndpointReady, resolveSurfaceAiConfig, type AiSurface } from "@/ai/assistantEndpoint";
import { ASSISTANT_CHATGPT_MODEL } from "@/ai/chatgptDefault";
import { type AiConfig, AI_CONFIG_STORAGE_KEY, loadAiConfig, resetAiTransportHealth, defaultAiConfig } from "@/ai/llmClient";
import { getAiConnectionStatus, refreshAiConnectionStatus, resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { assistantRoleModel, configWithAutoAssistantRoles, resolveAssistantRoles, type AssistantRole, type RoleAssignment } from "@/ai/assistantRoles";
import { mockConnectedRoutes } from "@/editor/panels/aiRoleMatrixSettings";
import { configForProviderSelection } from "@/ai/providerSelection";
import { isStoreCardRequest, STORE_TOOLS } from "@/editor/tools/storeTools";
import { storeCardFromEvent } from "@/editor/panels/aiStoreCard";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { battleBackdropPreviewUrl, nextBattleScenery, readBattleScenery } from "@/editor/panels/battleSceneryPicker";
import { applyBattleMethod } from "@/project/battleMethod";
import type { Project, MapId, GameEvent, ClusterRule, GameMap, TileGroupMetadata, MonsterSpeciesRecord, TroopRecord } from "@/project/types";
import { ACTIVE_BATTLE_SKIN_IDS, isRetiredBattleSkinId, listActiveBattleSkinIds, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import { isActionCombatMap } from "@/project/actionCombat";
import { projectLint } from "@/project/lint/projectLint";
import { Window } from "happy-dom";
import { betweenTurnActionLabel, betweenTurnClock, betweenTurnDetailText, betweenTurnLogText, betweenTurnSurfaceLabel, buildBetweenTurnRows } from "@/editor/panels/aiBetweenTurnLogRows";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import { listAiUiEvents, recordAiUiEvent, resetAiUiEventLogForTest } from "@/ai/uiEventLog";
import { createBetweenTurnLogSection } from "@/editor/panels/aiBetweenTurnLog";
import { BUILD_PALETTE_GROUP_CLAIMS } from "@/editor/panels/buildPaletteCore";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";
import { editorState } from "@/editor/editorState";
import { getBuildPaletteHouseOptions, getSelectedHouseKitId, getSelectedHouseShapeId, isBuildPaletteEnabled, renderBuildPalettePopup, setBuildPaletteHouseOption, setBuildPaletteEnabled, setSelectedHouseKitId, setSelectedHouseShapeId } from "@/editor/panels/buildPalette";
import { executeCanvasAiAction, renderCanvasAiWorkbench, type CanvasAiWorkbenchDeps } from "@/editor/panels/canvasAiWorkbench";
import { isolateTimers } from "./mergedTeardown";
import { openCanvasInspectionPanel, type CanvasInspectionDeps } from "@/editor/panels/canvasInspectionPanel";
import { resolveCharacterListThumbSource } from "@/editor/panels/characterListThumbnail";
import { listCharacterIdIndex } from "@/project/characterIdIndex";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { Buffer } from "node:buffer";
import { prepareCinematicUpload } from "@/editor/cinematicMediaImport";
import { IMAGE_IMPORT_MAX_BYTES } from "@/editor/panels/resourceManagerImageImport";
import { mediaImportRuleFor } from "@/editor/panels/resourceManagerMediaImport";
import { clusterAssistCopy, clusterRecoveryOffer, presentClusterRecovery, toggleClusterAssistMode } from "@/editor/clusterAssistRecovery";
import { makeTileBrushAssistPanel } from "@/editor/panels/tilePalettePreviewPanel";
import { resetMapEditHistory, getMapEditHistoryState, undoMapEdit } from "@/editor/mapEditHistory";
import { paintTilesBulk, type TilePaintRejection } from "@/editor/tileActions";
import { resetToastsForTest } from "@/util/toast";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { runTool } from "@/editor/tools/toolRunner";
import { mergeSurfaceRule } from "@/editor/panels/tilesetKnowledgeWorkspaceState";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import { buildPaletteEntries, movePaletteIndex, paletteKeyAction } from "@/editor/panels/commandPalette";
import type { EditorCommand } from "@/editor/commandRegistry";
import { effectiveActorEquipment, transitionActorEquipment } from "@/project/equipmentRules";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { addEquipmentSlot, equipmentSlots, equipmentSlotLabel, equipmentSlotRemovalBlocker, renameEquipmentSlot, removeEquipmentSlot } from "@/project/equipmentSlots";
import { serialize, deserialize } from "@/project/io/serialize";
import { normalizeActorRecord } from "@/project/actorModel";
import { actorDerivedStats, classicEnemyFormation, enemyBattlers } from "@/battle/battleBattlers";
import { startSession } from "@/project/session";
import { changeActorEquipment } from "@/project/sessionActorCommands";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { createSaveSnapshot, saveToSlot, readSaveSlot, applySaveSnapshot, snapshotLoadBlocker, saveSlotKey } from "@/player/saveSlots";
import { isActorEquipmentRecord } from "@/player/saveSlotValidation";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { battlePanel } from "@/editor/panels/actorRecordBattlePanels";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { el } from "@/util/dom";
import { updateDatabaseRecord, addDatabaseRecord } from "@/editor/databaseActions";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { monsterSpeciesReferenceMessage, databaseReferenceMessage } from "@/editor/databaseReferences";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { kindOfBattleEventCondition } from "@/editor/panels/databaseTroopBattleEventConditions";
import { updateTroopBattleEventPage } from "@/editor/panels/databaseTroopBattleEventActions";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import { monsterEvolutionCycleSpeciesIds, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { numberField } from "@/editor/panels/databaseControls";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { actorCurveCards, actorExperiencePanel } from "@/editor/panels/actorRecordCurveEditors";
import { classCurveCards } from "@/editor/panels/databaseClassCurveEditors";
import { renderExperienceCurvePanel } from "@/editor/panels/databaseClassExperienceCurveEditor";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";

describe("editorPanelsSuite15", () => {
  isolateTimers();
  // 조수가 한 일 — 캔버스 하단 가로 띠(aiWorkStrip). 대화 창에서 빠진 작업 산출물이 여기로 온다(방향 G, 2026-09-17).
  describe("aiWorkStrip", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    function strip(): FakeElement {
      const root = getAiWorkStripElement() as unknown as FakeElement | null;
      if (!root) throw new Error("작업 띠가 없다");
      return root;
    }
    function cards(): FakeElement[] {
      return strip().querySelectorAll("[data-testid=ai-work-card]");
    }
    function stepEntry(text: string): HTMLElement {
      const entry = document.createElement("div");
      entry.className = "ai-tool-activity-line ai-act";
      entry.dataset.testid = "ai-tool-entry";
      entry.textContent = text;
      return entry;
    }
    function changedPreview(title = "광장 바닥 8×6"): ChangePreviewInput {
      const before = store.getCurrent();
      const mapId = before.startMapId;
      const after = structuredClone(before);
      after.maps[mapId]!.lowerTiles[0] = (after.maps[mapId]!.lowerTiles[0] ?? 0) + 1;
      return { before, after, mapId, title, chips: ["타일 48", "이벤트 +1"], onUndo: vi.fn() };
    }
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });
    afterEach(() => {
      resetAiWorkStripForTest();
      restoreDom?.();
      restoreDom = null;
    });
    describe("작업 띠 — 카드 생명주기", () => {
      it("첫 카드가 생기면 띠가 body 에 붙고 머리 알약이 개수를 말한다", () => {
        // Break: 띠가 채팅 로그 안에 붙거나, 카드 수가 머리에 안 나온다.
        const card = beginAiWorkCard({ title: "우물 놓고 상인 세워줘", onStop: vi.fn() });
        const root = strip();
        expect((document.body as unknown as FakeElement).children).toContain(root);
        expect(root.hidden).toBe(false);
        expect(findByTestId(root, "ai-work-strip-toggle")?.textContent).toContain("조수가 한 일");
        expect(findByTestId(root, "ai-work-strip-toggle")?.textContent).toContain("1");
        expect(card.root.dataset.state).toBe("running");
        expect(findByTestId(card.root as unknown as FakeElement, "ai-work-card-stop")).not.toBeNull();
        expect(root.className).toContain("is-running");
      });

      it("진행 중 카드는 중지 버튼으로 onStop 을 부르고, 단계는 쓰기만 세고 조회는 개수만", () => {
        const onStop = vi.fn();
        const card = beginAiWorkCard({ title: "길 깔아줘", onStop });
        card.noteReadOnly();
        card.noteReadOnly();
        card.appendStep(stepEntry("길 6칸"));
        findByTestId(card.root as unknown as FakeElement, "ai-work-card-stop")?.click();
        expect(onStop).toHaveBeenCalledTimes(1);
        expect(findByTestId(card.root as unknown as FakeElement, "ai-work-card-step-count")?.textContent).toBe("1단계");
        expect(findByTestId(card.root as unknown as FakeElement, "ai-work-card-steps")?.querySelectorAll("[data-testid=ai-tool-entry]")).toHaveLength(1);
      });

      it("변경이 붙은 카드는 끝나면 완료 상태 + 맵에서 보기·이 작업만 되돌리기, 중지 버튼은 사라진다", () => {
        const preview = changedPreview();
        const card = beginAiWorkCard({ title: "광장", onStop: vi.fn() });
        card.appendStep(stepEntry("바닥 48칸"));
        card.attachChange(preview);
        card.finish({ ok: true });
        const root = card.root as unknown as FakeElement;
        expect(root.dataset.state).toBe("done");
        expect(findByTestId(root, "ai-work-card-stop")).toBeNull();
        expect(root.querySelector(".ai-work-card-title")?.textContent).toBe("광장 바닥 8×6");
        expect(findByTestId(root, "ai-work-card-meta")?.textContent).toContain("타일 48");
        expect(findByTestId(root, "ai-work-card-locate")).not.toBeNull();
        findByTestId(root, "ai-work-card-undo")?.click();
        expect(preview.onUndo).toHaveBeenCalledTimes(1);
        expect(root.className).toContain("is-undone");
        expect(card.discardIfEmpty()).toBe(false);
        expect(aiWorkCardCount()).toBe(1);
      });

      it("말만 한 턴(조회만·변경 없음)의 카드는 닫을 때 띠에서 빠지고 띠는 숨는다", () => {
        // Break: 질문에 답만 한 턴이 「조수가 한 일」 로 남아 띠를 채운다.
        const card = beginAiWorkCard({ title: "이 영역 크기 알려줘" });
        card.noteReadOnly();
        card.finish({ ok: true });
        expect(card.discardIfEmpty()).toBe(true);
        expect(aiWorkCardCount()).toBe(0);
        expect(strip().hidden).toBe(true);
      });

      it("카드 본문을 누르면 그 카드만 펼쳐져 변경 카드(전→후)와 단계가 그려지고, 나머지는 썸네일 칩", () => {
        const first = beginAiWorkCard({ title: "첫 일" });
        first.appendStep(stepEntry("a"));
        first.finish({ ok: true });
        const second = beginAiWorkCard({ title: "둘째 일" });
        second.appendStep(stepEntry("b"));
        second.attachChange(changedPreview("둘째 변경"));
        second.finish({ ok: true });

        const secondRoot = second.root as unknown as FakeElement;
        expect(findByTestId(secondRoot, "ai-change-card")).toBeNull(); // 펼치기 전엔 안 그린다
        secondRoot.querySelector(".ai-work-card-body")!.click();
        expect(secondRoot.className).toContain("is-open");
        expect(secondRoot.getAttribute("aria-expanded")).toBe("true");
        expect((first.root as unknown as FakeElement).className).toContain("is-mini");
        expect(strip().className).toContain("has-open");
        const changeCard = findByTestId(secondRoot, "ai-change-card");
        expect(changeCard).not.toBeNull();
        expect(changeCard?.querySelector(".ai-change-title")?.textContent).toBe("둘째 변경");
        expect(findByTestId(secondRoot, "ai-work-card-detail")?.querySelectorAll("[data-testid=ai-tool-entry]")).toHaveLength(1);

        // 다시 누르면 접힌다.
        secondRoot.querySelector(".ai-work-card-body")!.click();
        expect(secondRoot.className).not.toContain("is-open");
        expect((first.root as unknown as FakeElement).className).not.toContain("is-mini");
      });

      it("머리 알약은 띠를 접고, 넘치는 카드는 오래된 것부터 「+N」 뒤로 숨긴다", () => {
        for (let index = 0; index < AI_WORK_STRIP_MAX_VISIBLE + 2; index += 1) {
          const card = beginAiWorkCard({ title: `일 ${index + 1}` });
          card.appendStep(stepEntry(`s${index}`));
          card.finish({ ok: true });
        }
        const all = cards();
        expect(all).toHaveLength(AI_WORK_STRIP_MAX_VISIBLE + 2);
        expect(all.slice(0, 2).every((card) => card.hidden)).toBe(true);
        expect(all.slice(2).every((card) => !card.hidden)).toBe(true);
        const overflow = findByTestId(strip(), "ai-work-strip-overflow");
        expect(overflow?.hidden).toBe(false);
        expect(overflow?.textContent).toBe("+2");
        overflow?.click();
        expect(cards().every((card) => !card.hidden)).toBe(true);

        const toggle = findByTestId(strip(), "ai-work-strip-toggle");
        toggle?.click();
        expect(strip().className).toContain("is-folded");
        expect(toggle?.getAttribute("aria-expanded")).toBe("false");
        toggle?.click();
        expect(strip().className).not.toContain("is-folded");
      });
    });
  });
  describe("assistantEndpoint", () => {
    isolateTimers();
    const ALL_SURFACES: readonly AiSurface[] = [
      "chat",
      "region",
      "cluster",
      "event-command",
      "structure-kit",
      "tileset-analysis",
    ];
    beforeEach(() => {
      const values = new Map<string, string>();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => void values.set(key, value),
          removeItem: (key: string) => void values.delete(key),
          clear: () => values.clear(),
        },
      });
      resetAiConnectionStatusCache();
      resetAiTransportHealth();
    });
    afterEach(() => {
      resetAiConnectionStatusCache();
      resetAiTransportHealth();
      Reflect.deleteProperty(globalThis, "localStorage");
      vi.unstubAllGlobals();
    });
    function companionConfig(overrides: Partial<AiConfig> = {}): AiConfig {
      return {
        authMode: "chatgpt",
        providerId: "openai-codex",
        baseUrl: "",
        model: ASSISTANT_CHATGPT_MODEL,
        liteModel: ASSISTANT_CHATGPT_MODEL,
        apiKey: "",
        maxToolCalls: 60,
        maxTokens: 32768,
        reasoningEffort: "medium",
        ...overrides,
      };
    }
    describe("resolveSurfaceAiConfig", () => {
      it("keeps the region surface tool-call ceiling at the generous chat default", () => {
        expect(REGION_SURFACE_MAX_TOOL_CALLS).toBe(2000);
      });

      it("Given any surface When resolving Then the endpoint fields stay identical to the assistant config", () => {
        // 이 스펙이 막는 결함: 표면이 자기 baseUrl/authMode/providerId 를 정하면 '조수 하나로 통일' 이
        // 깨진다. 과거 타일셋 AI 가 직접 baseUrl 을 조립하다 조용히 죽은 경로가 그것이었다.
        const base = companionConfig();

        for (const surface of ALL_SURFACES) {
          const resolved = resolveSurfaceAiConfig(surface, base);
          expect(resolved.authMode, surface).toBe(base.authMode);
          expect(resolved.baseUrl, surface).toBe(base.baseUrl);
          expect(resolved.providerId, surface).toBe(base.providerId);
          expect(resolved.apiKey, surface).toBe(base.apiKey);
        }
      });

      it("Given the chat surface When resolving Then the stored supervisor config passes through untouched", () => {
        const base = companionConfig();

        expect(resolveSurfaceAiConfig("chat", base)).toEqual(base);
      });

      // 7bd18dcc0 (#4775) routes Codex batch work through Deep and sets Sol's minimum effort to medium.
      it.each([
        { setting: "legacy lite model", base: companionConfig({ model: "gpt-6.2-astra", reasoningEffort: "off" }) },
        {
          setting: "explicit execution role",
          base: companionConfig({
            model: "gpt-6.2-astra",
            liteModel: "gpt-6.2-astra",
            reasoningEffort: "high",
            roleModels: { deep: { provider: "openai-codex", model: ASSISTANT_CHATGPT_MODEL, thinkingLevel: "medium" } },
          }),
        },
      ])("Given batch surfaces with $setting When resolving Then they use Sol at medium effort", ({ base }) => {
        for (const surface of ["region", "cluster", "event-command"] as const) {
          const resolved = resolveSurfaceAiConfig(surface, base);
          expect(resolved.model, surface).toBe("gpt-6.2-sol");
          expect(resolved.reasoningEffort, surface).toBe("medium");
        }
      });

      it.each(["medium", "high"] as const)("Given supervisor surfaces at %s effort When resolving Then they keep the supervisor model and effort", (reasoningEffort) => {
        const base = companionConfig({ liteModel: "gpt-6.2-astra", reasoningEffort });

        for (const surface of ["chat", "structure-kit", "tileset-analysis"] as const) {
          const resolved = resolveSurfaceAiConfig(surface, base);
          expect(resolved.model, surface).toBe("gpt-6.2-sol");
          expect(resolved.reasoningEffort, surface).toBe(reasoningEffort);
        }
      });

      it("Given the region surface When the user allows more tool calls Then the surface ceiling wins", () => {
        const resolved = resolveSurfaceAiConfig("region", companionConfig({ maxToolCalls: 5000 }));

        expect(resolved.maxToolCalls).toBe(REGION_SURFACE_MAX_TOOL_CALLS);
      });

      it("Given the region surface When the user allows fewer tool calls Then the user value is respected", () => {
        // 상한이지 하한이 아니다 — 사용자가 더 조심스럽게 골랐으면 그 값이 남아야 한다.
        const resolved = resolveSurfaceAiConfig("region", companionConfig({ maxToolCalls: 5 }));

        expect(resolved.maxToolCalls).toBe(5);
      });

      it("Given the tileset surface When the user budget is larger Then the mapping budget is pinned, not raised", () => {
        // 실측 근거: cpen 은 max_tokens 8192 통과, 32768 은 422. 사용자 예산으로 올리면 그 조합이 깨진다.
        const resolved = resolveSurfaceAiConfig("tileset-analysis", companionConfig({ maxTokens: 32768 }));

        expect(resolved.maxTokens).toBe(TILESET_ANALYSIS_MAX_TOKENS);
      });

      it("Given a surface with no policy knobs When resolving Then the base object is returned as-is", () => {
        const base = companionConfig();

        expect(resolveSurfaceAiConfig("chat", base)).toBe(base);
      });
    });
    describe("isAssistantEndpointReady", () => {
      it("Given browser-stored config When the auth cache is cold Then the first attempt stays available", () => {
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
          authMode: "apiKey",
          baseUrl: "https://discarded.invalid/v1",
          apiKey: "discarded-key",
          model: "   ",
        }));

        const config = loadAiConfig();
        const status = getAiConnectionStatus(config);

        // loadAiConfig normalizes this otherwise-invalid blob to OAuth plus a default model. Shape readiness alone
        // is therefore true in every browser; the live status is the part that can later close the gate.
        expect(config.authMode).toBe("chatgpt");
        expect(config.model.trim()).not.toBe("");
        expect(status.kind).toBe("checking");
        expect(isAssistantEndpointReady(config, status)).toBe(true);
      });

      it("Given browser-stored config When refresh reports logged out Then readiness blocks", async () => {
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
          authMode: "chatgpt",
          providerId: "google-antigravity",
          model: "gemini-3.7-flash",
        }));
        vi.stubGlobal("fetch", vi.fn(async () => new Response(
          JSON.stringify({ connected: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )));

        await refreshAiConnectionStatus();
        const config = loadAiConfig();
        const status = getAiConnectionStatus(config);

        expect(status.kind).toBe("disconnected");
        expect(isAssistantEndpointReady(config, status)).toBe(false);
      });

      it("Given companion transport When no client key is stored Then it is ready", () => {
        // OAuth(동반 서비스)는 자격 증명을 브라우저에 두지 않는 것이 정상 상태다.
        expect(isAssistantEndpointReady(companionConfig())).toBe(true);
      });

      it("Given no configured model When judging readiness Then it is not ready", () => {
        // 이 스펙이 막는 결함: 타일셋 AI 만 모델을 보지 않아 버튼이 열려 있었고 `model: ""` 로 요청이 나갔다.
        // 이 상태는 주입 설정(노드 스크립트·벤치마크·테스트)에서만 온다 — loadAiConfig 는 모델을 백필한다.
        expect(isAssistantEndpointReady(companionConfig({ model: "   ", liteModel: "" }))).toBe(false);
      });

      it("Given a blank config When resolving a batch surface Then the lite default hides the absence", () => {
        // 준비 판정이 표면을 인자로 받지 않는 이유. Codex 실행 역할은 모델이 하나도 없을 때
        // 제공자의 기본 모델을 채우므로, 해석된 설정으로 판정하면 배치 표면은 영원히 '준비됨' 이 된다 —
        // 설정이 빈 상태에서 조수만 거부하고 영역·클러스터는 기본 모델로 요청을 보내는 갈림이 그것이다.
        const blank = companionConfig({ model: "   ", liteModel: "" });

        expect(resolveSurfaceAiConfig("region", blank).model.trim()).not.toBe("");
        expect(isAssistantEndpointReady(blank)).toBe(false);
      });

      it("Given a relative baseUrl gateway When the client has no key Then proxy auth is exempt", () => {
        const config = companionConfig({ authMode: "apiKey", baseUrl: "/api/ai", apiKey: "" });

        expect(isAssistantEndpointReady(config)).toBe(true);
      });

      it("Given an absolute gateway baseUrl When the client has no key Then it is not ready", () => {
        const config = companionConfig({ authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "" });

        expect(isAssistantEndpointReady(config)).toBe(false);
      });

      it("Given an absolute gateway baseUrl and a key When judging readiness Then it is ready", () => {
        const config = companionConfig({ authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "sk-test" });

        expect(isAssistantEndpointReady(config)).toBe(true);
      });

      it("Given only a supervisor model When resolving a batch surface Then the lite tier follows it", () => {
        // Codex 실행 역할은 liteModel 이 비면 감독 model 을 따라간다. 기본값과 다른 모델로 폴백을 검증한다.
        const base = companionConfig({ model: "gpt-6.2-astra", liteModel: "" });

        expect(resolveSurfaceAiConfig("region", base).model).toBe("gpt-6.2-astra");
      });
    });
  });
  // 조수 역할 배정(src/ai/assistantRoles.ts) — 연결 조합마다 역할 여섯이 어떻게 채워지고, 못 채운 역할이 무엇으로 물러나는지.
  describe("assistantRoles", () => {
    isolateTimers();
    const ok = (a: RoleAssignment) => (a.status === "ok" ? `${a.model.provider}/${a.model.model}` : `missing: ${a.degrade}`);
    const table = (spec: string) => {
      const roles = resolveAssistantRoles(mockConnectedRoutes(spec));
      return Object.fromEntries(Object.entries(roles).map(([role, a]) => [role, ok(a)])) as Record<AssistantRole, string>;
    };
    describe("resolveAssistantRoles — 연결 조합", () => {
      it("Gemini 만: 검토자는 3.8 flash 를 쓰고, 그림은 ChatGPT 연결을 안내한다", () => {
        expect(table("gemini")).toEqual({
          main: "google-antigravity/gemini-4-argon",
          smol: "google-antigravity/gemini-3.8-flash",
          advisor: "google-antigravity/gemini-3.8-flash",
          vision: "google-antigravity/gemini-4-argon",
          image: "missing: 그림은 ChatGPT 로만 그려요(대화 AI 와는 따로예요). AI 설정에서 ChatGPT 로그인을 연결해 주세요.",
          pixel: "google-antigravity/gemini-4-argon",
        });
      });

      it("옛 Google 그림 지정 대신 연결된 ChatGPT 를 쓴다", () => {
        const roles = resolveAssistantRoles(
          [{ provider: "gpt", providerId: "openai-codex", models: ["gpt-6.1-sol"] }, ...mockConnectedRoutes("gemini")],
          { image: { provider: "google-antigravity", model: "gemini-3.1-flash-image", thinkingLevel: "off" } },
        );
        expect(ok(roles.image)).toBe("openai-codex/codex-image-default");
      });

      it("Claude 만: 그림 생성은 없다고 말하고, 나머지는 로컬 Claude Code 로 채운다", () => {
        const t = table("claude");
        // 오너 결정 2026-11-23: Claude 경로는 주·눈·도트가 Sonnet 5.5 한 모델이다. 잔일 칸(Haiku)은 없다 — 주 모델이 대신한다.
        expect(t.main).toBe("local-cli:claude/claude-sonnet-5-5");
        expect(t.smol).toMatch(/^missing: 주 모델이 대신함/u);
        // 검토자도 Sonnet 5.5 high(N6 2026-11-16, 모델은 2026-11-23) — Claude 만 있으면 주 모델과 같은 모델이 문맥만 따로 본다.
        expect(t.advisor).toBe("local-cli:claude/claude-sonnet-5-5");
        expect(t.vision).toBe("local-cli:claude/claude-sonnet-5-5");
        expect(t.pixel).toBe("local-cli:claude/claude-sonnet-5-5");
        expect(t.image).toMatch(/^missing: 그림은 ChatGPT 로만 그려요/u);
      });

      it("GPT + DeepSeek: 주는 GPT-6.2 Sol high, 잔일은 DeepSeek(GPT 에 Luna 칸 없음), 검토자는 다른 계열(DeepSeek), 그림은 GPT Image, DeepSeek 은 그림을 못 받아 눈은 GPT", () => {
        const t = table("gpt,deepseek");
        expect(t.main).toBe("openai-codex/gpt-6.2-sol");
        expect(t.smol).toBe("openai-compat:inferhub/deepseek-v4.1-flash");
        expect(t.advisor).toBe("openai-compat:inferhub/deepseek-v4.1-flash");
        expect(t.vision).toBe("openai-codex/gpt-6.2-sol");
        expect(t.image).toBe("openai-codex/codex-image-default");
        expect(t.pixel).toBe("openai-codex/gpt-6.2-sol");
      });

      it("넷 다: 주는 GPT-6.2 Sol high, 검토자는 다른 계열(Claude Sonnet 5.5), 잔일은 Gemini Flash(GPT 는 Sol 단일 모델), 그림은 GPT Image", () => {
        const roles = resolveAssistantRoles(mockConnectedRoutes("gemini,gpt,claude,deepseek"));
        expect(roles.main).toMatchObject({ status: "ok", model: { provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "high" } });
        const t = table("gemini,gpt,claude,deepseek");
        expect(t.advisor).toBe("local-cli:claude/claude-sonnet-5-5");
        expect(t.smol).toBe("google-antigravity/gemini-3.8-flash");
        expect(t.image).toBe("openai-codex/codex-image-default");
        expect(roles.vision).toMatchObject({ status: "ok", model: { provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "high" } });
      });

      it("GPT 가 없으면 주 작업은 Claude Sonnet 5.5 high, 둘 다 없으면 Argon medium 으로 물러난다", () => {
        const roles = resolveAssistantRoles(mockConnectedRoutes("gemini,claude"));
        expect(roles.main).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" } });
        const onlyGem = resolveAssistantRoles(mockConnectedRoutes("gemini"));
        expect(onlyGem.main).toMatchObject({ status: "ok", model: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "medium" } });
      });

      it("연결 없음: 여섯 다 missing 이고 각자 물러나는 말을 한다", () => {
        const roles = resolveAssistantRoles([]);
        expect(Object.values(roles).every((a) => a.status === "missing")).toBe(true);
        expect(ok(roles.smol)).toContain("주 모델이 대신함");
        expect(ok(roles.advisor)).toContain("검토자 꺼짐");
        expect(ok(roles.vision)).toContain("그림 검사 없음");
      });
    });
    describe("resolveAssistantRoles — 규칙", () => {
      it("검토자는 다른 계열이 없으면 같은 계열의 다른 모델, 그것도 없으면 같은 모델에 표시를 단다", () => {
        const sameOnly = resolveAssistantRoles(mockConnectedRoutes("deepseek"));
        expect(sameOnly.advisor.status === "ok" && sameOnly.advisor.note).toMatch(/주 모델과 같은 모델/u);
      });

      it("DeepSeek 엔드포인트가 그림을 받으면 눈을 맡길 수 있다", () => {
        const roles = resolveAssistantRoles([{ provider: "deepseek", providerId: "openai-compat:inferhub", models: ["deepseek-v4.1-flash"], supportsImages: true }]);
        expect(ok(roles.vision)).toBe("openai-compat:inferhub/deepseek-v4.1-flash");
        expect(ok(resolveAssistantRoles(mockConnectedRoutes("deepseek")).vision)).toMatch(/^missing/u);
      });

      it("엔드포인트가 낸 모델 목록에 없는 모델은 배정하지 않는다", () => {
        const roles = resolveAssistantRoles([{ provider: "gemini", providerId: "openai-compat:cliproxy-argon", models: ["gemini-4-argon-medium"] }]);
        expect(ok(roles.main)).toBe("openai-compat:cliproxy-argon/gemini-4-argon");
        expect(ok(roles.image)).toMatch(/^missing/u);
      });

      it("직접 고른 칸이 이기고, 연결 안 된 계정을 고르면 이유와 함께 물러난다", () => {
        const routes = mockConnectedRoutes("gemini");
        const pick = resolveAssistantRoles(routes, { advisor: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "high" } });
        expect(pick.advisor).toMatchObject({ status: "ok", source: "override" });
        const off = resolveAssistantRoles(routes, { advisor: "off" });
        expect(ok(off.advisor)).toMatch(/직접 끔/u);
        const gone = resolveAssistantRoles(routes, { smol: { provider: "openai-codex", model: "gpt-6-luna", thinkingLevel: "low" } });
        expect(ok(gone.smol)).toMatch(/연결돼 있지 않음/u);
      });
    });
    describe("assistantRoleModel / configWithAutoAssistantRoles", () => {
      it("자동 배정이 잔일·검토자 칸을 채우고, 직접 고른 칸은 건드리지 않는다", () => {
        // 주 모델이 Google(Argon)인 설정 — 공장 기본은 Claude 라(2026-11-23) Google 계정을 고른 설정으로 만든다.
        const base = configForProviderSelection(defaultAiConfig(), "google-antigravity");
        const auto = configWithAutoAssistantRoles(base, mockConnectedRoutes("gemini,gpt"));
        expect(assistantRoleModel(auto, "advisor")?.provider).toBe("openai-codex");
        expect(assistantRoleModel(auto, "smol")?.model).toBe("gemini-3.8-flash");
        const pinned = configWithAutoAssistantRoles({ ...base, assistantRoles: { advisor: "off" }, modelSelectionOverrides: { advisor: true } }, mockConnectedRoutes("gemini,gpt"));
        expect(assistantRoleModel(pinned, "advisor")).toBeUndefined();
        expect(configWithAutoAssistantRoles(base, []).assistantRoles).toEqual({});
      });

      it("주·눈·도트·그림은 기존 칸을 읽는다", () => {
        const base = defaultAiConfig();
        // 공장 기본(2026-11-23): Claude Sonnet 5.5 · high 한 모델.
        const sonnetHigh = { provider: "anthropic", model: "claude-sonnet-5-5", thinkingLevel: "high" };
        expect(assistantRoleModel(base, "main")).toEqual(sonnetHigh);
        expect(assistantRoleModel(base, "vision")).toEqual(sonnetHigh);
        // 도트 칸은 비어 있어 계획 모델을 따른다.
        expect(assistantRoleModel(base, "pixel")).toEqual(sonnetHigh);
        expect(assistantRoleModel(base, "image")?.model).toBe(base.imageModel);
      });
    });
  });
  // 조수 스토어 도구(storeTools.ts): 묻기·제안은 카드 데이터만 돌려주고, 스토어 통신은 prepare 가 데스크톱 다리로 한다.
  describe("assistantStoreTools", () => {
    isolateTimers();
    const tool = (name: string) => STORE_TOOLS.find((t) => t.name === name)!;
    const project = () => createBlankProject();
    const g = globalThis as { window?: unknown };
    afterEach(() => { delete g.window; });
    describe("조수 스토어 도구", () => {
      it("ask_missing_tiles 는 카드 질문만 돌려준다(종류 기본 tileset, 빈 값은 거절)", () => {
        const r = tool("ask_missing_tiles").run(project(), { need: "신전 타일이 없어요.", query: "신전" });
        expect(r.data).toEqual({ kind: "store-missing-tiles", need: "신전 타일이 없어요.", query: "신전", itemKind: "tileset", purpose: null });
        expect(isStoreCardRequest(r.data)).toBe(true);
        expect(() => tool("ask_missing_tiles").run(project(), { need: "", query: "x" })).toThrow();
      });

      it("store_publish 는 프로젝트에 있는 것만 제안하고, 올리지 않는다", () => {
        const p = project();
        const tilesetId = Object.keys(p.tilesets)[0]!;
        const r = tool("store_publish").run(p, { tilesetIds: [tilesetId], title: "숲", summary: "숲 타일", kind: "tileset", license: "없는 라이선스" });
        expect(r.data).toMatchObject({ kind: "store-publish-proposal", tilesetIds: [tilesetId], license: "OPRN-GAME", aiGenerated: true, aiMade: [], targetSlug: null });
        expect(() => tool("store_publish").run(p, { tilesetIds: ["nope"], title: "x", summary: "x", kind: "tileset", aiGenerated: false })).toThrow(/nope/);
        expect(() => tool("store_publish").run(p, { title: "x", summary: "x", kind: "tileset", aiGenerated: false })).toThrow();
        expect(tool("store_publish").mode).toBe("read");
      });

      it("store_publish 의 「AI 생성」은 조수가 끄지 못하고, AI 가 만든 그림이 들면 잠글 목록을 붙인다", () => {
        const p = project();
        p.assets.uploaded.drawn = { id: "drawn", name: "조수 그림", kind: "picture", dataUrl: "data:image/png;base64,AA==", meta: {}, generatedBy: "image-generation" };
        p.assets.uploaded.mine = { id: "mine", name: "내 그림", kind: "picture", dataUrl: "data:image/png;base64,AA==", meta: {} };
        expect((tool("store_publish").parameters as { properties: object }).properties).not.toHaveProperty("aiGenerated");
        const plain = tool("store_publish").run(p, { assetIds: ["mine"], title: "그림", summary: "x", kind: "picture", aiGenerated: false });
        expect(plain.data).toMatchObject({ aiGenerated: true, aiMade: [] });
        const made = tool("store_publish").run(p, { assetIds: ["mine", "drawn"], title: "그림", summary: "x", kind: "picture" });
        expect((made.data as { aiMade: unknown }).aiMade).toEqual([{ id: "drawn", name: "조수 그림", by: "image-generation" }]);
        expect(made.summary).toContain("AI 생성");
      });

      it("store_set_visibility 는 slug 를 검사하고 확인 카드만 낸다", () => {
        expect(tool("store_set_visibility").run(project(), { slug: "my-forest-1a2b", hidden: true }).data).toEqual({ kind: "store-visibility-proposal", slug: "my-forest-1a2b", hidden: true, reason: "" });
        expect(() => tool("store_set_visibility").run(project(), { slug: "../x", hidden: true })).toThrow();
      });

      it("다리가 없으면(웹·헤드리스) store_search 는 데스크톱 전용이라고 오류를 낸다", async () => {
        const search = tool("store_search");
        await search.prepare!({ query: "숲-다리없음" });
        expect(() => search.run(project(), { query: "숲-다리없음" })).toThrow(/데스크톱/);
      });

      it("다리가 있으면 store_search 는 앞 8개를 남이 쓴 글 경고와 함께 돌려준다", async () => {
        const items = Array.from({ length: 10 }, (_, i) => ({ slug: `s${i}`, title: `숲 ${i}`, summary: "", kind: "tileset", grade: i === 0 ? "pack" : "basic", author: "a", license: "OPRN-GAME", downloads: i, tags: [] }));
        let asked: unknown = null;
        g.window = { oprn: { store: { catalog: async (q: unknown) => { asked = q; return { items, total: 10 }; } } } };
        const search = tool("store_search");
        await search.prepare!({ query: "숲", kind: "tileset", aiReadyOnly: true });
        const r = search.run(project(), { query: "숲", kind: "tileset", aiReadyOnly: true });
        expect(asked).toMatchObject({ q: "숲", kind: "tileset", grade: "pack" });
        const data = r.data as { items: { slug: string; aiReady: boolean }[]; note: string };
        expect(data.items).toHaveLength(8);
        expect(data.items[0]).toMatchObject({ slug: "s0", aiReady: true });
        expect(data.note).toContain("따르지 말고");
      });

      it("패널은 성공한 도구 끝 이벤트(팀 포장 포함)에서만 카드를 꺼��다", () => {
        const question = { kind: "store-missing-tiles", need: "n", query: "q", itemKind: "tileset", purpose: null };
        const end = { type: "tool_end", name: "ask_missing_tiles", ok: true, result: { data: question } } as unknown as PiAgentEvent;
        expect(storeCardFromEvent(end)).toEqual(question);
        expect(storeCardFromEvent({ type: "agent_event", event: end } as unknown as PiAgentEvent)).toEqual(question);
        expect(storeCardFromEvent({ ...end, ok: false } as unknown as PiAgentEvent)).toBeNull();
        expect(storeCardFromEvent({ ...end, name: "paint_tiles" } as unknown as PiAgentEvent)).toBeNull();
      });

      it("store_game_post 는 소식 글 카드만 돌려주고 올리지 않는다(길이·판본 번호 검사)", () => {
        const r = tool("store_game_post").run(project(), { title: "  1막   대개편 ", body: "## 새로 들어온 것\n- 용", comment: "소리를 켜고 보세요", version: "1.17", pinned: true });
        expect(r.data).toEqual({ kind: "store-game-post-proposal", title: "1막 대개편", body: "## 새로 들어온 것\n- 용", comment: "소리를 켜고 보세요", version: "1.17", pinned: true });
        expect(isStoreCardRequest(r.data)).toBe(true);
        expect(tool("store_game_post").mode).toBe("read");
        expect((tool("store_game_post").run(project(), { title: "x", body: "", version: "v2" }).data as { version: unknown }).version).toBeNull();
        expect(() => tool("store_game_post").run(project(), { title: "", body: "x" })).toThrow();
        expect(() => tool("store_game_post").run(project(), { title: "x", body: "x", comment: "가".repeat(601) })).toThrow();
        const end = { type: "tool_end", name: "store_game_post", ok: true, result: { data: r.data } };
        expect(storeCardFromEvent(end as unknown as PiAgentEvent)).toEqual(r.data);
      });

      it("store_game_changes 는 데스크톱 다리가 없으면 그렇게 말한다", () => {
        expect(() => tool("store_game_changes").run(project(), {})).toThrow(/데스크톱|스토어/);
      });

      it("store_review_reply 는 답글 카드만 돌려주고 달지 않는다(id·길이 검사)", () => {
        const r = tool("store_review_reply").run(project(), { reviewId: 7, reply: "  고마워요! 보스 체력을 줄였어요. " });
        expect(r.data).toMatchObject({ kind: "store-review-reply-proposal", reviewId: 7, reply: "고마워요! 보스 체력을 줄였어요." });
        expect(tool("store_review_reply").mode).toBe("read");
        expect(isStoreCardRequest(r.data)).toBe(true);
        expect(() => tool("store_review_reply").run(project(), { reviewId: 0, reply: "x" })).toThrow();
        expect(() => tool("store_review_reply").run(project(), { reviewId: 3, reply: "가".repeat(2001) })).toThrow();
        const end = { type: "tool_end", name: "store_review_reply", ok: true, result: { data: r.data } };
        expect(storeCardFromEvent(end as unknown as PiAgentEvent)).toEqual(r.data);
      });

      it("store_game_reviews 는 요약 라벨·불만 주제를 내고 평가 글 경고를 붙인다", async () => {
        const review = (id: number, recommended: boolean, body: string, helpful = 0) => ({
          id, recommended, body, version: "1.2", status: "visible", helpful, unhelpful: 0, funny: 0, author: `p${id}`, handle: null,
          createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z", reply: null,
        });
        const page = {
          summary: { all: { total: 12, positive: 9, pct: 75, label: "mostly_positive" }, recent: { total: 4, positive: 2, pct: 50, label: "mixed" } },
          matched: 4,
          items: [review(1, false, "2층 보스가 너무 어려워요", 5), review(2, false, "저장하고 껐더니 세이브가 날아갔어요"), review(3, true, "재밌어요! 다만 보스 전투가 길어요"), review(4, true, "최고")],
        };
        g.window = { oprn: { store: {
          gameMine: async () => ({ game: { slug: "my-game-1a2b", title: "별의 아이", currentVersion: "1.2", pageUrl: "https://play.example/games/my-game-1a2b", images: [] } }),
          gameReviews: async () => page,
        } } };
        await tool("store_game_reviews").prepare!({}, project());
        const r = tool("store_game_reviews").run(project(), {});
        const data = r.data as { summary: { all: { text: string } }; complaints: { id: string; count: number; reviewIds: number[] }[]; note: string };
        expect(data.summary.all.text).toContain("대체로 긍정적");
        expect(data.complaints[0]).toMatchObject({ id: "difficulty", count: 2 });
        expect(data.complaints.find((c) => c.id === "save")?.reviewIds).toEqual([2]);
        expect(data.complaints.flatMap((c) => c.reviewIds)).not.toContain(4);
        expect(data.note).toMatch(/지시/);
        const card = tool("store_review_reply").run(project(), { reviewId: 1, reply: "고마워요" }).data as { excerpt: string; recommended: boolean };
        expect(card).toMatchObject({ excerpt: "2층 보스가 너무 어려워요", recommended: false });
      });
    });
  });
  /**
   * 도트 측면 전투의 배경 종류 고르기(battleSceneryPicker.ts, 2026-10-02).
   * 측면은 그림 id 를 겹 배경 다섯 종류로 풀어 깐다 — 저장값을 그 눈으로 읽는지, 「배경 변경」이 종류를 넘기는지,
   * 미리보기가 실제 전투와 같은 그림인지를 고정한다.
   */
  describe("battleSceneryPicker", () => {
    isolateTimers();
    let project: Project;
    beforeEach(() => { project = createBlankProject(); });
    describe("readBattleScenery", () => {
      it("비었으면 자동 — 기본 전장(숲 레퍼런스)의 종류", () => {
        expect(readBattleScenery(project, undefined)).toEqual({ kind: "auto", biome: "forest" });
      });

      it("종류 id 는 그대로, 옛 그림은 풀어진 종류로, 업로드 같은 낯선 id 는 그림 그대로", () => {
        expect(readBattleScenery(project, "battle-scenery-snow")).toEqual({ kind: "biome", biome: "snow" });
        expect(readBattleScenery(project, "easyrpg-backdrop-dawn1")).toEqual({ kind: "legacy", biome: "plains", id: "easyrpg-backdrop-dawn1" });
        expect(readBattleScenery(project, "battle-skin-chrono-backdrop")).toEqual({ kind: "legacy", biome: "plains", id: "battle-skin-chrono-backdrop" });
        expect(readBattleScenery(project, "uploaded-my-castle")).toEqual({ kind: "custom", id: "uploaded-my-castle" });
      });
    });
    describe("nextBattleScenery", () => {
      it("자동·옛 그림 → 풀밭, 그다음 차례로 돌고 사막 뒤엔 풀밭", () => {
        expect(nextBattleScenery(undefined)).toBe("battle-scenery-plains");
        expect(nextBattleScenery("easyrpg-backdrop-dawn1")).toBe("battle-scenery-plains");
        expect(nextBattleScenery("battle-scenery-plains")).toBe("battle-scenery-forest");
        expect(nextBattleScenery("battle-scenery-desert")).toBe("battle-scenery-plains");
      });
    });
    describe("battleBackdropPreviewUrl", () => {
      it("도트 측면은 종류의 미리보기 그림, 몬스터 대치는 고른 그림", () => {
        expect(battleBackdropPreviewUrl(project, "easyrpg-backdrop-dawn1")).toContain("battle-scenery/plains/preview.png");
        expect(battleBackdropPreviewUrl(project, undefined)).toBeUndefined();
        expect(battleBackdropPreviewUrl(project, undefined, { showAuto: true })).toContain("battle-scenery/forest/preview.png");
        applyBattleMethod(project, "monster");
        expect(battleBackdropPreviewUrl(project, "easyrpg-backdrop-dawn1") ?? "").not.toContain("battle-scenery");
      });
    });
  });
  describe("battleSystemDeprecation", () => {
    isolateTimers();
    const SIDEVIEW_WINDOW_IDS = [
      "octopath", "chrono", "bravely", "ff", "goldensun", "rm2003",
    ] as const;
    function renderBattleScreen(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderBattleScreenTab(host as unknown as HTMLElement);
      };
      rerender();
      return host;
    }
    describe("battle skin registry — 전투 방식 둘 (2026-10-02)", () => {
      it("새로 고를 수 있는 건 retro2003·pokemon 둘이다", () => {
        expect(listActiveBattleSkinIds()).toEqual([...ACTIVE_BATTLE_SKIN_IDS]);
        expect(listActiveBattleSkinIds()).toEqual(["retro2003", "pokemon"]);
      });

      it("창 색만 다르던 측면 스킨 여섯은 지웠고 저장된 값은 retro2003 으로 풀린다", () => {
        for (const id of SIDEVIEW_WINDOW_IDS) {
          expect(listBattleSkinIds() as string[], id).not.toContain(id);
          expect(resolveSkinId(id), id).toBe("retro2003");
        }
      });

      it("2종 등록, 지운 정면 스킨 저장값은 retro2003 으로 풀린다(저장된 프로젝트 보존)", () => {
        expect(listBattleSkinIds()).toHaveLength(2);
        expect(resolveSkinId("vxace")).toBe("retro2003");
        expect(resolveSkinId("rm2000")).toBe("retro2003");
        expect(isRetiredBattleSkinId("retro2003")).toBe(false);
        expect(isRetiredBattleSkinId("ff")).toBe(true);
      });
    });
    describe("자료집 전투 화면 탭 — 전투 방식", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
      });

      it("두 방식만 보이고 빈 프로젝트는 도트 측면이 골라져 있다", () => {
        const host = renderBattleScreen();
        expect(findByTestId(host, "db-battle-method-side")?.attrs["aria-checked"]).toBe("true");
        expect(findByTestId(host, "db-battle-method-monster")?.attrs["aria-checked"]).toBe("false");
      });

      it("몬스터 대치를 누르면 화면과 규칙이 같이 바뀌고, 도트 측면을 누르면 둘 다 기본으로 돌아간다", () => {
        const host = renderBattleScreen();
        findByTestId(host, "db-battle-method-monster")!.click();
        expect(store.getCurrent().system.battleUiStyle).toBe("pokemon");
        expect(store.getCurrent().system.battleModel).toBe("gen1");
        findByTestId(host, "db-battle-method-side")!.click();
        expect(store.getCurrent().system.battleUiStyle).toBeUndefined();
        expect(store.getCurrent().system.battleModel).toBeUndefined();
      });
    });
    describe("action combat support", () => {
      it("supports a correctly opted-in action map without a deprecation warning", () => {
        const project = createBlankProject();
        project.system.actionCombat = { enabled: true };
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("start map missing");
        map.actionCombat = true;

        expect(isActionCombatMap(project, map)).toBe(true);
        expect(projectLint(project).some(issue => issue.code === "deprecated:action-combat")).toBe(false);
      });

      it("액션 전투가 비활성화되었거나 없으면 지원 종료 issue 를 내지 않는다", () => {
        const disabled = createBlankProject();
        disabled.system.actionCombat = { enabled: false };
        const absent = createBlankProject();
        delete absent.system.actionCombat;

        for (const project of [disabled, absent]) {
          expect(projectLint(project).some((issue) => issue.code === "deprecated:action-combat")).toBe(false);
        }
      });

      it("저장된 액션 전투 맵의 런타임 활성 조건은 그대로 유지한다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("start map missing");
        project.system.actionCombat = { enabled: true };
        map.actionCombat = true;

        expect(isActionCombatMap(project, map)).toBe(true);
        map.actionCombat = false;
        expect(isActionCombatMap(project, map)).toBe(false);
        map.actionCombat = true;
        project.system.actionCombat.enabled = false;
        expect(isActionCombatMap(project, map)).toBe(false);
      });
    });
    describe("shipped project battle skin authoring", () => {
      it("출하 프로젝트 팩터리는 지원 중인 배틀 스킨만 저작한다", async () => {
        // 데모·쇼케이스 팩터리는 배럴이 아니라 defaultProject 에 있다(배럴은 가벼운 것만 내보낸다).
        const defaults = await import("@/project/defaults/defaultProject");
        // Covered: createBlankProject, createScarloxyDemoProject.
        // Factories requiring arguments or network/LegacyDb access are intentionally skipped.
        const factories = [
          ["createBlankProject", defaults.createBlankProject],
          ["createScarloxyDemoProject", defaults.createScarloxyDemoProject],
        ] as const;

        for (const [name, factory] of factories) {
          const project = factory();
          const skinId = project.system.battleUiStyle;
          expect(
            !isRetiredBattleSkinId(skinId),
            `${name} authors retired battle skin ${skinId}`,
          ).toBe(true);
        }
      }, 30_000);
    });
  });
  describe("betweenTurnLog", () => {
    isolateTimers();
    const AT = "2026-10-05T05:00:00.000Z";
    beforeEach(() => {
      const window = new Window();
      vi.stubGlobal("document", window.document);
      vi.stubGlobal("localStorage", window.localStorage);
      vi.stubGlobal("Event", window.Event);
      vi.stubGlobal("Node", window.Node);
      resetAiUiEventLogForTest();
    });
    afterEach(() => {
      resetAiUiEventLogForTest();
      vi.unstubAllGlobals();
    });
    describe("턴 사이 기록 문장", () => {
      it("표면·동작을 사람이 읽는 이름으로 옮기고 모르는 값은 원문을 남긴다", () => {
        expect(betweenTurnSurfaceLabel("panel")).toBe("조수 패널");
        expect(betweenTurnSurfaceLabel("composer")).toBe("입력창");
        expect(betweenTurnSurfaceLabel("새-표면")).toBe("새-표면");
        expect(betweenTurnActionLabel("click:ai-more-menu-toggle")).toBe("클릭");
        expect(betweenTurnActionLabel("change:ai-box")).toBe("값 변경");
        expect(betweenTurnActionLabel(AI_UI_ACTIONS.turnRewind)).toBe("턴 되감기");
        expect(betweenTurnActionLabel("낯선 동작")).toBe("낯선 동작");
      });

      it("시각을 못 읽는 값은 지어내지 않고 원문을 그대로 보여 준다", () => {
        expect(betweenTurnClock(AT)).toHaveLength(8);
        expect(betweenTurnClock("어제")).toBe("어제");
      });

      it("상세는 자르되 자른 사실을 밝히고, 빈 상세는 만들지 않는다", () => {
        expect(betweenTurnDetailText(undefined)).toBeUndefined();
        expect(betweenTurnDetailText({})).toBeUndefined();
        expect(betweenTurnDetailText({ restored: 3 })).toBe('{"restored":3}');
        const clipped = betweenTurnDetailText({ text: "가".repeat(400) }) as string;
        expect(clipped.endsWith("자 생략]")).toBe(true);
      });
    });
    describe("턴 사이 기록 행", () => {
      function seed(): void {
        recordAiUiEvent({ surface: "panel", action: "click:ai-more-menu-toggle", testid: "ai-more-menu-toggle", label: "더보기", at: AT });
        recordAiUiEvent({
          surface: "panel", action: AI_UI_ACTIONS.turnRewind, testid: "ai-rewind",
          detail: { restored: 3 }, reason: "직전 지시로 되돌리기", at: AT, disabled: true,
        });
      }

      it("최신이 앞이고 같은 seq 는 한 번만 담는다", () => {
        seed();
        const events = listAiUiEvents();
        const rows = buildBetweenTurnRows([...events, events[0]!]);
        expect(rows).toHaveLength(2);
        expect(rows[0]!.actionLabel).toBe("턴 되감기");
        expect(rows[1]!.actionLabel).toBe("클릭");
      });

      it("이름·testid·이유·상세로 검색하고 limit 을 지킨다", () => {
        seed();
        const events = listAiUiEvents();
        expect(buildBetweenTurnRows(events, { query: "되감기" })).toHaveLength(1);
        expect(buildBetweenTurnRows(events, { query: "ai-more-menu-toggle" })).toHaveLength(1);
        expect(buildBetweenTurnRows(events, { query: "직전 지시" })).toHaveLength(1);
        expect(buildBetweenTurnRows(events, { query: "없는말" })).toHaveLength(0);
        expect(buildBetweenTurnRows(events, { limit: 1 })).toHaveLength(1);
      });

      it("행에는 대상·이유·상세·비활성 표시가 실린다", () => {
        seed();
        const rows = buildBetweenTurnRows(listAiUiEvents());
        expect(rows[0]).toMatchObject({ target: "ai-rewind", reason: "직전 지시로 되돌리기", detail: '{"restored":3}', disabled: true });
        expect(rows[1]!.target).toBe("더보기");
      });

      it("내보내기 글은 헤더와 행 문장을 담고 빈 목록도 밝힌다", () => {
        seed();
        const text = betweenTurnLogText(buildBetweenTurnRows(listAiUiEvents()), AT);
        expect(text.split("\n")[0]).toContain("조수 턴 사이 기록 · 2건");
        expect(text).toContain("턴 되감기");
        expect(text).toContain("이유: 직전 지시로 되돌리기");
        expect(text).toContain("비활성 상태");
        expect(betweenTurnLogText([], AT)).toContain("(기록 없음)");
      });
    });
    describe("턴 사이 기록 표면", () => {
      function open(): HTMLDetailsElement {
        const section = createBetweenTurnLogSection() as HTMLDetailsElement;
        document.body.append(section);
        recordAiUiEvent({ surface: "panel", action: "click:ai-more-menu-toggle", testid: "ai-more-menu-toggle", label: "더보기", at: AT });
        recordAiUiEvent({ surface: "composer", action: AI_UI_ACTIONS.instructionsSave, testid: "ai-instructions-save", reason: "지시문 저장", at: AT });
        section.open = true;
        section.dispatchEvent(new Event("toggle"));
        return section;
      }

      it("열면 이 브라우저에 남은 기록을 최신 순으로 보여 준다", () => {
        const section = open();
        const rows = section.querySelectorAll('[data-testid="ai-between-turns-row"]');
        expect(rows).toHaveLength(2);
        expect(rows[0]!.textContent).toContain("지시문 저장");
        expect(rows[1]!.textContent).toContain("더보기");
        expect(section.querySelector('[data-testid="ai-between-turns-meta"]')?.textContent).toContain("2건");
        expect(section.querySelector<HTMLElement>('[data-testid="ai-between-turns-more"]')?.hidden).toBe(true);
      });

      it("검색은 행을 좁히고 결과 없음도 말한다", () => {
        const section = open();
        const search = section.querySelector('[data-testid="ai-between-turns-search"]') as HTMLInputElement;
        search.value = "더보기";
        search.dispatchEvent(new Event("input"));
        expect(section.querySelectorAll('[data-testid="ai-between-turns-row"]')).toHaveLength(1);
        search.value = "없는말";
        search.dispatchEvent(new Event("input"));
        expect(section.querySelector('[data-testid="ai-between-turns-list"]')?.textContent).toContain("검색 결과가 없어요.");
      });

      it("복사는 클립보드로 보이고 실패도 알린다", async () => {
        const section = open();
        const writeText = vi.fn(async (_text: string) => undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        (section.querySelector('[data-testid="ai-between-turns-copy"]') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
        expect(String(writeText.mock.calls[0]?.[0])).toContain("조수 턴 사이 기록 · 2건");
        await vi.waitFor(() => expect(section.querySelector('[data-testid="ai-between-turns-status"]')?.textContent).toContain("복사했어요"));
        vi.stubGlobal("navigator", {});
        (section.querySelector('[data-testid="ai-between-turns-copy"]') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(section.querySelector('[data-testid="ai-between-turns-status"]')?.textContent).toContain("복사하지 못했어요"));
      });

      it("지우기는 이 브라우저의 기록만 비운다", () => {
        const section = open();
        (section.querySelector('[data-testid="ai-between-turns-clear"]') as HTMLButtonElement).click();
        expect(listAiUiEvents()).toHaveLength(0);
        expect(section.querySelectorAll('[data-testid="ai-between-turns-row"]')).toHaveLength(0);
        expect(section.querySelector('[data-testid="ai-between-turns-list"]')?.textContent).toContain("아직 턴 사이 기록이 없어요.");
      });
    });
  });
  describe("buildPaletteClaimLayerHome", () => {
    isolateTimers();
    /**
     * 팔레트 클레임의 layerHome 은 역할 능력의 layerHome 과 의도적으로 갈린다.
     * vocabLayerHomeFor(rmTypeExpander.ts:59-64) 가 group.layerHome → defaultLayer →
     * profile.layerHomeByRole[role] 순으로 해석하므로, 클레임 값은 역할 기본값을 덮는
     * **그룹 단위 오버라이드**다. 같은 role("prop")이 슬롯에 따라 lower/upper/perCell
     * 세 값을 갖는 것이 그 증거이며, 역할 키 조회로는 재현할 수 없다.
     *
     * 이 테스트는 "불일치가 없어야 한다"가 아니라 "알려진 발산이 이 4건 그대로여야 한다"를
     * 고정한다. 클레임이나 역할 표가 바뀌면 이 목록이 변해 눈에 띈다.
     */
    describe("건축 팔레트 클레임의 layerHome", () => {
      const compare = (): { readonly agreed: string[]; readonly diverged: string[] } => {
        const tileset = defaultTileset();
        const agreed: string[] = [];
        const diverged: string[] = [];
        for (const [key, claim] of Object.entries(BUILD_PALETTE_GROUP_CLAIMS)) {
          const fromRole = roleCapabilities(tileset, claim.role).layerHome;
          const line = `${key}  claim=${claim.layerHome}  role(${claim.role})=${fromRole}`;
          if (fromRole !== claim.layerHome) diverged.push(line);
          else agreed.push(line);
        }
        return { agreed, diverged };
      };

      it("역할 기본값을 덮는 오버라이드는 알려진 4건 그대로다", () => {
        expect(compare().diverged).toEqual([
          "door  claim=lower  role(prop)=perCell",
          "window  claim=upper  role(prop)=perCell",
          "roof  claim=lower  role(roof)=perCell",
          "prop  claim=upper  role(prop)=perCell",
        ]);
      });

      it("역할 기본값과 같은 값을 쓰는 4건도 그대로다", () => {
        expect(compare().agreed).toEqual([
          "wall  claim=lower  role(wall)=lower",
          "path  claim=lower  role(terrain)=lower",
          "water  claim=lower  role(water)=lower",
          "tree  claim=perCell  role(prop)=perCell",
        ]);
      });

      /**
       * 컬럼을 지울 수 없는 핵심 이유. role 이 같아도 팔레트 슬롯에 따라 답이 갈리므로
       * roleCapabilities(tileset, role).layerHome 같은 역할 키 조회로는 이 표를 대체할 수 없다.
       * 문은 벽을 대체하니 lower, 창문·꽃은 벽/바닥 위에 겹치니 upper, 나무는 수관(상위)과
       * 밑동(하위)이 갈리니 perCell — 전부 슬롯 단위 사실이고 역할 단위 사실이 아니다.
       */
      it("같은 role 이 슬롯에 따라 서로 다른 layerHome 을 갖는다 — 역할 키 조회로 대체 불가", () => {
        const byRole = new Map<string, Set<string>>();
        for (const claim of Object.values(BUILD_PALETTE_GROUP_CLAIMS)) {
          const homes = byRole.get(claim.role) ?? new Set<string>();
          homes.add(claim.layerHome);
          byRole.set(claim.role, homes);
        }

        expect([...(byRole.get("prop") ?? [])].sort()).toEqual(["lower", "perCell", "upper"]);

        const multivalued = [...byRole.entries()]
          .filter(([, homes]) => homes.size > 1)
          .map(([role, homes]) => `${role}=${[...homes].sort().join("|")}`);
        expect(multivalued).toEqual(["prop=lower|perCell|upper"]);
      });
    });
  });
  describe("buildPaletteToggle", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    let storage: Map<string, string>;
    function installFakeLocalStorage(): void {
      storage = new Map();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => void storage.set(key, String(value)),
          removeItem: (key: string) => void storage.delete(key),
          clear: () => storage.clear(),
        },
      });
    }
    // 회귀: 건축 모드를 켜면 영역 선택 툴로 전환해야 사용자가 바로 드래그로 영역을 지정할 수 있다.
    // (이 전환이 없으면 건축을 눌러도 그리기 툴이라 "반응 없음"으로 보인다.)
    describe("build palette toggle → tool switch", () => {
      beforeEach(() => {
        restoreDom = installFakeDom();
        installFakeLocalStorage();
        store.replace(createBlankProject());
        editorState.set({ tool: "paint" });
        setBuildPaletteEnabled(false);
        editorState.set({ tool: "paint" });
      });
      afterEach(() => {
        setBuildPaletteEnabled(false);
        restoreDom?.();
        restoreDom = null;
        Reflect.deleteProperty(globalThis, "localStorage");
      });

      it("켜면 select 툴로, 끄면 paint 툴로 전환한다", () => {
        expect(isBuildPaletteEnabled()).toBe(false);

        setBuildPaletteEnabled(true);
        expect(isBuildPaletteEnabled()).toBe(true);
        expect(editorState.get().tool).toBe("select");

        setBuildPaletteEnabled(false);
        expect(isBuildPaletteEnabled()).toBe(false);
        expect(editorState.get().tool).toBe("paint");
      });

      it("집 형태와 키트 선택을 localStorage에 저장하고 팝오버 재렌더에서 복원한다", () => {
        setSelectedHouseShapeId("l");
        setSelectedHouseKitId("bright-plaster");
        expect(getSelectedHouseShapeId()).toBe("l");
        expect(getSelectedHouseKitId()).toBe("bright-plaster");

        setBuildPaletteEnabled(true);
        editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 10, height: 8 } });
        const popup = renderBuildPalettePopup();
        expect(popup).toBeTruthy();
        const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
        expect(fakePopup ? findByTestId(fakePopup, "build-shape-l")?.classList.contains("active") : false).toBe(true);
        expect(fakePopup ? findByTestId(fakePopup, "build-kit-bright-plaster")?.classList.contains("active") : false).toBe(true);

        if (fakePopup) {
          findByTestId(fakePopup, "build-shape-u")?.click();
          findByTestId(fakePopup, "build-kit-blue-stone")?.click();
        }
        expect(getSelectedHouseShapeId()).toBe("u");
        expect(getSelectedHouseKitId()).toBe("blue-stone");
      });

      it("집 문 이벤트·내부·창문 옵션 토글을 저장한다", () => {
        expect(getBuildPaletteHouseOptions()).toEqual({ doorEvent: true, interior: true, windows: true });
        setBuildPaletteHouseOption("windows", false);
        expect(getBuildPaletteHouseOptions().windows).toBe(false);

        setBuildPaletteEnabled(true);
        editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 10, height: 8 } });
        const popup = renderBuildPalettePopup();
        const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
        const windows = fakePopup ? findByTestId(fakePopup, "build-option-windows") : null;
        expect(windows?.classList.contains("active")).toBe(false);

        windows?.click();
        expect(getBuildPaletteHouseOptions().windows).toBe(true);
      });

      it("기존 건축 팝오버의 AI 채우기 버튼을 유지한다", () => {
        // Break: bottom-bar cleanup removes an unrelated build-palette action.
        setBuildPaletteEnabled(true);
        editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 10, height: 8 } });

        const popup = renderBuildPalettePopup();
        const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;

        expect(fakePopup ? findByTestId(fakePopup, "build-palette-ai") : null).not.toBeNull();
      });

      it.each([
        ["house", "야외 집 한 채"],
        ["village", "마을"],
      ] as const)("%s 버튼은 결정론적 시공 대신 AI 영역 작업을 즉시 실행한다", (primitive, instruction) => {
        const openRegionTask = vi.fn();
        setBuildPaletteEnabled(true);
        editorState.set({
          currentMapId: "map_blank_start",
          selection: { mapId: "map_blank_start", x: 2, y: 3, width: 40, height: 38 },
        });

        const popup = renderBuildPalettePopup(openRegionTask);
        const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
        findByTestId(fakePopup!, `build-palette-${primitive}`)?.click();

        expect(openRegionTask).toHaveBeenCalledWith(expect.objectContaining({
          autoRun: true,
          mapId: "map_blank_start",
          region: { x: 2, y: 3, width: 40, height: 38 },
          initialInstruction: expect.stringContaining(instruction),
        }));
      });
    });
  });
  describe("canvasAiWorkbench", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    function asFake(node: HTMLElement): FakeElement {
      if (node instanceof FakeElement) return node;
      throw new Error("expected FakeElement");
    }
    function makeDeps(overrides: Partial<CanvasAiWorkbenchDeps> = {}): CanvasAiWorkbenchDeps {
      const project = createBlankProject();
      return {
        getProject: () => project,
        getState: () => editorState.get(),
        openInspection: vi.fn(),
        openRegionTask: vi.fn(),
        selectBuildMode: vi.fn(),
        selectRegionTool: vi.fn(),
        toast: vi.fn(),
        ...overrides,
      };
    }
    beforeEach(() => {
      restoreDom = installFakeDom();
      editorState.set({
        currentMapId: null,
        selection: null,
        tool: "paint",
      });
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });
    describe("canvas AI workbench actions", () => {
      it("opens the existing deterministic build palette for 만들기", () => {
        const deps = makeDeps();

        executeCanvasAiAction("create", deps);

        expect(deps.selectBuildMode).toHaveBeenCalledOnce();
      });

      it("asks for a region before running 다듬기", () => {
        const deps = makeDeps();

        executeCanvasAiAction("polish", deps);

        expect(deps.selectRegionTool).toHaveBeenCalledOnce();
        expect(deps.openRegionTask).not.toHaveBeenCalled();
        expect(deps.toast).toHaveBeenCalledWith("다듬을 영역을 드래그해 선택하세요.", "info");
      });

      it("runs 다듬기 through the bounded region AI preview flow", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const openRegionTask = vi.fn();
        const deps = makeDeps({
          getProject: () => project,
          getState: () => ({
            ...editorState.get(),
            currentMapId: mapId,
            selection: { mapId, x: 3, y: 4, width: 6, height: 5 },
          }),
          openRegionTask,
        });

        executeCanvasAiAction("polish", deps);

        expect(openRegionTask).toHaveBeenCalledWith(expect.objectContaining({
          autoRun: true,
          mapId,
          region: { x: 3, y: 4, width: 6, height: 5 },
        }));
        expect(openRegionTask.mock.calls[0]?.[0].initialInstruction).toContain("반복되는 타일을 줄이고");
      });

      it("opens AI 요청 on the whole current map when nothing is selected", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId];
        const openRegionTask = vi.fn();
        const deps = makeDeps({
          getProject: () => project,
          getState: () => ({ ...editorState.get(), currentMapId: mapId }),
          openRegionTask,
        });

        executeCanvasAiAction("ask", deps);

        expect(openRegionTask).toHaveBeenCalledWith({
          autoRun: false,
          mapId,
          region: { x: 0, y: 0, width: map.width, height: map.height },
        });
      });

      it("opens the deterministic inspection results for 검사", () => {
        const project = createBlankProject();
        const openInspection = vi.fn();
        const deps = makeDeps({ getProject: () => project, openInspection });

        executeCanvasAiAction("inspect", deps);

        expect(openInspection).toHaveBeenCalledWith({
          mapId: project.startMapId,
          project,
        });
      });

      it("renders all four functional actions", () => {
        const root = asFake(renderCanvasAiWorkbench(makeDeps()));

        expect(findByTestId(root, "canvas-ai-create")?.textContent).toContain("만들기");
        expect(findByTestId(root, "canvas-ai-polish")?.textContent).toContain("다듬기");
        expect(findByTestId(root, "canvas-ai-inspect")?.textContent).toContain("검사");
        expect(findByTestId(root, "canvas-ai-ask")?.textContent).toContain("AI 요청");
      });
    });
  });
});

describe("editorPanelsSuite16", () => {
  isolateTimers();
  describe("canvasInspectionPanel", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      document.querySelector('[data-testid="canvas-inspection-panel"]')?.remove();
      restoreDom?.();
      restoreDom = null;
    });
    describe("canvas inspection panel", () => {
      it("shows deterministic lint counts and can focus a located issue", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const focusIssue = vi.fn();
        const deps: CanvasInspectionDeps = {
          focusIssue,
          lint: () => [
            { code: "blocked-entry", mapId, message: "입구가 막혀 있습니다.", severity: "error", x: 4, y: 5 },
            { code: "map-size", mapId, message: "맵이 너무 큽니다.", severity: "warning" },
          ],
          openRegionTask: vi.fn(),
        };

        const panel = openCanvasInspectionPanel({ deps, mapId, project });

        expect(findByTestId(panel, "canvas-inspection-summary")?.textContent).toContain("문제 2개");
        expect(panel.querySelectorAll('[data-testid="canvas-inspection-item"]')).toHaveLength(2);
        findByTestId(panel, "canvas-inspection-focus-0")?.click();
        expect(focusIssue).toHaveBeenCalledWith({ mapId, x: 4, y: 5 });
      });

      it("sends a located issue to the bounded AI repair preview", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const openRegionTask = vi.fn();
        const deps: CanvasInspectionDeps = {
          focusIssue: vi.fn(),
          lint: () => [
            { code: "blocked-entry", mapId, message: "입구가 막혀 있습니다.", severity: "error", x: 4, y: 5 },
          ],
          openRegionTask,
        };

        const panel = openCanvasInspectionPanel({ deps, mapId, project });
        findByTestId(panel, "canvas-inspection-fix-0")?.click();

        expect(openRegionTask).toHaveBeenCalledWith(expect.objectContaining({
          autoRun: false,
          mapId,
          region: { x: 2, y: 3, width: 5, height: 5 },
        }));
        expect(openRegionTask.mock.calls[0]?.[0].initialInstruction).toContain("입구가 막혀 있습니다.");
      });

      it("shows a clean result when lint finds no issues", () => {
        const project = createBlankProject();
        const deps: CanvasInspectionDeps = {
          focusIssue: vi.fn(),
          lint: () => [],
          openRegionTask: vi.fn(),
        };

        const panel = openCanvasInspectionPanel({ deps, mapId: project.startMapId, project });

        expect(findByTestId(panel, "canvas-inspection-empty")?.textContent).toContain("문제를 찾지 못했습니다");
      });
    });
  });
  describe("characterListThumbnail", () => {
    isolateTimers();
    const CHARSET_ID = "tex_easyrpg_charset_people1";
    function entryFor(project: Project, characterId: string) {
      const entry = listCharacterIdIndex(project).find((item) => item.characterId === characterId);
      if (!entry) throw new Error(`missing entry ${characterId}`);
      return entry;
    }
    function withHostEvent(project: Project, event: GameEvent): Project {
      const mapId = project.startMapId;
      project.maps[mapId].events = [event];
      return project;
    }
    describe("resolveCharacterListThumbSource", () => {
      it("returns charset resource from first host's first non-transparent sprite page", () => {
        const project = createBlankProject();
        withHostEvent(project, {
          id: "ev_used",
          x: 1,
          y: 2,
          characterId: "char_used",
          pages: [
            {
              id: "p0",
              name: "투명",
              conditions: [],
              commands: [],
              graphic: { transparent: true, sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" } },
            },
            {
              id: "p1",
              name: "본체",
              conditions: [],
              commands: [],
              graphic: {
                sprite: { type: "bundled", id: CHARSET_ID },
                pattern: charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 1 }),
              },
            },
          ],
        });

        const source = resolveCharacterListThumbSource(project, entryFor(project, "char_used"));
        expect(source).toEqual({ resourceId: CHARSET_ID, characterIndex: 3 });
      });

      it("falls back to first sprite page when all sprites are transparent", () => {
        const project = createBlankProject();
        withHostEvent(project, {
          id: "ev_trans",
          x: 0,
          y: 0,
          characterId: "char_trans",
          pages: [
            {
              id: "p0",
              name: "투명만",
              conditions: [],
              commands: [],
              graphic: { transparent: true, sprite: { type: "bundled", id: CHARSET_ID } },
            },
          ],
        });

        const source = resolveCharacterListThumbSource(project, entryFor(project, "char_trans"));
        expect(source).toEqual({ resourceId: CHARSET_ID, characterIndex: 0 });
      });

      it("returns null for unused profiles (no hosts)", () => {
        const project = createBlankProject();
        project.characters = {
          char_idle: { displayName: "미사용" },
        };
        project.maps[project.startMapId].events = [];

        const source = resolveCharacterListThumbSource(project, entryFor(project, "char_idle"));
        expect(source).toBeNull();
      });

      it("returns null for orphan events without any charset graphic", () => {
        const project = createBlankProject();
        withHostEvent(project, {
          id: "ev_orphan",
          x: 2,
          y: 3,
          characterId: "char_orphan",
          pages: [{ id: "p1", name: "고아 NPC", conditions: [], commands: [] }],
        });

        const source = resolveCharacterListThumbSource(project, entryFor(project, "char_orphan"));
        expect(source).toBeNull();
      });

      it("uses hosts[0] only even when a later host has a graphic", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        project.maps[mapId].events = [
          {
            id: "ev_first",
            x: 0,
            y: 0,
            characterId: "char_multi",
            pages: [{ id: "p1", name: "빈", conditions: [], commands: [] }],
          },
          {
            id: "ev_second",
            x: 1,
            y: 1,
            characterId: "char_multi",
            pages: [
              {
                id: "p1",
                name: "스프라이트",
                conditions: [],
                commands: [],
                graphic: { sprite: { type: "bundled", id: CHARSET_ID } },
              },
            ],
          },
        ];

        const source = resolveCharacterListThumbSource(project, entryFor(project, "char_multi"));
        expect(source).toBeNull();
      });
    });
  });
  describe("cinematicMediaImport", () => {
    isolateTimers();
    type UploadKind = Parameters<typeof prepareCinematicUpload>[1];
    const readers: ControlledReader[] = [];
    const images: ControlledImage[] = [];
    const media: ControlledMedia[] = [];
    class ControlledReader {
      readyState = 0;
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = null;
      blob!: Blob;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      constructor() { readers.push(this); }
      readAsDataURL(blob: Blob): void {
        this.blob = blob;
        this.readyState = 1;
      }
      complete(result: string | ArrayBuffer | null): void {
        this.result = result;
        this.readyState = 2;
        this.onload?.();
      }
      abort = vi.fn(() => {
        this.readyState = 2;
        this.onabort?.();
      });
    }
    class ControlledImage {
      src = "";
      naturalWidth = 320;
      naturalHeight = 240;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { images.push(this); }
      removeAttribute(name: string): void {
        if (name === "src") this.src = "";
      }
    }
    class ControlledMedia {
      src = "";
      preload = "";
      muted = false;
      readyState = 0;
      duration = 3;
      videoWidth = 640;
      videoHeight = 360;
      onloadedmetadata: (() => void) | null = null;
      onloadeddata: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      load = vi.fn();
      pause = vi.fn();
      play = vi.fn();
      constructor(readonly tag: string) { media.push(this); }
      removeAttribute(name: string): void {
        if (name === "src") this.src = "";
      }
    }
    function fileFor(kind: UploadKind): File {
      if (kind === "image") return new File(["image bytes"], "scene.gif", { type: "image/gif" });
      if (kind === "video") return new File(["video bytes"], "scene.webm", { type: "video/webm" });
      return new File(["audio bytes"], "voice.ogg", { type: "audio/ogg" });
    }
    async function completeRead(): Promise<string> {
      const reader = readers.at(-1)!;
      const bytes = Buffer.from(await reader.blob.arrayBuffer());
      const dataUrl = `data:${reader.blob.type};base64,${bytes.toString("base64")}`;
      reader.complete(dataUrl);
      return dataUrl;
    }
    function completeDecode(kind: UploadKind): void {
      if (kind === "image") images.at(-1)!.onload?.();
      else {
        const target = media.at(-1)!;
        target.readyState = 2;
        target.onloadeddata?.();
      }
    }
    beforeEach(() => {
      vi.useFakeTimers();
      readers.length = 0;
      images.length = 0;
      media.length = 0;
      vi.stubGlobal("FileReader", ControlledReader);
      vi.stubGlobal("Image", ControlledImage);
      vi.stubGlobal("document", {
        createElement: (tag: string) => {
          if (tag !== "audio" && tag !== "video") throw new Error(`Unexpected native resource: ${tag}`);
          return new ControlledMedia(tag);
        },
      });
      // Preserve real store behavior; preparation must never access it.
      vi.spyOn(store, "getCurrent");
      vi.spyOn(store, "update");
    });
    afterEach(() => {
      try {
        expect(store.getCurrent).not.toHaveBeenCalled();
        expect(store.update).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
      }
    });
    describe("prepareCinematicUpload", () => {
      it.each(["png", "jpeg", "gif", "webp"])("preserves %s payload bytes without canvas conversion", async (format) => {
        const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
        const file = new File([bytes], `scene.${format}`, { type: `image/${format}` });
        const controller = new AbortController();
        const removeListener = vi.spyOn(controller.signal, "removeEventListener");
        const promise = prepareCinematicUpload(file, "image", controller.signal);
        const dataUrl = await completeRead();
        expect(images[0].src).toBe(dataUrl);
        completeDecode("image");
        const asset = await promise;
        expect(asset).toMatchObject({
          name: "scene",
          kind: "picture",
          dataUrl,
          meta: { width: 320, height: 240 },
        });
        expect(asset.id.startsWith("picture_img")).toBe(true);
        expect(Buffer.from(asset.dataUrl.split(",")[1], "base64")).toEqual(Buffer.from(bytes));
        expect(images[0].src).toBe("");
        expect(images[0].onload).toBeNull();
        expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
      });

      it.each([
        ["scene.gif", "", "image/gif"],
        ["scene.webp", "application/octet-stream", "image/webp"],
        ["scene.jpg", "image/jpg", "image/jpeg"],
      ])("canonicalizes the header for %s without changing bytes", async (name, type, mime) => {
        const promise = prepareCinematicUpload(new File(["original"], name, { type }), "image", new AbortController().signal);
        const dataUrl = await completeRead();
        completeDecode("image");
        expect((await promise).dataUrl).toBe(dataUrl);
        expect(dataUrl).toBe(`data:${mime};base64,${Buffer.from("original").toString("base64")}`);
      });

      it.each([
        ["video", "scene.webm", "video/webm"],
        ["video", "scene.mp4", "video/mp4"],
        ["video", "scene.m4v", "video/mp4"],
        ["video", "scene.ogv", "video/ogg"],
        ["audio", "voice.wav", "audio/wav"],
        ["audio", "voice.mp3", "audio/mpeg"],
        ["audio", "voice.ogg", "audio/ogg"],
      ] as const)("prepares %s %s after decodable data without playback", async (kind, name, mime) => {
        const promise = prepareCinematicUpload(new File(["payload"], name, { type: mime }), kind, new AbortController().signal);
        const dataUrl = await completeRead();
        const target = media[0];
        expect(target.tag).toBe(kind);
        target.readyState = 1;
        target.onloadedmetadata?.();
        expect(target.pause).not.toHaveBeenCalled();
        expect(target.src).toBe(dataUrl);
        completeDecode(kind);
        const asset = await promise;
        expect(asset.kind).toBe(kind === "video" ? "movie" : "sound");
        expect(asset.id.startsWith(kind === "video" ? "movie" : "se")).toBe(true);
        expect(asset.dataUrl).toBe(dataUrl);
        expect(asset.meta).toEqual(kind === "video" ? { width: 640, height: 360 } : {});
        expect(target.play).not.toHaveBeenCalled();
        expect(target.pause).toHaveBeenCalledOnce();
        expect(target.src).toBe("");
        expect(target.onloadeddata).toBeNull();
        expect(target.load).toHaveBeenCalledTimes(2);
      });

      it("accepts a decoded video whose duration is not yet known", async () => {
        const promise = prepareCinematicUpload(fileFor("video"), "video", new AbortController().signal);
        const accepted = expect(promise).resolves.toMatchObject({
          kind: "movie",
          meta: { width: 640, height: 360 },
        });
        await completeRead();
        media[0].duration = Number.POSITIVE_INFINITY;
        completeDecode("video");
        await accepted;
        expect(media[0].src).toBe("");
      });

      it.each(["image", "video", "audio"] as const)("rejects empty and oversized %s before reading", async (kind) => {
        const source = fileFor(kind);
        await expect(prepareCinematicUpload(new File([], source.name, { type: source.type }), kind, new AbortController().signal))
          .rejects.toBeInstanceOf(RangeError);
        const limit = kind === "image" ? IMAGE_IMPORT_MAX_BYTES : mediaImportRuleFor(kind === "video" ? "movie" : "sound")!.maxBytes;
        Object.defineProperty(source, "size", { value: limit + 1 });
        await expect(prepareCinematicUpload(source, kind, new AbortController().signal)).rejects.toBeInstanceOf(RangeError);
        expect(readers).toHaveLength(0);
      });

      it.each(["image", "video", "audio"] as const)("accepts the exact %s size boundary", async (kind) => {
        const source = fileFor(kind);
        const limit = kind === "image" ? IMAGE_IMPORT_MAX_BYTES : mediaImportRuleFor(kind === "video" ? "movie" : "sound")!.maxBytes;
        Object.defineProperty(source, "size", { value: limit });
        const controller = new AbortController();
        const promise = prepareCinematicUpload(source, kind, controller.signal);
        expect(readers).toHaveLength(1);
        const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
        controller.abort();
        await rejection;
      });

      it.each([
        ["image", "scene.svg", "image/svg+xml"],
        ["video", "scene.avi", "video/x-msvideo"],
        ["audio", "voice.mid", "audio/midi"],
        ["video", "scene.webm", "image/png"],
        ["audio", "voice.ogg", "video/ogg"],
      ] as const)("rejects unsupported %s format %s before reading", async (kind, name, type) => {
        await expect(prepareCinematicUpload(new File(["x"], name, { type }), kind, new AbortController().signal))
          .rejects.toBeInstanceOf(TypeError);
        expect(readers).toHaveLength(0);
      });

      it("propagates native read errors", async () => {
        const promise = prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal);
        const error = new DOMException("read failed", "NotReadableError");
        const rejection = expect(promise).rejects.toBe(error);
        readers[0].error = error;
        readers[0].readyState = 2;
        readers[0].onerror?.();
        await rejection;
        expect(readers[0].abort).not.toHaveBeenCalled();
        expect(readers[0].onerror).toBeNull();
        expect(images).toHaveLength(0);
      });

      it("propagates synchronous read failures and removes the deadline", async () => {
        const error = new Error("read failed");
        vi.spyOn(ControlledReader.prototype, "readAsDataURL").mockImplementationOnce(() => { throw error; });
        await expect(prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal)).rejects.toBe(error);
      });

      it.each([null, "", "data:image/gif;base64,", "data:text/plain;base64,eA=="])("rejects an unusable reader result", async (result) => {
        const promise = prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal);
        const rejection = expect(promise).rejects.toMatchObject({ name: "NotReadableError" });
        readers[0].complete(result);
        await rejection;
        expect(images).toHaveLength(0);
      });

      it.each(["image", "video", "audio"] as const)("rejects %s decoder failures and releases native resources", async (kind) => {
        const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
        const rejection = expect(promise).rejects.toMatchObject({ name: "EncodingError" });
        await completeRead();
        const target = kind === "image" ? images[0] : media[0];
        target.onerror?.();
        await rejection;
        expect(target.src).toBe("");
        expect(target.onerror).toBeNull();
      });

      it.each(["image", "video", "audio"] as const)("rejects invalid %s dimensions or duration", async (kind) => {
        const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
        const rejection = expect(promise).rejects.toMatchObject({ name: "EncodingError" });
        await completeRead();
        if (kind === "image") images[0].naturalWidth = 0;
        else if (kind === "video") media[0].videoHeight = 0;
        else media[0].duration = Number.NaN;
        completeDecode(kind);
        await rejection;
      });

      it("rejects pre-aborted work without allocating native resources", async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(prepareCinematicUpload(fileFor("image"), "image", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
        expect(readers).toHaveLength(0);
      });

      it("aborts a pending reader and ignores its late completion", async () => {
        const controller = new AbortController();
        const promise = prepareCinematicUpload(fileFor("image"), "image", controller.signal);
        const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
        controller.abort();
        await rejection;
        expect(readers[0].abort).toHaveBeenCalledOnce();
        readers[0].complete("data:image/gif;base64,eA==");
        expect(images).toHaveLength(0);
      });

      it.each(["image", "video", "audio"] as const)("cancels pending %s decoding", async (kind) => {
        const controller = new AbortController();
        const promise = prepareCinematicUpload(fileFor(kind), kind, controller.signal);
        const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
        await completeRead();
        controller.abort();
        await rejection;
        expect((kind === "image" ? images[0] : media[0]).src).toBe("");
        completeDecode(kind);
      });

      it("rejects cancellation between the final native event and async return", async () => {
        const controller = new AbortController();
        const promise = prepareCinematicUpload(fileFor("video"), "video", controller.signal);
        const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
        await completeRead();
        completeDecode("video");
        controller.abort();
        await rejection;
      });

      it.each(["read", "image", "video", "audio"] as const)("bounds stalled %s preparation without polling", async (stage) => {
        const kind = stage === "read" ? "image" : stage;
        const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
        const rejection = expect(promise).rejects.toMatchObject({ name: "TimeoutError" });
        if (stage !== "read") await completeRead();
        vi.advanceTimersByTime(15_000);
        await rejection;
        if (stage === "read") expect(readers[0].abort).toHaveBeenCalledOnce();
        else expect((kind === "image" ? images[0] : media[0]).src).toBe("");
      });
    });
  });
  // OPRN-OUT-017 — 두 보조가 화면에서도 **서로 다른 계약**으로 보이는가, 그리고 거부가
  // 조용한 무동작이 아니라 누를 수 있는 복구 행동을 내놓는가.
  describe("clusterAssistUi", () => {
    isolateTimers();
    let restoreFakeDom: () => void;
    function seed(): MapId {
      const project = startOnRetiredCombinedTown(createBlankProject());
      const map = project.maps[project.startMapId];
      map.width = 8;
      map.height = 8;
      map.lowerTiles = Array(64).fill(TILE.GRASS);
      map.upperTiles = Array(64).fill(TILE.EMPTY);
      map.events = [];
      project.startPos = { x: 0, y: 7 };
      store.replace(project);
      resetMapEditHistory();
      return project.startMapId;
    }
    function renderAssist(mapId: MapId) {
      const project = store.getCurrent();
      const map = project.maps[mapId]!;
      const state = editorState.get();
      return renderWithFakeDom(() =>
        makeTileBrushAssistPanel({
          autoConnectMode: state.autoConnectMode,
          clusterAssistMode: state.clusterAssistMode,
          mapId,
          onSelectTile: () => {},
          rerender: () => {},
          selectedTile: 290,
          tileset: project.tilesets[map.tilesetId]!,
        })
      );
    }
    beforeEach(() => {
      restoreFakeDom = installFakeDom();
      resetToastsForTest();
      store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
      editorState.set({ autoConnectMode: false, clusterAssistMode: true });
    });
    afterEach(() => {
      resetToastsForTest();
      restoreFakeDom();
      editorState.set({ autoConnectMode: false, clusterAssistMode: true });
    });
    describe("이웃 연결과 구조 보조는 화면에서 따로 표현된다", () => {
      it("두 토글이 각자의 줄·testid·상태로 존재한다", () => {
        const mapId = seed();

        const panel = renderAssist(mapId);

        const neighbor = findByTestId(panel, "auto-connect-mode-toggle");
        const cluster = findByTestId(panel, "cluster-assist-mode-toggle");
        expect(neighbor).toBeTruthy();
        expect(cluster).toBeTruthy();
        expect(neighbor).not.toBe(cluster);
        // 이웃 연결 수동 + 구조 보조 켜짐 — 두 상태가 독립적으로 표시된다.
        expect(neighbor!.getAttribute("aria-pressed")).toBe("false");
        expect(cluster!.getAttribute("aria-pressed")).toBe("true");
      });

      it("이웃 연결 수동 설명이 구조물 짝 배치를 따로 가리킨다 — 하나가 둘을 끈다고 읽히지 않는다", () => {
        const mapId = seed();

        const title = findByTestId(renderAssist(mapId), "auto-connect-mode-toggle")!.getAttribute("title") ?? "";

        expect(title).toContain("지형 연결만");
        expect(title).toContain("구조 보조");
      });

      it("구조 보조 문구가 켜짐/꺼짐에서 서로 다른 계약을 말한다", () => {
        const on = clusterAssistCopy(true);
        const off = clusterAssistCopy(false);

        expect(on.chip).not.toBe(off.chip);
        expect(on.title).toContain("동반 칸까지");
        expect(off.title).toContain("고른 칸·레이어 하나만");
        // 정확 배치도 보호셀·남의 덧그림은 덮지 않는다는 사실이 문구에 남아야 한다.
        expect(off.title).toContain("보호셀");
      });

      it("구조 보조 토글은 이웃 연결 상태를 건드리지 않는다", () => {
        editorState.set({ autoConnectMode: true, clusterAssistMode: true });

        expect(toggleClusterAssistMode()).toBe(false);

        expect(editorState.get().clusterAssistMode).toBe(false);
        expect(editorState.get().autoConnectMode).toBe(true);
      });
    });
    describe("거부는 실행 가능한 복구 경로를 화면에 낸다", () => {
      it("경계 거부 토스트에 규칙 문장과 정확 배치 버튼이 함께 있고, 누르면 그 칸이 칠해진다", () => {
        const mapId = seed();
        const rejections: TilePaintRejection[] = [];
        paintTilesBulk(mapId, [{ layer: "lower", tile: 291, x: 4, y: 0 }], {
          autoConnect: false,
          onRejected: (rejection) => rejections.push(rejection),
        });
        expect(rejections).toHaveLength(1);

        presentClusterRecovery(clusterRecoveryOffer(mapId, rejections[0]!));

        const toastEl = document.querySelector<HTMLElement>('[data-testid="toast"]');
        expect(toastEl).toBeTruthy();
        expect(toastEl!.textContent).toContain("261");
        const button = document.querySelector<HTMLElement>('[data-testid="cluster-exact-place"]');
        expect(button).toBeTruthy();

        button!.click();

        const map = store.getCurrent().maps[mapId]!;
        expect(map.lowerTiles[0 * map.width + 4]).toBe(291);
      });

      it("복구 불가(보호셀 자체)일 때는 버튼 대신 다음에 할 일을 말한다", () => {
        const mapId = seed();
        store.update((project) => {
          project.startMapId = mapId;
          project.startPos = { x: 4, y: 4 };
        });
        const rejections: TilePaintRejection[] = [];
        paintTilesBulk(mapId, [{ layer: "lower", tile: 290, x: 4, y: 4 }], {
          autoConnect: false,
          exactPlacement: true,
          onRejected: (rejection) => rejections.push(rejection),
        });

        presentClusterRecovery(clusterRecoveryOffer(mapId, rejections[0]!));

        expect(document.querySelector('[data-testid="cluster-exact-place"]')).toBeNull();
        expect(document.querySelector<HTMLElement>('[data-testid="toast"]')!.textContent).toContain("먼저 그 칸을 비우거나");
      });
    });
  });
  describe("clusterRuleSurface", () => {
    isolateTimers();
    /**
     * 타일 그룹의 `surface` 규칙 — 「화덕은 북쪽 벽에 붙는다」의 타일 쪽 절반.
     * 구조물 킷 조건(structureKitPlacementConditions.test.ts)은 찍는 순간 차단하고,
     * 이쪽은 이미 찍힌 맵을 훑어 규칙 감사 패널에 올린다.
     */

    const MAP_ID = "map_surface_rules";
    const WALL = 300;
    const FLOOR = 400;
    const STOVE_TOP = 21;
    const STOVE_BOT = 51;
    function stoveGroup(rules: readonly ClusterRule[]): TileGroupMetadata {
      return {
        defaultLayer: "mixed",
        description: "화덕 오븐",
        id: "kitchen-stove",
        name: "화덕 오븐",
        patternGrammar: {
          axis: "vertical",
          kind: "vertical_expandable",
          minHeight: 2,
          minWidth: 1,
          parts: [
            { role: "topCap", tileIds: [STOVE_TOP] },
            { role: "bottomCap", tileIds: [STOVE_BOT] },
          ],
          preserveCaps: true,
          repeat: "source_order",
        },
        placementRules: "부엌 북쪽 벽",
        role: "building",
        rules: [...rules],
        tileIds: [STOVE_TOP, STOVE_BOT],
      };
    }
    const NORTH_WALL_RULE: ClusterRule = {
      id: "r_interior_stove_north_wall",
      kind: "surface",
      message: "화덕은 북쪽 벽에 등을 대고 놓입니다.",
      params: { facing: "north", zone: "againstWall" },
      strength: "hard",
    };
    /** 8×6 방. y=1 행이 벽, 나머지는 바닥. */
    function projectWithStove(stoveOriginY: number): Project {
      const width = 8;
      const height = 6;
      const map: GameMap = {
        events: [],
        height,
        id: MAP_ID,
        lowerTiles: new Array<number>(width * height).fill(FLOOR),
        name: "주방",
        tileSize: 16,
        tilesetId: DEFAULT_TILESET_ID,
        upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
        width,
      };
      for (let x = 0; x < width; x += 1) map.lowerTiles[1 * width + x] = WALL;

      const project = createBlankProject();
      project.maps = { [MAP_ID]: map };
      project.mapTree = { mapId: MAP_ID, children: [] };
      project.startMapId = MAP_ID;
      project.startPos = { x: 0, y: 0 };
      const tileset = project.tilesets[DEFAULT_TILESET_ID]!;
      tileset.passability[WALL] = blockedFlag();
      tileset.passability[FLOOR] = passableFlag();
      tileset.priority[WALL] = "lower";
      tileset.priority[FLOOR] = "lower";
      // 화덕 자체는 통행 불가 — 검증기가 자기 발밑을 벽으로 오인하지 않는지 같이 본다.
      tileset.passability[STOVE_TOP] = blockedFlag();
      tileset.passability[STOVE_BOT] = blockedFlag();
      tileset.tileGroups = [stoveGroup([NORTH_WALL_RULE])];

      // 실내 파이프라인과 같은 방식으로 찍는다: 상단(21)은 **상위** 레이어에 벽면 위로 겹쳐 세우고,
      // 발밑(51)은 하위 레이어에 놓는다. 그래야 벽의 지형 타일이 남아 감사가 되돌려 볼 수 있다.
      map.upperTiles[stoveOriginY * width + 3] = STOVE_TOP;
      map.lowerTiles[(stoveOriginY + 1) * width + 3] = STOVE_BOT;
      return project;
    }
    describe("cluster-rule surface — 맵 감사", () => {
      it("벽 아래에 등을 댄 화덕은 위반이 아니다", () => {
        // 상단이 벽 행(y=1), 발밑이 y=2 바닥 → 발밑 위(y=1)가 벽.
        const violations = validateClusterRules(projectWithStove(1), MAP_ID);
        expect(violations.filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
      });

      it("방 가운데 떠 있는 화덕은 error 로 보고된다", () => {
        const violations = validateClusterRules(projectWithStove(3), MAP_ID);
        const surface = violations.filter((entry) => entry.rule.kind === "surface");
        expect(surface).toHaveLength(1);
        expect(surface[0]!.severity).toBe("error");
        expect(surface[0]!.code).toBe("cluster-rule:surface:kitchen-stove");
        // 규칙 감사 패널이 위치를 찍을 수 있어야 한다.
        expect(surface[0]!.coords.length).toBeGreaterThan(0);
      });

      it("지형까지 덮어 찍힌 세로쌍은 «판정 불가» 로 건너뛴다 — 벽을 지운 자리는 되볼 수 없다", () => {
        // 구조물 킷 스탬프는 두 줄을 모두 하위 레이어에 쓴다 → 상단이 앉았던 벽 타일이 사라진다.
        // 찍는 순간에는 검사를 통과했으므로, 나중에 되보고 위반이라 우기면 거짓 위반이다.
        const project = projectWithStove(1);
        const map = project.maps[MAP_ID]!;
        map.upperTiles[1 * map.width + 3] = TILE.EMPTY;
        map.lowerTiles[1 * map.width + 3] = STOVE_TOP;
        expect(validateClusterRules(project, MAP_ID).filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
      });

      it("params 가 망가진 규칙은 조용히 건너뛴다 — 거짓 위반을 만들지 않는다", () => {
        const project = projectWithStove(3);
        project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [
          stoveGroup([{ ...NORTH_WALL_RULE, params: { zone: "없는존" } }]),
        ];
        expect(validateClusterRules(project, MAP_ID).filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
      });
    });
    describe("set_cluster_rule — surface 규칙 편집", () => {
      it("zone·facing 을 받아 그룹에 저장한다", () => {
        const project = projectWithStove(1);
        project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [stoveGroup([])];
        const context = { project };
        const result = runTool(context, "set_cluster_rule", {
          tilesetId: DEFAULT_TILESET_ID,
          groupId: "kitchen-stove",
          rule: {
            id: "r_stove_surface",
            kind: "surface",
            strength: "hard",
            params: { zone: "againstWall", facing: "north" },
          },
        });
        expect(result.ok).toBe(true);
        const saved = context.project.tilesets[DEFAULT_TILESET_ID]!.tileGroups!
          .find((group) => group.id === "kitchen-stove")!.rules!
          .find((rule) => rule.kind === "surface");
        expect(saved?.params).toEqual({ facing: "north", zone: "againstWall" });
      });

      it("모르는 zone 은 거부한다 — 조용히 통과시키면 검사가 없는 것과 같아진다", () => {
        const project = projectWithStove(1);
        project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [stoveGroup([])];
        const result = runTool({ project }, "set_cluster_rule", {
          tilesetId: DEFAULT_TILESET_ID,
          groupId: "kitchen-stove",
          rule: { id: "r_bad", kind: "surface", strength: "hard", params: { zone: "북벽" } },
        });
        expect(result.ok).toBe(false);
        expect(result.summary + JSON.stringify(result.issues ?? [])).toContain("params.zone");
      });
    });
    describe("타일셋 지식 저장 — 배치 면 병합", () => {
      const adjacency: ClusterRule = {
        id: "r_interior_stove_v_pair",
        kind: "adjacency",
        params: { a: STOVE_TOP, b: STOVE_BOT, relation: "aAboveB" },
        strength: "hard",
      };

      it("«조건 없음» 은 surface 규칙만 지우고 다른 규칙은 남긴다", () => {
        const merged = mergeSurfaceRule([adjacency, NORTH_WALL_RULE], "kitchen-stove", {
          surfaceFacing: "any",
          surfaceStrength: "hard",
          surfaceZone: "none",
        });
        expect(merged).toEqual([adjacency]);
      });

      it("배치 면을 고르면 규칙이 생기고, 인접 규칙은 그대로 보존된다", () => {
        const merged = mergeSurfaceRule([adjacency], "kitchen-stove", {
          surfaceFacing: "north",
          surfaceStrength: "hard",
          surfaceZone: "againstWall",
        });
        expect(merged).toHaveLength(2);
        expect(merged[0]).toEqual(adjacency);
        expect(merged[1]).toMatchObject({
          id: "r_surface_kitchen-stove",
          kind: "surface",
          params: { facing: "north", zone: "againstWall" },
          strength: "hard",
        });
      });

      it("같은 그룹에 두 번 저장해도 surface 규칙은 하나만 남는다", () => {
        const once = mergeSurfaceRule([adjacency], "kitchen-stove", {
          surfaceFacing: "north",
          surfaceStrength: "hard",
          surfaceZone: "againstWall",
        });
        const twice = mergeSurfaceRule(once, "kitchen-stove", {
          surfaceFacing: "west",
          surfaceStrength: "soft",
          surfaceZone: "againstWall",
        });
        expect(twice.filter((rule) => rule.kind === "surface")).toHaveLength(1);
        expect(twice[1]).toMatchObject({ params: { facing: "west", zone: "againstWall" }, strength: "soft" });
      });

      it("방향은 againstWall 에서만 실린다 — 다른 면에 facing 을 남기면 읽는 쪽이 헷갈린다", () => {
        const merged = mergeSurfaceRule([], "g", {
          surfaceFacing: "north",
          surfaceStrength: "medium",
          surfaceZone: "wallFace",
        });
        expect(merged[0]!.params).toEqual({ zone: "wallFace" });
      });
    });
  });
  describe("commandPalette", () => {
    isolateTimers();
    function cmd(id: string, label: string): EditorCommand {
      return { id, label, category: "도구", keywords: [label], run: () => {} };
    }
    describe("buildPaletteEntries", () => {
      it("명령 → 맵 순으로 합치고 종류별 상한을 지킨다", () => {
        const commands = Array.from({ length: 10 }, (_, i) => cmd(`c${i}`, `명령${i}`));
        const maps = Array.from({ length: 10 }, (_, i) => cmd(`m${i}`, `맵${i}`));
        const entries = buildPaletteEntries("", { commands, maps });
        expect(entries.filter((e) => e.kind === "command")).toHaveLength(6);
        expect(entries.filter((e) => e.kind === "map")).toHaveLength(4);
        expect(entries[0]!.kind).toBe("command");
      });

      it("질의가 명령과 맵을 함께 거른다", () => {
        const entries = buildPaletteEntries("맵3", {
          commands: [cmd("c1", "명령1")],
          maps: [cmd("m3", "맵3"), cmd("m4", "맵4")],
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]!.id).toBe("m3");
      });
    });
    describe("movePaletteIndex", () => {
      it("순환 이동한다", () => {
        expect(movePaletteIndex(3, 0, 1)).toBe(1);
        expect(movePaletteIndex(3, 2, 1)).toBe(0);
        expect(movePaletteIndex(3, 0, -1)).toBe(2);
        expect(movePaletteIndex(0, 0, 1)).toBe(0);
      });
    });
    describe("paletteKeyAction", () => {
      it("조합 중 Enter·화살표는 명령을 실행하거나 선택을 옮기지 않는다", () => {
        expect(paletteKeyAction({ key: "Enter", isComposing: true })).toBe("ignore");
        expect(paletteKeyAction({ key: "Enter", keyCode: 229 })).toBe("ignore");
        expect(paletteKeyAction({ key: "Process", keyCode: 229 })).toBe("ignore");
        expect(paletteKeyAction({ key: "ArrowDown", isComposing: true })).toBe("ignore");
        expect(paletteKeyAction({ key: "ArrowUp", keyCode: 229 })).toBe("ignore");
        expect(paletteKeyAction({ key: "Unidentified" })).toBe("ignore");
      });

      it("조합이 끝난 Enter 는 실행이고 화살표는 이동이다", () => {
        expect(paletteKeyAction({ key: "Enter" })).toBe("run");
        expect(paletteKeyAction({ key: "ArrowDown" })).toBe("down");
        expect(paletteKeyAction({ key: "ArrowUp" })).toBe("up");
        expect(paletteKeyAction({ key: "Escape" })).toBe("ignore");
      });
    });
  });
  describe("customEquipmentSlots", () => {
    isolateTimers();
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();
      get length() { return this.values.size; }
      clear() { this.values.clear(); }
      getItem(key: string) { return this.values.get(key) ?? null; }
      key(index: number) { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string) { this.values.delete(key); }
      setItem(key: string, value: string) { this.values.set(key, value); }
    }
    function fixture() {
      const project = createBlankProject();
      const actor = project.database.actors[0]!;
      const slot = addEquipmentSlot(project, "Boots");
      const boots = normalizeEquipmentRecord({
        id: "equip_test_custom_boots", name: "Boots", slot: slot.id,
        statBonuses: { attack: 2, defense: 3, mind: 4, agility: 7 },
        equippableActorIds: [actor.id], iconResourceId: project.database.equipment[0]!.iconResourceId,
        effectFlags: { ...project.database.equipment[0]!.effectFlags, doubleAttack: true },
      });
      project.database.equipment.push(boots);
      return { project, actor, slot, boots };
    }
    function node(root: FakeElement, id: string): FakeElement {
      const found = findByTestId(root, id);
      if (!found) throw new Error(`Missing UI control: ${id}`);
      return found;
    }
    describe("project-authored equipment slots", () => {
      it("retains a real custom slot in the runtime equipment projection", () => {
        const project = createBlankProject();
        project.database.equipmentSlots = [{ id: "slot_boots", label: "Boots" }];
        const actor = project.database.actors[0]!;
        const boots = normalizeEquipmentRecord({ id: "equip_test_custom_boots", name: "Boots", slot: "slot_boots" });
        project.database.equipment.push(boots);
        expect(effectiveActorEquipment(project, actor, { slot_boots: boots.id }))
          .toEqual({ slot_boots: boots.id });
      });

      it("creates distinct stable IDs, renames in place, and removes only unused custom slots", () => {
        const { project, actor, slot, boots } = fixture();
        const second = addEquipmentSlot(project, "Boots");
        expect(second.id).not.toBe(slot.id);
        const order = equipmentSlots(project).map((entry) => entry.id);
        renameEquipmentSlot(project, slot.id, "Greaves");
        expect(equipmentSlotLabel(project, slot.id)).toBe("Greaves");
        expect(equipmentSlots(project).map((entry) => entry.id)).toEqual(order);
        expect(boots.slot).toBe(slot.id);
        expect(removeEquipmentSlot(project, slot.id)).toBe(false);
        expect(equipmentSlotRemovalBlocker(project, slot.id)).toBe("referenced");
        boots.slot = "accessory";
        actor.initialEquipment[slot.id] = boots.id;
        expect(removeEquipmentSlot(project, slot.id)).toBe(false);
        delete actor.initialEquipment[slot.id];
        project.commonEvents.push({ id: "ce_slot", name: "Slot", trigger: "call", commands: [{ kind: "loop", body: [
          { kind: "changeEquipment", actorId: actor.id, slot: slot.id, equipmentId: "" },
        ] }] } as typeof project.commonEvents[number]);
        expect(removeEquipmentSlot(project, slot.id)).toBe(false);
        project.commonEvents.pop();
        expect(removeEquipmentSlot(project, slot.id)).toBe(true);
        expect(removeEquipmentSlot(project, "weapon")).toBe(false);
        expect(() => addEquipmentSlot(project, " ")).toThrow();
        expect(() => renameEquipmentSlot(project, second.id, " ")).toThrow();
      });

      it("roundtrips initial equipment, equips through menu and event authority, derives stats, and saves/reloads", () => {
        const { project, actor, slot, boots } = fixture();
        actor.initialEquipment = { [slot.id]: boots.id };
        renameEquipmentSlot(project, slot.id, "Greaves");
        const loaded = deserialize(serialize(project));
        const loadedActor = loaded.database.actors.find((entry) => entry.id === actor.id)!;
        expect(loadedActor.initialEquipment).toEqual({ [slot.id]: boots.id });
        expect(loaded.database.equipment.find((entry) => entry.id === boots.id)).toEqual(boots);
        expect(equipmentSlotLabel(loaded, slot.id)).toBe("Greaves");
        const session = startSession(loaded);
        expect(session.actorEquipment[actor.id]).toEqual({ [slot.id]: boots.id });
        expect(changeActorEquipment(session, loaded, { kind: "changeEquipment", actorId: actor.id, slot: slot.id, equipmentId: "" }).kind).toBe("accepted");
        expect(session.inventory[boots.id]).toBe(1);
        const options = { project: loaded, session, selectedCommand: "equipment" as const, equipmentActorId: actor.id, slots: [], waitModeEnabled: false };
        const slots = createStatusMenuDetail(options);
        expect(slots.entries.find((entry) => entry.testId === `status-menu-equipment-slot-${slot.id}`)).toMatchObject({ label: "Greaves" });
        const detail = createStatusMenuDetail({ ...options, equipmentSlotId: slot.id,
          onEquipItem: (actorId, slotId, equipmentId) => {
            expect(changeActorEquipment(session, loaded, { kind: "changeEquipment", actorId, slot: slotId, equipmentId }).kind).toBe("accepted");
          },
        });
        const candidate = detail.entries.find((entry) => entry.testId === `status-menu-equipment-item-${boots.id}`);
        expect(candidate?.onActivate).toBeTypeOf("function");
        candidate!.onActivate!();
        expect(session.inventory[boots.id]).toBeUndefined();
        const normalized = normalizeActorRecord(loadedActor);
        const base = actorDerivedStats(loaded, normalized, { level: 1, equipment: {} });
        const equipped = actorDerivedStats(loaded, normalized, { level: 1, equipment: effectiveActorEquipment(loaded, loadedActor, session.actorEquipment[actor.id]) });
        expect(equipped.agility - base.agility).toBe(7);
        expect(equipped.attack - base.attack).toBe(2);
        expect(equipped.equipmentEffects.doubleAttack).toBe(true);
        const storage = new MemoryStorage();
        expect(saveToSlot(storage, 1, createSaveSnapshot(loaded, session)).ok).toBe(true);
        const read = readSaveSlot(storage, 1);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("Save did not roundtrip");
        expect(snapshotLoadBlocker(loaded, read.snapshot)).toBeNull();
        const restored = applySaveSnapshot(loaded, read.snapshot);
        expect(restored.actorEquipment[actor.id]).toEqual({ [slot.id]: boots.id });
        expect(restored.inventory).toEqual(session.inventory);
        loaded.database.equipmentSlots = [];
        expect(snapshotLoadBlocker(loaded, read.snapshot)).not.toBeNull();
      });

      it("rejects unknown slots atomically, including empty-slot unequip, and preserves permissions and curse rules", () => {
        const { project, actor, slot, boots } = fixture();
        const input = { project, actorId: actor.id, equipment: {}, inventory: { [boots.id]: 1 }, slot: "missing" };
        expect(transitionActorEquipment(input)).toEqual({ kind: "rejected", reason: "invalidSlot" });
        expect(transitionActorEquipment({ ...input, equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "invalidSlot" });
        expect(transitionActorEquipment({ ...input, slot: "accessory", equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "invalidSlot" });
        boots.equippableActorIds = [];
        project.database.classes.find((entry) => entry.id === actor.classId)!.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [] };
        expect(transitionActorEquipment({ ...input, slot: slot.id, equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "notEquippable" });
        boots.equippableActorIds = [actor.id];
        boots.cursed = true;
        expect(transitionActorEquipment({ ...input, slot: slot.id, equipment: { [slot.id]: boots.id } })).toEqual({ kind: "rejected", reason: "cursedEquipment" });
        boots.twoHanded = true;
        expect(transitionActorEquipment({ ...input, slot: slot.id, equipmentId: boots.id })).toEqual({ kind: "rejected", reason: "invalidSlot" });
        expect(input.inventory).toEqual({ [boots.id]: 1 });
      });

      it.each(["missing", "", "__proto__"])("rejects unknown or unsafe authored slot %j on project reload", (id) => {
        const { project, boots } = fixture();
        boots.slot = id;
        expect(() => deserialize(serialize(project))).toThrow(/slot/i);
      });

      it("validates catalog identity, initial equipment, event slots, and all custom save values", () => {
        const { project, actor, slot } = fixture();
        project.database.equipmentSlots!.push({ ...slot });
        expect(() => deserialize(serialize(project))).toThrow(/Duplicate equipment slot/);
        project.database.equipmentSlots!.pop();
        actor.initialEquipment.missing = project.database.equipment[0]!.id;
        expect(() => deserialize(serialize(project))).toThrow(/slot/);
        delete actor.initialEquipment.missing;
        project.commonEvents.push({ id: "ce_slot", name: "Slot", trigger: "call", commands: [
          { kind: "changeEquipment", actorId: actor.id, slot: slot.id, equipmentId: "" },
        ] } as typeof project.commonEvents[number]);
        expect(deserialize(serialize(project)).commonEvents.at(-1)!.commands[0]).toMatchObject({ slot: slot.id });
        project.commonEvents.at(-1)!.commands = [{ kind: "changeEquipment", actorId: actor.id, slot: "missing", equipmentId: "" }];
        expect(() => deserialize(serialize(project))).toThrow(/slot/);
        expect(isActorEquipmentRecord({ [actor.id]: { [slot.id]: 42 } })).toBe(false);
        const storage = new MemoryStorage();
        const snapshot = createSaveSnapshot(project, startSession(project));
        const malformed = JSON.parse(JSON.stringify(snapshot));
        malformed.session.actorEquipment[actor.id][slot.id] = 42;
        storage.setItem(saveSlotKey(1), JSON.stringify(malformed));
        expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
      });

      it("keeps catalog-free legacy projects and saves compatible, even after renaming built-in labels", () => {
        const project = createBlankProject();
        expect(project.database.equipmentSlots).toBeUndefined();
        const loaded = deserialize(serialize(project));
        expect(equipmentSlots(loaded).map((slot) => slot.id)).toEqual(["weapon", "shield", "helmet", "armor", "accessory"]);
        const actor = loaded.database.actors[0]!;
        const weapon = loaded.database.equipment.find((entry) => entry.slot === "weapon")!;
        weapon.twoHanded = true;
        weapon.equippableActorIds = [actor.id];
        renameEquipmentSlot(loaded, "weapon", "Main hand");
        const result = transitionActorEquipment({ project: loaded, actorId: actor.id, equipment: {}, inventory: { [weapon.id]: 1 }, slot: "weapon", equipmentId: weapon.id });
        expect(result).toMatchObject({ kind: "accepted", equipment: { weapon: weapon.id, shield: weapon.id }, inventory: {} });
        const snapshot = createSaveSnapshot(loaded, startSession(loaded));
        const legacy = { ...snapshot, session: { ...snapshot.session, actorEquipment: undefined } };
        const storage = new MemoryStorage();
        saveToSlot(storage, 1, legacy);
        expect(readSaveSlot(storage, 1).kind).toBe("present");
        expect(applySaveSnapshot(loaded, legacy).actorEquipment[actor.id]).toEqual(actor.initialEquipment);
      });

      it("authors a custom slot inline, retains its ID on rename, and exposes it in the actor picker", () => {
        const restoreDom = installFakeDom();
        try {
          const project = createBlankProject();
          const equipmentId = project.database.equipment[0]!.id;
          store.replace(project);
          const form = document.createElement("section") as unknown as FakeElement;
          const render = () => {
            form.replaceChildren();
            renderEquipmentRecordForm(form as unknown as HTMLElement, store.getCurrent().database.equipment.find((entry) => entry.id === equipmentId)!, render);
          };
          render();
          node(form, "db-equipment-slot-new-label").value = "Boots";
          node(form, "db-equipment-slot-add").click();
          const slot = store.getCurrent().database.equipmentSlots![0]!;
          expect(slot.id).not.toBe("accessory");
          expect(store.getCurrent().database.equipment[0]!.slot).toBe(slot.id);
          const label = node(form, `db-equipment-slot-label-${slot.id}`);
          label.value = "Greaves";
          label.dispatchEvent(new Event("change"));
          expect(store.getCurrent().database.equipmentSlots![0]).toEqual({ id: slot.id, label: "Greaves" });
          expect(node(form, `db-equipment-slot-remove-${slot.id}`).disabled).toBe(true);
          const actor = store.getCurrent().database.actors[0]!;
          const panel = battlePanel(actor, () => undefined, () => undefined) as unknown as FakeElement;
          const picker = node(panel, `db-picker-actor-equipment-${slot.id}`);
          picker.value = equipmentId;
          picker.dispatchEvent(new Event("change"));
          expect(store.getCurrent().database.actors[0]!.initialEquipment[slot.id]).toBe(equipmentId);
          expect(deserialize(serialize(store.getCurrent())).database.actors[0]!.initialEquipment[slot.id]).toBe(equipmentId);
        } finally {
          restoreDom();
        }
      });
    });
  });
  describe("databaseAnimationCellStaleClosure", () => {
    isolateTimers();
    // P2/P8 회귀 스펙(qa-battle Major): 셀 값을 인라인 수정한 직후 '셀 추가/삭제'를 누르면
    // 렌더 시점 셀 배열(스테일 클로저)이 프레임을 덮어써 방금 수정한 값이 조용히 롤백되던 결함.
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      (globalThis as unknown as { Image: new () => object }).Image = class {
        addEventListener(): void {}
        set src(_value: string) {}
      };
      store.replace(createBlankProject());
      resetMapEditHistory();
      editorState.set({ selectedAnimationFrameIndex: 0, selectedAnimationCellIndex: 0 });
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    function renderForm(): { form: FakeElement; animationId: string } {
      const animation = store.getCurrent().database.battleAnimations[0];
      if (!animation) throw new Error("expected default battle animation");
      const form = el("div") as unknown as FakeElement;
      renderBattleAnimationRecordForm(form as unknown as HTMLElement, animation);
      return { form, animationId: animation.id };
    }
    function storedCells(animationId: string): readonly { x: number }[] {
      const record = store.getCurrent().database.battleAnimations.find((entry) => entry.id === animationId);
      return record?.frames?.[0]?.cells ?? [];
    }
    describe("battle animation cell mutations refetch from the store (P2)", () => {
      it("keeps an inline cell edit when 셀 추가 is clicked right after", () => {
        const { form, animationId } = renderForm();
        const xInput = findByTestId(form, "db-animation-cell-x-0");
        if (!xInput) throw new Error("missing cell x input");
        xInput.value = "55";
        xInput.dispatchEvent(new Event("input"));
        expect(storedCells(animationId)[0]?.x).toBe(55);

        const add = findByTestId(form, "db-animation-cell-add");
        if (!add) throw new Error("missing cell add button");
        add.dispatchEvent(new Event("click"));

        const cells = storedCells(animationId);
        expect(cells.length).toBe(2);
        // 스테일 클로저였다면 여기서 x 가 0 으로 롤백된다.
        expect(cells[0]?.x).toBe(55);
      });

      it("keeps an inline cell edit when another cell is deleted right after", () => {
        const { form, animationId } = renderForm();
        // 셀을 하나 늘려 2개로 만든 뒤 다시 그린다.
        const add = findByTestId(form, "db-animation-cell-add");
        if (!add) throw new Error("missing cell add button");
        add.dispatchEvent(new Event("click"));
        expect(storedCells(animationId).length).toBe(2);

        const form2 = el("div") as unknown as FakeElement;
        const animation = store.getCurrent().database.battleAnimations.find((entry) => entry.id === animationId);
        if (!animation) throw new Error("missing animation");
        renderBattleAnimationRecordForm(form2 as unknown as HTMLElement, animation);

        const xInput = findByTestId(form2, "db-animation-cell-x-0");
        if (!xInput) throw new Error("missing cell x input");
        xInput.value = "77";
        xInput.dispatchEvent(new Event("input"));

        const deleteSecond = findByTestId(form2, "db-animation-cell-delete-1");
        if (!deleteSecond) throw new Error("missing cell delete button");
        deleteSecond.dispatchEvent(new Event("click"));

        const cells = storedCells(animationId);
        expect(cells.length).toBe(1);
        expect(cells[0]?.x).toBe(77);
      });
    });
  });
  describe("databaseClassLearnedSkills", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    describe("class learned skills editor", () => {
      it("editing the first row does not drop the rest of learnedSkills", () => {
        const klass = store.getCurrent().database.classes[0];
        const skills = store.getCurrent().database.skills;
        if (!klass || skills.length < 2) throw new Error("fixture needs a class and two skills");
        updateDatabaseRecord("classes", klass.id, {
          learnedSkills: [
            { level: 1, skillId: skills[0]!.id },
            { level: 8, skillId: skills[1]!.id },
          ],
        });

        const form = document.createElement("section") as unknown as FakeElement;
        renderClassRecordForm(form as unknown as HTMLElement, store.getCurrent().database.classes[0]!);

        const level = findByTestId(form, "db-field-class-skill-level");
        expect(level).not.toBeNull();
        level!.value = "3";
        level!.dispatchEvent(new Event("input"));

        const after = store.getCurrent().database.classes[0]!;
        expect(after.learnedSkills).toHaveLength(2);
        expect(after.learnedSkills[0]).toEqual({ level: 3, skillId: skills[0]!.id });
        expect(after.learnedSkills[1]).toEqual({ level: 8, skillId: skills[1]!.id });
      });

      it("add button appends a learned-skill row instead of replacing the array", () => {
        const klass = store.getCurrent().database.classes[0];
        const skills = store.getCurrent().database.skills;
        if (!klass || !skills[0]) throw new Error("fixture needs a class and a skill");
        updateDatabaseRecord("classes", klass.id, {
          learnedSkills: [{ level: 1, skillId: skills[0].id }],
        });

        const form = document.createElement("section") as unknown as FakeElement;
        renderClassRecordForm(form as unknown as HTMLElement, store.getCurrent().database.classes[0]!);
        findByTestId(form, "db-add-class-skill")?.click();

        const after = store.getCurrent().database.classes[0]!;
        expect(after.learnedSkills.length).toBe(2);
        expect(after.learnedSkills[0]?.skillId).toBe(skills[0].id);
      });
    });
  });
});

describe("editorPanelsSuite17", () => {
  isolateTimers();
  describe("databaseCollectionTabsHardening", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    function species(patch: Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, "id" | "name">): MonsterSpeciesRecord {
      return normalizeMonsterSpeciesRecord(patch);
    }
    function firstEnemyForm(): { form: FakeElement; enemyId: string } {
      const enemy = store.getCurrent().database.enemies[0];
      if (!enemy) throw new Error("enemy fixture missing");
      const form = new FakeElement("div");
      renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
      return { form, enemyId: enemy.id };
    }
    function setNumber(form: FakeElement, testid: string, value: string): FakeElement {
      const input = findByTestId(form, testid);
      if (!input) throw new Error(`missing field ${testid}`);
      input.value = value;
      input.dispatchEvent(new Event("input"));
      return input;
    }
    describe("F1 포획률 스케일 마이그레이션", () => {
      it("0~100 스케일로 저작된 값을 0~1로 이관하고 이미 0~1인 값은 그대로 둔다", () => {
        expect(species({ id: "a", name: "a", captureRate: 40 }).captureRate).toBe(0.4);
        expect(species({ id: "a", name: "a", captureRate: 0.4 }).captureRate).toBe(0.4);
      });

      it("출하 기본 종족이 1.0으로 뭉개지지 않는다", () => {
        const records = defaultBattleRecords().monsterSpecies ?? [];
        expect(records.length).toBeGreaterThan(0);
        for (const record of records) {
          expect(record.captureRate).toBeLessThanOrEqual(1);
          expect(record.captureRate).toBeLessThan(1);
        }
      });
    });
    describe("F2 적 그룹 좌표", () => {
      it("에디터가 만든 좌표가 런타임에서 재배치되지 않는다", () => {
        const project = store.getCurrent();
        const enemyId = project.database.enemies[0]?.id;
        if (!enemyId) throw new Error("enemy fixture missing");
        const members = [0, 1, 2, 3].map((index) => ({ enemyId, ...classicEnemyFormation(index), hidden: false }));
        for (const member of members) expect(member.x).toBeLessThanOrEqual(150);
        const troop: TroopRecord = {
          ...project.database.troops[0]!,
          members,
          enemyIds: members.map((member) => member.enemyId),
        };
        const battlers = enemyBattlers(project, troop);
        battlers.forEach((battler, index) => {
          expect(battler.battleX).toBe(members[index]!.x);
          expect(battler.battleY).toBe(members[index]!.y);
        });
      });
    });
    describe("F3 전투 이벤트 조건 편집", () => {
      it("첫 조건을 편집해도 추가 조건이 살아 있다", () => {
        const troopId = store.getCurrent().database.troops[0]!.id;
        store.update((project) => {
          const troop = project.database.troops.find((entry) => entry.id === troopId)!;
          troop.battleEventPages = [
            {
              id: "page-1",
              name: "테스트",
              span: "battle",
              conditions: [
                { kind: "turn", start: 1, interval: 1 },
                { kind: "switch", switchId: "0001", value: true },
              ],
              commands: [],
            },
          ];
        });
        const troop = store.getCurrent().database.troops.find((entry) => entry.id === troopId)!;
        const page = troop.battleEventPages[0]!;
        const stored = page.conditions;
        updateTroopBattleEventPage(troop, page, { conditions: [{ kind: "turn", start: 3, interval: 1 }, ...stored.slice(1)] });
        const after = store.getCurrent().database.troops.find((entry) => entry.id === troopId)!.battleEventPages[0]!;
        expect(after.conditions).toHaveLength(2);
        expect(after.conditions[1]?.kind).toBe("switch");
      });

      it("전용 폼이 없는 조건 종류는 undefined 를 반환해 편집을 잠근다", () => {
        expect(kindOfBattleEventCondition({ kind: "selfSwitch", switchId: "A", value: true } as never)).toBeUndefined();
        expect(kindOfBattleEventCondition({ kind: "turn", start: 1, interval: 1 })).toBe("turn");
        expect(kindOfBattleEventCondition(undefined)).toBe("none");
      });
    });
    describe("F4/F6 적 숫자 필드", () => {
      it("레벨 입력이 화면값과 저장값 모두 99로 클램프된다", () => {
        const { form, enemyId } = firstEnemyForm();
        const input = setNumber(form, "db-field-enemy-level", "120");
        expect(input.value).toBe("99");
        expect(store.getCurrent().database.enemies.find((entry) => entry.id === enemyId)?.level).toBe(99);
      });

      it("드롭률 입력이 화면에서 100으로 클램프된다", () => {
        const { form } = firstEnemyForm();
        expect(setNumber(form, "db-field-enemy-drop-rate", "500").value).toBe("100");
      });
    });
    describe("F9 공격 패턴 표", () => {
      it("행동이 0개면 유령 행 대신 빈 상태를 보여주고, 행 추가가 실제 행동을 만든다", () => {
        const enemy = store.getCurrent().database.enemies[0]!;
        store.update((project) => {
          const target = project.database.enemies.find((entry) => entry.id === enemy.id)!;
          target.actions = [];
        });
        const live = store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id)!;
        const form = new FakeElement("div");
        renderEnemyRecordForm(form as unknown as HTMLElement, live);
        expect(findByTestId(form, "db-enemy-actions-empty")).toBeTruthy();
        expect(findByTestId(form, "db-enemy-action-row-0")).toBeFalsy();
        findByTestId(form, "db-enemy-action-add")?.click();
        expect(store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id)?.actions).toHaveLength(1);
      });
    });
    describe("F5 진화 사이클", () => {
      it("A→B→A 를 사이클로 검출하고 검증 이슈를 낸다", () => {
        const a = species({ id: "sp_a", name: "A", evolutions: [{ toSpeciesId: "sp_b", requires: { level: 5 } }] });
        const b = species({ id: "sp_b", name: "B", evolutions: [{ toSpeciesId: "sp_a", requires: { level: 9 } }] });
        expect(monsterEvolutionCycleSpeciesIds([a, b])).toEqual(["sp_a", "sp_b"]);
        store.update((project) => {
          project.database.monsterSpecies = [a, b];
        });
        const issues = collectProjectReferenceIssues(store.getCurrent());
        expect(issues.filter((issue) => issue.includes("사이클"))).toHaveLength(1);
      });
    });
    describe("F16 종족 삭제 가드", () => {
      it("giveMonster 명령이 참조하는 종족은 삭제 가드에 걸린다", () => {
        store.update((project) => {
          project.database.monsterSpecies = [species({ id: "sp_a", name: "A" })];
          project.commonEvents = [
            { id: "ce_1", name: "테스트", trigger: "none", commands: [{ kind: "giveMonster", speciesId: "sp_a", level: 5 }] } as never,
          ];
        });
        expect(monsterSpeciesReferenceMessage("sp_a")).not.toBeUndefined();
        expect(monsterSpeciesReferenceMessage("sp_a")).not.toBeNull();
      });

      it("다른 종족의 진화 대상이면 삭제 가드에 걸린다", () => {
        store.update((project) => {
          project.database.monsterSpecies = [
            species({ id: "sp_a", name: "A", evolutions: [{ toSpeciesId: "sp_b", requires: { level: 5 } }] }),
            species({ id: "sp_b", name: "B" }),
          ];
        });
        expect(monsterSpeciesReferenceMessage("sp_b")).toContain("진화");
      });
    });
  });
  describe("databaseControlsNumberField", () => {
    isolateTimers();
    // P4: numberField 가 클램프 후 input.value 를 되쓰지 않아(percentField 와 패턴 불일치)
    // 화면과 저장값이 어긋나던 결함 회귀 방지. blur(change) 시 표시가 반드시 정규화돼야 한다.
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    function renderNumberField(
      value: number,
      bounds?: { min: number; max: number }
    ): { input: FakeElement; committed: number[] } {
      const committed: number[] = [];
      const field = numberField("테스트", "test-number-field", value, (next) => committed.push(next), bounds);
      const input = (field as unknown as FakeElement).querySelector("input");
      if (!input) throw new Error("numberField 가 input 을 렌더하지 않음");
      return { input, committed };
    }
    describe("numberField bounds clamp + display write-back (P4)", () => {
      it("clamps over-max input immediately and rewrites the visible value", () => {
        const { input, committed } = renderNumberField(50, { min: 0, max: 100 });
        input.value = "500000";
        input.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(100);
        expect(input.value).toBe("100");
      });

      it("clamps under-min input and rewrites the visible value", () => {
        const { input, committed } = renderNumberField(50, { min: 0, max: 100 });
        input.value = "-50";
        input.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(0);
        expect(input.value).toBe("0");
      });

      it("normalizes the display on blur(change) — cleared field shows the clamped floor", () => {
        const { input, committed } = renderNumberField(50, { min: 1, max: 99 });
        input.value = "";
        input.dispatchEvent(new Event("input"));
        input.dispatchEvent(new Event("change"));
        expect(input.value).toBe("1");
        expect(committed.at(-1)).toBe(1);
      });

      it("sets min/max attributes when bounds are provided", () => {
        const { input } = renderNumberField(5, { min: 0, max: 100 });
        expect(input.getAttribute("min")).toBe("0");
        expect(input.getAttribute("max")).toBe("100");
      });

      it("without bounds keeps raw commits but still normalizes NaN display on blur", () => {
        const { input, committed } = renderNumberField(5);
        input.value = "1234";
        input.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(1234);
        expect(input.value).toBe("1234");
        input.value = "";
        input.dispatchEvent(new Event("change"));
        expect(input.value).toBe("0");
      });

      it("does not rewrite the field while typing an in-range value (no cursor jump)", () => {
        const { input } = renderNumberField(5, { min: 0, max: 100 });
        input.value = "42";
        input.dispatchEvent(new Event("input"));
        expect(input.value).toBe("42");
      });

      it("keeps a leading minus so a signed value can be typed (skill priority, backdrop scroll)", () => {
        const committed: number[] = [];
        const field = numberField("우선도", "test-number-field", 0, (next) => committed.push(next), { min: -7, max: 7 });
        const input = (field as unknown as FakeElement).querySelector("input");
        if (!input) throw new Error("numberField 가 input 을 렌더하지 않음");
        input.value = "-";
        input.dispatchEvent(new Event("input"));
        expect(committed).toEqual([]);
        expect(input.value).toBe("-");
        input.value = "-2";
        input.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(-2);
        expect(input.value).toBe("-2");
      });

      it("keeps a trailing decimal and an equivalent spelling while a fraction is typed", () => {
        const committed: number[] = [];
        const field = numberField("배율", "test-number-field", 1, (next) => committed.push(next), { min: 0, max: 10, step: 0.05 });
        const input = (field as unknown as FakeElement).querySelector("input");
        if (!input) throw new Error("numberField 가 input 을 렌더하지 않음");
        input.value = "1.";
        input.dispatchEvent(new Event("input"));
        expect(committed).toEqual([]);
        expect(input.value).toBe("1.");
        input.value = "1.0";
        input.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(1);
        expect(input.value).toBe("1.0");
        input.value = "1.05";
        input.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(1.05);
        expect(input.value).toBe("1.05");
      });

      it("resolves a lone minus to the floor when the field blurs", () => {
        const committed: number[] = [];
        const field = numberField("우선도", "test-number-field", 1, (next) => committed.push(next), { min: -7, max: 7 });
        const input = (field as unknown as FakeElement).querySelector("input");
        if (!input) throw new Error("numberField 가 input 을 렌더하지 않음");
        input.value = "-";
        input.dispatchEvent(new Event("change"));
        expect(input.value).toBe("-7");
        expect(committed.at(-1)).toBe(-7);
      });
    });
  });
  describe("databaseCropView", () => {
    isolateTimers();
    let previousWindow: typeof globalThis.window | undefined;
    function stubWindowTimers(): void {
      previousWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          setTimeout: (handler: TimerHandler): number => {
            if (typeof handler === "function") handler();
            return 0;
          },
          clearTimeout,
        },
      });
    }
    function restoreWindow(): void {
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
    function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        render(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    describe("database crop view", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        stubWindowTimers();
        store.replace(createBlankProject());
        resetMapEditHistory();
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
        restoreWindow();
      });

      // fix(db): 계절 체크박스를 전부 해제하면 normalizeCropRecord가 데이터를 "봄"으로 강제
      // 복원하지만 화면(체크박스)은 갱신되지 않아 사용자가 "어느 계절에도 안 자란다"고
      // 착각했다(qa-items-report.md). rerender를 배선해 화면이 실제 저장값을 반영해야 한다.
      it("re-renders the season checkboxes after unchecking all seasons forces a spring restore", () => {
        const host = renderUtility(renderCropTab);
        findByTestId(host, "db-crop-add")?.click();

        const spring = findByTestId(host, "db-crop-season-spring");
        if (!spring) throw new Error("missing spring checkbox");
        expect(spring.checked).toBe(true);

        spring.checked = false;
        spring.dispatchEvent(new Event("input"));

        const cropId = store.getCurrent().database.crops?.[0]?.id;
        expect(store.getCurrent().database.crops?.find((crop) => crop.id === cropId)?.seasons).toEqual(["spring"]);
        // the DOM must reflect the forced restore, not the just-unchecked state
        const springAfter = findByTestId(host, "db-crop-season-spring");
        expect(springAfter?.checked).toBe(true);
      });

      it("adds an undo snapshot before add/delete and duplicate creates a name with the 사본 suffix", () => {
        const host = renderUtility(renderCropTab);
        expect(getMapEditHistoryState().canUndo).toBe(false);

        findByTestId(host, "db-crop-add")?.click();
        expect(getMapEditHistoryState().canUndo).toBe(true);
        const cropId = store.getCurrent().database.crops?.[0]?.id;
        expect(cropId).toBeTruthy();

        findByTestId(host, "db-crop-duplicate")?.click();
        const crops = store.getCurrent().database.crops ?? [];
        expect(crops).toHaveLength(2);
        expect(crops[1]?.name).toBe("새 작물 사본");
      });

      it("requires a second click within the confirm window before deleting a crop", () => {
        const host = renderUtility(renderCropTab);
        findByTestId(host, "db-crop-add")?.click();
        expect(store.getCurrent().database.crops).toHaveLength(1);

        const deleteButton = findByTestId(host, "db-crop-delete");
        if (!deleteButton) throw new Error("missing delete button");

        deleteButton.click();
        expect(deleteButton.textContent).toBe("정말 삭제?");
        expect(store.getCurrent().database.crops).toHaveLength(1);

        deleteButton.click();
        expect(store.getCurrent().database.crops).toHaveLength(0);

        const undone = undoMapEdit();
        expect(undone).toBe(true);
        expect(store.getCurrent().database.crops).toHaveLength(1);
      });

      // Break caught: an empty crop catalog falls back to a blank detail pane with no first action.
      it("offers a first-crop action in the empty state and opens the created record", () => {
        const host = renderUtility(renderCropTab);
        expect(findByTestId(host, "db-crop-empty")).toBeTruthy();

        findByTestId(host, "db-crop-empty-add")?.click();

        expect(store.getCurrent().database.crops).toHaveLength(1);
        expect(findByTestId(host, "db-crop-name")).toBeTruthy();
        // AI 입구는 자료집 머리줄 「말로 고치기」 하나다(impl-database PR-B) — 레코드마다 따로 붙지 않는다.
        expect(findByTestId(host, "small-task-open")).toBeNull();
      });

      // Break caught: the crop tab exposes raw fields but not whether time/farmable-map wiring is ready.
      it("shows farming readiness and a derived crop loop summary", () => {
        const host = renderUtility(renderCropTab);
        expect(findByTestId(host, "db-crop-readiness-time")?.dataset.state).toBe("needs-setup");
        expect(findByTestId(host, "db-crop-readiness-fields")?.dataset.state).toBe("needs-setup");

        findByTestId(host, "db-crop-add")?.click();
        const cropId = store.getCurrent().database.crops?.[0]?.id;
        if (!cropId) throw new Error("missing added crop");
        store.update((project) => {
          project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
          project.maps[project.startMapId].farmableArea = [{ x: 1, y: 1, w: 3, h: 2 }];
          const crop = project.database.crops?.find((entry) => entry.id === cropId);
          if (!crop) return;
          crop.stages = [{ days: 2 }, { days: 3 }];
          crop.harvestCount = 4;
          crop.seasons = ["spring", "summer"];
          crop.regrow = { days: 2 };
        });

        const readyHost = renderUtility(renderCropTab);
        expect(findByTestId(readyHost, "db-crop-readiness-time")?.dataset.state).toBe("ready");
        expect(findByTestId(readyHost, "db-crop-readiness-fields")?.dataset.state).toBe("ready");
        expect(findByTestId(readyHost, "db-crop-overview-growth")?.dataset.days).toBe("5");
        expect(findByTestId(readyHost, "db-crop-overview-yield")?.dataset.count).toBe("4");
        expect(findByTestId(readyHost, "db-crop-overview-seasons")?.dataset.count).toBe("2");
        expect(findByTestId(readyHost, "db-crop-overview-regrow")?.dataset.days).toBe("2");
      });

      // Break caught: broken seed/harvest links are only visible after opening each record by hand.
      it("reports unusable crop records and exposes direct repair actions", () => {
        store.update((project) => {
          project.database.crops = [{
            id: "crop_broken",
            name: "끊긴 작물",
            seedItemId: "missing_seed",
            harvestItemId: "missing_harvest",
            harvestCount: 1,
            stages: [{ days: 1 }],
            seasons: ["spring"],
          }];
        });

        const host = renderUtility(renderCropTab);
        expect(findByTestId(host, "db-crop-readiness-records")?.dataset.invalid).toBe("1");
        expect(findByTestId(host, "db-crop-readiness-records")?.dataset.state).toBe("needs-setup");
        expect(findByTestId(host, "db-crop-readiness-time-action")).toBeTruthy();
        expect(findByTestId(host, "db-crop-readiness-fields-action")).toBeTruthy();
        expect(findByTestId(host, "db-crop-readiness-tools-action")).toBeTruthy();
        expect(findByTestId(host, "db-crop-readiness-records-action")).toBeTruthy();
      });
    });
  });
  describe("databaseCurveDialogDraft", () => {
    isolateTimers();
    // P7 회귀 스펙: 곡선 다이얼로그의 "취소"가 입력값을 적용해버리던 결함(draft 미분리) +
    // 다이얼로그를 닫아도 시트 요약이 갱신되지 않던 결함 + "다음 레벨까지" dead 탭.
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      resetMapEditHistory();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    function body(): FakeElement {
      return document.body as unknown as FakeElement;
    }
    function byTestId(testid: string): FakeElement {
      const found = findByTestId(body(), testid);
      if (!found) throw new Error(`missing [data-testid=${testid}]`);
      return found;
    }
    function commitInput(input: FakeElement, value: string): void {
      input.value = value;
      input.dispatchEvent(new Event("change"));
    }
    describe("class parameter curve dialog draft separation (P7)", () => {
      function openDialog(): void {
        const record = store.getCurrent().database.classes[0];
        if (!record) throw new Error("expected default class");
        const cards = classCurveCards(record);
        const maxHpCard = cards[0];
        if (!(maxHpCard instanceof FakeElement)) throw new Error("expected fake card");
        maxHpCard.dispatchEvent(new Event("click"));
      }

      function storedMaxHpLv1(): number | undefined {
        return store.getCurrent().database.classes[0]?.parameterCurves.maxHp[0];
      }

      it("취소 discards edits even after the value input change committed to the draft", () => {
        const before = storedMaxHpLv1();
        openDialog();
        commitInput(byTestId("db-class-parameter-value"), "77777");
        byTestId("db-class-parameter-cancel").click();
        expect(storedMaxHpLv1()).toBe(before);
        expect(findByTestId(body(), "db-class-parameter-dialog")).toBeNull();
      });

      it("OK commits the draft to the store", () => {
        openDialog();
        commitInput(byTestId("db-class-parameter-value"), "77777");
        byTestId("db-class-parameter-close").click();
        expect(storedMaxHpLv1()).toBe(77777);
      });

      it("도움말 dead 버튼은 제거됐다", () => {
        openDialog();
        const dialog = byTestId("db-class-parameter-dialog");
        expect(dialog.textContent).not.toContain("도움말");
      });
    });
    describe("class experience curve dialog draft + delta tab (P7)", () => {
      function openExpDialog(): { host: FakeElement } {
        const record = store.getCurrent().database.classes[0];
        if (!record) throw new Error("expected default class");
        const host = el("div") as unknown as FakeElement;
        const refresh = (): void =>
          renderExperienceCurvePanel(
            {
              testidPrefix: "db-class-exp",
              dialogLabel: "경험치 곡선 설정",
              readCurve: () => store.getCurrent().database.classes.find((entry) => entry.id === record.id)?.expCurve ?? record.expCurve,
              onCommit: (expCurve) => updateDatabaseRecord("classes", record.id, { expCurve }),
              refresh,
            },
            host as unknown as HTMLElement
          );
        refresh();
        const edit = findByTestId(host, "db-class-exp-edit");
        if (!edit) throw new Error("missing exp edit button");
        edit.dispatchEvent(new Event("click"));
        return { host };
      }

      function storedBase(): number | undefined {
        return store.getCurrent().database.classes[0]?.expCurve.base;
      }

      it("취소 discards the edited base value", () => {
        const before = storedBase();
        openExpDialog();
        commitInput(byTestId("db-class-exp-base"), "999");
        byTestId("db-class-exp-cancel").click();
        expect(storedBase()).toBe(before);
      });

      it("OK commits and the sheet summary rerenders immediately", () => {
        const { host } = openExpDialog();
        commitInput(byTestId("db-class-exp-base"), "999");
        byTestId("db-class-exp-close").click();
        expect(storedBase()).toBe(999);
        const summary = findByTestId(host, "db-class-exp-summary");
        expect(summary?.textContent).toContain("기본=999");
      });

      it("다음 레벨까지 tab switches the table to per-level deltas", () => {
        openExpDialog();
        const dialog = byTestId("db-class-exp-dialog");
        const before = dialog.querySelector(".db-class-exp-table")?.textContent ?? "";
        const deltaTab = byTestId("db-class-exp-tab-delta");
        deltaTab.dispatchEvent(new Event("click"));
        const after = dialog.querySelector(".db-class-exp-table")?.textContent ?? "";
        expect(after).not.toBe(before);
        expect(deltaTab.classList.contains("active")).toBe(true);
        // 최고 레벨(99)은 "다음 레벨"이 없으므로 - 로 표시.
        expect(after).toContain("L99: -");
        byTestId("db-class-exp-tab-total").dispatchEvent(new Event("click"));
        const restored = dialog.querySelector(".db-class-exp-table")?.textContent ?? "";
        expect(restored).toBe(before);
      });
    });
    describe("actor curve dialogs draft + self-refreshing summaries (P7 + qa-actors)", () => {
      function actor(): ReturnType<typeof store.getCurrent>["database"]["actors"][number] {
        const found = store.getCurrent().database.actors[0];
        if (!found) throw new Error("expected default actor");
        return found;
      }

      it("취소 discards actor parameter edits, OK commits them", () => {
        const record = actor();
        const cards = actorCurveCards(record);
        const maxHpCard = cards[0];
        if (!(maxHpCard instanceof FakeElement)) throw new Error("expected fake card");
        const before = store.getCurrent().database.actors[0]?.parameterCurves.maxHp[0];

        maxHpCard.dispatchEvent(new Event("click"));
        commitInput(byTestId("db-actor-parameter-value"), "4321");
        byTestId("db-actor-parameter-cancel").click();
        expect(store.getCurrent().database.actors[0]?.parameterCurves.maxHp[0]).toBe(before);

        maxHpCard.dispatchEvent(new Event("click"));
        commitInput(byTestId("db-actor-parameter-value"), "4321");
        byTestId("db-actor-parameter-close").click();
        expect(store.getCurrent().database.actors[0]?.parameterCurves.maxHp[0]).toBe(4321);
        // 커밋 후 카드 요약이 즉시 갱신된다(P7 요약 미갱신 회귀 방지).
        expect(maxHpCard.textContent).toContain("4321");
      });

      it("actor exp dialog OK updates the panel summary immediately, 취소 discards", () => {
        const record = actor();
        const panelChildren = actorExperiencePanel(record);
        const row = panelChildren[0];
        if (!(row instanceof FakeElement)) throw new Error("expected fake row");
        const edit = findByTestId(row, "db-actor-exp-edit");
        if (!edit) throw new Error("missing exp edit button");
        const beforeBase = store.getCurrent().database.actors[0]?.expCurve.base;

        edit.dispatchEvent(new Event("click"));
        commitInput(byTestId("db-actor-exp-base"), "500");
        byTestId("db-actor-exp-cancel").click();
        expect(store.getCurrent().database.actors[0]?.expCurve.base).toBe(beforeBase);

        edit.dispatchEvent(new Event("click"));
        commitInput(byTestId("db-actor-exp-base"), "500");
        byTestId("db-actor-exp-close").click();
        expect(store.getCurrent().database.actors[0]?.expCurve.base).toBe(500);
        const summary = findByTestId(row, "db-actor-exp-summary");
        expect(summary?.textContent).toContain("기본=500");
      });
    });
  });
  describe("databaseDeleteGuardCommandCoverage", () => {
    isolateTimers();
    /**
     * 2026-09-19 리뷰 P0-6: 삭제 가드(databaseReferences)와 로드 검증기
     * (commandReferenceValidation)의 커버리지가 어긋나 있었다. 가드가 놓친 참조를 지우면
     * **경고 0건으로 저장**되고, 다음 로드에서 validateProjectReferences 가 하드 실패해
     * 프로젝트 전체가 열리지 않는다.
     *
     * 이 파일의 계약: "로드 검증기가 하드 실패로 다루는 참조는 삭제 가드도 반드시 막는다."
     * 검증기에 assert 를 추가할 때 이 테스트가 같이 깨져야 커버리지가 다시 갈라지지 않는다.
     */
    describe("삭제 가드는 로드 검증기와 같은 명령 참조를 본다", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
        resetMapEditHistory();
      });

      function addCommonEvent(commands: unknown[]): void {
        store.update((project) => {
          project.commonEvents.push({
            id: "ce_guard_probe",
            name: "가드 프로브",
            trigger: "none",
            commands: commands as never,
          } as never);
        });
      }

      /** 새 레코드는 기본 프로젝트의 다른 참조(시작 파티·기본 애니메이션 등)에 안 걸린다. */
      function freshRecordId(collection: Parameters<typeof addDatabaseRecord>[0]): string {
        const id = addDatabaseRecord(collection);
        expect(databaseReferenceMessage(collection, id)).toBeNull();
        return id;
      }

      it("showAnimation 만 참조하는 전투 애니메이션의 삭제를 막는다", () => {
        const animationId = freshRecordId("battleAnimations");

        addCommonEvent([{ kind: "showAnimation", target: "player", animationId, wait: true }]);

        expect(databaseReferenceMessage("battleAnimations", animationId)).toContain("가드 프로브");
      });

      it("enterHeroName 만 참조하는 주인공의 삭제를 막는다", () => {
        const actorId = freshRecordId("actors");

        addCommonEvent([{ kind: "enterHeroName", actorId, maxLength: 8, showInitialName: true, currentName: "" }]);

        expect(databaseReferenceMessage("actors", actorId)).toContain("가드 프로브");
      });

      it("addFollower 만 참조하는 주인공의 삭제를 막는다", () => {
        const actorId = freshRecordId("actors");

        addCommonEvent([{ kind: "addFollower", actorId }]);

        expect(databaseReferenceMessage("actors", actorId)).toContain("가드 프로브");
      });

      it("promoteActor 의 toClassId 만 참조하는 직업의 삭제를 막는다", () => {
        const classId = freshRecordId("classes");
        const actorId = store.getCurrent().database.actors[0]?.id ?? "";

        addCommonEvent([{ kind: "promoteActor", actorId, toClassId: classId }]);

        expect(databaseReferenceMessage("classes", classId)).toContain("가드 프로브");
      });

      it("equipTool 만 참조하는 아이템의 삭제를 막는다", () => {
        const itemId = freshRecordId("items");

        addCommonEvent([{ kind: "equipTool", itemId }]);

        expect(databaseReferenceMessage("items", itemId)).toContain("가드 프로브");
      });

      it("stateRates 로만 참조되는 상태의 삭제를 막는다", () => {
        const stateId = freshRecordId("states");

        store.update((project) => {
          project.database.actors[0]!.stateRates[stateId] = "weak" as never;
        });

        expect(databaseReferenceMessage("states", stateId)).toContain("주인공");
      });

      // 가드가 막아 준 덕분에 저장본이 로드 가능한 상태로 남는다는 반대편 증거.
      it("가드가 막은 참조를 무시하고 지우면 로드 검증기가 실패한다(가드가 필요한 이유)", () => {
        const animationId = freshRecordId("battleAnimations");
        addCommonEvent([{ kind: "showAnimation", target: "player", animationId, wait: true }]);

        store.update((project) => {
          project.database.battleAnimations = project.database.battleAnimations.filter((record) => record.id !== animationId);
        });

        const issues = collectProjectReferenceIssues(store.getCurrent());
        expect(issues.join("\n")).toContain(animationId);
      });
    });
    /**
     * 2026-09-19 리뷰 P0-7: 되돌리기 범위가 프로젝트 전체여서, 도크 모드로 맵을 칠한 뒤 DB 를
     * 되돌리면 맵 편집까지 사라졌다. 프롬프트 문구가 약속하는 범위(=DB)로 좁혔다.
     */
    describe("DB 되돌리기는 맵을 건드리지 않는다", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
        resetMapEditHistory();
      });

      function firstMapId(): string {
        return Object.keys(store.getCurrent().maps)[0] ?? "";
      }

      it("맵만 바뀐 경우 dirty 로 보지 않는다", () => {
        const mapId = firstMapId();
        const dirtySession = createDatabaseModalDirtySession();

        store.update((project) => {
          project.maps[mapId]!.name = "도크로 고친 맵 이름";
        });

        expect(dirtySession.isDirty()).toBe(false);
      });

      it("되돌리기가 세션 중의 맵 편집을 살려 둔다", () => {
        const mapId = firstMapId();
        const actorId = store.getCurrent().database.actors[0]?.id ?? "";
        const originalActorName = store.getCurrent().database.actors[0]?.name ?? "";
        const dirtySession = createDatabaseModalDirtySession();

        // 도크 모드의 정상 흐름: DB 를 고치면서 맵도 함께 칠한다.
        store.update((project) => {
          project.database.actors.find((record) => record.id === actorId)!.name = "버릴 이름";
          project.maps[mapId]!.name = "지켜야 할 맵 이름";
        });
        expect(dirtySession.isDirty()).toBe(true);

        dirtySession.discard();

        expect(store.getCurrent().database.actors[0]?.name).toBe(originalActorName);
        expect(store.getCurrent().maps[mapId]?.name).toBe("지켜야 할 맵 이름");
      });
    });
  });
});
