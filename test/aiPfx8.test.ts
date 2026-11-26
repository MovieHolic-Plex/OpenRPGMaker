import { describe, expect, it, afterEach, beforeEach, vi, beforeAll } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { type AiConfig, type ChatResult, AI_CONFIG_STORAGE_KEY, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import { offlineChatResponse } from "./fixtures/offlineChatResponse";
import { approvedReviewResponse } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";
import { renderAiChatPanel, renderEmptyProposalNotice, EMPTY_PROPOSAL_NOTICE_DISMISS_MS } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement, renderWithFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";
import { mergesMapBundles, parsePiCommand, plainPiCommand } from "@/editor/panels/aiPiAgentCommand";
import { runTool } from "@/editor/tools";
import { handleCompanionRequest, isCompanionPath } from "../scripts/lib/ohMyPiHttp.mjs";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { DEFAULT_PI_TEAM, resolvePiRunPlan } from "@/ai/piAgent/executionRoute";
import { createTeamBoardState, markTeamBoardDiscarded, markTeamBoardReview, reduceTeamBoard, markTeamBoardAborted, markTeamBoardApplied, markTeamBoardDone, plainLine, teamBoardTotals } from "@/ai/piAgent/teamBoardState";
import { PI_TEAM_ROLES, teamRoleSummaries } from "@/ai/piAgent/team";
import { selectPiToolDefinitions } from "@/ai/piAgent/toolAdapter";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { parseAcceptance } from "@/ai/assistantAcceptance";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { parseOrchestratorDecision, workPlanFromOrchestratorDecision } from "@/ai/workPlan";
import { fixture, plan, size, skip, target } from "./requiredOutcomeFixture";

describe("aiOpeningAuthoring", () => {
  isolateTimers();
  // 선언자가 없으면 세션은 폴백 의도로 첫 목록을 코어 도구로 좁힌다(하이브리드 노출) — 모델이 오프닝 도구를
  // 고른 것처럼 선언을 주입한다(다른 세션 라우팅 테스트와 같은 픽스처).
  const OPENING_DECLARER = fixedDeclarer({ mode: "create", tools: ["get_opening", "set_opening", "remove_opening", "list_opening_media"] });
  const PICTURE = "picture-upload";
  const MOVIE = "movie-upload";
  const VOICE = "voice-upload";
  function mediaProject(): Project {
    const project = createBlankProject();
    project.assets.uploaded[PICTURE] = {
      id: PICTURE, name: "표지 그림", kind: "picture", dataUrl: "data:image/png;base64,AAAA", meta: {},
    };
    project.assets.uploaded[MOVIE] = {
      id: MOVIE, name: "인트로 영상", kind: "movie", dataUrl: "data:video/webm;base64,AAAA", meta: {},
    };
    project.assets.uploaded[VOICE] = {
      id: VOICE, name: "내레이션", kind: "sound", dataUrl: "data:audio/ogg;base64,AAAA", meta: {},
    };
    return project;
  }
  function testConfig(): AiConfig {
    return {
      authMode: "apiKey",
      baseUrl: "http://127.0.0.1:9/v1",
      model: "test",
      liteModel: "test",
      apiKey: "test",
      maxToolCalls: 8,
      maxTokens: 2000,
      reasoningEffort: "low",
    } as AiConfig;
  }
  function toolCall(name: string, args: unknown, id: string): ChatResult {
    return {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
      },
      finishReason: "tool_calls",
    } as ChatResult;
  }
  function final(text: string): ChatResult {
    return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
  }
  describe("어시스턴트 오프닝 저작 루프", () => {
    it("exposes the opening tools and applies set_opening through the real session", async () => {
      const project = mediaProject();
      // set_opening 은 음악을 주지 않으면 기존 오프닝 배경음악을 이어 쓴다(cinematicTools.ts) — 빈 프로젝트의 기본 곡.
      const existingMusic = project.system.opening?.musicResourceId;
      const exposed: string[][] = [];
      const events: SessionEvent[] = [];
      let step = 0;

      const session = new AssistantSession(project, {
        config: testConfig(),
        declareIntent: OPENING_DECLARER,
        chat: async (_config, request): Promise<ChatResult> => {
          const review = approvedReviewResponse(request);
          if (review) return offlineChatResponse(review);
          const names = (request.tools ?? []).map((tool) => tool.function.name);
          exposed.push(names);
          if (!names.includes("set_opening")) return offlineChatResponse(final(JSON.stringify({ mode: "create", needsPlan: false, summary: "오프닝" })));
          step += 1;
          if (step === 1) return offlineChatResponse(toolCall("list_opening_media", { kind: "image" }, "opening-1"));
          if (step === 2) {
            return offlineChatResponse(toolCall("set_opening", {
              enabled: true,
              skippable: true,
              scenes: [
                { kind: "text", narration: "폭풍우 치던 밤", durationMs: 0 },
                { kind: "image", resourceId: PICTURE, narration: "그날의 사진", durationMs: 4000, motion: "zoom" },
                { kind: "video", resourceId: MOVIE, narrationAudioResourceId: VOICE, narration: "영상", durationMs: 0 },
              ],
            }, "opening-2"));
          }
          return offlineChatResponse(final("오프닝을 저장했습니다."));
        },
      });

      const result = await session.sendUserMessage("커스텀 오프닝을 만들어줘", event => { events.push(event); }, undefined, { autonomous: false });

      expect(exposed[0], "본문 요청에 오프닝 툴이 노출되어야 한다").toEqual(expect.arrayContaining(["get_opening", "set_opening", "remove_opening", "list_opening_media"]));
      const opening = session.getProposedProject().system.opening;
      expect(opening).toEqual({
        enabled: true,
        skippable: true,
        ...(existingMusic ? { musicResourceId: existingMusic } : {}),
        scenes: [
          { id: "opening-scene-1", kind: "text", narration: "폭풍우 치던 밤", durationMs: 0 },
          { id: "opening-scene-2", kind: "image", resourceId: PICTURE, narration: "그날의 사진", durationMs: 4000, motion: "zoom" },
          { id: "opening-scene-3", kind: "video", resourceId: MOVIE, narrationAudioResourceId: VOICE, narration: "영상", durationMs: 0 },
        ],
      });
      expect(deserialize(serialize(session.getProposedProject())).system.opening).toEqual(opening);
      expect(result.review?.status).toBe("approved");
      const toolEvents = events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
      expect(toolEvents.map((event) => event.name)).toEqual(["list_opening_media", "set_opening"]);
    }, 30000);

    it("keeps a rejected media id recoverable for the next model round", async () => {
      const project = mediaProject();
      let step = 0;
      const auditTools: { name?: string; ok?: boolean }[] = [];

      const session = new AssistantSession(project, {
        config: testConfig(),
        declareIntent: OPENING_DECLARER,
        chat: async (_config, request): Promise<ChatResult> => {
          const review = approvedReviewResponse(request);
          if (review) return offlineChatResponse(review);
          const names = (request.tools ?? []).map((tool) => tool.function.name);
          if (!names.includes("set_opening")) return offlineChatResponse(final(JSON.stringify({ mode: "create", needsPlan: false, summary: "오프닝" })));
          step += 1;
          if (step === 1) {
            return offlineChatResponse(toolCall("set_opening", { scenes: [{ kind: "image", resourceId: "picture-없음", narration: "그림", durationMs: 0, motion: "none" }] }, "bad-1"));
          }
          if (step === 2) {
            return offlineChatResponse(toolCall("set_opening", { scenes: [{ kind: "text", narration: "다시 시도", durationMs: 0 }] }, "good-2"));
          }
          return offlineChatResponse(final("고쳤습니다."));
        },
      });

      await session.sendUserMessage("커스텀 오프닝을 만들어줘", () => {}, undefined, { autonomous: false });

      const audit = JSON.parse(session.exportAudit()) as { entries?: { kind: string; name?: string; ok?: boolean }[] };
      for (const entry of audit.entries ?? []) {
        if (entry.kind === "tool") auditTools.push({ name: entry.name, ok: entry.ok });
      }
      expect(auditTools.map(entry => `${entry.name}:${entry.ok}`)).toEqual(["set_opening:false", "set_opening:true"]);
      expect(session.getProposedProject().system.opening?.scenes).toEqual([
        { id: "opening-scene-1", kind: "text", narration: "다시 시도", durationMs: 0 },
      ]);
    }, 30000);
  });
});

