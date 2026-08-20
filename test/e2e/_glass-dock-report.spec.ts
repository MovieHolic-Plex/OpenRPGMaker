import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "output/evidence/ai-float-left-brainstorm/shots";
mkdirSync(OUT, { recursive: true });

async function dismissChrome(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  try {
    await guest.waitFor({ state: "visible", timeout: 5_000 });
    await guest.click();
  } catch {
    /* already in */
  }
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
}

async function boot(page: Page, mode: "beginner" | "standard"): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 920 });
  await page.addInitScript(({ uiMode }) => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", uiMode);
    localStorage.removeItem("rpg-zzu:editor-layout:v4");
    localStorage.removeItem("rpg-zzu:ai-panel-collapsed");
  }, { uiMode: mode });
  await page.goto("/?blankProject=1");
  await dismissChrome(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 40_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await expect(page.getByTestId("ai-command-bar")).toBeVisible({ timeout: 15_000 });
}

async function cycleDock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid=chat-dock-toggle]");
    toggle?.click();
  });
}

async function expandGlassLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log = document.querySelector("[data-testid=ai-chat-log]");
    if (!log) return;
    const row = document.createElement("div");
    row.className = "ai-command-row";
    row.dataset.testid = "ai-command-row-assistant";
    row.textContent = "샘은 집 앞 잔디에만 둘게요. 나무와 길은 그대로 둘까요?";
    log.append(row);
    document.querySelector("[data-testid=ai-panel]")?.classList.remove("is-glass-idle");
    const steps = document.querySelector<HTMLElement>("[data-testid=ai-next-steps]");
    if (steps) steps.hidden = true;
  });
}

test("glass dock visual report shots", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "beginner");
  await expect(page.locator("body")).toHaveClass(/ai-chat-dock-glass/);
  await expect(page.getByTestId("ai-next-steps")).toBeVisible();
  await expect(page.getByTestId("ai-start-visual-gallery")).toBeVisible();
  await expect(page.getByTestId("ai-start-visual-stage-place")).toBeVisible();
  await page.screenshot({ path: `${OUT}/01-beginner-glass-idle.png`, fullPage: true });
  await page.getByTestId("ai-panel").screenshot({ path: `${OUT}/03-glass-card-closeup.png` });

  await expandGlassLog(page);
  await page.screenshot({ path: `${OUT}/02-beginner-glass-log.png`, fullPage: true });

  await cycleDock(page);
  await expect(page.locator("body")).toHaveClass(/ai-chat-dock-side/);
  await page.screenshot({ path: `${OUT}/04-beginner-side.png`, fullPage: true });

  await cycleDock(page);
  await expect(page.locator("body")).toHaveClass(/ai-chat-dock-float/);
  await page.screenshot({ path: `${OUT}/05-beginner-float.png`, fullPage: true });

  await boot(page, "standard");
  await expect(page.locator("body")).toHaveClass(/ai-chat-dock-glass/);
  await page.screenshot({ path: `${OUT}/06-standard-glass-idle.png`, fullPage: true });
  await expandGlassLog(page);
  await page.screenshot({ path: `${OUT}/07-standard-glass-log.png`, fullPage: true });
});
