import { expect, firefox, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

test("items and equipment expose usable settings and keep summaries synchronized", async ({ baseURL }) => {
  test.setTimeout(300_000);
  const browser = await firefox.launch({ args: [] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const evidence = "output/evidence/items-equipment-fixed";
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  try {
    await page.goto(`${baseURL}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
    for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) {
      if (await page.getByTestId(id).isVisible()) await page.getByTestId(id).click();
    }
    console.log("editor ready");
    await page.getByTestId("toolbar-database").click();
    await page.getByTestId("db-tab-items").click();
    await expect(page.getByTestId("db-field-item-type").locator('option[value="weapon"]')).toHaveCount(0);
    await expect(page.getByTestId("db-field-item-farm-tool")).toHaveCount(0);
    await expect(page.getByTestId("db-item-card-capture")).toHaveCount(0);
    await expect(page.getByTestId("db-item-card-graphic")).toContainText("게임 인벤토리");
    const measurements: object[] = [];
    for (const width of [1280, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1024 ? 768 : width === 1280 ? 800 : 900 });
      for (const tab of ["items", "equipment"]) {
        await page.getByTestId("db-tab-items").click();
        await page.getByTestId(`db-catalog-filter-${tab}`).click();
        await page.locator(`.db-catalog-rows [data-collection="${tab}"]`).first().click();
        console.log(`capturing ${tab} ${width}`);
        await page.screenshot({ path: `${evidence}/${tab}-${width}.png` });
        measurements.push(await page.evaluate(({ tab, width }) => {
          const body = document.querySelector(".db-ws-detail-body") as HTMLElement;
          return { tab, width, visible: body.clientHeight, total: body.scrollHeight, documentOverflow: document.documentElement.scrollWidth > innerWidth };
        }, { tab, width }));
        if (tab === "equipment") {
          // No auto-scroll before measuring: this catches inputs pushed off the first screen.
          const bounds = await page.getByTestId("db-field-equipment-attack").boundingBox();
          expect(bounds).not.toBeNull();
          expect(bounds!.y + bounds!.height).toBeLessThan((await page.getByTestId("database-modal").boundingBox())!.height - 35);
          await expect(page.getByTestId("db-picker-skill")).toHaveCount(0);
          await expect(page.getByTestId("db-field-equipment-effect-preemptive")).toHaveCount(0);
          await expect(page.getByTestId("db-equipment-card-action-weapon")).toHaveCount(0);
        }
      }
    }
    await page.getByTestId("db-tab-items").click();
    await page.getByTestId("db-catalog-filter-items").click();
    await page.locator('.db-catalog-rows [data-collection="items"]').first().click();
    await page.getByTestId("db-item-card-story").getByRole("button").click();
    await page.getByTestId("db-field-item-occasion").selectOption("field");
    await expect(page.getByTestId("db-item-story-occasion").locator("strong")).toHaveText("필드");
    await page.getByTestId("db-field-item-occasion").selectOption("always");
    await expect(page.getByTestId("db-item-story-occasion").locator("strong")).toHaveText("필드 · 전투");
    await page.getByTestId("db-field-item-consumption-limit").selectOption("reusable");
    await expect(page.getByTestId("db-item-effect-story")).toContainText("소비하지 않음");
    await page.getByTestId("db-field-item-type").selectOption("special");
    await expect(page.getByTestId("db-picker-skill")).toHaveCount(0);
    await expect(page.getByTestId("db-item-card-usable")).toHaveCount(0);
    await page.getByTestId("db-item-card-story").getByRole("button").click();
    await page.getByTestId("db-field-scope").selectOption("enemy");
    await expect(page.getByTestId("db-item-story-target")).toContainText("적");
    await page.getByTestId("db-picker-item-activate-skill").selectOption({ index: 1 });
    await page.getByTestId("db-item-card-capture").getByRole("button").click();
    await page.getByTestId("db-field-item-capture-enabled").check();
    await page.getByTestId("db-field-item-capture-multiplier").fill("2.5");
    await page.getByTestId("db-field-item-capture-multiplier").blur();
    await page.getByTestId("db-item-card-story").getByRole("button").click();
    await expect(page.getByTestId("db-item-effect-story")).toContainText("포획 배율 ×2.5");
    await expect(page.getByTestId("db-item-effect-story")).not.toContainText("스킬 발동");
    await page.getByTestId("db-field-item-capture-enabled").uncheck();
    await page.getByTestId("db-picker-item-activate-skill").selectOption("");
    await page.getByTestId("db-item-card-state-effects").locator(".db-ws-card-toggle").click();
    await page.getByTestId("db-item-state-effect-add").click();
    await page.getByTestId("db-field-item-state-effect-chance-0").fill("75");
    await page.getByTestId("db-field-item-occasion").selectOption("field");
    await page.getByTestId("db-item-card-story").locator(".db-ws-card-toggle").click();
    await expect(page.getByTestId("db-item-effect-story")).toContainText("75%");
    await expect(page.getByTestId("db-item-story-occasion").locator("strong")).toHaveText("필드");
    await page.getByTestId("db-item-card-care").locator(".db-ws-card-toggle").click();
    await page.getByTestId("db-field-item-care-kind").selectOption("feed");
    await page.getByTestId("db-field-item-care-friendship").fill("8");
    await page.getByTestId("db-field-item-care-exp").fill("20");
    await page.getByTestId("db-item-card-story").locator(".db-ws-card-toggle").click();
    await expect(page.getByTestId("db-item-effect-story")).toContainText("몬스터 친밀도 +8 · 경험치 +20");
    await expect(page.getByTestId("db-item-card-state-effects")).toHaveCount(0);
    writeFileSync(`${evidence}/measurements.json`, JSON.stringify({ measurements, errors }, null, 2));
    expect(errors).toEqual([]);
    expect(measurements.every((entry) => !(entry as { documentOverflow: boolean }).documentOverflow)).toBe(true);
  } finally { await browser.close(); }
});
