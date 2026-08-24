import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { openDatabase } from "./oprn-database-helpers";

const PROJECT_ID = "rpg-zzu-stardew-demo";
const EVIDENCE_DIR = ".superpowers/sdd/qa-shots/stardew-p2";
const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1440, height: 900 }] as const;

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

async function expectRemoteProject(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(`/?project=${PROJECT_ID}`, { waitUntil: "domcontentloaded" });
    const outcome = await Promise.race([
      page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 30_000 }).then(() => "loaded" as const).catch(() => "timeout" as const),
      page.getByText("저장된 작업을 바로 열 수 없습니다").waitFor({ state: "visible", timeout: 30_000 }).then(() => "failed" as const).catch(() => "timeout" as const),
    ]);
    if (outcome === "loaded") break;
  }
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => {
    const text = await page.getByTestId("project-export-json").textContent();
    if (!text) return undefined;
    return (JSON.parse(text) as { project?: { meta?: { title?: string } } }).project?.meta?.title;
  }, { timeout: 30_000 }).toBe("별빛 농장 마을");
}

async function expectImageLoaded(image: Locator, label: string): Promise<void> {
  await expect(image).toBeVisible();
  expect(await image.evaluate((node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0), label).toBe(true);
}

async function expectNoHorizontalOverflow(locator: Locator, label: string): Promise<void> {
  const metrics = await locator.evaluate((node) => {
    if (!(node instanceof HTMLElement)) throw new Error("expected HTMLElement");
    return { clientWidth: node.clientWidth, scrollWidth: node.scrollWidth };
  });
  expect(metrics.scrollWidth, `${label} horizontal overflow`).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test("P2 낚시·채집·박물관과 공간 저작 화면을 두 해상도에서 검증한다", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text() !== "Failed to load resource: net::ERR_CONNECTION_REFUSED") errors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectRemoteProject(page);
  // Bootstrap retries deliberately recover transient Supabase fetch failures; scope the
  // clean-console assertion to the successfully loaded editor session under test.
  errors.length = 0;
  failedRequests.length = 0;
  await openDatabase(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const size = `${viewport.width}x${viewport.height}`;

    await page.getByTestId("db-tab-life-collections").click({ force: true });
    const life = page.getByTestId("db-life-collections-workspace");
    await expect(life).toBeVisible();
    await expect(life).toContainText("물고기 2 · 낚시터 1 · 채집 구역 2 · 박물관 보상 2");
    await expect(page.getByTestId("db-life-collections-name-fish-fish_river_carp")).toHaveValue("강 잉어");
    await expect(page.getByTestId("db-life-collections-name-fish-fish_moon_trout")).toHaveValue("달빛 송어");
    await expect(page.getByTestId("db-life-collections-name-forage-forage_farm_meadow")).toHaveValue("농장 남쪽 풀밭");
    await expect(page.getByTestId("db-life-collections-name-museum-museum_reward_field_scholar")).toHaveValue("들판 연구가 보상");
    await expectImageLoaded(page.getByTestId("db-life-collections-hero-image"), `${size} forage artwork`);
    await expectNoHorizontalOverflow(page.getByTestId("db-life-collections-hero"), `${size} life collections hero`);
    await expectNoHorizontalOverflow(life, `${size} life collections workspace`);
    await page.getByTestId("database-modal").screenshot({ path: `${EVIDENCE_DIR}/editor-life-collections-${size}.png` });

    await page.getByTestId("db-tab-farm-spatial").click({ force: true });
    const spatial = page.getByTestId("db-spatial-workspace");
    await expect(spatial).toBeVisible();
    await expect(spatial).toContainText("건물 유형 1 · 장식 유형 2 · 시작 배치 3");
    await expect(page.getByTestId("db-spatial-building-name-farm_building_workshop")).toHaveValue("농장 작업실");
    await expect(page.getByTestId("db-spatial-building-level-farm_building_workshop-2")).toContainText("Lv.2 업그레이드");
    await expect(page.getByTestId("db-spatial-decoration-name-home_decor_sun_rug")).toHaveValue("해님 러그");
    await expect(page.getByTestId("db-spatial-building-placement-farm_building_workshop_1")).toBeVisible();
    await expect(page.getByTestId("db-spatial-decoration-placement-home_decor_wood_table_1")).toBeVisible();
    await expectImageLoaded(page.getByTestId("db-spatial-hero-image"), `${size} decorating artwork`);
    await expectNoHorizontalOverflow(spatial, `${size} spatial workspace`);
    await page.getByTestId("database-modal").screenshot({ path: `${EVIDENCE_DIR}/editor-spaces-${size}.png` });
  }

  expect(errors).toEqual([]);
  expect(failedRequests.filter((entry) => !isKnownOptionalRequestFailure(entry))).toEqual([]);
});

function isKnownOptionalRequestFailure(entry: string): boolean {
  return entry.startsWith("http://127.0.0.1:17831/v1/browser/hello") || entry.endsWith("net::ERR_ABORTED");
}
