import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const COMMON_TABS = [
  "db-tab-overview",
  "db-tab-actors",
  "db-tab-items",
  "db-tab-enemies",
  "db-tab-troops",
  "db-tab-system",
];

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  setDatabaseActiveTab("actors");
});

afterEach(() => {
  resetEditorUiModeForTests("standard");
  restoreDom?.();
  restoreDom = null;
});

function renderPanel(mode: "beginner" | "standard" | "expert"): FakeElement {
  resetEditorUiModeForTests(mode);
  const host = document.createElement("div") as unknown as FakeElement;
  renderDatabasePanel(host as unknown as HTMLElement);
  return host;
}

function directTabIds(node: FakeElement): string[] {
  return node.children
    .filter((child) => child.classList.contains("db-tab"))
    .map((child) => child.dataset.testid ?? "");
}

describe("database navigation by editor mode", () => {
  it("shows exactly six common tabs before a closed all-data disclosure in beginner mode", () => {
    const host = renderPanel("beginner");
    const nav = host.querySelector(".db-tabs");
    if (!nav) throw new Error("missing database navigation");

    expect(directTabIds(nav)).toEqual(COMMON_TABS);
    const all = findByTestId(nav, "db-nav-all");
    if (!all) throw new Error("missing all-data disclosure");
    expect(all.tagName).toBe("DETAILS");
    expect(all.getAttribute("open")).toBeNull();
    expect(all.children[0]?.tagName).toBe("SUMMARY");
    expect(all.children[0]?.textContent).toBe("모든 자료");
    expect(all.children[0]?.textContent).not.toContain("DB");

    const switches = findByTestId(all, "db-tab-switches");
    expect(switches).not.toBeNull();
    expect(findByTestId(nav, "db-tab-switches")?.closest("details")).toBe(all);

    all.setAttribute("open", "");
    expect(all.getAttribute("open")).toBe("");
    expect(findByTestId(all, "db-tab-switches")?.textContent).toBe("스위치");
  });

  it("keeps grouped navigation with explicit monster and life domains in standard mode", () => {
    const host = renderPanel("standard");
    const groups = host.querySelectorAll(".db-tab-group").map((group) => group.textContent);
    // 몬스터는 전투 규칙과 분리된 독립 그룹이다 — 예전 `전투·몬스터` 한 덩어리(9탭)가 아니다.
    expect(groups).toContain("몬스터");
    expect(groups).toContain("전투 규칙");
    expect(groups).toContain("생활");
    expect(findByTestId(host, "db-nav-all")).toBeNull();
  });

  it("shows the full expert surface without an all-data disclosure", () => {
    const host = renderPanel("expert");
    const nav = host.querySelector(".db-tabs");
    if (!nav) throw new Error("missing database navigation");

    expect(findByTestId(host, "db-nav-all")).toBeNull();
    expect(directTabIds(nav)).toContain("db-tab-tilesets");
    expect(findByTestId(nav, "db-tab-tilesets")?.closest("details")).toBeNull();
  });
});
