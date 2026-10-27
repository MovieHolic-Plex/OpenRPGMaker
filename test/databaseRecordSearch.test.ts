import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { searchQueryForCollection, setCategoryFilterForCollection, setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

// 목록 검색은 80ms 뒤에 탭을 다시 그린다. 타이머를 즉시 돌리면, 그 사이에 옮긴 커서와
// 조합 중인 음절을 구분할 수 없다.
type PendingTimer = { id: number; run: () => void };

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;
let storage: Storage;
let timers: PendingTimer[] = [];
let nextTimerId = 1;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  storage = createFakeLocalStorage();
  timers = [];
  nextTimerId = 1;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      setTimeout: (handler: TimerHandler): number => {
        const id = nextTimerId;
        nextTimerId += 1;
        if (typeof handler === "function") timers.push({ id, run: () => handler() });
        return id;
      },
      clearTimeout: (id: number): void => {
        timers = timers.filter((timer) => timer.id !== id);
      },
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  });
  store.replace(createBlankProject());
  resetDatabaseRecordViewSession();
  setViewModeForCollection("items", "list");
  setCategoryFilterForCollection("items", "all");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousWindow);
  Reflect.deleteProperty(globalThis, "requestAnimationFrame");
});

describe("database record search", () => {
  it("puts the caret back where it was when the list rebuilds", () => {
    const host = renderItems();
    const search = searchInput(host);
    search.value = "회복약";
    search.setSelectionRange(1, 1);
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(searchInput(host)).toBe(search);
    expect(searchQueryForCollection("items")).toBe("");

    // 디바운스 안에 커서를 옮긴다. 예전의 구현은 첫 input 시점의 칸(1)으로 되돌렸다.
    search.setSelectionRange(2, 2);
    flushTimers();

    const next = searchInput(host);
    expect(next).not.toBe(search);
    expect(next.value).toBe("회복약");
    expect(next.selectionStart).toBe(2);
    expect(next.selectionEnd).toBe(2);
    expect(visibleRecordIds(host)).toEqual(["it_potion"]);
  });

  it("keeps the search field while an IME composition is in progress", () => {
    const host = renderItems();
    const search = searchInput(host);
    search.dispatchEvent(new Event("compositionstart"));
    search.value = "회";
    const composing = new Event("input", { bubbles: true });
    Object.defineProperty(composing, "isComposing", { value: true });
    search.dispatchEvent(composing);
    flushTimers();
    expect(searchInput(host)).toBe(search);
    expect(searchQueryForCollection("items")).toBe("");
    expect(visibleRecordIds(host)).toEqual(["it_potion", "it_ether"]);

    search.value = "회복";
    search.setSelectionRange(1, 1);
    search.dispatchEvent(new Event("compositionend", { bubbles: true }));
    const next = searchInput(host);
    expect(next).not.toBe(search);
    expect(next.value).toBe("회복");
    expect(next.selectionStart).toBe(1);
    expect(next.selectionEnd).toBe(1);
    expect(visibleRecordIds(host)).toEqual(["it_potion"]);

    // 조합이 끝난 칸에 같은 값의 input 이 한 번 더 와도 커서를 끝으로 밀지 않는다.
    search.setSelectionRange(search.value.length, search.value.length);
    search.dispatchEvent(new Event("input", { bubbles: true }));
    flushTimers();
    expect(searchInput(host).selectionStart).toBe(1);
    expect(searchInput(host).selectionEnd).toBe(1);
  });

  it("does not bake an in-progress syllable when the debounce fires during composition", () => {
    const host = renderItems();
    const search = searchInput(host);
    search.value = "회";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.dispatchEvent(new Event("compositionstart"));
    search.value = "회복";
    flushTimers();
    expect(searchInput(host)).toBe(search);
    expect(searchQueryForCollection("items")).toBe("");

    search.value = "회";
    search.setSelectionRange(1, 1);
    search.dispatchEvent(new Event("compositionend", { bubbles: true }));
    const next = searchInput(host);
    expect(next.value).toBe("회");
    expect(next.selectionStart).toBe(1);
    expect(searchQueryForCollection("items")).toBe("회");
    expect(visibleRecordIds(host)).toEqual(["it_potion"]);
  });

  it("forgets an unfinished syllable when IME composition is cancelled", () => {
    const host = renderItems();
    const search = searchInput(host);
    search.dispatchEvent(new Event("compositionstart"));
    search.value = "회";
    const composing = new Event("input", { bubbles: true });
    Object.defineProperty(composing, "isComposing", { value: true });
    search.dispatchEvent(composing);
    search.value = "";
    search.dispatchEvent(new Event("compositionend", { bubbles: true }));
    expect(searchQueryForCollection("items")).toBe("");
    expect(searchInput(host)).toBe(search);
    expect(search.value).toBe("");
    expect(visibleRecordIds(host)).toEqual(["it_potion", "it_ether"]);
  });
});

function flushTimers(): void {
  const pending = timers.splice(0);
  for (const timer of pending) timer.run();
}

function renderItems(): FakeElement {
  store.update((project) => {
    project.database.items = [
      normalizeItemRecord({ id: "it_potion", name: "회복약", type: "medicine" }),
      normalizeItemRecord({ id: "it_ether", name: "마력약", type: "medicine" }),
    ];
  });
  const host = document.createElement("div") as unknown as FakeElement;
  document.body.append(host);
  const rerender = (): void => {
    host.replaceChildren();
    renderRecordTab(host, "items", rerender);
  };
  rerender();
  return host;
}

function searchInput(host: FakeElement): FakeElement {
  const input = findByTestId(host, "db-record-search");
  if (!(input instanceof FakeElement)) throw new Error("missing record search");
  return input;
}

function visibleRecordIds(host: FakeElement): string[] {
  return [
    ...host.querySelectorAll(".db-list-row"),
    ...host.querySelectorAll(".db-gallery-card"),
  ].map((row) => row.dataset.recordId ?? "");
}

function createFakeLocalStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  } as Storage;
}

function restoreBrowserGlobal(name: "window", value: typeof globalThis.window | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Object.defineProperty(globalThis, name, { configurable: true, value });
}
