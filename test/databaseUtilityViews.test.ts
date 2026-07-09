import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderSwitchesTab, renderVariablesTab } from "@/editor/panels/databaseUtilityViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function namedSwitches(): { id: string; name: string }[] {
  return store.getCurrent().switches.filter((record) => record.name.trim().length > 0);
}

function namedVariables(): { id: string; name: string }[] {
  return store.getCurrent().variables.filter((record) => record.name.trim().length > 0);
}

function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    render(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

describe("database utility views", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("switch add button creates the next numbered switch and focuses name input", () => {
    const host = renderUtility(renderSwitchesTab);
    expect(host.textContent).toContain("아직 스위치가 없습니다");
    expect(host.querySelectorAll(".db-empty-row")).toHaveLength(0);

    findByTestId(host, "db-add-switch")?.click();
    const input = findByTestId(host, "db-utility-selected-name");
    if (!input) throw new Error("missing selected switch input");
    input.value = "문 열림";
    input.dispatchEvent(new Event("input"));

    expect(namedSwitches()).toEqual([{ id: "sw_0001", name: "문 열림" }]);
    expect(document.activeElement).toBe(input);
  });

  it("variable add button creates the next numbered variable and supports rename", () => {
    const host = renderUtility(renderVariablesTab);

    findByTestId(host, "db-add-variable")?.click();
    const input = findByTestId(host, "db-utility-selected-name");
    if (!input) throw new Error("missing selected variable input");
    input.value = "퍼즐 점수";
    input.dispatchEvent(new Event("input"));

    expect(namedVariables()).toEqual([{ id: "var_0001", name: "퍼즐 점수" }]);
    expect(document.activeElement).toBe(input);
  });

  it("row delete button removes unused switches through the existing action path", () => {
    const host = renderUtility(renderSwitchesTab);
    findByTestId(host, "db-add-switch")?.click();

    findByTestId(host, "db-delete-sw_0001")?.click();

    expect(namedSwitches()).toEqual([]);
    expect(host.textContent).toContain("아직 스위치가 없습니다");
  });

  it("shows story flags in a read-only section instead of decorating switch rows", () => {
    store.update((project) => {
      const first = project.switches.find((record) => record.id === "sw_0001");
      if (!first) throw new Error("missing sw_0001");
      first.name = "시장 만남";
      project.storyFlags = [{
        id: "met-mayor",
        kind: "switch",
        targetId: "sw_0001",
        description: "촌장을 만남",
      }];
    });

    const host = renderUtility(renderSwitchesTab);
    const row = host.querySelector(".db-utility-row");
    const storyFlags = host.querySelector(".db-story-flag-list");

    expect(row?.textContent).toContain("시장 만남");
    expect(row?.textContent).not.toContain("met-mayor");
    expect(storyFlags?.textContent).toContain("스토리 플래그 (읽기 전용)");
    expect(storyFlags?.textContent).toContain("met-mayor");
  });
});
