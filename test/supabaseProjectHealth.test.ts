import { afterEach, describe, expect, it, vi } from "vitest";
import { pingSupabaseProject } from "@/project/supabaseProjectSync";

const TEST_CONFIG = {
  anonKey: "test-anon-key",
  projectId: "rpg-zzu-house-template-gallery",
  url: "http://dbserver:8100",
} as const;

type FetchCall = {
  readonly init: RequestInit | undefined;
  readonly input: RequestInfo | URL;
};

describe("pingSupabaseProject", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("checks only the configured project id for health", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify([{ project_id: TEST_CONFIG.projectId }]), { status: 200 });
    }) satisfies typeof fetch);

    await expect(pingSupabaseProject(TEST_CONFIG)).resolves.toEqual({ kind: "healthy" });

    expect(String(calls[0]?.input)).toContain("/rest/v1/projects?");
    expect(String(calls[0]?.input)).toContain("select=project_id");
    expect(String(calls[0]?.input)).toContain("project_id=eq.rpg-zzu-house-template-gallery");
    expect(calls[0]?.init?.headers).toMatchObject({
      "Accept-Profile": "rpg_zzu",
      apikey: "test-anon-key",
    });
  });

  it("reports a reachable database with no matching project separately", async () => {
    vi.stubGlobal("fetch", (async () => (
      new Response(JSON.stringify([]), { status: 200 })
    )) satisfies typeof fetch);

    await expect(pingSupabaseProject(TEST_CONFIG)).resolves.toEqual({ kind: "missing" });
  });
});
