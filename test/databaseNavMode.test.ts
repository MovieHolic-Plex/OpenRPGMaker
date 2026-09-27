import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  restoreDom?.();
  restoreDom = null;
});

function renderPanel(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  renderDatabasePanel(host as unknown as HTMLElement);
  return host;
}

function directTabIds(node: FakeElement): string[] {
  return node.children
    .filter((child) => child.classList.contains("db-tab"))
    .map((child) => child.dataset.testid ?? "");
}

describe("database navigation", () => {
  it("groups the rail by category — no all-data disclosure", () => {
    const host = renderPanel();
    const nav = host.querySelector(".db-tabs");
    if (!nav) throw new Error("missing database navigation");

    // 예전 초보 레일은 자주 쓰는 6개만 깔고 남은 24개를 <details>「모든 자료」에 몰아넣었다.
    // 찾는 경로가 모드마다 갈리면 초보가 배운 자리가 표준에서 통하지 않는다 — 그룹으로 통일한다.
    expect(findByTestId(host, "db-nav-all")).toBeNull();
    // 라벨은 .db-tab-group-label 로 읽는다 — 헤더에는 접힘 부제와 배지도 들어가므로
    // textContent 를 그대로 쓰면 라벨 계약이 아니라 헤더 전체를 재게 된다.
    const groups = Array.from(nav.querySelectorAll(".db-tab-group-label")).map((group) => group.textContent);
    expect(groups).toContain("파티");
    expect(groups).toContain("몬스터");
    expect(groups).toContain("시스템");

    // 접힌 그룹 안에 있어도 모든 탭이 레일에 존재해야 한다(교차 탭 이동 계약).
    for (const testId of ["db-tab-overview", "db-tab-actors", "db-tab-items", "db-tab-switches"]) {
      expect(findByTestId(nav, testId)).not.toBeNull();
    }
    expect(findByTestId(nav, "db-tab-switches")?.closest("details")).toBeNull();
  });

  it("keeps grouped navigation with explicit monster and life domains", () => {
    const host = renderPanel();
    const groups = host.querySelectorAll(".db-tab-group-label").map((group) => group.textContent);
    // 몬스터는 전투 규칙과 분리된 독립 그룹이다 — 예전 `전투·몬스터` 한 덩어리(9탭)가 아니다.
    expect(groups).toContain("몬스터");
    expect(groups).toContain("전투 규칙");
    expect(groups).toContain("생활");
    expect(findByTestId(host, "db-nav-all")).toBeNull();
  });

  // 그룹은 늘 펼쳐진 구획이다(2026-09-24 개선안 C). 숨는 것은 레코드 0 인 목록 탭뿐이고,
  // 그 이름은 그룹 끝 「빈 탭 N개」 줄에 적힌다. 단위가 다른 것을 더한 그룹 합계 배지는 없앴다.
  it("그룹 머리는 라벨만 남고, 빈 목록 탭은 그룹 끝 한 줄로 접힌다", () => {
    const host = renderPanel();
    const world = findByTestId(host, "db-tab-group-world");
    const life = findByTestId(host, "db-tab-group-life");
    if (!world || !life) throw new Error("missing group header");

    expect(world.querySelector(".db-tab-group-label")?.textContent).toBe("맵");
    expect(world.dataset.tabCount).toBeUndefined();

    const railChildren = (host.querySelector(".db-tabs") as FakeElement).children;
    const start = railChildren.indexOf(life);
    const lifeRows: FakeElement[] = [];
    for (const child of railChildren.slice(start + 1)) {
      if (child.classList.contains("db-tab-group")) break;
      lifeRows.push(child);
    }
    const tabsInLife = lifeRows.filter((child) => child.classList.contains("db-tab"));
    const fold = lifeRows.find((child) => child.classList.contains("db-tab-fold"));
    if (!fold) throw new Error("missing life fold row");

    // 빈 프로젝트의 생활 탭은 모두 0건이다 — 전부 접히고 접기 줄이 그 수를 말한다.
    const folded = tabsInLife.filter((tab) => tab.hidden);
    expect(folded.length).toBe(tabsInLife.length);
    expect(fold.hidden).toBe(false);
    expect(fold.textContent).toContain(`빈 탭 ${folded.length}개`);
    expect(life.getAttribute("aria-expanded")).toBe("false");

    // 레코드가 있는 탭은 절대 접히지 않는다.
    for (const child of railChildren) {
      if (child.classList.contains("db-tab") && child.dataset.count) expect(child.hidden).toBe(false);
    }

    // 접기 줄을 누르면 그 그룹의 빈 탭이 펼쳐진다.
    fold.click();
    expect(tabsInLife.every((tab) => !tab.hidden)).toBe(true);
    expect(fold.hidden).toBe(true);
    expect(life.getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the full surface without an all-data disclosure", () => {
    const host = renderPanel();
    const nav = host.querySelector(".db-tabs");
    if (!nav) throw new Error("missing database navigation");

    expect(findByTestId(host, "db-nav-all")).toBeNull();
    expect(directTabIds(nav)).toContain("db-tab-spatial-tiles");
    expect(findByTestId(nav, "db-tab-spatial-tiles")?.closest("details")).toBeNull();
  });
});
