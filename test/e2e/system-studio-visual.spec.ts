import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { DATABASE_TAB_SPECS, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

const SYSTEM_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "system")!;
const EVIDENCE_PATH = "output/evidence/system-studio/system-studio-1586x992.png";

test.use({ viewport: { width: 1586, height: 992 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("approved system-studio mockup keeps at least 95% structural parity", async ({ page }) => {
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, SYSTEM_TAB);
  await expect(page.getByTestId("db-system-studio")).toBeVisible();
  await expect(page.getByTestId("db-system-nav-overview")).toHaveClass(/active/);

  const parity = await page.evaluate(() => {
    const rect = (selector: string): DOMRect => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error(`missing ${selector}`);
      return node.getBoundingClientRect();
    };
    const count = (selector: string): number => document.querySelectorAll(selector).length;
    const modal = rect(".database-modal-window");
    const rail = rect(".db-tabs");
    const subnav = rect("nav.db-system-section-nav");
    const studio = rect(".db-system-studio");
    const primary = Array.from(document.querySelectorAll<HTMLElement>(".db-system-studio-card-grid .db-system-studio-card"))
      .map((node) => node.getBoundingClientRect());
    const state = rect(".db-system-studio-state");
    const rules = Array.from(document.querySelectorAll<HTMLElement>(".db-system-studio-rule-grid .db-system-studio-card"))
      .map((node) => node.getBoundingClientRect());
    const preview = rect(".db-system-studio-preview");
    const footer = rect(".database-modal-footer");
    const sectionHost = document.querySelector(".db-system-sections");
    if (!(sectionHost instanceof HTMLElement)) throw new Error("missing system section host");

    const checks = {
      modalNearlyFullWidth: modal.width >= innerWidth * 0.97,
      modalNearlyFullHeight: modal.height >= innerHeight * 0.95,
      iconRailBand: rail.width >= 60 && rail.width <= 84,
      secondaryNavBand: subnav.width >= 210 && subnav.width <= 245,
      studioStartsAfterNavigation: studio.left >= subnav.right,
      nineSystemDestinations: count("nav.db-system-section-nav > button") === 9,
      overviewIsDefault: document.querySelector('[data-system-section="overview"]:not([hidden])') !== null,
      partyEditorStartsHidden: document.querySelector('[data-system-section="party"][hidden]') !== null,
      fourPrimaryCards: primary.length === 4,
      primaryCardsShareRow: primary.length === 4 && Math.max(...primary.map((item) => item.top)) - Math.min(...primary.map((item) => item.top)) <= 2,
      primaryCardDensity: primary.length === 4 && primary.every((item) => item.height >= 105),
      stateBelowPrimary: primary.length === 4 && state.top > Math.max(...primary.map((item) => item.bottom)),
      semanticStateRows: count(".db-system-studio-table-row") === 3,
      statePanelDensity: state.height >= 290,
      threeRuleCards: rules.length === 3,
      ruleCardsShareRow: rules.length === 3 && Math.max(...rules.map((item) => item.top)) - Math.min(...rules.map((item) => item.top)) <= 2,
      twelveRuleDetails: count(".db-system-studio-card-detail") === 12,
      previewOnRight: primary.length === 4 && preview.left > Math.max(...primary.map((item) => item.right)),
      fivePreviewImpacts: count(".db-system-studio-impact-item") === 5,
      noHorizontalOverflow: sectionHost.scrollWidth <= sectionHost.clientWidth + 2 && footer.bottom <= innerHeight + 1,
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return { checks, passed, total: Object.keys(checks).length, score: passed / Object.keys(checks).length };
  });

  expect(parity, JSON.stringify(parity.checks, null, 2)).toMatchObject({ total: 20 });
  expect(parity.score, JSON.stringify(parity.checks, null, 2)).toBeGreaterThanOrEqual(0.95);

  await mkdir("output/evidence/system-studio", { recursive: true });
  await page.screenshot({ path: EVIDENCE_PATH });
});
