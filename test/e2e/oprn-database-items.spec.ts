import { expect, test } from "@playwright/test";
import { exportedProject } from "./oprn-database-helpers";

test("Database Items tab follows RM2K3 item types and Korean type-specific panels", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // DB 툴바(toolbar-database)는 expert chrome 에서만 노출된다.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-items").click();

  await expect(page.getByTestId("db-items-oprn-workbench")).toBeVisible();
  await expect(page.getByTestId("db-field-item-type")).not.toContainText("무기");
  await expect(page.getByTestId("db-field-item-type")).not.toContainText("방패");
  await expect(page.getByTestId("db-field-item-type")).toContainText("약");
  await expect(page.getByTestId("db-field-item-type")).toContainText("장치 작동");

  await page.getByTestId("db-field-name").fill("QA 회복약");
  await page.getByTestId("db-field-item-type").selectOption("medicine");
  await page.getByTestId("db-field-item-consumption-limit").selectOption("1");
  // 대상은 T9 이후 세그먼트 컨트롤(네이티브 radio) — 레이블 클릭으로 선택.
  await page.getByTestId("db-field-item-scope").getByText("아군 전체").click();
  // 회복 % 는 T9 이후 슬라이더+스테퍼 쌍 — 스테퍼(number input)에 값을 입력한다.
  await page.getByTestId("db-field-item-hp-percent-stepper").fill("10");
  await page.getByTestId("db-field-item-hp-flat").fill("50");
  await page.getByTestId("db-field-item-mp-percent-stepper").fill("25");
  await page.getByTestId("db-field-item-occasion").selectOption("field");
  await expect(page.getByTestId("db-items-medicine-panel")).toContainText("HP 회복");
  // "사용 가능"은 약/책/씨앗/특수 패널에 각각 복제되지 않고 "사용 제한" 구역의 공용 카드
  // 한 장이 소유한다 — 패널 안이 아니라 해당 카드로 확인한다.
  await expect(page.getByTestId("db-item-card-usable")).toContainText("사용 대상 제한");

  await page.getByTestId("db-field-item-type").selectOption("special");
  await page.getByTestId("db-picker-item-activate-skill").selectOption({ label: "치유" });
  await expect(page.getByTestId("db-field-item-usage-message")).toHaveCount(0);
  await expect(page.getByTestId("db-items-special-panel")).toContainText("발동 스킬");

  await page.getByTestId("db-field-item-type").selectOption("switch");
  await page.getByTestId("db-picker-item-switch").selectOption({ index: 1 });
  await page.getByTestId("db-field-item-occasion").selectOption("field");
  await expect(page.getByTestId("db-items-switch-panel")).toContainText("장치 켜기 (ON)");
  await page.getByTestId("database-modal").screenshot({
    path: testInfo.outputPath("items-tab-switch-panel.png"),
  });

  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-catalog-filter-equipment").click();
  await page.locator('.db-catalog-rows [data-collection="equipment"]').first().click();
  const project = await exportedProject(page);
  const item = project.database.items.find((record) => record.name === "QA 회복약");
  expect(item).toMatchObject({
    type: "switch",
    occasion: "field",
    consumptionLimit: 1,
    scope: "allAllies",
    hpRecovery: { percentMax: 10, flat: 50 },
    mpRecovery: { percentMax: 25, flat: 0 },
    onlyUsableInMenu: true,
    usageMessage: "normal",
  });
  expect(item?.skillId).toBe("skill_heal");
  expect(item?.switchId).toBeTruthy();

  await page.getByTestId("database-modal").screenshot({
    path: testInfo.outputPath("items-tab-weapon-panel.png"),
  });
  await page.screenshot({ path: testInfo.outputPath("database-items-rm2k3.png"), fullPage: true });
});
