import { describe, expect, it } from "vitest";
import { TodoStore } from "@/ai/v2/loop/todoStore";

// 2026-11-12 Haiku 게임 하나(r1v-fun) 실측: todo 91번, 결과마다 목록 전체(평균 6.7천 자) — 대화에 쌓여 그 판 입력의 8.7%.
// 항목 하나를 고친 결과는 그 줄과 열린 줄만 싣는다(전체는 todo view). 문서 openwiki/assistant-v2.md 「할 일 결과는 짧게」.

function listOf(n: number): TodoStore {
  const store = new TodoStore();
  store.init([{ phase: "짓기", items: Array.from({ length: n }, (_, i) => ({ content: `할 일 ${i + 1} — 무언가를 짓는다` })) }]);
  return store;
}

describe("viewFocusEn — 항목 하나를 고친 뒤의 짧은 목록", () => {
  it("짧은 목록은 전체를 준다", () => {
    const store = listOf(TodoStore.SHORT_LIST);
    expect(store.viewFocusEn(store.items[0]!.id)).toBe(store.view(40, true));
  });

  it("긴 목록은 세는 줄 + 그 항목 + 열린 항목 8개 + 나머지 수만", () => {
    const store = listOf(30);
    for (const item of store.items.slice(0, 12)) store.done(item, undefined);
    const focus = store.items[11]!;
    const text = store.viewFocusEn(focus.id);
    const lines = text.split("\n");
    expect(lines[0]).toBe(store.view(40, true).split("\n")[0]);
    expect(lines[1]).toContain(` ${focus.id} `);
    expect(lines.slice(2, 10).map((l) => l.trim().split(" ")[1])).toEqual(store.items.slice(12, 20).map((i) => i.id));
    expect(lines.at(-1)).toContain("todo view shows the whole list");
    expect(lines.at(-1)).toContain("10 open");
    expect(text).not.toContain(` ${store.items[0]!.id} `);
    expect(text.length).toBeLessThan(store.view(40, true).length / 2);
  });

  it("전체 목록의 40줄 상한 뒤에 있는 열린 항목도 보인다", () => {
    const store = listOf(46);
    for (const item of store.items.slice(0, 44)) store.done(item, undefined);
    const text = store.viewFocusEn(store.items[43]!.id);
    expect(text).toContain(` ${store.items[45]!.id} `);
    expect(store.view(40, true)).not.toContain(` ${store.items[45]!.id} `);
  });

  it("항목을 못 찾았으면(id 없음) 전체를 준다", () => {
    const store = listOf(30);
    expect(store.viewFocusEn(undefined)).toBe(store.view(40, true));
  });
});
