import { describe, expect, it } from "vitest";
import { currentStatusMenu, markStatusMenuClosing } from "@/player/playerStatusMenuControllerDom";
import { installFakeDom } from "./fakeDom";

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
});
