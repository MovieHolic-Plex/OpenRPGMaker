import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/ai/assistantSession";
import * as conversations from "@/ai/conversationStore";
import { clearConversations, CONVERSATION_TRIM_MARKER, deriveTitle, listConversations, saveConversation, type ConversationRecord, type ConversationSummary } from "@/ai/conversationStore";
import { resetAiRecordDbForTest } from "@/ai/aiRecordDb";
import { AI_HISTORY_ARCHIVE_PAGE_SIZE, closeAiConversationHistoryModal, filterConversationsByTitle, openAiConversationHistoryModal, sortConversationsForScope, whenAiConversationHistoryModalSettled } from "@/editor/panels/aiConversationHistoryModal";
import { findByTestId, installFakeDom, FakeElement, renderWithFakeDom } from "./fakeDom";
import { createConversationLogHost } from "@/editor/panels/aiConversationLog";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { RESTORED_TRANSCRIPT_MARKER, isRestoredTranscriptMessage, restoredTranscriptMessage, serializeAuditTranscript } from "@/ai/conversationReplay";
import { DECK_ICON_NAMES, deckIcon } from "@/editor/panels/aiDeckIcons";
import { createDeckRail, deckStateOfTone } from "@/editor/panels/aiDeckRail";
import { findEntityMentions, renderEntityMentionStrip, type EntityMention } from "@/editor/panels/aiEntityMentions";
import type { EnemyRecord, ItemRecord, GameMap, Project } from "@/project/types";
import { mergeHarnessTimeline } from "@/editor/panels/aiHarnessModal";
import { AI_INSTRUCTIONS_MAX_CHARS } from "@/ai/projectInstructions";
import { closeAiInstructionsModal, openAiInstructionsModal } from "@/editor/panels/aiInstructionsModal";
import { getMapEditHistoryMarker, getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { chipWindow, regionFromToolCall, renderMapChip } from "@/editor/panels/aiMapChip";
import { clampPanelSize, clampPanelSizeToViewport, loadPanelBarSize, PANEL_SIZE_LIMITS, savePanelBarSize, savePanelSize, stepAiFontSize } from "@/editor/panels/aiPanelLayout";
import { loadPanelSize, renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { filterToolCategories, openToolBrowserModal, TOOL_CATEGORIES, totalToolCount } from "@/editor/panels/toolBrowserModal";
import { activeTools, runTool } from "@/editor/tools";
import { setAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { createPiGhostBridge } from "@/editor/panels/aiPiGhostBridge";
import { diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { clearAgentGhostPreview, getAgentGhostDraftMap, getAgentGhostPreviewState, setAgentGhostDraftMapProvider } from "@/editor/agentGhostPreview";
import { collectVocabSoftConfirms, markSoftVocabApprovalsOnProject } from "@/editor/panels/aiProposalFusion";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { isolateTimers } from "./mergedTeardown";

describe("aiConversation", () => {
  isolateTimers();
  // test/aiConversationHistoryModal.test.ts
  // 저장된 대화 목록 모달 — 정렬/검색 순수 함수 + 맵 필터/열기/삭제/페이지/복구.
  describe("aiConversationHistoryModal", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const KNOWN_MAPS = [
      { id: "map_a", name: "광장" },
      { id: "map_b", name: "숲길" },
    ] as const;
    function installMemoryStorage(): void {
      const values = new Map<string, string>();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: {
          get length() {
            return values.size;
          },
          clear: () => values.clear(),
          getItem: (key: string) => values.get(key) ?? null,
          key: (index: number) => Array.from(values.keys())[index] ?? null,
          removeItem: (key: string) => void values.delete(key),
          setItem: (key: string, value: string) => void values.set(key, String(value)),
        },
      });
    }
    function summary(id: string, savedAt: number, projectContextKey?: string): ConversationSummary {
      return {
        id,
        title: `대화 ${id}`,
        model: "m",
        savedAt,
        turnCount: 1,
        ...(projectContextKey === undefined ? {} : { projectContextKey }),
      };
    }
    function mapContext(mapId: string, mapName = mapId): NonNullable<Extract<AuditEntry, { kind: "user" }>["context"]> {
      return { mapId, mapName, mapWidth: 20, mapHeight: 15 };
    }
    function record(
      id: string,
      savedAt: number,
      scope?: string,
      text = `지시 ${id}`,
      mapId: string | null = "map_a",
    ): ConversationRecord {
      const entries: AuditEntry[] = [{
        kind: "user",
        text,
        ...(mapId ? { context: mapContext(mapId, mapId === "map_a" ? "광장" : mapId === "map_b" ? "숲길" : mapId) } : {}),
      }];
      return {
        id,
        title: deriveTitle(entries),
        model: "m",
        savedAt,
        entries,
        ...(scope === undefined ? {} : { projectContextKey: scope }),
      };
    }
    function openModal(
      overrides: Partial<Parameters<typeof openAiConversationHistoryModal>[0]> = {},
    ): FakeElement {
      const onOpen = overrides.onOpen ?? (() => undefined);
      return openAiConversationHistoryModal({
        scopeKey: "mine",
        currentConversationId: "none",
        currentMapId: "map_a",
        knownMaps: KNOWN_MAPS,
        ...overrides,
        onOpen,
      }) as unknown as FakeElement;
    }
    function click(root: FakeElement, testId: string): void {
      const node = findByTestId(root, testId);
      expect(node, testId).not.toBeNull();
      (node as unknown as HTMLElement).click();
    }
    function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((done) => { resolve = done; });
      return { promise, resolve };
    }
    beforeEach(async () => {
      installMemoryStorage();
      resetAiRecordDbForTest();
      await clearConversations();
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      closeAiConversationHistoryModal();
      restoreDom?.();
      restoreDom = null;
      if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
      else Reflect.deleteProperty(globalThis, "localStorage");
      vi.restoreAllMocks();
    });
    describe("sortConversationsForScope", () => {
      it("Given 내 프로젝트와 남의 프로젝트가 섞임 When 정렬 Then 내 것이 먼저, 그 안에서 최근 순", () => {
        const sorted = sortConversationsForScope(
          [summary("old-mine", 100, "mine"), summary("foreign", 900, "other"), summary("new-mine", 500, "mine")],
          "mine",
        );

        expect(sorted.map((row) => row.id)).toEqual(["new-mine", "old-mine", "foreign"]);
      });

      it("Given 스코프 미기록 대화 When 정렬 Then 남의 것과 같은 뒤쪽으로 간다(내 것으로 위장하지 않는다)", () => {
        const sorted = sortConversationsForScope([summary("unscoped", 900), summary("mine", 100, "mine")], "mine");

        expect(sorted.map((row) => row.id)).toEqual(["mine", "unscoped"]);
      });
    });
    describe("filterConversationsByTitle", () => {
      const rows = [summary("a", 1), summary("B", 2)];

      it("Given 빈 검색어 When 필터 Then 전부 남는다", () => {
        expect(filterConversationsByTitle(rows, "   ")).toHaveLength(2);
      });

      it("Given 대소문자 다른 부분 문자열 When 필터 Then 대소문자를 무시하고 찾는다", () => {
        expect(filterConversationsByTitle(rows, "b").map((row) => row.id)).toEqual(["B"]);
      });

      it("Given 없는 제목 When 필터 Then 빈 목록", () => {
        expect(filterConversationsByTitle(rows, "없음")).toHaveLength(0);
      });
    });
    describe("모달 렌더", () => {
      it("Given 저장된 대화 2건 When 열기 Then 현재-맵 필터가 켜지고 행 2개가 최근 순으로 렌더된다", async () => {
        await saveConversation(record("old", 1_000, "mine", "오래된 지시"));
        await saveConversation(record("new", 2_000, "mine", "최근 지시"));

        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-filter-current")!.getAttribute("aria-pressed")).toBe("true");
        const list = findByTestId(backdrop, "ai-history-list")!;
        const rows = list.querySelectorAll("[data-testid=ai-history-row]");
        expect(rows).toHaveLength(2);
        expect(rows[0]!.textContent).toContain("최근 지시");
      });

      it("Given 저장된 대화 없음 When 열기 Then 빈 상태가 오고 전역 부재를 주장하지 않는다", async () => {
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-empty")!.textContent).not.toMatch(/어디에도|anywhere/i);
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(0);
      });

      it("Given 행 클릭 When 열기 Then 기록 전체(record)가 호출자에게 전달되고 모달이 닫힌다", async () => {
        await saveConversation(record("target", 1_000, "mine", "우물을 놔줘"));
        const opened: ConversationRecord[] = [];
        const backdrop = openModal({ onOpen: (row) => opened.push(row) });
        await whenAiConversationHistoryModalSettled();

        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();

        expect(opened).toHaveLength(1);
        expect(opened[0]!.id).toBe("target");
        expect(opened[0]!.entries[0]).toMatchObject({ kind: "user", text: "우물을 놔줘" });
        expect(backdrop.parentElement).toBeNull();
      });

      it("Given 지금 열려 있는 대화 When 렌더 Then 「현재」로 표시하고 클릭을 무시한다", async () => {
        await saveConversation(record("current", 1_000, "mine"));
        const opened: ConversationRecord[] = [];
        const backdrop = openModal({
          currentConversationId: "current",
          onOpen: (row) => opened.push(row),
        });
        await whenAiConversationHistoryModalSettled();

        const open = findByTestId(backdrop, "ai-history-open")!;
        expect(open.getAttribute("aria-disabled")).toBe("true");
        expect(open.textContent).toContain("현재");
        (open as unknown as HTMLElement).click();
        await whenAiConversationHistoryModalSettled();
        expect(opened).toHaveLength(0);
      });

      it.each([new Error("ARCHIVE_READ_FAILURE"), null])("keeps a failed archive open recoverable after listing: %s", async (failure) => {
        const target = record("read-failure", 1_000, "mine", "READ_FAILURE_TARGET");
        await saveConversation(target);
        const onOpen = vi.fn();
        const backdrop = openModal({ currentConversationId: "active-conversation", onOpen });
        await whenAiConversationHistoryModalSettled();
        const open = findByTestId(backdrop, "ai-history-open")!;
        expect(open).not.toBeNull();
        // Listing succeeds; only the subsequent full-record read fails once.
        vi.spyOn(conversations, "loadConversationForScope").mockRejectedValueOnce(failure);

        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).not.toBeNull();
        const status = findByTestId(backdrop, "ai-history-recover-status")!;
        expect(status.dataset.state).toBe("error");
        expect(status.hidden).toBe(false);
        expect(status.textContent?.trim().length).toBeGreaterThan(0);
        if (failure instanceof Error) expect(status.textContent).toContain(failure.message);
        expect(findByTestId(backdrop, "ai-history-open")).toBe(open);
        expect(findByTestId(backdrop, "ai-history-recover")!.disabled).toBe(false);

        // The same control retries the real store read without dismissing the error first.
        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: target.id, entries: target.entries }));
        expect(backdrop.parentElement).toBeNull();
      });

      it("reports a record removed after listing without adopting or silently losing it", async () => {
        await saveConversation(record("removed-after-list", 1_000, "mine"));
        const onOpen = vi.fn();
        const backdrop = openModal({ currentConversationId: "active-conversation", onOpen });
        await whenAiConversationHistoryModalSettled();
        await conversations.deleteConversationForScope("removed-after-list", "mine");

        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).not.toBeNull();
        const status = findByTestId(backdrop, "ai-history-recover-status")!;
        expect(status.dataset.state).toBe("error");
        expect(status.hidden).toBe(false);
        expect(status.textContent?.trim().length).toBeGreaterThan(0);
        expect(findByTestId(backdrop, "ai-history-open")).toBeNull();
        expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-recover")!.disabled).toBe(false);
      });

      it.each(["close", "replace"] as const)("suppresses a late archive read failure after modal %s", async (boundary) => {
        await saveConversation(record("late-failure", 1_000, "mine"));
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        let rejectLoad!: (reason: Error) => void;
        const load = new Promise<ConversationRecord | null>((_resolve, reject) => { rejectLoad = reject; });
        const read = vi.spyOn(conversations, "loadConversationForScope").mockReturnValueOnce(load);
        click(backdrop, "ai-history-open");
        expect(read).toHaveBeenCalledWith("late-failure", "mine");
        const replacement = boundary === "replace" ? openModal({ scopeKey: "other", onOpen }) : null;
        if (boundary === "close") closeAiConversationHistoryModal();
        rejectLoad(new Error("STALE_ARCHIVE_READ_FAILURE"));
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).toBeNull();
        for (const root of replacement ? [backdrop, replacement] : [backdrop]) {
          const status = findByTestId(root, "ai-history-recover-status")!;
          expect(status.dataset.state).toBe("idle");
          expect(status.hidden).toBe(true);
          expect(status.textContent).not.toContain("STALE_ARCHIVE_READ_FAILURE");
        }
        if (replacement) expect(replacement.parentElement).not.toBeNull();
      });

      it("Given 다른 프로젝트의 대화 When 모든 필터 Then 나열되지 않는다", async () => {
        await saveConversation(record("foreign", 1_000, "other"));
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-all");
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(0);
        expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
      });

      it("Given 삭제 클릭 When 목록 갱신 Then 저장소에서도 지워진다", async () => {
        await saveConversation(record("doomed", 1_000, "mine"));
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();

        click(backdrop, "ai-history-delete");
        await whenAiConversationHistoryModalSettled();

        expect(await listConversations()).toHaveLength(0);
        expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
      });

      it("Given 검색어 입력 When 목록 갱신 Then 제목이 맞는 행만 남는다", async () => {
        await saveConversation(record("a", 1_000, "mine", "우물 배치"));
        await saveConversation(record("b", 2_000, "mine", "상점 배치"));
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        const search = findByTestId(backdrop, "ai-history-search") as unknown as HTMLInputElement & FakeElement;

        search.value = "우물";
        search.dispatchEvent(new Event("input"));
        await whenAiConversationHistoryModalSettled();

        const rows = findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]");
        expect(rows).toHaveLength(1);
        expect(rows[0]!.textContent).toContain("우물");
      });

      it("Given A 기원과 B 대상 대화 When 현재 맵 A Then 둘 다 전체 대화로 보이고 B 전용은 숨는다", async () => {
        await saveConversation(record("origin-a", 1_000, "mine", "광장 우물", "map_a"));
        await saveConversation({
          ...record("target-a", 2_000, "mine", "숲에서 광장을 칠함", "map_b"),
          entries: [
            { kind: "user", text: "숲에서 광장을 칠함", context: mapContext("map_b", "숲길") },
            { kind: "tool", name: "paint_tiles", args: { mapId: "map_a" }, ok: true, summary: "painted A" },
          ],
        });
        await saveConversation(record("only-b", 3_000, "mine", "숲길만", "map_b"));

        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        const rows = findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]");
        const text = [...rows].map((row) => row.textContent ?? "").join("\n");
        expect(text).toContain("광장 우물");
        expect(text).toContain("숲에서 광장을 칠함");
        expect(text).not.toContain("숲길만");
      });

      it("Given 맵 필드 없는 대화 When 출처 없음 Then 그것만 보이고 삭제된 맵 id 는 선택 가능하다", async () => {
        await saveConversation(record("unknown", 1_000, "mine", "옛 기록", null));
        await saveConversation(record("gone", 2_000, "mine", "허물어진 다리", "map_gone"));

        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-unknown");
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("옛 기록");
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain("허물어진 다리");

        click(backdrop, "ai-history-filter-all");
        await whenAiConversationHistoryModalSettled();
        const gone = backdrop.querySelector('[data-map-id="map_gone"]');
        expect(gone).not.toBeNull();
        (gone as unknown as HTMLElement).click();
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("허물어진 다리");
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain("옛 기록");
      });

      it("selects an older deleted map from the complete 201-record archive before paging", async () => {
        const target = record("old-deleted-map", 1, "mine", "OLDER_DELETED_MAP", "map_gone");
        expect((await saveConversation(target)).ok).toBe(true);
        for (let index = 0; index < 200; index += 1) {
          expect((await saveConversation(record(`new-a-${index}`, 1_000 + index, "mine"))).ok).toBe(true);
        }
        expect((await conversations.queryConversationArchive({ projectContextKey: "mine" })).total).toBe(201);
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-filter-current")!.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(
          AI_HISTORY_ARCHIVE_PAGE_SIZE,
        );
        const gone = backdrop.querySelector('[data-map-id="map_gone"]');
        expect(gone).not.toBeNull();
        (gone as unknown as HTMLElement).click();
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(1);
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("OLDER_DELETED_MAP");
        expect(onOpen).not.toHaveBeenCalled();
        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: target.id, entries: target.entries }));
      });

      it("Given 페이지 크기보다 많은 기록 When 더 보기 Then 다음 페이지가 붙는다", async () => {
        for (let index = 0; index < AI_HISTORY_ARCHIVE_PAGE_SIZE + 1; index += 1) {
          await saveConversation(record(`page-${index}`, 1_000 + index, "mine", `페이지 ${index}`));
        }
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(
          AI_HISTORY_ARCHIVE_PAGE_SIZE,
        );
        click(backdrop, "ai-history-load-more");
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(
          AI_HISTORY_ARCHIVE_PAGE_SIZE + 1,
        );
      });

      it("Given 압축·일부 출처 When 렌더 Then 표시가 붙는다", async () => {
        await saveConversation({
          ...record("partial", 1_000, "mine", "일부 출처"),
          entries: [
            { kind: "user", text: "일부 출처", context: mapContext("map_a", "광장") },
            { kind: "status", text: CONVERSATION_TRIM_MARKER },
            { kind: "assistant", text: "잘린 인자", toolCalls: [{ name: "paint_tiles", args: "{not-json" }] },
          ],
        });
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-compacted")).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-attribution")?.dataset.attribution).toBe("partial");
      });

      it("Given 복구 실패 When 가져오기 Then error 상태이고 목록을 성공으로 바꾸지 않는다", async () => {
        const hydrate = vi.spyOn(conversations, "hydrateConversationArchive").mockRejectedValue(new Error("transport down"));
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-recover");
        await whenAiConversationHistoryModalSettled();
        const status = findByTestId(backdrop, "ai-history-recover-status")!;
        expect(status.dataset.state).toBe("error");
        expect(status.textContent).toContain("transport down");
        expect(hydrate).toHaveBeenCalledWith(expect.objectContaining({ projectContextKey: "mine" }));
      });

      it("Given 닫힌 모달 When 늦은 열기 응답 Then onOpen 을 부르지 않는다", async () => {
        await saveConversation(record("late", 1_000, "mine", "늦은 열기"));
        let resolveLoad: ((value: ConversationRecord | null) => void) | undefined;
        vi.spyOn(conversations, "loadConversationForScope").mockImplementation(
          () => new Promise((resolve) => {
            resolveLoad = resolve;
          }),
        );
        const opened: ConversationRecord[] = [];
        const backdrop = openModal({ onOpen: (row) => opened.push(row) });
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-open");
        closeAiConversationHistoryModal();
        resolveLoad?.(record("late", 1_000, "mine", "늦은 열기"));
        await whenAiConversationHistoryModalSettled();
        expect(opened).toHaveLength(0);
      });

      it("Given 필터 전환 When 목록만 바뀜 Then onOpen 은 호출되지 않는다", async () => {
        await saveConversation(record("keep", 1_000, "mine"));
        const opened: ConversationRecord[] = [];
        const backdrop = openModal({ onOpen: (row) => opened.push(row) });
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-all");
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-unknown");
        await whenAiConversationHistoryModalSettled();
        expect(opened).toHaveLength(0);
        expect(findByTestId(backdrop, "ai-history-modal")).not.toBeNull();
      });

      it("Given an unscoped retained record When the legacy view is opened Then the transcript is readable without adopting it", async () => {
        // Break: every modal filter queries the captured project scope, so projectContextKey-less
        // records stay in the archive but cannot be selected or read.
        const legacyUser = "LEGACY_UNSCOPED_USER";
        const legacyAssist = "LEGACY_UNSCOPED_ASSIST";
        await saveConversation({
          id: "legacy-unscoped",
          title: legacyUser,
          model: "m",
          savedAt: 500,
          entries: [
            { kind: "user", text: legacyUser, context: { mapId: "map_a", mapName: "옛 광장", mapWidth: 20, mapHeight: 15 } },
            { kind: "assistant", text: legacyAssist },
          ],
        });
        await saveConversation(record("mine-now", 2_000, "mine", "CURRENT_PROJECT_TURN"));
        const onOpen = vi.fn();
        const hydrate = vi.spyOn(conversations, "hydrateConversationArchive");
        const backdrop = openModal({ currentConversationId: "active-now", onOpen });
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain(legacyUser);
        click(backdrop, "ai-history-filter-all");
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain(legacyUser);

        click(backdrop, "ai-history-filter-legacy");
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-filter-legacy")!.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(backdrop, "ai-history-filter-all")!.getAttribute("aria-pressed")).toBe("false");
        const list = findByTestId(backdrop, "ai-history-list")!;
        expect(list.textContent).toContain(legacyUser);
        expect(list.textContent).not.toContain("CURRENT_PROJECT_TURN");
        expect(list.textContent).toContain("map_a");
        expect(list.textContent).not.toContain("광장");
        expect(findByTestId(backdrop, "ai-history-open")).toBeNull();
        expect(findByTestId(backdrop, "ai-history-delete")).toBeNull();
        expect(findByTestId(backdrop, "ai-history-recover")!.hidden).toBe(true);
        expect(hydrate).not.toHaveBeenCalled();

        click(backdrop, "ai-history-legacy-inspect");
        await whenAiConversationHistoryModalSettled();
        const body = findByTestId(backdrop, "ai-history-legacy-body")!;
        expect(body.textContent).toContain(legacyUser);
        expect(body.textContent).toContain(legacyAssist);
        expect(onOpen).not.toHaveBeenCalled();
        expect((await conversations.loadConversation("legacy-unscoped"))?.projectContextKey).toBeUndefined();
        expect(backdrop.parentElement).not.toBeNull();
      });

      it.each(["open", "delete"] as const)("blocks stale scoped %s during a deferred legacy transition", async (action) => {
        const target = record("transition-target", 1_000, "mine");
        await saveConversation(target);
        await saveConversation(record("transition-legacy", 500));
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        const staleAction = findByTestId(backdrop, `ai-history-${action}`)!;
        expect(staleAction).not.toBeNull();
        const legacyResult = await conversations.queryConversationArchive({ projectContextKey: null });
        const query = deferred<typeof legacyResult>();
        const queried = vi.spyOn(conversations, "queryConversationArchive").mockReturnValueOnce(query.promise);
        const read = vi.spyOn(conversations, "loadConversationForScope");
        const remove = vi.spyOn(conversations, "deleteConversationForScope");

        click(backdrop, "ai-history-filter-legacy");
        const pendingActions = backdrop.querySelectorAll("[data-testid=ai-history-open], [data-testid=ai-history-delete]");
        // Retained controls must also reject invocation, even after they leave the DOM.
        (staleAction as unknown as HTMLElement).click();
        query.resolve(legacyResult);
        await whenAiConversationHistoryModalSettled();

        expect.soft(pendingActions).toHaveLength(0);
        expect.soft(read).not.toHaveBeenCalled();
        expect.soft(remove).not.toHaveBeenCalled();
        expect.soft(onOpen).not.toHaveBeenCalled();
        expect.soft(await conversations.loadConversation(target.id)).toMatchObject(target);
        expect(backdrop.parentElement).not.toBeNull();
        expect(queried).toHaveBeenCalledWith(expect.objectContaining({ projectContextKey: null }));
        expect(findByTestId(backdrop, "ai-history-filter-legacy")!.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(backdrop, "ai-history-legacy-inspect")).not.toBeNull();
      });

      it.each([false, true])("invalidates pending scoped Open on legacy transition (return to scoped: %s)", async (returnToScoped) => {
        const target = record("transition-pending-open", 1_000, "mine");
        await saveConversation(target);
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        const load = deferred<ConversationRecord | null>();
        const read = vi.spyOn(conversations, "loadConversationForScope").mockReturnValueOnce(load.promise);
        const legacyResult = await conversations.queryConversationArchive({ projectContextKey: null });
        const query = deferred<typeof legacyResult>();
        const queried = vi.spyOn(conversations, "queryConversationArchive").mockReturnValueOnce(query.promise);

        click(backdrop, "ai-history-open");
        click(backdrop, "ai-history-filter-legacy");
        if (returnToScoped) click(backdrop, "ai-history-filter-all");
        query.resolve(legacyResult);
        load.resolve(target);
        await whenAiConversationHistoryModalSettled();

        expect(read).toHaveBeenCalledWith(target.id, "mine");
        expect(queried).toHaveBeenCalledWith(expect.objectContaining({ projectContextKey: null }));
        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-recover-status")!.dataset.state).toBe("idle");
        if (returnToScoped) {
          // A fresh scoped invocation still works after the abandoned read completes.
          click(backdrop, "ai-history-open");
          await whenAiConversationHistoryModalSettled();
          expect(onOpen).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: target.id }));
          expect(backdrop.parentElement).toBeNull();
        }
      });

      it("keeps a failed legacy inspect recoverable without adopting", async () => {
        await saveConversation({
          id: "legacy-retry",
          title: "LEGACY_RETRY_USER",
          model: "m",
          savedAt: 500,
          entries: [
            { kind: "user", text: "LEGACY_RETRY_USER" },
            { kind: "assistant", text: "LEGACY_RETRY_ASSIST" },
          ],
        });
        const onOpen = vi.fn();
        const backdrop = openModal({ currentConversationId: "active-now", onOpen });
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-legacy");
        await whenAiConversationHistoryModalSettled();
        vi.spyOn(conversations, "loadConversationForScope").mockRejectedValueOnce(new Error("LEGACY_READ_FAILURE"));

        click(backdrop, "ai-history-legacy-inspect");
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-legacy-body")).toBeNull();
        const status = findByTestId(backdrop, "ai-history-recover-status")!;
        expect(status.dataset.state).toBe("error");
        expect(status.textContent).toContain("LEGACY_READ_FAILURE");
        expect(findByTestId(backdrop, "ai-history-recover")!.hidden).toBe(true);

        click(backdrop, "ai-history-legacy-inspect");
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-legacy-body")!.textContent).toContain("LEGACY_RETRY_ASSIST");
        expect(onOpen).not.toHaveBeenCalled();
        expect((await conversations.loadConversation("legacy-retry"))?.projectContextKey).toBeUndefined();
      });

      it("does not paint a late legacy inspect onto the current-project list", async () => {
        await saveConversation({
          id: "legacy-stale",
          title: "LEGACY_STALE_USER",
          model: "m",
          savedAt: 500,
          entries: [{ kind: "user", text: "LEGACY_STALE_USER" }, { kind: "assistant", text: "LEGACY_STALE_ASSIST" }],
        });
        await saveConversation(record("mine-now", 2_000, "mine", "CURRENT_PROJECT_TURN"));
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-legacy");
        await whenAiConversationHistoryModalSettled();
        let resolveLoad: ((value: ConversationRecord | null) => void) | undefined;
        vi.spyOn(conversations, "loadConversationForScope").mockImplementationOnce(
          () => new Promise((resolve) => { resolveLoad = resolve; }),
        );
        click(backdrop, "ai-history-legacy-inspect");
        click(backdrop, "ai-history-filter-all");
        resolveLoad?.({
          id: "legacy-stale",
          title: "LEGACY_STALE_USER",
          model: "m",
          savedAt: 500,
          entries: [{ kind: "user", text: "LEGACY_STALE_USER" }, { kind: "assistant", text: "LEGACY_STALE_ASSIST" }],
        });
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(findByTestId(backdrop, "ai-history-legacy-body")).toBeNull();
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("CURRENT_PROJECT_TURN");
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain("LEGACY_STALE_USER");
      });
    });
  });
  describe("aiConversationLog", () => {
    isolateTimers();
    function makeLog(): {
      readonly log: HTMLElement;
      readonly host: ReturnType<typeof createConversationLogHost>;
    } {
      const log = document.createElement("div");
      const host = createConversationLogHost({
        log,
        removeStartScreen: () => undefined,
      });
      return { log, host };
    }
    describe("conversation log command rows", () => {
      let restoreDom: (() => void) | null = null;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      it("records a user+assistant turn as two command rows and zero chat bubbles", () => {
        // Break: appendConversationBubble still assigns ai-chat-bubble / ai-chat-user.
        const { log, host } = makeLog();

        host.renderConversationEntry({ kind: "user", text: "호수 만들어줘" });
        host.renderConversationEntry({ kind: "assistant", text: "초안입니다." });

        expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(2);
        expect(log.querySelectorAll(".ai-chat-user")).toHaveLength(0);
        expect(log.querySelectorAll(".ai-chat-assistant")).toHaveLength(0);
        expect(findByTestId(log as unknown as FakeElement, "ai-command-row-user")?.textContent).toContain("호수 만들어줘");
        expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toContain("초안입니다.");
      });

      it("prefixes each human-log row with @>", () => {
        // Break: the row is emitted without an @> prefix node.
        const { log, host } = makeLog();

        host.appendBubble("user", "길 깔아줘");
        host.appendBubble("system", "오류: 키 없음");

        const prefixes = log.querySelectorAll(".ai-command-prefix");
        expect(prefixes).toHaveLength(2);
        expect(prefixes[0]?.textContent).toBe("@>");
        expect(prefixes[1]?.textContent).toBe("@>");
      });

      it("streams tokens into the last command row in place", () => {
        // Break: each stream token creates another ai-command-row instead of mutating the last body.
        const { log, host } = makeLog();

        const streamed = host.appendBubble("assistant", "");
        streamed.textContent = `${streamed.textContent ?? ""}헬`;
        streamed.textContent = `${streamed.textContent ?? ""}로`;

        expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(1);
        expect(streamed.textContent).toBe("헬로");
        expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toBe("헬로");
      });

      it("keeps markdown rendering inside the command row", () => {
        // Break: assistant markdown is rendered as a sibling bubble, not inside the row.
        const { log, host } = makeLog();

        host.appendBubble("assistant", "**초안**입니다");

        const row = log.querySelector("[data-testid=ai-command-row]");
        expect(row?.querySelector(".md")).toBeTruthy();
        expect(row?.querySelector("strong")?.textContent).toBe("초안");
      });

      it("tool lines leave the log entirely — they are handed to the work sink (방향 G)", () => {
        // Break: appendToolLine attaches ai-tool-activity to the command row again.
        const log = document.createElement("div");
        const received: HTMLElement[] = [];
        const host = createConversationLogHost({
          log,
          removeStartScreen: () => undefined,
          workSink: {
            appendToolEntry: (entry) => void received.push(entry),
            noteReadOnlyTool: () => undefined,
            appendCard: () => undefined,
          },
        });

        host.appendBubble("user", "길 깔아줘");
        const entry = host.appendToolLine("paint_road", { ok: true, summary: "길을 그렸습니다" }, undefined, { live: true });

        expect(entry).not.toBeNull();
        expect(received).toEqual([entry]);
        expect(findByTestId(log as unknown as FakeElement, "ai-tool-activity")).toBeNull();
        expect(findByTestId(log as unknown as FakeElement, "ai-tool-entry")).toBeNull();
        expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(1);
      });

      it("attaches a tile grid to the last command row instead of a bubble", () => {
        // Break: appendTileGrid still wraps the grid in ai-chat-bubble.
        const { log, host } = makeLog();

        host.appendBubble("assistant", "격자");
        host.appendTileGrid({
          // New projects no longer carry the EasyRPG combined_town sheet (2026-10-07 purge); use the default tileset.
          tilesetId: DEFAULT_TILESET_ID,
          x: 0,
          y: 0,
          w: 1,
          h: 1,
          lower: [[0]],
          upper: [[-1]],
        });

        const grid = findByTestId(log as unknown as FakeElement, "ai-bubble-tile-grid");
        const row = log.querySelector("[data-testid=ai-command-row]");
        expect(grid).toBeTruthy();
        expect(grid?.className).not.toContain("ai-chat-bubble");
        expect(row?.contains(grid as unknown as Node)).toBe(true);
      });
    });
    describe("작업 행 — 한국어 라벨 · 조회는 개수만 · 복원 경로 표시 (데크 2026-09-03 → 띠 2026-09-17)", () => {
      let restoreDom: (() => void) | null = null;
      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      function makeHost(renderChip?: Parameters<typeof createConversationLogHost>[0]["renderChip"]) {
        const log = document.createElement("div");
        const entries: Array<{ entry: HTMLElement; live: boolean; name: string }> = [];
        const reads: Array<{ name: string; live: boolean }> = [];
        const host = createConversationLogHost({
          log,
          removeStartScreen: () => undefined,
          workSink: {
            appendToolEntry: (entry, meta) => void entries.push({ entry, live: meta.live, name: meta.name }),
            noteReadOnlyTool: (name, live) => void reads.push({ name, live }),
            appendCard: () => undefined,
          },
          ...(renderChip ? { renderChip } : {}),
        });
        return { log, host, entries, reads };
      }

      it("라이브 행은 한국어 라벨 + 요약 + 상태이고, 함수 이름은 title 로 내려간다", () => {
        // Break: 행이 `✓ place_npc …` 한 줄 텍스트로 돌아가거나 라벨이 함수 이름 그대로다.
        const { host, entries } = makeHost();
        host.appendBubble("user", "상인 세워줘");
        host.appendToolLine("place_npc", { ok: true, summary: "상인 「두리」 (27,15)" }, { x: 27, y: 15 }, { live: true });
        const entry = entries[0]?.entry as unknown as FakeElement | undefined;
        expect(entry?.dataset.testid).toBe("ai-tool-entry");
        expect(entry?.querySelector(".ai-act-label")?.textContent).toBe("NPC 배치");
        expect(entry?.querySelector(".ai-act-sum")?.textContent).toBe("상인 「두리」 (27,15)");
        expect(entry?.querySelector(".ai-act-status")).not.toBeNull();
        expect(entry?.getAttribute("title")).toContain("place_npc");
        expect(entry?.textContent).not.toContain("place_npc");
      });

      it("조회 툴(get_*)은 행 없이 개수만 알리고, 쓰기 툴만 행이 된다", () => {
        // Break: 조회가 단계 행으로 남아 카드가 「작업 3단계」 로 부푼다.
        const { host, entries, reads } = makeHost();
        host.appendBubble("user", "우물 놓고 상인 세워줘");
        expect(host.appendToolLine("get_map_region", { ok: true, summary: "60×45" }, { x: 0, y: 0, w: 60, h: 45 }, { live: true })).toBeNull();
        host.appendToolLine("stamp_structure", { ok: true, summary: "우물 1" }, { x: 24, y: 11 }, { live: true });
        host.appendToolLine("place_npc", { ok: true, summary: "상인 2" }, { x: 22, y: 14 }, { live: true });
        expect(reads).toEqual([{ name: "get_map_region", live: true }]);
        expect(entries.map((item) => item.name)).toEqual(["stamp_structure", "place_npc"]);
        expect(entries.every((item) => item.live)).toBe(true);
      });

      it("복원 경로(live 아님)는 live=false 로 표시돼 띠가 걸러낼 수 있다", () => {
        // Break: 복원된 대화의 툴콜이 이번 세션의 작업 카드로 쌓인다.
        const { host, entries, reads } = makeHost();
        host.appendBubble("user", "맵 좀 봐줘");
        host.appendToolLine("get_map_region", { ok: true, summary: "60×45" });
        host.appendToolLine("show_map_region", { ok: true, summary: "보임" });
        host.appendToolLine("paint_road", { ok: true, summary: "길 3칸" });
        expect(reads.map((item) => item.live)).toEqual([false, false]);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.live).toBe(false);
      });

      it("renderChip 이 주어지면 행 앞에 맵 칩을 꽂고, null 이면 아이콘 칩", () => {
        // Break: 칩 훅이 무시되어 모든 행이 아이콘으로만 남는다.
        const chip = document.createElement("span");
        chip.className = "ai-act-chip";
        chip.dataset.testid = "fake-chip";
        const { host, entries } = makeHost((name) => (name === "place_npc" ? chip : null));
        host.appendBubble("user", "상인");
        host.appendToolLine("place_npc", { ok: true, summary: "상인 1" }, { x: 1, y: 1 }, { live: true });
        host.appendToolLine("configure_game_systems", { ok: true, summary: "설정" }, {}, { live: true });
        expect(findByTestId(entries[0]!.entry as unknown as FakeElement, "fake-chip")).toBe(chip);
        expect(entries[1]?.entry.querySelector(".ai-act-chip")?.className).toContain("is-icon");
      });
    });
  });
  // test/aiConversationReplay.test.ts
  // "이전 대화 이어가기" 가 모델 쪽에서도 참이 되게 하는 직렬화의 계약.
  //
  // 잠그는 것 셋:
  //  1. status 항목은 버린다(턴 수명주기 진단은 다음 턴 모델에게 소음이다).
  //  2. 상한을 넘으면 **꼬리**를 남긴다 — 앞을 남기면 "방금 무엇을 하던 중" 이 사라진다.
  //  3. 주입 메시지는 role "user" + 마커로 시작한다(압축 요약과 같은 안전 지대. tool_calls 짝을
  //     재구성하면 Gemini/Cloud Code Assist 에서 400 이다).
  describe("aiConversationReplay", () => {
    isolateTimers();
    const ENTRIES: readonly AuditEntry[] = [
      { kind: "user", text: "마을 입구에 우물을 놔줘" },
      { kind: "status", text: "tools:exposed=40" },
      { kind: "tool", name: "place_structure", args: { id: "well" }, ok: true, summary: "우물 1개 배치" },
      { kind: "assistant", text: "우물을 놨습니다." },
      { kind: "tool", name: "edit_tile", args: {}, ok: false, summary: "범위를 벗어났습니다" },
    ];
    describe("serializeAuditTranscript", () => {
      it("Given 사용자·조수·툴·상태가 섞인 기록 When 직렬화 Then 상태만 빠지고 나머지는 순서대로 남는다", () => {
        const lines = serializeAuditTranscript(ENTRIES).split("\n");

        expect(lines).toEqual([
          "[사용자] 마을 입구에 우물을 놔줘",
          "[툴 성공] place_structure: 우물 1개 배치",
          "[조수] 우물을 놨습니다.",
          "[툴 실패] edit_tile: 범위를 벗어났습니다",
        ]);
        expect(serializeAuditTranscript(ENTRIES)).not.toContain("tools:exposed");
      });

      it("Given 빈 기록 When 직렬화 Then 빈 문자열이다(주입할 것이 없다는 신호)", () => {
        expect(serializeAuditTranscript([])).toBe("");
        expect(serializeAuditTranscript([{ kind: "status", text: "x" }])).toBe("");
      });

      it("Given 공백만 있는 발화 When 직렬화 Then 줄을 만들지 않는다", () => {
        expect(serializeAuditTranscript([{ kind: "user", text: "   " }, { kind: "assistant", text: "\n" }])).toBe("");
      });

      it("Given 상한을 넘는 기록 When 직렬화 Then 최근 줄이 남고 생략 머리글이 붙는다", () => {
        const many: AuditEntry[] = Array.from({ length: 40 }, (_unused, index) => ({
          kind: "user" as const,
          text: `${index}번째 지시 ${"가".repeat(20)}`,
        }));

        const output = serializeAuditTranscript(many, 300);

        expect(output.startsWith("[앞부분 ")).toBe(true);
        expect(output).toContain("39번째 지시");
        expect(output).not.toContain("0번째 지시");
        expect(output.length).toBeLessThanOrEqual(300 + "[앞부분 00줄 생략 — 오래된 기록]\n".length);
      });

      it("Given 아주 긴 툴 요약 When 직렬화 Then 요약 1건이 200자에서 잘린다", () => {
        const output = serializeAuditTranscript([
          { kind: "tool", name: "t", args: {}, ok: true, summary: "가".repeat(500) },
        ]);

        expect(output).toContain("…");
        expect(output.length).toBeLessThan(300);
      });
    });
    describe("restoredTranscriptMessage", () => {
      it("Given 직렬화된 기록 When 메시지 생성 Then user 역할 + 마커 + 재실행 금지 문구를 담는다", () => {
        const message = restoredTranscriptMessage("[사용자] 우물");

        expect(message.role).toBe("user");
        expect(String(message.content).startsWith(RESTORED_TRANSCRIPT_MARKER)).toBe(true);
        expect(String(message.content)).toContain("다시 실행하지 마라");
        expect(String(message.content)).toContain("[사용자] 우물");
        expect(isRestoredTranscriptMessage(message)).toBe(true);
      });

      it("Given 평범한 사용자 메시지 When 판정 Then 복원 메시지가 아니다", () => {
        expect(isRestoredTranscriptMessage({ role: "user", content: "우물 놔줘" })).toBe(false);
        expect(isRestoredTranscriptMessage({ role: "system", content: RESTORED_TRANSCRIPT_MARKER })).toBe(false);
      });
    });
  });
});

