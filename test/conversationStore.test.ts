// test/conversationStore.test.ts
// 대화 기록 저장소 — IndexedDB(정본) + 레거시 localStorage 이관 + 압축·예산·무예외 계약.
//
// 실측 결함(2026-09-03): 대화 50건을 localStorage 한 키에 통째로 다시 쓰다 오리진 한도(약 5MB)를
// 넘겨 「오류: Failed to execute 'setItem' on 'Storage': … exceeded the quota.」 로 조수 턴이 끊겼다.
// 저장소를 IndexedDB 로 옮기고(레코드 단위 비동기 쓰기, 용량 수백 MB), 예전 키는 첫 접근에 이관한다.
// Node 에는 IndexedDB 가 없어 fake-indexeddb 로 실제 IDB 의미론을 돌린다.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { AuditEntry } from "@/ai/assistantSession";
import { resetAiRecordDbForTest } from "@/ai/aiRecordDb";
import type { MemoryRepository } from "@/project/persistence/memoryRepository";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";
import {
  CONVERSATION_ARGS_MAX_CHARS,
  CONVERSATION_MAX_RECORDS,
  CONVERSATION_RECORD_MAX_CHARS,
  CONVERSATION_TRIM_MARKER,
  LEGACY_CONVERSATION_STORAGE_KEY,
  clearConversations,
  deleteConversation,
  deriveTitle,
  listConversations,
  loadConversation,
  loadLatestConversationForScope,
  saveConversation,
  searchConversations,
  type ConversationRecord,
} from "@/ai/conversationStore";

// 원격 미러는 포트가 받는다. 예전에는 sync 모듈을 목킹했는데 그 목은 기본 어댑터가 LegacyDb 일 때만
// 살아 있었다 — 저장소를 심고 그 ai.recordConversation 을 본다.
let session: MemoryProjectSession | null = null;
let recordConversationSpy: MockInstance<MemoryRepository["ai"]["recordConversation"]> | null = null;

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalIndexedDb = globalThis.indexedDB;

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

function installStorage(storage: Storage): void {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
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
    model: "stub-model",
    savedAt,
    entries: [...entries],
  };
}

const bulkyArgs = (chars: number): Record<string, unknown> => ({
  mapId: "map_village",
  cells: Array.from({ length: Math.ceil(chars / 12) }, (_, index) => ({ x: index % 100, y: Math.floor(index / 100), t: 342 })),
});
const bulkyTool = (name: string, chars: number): AuditEntry => ({ kind: "tool", name, args: bulkyArgs(chars), ok: true, summary: `${name} 적용` });
const bulkyRecord = (id: string, savedAt: number, toolCalls: number, charsPerCall: number): ConversationRecord =>
  record(id, savedAt, [user(`대화 ${id}`), ...Array.from({ length: toolCalls }, (_, index) => bulkyTool(`place_${index}`, charsPerCall))]);

