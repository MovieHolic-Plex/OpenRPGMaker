import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushFakeAnimationFrames, installFakeDom } from "./fakeDom";

describe("fake DOM audio control contracts", () => {
  let restore: () => void;
  const globalNames = ["MutationObserver", "requestAnimationFrame", "cancelAnimationFrame"] as const;
  let previousGlobals: PropertyDescriptor[];

  beforeEach(() => {
    previousGlobals = globalNames.map(name => Object.getOwnPropertyDescriptor(globalThis, name) ?? {});
    restore = installFakeDom({ animationFrames: "manual" });
  });
  afterEach(() => { restore(); });

  it("keeps select options, index and value consistent", () => {
    const select = document.createElement("select");
    const first = document.createElement("option");
    const second = document.createElement("option");
    first.value = "a"; second.value = "b";
    select.append(first, second);
    expect(Array.from(select.options)).toEqual([first, second]);
    expect(select.selectedIndex).toBe(0);
    expect(select.value).toBe("a");
    select.value = "b";
    expect(select.selectedIndex).toBe(1);
    expect(Array.from(select.selectedOptions)).toEqual([second]);
    expect(second.index).toBe(1);
    select.selectedIndex = 0;
    expect(select.value).toBe("a");
    select.selectedIndex = -1;
    expect(select.value).toBe("");
    expect(select.selectedIndex).toBe(-1);
    select.value = "b";
    expect(select.selectedIndex).toBe(1);
  });

  it("distinguishes elements, select controls and text nodes for observers", () => {
    const container = document.createElement("div");
    const select = document.createElement("select");
    const text = document.createTextNode("label");
    expect(container).toBeInstanceOf(Element);
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(container).not.toBeInstanceOf(HTMLSelectElement);
    expect(text).not.toBeInstanceOf(Element);
  });

  it("preserves the default frame capability while allowing idle cancellation", () => {
    restore();
    const previousFrame = globalThis.requestAnimationFrame;
    restore = installFakeDom();
    expect(globalThis.requestAnimationFrame).toBe(previousFrame);
    expect(() => cancelAnimationFrame(0)).not.toThrow();
  });

  it("delivers filtered attribute records with requested old values", () => {
    const element = document.createElement("div");
    const observer = new MutationObserver(() => undefined);
    observer.observe(element, { attributes: true, attributeFilter: ["data-state"], attributeOldValue: true });
    element.setAttribute("ignored", "value");
    element.setAttribute("data-state", "playing");
    element.removeAttribute("data-state");
    expect(observer.takeRecords().map(record => [record.type, record.attributeName, record.oldValue]))
      .toEqual([["attributes", "data-state", null], ["attributes", "data-state", "playing"]]);
    observer.disconnect();
  });

  it("supports combined child, class and character data observations", () => {
    const element = document.createElement("div");
    const observer = new MutationObserver(() => undefined);
    observer.observe(element, { childList: true, subtree: true, attributes: true, characterData: true, characterDataOldValue: true });
    const text = document.createTextNode("before");
    element.append(text);
    text.textContent = "after";
    element.setAttribute("class", "active");
    expect(observer.takeRecords().map(record => [record.type, record.oldValue]))
      .toEqual([["childList", null], ["characterData", "before"], ["attributes", null]]);
    observer.disconnect();
  });

  it("provides cancellable animation frames without a wall-clock timer", () => {
    const frames: number[] = [];
    const cancelled = requestAnimationFrame(time => { frames.push(time); });
    requestAnimationFrame(time => { frames.push(time); });
    cancelAnimationFrame(cancelled);
    cancelAnimationFrame(0);
    expect(frames).toEqual([]);
    flushFakeAnimationFrames(123);
    expect(frames).toEqual([123]);
  });

  it("supports idle audio teardown without claiming successful playback", () => {
    const audio = document.createElement("audio");
    audio.setAttribute("src", "https://example.invalid/preview.ogg");
    let playing = 0;
    audio.addEventListener("playing", () => { playing += 1; });
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(audio.duration).toBeNaN();
    expect(audio.getAttribute("src")).toBeNull();
    expect(playing).toBe(0);
  });

  it("delivers batched subtree child-list records after attachment and removal", async () => {
    const wrapper = document.createElement("section");
    const preview = document.createElement("div");
    wrapper.append(preview);
    let delivered = false;
    const recordsReady = new Promise<MutationRecord[]>(resolve => {
      const observer = new MutationObserver(records => {
        delivered = true;
        observer.disconnect();
        resolve(records);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    document.body.append(wrapper);
    preview.remove();
    expect(delivered).toBe(false);
    const records = await recordsReady;
    const [attachment, removal] = records;
    if (!attachment || !removal) throw new Error("Expected attachment and removal records");
    expect(records.map(record => record.type)).toEqual(["childList", "childList"]);
    expect(records.map(record => record.target)).toEqual([document.body, wrapper]);
    expect(Array.from(attachment.addedNodes)).toEqual([wrapper]);
    expect(Array.from(removal.removedNodes)).toEqual([preview]);
    expect(preview.isConnected).toBe(false);
    expect(preview.parentNode).toBeNull();
  });

  it("reports replacement as one mutation and disconnect discards queued records", () => {
    const parent = document.createElement("div");
    const old = document.createElement("span");
    parent.append(old);
    const observer = new MutationObserver(() => { throw new Error("Disconnected observer fired"); });
    observer.observe(parent, { childList: true });
    parent.replaceChildren("next");
    const records = observer.takeRecords();
    expect(records).toHaveLength(1);
    const replacement = records[0];
    if (!replacement) throw new Error("Expected a replacement record");
    expect(Array.from(replacement.removedNodes)).toEqual([old]);
    expect(Array.from(replacement.addedNodes)).toEqual(Array.from(parent.childNodes));
    expect(observer.takeRecords()).toEqual([]);
    parent.replaceChildren();
    observer.disconnect();
    expect(observer.takeRecords()).toEqual([]);
    parent.append("unobserved");
    expect(observer.takeRecords()).toEqual([]);
  });

  it("limits notifications to the observed target unless subtree is requested", () => {
    const parent = document.createElement("div");
    const child = document.createElement("section");
    parent.append(child);
    const observer = new MutationObserver(() => { throw new Error("Unrelated mutation delivered"); });
    observer.observe(parent, { childList: true });
    child.append("nested");
    document.body.append("outside");
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it("restores lifecycle globals and discards pending work on teardown", () => {
    const observer = new MutationObserver(() => { throw new Error("Observer leaked after teardown"); });
    observer.observe(document.body, { childList: true });
    document.body.append("pending");
    requestAnimationFrame(() => { throw new Error("Frame leaked after teardown"); });
    restore();
    expect(observer.takeRecords()).toEqual([]);
    flushFakeAnimationFrames();
    globalNames.forEach((name, index) => {
      expect(Object.getOwnPropertyDescriptor(globalThis, name) ?? {}).toEqual(previousGlobals[index]);
    });
  });

  it("appends mixed strings and elements as ordered child nodes", () => {
    const button: HTMLElement = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    button.append("before", icon, "after");

    expect(Array.from(button.childNodes, node => node.textContent)).toEqual(["before", "", "after"]);
    expect(button.textContent).toBe("beforeafter");
    expect(Array.from(button.children)).toEqual([icon]);
    expect(button.childElementCount).toBe(1);
    for (const node of button.childNodes) expect(node.parentNode).toBe(button);
    expect(button.childNodes[0]).toBeInstanceOf(Node);
    expect(button.childNodes[0]).not.toBeInstanceOf(HTMLElement);
  });

  it("replaces textContent and old children without retaining stale labels or parents", () => {
    const button: HTMLElement = document.createElement("button");
    const oldIcon = document.createElement("span");
    button.textContent = "old";
    button.append(oldIcon);
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    button.replaceChildren(icon, "next");

    expect(button.textContent).toBe("next");
    expect(Array.from(button.children)).toEqual([icon]);
    expect(button.childNodes).toHaveLength(2);
    expect(oldIcon.parentNode).toBeNull();
    const label = button.childNodes[1];
    expect(label?.parentNode).toBe(button);
    button.replaceChildren();
    expect(button.textContent).toBe("");
    expect(button.childNodes).toHaveLength(0);
    expect(icon.parentNode).toBeNull();
    expect(label?.parentNode).toBeNull();
  });

  it("clears textContent even when replacing with no children", () => {
    const button: HTMLElement = document.createElement("button");
    button.textContent = "old";
    button.replaceChildren();
    expect(button.textContent).toBe("");
  });

  it("moves existing nodes rather than duplicating them when appending or replacing", () => {
    const previous: HTMLElement = document.createElement("div");
    const next: HTMLElement = document.createElement("div");
    const icon = document.createElement("span");
    previous.append(icon);
    next.append(icon, icon);
    expect(previous.childNodes).toHaveLength(0);
    expect(Array.from(next.childNodes)).toEqual([icon]);
    previous.replaceChildren(icon);
    expect(next.childNodes).toHaveLength(0);
    expect(Array.from(previous.childNodes)).toEqual([icon]);
    expect(icon.parentNode).toBe(previous);
  });
});
