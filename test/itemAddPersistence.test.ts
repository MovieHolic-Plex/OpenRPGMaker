import { freshProjectStorage } from "./helpers/freshProjectWindow";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { setDevProjectFactory, store } from "@/project/store";
import { addDatabaseRecord } from "@/editor/databaseActions";

describe("editor-added item persistence", () => {
  it("marks a fresh-project item edit as non-persistent before the fresh session discards it", async () => {
    freshProjectStorage.clear();
    setDevProjectFactory(() => createBlankProject());
    await store.load();

    const itemId = addDatabaseRecord("items");

    expect(store.getCurrent().database.items.some((item) => item.id === itemId)).toBe(true);
    expect(store.getAutoSaveState()).toMatchObject({ kind: "error", code: "session-not-persisted" });

    const flushResult = await store.flush();
    expect(flushResult).toEqual({ kind: "saved-local" });
    expect(store.getAutoSaveState()).toMatchObject({ kind: "error", code: "session-not-persisted" });

    await store.load();
    expect(store.getCurrent().database.items.some((item) => item.id === itemId)).toBe(false);
    expect(freshProjectStorage.length).toBe(0);
  });
});
