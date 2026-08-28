import { expect, test } from "@playwright/test";
import { DATABASE_TAB_SPECS, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

/* 이 파일은 원래 56px 크림색 아이콘 레일을 고정했다. 그 디자인은 폐기됐다 —
 * 지금은 220px 라벨 레일 + 그룹 아코디언(#160)이고 팔레트는 크림이 아니라
 * studio 중립 토큰(--db-studio-surface #FFFFFF / --db-studio-text-1 #0F172A)이다.
 * 폐기된 숫자(레일 52-60px, font-size 0, 그룹 라벨 0개, 크림 hex, subnav 180-188px)는
 * 버리고, 살아 있는 계약만 남긴다:
 *   - 탭을 바꿔도 레일 기하가 흔들리지 않는다 (원래 이 파일이 지키려던 것)
 *   - 모든 탭이 title + aria-label 을 유지한다
 *   - sidebar.css 의 per-testid 글리프가 데스크톱에서 보인다 (#160 계약)
 *   - System 이 콘텐츠 앞에서 내비게이션 폭을 독식하지 않는다
 *   - System 이 DB 모달과 같은 표면/텍스트 토큰을 쓴다 (별도 다크 앱으로 갈라지지 않는다) */

const ACTORS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "actors")!;
const ITEMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;
const SYSTEM_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "system")!;

test.use({ viewport: { width: 1586, height: 992 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  await openDatabase(page);
});

test("the labeled rail keeps identical geometry on every tab", async ({ page }) => {
  // Break named: a tab-specific rule resizes .db-tabs, so the rail jumps width between tabs.
  const railWidth = async (): Promise<number> =>
    page.locator(".db-tabs").evaluate((node) => Math.round(node.getBoundingClientRect().width));

  await switchDatabaseTab(page, ACTORS_TAB);
  const actorsWidth = await railWidth();
  // sidebar.css 의 `:has(.db-shared-workspace) .db-tabs { flex: 0 0 220px }` 가 소유하는 값.
  expect(actorsWidth).toBe(220);

  await switchDatabaseTab(page, ITEMS_TAB);
  expect(await railWidth(), "items rail width").toBe(actorsWidth);
  await switchDatabaseTab(page, SYSTEM_TAB);
  expect(await railWidth(), "system rail width").toBe(actorsWidth);

  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".db-tab"))
      .filter((node) => !node.title || !node.getAttribute("aria-label")).length);
  expect(labels, "every tab keeps title + aria-label").toBe(0);
});

test("per-tab glyphs stay visible in the labeled rail", async ({ page }) => {
  // Break named: the desktop glyph rule and its @media fallback twin disagree, so icons
  // silently vanish at the width users actually run (that is exactly what #160 fixed).
  await switchDatabaseTab(page, ACTORS_TAB);
  const glyph = async (testId: string): Promise<{ content: string; display: string }> =>
    page.getByTestId(testId).evaluate((node) => ({
      content: getComputedStyle(node, "::before").content,
      display: getComputedStyle(node, "::before").display,
    }));

  const actors = await glyph("db-tab-actors");
  expect(actors.content, "actors glyph from sidebar.css").toBe('"♙"');
  expect(actors.display, "actors glyph is rendered").not.toBe("none");

  await switchDatabaseTab(page, ITEMS_TAB);
  const items = await glyph("db-tab-items");
  expect(items.content, "items glyph from sidebar.css").toBe('"▤"');
  expect(items.display, "items glyph is rendered").not.toBe("none");
});

test("the rail search filters tabs and stays wide enough to read", async ({ page }) => {
  // Break named: the search collapses to an unusable width or stops filtering the rail.
  await switchDatabaseTab(page, ACTORS_TAB);
  const search = page.getByTestId("db-tab-search");
  await expect(search).toBeVisible();
  const width = (await search.boundingBox())?.width ?? 0;
  expect(width, "search is top-resident at rail width, not a 44px overlay").toBeGreaterThanOrEqual(150);

  await search.fill("아이템");
  await expect(page.getByTestId("db-tab-items")).toBeVisible();
  await expect(page.getByTestId("db-tab-actors")).toBeHidden();
  await search.fill("");
  await expect(page.getByTestId("db-tab-actors")).toBeVisible();
});

