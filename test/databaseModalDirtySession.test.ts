import { beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
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
});
