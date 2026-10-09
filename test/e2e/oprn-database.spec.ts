import { expect, test } from "@playwright/test";
import { exportedProject } from "./oprn-database-helpers";

test("RM2K3 database modal exposes footer status without duplicate workbench text row", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();

  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("db-workbench-status")).toHaveCount(0);
  await expect(page.getByTestId("db-footer-status")).toContainText("선택");
  await expect(page.getByTestId("database-footer-ok")).toBeVisible();
  await expect(page.getByTestId("database-footer-apply")).toBeVisible();
});
test("BM88 Classes tab exposes Korean ontology fields and persists class settings", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
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

  await page.locator(".oprn-detail-form").evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.getByTestId("database-modal").screenshot({ path: testInfo.outputPath("bm88-classes-tab.png") });
});

test("RM2K3 database editor edits records, updates dependent pickers, and blocks referenced deletes", async ({ page }, testInfo) => {
  // 전체 컬렉션을 한 번에 편집하는 긴 흐름 — 갤러리/섹션 내비 추가 이후 60s 로는 부족하다.
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
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
    "db-tab-enemies",
    "db-tab-troops",
    "db-tab-states",
    "db-subview-animations",
    "db-tab-tilesets",
    "db-tab-common-events",
    "db-tab-system",
    "db-tab-terms",
    "db-tab-switches",
    "db-tab-variables",
  ]) {
    // 전투 애니메이션은 도트 연출 레일 탭 아래 하위 보기다.
    if (id === "db-subview-animations") await page.getByTestId("db-tab-retro-choreographies").click();
    await page.getByTestId(id).click();
    await expect(page.getByTestId("db-detail-form")).toBeVisible();
    // generated- 임시 ID 가 UI 에 새지 않아야 한다. 예외: troops 요약 줄이 의도적으로
    // 전투 배경 리소스 ID(generated-battle-reference-forest)를 보여준다(9521aae6 이후).
    await expect(page.getByTestId("database-modal")).not.toContainText(/generated-(?!battle-reference-forest)/);
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
  // 대상은 T9 이후 세그먼트 컨트롤(네이티브 radio) — 레이블 클릭으로 선택.
  await page.getByTestId("db-field-item-scope").getByText("아군 전체").click();
  await page.getByTestId("db-field-item-hp-flat").fill("25");
  await page.getByTestId("db-field-item-occasion").selectOption("field");
  await expect(page.getByTestId("db-picker-skill")).toHaveCount(0);

  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-catalog-filter-equipment").click();
  await page.locator('.db-catalog-rows [data-collection="equipment"]').first().click();
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
  await page.getByTestId("db-tab-retro-choreographies").click();
  await page.getByTestId("db-subview-animations").click();
  await page.getByTestId("db-field-name").fill("Animation QA");
  await page.getByTestId("db-tab-system").click();
  // 타이틀 리소스 필드는 리소스 섹션에 있다(T11 섹션 내비 이후 기본 섹션은 초기 파티).
  await page.getByTestId("db-system-nav-resources").click();
  await page.getByTestId("db-field-title-resource").fill("title_qa");
  await page.getByTestId("db-tab-terms").click();
  await page.getByTestId("db-field-gold").fill("Zenny");
  await page.getByTestId("db-field-skill-term").fill("Arts");

  await page.getByTestId("db-tab-skills").click();
  await page.getByTestId("db-delete-selected").click();
  // fix(db): 삭제 거부 메시지가 어떤 레코드가 참조하는지(이름)도 포함하도록 풍부화됐다.
  await expect(page.getByTestId("toast")).toContainText("주인공 'Actor QA'이 이 스킬을 사용 중입니다.");
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
