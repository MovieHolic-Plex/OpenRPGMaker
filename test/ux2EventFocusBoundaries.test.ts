/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { installFocusTrap } from "@/editor/panels/eventEditor/modal";
import { registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); dispose = undefined; resetModalStackForTest(); document.body.replaceChildren(); });
function tab(target: HTMLElement, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event); return event;
}
function setup() {
  resetModalStackForTest();
  const backdrop = document.createElement("div"), dialog = document.createElement("div");
  backdrop.append(dialog); document.body.append(backdrop); registerModal(backdrop, () => {});
  let reads = 0;
  const button = (parent = dialog): HTMLButtonElement => {
    const node = document.createElement("button"); node.textContent = "control";
    Object.defineProperty(node, "offsetParent", { get() { reads += 1; return dialog; } });
    parent.append(node); return node;
  };
  const first = button();
  const hidden = document.createElement("div"); hidden.hidden = true; dialog.append(hidden);
  for (let i = 0; i < 1000; i++) button(hidden);
  const middle = button(), last = button();
  dispose = installFocusTrap(backdrop, dialog);
  return { backdrop, dialog, first, middle, last, button, reads: () => reads };
}

describe("event focus boundary cache", () => {
  it("wraps both directions, lets native traversal handle interior controls and skips hidden geometry", () => {
    const fixture = setup();
    fixture.last.focus(); expect(tab(fixture.last).defaultPrevented).toBe(true); expect(document.activeElement).toBe(fixture.first);
    expect(tab(fixture.first, true).defaultPrevented).toBe(true); expect(document.activeElement).toBe(fixture.last);
    fixture.middle.focus(); const before = fixture.reads();
    expect(tab(fixture.middle).defaultPrevented).toBe(false);
    expect(fixture.reads() - before).toBeLessThan(8);
    expect(fixture.reads()).toBeLessThan(30);
  });

  it("sees same-task disabled/hidden changes, newly inserted boundaries and a nested modal", () => {
    const fixture = setup();
    fixture.first.focus(); tab(fixture.first, true); // prime boundaries
    fixture.last.disabled = true;
    fixture.first.focus(); tab(fixture.first, true); expect(document.activeElement).toBe(fixture.middle);
    fixture.middle.hidden = true;
    fixture.first.focus(); tab(fixture.first, true); expect(document.activeElement).toBe(fixture.first);
    fixture.middle.hidden = false;
    const added = fixture.button(); fixture.first.focus(); tab(fixture.first, true); expect(document.activeElement).toBe(added);
    const nested = document.createElement("div"); const inner = document.createElement("button"); nested.append(inner); document.body.append(nested); registerModal(nested, () => {});
    inner.focus(); expect(tab(inner).defaultPrevented).toBe(false); expect(document.activeElement).toBe(inner);
    dispose?.(); dispose = undefined;
    fixture.first.focus(); expect(tab(fixture.first, true).defaultPrevented).toBe(false);
  });
});
