/** @vitest-environment happy-dom */
// 코딩 에이전트(바깥 프로세스)가 열린 프로젝트를 저장했을 때 편집기 반영 계약 — openwiki/agent-direct-edit.md.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryState, recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";

let session: MemoryProjectSession | null = null;

function withSecondMap(project: Project): { project: Project; first: string; second: string } {
  const first = Object.keys(project.maps)[0]!;
  const second = `${first}_agent`;
  project.maps[second] = { ...structuredClone(project.maps[first]!), id: second, name: "에이전트 맵" };
  return { project, first, second };
}

/** 정본에 바깥 저장을 한 번 넣는다 — 브리지로 저장한 에이전트와 같은 결과(저장 행만 바뀐다). */
async function externalSave(mutate: (draft: Project) => void): Promise<void> {
  const snapshot = await session!.repository.loadSnapshot(session!.target);
  const next = structuredClone(snapshot!.project);
  mutate(next);
  await session!.repository.save(next, session!.target);
}

beforeEach(async () => {
  session = installMemoryProjectSession();
  const { project } = withSecondMap(createBlankProject());
  await session.seed(project);
  store.replaceProject(structuredClone(project));
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  store._setPersistedBaselineForTest((await session.repository.loadSnapshot(session.target))!.project);
  store._setCleanPersistStateForTest();
  resetMapEditHistory();
});

afterEach(async () => {
  vi.useRealTimers();
  const { _resetEditActivityForTest } = await import("@/editor/editActivityLog");
  _resetEditActivityForTest();
  session?.dispose();
  session = null;
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  vi.restoreAllMocks();
});

const mapIds = () => { const ids = Object.keys(store.getCurrent().maps); return { first: ids[0]!, second: ids.find((id) => id.endsWith("_agent"))! }; };

describe("external (coding agent) saves reach the open editor", () => {
  it("a clean editor adopts the save without dropping its undo history", async () => {
    const { first, second } = mapIds();
    recordProjectSnapshot("맵 이름", first);
    store.update((draft) => { draft.maps[first]!.name = "사람 이름"; });
    await store.flush();
    expect(getMapEditHistoryState().canUndo).toBe(true);

    await externalSave((draft) => { draft.maps[second]!.name = "에이전트가 바꾼 이름"; });
    expect(await store.refreshFromHost()).toBe(true);

    expect(store.getCurrent().maps[second]!.name).toBe("에이전트가 바꾼 이름");
    expect(getMapEditHistoryState().canUndo).toBe(true);
    // Ctrl+Z 는 사람 편집만 되돌리고 바깥 작업은 남긴다.
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[first]!.name).not.toBe("사람 이름");
    expect(store.getCurrent().maps[second]!.name).toBe("에이전트가 바꾼 이름");
  });

  // refreshFromHost 는 저장이 날아가는 중이면 false 로 물러난다. 빈 프로젝트가 커서 병합 차이 계산이 느린 러너에서는 그 사이
  // 1.5초 자동저장 타이머가 먼저 울려 저장이 시작되므로, 사람 편집이 있는 두 경우는 타이머를 멈춘 채 병합 계약만 본다.
  it("unsaved edits on another map survive and stay dirty", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { first, second } = mapIds();
    store.update((draft) => { draft.maps[first]!.name = "저장 안 된 사람 편집"; });
    await externalSave((draft) => { draft.maps[second]!.name = "에이전트 편집"; });

    expect(await store.refreshFromHost()).toBe(true);

    expect(store.getCurrent().maps[first]!.name).toBe("저장 안 된 사람 편집");
    expect(store.getCurrent().maps[second]!.name).toBe("에이전트 편집");
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.externalChangeConflict()).toBeNull();
  });

  it("the same map edited by both keeps the unsaved human edit and names it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { first } = mapIds();
    store.update((draft) => { draft.maps[first]!.name = "사람 편집"; });
    await externalSave((draft) => { draft.maps[first]!.name = "에이전트 편집"; });

    expect(await store.refreshFromHost()).toBe(true);

    expect(store.getCurrent().maps[first]!.name).toBe("사람 편집");
    expect(store.externalChangeConflict()).toHaveLength(1);
    expect(store.hasUnsavedChanges()).toBe(true);
  });
});
