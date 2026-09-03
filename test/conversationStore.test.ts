import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/ai/assistantSession";
import { recordSupabaseConversation } from "@/project/supabaseProjectSync";
import {
  CONVERSATION_ARGS_MAX_CHARS,
  CONVERSATION_RECORD_MAX_CHARS,
  CONVERSATION_STORE_MAX_CHARS,
  CONVERSATION_TRIM_MARKER,
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

vi.mock("@/project/supabaseProjectSync", () => ({
  recordSupabaseConversation: vi.fn(),
}));

const recordSupabaseConversationMock = vi.mocked(recordSupabaseConversation);

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

/** 브라우저처럼 오리진 총량(글자 수)을 넘는 setItem 을 QuotaExceededError 로 거절하는 메모리 Storage. */
function createMemoryStorage(options: { readonly maxChars?: number; readonly rejectAll?: boolean } = {}): Storage {
  const values = new Map<string, string>();
  const usedChars = (): number => Array.from(values.entries()).reduce((sum, [key, value]) => sum + key.length + value.length, 0);
  const quotaError = (key: string): Error => {
    const message = `Failed to execute 'setItem' on 'Storage': Setting the value of '${key}' exceeded the quota.`;
    if (typeof DOMException !== "undefined") return new DOMException(message, "QuotaExceededError");
    const error = new Error(message);
    error.name = "QuotaExceededError";
    return error;
  };
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => {
      if (options.rejectAll) throw quotaError(key);
      if (options.maxChars !== undefined) {
        const next = usedChars() - (values.get(key)?.length ?? 0) - (values.has(key) ? key.length : 0) + key.length + value.length;
        if (next > options.maxChars) throw quotaError(key);
      }
      values.set(key, value);
    },
  };
}

