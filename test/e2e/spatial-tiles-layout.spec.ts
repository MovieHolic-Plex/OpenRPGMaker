import { expect, test, type Page } from "@playwright/test";

// 맵 → 타일 작업대 레이아웃 회귀 (2026-09-13).
//
// spatial-authoring.spec.ts 는 「컨트롤이 잘리거나 덮이지 않는가」만 본다 — 컨테이너가
// 0px 로 붕괴한 상태도 통과했다. 여기서는 시트·사이드바의 실제 크기를 잰다.
//
// 잠그는 결함(전부 실측으로 확인):
//  1) 모달 폭 <1200px 에서 .spatial-body 가 두 행으로 바뀌며 작업대가 0px 붕괴.
//  2) 「타일 설명」탭에서 시트가 244px 좁은 열, 폼 패널이 1fr 넓은 열로 반전.
//  3) 인스펙터가 영구 숨김인데 <1200px 에서 「속성」토글이 나타나는 죽은 버튼.
//
// 실행: DEV_SERVER_PORT=<포트> npx playwright test test/e2e/spatial-tiles-layout.spec.ts \
//         --workers=1 --trace off

test.use({ trace: "off" });

async function openTilesTab(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto("/?blankProject=1&aiBridge=0");
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  const mapGroup = page.getByTestId("db-tab-group-world");
  await mapGroup.evaluate((node) => node.scrollIntoView({ block: "center" }));
  if ((await mapGroup.getAttribute("aria-expanded")) !== "true") await mapGroup.click();
  const tilesTab = page.getByTestId("db-tab-spatial-tiles");
  await tilesTab.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await tilesTab.click();
  await expect(page.getByTestId("tileset-db-preview")).toBeVisible();
}

test("타일 작업대는 좁은 모달에서도 시트가 살아 있다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await openTilesTab(page);

  // 1) 붕괴 회귀: 스테이지와 시트가 콘텐츠 높이를 가진다 (기존엔 178px/0px).
  const stage = await page.locator(".spatial-stage").boundingBox();
  const preview = await page.getByTestId("tileset-db-preview").boundingBox();
  const editArea = await page.locator(".tileset-db-edit-area").boundingBox();
  expect(stage?.height ?? 0).toBeGreaterThan(300);
  expect(editArea?.height ?? 0).toBeGreaterThan(240);
  expect(preview?.height ?? 0).toBeGreaterThan(200);
  expect(preview?.width ?? 0).toBeGreaterThan(240);

  // 3) 「속성」토글은 인스펙터를 못 여는 죽은 버튼 — 타일 셸에서는 숨는다.
  await expect(page.locator(".spatial-inspector-toggle")).toBeHidden();
});

test("타일 설명 탭에서 시트가 넓은 열을 차지한다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTilesTab(page);

  await page.getByTestId("tileset-section-tab-knowledge").click();
  const previewWrap = page.locator(".tileset-db-preview-wrap");
  await expect(previewWrap).toBeVisible();

  const preview = await previewWrap.boundingBox();
  const sidebar = await page.locator(".tileset-db-edit-sidebar").boundingBox();
  expect(preview).toBeTruthy();
  expect(sidebar).toBeTruthy();
  // 2) 열 반전 회귀: 시트가 사이드바보다 넓고 왼쪽에 있다.
  expect(preview!.width).toBeGreaterThan(sidebar!.width);
  expect(preview!.x).toBeLessThan(sidebar!.x);
});
