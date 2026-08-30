import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AssistantSession, type AuditEntry } from "@/ai/assistantSession";
import { AI_CONVERSATION_DISK_ENDPOINT } from "@/ai/conversationMirrorEndpoint";
import {
  _resetConversationMirrorStateForTest,
  buildConversationMirrorRequest,
  mirrorConversationEntry,
} from "@/ai/conversationSqliteMirror";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import {
  appendConversationEntry,
  listConversations,
  openConversationDb,
  readConversationEntries,
} from "../scripts/lib/aiConversationSqlite.mjs";

// 왜 이 테스트가 있는가: 대화의 Supabase 저장은 턴 종료 한 곳에서만 일어난다. 실시간 SQLite
// 미러는 그 사이 구멍(응답 대기 중 새로고침 → 사용자 지시 유실)을 막는 유일한 장치이므로,
// (1) 항목이 즉시 나가는지 (2) 경로가 서버와 같은지 (3) DB 가 순서/중복을 지키는지를 고정한다.

describe("대화 SQLite 미러 — 서버 writer", () => {
  let dir: string;
  let db: ReturnType<typeof openConversationDb>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rpgzzu-conv-"));
    db = openConversationDb(join(dir, "ai-conversations.sqlite"));
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("append 순서대로 seq 를 매기고 첫 사용자 발화로 제목을 정한다", () => {
    const first = appendConversationEntry(db, {
      conversationId: "conv_a",
      entryId: "ent_1",
      kind: "user",
      at: "2026-08-30T09:00:00.000Z",
      text: "맵을 비워라\n\n[컨텍스트] 현재 맵: 빈 맵",
      projectContextKey: "oprn-test",
      model: "gemini-3.7-flash",
      payload: { kind: "user", text: "맵을 비워라" },
    });
    const second = appendConversationEntry(db, {
      conversationId: "conv_a",
      entryId: "ent_2",
      kind: "assistant",
      at: "2026-08-30T09:00:05.000Z",
      text: "비웠습니다",
      payload: { kind: "assistant", text: "비웠습니다" },
    });

    expect([first.seq, second.seq]).toEqual([0, 1]);
    const [conversation] = listConversations(db, 10);
    // 제목은 [컨텍스트] 꼬리를 빼고, 두 번째 항목이 갈아치우지 않는다.
    expect(conversation?.title).toBe("맵을 비워라");
    expect(conversation?.entry_count).toBe(2);
    expect(conversation?.project_context_key).toBe("oprn-test");
  });

  it("같은 entry_id 재전송은 행을 늘리지 않고 처음 seq 를 돌려준다", () => {
    const input = {
      conversationId: "conv_b",
      entryId: "ent_dup",
      kind: "tool" as const,
      at: "2026-08-30T09:01:00.000Z",
      text: "타일 12칸 변경",
      toolName: "paint_tiles",
      payload: { kind: "tool", name: "paint_tiles", args: {}, ok: true, summary: "타일 12칸 변경" },
    };
    const first = appendConversationEntry(db, input);
    const retry = appendConversationEntry(db, input);

    expect(first).toEqual({ seq: 0, inserted: true });
    expect(retry).toEqual({ seq: 0, inserted: false });
    const entries = readConversationEntries(db, "conv_b");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.tool_name).toBe("paint_tiles");
  });

  it("conversationId·entryId·kind 가 없으면 거절한다(경계 검증)", () => {
    expect(() => appendConversationEntry(db, { entryId: "e", kind: "user" })).toThrow(/conversationId/);
    expect(() => appendConversationEntry(db, { conversationId: "c", kind: "user" })).toThrow(/entryId/);
    expect(() => appendConversationEntry(db, { conversationId: "c", entryId: "e" })).toThrow(/kind/);
  });
});

