import { describe, expect, it } from "vitest";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { createPlayerStatusMenuController } from "@/player/playerStatusMenuController";
import type { PlayScene } from "@/player/PlayScene";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import type { StatusMenuRailId } from "@/player/playerStatusMenuModel";
import type { MenuUiStyle } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noopActions: PlayerStatusMenuActions = {
  onCommand: () => undefined,
  onOpenGroup: () => undefined,
  onSaveSlot: () => undefined,
  onLoadSlot: () => undefined,
  onSelectItemTarget: () => undefined,
  onUseItem: () => undefined,
  onSelectSkillActor: () => undefined,
  onSelectSkill: () => undefined,
  onSelectEquipmentActor: () => undefined,
  onSelectEquipmentSlot: () => undefined,
  onEquipItem: () => undefined,
  onUnequipItem: () => undefined,
  onToggleRow: () => undefined,
  onSelectFormationActor: () => undefined,
  onMoveFormationActor: () => undefined,
  onToggleMonsterView: () => undefined,
  onMoveMonster: () => undefined,
  onToggleWait: () => undefined,
  onToTitle: () => undefined,
};

function render(skin: MenuUiStyle | undefined, mode: "main" | "function" = "main", selectedCommand: StatusMenuRailId = "items") {
  const project = createBlankProject();
  if (skin) project.system.menuUiStyle = skin;
  return renderWithFakeDom(() => renderPlayerStatusMenu({
    project,
    session: startSession(project),
    slots: [],
    actions: noopActions,
    mode,
    selectedCommand,
  }));
}

