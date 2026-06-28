import { expect, test } from "@playwright/test";
import { exportedProject } from "./rm2k3-database-helpers";

test("RM2K3 database modal exposes workbench context and footer status", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();

  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("db-workbench-status")).toContainText("주인공");
  await expect(page.getByTestId("db-workbench-status")).toContainText(/actor/i);
  await expect(page.getByTestId("db-footer-status")).toContainText("선택");
  await expect(page.getByTestId("database-footer-ok")).toBeVisible();
  await expect(page.getByTestId("database-footer-cancel")).toBeVisible();
  await expect(page.getByTestId("database-footer-apply")).toBeVisible();
});

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
  await page.getByTestId("db-field-enemy-exp").fill("77");
  await page.getByTestId("db-field-enemy-gold").fill("88");
  await page.getByTestId("db-picker-enemy-drop").selectOption({ index: 1 });
  await page.getByTestId("db-field-enemy-drop-rate").fill("35");
  await page.getByTestId("db-field-enemy-critical-enabled").check();
  await page.getByTestId("db-field-enemy-critical-one-in").fill("7");
  await page.getByTestId("db-field-enemy-normal-miss").check();
  await page.getByTestId("db-field-enemy-transparent").check();
  await page.getByTestId("db-field-enemy-flying").check();
  await page.getByTestId("db-picker-enemy-state-rate-state_poison").selectOption("A");
  await page.getByTestId("db-picker-enemy-element-rate-fire").selectOption("E");

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

test("BM88 Classes tab exposes Korean ontology fields and persists class settings", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-classes").click({ force: true });

  await expect(page.getByTestId("db-classes-bm88-workbench")).toBeVisible();
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("이름");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("옵션");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("능력치 곡선");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("경험치 곡선");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("스킬");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("상태 유효도");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("속성 유효도");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("전투 명령");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("애니메이션");

  await page.getByTestId("db-field-class-option-dualWield").check();
  await page.getByTestId("db-field-class-option-autoBattle").check();
  await page.getByTestId("db-picker-class-animation").selectOption({ index: 1 });
  await page.getByTestId("db-picker-class-state-rate-state_poison").selectOption("E");
  await page.getByTestId("db-picker-class-state-rate-state_sleep").selectOption("B");
  await page.getByTestId("db-picker-class-element-rate-fire").selectOption("B");
  await page.getByTestId("db-picker-class-element-rate-ice").selectOption("D");
  await page.getByTestId("db-field-class-command-name").fill("Arts");
  await page.getByTestId("db-class-curve-edit-maxHp").click();
  await expect(page.getByTestId("db-class-parameter-dialog")).toBeVisible();
  await page.getByTestId("db-class-parameter-dialog").screenshot({ path: testInfo.outputPath("bm88-parameter-curve-dialog.png") });
  await page.getByTestId("db-class-parameter-level").fill("10");
  await page.getByTestId("db-class-parameter-value").fill("777");
  await page.getByTestId("db-class-parameter-apply").click();
  await page.getByTestId("db-class-parameter-close").click();
  await expect(page.getByTestId("db-class-curve-edit-maxHp")).toContainText("Lv10:777");
  await page.getByTestId("db-class-exp-edit").click();
  await expect(page.getByTestId("db-class-exp-dialog")).toBeVisible();
  await page.getByTestId("db-class-exp-dialog").screenshot({ path: testInfo.outputPath("bm88-experience-curve-dialog.png") });
  await page.getByTestId("db-class-exp-base").fill("3");
  await page.getByTestId("db-class-exp-extra").fill("888");
  await page.getByTestId("db-class-exp-acceleration").fill("55");
  await page.getByTestId("db-class-exp-close").click();
  await expect(page.getByTestId("db-class-exp-summary")).toContainText("기본=3; 추가=888; 가속=55");

  const project = await exportedProject(page);
  const klass = project.database.classes.find((record) => record.battleCommands[0]?.name === "Arts");
  expect(klass?.options).toMatchObject({ dualWield: true, autoBattle: true });
  expect(klass?.animationId).toBeTruthy();
  expect(klass?.stateRates.state_poison).toBe("E");
  expect(klass?.stateRates.state_sleep).toBe("B");
  expect(klass?.elementRates.fire).toBe("B");
  expect(klass?.elementRates.ice).toBe("D");
  expect(klass?.battleCommands[0]).toMatchObject({ name: "Arts" });
  expect(klass?.parameterCurves.maxHp[9]).toBe(777);
  expect(klass?.expCurve).toMatchObject({ base: 3, extra: 888, acceleration: 55 });

  await page.locator(".rm2k3-detail-form").evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("bm88-classes-tab.png") });
});

