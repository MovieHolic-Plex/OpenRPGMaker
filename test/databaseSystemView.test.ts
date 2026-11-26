import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderSystemTab, requestSystemSection, resetRequestedSystemSection } from "@/editor/panels/databaseSystemView";
import { DEFAULT_MENU_SKIN_ID, listMenuSkinIds, MENU_SKINS } from "@/player/menuSkins/registry";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit, getMapEditHistoryState } from "@/editor/mapEditHistory";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { resolveTimeSystem } from "@/project/gameTime";
import { listTitleMenuOptions } from "@/player/titleScreen";
import { getAudioEngine } from "@/player/audio";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { isolateTimers } from "./mergedTeardown";

// 자료집 시스템 탭 「게임 메뉴 디자인」 — ESC 메뉴 스킨 12종을 고르고, 기본값은 저장에서 지운다.
describe("databaseSystemMenuSkin", () => {
  isolateTimers();
  function renderSystem(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderSystemTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  describe("system tab menu skin cards", () => {
    let cleanup: (() => void) | undefined;

    beforeEach(() => {
      cleanup = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      cleanup?.();
      cleanup = undefined;
    });

    it("스킨 12종을 레지스트리 순서·라벨로 내놓고 기본이 선택돼 있다", () => {
      const host = renderSystem();
      const select = findByTestId(host, "db-field-system-menu-ui-style");
      expect(select).not.toBeNull();
      const cards = select!.children;
      expect(cards.map((card) => card.dataset.testid)).toEqual(listMenuSkinIds().map((id) => `db-system-menu-skin-${id}`));
      expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual(listMenuSkinIds().map((id) => MENU_SKINS[id].label));
      // 기본 스킨은 2026-09-28 에 workbench → pixel 로 바뀌었다(registry.ts DEFAULT_MENU_SKIN_ID). 이름을 박지 않고 상수를 본다.
      expect(findByTestId(host, `db-system-menu-skin-${DEFAULT_MENU_SKIN_ID}`)?.getAttribute("aria-pressed")).toBe("true");
    });

    it("선택을 바꾸면 store 에 반영되고 선택 표시와 설명이 따라온다, 기본으로 돌리면 키를 지운다", () => {
      const host = renderSystem();
      findByTestId(host, "db-system-menu-skin-hub")!.click();
      expect(store.getCurrent().system.menuUiStyle).toBe("hub");
      expect(findByTestId(host, "db-system-menu-skin-hub")?.getAttribute("aria-pressed")).toBe("true");
      expect(findByTestId(host, `db-system-menu-skin-${DEFAULT_MENU_SKIN_ID}`)?.getAttribute("aria-pressed")).toBe("false");
      expect(findByTestId(host, "db-system-menu-skin-description")?.textContent).toContain(MENU_SKINS.hub.label);
      findByTestId(host, `db-system-menu-skin-${DEFAULT_MENU_SKIN_ID}`)!.click();
      expect(store.getCurrent().system.menuUiStyle).toBeUndefined();
    });

    it("저장된 선택으로 다시 열면 그 값이 선택돼 있고 스튜디오 게임 메뉴 카드에도 라벨이 보인다", () => {
      store.update((draft) => {
        draft.system.menuUiStyle = "sheet";
      });
      const host = renderSystem();
      expect(findByTestId(host, "db-system-menu-skin-sheet")?.getAttribute("aria-pressed")).toBe("true");
      expect(findByTestId(host, "db-system-studio-card-menu")?.textContent).toContain(MENU_SKINS.sheet.label);
    });
  });
});

describe("databaseSystemModern", () => {
  isolateTimers();
  let cleanup: (() => void) | undefined;
  function render(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    document.body.append(host as unknown as HTMLElement);
    const refresh = (): void => {
      host.replaceChildren();
      renderSystemTab(host as unknown as HTMLElement, refresh);
      // fakeDom does not reflect the type attribute into HTMLInputElement.type.
      for (const input of host.querySelectorAll("input")) input.type = input.getAttribute("type") ?? "text";
    };
    refresh();
    return host;
  }
  function node(host: FakeElement, id: string): FakeElement {
    const result = findByTestId(host, id);
    if (!result) throw new Error(`Missing ${id}`);
    return result;
  }
  function change(host: FakeElement, id: string, value: string): void {
    const input = node(host, id); input.value = value; input.dispatchEvent(new Event("change"));
  }
  function checkbox(host: FakeElement, id: string, checked: boolean): void {
    const input = node(host, id); input.checked = checked; input.dispatchEvent(new Event("change"));
  }
  beforeEach(() => { cleanup = installFakeDom(); store.replace(createBlankProject()); resetMapEditHistory(); resetRequestedSystemSection(); });
  afterEach(() => { vi.unstubAllGlobals(); cleanup?.(); resetRequestedSystemSection(); });
  describe("System workspace contracts", () => {
    it("indexes all nine editing destinations and filters without dirtying or replacing search", () => {
      const host = render();
      const studio = node(host, "db-system-studio");
      const targets = new Set(studio.querySelectorAll("button").map((button) => button.dataset.systemTarget).filter(Boolean));
      expect([...targets].sort()).toEqual(["party", "display", "menu", "hud", "font", "resources", "sound", "startup", "optin", "time", "typechart", "title"].sort());
      const before = JSON.stringify(store.getCurrent());
      const search = node(host, "db-system-studio-command-search");
      search.focus(); search.value = "__no_matching_setting__"; search.dispatchEvent(new Event("input"));
      expect(node(host, "db-system-studio-no-results").hidden).toBe(false);
      expect(node(host, "db-system-studio-command-search")).toBe(search);
      node(host, "db-system-studio-search-reset").click();
      expect(search.value).toBe("");
      expect(node(host, "db-system-studio-no-results").hidden).toBe(true);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });

    it("routes requested focus and preserves all mounted section identities during navigation", () => {
      requestSystemSection("display", "db-field-system-resolution-width");
      const host = render();
      expect(host.dataset.dbSystemSection).toBe("display");
      expect(document.activeElement).toBe(node(host, "db-field-system-resolution-width"));
      const sections = host.querySelectorAll(".db-system-section");
      const nav = node(host, "db-system-section-nav");
      // 「소리」 구획(#4968)이 더해져 14개다.
      expect(nav.querySelectorAll(".db-system-section-button")).toHaveLength(14);
      expect(nav.querySelectorAll(".db-system-section-nav")).toHaveLength(0);
      node(host, "db-system-nav-party").click();
      expect(host.querySelectorAll(".db-system-section")).toEqual(sections);
      expect(sections.filter((section) => !section.hidden).map((section) => section.dataset.systemSection)).toEqual(["party"]);
    });

    it("keeps focused title typing mounted and updates preview and authored menu labels", () => {
      const host = render();
      node(host, "db-system-nav-title").click();
      const title = node(host, "db-field-title-screen-title");
      title.focus(); title.value = "새 제목 sentinel"; title.dispatchEvent(new Event("input"));
      expect(node(host, "db-field-title-screen-title")).toBe(title);
      expect(document.activeElement).toBe(title);
      expect(node(host, "db-title-workbench-title-text").textContent).toBe(title.value);
      const resume = node(host, "db-field-title-screen-resume");
      resume.focus(); resume.value = "resume-sentinel"; resume.dispatchEvent(new Event("input"));
      expect(node(host, "db-field-title-screen-resume")).toBe(resume);
      const expected = listTitleMenuOptions(store.getCurrent().system.titleScreen!, { autosaveAvailable: true });
      const preview = node(host, "db-title-workbench-menu-preview");
      expect(preview.childNodes.map((entry) => (entry as FakeElement).textContent)).toEqual(expected.map((option) => option.label));
    });

    it("retains disabled calendars through normalization and keeps the runtime clock off", () => {
      store.update((draft) => { draft.system.timeSystem = { enabled: true, daysPerSeason: 31, dayStartHour: 7, dayEndHour: 27, minutesPerRealSecond: 2.5, forceSleep: true }; });
      const host = render();
      checkbox(host, "db-field-system-time-enabled", false);
      const normalized = normalizeSystemRecords(store.getCurrent().system);
      expect(normalized.timeSystem).toMatchObject({ enabled: false, daysPerSeason: 31, dayStartHour: 7, dayEndHour: 27, minutesPerRealSecond: 2.5, forceSleep: true });
      expect(resolveTimeSystem(normalized.timeSystem)).toBeUndefined();
      checkbox(host, "db-field-system-time-enabled", true);
      expect(resolveTimeSystem(store.getCurrent())).toMatchObject({ daysPerSeason: 31, dayStartHour: 7, dayEndHour: 27, minutesPerRealSecond: 2.5 });
    });

    it("directly clears a logo, preserves sibling fields, and supports undo and reopening", () => {
      store.update((draft) => { draft.system.titleScreen!.titleGraphic = { mode: "both", resourceId: "easyrpg-title-title1", x: 32, y: 24 }; });
      resetMapEditHistory();
      const host = render();
      node(host, "db-field-title-screen-logo-clear").click();
      expect(normalizeSystemRecords(store.getCurrent().system).titleScreen?.titleGraphic).toMatchObject({ mode: "both", x: 32, y: 24 });
      expect(store.getCurrent().system.titleScreen?.titleGraphic?.resourceId).toBeUndefined();
      expect(undoMapEdit()).toBe(true);
      // 다시 열기 = 먼저 연 탭은 닫히고 새로 그린다. 첫 탭을 문서에 붙여 둔 채 둘째 탭을 그리면, 가짜 DOM 의 MutationObserver 가 변경 하나마다
      // 지켜보는 나무 전체(붙어 있는 첫 탭까지)를 훑어(fakeDom FakeNode.contains) 이 한 경우가 러너에서 17.8~37.9초 걸렸고 기본 한도 15초를 넘겼다.
      // 제품 시간이 아니다 — 첫 탭을 떼면 둘째 그리기는 첫째와 같은 시간이다. 한도는 그대로 둔다.
      host.remove();
      expect(node(render(), "db-field-title-screen-logo").value).toBe("easyrpg-title-title1");
    });

    it("preserves authored parallax when editing a title layer and omits default scroll", () => {
      store.update((draft) => { draft.system.titleScreen!.backgroundLayers = [{ resourceId: "easyrpg-title-title1", parallax: 2.5, scrollXPerSec: 7 }]; });
      const host = render();
      change(host, "db-field-title-screen-layer-0-opacity", "65");
      change(host, "db-field-title-screen-layer-0-scroll-x", "0");
      expect(store.getCurrent().system.titleScreen?.backgroundLayers).toEqual([{ resourceId: "easyrpg-title-title1", parallax: 2.5, opacity: .65 }]);
    });

    it("provides direct matrix entry, bounded mutation, diagonal protection and clear cancellation", () => {
      store.update((draft) => { draft.system.typeChart = { types: ["fire", "water"], multipliers: { fire: { water: .5 } } }; });
      const host = render();
      expect(node(host, "db-type-chart-fire-fire").disabled).toBe(true);
      const direct = node(host, "db-type-chart-direct-edit");
      direct.click();
      expect(node(host, "db-type-chart-popover").hidden).toBe(false);
      node(host, "db-type-chart-popover-input").value = "1.25";
      node(host, "db-type-chart-popover-confirm").click();
      expect(store.getCurrent().system.typeChart?.multipliers.fire?.water).toBe(1.25);
      expect(document.activeElement).toBe(direct);
      direct.click(); node(host, "db-type-chart-popover-input").value = "9";
      node(host, "db-type-chart-popover-confirm").click();
      expect(store.getCurrent().system.typeChart?.multipliers.fire?.water).toBe(4);
      const before = structuredClone(store.getCurrent().system.typeChart);
      vi.stubGlobal("confirm", () => false);
      change(host, "db-field-system-type-chart-types", "");
      expect(store.getCurrent().system.typeChart).toEqual(before);
      vi.stubGlobal("confirm", () => true);
      change(host, "db-field-system-type-chart-types", "");
      expect(store.getCurrent().system.typeChart).toBeUndefined();
    });
  });
});

describe("databaseSystemSections", () => {
  isolateTimers();
  function renderSystem(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderSystemTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  function sectionNavButtons(host: FakeElement): FakeElement[] {
    const nav = findByTestId(host, "db-system-section-nav");
    if (!nav) throw new Error("missing section nav");
    return nav.querySelectorAll(".db-system-section-button");
  }
  function sectionNode(host: FakeElement, slug: string): FakeElement {
    const node = host.querySelector(`[data-system-section="${slug}"]`);
    if (!node) throw new Error(`missing section ${slug}`);
    return node;
  }
  function clickNav(host: FakeElement, slug: string): void {
    const button = findByTestId(host, `db-system-nav-${slug}`);
    if (!button) throw new Error(`missing nav button ${slug}`);
    button.click();
  }
  /** 각 섹션을 대표하는 testid — 섹션 상태와 무관하게 DOM 에 존재해야 한다. */
  // 게임 메뉴·대화창·HUD 의 키 testid 는 실제 컨트롤 이름이다(스킨 카드 묶음·대화창 스타일 갤러리·HUD 스튜디오 뿌리).
  const SECTION_KEY_TESTIDS: readonly { readonly slug: string; readonly testid: string }[] = [
    { slug: "overview", testid: "db-system-studio" },
    { slug: "party", testid: "db-picker-system-start-actor" },
    { slug: "startup", testid: "db-field-system-battle-flow" },
    { slug: "optin", testid: "db-field-system-skill-system" },
    { slug: "time", testid: "db-field-system-time-enabled" },
    { slug: "typechart", testid: "db-field-system-type-chart-types" },
    { slug: "display", testid: "db-field-system-resolution-preset" },
    { slug: "menu", testid: "db-field-system-menu-ui-style" },
    { slug: "dialogue", testid: "db-field-system-dialogue-style" },
    { slug: "hud", testid: "db-field-hud" },
    { slug: "font", testid: "db-field-system-font-ui" },
    { slug: "resources", testid: "db-field-title-resource" },
    { slug: "sound", testid: "db-field-system-default-bgm" },
    { slug: "title", testid: "db-title-workbench" },
  ];
  describe("database system section navigation", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      cleanupDom?.();
      cleanupDom = undefined;
    });

    it("renders 14 section nav buttons in order under 3 subheadings and lifts title jump links", () => {
      const host = renderSystem();
      const nav = findByTestId(host, "db-system-section-nav")!;
      const buttons = sectionNavButtons(host);
      expect(buttons.map((button) => button.dataset.testid)).toEqual([
        "db-system-nav-overview",
        "db-system-nav-party",
        "db-system-nav-startup",
        "db-system-nav-optin",
        "db-system-nav-time",
        "db-system-nav-typechart",
        "db-system-nav-display",
        "db-system-nav-menu",
        "db-system-nav-dialogue",
        "db-system-nav-hud",
        "db-system-nav-font",
        "db-system-nav-resources",
        "db-system-nav-sound",
        "db-system-nav-title",
      ]);
      expect(buttons.map((button) => button.textContent)).toEqual([
        "개요",
        "초기 파티",
        "시작 설정",
        "기능 확장",
        "시간",
        "타입 상성",
        "화면",
        "게임 메뉴",
        "대화창",
        "인게임 HUD",
        "폰트",
        "리소스",
        "소리",
        "타이틀",
      ]);
      expect(nav.querySelectorAll(".db-system-section-subhead").map((subhead) => subhead.textContent)).toEqual([
        "규칙",
        "보이는 것",
        "시작·끝",
      ]);
      const jump = findByTestId(nav, "db-title-workbench-jump")!;
      expect(jump.hidden).toBe(true);
      expect(jump.querySelectorAll(".db-title-workbench-jump-link").map((link) => link.textContent)).toEqual([
        "오프닝 효과",
        "글자·배경",
        "메뉴",
        "연출",
        "소리",
      ]);
      clickNav(host, "title");
      expect(jump.hidden).toBe(false);
    });

    it("gathers default, battle, and title sound pickers in the sound section once", () => {
      const host = renderSystem();
      const sound = sectionNode(host, "sound");
      for (const testid of [
        "db-field-system-default-bgm",
        "db-field-system-battle-bgm",
        "db-field-system-battle-victory-me",
        "db-field-system-battle-defeat-se",
        "db-field-system-battle-escape-se",
        "db-field-title-screen-music",
        "db-field-title-screen-se-cursor",
        "db-field-title-screen-se-confirm",
        "db-field-title-screen-se-cancel",
      ]) {
        expect(host.querySelectorAll(`[data-testid="${testid}"]`)).toHaveLength(1);
        expect(findByTestId(sound, testid)).not.toBeNull();
      }
      // 옛 자리(시작 설정 「전투 오디오」, 타이틀 「소리」)에는 소리 구획 링크만 남는다.
      expect(findByTestId(sectionNode(host, "startup"), "db-system-startup-open-sound")?.dataset.systemTarget).toBe("sound");
      expect(findByTestId(sectionNode(host, "title"), "db-title-open-sound")?.dataset.systemTarget).toBe("sound");
      clickNav(host, "startup");
      findByTestId(host, "db-system-startup-open-sound")!.click();
      expect(sectionNode(host, "sound").hidden).toBe(false);
    });

    it("defaults to the overview section active and keeps the party editor hidden", () => {
      const host = renderSystem();
      const buttons = sectionNavButtons(host);
      expect(buttons[0]?.classList.contains("active")).toBe(true);
      expect(buttons.every((button, index) => button.classList.contains("active") === (index === 0))).toBe(true);
      expect(sectionNode(host, "overview").hidden).toBe(false);
      expect(sectionNode(host, "party").hidden).toBe(true);
      // 비활성 섹션은 [hidden] 처리 — 여전히 DOM 에 존재하지만 숨겨진다.
      for (const { slug } of SECTION_KEY_TESTIDS) {
        if (slug === "overview") continue;
        expect(sectionNode(host, slug).hidden).toBe(true);
      }
    });

    it("switches the active section on nav click", () => {
      const host = renderSystem();

      clickNav(host, "typechart");
      expect(sectionNode(host, "typechart").hidden).toBe(false);
      expect(sectionNode(host, "party").hidden).toBe(true);
      const buttons = sectionNavButtons(host);
      const active = buttons.filter((button) => button.classList.contains("active"));
      expect(active.map((button) => button.dataset.testid)).toEqual(["db-system-nav-typechart"]);

      clickNav(host, "title");
      expect(sectionNode(host, "title").hidden).toBe(false);
      expect(sectionNode(host, "typechart").hidden).toBe(true);
      const activeAfter = sectionNavButtons(host).filter((button) => button.classList.contains("active"));
      expect(activeAfter.map((button) => button.dataset.testid)).toEqual(["db-system-nav-title"]);

      clickNav(host, "party");
      expect(sectionNode(host, "party").hidden).toBe(false);
      expect(sectionNode(host, "title").hidden).toBe(true);
    });

    it("keeps every section's key testids in the DOM (mounted-hidden approach)", () => {
      const host = renderSystem();
      for (const { testid } of SECTION_KEY_TESTIDS) {
        expect(findByTestId(host, testid)).not.toBeNull();
      }
      // 각 섹션으로 전환하면 해당 섹션의 키 testid 가 그대로 조회된다.
      for (const { slug, testid } of SECTION_KEY_TESTIDS) {
        clickNav(host, slug);
        expect(sectionNode(host, slug).hidden).toBe(false);
        expect(findByTestId(host, testid)).not.toBeNull();
      }
    });

    it("nav clicking produces zero store.update calls (no snapshot-history growth)", () => {
      const host = renderSystem();
      expect(getMapEditHistoryState().canUndo).toBe(false);
      const entriesBefore = getMapEditHistoryEntries().length;
      const projectBefore = JSON.stringify(store.getCurrent());

      for (const { slug } of SECTION_KEY_TESTIDS) clickNav(host, slug);
      clickNav(host, "party");

      expect(getMapEditHistoryEntries().length).toBe(entriesBefore);
      expect(getMapEditHistoryState().canUndo).toBe(false);
      expect(JSON.stringify(store.getCurrent())).toBe(projectBefore);
    });

    it("stops title BGM preview when leaving the title section", () => {
      const project = createBlankProject();
      project.system.titleScreen = { ...defaultTitleScreenSettings(), musicResourceId: "cc0-music-field-loop" };
      store.replace(project);
      const host = renderSystem();
      document.body.append(host);
      clickNav(host, "title");
      const engine = getAudioEngine();
      vi.spyOn(engine, "play").mockImplementation(() => undefined);
      const stop = vi.spyOn(engine, "stopChannel");
      clickNav(host, "startup");
      expect(stop).not.toHaveBeenCalled();
      clickNav(host, "title");
      findByTestId(host, "db-title-bgm-play")!.click();
      clickNav(host, "startup");
      expect(stop).toHaveBeenCalledWith("bgm", 0);
    });
  });
});