describe("status menu skins", () => {
  it("기본 스킨은 workbench 속성을 달고 파티 개요·사이드 파티가 없다", () => {
    const restore = installFakeDom();
    try {
      const menu = render(undefined);
      expect(menu.getAttribute("data-menu-skin")).toBe("workbench");
      expect(menu.getAttribute("data-menu-skin-icons")).toBe("glyph");
      expect(menu.getAttribute("data-menu-skin-landing")).toBe("work");
      expect(findByTestId(menu, "status-menu-party-overview")).toBeNull();
      expect(findByTestId(menu, "status-menu-side-party")).toBeNull();
      expect(findByTestId(menu, "status-menu-detail")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-command-icon-items")?.getAttribute("data-icon")).toBe("◇");
    } finally {
      restore();
    }
  });

  it("party-first 는 main 모드에 파티 개요를 그리고 작업 패널을 그리지 않는다", () => {
    const restore = installFakeDom();
    try {
      const menu = render("party-first");
      expect(menu.getAttribute("data-menu-skin")).toBe("party-first");
      expect(menu.getAttribute("data-menu-skin-landing")).toBe("party");
      expect(menu.getAttribute("data-menu-skin-rail")).toBe("flat");
      expect(menu.getAttribute("data-menu-skin-icons")).toBe("painted");
      const overview = findByTestId(menu, "status-menu-party-overview");
      expect(overview).not.toBeNull();
      expect(findByTestId(menu, "status-menu-overview-row-0")?.textContent).toContain("Lv");
      expect(findByTestId(menu, "status-menu-overview-hp-0")?.getAttribute("role")).toBe("meter");
      expect(findByTestId(menu, "status-menu-overview-mp-0")?.getAttribute("role")).toBe("meter");
      expect(findByTestId(menu, "status-menu-detail")).toBeNull();
      // 평탄 레일: 상태가 레일에 직접 있고, 컬러 아이콘 이름이 붙는다.
      expect(findByTestId(menu, "status-menu-command-status")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-command-icon-items")?.getAttribute("data-icon-name")).toBe("bag");
      expect(findByTestId(menu, "status-menu-command-icon-system-menu")?.getAttribute("data-icon-name")).toBe("gear");
    } finally {
      restore();
    }
  });

  it("party-first 는 function 모드에 작업 패널 + 사이드 파티를 그린다", () => {
    const restore = installFakeDom();
    try {
      const menu = render("party-first", "function");
      expect(findByTestId(menu, "status-menu-party-overview")).toBeNull();
      const detail = findByTestId(menu, "status-menu-detail");
      expect(detail).not.toBeNull();
      expect(detail?.className).toContain("has-side");
      expect(findByTestId(menu, "status-menu-side-party")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-side-party-row-0")).not.toBeNull();
    } finally {
      restore();
    }
  });

  it("사이드 파티는 작업 패널에만 붙는다 — 확인 카드(타이틀)에는 없다", () => {
    const restore = installFakeDom();
    try {
      const menu = render("party-first", "function", "to-title");
      expect(findByTestId(menu, "status-menu-detail")?.getAttribute("data-status-menu-presentation")).toBe("confirmation-card");
      expect(findByTestId(menu, "status-menu-side-party")).toBeNull();
    } finally {
      restore();
    }
  });

  it("레일 커서는 행 번호를 CSS 변수로 내놓는다 — 평탄 레일은 행 높이가 달라 y 픽셀을 그대로 쓸 수 없다", () => {
    const restore = installFakeDom();
    try {
      // party-first 평탄 레일: 아이템·스킬·장비 → 장비는 3번째(0부터 2).
      const flat = render("party-first", "main", "equipment");
      const flatStyle = findByTestId(flat, "status-menu-command-rail")?.getAttribute("style") ?? "";
      expect(flatStyle).toContain("--status-menu-cursor-index:2");
      // workbench 는 기존 y 픽셀 변수를 그대로 유지한다(26px 행 간격).
      const bench = render(undefined, "main", "equipment");
      const benchStyle = findByTestId(bench, "status-menu-command-rail")?.getAttribute("style") ?? "";
      expect(benchStyle).toContain("--status-menu-cursor-y:52px");
      expect(benchStyle).toContain("--status-menu-cursor-index:2");
    } finally {
      restore();
    }
  });

  it("hub 는 main 모드에 명령 요약과 파티 스트립을 그린다", () => {
    const restore = installFakeDom();
    try {
      const menu = render("hub");
      expect(menu.getAttribute("data-menu-skin-landing")).toBe("hub");
      expect(menu.getAttribute("data-menu-skin-rail")).toBe("collapsed");
      expect(findByTestId(menu, "status-menu-command-summary-items")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-party-strip")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-strip-card-0")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-detail")).toBeNull();
      expect(findByTestId(menu, "status-menu-party-overview")).toBeNull();
      for (const id of ["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"]) {
        expect(findByTestId(menu, `status-menu-command-${id}`), id).not.toBeNull();
      }
      // 작업대·파티 퍼스트에는 요약이 없다.
      expect(findByTestId(render(undefined), "status-menu-command-summary-items")).toBeNull();
      expect(findByTestId(render("party-first"), "status-menu-command-summary-items")).toBeNull();
      // 격자에서는 → 가 선택이 아니라 이동이므로 조작 안내도 달라진다.
      expect(findByTestId(menu, "status-menu-controls")?.textContent).toContain("←→");
      expect(findByTestId(menu, "status-menu-controls")?.textContent).not.toContain("→ / Enter");
      expect(findByTestId(render(undefined), "status-menu-controls")?.textContent).toContain("→ / Enter 선택");
    } finally {
      restore();
    }
  });

  it("party-first-warm 은 톤만 warm 이고 나머지는 party-first 와 같다", () => {
    const restore = installFakeDom();
    try {
      const menu = render("party-first-warm");
      expect(menu.getAttribute("data-menu-skin-tone")).toBe("warm");
      expect(menu.getAttribute("data-menu-skin-landing")).toBe("party");
      expect(findByTestId(menu, "status-menu-party-overview")).not.toBeNull();
    } finally {
      restore();
    }
  });
});

/** 컨트롤러가 renderMenu 에서 window.localStorage 로 저장 칸을 읽는다 — 메모리 저장소로 대신한다. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    setItem: (key: string, value: string) => { map.set(key, value); },
  } as Storage;
}

type ControllerHarness = { controller: ReturnType<typeof createPlayerStatusMenuController>; layout: HTMLElement };

function mountController(skin: MenuUiStyle): ControllerHarness {
  const project = createBlankProject();
  project.system.menuUiStyle = skin;
  store.replaceProject(project);
  const session = startSession(project);
  const layout = document.createElement("div");
  document.body.append(layout);
  const scene = {
    session,
    getSession: () => session,
    refreshRuntimeSurfaces: () => undefined,
    syncRuntimeState: () => undefined,
  } as unknown as PlayScene;
  const controller = createPlayerStatusMenuController({
    layout,
    getActiveScene: () => scene,
    getPlayStage: () => layout,
    getPlayStartedAt: () => 0,
    closeMenu: () => undefined,
    closeMenuWithJuice: () => undefined,
    renderTitle: () => undefined,
    emitMenuJuice: () => undefined,
    menuCloseJuiceMs: 0,
    loadSlot: () => undefined,
  });
  return { controller, layout };
}

describe("status menu skins — controller", () => {
  it("hub: main 모드에서 → 는 진입이 아니라 격자 이동이고, Enter 가 들어간다", () => {
    const restore = installFakeDom();
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: memoryStorage() } });
    try {
      const { controller, layout } = mountController("hub");
      controller.toggleMenu();
      expect(controller.handleKey("ArrowRight")).toBe(true);
      let menu = findByTestId(layout, "main-menu")!;
      expect(menu.getAttribute("data-status-menu-screen")).toBe("main");
      expect(findByTestId(menu, "status-menu-command-skills")?.className).toContain("selected");
      expect(controller.handleKey("ArrowDown")).toBe(true);
      menu = findByTestId(layout, "main-menu")!;
      // 3열 격자: skills(1) 아래는 record-menu(4).
      expect(findByTestId(menu, "status-menu-command-record-menu")?.className).toContain("selected");
      expect(controller.handleKey("Enter")).toBe(true);
      menu = findByTestId(layout, "main-menu")!;
      expect(menu.getAttribute("data-status-menu-screen")).toBe("function");
      expect(findByTestId(menu, "status-menu-detail")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-party-strip")).toBeNull();
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else delete (globalThis as { window?: unknown }).window;
      restore();
    }
  });

  it("party-first: 레일에서 → 를 누르면 작업 패널이 실제로 그려지고, ← 로 돌아오면 파티 개요가 다시 그려진다", () => {
    const restore = installFakeDom();
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: memoryStorage() } });
    try {
      const project = createBlankProject();
      project.system.menuUiStyle = "party-first";
      store.replaceProject(project);
      const session = startSession(project);
      const layout = document.createElement("div");
      document.body.append(layout);
      const scene = {
        session,
        getSession: () => session,
        refreshRuntimeSurfaces: () => undefined,
        syncRuntimeState: () => undefined,
      } as unknown as PlayScene;
      const controller = createPlayerStatusMenuController({
        layout,
        getActiveScene: () => scene,
        getPlayStage: () => layout,
        getPlayStartedAt: () => 0,
        closeMenu: () => undefined,
        closeMenuWithJuice: () => undefined,
        renderTitle: () => undefined,
        emitMenuJuice: () => undefined,
        menuCloseJuiceMs: 0,
        loadSlot: () => undefined,
      });

      controller.toggleMenu();
      const opened = findByTestId(layout, "main-menu");
      expect(opened).not.toBeNull();
      expect(findByTestId(opened!, "status-menu-party-overview")).not.toBeNull();
      expect(findByTestId(opened!, "status-menu-detail")).toBeNull();

      expect(controller.handleKey("ArrowRight")).toBe(true);
      const entered = findByTestId(layout, "main-menu")!;
      expect(entered.getAttribute("data-status-menu-screen")).toBe("function");
      expect(findByTestId(entered, "status-menu-detail")).not.toBeNull();
      expect(findByTestId(entered, "status-menu-side-party")).not.toBeNull();
      expect(findByTestId(entered, "status-menu-party-overview")).toBeNull();

      expect(controller.handleKey("ArrowLeft")).toBe(true);
      const back = findByTestId(layout, "main-menu")!;
      expect(back.getAttribute("data-status-menu-screen")).toBe("main");
      expect(findByTestId(back, "status-menu-party-overview")).not.toBeNull();
      expect(findByTestId(back, "status-menu-detail")).toBeNull();
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else delete (globalThis as { window?: unknown }).window;
      restore();
    }
  });
});
