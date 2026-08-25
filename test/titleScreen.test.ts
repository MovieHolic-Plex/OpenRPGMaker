import { describe, expect, it } from "vitest";
import {
  clampTitleMenuIndex,
  focusSelectedTitleOption,
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
  it("renders the redesigned editorial title composition instead of legacy window chrome", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );

      expect(screen.classList.contains("rm-title-screen-editorial")).toBe(true);
      expect(findByTestId(screen, "title-kicker")?.textContent).toBe("A NEW ADVENTURE");
      expect(findByTestId(screen, "title-subtitle")?.textContent).toBe("이야기가 시작되는 곳");
      expect(screen.querySelector(".rm-title-menu")?.classList.contains("rm-title-menu-open")).toBe(true);
    } finally {
      restoreDom();
    }
  });

  it("renders database-configured title text, menu labels, and positions", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = fullVisibilitySettings({
        title: "용사의 밤",
        backgroundResourceId: "oprn-title-blue",
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
          onResume: () => undefined,
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
        backgroundResourceId: "oprn-title-blue",
      });
      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );
      expect(screen.style.backgroundImage).toContain("default-title-blue.png");
      expect(screen.style.borderImageSource).toBeUndefined();
      expect(screen.style["--runtime-window-skin"]).toContain("windowskin-default.png");
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
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );

      expect(screen.style.backgroundImage).toContain("Title2.png");
    } finally {
      restoreDom();
    }
  });

  it("uses the 320x240 title background and left-aligned editorial composition by default", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();

      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );

      const title = screen.childNodes[0];
      const menu = screen.childNodes[1];
      if (!(title instanceof FakeElement) || !(menu instanceof FakeElement)) {
        throw new Error("expected title screen children");
      }
      expect(screen.style.backgroundImage).toContain("oprn-title-field.png");
      expect(title.style.left).toBe("10%");
      expect(menu.style.left).toBe("10.625%");
      expect(findByTestId(screen, "title-input-hint")?.textContent).toBe(TITLE_KEY_PROMPT);
    } finally {
      restoreDom();
    }
  });

  it("ignores pointer clicks because title selection is keyboard-only", () => {
    const restoreDom = installFakeDom();
    try {
      let activated: string | null = null;
      const project = createBlankProject();
      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => {
            activated = "new";
          },
          onResume: () => {
            activated = "resume";
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
      expect(activated).toBeNull();
      expect(findByTestId(screen, "title-input-hint")?.textContent).not.toContain("클릭");
    } finally {
      restoreDom();
    }
  });

  it("gives exactly one stable title option the roving tab stop and focuses it", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }, 1),
      );

      const newGame = findByTestId(screen, "title-new-game");
      const load = findByTestId(screen, "title-load-game");
      const quit = findByTestId(screen, "title-quit-game");
      expect([newGame, load, quit].filter((option) => option?.attrs.tabindex === "0")).toHaveLength(1);
      expect(newGame?.attrs.id).toBe("title-option-new-game");
      expect(load?.attrs.id).toBe("title-option-load-game");
      expect(quit?.attrs.id).toBe("title-option-quit-game");
      expect(newGame?.attrs.tabindex).toBe("-1");
      expect(load?.attrs.tabindex).toBe("0");
      expect(load?.attrs["aria-selected"]).toBe("true");
      expect(quit?.attrs["aria-selected"]).toBe("false");

      focusSelectedTitleOption(screen);
      expect(document.activeElement).toBe(load);
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
      {
        id: "newGame",
        testId: "title-new-game",
        elementId: "title-option-new-game",
        label: defaults.menuLabels.newGame,
      },
    ]);
  });

  it("shows resume only when an autosave exists, ordered New→Resume→Continue→Quit", () => {
    const defaults = defaultTitleScreenSettings();
    // 컨텍스트 생략/오토세이브 없음 → resume 미노출(기존 3항목 그대로).
    expect(listTitleMenuOptions(defaults).map((option) => option.id)).toEqual([
      "newGame",
      "continueGame",
      "quit",
    ]);
    expect(listTitleMenuOptions(defaults, { autosaveAvailable: false }).map((option) => option.id)).toEqual([
      "newGame",
      "continueGame",
      "quit",
    ]);

    const withAutosave = listTitleMenuOptions(defaults, { autosaveAvailable: true });
    expect(withAutosave.map((option) => option.id)).toEqual([
      "newGame",
      "resume",
      "continueGame",
      "quit",
    ]);
    const resume = withAutosave[1];
    expect(resume).toEqual({
      id: "resume",
      testId: "title-resume-game",
      elementId: "title-option-resume-game",
      label: "이어하기",
    });
  });

  it("respects menuVisibility.resume and the authored resume label", () => {
    const defaults = defaultTitleScreenSettings();
    const hidden = fullVisibilitySettings({
      ...defaults,
      menuVisibility: { newGame: true, continueGame: true, quit: true, resume: false },
    });
    expect(listTitleMenuOptions(hidden, { autosaveAvailable: true }).map((option) => option.id)).toEqual([
      "newGame",
      "continueGame",
      "quit",
    ]);

    const labeled = fullVisibilitySettings({
      ...defaults,
      menuLabels: { ...defaults.menuLabels, resume: "지난 모험 계속" },
    });
    const resume = listTitleMenuOptions(labeled, { autosaveAvailable: true })
      .find((option) => option.id === "resume");
    expect(resume?.label).toBe("지난 모험 계속");
  });

  it("keeps a 4-option menu above the input hint without overlap", () => {
    const optionCount = 4;
    // 기본 저작값 menuY=148 은 4항목이면 반드시 겹치므로 끌어올려진다.
    const top = titleMenuTop(148, optionCount, true);
    expect(top).toBe(240 - 40 - titleMenuHeight(optionCount));
    // 메뉴 아래끝이 안내 창 예약 영역(200) 위에서 끝난다.
    expect(top + titleMenuHeight(optionCount)).toBeLessThanOrEqual(200);
    // 안내 창이 없으면 저작값 그대로.
    expect(titleMenuTop(148, optionCount, false)).toBe(148);
  });

  it("renders the resume option between new game and load when context says autosave exists", () => {
    const restoreDom = installFakeDom();
    try {
      let resumed = 0;
      const project = createBlankProject();
      const screen = renderWithFakeDom(() =>
        renderTitleScreen(
          project,
          {
            onNewGame: () => undefined,
            onResume: () => {
              resumed += 1;
            },
            onContinue: () => undefined,
            onQuit: () => undefined,
          },
          1,
          { autosaveAvailable: true },
        ),
      );

      const resume = findByTestId(screen, "title-resume-game");
      expect(resume).toBeTruthy();
      expect(resume?.textContent).toBe("이어하기");
      expect(resume?.attrs.id).toBe("title-option-resume-game");
      // selectedIndex 1 은 이제 resume 을 가리킨다(new → resume → load → quit).
      expect(resume?.attrs["aria-selected"]).toBe("true");
      resume?.dispatchEvent?.(new Event("click", { bubbles: true }));
      expect(resumed).toBe(0);
    } finally {
      restoreDom();
    }
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
            onResume: () => undefined,
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
            onResume: () => undefined,
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

  it("renders background layers in authored order with injected scroll animations", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = fullVisibilitySettings({
        ...defaultTitleScreenSettings(),
        backgroundLayers: [
          { resourceId: "oprn-title-field", scrollXPerSec: 16 },
          { resourceId: "easyrpg-title-title1", scrollYPerSec: -12, opacity: 0.5 },
        ],
      });

      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );

      const fx = findByTestId(screen, "title-fx");
      expect(fx).toBeTruthy();
      const layers = screen.querySelectorAll("[data-testid='title-bg-layer']");
      expect(layers).toHaveLength(2);
      expect(layers[0]?.dataset.titleLayerResource).toBe("oprn-title-field");
      expect(layers[0]?.dataset.titleLayerIndex).toBe("0");
      // 320px 타일 / 16px/s = 20s 무한 스크롤 주기.
      expect(layers[0]?.style.animation).toBe("rm-title-layer-scroll-x 20s linear infinite");
      expect(layers[1]?.dataset.titleLayerResource).toBe("easyrpg-title-title1");
      // 240px / 12px/s = 20s, 음수 속도는 reverse.
      expect(layers[1]?.style.animation).toBe("rm-title-layer-scroll-y 20s linear infinite reverse");
      expect(layers[1]?.style.opacity).toBe("0.5");
      // 파티클 설정이 없으면 canvas 는 만들지 않는다.
      expect(findByTestId(screen, "title-particles")).toBeNull();
    } finally {
      restoreDom();
    }
  });

  it("keeps the legacy title DOM unchanged when no fx settings exist", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );
      expect(findByTestId(screen, "title-fx")).toBeNull();
      expect(findByTestId(screen, "title-particles")).toBeNull();
      expect(findByTestId(screen, "title-bg-layer")).toBeNull();
    } finally {
      restoreDom();
    }
  });

  it("mounts the particle canvas only when particles are configured", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = fullVisibilitySettings({
        ...defaultTitleScreenSettings(),
        particles: { preset: "fireflies", density: 80 },
      });
      const screen = renderWithFakeDom(() =>
        renderTitleScreen(project, {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );
      const canvas = findByTestId(screen, "title-particles");
      expect(canvas).toBeTruthy();
      expect(canvas?.tagName).toBe("CANVAS");
      expect(canvas?.dataset.titleParticlePreset).toBe("fireflies");
      expect(canvas?.dataset.titleParticleDensity).toBe("80");
    } finally {
      restoreDom();
    }
  });

  it("applies intro classes with delays on first entry only", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = fullVisibilitySettings({
        ...defaultTitleScreenSettings(),
        titleGraphic: undefined,
        intro: { logo: "fadeIn", menu: "slideUp", delayMs: 100, staggerMs: 50 },
      });
      const actions = {
        onNewGame: () => undefined,
        onResume: () => undefined,
        onContinue: () => undefined,
        onQuit: () => undefined,
      };

      // 최초 진입(playIntro 생략 = true): intro 클래스 + 지연 부여.
      const first = renderWithFakeDom(() => renderTitleScreen(project, actions));
      const title = first.querySelector(".rm-title-screen-title");
      expect(title?.classList.contains("rm-title-intro-fade-in")).toBe(true);
      expect(title?.style.animationDelay).toBe("100ms");
      const buttons = first.querySelectorAll(".rm-title-menu-button");
      expect(buttons.length).toBeGreaterThan(1);
      expect(buttons.every((button) => button.classList.contains("rm-title-intro-slide-up"))).toBe(true);
      expect(buttons[0]?.style.animationDelay).toBe("100ms");
      expect(buttons[1]?.style.animationDelay).toBe("150ms");

      // 방향키 재렌더(playIntro:false): intro 클래스가 다시 붙지 않는다.
      const rerendered = renderWithFakeDom(() =>
        renderTitleScreen(project, actions, 1, { playIntro: false }),
      );
      expect(rerendered.querySelector(".rm-title-intro-fade-in")).toBeNull();
      expect(rerendered.querySelector(".rm-title-intro-slide-up")).toBeNull();
    } finally {
      restoreDom();
    }
  });

  it("reuses the fx stack node across re-renders when the fx signature matches", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.titleScreen = fullVisibilitySettings({
        ...defaultTitleScreenSettings(),
        backgroundLayers: [{ resourceId: "oprn-title-field", scrollXPerSec: 16 }],
        particles: { preset: "snow", density: 40 },
      });
      const actions = {
        onNewGame: () => undefined,
        onResume: () => undefined,
        onContinue: () => undefined,
        onQuit: () => undefined,
      };

      const first = renderWithFakeDom(() => renderTitleScreen(project, actions));
      const firstFx = findByTestId(first, "title-fx");
      expect(firstFx).toBeTruthy();

      // 서명이 같으면 같은 노드가 새 루트로 move 된다(canvas 상태 보존).
      const second = renderWithFakeDom(() =>
        renderTitleScreen(project, actions, 1, { playIntro: false, reuseFx: firstFx as unknown as HTMLElement }),
      );
      expect(findByTestId(second, "title-fx")).toBe(firstFx);

      // 설정이 바뀌면(서명 불일치) 새 노드를 만든다.
      project.system.titleScreen = fullVisibilitySettings({
        ...defaultTitleScreenSettings(),
        backgroundLayers: [{ resourceId: "oprn-title-field", scrollXPerSec: 32 }],
        particles: { preset: "snow", density: 40 },
      });
      const third = renderWithFakeDom(() =>
        renderTitleScreen(project, actions, 0, { playIntro: false, reuseFx: firstFx as unknown as HTMLElement }),
      );
      const thirdFx = findByTestId(third, "title-fx");
      expect(thirdFx).toBeTruthy();
      expect(thirdFx).not.toBe(firstFx);
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
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        }),
      );

      expect(screen.textContent).toContain("로고 타이틀");
      const logo = findByTestId(screen, "title-logo");
      expect(logo).toBeTruthy();
      expect(logo?.dataset.titleLogoResource).toBe("easyrpg-title-title1");
      // Background stays on the title-screen node; logo uses its own resource.
      expect(screen.style.backgroundImage).toContain("oprn-title-field.png");
    } finally {
      restoreDom();
    }
  });
});