describe("aiDeckIcons", () => {
  isolateTimers();
  describe("aiDeckIcons — 데크 아이콘 빌더", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("아이콘은 currentColor stroke 의 svg 이고 이름을 data-icon 으로 든다", () => {
      // Break: 아이콘이 텍스트 글리프(☰·🕒)로 돌아가거나 stroke/fill 계약이 깨진다.
      const icon = deckIcon("plus");
      expect(icon.tagName.toLowerCase()).toBe("svg");
      expect(icon.getAttribute("data-icon")).toBe("plus");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("stroke")).toBe("currentColor");
      expect(icon.getAttribute("fill")).toBe("none");
      expect(icon.getAttribute("stroke-width")).toBe("1.75");
      expect(icon.getAttribute("width")).toBe("18");
      expect(icon.getAttribute("class")).toContain("ai-deck-icon");
    });

    it("크기 옵션은 width/height 를 함께 바꾼다", () => {
      // Break: size 가 width 에만 적용되거나 무시된다.
      const icon = deckIcon("clock", { size: 15 });
      expect(icon.getAttribute("width")).toBe("15");
      expect(icon.getAttribute("height")).toBe("15");
    });

    it("모든 이름에 그림(path/circle/rect) 이 하나 이상 있다", () => {
      // Break: 사전에 이름만 있고 경로가 비어 빈 사각형이 그려진다.
      for (const name of DECK_ICON_NAMES) {
        const icon = deckIcon(name);
        expect(icon.childNodes.length, name).toBeGreaterThan(0);
      }
    });
  });
});

