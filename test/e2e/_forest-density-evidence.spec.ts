/**
 * 숲 밀도 증거 촬영 — 실제 편집기 캔버스에서 밀도별 결과를 찍는다(진단 스펙, `_` 접두).
 *
 * 실행:
 *   DEV_SERVER_PORT=9841 SHOT_DIR=<절대경로> \
 *   npx playwright test test/e2e/_forest-density-evidence.spec.ts --project=chromium --workers=1
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SHOT_DIR = path.resolve(process.env.SHOT_DIR ?? ".omo/evidence/forest-density");
mkdirSync(SHOT_DIR, { recursive: true });

const AREA = { x: 3, y: 3, w: 24, h: 20 } as const;

type Measured = {
  readonly label: string;
  readonly density: string;
  readonly shot: string;
  readonly summary: string;
  readonly placed: number;
  readonly coverage: number;
  readonly passableBefore: number;
  readonly passableAfter: number;
};

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

function runTool(page: Page, name: string, args: Record<string, unknown>): Promise<unknown> {
  return page.evaluate(({ toolName, toolArgs }: { toolName: string; toolArgs: Record<string, unknown> }) => {
    const run = (window as unknown as {
      __oprnEditorTool?: (name: string, args: Record<string, unknown>) => unknown;
    }).__oprnEditorTool;
    if (!run) throw new Error("window.__oprnEditorTool 미등록");
    return run(toolName, toolArgs);
  }, { toolName: name, toolArgs: args });
}

function passableCount(page: Page, mapId: string): Promise<number | null> {
  return page.evaluate(({ id, rect }: { id: string; rect: typeof AREA }) => {
    const harness = (window as unknown as {
      __oprnRegionTaskHarness?: { passableCount?: (m: string, a: typeof rect) => number | null };
    }).__oprnRegionTaskHarness;
    return harness?.passableCount?.(id, rect) ?? null;
  }, { id: mapId, rect: AREA });
}

function coverage(page: Page, mapId: string): Promise<number> {
  return page.evaluate(({ id, rect }: { id: string; rect: typeof AREA }) => {
    const harness = (window as unknown as {
      __oprnRegionTaskHarness?: { readCell?: (m: string, layer: "upper" | "lower", x: number, y: number) => number | null };
    }).__oprnRegionTaskHarness;
    if (!harness?.readCell) return -1;
    const upperTree = new Set([260, 261, 262, 263, 289]);
    const lowerTree = new Set([290, 291, 292, 293]);
    let treed = 0;
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        const u = harness.readCell(id, "upper", x, y) ?? 0;
        const l = harness.readCell(id, "lower", x, y) ?? 0;
        if (upperTree.has(u) || lowerTree.has(l) || lowerTree.has(u)) treed += 1;
      }
    }
    return treed / (rect.w * rect.h);
  }, { id: mapId, rect: AREA });
}

test("숲 밀도별 편집기 캔버스 증거", async ({ page }) => {
  test.setTimeout(240_000);
  const measured: Measured[] = [];

  const cases = [
    { label: "옛 기본값 재현 (면적/28, 최대 10그루 캡)", density: "legacy", args: { style: "broadleaf-2x2", count: 10, minGap: 3 } },
    { label: "sparse — 드문드문", density: "sparse", args: { style: "mixed", density: "sparse" } },
    { label: "dense — 새 기본값(숲)", density: "dense", args: { style: "mixed", density: "dense" } },
    { label: "impassable — 울창한 숲", density: "impassable", args: { style: "mixed", density: "impassable" } },
  ] as const;

  for (const entry of cases) {
    const mapId = await bootEditor(page);
    const before = (await passableCount(page, mapId)) ?? -1;
    const empty = path.join(SHOT_DIR, `00-empty.png`);
    if (entry === cases[0]) await page.getByTestId("edit-canvas").screenshot({ path: empty });

    const result = await runTool(page, "plant_tree_clusters", { mapId, area: { ...AREA }, ...entry.args }) as {
      summary?: string;
      data?: { placed?: number; density?: string };
    };
    // 다른 체크아웃이 포트를 잡고 있으면 남의 코드를 촬영한다(실측 2026-08-30: 9841 점유 →
    // 밀도 3종이 전부 동일 결과로 찍혔고 요약도 옛 형식이었다). 싱겁게 게이트한다.
    if (entry.density !== "legacy") {
      expect(result.data?.density, "남의 번들을 촬영했다 — dev 서버 포트가 다른 체크아웃에 잡혀 있다").toBe(entry.density);
    }
    await expect.poll(async () => (await coverage(page, mapId)) >= 0, { timeout: 15_000 }).toBe(true);
    const shot = path.join(SHOT_DIR, `${entry.density}.png`);
    await page.getByTestId("edit-canvas").screenshot({ path: shot });

    measured.push({
      label: entry.label,
      density: entry.density,
      shot,
      summary: String(result?.summary ?? ""),
      placed: Number(result?.data?.placed ?? -1),
      coverage: await coverage(page, mapId),
      passableBefore: before,
      passableAfter: (await passableCount(page, mapId)) ?? -1,
    });
  }

  writeFileSync(path.join(SHOT_DIR, "receipt.json"), JSON.stringify({ area: AREA, measured }, null, 2), "utf8");
  const dense = measured.find((m) => m.density === "dense");
  const legacy = measured.find((m) => m.density === "legacy");
  expect(dense!.coverage).toBeGreaterThan(legacy!.coverage);
});
