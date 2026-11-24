import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/ai/assistantSession";
import * as conversations from "@/ai/conversationStore";
import { clearConversations, CONVERSATION_TRIM_MARKER, deriveTitle, listConversations, saveConversation, type ConversationRecord, type ConversationSummary } from "@/ai/conversationStore";
import { resetAiRecordDbForTest } from "@/ai/aiRecordDb";
import { AI_HISTORY_ARCHIVE_PAGE_SIZE, closeAiConversationHistoryModal, filterConversationsByTitle, openAiConversationHistoryModal, sortConversationsForScope, whenAiConversationHistoryModalSettled } from "@/editor/panels/aiConversationHistoryModal";
import { findByTestId, installFakeDom, FakeElement } from "./fakeDom";
import { createConversationLogHost } from "@/editor/panels/aiConversationLog";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { RESTORED_TRANSCRIPT_MARKER, isRestoredTranscriptMessage, restoredTranscriptMessage, serializeAuditTranscript } from "@/ai/conversationReplay";
import { isolateTimers } from "./mergedTeardown";

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
