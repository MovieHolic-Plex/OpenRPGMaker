import { afterEach, describe, expect, it } from "vitest";
import { installFakeDom, type FakeElement } from "./fakeDom";

let restore: (() => void) | null = null;
afterEach(() => { restore?.(); restore = null; });

function el(tag: string): FakeElement {
  return document.createElement(tag) as unknown as FakeElement;
}

describe("FakeNode native parent identity", () => {
  it("append moves a child out of the previous parent instead of duplicating it", () => {
    restore = installFakeDom();
    const parent = el("div");
    const wrapper = el("span");
    const select = el("select");
    (document.body as unknown as FakeElement).append(parent);
    parent.append(select);
    parent.insertBefore(wrapper, select);
    wrapper.append(select);
    expect(parent.childNodes).toEqual([wrapper]);
    expect(wrapper.childNodes).toEqual([select]);
    expect(select.parentNode).toBe(wrapper);
    expect(parent.childNodes.filter((child) => child === select)).toHaveLength(0);
  });

  it("insertBefore relocates an existing child and removeChild clears parentNode", () => {
    restore = installFakeDom();
    const parent = el("div");
    const wrapper = el("span");
    const select = el("select");
    parent.append(wrapper, select);
    wrapper.append(select);
    parent.insertBefore(select, wrapper);
    wrapper.remove();
    expect(select.parentNode).toBe(parent);
    expect(wrapper.parentNode).toBeNull();
    expect(parent.childNodes).toEqual([select]);
  });

  it("textContent assignment clears former children's parentNode so a later adopt does not throw", () => {
    restore = installFakeDom();
    const parent = el("div");
    const child = el("span");
    const next = el("div");
    parent.append(child);
    parent.textContent = "";
    expect(child.parentNode).toBeNull();
    expect(parent.childNodes).toEqual([]);
    next.append(child);
    expect(child.parentNode).toBe(next);
    expect(next.childNodes).toEqual([child]);
  });

  it("matches uses the existing selector matcher and :disabled on form controls only", () => {
    restore = installFakeDom();
    const button = el("button");
    const div = el("div");
    button.dataset.testid = "tileset-ai-workspace-question";
    expect(button.matches('[data-testid="tileset-ai-workspace-question"]')).toBe(true);
    expect(button.matches(":disabled")).toBe(false);
    expect(div.matches(":disabled")).toBe(false);
    button.disabled = true;
    expect(button.matches(":disabled")).toBe(true);
    div.disabled = true;
    expect(div.matches(":disabled")).toBe(false);
  });
});
