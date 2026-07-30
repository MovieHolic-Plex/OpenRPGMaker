/**
 * 생성된 증거 리포트 HTML 이 브라우저에서 실제로 렌더되는지 확인한다.
 * (인라인 base64 이미지가 깨지면 리포트는 그냥 텍스트 문서다 — 그걸 잡는다.)
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const REPORT = path.resolve("docs/2026-07-30-ai-three-map-rpg-evidence.html");

test("증거 리포트 HTML 이 렌더되고 모든 이미지가 로드된다", async ({ page }) => {
  expect(existsSync(REPORT), `먼저 리포트를 생성해라: ${REPORT}`).toBe(true);
  await page.goto(`file:///${REPORT.replace(/\\/g, "/")}`);

  await expect(page.locator("h1")).toContainText("맵 3개 RPG");

  const images = page.locator("figure.shot img");
  const count = await images.count();
  expect(count, "증거 이미지가 최소 5장이어야 한다").toBeGreaterThanOrEqual(5);

  // 모든 <img> 가 실제로 디코드됐는지 (naturalWidth > 0) 확인한다.
  const broken = await page.evaluate(() =>
    Array.from(document.querySelectorAll("figure.shot img"))
      .filter((img) => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0)
      .map((img) => (img as HTMLImageElement).alt),
  );
  expect(broken, `깨진 이미지: ${broken.join(", ")}`).toEqual([]);

  // 표가 비어 있지 않은지 (맵 3행 + 전이 4행)
  const rows = await page.locator("table tbody tr").count();
  expect(rows, "표에 데이터가 있어야 한다").toBeGreaterThanOrEqual(7);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "docs/ai-three-map-rpg-assets/00-report-rendered.png", fullPage: false });
});