test("System shares the database surface and does not hog navigation width", async ({ page }) => {
  // Break named: System swaps the database shell for a separate dark app, or its rail plus
  // section nav eat the content width before any setting is visible.
  await switchDatabaseTab(page, SYSTEM_TAB);
  await expect(page.getByTestId("db-system-studio")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const required = (selector: string): HTMLElement => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error(`missing ${selector}`);
      return node;
    };
    const rail = required(".db-tabs");
    const subnav = required("nav.db-system-section-nav");
    const sectionHost = required(".db-system-sections");
    const card = required(".db-system-studio-card");
    const panel = required(".db-system-studio-panel");
    const preview = required(".db-system-studio-preview");
    const modal = required(".database-modal-window");
    const activeSubnav = required("button.db-system-section-nav.active");
    return {
      navigationWidth: Math.round(rail.getBoundingClientRect().width + subnav.getBoundingClientRect().width),
      subnavWidth: Math.round(subnav.getBoundingClientRect().width),
      previewWidth: Math.round(preview.getBoundingClientRect().width),
      sectionPaddingLeft: Number.parseFloat(getComputedStyle(sectionHost).paddingLeft),
      modalBackground: getComputedStyle(modal).backgroundColor,
      cardBackground: getComputedStyle(card).backgroundColor,
      panelBackground: getComputedStyle(panel).backgroundColor,
      previewBackground: getComputedStyle(preview).backgroundColor,
      textColor: getComputedStyle(card).color,
      activeSubnavText: getComputedStyle(activeSubnav).color,
    };
  });

  // 섹션 nav 폭 180-188px 는 이 파일이 원래 고정한 밴드이고 지금도 실측값(180)이다.
  // 총 내비게이션 폭 상한만 레일 220px 에 맞춰 다시 잡는다(예전 244px 는 56px 레일 시절 값).
  expect(metrics.subnavWidth, "section nav keeps its readable band").toBeGreaterThanOrEqual(180);
  expect(metrics.subnavWidth, "section nav does not sprawl").toBeLessThanOrEqual(188);
  expect(metrics.navigationWidth).toBeLessThanOrEqual(410);
  expect(metrics.previewWidth, "preview column survives next to the panel").toBeGreaterThanOrEqual(240);
  expect(metrics.sectionPaddingLeft).toBeLessThanOrEqual(18);

  // 팔레트는 hex 를 박지 않는다 — studio 표면 토큰을 공유하는지만 본다(다크 앱 분기 방지).
  const surface = metrics.modalBackground;
  expect(metrics.cardBackground, "card shares the modal surface").toBe(surface);
  expect(metrics.panelBackground, "panel shares the modal surface").toBe(surface);
  expect(metrics.previewBackground, "preview shares the modal surface").toBe(surface);
  // --db-studio-text-1 #0F172A. 표면과 같은 색이면 글씨가 사라진다.
  expect(metrics.textColor).toBe("rgb(15, 23, 42)");
  expect(metrics.activeSubnavText, "active section stays visually distinct").not.toBe(metrics.textColor);
});

test("System overview exposes only settings backed by project data", async ({ page }) => {
  // Break named: placeholder Save, Economy, and Input cards appear complete and inert preview rows look clickable.
  await switchDatabaseTab(page, SYSTEM_TAB);
  const studio = page.getByTestId("db-system-studio");
  await expect(studio).toBeVisible();

  for (const id of ["startup", "party", "display", "time", "combat", "features", "title"]) {
    await expect(page.getByTestId(`db-system-studio-card-${id}`)).toBeVisible();
  }
  for (const id of ["save", "economy", "input"]) {
    await expect(page.getByTestId(`db-system-studio-card-${id}`)).toHaveCount(0);
  }
  await expect(studio).not.toContainText("구성 완료");
  await expect(studio).not.toContainText("자동 저장 사용");
  await expect(page.locator("button.db-system-studio-impact-row")).toHaveCount(0);
  await expect(page.locator(".db-system-studio-impact-row")).toHaveCount(4);
  await expect(page.locator(".db-system-studio-all-screens")).toHaveCount(0);
});
