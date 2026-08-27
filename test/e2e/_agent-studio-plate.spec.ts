import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = path.resolve("output/evidence/agent-studio");

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  try {
    await guest.waitFor({ state: "visible", timeout: 5_000 });
    await guest.click();
  } catch {
    // already past login
  }
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
}

test.describe("agent studio plate", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
      localStorage.removeItem("rpg-zzu:ai-panel-collapsed");
    });
  });

  test("펼친 헤더가 감독 플레이트이고 접으면 얼굴이 남는다", async ({ page }) => {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?blankProject=1");
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

    const panel = page.getByTestId("ai-panel");
    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) {
      await restore.click();
    }
    await expect(panel).not.toHaveClass(/is-collapsed/);
    const plate = page.getByTestId("ai-agent-plate");
    await expect(plate).toBeVisible();
    await expect(page.getByTestId("ai-agent-name")).toHaveText("감독");
    await expect(page.getByTestId("ai-agent-status")).toHaveText("보고 있음");
    await expect(page.getByTestId("ai-agent-brief")).toContainText("빈 맵");
    await expect(plate.getByTestId("ai-agent-face")).toBeVisible();
    await expect(page.getByTestId("ai-input")).toHaveAttribute("placeholder", /이 맵에 지시/);
    await expect(page.getByTestId("ai-start-empty-hint")).toHaveText("지금 이 맵");
    await expect(page.getByTestId("ai-start-looking-at")).toContainText("지금 빈 맵");
    await expect(page.getByTestId("ai-start-looking-at")).toContainText("사람 0");
    await expect(page.getByTestId("ai-director-modes")).toBeVisible();
    await expect(page.getByTestId("ai-director-mode-instruct")).toHaveText("지시");
    await expect(page.getByTestId("ai-director-mode-ask")).toHaveText("질문");
    await expect(page.getByTestId("ai-director-mode-plan")).toHaveText("계획");
    await expect(page.getByTestId("ai-start-visual-place")).toContainText("@>");
    await page.getByTestId("ai-start-visual-character").click();
    await expect(page.getByTestId("ai-input")).toHaveValue(/등장인물/);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, "plate-open.png"), fullPage: true });

    const input = page.getByTestId("ai-input");
    await input.fill("집 세 채 지어");
    await page.getByTestId("ai-send").click();
    await expect(page.getByTestId("ai-bubble-user")).toContainText("집 세 채 지어");
    await expect(page.locator(".ai-command-prefix").first()).toHaveText("@>");
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "command-row.png"), fullPage: true });

    await page.getByTestId("ai-collapse").click();
    await expect(panel).toHaveClass(/is-collapsed/);
    await expect(restore).toBeVisible();
    await expect(restore.locator(".ai-collapsed-restore-wordmark")).toHaveCount(0);
    await expect(restore.getByTestId("ai-agent-face")).toHaveCount(1);
    await expect(restore.getByTestId("ai-agent-face")).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "plate-collapsed.png"), fullPage: true });
  });

  test("전문가 셸이 Unity 톤 다크 크롬이다", async ({ page }) => {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?blankProject=1");
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) await restore.click();

    const topbar = page.locator(".topbar").first();
    await expect(topbar).toBeVisible();
    const bg = await topbar.evaluate((el) => getComputedStyle(el).backgroundColor);
    const rgb = bg.match(/\d+/g)?.map(Number) ?? [];
    expect(rgb[0] ?? 255).toBeLessThan(80);
    expect(rgb[1] ?? 255).toBeLessThan(80);
    expect(rgb[2] ?? 255).toBeLessThan(80);

    const activeMode = page.locator(".editor-ui-mode-btn.is-active");
    const activeBg = await activeMode.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(activeBg).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/i);

    await expect(page.getByTestId("mode-play")).toBeVisible();
    await expect(page.locator('[data-testid="rm2k3-toolbar"] [data-testid="mode-play"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="rm2k3-toolbar"] [data-testid="toolbar-zoom-2"]')).toHaveCount(0);
    await expect(page.getByTestId("editor-zoom-stepper")).toBeVisible();
    const mapCell = page.getByTestId("statusbar-map");
    await expect(mapCell).toBeVisible();
    await expect(mapCell).toContainText(/맵:/);
    const mapDisplay = await mapCell.evaluate((el) => {
      const style = getComputedStyle(el);
      return { display: style.display, visibility: style.visibility };
    });
    expect(mapDisplay.display).not.toBe("none");
    expect(mapDisplay.visibility).not.toBe("hidden");
    const emptyEvent = page.getByTestId("event-list-empty");
    if (await emptyEvent.count()) {
      await expect(emptyEvent).toContainText("이벤트 없음");
    }
    await expect(page.getByTestId("left-drawer-tabs")).toBeVisible();
    await expect(page.getByTestId("left-drawer-tab-map")).toBeVisible();
    await page.getByTestId("left-drawer-tab-map").click();
    await expect(page.getByTestId("left-map-root")).toBeVisible();
    await expect(page.getByTestId("left-palette-root")).toBeVisible();
    await expect(page.getByTestId("toolbar-new")).toBeHidden();
    await expect(page.getByTestId("toolbar-map-copy")).toBeHidden();
    await expect(page.getByTestId("toolbar-save")).toBeVisible();
    await page.getByTestId("toolbar-database").click();
    const dbHeader = page.locator(".database-modal-header").first();
    await expect(dbHeader).toBeVisible();
    const dbHeaderBg = await dbHeader.evaluate((el) => getComputedStyle(el).backgroundColor);
    const dbRgb = dbHeaderBg.match(/\d+/g)?.map(Number) ?? [];
    expect(dbRgb[0] ?? 255).toBeLessThan(80);
    expect(dbRgb[1] ?? 255).toBeLessThan(80);
    expect(dbRgb[2] ?? 255).toBeLessThan(80);
    await page.getByTestId("database-modal-close").click();
    await expect(page.getByTestId("database-modal")).toBeHidden();

    const rail = await page.evaluate(() => {
      const ai = document.querySelector<HTMLElement>("[data-testid='chat-side-panel']");
      const left = document.querySelector<HTMLElement>(".left-panel");
      const canvas = document.querySelector<HTMLElement>(".canvas-area");
      if (!ai || !left || !canvas) throw new Error("rail columns missing");
      const a = ai.getBoundingClientRect();
      const l = left.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      return {
        aiLeft: a.left,
        leftLeft: l.left,
        canvasLeft: c.left,
        aiTop: a.top,
        leftTop: l.top,
        canvasTop: c.top,
        aiHeight: a.height,
        leftHeight: l.height,
        canvasHeight: c.height,
      };
    });
    expect(rail.aiLeft).toBeLessThan(rail.leftLeft);
    expect(rail.leftLeft).toBeLessThan(rail.canvasLeft);
    expect(Math.abs(rail.aiTop - rail.leftTop)).toBeLessThan(8);
    expect(Math.abs(rail.leftTop - rail.canvasTop)).toBeLessThan(8);
    expect(Math.abs(rail.aiHeight - rail.canvasHeight)).toBeLessThan(8);

    await page.evaluate(() => {
      const harness = (window as unknown as {
        __rpgzzuRegionTaskHarness?: {
          currentMapId: () => string;
          setSelection: (selection: { mapId: string; x: number; y: number; width: number; height: number } | null) => void;
        };
      }).__rpgzzuRegionTaskHarness;
      if (!harness) throw new Error("region harness missing");
      const mapId = harness.currentMapId();
      harness.setSelection({ mapId, x: 2, y: 2, width: 4, height: 3 });
    });
    await expect(page.getByTestId("selection-minibar")).toBeVisible();
    await expect(page.getByTestId("selection-minibar")).toContainText("선택 4×3");
    await expect(page.getByTestId("ai-agent-brief")).toContainText("선택 4×3");

    await page.screenshot({ path: path.join(EVIDENCE_DIR, "pr1-warm-shell.png"), fullPage: true });
  });
});
