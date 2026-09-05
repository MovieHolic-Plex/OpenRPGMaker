import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

// Wave 3 — 프레임 행/이전·다음이 editorState만 바꾸고 폼을 다시 그리지 않던 결함.
let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  // 스테이지 프리뷰가 chromaKey Image를 띄우므로 노드 테스트에서 거절만 막는다.
  (globalThis as unknown as { Image: new () => object }).Image = class {
    addEventListener(): void {}
    set src(_value: string) {}
  };
  store.replace(createBlankProject());
  resetMapEditHistory();
  editorState.set({ selectedAnimationFrameIndex: 0, selectedAnimationCellIndex: 0 });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function renderForm(): FakeElement {
  const animation = store.getCurrent().database.battleAnimations[0];
  if (!animation) throw new Error("expected default battle animation");
  const form = el("div") as unknown as FakeElement;
  renderBattleAnimationRecordForm(form as unknown as HTMLElement, animation);
  return form;
}

function requireTestId(root: FakeElement, testid: string): FakeElement {
  const node = findByTestId(root, testid);
  if (!node) throw new Error(`missing ${testid}`);
  return node;
}

describe("battle animation frame selection rerenders the form", () => {
  it("binds the visible graphic name to catalog selection, cancel and clear", () => {
    const form = renderForm();
    const catalog = listDatabaseResourceOptions("battle", store.getCurrent());
    const selectedId = store.getCurrent().database.battleAnimations[0].resourceId;
    const selected = catalog.find((entry) => entry.id === selectedId)!;
    expect(form.querySelector(".db-resource-picker-inline-name")?.textContent).toBe(selected.name);
    const body = document.body as unknown as FakeElement;
    const next = catalog.find((entry) => entry.id !== selectedId)!;
    const open = () => requireTestId(form, "db-field-animation-resource-set").dispatchEvent(new Event("click"));
    const action = (suffix: string) => requireTestId(body, `db-field-animation-resource-dialog-${suffix}`).dispatchEvent(new Event("click"));
    open(); action(`option-${next.id}`); action("cancel");
    expect(store.getCurrent().database.battleAnimations[0].resourceId).toBe(selectedId);
    expect(form.querySelector(".db-resource-picker-inline-name")?.textContent).toBe(selected.name);
    open(); action(`option-${next.id}`); action("ok");
    expect(store.getCurrent().database.battleAnimations[0].resourceId).toBe(next.id);
    expect(form.querySelector(".db-resource-picker-inline-name")?.textContent).toBe(next.name);
    open(); action("clear");
    expect(store.getCurrent().database.battleAnimations[0].resourceId).toBeUndefined();
    expect(requireTestId(form, "db-field-animation-resource").value).toBe("");
    expect(form.querySelector(".db-animation-stage-cell")).toBeNull();
  });

  it("row click marks the row active and swaps the cell table to that frame", () => {
    const form = renderForm();
    expect(requireTestId(form, "db-animation-frame-0").classList.contains("active")).toBe(true);
    expect(requireTestId(form, "db-animation-cell-pattern-0").value).toBe("0");

    requireTestId(form, "db-animation-frame-1").dispatchEvent(new Event("click"));

    expect(requireTestId(form, "db-animation-frame-1").classList.contains("active")).toBe(true);
    expect(requireTestId(form, "db-animation-frame-0").classList.contains("active")).toBe(false);
    expect(requireTestId(form, "db-animation-cell-pattern-0").value).toBe("1");
  });

  it("다음 advances the selected frame and cell table", () => {
    const form = renderForm();
    requireTestId(form, "db-animation-frame-next").dispatchEvent(new Event("click"));

    expect(requireTestId(form, "db-animation-frame-1").classList.contains("active")).toBe(true);
    expect(requireTestId(form, "db-animation-cell-pattern-0").value).toBe("1");
  });
});
