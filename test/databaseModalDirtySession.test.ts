import { beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import {
  getMapEditHistoryDepth,
  getMapEditHistoryState,
  recordProjectSnapshot,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("database modal dirty session", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  it("tracks a clean modal snapshot until database edits change project state", () => {
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    const dirtySession = createDatabaseModalDirtySession();

    expect(dirtySession.isDirty()).toBe(false);

    updateDatabaseRecord("actors", actorId, { name: "Dirty Actor" });

    expect(dirtySession.isDirty()).toBe(true);
  });

  it("restores the modal-open snapshot when dirty edits are discarded", () => {
    const originalName = store.getCurrent().database.actors[0]?.name ?? "";
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    const dirtySession = createDatabaseModalDirtySession();

    updateDatabaseRecord("actors", actorId, { name: "Discarded Actor" });
    dirtySession.discard();

    expect(store.getCurrent().database.actors[0]?.name).toBe(originalName);
    expect(dirtySession.isDirty()).toBe(false);
  });

  it("marks applied edits clean so later cancel attempts can close without a prompt", () => {
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    const dirtySession = createDatabaseModalDirtySession();

    updateDatabaseRecord("actors", actorId, { name: "Applied Actor" });
    expect(dirtySession.isDirty()).toBe(true);

    dirtySession.markClean();

    expect(dirtySession.isDirty()).toBe(false);
  });

  it("rewinds undo history to the session-open depth on discard so discarded edits cannot be revived with Ctrl+Z", () => {
    const originalName = store.getCurrent().database.actors[0]?.name ?? "";
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    const baselineHistory = getMapEditHistoryState();

    const dirtySession = createDatabaseModalDirtySession();
    updateDatabaseRecord("actors", actorId, { name: "Discard Edit One" });
    updateDatabaseRecord("actors", actorId, { nickname: "Discard Edit Two" });
    expect(getMapEditHistoryState().canUndo).toBe(true);

    dirtySession.discard();

    // (a) 프로젝트가 세션을 열 때 상태로 복원된다.
    expect(store.getCurrent().database.actors[0]?.name).toBe(originalName);
    // (b) 세션 중 쌓인 스냅샷이 사라져 히스토리 깊이가 세션 이전과 같다.
    expect(getMapEditHistoryState()).toEqual(baselineHistory);

    // (c) undo 를 실행해도 폐기한 편집은 부활하지 않는다(되감을 스냅샷이 없음).
    expect(undoMapEdit()).toBe(false);
    expect(store.getCurrent().database.actors[0]?.name).toBe(originalName);
  });

  it("discards a session-only edit even when the undo stack was already saturated at MAX_HISTORY before the session opened", () => {
    const originalName = store.getCurrent().database.actors[0]?.name ?? "";
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";

    // 스택을 포화 상태(MAX_HISTORY)로 채운다 — 세션 중 push 가 MAX_HISTORY shift 로
    // 상쇄돼 길이가 그대로 유지되는 상황(깊이 기준 절단이 무동작이 되는 조건)을 재현한다.
    for (let index = 0; index < 55; index += 1) {
      recordProjectSnapshot(`prefill ${index}`);
      store.update((project) => {
        project.database.actors[0].nickname = `prefill-${index}`;
      });
    }
    // 깊이만 본다 — getMapEditHistoryDebugEntries 는 엔트리 50개의 프로젝트 전체를 JSON 으로 재서 호출마다 수십 초가 걸렸다.
    const saturated = getMapEditHistoryDepth();
    expect(saturated).toBeGreaterThanOrEqual(50);

    const dirtySession = createDatabaseModalDirtySession();
    updateDatabaseRecord("actors", actorId, { name: "Discarded After Saturation" });
    // 포화 상태라 세션 중 push 가 가장 오래된 엔트리를 밀어내 길이가 그대로다 — 깊이 기준 절단이 무동작이 되는 조건.
    expect(getMapEditHistoryDepth()).toBe(saturated);
    dirtySession.discard();

    expect(store.getCurrent().database.actors[0]?.name).toBe(originalName);
    // 세션 중 쌓인 엔트리는 시퀀스 기준으로 빠진다 — 깊이 기준 절단(회귀)이면 길이가 그대로 남는다.
    expect(getMapEditHistoryDepth()).toBeLessThan(saturated);

    // discard 직후의 undo 는 폐기한 편집(Discarded After Saturation)을 부활시키지 않는다.
    // 예전엔 undo 를 50번 모두 소진해 호스티드 CI 에서 30~53초 걸렸다(release-0420, ci-full 45700529442) —
    // 세션 엔트리는 스택 꼭대기에만 있을 수 있으므로 위의 길이 단언과 앞쪽 undo 몇 번으로 같은 회귀를 잡는다.
    for (let step = 0; step < 3 && undoMapEdit(); step += 1) {
      expect(store.getCurrent().database.actors[0]?.name).not.toBe("Discarded After Saturation");
    }
  }, 45_000);
});
