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

async function openSettingsRail(modal: Locator, slug: string): Promise<void> {
  const group = modal.getByTestId(`evt-rail-group-${slug}`);
  const open = await group.evaluate((node) => node.classList.contains("is-open"));
  if (!open) {
    // 넓은 설정 열은 그룹을 display:contents 로 놓아 Playwright 가 헤더를 보이지 않는 것으로 본다.
    await group.locator(".event-editor-settings-accordion-header").evaluate((node: HTMLElement) => {
      node.scrollIntoView({ block: "center", inline: "nearest" });
      node.click();
    });
  }
  await expect(group).toHaveClass(/is-open/);
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
  // 「NPC와 일정」 묶음은 편집기에서 일부러 감춘다(pages-4.css). 보이는 단추 가족이 아니다.

  await openSettingsRail(modal, "move");
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
    modal.getByTestId("evt-page-segment-1"),
    modal.locator("[data-testid^='event-storyboard-card-']").first(),
  ];
  for (const button of shellButtons) {
    await expect(button).toBeVisible();
    await button.click();
    await expectOriginalEditorBackdrop(modal);
  }

  // 푸터 「더보기」 disclosure 는 빠졌다. 도움말은 푸터의 보이는 단추다.
  await modal.getByTestId("event-editor-help").click();
  const help = page.getByTestId("event-editor-help-modal");
  await expectTranslucentScrim(help);
  await page.getByTestId("event-editor-help-close").click();
  await expectOriginalEditorBackdrop(modal);

  const fullscreen = modal.getByTestId("event-editor-window-fullscreen");
  await fullscreen.click();
  // 전체 보기는 같은 backdrop 노드를 유지하고 창을 뷰포트까지 늘린다. 그때 스크림은 불투명 바탕이 된다.
  await expect(modal).toHaveAttribute("data-backdrop-witness", "original");
  await expect(modal).toHaveClass(/is-fullscreen/);
  await expect(fullscreen).toHaveAttribute("aria-pressed", "true");
  const fullscreenGeometry = await modal.evaluate((backdrop) => {
    const windowElement = backdrop.querySelector<HTMLElement>(".event-editor-modal-window");
    const outer = backdrop.getBoundingClientRect();
    const inner = windowElement?.getBoundingClientRect();
    return inner ? {
      coversViewport: inner.width >= outer.width - 16 && inner.height >= outer.height - 16,
      outer: { width: outer.width, height: outer.height },
      inner: { width: inner.width, height: inner.height },
    } : null;
  });
  expect(fullscreenGeometry?.coversViewport, JSON.stringify(fullscreenGeometry)).toBe(true);
  await fullscreen.click();
  await expect(fullscreen).toHaveAttribute("aria-pressed", "false");
  await expectOriginalEditorBackdrop(modal);

  await modal.screenshot({ path: `${EVIDENCE_DIR}/button-family-tour.png` });
  expect(browserIssues).toEqual([]);
});
