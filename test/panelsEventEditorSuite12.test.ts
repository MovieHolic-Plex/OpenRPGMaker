import { expect, it, vi, afterEach, beforeEach, describe } from "vitest";
import { installFakeDom, flushFakeAnimationFrames, FakeElement, FakeNode, findByTestId, renderWithFakeDom } from "./fakeDom";
import { store } from "@/project/store";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults";
import { editorState } from "@/editor/editorState";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { navigateToEventCommand } from "@/editor/panels/eventEditor/content";
import { navigateToEventDraftIssue } from "@/editor/panels/eventEditor/validationBell";
import { selectedCommandPath } from "@/editor/panels/eventEditor/commandInspector";
import { getAutoKeyedDataUrl } from "@/editor/panels/chromaKey";
import { Window } from "happy-dom";
import { createAiStickyChecklist } from "@/editor/panels/aiStickyChecklist";
import type { AcceptanceSnapshot } from "@/ai/assistantAcceptance";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";
import { isolateTimers } from "./mergedTeardown";
import { insertGeneratedPictureAsset } from "@/editor/generatedPictureAsset";
import { faceDisplayModeOf } from "@/editor/panels/eventEditor/facesetPreview";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import type { EventPage, EventPageCondition, GameEvent, NpcScheduleEntry, Project } from "@/project/types";
import { el } from "@/util/dom";
import { validateEventDraftBody, validateEventDraft } from "@/editor/eventDraftValidator";
import { renderNpcActivityCondition } from "@/editor/panels/eventEditor/conditionForm";
import { collectNpcActivitySuggestions } from "@/editor/panels/eventEditor/options";

describe("eventValidationFakeNavigation", () => {
  isolateTimers();
  it("uses the shared navigation contract in the lightweight rendered host", () => {
    const restore = installFakeDom();
    const errors = vi.spyOn(console, "error");
    try {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      if (!map) throw new Error("Missing map");
      map.events = [{ id: "fake-nav", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
        id: "p1", name: "page", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: "missing-map", x: 0, y: 0 }],
      }] }];
      store.replaceProject(project);
      editorState.set({ currentMapId: mapId, selectedEventId: "fake-nav", selectedEventPageId: "p1" });
      openEventEditorModal(mapId, "fake-nav");
      expect(errors.mock.calls).toEqual([]);
      expect(document.querySelector('[data-testid="event-editor-modal"]')?.isConnected).toBe(true);
      expect(document.querySelectorAll("[data-cmd-path]").length).toBeGreaterThan(0);
      expect(navigateToEventCommand(mapId, "fake-nav", "p1", [0])).toBe(true);
      expect(selectedCommandPath()).toEqual([0]);
      navigateToEventDraftIssue({ pageId: "p1", commandPath: [0], code: "reference.map.missing", severity: "error", message: "" });
      expect(document.querySelector('[data-testid="event-command-transfer"]')?.className).toContain("selected");
    } finally {
      document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
      errors.mockRestore();
      restore();
    }
  });
});

describe("fakeDom", () => {
  isolateTimers();
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
});