beforeEach(() => {
  session = installMemoryProjectSession();
  recordConversationSpy = vi.spyOn(session.repository.ai, "recordConversation");
  recordConversationSpy.mockResolvedValue({ kind: "not-configured" });
  installStorage(createMemoryStorage());
  // 테스트마다 새 IndexedDB 세계 — 연결 캐시와 이관 표식도 같이 리셋한다.
  globalThis.indexedDB = new IDBFactory();
  resetAiRecordDbForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
  session?.dispose();
  session = null;
  globalThis.indexedDB = originalIndexedDb;
  resetAiRecordDbForTest();
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("conversationStore", () => {
  it("Given saved conversations When listed Then summaries include turn counts and newest records first", async () => {
    await saveConversation(record("old", 100, [user("첫 번째 요청"), assistant("응답")]));
    await saveConversation(record("new", 200, [assistant("준비"), user("두 번째 요청"), tool("create_map"), user("수정 요청")]));

    // preview(마지막 조수/사용자 발화)는 데크(2026-09-03)에서 추가된 목록 필드다 — 여기서는 나머지 모양만 잠근다.
    expect((await listConversations()).map(({ preview: _preview, ...rest }) => rest)).toEqual([
      { id: "new", title: "두 번째 요청", model: "stub-model", savedAt: 200, turnCount: 2 },
      { id: "old", title: "첫 번째 요청", model: "stub-model", savedAt: 100, turnCount: 1 },
    ]);
  });

  it("Given an existing conversation id When saved again Then it replaces the record without a duplicate", async () => {
    await saveConversation(record("same", 100, [user("처음")]));
    await saveConversation(record("same", 300, [user("교체됨"), assistant("응답")]));

    expect((await listConversations()).map(({ preview: _preview, ...rest }) => rest)).toEqual([
      { id: "same", title: "교체됨", model: "stub-model", savedAt: 300, turnCount: 1 },
    ]);
  });

  it("Given a saved conversation When loaded Then entries roundtrip and the outcome says durable", async () => {
    const saved = record("roundtrip", 123, [user("저장해줘"), assistant("저장했습니다"), tool("set_tile_metadata")]);

    const outcome = await saveConversation(saved);

    expect(outcome).toEqual({ ok: true, durable: true, evicted: 0 });
    expect(await loadConversation("roundtrip")).toMatchObject(saved);
  });

  it("Given a tool audit with reason When saved Then local load and remote payload keep the reason", async () => {
    const withReason: AuditEntry = {
      kind: "tool",
      name: "tile_erase",
      args: { mapId: "map_hub" },
      ok: true,
      summary: "754칸",
      reason: "다음에 author_village 를 찍을 자리를 비운다",
    };
    await saveConversation(record("reason", 400, [user("검토해줘"), withReason]));
    expect((await loadConversation("reason"))?.entries).toEqual([user("검토해줘"), withReason]);
    const remote = recordConversationSpy!.mock.calls.at(-1)?.[0] as { entries?: AuditEntry[] } | undefined;
    expect(remote?.entries).toEqual([user("검토해줘"), withReason]);
  });

  it("Given saved conversations When one is deleted Then only the other remains", async () => {
    await saveConversation(record("keep", 200));
    await saveConversation(record("delete", 300));

    await deleteConversation("delete");

    expect((await listConversations()).map(({ preview: _preview, ...rest }) => rest)).toEqual([
      { id: "keep", title: "대화 keep", model: "stub-model", savedAt: 200, turnCount: 1 },
    ]);
  });

  it("Given the only saved conversation When deleted Then the list is empty and stays empty after reopening", async () => {
    await saveConversation(record("only", 100));

    await deleteConversation("only");

    expect(await listConversations()).toEqual([]);
    resetAiRecordDbForTest(); // 연결을 끊고 다시 열어도(새로 고침) 지운 것이 되살아나지 않는다.
    expect(await listConversations()).toEqual([]);
  });

  it("Given saved conversations When cleared Then the list is empty", async () => {
    await saveConversation(record("one", 100));
    await saveConversation(record("two", 200));

    await clearConversations();

    expect(await listConversations()).toEqual([]);
  });

  it("Given more than the recent cap When saved Then older records remain loadable and no eviction is reported", async () => {
    let last = await saveConversation(record("c1", 1));
    for (let index = 2; index <= CONVERSATION_MAX_RECORDS + 5; index += 1) last = await saveConversation(record(`c${index}`, index));

    const summaries = await listConversations();

    expect(summaries).toHaveLength(CONVERSATION_MAX_RECORDS);
    expect(summaries[0]!.id).toBe(`c${CONVERSATION_MAX_RECORDS + 5}`);
    expect(summaries.at(-1)?.id).toBe("c6");
    expect((await loadConversation("c5"))?.id).toBe("c5");
    expect(last).toEqual({ ok: true, durable: true, evicted: 0 });
  });

  it("Given saved conversations When searched by title Then partial case-insensitive matches return", async () => {
    await saveConversation(record("a", 1, [user("마을에 집 지어줘")]));
    await saveConversation(record("b", 2, [user("NPC Dialogue 수정")]));

    expect((await searchConversations("집")).map((conversation) => conversation.id)).toEqual(["a"]);
    expect((await searchConversations("npc dialogue")).map((conversation) => conversation.id)).toEqual(["b"]);
    expect((await searchConversations("")).map((conversation) => conversation.id)).toEqual(["b", "a"]);
    expect(await searchConversations("없는검색어")).toHaveLength(0);
  });

  it("Given audit entries When deriving a title Then it uses the first user text with a short fallback", () => {
    expect(deriveTitle([assistant("ignored"), user("   0123456789012345678901234567890123456789 beyond   ")])).toBe(
      "0123456789012345678901234567890123456789...",
    );
    expect(deriveTitle([assistant("no user")])).toBe("(빈 대화)");
    expect(deriveTitle([user("   ")])).toBe("(빈 대화)");
  });

  it("Given a machine-appended context footer When deriving a title Then only the human sentence survives", () => {
    expect(deriveTitle([user("우물을 놔줘\n\n[컨텍스트] 현재 맵: 이슬 장터 마을 (100x100)")])).toBe("우물을 놔줘");
    expect(deriveTitle([user("표지판을 세워줘")])).toBe("표지판을 세워줘");
  });

  it("Given a remote mirror failure When saving Then the failure is visible without losing the local record", async () => {
    const failure = new Error("missing ai_conversations migration");
    const failureReported = new Promise<void>(resolve => {
      vi.spyOn(console, "error").mockImplementation(() => resolve());
    });
    recordConversationSpy!.mockRejectedValueOnce(failure);

    await saveConversation(record("remote-failure", 400));
    await failureReported;

    expect((await loadConversation("remote-failure"))?.id).toBe("remote-failure");
    expect(console.error).toHaveBeenCalledWith("[ai-conversation] LegacyDb mirror failed:", failure);
  });
});

describe("loadLatestConversationForScope", () => {
  it("남의 프로젝트 대화가 더 최근이어도 내 범위의 최신을 돌려준다", async () => {
    await saveConversation({ ...record("conv_mine_old", 100), projectContextKey: "remote:mine" });
    await saveConversation({ ...record("conv_mine_new", 200), projectContextKey: "remote:mine" });
    await saveConversation({ ...record("conv_other", 999), projectContextKey: "remote:other" });

    expect((await loadLatestConversationForScope("remote:mine"))?.id).toBe("conv_mine_new");
    expect((await loadLatestConversationForScope("remote:other"))?.id).toBe("conv_other");
  });

  it("범위에 저장본이 없으면 null 이다 — 남의 대화를 끌어오지 않는다", async () => {
    await saveConversation({ ...record("conv_other", 999), projectContextKey: "remote:other" });
    expect(await loadLatestConversationForScope("remote:mine")).toBeNull();
  });

  it("저장 순서가 흐트러져도 savedAt 최댓값을 고른다", async () => {
    await saveConversation({ ...record("conv_new", 500), projectContextKey: "remote:mine" });
    await saveConversation({ ...record("conv_old", 100), projectContextKey: "remote:mine" });
    expect((await loadLatestConversationForScope("remote:mine"))?.id).toBe("conv_new");
  });
});

// ── 레거시 localStorage 이관 ───────────────────────────────────────────────────────────────
describe("conversationStore — 레거시 localStorage 이관", () => {
  it("Given 옛 키에 부풀린 대화 3건 When 처음 읽는다 Then IndexedDB 로 옮기며 인자를 압축하고 옛 키를 지운다", async () => {
    const legacy = [bulkyRecord("legacy_c", 3, 10, 20_000), bulkyRecord("legacy_b", 2, 10, 20_000), bulkyRecord("legacy_a", 1, 10, 20_000)];
    const seeded = JSON.stringify(legacy);
    expect(seeded.length).toBeGreaterThan(300_000);
    localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, seeded);

    expect((await listConversations()).map((conversation) => conversation.id)).toEqual(["legacy_c", "legacy_b", "legacy_a"]);
    expect(localStorage.getItem(LEGACY_CONVERSATION_STORAGE_KEY)).toBeNull();
    const migrated = (await loadConversation("legacy_a"))!;
    const firstTool = migrated.entries[1];
    expect(firstTool.kind).toBe("tool");
    if (firstTool.kind !== "tool") return;
    expect(firstTool.args._truncated).toBe(true);
    expect(JSON.stringify(migrated).length).toBeLessThan(40_000);
  });

  it("Given 옛 키가 다시 심어졌다(e2e 시드·QA 스크립트) When 다시 읽는다 Then 같은 id 는 중복되지 않고 최신 savedAt 이 남는다", async () => {
    localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([record("seed", 100, [user("시드 1")])]));
    expect((await listConversations()).map((conversation) => conversation.id)).toEqual(["seed"]);
    await saveConversation(record("seed", 200, [user("시드 1"), assistant("응답")]));

    // 새로 고침을 흉내낸다: 연결을 끊고, e2e addInitScript 처럼 옛 키를 다시 심는다.
    resetAiRecordDbForTest();
    localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([record("seed", 100, [user("시드 1")])]));

    const summaries = await listConversations();
    expect(summaries.map((conversation) => conversation.id)).toEqual(["seed"]);
    expect(summaries[0]!.savedAt).toBe(200);
    expect((await loadConversation("seed"))?.entries).toHaveLength(2);
  });

  it("Given 옛 키가 깨진 JSON 이다 When 읽는다 Then 무시하고 빈 목록이며 키는 정리된다", async () => {
    localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, "{broken json");

    expect(await listConversations()).toEqual([]);
    expect(localStorage.getItem(LEGACY_CONVERSATION_STORAGE_KEY)).toBeNull();
  });
});

