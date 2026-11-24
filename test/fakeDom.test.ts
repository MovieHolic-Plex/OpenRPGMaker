import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushFakeAnimationFrames, installFakeDom, FakeElement, FakeNode } from "./fakeDom";
import { getAutoKeyedDataUrl } from "@/editor/panels/chromaKey";
import { Window } from "happy-dom";
import { createAiStickyChecklist } from "@/editor/panels/aiStickyChecklist";
import type { AcceptanceSnapshot } from "@/ai/assistantAcceptance";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";
import { isolateTimers } from "./mergedTeardown";

describe("fakeDomAudioContract", () => {
  isolateTimers();
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

    it("reports an adopted descendant replacement without leaving duplicate ownership", () => {
      const parent = document.createElement("div");
      const wrapper = document.createElement("section");
      const preview = document.createElement("audio");
      wrapper.append(preview);
      parent.append(wrapper);
      const observer = new MutationObserver(() => undefined);
      observer.observe(parent, { childList: true, subtree: true });

      wrapper.replaceWith(preview);

      expect(Array.from(parent.childNodes)).toEqual([preview]);
      expect(wrapper.childNodes).toHaveLength(0);
      expect(preview.parentNode).toBe(parent);
      expect(wrapper.parentNode).toBeNull();
      const records = observer.takeRecords();
      expect(records.map(record => [record.target, Array.from(record.addedNodes), Array.from(record.removedNodes)]))
        .toEqual([[wrapper, [], [preview]], [parent, [preview], [wrapper]]]);
      observer.disconnect();
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
});

describe("fakeDomImageGlobal", () => {
  isolateTimers();
  describe("fake DOM Image global", () => {
    let preInstallImage: PropertyDescriptor | undefined;
    let restore: (() => void) | null = null;

    beforeEach(() => {
      preInstallImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
      restore = installFakeDom();
    });

    afterEach(() => {
      restore?.();
      restore = null;
    });

    it("constructs an IMG-shaped FakeElement without throwing", () => {
      const image = new Image();
      expect(image).toBeInstanceOf(FakeElement);
      expect(image.tagName).toBe("IMG");
      expect(image.naturalWidth).toBe(0);
      expect(image.naturalHeight).toBe(0);
    });

    it("dispatches error exactly once when src is assigned", async () => {
      const image = new Image();
      let errorCount = 0;
      let loadCount = 0;
      const fired = new Promise<void>((resolve) => {
        image.addEventListener("error", () => {
          errorCount += 1;
          resolve();
        });
      });
      image.addEventListener("load", () => {
        loadCount += 1;
      });
      image.src = "https://example.invalid/sheet.png";
      expect(errorCount).toBe(0);
      await fired;
      expect(errorCount).toBe(1);
      expect(loadCount).toBe(0);
    });

    it("lets getAutoKeyedDataUrl resolve to the original url instead of rejecting", async () => {
      const url = "https://example.invalid/fake-dom-auto-key.png";
      await expect(getAutoKeyedDataUrl(url)).resolves.toBe(url);
    });

    it("restores the pre-install Image global on teardown", () => {
      expect(Object.getOwnPropertyDescriptor(globalThis, "Image")).toBeDefined();
      restore?.();
      restore = null;
      const after = Object.getOwnPropertyDescriptor(globalThis, "Image");
      expect(after?.value).toBe(preInstallImage?.value);
      expect("Image" in globalThis).toBe(preInstallImage !== undefined);
    });
  });
});

describe("fakeDomInsertBefore", () => {
  isolateTimers();
  describe("acceptance checklist DOM insertion", () => {
    it("moves an existing row without duplication and supports append and self insertion", () => {
      const list = new FakeNode(), first = new FakeNode(), second = new FakeNode();
      list.append(first, second);
      expect(list.insertBefore(second, first)).toBe(second);
      expect(list.childNodes).toEqual([second, first]);
      list.insertBefore(second, second);
      expect(list.childNodes).toEqual([second, first]);
      list.insertBefore(second, null);
      expect(list.childNodes).toEqual([first, second]);
      expect(second.parentNode).toBe(list);
    });
    it("detaches a row from its previous list and rejects a foreign reference", () => {
      const previous = new FakeNode(), next = new FakeNode(), row = new FakeNode(), foreign = new FakeNode();
      previous.append(row);
      next.insertBefore(row, null);
      expect(previous.childNodes).toEqual([]);
      expect(next.childNodes).toEqual([row]);
      expect(row.parentNode).toBe(next);
      expect(() => next.insertBefore(row, foreign)).toThrow();
      expect(next.childNodes).toEqual([row]);
    });
  });
});

describe("fakeDomNumericInput", () => {
  isolateTimers();
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
});

describe("fakeDomSelectContracts", () => {
  isolateTimers();
  let restore = (): void => {};
  afterEach(() => { vi.restoreAllMocks(); restore(); });
  describe("fake DOM select/adoption contracts", () => {
    function documentForTest(): Document {
      restore = installFakeDom();
      return document;
    }

    function fixture() {
      const doc = documentForTest();
      const select = doc.createElement("select");
      const first = doc.createElement("option");
      first.value = "first";
      const group = doc.createElement("optgroup");
      const second = doc.createElement("option");
      second.value = "second";
      group.append(second);
      select.append(first, group);
      return { doc, select, first, group, second };
    }

    it("flattens optgroups and aligns value, selectedIndex, selected and option.index", () => {
      const { select, first, second, group } = fixture();
      expect(Array.from(select.options)).toEqual([first, second]);
      expect([select.value, select.selectedIndex, first.index, second.index]).toEqual(["first", 0, 0, 1]);
      select.value = "second";
      expect([select.selectedIndex, first.selected, second.selected]).toEqual([1, false, true]);
      select.prepend(group);
      expect([select.value, select.selectedIndex, second.index, first.index]).toEqual(["second", 0, 0, 1]);
      select.selectedIndex = first.index;
      expect([select.value, first.selected, second.selected]).toEqual(["first", true, false]);
    });

    it("clears invalid selections, chooses one duplicate value, and recovers on insertion", () => {
      const { select, first, second, doc } = fixture();
      second.value = first.value;
      select.value = first.value;
      expect([select.selectedIndex, first.selected, second.selected]).toEqual([0, true, false]);
      select.value = "missing";
      expect([select.value, select.selectedIndex, first.selected, second.selected]).toEqual(["", -1, false, false]);
      select.append(doc.createElement("option"));
      expect(select.selectedIndex).toBe(0);
      select.selectedIndex = 99;
      expect([select.value, select.selectedIndex]).toEqual(["", -1]);
      select.selectedIndex = -1;
      expect(select.selectedIndex).toBe(-1);
    });

    it("honors selected options, disabled defaults and removal of the selected optgroup", () => {
      const { doc, select, first, second, group } = fixture();
      second.selected = true;
      expect([select.value, first.selected, second.selected]).toEqual(["second", false, true]);
      group.remove();
      expect([select.value, select.selectedIndex, second.index]).toEqual(["first", 0, 0]);
      first.disabled = true;
      const disabledGroup = doc.createElement("optgroup");
      disabledGroup.disabled = true;
      disabledGroup.append(doc.createElement("option"));
      select.replaceChildren(first, disabledGroup, group);
      first.selected = false;
      expect(select.value).toBe("second");
      const chosen = doc.createElement("option");
      chosen.value = "chosen";
      chosen.setAttribute("selected", "");
      select.append(chosen);
      expect([select.value, select.selectedIndex, second.selected]).toEqual(["chosen", 3, false]);
    });

    it("uses option text as fallback value and label, preserving explicit empty values", () => {
      const doc = documentForTest();
      const option = doc.createElement("option");
      option.textContent = "  Text\n label  ";
      expect([option.value, option.label]).toEqual(["Text label", "Text label"]);
      option.setAttribute("label", "Display");
      option.value = "";
      expect([option.value, option.label]).toEqual(["", "Display"]);
      option.removeAttribute("value");
      option.removeAttribute("label");
      expect([option.value, option.label]).toEqual(["Text label", "Text label"]);
    });

    it("adopts into enhanced wrappers and unwraps without duplicate ownership", () => {
      const { doc, select } = fixture();
      const host = doc.createElement("div"), wrapper = doc.createElement("span"), tail = doc.createElement("button");
      host.append(select, tail);
      host.insertBefore(wrapper, select);
      wrapper.append(select);
      expect(Array.from(host.childNodes)).toEqual([wrapper, tail]);
      expect(Array.from(wrapper.childNodes)).toEqual([select]);
      host.insertBefore(select, wrapper);
      wrapper.remove();
      expect(Array.from(host.childNodes)).toEqual([select, tail]);
      expect(wrapper.childNodes.length).toBe(0);
      expect(wrapper.parentNode).toBeNull();
      host.prepend(tail, select);
      expect(Array.from(host.childNodes)).toEqual([tail, select]);
      host.append(tail, tail);
      expect(Array.from(host.childNodes)).toEqual([select, tail]);
    });

    it("replaces with adopted siblings and descendants, including self replacement", () => {
      const doc = documentForTest();
      const host = doc.createElement("div"), first = doc.createElement("span"), middle = doc.createElement("span"), last = doc.createElement("span");
      host.append(first, middle, last);
      middle.replaceWith(last, first, middle);
      expect(Array.from(host.childNodes)).toEqual([last, first, middle]);
      const inner = doc.createElement("select");
      middle.append(inner);
      middle.replaceWith(inner);
      expect(Array.from(host.childNodes)).toEqual([last, first, inner]);
      expect(middle.parentNode).toBeNull();
      expect(middle.childNodes.length).toBe(0);
    });

    it("clears parent links on removal, text replacement and replaceChildren", () => {
      const { doc, select } = fixture();
      const host = doc.createElement("div");
      host.append(select);
      expect(host.removeChild(select)).toBe(select);
      expect(select.parentNode).toBeNull();
      expect(() => host.removeChild(select)).toThrow();
      host.append(select);
      host.textContent = "replacement";
      expect(select.parentNode).toBeNull();
      expect(() => host.insertBefore(doc.createElement("span"), select)).toThrow();
      host.replaceChildren(select);
      expect(host.textContent).toBe("");
      host.replaceChildren();
      expect(select.parentNode).toBeNull();
      expect(host.textContent).toBe("");
    });
  });
  it("matches Happy DOM for grouped selection, wrapper adoption and cleanup", () => {
    // Happy DOM's duplicate-value, label and self-replacement implementations differ
    // from browsers. Those edge assertions above were checked against Firefox instead.
    function trace(doc: Document) {
      const host = doc.createElement("div"), wrapper = doc.createElement("span");
      const select = doc.createElement("select"), group = doc.createElement("optgroup");
      const first = doc.createElement("option"), second = doc.createElement("option");
      first.value = "first"; second.value = "second";
      group.append(second); select.append(first, group); host.append(select);
      const initial = [select.value, select.selectedIndex, first.index, second.index];
      select.value = "second";
      const changed = [select.value, select.selectedIndex, first.selected, second.selected];
      host.insertBefore(wrapper, select); wrapper.append(select);
      const wrapped = [host.children.length, wrapper.children.length, select.parentElement === wrapper];
      host.insertBefore(select, wrapper); wrapper.remove();
      const unwrapped = [host.children.length, wrapper.children.length, wrapper.parentNode === null];
      host.textContent = "";
      return { initial, changed, wrapped, unwrapped, detached: select.parentNode === null };
    }
    restore = installFakeDom();
    expect(trace(document)).toEqual(trace(new Window().document as unknown as Document));
  });
  it("recognizes only SELECT elements and exposes current selectedOptions", () => {
    restore = installFakeDom();
    expect(document.createElement("div") instanceof HTMLSelectElement).toBe(false);
    expect(new FakeElement("select") instanceof HTMLSelectElement).toBe(true);
    const select = document.createElement("select");
    const first = document.createElement("option"), second = document.createElement("option");
    const group = document.createElement("optgroup");
    group.append(second);
    select.append(first, group);
    expect(Array.from(select.selectedOptions)).toEqual([first]);
    select.selectedIndex = 1;
    expect(Array.from(select.selectedOptions)).toEqual([second]);
    select.selectedIndex = -1;
    expect(Array.from(select.selectedOptions)).toEqual([]);
  });
  it("runs real select refresh, menu selection and disposal without wrapping the dialog root", async () => {
    restore = installFakeDom();
    // Geometry is a fixture; menu construction, selection, events and cleanup are real.
    Object.defineProperty(document, "documentElement", { value: { clientWidth: 800, clientHeight: 600 } });
    const host = document.createElement("section"), select = document.createElement("select");
    const first = document.createElement("option"), second = document.createElement("option");
    first.value = "first"; second.value = "second";
    first.textContent = "First"; second.textContent = "Second";
    select.append(first, second);
    host.append(select);
    document.body.append(host);
    const controller = installEventEditorCustomSelects(host);
    let focusTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      expect(Array.from(document.body.children)).toEqual([host]);
      expect(host.querySelectorAll("select")).toHaveLength(1);
      expect(host.querySelectorAll(".event-custom-select-trigger")).toHaveLength(1);
      expect(select.parentElement?.parentElement).toBe(host);
      select.selectedIndex = 1;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      expect(host.querySelector(".event-custom-select-value")?.textContent).toBe(second.textContent);
      controller.refresh();
      expect(host.querySelectorAll("select")).toHaveLength(1);
      const trigger = host.querySelector<HTMLButtonElement>(".event-custom-select-trigger")!;
      trigger.click();
      const rows = host.querySelectorAll<HTMLButtonElement>(".event-custom-select-option");
      expect(rows).toHaveLength(2);
      expect(rows[1]?.getAttribute("aria-selected")).toBe("true");
      const events: string[] = [];
      host.addEventListener("input", () => events.push("input"));
      host.addEventListener("change", () => events.push("change"));
      const focus = trigger.focus.bind(trigger);
      const focused = new Promise<void>((resolve, reject) => {
        focusTimeout = setTimeout(() => reject(new Error("Menu selection did not restore focus")), 1000);
        vi.spyOn(trigger, "focus").mockImplementation((options) => { focus(options); resolve(); });
      });
      rows[0]!.click();
      expect([select.value, select.selectedIndex]).toEqual(["first", 0]);
      expect(events).toEqual(["input", "change"]);
      expect(host.querySelector(".event-custom-select-value")?.textContent).toBe(first.textContent);
      expect(host.querySelector(".event-custom-select-popover")).toBeNull();
      await focused;
      expect(document.activeElement).toBe(trigger);
    } finally {
      clearTimeout(focusTimeout);
      controller.dispose();
    }
    expect(Array.from(host.children)).toEqual([select]);
    expect(select.getAttribute("aria-hidden")).toBeNull();
    expect(select.dataset.eventCustomSelect).toBeUndefined();
    expect((select as unknown as FakeElement).hasListener("change")).toBe(false);
    expect((host as unknown as FakeElement).hasListener("scroll")).toBe(false);
    host.remove();
    expect(document.body.children).toHaveLength(0);
  });
  it("keeps real acceptance checklist row identity while reordering, removing and clearing", () => {
    restore = installFakeDom();
    const checklist = createAiStickyChecklist();
    const snapshot: AcceptanceSnapshot = { id: "contract", goal: "fixture", status: "working", items: [
      { id: "first", title: "first", status: "working", evidence: [] },
      { id: "second", title: "second", status: "pending", evidence: [] },
    ] };
    try {
      checklist.update(snapshot);
      const rows = Array.from(checklist.root.querySelectorAll<HTMLElement>(".ai-sticky-item"));
      expect(rows.map(row => row.dataset.itemId)).toEqual(["first", "second"]);
      // Input order cannot override working-before-pending priority.
      checklist.update({ ...snapshot, items: [...snapshot.items].reverse() });
      const priorityRows = Array.from(checklist.root.querySelectorAll(".ai-sticky-item"));
      expect(priorityRows).toHaveLength(2);
      expect(priorityRows[0]).toBe(rows[0]);
      expect(priorityRows[1]).toBe(rows[1]);
      // Swap priorities in the original input order: the existing keyed rows must move.
      checklist.update({ ...snapshot, items: [
        { ...snapshot.items[0]!, status: "pending" },
        { ...snapshot.items[1]!, status: "working" },
      ] });
      const reordered = Array.from(checklist.root.querySelectorAll(".ai-sticky-item"));
      expect(reordered).toEqual([...rows].reverse());
      expect(reordered[0]).toBe(rows[1]);
      expect(reordered[1]).toBe(rows[0]);
      checklist.update({ ...snapshot, items: [snapshot.items[1]!] });
      expect(rows[0]!.parentNode).toBeNull();
      expect(Array.from(checklist.root.querySelectorAll(".ai-sticky-item"))).toEqual([rows[1]]);
      checklist.update(null);
      expect(rows[1]!.parentNode).toBeNull();
      expect(checklist.root.isConnected).toBe(false);
      expect(document.body.children).toHaveLength(0);
    } finally {
      checklist.dispose();
    }
  });
});