describe("generatedPictureAsset", () => {
  isolateTimers();
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFHAP/q842iQAAAABJRU5ErkJggg==";
  describe("insertGeneratedPictureAsset", () => {
    it("dataUrl 그림을 uploaded picture 로 넣고 id 를 돌려준다", () => {
      const project = createBlankProject();
      const before = Object.keys(project.assets.uploaded).length;
      const id = insertGeneratedPictureAsset(project, { name: "달빛 창가", dataUrl: PNG });
      expect(id.length).toBeGreaterThan(0);
      expect(project.assets.uploaded[id]?.kind).toBe("picture");
      expect(project.assets.uploaded[id]?.dataUrl).toBe(PNG);
      expect(project.assets.uploaded[id]?.name).toBe("달빛 창가");
      expect(project.resourceProfiles.some((profile) => profile.assetId === id && profile.kind === "picture")).toBe(true);
      expect(Object.keys(project.assets.uploaded).length).toBe(before + 1);
    });

    it("kind 를 주면 그 kind 로 저장한다", () => {
      const project = createBlankProject();
      const faceId = insertGeneratedPictureAsset(project, { name: "검사", dataUrl: PNG, kind: "faceset" });
      expect(project.assets.uploaded[faceId]?.kind).toBe("faceset");
      expect(project.resourceProfiles.some((profile) => profile.assetId === faceId && profile.kind === "faceset")).toBe(true);
      const titleId = insertGeneratedPictureAsset(project, { name: "타이틀", dataUrl: PNG, kind: "title" });
      expect(project.assets.uploaded[titleId]?.kind).toBe("title");
      const backdropId = insertGeneratedPictureAsset(project, { name: "화산 동굴", dataUrl: PNG, kind: "backdrop" });
      expect(project.assets.uploaded[backdropId]?.kind).toBe("backdrop");
      expect(backdropId).toContain("backdrop_img");
    });

    it("faceset 생성 id 는 통짜 초상 판정을 받는다", () => {
      const project = createBlankProject();
      const id = insertGeneratedPictureAsset(project, { name: "검사", dataUrl: PNG, kind: "faceset" });
      expect(faceDisplayModeOf(id)).not.toBe("chip");
    });

    it("그림 dataUrl 이 아니면 프로젝트에 쓰지 않는다", () => {
      const project = createBlankProject();
      const before = Object.keys(project.assets.uploaded).length;
      expect(() => insertGeneratedPictureAsset(project, { name: "x", dataUrl: "not-an-image" })).toThrow();
      expect(Object.keys(project.assets.uploaded).length).toBe(before);
    });
  });
});

