// test/storeFlushShaEvidence.test.ts
// Todo 5 — ProjectFlushResult "saved" 성공 형태가 sha256 증거를 운반한다.
// saveProjectToSupabase/saveProjectMapPatchToSupabase 의 결과(sha256)가 flush 결과로
// 그대로 흘러들어온다(commitId 는 여기 오지 않는다 — 비동기 커밋 로그 경로의 전용 row).
// 자율 런 run-end 게이트가 agent_run_saved 감사에 projectId + sha256 으로 기록하는 근거다.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";

function stubBrowserWindow(): void {
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
    },
  });
}

function stubSupabaseEnv(): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-sha-evidence");
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
}

function stubManualCommitLog(): void {
  vi.doMock("@/project/projectCommitLog", async () => {
    const actual = await vi.importActual<typeof import("@/project/projectCommitLog")>(
      "@/project/projectCommitLog",
    );
    return { ...actual, recordManualProjectCommitAfterSave: vi.fn() };
  });
}

describe("Project store flush sha256 evidence", () => {
  afterEach(async () => {
    // 앞 테스트가 store 를 건드리면 편집 활동 로그가 PERSIST_DEBOUNCE_MS 뒤에
    // fetch("/__oprn/edit-activity") 를 쏜다. 그 타이머를 끄지 않으면 다음 테스트가 새로 세운
    // fetch 스파이에 그 요청이 들어와 "저장 요청이 없어야 한다" 단정이 순서/부하에 따라 깨진다
    // (실측: 두 번째 테스트가 1st spy call = edit-activity POST 로 실패).
    // vi.resetModules() 는 다음 테스트 본문에서 일어나므로 여기서 import 하면 앞 테스트가
    // 쓰던 그 모듈 인스턴스를 잡는다.
    const { _resetEditActivityForTest } = await import("@/editor/editActivityLog");
    _resetEditActivityForTest();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("전체 저장 경로: saveProjectToSupabase 의 sha256 이 flush 결과(saved.sha256)로 흘러든다", async () => {
    stubSupabaseEnv();
    stubBrowserWindow();
    stubManualCommitLog();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    vi.doMock("@/project/supabaseProjectSync", async () => {
      const actual = await vi.importActual<typeof import("@/project/supabaseProjectSync")>(
        "@/project/supabaseProjectSync",
      );
      return {
        ...actual,
        saveProjectToSupabase: vi.fn(async () => ({ kind: "saved" as const, sha256: "sha-evidence-1" })),
      };
    });
    vi.resetModules();

    const { store } = await import("@/project/store");
    const { createBlankProject } = await import("@/project/defaults");
    const project = createBlankProject();
    store.replaceProject(project);
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(null);
    store.update((draft: Project) => {
      draft.meta.title = "sha 증거 제목";
    });

    const result = await store.flush();

    expect(result.kind).toBe("saved");
    // todo 5 계약: 성공 형태가 sha256 을 운반한다(run-end 게이트의 agent_run_saved 근거).
    expect((result as { sha256?: string }).sha256).toBe("sha-evidence-1");
  });

  it("변경 없음 fast path 는 saved(sha256 없음) — sha256 은 선택 필드 계약 그대로", async () => {
    stubSupabaseEnv();
    stubBrowserWindow();
    stubManualCommitLog();
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { store } = await import("@/project/store");
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(store.getCurrent());

    const result = await store.flush();

    expect(result).toEqual({ kind: "saved" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
