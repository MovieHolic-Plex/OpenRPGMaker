import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captureFocus, restoreFocus, applyRovingTabindex } from "@/editor/panels/sidebarFocus";
import { installFakeDom } from "./fakeDom";

describe("sidebarFocus - Focus survival & Roving Tabindex", () => {
  let container: HTMLElement;
  let restoreFakeDom: () => void;

  beforeEach(() => {
    restoreFakeDom = installFakeDom();
    container = document.createElement("div");
    document.body.replaceChildren(container);
  });

  afterEach(() => {
    restoreFakeDom();
  });

  describe("captureFocus & restoreFocus", () => {
    it("captures and restores focus by data-testid", () => {
      const btn1 = document.createElement("button");
      btn1.dataset.testid = "tool-paint";
      const btn2 = document.createElement("button");
      btn2.dataset.testid = "tool-fill";
      container.append(btn1, btn2);
      btn2.focus();
      expect(document.activeElement).toBe(btn2);

      const snapshot = captureFocus(container);
      expect(snapshot).not.toBeNull();

      // Clear container and simulate rebuild
      container.replaceChildren();

      const newBtn1 = document.createElement("button");
      newBtn1.dataset.testid = "tool-paint";
      const newBtn2 = document.createElement("button");
      newBtn2.dataset.testid = "tool-fill";
      container.append(newBtn1, newBtn2);

      restoreFocus(container, snapshot);
      expect(document.activeElement).toBe(newBtn2);
    });

    it("falls back to DOM path/index when data-testid is absent", () => {
      const btn1 = document.createElement("button");
      const btn2 = document.createElement("button");
      container.append(btn1, btn2);
      btn2.focus();

      const snapshot = captureFocus(container);
      container.replaceChildren();

      const newBtn1 = document.createElement("button");
      const newBtn2 = document.createElement("button");
      container.append(newBtn1, newBtn2);

      restoreFocus(container, snapshot);
      expect(document.activeElement).toBe(newBtn2);
    });

    it("does not restore focus if activeElement was outside the container", () => {
      const outsideBtn = document.createElement("button");
      document.body.append(outsideBtn);
      outsideBtn.focus();

      const snapshot = captureFocus(container);
      expect(snapshot).toBeNull();

      const newBtn = document.createElement("button");
      newBtn.dataset.testid = "tool-fill";
      container.append(newBtn);

      restoreFocus(container, snapshot);
      expect(document.activeElement).toBe(outsideBtn);
    });
  });

  describe("applyRovingTabindex & keyboard navigation", () => {
    it("sets tabindex=0 on active button and tabindex=-1 on others", () => {
      const toolbar = document.createElement("div");
      toolbar.setAttribute("role", "toolbar");
      toolbar.dataset.testid = "oprn-tile-toolbar";

      const btn1 = document.createElement("button");
      btn1.dataset.testid = "oprn-tool-undo";
      const btn2 = document.createElement("button");
      btn2.dataset.testid = "tool-select";
      btn2.classList.add("active");
      const btn3 = document.createElement("button");
      btn3.dataset.testid = "tool-fill";

      toolbar.append(btn1, btn2, btn3);
      container.append(toolbar);

      applyRovingTabindex(container);

      expect(btn1.getAttribute("tabindex")).toBe("-1");
      expect(btn2.getAttribute("tabindex")).toBe("0");
      expect(btn3.getAttribute("tabindex")).toBe("-1");
    });

    it("moves focus on ArrowRight / ArrowLeft / Home / End and stops propagation", () => {
      const toolbar = document.createElement("div");
      toolbar.setAttribute("role", "toolbar");

      const btn1 = document.createElement("button");
      btn1.dataset.testid = "tool-paint";
      const btn2 = document.createElement("button");
      btn2.dataset.testid = "tool-fill";
      const btn3 = document.createElement("button");
      btn3.dataset.testid = "tool-erase";

      toolbar.append(btn1, btn2, btn3);
      container.append(toolbar);

      applyRovingTabindex(container);

      btn1.focus();
      expect(document.activeElement).toBe(btn1);

      let stopped = false;
      let prevented = false;
      const rightEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
      rightEvent.key = "ArrowRight";
      rightEvent.stopPropagation = () => { stopped = true; };
      rightEvent.preventDefault = () => { prevented = true; };

      btn1.dispatchEvent(rightEvent);
      expect(document.activeElement).toBe(btn2);
      expect(stopped).toBe(true);
      expect(prevented).toBe(true);

      // Home moves to first
      const homeEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
      homeEvent.key = "Home";
      btn2.dispatchEvent(homeEvent);
      expect(document.activeElement).toBe(btn1);

      // End moves to last
      const endEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
      endEvent.key = "End";
      btn1.dispatchEvent(endEvent);
      expect(document.activeElement).toBe(btn3);
    });
  });
});
