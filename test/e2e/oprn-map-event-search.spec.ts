import { expect, test } from "@playwright/test";

test("map/event search opens as a Korean RM2K3-style search dialog", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&mapEventSearchDialog=1");

  await page.getByTestId("toolbar-search").click();

  const dialog = page.getByTestId("map-event-search-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "검색" })).toBeVisible();
  await expect(dialog.getByTestId("map-event-search-keyword")).toContainText("검색 키워드");
  await expect(dialog.getByTestId("map-event-search-range")).toContainText("검색 범위");
  await expect(dialog.getByLabel("변수")).toBeChecked();
  await expect(dialog.getByLabel("스위치")).toBeVisible();
  await expect(dialog.getByLabel("이벤트 이름")).toBeVisible();
  await expect(dialog.getByLabel("선택한 맵")).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "공통 이벤트", exact: true })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "전체 맵 + 공통 이벤트", exact: true })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "변수" })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("tab", { name: "스위치" })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "이벤트 이름" })).toBeVisible();
  await expect(dialog.getByTestId("map-event-search-results")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "검색" })).toBeVisible();
  await expect(dialog.getByTestId("map-event-search-close")).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("map-event-search-dialog.png"), fullPage: true });
});

test("map/event search controls keep the results pane stable for an empty search", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&mapEventSearchEmpty=1");

  await page.getByTestId("toolbar-search").click();
  const dialog = page.getByTestId("map-event-search-modal");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("스위치").check();
  await expect(dialog.getByRole("tab", { name: "스위치" })).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("tab", { name: "스위치" }).click();
  await dialog.getByRole("radio", { name: "전체 맵 + 공통 이벤트", exact: true }).check();
  await dialog.getByTestId("map-event-search-switch-input").fill("");
  await dialog.getByRole("button", { name: "검색" }).click();

  const results = dialog.getByTestId("map-event-search-results");
  await expect(results).toContainText("검색어를 입력하거나 조건을 선택한 뒤 검색하세요.");
  await expect.poll(async () => results.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);

  await page.screenshot({ path: testInfo.outputPath("map-event-search-empty.png"), fullPage: true });
});

test("map/event search resets state and picker buttons select a live record", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&mapEventSearchPicker=1");

  await page.getByTestId("toolbar-search").click();
  let dialog = page.getByTestId("map-event-search-modal");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("스위치").check();
  await expect(dialog.getByRole("tab", { name: "스위치" })).toHaveAttribute("aria-selected", "true");
  await dialog.getByTestId("map-event-search-switch-picker").click();
  await expect(dialog.getByTestId("map-event-search-switch-input")).not.toHaveValue("");
  await dialog.getByTestId("map-event-search-close").click();
  await expect(dialog).toHaveCount(0);

  await page.getByTestId("toolbar-search").click();
  dialog = page.getByTestId("map-event-search-modal");
  await expect(dialog.getByLabel("변수")).toBeChecked();
  await expect(dialog.getByLabel("선택한 맵")).toBeChecked();
  await expect(dialog.getByRole("tab", { name: "변수" })).toHaveAttribute("aria-selected", "true");
});
