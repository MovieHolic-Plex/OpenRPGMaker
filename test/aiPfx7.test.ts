import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { changeCountsLine, changedSinceRun, listChangeItems, revertChangeItem } from "@/editor/panels/aiChangeSummaryCard";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project, Command, GameEvent } from "@/project/types";
import { renderAiChatPanel, teardownAiChatPanel, isMetadataOnlyProposal } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement, renderWithFakeDom } from "./fakeDom";
import { publishAiApplyCompletion } from "@/editor/aiApplyCompletion";
import { getMapEditHistoryEntries, getMapEditHistoryState, recordProjectSnapshot, resetMapEditHistory } from "@/editor/mapEditHistory";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { clearConversations } from "@/ai/conversationStore";
import { buildInterviewKickoff, buildStructureLearnKickoff, parseQuickReplies, QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import { type ProposedCall, AssistantSession } from "@/ai/assistantSession";
import { isolateTimers } from "./mergedTeardown";
import assert from "node:assert/strict";
import { parseToolVerdict } from "@/ai/agentVerification";
import { createInterpreter } from "@/player/interpreter";
import { deserialize, resolveEventPage, serialize } from "@/project/io";
import { startSession } from "@/project/session";

describe("aiChangeSummaryCard", () => {
  isolateTimers();
  type MapEvent = GameMap["events"][number];
  const npc = (id: string, x: number, y: number, name = id): MapEvent => ({ id, name, x, y, pages: [] } as unknown as MapEvent);
  function seed(): Project {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "create_map", { id: "map_east", name: "동쪽", width: 12, height: 10 });
    if (!result.ok) throw new Error(result.summary);
    const map = ctx.project.maps.map_east!;
    return { ...ctx.project, maps: { ...ctx.project.maps, map_east: { ...map, events: [npc("ev_a", 1, 1, "촌장")] } } };
  }
  function withMap(project: Project, mapId: string, patch: Partial<GameMap>): Project {
    return { ...project, maps: { ...project.maps, [mapId]: { ...project.maps[mapId]!, ...patch } } };
  }
  describe("listChangeItems", () => {
    it("separates a map's tiles from its events and counts by kind", () => {
      const before = seed();
      const map = before.maps.map_east!;
      const tiles = [...map.lowerTiles]; tiles[5] = 9;
      const after = withMap(before, "map_east", { lowerTiles: tiles, events: [npc("ev_a", 4, 4, "촌장"), npc("ev_b", 2, 2, "상인")] });
      const items = listChangeItems(before, after);
      expect(items.map((item) => `${item.kind}:${item.change}:${item.id}`)).toEqual(["map:modified:map_east", "event:modified:ev_a", "event:added:ev_b"]);
      expect(changeCountsLine(items)).toBe("맵 1 · 이벤트 2");
    });

    it("reports a new map once and its events", () => {
      const before = seed();
      const after = { ...before, maps: { ...before.maps, map_new: { ...before.maps.map_east!, id: "map_new", name: "숲속 마을" } } } as Project;
      const items = listChangeItems(before, after);
      expect(items.filter((item) => item.mapId === "map_new").map((item) => `${item.kind}:${item.change}`)).toEqual(["map:added", "event:added"]);
    });
  });
  describe("revertChangeItem", () => {
    it("puts one moved event back and leaves the other change alone", () => {
      const before = seed();
      const after = withMap(before, "map_east", { events: [npc("ev_a", 4, 4, "촌장"), npc("ev_b", 2, 2, "상인")] });
      const items = listChangeItems(before, after);
      const moved = items.find((item) => item.id === "ev_a")!;
      const next = revertChangeItem(after, before, moved);
      expect(next.maps.map_east!.events.map((event) => [event.id, event.x, event.y])).toEqual([["ev_a", 1, 1], ["ev_b", 2, 2]]);
    });

    it("removes an added event and an added map", () => {
      const before = seed();
      const after = { ...withMap(before, "map_east", { events: [npc("ev_a", 1, 1, "촌장"), npc("ev_b", 2, 2)] }),
        maps: { ...before.maps, map_east: { ...before.maps.map_east!, events: [npc("ev_a", 1, 1, "촌장"), npc("ev_b", 2, 2)] }, map_new: { ...before.maps.map_east!, id: "map_new" } } } as Project;
      const items = listChangeItems(before, after);
      const noEvent = revertChangeItem(after, before, items.find((item) => item.id === "ev_b")!);
      expect(noEvent.maps.map_east!.events.map((event) => event.id)).toEqual(["ev_a"]);
      const noMap = revertChangeItem(noEvent, before, items.find((item) => item.kind === "map" && item.id === "map_new")!);
      expect(Object.keys(noMap.maps)).not.toContain("map_new");
    });

    it("restores map tiles while keeping the map's current events", () => {
      const before = seed();
      const tiles = [...before.maps.map_east!.lowerTiles]; tiles[3] = 7;
      const after = withMap(before, "map_east", { lowerTiles: tiles, events: [npc("ev_a", 6, 6, "촌장")] });
      const item = listChangeItems(before, after).find((entry) => entry.kind === "map")!;
      const next = revertChangeItem(after, before, item);
      expect(next.maps.map_east!.lowerTiles[3]).toBe(before.maps.map_east!.lowerTiles[3]);
      expect(next.maps.map_east!.events[0]!.x).toBe(6);
    });
  });
  describe("changedSinceRun", () => {
    it("notices a hand edit made after the run", () => {
      const before = seed();
      const after = withMap(before, "map_east", { events: [npc("ev_a", 4, 4, "촌장")] });
      const item = listChangeItems(before, after)[0]!;
      expect(changedSinceRun(item, after, after)).toBe(false);
      expect(changedSinceRun(item, after, withMap(after, "map_east", { events: [npc("ev_a", 5, 4, "촌장")] }))).toBe(true);
    });
  });
});

