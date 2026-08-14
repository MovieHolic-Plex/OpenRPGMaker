import { expect, test } from "@playwright/test";
import { exportedProject } from "./rm2k3-database-helpers";

test("Database Items tab follows RM2K3 item types and Korean type-specific panels", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // DB 툴바(toolbar-database)는 expert chrome 에서만 노출된다.
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-items").click();

  await expect(page.getByTestId("db-items-rm2k3-workbench")).toBeVisible();
  await expect(page.getByTestId("db-field-item-type")).toContainText("무기");
  await expect(page.getByTestId("db-field-item-type")).toContainText("방패");
  await expect(page.getByTestId("db-field-item-type")).toContainText("약");
  await expect(page.getByTestId("db-field-item-type")).toContainText("스위치");

  await page.getByTestId("db-field-name").fill("QA 회복약");
  await page.getByTestId("db-field-item-type").selectOption("medicine");
  await page.getByTestId("db-field-item-consumption-limit").selectOption("1");
  // 대상은 T9 이후 세그먼트 컨트롤(네이티브 radio) — 레이블 클릭으로 선택.
  await page.getByTestId("db-field-item-scope").getByText("아군 전체").click();
  // 회복 % 는 T9 이후 슬라이더+스테퍼 쌍 — 스테퍼(number input)에 값을 입력한다.
  await page.getByTestId("db-field-item-hp-percent-stepper").fill("10");
  await page.getByTestId("db-field-item-hp-flat").fill("50");
  await page.getByTestId("db-field-item-mp-percent-stepper").fill("25");
  await page.getByTestId("db-field-item-only-menu").check();
  await expect(page.getByTestId("db-items-medicine-panel")).toContainText("HP 회복");
  await expect(page.getByTestId("db-items-medicine-panel")).toContainText("사용 가능");

  await page.getByTestId("db-field-item-type").selectOption("special");
  await page.getByTestId("db-picker-item-activate-skill").selectOption({ label: "치유" });
  await page.getByTestId("db-field-item-usage-message").selectOption("skill");
  await expect(page.getByTestId("db-items-special-panel")).toContainText("발동 스킬");

  await page.getByTestId("db-field-item-type").selectOption("switch");
  await page.getByTestId("db-picker-item-switch").selectOption({ index: 1 });
  // occasion 배치: 두 플래그 모두 켜짐을 보장한다. 원본 레코드가 이미 켜진 상태면
  // check() 가 no-op(change 없음)라서 occasion 재계산이 안 일어난다 — 껐다 켜서
  // occasionFromFlags(true,true)="always" 를 실제 UI 경로로 만들게 한다.
  for (const id of ["db-field-item-occasion-field", "db-field-item-occasion-battle"]) {
    const toggle = page.getByTestId(id);
    if (await toggle.isChecked()) await toggle.uncheck();
    await toggle.check();
  }
  await expect(page.getByTestId("db-items-switch-panel")).toContainText("스위치 토글 ON/OFF");
  await page.getByTestId("database-modal").screenshot({
    path: testInfo.outputPath("items-tab-switch-panel.png"),
  });

  await page.getByTestId("db-field-item-type").selectOption("weapon");
  await page.getByTestId("db-field-item-wield-type").selectOption("twoHanded");
  await page.getByTestId("db-field-item-equipment-attack").fill("7");
  await page.getByTestId("db-field-item-equipment-defense").fill("3");
  await page.getByTestId("db-field-item-mp-cost").fill("2");
  await page.getByTestId("db-field-item-accuracy").fill("95");
  await page.getByTestId("db-field-item-usable-actor-actor_hero").check();
  await page.getByTestId("db-field-item-usable-actor-actor_guardian").check();
  await page.getByTestId("db-field-item-attackElementIds-sword").check();
  await page.getByTestId("db-field-item-attackElementIds-fire").check();
  await page.getByTestId("db-field-item-stateInflictIds-state_poison").check();
  await page.getByTestId("db-field-item-stateInflictIds-state_sleep").check();

  // project export JSON 은 150ms trailing 디바운스(editor.ts updateProjectExport) — 마지막
  // 체크박스 변경이 반영될 때까지 폴링해 확정 상태를 읽는다(플레이크 방지).
  await expect
    .poll(async () => {
      const current = await exportedProject(page);
      return current.database.items.find((record) => record.name === "QA 회복약")?.equipmentProfile?.stateInflictIds;
    }, { timeout: 5_000 })
    .toEqual(["state_poison", "state_sleep"]);

  const project = await exportedProject(page);
  const item = project.database.items.find((record) => record.name === "QA 회복약");
  expect(item).toMatchObject({
    type: "weapon",
    occasion: "always",
    consumptionLimit: 1,
    scope: "allAllies",
    hpRecovery: { percentMax: 10, flat: 50 },
    mpRecovery: { percentMax: 25, flat: 0 },
    onlyUsableInMenu: true,
    usageMessage: "skill",
  });
  expect(item?.skillId).toBe("skill_heal");
  expect(item?.switchId).toBeTruthy();
  expect(item?.equipmentProfile).toMatchObject({
    twoHanded: true,
    mpCost: 2,
    accuracy: 95,
    statBonuses: { attack: 7, defense: 3 },
    equippableActorIds: ["actor_hero", "actor_guardian"],
    attackElementIds: ["sword", "fire"],
    stateInflictIds: ["state_poison", "state_sleep"],
  });

  await page.getByTestId("database-modal").screenshot({
    path: testInfo.outputPath("items-tab-weapon-panel.png"),
  });
  await page.screenshot({ path: testInfo.outputPath("database-items-rm2k3.png"), fullPage: true });
});
