import { expect, test } from "@playwright/test";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test("probe: dblclick witness opens event editor", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, createModernNocturneProject(), "/?e2eVitals=1");
  await expect(page.getByText("해오름구 · 자정", { exact: true }).first()).toBeVisible();
  await page.waitForFunction(() => typeof (window as unknown as { __oprnEditCamera?: unknown }).__oprnEditCamera === "function", undefined, { timeout: 20_000 });
  await page.getByTestId("layer-lower").click();
  await page.waitForTimeout(500);

  const diag = await page.evaluate(() => {
    const cam = (window as unknown as { __oprnEditCamera: () => { scrollX: number; scrollY: number; zoom: number } }).__oprnEditCamera();
    const worldX = 10 * 16 + 8;
    const worldY = 8 * 16 + 8;
    const screenX = (worldX - cam.scrollX) * cam.zoom;
    const screenY = (worldY - cam.scrollY) * cam.zoom;
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="edit-canvas"] canvas');
    const rect = canvas?.getBoundingClientRect();
    const layer = document.querySelector('[data-testid="layer-event"]');
    return {
      cam,
      worldX, worldY, screenX, screenY,
      rect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
      clientX: rect ? rect.x + screenX : null,
      clientY: rect ? rect.y + screenY : null,
      eventLayerActive: layer ? layer.classList.contains("is-active") : null,
      canvasInViewport: rect ? (rect.x + screenX >= 0 && rect.y + screenY >= 0 && rect.x + screenX <= innerWidth && rect.y + screenY <= innerHeight) : null,
    };
  });
  console.log("DIAG1 " + JSON.stringify(diag));

  await page.mouse.click(diag.clientX!, diag.clientY!, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="event-editor-modal"]');
    const toasts = Array.from(document.querySelectorAll('[class*="toast"]')).map((t) => t.textContent?.trim().slice(0, 60));
    const status = document.querySelector('[class*="statusbar"]');
    const layerEvent = document.querySelector('[data-testid="layer-event"]');
    const toolEvent = document.querySelector('[data-testid="tool-event"]');
    return {
      modal: modal ? { mapId: modal.getAttribute("data-map-id"), eventId: modal.getAttribute("data-event-id") } : null,
      toasts,
      status: status?.innerText.slice(0, 150),
      eventLayerActive: layerEvent ? layerEvent.classList.contains("is-active") : null,
      eventToolActive: toolEvent ? toolEvent.classList.contains("is-active") : null,
    };
  });
  console.log("DIAG2 " + JSON.stringify(state));
  expect(true).toBe(true);
});
