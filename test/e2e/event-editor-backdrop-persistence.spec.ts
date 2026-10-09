import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { mockupProject } from "./mockupProbeSeeds";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectForEditor } from "./projectSeed";

const EVIDENCE_DIR = "output/evidence/event-editor-backdrop-persistence";

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

async function expectTranslucentScrim(overlay: Locator): Promise<void> {
  await expect(overlay).toBeVisible();
  const paint = await overlay.evaluate((node) => {
    const style = getComputedStyle(node);
    const match = style.backgroundColor.match(/rgba?\(([^)]+)\)/);
    const channels = match?.[1]?.split(/[ ,/]+/).filter(Boolean) ?? [];
    const alpha = channels.length >= 4 ? Number(channels[3]) : 1;
    return { alpha, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage };
  });
  expect(paint.backgroundImage, JSON.stringify(paint)).toBe("none");
  expect(paint.alpha, JSON.stringify(paint)).toBeGreaterThan(0);
  expect(paint.alpha, JSON.stringify(paint)).toBeLessThan(1);
}

async function expectOriginalEditorBackdrop(modal: Locator): Promise<void> {
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-backdrop-witness", "original");
  await expectTranslucentScrim(modal);
}

async function closeSubdialog(dialog: Locator): Promise<void> {
  const cancel = dialog.locator(
    "[data-testid='event-command-picker-cancel'], [data-testid='field-monster-template-cancel'], .event-subdialog-close",
  ).first();
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(dialog).toBeHidden();
}

async function assertSubdialogButton(
  modal: Locator,
  opener: Locator,
  page: Page,
  dialogTestId: string,
): Promise<void> {
  await expect(opener).toBeVisible();
  await opener.click();
  const dialog = page.getByTestId(dialogTestId);
  await expectTranslucentScrim(dialog);
  await expectOriginalEditorBackdrop(modal);
  await page.screenshot({ path: `${EVIDENCE_DIR}/${dialogTestId}.png` });
  await closeSubdialog(dialog);
  await expectOriginalEditorBackdrop(modal);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test.setTimeout(120_000);

test("all event-editor button families keep visible background context", async ({ page }) => {
  const browserIssues = installBrowserIssuePolicy(page);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  const { project, eventId } = mockupProject();
  await seedProjectForEditor(page, project);
  await openEventEditor(page, eventId);

  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  await modal.evaluate((node) => { node.dataset.backdropWitness = "original"; });
  await expectOriginalEditorBackdrop(modal);

  // Generated command buttons share this picker/subdialog path; one representative guards the family.
  await assertSubdialogButton(modal, modal.getByTestId("event-command-toolbar-add").first(), page, "event-command-picker");
  await assertSubdialogButton(modal, modal.getByTestId("event-page-graphic-set"), page, "event-graphic-dialog");
  await assertSubdialogButton(modal, modal.getByTestId("event-character-id-connect"), page, "event-character-id-picker");

  const movementSection = modal.getByTestId("event-classic-movement-section");
  await movementSection.locator(":scope > summary").click();
  await modal.getByTestId("event-page-movement-type").selectOption("custom");
  await expectOriginalEditorBackdrop(modal);
  await assertSubdialogButton(modal, modal.getByTestId("event-page-custom-route"), page, "event-page-move-route-dialog");

  const auxTools = modal.getByTestId("event-editor-aux-tools");
  await auxTools.locator(":scope > summary").click();
  await expectOriginalEditorBackdrop(modal);
  await assertSubdialogButton(modal, modal.getByTestId("event-command-toolbar-field-monster"), page, "field-monster-template-dialog");

  // Native disclosure/toggle/page/inspector/help buttons must not replace the root backdrop.
  const shellButtons = [
    modal.getByTestId("event-view-toggle-list"),
    modal.getByTestId("event-view-toggle-storyboard"),
    modal.locator("[data-testid^='event-page-tab-']").first(),
    modal.locator("[data-testid^='event-storyboard-card-']").first(),
  ];
  for (const button of shellButtons) {
    await expect(button).toBeVisible();
    await button.click();
    await expectOriginalEditorBackdrop(modal);
  }

  const footerMore = modal.locator(".event-editor-footer-more");
  await footerMore.locator(":scope > summary").click();
  await expectOriginalEditorBackdrop(modal);
  await modal.getByTestId("event-editor-help").click();
  const help = page.getByTestId("event-editor-help-modal");
  await expectTranslucentScrim(help);
  await page.getByTestId("event-editor-help-dismiss").click();
  await expectOriginalEditorBackdrop(modal);

  const fullscreen = modal.getByTestId("event-editor-window-fullscreen");
  await fullscreen.click();
  await expectOriginalEditorBackdrop(modal);
  const fullscreenGeometry = await modal.evaluate((backdrop) => {
    const windowElement = backdrop.querySelector<HTMLElement>(".event-editor-modal-window");
    const outer = backdrop.getBoundingClientRect();
    const inner = windowElement?.getBoundingClientRect();
    return inner ? {
      visibleScrimEdge: inner.left > outer.left || inner.top > outer.top || inner.right < outer.right || inner.bottom < outer.bottom,
      outer: { left: outer.left, top: outer.top, right: outer.right, bottom: outer.bottom },
      inner: { left: inner.left, top: inner.top, right: inner.right, bottom: inner.bottom },
    } : null;
  });
  expect(fullscreenGeometry?.visibleScrimEdge, JSON.stringify(fullscreenGeometry)).toBe(true);
  await fullscreen.click();
  await expectOriginalEditorBackdrop(modal);

  await modal.screenshot({ path: `${EVIDENCE_DIR}/button-family-tour.png` });
  expect(browserIssues).toEqual([]);
});