describe("pageConditions", () => {
  isolateTimers();
  // 페이지 조건의 "꺼짐/없음" 방향 저작 보증.
  // 런타임은 switch value:false / item present:false / actor present:false 를 정상 평가하는데
  // (src/project/io/pageResolution.ts:33-46) 좌측 "언제 보이나요" 패널은 항상 true 로만 써서
  // (a) 데이터에 있는 false 를 화면에서 볼 수 없고 (b) id 를 한 번 바꾸면 조용히 true 로 뒤집혔다.
  describe("eventPageConditionOffValue", () => {
    isolateTimers();
    const EVENT_ID = "ev-cond-off";
    function seedPage(conditions: readonly EventPageCondition[]): { mapId: string; page: EventPage } {
      const mapId = store.getCurrent().startMapId;
      const page: EventPage = {
        id: "page-off",
        name: "꺼짐 조건",
        conditions: [...conditions],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
      const event: GameEvent = {
        id: EVENT_ID,
        x: 2,
        y: 2,
        trigger: { kind: "action" },
        commands: [],
        pages: [page],
      };
      store.update((draft) => {
        const target = draft.maps[mapId];
        if (!target) return;
        target.events = [...target.events.filter((entry) => entry.id !== EVENT_ID), structuredClone(event)];
      });
      return { mapId, page: livePage(mapId) };
    }
    function livePage(mapId: string): EventPage {
      const page = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === EVENT_ID)?.pages?.[0];
      if (!page) throw new Error("live page missing");
      return page;
    }
    function render(mapId: string, page: EventPage) {
      return renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));
    }
    describe("페이지 조건: 꺼짐/없음 방향 저작", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("스위치 조건의 켜짐/꺼짐 셀렉트가 저장된 value 를 보여준다", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_a";
        const { mapId, page } = seedPage([{ kind: "switch", switchId, value: false }]);
        const root = render(mapId, page);
        const value = findByTestId(root, "event-page-switch-condition-value");
        expect(value).toBeDefined();
        expect(value?.value).toBe("off");
      });

      it("스위치 조건의 셀렉트를 꺼짐으로 바꾸면 store 에 value:false 로 저장된다", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_a";
        const { mapId, page } = seedPage([{ kind: "switch", switchId, value: true }]);
        const root = render(mapId, page);
        const value = findByTestId(root, "event-page-switch-condition-value");
        if (!value) throw new Error("switch value select missing");
        value.value = "off";
        value.dispatchEvent(new Event("change"));
        const stored = livePage(mapId).conditions.find((entry) => entry.kind === "switch");
        expect(stored).toEqual({ kind: "switch", switchId, value: false });
      });

      it("아이템 조건은 보유/미보유를 저작하고 유지한다", () => {
        const { mapId, page } = seedPage([{ kind: "item", itemId: DEFAULT_ITEM_ID, present: false }]);
        const root = render(mapId, page);
        const value = findByTestId(root, "event-page-item-condition-present");
        expect(value?.value).toBe("absent");
      });

      it("주인공 조건은 파티 있음/없음을 저작하고 유지한다", () => {
        const { mapId, page } = seedPage([{ kind: "actor", actorId: DEFAULT_ACTOR_ID, present: false }]);
        const root = render(mapId, page);
        const value = findByTestId(root, "event-page-actor-condition-present");
        expect(value?.value).toBe("absent");
      });

      it("고급 스위치에서 꺼짐을 저작한 뒤 대상을 바꿔도 value:false를 유지한다", () => {
        const switches = store.getCurrent().switches;
        const { mapId, page } = seedPage([
          { kind: "switch", switchId: switches[0]?.id ?? "sw_1", value: true },
          { kind: "switch", switchId: switches[1]?.id ?? "sw_2", value: true },
          { kind: "switch", switchId: switches[2]?.id ?? "sw_3", value: true },
        ]);
        const root = render(mapId, page);
        const polarity = findByTestId(root, "event-page-advanced-condition-switch-value-0");
        const picker = findByTestId(root, "event-page-advanced-condition-switch-0");
        if (!polarity || !picker) throw new Error("advanced switch controls missing");

        polarity.value = "false";
        polarity.dispatchEvent(new Event("change"));
        picker.value = switches[0]?.id ?? "sw_changed";
        picker.dispatchEvent(new Event("change"));

        expect(polarity.textContent).toContain("꺼짐");
        expect(livePage(mapId).conditions[2]).toEqual({
          kind: "switch",
          switchId: switches[0]?.id ?? "sw_changed",
          value: false,
        });
      });

      it("고급 아이템에서 보유 안 함을 저작한 뒤 대상을 바꿔도 present:false를 유지한다", () => {
        const items = store.getCurrent().database.items;
        const { mapId, page } = seedPage([
          { kind: "item", itemId: DEFAULT_ITEM_ID, present: true },
          { kind: "item", itemId: items[1]?.id ?? "item_extra", present: true },
        ]);
        const root = render(mapId, page);
        const polarity = findByTestId(root, "event-page-advanced-condition-item-present-0");
        const picker = findByTestId(root, "event-page-advanced-condition-item-0");
        if (!polarity || !picker) throw new Error("advanced item controls missing");

        polarity.value = "false";
        polarity.dispatchEvent(new Event("change"));
        picker.value = DEFAULT_ITEM_ID;
        picker.dispatchEvent(new Event("change"));

        expect(polarity.textContent).toContain("보유 안 함");
        expect(livePage(mapId).conditions[1]).toEqual({ kind: "item", itemId: DEFAULT_ITEM_ID, present: false });
      });

      it("고급 주인공에서 파티에 없음을 저작한 뒤 대상을 바꿔도 present:false를 유지한다", () => {
        const actors = store.getCurrent().database.actors;
        const { mapId, page } = seedPage([
          { kind: "actor", actorId: DEFAULT_ACTOR_ID, present: true },
          { kind: "actor", actorId: actors[1]?.id ?? "actor_extra", present: true },
        ]);
        const root = render(mapId, page);
        const polarity = findByTestId(root, "event-page-advanced-condition-actor-present-0");
        const picker = findByTestId(root, "event-page-advanced-condition-actor-0");
        if (!polarity || !picker) throw new Error("advanced actor controls missing");

        polarity.value = "false";
        polarity.dispatchEvent(new Event("change"));
        picker.value = DEFAULT_ACTOR_ID;
        picker.dispatchEvent(new Event("change"));

        expect(polarity.textContent).toContain("파티에 없음");
        expect(livePage(mapId).conditions[1]).toEqual({ kind: "actor", actorId: DEFAULT_ACTOR_ID, present: false });
      });
    });
  });
  describe("npcActivitySuggestions", () => {
    isolateTimers();
    const EVENT_ID = "ev-activity-condition";
    const NPC_ID = "ev-scheduled-npc";
    function scheduleEntry(mapId: string, activity: string | undefined): NpcScheduleEntry {
      return { when: { timePhase: "day" }, at: { mapId, x: 3, y: 3 }, activity, facing: "down" };
    }
    function seedScheduledNpc(project: Project, activities: readonly (string | undefined)[]): void {
      const mapId = project.startMapId;
      const npc: GameEvent = {
        id: NPC_ID,
        x: 3,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: activities.map((activity) => scheduleEntry(mapId, activity)),
      };
      const map = project.maps[mapId];
      if (!map) throw new Error("start map missing");
      map.events = [...map.events.filter((entry) => entry.id !== NPC_ID), npc];
    }
    function activityPage(activity: string): EventPage {
      return {
        id: "page-activity",
        name: "활동 조건",
        conditions: [{ kind: "npcActivity", activity }],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "안녕" }],
      };
    }
    function hostEvent(page: EventPage): GameEvent {
      return { id: EVENT_ID, x: 2, y: 2, trigger: page.trigger, commands: [], pages: [page] };
    }
    function optionValues(root: FakeElement, testId: string): string[] {
      const list = findByTestId(root, testId);
      if (!list) throw new Error(`datalist ${testId} 없음`);
      return list.children.filter((child) => child.tagName === "OPTION").map((option) => option.value);
    }
    describe("활동 조건 저작 도움", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
      });

      afterEach(() => {
        restoreDom?.();
        restoreDom = undefined;
      });

      it("프로젝트 일정에 적힌 활동을 중복 없이 정렬해 모은다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["저녁 장터", "귀가", "저녁 장터", "  ", undefined]);

        expect(collectNpcActivitySuggestions(project)).toEqual(["귀가", "저녁 장터"]);
      });

      it("일정이 없으면 빈 목록을 준다", () => {
        expect(collectNpcActivitySuggestions(createBlankProject())).toEqual([]);
      });

      it("페이지 활동 조건 입력이 프로젝트 활동을 후보로 건다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가", "저녁 장터"]);
        const page = activityPage("저녁 장터");
        const mapId = project.startMapId;
        project.maps[mapId]!.events = [...project.maps[mapId]!.events, hostEvent(page)];
        store.replace(project);

        const root = renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));

        expect(optionValues(root, "event-page-npc-activity-condition-options")).toEqual(["귀가", "저녁 장터"]);
        const input = findByTestId(root, "event-page-npc-activity-condition-input");
        expect(input?.getAttribute("list")).toBe("event-page-npc-activity-condition-options");
      });

      it("분기 폼 활동 입력도 같은 후보를 건다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가"]);
        store.replace(project);

        const root = renderWithFakeDom(() =>
          el("div", { children: [renderNpcActivityCondition({ kind: "npcActivity", activity: "귀가" }, () => undefined)] })
        );

        expect(optionValues(root, "event-condition-npc-activity-options")).toEqual(["귀가"]);
        const input = findByTestId(root, "event-condition-npc-activity");
        expect(input?.getAttribute("list")).toBe("event-condition-npc-activity-options");
      });

      it("어떤 일정에도 없는 활동은 저작 시점에 알려준다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가"]);
        const event = hostEvent(activityPage("관광"));
        project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

        const result = validateEventDraftBody(project, project.startMapId, event);
        const issue = result.issues.find((entry) => entry.code === "condition.npcActivity.unknown");

        expect(issue?.severity).toBe("warning");
        expect(issue?.message).toContain("NPC 일정");
      });

      it("일정에 있는 활동은 알리지 않는다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가", "저녁 장터"]);
        const event = hostEvent(activityPage("저녁 장터"));
        project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

        const result = validateEventDraftBody(project, project.startMapId, event);

        expect(result.issues.filter((entry) => entry.code === "condition.npcActivity.unknown")).toEqual([]);
      });

      it("빈 활동은 기존 경고만 내고 미확인 경고를 겹치지 않는다", () => {
        const project = createBlankProject();
        seedScheduledNpc(project, ["귀가"]);
        const event = hostEvent(activityPage("   "));
        project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

        const codes = validateEventDraftBody(project, project.startMapId, event).issues.map((entry) => entry.code);

        expect(codes).toContain("condition.npcActivity.empty");
        expect(codes).not.toContain("condition.npcActivity.unknown");
      });
    });
  });
  describe("pageConditionAuthoringIntegrity", () => {
    isolateTimers();
    const EVENT_ID = "ev-condition-integrity";
    function seedPage(conditions: readonly EventPageCondition[]): { mapId: string; page: EventPage } {
      const mapId = store.getCurrent().startMapId;
      const page: EventPage = {
        id: "page-condition-integrity",
        name: "조건 무결성",
        conditions: [...conditions],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
      const event: GameEvent = {
        id: EVENT_ID,
        x: 2,
        y: 2,
        trigger: { kind: "action" },
        commands: [],
        pages: [page],
      };
      store.update((draft) => {
        const map = draft.maps[mapId];
        if (!map) return;
        map.events = [...map.events.filter((entry) => entry.id !== EVENT_ID), structuredClone(event)];
      });
      return { mapId, page: livePage(mapId) };
    }
    function livePage(mapId: string): EventPage {
      const page = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === EVENT_ID)?.pages?.[0];
      if (!page) throw new Error("live page missing");
      return page;
    }
    function render(mapId: string, page: EventPage) {
      return renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));
    }
    describe("페이지 조건 저작 무결성", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it.each([
        {
          name: "스위치",
          condition: () => ({ kind: "switch", switchId: store.getCurrent().switches[0]?.id ?? "sw_1", value: false }) as EventPageCondition,
          pickerTestId: "event-page-switch-condition-input",
          errorTestId: "event-page-switch-condition-error",
          expected: { kind: "switch", switchId: "", value: false },
          issueCode: "reference.switch.missing",
        },
        {
          name: "아이템",
          condition: () => ({ kind: "item", itemId: DEFAULT_ITEM_ID, present: false }) as EventPageCondition,
          pickerTestId: "event-page-item-condition-input",
          errorTestId: "event-page-item-condition-error",
          expected: { kind: "item", itemId: "", present: false },
          issueCode: "reference.item.missing",
        },
      ])("$name 참조를 비워도 조건을 보존하고 인라인 오류와 집계 검증을 표시한다", ({ condition, pickerTestId, errorTestId, expected, issueCode }) => {
        const { mapId, page } = seedPage([condition()]);
        const root = render(mapId, page);
        const picker = findByTestId(root, pickerTestId);
        const error = findByTestId(root, errorTestId);
        if (!picker || !error) throw new Error("reference controls missing");

        picker.value = "";
        picker.dispatchEvent(new Event("change"));

        expect(livePage(mapId).conditions[0]).toEqual(expected);
        expect(error.hidden).toBe(false);
        const validation = validateEventDraft(store.getCurrent(), mapId, EVENT_ID);
        expect(validation.issues.some((issue) => issue.code === issueCode)).toBe(true);
      });

      it("칩으로 아이템 조건을 담으면 행이 생기고, 다시 빼면 안내 한 줄로 돌아간다", () => {
        const { mapId, page } = seedPage([]);
        const emptyRoot = render(mapId, page);
        expect(findByTestId(emptyRoot, "event-condition-empty")).not.toBeNull();
        expect(findByTestId(emptyRoot, "event-condition-row-아이템")).toBeNull();
        const chip = findByTestId(emptyRoot, "event-condition-chip-item");
        if (!chip) throw new Error("item chip missing");
        expect(chip.getAttribute("aria-pressed")).toBe("false");

        chip.click();

        // 첫 아이템에 조용히 묶지 않는다 — 빈 참조로 세우고 행의 「아이템을 선택하세요」가 고르게 한다(2026-09-18).
        expect(livePage(mapId).conditions).toEqual([{ kind: "item", itemId: "", present: true }]);
        const openRoot = render(mapId, livePage(mapId));
        const row = findByTestId(openRoot, "event-condition-row-아이템");
        if (!row) throw new Error("enabled item row missing after chip toggle");
        expect(row.dataset.conditionActive).toBe("true");
        expect(row.classList.contains("disabled")).toBe(false);
        expect(findByTestId(openRoot, "event-condition-chip-item")?.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(openRoot, "event-page-item-condition-input")).not.toBeNull();

        findByTestId(openRoot, "event-condition-chip-item")?.click();

        expect(livePage(mapId).conditions).toEqual([]);
        expect(findByTestId(render(mapId, livePage(mapId)), "event-condition-empty")).not.toBeNull();
      });
    });
  });
});
