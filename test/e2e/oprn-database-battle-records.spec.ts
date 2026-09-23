import { expect, test } from "@playwright/test";
import { exportedProject } from "./oprn-database-helpers";

test("BM101-BM104 Enemies tab exposes Korean RPG Maker-style editable enemy settings", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-enemies").click({ force: true });

  const workbench = page.getByTestId("db-enemies-bm101-workbench");
  await expect(workbench).toBeVisible();
  await expect(workbench).toContainText("이름");
  await expect(workbench).toContainText("능력치");
  await expect(workbench).toContainText("그래픽");
  await expect(workbench).toContainText("보상");
  await expect(workbench).toContainText("치명타 %");
  await expect(workbench).toContainText("옵션");
  await expect(workbench).toContainText("상태 유효도");
  await expect(workbench).toContainText("속성 유효도");
  await expect(workbench).toContainText("공격 패턴");

  await page.getByTestId("db-field-name").fill("테스트 슬라임");
  await page.getByTestId("db-field-enemy-max-hp").fill("321");
  await page.getByTestId("db-field-enemy-max-mp").fill("12");
  await page.getByTestId("db-field-enemy-attack").fill("33");
  await page.getByTestId("db-field-enemy-defense").fill("22");
  await page.getByTestId("db-field-enemy-mind").fill("11");
  await page.getByTestId("db-field-enemy-agility").fill("44");
  await page.getByTestId("db-enemy-section-rewards-tab").click();
  await page.getByTestId("db-field-enemy-exp").fill("77");
  await page.getByTestId("db-field-enemy-gold").fill("88");
  await page.getByTestId("db-picker-enemy-drop").selectOption({ index: 1 });
  await page.getByTestId("db-field-enemy-drop-rate").fill("35");
  await page.getByTestId("db-enemy-section-combat-tab").click();
  await page.getByTestId("db-field-enemy-critical-enabled").check();
  await page.getByTestId("db-field-enemy-critical-one-in").fill("7");
  await page.getByTestId("db-field-enemy-normal-miss").check();
  await page.getByTestId("db-enemy-section-appearance-tab").click();
  await page.getByTestId("db-field-enemy-transparent").check();
  await page.getByTestId("db-field-enemy-flying").check();
  await page.getByTestId("db-enemy-section-combat-tab").click();
  await page.getByTestId("db-picker-enemy-state-rate-state_poison").selectOption("A");
  await page.getByTestId("db-picker-enemy-element-rate-fire").selectOption("E");

  await page.getByTestId("db-enemy-section-appearance-tab").click();
  await page.getByTestId("db-enemy-graphic-set").click();
  await expect(page.getByTestId("db-enemy-graphic-dialog")).toBeVisible();
  await page.getByTestId("db-enemy-graphic-hue").fill("120");
  await page.getByTestId("db-enemy-graphic-option-generated-enemy-ontology-8da61312").click();
  await page.getByTestId("db-enemy-graphic-ok").click();
  await expect(page.getByTestId("db-enemy-graphic-dialog")).toBeHidden();

  await page.getByTestId("db-enemy-action-row-0").dblclick();
  await expect(page.getByTestId("db-enemy-action-dialog")).toBeVisible();
  await page.getByTestId("db-enemy-action-rating").fill("64");
  await page.getByTestId("db-enemy-action-condition-type").selectOption("turn");
  await page.getByTestId("db-enemy-action-turn-start").fill("2");
  await page.getByTestId("db-enemy-action-turn-interval").fill("5");
  await expect(page.getByTestId("db-enemy-action-switch-on-enabled")).toBeVisible();
  await expect(page.getByTestId("db-enemy-action-switch-off-enabled")).toBeVisible();
  await page.getByTestId("db-enemy-action-switch-on-enabled").check();
  await page.getByTestId("db-enemy-action-switch-off-enabled").check();
  await page.getByTestId("db-enemy-action-ok").click();
  await expect(page.getByTestId("db-enemy-action-dialog")).toBeHidden();

  await page.getByTestId("db-enemy-action-row-0").click({ button: "right" });
  await expect(page.getByTestId("db-enemy-action-context-menu")).toBeVisible();
  await expect(page.getByTestId("db-enemy-action-context-edit")).toContainText("편집");
  await page.getByTestId("db-enemy-action-context-copy").click();
  await page.getByTestId("db-enemy-action-row-0").click({ button: "right" });
  await page.getByTestId("db-enemy-action-context-paste").click();
  await expect(page.getByTestId("db-enemy-action-row-1")).toBeVisible();

  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("bm101-enemies-tab.png") });
  const project = await exportedProject(page);
  const enemy = project.database.enemies.find((record) => record.name === "테스트 슬라임");
  expect(enemy?.monsterResourceId).toBe("generated-enemy-ontology-8da61312");
  expect(enemy?.transparent).toBe(true);
  expect(enemy?.flying).toBe(true);
  expect(enemy?.stats).toMatchObject({ maxHp: 321, maxMp: 12, attack: 33, defense: 22, mind: 11, agility: 44 });
  expect(enemy?.rewards).toMatchObject({ exp: 77, gold: 88, dropRatePercent: 35 });
  expect(enemy?.criticalHit).toMatchObject({ enabled: true, oneIn: 7 });
  expect(enemy?.attackOptions).toMatchObject({ normalAttacksMiss: true });
  expect(enemy?.stateRates?.state_poison).toBe("A");
  expect(enemy?.elementRates?.fire).toBe("E");
  expect(enemy?.actions[0]).toMatchObject({
    priority: 64,
    condition: { kind: "turn", start: 2, interval: 5 },
    switchOnAfterAction: { enabled: true },
    switchOffAfterAction: { enabled: true },
  });
  expect(enemy?.actions[1]).toMatchObject({ priority: 64, condition: { kind: "turn", start: 2, interval: 5 } });
  expect(enemy?.actions).toHaveLength(3);
});

