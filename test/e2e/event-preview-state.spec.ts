import { expect, test, type Locator } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";

const FACE_A = "easyrpg-faceset-people1-03";
const FACE_B = "easyrpg-faceset-actor1-00";
const EVENT_ID = "direct_preview_state";

test("preview stays current while faces are edited and branches are traversed", async ({ page }) => {
  test.setTimeout(180_000);
  const output = resolve("output/evidence/event-preview-state/browser");
  await mkdir(output, { recursive: true });
  const writes: string[] = [];
  const actions: string[] = [];
  await page.route("**/rest/v1/**", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes.push(route.request().method());
      await route.abort();
    } else await route.continue();
  });
  const project = createBlankProject();
  project.variables = [{ id: "var_0001", name: "점수" }];
  const commands: Command[] = [
    { kind: "changeFace", resourceId: FACE_A, position: "left", flipHorizontally: false },
    { kind: "text", speaker: "촌장", body: "직접 갱신 확인" },
    { kind: "setVariable", variableId: "var_0001", op: "=", value: 37 },
    { kind: "text", speaker: "촌장", body: "점수: \\V[1]" },
    {
      kind: "fork", condition: { kind: "switch", switchId: "sw_never", value: true },
      then: [{ kind: "changeFace", resourceId: FACE_A, position: "left", flipHorizontally: false }],
      else: [],
    },
    { kind: "text", speaker: "촌장", body: "분기 뒤 점수: \\V[1]" },
  ];
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing fixture map");
  map.events = [{
    id: EVENT_ID, name: "직접 상태 검사", x: 3, y: 3, trigger: { kind: "action" }, commands,
    pages: [{
      id: "direct_state_page", name: "직접 상태 검사", conditions: [], graphic: {},
      trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
    }],
  }];
  await page.addInitScript(seed => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    window.__OPRN_E2E_PROJECT__ = seed;
  }, project);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?blankProject=1");
  await page.getByTestId("layer-event").click();
  await page.getByTestId(`event-list-row-${EVENT_ID}`).click();
  await page.getByTestId("event-editor-open").click();
  const editor = page.getByTestId("event-editor-modal");
  await editor.getByTestId("event-view-toggle-list").click();
  await editor.getByTestId("event-command-changeFace").first().dblclick();
  const faceDialog = page.getByTestId("event-command-edit-dialog");
  await expect(faceDialog).toBeVisible();
  await expect(editor.getByTestId("event-view-toggle-list")).toHaveAttribute("aria-selected", "true");
  await faceDialog.getByTestId("event-command-edit-cancel").click();
  actions.push("Cold-inspector double-click opens the command editor without switching to Preview");
  await editor.getByTestId("event-command-changeFace").first().locator(".cmd-head").click();
  await expect(editor.getByTestId("event-view-toggle-list")).toHaveAttribute("aria-selected", "true");
  await editor.getByTestId("event-view-toggle-preview").click();
  const preview = editor.getByTestId("event-page-preview");
  const status = preview.locator('[role="status"]');
  const next = editor.getByTestId("event-script-live-next");
  await next.click();
  await expect(status).toHaveAttribute("data-current", "2");
  await expect(face(preview)).toHaveAttribute("data-resource-id", FACE_A);

  await editor.getByTestId(`event-command-face-option-${FACE_B}`).click();
  await expect(editor.getByTestId("event-command-face-resource")).toHaveValue(FACE_B);
  await expect(face(preview)).toHaveAttribute("data-resource-id", FACE_B);
  actions.push("Changed portrait in inspector while page Preview remained at step2; current resource matched");
  await editor.getByTestId("event-command-face-resource-clear").click();
  await expect(face(preview)).toHaveCount(0);
  actions.push("Cleared portrait while page Preview remained at step2; no old face remained");
  await editor.getByTestId(`event-command-face-option-${FACE_B}`).click();
  await editor.locator('[data-custom-select-for="event-command-face-position"]').click();
  await page.getByRole("option", { name: "오른쪽", exact: true }).click();
  await editor.getByTestId("event-command-face-flip-horizontal").check();
  await expect(face(preview)).toHaveAttribute("data-position", "right");
  await expect(face(preview)).toHaveClass(/flipped/);
  await expect(preview.locator(".ecp-message-window")).toHaveClass(/face-right/);
  const cropScale = await face(preview).getByTestId("event-command-face-crop").evaluate(node => {
    const transform = getComputedStyle(node).transform;
    return transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
  });
  expect(cropScale).toBeLessThan(0);
  actions.push("Right position and flip propagate to actual dialogue layout and negative CSS transform");
  await page.screenshot({ path: resolve(output, "edited-right-flipped.png") });

  await next.click();
  await expect(status).toHaveAttribute("data-current", "3");
  await next.click();
  await expect(status).toHaveAttribute("data-current", "4");
  await expect(preview.getByTestId("ecp-message-body")).toHaveText("점수: 37");
  actions.push("Set variable37 is interpolated as37, not zero");
  await next.click();
  await next.click();
  await expect(status).toHaveAttribute("data-current", "6");
  await expect(preview.getByTestId("event-command-preview-body")).toHaveClass(/ecp-skipped/);
  await next.click();
  await expect(status).toHaveAttribute("data-current", "7");
  await expect(face(preview)).toHaveAttribute("data-resource-id", FACE_B);
  await expect(preview.getByTestId("ecp-message-body")).toHaveText("분기 뒤 점수: 37");
  actions.push("Skipped branch portrait does not replace the executed portrait");
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(face(preview)).toHaveAttribute("data-position", "right");
  await page.screenshot({ path: resolve(output, "branch-state-1024.png") });

  await editor.getByTestId("event-view-toggle-list").click();
  await editor.getByTestId("event-inspector-close").click();
  const textRow = editor.getByTestId("event-command-text").first();
  const beforeOpen = await textRow.boundingBox();
  await textRow.dblclick();
  const textDialog = page.getByTestId("event-command-edit-dialog");
  await expect(textDialog).toBeVisible();
  expect(await textRow.boundingBox()).toEqual(beforeOpen);
  await expect(editor.getByTestId("event-view-toggle-list")).toHaveAttribute("aria-selected", "true");
  await textDialog.getByTestId("event-command-edit-cancel").click();
  actions.push("At1024, closing/reopening the inspector does not move the double-clicked row");
  await editor.getByTestId("event-command-text").first().locator(".cmd-head").click();
  await expect(editor.getByTestId("event-view-toggle-list")).toHaveAttribute("aria-selected", "true");
  const inspector = editor.getByTestId("event-editor-inspector");
  await expect(face(inspector)).toHaveAttribute("data-position", "right");
  await expect(face(inspector)).toHaveClass(/flipped/);
  actions.push("List selection remains list; text inspector preserves portrait side/flip");
  await editor.getByTestId("event-view-toggle-preview").click();
  await expect(status).toHaveAttribute("data-current", "7");
  await editor.getByTestId("event-script-live-restart").click();
  await expect(status).toHaveAttribute("data-current", "1");
  await next.click();
  await expect(status).toHaveAttribute("data-current", "2");
  await expect(face(preview)).toHaveAttribute("data-resource-id", FACE_B);
  actions.push("Preview remembers step across views and restart/next use current edited state");
  expect(writes).toEqual([]);
  await writeFile(resolve(output, "actions.json"), JSON.stringify({
    url: page.url(), actions, remoteWrites: writes,
    imageReading: "Screenshots captured; this session cannot receive image input. Assertions use browser DOM/CSSOM.",
  }, null, 2));
});

function face(host: Locator): Locator {
  return host.getByTestId("event-command-face-crop-shell");
}
