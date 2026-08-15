import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord } from "@/editor/databaseActions";
import { refreshDatabasePanel, renderDatabasePanel } from "@/editor/panels/database";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    window: globalThis.window,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
      localStorage: createFakeLocalStorage(),
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
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
  // 스킬 탭은 갤러리 기본값이지만 이 테스트는 리스트 행 부분 렌더 계약을 검증한다 — 명시적으로 list.
  setViewModeForCollection("skills", "list");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
  restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
});

describe("Database record tab partial rendering", () => {
  it("Given a record selection When another record row is clicked Then the list is not rebuilt and only the active row changes", () => {
    const firstId = store.getCurrent().database.skills[0]?.id ?? "";
    const secondId = addDatabaseRecord("skills");
    const host = renderRecordHost("skills");

    const firstRowBefore = findByTestId(host, `db-record-row-${firstId}`);
    const secondRowBefore = findByTestId(host, `db-record-row-${secondId}`);
    expect(firstRowBefore).not.toBeNull();
    expect(secondRowBefore).not.toBeNull();

    secondRowBefore?.click();

    // 리스트 행 노드는 재생성되지 않고 그대로 유지되어야 한다(스크롤/포커스 보존의 근거).
    expect(findByTestId(host, `db-record-row-${firstId}`)).toBe(firstRowBefore);
    expect(findByTestId(host, `db-record-row-${secondId}`)).toBe(secondRowBefore);
    // 활성 표시는 클릭한 행으로만 이동한다.
    expect(secondRowBefore?.attrs["aria-pressed"]).toBe("true");
    expect(firstRowBefore?.attrs["aria-pressed"]).toBe("false");
    // 디테일 폼은 선택한 레코드로 교체된다.
    expect(nameInputValue(host)).toBe(store.getCurrent().database.skills.find((entry) => entry.id === secondId)?.name);
  });

  it("Given a name field edit When the value changes Then the list row label updates without rebuilding the detail form", () => {
    const skillId = store.getCurrent().database.skills[0]?.id ?? "";
    const host = renderRecordHost("skills");

    const detailFormBefore = findByTestId(host, "db-detail-form");
    const nameInput = findByTestId(host, "db-field-name");
    expect(detailFormBefore).not.toBeNull();
    expect(nameInput).not.toBeNull();

    nameInput!.value = "번개 강타";
    nameInput!.dispatchEvent(new Event("input"));

    // 리스트 행 라벨이 즉시 갱신된다.
    const row = findByTestId(host, `db-record-row-${skillId}`);
    expect(row?.querySelector(".db-list-name")?.textContent).toBe("번개 강타");
    expect(row?.dataset.recordName).toBe("번개 강타");
    // 스토어에도 반영된다.
    expect(store.getCurrent().database.skills.find((entry) => entry.id === skillId)?.name).toBe("번개 강타");
    // 디테일 폼 노드는 재생성되지 않아 입력 포커스가 유지된다.
    expect(findByTestId(host, "db-detail-form")).toBe(detailFormBefore);
  });

  it("Given a scrolled record list When the tab is re-rendered Then the scroll position is restored", () => {
    const firstHost = renderRecordHost("skills");
    const listBefore = firstHost.querySelector(".db-list");
    expect(listBefore).not.toBeNull();

    (listBefore as unknown as { scrollTop: number }).scrollTop = 144;
    listBefore!.dispatchEvent(new Event("scroll"));

    const secondHost = renderRecordHost("skills");
    const listAfter = secondHost.querySelector(".db-list");
    expect((listAfter as unknown as { scrollTop: number }).scrollTop).toBe(144);
  });
});

describe("Database panel partial refresh (undo/redo path)", () => {
  it("Given a mounted panel When refreshDatabasePanel runs Then the tab scaffold is preserved and only the body re-renders", () => {
    const container = document.createElement("div") as unknown as FakeElement;
    renderDatabasePanel(container as unknown as HTMLElement);
    const headerBefore = container.querySelector(".db-tabs");
    const bodyBefore = container.querySelector(".db-body");
    expect(headerBefore).not.toBeNull();
    expect(bodyBefore).not.toBeNull();

    refreshDatabasePanel(container as unknown as HTMLElement);

    // 헤더 스캐폴드는 동일 인스턴스로 유지되고 본문만 다시 그려진다.
    expect(container.querySelector(".db-tabs")).toBe(headerBefore);
    expect(container.querySelector(".db-body")).toBe(bodyBefore);
    expect(container.querySelectorAll(".db-tabs").length).toBe(1);
    expect(bodyBefore?.childNodes.length).toBeGreaterThan(0);
  });
});

function renderRecordHost(collection: Parameters<typeof renderRecordTab>[1]): FakeElement {
  const host = document.createElement("div");
  renderRecordTab(host, collection, () => undefined);
  if (host instanceof FakeElement) return host;
  throw new Error("Expected fake database host");
}

function nameInputValue(host: FakeElement): string | undefined {
  return findByTestId(host, "db-field-name")?.value;
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

function restoreBrowserGlobal(name: keyof FakeBrowserGlobals, value: FakeBrowserGlobals[typeof name]): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Object.defineProperty(globalThis, name, { configurable: true, value });
}
