import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __setRecentInstructionsForTest,
  clearRecentInstructions,
  loadRecentInstructions,
  pushRecentInstruction,
} from "@/editor/regionTask/recentInstructions";

// Vitest environment:"node" 는 localStorage 가 없다 — 메모리 스텁으로 대체.
// globalThis 타입엔 localStorage 가 없어 명명된 참조로 한 번만 단언.
const g = globalThis as unknown as { localStorage?: Storage };
const store = new Map<string, string>();
const stub: Storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size; },
};
beforeEach(() => {
  store.clear();
  g.localStorage = stub;
});

afterEach(() => {
  delete g.localStorage;
});

describe("loadRecentInstructions / pushRecentInstruction", () => {
  it("빈 상태에서 빈 배열", () => {
    clearRecentInstructions();
    expect(loadRecentInstructions()).toEqual([]);
  });

  it("push 하면 최신이 맨 앞", () => {
    pushRecentInstruction("침엽수 숲으로 채워줘");
    pushRecentInstruction("둥근 호수를 만들어줘");
    const list = loadRecentInstructions();
    expect(list).toHaveLength(2);
    expect(list[0]).toBe("둥근 호수를 만들어줘");
    expect(list[1]).toBe("침엽수 숲으로 채워줘");
  });

  it("중복 지시어는 맨 앞으로 이동 (개수 유지)", () => {
    pushRecentInstruction("A");
    pushRecentInstruction("B");
    pushRecentInstruction("A"); // 중복
    const list = loadRecentInstructions();
    expect(list).toHaveLength(2);
    expect(list[0]).toBe("A");
    expect(list[1]).toBe("B");
  });

  it("5개 초과시 가장 오래된 것 삭제 (FIFO)", () => {
    for (let i = 1; i <= 6; i += 1) pushRecentInstruction(`지시${i}`);
    const list = loadRecentInstructions();
    expect(list).toHaveLength(5);
    expect(list[0]).toBe("지시6"); // 최신
    expect(list[4]).toBe("지시2"); // 5개째 — 지시1은 삭제
  });

  it("빈 문자열/공백은 무시", () => {
    pushRecentInstruction("   ");
    pushRecentInstruction("");
    expect(loadRecentInstructions()).toEqual([]);
  });

  it("__setRecentInstructionsForTest 로 직접 세팅", () => {
    __setRecentInstructionsForTest(["X", "Y"]);
    expect(loadRecentInstructions()).toEqual(["X", "Y"]);
  });
});
