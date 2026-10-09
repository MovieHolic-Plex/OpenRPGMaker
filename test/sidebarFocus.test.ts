import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captureFocus, restoreFocus, applyRovingTabindex, cssEscape } from "@/editor/panels/sidebarFocus";
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
    it("preserves a search caret while filtering replaces the input", () => {
      const input = document.createElement("input");
      input.type = "search";
      input.dataset.testid = "tile-search-input";
      input.value = "xab";
      container.append(input);
      input.focus();
      input.setSelectionRange(1, 1);
      const snapshot = captureFocus(container);
      const replacement = document.createElement("input");
      replacement.type = "search";
      replacement.dataset.testid = input.dataset.testid;
      replacement.value = input.value;
      container.replaceChildren(replacement);
      restoreFocus(container, snapshot);
      expect(document.activeElement).toBe(replacement);
      expect(replacement.selectionStart).toBe(1);
      expect(replacement.selectionEnd).toBe(1);
    });

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

    it("restores focus to oprn-tool-overflow anchor when focused element inside overflow dropdown disappears", () => {
      const toolbar = document.createElement("div");
      toolbar.setAttribute("role", "toolbar");

      const overflowTrigger = document.createElement("button");
      overflowTrigger.dataset.testid = "oprn-tool-overflow";

      const dropdown = document.createElement("div");
      dropdown.dataset.testid = "toolbar-overflow-dropdown";

      const brush2Btn = document.createElement("button");
      brush2Btn.dataset.testid = "brush-size-2";
      dropdown.append(brush2Btn);

      toolbar.append(overflowTrigger, dropdown);
      container.append(toolbar);

      brush2Btn.focus();
      expect(document.activeElement).toBe(brush2Btn);

      const snapshot = captureFocus(container);

      // Rebuild container with dropdown closed (brush-size-2 is gone)
      container.replaceChildren();
      const newToolbar = document.createElement("div");
      newToolbar.setAttribute("role", "toolbar");
      const newOverflowTrigger = document.createElement("button");
      newOverflowTrigger.dataset.testid = "oprn-tool-overflow";
      newToolbar.append(newOverflowTrigger);
      container.append(newToolbar);

      restoreFocus(container, snapshot);
      expect(document.activeElement).toBe(newOverflowTrigger);
    });
    it("escapes data-testid unconditionally for quoted string attribute selectors", () => {
      expect(cssEscape('foo"bar\\baz')).toBe('foo\\"bar\\\\baz');
    });

    it("falls back to the anchor named by an ancestor's data-focus-fallback-anchor", () => {
      const rail = document.createElement("div");
      const toggle = document.createElement("button");
      toggle.dataset.testid = "basic-rail-toggle-tiles";
      const flyout = document.createElement("div");
      flyout.dataset.testid = "basic-rail-flyout";
      flyout.dataset.focusFallbackAnchor = "basic-rail-toggle-tiles";
      const closeBtn = document.createElement("button");
      closeBtn.dataset.testid = "basic-flyout-close";
      flyout.append(closeBtn);
      rail.append(toggle, flyout);
      container.append(rail);

      closeBtn.focus();
      const snapshot = captureFocus(container);
      expect(snapshot?.fallbackAnchorTestId).toBe("basic-rail-toggle-tiles");

      // Rebuild with the flyout closed — the close button no longer exists.
      container.replaceChildren();
      const newRail = document.createElement("div");
      const newToggle = document.createElement("button");
      newToggle.dataset.testid = "basic-rail-toggle-tiles";
      newRail.append(newToggle);
      container.append(newRail);

      restoreFocus(container, snapshot);
      expect(document.activeElement).toBe(newToggle);
    });
  });

  describe("applyRovingTabindex & keyboard navigation", () => {
    it("드롭다운 버튼은 roving tabindex 를 받지 않아 Tab 순서에 남고, 그 안에서 누른 화살표는 도구막대 포커스를 옮기지 않는다", () => {
      const toolbar = document.createElement("div");
      toolbar.setAttribute("role", "toolbar");

      const tool1 = document.createElement("button");
      tool1.dataset.testid = "tool-paint";
      tool1.classList.add("active");

      const overflowTrigger = document.createElement("button");
      overflowTrigger.dataset.testid = "oprn-tool-overflow";

      const dropdown = document.createElement("div");
      dropdown.dataset.testid = "toolbar-overflow-dropdown";

      const copyBtn = document.createElement("button");
      copyBtn.dataset.testid = "copy-button";
      const brush4Btn = document.createElement("button");
      brush4Btn.dataset.testid = "brush-size-4";

      dropdown.append(copyBtn, brush4Btn);
      toolbar.append(tool1, overflowTrigger, dropdown);
      container.append(toolbar);

      applyRovingTabindex(container);

      // Toolbar buttons get roving tabindex
      expect(tool1.getAttribute("tabindex")).toBe("0");
      expect(overflowTrigger.getAttribute("tabindex")).toBe("-1");

      // Dropdown buttons must NOT get tabindex="-1"
      expect(copyBtn.getAttribute("tabindex")).toBeNull();
      expect(brush4Btn.getAttribute("tabindex")).toBeNull();

      // Arrow keys inside dropdown must NOT preventDefault or hijack focus to toolbar
      copyBtn.focus();
      let prevented = false;
      const arrowDownEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
      arrowDownEvent.key = "ArrowDown";
      arrowDownEvent.preventDefault = () => { prevented = true; };

      copyBtn.dispatchEvent(arrowDownEvent);
      expect(prevented).toBe(false);
      expect(document.activeElement).toBe(copyBtn);
    });
    it("data-roving 그룹도 roving tabindex 를 받고 aria-current 로 활성 버튼을 고른다", () => {
      const group = document.createElement("div");
      group.setAttribute("role", "group");
      group.dataset.roving = "true";

      const first = document.createElement("button");
      first.dataset.testid = "layer-lower";
      first.setAttribute("aria-current", "false");
      const second = document.createElement("button");
      second.dataset.testid = "layer-upper";
      second.setAttribute("aria-current", "true");
      const third = document.createElement("button");
      third.dataset.testid = "layer-event";
      third.setAttribute("aria-current", "false");

      group.append(first, second, third);
      container.append(group);

      applyRovingTabindex(container);

      expect(first.getAttribute("tabindex")).toBe("-1");
      expect(second.getAttribute("tabindex")).toBe("0");
      expect(third.getAttribute("tabindex")).toBe("-1");

      second.focus();
      const downEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
      downEvent.key = "ArrowDown";
      second.dispatchEvent(downEvent);
      expect(document.activeElement).toBe(third);
      expect(third.getAttribute("tabindex")).toBe("0");
      expect(second.getAttribute("tabindex")).toBe("-1");
    });

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
