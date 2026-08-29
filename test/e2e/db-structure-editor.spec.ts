import { expect, test, type Page } from "@playwright/test";
import { DATABASE_TAB_SPECS, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

// 유닛 테스트(environment:"node" + FakeElement)는 캔버스를 그리지 않고
// getBoundingClientRect 가 전부 0 이라, 실제 클릭 좌표 → 칸 매핑과
// 다운로드·파일 선택 왕복은 브라우저에서만 증명된다.
//
// 실행 주의 1: 케이스마다 앱을 통째로 부팅하므로 `--workers=1` 로 돌려라. 기본 병렬에서는
// 한 dev 서버에 부팅 4개가 겹쳐 다운로드 이벤트·다이얼로그 렌더가 밀려 간헐 실패한다
// (실측 2026-08-29: 병렬 2건 실패 → --workers=1 에서 4건 전부 통과).
//
// 실행 주의 2: 손으로 만든 워크트리에서는 `DEV_SERVER_PORT=<고유 포트>` 를 주고 돌려라.
// playwright.config.ts 의 기본 포트 9173 + reuseExistingServer:true 조합 때문에, 다른
// 워크트리가 9173 을 점유하고 있으면 그 서버를 재사용해 **다른 브랜치 코드를 검증한다**
// (실측 2026-08-29: 이 스펙 3케이스가 옛 도구줄을 보고 전부 실패했다). openwiki/agent-worktrees.md 참조.

const STRUCTURE_KITS_TAB = DATABASE_TAB_SPECS.find((spec) => spec.slug === "structure-kits")!;

async function openStructureTab(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  // toolbar-database (classic toolbar) 는 expert chrome 에서만 노출된다 — 다른 DB e2e
  // 전부(oprn-database.spec.ts, db-desktop-matrix.spec.ts 등)가 같은 이유로 이 줄을 둔다.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 15_000 });
  await openDatabase(page);
  // 사이드바는 아코디언이라 접힌 그룹의 탭은 먼저 펼쳐야 눌린다. 예전에는 그룹 슬러그를
  // "map" 으로 직접 눌렀는데 그런 슬러그가 없어서(실제는 "world") 이 헬퍼가 통째로 죽어
  // 있었고, 그래서 아래 [편집] 잘림 회귀를 아무도 잡지 못했다. 공용 헬퍼는 그룹을 순회해
  // 찾고 탭 버튼의 .active 까지 확인한다 — 헤딩 가시성만 보면 초기화 경합에 밀려
  // activeTab 이 기본값으로 되돌아간 것을 놓친다(실측: 파티 탭으로 되돌아갔다).
  await switchDatabaseTab(page, STRUCTURE_KITS_TAB);
  await expect(page.getByTestId("structure-kit-heading")).toBeVisible();
}

/** 빈 3×3 으로 새 구조물을 만들고 편집기를 연 상태로 둔다. */
async function newBlankKit(page: Page): Promise<void> {
  await page.getByTestId("structure-kit-new").click();
  const blank = page.getByTestId("structure-kit-new-blank");
  const editor = page.getByTestId("structure-kit-editor");
  // combined_town 앨범이면 시작점 선택 창이 먼저 뜬다. count() 를 한 번만 보면 창이 그려지기
  // 전에 0 을 읽고 그냥 지나쳐 편집기가 끝내 안 열린다 — 병렬 부팅으로 앱이 느릴 때 실제로 났다.
  await expect(async () => {
    if ((await blank.count()) > 0) await blank.click();
    await expect(editor).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("데이터베이스 구조물 편집기", () => {
  // 케이스마다 앱을 통째로 부팅한다(?freshProject=1). 워커가 겹치면 기본 30초로는 모자란다.
  test.slow();

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

    // 드래그를 떼면 종류 팝오버가 먼저 뜬다 — 예전에는 종류가 언제나 '입구'로 굳어
    // 창문·간판·자리를 그릴 방법이 아예 없었다. 고르지 않으면 부위도 생기지 않는다.
    await expect(page.getByTestId("structure-kit-part-kind-menu")).toBeVisible();
    await expect(page.getByTestId("structure-kit-editor-parts")).toContainText("부위 (0)");
    await page.getByTestId("structure-kit-part-kind-option-window").click();

    await expect(page.getByTestId("structure-kit-editor-parts")).toContainText("부위 (1)");
    await expect(page.getByTestId("structure-kit-editor-parts")).toContainText("창문");
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

  // 잘림 회귀 방지. locator.click() 은 scrollIntoViewIfNeeded 를 먼저 하므로 사람이 못 누르는
  // 버튼도 눌러 버린다 — 즉 클릭 성공은 증거가 안 된다. 스크롤 없이 그 자리에 실제로 무엇이
  // 있는지(elementFromPoint)와 스크롤 여지가 0인지로 판정한다.
  // 해상도마다 따로 test 를 두면 앱을 세 번 부팅해 기본 30초 타임아웃에 걸린다. 한 번
  // 부팅해서 창 크기만 바꿔가며 잰다 — 삐짐은 앞선 h3+p 높이에서 오므로 해상도와 무관하다.
  test("[편집] 버튼이 해상도와 무관하게 스크롤 없이 눌린다", async ({ page }) => {
    test.slow();
    await openStructureTab(page);
    await newBlankKit(page);
    await page.getByTestId("structure-kit-editor-close").click();
    await expect(page.getByTestId("structure-kit-editor")).toHaveCount(0);

    // .structure-kit-actions 로 좁힌다 — "structure-kit-edit-" 는 접두사가 겹쳐
    // structure-kit-editor·-editor-close·-editor-canvas 까지 전부 잡아 strict 위반이 난다.
    const editBtn = page.locator('.structure-kit-actions [data-testid^="structure-kit-edit-"]');

    let lastCenter = { x: 0, y: 0 };
    for (const [w, h] of [[1366, 768], [1440, 900], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await expect(editBtn).toHaveCount(1);
      await expect(editBtn).toBeVisible();

      const probe = await editBtn.evaluate((btn) => {
        const scroller = btn.closest(".db-body.db-shared-workspace");
        if (!scroller) return null;
        scroller.scrollTop = 0;
        const b = btn.getBoundingClientRect();
        const s = scroller.getBoundingClientRect();
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return {
          overflow: scroller.scrollHeight - scroller.clientHeight,
          spill: Math.round(b.bottom - s.bottom),
          hitsButton: hit === btn || btn.contains(hit),
          hitTag: hit ? `${hit.tagName.toLowerCase()}.${hit.className}` : "(none)",
          center: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
        };
      });

      expect(probe, `${w}×${h}: .db-body.db-shared-workspace 스크롤러를 못 찾았다`).not.toBeNull();
      if (!probe) return;
      // 고치기 전 증상: 삐짐 67px, [편집] y=831 vs 클립 829,
      // elementFromPoint → div.database-footer-status (세 해상도 모두 동일).
      expect(probe.spill, `${w}×${h}: [편집] 이 스크롤 영역 아래로 ${probe.spill}px 삐져나갔다`)
        .toBeLessThanOrEqual(0);
      expect(probe.overflow, `${w}×${h}: 스크롤 여지 ${probe.overflow}px — 뭔가 화면 밖에 있다`).toBe(0);
      expect(probe.hitsButton, `${w}×${h}: 그 좌표에 있는 건 ${probe.hitTag} 였다`).toBe(true);
      lastCenter = probe.center;
    }

    // 좌표 직접 클릭 — locator.click() 의 자동 스크롤을 거치지 않는 진짜 증명.
    await page.mouse.click(lastCenter.x, lastCenter.y);
    await expect(page.getByTestId("structure-kit-editor")).toBeVisible();
  });
});
