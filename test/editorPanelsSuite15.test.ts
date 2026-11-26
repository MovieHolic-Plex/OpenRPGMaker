import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_WORK_STRIP_MAX_VISIBLE, aiWorkCardCount, beginAiWorkCard, getAiWorkStripElement, resetAiWorkStripForTest } from "@/editor/panels/aiWorkStrip";
import type { ChangePreviewInput } from "@/editor/panels/aiChangePreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement } from "./fakeDom";
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
import type { Project, MapId } from "@/project/types";
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
        image: "missing: 그림은 ChatGPT 로만 그려요. AI 설정에서 ChatGPT 로그인을 연결해 주세요.",
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

    it("GPT + DeepSeek: 주는 GPT, 검토자는 다른 계열(DeepSeek), 그림은 GPT Image, DeepSeek 은 그림을 못 받아 눈은 GPT", () => {
      const t = table("gpt,deepseek");
      expect(t.main).toBe("openai-codex/gpt-6.2-sol");
      expect(t.smol).toBe("openai-codex/gpt-6-luna");
      expect(t.advisor).toBe("openai-compat:inferhub/deepseek-v4.1-flash");
      expect(t.vision).toBe("openai-codex/gpt-6.2-sol");
      expect(t.image).toBe("openai-codex/codex-image-default");
      expect(t.pixel).toBe("openai-codex/gpt-6.2-sol");
    });

    it("넷 다: 주는 Claude Sonnet 5.5 high, 검토자는 다른 계열(Gemini Argon), 잔일은 다른 계정의 싼 모델(Claude 에는 잔일 칸이 없다), 그림은 GPT Image", () => {
      const roles = resolveAssistantRoles(mockConnectedRoutes("gemini,gpt,claude,deepseek"));
      expect(roles.main).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" } });
      const t = table("gemini,gpt,claude,deepseek");
      expect(t.advisor).toBe("google-antigravity/gemini-4-argon");
      expect(t.smol).toBe("google-antigravity/gemini-3.8-flash");
      expect(t.image).toBe("openai-codex/codex-image-default");
      expect(roles.vision).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" } });
    });

    it("Claude 가 없으면 주 작업은 Argon medium 으로 물러난다", () => {
      const roles = resolveAssistantRoles(mockConnectedRoutes("gemini,gpt"));
      expect(roles.main).toMatchObject({ status: "ok", model: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "medium" } });
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
