import { test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createTownArchitectureCityProject } from "@/project/defaults/defaultProject";
import { seedProjectForEditor } from "./projectSeed";

declare const process: {
  readonly env: {
    readonly OPRN_EVIDENCE_URL?: string;
  };
};

const EVIDENCE_DIR = "output/evidence/chaotic-city";
const APP_URL = process.env.OPRN_EVIDENCE_URL ?? "/";

test.use({ serviceWorkers: "block" });

test("captures four browser screenshots of the chaotic generated city", async ({ page }) => {
  test.setTimeout(60_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const project = createTownArchitectureCityProject();
  const city = project.maps[project.startMapId];
  if (!city) throw new Error("missing generated city map");
  city.name = "Chaotic generated city";

  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedProjectForEditor(page, project, APP_URL);
  await page.getByTestId(`map-tree-node-${project.startMapId}`).click();

  // Standard keeps dense zoom buttons behind the ⋯ expand gate, and the canvas toolbar
  // re-renders (collapses) on every zoom change — re-open the gate before each click.
  await page.getByTestId("editor-canvas-toolbar-expand").click();
  await page.getByTestId("editor-zoom-1").click();
  await captureAt(page, "01-overview-zoom1.png", { left: 0, top: 0 });

  await page.getByTestId("editor-canvas-toolbar-expand").click();
  await page.getByTestId("editor-zoom-2").click();
  await captureAt(page, "02-northwest-houses.png", { left: 0, top: 0 });
  await captureAt(page, "03-chaotic-center.png", { left: 140, top: 180 });
  await captureAt(page, "04-southern-houses.png", { left: 120, top: 350 });
});

async function captureAt(page: Page, name: string, scroll: { readonly left: number; readonly top: number }): Promise<void> {
  await page.evaluate(`
    const modeUrl = performance.getEntriesByType("resource")
      .map((e) => e.name)
      .find((name) => /\\/src\\/app\\/mode\\.ts(\\?|$)/.test(name)) ?? "/src/app/mode.ts";
    import(modeUrl).then(({ getGame }) => {
    const scene = getGame()?.scene.getScene("EditScene");
    if (!scene) throw new Error("missing EditScene");
      scene.cameras.main.setScroll(${scroll.left}, ${scroll.top});
    })
  `);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await screenshot(page, name);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${name}`, fullPage: true });
}
