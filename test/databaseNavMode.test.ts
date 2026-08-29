import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";


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
  it("groups the rail by category in beginner mode too — no all-data disclosure", () => {
    const host = renderPanel("beginner");
    const nav = host.querySelector(".db-tabs");
    if (!nav) throw new Error("missing database navigation");

    // 예전 초보 레일은 자주 쓰는 6개만 깔고 남은 24개를 <details>「모든 자료」에 몰아넣었다.
    // 찾는 경로가 모드마다 갈리면 초보가 배운 자리가 표준에서 통하지 않는다 — 그룹으로 통일한다.
    expect(findByTestId(host, "db-nav-all")).toBeNull();
    const groups = Array.from(nav.querySelectorAll(".db-tab-group")).map((group) => group.textContent);
    expect(groups).toContain("파티");
    expect(groups).toContain("몬스터");
    expect(groups).toContain("시스템");

    // 접힌 그룹 안에 있어도 모든 탭이 레일에 존재해야 한다(교차 탭 이동 계약).
    for (const testId of ["db-tab-overview", "db-tab-actors", "db-tab-items", "db-tab-switches"]) {
      expect(findByTestId(nav, testId)).not.toBeNull();
    }
    expect(findByTestId(nav, "db-tab-switches")?.closest("details")).toBeNull();
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
