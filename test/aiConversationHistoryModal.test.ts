// test/aiConversationHistoryModal.test.ts
// 저장된 대화 목록 모달 — 정렬/검색 순수 함수 + 목록 렌더/열기/삭제.
//
// 이 모달이 없던 동안 `loadConversation`/`searchConversations` 는 호출 지점이 0 인 죽은 코드였다
// (저장 쪽은 매 턴 돌고 있었다). 그래서 여기서 잠그는 첫 계약은 "행을 누르면 record 가
// 호출자에게 간다" 다 — 그것이 이어가기의 유일한 입구다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/ai/assistantSession";
import {
  clearConversations,
  deriveTitle,
  listConversations,
  saveConversation,
  type ConversationRecord,
  type ConversationSummary,
} from "@/ai/conversationStore";
import {
  closeAiConversationHistoryModal,
  filterConversationsByTitle,
  openAiConversationHistoryModal,
  sortConversationsForScope,
} from "@/editor/panels/aiConversationHistoryModal";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/project/supabaseProjectSync", () => ({
  recordSupabaseConversation: vi.fn(async () => undefined),
}));

let restoreDom: (() => void) | null = null;
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

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

function record(id: string, savedAt: number, scope?: string, text = `지시 ${id}`): ConversationRecord {
  const entries: AuditEntry[] = [{ kind: "user", text }];
  return {
    id,
    title: deriveTitle(entries),
    model: "m",
    savedAt,
    entries,
    ...(scope === undefined ? {} : { projectContextKey: scope }),
  };
}

beforeEach(() => {
  installMemoryStorage();
  clearConversations();
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
  it("Given 저장된 대화 2건 When 열기 Then 행 2개가 최근 순으로 렌더된다", () => {
    saveConversation(record("old", 1_000, "mine", "오래된 지시"));
    saveConversation(record("new", 2_000, "mine", "최근 지시"));

    const backdrop = openAiConversationHistoryModal({
      scopeKey: "mine",
      currentConversationId: "none",
      onOpen: () => undefined,
    }) as unknown as FakeElement;

    const list = findByTestId(backdrop, "ai-history-list")!;
    const rows = list.querySelectorAll("[data-testid=ai-history-row]");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("최근 지시");
  });

  it("Given 저장된 대화 없음 When 열기 Then 빈 상태 문장이 온다", () => {
    const backdrop = openAiConversationHistoryModal({
      scopeKey: "mine",
      currentConversationId: "none",
      onOpen: () => undefined,
    }) as unknown as FakeElement;

    expect(findByTestId(backdrop, "ai-history-empty")!.textContent).toBe("저장된 대화가 없습니다.");
  });

  it("Given 행 클릭 When 열기 Then 기록 전체(record)가 호출자에게 전달되고 모달이 닫힌다", () => {
    saveConversation(record("target", 1_000, "mine", "우물을 놔줘"));
    const opened: ConversationRecord[] = [];
    const backdrop = openAiConversationHistoryModal({
      scopeKey: "mine",
      currentConversationId: "none",
      onOpen: (row) => opened.push(row),
    }) as unknown as FakeElement;

    (findByTestId(backdrop, "ai-history-open") as unknown as HTMLElement).click();

    expect(opened).toHaveLength(1);
    expect(opened[0]!.id).toBe("target");
    expect(opened[0]!.entries[0]).toMatchObject({ kind: "user", text: "우물을 놔줘" });
    expect(backdrop.parentElement).toBeNull();
  });

  it("Given 지금 열려 있는 대화 When 렌더 Then 「현재」로 표시하고 클릭을 무시한다", () => {
    saveConversation(record("current", 1_000, "mine"));
    const opened: ConversationRecord[] = [];
    const backdrop = openAiConversationHistoryModal({
      scopeKey: "mine",
      currentConversationId: "current",
      onOpen: (row) => opened.push(row),
    }) as unknown as FakeElement;

    const open = findByTestId(backdrop, "ai-history-open")!;
    expect(open.getAttribute("aria-disabled")).toBe("true");
    expect(open.textContent).toContain("현재");
    (open as unknown as HTMLElement).click();
    expect(opened).toHaveLength(0);
  });

  it("Given 다른 프로젝트의 대화 When 렌더 Then 꼬리표를 달지만 열기를 막지는 않는다", () => {
    saveConversation(record("foreign", 1_000, "other"));
    const backdrop = openAiConversationHistoryModal({
      scopeKey: "mine",
      currentConversationId: "none",
      onOpen: () => undefined,
    }) as unknown as FakeElement;

    const open = findByTestId(backdrop, "ai-history-open")!;
    expect(open.textContent).toContain("다른 프로젝트");
    expect(open.getAttribute("aria-disabled")).toBeNull();
  });

  it("Given 삭제 클릭 When 목록 갱신 Then 저장소에서도 지워진다", () => {
    saveConversation(record("doomed", 1_000, "mine"));
    const backdrop = openAiConversationHistoryModal({
      scopeKey: "mine",
      currentConversationId: "none",
      onOpen: () => undefined,
    }) as unknown as FakeElement;

    (findByTestId(backdrop, "ai-history-delete") as unknown as HTMLElement).click();

    expect(listConversations()).toHaveLength(0);
    expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
  });

  it("Given 검색어 입력 When 목록 갱신 Then 제목이 맞는 행만 남는다", () => {
    saveConversation(record("a", 1_000, "mine", "우물 배치"));
    saveConversation(record("b", 2_000, "mine", "상점 배치"));
    const backdrop = openAiConversationHistoryModal({
      scopeKey: "mine",
      currentConversationId: "none",
      onOpen: () => undefined,
    }) as unknown as FakeElement;
    const search = findByTestId(backdrop, "ai-history-search") as unknown as HTMLInputElement & FakeElement;

    search.value = "우물";
    search.dispatchEvent(new Event("input"));

    const rows = findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain("우물");
  });
});
