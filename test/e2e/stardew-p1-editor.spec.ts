import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { openDatabase } from "./oprn-database-helpers";

const PROJECT_ID = "rpg-zzu-stardew-demo";
const EVIDENCE_DIR = ".superpowers/sdd/qa-shots/stardew-p1";
const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1440, height: 900 }] as const;

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

async function expectNoHorizontalOverflow(locator: Locator, label: string): Promise<void> {
  const metrics = await locator.evaluate((node) => {
    if (!(node instanceof HTMLElement)) throw new Error("expected HTMLElement");
    return { clientWidth: node.clientWidth, scrollWidth: node.scrollWidth };
  });
  expect(metrics.scrollWidth, `${label} horizontal overflow`).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function expectRemoteProject(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => {
    const text = await page.getByTestId("project-export-json").textContent();
    if (!text) return undefined;
    return (JSON.parse(text) as { project?: { meta?: { title?: string } } }).project?.meta?.title;
  }, { timeout: 30_000 }).toBe("별빛 농장 마을");
}

test("P1 계절·날씨와 동물·축사 저작 화면을 두 해상도에서 검증한다", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text() !== "Failed to load resource: net::ERR_CONNECTION_REFUSED") {
      errors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?project=${PROJECT_ID}`, { waitUntil: "domcontentloaded" });
  await expectRemoteProject(page);
  await openDatabase(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const size = `${viewport.width}x${viewport.height}`;

    await page.getByTestId("db-tab-daily-weather").click({ force: true });
    await expect(page.getByTestId("db-weather-workspace")).toBeVisible();
    await expect(page.getByTestId("db-weather-enabled")).toBeChecked();
    await expect(page.getByTestId("db-weather-forecast-days")).toHaveValue("3");
    for (const season of ["spring", "summer", "fall", "winter"] as const) {
      const card = page.getByTestId(`db-weather-season-${season}`);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("data-count", /[1-9]/);
    }
    await expectNoHorizontalOverflow(page.getByTestId("db-weather-workspace"), `${size} weather workspace`);
    await page.getByTestId("database-modal").screenshot({ path: `${EVIDENCE_DIR}/editor-weather-${size}.png` });

    await page.getByTestId("db-tab-farm-animals").click({ force: true });
    await expect(page.getByTestId("db-farm-animals-workspace")).toBeVisible();
    await expect(page.getByTestId("db-farm-species-animal_chicken").locator("input").first()).toHaveValue("닭");
    await expect(page.getByTestId("db-farm-species-animal_cow").locator("input").first()).toHaveValue("소");
    await expect(page.getByTestId("db-farm-building-building_sunrise_barn").locator("input").first()).toHaveValue("햇살 축사");
    await expect(page.getByTestId("db-farm-animal-farm_animal_bori").locator("input").first()).toHaveValue("보리");
    await expect(page.getByTestId("db-farm-animal-farm_animal_dubu").locator("input").first()).toHaveValue("두부");
    await expectNoHorizontalOverflow(page.getByTestId("db-farm-animals-workspace"), `${size} animals workspace`);
    await page.getByTestId("database-modal").screenshot({ path: `${EVIDENCE_DIR}/editor-animals-${size}.png` });
  }

  expect(errors).toEqual([]);
  expect(failedRequests.filter((entry) => !isKnownOptionalRequestFailure(entry))).toEqual([]);
});

function isKnownOptionalRequestFailure(entry: string): boolean {
  return entry.startsWith("http://127.0.0.1:17831/v1/browser/hello")
    || entry.endsWith("net::ERR_ABORTED");
}
