import { expect, test, type Page } from "@playwright/test";

/* 이 스펙의 bootEditor 는 에디터 전체 부팅을 기다린다. 이 저장소는 워크트리가 여럿이라
   다른 세션의 vite/playwright 가 동시에 도는 일이 흔하고, 그때 부팅이 기본 30초
   테스트 타임아웃을 넘긴다. 로케이터 대기(90초)가 도달 가능하도록 테스트 타임아웃을
   그 위로 올린다 — 게이트가 부하로 흔들리면 이후 태스크의 회귀 판정이 무의미해진다. */
test.beforeEach(() => {
  test.setTimeout(120_000);
});

type Mode = "expert" | "standard" | "beginner";

/** 초보 모드는 맵이 좌측 레일의 플라이아웃으로 뜬다. 나머지는 좌패널에 상주한다. */
const MODES: readonly Mode[] = ["expert", "standard", "beginner"];

async function bootEditor(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript((m) => {
    localStorage.setItem("oprn:editor-ui-mode", m as string);
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  }, mode);
  await page.goto("/?devProject=1&marketTown=1", { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
  for (const testid of ["editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
  if (mode === "beginner") {
    await page.getByTestId("basic-rail-toggle-maps").click();
  }
  await page.getByTestId("map-tree").waitFor({ state: "visible", timeout: 30_000 });
}

type PanelReading = {
  readonly rows: number;
  /** meta+badge 쌍을 실제로 찾아 겹침을 잰 행 수. `rows > 0` 는 행 존재만 보장할 뿐
   *  `.start-mark`(시작 맵에만 렌더)가 하나라도 있었는지는 보장하지 않는다 — 이
   *  카운터가 0이면 아래 maxBadgeOverlapPx 는 "겹치지 않았다"가 아니라 "잴 게 없었다"는
   *  뜻이므로, 헤드라인 결함(28px 배지 겹침) 게이트는 이 값이 0보다 커야 유효하다. */
  readonly measuredPairs: number;
  readonly maxBadgeOverlapPx: number;
  readonly clippedTexts: number;
};

async function readMapPanel(page: Page): Promise<PanelReading> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="map-tree-node-"]'));
    let maxBadgeOverlapPx = 0;
    let clippedTexts = 0;
    let measuredPairs = 0;
    for (const row of rows) {
      const meta = row.querySelector<HTMLElement>(".map-tree-meta");
      const name = row.querySelector<HTMLElement>(".map-tree-name");
      const badge = row.querySelector<HTMLElement>(".start-mark");
      for (const text of [meta, name]) {
        if (text && text.scrollWidth > text.clientWidth + 1) clippedTexts += 1;
      }
      if (meta && badge) {
        measuredPairs += 1;
        const m = meta.getBoundingClientRect();
        const b = badge.getBoundingClientRect();
        const ox = Math.min(m.right, b.right) - Math.max(m.left, b.left);
        const oy = Math.min(m.bottom, b.bottom) - Math.max(m.top, b.top);
        if (ox > 0 && oy > 0) maxBadgeOverlapPx = Math.max(maxBadgeOverlapPx, Math.round(ox));
      }
    }
    return { rows: rows.length, measuredPairs, maxBadgeOverlapPx, clippedTexts };
  });
}

