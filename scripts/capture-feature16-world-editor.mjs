// Existing parent-owned editor server only. All edits stay in an isolated fresh project.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.FEATURE16_EDITOR_URL ?? `http://127.0.0.1:${process.env.DEV_SERVER_PORT ?? 9999}`;
const out = "verify-shots/feature16-world-editor";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    for (const key of ["oprn:editor-welcome-dismissed", "oprn:coachmarks-basic-v1", "oprn:standard-welcome-seen"]) localStorage.setItem(key, "1");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  // Block external writes; this script authors QA data only.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin && !["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.abort();
    return route.continue();
  });
  await page.goto(`${base}/?freshProject=1`);
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120000 });
  for (const id of ["standard-welcome-start", "editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
    const control = page.getByTestId(id);
    if (await control.isVisible().catch(() => false)) await control.click();
  }
  await page.getByTestId("palette-tileset-name").first().click();
  await page.getByTestId("map-props-tab-climate").click();
  await page.getByTestId("map-climate-mode").selectOption("fixed");
  await page.getByTestId("map-climate-weather").selectOption("snow");
  await page.getByTestId("map-climate-intensity").fill("0.8");
  await page.getByTestId("map-climate-intensity").blur();
  await page.screenshot({ path: `${out}/climate-fixed.png` });
  await page.getByTestId("map-climate-mode").selectOption("indoor");
  await expect(page.getByTestId("map-climate-weather")).toHaveCount(0);
  await page.screenshot({ path: `${out}/climate-indoor.png` });
  await page.keyboard.press("Escape");
  await page.getByTestId("toolbar-database").click();
  const skillTab = page.getByTestId("db-tab-skills");
  if (!await skillTab.isVisible()) await page.getByTestId("db-tab-group-party").click();
  await skillTab.click();
  const row = page.locator('[data-testid^="db-record-row-"], [data-testid^="db-record-card-"]').first();
  await row.click();
  await page.getByTestId("db-skill-card-action").scrollIntoViewIfNeeded();
  await page.getByTestId("db-field-skill-action-enabled").selectOption("on");
  for (const kind of ["melee", "dash", "trap", "projectile"]) {
    await page.getByTestId("db-field-skill-action-kind").selectOption(kind);
    await page.getByTestId("db-field-skill-action-range").fill("3");
    await page.getByTestId("db-field-skill-action-range").blur();
    await page.getByTestId("db-field-skill-action-status").selectOption("slow");
    await page.getByTestId("db-field-skill-action-status-duration").fill("2000");
    await page.getByTestId("db-field-skill-action-status-duration").blur();
    if (kind === "trap") await expect(page.getByTestId("db-field-skill-action-duration")).toBeVisible();
    await page.getByTestId("db-skill-card-action").screenshot({ path: `${out}/action-${kind}.png` });
  }
  // Observe canonical store + real serializer after UI changes; no synthetic mounts.
  const receipt = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { serialize, deserialize } = await import("/src/project/io.ts");
    const loaded = deserialize(serialize(store.getCurrent()));
    return { climates: Object.values(loaded.maps).map((m) => m.climate).filter(Boolean),
      profiles: loaded.database.skills.filter((s) => s.actionSkill).map((s) => s.actionSkill) };
  });
  expect(receipt.climates).toContainEqual({ mode: "indoor" });
  expect(receipt.profiles).toContainEqual(expect.objectContaining({ kind: "projectile", range: 3, fieldStatus: { kind: "slow", durationMs: 2000 } }));
  await writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
} finally { await browser.close(); }
