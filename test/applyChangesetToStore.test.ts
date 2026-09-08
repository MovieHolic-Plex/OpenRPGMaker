import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reassembleSelectedProposalProject } from "@/editor/panels/aiProposalSummary";
import * as applyChangesetToStore from "@/editor/tools/applyChangesetToStore";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { recordProjectCommit } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import type { ProposedCall } from "@/ai/assistantSession";

const TEST_ENV = {
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
  VITE_SUPABASE_PROJECT_ID: "rpg-zzu-test-project",
  VITE_SUPABASE_URL: "http://dbserver:8100",
} as const;

function stubSupabaseEnv(values: Partial<typeof TEST_ENV> = TEST_ENV): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", values.VITE_SUPABASE_ANON_KEY ?? "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", values.VITE_SUPABASE_PROJECT_ID ?? "");
  vi.stubEnv("VITE_SUPABASE_URL", values.VITE_SUPABASE_URL ?? "");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("canonical construction apply and undo policy", () => {
  it("uses map undo for existing targets and full-project undo for planned new targets", () => {
    // Given: the two canonical routes and their target variants.
    const candidate: unknown = Reflect.get(applyChangesetToStore, "toolUndoScope");
    expect(typeof candidate).toBe("function");
    if (typeof candidate !== "function") return;
    const existingHouse = candidate("author_house", { kind: "single", mapId: "m1" });
    const existingVillage = candidate("author_village", {
      target: { kind: "existing", mapId: "m1", bounds: { x: 2, y: 2, w: 10, h: 10 } },
    });
    const newVillage = candidate("author_village", {
      target: {
        kind: "new", mapId: "m2", name: "새 마을", width: 30, height: 28,
        plannedMap: { mapId: "m2", width: 30, height: 28 },
      },
    });

    // When/Then: existing writes are one-map snapshots; map creation is one project snapshot.
    expect(existingHouse).toEqual({ kind: "map", mapId: "m1" });
    expect(existingVillage).toEqual({ kind: "map", mapId: "m1" });
    expect(newVillage).toEqual({ kind: "project" });
  });

  it("never reruns a canonical facade while reassembling a partial proposal", () => {
    // Given: a canonical call whose preview already exists in the AssistantSession draft.
    const call: ProposedCall = {
      name: "author_house",
      args: { kind: "single", mapId: "m1", wings: [{ x: 2, y: 2, w: 7, h: 6 }] },
      summary: "previewed once",
      result: { ok: true, summary: "previewed once" },
      destructive: false,
      requiresApproval: false,
    };

    // When: a caller asks the legacy reassembly path to replay that selected call.
    const result = reassembleSelectedProposalProject(createEmptyToolProject(), [call], [true]);

    // Then: reassembly is rejected; full accept must commit getProposedProject() directly.
    expect(result).toEqual(expect.objectContaining({
      ok: false,
      message: expect.stringContaining("preview"),
    }));
  });
});

describe("recordProjectCommit awaited variant", () => {
  it("(d) supabase 미설정 환경에서도 결정적으로 CommitRow로 resolve한다", async () => {
    // 저장소 .env 가 VITE_SUPABASE_* 를 제공하므로 빈 값으로 덮어 미설정을 재현한다.
    stubSupabaseEnv({});
    const project = createBlankProject();

    const row = await recordProjectCommit({
      project,
      reviewStatus: "approved",
      summary: "마일스톤: 테스트",
      toolNames: ["set_title_screen"],
    });

    // fire-and-forget와 달리 await 후 row를 돌려준다 — 포스트 적용 커밋 증거가 결정적.
    expect(row).toMatchObject({
      persisted: false,
      commitId: null,
      reviewStatus: "approved",
      summary: "마일스톤: 테스트",
      toolNames: ["set_title_screen"],
    });
    expect(Number.isNaN(Date.parse(row.recordedAt))).toBe(false);
  });

  it("(d) supabase 설정 + 정상 응답이면 커밋 row를 영속하고 commitId를 돌려준다", async () => {
    const calls: { input: RequestInfo | URL; init: RequestInit | undefined }[] = [];
    stubSupabaseEnv();
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: true, disabledReason: null });

    const row = await recordProjectCommit({
      project: createBlankProject(),
      reviewStatus: "approved",
      summary: "마일스톤: 원격",
      toolNames: ["set_title_screen", "place_npc"],
    });

    expect(row.persisted).toBe(true);
    expect(typeof row.commitId).toBe("string");
    expect(row.commitId?.length).toBeGreaterThan(0);
    expect(row.summary).toBe("마일스톤: 원격");
    expect(row.toolNames).toEqual(["set_title_screen", "place_npc"]);
    const commitCall = calls.find((call) => String(call.input).includes("/rest/v1/project_commits"));
    expect(commitCall).toBeTruthy();
  });
});

describe("applyProposedProject shared apply path", () => {
  beforeEach(() => {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory();
  });

  it("스냅샷 → store.replace → await 커밋 순서로 제안 프로젝트를 적용한다", async () => {
    const calls: { input: RequestInfo | URL; init: RequestInit | undefined }[] = [];
    stubSupabaseEnv();
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);
    const base = createBlankProject();
    store.replace(base);
    const proposalBase = applyChangesetToStore.captureProposalBase(store.getCurrent());
    const proposed = structuredClone(base);
    proposed.meta = { ...(proposed.meta ?? {}), title: "적용된 제목" };

    const result = await applyChangesetToStore.applyProposedProject(proposed, {
      base: proposalBase, baseline: new AuthoredProjectBaseline(base),
      source: "agent-milestone",
      agentName: "test-agent",
      summary: "마일스톤: 제목",
      toolNames: ["set_title_screen"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.commit.persisted).toBe(true);
    expect(typeof result.commit.commitId).toBe("string");
    expect(result.commit.summary).toBe("마일스톤: 제목");
    expect(result.applied.meta?.title).toBe("적용된 제목");
    expect(store.getCurrent().meta?.title).toBe("적용된 제목");
    // 마일스톤 1개 = undo 스냅샷 1개 + 커밋 row 1개(await 확정).
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(calls.filter((call) => String(call.input).includes("/rest/v1/project_commits"))).toHaveLength(1);
    expect(calls.filter((call) => String(call.input).includes("/rest/v1/project_changes"))).toHaveLength(1);
  });

  it("린트 차단 제안은 스토어를 건드리지 않고 commit-rejected를 돌려준다", async () => {
    const base = createBlankProject();
    store.replace(base);
    const proposalBase = applyChangesetToStore.captureProposalBase(store.getCurrent());
    const proposed = structuredClone(base);
    proposed.startMapId = "missing-map";

    const result = await applyChangesetToStore.applyProposedProject(proposed, {
      base: proposalBase, baseline: new AuthoredProjectBaseline(base),
      source: "agent-milestone",
      summary: "깨진 마일스톤",
      toolNames: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("commit-rejected");
    expect(store.getCurrent().startMapId).not.toBe("missing-map");
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
});
