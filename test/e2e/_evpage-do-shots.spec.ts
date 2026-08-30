/* 「이 페이지가 하는 일」 컬럼 UI 진단 촬영. EVIDENCE_TAG=before|after 로 디렉터리를 나눈다.
 * `_` 접두사라 기본 스위트에서 제외된다. */
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { emptyEventProject, mockupProject } from "./mockupProbeSeeds";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { openSeededEventEditor } from "./eventStoryboardPicker";

const TAG = process.env.EVIDENCE_TAG ?? "before";
const DIR = `output/evidence/event-do-column/${TAG}`;

type Shot = {
  readonly name: string;
  readonly seed: "mockup" | "empty";
  readonly width: number;
  readonly height: number;
  readonly view?: "list" | "storyboard" | "preview";
};

const SHOTS: readonly Shot[] = [
  { name: "1440-list", seed: "mockup", width: 1440, height: 900, view: "list" },
  { name: "1440-storyboard", seed: "mockup", width: 1440, height: 900, view: "storyboard" },
  { name: "1440-empty", seed: "empty", width: 1440, height: 900, view: "list" },
  { name: "1024-list", seed: "mockup", width: 1024, height: 800, view: "list" },
];

test.setTimeout(180_000);

async function columnReport(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const box = (node: Element | null): unknown => {
      if (!(node instanceof HTMLElement)) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const column = document.querySelector<HTMLElement>(".event-editor-commands-column");
    const toolbar = column?.querySelector<HTMLElement>(".event-editor-command-toolbar") ?? null;
    const buttons = toolbar
      ? [...toolbar.querySelectorAll("button, summary")].map((el) => ({
          testid: (el as HTMLElement).dataset.testid ?? "",
          text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
          title: el.getAttribute("title") ?? "",
          ariaLabel: el.getAttribute("aria-label") ?? "",
          box: box(el),
        }))
      : [];
    const rows = [...(column?.querySelectorAll<HTMLElement>("[data-testid^='event-command-row']") ?? [])].map((el) => ({
      testid: el.dataset.testid ?? "",
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    }));
    return {
      column: box(column ?? null),
      label: {
        box: box(column?.querySelector(".event-editor-column-label") ?? null),
        title: column?.querySelector(".event-editor-column-title")?.textContent ?? "",
        hint: column?.querySelector(".event-editor-column-hint")?.textContent ?? "",
        count: column?.querySelector("[data-testid='event-editor-command-count']")?.textContent ?? "",
      },
      toolbar: { box: box(toolbar), wraps: toolbar ? toolbar.scrollHeight > toolbar.clientHeight + 1 : null, buttons },
      list: box(column?.querySelector("[data-testid='event-command-list']") ?? null),
      rowCount: rows.length,
      rows: rows.slice(0, 20),
      emptyText: (column?.querySelector("[data-testid='event-command-empty']")?.textContent ?? "").trim(),
    };
  });
}

for (const shot of SHOTS) {
  test(`do-column ${shot.name}`, async ({ page }) => {
    await mkdir(DIR, { recursive: true });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.addInitScript(() => {
      localStorage.setItem("oprn:editor-ui-mode", "expert");
    });
    await page.setViewportSize({ width: shot.width, height: shot.height });
    const seed = shot.seed === "mockup" ? mockupProject() : emptyEventProject();
    await seedProjectFromSupabaseCanonical(page, seed.project);
    await openSeededEventEditor(page, shot.seed === "mockup" ? { x: 8, y: 8 } : { x: 4, y: 4 });
    const modal = page.getByTestId("event-editor-modal");
    if (shot.view) {
      const toggle = modal.getByTestId(`event-view-toggle-${shot.view}`);
      if (await toggle.count()) await toggle.click();
    }
    await expect(modal.locator(".event-editor-commands-column")).toBeVisible();
    const column = modal.locator(".event-editor-commands-column");
    await page.screenshot({ path: `${DIR}/${shot.name}-full.png` });
    await column.screenshot({ path: `${DIR}/${shot.name}-column.png` });
    await writeFile(
      `${DIR}/${shot.name}.json`,
      `${JSON.stringify({ shot, report: await columnReport(page), pageErrors }, null, 2)}\n`,
      "utf8",
    );
    expect(pageErrors).toEqual([]);
  });
}
