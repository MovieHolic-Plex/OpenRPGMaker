/**
 * 밀집 배치 대조 캡처 — 같은 영역, 같은 재료, 같은 개수. packing 만 다르다.
 *
 * 보고서용 그림을 만든다. 하드 단정은 두지 않는다(수치 단정은 test/densePackingPlacement.test.ts).
 * 실제 에디터 캔버스를 찍으므로 "지나갈 길이 남았다/막혔다"를 눈으로 볼 수 있다.
 *
 * 실행:
 *   DEV_SERVER_PORT=9621 SHOT_DIR=<절대경로> npx playwright test \
 *     test/e2e/dense-packing-capture.spec.ts --project=chromium --workers=1
 */
import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SHOT_DIR = path.resolve(process.env.SHOT_DIR ?? ".omo/evidence/dense-packing/run");
mkdirSync(SHOT_DIR, { recursive: true });

const AREA = { x: 3, y: 3, w: 14, h: 14 } as const;
const COUNT = 400;

async function bootEditor(page: Page): Promise<string> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  return String(await page.evaluate(() => (window as unknown as {
    __oprnRegionTaskHarness?: { currentMapId: () => string };
  }).__oprnRegionTaskHarness?.currentMapId()));
}

function plant(page: Page, mapId: string, packing: "natural" | "dense"): Promise<unknown> {
  return page.evaluate(({ id, mode, area, count }: {
    id: string; mode: string; area: typeof AREA; count: number;
  }) => {
    const run = (window as unknown as {
      __oprnEditorTool?: (name: string, args: Record<string, unknown>) => unknown;
    }).__oprnEditorTool;
    if (!run) throw new Error("window.__oprnEditorTool 미등록");
    return run("place_props", { mapId: id, area, material: "활엽수", count, packing: mode, seed: 11 });
  }, { id: mapId, mode: packing, area: AREA, count: COUNT });
}

function passableCount(page: Page, mapId: string): Promise<number | null> {
  return page.evaluate(({ id, area }: { id: string; area: typeof AREA }) => {
    const harness = (window as unknown as {
      __oprnRegionTaskHarness?: { passableCount?: (m: string, a: typeof area) => number | null };
    }).__oprnRegionTaskHarness;
    return harness?.passableCount?.(id, area) ?? null;
  }, { id: mapId, area: AREA });
}

test.describe("밀집 배치 대조", () => {
  test.describe.configure({ timeout: 300_000 });

  for (const packing of ["natural", "dense"] as const) {
    test(`packing:${packing} — 같은 지시로 심고 남은 통행 칸을 센다`, async ({ page }) => {
      const mapId = await bootEditor(page);
      const before = await passableCount(page, mapId);
      await page.screenshot({ path: path.join(SHOT_DIR, `${packing}-0-before.png`), animations: "disabled" });

      const result = await plant(page, mapId, packing);
      await page.waitForTimeout(800);
      const after = await passableCount(page, mapId);

      writeFileSync(
        path.join(SHOT_DIR, `${packing}-receipt.json`),
        `${JSON.stringify({ packing, area: AREA, count: COUNT, passableBefore: before, passableAfter: after, result }, null, 2)}\n`,
        "utf8",
      );
      await page.screenshot({ path: path.join(SHOT_DIR, `${packing}-1-after.png`), animations: "disabled" });
      // AI 패널이 맵의 왼쪽 1/3 을 덮는다 — 대조 그림에는 맵만 남긴다.
      await page.evaluate(() => {
        const panel = document.querySelector("[data-testid='ai-panel']");
        if (panel instanceof HTMLElement) panel.style.display = "none";
      });
      await page.waitForTimeout(200);
      const canvas = page.getByTestId("edit-canvas");
      await canvas.screenshot({ path: path.join(SHOT_DIR, `${packing}-2-canvas.png`), animations: "disabled" }).catch(() => {});
    });
  }
});
