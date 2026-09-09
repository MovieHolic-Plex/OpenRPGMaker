import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

// Task 18: the seven 생활 tabs on the REAL editor surface, against the isolated remote
// project that task 19 saved and reloaded (never the shared demo row).
const PROJECT_ID = "rpg-zzu-life-full-01a08046-verify";
const EVIDENCE_DIR = ".omo/evidence/life-full-20260906/18/editor-e2e";
const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1440, height: 900 }] as const;

// database.ts: { label: "생활", slug: "life", tabs: [...] } — exactly these seven.
const LIFE_TABS = [
  { label: "작물", slug: "crops", testId: "db-tab-crops" },
  { label: "주민", slug: "characters", testId: "db-tab-characters" },
  { label: "생활 기술·제작", slug: "lifeCrafting", testId: "db-tab-life-crafting" },
  { label: "날씨·달력", slug: "dailyWeather", testId: "db-tab-daily-weather" },
  { label: "농장 동물", slug: "farmAnimals", testId: "db-tab-farm-animals" },
  { label: "농장 배치", slug: "farmSpatial", testId: "db-tab-farm-spatial" },
  { label: "수집", slug: "lifeCollections", testId: "db-tab-life-collections" },
] as const;

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

async function expectRemoteProject(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => {
    const text = await page.getByTestId("project-export-json").textContent();
    if (!text) return undefined;
    return (JSON.parse(text) as { project?: { meta?: { title?: string } } }).project?.meta?.title;
  }, { timeout: 60_000 }).toBe("생활 시스템 완주 픽스처");
}

test("생활 7탭을 실제 편집기에서 두 해상도로 저작 표면까지 확인한다", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // 이 QA 세션은 원격 저장이 아닌 임시 세션이므로 자동 저장 경고는 예상된 것이다.
    if (text.includes("[autosave]") || text.includes("ERR_CONNECTION_REFUSED")) return;
    errors.push(text);
  });

  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?project=${PROJECT_ID}`, { waitUntil: "domcontentloaded" });
  await expectRemoteProject(page);
  await openDatabase(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const tab of LIFE_TABS) {
      // switchDatabaseTab expands the collapsed sidebar group exactly as a user does.
      await switchDatabaseTab(page, tab);
      const panel = page.getByTestId("database-modal");
      await expect(panel, `${tab.slug} panel`).toBeVisible();
      // The tab must render an authoring surface, not an empty shell.
      const body = await panel.innerText();
      expect(body.trim().length, `${tab.slug} body empty`).toBeGreaterThan(0);
      await page.screenshot({
        path: `${EVIDENCE_DIR}/${tab.slug}-${viewport.width}x${viewport.height}.png`,
      });
    }
  }

  expect(errors, "editor console/page errors").toEqual([]);
});
