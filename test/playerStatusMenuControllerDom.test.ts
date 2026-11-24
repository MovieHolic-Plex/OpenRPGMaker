import { describe, expect, it, vi } from "vitest";
import { adoptStatusMenuPanel, currentStatusMenu, markStatusMenuClosing } from "@/player/playerStatusMenuControllerDom";
import { installFakeDom } from "./fakeDom";
import { closeStatusMenu } from "@/player/playerStatusMenuMotion";
import { isolateTimers } from "./mergedTeardown";

describe("playerStatusMenuClosingGuard", () => {
  isolateTimers();
  describe("status menu closing guard", () => {
    it("stops counting a menu as open once the close juice starts", () => {
      const restoreDom = installFakeDom();
      try {
        const layout = document.createElement("div");
        const menu = document.createElement("div");
        menu.dataset.testid = "main-menu";
        layout.append(menu);

        expect(currentStatusMenu(layout)).toBe(menu);

        markStatusMenuClosing(menu);

        expect(currentStatusMenu(layout)).toBeNull();
      } finally {
        restoreDom();
      }
    });

    it("keeps the overlay element when adopting a rerender", () => {
      const restoreDom = installFakeDom();
      try {
        const existing = document.createElement("div");
        existing.className = "main-menu oprn-status-menu juice-menu-open";
        existing.dataset.testid = "main-menu";
        existing.append(document.createElement("span"));

        const next = document.createElement("div");
        next.className = "main-menu oprn-status-menu status-menu-detail-focus";
        next.dataset.testid = "main-menu";
        next.dataset.statusMenuScreen = "function";
        next.setAttribute("role", "dialog");
        const child = document.createElement("span");
        child.textContent = "items";
        next.append(child);

        const live = adoptStatusMenuPanel(existing, next);
        expect(live).toBe(existing);
        expect(live.className).toBe("main-menu oprn-status-menu status-menu-detail-focus");
        expect(live.dataset.statusMenuScreen).toBe("function");
        expect(live.getAttribute("role")).toBe("dialog");
        expect(live.textContent).toBe("items");
      } finally {
        restoreDom();
      }
    });
  });
});

describe("playerStatusMenuMotion", () => {
  isolateTimers();
  describe("status menu exit lifetime", () => {
    it("keeps the transparent final frame until finished and cannot remove a reopened menu", async () => {
      const restore = installFakeDom();
      try {
        const layout = document.createElement("div");
        const menu = document.createElement("div");
        menu.dataset.testid = "main-menu";
        layout.append(menu);
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => { finish = resolve; });
        const animate = vi.fn(() => ({ finished, cancel: vi.fn() } as unknown as Animation));
        menu.animate = animate;
        closeStatusMenu(menu);
        expect(currentStatusMenu(layout)).toBeNull();
        expect(menu.parentNode).toBe(layout);
        expect(animate).toHaveBeenCalledTimes(1);
        const [frames, options] = (animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions]);
        expect(frames.at(-1)?.opacity).toBe(0);
        expect(options.fill).toBe("forwards");
        menu.remove();
        const reopened = document.createElement("div");
        reopened.dataset.testid = "main-menu";
        layout.append(reopened);
        finish();
        await finished;
        expect(currentStatusMenu(layout)).toBe(reopened);
      } finally { restore(); }
    });
  });
});
