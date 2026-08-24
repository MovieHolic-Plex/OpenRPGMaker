/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { attachColumnResize } from "@/editor/panels/eventEditor/layoutResize";
import { attachWindowFullscreen } from "@/editor/panels/eventEditor/modalFullscreen";
import { attachWindowResize } from "@/editor/panels/eventEditor/modalResize";

describe("event editor windowing", () => {
  afterEach(() => {
    document.body.classList.remove("event-editor-column-resizing");
    document.body.replaceChildren();
  });

  it("toggles full view and restores the previous window geometry", () => {
    const backdrop = document.createElement("div");
    const windowEl = document.createElement("section");
    const header = document.createElement("header");
    const button = document.createElement("button");
    header.append(button);
    windowEl.append(header);
    backdrop.append(windowEl);
    document.body.append(backdrop);
    windowEl.style.width = "960px";
    windowEl.style.height = "700px";
    windowEl.style.transform = "translate(24px, 12px)";

    const controller = attachWindowFullscreen(button, header, backdrop, windowEl);
    expect(button.getAttribute("aria-label")).toBe("전체 보기");
    expect(button.getAttribute("aria-pressed")).toBe("false");

    button.click();
    expect(controller.isFullscreen()).toBe(true);
    expect(backdrop.classList.contains("is-fullscreen")).toBe(true);
    expect(windowEl.classList.contains("is-fullscreen")).toBe(true);
    expect(windowEl.style.transform).toBe("");
    expect(button.getAttribute("aria-label")).toBe("창 보기로 복원");

    backdrop.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(controller.isFullscreen()).toBe(false);
    expect(windowEl.style.width).toBe("960px");
    expect(windowEl.style.height).toBe("700px");
    expect(windowEl.style.transform).toBe("translate(24px, 12px)");
    controller.dispose();
  });

  it("supports title-bar double click and Alt+Enter", () => {
    const backdrop = document.createElement("div");
    const windowEl = document.createElement("section");
    const header = document.createElement("header");
    const button = document.createElement("button");
    const title = document.createElement("span");
    header.append(title, button);
    windowEl.append(header);
    backdrop.append(windowEl);
    document.body.append(backdrop);

    const controller = attachWindowFullscreen(button, header, backdrop, windowEl);
    title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    expect(controller.isFullscreen()).toBe(true);

    backdrop.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      altKey: true,
      bubbles: true,
      cancelable: true,
    }));
    expect(controller.isFullscreen()).toBe(false);
    controller.dispose();
  });

  it("resizes the settings rail by keyboard and resets it on double click", () => {
    const workbench = document.createElement("div");
    const settings = document.createElement("div");
    const handle = document.createElement("div");
    settings.className = "event-editor-settings-column";
    workbench.append(settings, handle);
    document.body.append(workbench);

    Object.defineProperty(workbench, "getBoundingClientRect", {
      value: () => ({ left: 100, width: 1200, right: 1300, top: 0, bottom: 700, height: 700, x: 100, y: 0, toJSON: () => ({}) }),
    });
    Object.defineProperty(settings, "getBoundingClientRect", {
      value: () => ({ left: 100, width: 312, right: 412, top: 0, bottom: 700, height: 700, x: 100, y: 0, toJSON: () => ({}) }),
    });

    attachColumnResize(handle, workbench);
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("336px");
    expect(handle.getAttribute("aria-valuenow")).toBe("336");
    expect(handle.getAttribute("aria-valuetext")).toBe("설정 패널 336픽셀");

    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("288px");

    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("");
    expect(handle.getAttribute("aria-valuenow")).toBe("312");
  });


  it("lets a viewport-fitted modal become smaller instead of growing to the desktop minimum", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    const windowEl = document.createElement("section");
    const handle = document.createElement("div");
    document.body.append(windowEl, handle);
    Object.defineProperty(windowEl, "getBoundingClientRect", {
      value: () => ({ left: 40, width: 720, right: 760, top: 32, bottom: 832, height: 800, x: 40, y: 32, toJSON: () => ({}) }),
    });

    attachWindowResize(handle, windowEl);
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));

    expect(windowEl.style.width).toBe("704px");
  });
});
