import { expect, test, type Page } from "@playwright/test";

// todo 16 최종 데스크톱 매트릭스 증거 — 1024×768 / 1280×800 / 1440×900 에서
// DB 모달의 핵심 흐름(오픈 → 사이드바 그룹 이동 → 갤러리 → 필터 칩 → 아이템 슬라이더 편집
// → 시스템 타입칩 매트릭스 → overview 대시보드 → 도크 토글)을 한 번에 돌리고,
// 뷰포트마다 콘솔이 깨끗한지(허용된 127.0.0.1:17831 브리지 거부만 예외) 단언한다.
// 스크린샷은 .superpowers/sdd/qa-shots/dbmodern-<viewport>-<step>.png 관례를 따른다.

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const SHOT_DIR = ".superpowers/sdd/qa-shots";

const ALLOWED_CONSOLE_ERROR = "Failed to load resource: net::ERR_CONNECTION_REFUSED";

function watchConsole(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // 127.0.0.1:17831 은 로컬 codex 앱서버 브리지 — 개발 중 거부 로그는 허용한다.
    if (msg.text() === ALLOWED_CONSOLE_ERROR) return;
    consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  return consoleErrors;
}

for (const { width, height } of VIEWPORTS) {
  const vp = `${width}x${height}`;

  test(`desktop matrix ${vp}: core DB flow console-clean with evidence shots`, async ({ page }) => {
    test.setTimeout(120_000);
    test.slow();
    const consoleErrors = watchConsole(page);

    await page.setViewportSize({ width, height });
    // DB 툴바(toolbar-database)는 expert chrome 에서만 노출된다.
    await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
    // 뷰포트당 하드 리로드 — 세션/로컬스토리지 스테일 상태를 배제한다.
    await page.goto("/?freshProject=1");

    const shot = (step: string) =>
      page.getByTestId("database-modal").screenshot({ path: `${SHOT_DIR}/dbmodern-${vp}-${step}.png` });

    // ── 1. 모달 오픈 + 라이트 팔레트 스코프 ──
    await page.getByTestId("toolbar-database").click();
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await expect(page.locator(".database-modal-window")).toBeVisible();
    await shot("01-open");

    // ── 2. 사이드바 그룹 내비 ──
    const groupLabels = await page.locator(".db-tab-group").allTextContents();
    expect(groupLabels).toEqual(["파티", "몬스터", "전투 규칙", "생활", "세계", "시스템"]);
    await expect(page.getByTestId("db-tab-overview")).toBeVisible();
    await expect(page.getByTestId("db-tab-items")).toBeVisible();
    // 1024px 바닥 계약: 모달 창 가로 스크롤 없음.
    const noHScroll = await page.evaluate(() => {
      const modal = document.querySelector(".database-modal-window");
      if (!(modal instanceof HTMLElement)) return false;
      return modal.scrollWidth <= modal.clientWidth + 1;
    });
    expect(noHScroll, "database-modal-window must not overflow horizontally").toBe(true);
    await shot("02-sidebar");

    // ── 3. 갤러리 뷰 (items 는 기본 갤러리) ──
    await page.getByTestId("db-tab-items").click();
    await expect(page.getByTestId("db-view-toggle-gallery")).toBeVisible();
    const galleryCards = page.locator("[data-testid^='db-record-card-']");
    await expect(galleryCards.first()).toBeVisible();
    const cardCount = await galleryCards.count();
    expect(cardCount).toBeGreaterThan(0);
    await shot("03-gallery");

    // ── 4. 카테고리 필터 칩 ──
    const medicineChip = page.getByTestId("db-filter-chip-medicine");
    await expect(medicineChip).toBeVisible();
    await medicineChip.click();
    await expect(medicineChip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("db-filter-chip-all")).toHaveAttribute("aria-pressed", "false");
    const filteredCount = await galleryCards.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(cardCount);
    // 필터 상태는 갤러리 카드의 카테고리 태그와 일치해야 한다(약 아이템만 보인다).
    const tags = await page.locator(".db-gallery-card .db-gallery-tag").allTextContents();
    expect(tags.length).toBe(filteredCount);
    expect(tags.every((tag) => tag === "약")).toBe(true);
    await shot("04-filter");
    // 전체로 복귀 — 세션 필터가 다음 단계에 영향을 주지 않게 한다.
    await page.getByTestId("db-filter-chip-all").click();
    await expect(page.getByTestId("db-filter-chip-all")).toHaveAttribute("aria-pressed", "true");

    // ── 5. 아이템 편집 (슬라이더+스테퍼) ──
    await galleryCards.first().click();
    await expect(page.getByTestId("db-detail-form")).toBeVisible();
    const typeSelect = page.getByTestId("db-field-item-type");
    await expect(typeSelect).toBeVisible();
    if ((await typeSelect.inputValue()) !== "medicine") await typeSelect.selectOption("medicine");
    const hpStepper = page.getByTestId("db-field-item-hp-percent-stepper");
    await expect(hpStepper).toBeVisible();
    await hpStepper.fill("35");
    await expect(page.getByTestId("db-field-item-hp-percent-slider")).toHaveValue("35");
    await shot("05-item-edit");

    // ── 6. 시스템 타입칩 매트릭스 ──
    await page.getByTestId("db-tab-system").click();
    await expect(page.getByTestId("db-system-section-nav")).toBeVisible();
    await page.getByTestId("db-system-nav-typechart").click();
    await page.getByTestId("db-field-system-type-chart-types").fill("fire, water");
    await page.getByTestId("db-field-system-type-chart-types").blur();
    await expect(page.getByTestId("db-type-chart-matrix")).toBeVisible();
    const fireWaterChip = page.getByTestId("db-type-chart-fire-water");
    await expect(fireWaterChip).toBeVisible();
    const initialValue = await fireWaterChip.getAttribute("data-value");
    expect(initialValue).not.toBeNull();
    await fireWaterChip.click();
    await expect(fireWaterChip).not.toHaveAttribute("data-value", initialValue ?? "");
    await shot("06-typechart");

    // ── 7. overview 대시보드 (idle 이후 차트 등장) ──
    await page.getByTestId("db-tab-overview").click();
    await expect(page.getByTestId("db-overview-stat-items")).toBeVisible();
    // 곡선/산점도는 requestIdleCallback(폴백 200ms) 뒤 주입된다 — 요소 가시성만 대기한다.
    await expect(page.getByTestId("db-overview-curve")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("db-overview-scatter")).toBeVisible({ timeout: 10_000 });
    await shot("07-overview");

    // ── 8. 도크 토글 (사이드바 → 아이콘 레일) ──
    await page.getByTestId("database-dock-toggle").click();
    await expect(page.locator(".database-modal-backdrop.is-docked")).toBeVisible();
    const sidebarWidth = await page.locator(".db-tabs").evaluate((node) => node.getBoundingClientRect().width);
    expect(sidebarWidth, "docked sidebar must collapse to an icon rail").toBeLessThanOrEqual(60);
    await shot("08-dock");

    // ── 콘솔 클린 ──
    expect(consoleErrors, `unexpected console errors at ${vp}: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
}
