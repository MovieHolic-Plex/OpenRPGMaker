// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CameraScrollbars } from "@/editor/CameraScrollbars";
import { editorCameraBounds } from "@/editor/cameraFocusViewport";

afterEach(() => document.body.replaceChildren());

const area = {
  canvas: { x: 300, y: 100, width: 1000, height: 700 },
  unoccluded: { x: 300, y: 100, width: 600, height: 500 },
  worldView: { x: 250, y: 200, width: 500, height: 350 },
  zoom: 2,
};

describe("native camera scrollbar projection", () => {
  it("mounts two named keyboard scroll regions with proportional content and position", () => {
    const pan = vi.fn();
    const bars = new CameraScrollbars(document.body, pan);
    bars.sync(area, 1600, 1200);
    const x = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-x"]')!;
    const y = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-y"]')!;
    expect(x.getAttribute("role")).toBe("region");
    expect(x.tabIndex).toBe(0);
    expect(y.tabIndex).toBe(0);
    expect(x.children.length).toBe(1);
    expect(y.children.length).toBe(1);
    // Track length is the canvas edge (1000-16 / 700-16); the thumb still reports
    // the unobstructed span, so every metric scales by track/visible.
    expect(parseFloat((x.firstElementChild as HTMLElement).style.width)).toBeCloseTo((3200 + 600 + 64) * 984 / 600);
    expect(x.scrollLeft).toBeCloseTo((500 + 300 + 32) * 984 / 600);
    expect(y.scrollTop).toBeCloseTo((400 + 250 + 32) * 684 / 500);
    x.dispatchEvent(new Event("scroll"));
    expect(pan).not.toHaveBeenCalled();
    bars.destroy();
    expect(document.body.childElementCount).toBe(0);
  });

  it("pins both tracks to the canvas edge, so opening the assistant never moves them", () => {
    const bars = new CameraScrollbars(document.body, vi.fn());
    const x = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-x"]')!;
    const y = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-y"]')!;

    // Assistant open: the deck crops a right-hand column out of the visible area.
    bars.sync(area, 1600, 1200);
    const boxed = (node: HTMLElement) => [node.style.left, node.style.top, node.style.width, node.style.height];
    const open = [boxed(x), boxed(y)];
    expect(open).toEqual([
      ["0px", "684px", "984px", "16px"],
      ["984px", "0px", "16px", "684px"],
    ]);

    // Assistant collapsed: the whole canvas is visible again. The tracks hold still.
    bars.sync({ ...area, unoccluded: area.canvas }, 1600, 1200);
    expect([boxed(x), boxed(y)]).toEqual(open);
    bars.destroy();
  });

  it("does not erase native input before its scroll event; converts track pixels once", () => {
    const pan = vi.fn();
    const bars = new CameraScrollbars(document.body, pan);
    bars.sync(area, 1600, 1200);
    const x = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-x"]')!;
    x.scrollLeft += 80;
    const pending = x.scrollLeft;
    bars.sync(area, 1600, 1200);
    expect(x.scrollLeft).toBe(pending);
    x.dispatchEvent(new Event("scroll"));
    expect(pan).toHaveBeenCalledExactlyOnceWith(80 / 2 / (984 / 600), 0);
    x.dispatchEvent(new Event("scroll"));
    expect(pan).toHaveBeenCalledTimes(1);
  });

  it("derives asymmetric map bounds that let both edges reach the visible center", () => {
    const bounds = editorCameraBounds({ ...area, mapWidth: 1600, mapHeight: 1200 });
    expect(bounds).toEqual({ x: -166, y: -141, width: 2132, height: 1582 });
    // Camera's minimum world-view X is bounds.x; at either limit its visible
    // center is 32 CSS pixels beyond the map, irrespective of overlay width.
    expect(bounds.x + area.unoccluded.width / 2 / area.zoom).toBe(-16);
    expect(bounds.x + bounds.width - area.canvas.width / area.zoom + area.unoccluded.width / 2 / area.zoom).toBe(1616);
  });
});