describe("대화 SQLite 미러 — 클라이언트", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    _resetConversationMirrorStateForTest();
  });

  it("툴 항목은 summary 를 본문으로, 툴 이름을 함께 보낸다", () => {
    const entry: AuditEntry = {
      kind: "tool",
      name: "paint_tiles",
      args: { mapId: "map_1" },
      ok: true,
      summary: "타일 12칸 변경",
      at: "2026-08-30T09:02:00.000Z",
    };
    const request = buildConversationMirrorRequest({ conversationId: "conv_c", entry });
    expect(request.payload.text).toBe("타일 12칸 변경");
    expect(request.payload.toolName).toBe("paint_tiles");
    expect(request.payload.at).toBe("2026-08-30T09:02:00.000Z");
    expect(request.keepalive).toBe(true);
  });

  it("60 KiB 초과 항목은 keepalive 를 쓰지 않는다", () => {
    const request = buildConversationMirrorRequest({
      conversationId: "conv_c",
      entry: { kind: "assistant", text: "가".repeat(40_000) },
    });
    expect(new TextEncoder().encode(request.body).byteLength).toBeGreaterThan(60 * 1024);
    expect(request.keepalive).toBe(false);
  });

  it("미러 엔드포인트로 POST 한다", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch);

    mirrorConversationEntry({
      conversationId: "conv_d",
      entry: { kind: "user", text: "길을 그려줘" },
      projectContextKey: "oprn-test",
      model: "gemini-3.7-flash",
    });
    // fire-and-forget — 마이크로태스크 큐가 비면 요청이 나가 있다(타이머 대기 없음).
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(AI_CONVERSATION_DISK_ENDPOINT);
    expect(calls[0]?.body).toMatchObject({
      conversationId: "conv_d",
      kind: "user",
      text: "길을 그려줘",
      projectContextKey: "oprn-test",
    });
  });
});

describe("대화 SQLite 미러 — 세션 싱크", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("사용자 항목은 LLM 응답을 기다리지 않고 즉시 싱크로 나간다", async () => {
    const project = createBlankProject();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);

    const seen: AuditEntry[] = [];
    // chat 이 호출되는 순간 = 아직 턴이 끝나지 않은 시점. 여기서 이미 사용자 항목이 보여야 한다.
    let kindsAtRequestTime: string[] = [];
    const session = new AssistantSession(project, {
      chat: async () => {
        kindsAtRequestTime = seen.map((entry) => entry.kind);
        return { message: { role: "assistant", content: "확인했습니다" }, finishReason: "stop" } as never;
      },
      onAudit: (entry) => seen.push(entry),
    });

    await session.sendUserMessage("맵을 비워라");

    expect(kindsAtRequestTime).toContain("user");
    const user = seen.find((entry) => entry.kind === "user");
    expect(user).toBeDefined();
    // 스탬프된 타임스탬프가 싱크에도 실려야 한다(DB 의 at 열이 이 값을 쓴다).
    expect(user?.at).toBeTruthy();
  });
});

describe("대화 SQLite 미러 — 경로 드리프트", () => {
  const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/ai/conversationSqliteMirror.ts", import.meta.url), "utf8");

  it("vite 미들웨어가 클라이언트와 같은 경로를 매칭한다", () => {
    expect(viteConfig).toContain(`const AI_CONVERSATION_DISK_ENDPOINT = "${AI_CONVERSATION_DISK_ENDPOINT}"`);
    expect(viteConfig).toContain("req.url?.startsWith(AI_CONVERSATION_DISK_ENDPOINT)");
  });

  it("클라이언트는 경로 문자열을 다시 적지 않고 상수를 쓴다", () => {
    expect(client).toContain("fetch(AI_CONVERSATION_DISK_ENDPOINT");
    expect(client).not.toMatch(/fetch\(\s*"\/__/);
  });

  it("미러 실패를 조용히 넘기지 않는다", () => {
    expect(client).toContain("res.ok");
    expect(client).toContain("warnMirrorFailure");
  });
});
