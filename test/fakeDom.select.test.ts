import { afterEach, describe, expect, it } from "vitest";
import { installFakeDom, type FakeElement, type FakeHTMLOptionsCollection } from "./fakeDom";

let restore: (() => void) | null = null;
afterEach(() => { restore?.(); restore = null; });

function el(tag: string): FakeElement {
  return document.createElement(tag) as unknown as FakeElement;
}

function selectWithOptions(values: readonly string[], selected?: string): FakeElement {
  restore = installFakeDom();
  const select = el("select");
  for (const value of values) {
    const option = el("option");
    option.setAttribute("value", value);
    option.textContent = value;
    select.append(option);
  }
  if (selected !== undefined) select.value = selected;
  (document.body as unknown as FakeElement).append(select);
  return select;
}

function optionsOf(select: FakeElement): FakeHTMLOptionsCollection {
  const options = select.options;
  if (!("item" in options) || typeof options.item !== "function" || typeof options.namedItem !== "function") {
    throw new Error("expected HTMLOptionsCollection on select");
  }
  return options;
}

describe("FakeElement select native indexing", () => {
  it("empty select has no options and selectedIndex -1", () => {
    restore = installFakeDom();
    const select = el("select");
    const options = optionsOf(select);
    expect(options).toHaveLength(0);
    expect(options[0]).toBeUndefined();
    expect(options.item(0)).toBeNull();
    expect(select.selectedIndex).toBe(-1);
    expect(select.selectedOptions).toEqual([]);
  });

  it("defaults selectedIndex to the first option when value is empty", () => {
    const select = selectWithOptions(["alpha", "beta"]);
    expect(optionsOf(select)).toHaveLength(2);
    expect(select.selectedIndex).toBe(0);
    expect(optionsOf(select)[select.selectedIndex]?.value).toBe("alpha");
    expect(select.selectedOptions).toHaveLength(1);
    expect(select.selectedOptions[0]?.value).toBe("alpha");
  });

  it("selectedIndex setter updates value and selectedOptions", () => {
    const select = selectWithOptions(["alpha", "beta", "gamma"]);
    select.selectedIndex = 2;
    expect(select.value).toBe("gamma");
    expect(select.selectedIndex).toBe(2);
    expect(optionsOf(select).item(2)?.value).toBe("gamma");
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
    expect(optionsOf(select)[1]).toBe(select.selectedOptions[0]);
  });

  it("option.index follows live options order after insert", () => {
    const select = selectWithOptions(["keep", "tail"]);
    const extra = el("option");
    extra.setAttribute("value", "head");
    extra.textContent = "head";
    select.prepend(extra);
    expect(extra.index).toBe(0);
    expect(optionsOf(select)[1]?.index).toBe(1);
    expect(optionsOf(select).namedItem("missing")).toBeNull();
  });

  it("non-select elements do not pretend to be option lists", () => {
    restore = installFakeDom();
    const div = el("div");
    expect(div.options).toEqual([]);
    expect(div.selectedIndex).toBe(-1);
    div.selectedIndex = 3;
    expect(div.value).toBe("");
  });
});
