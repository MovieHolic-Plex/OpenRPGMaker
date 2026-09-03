import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { EventPage, Project } from "@/project/types";
import { debugState, writeEvidenceJson } from "./eventEditorCertEvidence";
import { expandEventMovementSection } from "./eventEditorExpandHelpers";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = "evidence/browser-screenshots/event-editor-controls-1-3-5-6";
const TEAM_ARTIFACTS_DIR = ".omo/teams/team-15e46b80/artifacts";
declare const process: { readonly env: { readonly RPG_ZZU_E2E_BASE_URL?: string } };
const APP_URL = process.env.RPG_ZZU_E2E_BASE_URL ?? "";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-controls-1-3-5-6");
  });
});

test("event editor controls 1,3,5,6 work from the browser surface", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await mkdir(TEAM_ARTIFACTS_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 820 });
  await seedProjectFromSupabaseCanonical(page, createBlankProject(), `${APP_URL}/?freshProject=1`);

  const editor = await openEventEditor(page);
  const ids = await openEditorIds(editor);

  const commands = editor.getByTestId("event-command-text");
  const initialCommandCount = await commands.count();
  expect(initialCommandCount).toBeGreaterThan(0);
  const command = commands.first();
  await command.locator(".cmd-head").click();

  await editor.getByTestId("event-command-toolbar-copy").click();
  await command.locator(".cmd-head").click({ button: "right" });
  await expect(page.getByTestId("event-command-menu-paste")).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("event-command-context-menu")).toHaveCount(0);

  await editor.getByTestId("event-command-toolbar-cut").click();
  await expect(editor.getByTestId("event-command-text")).toHaveCount(initialCommandCount - 1);
  await editor.getByTestId("event-command-toolbar-undo").click();
  await expect(editor.getByTestId("event-command-text")).toHaveCount(initialCommandCount);
  await editor.getByTestId("event-command-toolbar-redo").click();
  await expect(editor.getByTestId("event-command-text")).toHaveCount(initialCommandCount - 1);
  await editor.getByTestId("event-command-toolbar-undo").click();
  await expect(editor.getByTestId("event-command-text")).toHaveCount(initialCommandCount);

  await expandEventMovementSection(editor);

  const overlapForbidden = editor.getByTestId("event-page-overlap-forbidden");
  await expect(overlapForbidden).toBeEnabled();
  await expect(overlapForbidden).toBeChecked();
  await overlapForbidden.uncheck();

  await editor.getByTestId("event-page-movement-type").selectOption("custom");
  await editor.getByTestId("event-page-custom-route").click();
  const routeDialog = page.getByTestId("event-page-move-route-dialog");
  await expect(routeDialog).toBeVisible();

  const skippable = routeDialog.getByTestId("event-page-move-route-skippable");
  await expect(skippable).toBeEnabled();
  await skippable.check();

  await routeDialog.getByTestId("event-page-move-route-help").click();
  await expect(routeDialog.getByTestId("event-page-move-route-help-panel")).toBeVisible();

  await page.screenshot({ path: `${EVIDENCE_DIR}/controls-1-3-5-6-editor-proof.png`, fullPage: true });
  await routeDialog.getByTestId("event-page-move-route-ok").click();
  await expect(routeDialog).toBeHidden();
  await editor.getByTestId("event-editor-apply").click();

  const savedPage = await authoredPage(page, ids);
  expect(savedPage?.overlapForbidden).toBe(false);
  expect(savedPage?.movement.route?.skippable).toBe(true);

  // 2026-09-03: 클래식 툴바의 「이벤트 테스트」 버튼은 사라졌다. 이 이벤트만 실행하는 집은 편집기 머리의
  // 「테스트」(event-editor-test)와 이벤트 우클릭 메뉴의 「이 이벤트 테스트」다.
  await editor.getByTestId("event-editor-test").click();
  const testWindow = page.getByTestId("test-play-window");
  await expect(testWindow).toBeVisible();
  await expect(page.getByTestId("test-play-window-title")).toContainText("이벤트 테스트");
  await expect(page.getByTestId("dialogue-box")).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE_DIR}/control-2-selected-event-test-proof.png`, fullPage: true });
  await page.getByTestId("test-play-window-close").click();
  await expect(testWindow).toBeHidden();
  await editor.getByTestId("event-editor-ok").click();
  await expect(editor).toBeHidden();

  const report = {
    controls: {
      "1": "command toolbar copy, cut, undo, and redo worked on a selected command",
      "2": "the editor's own 테스트 button opened an isolated test-play window and ran the selected event",
      "3": "overlapForbidden checkbox was enabled and persisted false",
      "5": "move-route skippable checkbox was enabled and persisted true",
      "6": "move-route Help opened an in-dialog help panel without closing the route editor",
    },
    screenshots: [
      `${EVIDENCE_DIR}/controls-1-3-5-6-editor-proof.png`,
      `${EVIDENCE_DIR}/control-2-selected-event-test-proof.png`,
    ],
  };
  await writeEvidenceJson(EVIDENCE_DIR, "controls-1-3-5-6-report.json", report);
  await writeFile(`${TEAM_ARTIFACTS_DIR}/event-editor-controls-1-3-5-6-proof.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
});

async function openEventEditor(page: Page): Promise<Locator> {
  await page.getByTestId("layer-event").click();
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();

  await page.locator(".event-list-row").first().click();
  await page.getByTestId("event-editor-open").click();

  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  return editor;
}

async function openEditorIds(editor: Locator): Promise<{ readonly mapId: string; readonly eventId: string }> {
  return await editor.evaluate((node) => ({
    mapId: node.dataset.mapId ?? "",
    eventId: node.dataset.eventId ?? "",
  }));
}

async function authoredPage(page: Page, ids: { readonly mapId: string; readonly eventId: string }): Promise<EventPage | undefined> {
  const state = await debugState(page);
  return pageForProject(state.project, ids);
}

function pageForProject(project: Project, ids: { readonly mapId: string; readonly eventId: string }): EventPage | undefined {
  return project.maps[ids.mapId]?.events.find((event) => event.id === ids.eventId)?.pages?.[0];
}
