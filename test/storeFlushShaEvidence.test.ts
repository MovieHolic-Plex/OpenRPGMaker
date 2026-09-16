// test/storeFlushShaEvidence.test.ts
// Todo 5 — ProjectFlushResult "saved" 성공 형태가 sha256 증거를 운반한다.
// 자율 런 run-end 게이트가 agent_run_saved 감사에 projectId + sha256 으로 기록하는 근거다.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";

let session: MemoryProjectSession | null = null;

function stubBrowserWindow(): void {
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
    },
  });
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
    session?.dispose();
    session = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("전체 저장 경로: 저장이 돌려준 sha256 이 flush 결과(saved.sha256)로 흘러든다", async () => {
    stubBrowserWindow();
    stubManualCommitLog();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    session = installMemoryProjectSession();

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
    expect((result as { sha256?: string }).sha256).toMatch(/^[0-9a-f]{64}$/);
    const stored = session.repository.rows.get(session.target.projectId);
    expect((result as { sha256?: string }).sha256).toBe(stored?.sha256);
  });

  it("변경 없음 fast path 는 saved(sha256 없음) — sha256 은 선택 필드 계약 그대로", async () => {
    stubBrowserWindow();
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    session = installMemoryProjectSession();

    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(store.getCurrent());
    store._setCleanPersistStateForTest();

    const result = await store.flush();

    expect(result).toEqual({ kind: "saved" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