describe("aiPanelGlassResize", () => {
  isolateTimers();
  // 조수 크기 조절 회귀 (감독 지시 2026-08-25: "조수의 크기를 좀 자연스럽게 키울 수 있게").
  //
  // 2026-08-31: 도크 축이 삭제됐다. glass/side/float 3분기가 사라지고 표면은 하나다.
  // 2026-09-03 데크: 그 표면은 컴포저 캡슐이 아니라 레일·기록·컴포저를 담은 `.ai-deck` 이다.
  //   · 소유 프로퍼티: deck 의 CSS 변수 `--ai-float-bar-width` (패널 인라인 크기는 안 쓴다)
  //   · 저장 키: `oprn:ai-panel-size` (최초 1회 레거시 `oprn:ai-panel-size:float` 을 물려받는다)
  //   · 핸들: 데크 왼쪽 끝(`is-edge-start`) — 왼쪽으로 끌면 넓어진다
  //   · 높이는 어떤 경로로도 바뀌지 않는다 — 기록 높이 축(상단 핸들·oprn:ai-log-height)도 걷었다
  describe("aiPanelGlassResize", () => {
    isolateTimers();
    const SIZE_KEY = "oprn:ai-panel-size";
    const LEGACY_FLOAT_SIZE_KEY = "oprn:ai-panel-size:float";
    let restoreDom: (() => void) | null = null;
    let restoreWindow: (() => void) | null = null;
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
    function installFakeWindow(innerWidth = 1600, innerHeight = 1000): void {
      const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
      const target = new EventTarget() as EventTarget & Partial<Window>;
      target.setTimeout = ((..._args: Parameters<typeof setTimeout>) => 0) as typeof setTimeout;
      target.clearTimeout = ((..._args: Parameters<typeof clearTimeout>) => undefined) as typeof clearTimeout;
      // 상태 띠(aiStatusBar)가 window.setInterval 로 시계를 돌린다 — setTimeout 처럼 멈춘 타이머로 둔다.
      target.setInterval = ((..._args: Parameters<typeof setInterval>) => 0) as typeof setInterval;
      target.clearInterval = ((..._args: Parameters<typeof clearInterval>) => undefined) as typeof clearInterval;
      Object.defineProperty(target, "innerWidth", { configurable: true, value: innerWidth });
      Object.defineProperty(target, "innerHeight", { configurable: true, value: innerHeight });
      Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: target });
      restoreWindow = () => {
        if (previous) Object.defineProperty(globalThis, "window", previous);
        else Reflect.deleteProperty(globalThis, "window");
        restoreWindow = null;
      };
    }
    interface Surface {
      readonly panel: FakeElement;
      readonly deck: FakeElement;
      readonly handle: FakeElement;
    }
    /** 패널을 띄우고 크기 계약에 관여하는 세 노드를 뽑는다. */
    function renderSurface(): Surface {
      const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
      const deck = findByTestId(panel, "ai-deck");
      const handle = findByTestId(panel, "ai-resize-handle");
      if (!deck || !handle) throw new Error("resize fixtures missing");
      return { panel, deck, handle };
    }
    /** 데크가 실제로 쓰는 폭. fake DOM 의 style 은 Record 라 커스텀 프로퍼티를 인덱스로 읽는다. */
    function barWidth(deck: FakeElement): string {
      return deck.style["--ai-float-bar-width"] ?? "";
    }
    /** 패널 자체에는 크기용 인라인 스타일이 남지 않아야 한다. */
    function expectNoInlinePanelSize(panel: FakeElement): void {
      expect(panel.style.width ?? "").toBe("");
      expect(panel.style.height ?? "").toBe("");
      expect(panel.style.maxWidth ?? "").toBe("");
      expect(panel.style.maxHeight ?? "").toBe("");
    }
    function pointerEvent(type: string, clientX: number, clientY: number): Event {
      const event = new Event(type);
      Object.defineProperty(event, "clientX", { configurable: true, value: clientX });
      Object.defineProperty(event, "clientY", { configurable: true, value: clientY });
      Object.defineProperty(event, "preventDefault", { configurable: true, value: () => undefined });
      return event;
    }
    function keyEvent(key: string, shiftKey = false): Event {
      const event = new Event("keydown", { cancelable: true });
      Object.defineProperties(event, {
        key: { configurable: true, value: key },
        shiftKey: { configurable: true, value: shiftKey },
      });
      return event;
    }
    function savedSize(): unknown {
      return JSON.parse(storage.get(SIZE_KEY) ?? "null");
    }
    beforeEach(() => {
      vi.stubEnv("VITE_LLM_API_URL", "");
      vi.stubEnv("VITE_LLM_API_KEY", "");
      store.replace(createBlankProject());
      editorState.set({ currentMapId: null, selection: null });
      restoreDom = installFakeDom();
      installFakeLocalStorage();
      // 이 파일은 펼친 데크의 위치·폭을 본다. 첫 부팅 접힘 기본값(aiChatPanel loadPanelCollapsed(true))과는 무관하니 펼침을 저장해 둔다.
      storage.set("oprn:ai-panel-collapsed", "0");
    });
    afterEach(() => {
      restoreWindow?.();
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });
    describe("컴포저 캡슐은 저장된 폭으로 열린다", () => {
      // 삭제: "도크별 키에 저장된 크기를 인라인 스타일로 적용", "접힌 입력줄은 저장 폭을 유지하고 높이만 푼다",
      // "사이드와 float 은 패널 자체 크기를 건드리지 않는다" — 세 케이스 모두 도크별 키/패널 인라인 크기,
      // 즉 삭제된 축을 주제로 삼는다. 남은 계약(저장 폭 적용·뷰포트 clamp)은 아래 케이스가 덮는다.
      it("저장된 폭을 캡슐 CSS 변수로 적용하고 패널에는 인라인 크기를 남기지 않는다", () => {
        installFakeWindow();
        storage.set(SIZE_KEY, JSON.stringify({ width: 520, height: 700 }));

        const { panel, deck } = renderSurface();

        expect(barWidth(deck)).toBe("520px");
        expect(panel.style["--ai-float-bar-width"]).toBe("520px");
        expectNoInlinePanelSize(panel);
      });

      it("저장값이 없으면 CSS 기본폭에 맡기고 변수를 쓰지 않는다", () => {
        installFakeWindow();

        const { deck } = renderSurface();

        // 변수를 안 쓰면 assistant-command-bar.css 의 `var(--ai-float-bar-width, 640px)` 폴백이 산다.
        expect(barWidth(deck)).toBe("");
      });

      it("레거시 float 키만 있어도 사용자가 맞춰 둔 폭을 물려받는다", () => {
        installFakeWindow();
        storage.set(LEGACY_FLOAT_SIZE_KEY, JSON.stringify({ width: 700, height: 400 }));

        const { deck } = renderSurface();

        expect(barWidth(deck)).toBe("700px");
      });

      it("뷰포트보다 큰 저장값은 화면 안으로 줄여서 적용한다", () => {
        installFakeWindow(800, 700);
        storage.set(SIZE_KEY, JSON.stringify({ width: 900, height: 900 }));

        const { deck } = renderSurface();

        // 캡슐 상한 = min(PANEL_SIZE_LIMITS.maxWidth, 뷰포트폭 − 24) = 776.
        expect(barWidth(deck)).toBe("776px");
      });

      it("뷰포트 축소 후 ARIA valuemax/now 는 표시 클램프 폭을 따르고 저장 선호폭은 유지한다", () => {
        // Break: aria-valuenow advertises raw saved 900 while max is 776.
        installFakeWindow(800, 700);
        storage.set(SIZE_KEY, JSON.stringify({ width: 900, height: 400 }));
        const { deck, handle } = renderSurface();

        expect(barWidth(deck)).toBe("776px");
        expect(handle.getAttribute("aria-valuemax")).toBe("776");
        expect(handle.getAttribute("aria-valuenow")).toBe("776");
        // Preferred storage untouched by viewport-only apply.
        expect(savedSize()).toEqual({ width: 900, height: 400 });
      });
    });
    describe("핸들은 캡슐 왼쪽 끝의 세로 분리자다", () => {
      // 삭제: "핸들은 유리에서 우하단 코너 모드로 표시된다" — `is-corner-end` 는 도크와 함께 사라졌다.
      it("캡슐에 붙고 edge-start / vertical / 폭 전용 라벨을 쓴다", () => {
        installFakeWindow();
        storage.set(SIZE_KEY, JSON.stringify({ width: 520, height: 700 }));

        const { deck, handle } = renderSurface();

        expect(handle.parentElement).toBe(deck);
        expect(handle.className).toContain("is-edge-start");
        expect(handle.className).not.toContain("is-corner-end");
        expect(handle.getAttribute("role")).toBe("separator");
        expect(handle.getAttribute("tabindex")).toBe("0");
        expect(handle.getAttribute("aria-orientation")).toBe("vertical");
        expect(handle.getAttribute("aria-label")).toBe("조수 입력줄 폭 조절");
        expect(handle.getAttribute("aria-valuemin")).toBe("280");
        expect(handle.getAttribute("aria-valuemax")).toBe("960");
        expect(handle.getAttribute("aria-valuenow")).toBe("520");
      });
    });
    describe("드래그는 폭만 바꾼다", () => {
      // 삭제: "side는 왼쪽 edge 드래그로 width callback만 갱신하고 side 키에 저장한다"(사이드 도크 없음),
      // "유리에서 오른쪽·아래로 끌면 커지고 놓으면 유리 키에 저장된다"(코너 드래그·유리 키 없음).
      it("왼쪽으로 끌면 넓어지고 놓을 때 저장된다 — 높이는 그대로", () => {
        installFakeWindow();
        storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
        const { panel, deck, handle } = renderSurface();

        handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
        globalThis.window.dispatchEvent(pointerEvent("pointermove", 340, 450));

        // 핸들이 캡슐 왼쪽 끝이므로 dx 부호가 반전된다: 640 + (500 − 340) = 800.
        expect(barWidth(deck)).toBe("800px");

        globalThis.window.dispatchEvent(pointerEvent("pointerup", 340, 450));

        // clientY 가 150px 움직였어도 높이는 저장값 그대로다 — 높이는 조절 대상이 아니다.
        expect(savedSize()).toEqual({ width: 800, height: 400 });
        // 레거시 도크별 키는 더 쓰지 않는다.
        expect(storage.has(LEGACY_FLOAT_SIZE_KEY)).toBe(false);
        expectNoInlinePanelSize(panel);
      });

      it("뷰포트 클램프된 표시 폭에서 안쪽 드래그는 즉시 줄어든다", () => {
        // Break: seed drag from raw saved 900; 80px inward stays clamped at 776.
        installFakeWindow(800, 700);
        storage.set(SIZE_KEY, JSON.stringify({ width: 900, height: 400 }));
        const { deck, handle } = renderSurface();
        expect(barWidth(deck)).toBe("776px");

        handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
        globalThis.window.dispatchEvent(pointerEvent("pointermove", 580, 300)); // +80 clientX = narrower
        // Effective start 776 - 80 = 696.
        expect(barWidth(deck)).toBe("696px");
        expect(handle.getAttribute("aria-valuenow")).toBe("696");
        globalThis.window.dispatchEvent(pointerEvent("pointerup", 580, 300));
        expect(savedSize()).toEqual({ width: 696, height: 400 });
      });

      it("드래그 시작 폭은 전환 중 레이아웃 값이 아니라 커밋된 barSize를 쓴다", () => {
        // Break: seed startWidth from getBoundingClientRect while CSS width is still animating.
        installFakeWindow();
        storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
        const { panel, deck, handle } = renderSurface();
        (deck as unknown as { getBoundingClientRect: () => object }).getBoundingClientRect = () =>
          ({ width: 600, height: 400, x: 0, y: 0, top: 0, left: 0, bottom: 400, right: 600, toJSON: () => ({}) });

        handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
        expect(panel.className).toContain("is-resizing");
        expect(deck.className).toContain("is-resizing");
        globalThis.window.dispatchEvent(pointerEvent("pointermove", 420, 300));
        // 640 + (500-420) = 720, not 600+80=680.
        expect(barWidth(deck)).toBe("720px");
        expect(handle.getAttribute("aria-valuenow")).toBe("720");
        globalThis.window.dispatchEvent(pointerEvent("pointerup", 420, 300));
        expect(savedSize()).toEqual({ width: 720, height: 400 });
        expect(panel.className).not.toContain("is-resizing");
        expect(deck.className).not.toContain("is-resizing");
      });

      it("오른쪽으로 끌면 좁아진다", () => {
        installFakeWindow();
        storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
        const { deck, handle } = renderSurface();

        handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
        globalThis.window.dispatchEvent(pointerEvent("pointermove", 660, 300));
        globalThis.window.dispatchEvent(pointerEvent("pointerup", 660, 300));

        expect(barWidth(deck)).toBe("480px");
        expect(savedSize()).toEqual({ width: 480, height: 400 });
      });

      it("과하게 끌어도 뷰포트·한계 범위 안에서 멈춘다", () => {
        installFakeWindow(800, 700);
        storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
        const { deck, handle } = renderSurface();

        handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
        globalThis.window.dispatchEvent(pointerEvent("pointermove", -4000, 300));
        expect(barWidth(deck)).toBe("776px"); // 뷰포트폭 − 24

        globalThis.window.dispatchEvent(pointerEvent("pointermove", 4000, 300));
        expect(barWidth(deck)).toBe("280px"); // PANEL_SIZE_LIMITS.minWidth

        globalThis.window.dispatchEvent(pointerEvent("pointerup", 4000, 300));
        expect(savedSize()).toEqual({ width: 280, height: 400 });
      });
    });
    describe("키보드는 폭만 조절한다", () => {
      // 삭제: "키보드는 width를 조절하고 glass에서만 height 화살표를 허용한다" — 도크별 분기와
      // 높이 화살표가 함께 사라졌다. 아래 두 케이스가 폭 조절 + 높이 불변을 각각 못박는다.
      it("ArrowLeft는 넓히고 ArrowRight는 좁히며 즉시 저장한다", () => {
        installFakeWindow();
        storage.set(SIZE_KEY, JSON.stringify({ width: 400, height: 600 }));
        const { deck, handle } = renderSurface();

        handle.dispatchEvent(keyEvent("ArrowLeft"));

        expect(barWidth(deck)).toBe("408px");
        expect(handle.getAttribute("aria-valuenow")).toBe("408");
        expect(savedSize()).toEqual({ width: 408, height: 600 });

        // Shift 는 32px 스텝.
        handle.dispatchEvent(keyEvent("ArrowRight", true));

        expect(barWidth(deck)).toBe("376px");
        expect(savedSize()).toEqual({ width: 376, height: 600 });
      });

      it("위/아래 화살표는 아무 일도 하지 않는다 — 높이는 조절 축이 아니다", () => {
        installFakeWindow();
        storage.set(SIZE_KEY, JSON.stringify({ width: 400, height: 600 }));
        const { panel, deck, handle } = renderSurface();

        const up = keyEvent("ArrowUp", true);
        const down = keyEvent("ArrowDown", true);
        handle.dispatchEvent(up);
        handle.dispatchEvent(down);

        expect(barWidth(deck)).toBe("400px");
        expect(savedSize()).toEqual({ width: 400, height: 600 });
        // 소비하지 않으므로 기본 스크롤 동작을 막지도 않는다.
        expect(up.defaultPrevented).toBe(false);
        expect(down.defaultPrevented).toBe(false);
        expectNoInlinePanelSize(panel);
      });
    });
    describe("기록 높이 축은 없다 — 데크가 한 표면이다", () => {
      it("기록 높이 핸들·기록 줌 크롬이 렌더되지 않는다", () => {
        // Break: 데크 안에 옛 기록 카드 상단 핸들이나 − 100% + 스테퍼가 되살아난다.
        installFakeWindow();
        const { panel, deck } = renderSurface();
        expect(findByTestId(panel, "ai-log-resize-handle")).toBeNull();
        expect(findByTestId(panel, "ai-log-zoom")).toBeNull();
        expect(findByTestId(panel, "ai-log-chrome")).toBeNull();
        // 데크는 레일 → 기록 → 컴포저 순서다.
        const order = deck.children.map((child) => (child as FakeElement).dataset.testid ?? (child as FakeElement).className);
        expect(order.indexOf("ai-deck-rail")).toBeLessThan(order.indexOf("ai-chat-body"));
        expect(order.indexOf("ai-chat-body")).toBeLessThan(order.indexOf("ai-command-bar"));
      });
    });
  });
  // 0건 프로포절 비블로킹화(도그푸딩 결함 ⑤) 회귀 테스트.
  // - 전용 알림(ai-proposal-empty-notice)과 전용 닫기 버튼(ai-proposal-dismiss)을 쓴다 —
  //   기존에 [확인] 버튼이 ai-proposal-reject testid를 재사용하던 문제 정리.
  // - 완성도 린트 경고 라인이 알림 본문에 담긴다(대화 로그 기록은 패널 통합 경로에서 수행).
  describe("aiProposalEmptyNotice", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
      vi.restoreAllMocks();
    });
    describe("renderEmptyProposalNotice", () => {
      it("전용 testid(알림/닫기)를 쓰고 완성도 린트 라인을 담는다", () => {
        const onDismiss = vi.fn();
        const lines = ["⚠ 미이행: road_horiz/road_vert/house_a 외 2개 영역 미변경"];
        const notice = renderWithFakeDom(() => renderEmptyProposalNotice(lines, onDismiss));

        expect(notice.dataset.testid).toBe("ai-proposal-empty-notice");
        // 기존 결함: [확인]이 ai-proposal-reject testid를 재사용 → 전용 dismiss testid로 교체 확인.
        expect(findByTestId(notice, "ai-proposal-reject")).toBeNull();
        const dismiss = findByTestId(notice, "ai-proposal-dismiss");
        expect(dismiss).toBeTruthy();
        expect(notice.textContent).toContain("변경 없음");
        expect(notice.textContent).toContain("⚠ 미이행");

        dismiss?.click();
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });

      it("자동 소거 지연은 양수 상수로 정의된다(패시브 알림 계약)", () => {
        expect(EMPTY_PROPOSAL_NOTICE_DISMISS_MS).toBeGreaterThan(0);
      });
    });
  });
  describe("aiSelectionAutoChip", () => {
    isolateTimers();
    describe("selection auto chip", () => {
      let restore: () => void;
      beforeEach(() => {
        restore = installFakeDom({ window: true });
        store.replace(createBlankProject());
        editorState.set({ selection: null, currentMapId: store.getCurrent().startMapId });
        document.body.append(renderAiChatPanel());
      });
      afterEach(() => {
        editorState.set({ selection: null });
        restore();
      });

      function chip(): unknown {
        return findByTestId(document.body as unknown as FakeElement, "ai-selection-chip");
      }

      it("선택이 생기면 칩이 자동 부착되고, ×로 해제하면 같은 선택엔 다시 붙지 않는다", () => {
        const mapId = store.getCurrent().startMapId;
        editorState.set({ selection: { mapId, x: 1, y: 1, width: 3, height: 3 } });
        expect(chip()).toBeTruthy();
        (findByTestId(document.body as unknown as FakeElement, "ai-selection-chip-clear") as unknown as HTMLElement).click();
        expect(chip()).toBeFalsy();
        // 같은 선택 그대로 → 재부착 없음
        editorState.set({ zoom: 3 });
        expect(chip()).toBeFalsy();
        // 새 선택 → 재부착
        editorState.set({ selection: { mapId, x: 2, y: 2, width: 4, height: 4 } });
        expect(chip()).toBeTruthy();
      });
    });
  });
  describe("aiSharedSurface", () => {
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
    beforeEach(() => {
      store.replace(createBlankProject());
      restoreDom = installFakeDom({ window: true });
      installFakeLocalStorage();
      document.body.className = "";
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    // 도크 축 삭제(float 단일) — "다음에 갈 도크" 라벨 계산과 「떼기」의 도크 이동 단언은
    // 대상이 없어져 고정 라벨·무동작 계약으로 뒤집었다.
    describe("AI shared surface", () => {
      it("shows the shared empty composer surface", () => {
        // Break: the panel remounts the start-screen empty kit or a private expert board.
        const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
        expect(findByTestId(panel, "ai-start-screen")).toBeNull();
        expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
        expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
        expect(findByTestId(panel, "ai-expert-board")).toBeNull();
        expect(findByTestId(panel, "ai-composer-chips")).toBeNull();
        expect(findByTestId(panel, "ai-input")).toBeTruthy();
        expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
        expect(findByTestId(panel, "ai-send")).toBeTruthy();
        expect(panel.dataset.uiDensity).toBe("shared");
      });

      it("도크 전환 진입점은 하나도 남지 않고, 붙은 곳은 dataset 으로만 읽는다", () => {
        // Break: 「입력줄」이라고만 적힌 채 눌러도 아무 일이 없는 도크 노드가 되살아났다.
        // 그런 노드는 없는 선택지를 광고하므로 «있으면» 회귀다.
        const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;

        for (const dead of [
          "ai-dock-mode-btn",
          "ai-dock-mode-btn-header",
          "ai-chat-detach",
          "chat-dock-toggle",
        ]) {
          expect(findByTestId(panel, dead), dead).toBeNull();
        }

        // ☰ 두 표면 모두에서 「도크 전환」 항목이 빠졌다.
        findByTestId(panel, "ai-more-menu-toggle")?.click();
        expect(findByTestId(panel, "ai-more-dock")).toBeNull();
        findByTestId(panel, "ai-command-menu-toggle")?.click();
        expect(findByTestId(panel, "ai-command-menu-dock")).toBeNull();

        // 배치를 읽는 창구는 dataset 하나다 — 레이아웃 테스트가 여기만 본다.
        expect(panel.dataset.chatDock).toBe("float");
      });

      it("대기 화면 선택은 더보기와 컴포저 메뉴 어디에도 없다", () => {
        const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;

        const menu = findByTestId(panel, "ai-more-menu");
        if (menu) menu.hidden = true;
        findByTestId(panel, "ai-more-menu-toggle")?.click();
        expect(menu?.hidden).toBe(false);
        expect(findByTestId(panel, "ai-temperature-quiet-gold")).toBeNull();
        expect(findByTestId(panel, "ai-command-temperature-quiet-gold")).toBeNull();
        expect(panel.dataset.temperature).toBeUndefined();
      });
    });
  });
});

