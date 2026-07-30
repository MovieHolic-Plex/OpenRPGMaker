import { beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import {
  getMapEditHistoryDebugEntries,
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
    expect(getMapEditHistoryDebugEntries().length).toBeGreaterThanOrEqual(50);

    const dirtySession = createDatabaseModalDirtySession();
    updateDatabaseRecord("actors", actorId, { name: "Discarded After Saturation" });
    dirtySession.discard();

    expect(store.getCurrent().database.actors[0]?.name).toBe(originalName);

    // discard 이후 몇 번을 undo 하든 폐기한 편집(Discarded After Saturation)은
    // 절대 부활하지 않아야 한다 — MAX_HISTORY 포화로 깊이 기준 절단이 무동작이던 회귀.
    let guard = 0;
    while (undoMapEdit() && guard < 200) {
      guard += 1;
      expect(store.getCurrent().database.actors[0]?.name).not.toBe("Discarded After Saturation");
    }
    // 스냅샷 55개 + undo 소진은 프로젝트 전체를 깊은 복사한다. 포커스 실행은 ~8.5초로 통과하지만
    // 전체 스위트 병렬 실행에서는 15초 기본 타임아웃(vitest.config.ts)을 넘겨 실패했다(실측).
    // 케이스 자체가 느린 것이므로 기본값을 올리지 않고 이 테스트만 예산을 늘린다.
  }, 45_000);
});
