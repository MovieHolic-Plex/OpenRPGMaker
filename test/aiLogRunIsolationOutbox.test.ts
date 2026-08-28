// 런 격리(run_id) · 전송 실패 큐(outbox) · anon 키 프록시 모드의 계약.
//
// 세 가지 모두 2026-08-29 실측에서 나온 결함을 고정한다:
//   1. DB 에 런 식별자가 없어 `order=created_at.desc&limit=1` 이 옆 워크트리의 e2e 턴을 줬다
//      (5,128턴 중 사람이 친 건 9턴. 디스크 미러의 cwd 가 유일한 격리 키였다).
//   2. localStorage 링버퍼가 전송 성공/실패와 무관하게 100건에서 밀어내므로, 원격이 죽은 동안의
//      턴은 복구 근거 없이 사라졌다 — "로컬이 정본" 이라 적혀 있는데 가장 먼저 사라지는 게 로컬이었다.
//   3. VITE_ 접두사 때문에 anon 키가 번들에 인라인됐다. RLS 가 없어 그 키로 전체 조회가 된다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiActivityRunId, resetAiActivityRunIdForTest } from "@/ai/activityRunId";
import { buildAiActivityLogRecord } from "@/ai/activityLog";
import {
  clearRemoteOutbox,
  enqueueRemoteWrite,
  flushRemoteOutbox,
  listRemoteOutbox,
  registerRemoteOutboxSender,
  remoteOutboxStats,
} from "@/project/remoteOutbox";
import {
  listSupabaseAiActivityLogs,
  recordSupabaseAiActivityLog,
  resetAiActivityRunIdColumnProbeForTest,
} from "@/project/supabaseProjectSync";
import { supabaseProjectConfig, supabaseProjectConfigDraftWithSource } from "@/project/supabaseProjectConfig";
import { SUPABASE_PROXY_ANON_SENTINEL, SUPABASE_PROXY_PATH } from "@/project/supabaseProxyPath";

const TEST_CONFIG = {
  anonKey: "test-anon-key",
  projectId: "rpg-zzu-house-template-gallery",
  url: "http://dbserver:8100",
} as const;

function stubWebStorage(name: "localStorage" | "sessionStorage"): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal(name, {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  });
  return store;
}

