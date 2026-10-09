import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reassembleSelectedProposalProject } from "@/editor/panels/aiProposalSummary";
import * as applyChangesetToStore from "@/editor/tools/applyChangesetToStore";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { createMemoryRepository } from "@/project/persistence/memoryRepository";
import { setProjectRepositoryForTest } from "@/project/persistence/repository";
import { recordProjectCommit } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import type { ProposedCall } from "@/ai/assistantSession";
import type { ProjectTarget } from "@/project/persistence/target";
import type { CommitInput, CommitListItem } from "@/project/persistence/types";

const TEST_ENV = {
  VITE_LEGACY_DB_ANON_KEY: "test-anon-key",
  VITE_LEGACY_DB_PROJECT_ID: "rpg-zzu-test-project",
  VITE_LEGACY_DB_URL: "http://dbserver:8100",
} as const;

function stubLegacyDbEnv(values: Partial<typeof TEST_ENV> = TEST_ENV): void {
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", values.VITE_LEGACY_DB_ANON_KEY ?? "");
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", values.VITE_LEGACY_DB_PROJECT_ID ?? "");
  vi.stubEnv("VITE_LEGACY_DB_URL", values.VITE_LEGACY_DB_URL ?? "");
}

/** 커밋을 실제로 영속하는 대상. 로컬 폴더 정본과 같은 모양(자격증명 없음). */
const COMMIT_TARGET: ProjectTarget = {
  kind: "local",
  projectDir: "/tmp/oprn-commit-log-test",
  projectId: "uuid-commit-log-test",
};

let disposeCommitRepository: (() => void) | null = null;

/**
 * 커밋 영속 포트를 이 테스트에 붙인다.
 *
 * 정본 경로는 `projectRepository().commits.record(...)` 다 — 은퇴한 Supabase 전송
 * (VITE_LEGACY_DB_* + `/rest/v1/project_commits` fetch, a931de829 에서 제거)이 아니다.
 * 메모리 저장소는 대상이 있으면 `{ kind: "saved", commitId }` 를 돌려주므로
 * 단위 테스트에서도 강한 계약(persisted:true + commitId)을 그대로 검증할 수 있다.
 * `recorded` 는 포트에 실제로 넘어간 payload(요약·diff·toolNames)를 그대로 들고 있다.
 */
function installCommitRepository(): {
  readonly recorded: CommitInput[];
  readonly listCommits: (limit: number) => readonly CommitListItem[];
} {
  const memory = createMemoryRepository({ target: COMMIT_TARGET });
  const recorded: CommitInput[] = [];
  setProjectRepositoryForTest({
    ...memory,
    commits: {
      ...memory.commits,
      record: (input, target) => {
        recorded.push(input);
        return memory.commits.record(input, target);
      },
    },
  });
  disposeCommitRepository = () => setProjectRepositoryForTest(null);
  return { recorded, listCommits: (limit) => memory.commits.listSync(limit) };
}

afterEach(() => {
  disposeCommitRepository?.();
  disposeCommitRepository = null;
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
  it("(d) legacyDb 미설정 환경에서도 결정적으로 CommitRow로 resolve한다", async () => {
    // 저장소 .env 가 VITE_LEGACY_DB_* 를 제공하므로 빈 값으로 덮어 미설정을 재현한다.
    stubLegacyDbEnv({});
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

  it("(d) 저장소 대상이 설정돼 있으면 커밋 row를 영속하고 commitId를 돌려준다", async () => {
    const repository = installCommitRepository();

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
    // 포트에 넘어간 payload와 저장된 커밋 row 양쪽을 본다 — row 만 보면 기록 없이 id 만 만들어도 통과한다.
    expect(repository.recorded).toHaveLength(1);
    expect(repository.recorded[0]).toMatchObject({
      reviewStatus: "approved",
      summary: "마일스톤: 원격",
      toolNames: ["set_title_screen", "place_npc"],
    });
    expect(repository.listCommits(5)).toEqual([
      expect.objectContaining({ commitId: row.commitId, reviewStatus: "approved", summary: "마일스톤: 원격" }),
    ]);
  });
});

describe("applyProposedProject shared apply path", () => {
  beforeEach(() => {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory();
  });

  it("스냅샷 → store.replace → await 커밋 순서로 제안 프로젝트를 적용한다", async () => {
    const repository = installCommitRepository();
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
    expect(repository.listCommits(5)).toEqual([
      expect.objectContaining({ commitId: result.commit.commitId, summary: "마일스톤: 제목" }),
    ]);
    // 커밋 payload 는 변경 내역(diff)과 도구 목록을 실어야 한다 — 은퇴한 전송에서 project_changes row 1건이 증명했던 몫.
    expect(repository.recorded).toHaveLength(1);
    expect(repository.recorded[0]?.toolNames).toEqual(["set_title_screen"]);
    expect(repository.recorded[0]?.diff).toBeDefined();
    expect(repository.recorded[0]?.project.meta?.title).toBe("적용된 제목");
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

describe("direct tool render descriptors", () => {
  it("publishes changed cells including autotile neighbors for direct tools and sequences", () => {
    store.replace(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    const replace = vi.spyOn(store, "replace");
    const args = { mapId, layer: "lower", mode: "cells", tile: 281, cells: [{ x: 2, y: 2 }] };
    const result = applyChangesetToStore.applyToolToStore("paint_tiles", args);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(replace.mock.calls.at(-1)?.[1]?.renderCells).toEqual({ mapId, cells: [{ x: 2, y: 2, layer: "lower" }] });
    const results = applyChangesetToStore.applyToolSequenceToStore([
      { name: "paint_tiles", args: { ...args, cells: [{ x: 3, y: 2 }] } },
    ]);
    expect(results[0]?.ok, JSON.stringify(results)).toBe(true);
    expect(replace.mock.calls.at(-1)?.[1]?.renderCells).toEqual({ mapId, cells: [{ x: 2, y: 2, layer: "lower" }, { x: 3, y: 2, layer: "lower" }] });
  });
});
