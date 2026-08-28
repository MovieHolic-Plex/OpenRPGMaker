/**
 * 맵 패널 모던화 — 현행(baseline) 시각 증거 캡처. 진단용 임시 스크립트.
 * 사용: npx tsx scripts/_map-panel-baseline.mts
 * 출력: verify-shots/map-modernize/baseline/*.png
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9977";
const OUT = join(process.cwd(), "verify-shots", "map-modernize", process.argv[2] ?? "scratch");
type Mode = "beginner" | "standard" | "expert";

async function boot(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript((m) => {
    localStorage.setItem("oprn:editor-ui-mode", m as string);
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  }, mode);
  await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
  await page.locator(".left-panel").waitFor({ state: "visible", timeout: 30_000 });
  for (const testid of ["editor-welcome-close", "editor-welcome-dismiss", "coachmark-done", "welcome-start-blank"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(800);
}

type Diag = Record<string, unknown>;

async function run(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const diags: Diag[] = [];
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  for (const mode of ["expert", "standard", "beginner"] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("pageerror", mode, e.message));
    try {
      await boot(page, mode);
    } catch (error) {
      await page.screenshot({ path: join(OUT, `_bootfail-${mode}.png`) });
      console.log("bootfail", mode, (error as Error).message);
      await context.close();
      continue;
    }
    await page.screenshot({ path: join(OUT, `${mode}-shell.png`) });
    const leftPanel = page.locator(".left-panel").first();
    if (await leftPanel.isVisible().catch(() => false)) {
      await leftPanel.screenshot({ path: join(OUT, `${mode}-left-panel.png`) }).catch(() => {});
    }
    const mapRoot = page.locator('[data-testid="left-map-root"]').first();
    if (await mapRoot.isVisible().catch(() => false)) {
      await mapRoot.screenshot({ path: join(OUT, `${mode}-map-root.png`) }).catch(() => {});
    }
    // 기본/표준 모드는 맵이 플라이아웃일 수 있다.
    const railMap = page.getByTestId("basic-rail-toggle-maps");
    if (await railMap.first().isVisible().catch(() => false)) {
      await railMap.first().click().catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT, `${mode}-map-flyout-shell.png`) });
      const flyout = page.locator(".basic-flyout-map-host, .map-tree-panel").first();
      if (await flyout.isVisible().catch(() => false)) {
        await flyout.screenshot({ path: join(OUT, `${mode}-map-flyout.png`) }).catch(() => {});
      }
    }
    const diag = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="left-map-root"]') as HTMLElement | null;
      const panel = document.querySelector('[data-testid="map-tree"]') as HTMLElement | null;
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="map-tree-node-"]'));
      const clipped = rows.filter((r) => {
        const name = r.querySelector<HTMLElement>(".map-tree-name");
        return !!name && name.scrollWidth > name.clientWidth + 1;
      }).length;
      // 헤드라인 결함(초보 플라이아웃 '시작' 배지가 메타 텍스트를 28px 덮던 것)의 수치를
      // 산문이 아니라 커밋된 diag.json 에 남긴다 — test/e2e/map-panel-modern.spec.ts 의
      // readMapPanel()·_map-panel-overlap-probe.mts 와 같은 계산이다. measuredPairs 가
      // 0이면 badgeOverlapsMetaPx: 0 은 "겹치지 않음"이 아니라 "잴 게 없었음"이라는 뜻이다.
      let badgeOverlapsMetaPx = 0;
      let measuredPairs = 0;
      for (const row of rows) {
        const meta = row.querySelector<HTMLElement>(".map-tree-meta");
        const badge = row.querySelector<HTMLElement>(".start-mark");
        if (!meta || !badge) continue;
        measuredPairs += 1;
        const m = meta.getBoundingClientRect();
        const b = badge.getBoundingClientRect();
        const ox = Math.min(m.right, b.right) - Math.max(m.left, b.left);
        const oy = Math.min(m.bottom, b.bottom) - Math.max(m.top, b.top);
        if (ox > 0 && oy > 0) badgeOverlapsMetaPx = Math.max(badgeOverlapsMetaPx, Math.round(ox));
      }
      const rect = root?.getBoundingClientRect();
      return {
        rootPresent: !!root,
        panelPresent: !!panel,
        rootWidth: rect ? Math.round(rect.width) : null,
        rootHeight: rect ? Math.round(rect.height) : null,
        rows: rows.length,
        clippedNames: clipped,
        rowHeight: rows[0] ? Math.round(rows[0].getBoundingClientRect().height) : null,
        overflowX: root ? root.scrollWidth - root.clientWidth : null,
        overflowY: root ? root.scrollHeight - root.clientHeight : null,
        measuredPairs,
        badgeOverlapsMetaPx,
      };
    });
    diags.push({ mode, ...diag });
    console.log(mode, JSON.stringify(diag));
    await context.close();
  }
  writeFileSync(join(OUT, "diag.json"), JSON.stringify(diags, null, 2));
  await browser.close();
}

void run();
