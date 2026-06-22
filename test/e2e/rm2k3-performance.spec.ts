import { expect, test, type Page } from "@playwright/test";
import systemShellProject from "../fixtures/projects/system-shell-v3.json" with { type: "json" };

type PerfMetricsRecord = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function modeSwitchMs(metrics: PerfMetricsRecord): readonly unknown[] {
  return Array.isArray(metrics.modeSwitchMs) ? metrics.modeSwitchMs : [];
}

async function seedProject(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async (seed) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("rpg-zzu", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("projects", "readwrite");
        transaction.objectStore("projects").put(seed, "current");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
    localStorage.clear();
  }, systemShellProject);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
}

async function perfMetrics(page: Page): Promise<PerfMetricsRecord> {
  const text = await page.locator('[data-testid="perf-metrics-json"]').textContent();
  if (!text) throw new Error("missing perf metrics JSON");
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error("invalid perf metrics JSON");
  return parsed;
}

async function waitForMetric(page: Page, field: string): Promise<void> {
  await expect.poll(async () => isNonnegativeNumber((await perfMetrics(page))[field])).toBe(true);
}

test("records nonnegative performance metrics through title flow, battle entry, and mode resume", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  // Given: a fresh browser context with the system-shell project seeded.
  await seedProject(page);
  await expect(page.locator('[data-testid="perf-metrics-json"]')).toBeAttached();
  await waitForMetric(page, "initialEditRenderMs");
  await page.screenshot({ path: testInfo.outputPath("edit-ready.png"), fullPage: true });

  // When: the T12 title flow starts play mode and launches a new game.
  await page.click('[data-testid="mode-play"]');
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.click('[data-testid="title-new-game"]');
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await waitForMetric(page, "playRenderMs");
  await page.screenshot({ path: testInfo.outputPath("play-ready.png"), fullPage: true });

  // Then: battle entry and edit-to-play resume both publish nonnegative timings.
  await expect(page.getByTestId("event-battle-start")).toBeVisible();
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await waitForMetric(page, "battleEntryMs");
  await page.screenshot({ path: testInfo.outputPath("battle-entry.png"), fullPage: true });

  await page.click('[data-testid="mode-edit"]');
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await page.click('[data-testid="mode-play"]');
  await expect(page.getByTestId("title-screen")).toBeVisible();

  const metrics = await perfMetrics(page);
  const switches = modeSwitchMs(metrics);
  expect(isNonnegativeNumber(metrics.initialEditRenderMs)).toBe(true);
  expect(isNonnegativeNumber(metrics.playRenderMs)).toBe(true);
  expect(isNonnegativeNumber(metrics.battleEntryMs)).toBe(true);
  expect(switches.length).toBeGreaterThanOrEqual(1);
  expect(switches.every(isNonnegativeNumber)).toBe(true);
  await testInfo.attach("performance-metrics", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  console.log(`[perf-metrics] ${JSON.stringify(metrics)}`);
  await page.screenshot({ path: testInfo.outputPath("performance-metrics.png"), fullPage: true });
});
