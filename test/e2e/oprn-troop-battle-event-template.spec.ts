import { expect, test } from "@playwright/test";
import { exportedProject } from "./oprn-database-helpers";

test("Troops battle event editor offers desktop encounter template and quality warnings", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-troops").click();

  await expect(page.getByTestId("db-troop-event-quality")).toContainText("전투 후 보상/후속 연출 없음");
  await page.getByTestId("db-troop-event-apply-payoff-template").click();
  await expect(page.getByTestId("db-troop-event-quality")).toContainText("템플릿 적용됨");
  await expect(page.getByTestId("db-troop-event-command-area")).toContainText("결과 요약");
  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("troops-battle-template-quality.png") });

  const project = await exportedProject(page);
  const troop = project.database.troops.find((entry) => entry.battleEventPages?.some((pageRecord) =>
    pageRecord.commands.some((command) => command.kind === "m2Command" && command.commandId === "m2-109-result-summary")
  ));
  const pageRecord = troop?.battleEventPages?.[0];
  expect(pageRecord?.commands).toEqual(
    expect.arrayContaining([
      { kind: "m2Command", commandId: "m2-101-enemy-encounter", fields: { target: "enemy-1" } },
      { kind: "m2Command", commandId: "m2-102-change-battleback", fields: { resourceId: "easyrpg-backdrop-dawn1" } },
      { kind: "m2Command", commandId: "m2-109-result-summary", fields: { label: "결과 요약" } },
    ])
  );
});
