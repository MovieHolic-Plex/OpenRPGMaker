import { expect, test, type Page } from "@playwright/test";
import { emptyEventProject } from "./mockupProbeSeeds";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const DIR = "output/evidence/evcmd-modal-fix";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});
test.setTimeout(120_000);

async function boot(page: Page) {
  const { project, eventId } = emptyEventProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await openEventEditor(page, eventId);
}

test("A: 빈 명령줄 더블클릭 → 피커", async ({ page }) => {
  await boot(page);
  const emptyLine = page.getByTestId("event-command-empty-line");
  await expect(emptyLine).toBeVisible();
  await emptyLine.dblclick();
  const picker = page.locator('[data-testid="event-command-picker"]');
  console.log("PICKER VISIBLE:", await picker.isVisible());
  console.log("PAGES:", page.context().pages().length);
  await expect(picker).toBeVisible({ timeout: 3000 }).catch(() => console.log("picker NOT visible in 3s"));
  await page.screenshot({ path: `${DIR}/repro-A-after-dblclick.png` });
});

test("B: 초보자 템플릿 '빈 이벤트 / 명령 검색' 클릭 → 피커", async ({ page }) => {
  await boot(page);
  const btn = page.getByTestId("event-template-empty-search");
  await expect(btn).toBeVisible();
  await btn.click();
  const picker = page.locator('[data-testid="event-command-picker"]');
  console.log("PICKER VISIBLE:", await picker.isVisible());
  await expect(picker).toBeVisible({ timeout: 3000 }).catch(() => console.log("picker NOT visible in 3s"));
  await page.screenshot({ path: `${DIR}/repro-B-template-click.png` });
});