describe("AI 활동 로그 런 격리", () => {
  beforeEach(() => {
    stubWebStorage("sessionStorage");
    stubWebStorage("localStorage");
    resetAiActivityRunIdForTest();
    resetAiActivityRunIdColumnProbeForTest();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("탭 안에서 런 식별자가 고정된다", () => {
    const first = aiActivityRunId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/iu);
    expect(aiActivityRunId()).toBe(first);
    // 같은 탭의 다른 모듈이 읽어도 같은 값이어야 한다 — 아니면 턴마다 런이 갈라진다.
    expect(sessionStorage.getItem("oprn:ai-activity-run-id")).toBe(first);
  });

  it("새 탭(sessionStorage 교체)은 다른 런을 받는다", () => {
    const first = aiActivityRunId();
    stubWebStorage("sessionStorage");
    resetAiActivityRunIdForTest();
    expect(aiActivityRunId()).not.toBe(first);
  });

  it("모든 활동 레코드에 런 식별자가 붙는다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "의자를 카페트 좌우로 깔아봐",
      result: { ok: true },
    });
    expect(record.runId).toBe(aiActivityRunId());
  });

  it("원격 행에 run_id 를 실어 보낸다", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", (async (_input, init) => {
      bodies.push(String(init?.body ?? ""));
      return new Response("", { status: 201 });
    }) satisfies typeof fetch);

    const result = await recordSupabaseAiActivityLog(
      {
        logId: "00000000-0000-4000-8000-00000000a999",
        runId: "11111111-2222-4333-8444-555555555555",
        channel: "chat",
        instruction: "의자 깔기",
        payload: { id: "00000000-0000-4000-8000-00000000a999" },
      },
      TEST_CONFIG,
    );

    expect(result.kind).toBe("saved");
    expect(JSON.parse(bodies[0] ?? "[]")).toMatchObject([{ run_id: "11111111-2222-4333-8444-555555555555" }]);
  });

  it("run_id 컬럼이 없는 DB 에서는 그 키만 빼고 다시 보낸다", async () => {
    // 마이그레이션이 밀린 DB 에서 새 컬럼 때문에 로그가 통째로 유실되면 안 된다.
    const bodies: string[] = [];
    vi.stubGlobal("fetch", (async (_input, init) => {
      const body = String(init?.body ?? "");
      bodies.push(body);
      if (body.includes("run_id")) {
        return new Response(
          JSON.stringify({ code: "PGRST204", message: "Could not find the 'run_id' column of 'ai_activity_logs'" }),
          { status: 400 },
        );
      }
      return new Response("", { status: 201 });
    }) satisfies typeof fetch);

    const result = await recordSupabaseAiActivityLog(
      {
        logId: "00000000-0000-4000-8000-00000000a998",
        runId: "11111111-2222-4333-8444-555555555555",
        channel: "chat",
        instruction: "의자 깔기",
        payload: {},
      },
      TEST_CONFIG,
    );

    expect(result.kind).toBe("saved");
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain("run_id");
    expect(bodies[1]).not.toContain("run_id");
  });

  it("런 필터 조회는 폴백 테이블을 섞지 않는다", async () => {
    // ai_analysis_runs 에는 런 정보가 없다 — 섞으면 다시 옆 런의 턴이 들어온다.
    const urls: string[] = [];
    vi.stubGlobal("fetch", (async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify([{ log_id: "a", run_id: "run-1" }]), { status: 200 });
    }) satisfies typeof fetch);

    const rows = await listSupabaseAiActivityLogs(5, TEST_CONFIG, { runId: "run-1" });

    expect(rows).toHaveLength(1);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("run_id=eq.run-1");
    expect(urls.some((url) => url.includes("ai_analysis_runs"))).toBe(false);
  });

  it("런 필터가 없으면 select 에 run_id 를 넣지 않는다", async () => {
    // 20260829000000 미적용 DB 에서 없는 컬럼을 select 하면 400 이고, 이 경로는 오류를 삼킨다.
    const urls: string[] = [];
    vi.stubGlobal("fetch", (async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify([]), { status: 200 });
    }) satisfies typeof fetch);

    await listSupabaseAiActivityLogs(5, TEST_CONFIG);

    const primary = urls.find((url) => url.includes("ai_activity_logs")) ?? "";
    expect(primary).not.toContain("run_id");
  });
});

