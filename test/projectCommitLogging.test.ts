import { afterEach, describe, expect, it, vi } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { store } from "@/project/store";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";

type FetchCall = {
  readonly init: RequestInit | undefined;
  readonly input: RequestInfo | URL;
};

const TEST_ENV = {
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
  VITE_SUPABASE_PROJECT_ID: "rpg-zzu-house-template-gallery",
  VITE_SUPABASE_URL: "http://dbserver:8100",
} as const;

describe("project commit logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("records an approved changeset commit and change row with identity payload", async () => {
    const calls: FetchCall[] = [];
    stubSupabaseEnv();
    stubEditorIdentityStorage();
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: true, disabledReason: null });
    const project = createHouseTemplateGalleryProject();
    const mapId = project.startMapId;
    store.replace(project);

    const results = applyToolSequenceToStore([
      { name: "set_map_properties", args: { mapId, name: "Commit Logged Map" } },
    ], { source: "agent", agentName: "test-agent-model", summary: "AI map rename" });
    await vi.waitFor(() => {
      expect(calls.some((call) => String(call.input).includes("/rest/v1/project_changes"))).toBe(true);
    });

    expect(results.every((result) => result.ok)).toBe(true);
    const commitCall = calls.find((call) => String(call.input).includes("/rest/v1/project_commits"));
    const changeCall = calls.find((call) => String(call.input).includes("/rest/v1/project_changes"));
    if (!commitCall || !changeCall) throw new Error("expected commit and change calls");
    const commit = bodyRecords(commitCall.init)[0];
    const change = bodyRecords(changeCall.init)[0];

    expect(commit).toMatchObject({
      project_id: TEST_ENV.VITE_SUPABASE_PROJECT_ID,
      message: "AI map rename",
      summary: "AI map rename",
      review_status: "approved",
      author_id: "session-1234",
      author_label: "Editor One",
      author_kind: "agent",
      agent_name: "test-agent-model",
    });
    expect(commit?.current_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(change).toMatchObject({
      entity_type: "project",
      entity_id: TEST_ENV.VITE_SUPABASE_PROJECT_ID,
      operation: "changeset",
    });
    expect((change?.patch_json as { toolNames?: unknown }).toolNames).toEqual(["set_map_properties"]);
    expect(store.getCurrent().maps[mapId]?.name).toBe("Commit Logged Map");
  });

  it("keeps the store changes when commit logging fails", async () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stubSupabaseEnv();
    stubEditorIdentityStorage();
    vi.stubGlobal("fetch", (async () => new Response("commit table unavailable", { status: 500 })) satisfies typeof fetch);
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: true, disabledReason: null });
    const project = createHouseTemplateGalleryProject();
    const mapId = project.startMapId;
    store.replace(project);

    const results = applyToolSequenceToStore([
      { name: "set_map_properties", args: { mapId, name: "Still Applied" } },
    ], { source: "agent", agentName: "test-agent-model" });
    await vi.waitFor(() => {
      expect(warnings).toHaveBeenCalled();
    });

    expect(results.every((result) => result.ok)).toBe(true);
    expect(store.getCurrent().maps[mapId]?.name).toBe("Still Applied");
    // 로거 이관(2026-08-29): 메시지 접두사(`[project-commits]`)는 createLogger 가 붙이므로
    // 문자열 전체를 고정하지 않는다. 계약은 "기록 실패가 warn 으로 보고된다" 이다.
    expect(warnings).toHaveBeenCalledWith(expect.stringContaining("커밋 기록 실패"), expect.any(Error));
  });

  it("dedupes manual autosave commit logging when nothing changed since the previous record", async () => {
    const calls: FetchCall[] = [];
    stubSupabaseEnv();
    stubEditorIdentityStorage();
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      if (String(input).includes("/rest/v1/projects?") && (init?.method ?? "GET") === "GET") {
        return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(store.getCurrent())), current_sha256: null }]), { status: 200 });
      }
      if (String(input).includes("/rest/v1/projects?") && init?.method === "PATCH") {
        return new Response(JSON.stringify([bodyRecord(init)]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    const project = createHouseTemplateGalleryProject();
    project.meta.title = "Manual Commit Dedupe";
    store.replace(project);

    await store.flush();
    await vi.waitFor(() => {
      expect(calls.some((call) => String(call.input).includes("/rest/v1/project_commits"))).toBe(true);
    });
    await store.flush();
    await Promise.resolve();

    const commitCalls = calls.filter((call) => String(call.input).includes("/rest/v1/project_commits"));
    expect(commitCalls).toHaveLength(1);
    const commit = bodyRecords(commitCalls[0]?.init)[0];
    expect(commit).toMatchObject({
      review_status: "direct",
      author_kind: "human",
      author_id: "session-1234",
      author_label: "Editor One",
    });
  });
});

function stubSupabaseEnv(): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", TEST_ENV.VITE_SUPABASE_ANON_KEY);
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", TEST_ENV.VITE_SUPABASE_PROJECT_ID);
  vi.stubEnv("VITE_SUPABASE_URL", TEST_ENV.VITE_SUPABASE_URL);
}

function stubEditorIdentityStorage(): void {
  const storage = new Map<string, string>([
    ["oprn:editor-session-id", "session-1234"],
    ["oprn:editor-owner-label", "Editor One"],
  ]);
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  };
  vi.stubGlobal("window", { localStorage, location: { hostname: "127.0.0.1", pathname: "/", search: "" } });
  vi.stubGlobal("localStorage", localStorage);
}

function bodyRecords(init: RequestInit | undefined): readonly Record<string, unknown>[] {
  if (typeof init?.body !== "string") throw new Error("expected string body");
  const parsed: unknown = JSON.parse(init.body);
  if (!Array.isArray(parsed) || !parsed.every(isRecord)) throw new Error("expected record array body");
  return parsed;
}

function bodyRecord(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== "string") throw new Error("expected string body");
  const parsed: unknown = JSON.parse(init.body);
  if (!isRecord(parsed)) throw new Error("expected record body");
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
