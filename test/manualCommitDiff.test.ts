// test/manualCommitDiff.test.ts
// 사람 손편집의 원격 커밋 로그가 **실제 diff** 를 담는지 고정한다.
//
// 실측(2026-08-29): `manualDiffSummary()` 가 `systemChanged = true` 만 세워서, 타일 3000장을
// 칠했든 NPC 를 지웠든 Supabase 커밋 summary 가 항상 `"변경 저장: 시스템"` 이었다.
// 진짜 diff 계산기(`summarizeChanges`)는 이미 있었지만 AI 경로만 쓰고 있었다.
//
// 두 번째 결함: `.then()` 이 성공과 `not-configured`(supabase 미설정 / project_commits 테이블
// 누락 → **정상 resolve**)를 구분하지 않아 dedup baseline 이 전진했다. 설정이 붙은 뒤 동일 내용
// 재저장이 dedup 에 걸려 그 커밋이 영구히 기록되지 않았다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import type { Project } from "@/project/types";

type CommitCallInput = { readonly summary: string; readonly diff?: { readonly tilesChanged: number; readonly systemChanged: boolean } };
// `not-configured` 도 정상 resolve 형태라 union 으로 못박는다 — 좁혀두면 dedup 테스트에서
// mockImplementation 이 타입 에러가 난다(그게 바로 이 테스트가 잡는 결함의 형태다).
type CommitCallResult = { readonly kind: "saved"; readonly commitId: string } | { readonly kind: "not-configured" };

// hoisted 로 만들어야 vi.resetModules() 이후에도 같은 spy 를 계속 관찰할 수 있다 —
// 팩토리 안에서 새로 만들면 리셋마다 spy 가 갈려서 호출 이력이 사라진다.
const remote = vi.hoisted(() => ({
  loadProjectFromSupabase: vi.fn(async () => null),
  recordProjectCommitToSupabase: vi.fn(
    async (_input: CommitCallInput): Promise<CommitCallResult> => ({ kind: "saved", commitId: "commit-1" }),
  ),
  saveProjectMapPatchToSupabase: vi.fn(async (input: { project: Project }) => ({
    kind: "saved" as const,
    project: structuredClone(input.project),
  })),
  saveProjectToSupabase: vi.fn(async (project: Project) => ({ kind: "saved" as const, project: structuredClone(project) })),
}));

vi.mock("@/project/supabaseProjectSync", () => remote);
vi.mock("@/assets/supabaseResourceCache", () => ({
  cacheSupabaseRootResources: vi.fn(async () => ({ skipped: [] })),
}));

/** fire-and-forget `.then()` 체인이 끝날 때까지 마이크로태스크를 비운다. */
async function flushPending(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function commitSummaries(): readonly string[] {
  return remote.recordProjectCommitToSupabase.mock.calls.map(([input]) => input.summary);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  remote.recordProjectCommitToSupabase.mockImplementation(async () => ({ kind: "saved" as const, commitId: "commit-1" }));
  _resetEventDraftVaultForTest();
});

afterEach(() => {
  _resetEventDraftVaultForTest();
  vi.clearAllMocks();
});

describe("수동 저장 커밋 summary 는 실제 diff 다", () => {
  it("타일을 칠하고 저장하면 summary 가 '시스템' 이 아니라 타일 변경을 담는다", async () => {
    const { store } = await import("@/project/store");
    store.replaceProject(createBlankProject());
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    // 저장 직전에 서버가 갖고 있던 내용 = diff baseline.
    store._setPersistedBaselineForTest(structuredClone(projectWithoutEventDrafts(store.getCurrent())));

    const mapId = store.getCurrent().startMapId;
    store.updateMap(mapId, (map) => {
      for (let i = 0; i < 5; i += 1) map.lowerTiles[i] = 7;
    }, { label: "타일 칠하기", cells: [] });

    const result = await store.flush();
    await flushPending();

    expect(result.kind).toBe("saved");
    expect(remote.recordProjectCommitToSupabase).toHaveBeenCalledTimes(1);
    const input = remote.recordProjectCommitToSupabase.mock.calls[0]![0];
    expect(input.summary).toBe("변경 저장: 타일 5");
    // 회귀 가드: 예전 구현은 diff 자체가 systemChanged 뿐이었다.
    expect(input.diff?.tilesChanged).toBe(5);
    expect(input.diff?.systemChanged).toBe(false);
    expect(input.summary).not.toContain("시스템");
  });

  it("baseline 이 없는 첫 저장은 던지지 않고 기존 폴백(시스템)으로 기록한다", async () => {
    const { store } = await import("@/project/store");
    store.replaceProject(createBlankProject());
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    // 첫 저장/프로젝트 전환 직후 상태 — 비교 대상이 없다.
    store._setPersistedBaselineForTest(null);

    store.update((project) => {
      project.meta.title = "baseline 없는 첫 저장";
    }, { scope: "project", label: "제목 변경" });

    const result = await store.flush();
    await flushPending();

    expect(result.kind).toBe("saved");
    // baseline 이 없으면 전체 저장 경로로 간다(map patch 아님).
    expect(remote.saveProjectToSupabase).toHaveBeenCalledTimes(1);
    expect(commitSummaries()).toEqual(["변경 저장: 시스템"]);
  });
});

describe("dedup baseline 은 실제 기록에만 전진한다", () => {
  it("not-configured 로 resolve 되면 baseline 이 전진하지 않아 동일 내용 재저장이 다시 시도된다", async () => {
    remote.recordProjectCommitToSupabase.mockImplementation(async () => ({ kind: "not-configured" as const }));
    const { recordManualProjectCommitAfterSave } = await import("@/project/projectCommitLog");
    const baseline = createBlankProject();
    const saved = structuredClone(baseline);
    saved.meta.title = "기록되지 않은 저장";

    recordManualProjectCommitAfterSave(saved, baseline);
    await flushPending();
    expect(remote.recordProjectCommitToSupabase).toHaveBeenCalledTimes(1);

    // supabase 설정이 붙었다고 가정하고 같은 내용을 다시 저장한다.
    remote.recordProjectCommitToSupabase.mockImplementation(async () => ({ kind: "saved" as const, commitId: "commit-2" }));
    recordManualProjectCommitAfterSave(saved, baseline);
    await flushPending();

    // 이전 구현은 여기서 dedup 에 걸려 이 커밋이 영구히 사라졌다.
    expect(remote.recordProjectCommitToSupabase).toHaveBeenCalledTimes(2);
  });

  it("saved 로 resolve 되면 baseline 이 전진해 동일 내용 재저장을 건너뛴다", async () => {
    const { recordManualProjectCommitAfterSave } = await import("@/project/projectCommitLog");
    const baseline = createBlankProject();
    const saved = structuredClone(baseline);
    saved.meta.title = "기록된 저장";

    recordManualProjectCommitAfterSave(saved, baseline);
    await flushPending();
    recordManualProjectCommitAfterSave(saved, baseline);
    await flushPending();

    expect(remote.recordProjectCommitToSupabase).toHaveBeenCalledTimes(1);
  });
});
