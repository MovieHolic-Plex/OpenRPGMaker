import { expect, test } from "@playwright/test";
import { exportedProject } from "./rm2k3-database-helpers";

test("Database States tab exposes readable Korean RM-style ontology controls", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1474, height: 910 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-states").click();

  const workbench = page.getByTestId("db-states-rm2k3-workbench");
  await expect(workbench).toBeVisible();
  for (const text of ["해제 조건", "색상", "우선도", "제한", "명중률 보정", "상태 유효도", "회복 방법", "행동 제한", "HP", "MP", "애니메이션", "참조"]) {
    await expect(workbench).toContainText(text);
  }

  await expect(page.getByTestId("db-state-rate-A")).toContainText("A");
  await expect(page.getByTestId("db-state-rate-E")).toContainText("E");
  await expect(page.getByTestId("db-state-ontology-summary")).toContainText("상태");

  await page.getByTestId("db-field-name").fill("검증 독 상태");
  const project = await exportedProject(page);
  expect(project.database.states.some((record) => record.name === "검증 독 상태")).toBe(true);

  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("states-tab-korean-rm-style.png") });
});