describe("aiPiAgentCommand", () => {
  isolateTimers();
  describe("piAgentCommandAndRoute", () => {
    isolateTimers();
    describe("맵 묶음 병합 여부 = 가드 신호", () => {
      it("평문이라도 에이전트가 둘 이상이면 병합한다(팀 제외)", () => {
        expect(mergesMapBundles({ team: false, mapIds: ["a", "b"], scopedByUser: false, groupCount: 2 })).toBe(true);
        expect(mergesMapBundles({ team: false, mapIds: ["a"], scopedByUser: true, groupCount: 1 })).toBe(true);
        expect(mergesMapBundles({ team: false, mapIds: ["a"], scopedByUser: false, groupCount: 1 })).toBe(false);
        expect(mergesMapBundles({ team: true, mapIds: ["a", "b"], scopedByUser: true, groupCount: 1 })).toBe(false);
        expect(mergesMapBundles({ team: false, mapIds: [], scopedByUser: false, groupCount: 1 })).toBe(false);
      });
    });
    describe("/pi 명령 파서", () => {
      const ctx = { project: createBlankProject() };
      runTool(ctx, "create_map", { id: "map_a", name: "A", width: 10, height: 10 });
      runTool(ctx, "create_map", { id: "map_b", name: "B", width: 10, height: 10 });

      it("접두사가 없으면 null", () => {
        expect(parsePiCommand("집 지어줘", ctx.project, "map_a")).toBeNull();
        expect(parsePiCommand("/pixel", ctx.project, "map_a")).toBeNull();
      });
      it("맵 목록이 없으면 현재 맵이 범위다", () => {
        expect(parsePiCommand("/pi 집 지어줘", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "집 지어줘" });
        expect(parsePiCommand("/pi 집 지어줘", ctx.project, null)).toEqual({ mode: "single", mapIds: [], currentMapId: null, task: "집 지어줘" });
      });
      // scopedByUser 는 이 갈래에서만 켜진다 — 사용자가 맵을 **직접 적은** 턴과 현재 맵으로 채운
      // 기본값을 구별한다. 병합이 범위 밖을 버리는 것은 전자뿐이다(2026-09-17).
      it("실존하는 맵 id 목록은 병렬 범위로 읽고, 사용자가 정한 범위로 표시한다", () => {
        expect(parsePiCommand("/pi map_a,map_b 집 한 채", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 한 채" });
        expect(parsePiCommand("/pi map_a,map_a 집", ctx.project, null)).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: null, scopedByUser: true, task: "집" });
        // 없는 id 는 지시문의 첫 단어일 뿐이다.
        expect(parsePiCommand("/pi map_zzz 집", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "map_zzz 집" });
      });
      it("team은 바로 팀 실행이며 기존 슬래시 명령도 호환된다", () => {
        // currentMapId 는 팀장이 「여기」를 푸는 기준이라 팀 턴에도 늘 실린다(2026-09-15) — 이 기대값은
        // 그때 갱신되지 않아 계속 빨간불이었다.
        expect(parsePiCommand("/team 마을 셋", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
        expect(parsePiCommand("team 마을 셋", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
        expect(parsePiCommand("team\nmap_a,map_b 집 두 채", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 두 채" });
        expect(parsePiCommand("/pi team 마을 셋", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
        expect(parsePiCommand("/team map_a,map_b 집 두 채", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 두 채" });
        expect(parsePiCommand("/pi team map_a,map_b 집 두 채", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 두 채" });
        // 팀 키워드로 시작하는 일반 단어는 명령이 아니다.
        expect(parsePiCommand("/teamspeak 열어줘", ctx.project, "map_a")).toBeNull();
        expect(parsePiCommand("teamwork 설명해줘", ctx.project, "map_a")).toBeNull();
        expect(parsePiCommand("team", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "" });
        expect(parsePiCommand("/team", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "" });
      });
    });
    describe("동반 라우터 /v1/agent/run", () => {
      it("경로를 인식하고 어댑터의 NDJSON 을 실행 기록을 거쳐 seq 를 붙여 넘긴다", async () => {
        expect(isCompanionPath("/v1/agent/run?provider=openai-codex")).toBe(true);
        expect(isCompanionPath("/v1/agent/cancel")).toBe(true);
        const seen: unknown[] = [];
        const ndjson = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"type":"turn","index":1}\n')); c.close(); } });
        const adapters = { runAgent: async (provider: string, body: unknown, options: unknown) => { seen.push([provider, body, options]); return { stream: true, ndjson }; } };
        const result = await handleCompanionRequest(
          { method: "POST", url: "/v1/agent/run?provider=openai-codex", headers: {}, body: { task: "x", mapIds: [], project: {} } },
          adapters,
        );
        expect(result).toMatchObject({ status: 200, stream: true });
        // runId 를 안 보낸 옛 클라이언트도 호스트가 번호를 매겨 헤더로 알려 준다.
        expect(result.headers?.["X-Oprn-Run-Id"]).toMatch(/^[A-Za-z0-9-]{8,64}$/);
        const text = await new Response(result.ndjson).text();
        expect(text.trim().split("\n").map((line) => JSON.parse(line))).toEqual([{ seq: 0, type: "turn", index: 1 }]);
        expect(seen).toHaveLength(1);
        const [provider, body, options] = seen[0] as [string, unknown, { signal?: AbortSignal }];
        expect(provider).toBe("openai-codex");
        expect(body).toEqual({ task: "x", mapIds: [], project: {} });
        expect(options.signal).toBeInstanceOf(AbortSignal);
      });
      it("어댑터가 없으면 501", async () => {
        const result = await handleCompanionRequest({ method: "POST", url: "/v1/agent/run", headers: {}, body: {} }, {});
        expect(result.status).toBe(501);
      });
    });
  });
  // 조수 채팅의 실행 계획 — 루프는 Pi 하나다(2026-09-11).
  //
  // 예전에는 경로 enum(session | pi-agent | pi-team)이 «어느 루프로 가는가» 를 답했다. 조수 세션을
  // deprecated 하면서 남은 결정은 둘뿐이다: «이 실행이 무엇을 해도 되는가»(자율성 다이얼 →
  // readOnly·planOnly·턴 상한·추론)와 «몇 명이 도는가»(`AiConfig.piTeam`).
  describe("piAgentExecutionRoute", () => {
    isolateTimers();
    class MemoryStorage {
      private map = new Map<string, string>();
      get length() { return this.map.size; }
      clear() { this.map.clear(); }
      getItem(key: string) { return this.map.get(key) ?? null; }
      key(index: number) { return [...this.map.keys()][index] ?? null; }
      removeItem(key: string) { this.map.delete(key); }
      setItem(key: string, value: string) { this.map.set(key, value); }
    }
    describe("자율성 다이얼 → Pi 실행 계획", () => {
      it("읽기 전용은 쓰기 없이 답만 한다", () => {
        // Break: readOnly 가 꺼지면 질문 턴이 프로젝트를 바꾼다 — 다이얼이 「읽기 전용」인데 실행되면
        // 사용자가 고른 유일한 안전장치가 사라진다.
        expect(resolvePiRunPlan(resolveAutonomy("readonly"))).toEqual({
          readOnly: true, planOnly: false, maxTurns: 50, thinkingLevel: "low",
        });
      });
      it("계획(확인) 턴은 실행도 막는다", () => {
        // 계획만 세우는데 쓰기 툴이 살아 있으면 "계획" 이 곧 실행이 된다(Pi 에는 세션 플래너가 없다).
        const plan = resolvePiRunPlan(resolveAutonomy("confirm"));
        expect(plan.readOnly).toBe(true);
        expect(plan.planOnly).toBe(true);
        expect(plan.maxTurns).toBe(50);
      });
      it("실행 레벨은 턴 상한·추론이 단조 증가한다", () => {
        const balanced = resolvePiRunPlan(resolveAutonomy("balanced"));
        const autonomous = resolvePiRunPlan(resolveAutonomy("autonomous"));
        const max = resolvePiRunPlan(resolveAutonomy("max"));
        expect([balanced.readOnly, balanced.planOnly]).toEqual([false, false]);
        expect([balanced.maxTurns, autonomous.maxTurns, max.maxTurns]).toEqual([200, 300, 600]);
        expect([balanced.thinkingLevel, autonomous.thinkingLevel, max.thinkingLevel]).toEqual(["low", "medium", "high"]);
      });
      // Break: 여기서 budgetCap(도구 호출 예산)을 다시 집어넣으면 「균형」이 16턴으로 돌아가고,
      // 다이얼을 고르는 것이 **안 고르는 것**(워커 기본 40턴)보다 나빠진다 — 2026-09-17 에 재현한
      // 턴 상한 중단 7건 중 4건이 이 조합이었다. 자율성 레벨은 turn 예산에서만 값을 가져온다.
      it("턴 상한은 도구 호출 예산이 아니라 piMaxTurns 에서 온다", () => {
        for (const level of ["balanced", "autonomous", "max"] as const) {
          const autonomy = resolveAutonomy(level);
          expect(resolvePiRunPlan(autonomy).maxTurns, level).toBe(autonomy.piMaxTurns);
          expect(resolvePiRunPlan(autonomy).maxTurns, level).not.toBe(autonomy.budgetCap);
        }
      });
    });
    describe("평문 지시는 팀 비트만 고른다", () => {
      // 실측(2026-09-15): 팀 모드가 현재 맵을 버려 팀장이 43맵 중 엉뚱한 맵에 배정했다. 사용자는 보통 «지금 보고 있는 맵» 을
      // 고치라고 말하므로, 팀도 현재 맵을 안다 — 후보는 그대로 프로젝트 전체(다른 맵을 지목한 지시가 되게)이고 기본 대상만 현재 맵이다.
      it("단독은 현재 맵이 범위, 팀은 후보 맵 없음 + 현재 맵을 기본 대상으로 싣는다", () => {
        expect(plainPiCommand("  집 지어  ", "single", "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "집 지어" });
        expect(plainPiCommand("집 지어", "team", "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "집 지어" });
      });
      it("현재 맵이 없으면 범위가 비고 지시는 그대로다", () => {
        expect(plainPiCommand("map_a 집 지어", "single", null)).toEqual({ mode: "single", mapIds: [], currentMapId: null, task: "map_a 집 지어" });
      });
    });
    describe("AI 설정의 팀·적용 방식", () => {
      beforeEach(() => { (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage(); });

      it("옛 blob 은 팀 꺼짐 + DEFAULT으로 백필한다", () => {
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gemini-3.7-flash" }));
        const config = loadAiConfig();
        expect(config.piTeam).toBe(DEFAULT_PI_TEAM);
        expect(config.piApply).toBe("default");
      });
      it("팀 비트와 적용 방식은 저장되고 이상한 값은 기본으로 돌아간다", () => {
        saveAiConfig({ ...loadAiConfig(), piTeam: true, piApply: "auto" });
        expect(loadAiConfig().piTeam).toBe(true);
        expect(loadAiConfig().piApply).toBe("auto");
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(AI_CONFIG_STORAGE_KEY)!), piTeam: "yes", piApply: "later" }));
        expect(loadAiConfig().piTeam).toBe(false);
        expect(loadAiConfig().piApply).toBe("default");
      });
      it.each(["yolo", "auto", "default", "review", "step"] as const)("%s 모드가 저장·재로드된다", piApply => {
        saveAiConfig({ ...loadAiConfig(), piApply });
        expect(loadAiConfig().piApply).toBe(piApply);
      });
      it("옛 review 기본값은 DEFAULT로 전환하고 새 명시 선택은 보존한다", () => {
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ piApply: "review", piTeam: true }));
        expect(loadAiConfig().piApply).toBe("default");
        expect(loadAiConfig().piTeam).toBe(true);
        saveAiConfig({ ...loadAiConfig(), piApply: "review" });
        expect(loadAiConfig().piApply).toBe("review");
        saveAiConfig({ ...loadAiConfig(), model: "kept-model" });
        expect(loadAiConfig().piApply).toBe("review");
      });
      it("경로 enum 시절의 `pi-team` 은 팀 비트로 승격한다", () => {
        // 옛 키를 버리면 사용자가 켜 둔 팀이 조용히 사라진다. `session`·`pi-agent` 는 둘 다 «Pi» 다.
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "pi-team" }));
        expect(loadAiConfig().piTeam).toBe(true);
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "session" }));
        expect(loadAiConfig().piTeam).toBe(false);
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ executionRoute: "pi-agent" }));
        expect(loadAiConfig().piTeam).toBe(false);
      });
    });
    describe("검토 대기 단계", () => {
      it("검토 → 버림 / 검토 칩", () => {
        let state = createTeamBoardState("single", "x");
        state = reduceTeamBoard(state, { type: "start", provider: "p", model: "m", toolCount: 1 });
        state = markTeamBoardReview(state, ["타일 12", "이벤트 +1"]);
        expect(state.phase).toBe("검토 대기"); expect(state.reviewChips).toEqual(["타일 12", "이벤트 +1"]);
        const discarded = markTeamBoardDiscarded(state);
        expect(discarded.phase).toBe("버림"); expect(discarded.applied).toMatch(/그대로/);
      });
    });
  });
  describe("piAgentTeam", () => {
    isolateTimers();
    function seeded() {
      const ctx = { project: createBlankProject() };
      runTool(ctx, "create_map", { id: "map_a", name: "A", width: 10, height: 10 });
      runTool(ctx, "create_map", { id: "map_b", name: "B", width: 10, height: 10 });
      return ctx.project;
    }
    describe("팀 역할", () => {
      it("세 역할이 있고 검수는 읽기 툴만, 팀장은 소수 읽기 툴만 받는다", () => {
        expect(teamRoleSummaries().map((role) => role.id)).toEqual(["orchestrator", "builder", "reviewer"]);
        const readOnly = selectPiToolDefinitions(undefined, { readOnly: true });
        expect(readOnly.length).toBeGreaterThan(10);
        expect(readOnly.every((tool) => tool.mode === "read")).toBe(true);
        const orch = selectPiToolDefinitions(undefined, { toolNames: PI_TEAM_ROLES.orchestrator.toolNames });
        expect(orch.map((tool) => tool.name).sort()).toEqual(["get_database_records", "get_map_region", "run_lint"]);
      });
      it("팀장 프롬프트는 후보 맵과 사용자 지시를 담는다", () => {
        const project = seeded();
        const lines = PI_TEAM_ROLES.orchestrator.systemPrompt(project, ["map_a"], "집 지어");
        expect(lines.join("\n")).toMatch(/map_a "A" 10×10/);
        expect(lines.join("\n")).not.toMatch(/map_b/);
        expect(lines.at(-1)).toBe("사용자 지시: 집 지어");
        const all = PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "x").join("\n");
        expect(all).toMatch(/map_a/); expect(all).toMatch(/map_b/);
      });
      // 실측(2026-09-15): 후보만 43맵 주고 「여기」 힌트가 없으면 팀장이 다른 40×40 마을에 배정했다(재현 실행 1).
      // 사용자가 보고 있는 맵을 기본 대상으로 말해 준다 — 후보 목록은 그대로라 다른 맵을 지목한 지시도 된다.
      it("팀장 프롬프트는 사용자가 보고 있는 맵을 기본 대상으로 말한다", () => {
        const project = seeded();
        const lines = PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "여기에 마을", undefined, "map_b");
        const text = lines.join("\n");
        expect(text).toMatch(/보고 있는 맵[^\n]*\n- map_b "B" 10×10/);
        expect(text).toMatch(/「여기」/);
        // 힌트는 후보 목록보다 앞에 온다 — 목록이 길어도 기본 대상이 먼저 읽힌다.
        expect(text.indexOf("보고 있는 맵")).toBeLessThan(text.indexOf("프로젝트의 맵:"));
        // 현재 맵이 없거나 후보 밖이면 힌트도 없다 — 후보를 제한한 사용자의 뜻이 우선이다.
        expect(PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "x").join("\n")).not.toMatch(/보고 있는 맵/);
        expect(PI_TEAM_ROLES.orchestrator.systemPrompt(project, ["map_a"], "x", undefined, "map_b").join("\n")).not.toMatch(/보고 있는 맵/);
        expect(PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "x", undefined, "map_zzz").join("\n")).not.toMatch(/보고 있는 맵/);
      });
    });
    describe("/pi team 파서", () => {
      const project = seeded();
      it("team 키워드는 팀 모드, 맵 목록은 후보", () => {
        expect(parsePiCommand("/pi team 마을 셋", project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
        expect(parsePiCommand("/pi team map_a,map_b 마을", project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "마을" });
        expect(parsePiCommand("/pi 마을", project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "마을" });
      });
    });
    describe("팀 보드 리듀서", () => {
      it("팀 이벤트를 행 단위 상태로 접는다", () => {
        let state = createTeamBoardState("team", "집");
        const events: PiAgentEvent[] = [
          { type: "team_start", task: "집", roles: teamRoleSummaries() },
          { type: "agent_spawn", agentId: "orchestrator-1", role: "orchestrator", mapId: null, mapName: null, task: "집" },
          { type: "agent_spawn", agentId: "builder-1", role: "builder", mapId: "map_a", mapName: "A", task: "집 한 채" },
          { type: "agent_event", agentId: "builder-1", event: { type: "turn", index: 2 } },
          { type: "agent_event", agentId: "builder-1", event: { type: "tool_start", id: "t1", name: "author_house", args: {} } },
          { type: "agent_event", agentId: "builder-1", event: { type: "tool_end", id: "t1", name: "author_house", ok: false, summary: "**겹침**" } },
          { type: "agent_done", agentId: "builder-1", ok: true, summary: "1개 키", stats: { ms: 3000, turns: 4, toolCalls: 3, toolErrors: 1 }, changedKeys: ["maps.map_a"], spills: ["maps.map_b"], conflicts: [] },
          { type: "agent_spawn", agentId: "reviewer-1", role: "reviewer", mapId: "map_a", mapName: "A", task: "검수" },
          { type: "review", agentId: "reviewer-1", mapId: "map_a", ok: false, findings: ["길 끊김 (3,4)"] },
          { type: "team_report", text: "끝" },
          { type: "agent_done", agentId: "orchestrator-1", ok: true, summary: "끝", stats: { ms: 9000, turns: 5, toolCalls: 3, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [] },
        ];
        for (const event of events.slice(0, 6)) state = reduceTeamBoard(state, event);
        expect(state.agents[1]!.lastLine).toBe("✗ author_house — 겹침");
        expect(state.agents[1]!.lastKind).toBe("tool");
        for (const event of events.slice(6)) state = reduceTeamBoard(state, event);
        expect(state.phase).toBe("실행 중");
        expect(state.agents.map((agent) => [agent.agentId, agent.state])).toEqual([
          ["orchestrator-1", "완료"], ["builder-1", "완료"], ["reviewer-1", "완료"],
        ]);
        const builder = state.agents[1]!;
        expect(builder.turns).toBe(4); expect(builder.toolCalls).toBe(3); expect(builder.toolErrors).toBe(1);
        // 완료 뒤 마지막 줄은 보고문으로 바뀐다(중간 툴 실패 문구가 남지 않는다).
        expect(builder.lastLine).toBe("1개 키"); expect(builder.lastKind).toBe("text"); expect(builder.spills).toEqual(["maps.map_b"]);
        expect(state.agents[2]!.review).toEqual({ ok: false, findings: ["길 끊김 (3,4)"] });
        expect(state.report).toBe("끝");
        expect(teamBoardTotals(state)).toEqual({ agents: 3, toolCalls: 6, toolErrors: 1, running: 0 });
        state = reduceTeamBoard(state, { type: "done", project: seeded(), stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps.map_a"] });
        expect(state.phase).toBe("적용 중");
        expect(markTeamBoardApplied(state, "적용").phase).toBe("적용됨");
        // 「적용됨」은 커밋된 실행에만 쓴다 — 적용 없이 끝난 정상 종료(계획·답변·무변경)는 「완료」다.
        expect(markTeamBoardDone(state, "답변").phase).toBe("완료");
        expect(markTeamBoardDone(state, "답변").applied).toBe("답변");
      });
      // 깨질 것: 팀원 이름이 roleLabel 을 덮으면 그 행이 시공인지 검수인지 알 방법이 사라진다
      // (팀 패널의 「지금」 구획에서 정원사 행에 종류 배지가 없던 이유).
      it("팀원 이름이 배지를 덮어도 종류 배지는 남는다", () => {
        let state = createTeamBoardState("team", "x");
        state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: "m", mapName: "M", task: "t", memberId: "gardener", label: "정원사" });
        state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "r1", role: "reviewer", mapId: "m", mapName: "M", task: "t", memberId: "qa", label: "품질" });
        expect(state.agents.map((agent) => [agent.roleLabel, agent.kindLabel])).toEqual([["정원사", "시공"], ["품질", "검수"]]);
      });

      // 깨질 것: 재배정 행이 원인이 된 검수를 가리키지 않으면, 같은 맵에 시공·수정 행이 나란히 쌓여
      // 사용자가 어느 것이 검수 지적 때문에 다시 돈 것인지 구분할 수 없다.
      it("수정 배정 행은 원인이 된 검수 행을 가리킨다", () => {
        let state = createTeamBoardState("team", "x");
        state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: "m", mapName: "M", task: "짓기" });
        state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "r1", role: "reviewer", mapId: "m", mapName: "M", task: "검수" });
        state = reduceTeamBoard(state, { type: "review", agentId: "r1", mapId: "m", ok: false, findings: ["길 끊김"] });
        state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b2", role: "builder", mapId: "m", mapName: "M", task: "길 잇기", fixOf: "r1" });
        expect(state.agents.map((agent) => agent.fixOf)).toEqual([null, null, "r1"]);
      });

      it("중단은 실행 중인 행만 중단으로 바꾼다", () => {
        let state = createTeamBoardState("single", "x");
        state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "a", role: "builder", mapId: "map_a", mapName: "A", task: "x" });
        state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b", role: "builder", mapId: "map_b", mapName: "B", task: "x" });
        state = reduceTeamBoard(state, { type: "agent_done", agentId: "a", ok: true, summary: "", stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [] });
        const aborted = markTeamBoardAborted(state);
        expect(aborted.phase).toBe("중단");
        expect(aborted.agents.map((agent) => agent.state)).toEqual(["완료", "중단"]);
      });
      it("마지막 줄은 마크다운을 벗기고 한 줄로 접는다", () => {
        expect(plainLine("### 결과\n- **집 1**: `map_a` 완료\n- 길 연결")).toBe("결과 집 1: map_a 완료 길 연결");
        expect(plainLine("a".repeat(200), 20)).toHaveLength(21);
      });
      it("평평한 단일 이벤트도 한 행으로 모은다", () => {
        let state = createTeamBoardState("single", "x");
        state = reduceTeamBoard(state, { type: "start", provider: "p", model: "m", toolCount: 3 });
        state = reduceTeamBoard(state, { type: "assistant", text: "다 했다" });
        expect(state.agents).toHaveLength(1);
        expect(state.agents[0]!.lastLine).toBe("다 했다");
      });
    });
  });
});

