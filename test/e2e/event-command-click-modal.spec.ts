import { expect, test } from "@playwright/test";
import { mockupProject } from "./mockupProbeSeeds";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = ".omo/evidence/evcmd-modal-fix";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

test("기존 이벤트 명령을 클릭하면 같은 페이지의 편집 모달이 열린다", async ({ page, context }) => {
  const { project, eventId } = mockupProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);

  const editor = page.getByTestId("event-editor-modal");
  const command = editor.getByTestId("event-storyboard-card-0");
  await expect(command).toBeVisible();

  await command.click();

  const editModal = page.getByTestId("event-command-edit-dialog");
  await expect(editModal).toBeVisible();
  await expect(editModal.locator('[role="dialog"]')).toHaveAttribute("aria-modal", "true");
  await expect(editor).toBeVisible();
  expect(context.pages()).toHaveLength(1);
  await page.screenshot({ path: `${EVIDENCE_DIR}/after-command-click.png` });
});
