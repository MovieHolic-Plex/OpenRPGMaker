/* 「이 페이지가 하는 일」 컬럼 UI 진단 촬영. EVIDENCE_TAG=before|after 로 디렉터리를 나눈다.
 * `_` 접두사라 기본 스위트에서 제외된다. */
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { emptyEventProject, mockupProject } from "./mockupProbeSeeds";
import { seedProjectForEditor } from "./projectSeed";
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
  { name: "1024-storyboard", seed: "mockup", width: 1024, height: 800, view: "storyboard" },
  { name: "960-list", seed: "mockup", width: 960, height: 900, view: "list" },
  { name: "960-storyboard", seed: "mockup", width: 960, height: 900, view: "storyboard" },
  { name: "800-list", seed: "mockup", width: 800, height: 900, view: "list" },
  { name: "800-storyboard", seed: "mockup", width: 800, height: 900, view: "storyboard" },
];

test.setTimeout(180_000);

async function columnReport(page: Page): Promise<{
  readonly rows: readonly { readonly horizontalOverflow: number }[];
  readonly storyboardBadges: readonly { readonly horizontalOverflow: number }[];
  readonly [key: string]: unknown;
}> {
  return page.evaluate(() => {
    const box = (node: Element | null): { x: number; y: number; w: number; h: number } | null => {
      if (!(node instanceof HTMLElement)) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const overflow = (node: HTMLElement): number => Math.max(0, Math.round(node.scrollWidth - node.clientWidth));
    const column = document.querySelector<HTMLElement>(".event-editor-commands-column");
    const toolbar = column?.querySelector<HTMLElement>(".event-editor-command-toolbar") ?? null;
    const buttons = toolbar
      ? [...toolbar.querySelectorAll("button, summary")].map((node) => ({
          testid: (node as HTMLElement).dataset.testid ?? "",
          text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
          title: node.getAttribute("title") ?? "",
          ariaLabel: node.getAttribute("aria-label") ?? "",
          box: box(node),
        }))
      : [];
    const list = column?.querySelector<HTMLElement>(".cmd-list") ?? null;
    const rows = [...(list?.querySelectorAll<HTMLElement>(".cmd-item") ?? [])].map((row) => {
      const head = row.querySelector<HTMLElement>(":scope > .cmd-head");
      const summary = head?.querySelector<HTMLElement>(":scope > .cmd-summary") ?? null;
      const kind = summary?.querySelector<HTMLElement>(".cmd-kind") ?? null;
      const face = summary?.querySelector<HTMLElement>("[data-testid='cmd-speaker-face']") ?? null;
      const stepEl = head?.querySelector<HTMLElement>(":scope > .cmd-step") ?? null;
      return {
        testid: row.dataset.testid ?? "",
        path: row.dataset.cmdPath ?? "",
        step: (stepEl?.textContent ?? "").trim(),
        stepAriaHidden: stepEl?.getAttribute("aria-hidden") ?? "",
        text: (row.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
        row: box(row),
        head: box(head ?? null),
        summary: box(summary),
        kind: box(kind),
        face: box(face),
        gridColumns: head ? getComputedStyle(head).gridTemplateColumns : "",
        horizontalOverflow: head ? overflow(head) : 0,
        summaryOverflow: summary ? overflow(summary) : 0,
      };
    });
    const storyboardBadges = [...(column?.querySelectorAll<HTMLElement>(".event-storyboard-card-cat") ?? [])]
      .map((badge) => ({
        label: badge.dataset.label ?? "",
        box: box(badge),
        horizontalOverflow: overflow(badge),
      }));
    return {
      column: box(column ?? null),
      columnHorizontalOverflow: column ? overflow(column) : null,
      label: {
        box: box(column?.querySelector(".event-editor-column-label") ?? null),
        title: column?.querySelector(".event-editor-column-title")?.textContent ?? "",
        hint: column?.querySelector(".event-editor-column-hint")?.textContent ?? "",
        count: column?.querySelector("[data-testid='event-editor-command-count']")?.textContent ?? "",
        countTitle: column?.querySelector("[data-testid='event-editor-command-count']")?.getAttribute("title") ?? "",
      },
      toolbar: { box: box(toolbar), wraps: toolbar ? toolbar.scrollHeight > toolbar.clientHeight + 1 : null, buttons },
      list: box(list),
      listHorizontalOverflow: list ? overflow(list) : null,
      rowCount: rows.length,
      rows,
      storyboardBadges,
      emptyText: (column?.querySelector("[data-testid='event-command-empty-line']")?.textContent ?? "").trim(),
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
    await seedProjectForEditor(page, seed.project);
    await openSeededEventEditor(page, shot.seed === "mockup" ? { x: 8, y: 8 } : { x: 4, y: 4 });
    const modal = page.getByTestId("event-editor-modal");
    // 페이지 세그먼트의 산 testid 는 `evt-page-segment-<n>` 이다 — `event-page-tab-3` 은 `src` 어느
    // 곳에도 없으며(기준 커밋 84bfc655 포함) 그것을 누르는 스펙은 이미 깨진 상태다.
    if (shot.seed === "mockup") await modal.getByTestId("evt-page-segment-3").click();
    if (shot.view) {
      const toggle = modal.getByTestId(`event-view-toggle-${shot.view}`);
      if (await toggle.count()) await toggle.click();
    }
    await expect(modal.locator(".event-editor-commands-column")).toBeVisible();
    const column = modal.locator(".event-editor-commands-column");
    await page.screenshot({ path: `${DIR}/${shot.name}-full.png` });
    await column.screenshot({ path: `${DIR}/${shot.name}-column.png` });
    const report = await columnReport(page);
    await writeFile(
      `${DIR}/${shot.name}.json`,
      `${JSON.stringify({ shot, report, pageErrors }, null, 2)}\n`,
      "utf8",
    );
    if (shot.view === "list" && shot.seed === "mockup") {
      expect(report.rows.length).toBeGreaterThan(0);
      expect(report.rows.map((row) => row.horizontalOverflow)).toEqual(report.rows.map(() => 0));
    }
    if (shot.view === "storyboard") {
      expect(report.storyboardBadges.length).toBeGreaterThan(0);
      expect(report.storyboardBadges.map((badge) => badge.horizontalOverflow)).toEqual(report.storyboardBadges.map(() => 0));
    }
    expect(pageErrors).toEqual([]);
  });
}
