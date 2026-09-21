import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { mockupProject } from "./mockupProbeSeeds";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectForEditor } from "./projectSeed";

const DIR = process.env.SHOT_DIR ?? "output/evidence/npc-schedule";

test.setTimeout(120_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("capture NPC and schedule rail group", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1536, height: 1024 });
  const { project, eventId } = mockupProject();
  await seedProjectForEditor(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  const group = modal.getByTestId("evt-rail-group-npc");
  await expect(group).toBeVisible();
  await group.locator(".event-editor-settings-accordion-header").click();
  const panel = modal.locator(".event-editor-settings-main");
  await page.screenshot({ path: `${DIR}/01-group-open.png`, fullPage: false });
  await panel.screenshot({ path: `${DIR}/02-panel.png` });

  // 일정 두 개를 넣어서 조건 행이 실제로 어떻게 보이는지 본다.
  const editor = modal.getByTestId("event-schedule-editor");
  await editor.locator("summary").click();
  await expect(modal.getByTestId("event-schedule-add")).toBeVisible();
  await panel.screenshot({ path: `${DIR}/02b-panel-empty-open.png` });
  await modal.getByTestId("event-schedule-add").click();
  await modal.getByTestId("event-schedule-add").click();
  await expect(modal.getByTestId("event-schedule-row-1")).toBeVisible();
  await page.screenshot({ path: `${DIR}/03-full-with-rows.png` });
  await panel.screenshot({ path: `${DIR}/04-panel-with-rows.png` });

  // 레일이 아래로 접히는 좁은 폭(1320px 이하) 폴백.
  await page.setViewportSize({ width: 1280, height: 1024 });
  await expect(modal.getByTestId("event-schedule-row-0")).toBeVisible();
  await page.screenshot({ path: `${DIR}/05-narrow.png` });
  await modal.getByTestId("event-schedule-row-0").scrollIntoViewIfNeeded();
  await modal.getByTestId("event-schedule-row-0").screenshot({ path: `${DIR}/06-narrow-row.png` });
});
