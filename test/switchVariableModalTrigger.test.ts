import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  databasePicker,
  switchPicker,
  switchVariablePicker,
  variablePicker,
} from "@/editor/panels/eventEditor/switchVariablePicker";
import { openRecordPickerPanel } from "@/editor/panels/eventEditor/recordPickerDialog";
import type { FakeElement } from "./fakeDom";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

vi.mock("@/editor/panels/eventEditor/recordPickerDialog", () => ({
  openRecordPickerPanel: vi.fn(),
}));

/**
 * 변수·스위치 선택 UX 통일 계약 (2026-08):
 * - visible 네이티브 드롭다운과 인라인 검색 필터는 제거된다.
 * - 현재 선택값을 보여 주는 단일 트리거 버튼만 남고, 클릭 시 커스텀 모달
 *   (openRecordPickerPanel → 검색/참조 수/이름 편집 내장)을 연다.
 * - 숨은 네이티브 select 는 Playwright selectOption / 폼 change 파이프라인 호환을 위해
 *   DOM 에 유지되며(`event-record-modal-select` 마커), 값·레이블 동기화 계약을 지킨다.
 */
describe("switch/variable modal-trigger picker", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    project.variables[0]!.name = "골드 랭킹";
    project.switches[0]!.name = "문 열림";
    store.replace(project);
    vi.mocked(openRecordPickerPanel).mockClear();
  });

  afterEach(() => {
    restoreDom?.();
  });

  function makePicker(kind: "switch" | "variable") {
    return switchVariablePicker({
      kind,
      selectedId: "",
      onChange: vi.fn(),
      testId: `contract-${kind}`,
    });
  }

  it("renders a single modal trigger instead of an inline dropdown", () => {
    const handle = makePicker("variable");
    const body = renderWithFakeDom(() => handle.root);
    // visible dropdown 제거 계약: select 는 숨김 마커 클래스 + aria-hidden
    const select = body.querySelector("select") as FakeElement | null;
    expect(select).not.toBeNull();
    expect(select?.classList.contains("event-record-modal-select")).toBe(true);
    expect(select?.getAttribute("aria-hidden")).toBe("true");
    // 인라인 검색 필터 제거 (검색은 모달이 소유)
    expect(findByTestId(body, "event-variable-inline-filter")).toBeNull();
    // 트리거 버튼 존재 (기존 picker-open testid 승계)
    const trigger = findByTestId(body, "event-variable-picker-open") as FakeElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger?.tagName.toLowerCase()).toBe("button");
  });

  it("trigger opens the custom modal with current selection and wires onSelect back through the hidden select", () => {
    const onChange = vi.fn();
    const firstVariable = store.getCurrent().variables[0];
    if (!firstVariable) throw new Error("missing variable fixture");
    const body = renderWithFakeDom(() =>
      variablePicker({ selectedId: firstVariable.id, onChange }).root
    );
    const trigger = findByTestId(body, "event-variable-picker-open") as FakeElement;
    trigger.dispatchEvent(new Event("click"));

    expect(openRecordPickerPanel).toHaveBeenCalledTimes(1);
    const request = vi.mocked(openRecordPickerPanel).mock.calls[0]?.[0] as {
      kind: string;
      currentId: string;
      onSelect: (id: string) => void;
    };
    expect(request.kind).toBe("variable");
    expect(request.currentId).toBe(firstVariable.id);

    // 모달에서 선택 완료 시: 숨은 select 갱신 + onChange 전파
    request.onSelect(firstVariable.id);
    const select = body.querySelector("select") as FakeElement | null;
    expect(select?.value).toBe(firstVariable.id);
    expect(onChange).toHaveBeenCalledWith(firstVariable.id);
  });

  it("keeps the trigger label synced with the current selection", () => {
    const firstVariable = store.getCurrent().variables[0];
    if (!firstVariable) throw new Error("missing variable fixture");
    const second = store.getCurrent().variables[1];
    if (!second) throw new Error("missing second variable fixture");
    const handle = makePicker("variable");
    handle.setSelectedId(firstVariable.id);
    const body = renderWithFakeDom(() => handle.root);
    const trigger = findByTestId(body, "event-variable-picker-open") as FakeElement | null;
    expect(trigger?.textContent).toContain("골드 랭킹");

    handle.setSelectedId(second.id);
    expect(handle.getSelectedId()).toBe(second.id);
    expect(handle.select.value).toBe(second.id);
  });

  it("databasePicker keeps the caller-supplied testid contract while switching to modal-only UI", () => {
    const body = renderWithFakeDom(() => databasePicker("switch", "", vi.fn(), "event-command-switch-target"));
    const select = findByTestId(body, "event-command-switch-target") as FakeElement | null;
    expect(select).not.toBeNull();
    expect(findByTestId(body, "event-switch-inline-filter")).toBeNull();
    const trigger = findByTestId(body, "event-switch-picker-open") as FakeElement | null;
    expect(trigger).not.toBeNull();
    // hidden select kept interactive programmatically (selectOption / change pipeline)
    const rawSelect = body.querySelector("select") as FakeElement | null;
    expect(rawSelect?.getAttribute("aria-hidden")).toBe("true");
  });

  it("supports new ids created inside the modal (ensureOption behavior stays)", () => {
    const onChange = vi.fn();
    const body = renderWithFakeDom(() =>
      switchVariablePicker({
        kind: "variable",
        selectedId: "",
        onChange,
        keepMissingId: false,
      }).root
    );
    const request = (() => {
      const trigger = findByTestId(body, "event-variable-picker-open") as FakeElement;
      trigger.dispatchEvent(new Event("click"));
      return vi.mocked(openRecordPickerPanel).mock.calls.at(-1)?.[0] as {
        onSelect: (id: string) => void;
      };
    })();
    expect(() => request.onSelect("var_brand_new")).not.toThrow();
    const select = body.querySelector("select") as FakeElement | null;
    expect(select?.value).toBe("var_brand_new");
  });
});
