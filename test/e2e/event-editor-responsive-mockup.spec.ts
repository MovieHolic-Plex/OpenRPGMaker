import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { screenshotEvidence } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = ".omo/evidence/ui-ux-adversarial-fixes/task-5-event-layout";
declare const process: { readonly env: { readonly OPRN_E2E_BASE_URL?: string } };
const APP_URL = process.env.OPRN_E2E_BASE_URL ?? "";

type Viewport = {
  readonly height: number;
  readonly label: string;
  readonly width: number;
};

const VIEWPORTS: readonly Viewport[] = [
  { label: "1586x992", width: 1586, height: 992 },
  { label: "1280x900", width: 1280, height: 900 },
  { label: "1024x768", width: 1024, height: 768 },
  { label: "960x900", width: 960, height: 900 },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "basic"));
});

test("event editor keeps a non-overlapping desktop flow at every supported viewport", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const browserIssues = installBrowserIssuePolicy(page);
  const captures: Record<string, unknown> = {};

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedProjectFromSupabaseCanonical(page, createBlankProject(), `${APP_URL}/?freshProject=1&classicCapture=2`);
    await ensureEventEditorOpen(page);
    await page.getByTestId("event-view-toggle-list").click();
    await resetEventEditorScroll(page);
    await screenshotEvidence(page, EVIDENCE_DIR, `${viewport.label}-open.png`);

    const nameInput = page.getByTestId("event-page-name-input");
    await nameInput.focus();
    await screenshotEvidence(page, EVIDENCE_DIR, `${viewport.label}-focus.png`);
    await nameInput.fill(`레이아웃 점검 ${viewport.label}`);
    await verifyKeyboardResizers(page);
    await screenshotEvidence(page, EVIDENCE_DIR, `${viewport.label}-edited.png`);
    captures[viewport.label] = await responsiveMetrics(page);

    await page.getByTestId("event-editor-cancel").click();
    await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
    await screenshotEvidence(page, EVIDENCE_DIR, `${viewport.label}-cancelled.png`);
  }

  await writeFile(`${EVIDENCE_DIR}/responsive-layout-metrics.json`, `${JSON.stringify(captures, null, 2)}\n`, "utf8");
  for (const [label, metrics] of Object.entries(captures)) {
    expect(metrics, label).toMatchObject({
      bodyHasHorizontalOverflow: false,
      modalHasHorizontalOverflow: false,
      topStripOverlapsWorkbench: false,
      workbenchHasHorizontalOverflow: false,
      workbenchOverlapsFooter: false,
      conditionRowsOverlap: false,
      cjkTextClipped: false,
      commandToolbarOverlapsList: false,
      commandContentClippedAtTop: false,
      commandPanelVisible: true,
      footerActionsVisible: true,
      modalResizeHandleVisible: true,
      splitResizeHandleVisible: true,
    });
  }
  expect(browserIssues).toEqual([]);
});

test("opening the event editor suppresses an active coachmark", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const browserIssues = installBrowserIssuePolicy(page);
  await page.addInitScript(() => localStorage.removeItem("oprn:coachmarks-basic-v1"));
  await seedProjectFromSupabaseCanonical(page, createBlankProject(), `${APP_URL}/?freshProject=1&classicCapture=2`);
  const restoredEditor = page.getByTestId("event-editor-modal");
  if (await restoredEditor.count()) {
    await page.getByTestId("event-editor-cancel").click();
    await expect(restoredEditor).toHaveCount(0);
  }
  await expect(page.locator(".coach-mark-card")).toBeVisible();
  await ensureEventEditorOpen(page);
  await expect(page.locator(".coach-mark-card")).toBeHidden();

  const intersects = await page.evaluate(() => {
    const coach = document.querySelector(".coach-mark-card");
    const modal = document.querySelector(".event-editor-modal-window");
    if (!(coach instanceof HTMLElement) || !(modal instanceof HTMLElement)) return false;
    const a = coach.getBoundingClientRect();
    const b = modal.getBoundingClientRect();
    return a.width > 0 && a.height > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
  expect(intersects).toBe(false);
  await screenshotEvidence(page, EVIDENCE_DIR, "coachmark-suppressed-open.png");
  expect(browserIssues).toEqual([]);
});

function installBrowserIssuePolicy(page: Page): string[] {
  const issues: string[] = [];
  page.on("console", (message) => {
    const optionalBridgeRefusal = message.text() === "Failed to load resource: net::ERR_CONNECTION_REFUSED";
    if (message.type() === "error" && !optionalBridgeRefusal) issues.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "unknown";
    if (!request.url().includes("127.0.0.1:17831") && reason !== "net::ERR_ABORTED") {
      issues.push(`requestfailed: ${request.url()} ${reason}`);
    }
  });
  return issues;
}

async function ensureEventEditorOpen(page: Page): Promise<void> {
  const modal = page.getByTestId("event-editor-modal");
  const restoredEditorVisible = await modal.waitFor({ state: "visible", timeout: 750 }).then(
    () => true,
    () => false,
  );
  if (restoredEditorVisible) {
    return;
  }
  await page.getByTestId("layer-event").click();
  const toolEvent = page.getByTestId("tool-event");
  if (await toolEvent.isVisible().catch(() => false)) await toolEvent.click();
  const eventRows = page.locator(".event-list-row");
  if (await eventRows.count()) {
    await eventRows.first().click();
    await page.getByTestId("event-editor-open").click();
  } else {
    const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("missing event canvas geometry");
    await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  }
  await expect(modal).toBeVisible();
}

async function resetEventEditorScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    const modal = document.querySelector("[data-testid='event-editor-modal']");
    const nodes = modal instanceof HTMLElement ? [modal, ...modal.querySelectorAll("*")] : [];
    for (const node of nodes) {
      if (node instanceof HTMLElement) {
        node.scrollLeft = 0;
        node.scrollTop = 0;
      }
    }
  });
  await page.waitForTimeout(50);
}

