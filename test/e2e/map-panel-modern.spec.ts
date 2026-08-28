import { expect, test, type Page } from "@playwright/test";

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
  readonly maxBadgeOverlapPx: number;
  readonly clippedTexts: number;
};

async function readMapPanel(page: Page): Promise<PanelReading> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="map-tree-node-"]'));
    let maxBadgeOverlapPx = 0;
    let clippedTexts = 0;
    for (const row of rows) {
      const meta = row.querySelector<HTMLElement>(".map-tree-meta");
      const name = row.querySelector<HTMLElement>(".map-tree-name");
      const badge = row.querySelector<HTMLElement>(".start-mark");
      for (const text of [meta, name]) {
        if (text && text.scrollWidth > text.clientWidth + 1) clippedTexts += 1;
      }
      if (meta && badge) {
        const m = meta.getBoundingClientRect();
        const b = badge.getBoundingClientRect();
        const ox = Math.min(m.right, b.right) - Math.max(m.left, b.left);
        const oy = Math.min(m.bottom, b.bottom) - Math.max(m.top, b.top);
        if (ox > 0 && oy > 0) maxBadgeOverlapPx = Math.max(maxBadgeOverlapPx, Math.round(ox));
      }
    }
    return { rows: rows.length, maxBadgeOverlapPx, clippedTexts };
  });
}

for (const mode of MODES) {
  test.describe(`맵 패널 — ${mode}`, () => {
    test("행에서 '시작' 배지가 메타 텍스트를 덮지 않는다", async ({ page }) => {
      await bootEditor(page, mode);
      const reading = await readMapPanel(page);
      expect(reading.rows).toBeGreaterThan(0);
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
  const HEADER_BUTTONS = ["map-add", "map-add-folder", "map-set-start", "map-toggle-all"] as const;

  test("헤더 버튼 4개가 모두 보이는 글리프를 가진다", async ({ page }) => {
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