describe("aiRequiredOutcomes", () => {
  isolateTimers();
  beforeEach(resetIntentDeclarationCache);
  afterEach(resetIntentDeclarationCache);
  beforeAll(() => {
    // Tests here build the ~63MB blank project (createBlankProject) and drive assistant sessions or editor
    // panels over it, fingerprinting/copying it per session. Under ci-full load (8 workers on 4-core runners)
    // single tests measured 10-50s, past vitest's 15s default, so the budget is raised for this file only.
    vi.setConfig({ testTimeout: 120_000 });
  });
  describe("canonical requirements", () => {
    // Removed it "keeps required skipped obligations when a replan tries to weaken them": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

    // Removed it "allows optional skipped work without labeling it verified": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
    // Removed it "fails closed for malformed declarations %j": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

    it("preserves requirements and item links through the planner parser", () => {
      // Given the planner transport's JSON shape.
      const raw = plan([size], ["size"]).args;
      // When parsed and materialized by the actual planner API.
      const parsed = parseOrchestratorDecision(JSON.stringify({ ...raw, action: "new_plan" })).decision;
      if (!parsed || parsed.action === "direct" || parsed.action === "resume") throw new Error("Expected a plan decision");
      const result = workPlanFromOrchestratorDecision(parsed);
      // Then the independent requirement contract survives normalization.
      expect(result).toMatchObject({ requirements: [{ id: "size", required: true }], layers: [{ items: [{ requirementIds: ["size"] }] }] });
    });

    // Removed it "keeps a bare legacy scheduler plan unassessed": it only asserted getAcceptanceSnapshot() is null, which is always true since the acceptance ledger was removed on 2026-09-17 (see below).
    // Removed it "assesses existing explicit acceptance without requiring the new field": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
    // Removed it "retains an unlinked required obligation when replan drops links=%s": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

    // Removed it "binds original text and scope at the host boundary despite fabricated ": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
    // Removed it "retains only the original user utterance through replan with instructi": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

    // Removed it "withdraws only the named current requirement through the user-only API": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
    // Removed it "keeps sibling obligations when the user withdraws just one": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

    // Removed it "rejects model tool withdrawal even with fabricated user provenance": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
    // Removed it "rejects stale goal withdrawal actions": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

    // Removed it "does not erase old obligations on a model resetsContext claim": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
    // Removed it "archives an incomplete goal when the user explicitly starts a new goal": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
  });
  describe("exact scoped verdict authority", () => {
    it.each(["explicit", "wrong-target", "stale", "advisory", "advisory-after-stale", "advisory-after-explicit", "negative", "model"] as const)("evaluates %s evidence without tool-name credit", source => {
      // Given a canonical criterion bound to the complete verification invocation.
      const project = createBlankProject();
      const args = { mapId: target.mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 1 }] };
      const promises = parseAcceptance([{ id: "route", title: "Route", criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }], passed: true }]);
      const ledger = new AssistantAcceptanceLedger("goal", "Route", project);
      ledger.adopt(promises ?? []);
      const evidence = new ToolVerificationEvidence();
      ledger.evaluate(project, project, evidence); // Bind the declared exact scope before executing it.
      const result = { ok: true, data: { reachable: source !== "negative" } };
      if (source !== "model") evidence.observe("check_reachability", source === "wrong-target" ? { ...args, mapId: "foreign" } : args, result, source === "advisory" ? "advisory" : "explicit");
      if (source === "stale" || source === "advisory-after-stale") evidence.invalidateAfterWrite();
      if (source === "advisory-after-stale" || source === "advisory-after-explicit") evidence.observe("check_reachability", args, result, "advisory");
      // When the canonical ledger evaluates actual evidence; then only fresh explicit exact scope verifies.
      const snapshot = ledger.evaluate(project, project, evidence);
      expect(snapshot.status === "verified").toBe(source === "explicit" || source === "advisory-after-explicit");
      expect(snapshot.items[0]?.evidence[0]?.passed).toBe(source === "explicit" || source === "advisory-after-explicit");
    });

    it("does not verify an unapplied draft from a passing scoped verdict", () => {
      // Given a passing host observation and an unapplied content change.
      const applied = createBlankProject();
      const draft = structuredClone(applied);
      draft.meta.title = "Unapplied";
      const evidence = new ToolVerificationEvidence();
      evidence.observe("run_lint", {}, { ok: true, data: { counts: { errors: 0 } } });
      const ledger = new AssistantAcceptanceLedger("draft", "Draft", applied);
      ledger.adopt(parseAcceptance([{ id: "lint", title: "Lint", criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }] }]) ?? []);
      // When assessed against applied content; then passing draft evidence is not goal satisfaction.
      expect(ledger.evaluate(applied, draft, evidence).status).toBe("verifying");
    });

    // Removed it "retires scoped verdicts after applied content changes even if later un": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
    // Removed it "rejects pre-declaration evidence after an external rebase": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

    // Removed it "credits a real scoped tool response through the session dispatcher": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
  });
  describe("question-safe continuation", () => {
    it.each(["ask", "question"] as const)("preserves blocked work and counters for %s", async mode => {
      // Given a genuinely stalled item with retry evidence.
      const f = fixture();
      await f.run([[plan()]]);
      expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("blocked");
      const attempts = [...f.session["ralphAttemptsByItemId"]];
      const reasons = [...f.session["lastBlockReasonByItemId"]];
      if (mode === "question") f.setIntent({ mode: "question" });
      // When the user asks without authorizing retries.
      await f.run([], mode === "ask" ? { composerMode: "ask" } : {}, "Why is it blocked?");
      // Then the question leaves scheduling and retry state intact.
      expect(f.events.filter(event => event.type === "work_plan")).toEqual([]);
      expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("blocked");
      expect([...f.session["ralphAttemptsByItemId"]]).toEqual(attempts);
      expect([...f.session["lastBlockReasonByItemId"]]).toEqual(reasons);
    });

    it("preserves repeated failure counters while answering a question", async () => {
      // Given three real rejected writes that stall their work item.
      const f = fixture();
      const reject = { name: "set_map_properties", args: { mapId: "missing", name: "Rejected" } };
      await f.run([[plan()], [reject], [reject], [reject]]);
      const failures = [...f.session["repeatedToolFailures"]];
      expect(failures.length).toBeGreaterThan(0);
      // When the user asks for the failure explanation.
      await f.run([], { composerMode: "ask" }, "Explain the failure");
      // Then failure evidence remains intact, rather than receiving another retry budget.
      expect([...f.session["repeatedToolFailures"]]).toEqual(failures);
    });

    it("does not reactivate from fabricated continuation source", async () => {
      // Given blocked work and a model claiming continuation for a non-resume message.
      const f = fixture();
      await f.run([[plan()]]);
      f.setIntent({ mode: "other", source: "continuation" });
      // When the model labels the turn; then no work-plan event grants reactivation.
      await f.run([], {}, "Status detail");
      expect(f.events.some(event => event.type === "work_plan" && event.plan?.layers[0]?.items[0]?.status === "in_progress")).toBe(false);
    });

    it("reactivates blocked work only with explicit user resume", async () => {
      // Given a blocked item and an event collector installed before resume.
      const f = fixture();
      await f.run([[plan()]]);
      // When the user dispatches resume; then reactivation is observable before it stalls again.
      await f.run([], { goalAction: "resume" }, "Try again");
      expect(f.events.filter(event => event.type === "work_plan")[0]).toMatchObject({ plan: { layers: [{ items: [{ status: "in_progress" }] }] } });
    });

    it("retains goal evidence and repair counters during ask", async () => {
      // Given a stopped canonical goal through the already-supported acceptance field.
      const f = fixture();
      await f.run([[{ name: "set_work_plan", args: { ...plan().args, acceptance: [size] } }, skip]]);
      const before = f.session.getAcceptanceSnapshot();
      const attempts = f.session["acceptanceRepairAttempts"];
      // When a question is answered; then it neither resumes nor discards goal evidence.
      await f.run([], { composerMode: "ask" }, "What remains?");
      expect(f.session.getAcceptanceSnapshot()).toEqual(before);
      expect(f.session["acceptanceRepairAttempts"]).toBe(attempts);
    });
  });
});
