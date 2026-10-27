import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryEntries, getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { getAudioEngine } from "@/player/audio";
import { createBlankProject } from "@/project/defaults";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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

  it("renders 13 section nav buttons in order under 3 subheadings and lifts title jump links", () => {
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
