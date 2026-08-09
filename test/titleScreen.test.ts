import { describe, expect, it } from "vitest";
import {
  clampTitleMenuIndex,
  listTitleMenuOptions,
  renderTitleScreen,
  titleMenuHeight,
  titleMenuTop,
} from "@/player/titleScreen";
import { TITLE_KEY_PROMPT } from "@/player/keyBindings";
import { createBlankProject } from "@/project/defaults";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type { TitleScreenSettings } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function fullVisibilitySettings(partial: Omit<TitleScreenSettings, "menuVisibility"> & {
  readonly menuVisibility?: TitleScreenSettings["menuVisibility"];
}): TitleScreenSettings {
  return {
    ...partial,
    menuVisibility: partial.menuVisibility ?? {
      newGame: true,
      continueGame: true,
      quit: true,
    },
  };
}

describe("title screen", () => {
  it("renders database-configured title text, menu labels, and positions", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = fullVisibilitySettings({
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
      });

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
      expect(hint?.textContent).toBe(TITLE_KEY_PROMPT);
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
      // 저작값 menuY=132 는 그대로 쓰이지 않는다. 항목 3개 + 조작 안내 창이 함께 보이면
      // 마지막 항목이 안내 창에 가려지므로 titleMenuTop 이 116 으로 끌어올린다(=48.3333%).
      // 규칙 자체는 아래 "clamps the menu above the input hint" 테스트가 담당한다.
      expect(menu.style.top).toBe("48.3333%");
    } finally {
      restoreDom();
    }
  });

  it("keeps the title artwork visible while exposing windowskin chrome to child menus", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = fullVisibilitySettings({
        ...defaultTitleScreenSettings(),
        backgroundResourceId: "rpg-zzu-title-blue",
      });
      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );
      expect(screen.style.backgroundImage).toContain("default-title-blue.png");
      expect(screen.style.borderImageSource).toBeUndefined();
      expect(screen.style["--runtime-window-skin"]).toContain("windowskin-rm2003.png");
    } finally {
      restoreDom();
    }
  });

  it("clamps the menu above the input hint only when it would overlap", () => {
    // 회귀 방지: 이 규칙에 단위 커버리지가 없어서 위 레이아웃 테스트가 조용히 낡았다.
    const optionCount = 3;
    // 안내 창이 없으면 저작값을 그대로 존중한다.
    expect(titleMenuTop(132, optionCount, false)).toBe(132);
    // 들어갈 자리가 있으면 저작값을 그대로 존중한다.
    expect(titleMenuTop(60, optionCount, true)).toBe(60);
    // 겹치면 메뉴 아래끝이 안내 영역 위에서 끝나도록 끌어올린다.
    expect(titleMenuTop(132, optionCount, true)).toBe(240 - 40 - titleMenuHeight(optionCount));
    expect(titleMenuTop(132, optionCount, true)).toBe(116);
  });

  it("uses the legacy title resource when the new title-screen background is unset", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleResourceId = "easyrpg-title-title2";
      project.system.titleScreen = fullVisibilitySettings({
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
      });

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
      expect(screen.style.backgroundImage).toContain("rm2k3-title-field.png");
      expect(title.style.left).toBe("50%");
      expect(menu.style.left).toBe("50%");
      expect(findByTestId(screen, "title-input-hint")?.textContent).toBe(TITLE_KEY_PROMPT);
    } finally {
      restoreDom();
    }
  });

  it("wires mouse click handlers on title menu options", () => {
    const restoreDom = installFakeDom();
    try {
      let activated: string | null = null;
      const project = createBlankProject();
      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => {
            activated = "new";
          },
          onContinue: () => {
            activated = "continue";
          },
          onQuit: () => {
            activated = "quit";
          },
        }),
      );
      const newGame = findByTestId(screen, "title-new-game");
      expect(String(newGame?.tagName ?? "").toLowerCase()).not.toBe("button");
      newGame?.dispatchEvent?.(new Event("click", { bubbles: true }));
      expect(activated).toBe("new");
    } finally {
      restoreDom();
    }
  });

  it("lists visible options New→Continue→Quit with stable ids/testIds", () => {
    const defaults = defaultTitleScreenSettings();
    expect(listTitleMenuOptions(defaults).map((option) => option.id)).toEqual([
      "newGame",
      "continueGame",
      "quit",
    ]);
    expect(listTitleMenuOptions(defaults).map((option) => option.testId)).toEqual([
      "title-new-game",
      "title-load-game",
      "title-quit-game",
    ]);

    const hideContinue = fullVisibilitySettings({
      ...defaults,
      menuVisibility: { newGame: true, continueGame: false, quit: true },
    });
    expect(listTitleMenuOptions(hideContinue).map((option) => option.id)).toEqual([
      "newGame",
      "quit",
    ]);

    const onlyNew = fullVisibilitySettings({
      ...defaults,
      menuVisibility: { newGame: true, continueGame: false, quit: false },
    });
    expect(listTitleMenuOptions(onlyNew)).toEqual([
      { id: "newGame", testId: "title-new-game", label: defaults.menuLabels.newGame },
    ]);
  });

  it("clamps title menu index into the visible range", () => {
    expect(clampTitleMenuIndex(2, 2)).toBe(1);
    expect(clampTitleMenuIndex(2, 1)).toBe(0);
    expect(clampTitleMenuIndex(-3, 3)).toBe(0);
    expect(clampTitleMenuIndex(0, 0)).toBe(0);
  });

  it("hides continue/quit options and input hint based on settings", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = fullVisibilitySettings({
        ...defaultTitleScreenSettings(),
        menuVisibility: { newGame: true, continueGame: false, quit: true },
        showInputHint: false,
      });

      const screen = renderWithFakeDom(() =>
        renderTitleScreen(
          project,
          {
            onNewGame: () => undefined,
            onContinue: () => undefined,
            onQuit: () => undefined,
          },
          1,
        ),
      );

      expect(findByTestId(screen, "title-new-game")).toBeTruthy();
      expect(findByTestId(screen, "title-load-game")).toBeNull();
      expect(findByTestId(screen, "title-quit-game")).toBeTruthy();
      expect(findByTestId(screen, "title-input-hint")).toBeNull();
      expect(findByTestId(screen, "title-quit-game")?.attrs["aria-current"]).toBe("true");
      expect(findByTestId(screen, "title-selection-json")?.textContent).toBe(
        JSON.stringify({ selectedIndex: 1 }),
      );
    } finally {
      restoreDom();
    }
  });

  it("clamps selected index to the last visible option when quit is hidden", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = fullVisibilitySettings({
        ...defaultTitleScreenSettings(),
        menuVisibility: { newGame: true, continueGame: true, quit: false },
      });

      const screen = renderWithFakeDom(() =>
        renderTitleScreen(
          project,
          {
            onNewGame: () => undefined,
            onContinue: () => undefined,
            onQuit: () => undefined,
          },
          2,
        ),
      );

      expect(findByTestId(screen, "title-quit-game")).toBeNull();
      expect(findByTestId(screen, "title-load-game")?.attrs["aria-current"]).toBe("true");
      expect(findByTestId(screen, "title-selection-json")?.textContent).toBe(
        JSON.stringify({ selectedIndex: 1 }),
      );
    } finally {
      restoreDom();
    }
  });

  it("renders title graphic logo without using applyTitleGraphic", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleResourceId = "easyrpg-title-title2";
      project.system.titleScreen = fullVisibilitySettings({
        ...defaultTitleScreenSettings(),
        title: "로고 타이틀",
        titleGraphic: {
          mode: "both",
          resourceId: "easyrpg-title-title1",
          x: 80,
          y: 40,
        },
      });

      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );

      expect(screen.textContent).toContain("로고 타이틀");
      const logo = findByTestId(screen, "title-logo");
      expect(logo).toBeTruthy();
      expect(logo?.dataset.titleLogoResource).toBe("easyrpg-title-title1");
      // Background stays on the title-screen node; logo uses its own resource.
      expect(screen.style.backgroundImage).toContain("rm2k3-title-field.png");
    } finally {
      restoreDom();
    }
  });
});