/** 한도 있는 저장소에 옛 코드가 남긴(한도를 넘는) 값을 미리 심는다 — 브라우저에 이미 쌓인 레거시를 흉내낸다. */
function createMemoryStorageWithSeed(options: { readonly maxChars: number }, seed: Readonly<Record<string, string>>): Storage {
  const storage = createMemoryStorage();
  for (const [key, value] of Object.entries(seed)) storage.setItem(key, value);
  const constrained = createMemoryStorage(options);
  return {
    get length() {
      return storage.length;
    },
    clear: () => storage.clear(),
    getItem: (key: string) => storage.getItem(key),
    key: (index: number) => storage.key(index),
    removeItem: (key: string) => storage.removeItem(key),
    setItem: (key: string, value: string) => {
      constrained.setItem(key, value); // 한도 검사만 빌린다.
      storage.setItem(key, value);
    },
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

    // preview(마지막 조수/사용자 발화)는 데크(2026-09-03)에서 추가된 목록 필드다 — 여기서는 나머지 모양만 잠근다.
    expect(listConversations().map(({ preview: _preview, ...rest }) => rest)).toEqual([
      { id: "new", title: "두 번째 요청", model: "stub-model", savedAt: 200, turnCount: 2 },
      { id: "old", title: "첫 번째 요청", model: "stub-model", savedAt: 100, turnCount: 1 },
    ]);
  });

  it("Given an existing conversation id When saved again Then it replaces the record without a duplicate", () => {
    saveConversation(record("same", 100, [user("처음")]));
    saveConversation(record("same", 300, [user("교체됨"), assistant("응답")]));

    expect(listConversations().map(({ preview: _preview, ...rest }) => rest)).toEqual([
      { id: "same", title: "교체됨", model: "stub-model", savedAt: 300, turnCount: 1 },
    ]);
  });

  it("Given a saved conversation When loaded Then entries roundtrip", () => {
    const saved = record("roundtrip", 123, [user("저장해줘"), assistant("저장했습니다"), tool("set_tile_metadata")]);

    saveConversation(saved);

    expect(loadConversation("roundtrip")).toEqual(saved);
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
    saveConversation(record("reason", 400, [user("검토해줘"), withReason]));
    expect(loadConversation("reason")?.entries).toEqual([user("검토해줘"), withReason]);
    await Promise.resolve();
    const remote = recordSupabaseConversationMock.mock.calls.at(-1)?.[0] as { entries?: AuditEntry[] } | undefined;
    expect(remote?.entries).toEqual([user("검토해줘"), withReason]);
  });

  it("Given saved conversations When one is deleted Then only the other remains", () => {
    saveConversation(record("keep", 200));
    saveConversation(record("delete", 300));

    deleteConversation("delete");

    expect(listConversations().map(({ preview: _preview, ...rest }) => rest)).toEqual([
      { id: "keep", title: "대화 keep", model: "stub-model", savedAt: 200, turnCount: 1 },
    ]);
  });

  it("Given the only saved conversation When deleted Then storage holds an empty list, not the stale record", () => {
    // 회귀 방어(2026-09-03): 예산 재시도 루프가 «쓸 레코드가 없으면 쓰지 않는» 형태였다면 마지막 삭제가 되돌아온다.
    saveConversation(record("only", 100));

    deleteConversation("only");

    expect(listConversations()).toEqual([]);
    expect(localStorage.getItem("oprn:ai-conversations")).toBe("[]");
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

describe("loadLatestConversationForScope", () => {
  // 왜 전역 최신(loadLatestConversation)으로는 안 되는가: 두 프로젝트를 번갈아 열면 남의
  // 프로젝트 대화가 더 최근이라, 내 대화가 그대로 있는데도 부팅 복원이 포기됐다 — 사용자에게는
  // 누르지도 않은 "새 세션 강요" 로 보인다.
  it("남의 프로젝트 대화가 더 최근이어도 내 범위의 최신을 돌려준다", () => {
    saveConversation({ ...record("conv_mine_old", 100), projectContextKey: "remote:mine" });
    saveConversation({ ...record("conv_mine_new", 200), projectContextKey: "remote:mine" });
    saveConversation({ ...record("conv_other", 999), projectContextKey: "remote:other" });

    expect(loadLatestConversationForScope("remote:mine")?.id).toBe("conv_mine_new");
    expect(loadLatestConversationForScope("remote:other")?.id).toBe("conv_other");
  });

  it("범위에 저장본이 없으면 null 이다 — 남의 대화를 끌어오지 않는다", () => {
    saveConversation({ ...record("conv_other", 999), projectContextKey: "remote:other" });
    expect(loadLatestConversationForScope("remote:mine")).toBeNull();
  });

  it("저장 순서가 흐트러져도 savedAt 최댓값을 고른다", () => {
    saveConversation({ ...record("conv_new", 500), projectContextKey: "remote:mine" });
    saveConversation({ ...record("conv_old", 100), projectContextKey: "remote:mine" });
    expect(loadLatestConversationForScope("remote:mine")?.id).toBe("conv_new");
  });
});

// ── 저장 용량 ────────────────────────────────────────────────────────────────────────────
// 실측 결함(2026-09-03): 조수를 쓰다 「오류: Failed to execute 'setItem' on 'Storage': Setting the
// value of 'oprn:ai-conversations' exceeded the quota.」 가 말풍선으로 떴다. 대화 50건을 통째로
// localStorage 에 쓰는데 툴콜 인자(맵 셀 배열 등)가 assistant 항목(문자열)과 tool 항목(객체)에
// 두 번 들어가 오리진 한도(약 5MB)를 넘겼고, 저장이 툴콜 스트리밍 도중에 던져 턴 자체가 끊겼다.
describe("conversationStore — 저장 용량", () => {
  const bulkyArgs = (chars: number): Record<string, unknown> => ({
    mapId: "map_village",
    cells: Array.from({ length: Math.ceil(chars / 12) }, (_, index) => ({ x: index % 100, y: Math.floor(index / 100), t: 342 })),
  });
  const bulkyTool = (name: string, chars: number): AuditEntry => ({ kind: "tool", name, args: bulkyArgs(chars), ok: true, summary: `${name} 적용` });
  const bulkyRecord = (id: string, savedAt: number, toolCalls: number, charsPerCall: number): ConversationRecord =>
    record(id, savedAt, [user(`대화 ${id}`), ...Array.from({ length: toolCalls }, (_, index) => bulkyTool(`place_${index}`, charsPerCall))]);
  const storedJson = (): string => localStorage.getItem("oprn:ai-conversations") ?? "";

  it("Given 저장 공간이 이미 부풀린 레코드로 가득 찼다 When 새 턴이 대화를 저장한다 Then 던지지 않고 기존 레코드까지 압축해 전부 살린다", () => {
    // 옛 코드가 남긴 원본: 레거시 3건 × 10 툴콜 × 20K 인자 ≈ 600K 글자. 브라우저 한도는 300K.
    // 고치기 전 코드는 (레거시 + 새 레코드) 를 통째로 쓰다 여기서 QuotaExceededError 를 던졌다.
    // 저장 배열은 최신이 앞이다(saveConversation 이 prepend) — 실제 브라우저에 남은 모양대로 심는다.
    const legacy = [bulkyRecord("legacy_c", 3, 10, 20_000), bulkyRecord("legacy_b", 2, 10, 20_000), bulkyRecord("legacy_a", 1, 10, 20_000)];
    const seeded = JSON.stringify(legacy);
    expect(seeded.length).toBeGreaterThan(300_000);
    installStorage(createMemoryStorageWithSeed({ maxChars: 300_000 }, { "oprn:ai-conversations": seeded }));

    const outcome = saveConversation(record("fresh", 10, [user("새 요청"), bulkyTool("place_fresh", 20_000)]));

    expect(outcome.ok).toBe(true);
    expect(outcome.evicted).toBe(0);
    expect(loadConversation("fresh")?.entries[0]).toEqual(user("새 요청"));
    expect(listConversations().map((conversation) => conversation.id)).toEqual(["fresh", "legacy_c", "legacy_b", "legacy_a"]);
    expect(storedJson().length).toBeLessThanOrEqual(300_000);
  });

  it("Given 인자가 큰 툴콜 When 저장한다 Then 인자는 미리보기로 잘리고 작은 인자와 요약·이유는 그대로다", () => {
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

    saveConversation(record("clip", 5, [user("채워줘"), assistantWithCalls, small, big]));

    const stored = loadConversation("clip")!;
    expect(stored.entries[2]).toEqual(small);
    const storedBig = stored.entries[3];
    expect(storedBig.kind).toBe("tool");
    if (storedBig.kind !== "tool") return;
    expect(storedBig.name).toBe("paint_cells");
    expect(storedBig.summary).toBe("paint_cells 적용");
    expect(storedBig.args._truncated).toBe(true);
    expect(typeof storedBig.args.preview).toBe("string");
    expect(JSON.stringify(storedBig.args).length).toBeLessThanOrEqual(CONVERSATION_ARGS_MAX_CHARS + 64);
    const storedAssistant = stored.entries[1];
    expect(storedAssistant.kind).toBe("assistant");
    if (storedAssistant.kind !== "assistant") return;
    expect(storedAssistant.text).toBe("칸을 채웁니다.");
    expect(storedAssistant.toolCalls?.[0]).toEqual(assistantWithCalls.kind === "assistant" ? assistantWithCalls.toolCalls?.[0] : undefined);
    expect(storedAssistant.toolCalls?.[1]?.args.length).toBeLessThanOrEqual(CONVERSATION_ARGS_MAX_CHARS + 1);
  });

  it("Given 레코드 하나가 예산을 넘는 긴 대화 When 저장한다 Then 머리와 꼬리를 남기고 가운데를 표식 하나로 접는다", () => {
    const line = (index: number): AuditEntry => user(`${index}번째 요청 ${"가".repeat(1_000)}`);
    const entries = Array.from({ length: Math.ceil((CONVERSATION_RECORD_MAX_CHARS * 2) / 1_000) }, (_, index) => line(index));
    const last = entries.length - 1;

    const outcome = saveConversation(record("long", 7, entries));

    expect(outcome.ok).toBe(true);
    const stored = loadConversation("long")!;
    expect(JSON.stringify(stored.entries).length).toBeLessThanOrEqual(CONVERSATION_RECORD_MAX_CHARS + 1_200);
    expect(stored.entries[0]).toEqual(line(0)); // 머리(첫 발화)는 남는다.
    expect(stored.entries.at(-1)).toEqual(line(last)); // 꼬리(최근)는 남는다.
    const markers = stored.entries.filter((entry) => entry.kind === "status" && entry.text.startsWith(CONVERSATION_TRIM_MARKER));
    expect(markers).toHaveLength(1);
    const dropped = entries.length - (stored.entries.length - 1);
    expect(markers[0]!.kind === "status" ? markers[0]!.text : "").toContain(String(dropped));

    // 다시 저장하면(복원된 기록 + 새 턴) 표식이 쌓이지 않고 하나로 누적된다.
    saveConversation(record("long", 8, [...stored.entries, line(last + 1), line(last + 2)]));
    const again = loadConversation("long")!;
    const markersAgain = again.entries.filter((entry) => entry.kind === "status" && entry.text.startsWith(CONVERSATION_TRIM_MARKER));
    expect(markersAgain).toHaveLength(1);
    expect(again.entries.at(-1)).toEqual(line(last + 2));
    expect(again.entries[0]).toEqual(line(0));
  });

  it("Given 대화들이 저장소 예산을 넘는다 When 저장한다 Then 최신부터 예산 안에 담고 나머지는 밀어내며 그 수를 돌려준다", () => {
    // 레코드당 약 150K → 10건이면 1.5M 로 예산(1M)을 넘는다. 툴콜 인자는 작게 여러 개(잘리지 않게).
    const perRecord = Math.floor(CONVERSATION_STORE_MAX_CHARS * 0.15);
    const smallArgsCalls = Math.ceil(perRecord / 600);
    const heavy = (id: string, savedAt: number): ConversationRecord =>
      record(id, savedAt, [user(`대화 ${id}`), ...Array.from({ length: smallArgsCalls }, (_, index) => bulkyTool(`t${index}`, 500))]);
    let lastOutcome = saveConversation(heavy("r1", 1));
    for (let index = 2; index <= 10; index += 1) lastOutcome = saveConversation(heavy(`r${index}`, index));

    const ids = listConversations().map((conversation) => conversation.id);
    expect(ids[0]).toBe("r10");
    expect(ids.length).toBeLessThan(10);
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(storedJson().length).toBeLessThanOrEqual(CONVERSATION_STORE_MAX_CHARS);
    expect(lastOutcome.ok).toBe(true);
    expect(lastOutcome.evicted).toBeGreaterThanOrEqual(1);
    expect(loadConversation("r1")).toBeNull();
  });

  it("Given 브라우저 한도가 우리 예산보다 낮다(다른 키가 공간을 먹었다) When 저장이 거절된다 Then 절반씩 줄여 재시도하고 최신 대화는 살린다", () => {
    // 인자 4K 는 2K 미리보기로 잘려 레코드 한 건이 약 8.5K. 여덟 건(약 68K)을 넉넉한 저장소에 만든 뒤
    // 그 값을 한도 40K 저장소에 그대로 심는다 — 다른 키가 공간을 먹어 우리 예산(1M)보다 먼저 막히는 상황.
    for (let index = 1; index <= 8; index += 1) saveConversation(bulkyRecord(`q${index}`, index, 4, 4_000));
    const seeded = storedJson();
    expect(seeded.length).toBeGreaterThan(40_000);
    installStorage(createMemoryStorageWithSeed({ maxChars: 40_000 }, { "oprn:ai-conversations": seeded }));

    const outcome = saveConversation(bulkyRecord("q9", 9, 4, 4_000));

    // 9건(약 76K) 거절 → 절반 4건(약 34K) 성공. 밀어낸 5건이 결과에 드러난다.
    expect(outcome.ok).toBe(true);
    expect(outcome.evicted).toBe(5);
    expect(listConversations().map((conversation) => conversation.id)).toEqual(["q9", "q8", "q7", "q6"]);
    expect(loadConversation("q9")).not.toBeNull();
    expect(storedJson().length).toBeLessThanOrEqual(40_000);
  });

  it("Given 저장소가 모든 쓰기를 거절한다 When 저장한다 Then 던지지 않고 ok:false 를 돌려주며 경고는 한 번만 찍는다", () => {
    installStorage(createMemoryStorage({ rejectAll: true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => saveConversation(record("dead_1", 1))).not.toThrow();
    const outcome = saveConversation(record("dead_2", 2));

    expect(outcome.ok).toBe(false);
    expect(loadConversation("dead_2")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("[ai-conversation]");
  });

  it("Given 인자가 큰 툴콜 When 저장한다 Then 원격 미러도 로컬과 같은 압축본을 받는다", async () => {
    saveConversation(record("mirror", 3, [user("미러"), bulkyTool("paint_cells", CONVERSATION_ARGS_MAX_CHARS * 4)]));
    await Promise.resolve();

    const remote = recordSupabaseConversationMock.mock.calls.at(-1)?.[0] as { entries?: AuditEntry[] } | undefined;
    const remoteTool = remote?.entries?.[1];
    expect(remoteTool?.kind).toBe("tool");
    if (remoteTool?.kind !== "tool") return;
    expect(remoteTool.args._truncated).toBe(true);
    expect(remote?.entries).toEqual(loadConversation("mirror")?.entries);
  });
});

describe("listConversations 미리보기 (데크 2026-09-03)", () => {
  it("마지막 조수 발화를 80자 안으로 잘라 preview 로 준다 — 없으면 마지막 사용자 발화", () => {
    // Break: 이전 대화 목록이 제목·날짜·턴 수만 보여 어느 대화인지 고를 근거가 없다.
    localStorage.clear();
    saveConversation({
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
    saveConversation({
      id: "conv_preview_user_only",
      title: "질문만",
      model: "m",
      savedAt: 20,
      projectContextKey: "local:x::m1",
      entries: [{ kind: "user", text: "이 맵에 상점이 몇 개야?" }],
    });
    const rows = listConversations();
    const withAssistant = rows.find((row) => row.id === "conv_preview");
    expect(withAssistant?.preview?.startsWith("광장 북쪽 (24,11) 에 우물을 놓았습니다.")).toBe(true);
    expect((withAssistant?.preview ?? "").length).toBeLessThanOrEqual(81);
    expect(withAssistant?.preview?.endsWith("…")).toBe(true);
    expect(rows.find((row) => row.id === "conv_preview_user_only")?.preview).toBe("이 맵에 상점이 몇 개야?");
  });
});