test("RM2K3 troops battle event editor authors encounter and battleback commands", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-troops").click();
  await page.getByTestId("db-troop-event-add-page").click();
  await page.getByTestId("db-field-troop-event-condition-kind").selectOption("actorCommand");
  await page.getByTestId("db-field-troop-event-condition-actor-command-command").selectOption("defend");
  await page.getByTestId("db-troop-event-add-enemy-encounter").click();
  await page.getByTestId("db-field-troop-event-enemy-encounter-target").fill("enemy-2");
  await page.getByTestId("db-troop-event-add-change-battleback").click();
  await page.getByTestId("db-field-troop-event-change-battleback-resource").fill("easyrpg-backdrop-dawn1");
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("troops-editor-battle-events.png") });

  await expect.poll(async () => {
    const project = await exportedProject(page);
    return project.database.troops.some((entry) => entry.battleEventPages?.some((pageRecord) =>
      pageRecord.conditions[0]?.kind === "actorCommand" && pageRecord.commands.length === 2
    ));
  }).toBe(true);
  const project = await exportedProject(page);
  const troop = project.database.troops.find((entry) => entry.battleEventPages?.some((pageRecord) => pageRecord.commands.length === 2));
  const pageRecord = troop?.battleEventPages?.[0];
  expect(pageRecord?.conditions).toEqual([{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }]);
  expect(pageRecord?.commands).toEqual([
    { kind: "m2Command", commandId: "m2-101-enemy-encounter", fields: { target: "enemy-2" } },
    { kind: "m2Command", commandId: "m2-102-change-battleback", fields: { resourceId: "easyrpg-backdrop-dawn1" } },
  ]);
});

test("RM2K3 Troops tab matches Korean classic troop editor layout", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1460, height: 820 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-troops").click();

  const workbench = page.getByTestId("db-troops-classic-workbench");
  await expect(workbench).toBeVisible();
  await expect(workbench).toContainText("이름 생성");
  await expect(workbench).toContainText("전투 테스트");
  await expect(workbench).toContainText("배경 변경");
  await expect(workbench).toContainText("설정");
  await expect(workbench).toContainText("수동");
  await expect(workbench).toContainText("자동");
  await expect(workbench).toContainText("지형");
  await expect(workbench).toContainText("전투 이벤트");
  await expect(page.getByTestId("db-troop-preview-stage")).toBeVisible();

  // 2026-09 구획 분할: 미리보기(배치)와 전투 이벤트는 더 이상 나란히 보이지 않는다 —
  // 「배치」 구획에서 미리보기가 넓게 차지하고, 전투 이벤트는 자기 구획 탭에서 전폭으로 열린다.
  const previewWidth = await page.getByTestId("db-troop-preview-stage").evaluate((node) => Math.round(node.getBoundingClientRect().width));
  expect(previewWidth).toBeGreaterThan(400);
  await page.getByTestId("db-troop-section-events-tab").click();
  await expect(page.getByTestId("db-troop-preview-stage")).toBeHidden();
  await expect(page.getByTestId("db-troop-event-command-area")).toContainText("◆");
  const eventsWidth = await page.getByTestId("db-troop-event-command-area").evaluate((node) => Math.round(node.getBoundingClientRect().width));
  expect(eventsWidth).toBeGreaterThan(520);
  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("troops-classic-layout.png") });
});