// ── 압축 ─────────────────────────────────────────────────────────────────────────────────
describe("conversationStore — 압축", () => {
  it("Given 인자가 큰 툴콜 When 저장한다 Then 인자는 미리보기로 잘리고 작은 인자와 요약·이유는 그대로다", async () => {
    const small: AuditEntry = { kind: "tool", name: "place_npc", args: { mapId: "map_hub", x: 3, y: 4, name: "상인" }, ok: true, summary: "NPC 1명", reason: "시장 입구" };
    const big = bulkyTool("paint_cells", CONVERSATION_ARGS_MAX_CHARS * 4);
    const assistantWithCalls: AuditEntry = {
      kind: "assistant",
      text: "칸을 채웁니다.",
      toolCalls: [
        { name: "place_npc", args: JSON.stringify(small.kind === "tool" ? small.args : {}) },
        { name: "paint_cells", args: "x".repeat(CONVERSATION_ARGS_MAX_CHARS * 3) },
      ],
    };

    await saveConversation(record("clip", 5, [user("채워줘"), assistantWithCalls, small, big]));

    const stored = (await loadConversation("clip"))!;
    expect(stored.entries[2]).toEqual(small);
    const storedBig = stored.entries[3]!;
    expect(storedBig.kind).toBe("tool");
    if (storedBig.kind !== "tool") return;
    expect(storedBig.name).toBe("paint_cells");
    expect(storedBig.summary).toBe("paint_cells 적용");
    expect(storedBig.args._truncated).toBe(true);
    expect(typeof storedBig.args.preview).toBe("string");
    expect(JSON.stringify(storedBig.args).length).toBeLessThanOrEqual(CONVERSATION_ARGS_MAX_CHARS + 64);
    const storedAssistant = stored.entries[1]!;
    expect(storedAssistant.kind).toBe("assistant");
    if (storedAssistant.kind !== "assistant") return;
    expect(storedAssistant.text).toBe("칸을 채웁니다.");
    expect(storedAssistant.toolCalls?.[0]).toEqual(assistantWithCalls.kind === "assistant" ? assistantWithCalls.toolCalls?.[0] : undefined);
    expect(storedAssistant.toolCalls?.[1]?.args.length).toBeLessThanOrEqual(CONVERSATION_ARGS_MAX_CHARS + 1);
  });

  it("Given 레코드 하나가 예산을 넘는 긴 대화 When 저장한다 Then 머리와 꼬리를 남기고 가운데를 표식 하나로 접는다", async () => {
    const line = (index: number): AuditEntry => user(`${index}번째 요청 ${"가".repeat(1_000)}`);
    const entries = Array.from({ length: Math.ceil((CONVERSATION_RECORD_MAX_CHARS * 2) / 1_000) }, (_, index) => line(index));
    const last = entries.length - 1;

    const outcome = await saveConversation(record("long", 7, entries));

    expect(outcome.ok).toBe(true);
    const stored = (await loadConversation("long"))!;
    expect(JSON.stringify(stored.entries).length).toBeLessThanOrEqual(CONVERSATION_RECORD_MAX_CHARS + 1_200);
    expect(stored.entries[0]).toEqual(line(0));
    expect(stored.entries.at(-1)).toEqual(line(last));
    const markers = stored.entries.filter((entry) => entry.kind === "status" && entry.text.startsWith(CONVERSATION_TRIM_MARKER));
    expect(markers).toHaveLength(1);
    const dropped = entries.length - (stored.entries.length - 1);
    expect(markers[0]!.kind === "status" ? markers[0]!.text : "").toContain(String(dropped));

    await saveConversation(record("long", 8, [...stored.entries, line(last + 1), line(last + 2)]));
    const again = (await loadConversation("long"))!;
    const markersAgain = again.entries.filter((entry) => entry.kind === "status" && entry.text.startsWith(CONVERSATION_TRIM_MARKER));
    expect(markersAgain).toHaveLength(1);
    expect(again.entries.at(-1)).toEqual(line(last + 2));
    expect(again.entries[0]).toEqual(line(0));
  });

  it("Given 인자가 큰 툴콜 When 저장한다 Then 원격 미러도 로컬과 같은 압축본을 받는다", async () => {
    await saveConversation(record("mirror", 3, [user("미러"), bulkyTool("paint_cells", CONVERSATION_ARGS_MAX_CHARS * 4)]));

    const remote = recordConversationSpy!.mock.calls.at(-1)?.[0] as { entries?: AuditEntry[] } | undefined;
    const remoteTool = remote?.entries?.[1];
    expect(remoteTool?.kind).toBe("tool");
    if (remoteTool?.kind !== "tool") return;
    expect(remoteTool.args._truncated).toBe(true);
    expect(remote?.entries).toEqual((await loadConversation("mirror"))?.entries);
  });
});

