import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createMemoryWorkshopStore, openWorkshopStore, type WorkshopStore } from "@/harnesses/_core/workshop/store";
import type { WorkshopRound } from "@/harnesses/_core/workshop/types";

const round = (id: string, projectKey: string, itemKey = "bookshelf"): WorkshopRound => ({
  id, projectKey, harnessId: "interior-props", itemKey, note: "", created: 1, runs: [],
});

async function exercise(store: WorkshopStore): Promise<void> {
  await store.putRound(round("r1", "local:A::m1"));
  await store.putRound(round("r2", "local:B::m1"));
  await store.putRound({ ...round("r1", "local:A::m1"), note: "다시" });
  expect((await store.listRounds("local:A::m1")).map((r) => [r.id, r.note])).toEqual([["r1", "다시"]]);
  expect((await store.getRound("r2"))?.projectKey).toBe("local:B::m1");
  await store.deleteRound("r2");
  expect(await store.getRound("r2")).toBeNull();

  await store.putPick({ projectKey: "local:A::m1", itemKey: "bookshelf", roundId: "r1", letter: "C", at: 5 });
  await store.putPick({ projectKey: "local:A::m1", itemKey: "bookshelf", roundId: "r1", letter: "D", at: 6 });
  expect((await store.listPicks("local:A::m1")).map((p) => p.letter)).toEqual(["D"]);
  await store.deletePick("local:A::m1", "bookshelf");
  expect(await store.listPicks("local:A::m1")).toEqual([]);

  await store.addFeedback({ id: "f1", projectKey: "local:A::m1", itemKey: "bookshelf", roundId: "r1", letter: "A", verdict: "reject", reasons: ["view"], note: "", at: 1 });
  await store.addFeedback({ id: "f2", projectKey: "local:A::m1", itemKey: "stool", roundId: "r3", letter: null, verdict: "reject", reasons: [], note: "", at: 2 });
  expect((await store.listFeedback("local:A::m1", "bookshelf")).map((f) => f.id)).toEqual(["f1"]);
  expect((await store.listFeedback("local:A::m1")).length).toBe(2);

  const def = { key: "new:herb-rack", title: "약초 걸이", description: "말린 약초", tilesW: 1, tilesH: 1, rise: 16, kind: "wall", category: "약방", use: [], refs: [] };
  await store.putItemDef("local:A::m1", def);
  expect(await store.listItemDefs("local:A::m1")).toEqual([def]);
  expect(await store.listItemDefs("local:B::m1")).toEqual([]);
}

describe("공방 저장소", () => {
  it("IndexedDB: 프로젝트 범위로 판·고른 것·버린 이유·새 기물을 나눠 둔다", async () => {
    const store = await openWorkshopStore(new IDBFactory());
    expect(store.backend).toBe("indexeddb");
    await exercise(store);
  });
  it("메모리 폴백도 같은 계약을 지킨다", async () => {
    const store = createMemoryWorkshopStore();
    expect(store.backend).toBe("memory");
    await exercise(store);
  });
  it("factory 가 없으면 메모리로 산다", async () => {
    expect((await openWorkshopStore(null)).backend).toBe("memory");
  });
  it("메모리 저장소는 넣은 객체를 복사한다(나중에 고쳐도 저장본이 안 바뀐다)", async () => {
    const store = createMemoryWorkshopStore();
    const r = round("r1", "p");
    await store.putRound(r);
    r.runs.push({} as never);
    expect((await store.getRound("r1"))?.runs).toEqual([]);
  });
});
