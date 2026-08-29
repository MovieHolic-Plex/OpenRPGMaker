import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/ai/assistantSession";
import { recordSupabaseConversation } from "@/project/supabaseProjectSync";
import {
  clearConversations,
  deleteConversation,
  deriveTitle,
  listConversations,
  loadConversation,
  saveConversation,
  searchConversations,
  type ConversationRecord,
} from "@/ai/conversationStore";

vi.mock("@/project/supabaseProjectSync", () => ({
  recordSupabaseConversation: vi.fn(),
}));

const recordSupabaseConversationMock = vi.mocked(recordSupabaseConversation);

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

function user(text: string): AuditEntry {
  return { kind: "user", text };
}

function assistant(text: string): AuditEntry {
  return { kind: "assistant", text };
}

function tool(name: string): AuditEntry {
  return { kind: "tool", name, args: {}, ok: true, summary: `${name} ok` };
}

function record(id: string, savedAt: number, entries: readonly AuditEntry[] = [user(`대화 ${id}`)]): ConversationRecord {
  return {
    id,
    title: deriveTitle(entries),
    model: "minimax/minimax-m3",
    savedAt,
    entries: [...entries],
  };
}

beforeEach(() => {
  recordSupabaseConversationMock.mockReset();
  recordSupabaseConversationMock.mockResolvedValue({ kind: "not-configured" });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("conversationStore", () => {
  it("Given saved conversations When listed Then summaries include turn counts and newest records first", () => {
    saveConversation(record("old", 100, [user("첫 번째 요청"), assistant("응답")]));
    saveConversation(record("new", 200, [assistant("준비"), user("두 번째 요청"), tool("create_map"), user("수정 요청")]));

    expect(listConversations()).toEqual([
      { id: "new", title: "두 번째 요청", model: "minimax/minimax-m3", savedAt: 200, turnCount: 2 },
      { id: "old", title: "첫 번째 요청", model: "minimax/minimax-m3", savedAt: 100, turnCount: 1 },
    ]);
  });

  it("Given an existing conversation id When saved again Then it replaces the record without a duplicate", () => {
    saveConversation(record("same", 100, [user("처음")]));
    saveConversation(record("same", 300, [user("교체됨"), assistant("응답")]));

    expect(listConversations()).toEqual([
      { id: "same", title: "교체됨", model: "minimax/minimax-m3", savedAt: 300, turnCount: 1 },
    ]);
  });

  it("Given a saved conversation When loaded Then entries roundtrip", () => {
    const saved = record("roundtrip", 123, [user("저장해줘"), assistant("저장했습니다"), tool("set_tile_metadata")]);

    saveConversation(saved);

    expect(loadConversation("roundtrip")).toEqual(saved);
  });

  it("Given saved conversations When one is deleted Then only the other remains", () => {
    saveConversation(record("keep", 200));
    saveConversation(record("delete", 300));

    deleteConversation("delete");

    expect(listConversations()).toEqual([
      { id: "keep", title: "대화 keep", model: "minimax/minimax-m3", savedAt: 200, turnCount: 1 },
    ]);
  });

  it("Given saved conversations When cleared Then the list is empty", () => {
    saveConversation(record("one", 100));
    saveConversation(record("two", 200));

    clearConversations();

    expect(listConversations()).toEqual([]);
  });

  it("Given more than 50 saved conversations When listed Then the oldest records are dropped", () => {
    for (let index = 1; index <= 55; index += 1) {
      saveConversation(record(`c${index}`, index));
    }

    const summaries = listConversations();

    expect(summaries).toHaveLength(50);
    expect(summaries[0].id).toBe("c55");
    expect(summaries.at(-1)?.id).toBe("c6");
    expect(loadConversation("c5")).toBeNull();
  });

  it("Given saved conversations When searched by title Then partial case-insensitive matches return", () => {
    saveConversation(record("a", 1, [user("마을에 집 지어줘")]));
    saveConversation(record("b", 2, [user("NPC Dialogue 수정")]));

    expect(searchConversations("집").map((conversation) => conversation.id)).toEqual(["a"]);
    expect(searchConversations("npc dialogue").map((conversation) => conversation.id)).toEqual(["b"]);
    expect(searchConversations("").map((conversation) => conversation.id)).toEqual(["b", "a"]);
    expect(searchConversations("없는검색어")).toHaveLength(0);
  });

  it("Given corrupted storage When listed Then it returns an empty list", () => {
    localStorage.setItem("oprn:ai-conversations", "{broken json");

    expect(listConversations()).toEqual([]);
  });

  it("Given audit entries When deriving a title Then it uses the first user text with a short fallback", () => {
    expect(deriveTitle([assistant("ignored"), user("   0123456789012345678901234567890123456789 beyond   ")])).toBe(
      "0123456789012345678901234567890123456789...",
    );
    expect(deriveTitle([assistant("no user")])).toBe("(빈 대화)");
    expect(deriveTitle([user("   ")])).toBe("(빈 대화)");
  });

  it("Given a machine-appended context footer When deriving a title Then only the human sentence survives", () => {
    // 이전 대화 목록의 모든 줄이 "… [컨텍스트] 현재 맵: 이슬 장터 마을 (…" 로 이어져 서로
    // 구별이 안 됐다(2026-08-30 실측). footer 는 패널이 붙이는 기계 텍스트라 제목에서 뺀다.
    expect(deriveTitle([user("우물을 놔줘\n\n[컨텍스트] 현재 맵: 이슬 장터 마을 (100x100)")])).toBe("우물을 놔줘");
    // footer 가 없으면 예전과 똑같이 동작한다.
    expect(deriveTitle([user("표지판을 세워줘")])).toBe("표지판을 세워줘");
  });

  it("Given Node without localStorage When functions are called Then they no-op safely", () => {
    Reflect.deleteProperty(globalThis, "localStorage");

    saveConversation(record("missing-storage", 100));
    deleteConversation("missing-storage");
    clearConversations();

    expect(listConversations()).toEqual([]);
    expect(loadConversation("missing-storage")).toBeNull();
  });

  it("Given a remote mirror failure When saving Then the failure is visible without losing the local record", async () => {
    const failure = new Error("missing ai_conversations migration");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    recordSupabaseConversationMock.mockRejectedValueOnce(failure);

    saveConversation(record("remote-failure", 400));
    await Promise.resolve();
    await Promise.resolve();

    expect(loadConversation("remote-failure")?.id).toBe("remote-failure");
    expect(consoleError).toHaveBeenCalledWith("[ai-conversation] Supabase mirror failed:", failure);
  });
});
