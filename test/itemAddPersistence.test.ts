// eslint-disable-next-line import/order -- 이 import 는 반드시 첫 줄이어야 한다.
// window 를 @/project/store 평가 전에 심는 side-effect 모듈이다. 정렬 자동수정이 아래로
// 내리면 store 그래프 컴파일이 이 테스트의 타임아웃 예산으로 들어와 30초에 죽는다.
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