describe("aiDeckRail", () => {
  isolateTimers();
  describe("aiDeckRail — 데크 상태 레일", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("이름은 「조수」 이고 헤더·얼굴 클래스는 되살리지 않는다", () => {
      // Break: 레일이 .ai-chat-header / .ai-director-* 이름을 다시 쓰면 aiPanelChrome 계약과 충돌한다.
      // 이름은 조수 하나다 — e9d308b43a 가 「AI」 에서 「조수」 로 바꿨다(머리·레일·접기 버튼이 같은 이름).
      const rail = createDeckRail();
      expect(rail.root.dataset.testid).toBe("ai-deck-rail");
      expect(rail.root.querySelector(".ai-deck-rail-name")?.textContent).toBe("조수");
      expect(rail.root.querySelector(".ai-chat-header")).toBeNull();
      expect(rail.root.querySelector(".ai-director-name")).toBeNull();
      expect(rail.root.querySelector(".ai-director-face")).toBeNull();
    });

    it("맵 맥락은 setContext 로 바뀌고 없으면 비운다", () => {
      // Break: 맵 이름이 갱신되지 않거나 null 에 「null」 글자가 남는다.
      const rail = createDeckRail();
      rail.setContext("시장 마을");
      expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("시장 마을");
      rail.setContext(null);
      expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("");
    });

    it("상태는 data-ai-state 하나로 점과 문장 톤이 함께 움직인다", () => {
      // Break: 점 클래스만 바뀌고 dataset 이 안 바뀌면 CSS 헤어라인·알약이 어긋난다.
      const rail = createDeckRail();
      expect(rail.root.dataset.aiState).toBe("idle");
      rail.setState("run");
      expect(rail.root.dataset.aiState).toBe("run");
      const dot = rail.root.querySelector(".ai-deck-rail-dot");
      expect(dot?.dataset.aiState).toBe("run");
      rail.setState("attention");
      expect(rail.root.dataset.aiState).toBe("attention");
      expect(dot?.dataset.aiState).toBe("attention");
    });

    it("액션 슬롯은 비어 있고 상태 슬롯은 기존 ai-status 를 받을 자리다", () => {
      // Break: 레일이 버튼을 스스로 만들면 컴포저와 두 벌이 된다 — 슬롯만 제공해야 한다.
      const rail = createDeckRail();
      expect(rail.actions.childNodes.length).toBe(0);
      const status = document.createElement("span");
      status.dataset.testid = "ai-status";
      rail.statusSlot.append(status);
      expect(rail.root.querySelector("[data-testid='ai-status']")).toBe(status);
    });

    it("상태 톤(idle/running/ok/error) → 데크 상태 사상 — 확인 필요는 톤이 아니라 패널이 직접 setState 한다", () => {
      // Break: 새 톤이 idle 로 조용히 떨어져 진행·확인 필요가 회색으로 보인다.
      expect(deckStateOfTone("idle")).toBe("idle");
      expect(deckStateOfTone("running")).toBe("run");
      expect(deckStateOfTone("ok")).toBe("done");
      expect(deckStateOfTone("error")).toBe("error");
    });
  });
});

