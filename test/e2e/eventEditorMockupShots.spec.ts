import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { emptyEventProject, mockupProject } from "./mockupProbeSeeds";
import { dispatchChange, openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const DIR = "output/evidence/event-editor-balanced";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test.setTimeout(120_000);

async function openMockupState(page: Page, viewport = { width: 1536, height: 1024 }): Promise<Locator> {
  await page.setViewportSize(viewport);
  const { project, eventId } = mockupProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  await modal.getByTestId("event-page-tab-3").click();
  await expect(modal.getByTestId("event-storyboard")).toBeVisible();
  return modal;
}

async function rect(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`missing layout box for ${locator}`);
  return box;
}

test("event editor matches the approved mockup", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  const modal = await openMockupState(page);

  const firstCommand = modal.locator(".event-storyboard-card").first();
  await firstCommand.click();
  const inspector = modal.getByTestId("event-editor-inspector");
  await expect(inspector).toBeVisible();
  await expect(inspector.getByTestId("event-inspector-title")).toContainText("드디어 돌아왔군");
  await expect(inspector.getByTestId("event-inspector-preview-restart")).toBeVisible();
  await expect(inspector.getByTestId("event-inspector-preview-current")).toBeVisible();
  await expect(inspector.getByTestId("event-inspector-close")).toBeVisible();
  await inspector.getByTestId("event-inspector-preview-current").click();
  await expect(inspector.locator("textarea, input:not([type='hidden']), select").first()).toBeFocused();

  const nested = modal.locator(".event-storyboard-branch-command").filter({ hasText: "고맙네" });
  await nested.click();
  await expect(inspector.getByTestId("event-inspector-title")).toContainText("고맙네");
  await inspector.getByTestId("event-inspector-density-toggle").click();
  await expect(inspector.getByTestId("event-inspector-card")).toBeVisible();
  await inspector.getByTestId("event-inspector-preview-current").click();
  await expect(inspector.getByTestId("event-inspector-body")).toBeVisible();
  await expect(inspector.locator("textarea, input:not([type='hidden']), select").first()).toBeFocused();
  await inspector.getByTestId("event-inspector-close").click();
  await expect(nested).toBeFocused();
  await nested.click();

  await modal.getByTestId("event-command-quick-ai").click();
  await expect(modal.getByTestId("event-editor-aux-tools")).toHaveAttribute("open", "");
  await expect(modal.getByTestId("ai-event-assist")).toHaveAttribute("open", "");
  await expect(modal.getByTestId("ai-event-assist")).toBeVisible();
  await modal.getByTestId("event-command-quick-preview").click();
  await expect(modal.getByTestId("event-script-live-preview")).toHaveAttribute("open", "");
  await expect(modal.getByTestId("event-script-live-preview")).toBeVisible();
  await modal.getByTestId("event-command-quick-flow").click();
  await expect(modal.getByTestId("event-script-flowchart")).toHaveAttribute("open", "");
  await expect(modal.getByTestId("event-script-flowchart")).toBeVisible();
  await modal.getByTestId("event-editor-aux-tools").evaluate((details) => { (details as HTMLDetailsElement).open = false; });
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("영구 ID: 0001");
    expect(dialog.message()).toContain("연결된 NPC: north-gate-guard");
    await dialog.accept();
  });
  await modal.getByTestId("event-editor-event-info").click();

  const header = await rect(modal.getByTestId("event-editor-titlebar"));
  const identity = await rect(modal.getByTestId("event-editor-card"));
  const pages = await rect(modal.locator(".event-editor-pagebar"));
  const settings = await rect(modal.locator(".event-editor-settings-column"));
  const commands = await rect(modal.locator(".event-editor-commands-column"));
  const inspectorBox = await rect(inspector);
  const footer = await rect(modal.locator(".event-editor-modal-footer"));
  expect(header.height).toBeCloseTo(54, 0);
  expect(identity.height).toBeCloseTo(89, 0);
  expect(pages.height).toBeCloseTo(102, 0);
  expect(settings.width).toBeCloseTo(350, 0);
  expect(inspectorBox.width).toBeCloseTo(383, 0);
  expect(commands.width).toBeGreaterThan(700);
  expect(footer.height).toBeCloseTo(55, 0);

  await expect(modal.getByTestId("event-page-copy")).toBeVisible();
  await expect(modal.getByTestId("event-page-delete")).toBeVisible();
  await expect(modal.getByTestId("event-editor-header-save-state")).toHaveAttribute("data-remote-state", "disabled");
  await modal.getByTestId("event-editor-header-more").click();
  await expect(modal.getByTestId("event-editor-header-help")).toBeVisible();
  await expect(modal.getByTestId("event-editor-header-delete")).toBeVisible();
  await modal.getByTestId("event-editor-header-more").click();

  const validation = modal.getByTestId("event-draft-validation");
  await expect(validation).toBeVisible();
  await validation.getByTestId("event-draft-validation-summary").click();
  await expect(validation.locator('[data-testid^="event-draft-validation-issue-"]')).toHaveCount(1);
  await expect(validation).toContainText("보이지 않는 페이지가 캐릭터와 같은 높이에서 이동을 막습니다");

  const evidence = {
    viewport: { width: 1536, height: 1024 },
    bands: { header, identity, pages, footer },
    tracks: { settings, commands, inspector: inspectorBox },
    saveState: await modal.getByTestId("event-editor-header-save-state").innerText(),
    validationIssues: await validation.locator('[data-testid^="event-draft-validation-issue-"]').allInnerTexts(),
  };
  await writeFile(`${DIR}/final-layout.json`, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await modal.screenshot({ path: `${DIR}/actual-approved-final.png` });
});

