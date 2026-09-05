import { describe, expect, it, vi } from "vitest";
import { closeStatusMenu } from "@/player/playerStatusMenuMotion";
import { currentStatusMenu } from "@/player/playerStatusMenuControllerDom";
import { installFakeDom } from "./fakeDom";

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
