import { expect, test } from "@playwright/test";
import { createHouseTemplateGalleryProject } from "@/project/defaults";
import { serialize } from "@/project/io";

const STORAGE_KEY = "rpg-zzu:supabase-project-config";
const TEST_CONFIG = {
  anonKey: "test-anon-key",
  projectId: "initial-project",
  source: "custom",
  url: "http://dbserver:8100",
} as const;

test("toolbar load lists Supabase projects and selects one", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: TEST_CONFIG });
  const canonicalProject = JSON.parse(serialize(createHouseTemplateGalleryProject()));

  await page.route("http://dbserver:8100/rest/v1/projects**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const select = requestUrl.searchParams.get("select") ?? "";
    if (select === "project_id,title" || (select.includes("project_id") && select.includes("title") && !select.includes("current_json"))) {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify([
          {
            project_id: "fog-harbor-lighthouse",
            title: "안개 항구와 등대의 밤",
          },
          {
            project_id: "star-village",
            title: "별등 마을",
          },
        ]),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify([{ current_json: canonicalProject, current_sha256: "test-sha" }]),
    });
  });

  await page.goto("/?rm2k3Shell=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("toolbar-load").click();
  await expect(page.getByTestId("db-config-modal")).toBeVisible();
  await expect(page.getByTestId("db-config-project-list")).toContainText("안개 항구와 등대의 밤");
  await expect(page.getByTestId("db-config-project-list")).toContainText("별등 마을");
  await page.getByTestId("db-config-project-option").filter({ hasText: "안개 항구와 등대의 밤" }).click();

  await expect(page.getByTestId("db-config-project-id")).toHaveValue("fog-harbor-lighthouse");
  await expect(page.getByTestId("db-config-status-line")).toContainText("프로젝트 선택됨");
  await page.getByTestId("db-config-modal").screenshot({ path: testInfo.outputPath("supabase-project-picker.png") });
});
