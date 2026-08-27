// 진단용: 시스템/연출 M2 명령 폼(3페이지) BEFORE 스크린샷 캡처.
// 산출물: rpg-zzu-system-ux/output/evidence/sysux-before/*.png
import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";

const DIR = "../rpg-zzu-system-ux/output/evidence/sysux-before";

const TARGETS = [
  { id: "m2-067-key-input-processing", body: "key-input-processing-command-body", shot: "01-key-input-processing", fields: { variableId: "0001", target: "0001", operation: "set", value: "true" } },
  { id: "m2-046-tint-screen", body: "tint-screen-command-body", shot: "02-tint-screen", fields: { color: "blue", value: "", duration: 600 } },
  { id: "m2-047-flash-screen", body: "flash-screen-command-body", shot: "03-flash-screen", fields: { color: "red", value: "red", durationMs: 300 } },
  { id: "m2-048-shake-screen", body: "shake-screen-command-body", shot: "04-shake-screen", fields: { intensity: "6", value: 6, durationMs: 400 } },
  { id: "m2-049-scroll-map", body: "scroll-map-command-body", shot: "05-scroll-map", fields: { direction: "right", distance: 4, speed: 4, wait: "true", mode: "return" } },
  { id: "m2-050-set-weather-effects", body: "set-weather-effects-command-body", shot: "06-set-weather-effects-fog", fields: { value: "fog,0.7", transitionMs: 800, durationMs: 800 } },
  { id: "m2-069-change-parallax-back", body: "change-parallax-back-command-body", shot: "07-change-parallax-back", fields: { value: "", target: "", operation: "set", resourceId: "" } },
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});
test.setTimeout(180_000);

test("sysux before shots", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  const project = createBlankProject();
  project.variables = [{ id: "0001", name: "누른키" }, { id: "0002", name: "V2" }];
  const mapId = project.startMapId!;
  const cmds: Command[] = TARGETS.map((t) => ({ kind: "m2Command", commandId: t.id, fields: { ...t.fields } }) as Command);
  project.maps[mapId]!.events = [{
    id: "ev_sysux", name: "시스템 연출", x: 5, y: 5, trigger: { kind: "action" }, commands: [],
    pages: [{ id: "p1", name: "p1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: cmds }],
  }];
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, "ev_sysux");
  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  await modal.getByTestId("event-view-toggle-list").click();
  const list = modal.locator(".cmd-list").first();
  await expect(list).toBeVisible();
  await list.screenshot({ path: `${DIR}/00-command-list.png` });

  for (const [i, t] of TARGETS.entries()) {
    const head = list.locator(".cmd-head").nth(i);
    await head.scrollIntoViewIfNeeded();
    await head.dblclick();
    const dialog = page.getByTestId("event-command-edit-dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const body = dialog.getByTestId(t.body).first();
    await expect(body).toBeVisible({ timeout: 10_000 });
    await dialog.screenshot({ path: `${DIR}/${t.shot}-dialog.png` });
    await body.screenshot({ path: `${DIR}/${t.shot}.png` });
    await page.getByTestId("event-command-edit-cancel").first().click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }
});
