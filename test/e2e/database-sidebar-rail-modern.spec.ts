import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/* DB 사이드바 레일 현대화 계약.
 *
 * Firefox 로 돈다: 이 머신의 도커 브리지 인터페이스가 오르내리면 Chromium 이
 * ERR_NETWORK_CHANGED 로 모듈 로드를 전부 끊어 백지가 된다(실측). Firefox 는
 * 그 알림에 반응하지 않는다. */
test.use({ browserName: "firefox", viewport: { height: 1000, width: 1600 } });

const OUT = join(process.cwd(), "output", "evidence", "db-rail-modern");

type RailFacts = {
  readonly activeIconColor: string;
  readonly activeIconSize: readonly [number, number];
  readonly badgeTexts: readonly string[];
  readonly clientHeight: number;
  readonly groupLefts: readonly number[];
  readonly groupLabels: readonly string[];
  readonly groupPositions: readonly string[];
  readonly rowLeft: number;
  readonly scrollHeight: number;
  readonly tabsWithoutIcon: readonly string[];
  readonly visibleTabCount: number;
};

test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  await mkdir(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
});

test("the rail fits without scrolling and groups collapse", async ({ page }) => {
  // Break named: 29 tabs render as one flat 1200px column inside a 796px rail, so
  // 시스템·용어·스위치·변수 are always below the fold.
  await openDatabase(page);
  const facts = await readRailFacts(page);

  expect(facts.groupLabels, "group labels").toEqual([
    "파티",
    "몬스터",
    "전투 규칙",
    "생활",
    "세계",
    "시스템",
  ]);
  expect(
    facts.scrollHeight,
    `rail must fit: scrollHeight ${facts.scrollHeight} vs clientHeight ${facts.clientHeight}`,
  ).toBeLessThanOrEqual(facts.clientHeight + 1);

  // 접힌 그룹은 헤더 클릭으로 펼친다 — 스크롤이 아니라 구조로 도달한다.
  const systemGroup = page.getByTestId("db-tab-group-system");
  await expect(systemGroup).toBeVisible();
  await expect(page.getByTestId("db-tab-variables")).toBeHidden();
  await systemGroup.click();
  await expect(page.getByTestId("db-tab-variables")).toBeVisible();

  await page.locator(".db-tabs").screenshot({ path: join(OUT, "01-rail-collapsed-groups.png") });
});

test("group headers read as left-aligned sticky sections", async ({ page }) => {
  // Break named: group labels are right-aligned captions floating over the list.
  await openDatabase(page);
  const facts = await readRailFacts(page);

  // 계산된 text-align 만 보면 껍데기가 오른쪽으로 밀려 있어도 통과한다(실측으로 겪었다).
  // 헤더 상자가 실제로 레일 폭을 쓰고 행과 같은 왼쪽 선에서 시작하는지 재야 한다.
  expect(facts.rowLeft, "a visible tab row anchors the left edge").toBeGreaterThan(0);
  for (const [index, left] of facts.groupLefts.entries()) {
    expect(
      Math.abs(left - facts.rowLeft),
      `group header "${facts.groupLabels[index]}" starts at the row's left edge (header ${left} vs row ${facts.rowLeft})`,
    ).toBeLessThanOrEqual(2);
  }
  expect(facts.groupPositions, "every group header is sticky").toEqual(
    facts.groupLabels.map(() => "sticky"),
  );
});

test("count badges never show zero and stay neutral", async ({ page }) => {
  // Break named: 농사·작물 / 주민 관계 / 생활 기술·제작 / 계절·날씨 render "0" pills,
  // and the badge hue collides with the active row accent.
  await openDatabase(page);
  await expandEveryGroup(page);
  const facts = await readRailFacts(page);

  expect(facts.badgeTexts.length, "some tabs carry badges").toBeGreaterThan(0);
  const zeros = facts.badgeTexts.filter((text) => Number.parseInt(text, 10) === 0);
  expect(zeros, "no badge may render a zero count").toEqual([]);
  for (const text of facts.badgeTexts) {
    expect(Number.parseInt(text, 10), `badge "${text}" parses as a positive integer`).toBeGreaterThan(0);
  }
});

