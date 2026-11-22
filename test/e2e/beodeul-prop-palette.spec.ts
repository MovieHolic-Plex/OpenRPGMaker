import { expect, test } from "@playwright/test";

test("the object palette opens catalog groups and searches them from one input", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  await page.goto("/?freshProject=1&blankProject=1&lang=ko", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  await page.getByTestId("sidebar-props").click();

  const palette = page.getByTestId("left-props-pane");
  const groups = palette.locator("details[data-prop-group]");
  const nature = palette.locator('details[data-prop-group="nature"]');
  const harbor = palette.locator('details[data-prop-group="harbor"]');
  await expect(nature).toBeVisible();
  await expect(nature.locator("summary")).toHaveText(/^자연 \([1-9]\d*\)$/u);
  await expect(nature.getByTestId("left-props-card")).toHaveCount(0);
  await nature.locator("summary").click();
  await expect(nature.getByTestId("left-props-card").first()).toBeVisible();
  await nature.locator("summary").press("Enter");
  await expect(nature.getByTestId("left-props-card").first()).toBeHidden();

  const search = palette.getByTestId("left-props-search");
  await search.fill("자작");
  await expect(nature.locator('[data-prop-id="bd-object:birch_tree"]')).toBeVisible();
  await search.fill("OR_DEC");
  const anchor = harbor.locator('[data-prop-id="bd-object:anchor_decor"]');
  await expect(anchor).toBeVisible();
  await anchor.click();
  await expect(anchor).toHaveAttribute("aria-pressed", "true");
  await search.fill("ARBO");
  await expect(harbor.locator("summary")).toContainText("항구·부두");
  await search.fill("물 위");
  for (const id of ["nature", "harbor", "structures"]) {
    await expect(palette.locator(`details[data-prop-group="${id}"][open]`)).toBeVisible();
  }
  await search.fill("버들항 기본 기물");
  await expect(harbor.locator("summary")).toHaveText(/^항구·부두 \([1-9]\d*\)$/u);
  await palette.screenshot({ path: testInfo.outputPath("grouped-search.png") });

  await search.fill("no-match-for-beodeul-props");
  await expect(palette.getByTestId("left-props-no-results")).toBeVisible();
  await expect(groups).toHaveCount(0);
  await expect(search).toBeFocused();
});
