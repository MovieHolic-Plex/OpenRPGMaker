import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderSwitchesTab, renderTermsTab, renderVariablesTab } from "@/editor/panels/databaseUtilityViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function namedSwitches(): { id: string; name: string }[] {
  return store.getCurrent().switches.filter((record) => record.name.trim().length > 0);
}

function namedVariables(): { id: string; name: string }[] {
  return store.getCurrent().variables.filter((record) => record.name.trim().length > 0);
}

function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    render(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

let previousWindow: typeof globalThis.window | undefined;

function stubWindowTimers(): void {
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout,
    },
  });
}

function restoreWindow(): void {
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
}

describe("database utility views", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    stubWindowTimers();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
    restoreWindow();
  });

  it("switch add button creates the next numbered switch and focuses name input", () => {
    const host = renderUtility(renderSwitchesTab);
    expect(host.textContent).toContain("아직 스위치가 없습니다");
    expect(host.querySelectorAll(".db-empty-row")).toHaveLength(0);

    findByTestId(host, "db-add-switch")?.click();
    const input = findByTestId(host, "db-utility-selected-name");
    if (!input) throw new Error("missing selected switch input");
    input.value = "문 열림";
    input.dispatchEvent(new Event("input"));

    expect(namedSwitches()).toEqual([{ id: "sw_0001", name: "문 열림" }]);
    expect(document.activeElement).toBe(input);
  });

  it("variable add button creates the next numbered variable and supports rename", () => {
    const host = renderUtility(renderVariablesTab);

    findByTestId(host, "db-add-variable")?.click();
    const input = findByTestId(host, "db-utility-selected-name");
    if (!input) throw new Error("missing selected variable input");
    input.value = "퍼즐 점수";
    input.dispatchEvent(new Event("input"));

    expect(namedVariables()).toEqual([{ id: "var_0001", name: "퍼즐 점수" }]);
    expect(document.activeElement).toBe(input);
  });

  // fix(db): 스위치/변수 삭제에 2단계 확인이 없었다(qa-system-report.md Minor) — 다른 DB
  // 탭과 동일하게 첫 클릭은 무장만 하고, 확인 창 안의 두 번째 클릭이 실제 삭제를 확정한다.
  it("row delete button requires a second click to confirm before removing the switch", () => {
    const host = renderUtility(renderSwitchesTab);
    findByTestId(host, "db-add-switch")?.click();

    const deleteButton = findByTestId(host, "db-delete-sw_0001");
    if (!deleteButton) throw new Error("missing delete button");

    deleteButton.click();
    expect(deleteButton.textContent).toBe("정말 삭제?");
    expect(namedSwitches()).toEqual([{ id: "sw_0001", name: "새 스위치" }]);

    deleteButton.click();
    expect(namedSwitches()).toEqual([]);
    expect(host.textContent).toContain("아직 스위치가 없습니다");
  });

  // fix(db): deleteSwitch/deleteVariable이 session.switches[id]/variables[id] 값을 정리하지
  // 않아, 삭제된 슬롯을 "+ 추가"로 재사용하면 이전 값(true)을 그대로 물려받는 위험이 있었다
  // (qa-system-report.md). ensureSwitchVariableSlots가 매 store.update마다 결측 세션 값을
  // 기본값으로 채워 넣으므로, 삭제 후 세션 값을 지우면 다음 update에서 기본값(false)으로
  // 리셋된다는 것을 검증한다.
  it("clears the stale runtime session value when a switch is deleted", () => {
    const host = renderUtility(renderSwitchesTab);
    findByTestId(host, "db-add-switch")?.click();
    store.update((project) => {
      project.session.switches.sw_0001 = true;
    });
    expect(store.getCurrent().session.switches.sw_0001).toBe(true);

    const deleteButton = findByTestId(host, "db-delete-sw_0001");
    deleteButton?.click();
    deleteButton?.click();

    expect(store.getCurrent().session.switches.sw_0001).toBe(false);
  });

  it("shows story flags in a read-only section instead of decorating switch rows", () => {
    store.update((project) => {
      const first = project.switches.find((record) => record.id === "sw_0001");
      if (!first) throw new Error("missing sw_0001");
      first.name = "시장 만남";
      project.storyFlags = [{
        id: "met-mayor",
        kind: "switch",
        targetId: "sw_0001",
        description: "촌장을 만남",
      }];
    });

    const host = renderUtility(renderSwitchesTab);
    const row = host.querySelector(".db-utility-row");
    const storyFlags = host.querySelector(".db-story-flag-list");

    expect(row?.textContent).toContain("시장 만남");
    expect(row?.textContent).not.toContain("met-mayor");
    expect(storyFlags?.textContent).toContain("스토리 플래그 (읽기 전용)");
    expect(storyFlags?.textContent).toContain("met-mayor");
  });

  // fix(db): 스위치/변수 이름 입력란이 키 입력마다 recordProjectSnapshot(비-코얼레스)을
  // 부르는 renameSwitch/renameVariable을 직접 호출해, 5글자 타이핑을 되돌리려면 Ctrl+Z를
  // 5번 눌러야 했다(qa-system-report.md). terms 필드와 동일한 recordCoalescedSnapshot으로
  // 맞춰 키 입력 스트림 전체가 undo 1스텝으로 병합돼야 한다.
  it("coalesces keystroke-by-keystroke switch renames into a single undo snapshot", () => {
    const host = renderUtility(renderSwitchesTab);
    findByTestId(host, "db-add-switch")?.click();
    resetMapEditHistory(); // isolate the rename snapshot count from the add snapshot

    const input = findByTestId(host, "db-utility-selected-name");
    if (!input) throw new Error("missing selected switch input");
    for (const next of ["H", "HE", "HEL", "HELL", "HELLO"]) {
      input.value = next;
      input.dispatchEvent(new Event("input"));
    }
    expect(namedSwitches()).toEqual([{ id: "sw_0001", name: "HELLO" }]);

    const undone = undoMapEdit();
    expect(undone).toBe(true);
    // one snapshot for the whole keystroke stream — reverts straight back to the
    // pre-typing name ("새 스위치"), not one letter at a time.
    expect(namedSwitches()).toEqual([{ id: "sw_0001", name: "새 스위치" }]);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  // fix(db): 용어 탭의 직행 store.update가 undo 스냅샷을 안 남겼다 — 다른 유틸리티 뷰
  // 필드는 Ctrl+Z가 되는데 용어만 안 되는 비일관 상태였다.
  it("records an undo snapshot when a term field changes, and undo restores the previous value", () => {
    expect(getMapEditHistoryState().canUndo).toBe(false);
    const host = renderUtility(renderTermsTab);
    const before = store.getCurrent().meta.terms.skill;

    const skillTerm = findByTestId(host, "db-field-skill-term");
    if (!skillTerm) throw new Error("missing skill term field");
    skillTerm.value = "Arts";
    skillTerm.dispatchEvent(new Event("input"));

    expect(store.getCurrent().meta.terms.skill).toBe("Arts");
    expect(getMapEditHistoryState().canUndo).toBe(true);

    const undone = undoMapEdit();

    expect(undone).toBe(true);
    expect(store.getCurrent().meta.terms.skill).toBe(before);
  });
});
