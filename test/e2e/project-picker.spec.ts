import { expect, test } from "@playwright/test";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { serialize } from "@/project/io";

const STORAGE_KEY = "oprn:legacyDb-project-config";
const TEST_CONFIG = {
  anonKey: "test-anon-key",
  projectId: "initial-project",
  source: "custom",
  url: "http://dbserver:8100",
} as const;

test("toolbar load shows beginner project cards and opens the selected work", async ({ page }, testInfo) => {
  // Given: an editor with online storage already configured on this device.
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: TEST_CONFIG });
  const canonicalProject = JSON.parse(serialize(createHouseTemplateGalleryProject()));
  let showEmptyList = false;

  await page.route(/http:\/\/dbserver:8100\/rest\/v1\/(?:maps|tilesets)/u, (route) =>
    route.fulfill({ contentType: "application/json", status: 200, body: "[]" })
  );
  await page.route("http://dbserver:8100/rest/v1/projects**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const select = requestUrl.searchParams.get("select") ?? "";
    if (select === "project_id,title" || (select.includes("project_id") && select.includes("title") && !select.includes("current_json"))) {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify(showEmptyList ? [] : [
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

  // When: the user opens the work picker from the Project menu.
  await page.goto("/?rm2k3Shell=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  const skipGuide = page.getByRole("button", { name: "건너뛰기" });
  if (await skipGuide.isVisible()) await skipGuide.click();
  await page.getByTestId("menu-project").click();
  await page.getByTestId("menu-project-load").click();

  // Then: work cards and a new-work action lead the flow; technical credentials do not exist in the UI.
  await expect(page.getByTestId("db-config-modal")).toBeVisible();
  await expect(page.getByTestId("db-config-title")).toContainText("작업 열기");
  await expect(page.getByTestId("db-config-create-project")).toBeVisible();
  await expect(page.getByTestId("db-config-advanced")).toHaveCount(0);
  await expect(page.getByTestId("db-config-url")).toHaveCount(0);
  await expect(page.getByTestId("db-config-anon-key")).toHaveCount(0);
  await expect(page.getByTestId("db-config-project-id")).toHaveCount(0);
  await expect(page.getByTestId("db-config-project-list")).toContainText("안개 항구와 등대의 밤");
  await expect(page.getByTestId("db-config-project-list")).toContainText("별등 마을");
  await page.getByTestId("db-config-modal").screenshot({ path: testInfo.outputPath("work-picker.png") });
  await page.setViewportSize({ width: 600, height: 800 });
  const compactColumns = await page.getByTestId("db-config-project-list").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(/\s+/u).filter(Boolean).length
  );
  expect(compactColumns).toBe(1);
  showEmptyList = true;
  await page.getByTestId("db-config-load-projects").click();
  await expect(page.getByTestId("db-config-project-list")).toContainText("새 작업 만들기");
  await page.getByTestId("db-config-modal").screenshot({ path: testInfo.outputPath("work-picker-empty.png") });
  showEmptyList = false;
  await page.getByTestId("db-config-load-projects").click();
  await expect(page.getByTestId("db-config-project-list")).toContainText("안개 항구와 등대의 밤");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId("db-config-project-option").filter({ hasText: "안개 항구와 등대의 밤" }).click();
  await expect(page.getByTestId("db-config-modal")).toBeHidden();
  await expect(page).toHaveURL(/project=fog-harbor-lighthouse/u);
});

test("first boot asks for a work choice without exposing connection jargon", async ({ page }, testInfo) => {
  // Given: saved connection information whose initial work no longer exists.
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: TEST_CONFIG });
  const canonicalProject = JSON.parse(serialize(createHouseTemplateGalleryProject()));
  await page.route(/http:\/\/dbserver:8100\/rest\/v1\/(?:maps|tilesets)/u, (route) =>
    route.fulfill({ contentType: "application/json", status: 200, body: "[]" })
  );
  const requestedProjectIds: string[] = [];
  await page.route("http://dbserver:8100/rest/v1/projects**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const select = requestUrl.searchParams.get("select") ?? "";
    if (select.includes("current_json")) {
      const projectId = requestUrl.searchParams.get("project_id") ?? "";
      requestedProjectIds.push(projectId);
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: projectId === "eq.fog-harbor-lighthouse"
          ? JSON.stringify([{ current_json: canonicalProject, current_sha256: "test-sha" }])
          : "[]",
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify([{ project_id: "fog-harbor-lighthouse", title: "안개 항구와 등대의 밤" }]),
    });
  });

  // When: the editor reaches its first required screen.
  await page.goto("/?rm2k3Shell=1");

  // Then: the user sees work choices, while server and key fields are never rendered.
  await expect(page.getByTestId("db-required-panel")).toBeVisible();
  await expect(page.getByTestId("db-config-modal")).toBeVisible();
  await expect(page.getByTestId("db-config-project-list")).toContainText("안개 항구와 등대의 밤");
  await expect(page.getByTestId("db-config-create-project")).toBeVisible();
  await expect(page.getByTestId("db-config-url")).toHaveCount(0);
  await expect(page.getByTestId("db-config-anon-key")).toHaveCount(0);
  await page.getByTestId("db-config-modal").screenshot({ path: testInfo.outputPath("first-work-choice.png") });
  await page.getByTestId("db-config-project-option").click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("db-config-modal")).toBeHidden();
  expect(requestedProjectIds).toEqual(["eq.initial-project", "eq.fog-harbor-lighthouse"]);
});