describe("aiEntityMentions", () => {
  isolateTimers();
  describe("findEntityMentions", () => {
    it("finds an enemy and an item mentioned in one sentence, in text order", () => {
      const project = createBlankProject();
      project.database.enemies = [
        {
          id: "enemy_goblin",
          name: "고블린",
        } as EnemyRecord,
      ];
      project.database.items = [
        {
          id: "item_potion",
          name: "체력 물약",
        } as ItemRecord,
      ];

      const mentions = findEntityMentions(
        "상점에서 체력 물약을 사고 숲에서 고블린을 처치했다.",
        project
      );

      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({
        collection: "items",
        id: "item_potion",
        name: "체력 물약",
        record: project.database.items[0],
      });
      expect(mentions[1]).toEqual({
        collection: "enemies",
        id: "enemy_goblin",
        name: "고블린",
        record: project.database.enemies[0],
      });
    });

    it("returns [] for text mentioning nothing, and [] for empty text", () => {
      const project = createBlankProject();
      project.database.enemies = [
        {
          id: "enemy_slime",
          name: "슬라임",
        } as EnemyRecord,
      ];

      expect(findEntityMentions("아무것도 일치하지 않는 문장입니다.", project)).toEqual([]);
      expect(findEntityMentions("", project)).toEqual([]);
      expect(findEntityMentions("   ", project)).toEqual([]);
    });

    it("prefers the longer name: a project with enemies named '슬라임' and '슬라임 왕' and text '슬라임 왕이 나타났다' yields exactly one mention, '슬라임 왕'", () => {
      const project = createBlankProject();
      project.database.enemies = [
        {
          id: "enemy_slime",
          name: "슬라임",
        } as EnemyRecord,
        {
          id: "enemy_king_slime",
          name: "슬라임 왕",
        } as EnemyRecord,
      ];

      const mentions = findEntityMentions("슬라임 왕이 나타났다", project);
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.name).toBe("슬라임 왕");
      expect(mentions[0]?.id).toBe("enemy_king_slime");
    });

    it("honours the limit argument", () => {
      const project = createBlankProject();
      project.database.items = [
        { id: "item_1", name: "사과 물약" } as ItemRecord,
        { id: "item_2", name: "바나나 물약" } as ItemRecord,
        { id: "item_3", name: "포도 물약" } as ItemRecord,
      ];

      const text = "사과 물약, 바나나 물약, 포도 물약 중 하나를 고르세요.";
      const mentions = findEntityMentions(text, project, 2);
      expect(mentions).toHaveLength(2);
      expect(mentions.map((m) => m.name)).toEqual(["사과 물약", "바나나 물약"]);
    });
  });
  describe("renderEntityMentionStrip", () => {
    let restoreFakeDom: (() => void) | undefined;

    afterEach(() => {
      restoreFakeDom?.();
      restoreFakeDom = undefined;
    });

    it("returns null for [] and, for two mentions, produces a container with testid ai-mention-strip holding two chips whose names match", () => {
      restoreFakeDom = installFakeDom();
      const project = createBlankProject();

      expect(renderEntityMentionStrip([], project)).toBeNull();

      const mentions: EntityMention[] = [
        {
          collection: "enemies",
          id: "enemy_1",
          name: "불도깨비",
          record: { id: "enemy_1", name: "불도깨비" } as EnemyRecord,
        },
        {
          collection: "items",
          id: "item_1",
          name: "마나 포션",
          record: { id: "item_1", name: "마나 포션" } as ItemRecord,
        },
      ];

      const node = renderWithFakeDom(() =>
        renderEntityMentionStrip(mentions, project)!
      ) as FakeElement;

      expect(node).not.toBeNull();
      expect(node.dataset.testid).toBe("ai-mention-strip");
      expect(node.getAttribute("role")).toBe("list");
      expect(node.getAttribute("aria-label")).toBe("언급된 자료");

      const chip1 = findByTestId(node, "ai-mention-enemies-enemy_1");
      const chip2 = findByTestId(node, "ai-mention-items-item_1");

      expect(chip1).not.toBeNull();
      expect(chip2).not.toBeNull();

      expect(chip1?.getAttribute("role")).toBe("listitem");
      expect(chip1?.getAttribute("title")).toBe("불도깨비");
      expect(chip1?.querySelector(".ai-mention-name")?.textContent).toBe("불도깨비");

      expect(chip2?.getAttribute("role")).toBe("listitem");
      expect(chip2?.getAttribute("title")).toBe("마나 포션");
      expect(chip2?.querySelector(".ai-mention-name")?.textContent).toBe("마나 포션");
    });
  });
  // 라이브 턴에서 실측한 오탐(2026-08-26): 기본 프로젝트에는 "map", "ale", "egg", "bell",
  // "bone", "coal" 같은 짧은 순수 ASCII 아이템 이름이 수십 개 있다. 부분 문자열 포함만으로
  // 매칭하면 어시스턴트가 "현재 맵: 이슬 장터 마을 (mapvillage30_100x100)" 이라고 말하는
  // 순간 아이템 "map" 썸네일이 붙는다 — 실제로 브라우저에서 붙는 것을 확인했다.
  // 단어 경계가 없다는 근거는 **한글에만** 해당하므로, ASCII 이름은 경계를 요구한다.
  describe("짧은 ASCII 이름 오탐", () => {
    function projectWithNames(itemNames: string[], enemyNames: string[] = []) {
      const project = createBlankProject();
      project.database.items = itemNames.map((name, i) => ({ id: `item_ascii_${i}`, name }) as ItemRecord);
      project.database.enemies = enemyNames.map((name, i) => ({ id: `enemy_ascii_${i}`, name }) as EnemyRecord);
      return project;
    }

    it('맵 id 문자열 안의 "map" 은 아이템 map 으로 보지 않는다', () => {
      const project = projectWithNames(["map"]);

      expect(findEntityMentions("현재 맵: 이슬 장터 마을 (mapvillage30_100x100)", project)).toEqual([]);
    });

    it("다른 영어 단어에 숨은 짧은 이름도 잡지 않는다", () => {
      const project = projectWithNames(["ale", "egg", "bell", "bone"]);

      const found = findEntityMentions("The female scale bellows; bones remain. eggplant.", project);

      expect(found.map((m) => m.name)).toEqual([]);
    });

    it("독립된 단어로 나오면 ASCII 이름도 정상 매칭한다", () => {
      const project = projectWithNames(["map", "ale"]);

      const found = findEntityMentions("상자에 map 과 ale 을 넣었습니다.", project);

      expect(found.map((m) => m.name).sort()).toEqual(["ale", "map"]);
    });

    it("한글 이름은 그대로 부분 문자열로 매칭한다(경계가 없으므로)", () => {
      const project = projectWithNames([], ["슬라임"]);

      expect(findEntityMentions("슬라임을 광장에 두었습니다.", project).map((m) => m.name)).toEqual(["슬라임"]);
    });
  });
});

