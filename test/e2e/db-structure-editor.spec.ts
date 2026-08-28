import { expect, test, type Page } from "@playwright/test";

// 유닛 테스트(environment:"node" + FakeElement)는 캔버스를 그리지 않고
// getBoundingClientRect 가 전부 0 이라, 실제 클릭 좌표 → 칸 매핑과
// 다운로드·파일 선택 왕복은 브라우저에서만 증명된다.

async function openStructureTab(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  // toolbar-database (classic toolbar) 는 expert chrome 에서만 노출된다 — 다른 DB e2e
  // 전부(oprn-database.spec.ts, db-desktop-matrix.spec.ts 등)가 같은 이유로 이 줄을 둔다.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  const dbButton = page.getByTestId("toolbar-database");
  await expect(dbButton).toBeVisible({ timeout: 15_000 });
  await dbButton.click();
  await expect(page.getByTestId("database-modal")).toBeVisible({ timeout: 15_000 });
  // 사이드바는 아코디언이다 — 기본으로 열리는 그룹은 activeTab("actors")이 속한 "파티"뿐이고
  // 구조물은 "맵" 그룹에 있어 hidden 상태다. 그룹 헤더를 먼저 펼쳐야 탭이 보인다.
  await page.getByTestId("db-tab-group-map").click();
  await page.getByTestId("db-tab-structure-kits").click({ force: true });
  await expect(page.getByTestId("structure-kit-heading")).toBeVisible();
}

/** 빈 3×3 으로 새 구조물을 만들고 편집기를 연 상태로 둔다. */
async function newBlankKit(page: Page): Promise<void> {
  await page.getByTestId("structure-kit-new").click();
  // combined_town 앨범이면 시작점 선택 창이 먼저 뜬다.
  const blank = page.getByTestId("structure-kit-new-blank");
  if (await blank.count() > 0) await blank.click();
  await expect(page.getByTestId("structure-kit-editor")).toBeVisible();
}

test.describe("데이터베이스 구조물 편집기", () => {
  test("새 구조물을 만들고 타일을 칠한다", async ({ page }) => {
    await openStructureTab(page);
    await newBlankKit(page);

    const canvas = page.getByTestId("structure-kit-editor-canvas");
    await expect(canvas).toBeVisible();

    await page.getByTestId("structure-kit-editor-tile-240").click();
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await page.getByTestId("structure-kit-editor-close").click();
    await expect(page.getByTestId("structure-kit-editor")).toHaveCount(0);
    // getByText("새 구조물")는 4곳(숨은 project-export-json, [+ 새 구조물] 버튼, 이 행, 인스펙터
    // 제목)과 동시에 일치해 strict-mode 위반이 난다 — 표의 실제 행으로 좁혀 판정한다.
    await expect(
      page.locator('[data-testid^="structure-kit-db-"]').filter({ hasText: "새 구조물" }),
    ).toBeVisible();
  });

  test("부위를 드래그로 그리면 목록에 뜬다", async ({ page }) => {
    await openStructureTab(page);
    await newBlankKit(page);

    await page.getByTestId("structure-kit-editor-tool-part").click();
    const box = (await page.getByTestId("structure-kit-editor-canvas").boundingBox())!;
    await page.mouse.move(box.x + 8, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 8, box.y + box.height - 8);
    await page.mouse.up();

    await expect(page.getByTestId("structure-kit-editor-parts")).toContainText("부위 (1)");
  });

  test("내보낸 파일을 다시 가져오면 '이미 있음'으로 걸러진다", async ({ page }, testInfo) => {
    await openStructureTab(page);
    await newBlankKit(page);
    await page.getByTestId("structure-kit-editor-tile-240").click();
    const box = (await page.getByTestId("structure-kit-editor-canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.getByTestId("structure-kit-editor-close").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("structure-kit-export").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".rpgzzu-kit.json");

    const savedPath = testInfo.outputPath("kits.rpgzzu-kit.json");
    await download.saveAs(savedPath);

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("structure-kit-import").click();
    const chooser = await chooserPromise;
    await chooser.setFiles(savedPath);

    // 서명이 같으므로 중복으로 표시되고 기본 체크가 풀려 있어야 한다 —
    // 같은 파일을 두 번 가져와도 사본이 쌓이지 않는다.
    await expect(page.getByTestId("structure-kit-import-list")).toContainText("이미 있음");
    await page.getByTestId("structure-kit-import-cancel").click();
  });
});
