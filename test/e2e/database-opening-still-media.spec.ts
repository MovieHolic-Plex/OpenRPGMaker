import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { Project } from "../../src/project/types";

// DEV_SERVER_PORT=19036 E2E_RETRIES=0 VITE_LEGACY_DB_URL= VITE_LEGACY_DB_ANON_KEY=
// VITE_LEGACY_DB_PROJECT_ID= VITE_AI_ACTIVITY_DISK_MIRROR=0 VITE_EDIT_ACTIVITY_DISK_MIRROR=0
// npm run test:e2e -- test/e2e/database-opening-still-media.spec.ts
const origin = `http://127.0.0.1:${process.env.DEV_SERVER_PORT ?? "9173"}`;
const prefix = "db-cinematic-";
const BACKDROP = "easyrpg-backdrop-cosmos1";
const MUSIC = "cc0-bgm-rtp-ttl-001";

test.use({
  actionTimeout: 15_000,
  navigationTimeout: 90_000,
  launchOptions: { args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] },
});
test.describe.configure({ timeout: 240_000, retries: 0 });

async function project(page: Page): Promise<Project> {
  return page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(path);
    return store.getCurrent();
  });
}

async function selectResource(page: Page, slot: string, id: string): Promise<void> {
  await page.getByTestId(`${prefix}${slot}-set`).click();
  await page.getByTestId(`${prefix}${slot}-dialog-search`).fill(id);
  await page.getByTestId(`${prefix}${slot}-dialog-option-${id}`).click();
  await page.getByTestId(`${prefix}${slot}-dialog-ok`).click();
}

test("오프닝 탭이 배경화·AI 생성·배경음악을 제공한다", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    // blankProject 세션은 원격 저장이 꺼져 있어 자동저장 실패를 의도적으로 알린다 — 이 스펙의 대상이 아니다.
    if (message.type() === "error" && !message.text().includes("[autosave]")) errors.push(`console: ${message.text()}`);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  const openingTab = page.getByTestId("db-tab-opening");
  if (!await openingTab.isVisible()) await page.getByTestId("db-tab-group-system").click();
  await openingTab.click();

  await page.getByTestId(`${prefix}music-set`).waitFor();
  await selectResource(page, "music", MUSIC);
  await expect.poll(async () => (await project(page)).system.opening?.musicResourceId).toBe(MUSIC);

  await page.getByTestId(`${prefix}add`).click();
  await page.getByTestId(`${prefix}kind`).selectOption("image");

  await page.getByTestId(`${prefix}resource-set`).click();
  await page.getByTestId(`${prefix}resource-dialog-search`).fill(BACKDROP);
  await expect(page.getByTestId(`${prefix}resource-dialog-option-${BACKDROP}`)).toBeVisible();
  await page.getByTestId(`${prefix}resource-dialog-option-${BACKDROP}`).click();
  await page.getByTestId(`${prefix}resource-dialog-ok`).click();

  await expect.poll(async () => {
    const scene = (await project(page)).system.opening?.scenes[0];
    return scene && scene.kind !== "text" ? scene.resourceId : undefined;
  }).toBe(BACKDROP);

  await expect(page.getByTestId(`${prefix}resource-ai-prompt`)).toBeVisible();
  await expect(page.getByTestId(`${prefix}resource-ai-generate`)).toBeVisible();

  const shot = await page.getByTestId("database-modal").screenshot();
  await info.attach("opening-still-media", { body: shot, contentType: "image/png" });
  await mkdir("verify-shots/opening-still-media", { recursive: true });
  await writeFile("verify-shots/opening-still-media/opening-tab.png", shot);
  expect(errors).toEqual([]);
});
