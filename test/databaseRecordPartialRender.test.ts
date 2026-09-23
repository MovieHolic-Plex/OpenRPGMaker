import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord } from "@/editor/databaseActions";
import {
  refreshDatabasePanel,
  renderDatabasePanel,
  setDatabaseActiveTab,
} from "@/editor/panels/database";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly Image: typeof globalThis.Image | undefined;
  readonly window: typeof globalThis.window | undefined;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = {
    Image: globalThis.Image,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    window: globalThis.window,
  };
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      addEventListener(): void {}
      set src(_value: string) {}
    },
  });
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
  setDatabaseActiveTab("terms");
  resetDatabaseRecordViewSession();
  // 스킬 탭은 갤러리 기본값이지만 이 테스트는 리스트 행 부분 렌더 계약을 검증한다 — 명시적으로 list.
  setViewModeForCollection("skills", "list");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
  restoreBrowserGlobal("Image", previousBrowserGlobals.Image);
  restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
});

describe("Database record tab partial rendering", () => {
  it("Given the actors collection When the record tab renders Then it uses the studio table and contextual inspector contract", () => {
    // Break caught: actors still render as the old narrow roster beside a card-heavy form.
    const host = renderRecordHost("actors");

    expect(findByTestId(host, "db-actor-studio")).not.toBeNull();
    expect(findByTestId(host, "db-actor-studio")?.textContent).toContain("주인공");
    expect(findByTestId(host, "db-actor-studio-summary")).toBeNull();
    expect(findByTestId(host, "db-actor-table-header")?.textContent).toContain("캐릭터");
    expect(findByTestId(host, "db-actor-table-header")?.textContent).toContain("직업");
    // 레벨·HP·맵 표시 열은 주인공마다 값이 다를 때만 선다(visibleActorColumns — databasePartySimplify.test.ts).
    expect(host.querySelector(".db-studio-table-pane")).not.toBeNull();
    expect(host.querySelector(".db-studio-inspector-pane")).not.toBeNull();

    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    expect(findByTestId(host, `db-record-row-${actorId}`)).not.toBeNull();
    expect(findByTestId(host, "db-detail-form")).not.toBeNull();
    // 얼굴 한 칸 = 파일 한 장 — 히어로 헤더는 시트 크롭이 아니라 그림 한 장을 그린다.
    expect(findByTestId(host, "db-record-hero")?.querySelector(".actor-face-image")).not.toBeNull();
    expect(findByTestId(host, "db-record-hero")?.querySelector(".actor-sheet-crop")).toBeNull();
  });

  it("Given an actor opens When the inspector renders Then hierarchy is expressed by direct tabs without guidance copy", () => {
    // Break caught: a tutorial card and numbered long-form document explain hierarchy instead of embodying it.
    const host = renderRecordHost("actors");

    expect(findByTestId(host, "db-actor-beginner-guide")).toBeNull();
    expect(host.querySelector(".actor-task-next")).toBeNull();
    expect(findByTestId(host, "db-actor-section-tabs")?.textContent).toBe("기본외형성장전투결과");
    expect(findByTestId(host, "db-actor-tab-identity")?.attrs["aria-selected"]).toBe("true");
    expect(findByTestId(host, "db-actor-panel-identity")?.hidden).toBe(false);
    expect(findByTestId(host, "db-actor-panel-appearance")?.hidden).toBe(true);
    expect(findByTestId(host, "db-record-hero")?.textContent).toContain("시작 파티");

    findByTestId(host, "db-actor-tab-battle")?.click();
    expect(findByTestId(host, "db-actor-tab-identity")?.attrs["aria-selected"]).toBe("false");
    expect(findByTestId(host, "db-actor-tab-battle")?.attrs["aria-selected"]).toBe("true");
    expect(findByTestId(host, "db-actor-panel-identity")?.hidden).toBe(true);
    expect(findByTestId(host, "db-actor-panel-battle")?.hidden).toBe(false);
    expect(findByTestId(host, "db-actor-panel-battle")?.textContent).toContain("크리티컬 공격");
  });

  it("Given the actors gallery preference When the tab renders Then it preserves the existing card gallery", () => {
    setViewModeForCollection("actors", "gallery");
    const host = renderRecordHost("actors");

    expect(findByTestId(host, "db-actor-studio")).toBeNull();
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    expect(findByTestId(host, `db-record-card-${actorId}`)).not.toBeNull();
  });

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

  it("Given an actor name edit When the inspector changes Then the studio row updates without rebuilding", () => {
    setViewModeForCollection("actors", "list");
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    const host = renderRecordHost("actors");
    const detailFormBefore = findByTestId(host, "db-detail-form");
    const nameInput = findByTestId(host, "db-field-name");

    nameInput!.value = "새 주인공 이름";
    nameInput!.dispatchEvent(new Event("input"));

    const row = findByTestId(host, `db-record-row-${actorId}`);
    expect(row?.querySelector(".db-list-name")?.textContent).toBe("새 주인공 이름");
    expect(store.getCurrent().database.actors[0]?.name).toBe("새 주인공 이름");
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

describe("Database tab render cache", () => {
  it("Given an unchanged project When a previously visited tab is reopened Then its rendered view is reused", () => {
    // Break caught: sidebar tab clicks discard a complete tab view and rebuild its list, thumbnails, and form.
    setDatabaseActiveTab("terms");
    const container = document.createElement("div") as unknown as FakeElement;
    renderDatabasePanel(container as unknown as HTMLElement);
    const termsViewBefore = container.querySelector(".db-body")?.firstChild;

    findByTestId(container, "db-tab-variables")?.click();
    findByTestId(container, "db-tab-terms")?.click();

    expect(container.querySelector(".db-body")?.firstChild).toBe(termsViewBefore);
  });

  it("Given a cached tab When project data changes Then reopening the tab renders fresh data", () => {
    // Break caught: a tab cache survives a project mutation and shows stale record data.
    setDatabaseActiveTab("terms");
    const container = document.createElement("div") as unknown as FakeElement;
    renderDatabasePanel(container as unknown as HTMLElement);
    const termsViewBefore = container.querySelector(".db-body")?.firstChild;

    findByTestId(container, "db-tab-variables")?.click();
    store.update((project) => {
      project.meta.terms.gold = "Cache invalidated gold";
    }, { scope: "database", collection: "terms" });
    findByTestId(container, "db-tab-terms")?.click();

    expect(container.querySelector(".db-body")?.firstChild).not.toBe(termsViewBefore);
    expect(findByTestId(container, "db-field-gold")?.value).toBe("Cache invalidated gold");
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
