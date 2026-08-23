import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIRECTORY = resolve(
  "output/evidence/ice-grand-expanse/ice-expanse-source-bound-20260722T080324Z-final/task-5/browser",
);

test.use({ serviceWorkers: "block" });

test("generic non-expanse map stays visually clean without zone feedback data", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/?freshProject=1&zoneFeedbackGenericQa=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await startNewGameFromTitle(page, { timeoutMs: 20_000 });
  await page.waitForTimeout(500);

  const runtimeStateText = await page.getByTestId("runtime-state-json").textContent();
  if (!runtimeStateText) throw new Error("missing runtime-state-json");
  const runtimeState = JSON.parse(runtimeStateText) as { readonly mapId?: string };
  expect(runtimeState.mapId).toBeTruthy();
  expect(runtimeState.mapId).not.toBe("map_g_ice_grand");
  await expect(page.getByTestId("zone-feedback")).toHaveCount(0);
  await expect(page.locator(".play-stage canvas")).toBeVisible();

  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const screenshotPath = resolve(EVIDENCE_DIRECTORY, "generic-non-expanse-no-feedback.png");
  await page.getByTestId("test-play-window").screenshot({ path: screenshotPath });
  expect(pageErrors).toEqual([]);
  await writeFile(
    resolve(EVIDENCE_DIRECTORY, "generic-non-expanse-no-feedback.json"),
    `${JSON.stringify({
      capturedAt: new Date().toISOString(),
      mapId: runtimeState.mapId,
      route: "/?freshProject=1&zoneFeedbackGenericQa=1",
      screenshotPath,
      zoneFeedbackCount: await page.getByTestId("zone-feedback").count(),
      pageErrors,
    }, null, 2)}\n`,
    "utf8",
  );
});
