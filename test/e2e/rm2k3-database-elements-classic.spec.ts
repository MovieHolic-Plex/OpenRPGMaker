import { expect, test } from "@playwright/test";
import { exportedProject } from "./rm2k3-database-helpers";

test("RM2003 Elements tab uses a readable single-record editor shape", async ({ page }) => {
  await page.setViewportSize({ width: 1484, height: 949 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-elements").click();

  await expect(page.getByTestId("db-elements-classic")).toBeVisible();
  await expect(page.getByTestId("db-elements-list-title")).toHaveText("속성");
  await expect(page.getByText("이름", { exact: true })).toBeVisible();
  await expect(page.getByText("속성 유형", { exact: true })).toBeVisible();
  await expect(page.getByText("대미지 배율", { exact: true })).toBeVisible();
  await expect(page.getByTestId("db-elements-maximum-number")).toHaveText("최대 개수");
  await expect(page.getByTestId("db-elements-list")).toContainText("0001: Sword");
  await expect(page.getByTestId("db-elements-list")).toContainText("0006: Ice");
  await expect(page.getByTestId("db-elements-row-5")).toHaveClass(/is-selected/);

  await expect(page.getByTestId("db-field-element-name-selected")).toHaveValue("Ice");
  await expect(page.getByText("물리", { exact: true })).toBeVisible();
  await expect(page.getByText("마법", { exact: true })).toBeVisible();
  await expect(page.getByTestId("db-field-element-kind-physical")).not.toBeChecked();
  await expect(page.getByTestId("db-field-element-kind-magical")).toBeChecked();
  await expect(page.getByTestId("db-field-element-damage-A")).toHaveValue("200");
  await expect(page.getByTestId("db-field-element-damage-B")).toHaveValue("150");
  await expect(page.getByTestId("db-field-element-damage-C")).toHaveValue("100");
  await expect(page.getByTestId("db-field-element-damage-D")).toHaveValue("50");
  await expect(page.getByTestId("db-field-element-damage-E")).toHaveValue("0");

  await page.getByTestId("db-field-element-name-selected").fill("검증 속성");
  await page.getByTestId("db-field-element-kind-physical").check();
  await page.getByTestId("db-field-element-damage-D").fill("75");

  const project = await exportedProject(page);
  expect(project.database.elements?.[5]).toMatchObject({
    id: "ice",
    kind: "physical",
    name: "검증 속성",
    damageMultipliers: { A: 200, B: 150, C: 100, D: 75, E: 0 },
  });
});
