import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiStickyChecklist } from "@/editor/panels/aiStickyChecklist";
import type { AcceptanceSnapshot } from "@/ai/assistantAcceptance";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";
import { FakeElement, installFakeDom } from "./fakeDom";

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
    checklist.update({ ...snapshot, items: [...snapshot.items].reverse() });
    expect(Array.from(checklist.root.querySelectorAll(".ai-sticky-item"))).toEqual([...rows].reverse());
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
