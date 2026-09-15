import { expect, test, type Page } from "@playwright/test";

async function recordState(page: Page) {
  return page.evaluate(async () => {
    const storeUrl = "/src/project/store.ts";
    const { store }: typeof import("@/project/store") = await import(storeUrl);
    return { enemy: store.getCurrent().database.enemies[0], remote: store.isRemotePersistenceEnabled() };
  });
}

test("monster action dialog validates visibly, preserves drafts and keyboard focus, and commits only on OK", async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) {
    if (await page.getByTestId(id).isVisible()) await page.getByTestId(id).click();
  }
  await page.getByTestId("toolbar-database").click();
  if (!await page.getByTestId("db-tab-enemies").isVisible()) await page.getByTestId("db-tab-group-monster").click();
  await page.getByTestId("db-tab-enemies").click();
  const before = await recordState(page);
  expect(before.remote).toBe(false);
  const row = page.getByTestId("db-enemy-action-row-0");
  await row.dblclick();
  const field = (suffix: string) => page.getByTestId(`db-enemy-action-${suffix}`);
  await field("condition-type").selectOption("always");
  await expect(field("turn-start")).toBeDisabled();
  await expect(field("turn-interval")).toBeDisabled();
  await field("condition-type").selectOption("turn");
  await field("turn-start").fill("27");
  await field("turn-interval").fill("");
  await field("condition-type").selectOption("always");
  await field("condition-type").selectOption("turn");
  await expect(field("turn-start")).toHaveValue("27");
  await expect(field("turn-interval")).toHaveValue("");
  await field("turn-interval").fill("999");
  await field("rating").fill("0");
  await field("ok").click();
  await expect(field("dialog")).toBeVisible();
  await expect(field("rating")).toBeFocused();
  await expect(page.locator("#db-enemy-action-rating-error")).toBeVisible();
  expect(await recordState(page)).toEqual(before);
  await page.screenshot({ path: "output/evidence/monster-trust/invalid-priority-1280.png" });
  await field("rating").fill("100");
  await field("mode-skill").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(field("mode-basic")).toBeFocused();
  await expect(field("dialog-skill")).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(field("mode-skill")).toBeFocused();
  await field("dialog-skill").focus();
  await page.keyboard.press("ArrowDown");
  await expect(field("dialog-skill")).toBeFocused();
  const skill = await field("dialog-skill").inputValue();
  await field("mode-basic").click();
  await field("mode-skill").click();
  await expect(field("dialog-skill")).toHaveValue(skill);
  await expect(field("switch-on-id")).toBeDisabled();
  await expect(field("switch-on-picker")).toBeDisabled();
  await expect(field("switch-on-enabled")).toHaveAccessibleName(/ON/);
  await expect(field("switch-on-id")).toHaveAccessibleName(/ON/);
  await field("switch-on-enabled").check();
  await expect(field("switch-on-id")).toBeEnabled();
  await expect(field("switch-on-picker")).toBeEnabled();
  await field("cancel").click();
  expect(await recordState(page)).toEqual(before);
  await row.dblclick();
  await field("condition-type").selectOption("turn");
  await field("rating").fill("100");
  await field("turn-start").fill("1");
  await field("turn-interval").fill("999");
  await page.screenshot({ path: "output/evidence/monster-trust/validated-values-1280.png" });
  await field("ok").focus();
  await page.keyboard.press("Enter");
  await expect(field("dialog")).toHaveCount(0);
  const saved = await recordState(page);
  expect(saved.enemy?.actions[0]).toMatchObject({ priority: 100, condition: { kind: "turn", start: 1, interval: 999 } });
  await row.dblclick();
  await expect(field("rating")).toHaveValue("100");
  await expect(field("turn-start")).toHaveValue("1");
  await expect(field("turn-interval")).toHaveValue("999");
  await field("cancel").click();
  console.info("MONSTER_TRUST_BROWSER_PASS: cancel unchanged; validated commit/reopen; radio/skill keyboard focus; named switches; remote=false");
});
