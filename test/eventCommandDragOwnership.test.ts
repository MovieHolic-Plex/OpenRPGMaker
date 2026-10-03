/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";

const MIME = "application/x-oprn-event-command-path";
const commands = [{ kind: "text" as const, body: "A" }, { kind: "text" as const, body: "B" }];
const actions = (): CommandListActions => ({
  addCommand: vi.fn(), insertCommand: vi.fn(), replaceCommand: vi.fn(),
  deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
});

function dragEvent(type: string, types = [MIME], payload = "[0]"): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types, getData: () => payload, setData: vi.fn() },
  });
  return event;
}

function startDrag(host: HTMLElement): HTMLElement {
  const item = host.querySelector<HTMLElement>(".cmd-item")!;
  item.querySelector(".cmd-drag-handle")!.dispatchEvent(new Event("pointerdown"));
  item.dispatchEvent(dragEvent("dragstart"));
  return item;
}

function mount(callbacks: CommandListActions): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  renderCommandList(host, commands, [], callbacks);
  return host;
}

afterEach(() => {
  document.querySelectorAll(".cmd-item").forEach(item => item.dispatchEvent(new Event("dragend")));
  document.body.replaceChildren();
});

describe("event command drag ownership", () => {
  it("ignores plain text and unowned command payloads", () => {
    const callbacks = actions();
    const host = mount(callbacks);
    host.dispatchEvent(dragEvent("drop", ["text/plain"]));
    host.dispatchEvent(dragEvent("drop"));
    expect(callbacks.moveCommandTo).not.toHaveBeenCalled();
  });

  it("rejects commands dragged from another editor and altered payloads", () => {
    const first = mount(actions());
    const callbacks = actions();
    const second = mount(callbacks);
    startDrag(first);
    second.dispatchEvent(dragEvent("drop"));
    startDrag(second);
    second.dispatchEvent(dragEvent("drop", [MIME], "[1]"));
    expect(callbacks.moveCommandTo).not.toHaveBeenCalled();
  });

  it("uses current callbacks after reusing a list host and rejects the old drag", () => {
    const oldActions = actions();
    const currentActions = actions();
    const host = mount(oldActions);
    const oldSource = startDrag(host);
    renderCommandList(host, commands, [], currentActions);
    host.dispatchEvent(dragEvent("drop"));
    expect(oldActions.moveCommandTo).not.toHaveBeenCalled();
    expect(currentActions.moveCommandTo).not.toHaveBeenCalled();
    oldSource.dispatchEvent(new Event("dragend"));
    startDrag(host);
    host.dispatchEvent(dragEvent("drop"));
    expect(oldActions.moveCommandTo).not.toHaveBeenCalled();
    expect(currentActions.moveCommandTo).toHaveBeenCalledExactlyOnceWith([0], Number.MAX_SAFE_INTEGER);
  });
});
