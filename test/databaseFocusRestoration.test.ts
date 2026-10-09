import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
import { restoreFocusAfterRerender } from "@/editor/panels/databaseWorkspace";

let frames: FrameRequestCallback[];
beforeEach(() => {
  const window = new Window();
  vi.stubGlobal("document", window.document);
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
});
afterEach(() => vi.unstubAllGlobals());

function button(id: string): HTMLButtonElement {
  const node = document.createElement("button");
  node.dataset.testid = id;
  document.body.append(node);
  return node;
}
function frame(): void {
  const callback = frames.shift();
  if (!callback) throw new Error("missing scheduled frame");
  callback(0);
}

it("does not steal focus after the author moves to a CSS input", () => {
  const target = button("placed");
  const input = document.createElement("textarea");
  document.body.append(input);
  restoreFocusAfterRerender("placed", 2);
  frame();
  expect(document.activeElement).toBe(target);
  input.focus();
  frame();
  expect(document.activeElement).toBe(input);
});

it("allows the latest requested restoration to supersede older queued frames", () => {
  button("old");
  const latest = button("latest");
  restoreFocusAfterRerender("old", 2);
  frame();
  restoreFocusAfterRerender("latest", 2);
  frame();
  frame();
  expect(document.activeElement).toBe(latest);
  frame();
  expect(document.activeElement).toBe(latest);
  while (frames.length) frame();
  expect(document.activeElement).toBe(latest);
});

it("still restores focus after a second DOM replacement", () => {
  const first = button("same");
  restoreFocusAfterRerender("same", 2);
  frame();
  expect(document.activeElement).toBe(first);
  first.remove();
  const replacement = button("same");
  frame();
  expect(document.activeElement).toBe(replacement);
});