// 하네스 타임라인 병합 — 사람이 누른 것과 모델이 한 것이 한 줄기로 흘러야 한다.
//
// 왜 필요한가: 「압축을 누른 직후 턴이 깨졌다」, 「도크를 바꾸자 답장이 사라졌다」류는 두 스트림을
// 따로 보면 절대 안 보인다. 그리고 병합에는 조용한 함정이 하나 있다 — audit 항목 중 `at` 이 없는
// 것들(초기 상태줄)을 빈 문자열로 정렬하면 전부 맨 앞으로 몰려 «순서가 거짓» 이 된다.
describe("aiHarnessTimelineMerge", () => {
  isolateTimers();
  const audit: readonly AuditEntry[] = [
    { kind: "user", text: "석상 좀 고쳐줘", at: "2026-08-30T04:00:00.000Z" },
    { kind: "status", text: "phase:plan" }, // at 없음 — 직전 시각을 물려받아야 한다
    { kind: "tool", name: "set_event", args: {}, ok: true, summary: "이벤트 1건", at: "2026-08-30T04:00:10.000Z" },
  ];
  describe("mergeHarnessTimeline", () => {
    it("interleaves front actions with audit entries by time", () => {
      const merged = mergeHarnessTimeline(audit, [
        { at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" },
        { at: "2026-08-30T04:00:20.000Z", seq: 2, surface: "panel", action: "turn-rewind" },
      ]);
      expect(
        merged.map((row) => (row.kind === "ui" ? `ui:${row.event.action}` : `audit:${row.entry.kind}`)),
      ).toEqual([
        "audit:user",
        "audit:status", // at 없는 칸이 사용자 발언 뒤에 그대로 남는다
        "ui:context-compact",
        "audit:tool",
        "ui:turn-rewind",
      ]);
    });

    it("puts the audit entry first when the timestamps tie", () => {
      // 액션의 결과가 그 액션보다 앞서 보이면 인과가 뒤집힌다.
      const merged = mergeHarnessTimeline(
        [{ kind: "status", text: "압축 완료", at: "2026-08-30T04:00:05.000Z" }],
        [{ at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" }],
      );
      expect(merged.map((row) => row.kind)).toEqual(["audit", "ui"]);
    });

    it("returns audit alone when nothing was pressed", () => {
      expect(mergeHarnessTimeline(audit, [])).toHaveLength(audit.length);
      expect(mergeHarnessTimeline([], [])).toHaveLength(0);
    });
  });
});

// test/aiInstructionsModal.test.ts
// 감독 지침 편집 모달 — 저장이 **프로젝트에** 들어가고, 되돌리기 스냅샷을 남기고,
// 세션에 알려 주는지.
//
// 프로젝트에 저장하는 이유(localStorage 가 아닌): 지침은 그 게임의 성질이지 이 브라우저의
// 설정이 아니다. 프로젝트를 옮기면 규칙도 따라가야 한다.
describe("aiInstructionsModal", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  function open(saved: string[]): FakeElement {
    return openAiInstructionsModal({ onSaved: (value) => saved.push(value) }) as unknown as FakeElement;
  }
  function typeInto(backdrop: FakeElement, value: string): void {
    const input = findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement & FakeElement;
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }
  function save(backdrop: FakeElement): void {
    (findByTestId(backdrop, "ai-instructions-save") as unknown as HTMLElement).click();
  }
  beforeEach(() => {
    store.replace(createBlankProject());
    // 히스토리는 모듈 전역이다 — 리셋하지 않으면 앞 케이스가 남긴 동일 서명 스냅샷 때문에
    // pushSnapshot 의 중복 제거가 이번 케이스의 스냅샷을 삼킨다.
    resetMapEditHistory();
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    closeAiInstructionsModal();
    restoreDom?.();
    restoreDom = null;
    vi.restoreAllMocks();
  });
  describe("감독 지침 모달", () => {
    it("Given 지침 없는 프로젝트 When 열기 Then 빈 입력과 0자 카운터", () => {
      const backdrop = open([]);

      expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("");
      expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`0 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
    });

    it("Given 이미 저장된 지침 When 열기 Then 그 값이 실려 온다", () => {
      store.update((draft) => {
        draft.aiInstructions = "4방향 이동만 쓴다.";
      });

      const backdrop = open([]);

      expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("4방향 이동만 쓴다.");
    });

    it("Given 지침 입력 When 저장 Then 프로젝트에 남고 onSaved 로 알리고 모달이 닫힌다", () => {
      const saved: string[] = [];
      const backdrop = open(saved);

      typeInto(backdrop, "  타일셋 B 는 쓰지 마라.\r\n ");
      save(backdrop);

      expect(store.getCurrent().aiInstructions).toBe("타일셋 B 는 쓰지 마라.");
      expect(saved).toEqual(["타일셋 B 는 쓰지 마라."]);
      expect(backdrop.parentElement).toBeNull();
    });

    it("Given 지침 편집 When 저장 Then 되돌리기 스냅샷이 남는다(다른 프로젝트 편집과 동일)", () => {
      const before = getMapEditHistoryMarker();
      const backdrop = open([]);

      typeInto(backdrop, "전투는 턴제다.");
      save(backdrop);

      expect(getMapEditHistoryMarker()).toBeGreaterThan(before);
      expect(getMapEditHistoryState().canUndo).toBe(true);
    });

    it("Given 저장된 지침을 비움 When 저장 Then 필드가 제거된다(빈 문자열을 남기지 않는다)", () => {
      store.update((draft) => {
        draft.aiInstructions = "지울 규칙";
      });
      const saved: string[] = [];
      const backdrop = open(saved);

      typeInto(backdrop, "   ");
      save(backdrop);

      expect("aiInstructions" in store.getCurrent()).toBe(false);
      expect(saved).toEqual([""]);
    });

    it("Given 값을 바꾸지 않고 저장 When 클릭 Then 스냅샷도 onSaved 도 없다(빈 편집은 편집이 아니다)", () => {
      const before = getMapEditHistoryMarker();
      const saved: string[] = [];
      const backdrop = open(saved);

      save(backdrop);

      expect(getMapEditHistoryMarker()).toBe(before);
      expect(saved).toEqual([]);
      expect(backdrop.parentElement).toBeNull();
    });

    it("Given 상한 초과 입력 When 저장 Then 상한에서 잘려 저장된다", () => {
      const backdrop = open([]);

      typeInto(backdrop, "가".repeat(AI_INSTRUCTIONS_MAX_CHARS + 200));
      save(backdrop);

      expect(store.getCurrent().aiInstructions).toHaveLength(AI_INSTRUCTIONS_MAX_CHARS);
    });

    it("Given 입력 중 When 글자 수 변화 Then 카운터가 따라온다", () => {
      const backdrop = open([]);

      typeInto(backdrop, "다섯글자");

      expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`4 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
    });

    it("Given 닫기 버튼 When 클릭 Then 저장 없이 닫힌다", () => {
      const backdrop = open([]);

      typeInto(backdrop, "저장하지 않을 값");
      (findByTestId(backdrop, "ai-instructions-close") as unknown as HTMLElement).click();

      expect(backdrop.parentElement).toBeNull();
      expect(store.getCurrent().aiInstructions).toBeUndefined();
    });
  });
});

describe("aiMapChip", () => {
  isolateTimers();
  const ok = { ok: true, summary: "" } as const;
  describe("aiMapChip — 툴 호출에서 맵 자리를 읽는다", () => {
    it("인자의 x/y 한 칸, x/y/w/h 사각형, rect 객체를 영역으로 읽는다", () => {
      // Break: 인자 모양 하나가 빠지면 그 툴의 행이 빈 아이콘 칩으로 떨어진다.
      expect(regionFromToolCall({ x: 3, y: 4 }, ok)).toEqual({ x: 3, y: 4, width: 1, height: 1 });
      expect(regionFromToolCall({ x: 2, y: 2, w: 4, h: 6 }, ok)).toEqual({ x: 2, y: 2, width: 4, height: 6 });
      expect(regionFromToolCall({ rect: { x: 1, y: 2, w: 5, h: 3 } }, ok)).toEqual({ x: 1, y: 2, width: 5, height: 3 });
      expect(regionFromToolCall({ region: { x: 1, y: 2, width: 5, height: 3 } }, ok)).toEqual({ x: 1, y: 2, width: 5, height: 3 });
    });

    it("인자에 없으면 결과 data 의 좌표·영역을 본다", () => {
      // Break: 결과 좌표(예: 빈 자리 찾기)가 무시되어 조회 툴 행에 칩이 없다.
      expect(regionFromToolCall({}, { ...ok, data: { x: 7, y: 8 } })).toEqual({ x: 7, y: 8, width: 1, height: 1 });
      expect(regionFromToolCall(undefined, { ...ok, data: { region: { x: 0, y: 1, width: 2, height: 2 } } }))
        .toEqual({ x: 0, y: 1, width: 2, height: 2 });
    });

    it("좌표가 없거나 유효하지 않으면 null", () => {
      // Break: NaN·음수·문자열 좌표를 영역으로 만들어 렌더러가 던진다.
      expect(regionFromToolCall({ name: "두리" }, ok)).toBeNull();
      expect(regionFromToolCall({ x: "3", y: 4 }, ok)).toBeNull();
      expect(regionFromToolCall({ x: -1, y: 4 }, ok)).toBeNull();
      expect(regionFromToolCall({ x: 1, y: 1, w: 0, h: 2 }, ok)).toBeNull();
    });

    it("칩 창은 영역을 가운데 두고 최소 7×5 로 넓힌 뒤 맵 안으로 자른다", () => {
      // Break: 한 칸 영역을 그대로 그려 46×32 칩에 타일 하나가 뭉개져 보이거나, 맵 밖을 그리려 한다.
      expect(chipWindow({ x: 10, y: 10, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 7, y: 8, width: 7, height: 5 });
      expect(chipWindow({ x: 0, y: 0, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 0, y: 0, width: 7, height: 5 });
      expect(chipWindow({ x: 58, y: 44, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 53, y: 40, width: 7, height: 5 });
      // 큰 영역은 그대로 두고 여백 1칸만 더한다.
      expect(chipWindow({ x: 10, y: 10, width: 20, height: 12 }, { width: 60, height: 45 })).toEqual({ x: 9, y: 9, width: 22, height: 14 });
    });
  });
  describe("renderMapChip", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("맵이 있으면 캔버스를 비동기로 붙이고 핀을 찍는다", async () => {
      // Break: 렌더러 결과를 버리거나 핀이 없어 어디가 바뀌었는지 알 수 없다.
      const project = createBlankProject();
      const mapId = project.startMapId;
      const canvas = document.createElement("canvas");
      const chip = renderMapChip({
        project,
        mapId,
        region: { x: 3, y: 3, width: 1, height: 1 },
        renderShot: () => Promise.resolve(canvas),
      });
      expect(chip.className).toContain("ai-act-chip");
      await Promise.resolve();
      await Promise.resolve();
      expect((chip as unknown as FakeElement).childNodes).toContain(canvas);
      expect(chip.querySelector(".ai-act-pin")).not.toBeNull();
      expect(chip.dataset.region).toBe("3,3 1×1");
    });

    it("렌더가 실패하면 아이콘 칩으로 남고 예외를 밖으로 내지 않는다", async () => {
      // Break: 타일셋 로드 실패가 로그 렌더 전체를 죽인다.
      const project = createBlankProject();
      const chip = renderMapChip({
        project,
        mapId: project.startMapId,
        region: { x: 0, y: 0, width: 1, height: 1 },
        renderShot: () => Promise.reject(new Error("no tileset")),
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(chip.querySelector("canvas")).toBeNull();
      expect(chip.className).toContain("is-icon");
    });

    it("맵이 없으면 아이콘 칩", () => {
      const project = createBlankProject();
      const chip = renderMapChip({ project, mapId: "nope", region: { x: 0, y: 0, width: 1, height: 1 } });
      expect(chip.className).toContain("is-icon");
    });
  });
});

// aiPanelLayoutResponsive.test.ts
// 컴포저 캡슐 폭 저장 + 뷰포트 반응형 클램프 계약.
// 2026-08-31: 도크가 float 하나가 되면서 per-dock 키(oprn:ai-panel-size:<dock>) 3종이
// 캡슐 폭 하나로 합쳐졌다. 낡은 float 키는 최초 1회만 읽어 사용자 폭을 물려받는다.
// vitest 환경은 "node" — 돔 대신 storage(globalThis.localStorage)만 스텁한다.
describe("aiPanelLayoutResponsive", () => {
  isolateTimers();
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
    installFakeLocalStorage();
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  describe("clampPanelSizeToViewport", () => {
    it("작은 뷰포트에서는 폭/높이를 뷰포트의 90%로 상한을 잡는다", () => {
      // 900x900 (한계 내) → 800x700 뷰포트: width=round(800*0.9)=720, height=round(700*0.9)=630
      expect(clampPanelSizeToViewport({ width: 900, height: 900 }, { width: 800, height: 700 })).toEqual({
        width: 720,
        height: 630,
      });
    });

    it("아무리 작은 뷰포트라도 minWidth/minHeight 아래로 내려가지 않는다", () => {
      expect(clampPanelSizeToViewport({ width: 900, height: 900 }, { width: 200, height: 200 })).toEqual({
        width: PANEL_SIZE_LIMITS.minWidth,
        height: PANEL_SIZE_LIMITS.minHeight,
      });
    });

    it("비유효 뷰포트(0/NaN)는 뷰포트 상한 없이 clampPanelSize와 같다", () => {
      const size = { width: 500, height: 600 };
      expect(clampPanelSizeToViewport(size, { width: 0, height: NaN })).toEqual(clampPanelSize(size));
    });
  });
  describe("캡슐 폭 저장/복원", () => {
    it("저장한 폭을 그대로 왕복하고, 저장이 없으면 null 이다", () => {
      expect(loadPanelBarSize()).toBeNull();
      savePanelBarSize({ width: 560, height: 880 });
      expect(loadPanelBarSize()).toEqual({ width: 560, height: 880 });
    });

    it("낡은 float 도크 키를 물려받는다 — 도크 삭제로 사용자 폭을 잃지 않는다", () => {
      storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 620, height: 700 }));
      expect(loadPanelBarSize()).toEqual({ width: 620, height: 700 });
    });

    it("새 키가 있으면 낡은 float 키보다 우선한다", () => {
      storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 620, height: 700 }));
      savePanelSize({ width: 480, height: 640 });
      expect(loadPanelBarSize()).toEqual({ width: 480, height: 640 });
    });

    it("삭제된 glass/side 키는 더 이상 읽지 않는다", () => {
      storage.set("oprn:ai-panel-size:glass", JSON.stringify({ width: 400, height: 700 }));
      storage.set("oprn:ai-panel-size:side", JSON.stringify({ width: 560, height: 880 }));
      expect(loadPanelBarSize()).toBeNull();
    });

    it("저장된 쓰레기 값은 예외 없이 null을 돌려준다", () => {
      storage.set("oprn:ai-panel-size", '{"width":"wide"}');
      expect(loadPanelBarSize()).toBeNull();
    });
  });
  describe("글자 크기 스테퍼", () => {
    it("작게↔보통↔크게에서 끝은 더 나가지 않는다", () => {
      expect(stepAiFontSize("normal", 1)).toBe("large");
      expect(stepAiFontSize("large", 1)).toBe("large");
      expect(stepAiFontSize("small", -1)).toBe("small");
      expect(stepAiFontSize("large", -1)).toBe("normal");
    });
  });
});

