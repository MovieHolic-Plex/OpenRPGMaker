import { expect, test } from "@playwright/test";
import { createModernNocturneProject } from "../../src/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test("capture positionToCamera transform", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectFromSupabaseCanonical(page, createModernNocturneProject(), "/?e2eVitals=1");

  await expect(page.getByText("해오름구 · 자정", { exact: true }).first()).toBeVisible();
  await page.waitForFunction(() => typeof (window as unknown as { __oprnEditCamera?: unknown }).__oprnEditCamera === "function", undefined, { timeout: 20_000 });
  await page.getByTestId("layer-lower").click();
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const phaser = (window as unknown as { Phaser?: unknown }).Phaser as
      | { Input?: { Pointer?: { prototype?: Record<string, unknown> } } }
      | undefined;
    const proto = phaser?.Input?.Pointer?.prototype;
    if (!proto) return;
    const original = proto.positionToCamera as (camera: unknown, output?: unknown) => { x: number; y: number };
    const samples: string[] = [];
    (window as unknown as Record<string, unknown>).__ptc = samples;
    proto.positionToCamera = function patched(camera, output) {
      const p = this as { x: number; y: number };
      const result = original.call(this, camera, output);
      const cam = camera as { scrollX: number; scrollY: number; zoomX: number; zoomY: number; x: number; y: number };
      samples.push(JSON.stringify({ px: Math.round(p.x * 10) / 10, py: Math.round(p.y * 10) / 10, world: [Math.round(result.x * 10) / 10, Math.round(result.y * 10) / 10], cam: [cam.scrollX, cam.scrollY, cam.zoomX, cam.zoomY, cam.x, cam.y] }));
      return result;
    };
  });

  const cam = await page.evaluate(() => {
    const c = (window as unknown as { __oprnEditCamera: () => { scrollX: number; scrollY: number; zoom: number; width: number; height: number } }).__oprnEditCamera();
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="edit-canvas"] canvas');
    const rect = canvas?.getBoundingClientRect();
    return { ...c, rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null };
  });
  console.log("DIAG-CAM", JSON.stringify(cam));

  const positions = [
    [748, 580],
    [748 + 16, 580],
    [748, 580 + 16],
    [200, 200],
    [700, 300],
  ] as const;
  for (const [lx, ly] of positions) {
    await page.mouse.move(cam.rect!.x + lx, cam.rect!.y + ly);
    await page.waitForTimeout(150);
    const pos = await page.getByTestId("cursor-position").textContent().catch(() => null);
    console.log("DIAG-SAMPLE", JSON.stringify({ local: [lx, ly], tile: pos }));
  }
  const samples = await page.evaluate(() => (window as unknown as Record<string, unknown>).__ptc as string[] | undefined);
  console.log("DIAG-PTC", JSON.stringify(samples));
  expect(true).toBe(true);
});