test("tabs keep an icon at desktop width", async ({ page }) => {
  // Break named: a stylesheet hides the rail icon above 800px, so the rail is a flat wall
  // of Korean words at the width users actually run. 아이콘은 CSS `content` 가 아니라
  // databaseTabIcons.ts 의 <svg class="db-tab-icon"> 라서 DOM 에서 직접 셀 수 있다.
  await openDatabase(page);
  const facts = await readRailFacts(page);

  expect(facts.tabsWithoutIcon, "every tab owns an svg.db-tab-icon").toEqual([]);
  const [width, height] = facts.activeIconSize;
  expect(width, "active tab icon width").toBeGreaterThanOrEqual(14);
  expect(height, "active tab icon height").toBeGreaterThanOrEqual(14);
  // stroke: currentColor — color 가 투명이면 상자만 남고 선이 사라진다.
  expect(facts.activeIconColor, "active tab icon keeps a visible stroke").not.toBe("rgba(0, 0, 0, 0)");
  expect(facts.activeIconColor, "active tab icon keeps a visible stroke").not.toBe("transparent");
});

test("search reaches tabs inside collapsed groups and restores after clearing", async ({ page }) => {
  // Break named: collapsing groups can hide tabs from the existing label filter.
  await openDatabase(page);
  await expect(page.getByTestId("db-tab-variables")).toBeHidden();

  const search = page.getByTestId("db-tab-search");
  await search.fill("변수");
  await expect(page.getByTestId("db-tab-variables")).toBeVisible();
  await page.getByTestId("db-tab-variables").click();
  await expect(page.getByTestId("db-tab-variables")).toHaveClass(/active/);

  await search.fill("");
  // 활성 탭이 속한 그룹은 펼쳐진 상태로 남아야 한다 — 방금 고른 탭이 사라지면 안 된다.
  await expect(page.getByTestId("db-tab-variables")).toBeVisible();
  await expect(page.getByTestId("db-tab-actors")).toBeHidden();

  await page.locator(".db-tabs").screenshot({ path: join(OUT, "02-rail-after-search.png") });
});

async function openDatabase(page: Page): Promise<void> {
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".db-tabs")).toBeVisible();
}

async function expandEveryGroup(page: Page): Promise<void> {
  const groups = page.locator("[data-testid^='db-tab-group-']");
  for (let index = 0; index < (await groups.count()); index += 1) {
    const group = groups.nth(index);
    if ((await group.getAttribute("aria-expanded")) === "false") await group.click();
  }
}

async function readRailFacts(page: Page): Promise<RailFacts> {
  return page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>(".db-tabs");
    if (!rail) throw new Error("database rail is missing");
    const groups = Array.from(document.querySelectorAll<HTMLElement>(".db-tab-group"));
    const tabs = Array.from(document.querySelectorAll<HTMLElement>(".db-tab"));
    const visible = tabs.filter((tab) => tab.getBoundingClientRect().height > 0);
    const active = document.querySelector<HTMLElement>(".db-tab.active");
    const rowLeft = visible[0] ? Math.round(visible[0].getBoundingClientRect().left) : -1;
    const badgeTexts = visible
      .map((tab) => tab.dataset.count)
      .filter((count): count is string => typeof count === "string");
    const activeIcon = active?.querySelector<SVGSVGElement>("svg.db-tab-icon") ?? null;
    const activeIconBox = activeIcon?.getBoundingClientRect();
    return {
      activeIconColor: activeIcon ? getComputedStyle(activeIcon).color : "none",
      activeIconSize: [
        Math.round(activeIconBox?.width ?? 0),
        Math.round(activeIconBox?.height ?? 0),
      ] as [number, number],
      badgeTexts,
      clientHeight: rail.clientHeight,
      groupLefts: groups.map((group) => Math.round(group.getBoundingClientRect().left)),
      groupLabels: groups.map((group) => (group.textContent ?? "").trim()),
      groupPositions: groups.map((group) => getComputedStyle(group).position),
      rowLeft,
      scrollHeight: rail.scrollHeight,
      // 접힌 탭도 포함해서 센다 — 아이콘은 DOM 이 소유하므로 펼침 상태와 무관하게 있어야 한다.
      tabsWithoutIcon: tabs
        .filter((tab) => !tab.querySelector("svg.db-tab-icon"))
        .map((tab) => tab.dataset.testid ?? "(no testid)"),
      visibleTabCount: visible.length,
    };
  });
}