for (const mode of MODES) {
  test.describe(`맵 패널 — ${mode}`, () => {
    test("행에서 '시작' 배지가 메타 텍스트를 덮지 않는다", async ({ page }) => {
      await bootEditor(page, mode);
      const reading = await readMapPanel(page);
      expect(reading.rows).toBeGreaterThan(0);
      // 이 게이트가 유일한 헤드라인 결함(28px 배지 겹침) 회귀 그물이다 — meta+badge
      // 쌍을 하나도 못 찾으면 maxBadgeOverlapPx 도 0 이라 겹침이 없어서 통과하는 것과
      // 구분이 안 된다. 쌍이 실제로 측정됐음을 먼저 단정한다.
      expect(reading.measuredPairs).toBeGreaterThan(0);
      expect(reading.maxBadgeOverlapPx).toBe(0);
    });

    test("이름과 메타가 자기 칸 안에서 말줄임된다", async ({ page }) => {
      await bootEditor(page, mode);
      const reading = await readMapPanel(page);
      expect(reading.rows).toBeGreaterThan(0);
      expect(reading.clippedTexts).toBe(0);
    });

    test("기존 testid 가 모두 살아 있다", async ({ page }) => {
      await bootEditor(page, mode);
      for (const testid of ["map-tree", "map-tree-list", "map-tree-filter",
        "map-tree-facet-all", "map-tree-facet-empty", "map-tree-facet-nolink",
        "map-tree-facet-encounter"]) {
        await expect(page.getByTestId(testid)).toHaveCount(1);
      }
    });
  });
}

test.describe("맵 패널 헤더 — expert", () => {
  // 필터 토글(map-tree-filter-toggle)이 5번째 버튼이다. 예전엔 이 그물에서
  // 의도적으로 빠져 있었다 — `.oprn-icon-search` 가 컬러 PNG 라 ::before/::after 가
  // 0px 였고, 넣으면 실패했기 때문이다(리뷰 Finding 1). `.oprn-icon-map-search` CSS
  // 도형으로 바꾼 지금은 다섯 버튼 전부 같은 그물로 검증한다.
  const HEADER_BUTTONS = ["map-add", "map-add-folder", "map-set-start", "map-toggle-all", "map-tree-filter-toggle"] as const;

  test("헤더 버튼 5개가 모두 보이는 글리프를 가진다", async ({ page }) => {
    await bootEditor(page, "expert");
    for (const testid of HEADER_BUTTONS) {
      const button = page.getByTestId(testid);
      await expect(button).toBeVisible();
      // 글리프는 `.rm-tool-icon` 의 ::before/::after CSS 도형이다. 정의가 없으면 0px 다.
      const painted = await button.evaluate((el) => {
        const glyph = el.querySelector(".rm-tool-icon") ?? el;
        for (const pseudo of ["::before", "::after"]) {
          const cs = getComputedStyle(glyph, pseudo);
          if (cs.content !== "none" && parseFloat(cs.width) > 0 && parseFloat(cs.height) > 0) return true;
        }
        return false;
      });
      expect(painted, `${testid} 의 글리프가 그려지지 않았다`).toBe(true);
    }
  });
});

test.describe("맵 필터 점진적 노출", () => {
  test("맵이 적으면 접혀 있고, 토글하면 열리며, 패싯이 활성이면 강제로 열린다", async ({ page }) => {
    await bootEditor(page, "expert");
    const filterWrap = page.locator(".map-tree-filter");
    await expect(filterWrap).toBeHidden();

    await page.getByTestId("map-tree-filter-toggle").click();
    await expect(filterWrap).toBeVisible();
    await page.getByTestId("map-tree-filter").fill("시장");
    await expect(page.getByTestId("map-tree-filter")).toHaveValue("시장");

    // 질의를 지우고 패싯만 켜도 접히지 않아야 한다.
    await page.getByTestId("map-tree-filter").fill("");
    await page.getByTestId("map-tree-facet-empty").click();
    // 패싯이 활성인 동안은 토글을 눌러도 상태가 안 바뀌는 죽은 컨트롤이 되므로 아예 사라진다.
    await expect(page.getByTestId("map-tree-filter-toggle")).toBeHidden();
    await expect(filterWrap).toBeVisible(); // 패싯이 활성이라 열려 있다

    // 패싯을 다시 끄면 토글이 돌아오고, 맵이 적으니 다시 접을 수 있다.
    await page.getByTestId("map-tree-facet-all").click();
    await expect(page.getByTestId("map-tree-filter-toggle")).toBeVisible();
    await page.getByTestId("map-tree-filter-toggle").click();
    await expect(filterWrap).toBeHidden();
  });
});