describe("databaseSystemStudio", () => {
  isolateTimers();
  function renderSystem(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderSystemTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  describe("database system studio", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      const project = createBlankProject();
      const switchId = project.switches[0]?.id;
      const variableId = project.variables[0]?.id;
      if (!switchId || !variableId) throw new Error("blank project needs state records");
      project.switches[0]!.name = "다리 복구 완료";
      project.variables[0]!.name = "현재 챕터";
      project.storyFlags = [
        {
          id: "bridge-repaired",
          kind: "switch",
          targetId: switchId,
          description: "다리 복구 퀘스트 진행 상태",
          questId: "quest",
        },
        {
          id: "chapter-current",
          kind: "variable",
          targetId: variableId,
          description: "현재 진행 중인 챕터",
        },
      ];
      store.replace(project);
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
    });

    it("renders the modern overview, semantic state registry, and live preview", () => {
      // Break named: System still opens as a legacy fieldset page without the studio overview.
      const host = renderSystem();

      expect(findByTestId(host, "db-system-studio")).not.toBeNull();
      expect(findByTestId(host, "db-system-studio-header")?.textContent).toContain("시스템 개요");
      expect(findByTestId(host, "db-system-studio-command-search")).not.toBeNull();
      expect(findByTestId(host, "db-system-studio-state-table")?.textContent).toContain("quest.bridge-repaired");
      expect(findByTestId(host, "db-system-studio-state-table")?.textContent).toContain("chapter-current");
      expect(findByTestId(host, "db-system-studio-live-preview")).not.toBeNull();
      expect(findByTestId(host, "db-system-studio-impact-list")).not.toBeNull();
    });

    it("only presents project-backed settings as actionable cards", () => {
      // Break named: hard-coded Save, Economy, and Input cards pretend unimplemented settings are complete.
      const host = renderSystem();
      const studio = findByTestId(host, "db-system-studio");
      if (!studio) throw new Error("missing system studio");

      for (const id of ["startup", "party", "display", "time", "sound", "combat", "features", "title"]) {
        expect(findByTestId(host, `db-system-studio-card-${id}`)).not.toBeNull();
      }
      for (const id of ["save", "economy", "input"]) {
        expect(findByTestId(host, `db-system-studio-card-${id}`)).toBeNull();
      }
      expect(studio.textContent).not.toContain("구성 완료");
      expect(studio.textContent).not.toContain("주의 1개");
      expect(studio.textContent).not.toContain("자동 저장 사용");
    });

    it("derives every rule-card detail from authored project values", () => {
      // Break named: rule-card rows keep fixed completion claims when the authored System values change.
      const project = createBlankProject();
      project.system.playResolution = { width: 640, height: 360 };
      project.system.battleFlow = "strict";
      project.system.activeSlots = 2;
      project.system.battleUiStyle = "retro2003";
      project.system.battleModel = "gen1";
      project.system.skillSystem = { enabled: true };
      project.system.actionCombat = { enabled: true };
      store.replace(project);
      const host = renderSystem();

      expect(findByTestId(host, "db-system-studio-card-display")?.textContent).toContain("640×360");
      expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("턴 전투");
      expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("2명");
      // 전투 카드는 이제 스킨 이름·전투 모델 대신 「전투 방식」(측면/몬스터 두 단추)과 「전투 화면」 요약을 보인다
      // (자료집 전투 정리 — databaseSystemStudio.ts ruleCardGrid, 공개 기준 커밋 0d4f13e7c8 에 이미 반영). 저작 값에서 나온다:
      // battleUiStyle retro2003 → 측면, pokemon → 몬스터.
      expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("도트 측면 (RM2003식)");
      store.update((draft) => { draft.system.battleUiStyle = "pokemon"; });
      const monsterHost = renderSystem();
      expect(findByTestId(monsterHost, "db-system-studio-card-combat")?.textContent).toContain("몬스터 대치 (포켓몬식)");
      expect(findByTestId(host, "db-system-studio-card-features")?.textContent).toContain("생활 스킬사용");
      expect(findByTestId(host, "db-system-studio-card-features")?.textContent).toContain("액션 전투사용");

      for (const id of ["combat", "features", "title"]) {
        for (let index = 0; index < 4; index += 1) {
          expect(findByTestId(host, `db-system-studio-card-${id}-detail-${index}`)).not.toBeNull();
        }
        expect(findByTestId(host, `db-system-studio-card-${id}-open`)).not.toBeNull();
      }
    });

    it("renders preview facts as non-interactive project values", () => {
      // Break named: inert preview buttons and 'all screens' affordances imply navigation that does not exist.
      const host = renderSystem();
      const impactList = findByTestId(host, "db-system-studio-impact-list");
      if (!impactList) throw new Error("missing impact list");

      const rows = impactList.querySelectorAll(".db-system-studio-impact-row");
      expect(rows).toHaveLength(4);
      expect(rows.every((row) => row.tagName !== "BUTTON")).toBe(true);
      expect(impactList.querySelector(".db-system-studio-all-screens")).toBeNull();
      expect(impactList.textContent).not.toContain("저장/불러오기");
    });

    it("includes configured resume in the overview title summary", () => {
      store.update((draft) => {
        draft.system.titleScreen!.menuLabels.resume = "resume-authored-sentinel";
        draft.system.titleScreen!.menuVisibility.resume = true;
      });
      const host = renderSystem();
      expect(findByTestId(host, "db-system-studio-live-preview")?.textContent).toContain("resume-authored-sentinel");
    });

    it("navigates from an overview card without writing project state", () => {
      // Break named: overview cards are decorative and cannot enter the existing authoring section.
      const host = renderSystem();
      const before = JSON.stringify(store.getCurrent());
      const startup = findByTestId(host, "db-system-studio-card-startup");
      if (!startup) throw new Error("missing startup card");

      startup.click();

      expect(findByTestId(host, "db-system-nav-startup")?.classList.contains("active")).toBe(true);
      expect(host.querySelector('[data-system-section="startup"]')?.hidden).toBe(false);
      expect(JSON.stringify(store.getCurrent())).toBe(before);
    });
  });
});
