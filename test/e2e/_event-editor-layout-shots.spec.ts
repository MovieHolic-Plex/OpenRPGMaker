/* EVIDENCE_TAG=before|after 가 산출 디렉터리를 나눈다. `_` 접두사는 기본 스위트 제외. */
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { emptyEventProject, mockupProject } from "./mockupProbeSeeds";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { openSeededEventEditor } from "./eventStoryboardPicker";

const TAG = process.env.EVIDENCE_TAG ?? "before";
const DIR = `output/evidence/event-editor-layout/${TAG}`;
const VIEWPORT = { width: 1440, height: 900 } as const;

type Shot = {
  readonly name: string;
  readonly mode: "beginner" | "standard" | "expert";
  readonly seed: "mockup" | "empty";
  readonly pageTab?: string;
};

const SHOTS: readonly Shot[] = [
  { name: "expert-dense-page3", mode: "expert", seed: "mockup", pageTab: "evt-page-segment-3" },
  { name: "expert-page1", mode: "expert", seed: "mockup" },
  { name: "standard-page1", mode: "standard", seed: "mockup" },
  { name: "beginner-page1", mode: "beginner", seed: "mockup" },
  { name: "expert-empty-event", mode: "expert", seed: "empty" },
];

test.setTimeout(150_000);

async function openEventEditorAnyMode(page: Page, eventId: string, tile: { x: number; y: number }): Promise<void> {
  const launcher = page.getByTestId("authoring-task-event");
  if (await launcher.count()) await launcher.click();
  const row = page.getByTestId(`event-list-row-${eventId}`);
  if (await row.count()) {
    await row.click();
    await page.getByTestId("event-editor-open").click();
    await expect(page.getByTestId("event-editor-modal")).toBeVisible();
    return;
  }
  await openSeededEventEditor(page, tile);
}

async function geometry(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const box = (selector: string): unknown => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const r = node.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        overflowX: node.scrollWidth > node.clientWidth + 1,
        overflowY: node.scrollHeight > node.clientHeight + 1,
      };
    };
    const modal = document.querySelector<HTMLElement>(".event-editor-modal-window");
    const controls = modal
      ? modal.querySelectorAll("input, select, textarea, button").length
      : 0;
    const topLevelSettingsBlocks = modal
      ? Array.from(modal.querySelectorAll<HTMLElement>(".event-editor-settings-main > *")).map((node) => ({
          cls: node.className,
          testid: node.dataset.testid ?? "",
          h: Math.round(node.getBoundingClientRect().height),
        }))
      : [];
    return {
      window: box(".event-editor-modal-window"),
      header: box(".event-editor-modal-header"),
      identityCard: box(".event-editor-card"),
      pagebar: box(".event-editor-pagebar"),
      settings: box(".event-editor-settings-column"),
      commands: box(".event-editor-commands-column"),
      inspector: box(".event-editor-inspector-column"),
      footer: box(".event-editor-modal-footer"),
      controlCount: controls,
      topLevelSettingsBlocks,
    };
  });
}

for (const shot of SHOTS) {
  test(`layout shot ${shot.name}`, async ({ page }) => {
    await mkdir(DIR, { recursive: true });
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.addInitScript((mode) => {
      localStorage.setItem("oprn:editor-ui-mode", mode);
    }, shot.mode);
    await page.setViewportSize({ ...VIEWPORT });
    const seed = shot.seed === "mockup" ? mockupProject() : emptyEventProject();
    await seedProjectFromSupabaseCanonical(page, seed.project);
    const eventTile = shot.seed === "mockup" ? { x: 8, y: 8 } : { x: 4, y: 4 };
    await openEventEditorAnyMode(page, seed.eventId, eventTile);
    const modal = page.getByTestId("event-editor-modal");
    if (shot.pageTab) {
      const tab = modal.getByTestId(shot.pageTab);
      if (await tab.count()) await tab.click();
    }
    await expect(modal.locator(".event-editor-commands-column")).toBeVisible();
    await page.waitForFunction(() => {
      const node = document.querySelector(".event-editor-modal-window");
      return node instanceof HTMLElement && node.getBoundingClientRect().height > 100;
    });
    await page.screenshot({ path: `${DIR}/${shot.name}.png` });
    await writeFile(
      `${DIR}/${shot.name}.json`,
      `${JSON.stringify({ shot, viewport: VIEWPORT, geometry: await geometry(page), pageErrors, consoleErrors }, null, 2)}\n`,
      "utf8",
    );
    expect(pageErrors).toEqual([]);
  });
}
