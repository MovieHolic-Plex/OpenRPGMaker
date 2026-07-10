import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

// P2/P8 회귀 스펙(qa-battle Major): 셀 값을 인라인 수정한 직후 '셀 추가/삭제'를 누르면
// 렌더 시점 셀 배열(스테일 클로저)이 프레임을 덮어써 방금 수정한 값이 조용히 롤백되던 결함.
let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  resetMapEditHistory();
  editorState.set({ selectedAnimationFrameIndex: 0, selectedAnimationCellIndex: 0 });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function renderForm(): { form: FakeElement; animationId: string } {
  const animation = store.getCurrent().database.battleAnimations[0];
  if (!animation) throw new Error("expected default battle animation");
  const form = el("div") as unknown as FakeElement;
  renderBattleAnimationRecordForm(form as unknown as HTMLElement, animation);
  return { form, animationId: animation.id };
}

function storedCells(animationId: string): readonly { x: number }[] {
  const record = store.getCurrent().database.battleAnimations.find((entry) => entry.id === animationId);
  return record?.frames?.[0]?.cells ?? [];
}

describe("battle animation cell mutations refetch from the store (P2)", () => {
  it("keeps an inline cell edit when 셀 추가 is clicked right after", () => {
    const { form, animationId } = renderForm();
    const xInput = findByTestId(form, "db-animation-cell-x-0");
    if (!xInput) throw new Error("missing cell x input");
    xInput.value = "55";
    xInput.dispatchEvent(new Event("input"));
    expect(storedCells(animationId)[0]?.x).toBe(55);

    const add = findByTestId(form, "db-animation-cell-add");
    if (!add) throw new Error("missing cell add button");
    add.dispatchEvent(new Event("click"));

    const cells = storedCells(animationId);
    expect(cells.length).toBe(2);
    // 스테일 클로저였다면 여기서 x 가 0 으로 롤백된다.
    expect(cells[0]?.x).toBe(55);
  });

  it("keeps an inline cell edit when another cell is deleted right after", () => {
    const { form, animationId } = renderForm();
    // 셀을 하나 늘려 2개로 만든 뒤 다시 그린다.
    const add = findByTestId(form, "db-animation-cell-add");
    if (!add) throw new Error("missing cell add button");
    add.dispatchEvent(new Event("click"));
    expect(storedCells(animationId).length).toBe(2);

    const form2 = el("div") as unknown as FakeElement;
    const animation = store.getCurrent().database.battleAnimations.find((entry) => entry.id === animationId);
    if (!animation) throw new Error("missing animation");
    renderBattleAnimationRecordForm(form2 as unknown as HTMLElement, animation);

    const xInput = findByTestId(form2, "db-animation-cell-x-0");
    if (!xInput) throw new Error("missing cell x input");
    xInput.value = "77";
    xInput.dispatchEvent(new Event("input"));

    const deleteSecond = findByTestId(form2, "db-animation-cell-delete-1");
    if (!deleteSecond) throw new Error("missing cell delete button");
    deleteSecond.dispatchEvent(new Event("click"));

    const cells = storedCells(animationId);
    expect(cells.length).toBe(1);
    expect(cells[0]?.x).toBe(77);
  });
});
