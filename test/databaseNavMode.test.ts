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

  it("keeps grouped navigation with explicit monster and life domains in standard mode", () => {
    const host = renderPanel("standard");
    const groups = host.querySelectorAll(".db-tab-group-label").map((group) => group.textContent);
    // 몬스터는 전투 규칙과 분리된 독립 그룹이다 — 예전 `전투·몬스터` 한 덩어리(9탭)가 아니다.
    expect(groups).toContain("몬스터");
    expect(groups).toContain("전투 규칙");
    expect(groups).toContain("생활");
    expect(findByTestId(host, "db-nav-all")).toBeNull();
  });

  // 접힌 그룹은 라벨 한 낱말만 남는다. 「마을」이 「세계」 안에 있다는 걸 알 길이 탭 검색뿐이었고,
  // 레코드가 0 인 탭은 배지도 없어서 그룹만 보고는 안에 뭐가 있는지 알 수 없었다.
  it("그룹 헤더가 안에 든 탭 이름과 레코드 합계를 알려준다 — 라벨 텍스트는 그대로", () => {
    const host = renderPanel("expert");
    const world = findByTestId(host, "db-tab-group-world");
    if (!world) throw new Error("missing world group header");

    // 라벨 계약(db-desktop-matrix / 위 두 테스트)은 정확 일치를 요구한다 — 배지는 가상 요소로 뺀다.
    // 라벨은 `.db-tab-group-label` 로 읽는다. 헤더에는 접힌 동에만 보이는 부제
    // (`.db-tab-group-peek`)도 들어 있어서, 헤더 textContent 를 그대로 재면 라벨 계약이 아니라
    // 헤더 전체를 재게 된다. 잡으려는 것은 "라벨이 그대로인가" 이므로 이게 맞다.
    expect(world.querySelector(".db-tab-group-label")?.textContent).toBe("세계");
    expect(world.getAttribute("title")).toContain("마을");
    expect(world.getAttribute("title")).toContain("타일셋");

    // 빈 프로젝트도 타일셋·공통 이벤트가 있으므로 세계 그룹은 합계를 들고 있다.
    const worldCount = Number(world.dataset.tabCount ?? "0");
    expect(worldCount).toBeGreaterThan(0);

    // 합계는 안에 든 탭 배지의 합이어야 한다 — 따로 세면 조용히 갈라진다.
    const railChildren = (host.querySelector(".db-tabs") as FakeElement).children;
    const start = railChildren.indexOf(world);
    let sum = 0;
    for (const child of railChildren.slice(start + 1)) {
      if (child.classList.contains("db-tab-group")) break;
      if (!child.classList.contains("db-tab")) continue;
      sum += Number(child.dataset.count ?? "0");
    }
    expect(worldCount).toBe(sum);
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
