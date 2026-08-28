/** @vitest-environment happy-dom */
// 레코드 픽커 창의 두 계약을 고정한다.
//
// 1) 참조 수 집계는 창이 열려 있는 동안 한 번만 한다. 렌더마다 새로 만들면 검색 키
//    한 번에 프로젝트 맵 전체가 다시 직렬화된다.
// 2) 행을 클릭해 재렌더가 일어나도 포커스가 선택된 행에 남는다. 재렌더는 방금 누른
//    버튼을 파괴하므로, 옮겨 주지 않으면 body 로 떨어져 ↑↓·Enter 와 스크린리더
//    위치를 함께 잃는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openRecordPickerPanel } from "@/editor/panels/eventEditor/recordPickerPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

function picker(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-testid="event-record-picker"]');
  if (!node) throw new Error("픽커가 열리지 않았다");
  return node;
}

const rows = (): HTMLElement[] =>
  Array.from(picker().querySelectorAll<HTMLElement>(".event-record-picker-row"));

describe("레코드 픽커 창 동작", () => {
  beforeEach(() => {
    const project = createBlankProject();
    project.switches[0]!.name = "마을 축제 시작";
    project.switches[1]!.name = "마을 축제 끝남";
    store.replace(project);
  });

  afterEach(() => {
    document.querySelectorAll('[data-testid="event-record-picker"]').forEach((n) => n.remove());
    vi.restoreAllMocks();
  });

  it("검색을 여러 번 해도 프로젝트를 다시 직렬화하지 않는다", () => {
    const spy = vi.spyOn(JSON, "stringify");
    openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

    const afterOpen = spy.mock.calls.length;
    expect(afterOpen).toBeGreaterThan(0);

    const search = picker().querySelector<HTMLInputElement>(
      '[data-testid="event-record-picker-search"]',
    )!;
    for (const query of ["축", "축제", "축제 시"]) {
      search.value = query;
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // 검색 세 번이 집계 원본을 다시 만들지 않아야 한다.
    expect(spy.mock.calls.length).toBe(afterOpen);
  });

  it("행을 클릭한 뒤에도 포커스가 선택된 행에 남는다", () => {
    openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

    const second = rows()[1];
    expect(second).toBeTruthy();
    second!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const selected = picker().querySelector<HTMLElement>(".event-record-picker-row.selected");
    expect(selected).toBeTruthy();
    expect(document.activeElement).toBe(selected);
    expect(document.activeElement).not.toBe(document.body);
  });

  it("행에 포커스가 있어도 ↑↓ 로 선택을 옮길 수 있다", () => {
    openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

    const first = rows()[0]!;
    first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const before = picker()
      .querySelector<HTMLElement>(".event-record-picker-row.selected")
      ?.dataset.testid;

    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );

    const after = picker()
      .querySelector<HTMLElement>(".event-record-picker-row.selected")
      ?.dataset.testid;
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  it("Enter 는 선택을 확정하고 창을 닫는다", () => {
    const onSelect = vi.fn();
    openRecordPickerPanel({ kind: "switch", currentId: "", onSelect });

    rows()[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="event-record-picker"]')).toBeNull();
  });
});