describe("원격 전송 실패 큐", () => {
  beforeEach(() => {
    stubWebStorage("localStorage");
    clearRemoteOutbox();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("같은 (kind,id) 는 중복 적재하지 않고 최신 payload 로 갱신한다", () => {
    enqueueRemoteWrite({ id: "log-1", kind: "ai-activity", payload: { v: 1 } });
    enqueueRemoteWrite({ id: "log-1", kind: "ai-activity", payload: { v: 2 } });
    const entries = listRemoteOutbox();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.payload).toEqual({ v: 2 });
    expect(entries[0]?.attempts).toBe(2);
  });

  it("성공하면 큐에서 빠진다", async () => {
    const sent: unknown[] = [];
    registerRemoteOutboxSender("ai-activity", async (payload) => {
      sent.push(payload);
    });
    enqueueRemoteWrite({ id: "log-2", kind: "ai-activity", payload: { v: 1 } });

    const result = await flushRemoteOutbox();

    expect(result.sent).toBe(1);
    expect(sent).toEqual([{ v: 1 }]);
    expect(listRemoteOutbox()).toHaveLength(0);
  });

  it("실패하면 큐에 남고 사유가 기록된다", async () => {
    registerRemoteOutboxSender("ai-activity", async () => {
      throw new Error("network down");
    });
    enqueueRemoteWrite({ id: "log-3", kind: "ai-activity", payload: { v: 1 } });

    const result = await flushRemoteOutbox();

    expect(result.failed).toBe(1);
    const entry = listRemoteOutbox()[0];
    expect(entry?.id).toBe("log-3");
    expect(entry?.lastError).toContain("network down");
    // 조용히 사라지지 않는다 — 유실이 이 기능이 존재하는 이유다.
    expect(remoteOutboxStats().pending + remoteOutboxStats().stalled).toBe(1);
  });

  it("반복 실패는 stalled 로 표시되어 자동 재시도에서 빠지지만 데이터는 남는다", async () => {
    let calls = 0;
    registerRemoteOutboxSender("ai-activity", async () => {
      calls += 1;
      throw new Error("migration missing");
    });
    for (let index = 0; index < 6; index += 1) {
      enqueueRemoteWrite({ id: "log-4", kind: "ai-activity", payload: { v: index } });
    }

    const stats = remoteOutboxStats();
    expect(stats.stalled).toBe(1);
    expect(stats.pending).toBe(0);

    const auto = await flushRemoteOutbox();
    expect(auto.skipped).toBe(1);
    expect(calls).toBe(0);
    // 데이터는 보존된다.
    expect(listRemoteOutbox()).toHaveLength(1);
    // 강제 flush 는 stalled 도 시도한다.
    await flushRemoteOutbox({ force: true });
    expect(calls).toBe(1);
  });

  it("전송기가 미설정을 알리면 큐에 남긴다", async () => {
    registerRemoteOutboxSender("ai-conversation", async () => {
      throw new Error("supabase not configured");
    });
    enqueueRemoteWrite({ id: "conv-1", kind: "ai-conversation", payload: { v: 1 } });

    await flushRemoteOutbox();

    expect(listRemoteOutbox().map((entry) => entry.id)).toEqual(["conv-1"]);
  });

  it("예산을 넘겨 버린 건수를 세어 둔다", () => {
    // 250건을 넣으면 MAX_ENTRIES(200)를 넘으므로 오래된 것부터 버려진다.
    for (let index = 0; index < 250; index += 1) {
      enqueueRemoteWrite({ id: `log-${index}`, kind: "ai-activity", payload: { index } });
    }
    const stats = remoteOutboxStats();
    expect(stats.pending + stats.stalled).toBeLessThanOrEqual(200);
    expect(stats.dropped).toBeGreaterThan(0);
  });
});

describe("Supabase anon 키 프록시 모드", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("프록시 모드는 같은-오리진 경로와 센티널만 클라이언트에 남긴다", () => {
    stubWebStorage("localStorage");
    const config = supabaseProjectConfig({
      VITE_SUPABASE_USE_PROXY: "1",
      VITE_SUPABASE_PROJECT_ID: "rpg-zzu-black-bell",
    });
    expect(config).not.toBeNull();
    expect(config?.url).toBe(SUPABASE_PROXY_PATH);
    expect(config?.projectId).toBe("rpg-zzu-black-bell");
    // 실 자격증명이 아니라 자리표시자다 — 프록시가 서버 전용 키로 덮는다.
    expect(config?.anonKey).toBe(SUPABASE_PROXY_ANON_SENTINEL);
  });

  it("브라우저에 남은 레거시 실 키가 프록시 모드를 되돌리지 못한다", () => {
    const store = stubWebStorage("localStorage");
    store.set(
      "oprn:supabase-project-config",
      JSON.stringify({ anonKey: "leaked-real-key", projectId: "old", url: "http://dbserver:8100", source: "custom" }),
    );

    const draft = supabaseProjectConfigDraftWithSource({
      VITE_SUPABASE_USE_PROXY: "1",
      VITE_SUPABASE_PROJECT_ID: "rpg-zzu-black-bell",
    });

    expect(draft.source).toBe("env");
    expect(draft.anonKey).toBe(SUPABASE_PROXY_ANON_SENTINEL);
    expect(draft.url).toBe(SUPABASE_PROXY_PATH);
  });

  it("프록시 모드가 아니면 기존 env 경로가 그대로다", () => {
    stubWebStorage("localStorage");
    const config = supabaseProjectConfig({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "explicit-key",
      VITE_SUPABASE_PROJECT_ID: "p1",
    });
    expect(config?.url).toBe("https://example.supabase.co");
    expect(config?.anonKey).toBe("explicit-key");
  });
});