async function verifyKeyboardResizers(page: Page): Promise<void> {
  const settings = page.locator(".event-editor-settings-column");
  const modal = page.locator(".event-editor-modal-window");
  const initialSettings = await settings.boundingBox();
  const initialModal = await modal.boundingBox();
  if (initialSettings === null || initialModal === null) throw new Error("missing event editor resize geometry");

  const split = page.getByTestId("event-editor-column-resizer");
  await split.focus();
  await split.press("ArrowRight");
  const resizedSettings = await settings.boundingBox();
  expect(resizedSettings?.width).toBeGreaterThan(initialSettings.width);

  const windowHandle = page.getByTestId("event-editor-modal-resize-handle");
  await windowHandle.focus();
  await windowHandle.press("ArrowLeft");
  const resizedModal = await modal.boundingBox();
  expect(resizedModal?.width).toBeLessThan(initialModal.width);

  await page.getByTestId("event-page-name-input").press("End");
  expect((await settings.boundingBox())?.width).toBeCloseTo(resizedSettings?.width ?? 0, 0);
  expect((await modal.boundingBox())?.width).toBeCloseTo(resizedModal?.width ?? 0, 0);
}

async function responsiveMetrics(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const roundedRect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const rect = node.getBoundingClientRect();
      return {
        bottom: Math.round(rect.bottom), height: Math.round(rect.height), left: Math.round(rect.left),
        right: Math.round(rect.right), top: Math.round(rect.top), width: Math.round(rect.width),
      };
    };
    const hasHorizontalOverflow = (selector: string): boolean => {
      const node = document.querySelector(selector);
      return node instanceof HTMLElement && node.scrollWidth > node.clientWidth + 1;
    };
    const overlaps = (a: DOMRect, b: DOMRect): boolean =>
      a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const conditionRowsOverlap = [...document.querySelectorAll(".event-condition-row")].some((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const children = [...node.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
      return children.some((child, index) => {
        const next = children[index + 1];
        return next !== undefined && overlaps(child.getBoundingClientRect(), next.getBoundingClientRect());
      });
    });

    const workbench = roundedRect(".event-editor-workbench");
    const topStrip = roundedRect(".event-editor-top-strip");
    const footerActions = roundedRect(".event-editor-footer-actions");
    const commandToolbar = roundedRect(".event-editor-command-toolbar");
    const commandList = roundedRect(".event-contents-fieldset .cmd-list");
    const commandListFirstChild = roundedRect(".event-contents-fieldset .cmd-list > :first-child");
    const viewToggle = roundedRect(".event-contents-fieldset > .event-view-toggle");
    const cjkClippedElements = [...document.querySelectorAll(
      ".event-editor-modal-window span, .event-editor-modal-window legend, .event-editor-modal-window button, .event-editor-modal-window input, .event-editor-modal-window select"
    )].flatMap((node) => {
      if (!(node instanceof HTMLElement) || node.offsetParent === null) return [];
      const value = "value" in node && typeof node.value === "string" ? node.value : "";
      const text = `${node.textContent ?? ""}${value}`.trim();
      if (!/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(text)) return [];
      if (node.scrollHeight <= node.clientHeight + 2 && node.scrollWidth <= node.clientWidth + 2) return [];
      return [{
        testId: node.dataset.testid ?? null, className: node.className, text,
        clientHeight: node.clientHeight, scrollHeight: node.scrollHeight,
        clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
      }];
    });

    return {
      bodyHasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      modalHasHorizontalOverflow: hasHorizontalOverflow(".event-editor-modal-window"),
      topStripOverlapsWorkbench: topStrip !== null && workbench !== null && topStrip.bottom > workbench.top - 1,
      workbenchHasHorizontalOverflow: hasHorizontalOverflow(".event-editor-workbench"),
      workbenchOverlapsFooter: workbench !== null && footerActions !== null && workbench.bottom > footerActions.top + 1,
      conditionRowsOverlap,
      cjkTextClipped: cjkClippedElements.length > 0,
      cjkClippedElements,
      commandToolbarOverlapsList:
        (commandToolbar !== null && commandList !== null && commandList.width > 0 && commandToolbar.bottom > commandList.top + 2) ||
        (commandToolbar !== null && viewToggle !== null && commandToolbar.left < viewToggle.right && commandToolbar.right > viewToggle.left && commandToolbar.top < viewToggle.bottom && commandToolbar.bottom > viewToggle.top),
      commandContentClippedAtTop:
        commandList !== null && commandListFirstChild !== null && commandListFirstChild.top < commandList.top - 1,
      commandPanelVisible: roundedRect(".event-editor-commands-column") !== null,
      footerActionsVisible: footerActions !== null,
      modalResizeHandleVisible: roundedRect("[data-testid='event-editor-modal-resize-handle']") !== null,
      splitResizeHandleVisible: roundedRect("[data-testid='event-editor-column-resizer']") !== null,
      modal: roundedRect(".event-editor-modal-window"), topStrip, workbench,
      settings: roundedRect(".event-editor-settings-column"), commands: roundedRect(".event-editor-commands-column"),
      contents: roundedRect(".event-contents-fieldset"), pageProps: roundedRect(".event-page-props"),
      commandToolbar, commandList, commandListFirstChild, viewToggle, footerActions,
    };
  });
}
