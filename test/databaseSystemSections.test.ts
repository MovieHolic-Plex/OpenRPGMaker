import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryEntries, getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { createBlankProject } from "@/project/defaults";
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
  return nav.querySelectorAll(".db-system-section-nav");
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
const SECTION_KEY_TESTIDS: readonly { readonly slug: string; readonly testid: string }[] = [
  { slug: "overview", testid: "db-system-studio" },
  { slug: "party", testid: "db-picker-system-start-actor" },
  { slug: "display", testid: "db-field-system-resolution-preset" },
  { slug: "font", testid: "db-field-system-font-ui" },
  { slug: "resources", testid: "db-field-title-resource" },
  { slug: "startup", testid: "db-field-system-battle-flow" },
  { slug: "optin", testid: "db-field-system-skill-system" },
  { slug: "time", testid: "db-field-system-time-enabled" },
  { slug: "typechart", testid: "db-field-system-type-chart-types" },
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
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("renders exactly 10 section nav buttons in order", () => {
    const host = renderSystem();
    const buttons = sectionNavButtons(host);
    expect(buttons.map((button) => button.dataset.testid)).toEqual([
      "db-system-nav-overview",
      "db-system-nav-party",
      "db-system-nav-display",
      "db-system-nav-font",
      "db-system-nav-resources",
      "db-system-nav-startup",
      "db-system-nav-optin",
      "db-system-nav-time",
      "db-system-nav-typechart",
      "db-system-nav-title",
    ]);
    expect(buttons.map((button) => button.textContent)).toEqual([
      "개요",
      "초기 파티",
      "화면",
      "폰트",
      "리소스",
      "시작 설정",
      "기능 확장",
      "시간",
      "타입 상성",
      "타이틀",
    ]);
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
});
