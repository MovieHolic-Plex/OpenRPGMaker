import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { screenshotEvidence } from "./eventEditorCertEvidence";
import { createBlankProject } from "@/project/defaults";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = "evidence/browser-screenshots/event-editor-responsive-20260703";
declare const process: { readonly env: { readonly RPG_ZZU_E2E_BASE_URL?: string } };
const APP_URL = process.env.RPG_ZZU_E2E_BASE_URL ?? "";

type Viewport = {
  readonly height: number;
  readonly label: string;
  readonly width: number;
};

const VIEWPORTS: readonly Viewport[] = [
  { label: "desktop", width: 1586, height: 992 },
  { label: "compact", width: 960, height: 900 },
  { label: "narrow", width: 768, height: 900 },
];

test("event editor keeps mockup-like composition across responsive widths", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const captures: Record<string, unknown> = {};
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedProjectFromSupabaseCanonical(page, createBlankProject(), `${APP_URL}/?freshProject=1&classicCapture=2`);
    await ensureEventEditorOpen(page);
    await resetEventEditorScroll(page);
    await screenshotEvidence(page, EVIDENCE_DIR, `${viewport.label}-event-editor.png`);
    captures[viewport.label] = await responsiveMetrics(page);
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
      commandPanelVisible: true,
      footerActionsVisible: true,
    });
  }
});

async function ensureEventEditorOpen(page: Page): Promise<void> {
  const modal = page.getByTestId("event-editor-modal");
  if (await modal.isVisible().catch(() => false)) return;
  await page.getByTestId("layer-event").click();
  const toolEvent = page.getByTestId("tool-event");
  if (await toolEvent.isVisible().catch(() => false)) {
    await toolEvent.click();
  }
  await page.locator(".event-list-row").first().click();
  await page.getByTestId("event-editor-open").click();
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

async function responsiveMetrics(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const roundedRect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const rect = node.getBoundingClientRect();
      return {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
      };
    };
    const hasHorizontalOverflow = (selector: string): boolean => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return false;
      return node.scrollWidth > node.clientWidth + 1;
    };
    const conditionRows = [...document.querySelectorAll(".event-condition-row")].filter(
      (node): node is HTMLElement => node instanceof HTMLElement
    );
    const conditionRowsOverlap = conditionRows.some((row) => {
      const children = [...row.children].filter((node): node is HTMLElement => node instanceof HTMLElement);
      return children.some((child, index) => {
        const next = children[index + 1];
        if (next === undefined) return false;
        const childRect = child.getBoundingClientRect();
        const nextRect = next.getBoundingClientRect();
        return childRect.right > nextRect.left + 1 || childRect.right > row.getBoundingClientRect().right + 1;
      });
    });

    const workbench = roundedRect(".event-editor-workbench");
    const topStrip = roundedRect(".event-editor-top-strip");
    const footerActions = roundedRect(".event-editor-footer-actions");
    const commandToolbar = roundedRect(".event-editor-command-toolbar");
    const commandList = roundedRect(".event-contents-fieldset .cmd-list");
    const textBearingNodes = [
      ...document.querySelectorAll(
        ".event-editor-modal-window span, .event-editor-modal-window legend, .event-editor-modal-window button, .event-editor-modal-window input, .event-editor-modal-window select"
      ),
    ].filter((node): node is HTMLElement => node instanceof HTMLElement);
    const cjkTextClipped = textBearingNodes.some((node) => {
      if (node.offsetParent === null) return false;
      const text = (node.textContent ?? "") + ("value" in node && typeof node.value === "string" ? node.value : "");
      if (!/[가-힣一-龥ぁ-んァ-ヶ]/.test(text)) return false;
      return node.scrollHeight > node.clientHeight + 2;
    });
    return {
      bodyHasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      modalHasHorizontalOverflow: hasHorizontalOverflow(".event-editor-modal-window"),
      topStripOverlapsWorkbench: topStrip !== null && workbench !== null && topStrip.bottom > workbench.top - 1,
      workbenchHasHorizontalOverflow: hasHorizontalOverflow(".event-editor-workbench"),
      workbenchOverlapsFooter: workbench !== null && footerActions !== null && workbench.bottom > footerActions.top - 8,
      conditionRowsOverlap,
      cjkTextClipped,
      commandToolbarOverlapsList: commandToolbar !== null && commandList !== null && commandToolbar.bottom > commandList.top + 2,
      commandPanelVisible: roundedRect(".event-editor-commands-column") !== null,
      footerActionsVisible: footerActions !== null,
      modal: roundedRect(".event-editor-modal-window"),
      topStrip,
      workbench,
      settings: roundedRect(".event-editor-settings-column"),
      commands: roundedRect(".event-editor-commands-column"),
      contents: roundedRect(".event-contents-fieldset"),
      pageProps: roundedRect(".event-page-props"),
      commandToolbar,
      commandList,
      footerActions,
    };
  });
}
