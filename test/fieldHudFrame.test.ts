import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { HudWidget } from "@/project/fieldHud";
import { FieldHud } from "@/player/fieldHud";
import { FakeElement, installFakeDom } from "./fakeDom";

const IDLE_FRAMES = 60;
// The old update assigned left, top, width, maxWidth, and height on every frame.
const STYLE_PROPS_PER_WIDGET = 5;

function goldWidget(): HudWidget {
  return {
    id: "gold",
    kind: "text",
    source: "gold",
    label: "G",
    shape: "number",
    anchor: "bottom-center",
    x: 8,
    y: 8,
    width: 80,
    height: 24,
    color: "#e5c878",
    panel: "none",
    condition: "always",
    showValue: true,
    enabled: true,
    hideEmpty: false,
    autoAvoid: true,
    max: 100,
    slots: 1,
    itemIds: [],
  };
}

function countStyleWrites(node: FakeElement): { writes: number } {
  const box = { writes: 0 };
  const current = node.style as unknown as object;
  node.style = new Proxy(current, {
    set(target, key, value) {
      box.writes += 1;
      Reflect.set(target, key, value);
      return true;
    },
  }) as typeof node.style;
  return box;
}

function countDatasetWrites(node: FakeElement): { writes: number } {
  const box = { writes: 0 };
  node.dataset = new Proxy(node.dataset, {
    set(target, key, value) {
      box.writes += 1;
      Reflect.set(target, key, value);
      return true;
    },
    deleteProperty(target, key) {
      box.writes += 1;
      return Reflect.deleteProperty(target, key);
    },
  });
  return box;
}

function countHiddenWrites(node: FakeElement): { writes: number } {
  const box = { writes: 0, value: node.hidden };
  Object.defineProperty(node, "hidden", {
    configurable: true,
    get() { return box.value; },
    set(value: boolean) {
      box.writes += 1;
      box.value = value;
    },
  });
  return box;
}

describe("field HUD idle frames", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("does not rewrite layout while the player stands still, and still moves when they do", () => {
    restore = installFakeDom();
    const project = createBlankProject();
    project.system.fieldHud = {
      theme: "minimal",
      vitals: false,
      clock: false,
      tools: false,
      objective: false,
      hideEmpty: false,
      widgets: [goldWidget()],
    };
    const session = startSession(project, 1);
    const host = new FakeElement("div");
    const hud = new FieldHud(host as unknown as HTMLElement);
    hud.update(project, session, { playerY: 10 });

    const root = hud.root as unknown as FakeElement;
    const widget = root.querySelector(".hud-widget") as FakeElement;
    expect(widget).toBeTruthy();
    expect(widget.style.top).toBe("208px");
    expect(widget.querySelector(".hud-text")?.textContent).toBe("0");

    const style = countStyleWrites(widget);
    const widgetData = countDatasetWrites(widget);
    const widgetHidden = countHiddenWrites(widget);
    const hostData = countDatasetWrites(host);
    const rootData = countDatasetWrites(root);
    const rootHidden = countHiddenWrites(root);

    for (let frame = 0; frame < IDLE_FRAMES; frame += 1) hud.update(project, session, { playerY: 10 });

    expect(style.writes).toBe(0);
    expect(widgetData.writes).toBe(0);
    expect(widgetHidden.writes).toBe(0);
    expect(hostData.writes).toBe(0);
    expect(rootData.writes).toBe(0);
    expect(rootHidden.writes).toBe(0);
    // 60 idle frames used to assign 5 style properties on this one widget.
    expect(IDLE_FRAMES * STYLE_PROPS_PER_WIDGET).toBe(300);

    session.gold = 25;
    hud.update(project, session, { playerY: 10 });
    expect(widget.querySelector(".hud-text")?.textContent).toBe("25");
    expect(style.writes).toBe(0);
    expect(widget.style.top).toBe("208px");

    hud.update(project, session, { playerY: 220 });
    expect(style.writes).toBe(STYLE_PROPS_PER_WIDGET);
    expect(widget.style.top).toBe("8px");
    expect(widget.dataset.avoiding).toBe("true");

    const moved = style.writes;
    hud.update(project, session, { playerY: 220 });
    expect(style.writes).toBe(moved);
  });
});