test("page actions are immediate and destructive deletion is cancelable", async ({ page }) => {
  const modal = await openMockupState(page);
  const tabs = modal.locator(".event-page-tab-rich");
  const before = await tabs.count();

  await modal.getByTestId("event-page-copy").click();
  await expect(modal.getByTestId("event-page-paste")).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("페이지와 그 안의 모든 명령을 삭제할까요?");
    await dialog.dismiss();
  });
  await modal.getByTestId("event-page-delete").click();
  await expect(tabs).toHaveCount(before);

  const actionBoxes = await Promise.all(
    ["event-page-copy", "event-page-paste", "event-page-delete"].map(async (id) => rect(modal.getByTestId(id))),
  );
  const modalBox = await rect(modal);
  for (const box of actionBoxes) expect(box.x + box.width).toBeLessThanOrEqual(modalBox.x + modalBox.width);
  const addBox = await rect(modal.getByTestId("event-page-tab-add"));
  const commandHeaderBox = await rect(modal.getByTestId("event-command-header"));
  expect(addBox.x + addBox.width).toBeLessThanOrEqual(commandHeaderBox.x);
  await modal.getByTestId("event-page-tab-add").click();
  await expect(modal.getByTestId("event-page-tab-4")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await modal.getByTestId("event-page-delete").click();
  await expect(modal.getByTestId("event-page-tab-4")).toHaveCount(0);
  await expect(modal.getByTestId("event-page-tab-3")).toBeVisible();
});

test("header test and save actions route to the real workflow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { project, eventId } = emptyEventProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");

  const name = modal.getByTestId("event-page-name-input");
  await name.fill("헤더 저장 검증");
  await dispatchChange(name);
  await expect(modal.getByTestId("event-editor-draft-status")).toHaveText("변경 있음");
  await modal.locator(".event-editor-header-save").click();
  await expect(modal.getByTestId("event-editor-draft-status")).toHaveText("반영됨");

  await modal.locator(".event-editor-header-test").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await page.getByTestId("test-play-window-close").click();
  await expect(page.getByTestId("test-play-window")).toHaveCount(0);
});

