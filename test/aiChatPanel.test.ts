import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishAiApplyCompletion } from "@/editor/aiApplyCompletion";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryEntries, getMapEditHistoryState, recordProjectSnapshot, resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderAiChatPanel, teardownAiChatPanel, isMetadataOnlyProposal, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { buildInterviewKickoff, buildStructureLearnKickoff, parseQuickReplies, QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import { type ProposedCall, AssistantSession } from "@/ai/assistantSession";
import { IDBFactory } from "fake-indexeddb";
import { AI_RECORD_STORES, resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import * as activity from "@/ai/activityLog";
import { getAiAssistantAudit } from "@/editor/aiAssistantBridge";
import { bounded } from "./aiEpochFixture";
import "fake-indexeddb/auto";
import { isolateTimers } from "./mergedTeardown";

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

describe("aiRunRecovery", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  afterEach(async () => {
    teardownAiChatPanel();
    await bounded(whenAiChatPanelSettled());
    resetAiRecordDbForTest();
    restoreDom?.(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });
  it.each(["indexeddb", "memory"] as const)("opens interrupted legacy history without admitting execution on %s", async backend => {
    restoreDom = installFakeDom({ window: true });
    vi.stubGlobal("indexedDB", backend === "indexeddb" ? new IDBFactory() : undefined);
    resetAiRecordDbForTest();
    const values = new Map([[AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat" })]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: "boot-recovery" });
    vi.spyOn(activity, "recordAiActivity").mockImplementation(async entry => activity.buildAiActivityLogRecord(entry));
    // Observe admission at the actual session boundary. Fail closed if old boot code enters;
    // this test asserts admission, not tool execution or successful crash reconciliation.
    const send = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockRejectedValue(new Error("Unexpected boot admission"));
    const entries = [{ kind: "user" as const, text: "create-interrupted-fixture" }];
    await writeAiRecords(AI_RECORD_STORES.conversations, [{ id: "interrupted", title: "fixture", model: "fixture",
      savedAt: 1, projectContextKey: "remote:boot-recovery", entries }]);
    const before = structuredClone(store.getCurrent());
    document.body.append(renderAiChatPanel());
    // Public tracker includes the exact IDB boot adoption promise, not a timing delay.
    await bounded(whenAiChatPanelSettled());
    expect(send).not.toHaveBeenCalled();
    expect(getAiAssistantAudit().filter(entry => entry.kind === "user")).toEqual(entries);
    expect(store.getCurrent()).toEqual(before);
  });
});
