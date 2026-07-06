import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderClassicPageTabStrip } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition, GameEvent } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreFakeDom: () => void = () => undefined;

function eventPage(id: string, overrides: Partial<EventPage> = {}): EventPage {
  return {
    id,
    name: "EV001",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
    ...overrides,
  };
}

function gameEvent(pages: EventPage[]): GameEvent {
  return {
    id: "event-1",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages,
  };
}

function richConditions(): EventPageCondition[] {
  return [
    { kind: "switch", switchId: "sw_0001", value: true },
    { kind: "variable", variableId: "var_0001", op: ">=", value: 3 },
    { kind: "item", itemId: "missing-item", present: true },
    { kind: "actor", actorId: "missing-actor", present: true },
    { kind: "timer", timerId: "timer1", seconds: 30 },
  ];
}

function renderStrip(pages: EventPage[], activePage: EventPage = pages[0]!): FakeElement {
  const strip = renderClassicPageTabStrip(gameEvent(pages), activePage);
  if (!(strip instanceof FakeElement)) throw new Error("expected FakeElement render");
  return strip;
}

describe("rich event page tabs", () => {
  beforeEach(() => {
    restoreFakeDom = installFakeDom();
    const project = createBlankProject();
    const firstSwitch = project.switches.find((record) => record.id === "sw_0001");
    if (firstSwitch) firstSwitch.name = "별등 의뢰 수락";
    const firstVariable = project.variables.find((record) => record.id === "var_0001");
    if (firstVariable) firstVariable.name = "별등 진행도";
    store.replace(project);
    editorState.set({ selectedEventPageId: null });
  });

  afterEach(() => {
    restoreFakeDom();
  });

  it("renders a graphic micro-thumbnail inside every page tab", () => {
    const pages = [
      eventPage("page-1"),
      eventPage("page-2", { graphic: { sprite: { type: "bundled", id: "unknown-sprite" } } }),
    ];
    const strip = renderStrip(pages);

    const tab1 = findByTestId(strip, "event-page-tab-1");
    const tab2 = findByTestId(strip, "event-page-tab-2");
    expect(tab1).not.toBeNull();
    expect(tab2).not.toBeNull();

    const thumb1 = findByTestId(tab1!, "event-page-tab-thumb");
    const thumb2 = findByTestId(tab2!, "event-page-tab-thumb");
    expect(thumb1).not.toBeNull();
    expect(thumb2).not.toBeNull();

    const emptyIcon = findByTestId(thumb1!, "event-page-graphic-icon-preview");
    expect(emptyIcon).not.toBeNull();
    expect(emptyIcon?.dataset.empty).toBe("true");

    const spriteIcon = findByTestId(thumb2!, "event-page-graphic-icon-preview");
    expect(spriteIcon).not.toBeNull();
    expect(spriteIcon?.dataset.spriteId).toBe("unknown-sprite");
  });

  it("renders condition badges capped at three plus an overflow counter", () => {
    const pages = [eventPage("page-1"), eventPage("page-2", { conditions: richConditions() })];
    const strip = renderStrip(pages);

    const badges1 = findByTestId(findByTestId(strip, "event-page-tab-1")!, "event-page-tab-badges");
    expect(badges1).not.toBeNull();
    expect(badges1?.querySelectorAll(".event-page-tab-badge")).toHaveLength(0);

    const badges2 = findByTestId(findByTestId(strip, "event-page-tab-2")!, "event-page-tab-badges");
    expect(badges2).not.toBeNull();
    const badgeTexts = badges2!.querySelectorAll(".event-page-tab-badge").map((badge) => badge.textContent);
    expect(badgeTexts).toEqual(["S", "V", "I", "+2"]);
    expect(badges2!.querySelector(".event-page-tab-badge-switch")?.textContent).toBe("S");
    expect(badges2!.querySelector(".event-page-tab-badge-more")?.textContent).toBe("+2");
  });

  it("summarizes conditions with database names in the tab tooltip", () => {
    const pages = [
      eventPage("page-1"),
      eventPage("page-2", { name: "의뢰 수락 후", conditions: richConditions() }),
    ];
    const strip = renderStrip(pages);

    const title1 = findByTestId(strip, "event-page-tab-1")!.getAttribute("title") ?? "";
    expect(title1).toContain("페이지 1 — EV001");
    expect(title1).toContain("조건 없음");

    const title2 = findByTestId(strip, "event-page-tab-2")!.getAttribute("title") ?? "";
    expect(title2).toContain("페이지 2 — 의뢰 수락 후");
    expect(title2).toContain("스위치 [0001: 별등 의뢰 수락] ON");
    expect(title2).toContain("변수 [0001: 별등 진행도] >= 3");
    expect(title2).toContain("아이템 [missing-item] 보유 중");
    expect(title2).toContain("주인공 [missing-actor] 파티에 있음");
    expect(title2).toContain("타이머 1 30초 이하");
  });

  it("keeps the numeric label, testid, active class, and click selection behavior", () => {
    const pages = [eventPage("page-1"), eventPage("page-2", { conditions: richConditions() })];
    const strip = renderStrip(pages, pages[1]!);

    expect(strip.dataset.testid).toBe("event-classic-page-tabs");
    const tab1 = findByTestId(strip, "event-page-tab-1")!;
    const tab2 = findByTestId(strip, "event-page-tab-2")!;
    expect(tab1.tagName).toBe("BUTTON");
    expect(tab2.tagName).toBe("BUTTON");

    expect(tab1.querySelector(".event-page-tab-number")?.textContent).toBe("1");
    expect(tab2.querySelector(".event-page-tab-number")?.textContent).toBe("2");
    expect(tab1.textContent).toContain("1");
    expect(tab2.textContent).toContain("2");

    expect(tab1.className).not.toContain("active");
    expect(tab2.className).toContain("active");

    tab1.click();
    expect(editorState.get().selectedEventPageId).toBe("page-1");
    tab2.click();
    expect(editorState.get().selectedEventPageId).toBe("page-2");
  });
});
