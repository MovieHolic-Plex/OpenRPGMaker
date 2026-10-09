import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const sections = ["overview", "party", "display", "menu", "font", "resources", "startup", "optin", "time", "typechart", "title"] as const;
for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`System settings workspace at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
    await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
    await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });
    for (const [button, overlay] of [["login-guest", "login-modal"], ["standard-welcome-start", "standard-welcome-card"], ["coach-mark-skip", ""]]) {
      if (await page.getByTestId(button!).isVisible()) {
        await page.getByTestId(button!).click();
        if (overlay) await page.getByTestId(overlay).waitFor({ state: "hidden" });
      }
    }
    await page.getByTestId("toolbar-database").click();
    await page.getByTestId("db-tab-group-system").click();
    await page.getByTestId("db-tab-system").click();
    const nav = page.getByTestId("db-system-section-nav");
    await expect(nav.locator(".db-system-section-button")).toHaveCount(11);
    const destinationTargets = await page.getByTestId("db-system-studio").locator("[data-system-target]").evaluateAll((buttons) => [...new Set(buttons.map((button) => (button as HTMLElement).dataset.systemTarget))].sort());
    expect(destinationTargets).toEqual(sections.filter((slug) => slug !== "overview").sort());
    await expect(page.locator(".db-system-studio-rule-grid .db-system-studio-card")).toHaveCount(3);
    await expect(page.locator(".db-system-studio-card-detail")).toHaveCount(12);
    await expect(page.locator(".db-system-studio-impact-row")).toHaveCount(4);
    await expect(page.locator(".db-system-studio-table-row")).toHaveCount(3);
    await expect(page.locator('[data-system-section="overview"]')).toBeVisible();
    await expect(page.locator('[data-system-section="party"]')).toBeHidden();
    const heights: number[] = [];
    await mkdir("output/evidence/system-studio", { recursive: true });
    for (const slug of sections) {
      await page.getByTestId(`db-system-nav-${slug}`).click();
      await expect(page.locator(`[data-system-section="${slug}"]`)).toBeVisible();
      await expect(page.locator(".db-system-section")).toHaveCount(11);
      const facts = await page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>(".db-system-section-nav")!;
        const body = document.querySelector<HTMLElement>(".db-system-sections")!;
        const selected = document.querySelector<HTMLElement>(".db-system-section:not([hidden])")!;
        const navRect = nav.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const footer = document.querySelector<HTMLElement>(".database-modal-footer")!.getBoundingClientRect();
        return {
          navHeight: navRect.height,
          navScrollHeight: nav.scrollHeight,
          navClientHeight: nav.clientHeight,
          bodyWidth: body.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          sectionWidth: selected.getBoundingClientRect().width,
          separate: navRect.bottom <= bodyRect.top + 1,
          footerVisible: footer.bottom <= innerHeight + 1,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      heights.push(facts.navHeight);
      expect(facts.navHeight).toBeGreaterThanOrEqual(50);
      expect(facts.navScrollHeight).toBeLessThanOrEqual(facts.navClientHeight + 1);
      expect(facts.bodyScrollWidth).toBeLessThanOrEqual(facts.bodyWidth + 1);
      expect(facts.sectionWidth).toBeGreaterThan(400);
      expect(facts.separate).toBe(true);
      expect(facts.footerVisible).toBe(true);
      expect(facts.overflow).toBe(false);
      await page.screenshot({ path: `output/evidence/system-studio/${viewport.width}x${viewport.height}-${slug}.png`, animations: "disabled" });
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    await page.getByTestId("db-system-nav-overview").click();
    await page.getByTestId("db-system-studio-command-search").fill("__no_such_setting__");
    await expect(page.getByTestId("db-system-studio-no-results")).toBeVisible();
    await page.getByTestId("db-system-studio-search-reset").click();
    await expect(page.getByTestId("db-system-studio-command-search")).toBeFocused();
    await page.getByTestId("db-system-nav-party").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-system-section="party"]')).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("db-system-nav-display")).toBeFocused();
  });
}
