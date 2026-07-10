import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord, deleteDatabaseRecord } from "@/editor/databaseActions";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { DATABASE_FOOTER_ACTION_TEST_IDS } from "@/editor/panels/databaseWorkbench";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, FakeNode, findByTestId, installFakeDom } from "./fakeDom";

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
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
  restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
});

describe("Database RM2K3 workbench context", () => {
  // "취소" 버튼은 "닫기"와 완전히 동일한 동작이던 중복 컨트롤이라 제거했다(fix(db): 저장 모델 UI
  // 정직화). testid 상수에서도 cancel 을 뺀다 — 더 이상 어떤 버튼도 이 testid 를 쓰지 않는다.
  it("keeps the footer actions stable", () => {
    expect(DATABASE_FOOTER_ACTION_TEST_IDS).toEqual({
      apply: "database-footer-apply",
      ok: "database-footer-ok",
    });
  });

  it("Given a stale deleted selection When a modal session restarts Then it selects the first live record", () => {
    const firstSkill = store.getCurrent().database.skills[0];
    const secondSkillId = addDatabaseRecord("skills");
    expect(firstSkill).toBeDefined();

    const selectedRow = findByTestId(renderRecordHost("skills"), `db-record-row-${secondSkillId}`);
    selectedRow?.click();

    expect(findByTestId(renderRecordHost("skills"), `db-record-row-${secondSkillId}`)?.attrs["aria-pressed"]).toBe("true");

    const deleteResult = deleteDatabaseRecord("skills", secondSkillId);
    expect(deleteResult.ok).toBe(true);
    resetDatabaseRecordViewSession();

    const reopened = renderRecordHost("skills");
    expect(findByTestId(reopened, `db-record-row-${secondSkillId}`)).toBeNull();
    expect(findByTestId(reopened, `db-record-row-${firstSkill.id}`)?.attrs["aria-pressed"]).toBe("true");
  });

  it("Given a search on one record tab When another tab renders Then the new tab has an isolated blank search", () => {
    const actorSearch = searchInput(renderRecordHost("actors"));
    actorSearch.value = "Hero";
    actorSearch.dispatchEvent(new Event("input"));

    expect(searchInput(renderRecordHost("actors")).value).toBe("Hero");
    expect(searchInput(renderRecordHost("skills")).value).toBe("");
  });

  it("Given class visual filler rows When automation queries records Then fillers are decorative non-records", () => {
    const host = renderRecordHost("classes");
    const recordRows = allElements(host).filter((node) => node.dataset.testid?.startsWith("db-record-row-"));
    const fillerRows = allElements(host).filter((node) => node.className.split(/\s+/u).includes("db-list-row-visual-filler"));

    expect(recordRows).toHaveLength(store.getCurrent().database.classes.length);
    expect(fillerRows.length).toBeGreaterThan(0);
    for (const row of fillerRows) {
      expect(row.dataset.testid).toBeUndefined();
      expect(row.dataset.recordId).toBeUndefined();
      expect(row.disabled || row.attrs.disabled === "true").toBe(true);
      expect(row.attrs["aria-hidden"]).toBe("true");
    }
  });
});

describe("Database record deletion — 2-step confirm", () => {
  it("arms a confirm state on the first click without deleting the record", () => {
    const skillId = addDatabaseRecord("skills");
    setSelectedRecordId("skills", skillId);
    const host = renderRecordHost("skills");

    const deleteButton = findByTestId(host, "db-delete-selected");
    deleteButton?.click();

    expect(deleteButton?.textContent).toBe("정말 삭제?");
    expect(deleteButton?.className.split(/\s+/u)).toContain("confirming");
    expect(store.getCurrent().database.skills.some((entry) => entry.id === skillId)).toBe(true);
  });

  it("deletes on a second click and shows an undo-hint toast", () => {
    const skillId = addDatabaseRecord("skills");
    setSelectedRecordId("skills", skillId);
    const host = renderRecordHost("skills");

    const deleteButton = findByTestId(host, "db-delete-selected");
    deleteButton?.click();
    deleteButton?.click();

    expect(store.getCurrent().database.skills.some((entry) => entry.id === skillId)).toBe(false);
    const toastEl = document.querySelector<HTMLElement>("[data-testid='toast']");
    expect(toastEl?.textContent).toContain("삭제했습니다");
    expect(toastEl?.textContent).toContain("Ctrl+Z");
  });

  it("still reports a reference-guard failure immediately on the first click (no confirm step needed)", () => {
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    store.update((project) => {
      project.system.startActorIds = [actorId];
    });
    setSelectedRecordId("actors", actorId);
    const host = renderRecordHost("actors");

    const deleteButton = findByTestId(host, "db-delete-selected");
    deleteButton?.click();

    // 참조 가드 실패는 기존처럼 1클릭 즉시 에러 — 확인 상태로 넘어가지 않고, 레코드도 남는다.
    // (databaseReferenceMessage 자체의 가드 메시지/커버리지는 test/databaseReferenceGuards.test.ts
    // 몫 — 여기선 2단계 확인 도입이 가드 실패 경로를 건드리지 않는다는 것만 확인한다.)
    expect(deleteButton?.textContent).toBe("삭제");
    expect(deleteButton?.className.split(/\s+/u)).not.toContain("confirming");
    expect(store.getCurrent().database.actors.some((entry) => entry.id === actorId)).toBe(true);
  });
});

function renderRecordHost(collection: Parameters<typeof renderRecordTab>[1]): FakeElement {
  const host = document.createElement("div");
  renderRecordTab(host, collection, () => undefined);
  if (host instanceof FakeElement) return host;
  throw new Error("Expected fake database host");
}

function searchInput(host: FakeElement): FakeElement {
  const input = host.querySelector("input");
  if (input) return input;
  throw new Error("Expected database search input");
}

function allElements(root: FakeNode): FakeElement[] {
  const matches: FakeElement[] = [];
  for (const child of root.childNodes) {
    if (child instanceof FakeElement) matches.push(child, ...allElements(child));
  }
  return matches;
}

function restoreBrowserGlobal(name: keyof FakeBrowserGlobals, value: FakeBrowserGlobals[typeof name]): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Object.defineProperty(globalThis, name, { configurable: true, value });
}
