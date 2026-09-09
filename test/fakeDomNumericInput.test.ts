import { describe, expect, it, vi } from "vitest";
import { FakeElement } from "./fakeDom";

function numeric(attrs: Record<string, string> = {}) {
  const input = new FakeElement("input");
  for (const [key, value] of Object.entries({ type: "number", ...attrs })) input.setAttribute(key, value);
  return input;
}

describe("fake DOM number-input fidelity", () => {
  it.each(["", " ", "NaN", "Infinity", "1e309", "0x10", "+1", "1.", "12px"])("rejects non-HTML number %j", value => {
    const input = numeric({ required: "" });
    input.value = value;
    expect(input.valueAsNumber).toBeNaN();
    const invalid = vi.fn((event: Event) => { expect(event.cancelable).toBe(true); expect(event.bubbles).toBe(false); event.preventDefault(); });
    input.addEventListener("invalid", invalid);
    expect(input.reportValidity()).toBe(false);
    expect(invalid).toHaveBeenCalledOnce();
  });

  it.each([["0", 0], ["-3", -3], [".5", 0.5], ["1.25", 1.25], ["2e2", 200]] as const)("converts %s without truncating", (raw, value) => {
    const input = numeric({ step: "any" });
    input.value = raw;
    expect(input.valueAsNumber).toBe(value);
    expect(input.reportValidity()).toBe(true);
  });

  it("checks required, bounds and step rather than reporting success unconditionally", () => {
    const input = numeric({ min: "1", max: "5", step: "2", required: "" });
    for (const value of ["", "0", "2", "6", "1.5"]) {
      input.value = value;
      expect(input.checkValidity(), value).toBe(false);
    }
    for (const value of ["1", "3", "5"]) {
      input.value = value;
      expect(input.checkValidity(), value).toBe(true);
    }
    input.value = "";
    input.removeAttribute("required");
    expect(input.reportValidity()).toBe(true);
    input.setAttribute("required", "");
    input.disabled = true;
    expect(input.reportValidity()).toBe(true);
  });

  it("uses the default integer step and value-attribute step base", () => {
    const input = numeric({ value: "0.5" });
    input.value = "1.5";
    expect(input.checkValidity()).toBe(true);
    input.value = "1";
    expect(input.checkValidity()).toBe(false);
    input.removeAttribute("value");
    expect(input.checkValidity()).toBe(true);
  });

  it("recognizes property-authored number types but not text inputs", () => {
    const input = new FakeElement("input");
    input.value = "3";
    expect(input.valueAsNumber).toBeNaN();
    input.type = "number";
    expect(input.valueAsNumber).toBe(3);
  });
});