describe("aiChatPanel", () => {
  isolateTimers();
  // 컴포저 입력 경로 UX 회귀 (감독 지시 2026-08-25: "명령어 입력하면 UX 가 너무 구림").
  //
  // 실측한 결함 3개:
  //  E1) `ai-send` 는 turnBusy 일 때만 disabled 였다. 빈 입력에서도 준비된 것처럼 보이고
  //      누르면 `send()` 가 `if (!text) return` 으로 조용히 끝났다 — 피드백 0.
  //      이제 준비 여부는 aria-disabled + `is-not-ready` 로 말한다. 진짜 `disabled` 는
  //      쓰지 않는다: disabled 버튼은 tab 순서에서 버려지고(aiPanelChrome 탭 순서 계약이
  //      이걸 직접 잡는다) 왜 못 보내는지 설명도 못 한다. 진짜 disabled 는 턴 진행 중에만.
  //  E3) "Enter 전송 · Shift+Enter 줄바꿈" 힌트가 액션 행을 영구 점유했다(실측 160x15).
  //      포커스 중에만 보여야 하고, 바 높이 = f(textarea 줄 수) 불변식을 지키려면
  //      display 가 아니라 visibility 로 숨겨야 한다.
  describe("aiComposerInputUx", () => {
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
    function renderPanel(dock: "glass" | "side" | "float" = "glass"): FakeElement {
      return renderAiChatPanel({ clock: () => 37_000, getChatDock: () => dock }) as unknown as FakeElement;
    }
    function typeInto(input: HTMLTextAreaElement, value: string): void {
      input.value = value;
      input.dispatchEvent(new Event("input"));
    }
    beforeEach(() => {
      vi.stubEnv("VITE_LLM_API_URL", "");
      vi.stubEnv("VITE_LLM_API_KEY", "");
      store.replace(createBlankProject());
      editorState.set({ currentMapId: null, selection: null });
      restoreDom = installFakeDom({ window: true });
      installFakeLocalStorage();
    });
    afterEach(() => {
      teardownAiChatPanel();
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });
    describe("E1 전송 버튼은 보낼 게 있을 때만 준비된 상태", () => {
      it("빈 입력이면 미준비, 글자가 들어오면 준비, 지우면 다시 미준비", () => {
        const panel = renderPanel();
        const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
        const send = findByTestId(panel, "ai-send") as unknown as FakeElement;

        expect(send.getAttribute("aria-disabled")).toBe("true");
        expect(send.className).toContain("is-not-ready");

        typeInto(input, "대장간 하나 지어줘");
        expect(send.getAttribute("aria-disabled")).toBe("false");
        expect(send.className).not.toContain("is-not-ready");

        typeInto(input, "");
        expect(send.getAttribute("aria-disabled")).toBe("true");
        expect(send.className).toContain("is-not-ready");
      });

      it("미준비 상태여도 초점·클릭은 살린다 — 진짜 disabled 로 만들지 않는다", () => {
        const panel = renderPanel();
        const send = findByTestId(panel, "ai-send") as unknown as FakeElement & { disabled: boolean };

        expect(send.disabled).toBe(false);
      });

      it("공백만 입력한 경우도 보낼 게 없다고 본다", () => {
        const panel = renderPanel();
        const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
        const send = findByTestId(panel, "ai-send") as unknown as FakeElement;

        typeInto(input, "   \n  ");
        expect(send.getAttribute("aria-disabled")).toBe("true");
      });

      it("왜 보낼 수 없는지 title 로 알려준다", () => {
        const panel = renderPanel();
        const send = findByTestId(panel, "ai-send") as unknown as FakeElement;

        expect(send.getAttribute("title")).toBe("보낼 지시를 입력하세요");
      });
    });
    describe("작업 설정 버튼은 적용 방식 목록과 같은 말을 한다", () => {
      it("기본값은 큰 삭제 확인을 숨기지 않고, 자동 검수는 바로 반영이라고 말한다", () => {
        const panel = renderPanel();
        const button = findByTestId(panel, "ai-composer-settings") as unknown as FakeElement;
        const select = findByTestId(panel, "ai-composer-apply-mode") as unknown as HTMLSelectElement;

        expect(button.textContent).toBe("바로 반영 · 큰 삭제만 확인");
        expect(button.getAttribute("aria-label")).toBe("작업 설정 · 바로 반영 · 큰 삭제만 확인");

        select.value = "auto";
        select.dispatchEvent(new Event("change"));
        expect(button.textContent).toBe("바로 반영 · 자동 검수");
        expect(button.getAttribute("aria-label")).toBe("작업 설정 · 바로 반영 · 자동 검수");
      });
    });
    describe("E3 힌트는 포커스 중에만", () => {
      it("포커스 전에는 액션 행에 포커스 표시가 없고, 포커스하면 붙고 blur 하면 떨어진다", () => {
        const panel = renderPanel();
        const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
        const actions = findByTestId(panel, "ai-composer-actions") as unknown as FakeElement;

        expect(actions.className).not.toContain("is-input-focused");

        input.dispatchEvent(new Event("focus"));
        expect(actions.className).toContain("is-input-focused");

        input.dispatchEvent(new Event("blur"));
        expect(actions.className).not.toContain("is-input-focused");
      });
    });
  });
  // 컴포저 액션 행의 "방금 적용한 AI 변경 되돌리기" 버튼.
  //
  // 이 버튼은 걷어낸 `ai-completion-strip`(맵 위에 fixed 로 떠 있던 요약 + 되돌리기 밴드)의
  // 유일한 실기능 후계자다. 밴드가 들고 있던 요약 문장은 변경 카드 제목이 같은 소스
  // (proposalHumanSummaryLine)로 이미 보여주고 있었고, 밴드 쪽 팔레트만 어긋나 있었다.
  // 계약: 되돌릴 AI 체크포인트가 히스토리 top 일 때만 존재하고, 그 외에는 행에서 빠진다.
  describe("aiComposerUndo", () => {
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
      resetMapEditHistory();
      restoreDom = installFakeDom({ window: true });
      installFakeLocalStorage();
      editorState.set({
        currentMapId: store.getCurrent().startMapId,
        layer: "lower",
        tool: "paint",
        selection: null,
        chatDock: "float",
      });
    });
    afterEach(() => {
      teardownAiChatPanel(); // 완료 스토어(모듈 싱글턴)를 비워 다음 케이스로 새지 않게 한다.
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    function renderPanel(): FakeElement {
      return renderWithFakeDom(() => renderAiChatPanel({}));
    }
    /** 히스토리 스냅샷 서명이 갈라지도록 맵을 실제로 바꾼다(같은 상태는 push 되지 않는다). */
    function editFirstTile(tile: number): void {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      if (!map) throw new Error("start map missing");
      const lowerTiles = [...map.lowerTiles];
      lowerTiles[0] = tile;
      store.replace({ ...project, maps: { ...project.maps, [mapId]: { ...map, lowerTiles } } });
    }
    function publishApplied(summary: string): void {
      publishAiApplyCompletion({
        mapId: store.getCurrent().startMapId,
        instruction: "마을에 대장간 하나",
        summary,
      });
    }
    describe("컴포저 되돌리기 버튼", () => {
      it("컴포저 액션 행에 살고, 적용 전에는 행에서 빠져 있다", () => {
        const panel = renderPanel();
        const undo = findByTestId(panel, "ai-composer-undo");
        if (!undo) throw new Error("composer undo button missing");

        expect(undo.textContent).toContain("되돌리기");
        expect(undo.hidden).toBe(true);
        expect(undo.getAttribute("aria-hidden")).toBe("true");
        expect(undo.closest("[data-testid=ai-composer-actions]")).toBeTruthy();
      });

      it("걷어낸 완료 스트립 표면은 어디에도 남지 않는다", () => {
        const panel = renderPanel();

        expect(findByTestId(panel, "ai-completion-host")).toBeNull();
        expect(findByTestId(panel, "ai-completion-strip")).toBeNull();
        expect(findByTestId(panel, "ai-completion-undo")).toBeNull();
      });

      it("AI 적용이 발행되면 드러나고 요약을 툴팁에 싣는다", () => {
        recordProjectSnapshot("AI 적용", store.getCurrent().startMapId);
        const panel = renderPanel();
        publishApplied("집 1 · 길 12칸");

        const undo = findByTestId(panel, "ai-composer-undo");
        expect(undo?.hidden).toBe(false);
        expect(undo?.getAttribute("aria-hidden")).toBe("false");
        expect(undo?.getAttribute("title")).toContain("집 1 · 길 12칸");
      });

      it("누르면 그 변경을 되돌리고 버튼은 다시 사라진다", () => {
        recordProjectSnapshot("AI 적용", store.getCurrent().startMapId);
        const panel = renderPanel();
        publishApplied("타일 4");
        const undo = findByTestId(panel, "ai-composer-undo");
        expect(undo?.hidden).toBe(false);

        undo?.click();

        expect(getMapEditHistoryState().canUndo).toBe(false);
        expect(undo?.hidden).toBe(true);
      });

      it("AI 체크포인트가 히스토리 top 이 아니면 눌러도 되돌리지 않는다", () => {
        recordProjectSnapshot("AI 적용", store.getCurrent().startMapId);
        const panel = renderPanel();
        publishApplied("타일 4");
        // 사용자가 직접 편집해 AI 체크포인트를 top 에서 밀어냈다.
        editFirstTile(7);
        recordProjectSnapshot("사용자 편집", store.getCurrent().startMapId);
        const before = getMapEditHistoryEntries().length;
        expect(before).toBe(2);

        const undo = findByTestId(panel, "ai-composer-undo");
        undo?.click();

        expect(getMapEditHistoryEntries().length).toBe(before);
        expect(undo?.hidden).toBe(true);
      });
    });
  });
  // AI 채팅 패널 메타 진입점 도달성 회귀.
  //
  // 왜 이 파일이 필요한가 (실측, 2026-08-30 test/e2e/_aichat-bug-hunt):
  // 기본 도크(glass, DEFAULT_CHAT_DOCK)와 side 에서 `.ai-command-menu-toggle` 이
  // `display:none` 이었다 — rect 0x0. float 만 30x30. ☰ 는 aiComposer 의 문서가 말하는
  // **유일한 메타 진입점**이고(헤더는 2026-08-28 에 제거됐다), 그 안에 되돌리기·내보내기·
  // 도크 전환·전체 기록·툴 브라우저·가르치기 3종·설정이 들어 있다. 즉 기본 상태에서 그
  // 전부가 도달 불가였고, side 로 들어가면 `.ai-dock-mode-btn`(숨은 훅 컨테이너 안)도 없어
  // 도크를 되돌릴 수단조차 없었다.
  //
  // 여기서는 두 층을 함께 못박는다: (1) CSS 가 ☰ 를 다시 숨기지 못한다, (2) 세 도크 모두에서
  // 메뉴 항목이 패널 DOM 에 실재한다.
  describe("aiDockMetaReach", () => {
    isolateTimers();
    const DOCK_CSS = path.resolve("src/styles/database/tabs-b-assistant-panel/02-chat-dock.css");
    let restoreDom: (() => void) | null = null;
    let storage: Map<string, string>;
    beforeEach(async () => {
      store.replace(createBlankProject());
      editorState.set({ currentMapId: null, selection: null });
      restoreDom = installFakeDom({ window: true });
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
      await clearConversations();
    });
    afterEach(async () => {
      teardownAiChatPanel();
      await clearConversations();
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    function renderPanel(): FakeElement {
      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test" }));
      return renderAiChatPanel({ clock: () => 1_000 }) as unknown as FakeElement;
    }
    describe("☰ 메타 메뉴는 어느 도크에서도 숨지 않는다", () => {
      it("02-chat-dock.css 의 어떤 display:none 블록도 .ai-command-menu-toggle 을 겨냥하지 않는다", () => {
        const css = readFileSync(DOCK_CSS, "utf8");
        const hidingBlocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/gu)].filter(([, , body]) =>
          /display\s*:\s*none/u.test(body)
        );
        const offenders = hidingBlocks
          .map(([, selector]) => selector.replace(/\/\*[\s\S]*?\*\//gu, "").trim())
          .filter((selector) => selector.includes(".ai-command-menu-toggle"));
        expect(offenders).toEqual([]);
      });

      it("메뉴 토글과 유일 항목이 패널에 있다", () => {
        const panel = renderPanel();
        expect(findByTestId(panel, "ai-command-menu-toggle")).toBeTruthy();
        for (const testid of [
          "ai-command-menu-export",
          "ai-command-menu-tools",
          "ai-command-menu-compact",
          "ai-command-menu-instructions",
        ]) {
          expect(findByTestId(panel, testid), testid).toBeTruthy();
        }
        expect(findByTestId(panel, "ai-command-menu-dock")).toBeNull();
        expect(findByTestId(panel, "ai-command-menu-settings")).toBeTruthy();
      });
    });
    describe("설정 진입점", () => {
      it("크롬 설정 단추(ai-settings-toggle·ai-settings-command-bar)는 여전히 만들지 않는다", () => {
        // 2026-08-30 계약: 조수 패널 크롬에는 설정 단추를 중복해 놓지 않는다. 진입점은
        // ☰ 메뉴 항목 하나다 — 이 둠이 함게 최종 표대 상태를 정의한다.
        const panel = renderPanel();
        expect(findByTestId(panel, "ai-settings-toggle")).toBeNull();
        expect(findByTestId(panel, "ai-settings-command-bar")).toBeNull();
      });

      it("☰ 의 설정 항목은 aria-label 을 갖고 전용 설정 모달을 연다", () => {
        const panel = renderPanel();
        const settings = findByTestId(panel, "ai-command-menu-settings") as unknown as FakeElement;
        expect(settings.getAttribute("aria-label")).toBe("AI 설정 열기");
        settings.click();
        expect(findByTestId(document.body as unknown as FakeElement, "ai-settings-modal")).toBeTruthy();
      });
    });
  });
  // 맵 인터뷰 UX 계약(2026-07-04): 킥오프 프롬프트 / 원탭 답변 칩 파싱 /
  // 메타데이터 전용 제안의 즉시 저장 판정 / 추천 없이 입력·로그·전송 유지.
  describe("aiInterviewUx", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    function installFakeLocalStorage(): void {
      const storage = new Map<string, string>();
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
      // renderAiChatPanel 이 window 에 이벤트를 붙인다(aiWorkspace) — 가짜 DOM 의 최소 window 를 켠다(#3645).
      restoreDom = installFakeDom({ window: true });
      installFakeLocalStorage();
    });
    afterEach(() => {
      teardownAiChatPanel();
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    describe("buildInterviewKickoff", () => {
      it("맵 id와 핵심 프로토콜(분석→강조→선택지→확정 기록)을 담는다", () => {
        const kickoff = buildInterviewKickoff("map_village");
        expect(kickoff).toContain('analyze_map_tile_usage(mapId="map_village")');
        expect(kickoff).toContain("highlight_map_region");
        expect(kickoff).toContain("show_tiles"); // 타일 이미지 없이 번호로만 묻던 문제 방지.
        expect(kickoff).toContain(QUICK_REPLY_MARKER);
        expect(kickoff).toContain("confirmedByUser=true");
        expect(kickoff).toContain("upsert_tile_group");
      });

      it("맵 id가 없으면 시작 맵을 확인하도록 안내한다", () => {
        expect(buildInterviewKickoff(null)).toContain("시작 맵");
      });

      it("구조물 발견 시 집 외장/메타데이터 학습 프로토콜(그리드→집 판단→템플릿 저장 금지)을 담는다", () => {
        const kickoff = buildInterviewKickoff("map_v");
        expect(kickoff).toContain("show_tile_grid");
        // author_house 는 제거됐고 집은 칩셋 건물 킷(stamp_object)이 맡는다(public baseline 0d4f13e7c8).
        expect(kickoff).toContain("stamp_object");
        expect(kickoff).toContain("별도 템플릿을 저장하지 않습니다");
      });
    });
    describe("buildStructureLearnKickoff (📐 선택 영역 학습)", () => {
      it("그림 먼저 + 집 외장 판단 + 타일/그룹만 저장한다(순서 강제)", () => {
        const kickoff = buildStructureLearnKickoff("map_v", { x: 3, y: 4, width: 10, height: 8 });
        const gridAt = kickoff.indexOf("show_tile_grid");
        const highlightAt = kickoff.indexOf("highlight_map_region");
        // author_house 제거 뒤 집 판단은 건물 킷(stamp_object) 기준이다(0d4f13e7c8).
        const kitAt = kickoff.indexOf("stamp_object");
        const noDumpAt = kickoff.indexOf("나열하지 말고");
        expect(gridAt).toBeGreaterThan(-1);
        expect(highlightAt).toBeGreaterThan(gridAt);
        expect(kitAt).toBeGreaterThan(highlightAt);
        expect(noDumpAt).toBeGreaterThan(kitAt); // 좌표·번호 목록을 채팅에 쏟지 않는다.
        expect(kickoff).toContain("x=3, y=4, w=10, h=8");
        expect(kickoff).toContain("set_tile_metadata");
        expect(kickoff).toContain("upsert_tile_group");
        expect(kickoff).toContain("지형 템플릿은 만들지 마세요");
      });
    });
    describe("parseQuickReplies", () => {
      it("마지막 줄의 [선택지] 마커를 칩 목록으로 파싱한다", () => {
        const text = "이 타일(12칸)은 무엇인가요? (설명됨 3/9)\n[선택지] 지붕 | 돌담 | 화단 | 모름/건너뛰기";
        expect(parseQuickReplies(text)).toEqual(["지붕", "돌담", "화단", "모름/건너뛰기"]);
      });

      it("마커가 마지막 줄이 아니거나 없으면 칩을 만들지 않는다", () => {
        expect(parseQuickReplies("일반 응답입니다.")).toEqual([]);
        expect(parseQuickReplies("[선택지] a | b\n마커 뒤에 다른 말")).toEqual([]);
      });

      it("빈 항목은 버리고 최대 6개까지만 취한다", () => {
        expect(parseQuickReplies("[선택지] a || b | c | d | e | f | g")).toEqual(["a", "b", "c", "d", "e", "f"]);
      });
    });
    describe("isMetadataOnlyProposal", () => {
      const call = (name: string): ProposedCall => ({
        name,
        args: {},
        summary: "",
        result: { ok: true, summary: "" },
        destructive: false,
      });

      it("타일 지식 툴만 있으면 true — 제안 카드 없이 즉시 저장 대상", () => {
        expect(isMetadataOnlyProposal([call("set_tile_metadata"), call("upsert_tile_group"), call("set_tile_passability")])).toBe(true);
      });

      it("맵/이벤트 변경이 섞이면 false — 기존 검토 절차 유지", () => {
        expect(isMetadataOnlyProposal([call("set_tile_metadata"), call("paint_tiles")])).toBe(false);
        expect(isMetadataOnlyProposal([])).toBe(false);
      });
    });
    describe("패널 인터뷰 UI", () => {
      it("원탭 칩과 가르치기 진입점 없이 입력·로그·전송을 유지한다", () => {
        const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
        expect(findByTestId(panel, "ai-quick-replies")).toBeNull();
        expect(findByTestId(panel, "ai-input")).toBeTruthy();
        expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
        expect(findByTestId(panel, "ai-send")).toBeTruthy();
        expect(findByTestId(panel, "ai-interview")).toBeNull();
        expect(findByTestId(panel, "ai-learn-structure")).toBeNull();
        expect(findByTestId(panel, "ai-demo-teach")).toBeNull();
      });
    });
  });
  // 로그 마운트 단일 출처 회귀 스펙.
  //
  // 고정하는 것: 같은 `log` 엘리먼트의 배치를 결정하는 코드가 세 함수(도크 정책·기록 열기·
  // 스튜디오)에 흩어져 있어, 상태 조합마다 어느 마운트에 붙는지 코드로 알 수 없었다. 이제
  // `mountLog()` 하나가 정하고 결과를 `panel.dataset.logSlot` 으로 노출한다.
  //
  // 2026-08-31: 도크가 float 하나가 되면서 슬롯 표가 (도크 3 × 기록/스튜디오 2) 에서
  // **둘**로 줄었다 — 기록/스튜디오가 열려 있으면 `history`, 아니면 `glass`.
  // 사이드 도크 전용이던 `volatile` 슬롯과 `.ai-rising-overlay` 는 함께 삭제됐다.
  describe("aiLogSlot", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    let storage: Map<string, string>;
    beforeEach(() => {
      store.replace(createBlankProject());
      resetMapEditHistory();
      restoreDom = installFakeDom({ window: true });
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
      editorState.set({
        currentMapId: store.getCurrent().startMapId,
        layer: "lower",
        tool: "paint",
        selection: null,
      });
    });
    afterEach(() => {
      teardownAiChatPanel();
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    function renderPanel(): FakeElement {
      const panel = renderWithFakeDom(() => renderAiChatPanel());
      // 부팅 접힘 상태에서는 뷰 정책이 돌지 않는다 — 펼쳐서 잰다.
      findByTestId(panel, "ai-collapsed-restore")?.click();
      return panel;
    }
    function logParentClass(panel: FakeElement): string {
      const log = findByTestId(panel, "ai-chat-log");
      if (!log) return "(unmounted)";
      return log.parentNode instanceof FakeElement ? log.parentNode.className : "(detached)";
    }
    describe("로그 슬롯은 한 곳에서 정해진다", () => {
      it("기본 뷰는 유리 로그 마운트 하나다", () => {
        const panel = renderPanel();
        expect(panel.dataset.chatDock).toBe("float");
        expect(panel.dataset.logSlot).toBe("glass");
        expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
        expect(logParentClass(panel)).toContain("ai-glass-log");
      });

      it("기록을 열면 기록 마운트로 가고, 닫으면 기본 슬롯으로 돌아온다", () => {
        const panel = renderPanel();
        const history = findByTestId(panel, "ai-dock-toggle");
        if (!history) throw new Error("history toggle missing");

        history.click();
        expect(panel.dataset.logSlot).toBe("history");
        expect(logParentClass(panel)).toContain("ai-history-log-mount");

        history.click();
        // 예전에는 닫는 쪽이 항상 휘발 존에 넣고 뒤이어 도크 정책이 다시 옮기는 이중 이동이었다.
        expect(panel.dataset.logSlot).toBe("glass");
        expect(logParentClass(panel)).toContain("ai-glass-log");
      });

      it("스튜디오도 기록 마운트를 쓰고, 끄면 기본으로 돌아온다", () => {
        const panel = renderPanel();
        const studio = findByTestId(panel, "ai-studio-toggle");
        if (!studio) throw new Error("studio toggle missing");

        studio.click();
        expect(panel.dataset.logSlot).toBe("history");
        expect(logParentClass(panel)).toContain("ai-history-log-mount");

        studio.click();
        expect(panel.dataset.logSlot).toBe("glass");
        expect(logParentClass(panel)).toContain("ai-glass-log");
      });

      it("사이드 도크 전용 오버레이·휘발 존은 어느 상태에서도 없다", () => {
        const panel = renderPanel();
        expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
        expect(findByTestId(panel, "ai-rising-volatile-zone")).toBeNull();

        findByTestId(panel, "ai-dock-toggle")?.click();
        expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
        expect(findByTestId(panel, "ai-rising-volatile-zone")).toBeNull();
      });

      // 완료 스트립(`ai-completion-host`)은 2026-08-30 에 걷었다 — 되돌리기는 컴포저의
      // `ai-composer-undo` 로 옮겼고, 스티키 존은 0건 알림 전용으로 남는다. 표면은 하나뿐이라
      // 도크를 돌며 볼 것도 없다(도크 축 삭제 2026-08-31).
      it("0건 알림 호스트와 컴포저 되돌리기는 남고 승인 UI는 없다", () => {
        const panel = renderPanel();
        expect(findByTestId(panel, "ai-rising-sticky-zone")).toBeTruthy();
        expect(findByTestId(panel, "ai-composer-undo")).toBeTruthy();
        for (const dead of [
          "ai-completion-host",
          "ai-proposal-reopen",
          "ai-proposal-pin-host",
          "ai-proposal-host",
          "ai-proposal-modal",
          "ai-proposal-card",
        ]) {
          expect(findByTestId(panel, dead), dead).toBeNull();
        }
      });
    });
  });
});

describe("aiEditorFullToolSafety", { timeout: 120000 }, () => {
  isolateTimers();
  // 시험 시간 한도는 수집 때 읽혀 beforeAll 안 vi.setConfig 는 듣지 않는다 — describe 옵션 timeout 으로 둔다.
  // Tests here build the ~63MB blank project (createBlankProject) and drive assistant sessions or editor
  // panels over it, fingerprinting/copying it per session. Under ci-full load (8 workers on 4-core runners)
  // single tests measured 10-50s, past vitest's 15s default, so the budget is raised for this file only.
  const CHAT_CONFIG = {
    authMode: "apiKey" as const,
    agentMode: "chat" as const,
    baseUrl: "x",
    model: "test-model",
    liteModel: "test-model",
    apiKey: "sk",
    maxToolCalls: 4,
    maxTokens: 2048,
  };
  function toolCall(name: string, args: unknown): ChatResult {
    return {
      message: { role: "assistant", content: null, tool_calls: [{ id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
      finishReason: "tool_calls",
    } as ChatResult;
  }
  function finalMessage(): ChatResult {
    return { message: { role: "assistant", content: "완료", tool_calls: undefined }, finishReason: "stop" } as ChatResult;
  }
  describe("AI editor-wide tool safety", () => {
    it("destructive editor-wide tools remain marked for audit but are not gated", async () => {
      const context = { project: createBlankProject() };
      const created = runTool(context, "create_map", { id: "map_delete_me", name: "삭제 대상", width: 8, height: 8 });
      expect(created.ok, created.summary).toBe(true);
      const calls: ChatResult[] = [];
      const chat = async (): Promise<ChatResult> => {
        const step = calls.shift();
        if (!step) throw new Error("scripted chat exhausted");
        return step;
      };
      calls.push(toolCall("remove_map", { mapId: "map_delete_me" }), finalMessage());
      const session = new AssistantSession(context.project, {
        config: CHAT_CONFIG,
        chat,
      });

      const result = await session.sendUserMessage("현재 맵을 삭제해줘");

      expect(result.proposedCalls, JSON.stringify(session.getAuditEntries())).toHaveLength(1);
      expect(result.proposedCalls[0]).toMatchObject({ name: "remove_map", destructive: true, requiresApproval: true });
      expect(session.getProposedProject().maps.map_delete_me).toBeUndefined();
    });

    it("unknown and malformed calls return typed failures instead of throwing", () => {
      const unknown = runTool({ project: createBlankProject() }, "totally_unknown_editor_tool", {});
      const malformed = runTool({ project: createBlankProject() }, "set_project_settings", { battle: { initialTroopId: "missing" } });

      expect(unknown).toMatchObject({ ok: false, issues: [{ severity: "error", code: "unknown-tool" }] });
      expect(malformed).toMatchObject({ ok: false, issues: [{ severity: "error", code: "troop-not-found" }] });
    });
  });
});

describe("aiEndingCompletionRegression", () => {
  isolateTimers();
  // Reduced from the successful define_ending + corrected upsert_event calls in
  // output/evidence/ai-adversarial-20260906/ai-audit.json (2026-09-06).
  // The saved exit consumes its page-condition item and sets the ending condition,
  // but never invokes the ending. Rendering, map art and unrelated NPCs are omitted.
  // Sentinels identify runtime steps; none of the original prompt/prose is pinned.
  function authorExit(invocation?: Command) {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const item = ctx.project.database.items[0];
    const clearSwitch = ctx.project.switches[0];
    assert(item);
    assert(clearSwitch);
    const itemId = item.id;
    const switchId = clearSwitch.id;
    const endingId = "ending_regression";
    const definition = runTool(ctx, "define_ending", {
      id: endingId,
      name: "REGRESSION_ENDING",
      conditions: [{ kind: "switch", switchId, value: true }],
      priority: 1,
      epilogue: [{ kind: "say", lines: ["EPILOGUE_SENTINEL"] }],
    });
    expect(definition.ok, definition.summary).toBe(true);
    const event: GameEvent = {
      id: "ev_regression_exit", x: 10, y: 2,
      trigger: { kind: "action" }, commands: [],
      pages: [
        {
          id: "locked", name: "locked", conditions: [],
          trigger: { kind: "action" }, priority: "same",
          graphic: { transparent: true },
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "text", body: "LOCKED_SENTINEL" }],
        },
        {
          id: "has_item", name: "has item",
          conditions: [{ kind: "item", itemId, present: true }],
          trigger: { kind: "action" }, priority: "same",
          graphic: { transparent: true },
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [
            { kind: "text", body: "OPEN_SENTINEL" },
            { kind: "changeItem", itemId, op: "-=", amount: 1 },
            { kind: "setSwitch", switchId, value: true },
            ...(invocation ? [invocation] : []),
          ],
        },
      ],
    };
    const write = runTool(ctx, "upsert_event", { mapId, event });
    expect(write.ok, write.summary).toBe(true);
    const project = deserialize(serialize(ctx.project));
    const authoredMap = ctx.project.maps[mapId];
    const savedMap = project.maps[mapId];
    assert(authoredMap);
    assert(savedMap);
    const authoredEvent = authoredMap.events.find(entry => entry.id === event.id);
    const savedEvent = savedMap.events.find(entry => entry.id === event.id);
    const ending = project.endings?.find(entry => entry.id === endingId);
    assert(authoredEvent);
    assert(savedEvent);
    assert(ending);
    expect(savedEvent.pages).toEqual(authoredEvent.pages);
    expect(project.endings).toEqual(ctx.project.endings);
    return { project, event: savedEvent, itemId, switchId, endingId, ending };
  }
  function useExit(fixture: ReturnType<typeof authorExit>) {
    const { project, event, itemId } = fixture;
    const session = startSession(project);
    // Match PlayScene's runCommands setup before creating the interpreter.
    session.commonEvents = project.commonEvents;
    expect(resolveEventPage(event, session)?.id).toBe("locked");
    // Grant through the real interpreter, not an injected successful ending state.
    expect(createInterpreter([{ kind: "changeItem", itemId, op: "+=", amount: 1 }], session, project).start()).toEqual({ kind: "done" });
    const page = resolveEventPage(event, session);
    assert(page);
    expect(page.id).toBe("has_item");
    const interpreter = createInterpreter(page.commands, session, project, { currentEventId: event.id });
    expect(interpreter.start()).toMatchObject({ kind: "text", body: "OPEN_SENTINEL" });
    const afterDialogue = interpreter.resume();
    expect(session.inventory[itemId] ?? 0).toBe(0);
    expect(session.switches[fixture.switchId]).toBe(true);
    return { session, interpreter, afterDialogue };
  }
  describe("AI-authored ending completion at the tool/save/runtime seam", () => {
    it("reproduces the saved correction: item consumed, switch retained, no ending, exit relocked", () => {
      const fixture = authorExit();
      const { session, afterDialogue } = useExit(fixture);
      expect(afterDialogue).toEqual({ kind: "done" });
      expect(session.flags[`ending:${fixture.endingId}`]).toBeUndefined();
      const repeatedPage = resolveEventPage(fixture.event, session);
      assert(repeatedPage);
      expect(repeatedPage.id).toBe("locked");
      expect(createInterpreter(repeatedPage.commands, session, fixture.project).start())
        .toMatchObject({ kind: "text", body: "LOCKED_SENTINEL" });
    });

    it.each([
      { kind: "triggerEnding" } as const,
      { kind: "triggerEnding", endingId: "ending_regression" } as const,
    ])("control: an explicit invocation $endingId executes the persisted epilogue and ending", invocation => {
      const fixture = authorExit(invocation);
      const { session, interpreter, afterDialogue } = useExit(fixture);
      expect(afterDialogue).toMatchObject({ kind: "text", body: "EPILOGUE_SENTINEL" });
      expect(session.flags[`ending:${fixture.endingId}`]).toBe(true);
      expect(interpreter.resume()).toMatchObject({ kind: "returnToTitle", title: fixture.ending.name });
      const quality = runTool({ project: fixture.project }, "evaluate_game_quality", {});
      expect(quality.ok, quality.summary).toBe(true);
      expect(quality.data).toMatchObject({ verdict: { blocked: false }, coverage: { endings: { defined: 1, triggers: 1 } } });
    });

    it("does not certify completion when the sole defined ending has no invocation anywhere", () => {
      const fixture = authorExit();
      const { session, afterDialogue } = useExit(fixture);
      expect(afterDialogue).toEqual({ kind: "done" });
      expect(session.flags[`ending:${fixture.endingId}`]).toBeUndefined();
      const before = serialize(fixture.project);
      const quality = runTool({ project: fixture.project }, "evaluate_game_quality", {});
      expect(quality.ok, quality.summary).toBe(true);
      expect(serialize(fixture.project)).toBe(before);
      expect(quality.data).toMatchObject({ coverage: { endings: { defined: 1, triggers: 0 } } });
      // This belongs at completion assessment, not an automatic setSwitch hook:
      // defining an ending before wiring its event must remain a valid edit.
      expect(quality.data).toMatchObject({
        verdict: { blocked: true, objectiveErrorCount: 1 },
        coverage: { endings: { uninvokedIds: [fixture.endingId] } },
      });
      expect(quality.issues).toContainEqual(expect.objectContaining({ code: "ending-uninvoked", severity: "error" }));
      expect(parseToolVerdict("evaluate_game_quality", quality).pass).toBe(false);
    });

    it("permits defining an ending before authoring its invocation", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "define_ending", { id: "ending_later", name: "Later", conditions: [] });
      expect(result.ok, result.summary).toBe(true);
      expect(result.issues?.filter(issue => issue.severity === "error") ?? []).toEqual([]);
      expect(Object.values(ctx.project.maps).flatMap(map => map.events)).toEqual([]);
      expect(deserialize(serialize(ctx.project)).endings).toEqual(ctx.project.endings);
      const quality = runTool(ctx, "evaluate_game_quality", {});
      expect(quality.data).toMatchObject({ verdict: { blocked: true }, coverage: { endings: { uninvokedIds: ["ending_later"] } } });
    });

    it.each(["open-ended", "legacy-no-registry", "native-ending"] as const)("does not impose an ending on a %s game", mode => {
      const project = createBlankProject();
      if (mode === "legacy-no-registry") delete project.endings;
      else project.endings = [];
      if (mode === "native-ending") {
        const map = project.maps[project.startMapId];
        assert(map);
        map.events.push({ id: "ev_native", x: 2, y: 2, trigger: { kind: "action" }, commands: [{ kind: "ending", title: "NATIVE_SENTINEL", message: "" }] });
      }
      const quality = runTool({ project: deserialize(serialize(project)) }, "evaluate_game_quality", {});
      expect(quality.ok, quality.summary).toBe(true);
      expect(quality.data).toMatchObject({ verdict: { blocked: false }, coverage: { endings: { uninvokedIds: [] } } });
      expect(parseToolVerdict("evaluate_game_quality", quality).pass).toBe(true);
    });

    it.each(["named", "condition-selected"] as const)("matches each defined ending against %s invocations", mode => {
      const invocation: Command = mode === "named"
        ? { kind: "triggerEnding", endingId: "ending_regression" }
        : { kind: "triggerEnding" };
      const fixture = authorExit(invocation);
      const ctx = { project: fixture.project };
      const second = runTool(ctx, "define_ending", {
        id: "ending_other", name: "Other", priority: 2,
        conditions: [{ kind: "switch", switchId: fixture.switchId, value: true }],
      });
      expect(second.ok, second.summary).toBe(true);
      const quality = runTool(ctx, "evaluate_game_quality", {});
      expect(quality.data).toMatchObject({
        verdict: { blocked: mode === "named" },
        coverage: { endings: { defined: 2, triggers: 1, uninvokedIds: mode === "named" ? ["ending_other"] : [] } },
      });
    });

    it("does not mistake obsolete root commands for invocations when pages own execution", () => {
      const fixture = authorExit();
      fixture.event.commands = [{ kind: "triggerEnding", endingId: fixture.endingId }];
      const quality = runTool({ project: deserialize(serialize(fixture.project)) }, "evaluate_game_quality", {});
      expect(quality.data).toMatchObject({ verdict: { blocked: true }, coverage: { endings: { uninvokedIds: [fixture.endingId] } } });
      expect(useExit(fixture).afterDialogue).toEqual({ kind: "done" });
    });

    it("accepts a nested common-event invocation and executes it through the exit", () => {
      const fixture = authorExit();
      const ctx = { project: fixture.project };
      const commonEventId = "ce_regression_ending";
      const common = runTool(ctx, "upsert_common_event", {
        id: commonEventId, name: "Ending branch", trigger: "none",
        commands: [{ kind: "fork", condition: { kind: "switch", switchId: fixture.switchId, value: true }, then: [{ kind: "triggerEnding", endingId: fixture.endingId }] }],
      });
      expect(common.ok, common.summary).toBe(true);
      const pages = structuredClone(fixture.event.pages);
      assert(pages);
      const itemPage = pages.find(page => page.id === "has_item");
      assert(itemPage);
      itemPage.commands.push({ kind: "callCommonEvent", commonEventId });
      const write = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: fixture.event.id, pages } });
      expect(write.ok, write.summary).toBe(true);
      const project = deserialize(serialize(ctx.project));
      const map = project.maps[project.startMapId];
      assert(map);
      const event = map.events.find(entry => entry.id === fixture.event.id);
      assert(event);
      const played = useExit({ ...fixture, project, event });
      expect(played.afterDialogue).toMatchObject({ kind: "text", body: "EPILOGUE_SENTINEL" });
      expect(played.interpreter.resume()).toMatchObject({ kind: "returnToTitle", title: fixture.ending.name });
      const quality = runTool({ project }, "evaluate_game_quality", {});
      expect(quality.data).toMatchObject({ verdict: { blocked: false }, coverage: { endings: { uninvokedIds: [] } } });
    });

    it("accepts legacy root invocations when no pages replace them", () => {
      const fixture = authorExit();
      fixture.event.pages = [];
      fixture.event.commands = [{ kind: "triggerEnding", endingId: fixture.endingId }];
      const quality = runTool({ project: deserialize(serialize(fixture.project)) }, "evaluate_game_quality", {});
      expect(quality.data).toMatchObject({ verdict: { blocked: false }, coverage: { endings: { uninvokedIds: [] } } });
    });
  });
});
