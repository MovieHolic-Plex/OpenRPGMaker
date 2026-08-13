import { expect, test } from "@playwright/test";

const TILESET_ID = "easyrpg_chipset_combined_town";

test("tileset review confirmation persists canonical user metadata", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  const coachSkip = page.getByTestId("coach-mark-skip");
  if (await coachSkip.isVisible()) await coachSkip.click();
  await page.getByTestId("menu-tools").click();
  await page.getByTestId("menu-tools-database").click();
  await page.getByTestId("db-tab-tilesets").click();
  await page.getByTestId("tileset-section-tab-knowledge").click();
  await page.getByTestId("tileset-reaudit").click();
  if (await coachSkip.isVisible()) await coachSkip.click();

  const wizard = page.getByTestId("tileset-review-wizard");
  await expect(wizard).toBeVisible();
  const cardText = await page.getByTestId("tileset-review-queue-card").textContent();
  const tileMatch = cardText?.match(/(\d+)번/);
  const tile = Number(tileMatch?.[1] ?? Number.NaN);
  expect(Number.isInteger(tile)).toBe(true);

  await page.getByTestId("tileset-review-confirm").click();

  await expect.poll(async () => page.getByTestId("project-export-json").evaluate((element, input) => {
    const parsed = JSON.parse(element.textContent ?? "{}");
    const meta = parsed.project?.tilesets?.[input.tilesetId]?.tileMeta?.[input.tile];
    return {
      confidence: meta?.confidence,
      locked: meta?.locked,
      origin: meta?.origin,
      source: meta?.source,
      userLocked: meta?.userLocked,
    };
  }, { tile, tilesetId: TILESET_ID })).toEqual({
    confidence: 1,
    locked: true,
    origin: "user",
    source: "user",
    userLocked: true,
  });

  const contrastRatio = await wizard.evaluate((element) => {
    const style = getComputedStyle(element);
    const channels = (value: string): number[] => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const luminance = (value: string): number => {
      const [red = 0, green = 0, blue = 0] = channels(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
    };
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
  await expect(page.getByTestId("tileset-review-approve-all"))
    .toHaveText(/나머지 모두 승인 \(낮은 신뢰 \d+칸\)/);

  await page.screenshot({ path: testInfo.outputPath("tileset-review-confirmed-1280x800.png") });
});
