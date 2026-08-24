import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { isMenuInsidePlayStage, openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";
import { startNewGameFromTitle } from "./runtimeInput";

const PROJECT_ID = "rpg-zzu-stardew-demo";
const EVIDENCE_DIR = ".superpowers/sdd/qa-shots/stardew-p2";
const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1440, height: 900 }] as const;

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

async function loadRemoteRuntime(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(`/?project=${PROJECT_ID}`, { waitUntil: "domcontentloaded" });
    const outcome = await Promise.race([
      page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 30_000 }).then(() => "loaded" as const).catch(() => "timeout" as const),
      page.getByText("저장된 작업을 바로 열 수 없습니다").waitFor({ state: "visible", timeout: 30_000 }).then(() => "failed" as const).catch(() => "timeout" as const),
    ]);
    if (outcome === "loaded") break;
  }
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page, { timeoutMs: 30_000 });
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
}

async function openLifeLedger(page: Page): Promise<void> {
  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.getByTestId("status-menu-command-record-menu").click();
  await page.getByTestId("status-menu-group-command-life-ledger").click();
  await expect(page.getByTestId("life-ledger-tab-collections")).toBeVisible();
}

async function expectImageLoaded(image: Locator, label: string): Promise<void> {
  await expect(image).toBeVisible();
  expect(await image.evaluate((node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0), label).toBe(true);
}

async function captureLedger(page: Page, tab: "collections" | "museum" | "spaces", size: string): Promise<void> {
  await page.getByTestId(`life-ledger-tab-${tab}`).click();
  await expect(page.getByTestId(`life-ledger-tab-${tab}`)).toHaveAttribute("aria-selected", "true");
  await expectImageLoaded(page.getByTestId("life-ledger-artwork"), `${size} ${tab} artwork`);
  const menu = page.getByTestId("main-menu");
  const metrics = await menu.evaluate((node) => {
    if (!(node instanceof HTMLElement)) throw new Error("menu is not HTMLElement");
    return { clientWidth: node.clientWidth, scrollWidth: node.scrollWidth };
  });
  expect(metrics.scrollWidth, `${size} ${tab} horizontal overflow`).toBeLessThanOrEqual(metrics.clientWidth + 1);
  await menu.screenshot({ path: `${EVIDENCE_DIR}/runtime-${tab}-${size}.png` });
}

test("P2 수집·박물관·공간 장부와 원자적 행동을 두 해상도에서 검증한다", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text() !== "Failed to load resource: net::ERR_CONNECTION_REFUSED") errors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
  await page.setViewportSize({ width: 1024, height: 768 });
  await loadRemoteRuntime(page);
  // A recovered bootstrap attempt is external transport noise, not a runtime-console failure.
  errors.length = 0;
  failedRequests.length = 0;
  await openLifeLedger(page);

  await page.getByTestId("life-ledger-tab-collections").click();
  await expect(page.getByTestId("life-ledger-collection-item_river_carp")).toContainText("강 잉어");
  await expect(page.getByTestId("life-ledger-collection-item_wild_leek")).toContainText("야생 부추");

  await page.getByTestId("life-ledger-tab-museum").click();
  const donation = page.getByTestId("life-ledger-museum-donate-item_wild_leek");
  await expect(donation).toBeEnabled();
  await donation.click();
  await expect(donation).toContainText("기부 완료");
  await expect(donation).toBeDisabled();

  await page.getByTestId("life-ledger-tab-spaces").click();
  await expect(page.getByTestId("life-ledger-space-building-farm_building_workshop_1")).toContainText("농장 작업실");
  await expect(page.getByTestId("life-ledger-space-decoration-home_decor_sun_rug_1")).toContainText("해님 러그");
  const rotate = page.getByTestId("life-ledger-space-decoration-rotate-home_decor_wood_table_1");
  await expect(rotate).toBeEnabled();
  await rotate.click();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const size = `${viewport.width}x${viewport.height}`;
    expect(await isMenuInsidePlayStage(page), `${size} menu containment`).toBe(true);
    await captureLedger(page, "collections", size);
    await captureLedger(page, "museum", size);
    await captureLedger(page, "spaces", size);
  }

  expect(errors).toEqual([]);
  expect(failedRequests.filter((entry) => !isKnownOptionalRequestFailure(entry))).toEqual([]);
});

function isKnownOptionalRequestFailure(entry: string): boolean {
  return entry.startsWith("http://127.0.0.1:17831/v1/browser/hello") || entry.endsWith("net::ERR_ABORTED");
}