test("required viewport matrix keeps controls reachable and resizer operable", async ({ browser }) => {
  test.setTimeout(300_000);
  await mkdir(DIR, { recursive: true });
  const viewports = [
    { width: 1586, height: 992 },
    { width: 1280, height: 900 },
    { width: 1024, height: 768 },
    { width: 960, height: 900 },
  ] as const;
  const evidence: unknown[] = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
    const page = await context.newPage();
    const modal = await openMockupState(page, viewport);
    await modal.locator(".event-storyboard-card").first().click();
    await expect(modal.getByTestId("event-editor-inspector")).toBeVisible();
    await expect(modal.getByTestId("event-inspector-title")).toBeVisible();
    await expect(modal.getByTestId("event-inspector-preview-current")).toBeVisible();
    const handle = modal.locator(".event-editor-column-resizer");
    await handle.focus();
    const before = Number(await handle.getAttribute("aria-valuenow"));
    await handle.press("ArrowRight");
    await expect(handle).not.toHaveAttribute("aria-valuenow", String(before));

    await modal.getByTestId("event-page-tab-add").scrollIntoViewIfNeeded();
    await expect(modal.getByTestId("event-page-tab-add")).toBeVisible();
    await expect(modal.getByTestId("event-page-copy")).toBeVisible();
    await expect(modal.getByTestId("event-page-delete")).toBeVisible();
    await expect(modal.getByTestId("event-editor-window-fullscreen")).toBeVisible();
    await expect(modal.getByTestId("event-editor-modal-close")).toBeVisible();
    const identityBounds = await Promise.all(
      ["event-page-name-input", "event-editor-event-id", "event-position-x", "event-character-id-picker-open", "event-editor-event-info"]
        .map(async (id) => rect(modal.getByTestId(id))),
    );
    const identityBand = await rect(modal.getByTestId("event-editor-card"));
    for (const box of identityBounds) {
      expect(box.x).toBeGreaterThanOrEqual(identityBand.x);
      expect(box.x + box.width).toBeLessThanOrEqual(identityBand.x + identityBand.width);
    }

    if (viewport.width <= 1180) {
      await modal.getByTestId("event-inspector-close").click();
      await expect(modal.getByTestId("event-editor-inspector")).toBeHidden();
      await modal.locator(".event-storyboard-card").first().click();
      await expect(modal.getByTestId("event-editor-inspector")).toBeVisible();
    }

    const pageTabs = modal.getByTestId("event-classic-page-tabs");
    await expect(pageTabs).toBeVisible();
    await pageTabs.evaluate((strip) => { strip.scrollLeft = 0; });

    const metrics = await modal.evaluate((root) => {
      const body = root.querySelector<HTMLElement>(".event-editor-modal-body");
      const pagebar = root.querySelector<HTMLElement>(".event-editor-pagebar");
      const workbench = root.querySelector<HTMLElement>(".event-editor-workbench");
      if (!body || !pagebar || !workbench) throw new Error("missing editor layout surface");
      const p = pagebar.getBoundingClientRect();
      const w = workbench.getBoundingClientRect();
      return {
        bodyOverflowX: body.scrollWidth - body.clientWidth,
        pagebarBottom: p.bottom,
        workbenchTop: w.top,
        documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(metrics.bodyOverflowX).toBeLessThanOrEqual(1);
    expect(metrics.documentOverflowX).toBeLessThanOrEqual(1);
    expect(metrics.workbenchTop).toBeGreaterThanOrEqual(metrics.pagebarBottom - 1);
    evidence.push({ viewport, resizeBefore: before, resizeAfter: Number(await handle.getAttribute("aria-valuenow")), metrics });
    await modal.screenshot({ path: `${DIR}/viewport-${viewport.width}x${viewport.height}.png` });
    await context.close();
  }

  await writeFile(`${DIR}/viewport-matrix.json`, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
});
