import { afterEach, describe, expect, it } from "vitest";
import { installFakeDom, type FakeElement } from "./fakeDom";

let restore: (() => void) | null = null;
afterEach(() => { restore?.(); restore = null; });

function selectWithOptions(values: readonly string[], selected?: string): FakeElement {
  restore = installFakeDom();
  const select = document.createElement("select") as unknown as FakeElement;
  for (const value of values) {
    const option = document.createElement("option") as unknown as FakeElement;
    option.setAttribute("value", value);
    option.textContent = value;
    select.append(option as unknown as Node);
  }
  if (selected !== undefined) select.value = selected;
  document.body.append(select as unknown as Node);
  return select;
}

describe("FakeElement select native indexing", () => {
  it("empty select has no options and selectedIndex -1", () => {
    restore = installFakeDom();
    const select = document.createElement("select") as unknown as FakeElement;
    expect(select.options).toHaveLength(0);
    expect(select.options[0]).toBeUndefined();
    expect(select.options.item?.(0)).toBeNull();
    expect(select.selectedIndex).toBe(-1);
    expect(select.selectedOptions).toEqual([]);
  });

  it("defaults selectedIndex to the first option when value is empty", () => {
    const select = selectWithOptions(["alpha", "beta"]);
    expect(select.options).toHaveLength(2);
    expect(select.selectedIndex).toBe(0);
    expect(select.options[select.selectedIndex]?.value).toBe("alpha");
    expect(select.selectedOptions).toHaveLength(1);
    expect(select.selectedOptions[0]?.value).toBe("alpha");
  });

  it("selectedIndex setter updates value and selectedOptions", () => {
    const select = selectWithOptions(["alpha", "beta", "gamma"]);
    select.selectedIndex = 2;
    expect(select.value).toBe("gamma");
    expect(select.selectedIndex).toBe(2);
    expect(select.options.item?.(2)?.value).toBe("gamma");
    expect(select.selectedOptions[0]?.value).toBe("gamma");
  });

  it("out-of-range selectedIndex clears the value like a native select", () => {
    const select = selectWithOptions(["alpha", "beta"]);
    select.selectedIndex = 1;
    select.selectedIndex = -1;
    expect(select.value).toBe("");
    select.selectedIndex = 9;
    expect(select.value).toBe("");
  });

  it("value assignment selects the matching option index", () => {
    const select = selectWithOptions(["alpha", "beta", "gamma"]);
    select.value = "beta";
    expect(select.selectedIndex).toBe(1);
    expect(select.options[1]).toBe(select.selectedOptions[0]);
  });

  it("option.index follows live options order after insert", () => {
    const select = selectWithOptions(["keep", "tail"]);
    const extra = document.createElement("option") as unknown as FakeElement;
    extra.setAttribute("value", "head");
    extra.textContent = "head";
    select.prepend(extra as unknown as Node);
    expect(extra.index).toBe(0);
    expect((select.options[1] as FakeElement).index).toBe(1);
    expect(select.options.namedItem?.("missing")).toBeNull();
  });

  it("non-select elements do not pretend to be option lists", () => {
    restore = installFakeDom();
    const div = document.createElement("div") as unknown as FakeElement;
    expect(div.options).toEqual([]);
    expect(div.selectedIndex).toBe(-1);
    div.selectedIndex = 3;
    expect(div.value).toBe("");
  });
});
