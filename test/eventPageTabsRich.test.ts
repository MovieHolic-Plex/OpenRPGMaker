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
  const strip = renderClassicPageTabStrip("map_start", gameEvent(pages), activePage);
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

  it("renders page tabs without graphic thumbnails (mockup v2 contract)", () => {
    const pages = [
      eventPage("page-1"),
      eventPage("page-2", { graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } } }),
    ];
    const strip = renderStrip(pages);

    const tab1 = findByTestId(strip, "evt-page-segment-1");
    const tab2 = findByTestId(strip, "evt-page-segment-2");
    expect(tab1).not.toBeNull();
    expect(tab2).not.toBeNull();
    // 목업 v2: 탭은 번호 + 이름 + 조건 요약 + 배지만 가진다 — 썸네일은 없다.
    expect(findByTestId(tab1!, "event-page-tab-thumb")).toBeNull();
    expect(findByTestId(tab2!, "event-page-tab-thumb")).toBeNull();
    expect(tab2!.querySelector(".event-page-tab-thumb")).toBeNull();
  });

  it("renders condition badges capped at three plus an overflow counter", () => {
    const pages = [eventPage("page-1"), eventPage("page-2", { conditions: richConditions() })];
    const strip = renderStrip(pages);

    const tab1 = findByTestId(strip, "evt-page-segment-1");
    const tab2 = findByTestId(strip, "evt-page-segment-2");
    expect(tab1).not.toBeNull();
    expect(tab2).not.toBeNull();
    expect(findByTestId(tab1!, "event-page-tab-badges")).toBeNull();
    expect(findByTestId(tab2!, "event-page-tab-badges")).toBeNull();
  });

  it("summarizes conditions with database names in the tab tooltip", () => {
    const pages = [
      eventPage("page-1"),
      eventPage("page-2", { name: "의뢰 수락 후", conditions: richConditions() }),
    ];
    const strip = renderStrip(pages);

    const title1 = findByTestId(strip, "evt-page-segment-1")!.getAttribute("title") ?? "";
    expect(title1).toContain("페이지 1 — EV001");
    expect(title1).toContain("조건 없음");

    const title2 = findByTestId(strip, "evt-page-segment-2")!.getAttribute("title") ?? "";
    expect(title2).toContain("페이지 2 — 의뢰 수락 후");
    expect(title2).toContain("별등 의뢰 수락 켜짐");
    expect(title2).toContain("별등 진행도 >= 3");
    expect(title2).toContain("아이템 missing-item 있음");
    expect(title2).toContain("주인공 [missing-actor] 파티에 있음");
    expect(title2).toContain("타이머 1 30초 이하");
  });

  it("keeps the numeric label, testid, active class, and click selection behavior", () => {
    const pages = [eventPage("page-1"), eventPage("page-2", { conditions: richConditions() })];
    const strip = renderStrip(pages, pages[1]!);

    expect(strip.dataset.testid).toBe("evt-header-page-tabs");
    const tab1 = findByTestId(strip, "evt-page-segment-1")!;
    const tab2 = findByTestId(strip, "evt-page-segment-2")!;
    expect(tab1.tagName).toBe("BUTTON");
    expect(tab2.tagName).toBe("BUTTON");

    expect(tab1.querySelector(".evt-page-segment-number")?.textContent).toBe("1");
    expect(tab2.querySelector(".evt-page-segment-number")?.textContent).toBe("2");
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
