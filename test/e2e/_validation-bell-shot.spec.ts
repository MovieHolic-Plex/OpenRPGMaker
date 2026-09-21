import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { mockupProject } from "./mockupProbeSeeds";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectForEditor } from "./projectSeed";

const DIR = "output/evidence/event-validation-bell";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test.setTimeout(120_000);

test("validation warnings surface as a titlebar bell with a count badge", async ({ page }, testInfo) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1536, height: 1024 });
  const { project, eventId } = mockupProject();
  await seedProjectForEditor(page, project);
  await openEventEditor(page, eventId);

  const modal = page.getByTestId("event-editor-modal");
  const titlebar = modal.getByTestId("event-editor-titlebar");
  const bell = titlebar.getByTestId("event-draft-validation");

  await expect(bell).toBeVisible();
  await expect(bell).toHaveAttribute("data-severity", "warning");
  await expect(bell).toHaveAttribute("data-count", "1");
  await expect(bell.getByTestId("event-draft-validation-count")).toHaveText("1");
  await expect(modal.locator(".event-editor > .event-draft-validation")).toHaveCount(0);

  const headerBox = await titlebar.boundingBox();
  const bellBox = await bell.boundingBox();
  if (!headerBox || !bellBox) throw new Error("expected titlebar and bell layout boxes");
  expect(bellBox.y).toBeLessThan(headerBox.y + headerBox.height);
  expect(bellBox.x).toBeGreaterThan(headerBox.x + headerBox.width / 2);
  await modal.screenshot({ path: `${DIR}/bell-closed.png` });

  await bell.getByTestId("event-draft-validation-summary").click();
  await expect(bell).toHaveAttribute("open", "");
  const issues = bell.locator('[data-testid^="event-draft-validation-issue-"]');
  await expect(issues).toHaveCount(1);
  await expect(bell.getByTestId("event-draft-validation-tally")).toHaveText("경고 1");

  const tallyBox = await bell.getByTestId("event-draft-validation-tally").boundingBox();
  if (!tallyBox) throw new Error("expected tally layout box");
  const ownerTestId = await page.evaluate(([x, y]) => {
    const hit = document.elementFromPoint(x, y);
    return hit?.closest<HTMLElement>("[data-testid]")?.dataset.testid ?? null;
  }, [tallyBox.x + tallyBox.width / 2, tallyBox.y + tallyBox.height / 2]);
  expect(ownerTestId).toBe("event-draft-validation-tally");
  await modal.screenshot({ path: `${DIR}/bell-open.png` });

  const windowBefore = await modal.locator(".event-editor-modal-window").boundingBox();
  await issues.first().click();
  await expect(bell).not.toHaveAttribute("open", "");
  const windowAfter = await modal.locator(".event-editor-modal-window").boundingBox();
  expect(windowAfter?.x).toBeCloseTo(windowBefore?.x ?? 0, 0);
  expect(windowAfter?.y).toBeCloseTo(windowBefore?.y ?? 0, 0);

  await writeFile(
    `${DIR}/bell-geometry.json`,
    `${JSON.stringify({ viewport: { width: 1536, height: 1024 }, header: headerBox, bell: bellBox }, null, 2)}\n`,
    "utf8",
  );
  await page.screenshot({ path: testInfo.outputPath("validation-bell-full.png"), fullPage: true });
});
