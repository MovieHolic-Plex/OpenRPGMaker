import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import { renderAutoApproveToggle } from "@/editor/panels/aiProposalCard";

describe("renderAutoApproveToggle", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("renderAutoApproveToggle({checked:false}) produces container with unchecked input and correct label text", () => {
    const container = renderWithFakeDom(() =>
      renderAutoApproveToggle({ checked: false, onChange: () => {} })
    );

    expect(container.dataset.testid).toBe("ai-proposal-auto-approve");
    expect(container.className).toContain("ai-proposal-auto-approve");

    const input = findByTestId(container, "ai-proposal-auto-approve-input") as FakeElement | null;
    expect(input).not.toBeNull();
    expect(input?.checked).toBe(false);

    const labelSpan = container.querySelector(".ai-proposal-auto-approve-label") as FakeElement | null;
    expect(labelSpan).not.toBeNull();
    expect(labelSpan?.textContent).toBe("앞으로 자동 적용");
  });

  it("renderAutoApproveToggle({checked:true}) renders the input checked", () => {
    const container = renderWithFakeDom(() =>
      renderAutoApproveToggle({ checked: true, onChange: () => {} })
    );

    const input = findByTestId(container, "ai-proposal-auto-approve-input") as FakeElement | null;
    expect(input).not.toBeNull();
    expect(input?.checked).toBe(true);
  });

  it("dispatching a change event after changing input.checked calls onChange with next boolean", () => {
    const onChange = vi.fn();
    const container = renderWithFakeDom(() =>
      renderAutoApproveToggle({ checked: false, onChange })
    );

    const input = findByTestId(container, "ai-proposal-auto-approve-input") as FakeElement | null;
    expect(input).not.toBeNull();

    // 1. Unchecked -> Checked
    if (input) input.checked = true;
    input?.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);

    // 2. Checked -> Unchecked
    if (input) input.checked = false;
    input?.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("sets the exact title attribute on the container for user guidance", () => {
    const container = renderWithFakeDom(() =>
      renderAutoApproveToggle({ checked: false, onChange: () => {} })
    );

    expect(container.getAttribute("title")).toBe(
      "켜면 안전한 변경은 검토 없이 바로 적용됩니다. 파괴적 변경과 재료 합의는 계속 승인을 요구합니다."
    );
  });
});