test("RM2K3 database editor edits records, updates dependent pickers, and blocks referenced deletes", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  const recordSearch = page.locator(".db-search input").first();
  await recordSearch.pressSequentially("Hero");
  await expect(recordSearch).toBeFocused();
  await expect(recordSearch).toHaveValue("Hero");
  for (const id of [
    "db-tab-actors",
    "db-tab-classes",
    "db-tab-skills",
    "db-tab-items",
    "db-tab-equipment",
    "db-tab-enemies",
    "db-tab-troops",
    "db-tab-states",
    "db-tab-animations",
    "db-tab-tilesets",
    "db-tab-common-events",
    "db-tab-system",
    "db-tab-terms",
    "db-tab-switches",
    "db-tab-variables",
  ]) {
    await page.getByTestId(id).click();
    await expect(page.getByTestId("db-detail-form")).toBeVisible();
    await expect(page.getByTestId("database-modal")).not.toContainText("generated-");
  }

  await page.getByTestId("db-tab-skills").click();
  await page.getByTestId("db-add-record").click();
  await page.getByTestId("db-field-name").fill("Spark QA");
  await page.getByTestId("db-field-power").fill("41");
  await page.getByTestId("db-field-skill-description").fill("Spark test skill");
  await page.getByTestId("db-field-skill-mp-flat").fill("8");
  await page.getByTestId("db-field-skill-mp-percent").fill("12");
  await page.getByTestId("db-field-skill-success").fill("96");
  await expect(page.getByTestId("db-field-scope")).toContainText("적 전체");
  await page.getByTestId("db-tab-classes").click();
  await expect(page.getByTestId("db-picker-class-skill")).toContainText("Spark QA");

  await page.getByTestId("db-tab-actors").click();
  await expect(page.getByTestId("db-actor-state-rate-manual-note")).toContainText("States Page");
  await expect(page.getByTestId("db-actor-state-rate-state_poison")).toContainText("60%");
  await page.getByTestId("db-picker-actor-state-rate-state_poison").selectOption("B");
  await expect(page.getByTestId("db-actor-state-rate-state_poison")).toContainText("80%");
  await page.getByTestId("db-field-name").fill("Actor QA");
  await page.getByTestId("db-field-actor-nickname").fill("Tester");
  await page.getByTestId("db-field-initial-level").fill("0");
  await page.getByTestId("db-field-max-level").fill("120");
  await page.getByTestId("db-field-face-resource").fill("hero");
  await page.getByTestId("db-field-character-transparent").check();
  await page.getByTestId("db-field-actor-option-dualWield").check();
  await page.getByTestId("db-field-actor-skill-level-0").fill("7");
  await page.getByTestId("db-picker-actor-skill-0").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-classes").click();
  await expect(page.getByTestId("db-classes-bm88-workbench")).toBeVisible();
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("옵션");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("능력치 곡선");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("경험치 곡선");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("상태 유효도");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("속성 유효도");
  await expect(page.getByTestId("db-classes-bm88-workbench")).toContainText("애니메이션");
  await page.getByTestId("db-field-class-option-dualWield").check();
  await page.getByTestId("db-field-class-option-autoBattle").check();
  await page.getByTestId("db-picker-class-animation").selectOption({ index: 1 });
  await page.getByTestId("db-picker-class-state-rate-state_poison").selectOption("E");
  await page.getByTestId("db-picker-class-element-rate-fire").selectOption("B");
  await page.getByTestId("db-field-name").fill("Class QA");
  await page.getByTestId("db-field-class-command-name").fill("Arts");
  await page.getByTestId("db-field-class-command-kind").selectOption("skill");
  await page.getByTestId("db-field-class-skill-level").fill("12");
  await page.getByTestId("db-picker-class-skill").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-field-name").fill("Item QA");
  await page.getByTestId("db-field-item-description").fill("Potion with battle metadata");
  await page.getByTestId("db-field-item-type").selectOption("medicine");
  await page.getByTestId("db-field-item-consumption-limit").selectOption("2");
  await page.getByTestId("db-field-item-scope").selectOption("allAllies");
  await page.getByTestId("db-field-item-hp-flat").fill("25");
  await page.getByTestId("db-field-item-only-menu").check();
  await page.getByTestId("db-picker-skill").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-equipment").click();
  await page.getByTestId("db-field-name").fill("Equipment QA");
  await page.getByTestId("db-field-equipment-description").fill("Cursed blade");
  await page.getByTestId("db-field-equipment-attack").fill("77");
  await page.getByTestId("db-field-equipment-defense").fill("22");
  await page.getByTestId("db-field-equipment-cursed").check();
  await page.getByTestId("db-picker-equipment-use-skill").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-enemies").click();
  await page.getByTestId("db-add-record").click();
  await page.getByTestId("db-field-name").fill("Enemy QA");
  await page.getByTestId("db-field-enemy-max-hp").fill("4321");
  await page.getByTestId("db-field-enemy-exp").fill("55");
  await page.getByTestId("db-picker-enemy-drop").selectOption({ label: "Item QA" });
  await page.getByTestId("db-picker-enemy-action-skill").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-troops").click();
  await page.getByTestId("db-field-name").fill("Troop QA");
  await page.getByTestId("db-picker-troop-member-enemy").selectOption({ label: "Enemy QA" });
  await page.getByTestId("db-field-troop-member-x").fill("144");
  await page.getByTestId("db-field-troop-member-y").fill("88");
  await page.getByTestId("db-field-troop-member-hidden").check();
  await page.getByTestId("db-field-troop-backdrop").fill("battleback_qa");

  await page.getByTestId("db-tab-states").click();
  await page.getByTestId("db-field-name").fill("State QA");
  await page.getByTestId("db-tab-animations").click();
  await page.getByTestId("db-field-name").fill("Animation QA");
  await page.getByTestId("db-tab-system").click();
  await page.getByTestId("db-field-title-resource").fill("title_qa");
  await page.getByTestId("db-tab-terms").click();
  await page.getByTestId("db-field-gold").fill("Zenny");
  await page.getByTestId("db-field-skill-term").fill("Arts");

  await page.getByTestId("db-tab-skills").click();
  await page.getByTestId("db-delete-selected").click();
  await expect(page.getByTestId("toast")).toContainText("주인공이 이 스킬을 사용 중입니다.");
  await page.getByTestId("db-tab-enemies").click();
  await page.locator(".db-search input").fill("");
  await page.getByRole("button", { name: /Enemy QA/ }).click();
  await page.getByTestId("db-delete-selected").click();

  const project = await exportedProject(page);
  const actor = project.database.actors.find((record) => record.name === "Actor QA");
  expect(actor?.nickname).toBe("Tester");
  expect(actor?.learnedSkills).toEqual([{ level: 7, skillId: project.database.skills.find((skill) => skill.name === "Spark QA")?.id }]);
  expect(actor?.options.dualWield).toBe(true);
  expect(actor?.faceResourceId).toBe("hero");
  expect(actor?.characterTransparent).toBe(true);
  expect(actor?.stateRates.state_poison).toBe("B");
  expect(project.database.classes.some((record) => record.name === "Class QA")).toBe(true);
  const klass = project.database.classes.find((record) => record.name === "Class QA");
  const skill = project.database.skills.find((record) => record.name === "Spark QA");
  const item = project.database.items.find((record) => record.name === "Item QA");
  const equipment = project.database.equipment.find((record) => record.name === "Equipment QA");
  const enemy = project.database.enemies.find((record) => record.name === "Enemy QA");
  const troop = project.database.troops.find((record) => record.name === "Troop QA");
  expect(klass?.battleCommands[0]).toMatchObject({ name: "Arts", kind: "skill" });
  expect(klass?.learnedSkills[0]).toMatchObject({ level: 12, skillId: skill?.id });
  expect(klass?.options).toMatchObject({ dualWield: true, autoBattle: true });
  expect(klass?.animationId).toBeTruthy();
  expect(klass?.stateRates.state_poison).toBe("E");
  expect(klass?.elementRates.fire).toBe("B");
  expect(skill).toMatchObject({ description: "Spark test skill", mpCost: { flat: 8, percentMax: 12 }, successRate: 96 });
  expect(item).toMatchObject({
    description: "Potion with battle metadata",
    type: "medicine",
    occasion: "field",
    consumable: true,
    consumptionLimit: 2,
    scope: "allAllies",
    hpRecovery: { percentMax: 0, flat: 25 },
    onlyUsableInMenu: true,
  });
  expect(equipment).toMatchObject({ description: "Cursed blade", statBonuses: { attack: 77, defense: 22 }, cursed: true, usableAsItemSkillId: skill?.id });
  expect(enemy).toMatchObject({ stats: { maxHp: 4321, attack: 10 }, rewards: { exp: 55, dropItemId: item?.id }, actions: [{ skillId: skill?.id }] });
  expect(troop).toMatchObject({ members: [{ enemyId: enemy?.id, x: 144, y: 88, hidden: true }], previewBackgroundResourceId: "battleback_qa" });
  expect(project.database.states.some((record) => record.name === "State QA")).toBe(true);
  expect(project.database.battleAnimations.some((record) => record.name === "Animation QA")).toBe(true);
  expect(project.meta.terms.gold).toBe("Zenny");
  expect(project.meta.terms.skill).toBe("Arts");
  await page.screenshot({ path: testInfo.outputPath("database-editor.png"), fullPage: true });
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
  await expect(page.getByTestId("db-troop-event-command-area")).toContainText("@>");

  const metrics = await page.getByTestId("database-modal").evaluate((node) => {
    const modal = node.getBoundingClientRect();
    const preview = node.querySelector<HTMLElement>("[data-testid='db-troop-preview-stage']")?.getBoundingClientRect();
    const events = node.querySelector<HTMLElement>("[data-testid='db-troop-event-command-area']")?.getBoundingClientRect();
    return {
      modalWidth: Math.round(modal.width),
      previewWidth: Math.round(preview?.width ?? 0),
      previewLeft: Math.round((preview?.left ?? 0) - modal.left),
      eventsWidth: Math.round(events?.width ?? 0),
      eventsLeft: Math.round((events?.left ?? 0) - modal.left),
    };
  });
  expect(metrics.modalWidth).toBeGreaterThan(1300);
  expect(metrics.previewWidth).toBeGreaterThan(430);
  expect(metrics.previewLeft).toBeLessThan(metrics.eventsLeft);
  expect(metrics.eventsWidth).toBeGreaterThan(520);
  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("troops-classic-layout.png") });
});
