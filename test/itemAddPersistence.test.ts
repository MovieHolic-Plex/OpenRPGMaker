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
    setDevProjectFactory(() => {
      const sample = createBlankProject();
      sample.switches = [];
      return sample;
    });
    await store.load();
    expect(store.getCurrent().switches.length).toBeGreaterThan(0);
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(store.getAutoSaveState()).toMatchObject({ kind: "error", code: "session-not-persisted" });

    const itemId = addDatabaseRecord("items");

    expect(store.getCurrent().database.items.some((item) => item.id === itemId)).toBe(true);
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.getAutoSaveState()).toMatchObject({ kind: "error", code: "session-not-persisted" });

    const flushResult = await store.flush();
    // fresh 세션은 기록을 건너뛰었다고 written:false 로 알린다(성공 토스트 금지, store.ts FlushResult).
    expect(flushResult).toEqual({ kind: "saved-local", written: false });
    expect(store.getAutoSaveState()).toMatchObject({ kind: "error", code: "session-not-persisted" });

    await store.load();
    expect(store.getCurrent().database.items.some((item) => item.id === itemId)).toBe(false);
    expect(store.getAutoSaveState()).toMatchObject({ kind: "error", code: "session-not-persisted" });
    // #4862: 임시 세션은 이벤트 초안 금고만 탭 열쇠(session:<탭 id>)로 남긴다. 그 밖의 열쇠도, 추가한 아이템도 남지 않는다.
    const keys = Array.from({ length: freshProjectStorage.length }, (_, index) => freshProjectStorage.key(index)!);
    expect(keys.every((key) => key.startsWith("oprn:event-draft-vault:session:"))).toBe(true);
    expect(keys.some((key) => freshProjectStorage.getItem(key)!.includes(itemId))).toBe(false);
  });
});