// 패널 크기 커스텀 + 툴 브라우저 계약(2026-07-05).
describe("aiPanelResizeAndToolBrowser", () => {
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
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  // 삭제(2026-08-31): describe("사이드 도크 폭 (1/3)") 2케이스 — `computeSideChatWidth` /
  // `resolveSideChatWidth` / `SIDE_CHAT_WIDTH` 가 사이드 도크와 함께 삭제됐다. 캔버스는 항상
  // 전폭이고 `--ai-chat-side-width` 는 영구 0px 다.
  describe("패널 크기 커스텀", () => {
    // 삭제: "저장된 크기가 있으면 유리 카드에 인라인 크기로 적용되고, 리사이즈 핸들이 렌더된다" —
    // 패널 인라인 크기는 삭제된 계약이다. 저장 폭 적용·핸들 렌더는 test/aiPanelGlassResize.test.ts
    // 가 새 표면(컴포저 캡슐의 `--ai-float-bar-width`)으로 덮는다.
    it("클램프 범위를 강제하고 저장/복원이 왕복한다", () => {
      expect(clampPanelSize({ width: 100, height: 100 })).toEqual({ width: PANEL_SIZE_LIMITS.minWidth, height: PANEL_SIZE_LIMITS.minHeight });
      expect(clampPanelSize({ width: 5000, height: 5000 })).toEqual({ width: PANEL_SIZE_LIMITS.maxWidth, height: PANEL_SIZE_LIMITS.maxHeight });
      savePanelSize({ width: 480, height: 600 });
      expect(loadPanelSize()).toEqual({ width: 480, height: 600 });
      // 손상된 저장값은 무시.
      storage.set("oprn:ai-panel-size", "{broken");
      expect(loadPanelSize()).toBeNull();
    });
  });
  describe("툴 브라우저", () => {
    it("카테고리 합계가 활성 툴과 일치한다 — deprecated 레거시는 브라우저 숨김", () => {
      expect(totalToolCount()).toBe(activeTools().length);
      const categoryNames = new Set(TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name)));
      for (const tool of activeTools()) {
        expect(categoryNames.has(tool.name), `브라우저에 누락된 활성 툴: ${tool.name}`).toBe(true);
      }
    });

    it("검색 필터가 이름/설명 부분 일치로 동작한다", () => {
      const byName = filterToolCategories("place_npc");
      expect(byName.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("place_npc");
      const byDescription = filterToolCategories("소품");
      expect(byDescription.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("place_props");
      expect(filterToolCategories("존재하지않는검색어xyz")).toEqual([]);
    });

    it("첫 화면은 자주 쓰는 툴 + 검색 진입이며 전체 목록은 확장으로 연다", () => {
      const modal = openToolBrowserModal() as unknown as FakeElement;
      expect(findByTestId(modal, "tool-browser-body")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-search")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-frequent")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-show-all")).toBeTruthy();
      // 전체 덤프가 첫 페인트에 깔리지 않는다
      expect(findByTestId(modal, "tool-browser-row-remove_map")).toBeNull();
      findByTestId(modal, "tool-browser-show-all")?.click();
      expect(findByTestId(modal, "tool-browser-row-remove_map")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-row-get_event")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-row-rename_variable")).toBeTruthy();
    });

    it("패널 헤더에 🧰 버튼이 렌더된다", () => {
      const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
      expect(findByTestId(panel, "ai-tools-browser")).toBeTruthy();
    });
  });
});

