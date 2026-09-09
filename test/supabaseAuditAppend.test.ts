import { afterEach, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import {
  peekLastRemoteCommitTip, recordProjectCommitToSupabase, recordSupabaseConversation,
  seedLastRemoteCommitTip, SupabaseProjectSyncError,
} from "@/project/supabaseProjectSync";

const config = { url: "http://127.0.0.1:1", anonKey: "test-only", projectId: "audit-request-test" };
const input = {
  project: createBlankProject(), serialized: "{}", summary: "append fixture",
  identity: { id: "fixture", label: "fixture", kind: "human" }, reviewStatus: "direct", toolNames: [],
} as const;
afterEach(() => vi.unstubAllGlobals());

it.each(["project_commits", "project_changes"])("uses append-only POST when writing %s", async (table) => {
  // Given a transport recorder; real SQL permissions are covered by spatial-audit-append.mts.
  const calls: { readonly url: string; readonly init: RequestInit | undefined }[] = [];
  vi.stubGlobal("fetch", (async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 201 });
  }) satisfies typeof fetch);
  // When the real audit writer emits its two linked rows.
  await recordProjectCommitToSupabase(input, config);
  // Then this table receives an INSERT request, not an upsert or a silently ignored duplicate.
  const request = calls.find(call => call.url.endsWith(`/${table}`));
  expect(request?.init?.method).toBe("POST");
  expect(new Headers(request?.init?.headers).get("Prefer")).toBe("return=minimal");
  expect(new Headers(request?.init?.headers).get("Content-Profile")).toBe("rpg_zzu");
});

it.each(["project_commits", "project_changes"])("retains the previous tip when %s rejects its append", async (table) => {
  // Given an established parent and a failed response at the selected table boundary.
  const target = { ...config, projectId: `audit-rejection-${table}` };
  seedLastRemoteCommitTip(target.projectId, "previous-tip");
  vi.stubGlobal("fetch", (async (url) => new Response(
    String(url).endsWith(`/${table}`) ? '{"code":"42501"}' : null,
    { status: String(url).endsWith(`/${table}`) ? 401 : 201 },
  )) satisfies typeof fetch);
  // When either append fails.
  const result = recordProjectCommitToSupabase(input, target);
  // Then failure propagates without advancing the linked audit receipt.
  await expect(result).rejects.toBeInstanceOf(SupabaseProjectSyncError);
  expect(peekLastRemoteCommitTip(target.projectId)).toBe("previous-tip");
});

it("preserves merge semantics when upserting an ordinary conversation", async () => {
  // Given the ordinary child-table writer and a successful transport recorder.
  const requests: RequestInit[] = [];
  vi.stubGlobal("fetch", (async (_url, init) => {
    if (init) requests.push(init);
    return new Response(null, { status: 201 });
  }) satisfies typeof fetch);
  // When an existing non-audit upsert path is used.
  await recordSupabaseConversation({ conversationId: "fixture", entries: [], title: "fixture", model: "fixture", savedAt: 0 }, config);
  // Then audit-specific semantics have not changed its conflict resolution.
  expect(new Headers(requests[0]?.headers).get("Prefer")).toBe("resolution=merge-duplicates,return=minimal");
});
