import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

type ImageProbe = {
  readonly width: number;
  readonly height: number;
  readonly cornerAlpha: readonly number[];
  readonly visibleAlphaCount: number;
};

const BATTLE_ASSETS = [
  { path: "/assets/generated/rm2k3/hero-01-battle.png", width: 144, height: 384 },
  { path: "/assets/generated/rm2k3/hero-02-battle.png", width: 144, height: 384 },
  { path: "/assets/generated/rm2k3/hero-03-battle.png", width: 144, height: 384 },
  { path: "/assets/generated/rm2k3/hero-04-battle.png", width: 144, height: 384 },
  { path: "/assets/generated/rm2k3/monster-slime-01.png", width: 96, height: 96 },
  { path: "/assets/generated/rm2k3/sylph-hornet-transparent.png", width: 64, height: 64 },
  { path: "/assets/generated/rm2k3/troop-preview-slime.png", width: 96, height: 96 },
] as const;

test("generated battle assets load with magenta-keyed transparent corners", async ({ page }) => {
  await page.goto("/");

  for (const asset of BATTLE_ASSETS) {
    const probe = await imageProbe(page, asset.path);
    expect(probe.width).toBe(asset.width);
    expect(probe.height).toBe(asset.height);
    expect(probe.cornerAlpha.every((alpha) => alpha === 0)).toBe(true);
    expect(probe.visibleAlphaCount).toBeGreaterThan(0);
  }
});

test("generated hero and slime assets render inside the battle scene", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedGeneratedBattleProject(page);
  await page.click('[data-testid="mode-play"]');
  await startNewGameFromTitle(page);
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 2_000 });
  await page.click('[data-testid="event-battle-start"]');

  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("battle-backdrop")).toHaveAttribute("data-backdrop-resource-id", "easyrpg-backdrop-sky1");
  await expect(page.getByTestId("battle-actor-actor_hero")).toHaveAttribute(
    "data-battle-charset-resource-id",
    "generated-actor-hero-01-battle"
  );
  await expect(page.getByTestId("battle-actor-sprite-generated-actor-hero-01-battle")).toBeVisible();
  await expect(page.getByTestId("enemy-1")).toHaveAttribute("data-monster-resource-id", "generated-enemy-slime-01");
  await expect(page.getByTestId("actor-command-attack")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("generated-battle-scene.png"), fullPage: true });
});

async function imageProbe(page: Page, path: string): Promise<ImageProbe> {
  return page.evaluate(async (assetPath) => {
    const image = document.createElement("img");
    image.src = assetPath;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2D canvas context is unavailable");
    context.drawImage(image, 0, 0);

    const cornerPixels = [
      context.getImageData(0, 0, 1, 1).data,
      context.getImageData(image.naturalWidth - 1, 0, 1, 1).data,
      context.getImageData(0, image.naturalHeight - 1, 1, 1).data,
      context.getImageData(image.naturalWidth - 1, image.naturalHeight - 1, 1, 1).data,
    ];
    const pixels = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight).data;
    let visibleAlphaCount = 0;
    for (let offset = 3; offset < pixels.length; offset += 4) {
      if ((pixels[offset] ?? 0) > 0) visibleAlphaCount += 1;
    }

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      cornerAlpha: cornerPixels.map((pixel) => pixel[3] ?? 0),
      visibleAlphaCount,
    };
  }, path);
}

async function seedGeneratedBattleProject(page: Page): Promise<void> {
  const fixture = await readFile("test/fixtures/projects/battle-v3.json", "utf8");
  const generatedFixture = fixture
    .replaceAll('"battleCharacterResourceId": "hero"', '"battleCharacterResourceId": "generated-actor-hero-01-battle"')
    .replaceAll('"monsterResourceId": "slime"', '"monsterResourceId": "generated-enemy-slime-01"')
    .replaceAll('"battleSystemResourceId": "tex_tiles_default"', '"battleSystemResourceId": "easyrpg-backdrop-sky1"')
    .replaceAll('"previewBackgroundResourceId": "tex_tiles_default"', '"previewBackgroundResourceId": "easyrpg-backdrop-sky1"');
  await seedProjectFromSupabaseCanonical(page, deserialize(generatedFixture));
}
