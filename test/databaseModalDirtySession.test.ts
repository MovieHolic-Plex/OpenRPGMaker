import { beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("database modal dirty session", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
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
});
