import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { numberField } from "@/editor/panels/databaseControls";
import { FakeElement, installFakeDom } from "./fakeDom";

// P4: numberField 가 클램프 후 input.value 를 되쓰지 않아(percentField 와 패턴 불일치)
// 화면과 저장값이 어긋나던 결함 회귀 방지. blur(change) 시 표시가 반드시 정규화돼야 한다.
let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function renderNumberField(
  value: number,
  bounds?: { min: number; max: number }
): { input: FakeElement; committed: number[] } {
  const committed: number[] = [];
  const field = numberField("테스트", "test-number-field", value, (next) => committed.push(next), bounds);
  const input = (field as unknown as FakeElement).querySelector("input");
  if (!input) throw new Error("numberField 가 input 을 렌더하지 않음");
  return { input, committed };
}

describe("numberField bounds clamp + display write-back (P4)", () => {
  it("clamps over-max input immediately and rewrites the visible value", () => {
    const { input, committed } = renderNumberField(50, { min: 0, max: 100 });
    input.value = "500000";
    input.dispatchEvent(new Event("input"));
    expect(committed.at(-1)).toBe(100);
    expect(input.value).toBe("100");
  });

  it("clamps under-min input and rewrites the visible value", () => {
    const { input, committed } = renderNumberField(50, { min: 0, max: 100 });
    input.value = "-50";
    input.dispatchEvent(new Event("input"));
    expect(committed.at(-1)).toBe(0);
    expect(input.value).toBe("0");
  });

  it("normalizes the display on blur(change) — cleared field shows the clamped floor", () => {
    const { input, committed } = renderNumberField(50, { min: 1, max: 99 });
    input.value = "";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("change"));
    expect(input.value).toBe("1");
    expect(committed.at(-1)).toBe(1);
  });

  it("sets min/max attributes when bounds are provided", () => {
    const { input } = renderNumberField(5, { min: 0, max: 100 });
    expect(input.getAttribute("min")).toBe("0");
    expect(input.getAttribute("max")).toBe("100");
  });

  it("without bounds keeps raw commits but still normalizes NaN display on blur", () => {
    const { input, committed } = renderNumberField(5);
    input.value = "1234";
    input.dispatchEvent(new Event("input"));
    expect(committed.at(-1)).toBe(1234);
    expect(input.value).toBe("1234");
    input.value = "";
    input.dispatchEvent(new Event("change"));
    expect(input.value).toBe("0");
  });

  it("does not rewrite the field while typing an in-range value (no cursor jump)", () => {
    const { input } = renderNumberField(5, { min: 0, max: 100 });
    input.value = "42";
    input.dispatchEvent(new Event("input"));
    expect(input.value).toBe("42");
  });
});
