import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { isMenuInsidePlayStage, openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";
import { startNewGameFromTitle } from "./runtimeInput";

const PROJECT_ID = "rpg-zzu-stardew-demo";
const EVIDENCE_DIR = ".superpowers/sdd/qa-shots/stardew-p1";
const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1440, height: 900 }] as const;

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

async function loadRemoteRuntime(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`/?project=${PROJECT_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page, { timeoutMs: 30_000 });
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
}

async function openAnimalLedger(page: Page): Promise<void> {
  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.getByTestId("status-menu-command-record-menu").click();
  await page.getByTestId("status-menu-group-command-life-ledger").click();
  await page.getByTestId("life-ledger-tab-animals").click();
  await expect(page.getByTestId("life-ledger-tab-animals")).toHaveAttribute("aria-selected", "true");
}

test("P1 런타임 HUD, 동물 시각 연결, 돌봄 장부를 두 해상도에서 검증한다", async ({ page }) => {
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
  await page.setViewportSize({ width: 1024, height: 768 });
  await loadRemoteRuntime(page);

  const hud = page.getByTestId("runtime-time-hud");
  await expect(hud).toContainText("1년 봄 1일");
  await expect(hud).toContainText("오늘");
  await expect(hud).toContainText("내일");
  await expect(hud).toContainText(/생일/);
  const eventIds = await page.evaluate(() => Object.keys((window as unknown as {
    __oprnCharacterSprites?: () => { events: Record<string, unknown> } | null;
  }).__oprnCharacterSprites?.()?.events ?? {}));
  expect(eventIds).toEqual(expect.arrayContaining(["ev_farm_chicken", "ev_farm_cow"]));

  await page.evaluate(() => (window as unknown as {
    __oprnDebug?: { giveItem: (itemId: string, count: number) => void };
  }).__oprnDebug?.giveItem("item_hay", 2));
  await openAnimalLedger(page);
  await expect(page.getByTestId("life-ledger-artwork")).toHaveAttribute("src", /animals-card\.png/);
  await expect(page.getByTestId("life-ledger-animal-summary-farm_animal_bori")).toContainText("보리");
  await expect(page.getByTestId("life-ledger-animal-summary-farm_animal_dubu")).toContainText("두부");
  await page.getByTestId("life-ledger-animal-feed-farm_animal_bori").click();
  await page.getByTestId("life-ledger-animal-pet-farm_animal_bori").click();
  await expect(page.getByTestId("life-ledger-animal-feed-farm_animal_bori")).toContainText("오늘 완료");
  await expect(page.getByTestId("life-ledger-animal-pet-farm_animal_bori")).toContainText("오늘 완료");

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const size = `${viewport.width}x${viewport.height}`;
    expect(await isMenuInsidePlayStage(page), `${size} menu containment`).toBe(true);
    const artworkLoaded = await page.getByTestId("life-ledger-artwork").evaluate((node) =>
      node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0);
    expect(artworkLoaded, `${size} generated animal artwork loaded`).toBe(true);
    const menuMetrics = await page.getByTestId("main-menu").evaluate((node) => {
      if (!(node instanceof HTMLElement)) throw new Error("menu is not HTMLElement");
      return { clientWidth: node.clientWidth, scrollWidth: node.scrollWidth };
    });
    expect(menuMetrics.scrollWidth, `${size} menu horizontal overflow`).toBeLessThanOrEqual(menuMetrics.clientWidth + 1);
    await page.getByTestId("main-menu").screenshot({ path: `${EVIDENCE_DIR}/runtime-animals-${size}.png` });
  }

  expect(errors).toEqual([]);
  expect(failedRequests.filter((entry) => !isKnownOptionalRequestFailure(entry))).toEqual([]);
});

function isKnownOptionalRequestFailure(entry: string): boolean {
  return entry.startsWith("http://127.0.0.1:17831/v1/browser/hello")
    || entry.endsWith("net::ERR_ABORTED");
}
