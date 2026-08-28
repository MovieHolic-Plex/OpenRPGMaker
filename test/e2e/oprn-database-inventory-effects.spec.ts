import { expect, test } from "@playwright/test";
import {
  applyDatabaseChanges,
  closeAndReopenDatabase,
  exportedProject,
  openDatabase,
} from "./oprn-database-helpers";

test("Database inventory/effects tabs persist skill, item, equipment, and state edits after reopen", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  // DB 툴바(toolbar-database)는 expert chrome 에서만 노출된다.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");

  await openDatabase(page);

  await page.getByTestId("db-tab-skills").click();
  await page.getByTestId("db-field-name").fill("QA 포커스");
  await page.getByTestId("db-field-scope").selectOption("ally");
  await page.getByTestId("db-field-power").fill("44");
  await page.getByTestId("db-picker-animation").selectOption("anim_heal");
  await page.getByTestId("db-field-skill-description").fill("QA support proof");
  await page.getByTestId("db-field-skill-mp-flat").fill("6");
  await page.getByTestId("db-field-skill-success").fill("88");
  await page.getByTestId("db-field-skill-hit-rate").fill("92");
  await page.getByTestId("db-field-skill-effect-kind").selectOption("healing");
  await page.getByTestId("db-field-skill-effect-affects").selectOption("mp");

  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-field-name").fill("QA 만능약");
  await page.getByTestId("db-field-item-type").selectOption("medicine");
  await page.getByTestId("db-field-item-consumption-limit").selectOption("2");
  // 대상은 T9 이후 세그먼트 컨트롤(네이티브 radio) — 레이블 클릭으로 선택.
  await page.getByTestId("db-field-item-scope").getByText("아군 전체").click();
  await page.getByTestId("db-field-item-state-state_poison").check();
  // 회복 % 는 T9 이후 슬라이더+스테퍼 쌍 — 스테퍼(number input)에 값을 입력한다.
  await page.getByTestId("db-field-item-hp-percent-stepper").fill("15");
  await page.getByTestId("db-field-item-mp-flat").fill("8");

  await page.getByTestId("db-tab-equipment").click();
  await page.getByTestId("db-field-name").fill("QA 부적검");
  // 부위는 헤더 세그먼트(네이티브 radio) 하나뿐 — 중복이던 레거시 <select> 는 제거됐다.
  await page.locator('[data-testid="db-field-equipment-slot-option"][value="weapon"]').check();
  await page.getByTestId("db-field-equipment-description").fill("QA equipment proof");
  await page.getByTestId("db-field-equipment-attack").fill("13");
  await page.getByTestId("db-field-equipment-defense").fill("4");
  await page.getByTestId("db-field-equipment-two-handed").check();
  await page.getByTestId("db-field-equipment-actor-actor_hero").check();
  await page.getByTestId("db-field-equipment-state-state_poison").check();
  await page.getByTestId("db-picker-equipment-use-skill").selectOption({ label: "QA 포커스" });

  await page.getByTestId("db-tab-states").click();
  await page.getByTestId("db-field-name").fill("QA 독 상태");

  await applyDatabaseChanges(page);
  await closeAndReopenDatabase(page);

  const project = await exportedProject(page);
  expect(project.database.skills.find((record) => record.name === "QA 포커스")).toMatchObject({
    animationId: "anim_heal",
    description: "QA support proof",
    effect: { affects: "mp", kind: "healing", statistic: "mind" },
    hitRate: 92,
    mpCost: { flat: 6, percentMax: 0 },
    power: 44,
    scope: "ally",
    successRate: 88,
  });
  expect(project.database.items.find((record) => record.name === "QA 만능약")).toMatchObject({
    consumptionLimit: 2,
    healStateIds: ["state_poison"],
    // 기본 선택 레코드는 예제 프로젝트 첫 아이템(회복약, hp flat 50) — 그대로 유지된다.
    hpRecovery: { flat: 50, percentMax: 15 },
    mpRecovery: { flat: 8, percentMax: 0 },
    scope: "allAllies",
    type: "medicine",
  });
  expect(project.database.equipment.find((record) => record.name === "QA 부적검")).toMatchObject({
    description: "QA equipment proof",
    equippableActorIds: expect.arrayContaining(["actor_hero"]),
    stateInflictIds: ["state_poison"],
    statBonuses: { attack: 13, defense: 4 },
    twoHanded: true,
    usableAsItemSkillId: "skill_attack",
  });
  expect(project.database.states.find((record) => record.name === "QA 독 상태")).toBeTruthy();
});
