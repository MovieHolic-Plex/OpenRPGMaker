import { describe, expect, it } from "vitest";
import { renderTitleScreen } from "@/player/titleScreen";
import { createBlankProject } from "@/project/defaults";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("title screen", () => {
  it("renders database-configured title text, menu labels, and positions", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = {
        title: "용사의 밤",
        backgroundResourceId: "rpg-zzu-title-blue",
        layout: {
          titleX: 144,
          titleY: 64,
          menuX: 88,
          menuY: 132,
        },
        menuLabels: {
          newGame: "처음부터",
          continueGame: "이어하기",
          quit: "끝내기",
        },
      };

      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );

      const newGame = findByTestId(screen, "title-new-game");
      const continueGame = findByTestId(screen, "title-load-game");
      const quit = findByTestId(screen, "title-quit-game");
      const hint = findByTestId(screen, "title-input-hint");
      expect(screen.textContent).toContain("용사의 밤");
      expect(newGame?.textContent).toBe("처음부터");
      expect(continueGame?.textContent).toBe("이어하기");
      expect(quit?.textContent).toBe("끝내기");
      expect(hint?.textContent).toBe("↑↓ 이동   Z/Enter 결정   X/Esc 취소");
      expect(newGame?.attrs["aria-current"]).toBe("true");
      expect(continueGame?.attrs["aria-current"]).toBeUndefined();
      expect(screen.style.backgroundImage).toContain("default-title-blue.png");
      const title = screen.childNodes[0];
      const menu = screen.childNodes[1];
      if (!(title instanceof FakeElement) || !(menu instanceof FakeElement)) {
        throw new Error("expected title screen children");
      }
      expect(title.style.left).toBe("45%");
      expect(title.style.top).toBe("26.6667%");
      expect(menu.style.left).toBe("27.5%");
      expect(menu.style.top).toBe("55%");
    } finally {
      restoreDom();
    }
  });

  it("uses the legacy title resource when the new title-screen background is unset", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleResourceId = "easyrpg-title-title2";
      project.system.titleScreen = {
        title: "레거시 타이틀",
        layout: {
          titleX: 160,
          titleY: 70,
          menuX: 122,
          menuY: 118,
        },
        menuLabels: {
          newGame: "새 게임",
          continueGame: "계속",
          quit: "게임 중지",
        },
      };

      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );

      expect(screen.style.backgroundImage).toContain("Title2.png");
    } finally {
      restoreDom();
    }
  });

  it("uses the 320x240 EasyRPG title background and centered menu by default", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();

      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );

      const title = screen.childNodes[0];
      const menu = screen.childNodes[1];
      if (!(title instanceof FakeElement) || !(menu instanceof FakeElement)) {
        throw new Error("expected title screen children");
      }
      expect(screen.style.backgroundImage).toContain("Title1.png");
      expect(title.style.left).toBe("50%");
      expect(menu.style.left).toBe("50%");
      expect(findByTestId(screen, "title-input-hint")?.textContent).toBe("↑↓ 이동   Z/Enter 결정   X/Esc 취소");
    } finally {
      restoreDom();
    }
  });
});