// ── 저장소가 없거나 고장났을 때 ─────────────────────────────────────────────────────────────
describe("conversationStore — 폴백", () => {
  it("Given IndexedDB 가 없는 환경(Node) When 저장·조회한다 Then 던지지 않고 메모리에서 동작하며 durable:false 를 돌려준다", async () => {
    Reflect.deleteProperty(globalThis, "indexedDB");
    resetAiRecordDbForTest();

    const outcome = await saveConversation(record("memory-only", 100));

    expect(outcome).toEqual({ ok: true, durable: false, evicted: 0 });
    expect((await loadConversation("memory-only"))?.id).toBe("memory-only");
    await deleteConversation("memory-only");
    await clearConversations();
    expect(await listConversations()).toEqual([]);
  });

  it("Given IndexedDB 열기가 실패한다(프라이빗 모드 등) When 저장한다 Then 메모리로 내려가고 경고는 한 번만 찍는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const broken = { open: () => { throw new Error("InvalidStateError: A mutation operation was attempted on a database that did not allow mutations."); } };
    globalThis.indexedDB = broken as unknown as IDBFactory;
    resetAiRecordDbForTest();

    const first = await saveConversation(record("broken_1", 1));
    const second = await saveConversation(record("broken_2", 2));

    expect(first).toEqual({ ok: true, durable: false, evicted: 0 });
    expect(second.durable).toBe(false);
    expect((await listConversations()).map((conversation) => conversation.id)).toEqual(["broken_2", "broken_1"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("[ai-records]");
  });

  it("Given Node without localStorage When the store is used Then legacy migration is skipped safely", async () => {
    Reflect.deleteProperty(globalThis, "localStorage");

    await saveConversation(record("missing-storage", 100));
    expect((await loadConversation("missing-storage"))?.id).toBe("missing-storage");
    await deleteConversation("missing-storage");
    await clearConversations();
    expect(await listConversations()).toEqual([]);
  });
});

describe("listConversations 미리보기 (데크 2026-09-03)", () => {
  it("마지막 조수 발화를 80자 안으로 잘라 preview 로 준다 — 없으면 마지막 사용자 발화", async () => {
    // Break: 이전 대화 목록이 제목·날짜·턴 수만 보여 어느 대화인지 고를 근거가 없다.
    await saveConversation({
      id: "conv_preview",
      title: "광장",
      model: "m",
      savedAt: 10,
      projectContextKey: "local:x::m1",
      entries: [
        { kind: "user", text: "우물 놓아줘" },
        { kind: "assistant", text: "광장 북쪽 (24,11) 에 우물을 놓았습니다. " + "다음으로 상점 창을 붙일까요? ".repeat(6) },
      ],
    });
    await saveConversation({
      id: "conv_preview_user_only",
      title: "질문만",
      model: "m",
      savedAt: 20,
      projectContextKey: "local:x::m1",
      entries: [{ kind: "user", text: "이 맵에 상점이 몇 개야?" }],
    });
    const rows = await listConversations();
    const withAssistant = rows.find((row) => row.id === "conv_preview");
    expect(withAssistant?.preview?.startsWith("광장 북쪽 (24,11) 에 우물을 놓았습니다.")).toBe(true);
    expect((withAssistant?.preview ?? "").length).toBeLessThanOrEqual(81);
    expect(withAssistant?.preview?.endsWith("…")).toBe(true);
    expect(rows.find((row) => row.id === "conv_preview_user_only")?.preview).toBe("이 맵에 상점이 몇 개야?");
  });
});
