import { expect, test } from "@playwright/test";
import { DATABASE_TAB_SPECS, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

const ACTORS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "actors")!;
const ITEMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;
const SYSTEM_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "system")!;

test.use({ viewport: { width: 1586, height: 992 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  await openDatabase(page);
});

test("every database tab keeps one compact cream icon rail", async ({ page }) => {
  // Break named: non-System tabs fall back to the old 210px text sidebar and cream/dark geometry jumps between tabs.
  await switchDatabaseTab(page, ACTORS_TAB);

  const actorsRail = await page.evaluate(() => {
    const rail = document.querySelector(".db-tabs");
    const active = document.querySelector('[data-testid="db-tab-actors"]');
    if (!(rail instanceof HTMLElement) || !(active instanceof HTMLElement)) throw new Error("database rail missing");
    const railStyle = getComputedStyle(rail);
    const activeStyle = getComputedStyle(active);
    return {
      width: rail.getBoundingClientRect().width,
      background: railStyle.backgroundColor,
      activeWidth: active.getBoundingClientRect().width,
      activeFontSize: activeStyle.fontSize,
      activeIcon: getComputedStyle(active, "::before").content,
      visibleGroupLabels: Array.from(document.querySelectorAll<HTMLElement>(".db-tab-group"))
        .filter((node) => getComputedStyle(node).display !== "none").length,
      unlabeledButtons: Array.from(document.querySelectorAll<HTMLElement>(".db-tab"))
        .filter((node) => !node.title || !node.getAttribute("aria-label")).length,
    };
  });

  expect(actorsRail.width).toBeGreaterThanOrEqual(52);
  expect(actorsRail.width).toBeLessThanOrEqual(60);
  expect(actorsRail.background).toBe("rgb(252, 249, 242)");
  expect(actorsRail.activeWidth).toBeLessThanOrEqual(44);
  expect(actorsRail.activeFontSize).toBe("0px");
  expect(actorsRail.activeIcon).toBe('"♙"');
  expect(actorsRail.visibleGroupLabels).toBe(0);
  expect(actorsRail.unlabeledButtons).toBe(0);

  await switchDatabaseTab(page, ITEMS_TAB);
  await expect(page.getByTestId("db-tab-items")).toHaveClass(/active/);
  expect(await page.locator(".db-tabs").evaluate((node) => node.getBoundingClientRect().width)).toBe(56);
  expect(await page.getByTestId("db-tab-items").evaluate((node) => getComputedStyle(node, "::before").content)).toBe('"▤"');
});

test("the compact rail keeps tab search usable as a focus overlay", async ({ page }) => {
  // Break named: shrinking the sidebar can make the existing tab search too narrow to type or inspect results.
  await switchDatabaseTab(page, ACTORS_TAB);
  const search = page.getByTestId("db-tab-search");
  await expect(search).toBeVisible();
  expect((await search.boundingBox())?.width).toBeLessThanOrEqual(44);

  await search.focus();
  expect((await search.boundingBox())?.width).toBeGreaterThanOrEqual(180);
  await search.fill("아이템");
  await expect(page.getByTestId("db-tab-items")).toBeVisible();
  await expect(page.getByTestId("db-tab-actors")).toBeHidden();
});

test("System uses the database cream palette and compact widths", async ({ page }) => {
  // Break named: System swaps the cream database into a separate dark app and consumes 298px before content.
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
      navigationWidth: rail.getBoundingClientRect().width + subnav.getBoundingClientRect().width,
      subnavWidth: subnav.getBoundingClientRect().width,
      previewWidth: preview.getBoundingClientRect().width,
      sectionPaddingLeft: Number.parseFloat(getComputedStyle(sectionHost).paddingLeft),
      modalBackground: getComputedStyle(modal).backgroundColor,
      subnavBackground: getComputedStyle(subnav).backgroundColor,
      cardBackground: getComputedStyle(card).backgroundColor,
      panelBackground: getComputedStyle(panel).backgroundColor,
      previewBackground: getComputedStyle(preview).backgroundColor,
      textColor: getComputedStyle(card).color,
      activeSubnavText: getComputedStyle(activeSubnav).color,
    };
  });

  expect(metrics.navigationWidth).toBeLessThanOrEqual(244);
  expect(metrics.subnavWidth).toBeGreaterThanOrEqual(180);
  expect(metrics.subnavWidth).toBeLessThanOrEqual(188);
  expect(metrics.previewWidth).toBeGreaterThanOrEqual(240);
  expect(metrics.previewWidth).toBeLessThanOrEqual(252);
  expect(metrics.sectionPaddingLeft).toBeLessThanOrEqual(18);
  expect(metrics.modalBackground).toBe("rgb(247, 243, 234)");
  expect(metrics.subnavBackground).toBe("rgb(252, 249, 242)");
  expect(metrics.cardBackground).toBe("rgb(255, 253, 248)");
  expect(metrics.panelBackground).toBe("rgb(255, 253, 248)");
  expect(metrics.previewBackground).toBe("rgb(255, 253, 248)");
  expect(metrics.textColor).toBe("rgb(42, 37, 33)");
  expect(metrics.activeSubnavText).toBe("rgb(74, 87, 214)");
});