describe("aiPiGhostBridge", () => {
  isolateTimers();
  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  function seed(): Project {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "create_map", { id: "map_east", name: "동쪽", width: 20, height: 16 });
    if (!result.ok) throw new Error(result.summary);
    return ctx.project;
  }
  /** 워커가 하는 일: 프로젝트를 제자리에서 바꾸고 증분 이벤트를 만든다. */
  function workerDelta(shadow: Record<string, GameMap>, next: Record<string, GameMap>): PiAgentEvent {
    return { type: "map_delta", maps: diffMapsForDelta(shadow, next) };
  }
  /** 스로틀 타이머를 손으로 돌린다 — 실제 시간에 기대지 않는다. */
  function fakeTimers() {
    const queued: Array<() => void> = [];
    return {
      setTimeoutFn: (handler: () => void) => { queued.push(handler); return queued.length as unknown as ReturnType<typeof setTimeout>; },
      clearTimeoutFn: () => { /* 취소는 flush/cancel 이 pending 플래그로 막는다 */ },
      tick: () => { const pending = [...queued]; queued.length = 0; for (const handler of pending) handler(); },
    };
  }
  describe("aiPiGhostBridge", () => {
    beforeEach(() => {
      setAiLiveCanvasEnabled(true);
      clearAgentGhostPreview();
      setAgentGhostDraftMapProvider(null);
    });

    afterEach(() => {
      setAiLiveCanvasEnabled(true);
    });

    it("map_delta 를 받아 고스트 프리뷰를 그린다 — 턴이 끝나기 전에", () => {
      const base = seed();
      const timers = fakeTimers();
      const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      timers.tick();

      const previews = getAgentGhostPreviewState().previews;
      expect(previews).toHaveLength(1);
      expect(previews[0]!.mapId).toBe("map_east");
      expect(previews[0]!.cells.some((cell) => cell.x === 2 && cell.y === 2 && cell.layer === "lower")).toBe(true);
      bridge.dispose();
    });

    it("툴마다 오는 증분이 누적된다 — 마지막 증분만 그리지 않는다", () => {
      const base = seed();
      const timers = fakeTimers();
      const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

      let shadow = clone(base.maps);
      const working = clone(base);
      for (const index of [10, 11, 12]) {
        working.maps.map_east!.lowerTiles[index] = 5;
        const event = workerDelta(shadow, working.maps);
        shadow = clone(working.maps);
        bridge.handleEvent(event);
        timers.tick();
      }

      const cells = getAgentGhostPreviewState().previews.flatMap((preview) => preview.cells);
      expect(cells.filter((cell) => cell.layer === "lower")).toHaveLength(3);
      bridge.dispose();
    });

    it("초안 맵을 공급한다 — 렌더러가 컴포지터 경로로 실제 타일을 찍을 수 있게", () => {
      const base = seed();
      const bridge = createPiGhostBridge({ baseProject: base });
      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent(workerDelta(base.maps, working.maps));

      expect(getAgentGhostDraftMap("map_east")!.lowerTiles[42]).toBe(7);
      expect(bridge.draftProject().maps.map_east!.lowerTiles[42]).toBe(7);
      bridge.dispose();
      expect(getAgentGhostDraftMap("map_east")).toBeUndefined();
    });

    it("tool_start 가 실행 중 도구와 그 대상 맵을 세운다", () => {
      const base = seed();
      const bridge = createPiGhostBridge({ baseProject: base });
      bridge.handleEvent({ type: "tool_start", id: "1", name: "paint_tiles", args: { mapId: "map_east" } });
      expect(getAgentGhostPreviewState().runningToolName).toBe("paint_tiles");
      expect(getAgentGhostPreviewState().runningToolMapId).toBe("map_east");
      bridge.dispose();
    });

    it("팀 이벤트(agent_event)는 한 겹 벗겨서 같은 길로 흐른다", () => {
      const base = seed();
      const timers = fakeTimers();
      const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent({ type: "agent_event", agentId: "builder-1", event: workerDelta(base.maps, working.maps) });
      timers.tick();

      expect(getAgentGhostPreviewState().previews).toHaveLength(1);
      bridge.dispose();
    });

    it("done 은 밀린 증분을 즉시 그리고 실행 중 도구를 내린다 — 그림은 남는다", () => {
      const base = seed();
      const timers = fakeTimers();
      const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent({ type: "tool_start", id: "1", name: "paint_tiles", args: { mapId: "map_east" } });
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      // 스로틀 타이머를 돌리지 않는다 — done 이 직접 비워야 한다.
      bridge.handleEvent({ type: "done", project: working, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps.map_east"] });

      expect(getAgentGhostPreviewState().previews).toHaveLength(1);
      expect(getAgentGhostPreviewState().runningToolName).toBe("");
      bridge.dispose();
    });

    it("dispose 는 그림을 지우고 초안 공급을 끊는다 — 적용·버리기·중단이 부르는 길", () => {
      const base = seed();
      const bridge = createPiGhostBridge({ baseProject: base });
      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      bridge.flush();
      expect(getAgentGhostPreviewState().previews).toHaveLength(1);

      bridge.dispose();
      expect(getAgentGhostPreviewState().previews).toHaveLength(0);
      // dispose 뒤에 늦게 도착한 이벤트는 죽은 다리를 되살리지 않는다.
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      bridge.flush();
      expect(getAgentGhostPreviewState().previews).toHaveLength(0);
    });

    it("헤드리스에서는 초안만 갱신하고 맵 연출은 그리지 않는다", () => {
      setAiLiveCanvasEnabled(false);
      const base = seed();
      const bridge = createPiGhostBridge({ baseProject: base });
      const working = clone(base);
      working.maps.map_east!.lowerTiles[42] = 7;
      bridge.handleEvent(workerDelta(base.maps, working.maps));
      bridge.flush();
      expect(getAgentGhostPreviewState().previews).toHaveLength(0);
      expect(bridge.draftProject().maps.map_east!.lowerTiles[42]).toBe(7);

      setAiLiveCanvasEnabled(true);
      expect(getAgentGhostPreviewState().previews.some((preview) => preview.cells.length > 0)).toBe(true);
      bridge.dispose();
    });

    it("빈 증분은 아무것도 예약하지 않는다", () => {
      const base = seed();
      let applied = 0;
      const bridge = createPiGhostBridge({ baseProject: base, apply: () => { applied += 1; } });
      bridge.handleEvent({ type: "map_delta", maps: [] });
      bridge.flush();
      expect(applied).toBe(0);
      bridge.dispose();
    });
  });
});

// 승인 카드 제거 후에도 즉시 적용 경로의 soft-confirm 합의 훅이 동작하는지 고정한다.
describe("aiProposalSoftConfirm", () => {
  isolateTimers();
  describe("soft-confirm 자동 합의", () => {
    it("proposedCalls의 vocabSoftConfirm을 수집해 즉시 origin:user로 마킹한다", () => {
      const project = createEmptyToolProject();
      const tilesetId = Object.keys(project.tilesets)[0];
      const tileset = project.tilesets[tilesetId];
      tileset.tileGroups = [...(tileset.tileGroups ?? []), {
        id: "g-soft", name: "soft 재료", role: "prop", defaultLayer: "lower",
        tileIds: [5], description: "", placementRules: "", origin: "ai",
      } as never];
      const calls = [{
        name: "place_props", args: {},
        result: { ok: true, summary: "", data: { vocabSoftConfirm: {
          kind: "group", groupId: "g-soft", tileIds: [5], name: "soft 재료", role: "prop", layerHome: "lower", tilesetId,
        } } },
      }] as never;
      expect(collectVocabSoftConfirms(calls).length).toBe(1);
      const marked = markSoftVocabApprovalsOnProject(project, calls);
      expect(marked).toBe(1);
      expect(project.tilesets[tilesetId].tileGroups?.find((g) => g.id === "g-soft")?.origin).toBe("user");
    });
  });
});
