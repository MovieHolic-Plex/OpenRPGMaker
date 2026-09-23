import { expect, test, type Page } from "@playwright/test";
import { DATABASE_TAB_SPECS, exportedProject, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

const ENEMIES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "enemies")!;
const ITEMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;
// 종족 탭은 oprn-database-helpers의 DATABASE_TAB_SPECS에 아직 없어 직접 정의한다(database.ts orderedTabs 기준).
const SPECIES_TAB = { label: "종족", slug: "monster-species", testId: "db-tab-monster-species" };

type ExportedEnemy = {
  id: string;
  name: string;
  speciesId?: string;
  monsterResourceId?: string;
  transparent?: boolean;
  flying?: boolean;
  criticalHit?: { enabled: boolean; oneIn: number };
  attackOptions?: { normalAttacksMiss: boolean };
  stats: Record<string, number>;
  rewards: { exp: number; gold?: number; dropItemId?: string; dropRatePercent?: number };
  actions: { skillId: string; priority?: number; condition?: { kind: string; start?: number; interval?: number }; switchOnAfterAction?: { enabled: boolean; switchId?: string } }[];
  stateRates?: Record<string, string>;
  elementRates?: Record<string, string>;
};

type ExportedSpecies = {
  id: string;
  name: string;
  captureRate: number;
  types?: string[];
  baseStats: Record<string, number>;
  graphic: { graphicHue: number; monsterResourceId?: string };
  skillsByLevel?: { level: number; skillId: string }[];
  evolutions?: { toSpeciesId: string; requires: { level?: number; friendshipAtLeast?: number } }[];
};

async function gotoExpertDatabase(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await openDatabase(page);
}

async function selectedRecordId(page: Page): Promise<string> {
  const row = page.locator(".db-list-row.active");
  await expect(row).toBeVisible();
  const id = await row.getAttribute("data-record-id");
  if (!id) throw new Error("no selected record row");
  return id;
}

async function selectSecondOption(page: Page, testid: string): Promise<string | undefined> {
  const select = page.getByTestId(testid);
  const options = await select.locator("option").all();
  if (options.length < 2) return undefined;
  const value = await options[1].getAttribute("value");
  if (value) await select.selectOption(value);
  return value ?? undefined;
}

test.describe("QA — enemies tab", () => {
  test("CRUD round trip: add, fill every panel, graphic dialog, tab away/back, export, duplicate, 2-step delete", async ({ page }) => {
    test.setTimeout(90_000); // 단계가 많아 기본 30s 예산을 초과한다
    await gotoExpertDatabase(page);
    await switchDatabaseTab(page, ENEMIES_TAB);
    await page.getByTestId("db-add-record").click();
    const id = await selectedRecordId(page);

    await page.getByTestId("db-field-name").fill("QA 몬스터");
    await page.getByTestId("db-field-enemy-max-hp").fill("777");
    await page.getByTestId("db-field-enemy-attack").fill("55");
    await page.getByTestId("db-field-enemy-mind").fill("44");
    await page.getByTestId("db-field-enemy-max-mp").fill("33");
    await page.getByTestId("db-field-enemy-defense").fill("22");
    await page.getByTestId("db-field-enemy-agility").fill("11");
    await page.getByTestId("db-field-enemy-transparent").check();
    await page.getByTestId("db-field-enemy-flying").check();

    // graphic dialog: open, pick first resource, confirm
    await page.getByTestId("db-enemy-graphic-set").click();
    const graphicDialog = page.getByTestId("db-enemy-graphic-dialog");
    await expect(graphicDialog).toBeVisible();
    const firstResource = graphicDialog.locator("[data-testid^='db-enemy-graphic-dialog-option-']").first();
    await expect(firstResource).toBeVisible();
    const pickedResourceId = await firstResource.getAttribute("data-resource-id");
    await firstResource.click();
    await page.getByTestId("db-enemy-graphic-dialog-ok").click();
    await expect(graphicDialog).toBeHidden();
    await expect(page.locator(".db-enemy-graphic-stage img").first()).toBeVisible();

    // species link
    const speciesValue = await selectSecondOption(page, "db-picker-enemy-species");

    // rewards
    await page.getByTestId("db-field-enemy-exp").fill("321");
    await page.getByTestId("db-field-enemy-gold").fill("654");
    const dropValue = await selectSecondOption(page, "db-picker-enemy-drop");
    await page.getByTestId("db-field-enemy-drop-rate").fill("42");

    // critical + options
    await page.getByTestId("db-field-enemy-critical-enabled").check();
    await page.getByTestId("db-field-enemy-critical-one-in").fill("8");
    await page.getByTestId("db-field-enemy-normal-miss").check();

    // rates
    await page.getByTestId("db-picker-enemy-state-rate-state_death").selectOption("A");
    await page.getByTestId("db-picker-enemy-element-rate-fire").selectOption("E");

    // action skill quick-select
    const actionSkill = await selectSecondOption(page, "db-picker-enemy-action-skill");

    // tab away and back: persistence in UI
    await switchDatabaseTab(page, ITEMS_TAB);
    await switchDatabaseTab(page, ENEMIES_TAB);
    await expect(page.locator(".db-list-row.active")).toContainText("QA 몬스터");
    await expect(page.getByTestId("db-field-name")).toHaveValue("QA 몬스터");
    await expect(page.getByTestId("db-field-enemy-max-hp")).toHaveValue("777");
    await expect(page.getByTestId("db-field-enemy-transparent")).toBeChecked();
    await expect(page.getByTestId("db-field-enemy-flying")).toBeChecked();
    await expect(page.getByTestId("db-field-enemy-drop-rate")).toHaveValue("42");
    await expect(page.getByTestId("db-field-enemy-critical-one-in")).toHaveValue("8");
    await expect(page.getByTestId("db-picker-enemy-state-rate-state_death")).toHaveValue("A");
    await expect(page.getByTestId("db-picker-enemy-element-rate-fire")).toHaveValue("E");

    // export: real project state
    const project = await exportedProject(page);
    const enemy = (project.database.enemies as unknown as ExportedEnemy[]).find((entry) => entry.id === id);
    expect(enemy, "exported enemy should exist").toBeTruthy();
    expect(enemy?.name).toBe("QA 몬스터");
    expect(enemy?.stats).toMatchObject({ maxHp: 777, attack: 55, mind: 44, maxMp: 33, defense: 22, agility: 11 });
    expect(enemy?.transparent).toBe(true);
    expect(enemy?.flying).toBe(true);
    if (pickedResourceId) expect(enemy?.monsterResourceId).toBe(pickedResourceId);
    if (speciesValue) expect(enemy?.speciesId).toBe(speciesValue);
    expect(enemy?.rewards).toMatchObject({ exp: 321, gold: 654, dropRatePercent: 42 });
    if (dropValue) expect(enemy?.rewards.dropItemId).toBe(dropValue);
    expect(enemy?.criticalHit).toEqual({ enabled: true, oneIn: 8 });
    expect(enemy?.attackOptions?.normalAttacksMiss).toBe(true);
    expect(enemy?.stateRates?.state_death).toBe("A");
    expect(enemy?.elementRates?.fire).toBe("E");
    if (actionSkill) expect(enemy?.actions[0]?.skillId).toBe(actionSkill);

    // duplicate
    await page.locator(".btn.small", { hasText: "복제" }).click();
    const duplicatedId = await selectedRecordId(page);
    expect(duplicatedId).not.toBe(id);
    await expect(page.getByTestId("db-field-name")).toHaveValue("QA 몬스터 사본");

    // delete: two-step confirm
    const deleteButton = page.getByTestId("db-delete-selected");
    await deleteButton.click();
    await expect(deleteButton).toHaveText("정말 삭제?");
    await expect(page.getByTestId(`db-record-row-${duplicatedId}`)).toBeVisible();
    await deleteButton.click();
    await expect(page.getByTestId(`db-record-row-${duplicatedId}`)).toBeHidden();
  });

  test("attack pattern dialog (keyboard path): Enter opens, edits persist to export, Cancel discards", async ({ page }) => {
    // NOTE: 마우스 dblclick/우클릭 경로는 .db-enemy-attack-patterns 컨테이너가 0px로
    // 붕괴되어 도달 불가(보고서 결함 참조). 키보드 Enter 경로는 동작하므로 이 계약만 고정한다.
    await gotoExpertDatabase(page);
    await switchDatabaseTab(page, ENEMIES_TAB);
    await page.locator(".db-list-row").first().click();

    const row = page.getByTestId("db-enemy-action-row-0");
    await row.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByTestId("db-enemy-action-dialog");
    await expect(dialog).toBeVisible();

    await page.getByTestId("db-enemy-action-rating").fill("77");
    await page.getByTestId("db-enemy-action-condition-type").selectOption("turn");
    await page.getByTestId("db-enemy-action-turn-start").fill("3");
    await page.getByTestId("db-enemy-action-turn-interval").fill("2");
    await page.getByTestId("db-enemy-action-switch-on-enabled").check();
    await page.getByTestId("db-enemy-action-ok").click();
    await expect(dialog).toBeHidden();

    const project = await exportedProject(page);
    const action = (project.database.enemies as unknown as ExportedEnemy[])[0].actions[0];
    expect(action.priority).toBe(77);
    expect(action.condition).toMatchObject({ kind: "turn", start: 3, interval: 2 });
    expect(action.switchOnAfterAction?.enabled).toBe(true);

    // reopen: dialog reflects stored values; Cancel discards edits
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("db-enemy-action-rating")).toHaveValue("77");
    await expect(page.getByTestId("db-enemy-action-condition-type")).toHaveValue("turn");
    await page.getByTestId("db-enemy-action-rating").fill("11");
    await page.getByTestId("db-enemy-action-cancel").click();
    await expect(dialog).toBeHidden();
    const afterCancel = await exportedProject(page);
    expect((afterCancel.database.enemies as unknown as ExportedEnemy[])[0].actions[0].priority).toBe(77);
  });

  test("boundary clamps: stats/rewards/critical normalize on update, empty name placeholder", async ({ page }) => {
    await gotoExpertDatabase(page);
    await switchDatabaseTab(page, ENEMIES_TAB);
    await page.getByTestId("db-add-record").click();

    await page.getByTestId("db-field-enemy-max-hp").fill("-5");
    await page.getByTestId("db-field-enemy-attack").fill("99999");
    await page.getByTestId("db-field-enemy-exp").fill("-3");
    await page.getByTestId("db-field-enemy-drop-rate").fill("999");
    // 치명타 확률은 「사용」에 종속된다 — 꺼진 상태에서는 잠긴다(꺼져 있으면 전투가 이 값을
    // 읽지 않으므로, 편집을 받아 주면 저장은 되고 효과는 없는 죽은 입력이 된다).
    // 새 레코드의 기본값은 enabled:false 이므로 클램프를 확인하려면 먼저 켠다.
    await page.getByTestId("db-field-enemy-critical-enabled").check();
    await page.getByTestId("db-field-enemy-critical-one-in").fill("0");
    await switchDatabaseTab(page, ITEMS_TAB);
    await switchDatabaseTab(page, ENEMIES_TAB);
    await expect(page.getByTestId("db-field-enemy-max-hp")).toHaveValue("1");
    await expect(page.getByTestId("db-field-enemy-attack")).toHaveValue("999");
    await expect(page.getByTestId("db-field-enemy-exp")).toHaveValue("0");
    await expect(page.getByTestId("db-field-enemy-drop-rate")).toHaveValue("100");
    await expect(page.getByTestId("db-field-enemy-critical-one-in")).toHaveValue("1");

    await page.getByTestId("db-field-name").fill("");
    await switchDatabaseTab(page, ITEMS_TAB);
    await switchDatabaseTab(page, ENEMIES_TAB);
    await expect(page.locator(".db-list-row.active")).toContainText("(이름 없음)");
  });

  test("undo: name edit reverts with Ctrl+Z", async ({ page }) => {
    await gotoExpertDatabase(page);
    await switchDatabaseTab(page, ENEMIES_TAB);
    await page.locator(".db-list-row").first().click();
    const nameField = page.getByTestId("db-field-name");
    const original = await nameField.inputValue();
    await nameField.fill("Undo몬스터");
    await switchDatabaseTab(page, ITEMS_TAB);
    await switchDatabaseTab(page, ENEMIES_TAB);
    await expect(page.getByTestId("db-field-name")).toHaveValue("Undo몬스터");
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("db-field-name")).toHaveValue(original);
  });
});

// 종족 상세는 「기본·포획·성장·진화·연결」 구역 탭으로 나뉜다 — 칸은 모두 DOM 에 있지만 고른 구역만
// 보이므로, fill()/check() 전에 그 칸의 구역을 연다(toHaveValue 는 숨은 칸에도 통한다).
async function openSpeciesSection(page: Page, section: "basic" | "capture" | "growth" | "evolution" | "links"): Promise<void> {
  await page.getByTestId(`db-monster-species-section-tab-${section}`).click();
  await expect(page.getByTestId(`db-monster-species-section-tab-${section}`)).toHaveAttribute("aria-selected", "true");
}

test.describe("QA — Species tab", () => {
  test("CRUD round trip: add, fill fields, resource dialog, parse round trips, export, delete", async ({ page }) => {
    test.setTimeout(90_000); // 단계가 많아 기본 30s 예산을 초과한다
    await gotoExpertDatabase(page);
    await switchDatabaseTab(page, SPECIES_TAB);
    await page.getByTestId("db-monster-species-add").click();
    const id = await selectedRecordId(page);

    // wave2 fix: updateSpecies 콜백들이 store에서 레코드를 refetch하므로(currentSpecies)
    // 리소스 다이얼로그 확정 순서와 Hue 입력 순서가 서로의 값을 지우지 않는다.
    await page.getByTestId("db-monster-species-resource-set").click();
    const resourceDialog = page.getByTestId("db-monster-species-resource-dialog");
    await expect(resourceDialog).toBeVisible();
    const firstResource = resourceDialog.locator("[data-testid^='db-monster-species-resource-dialog-option-']").first();
    await expect(firstResource).toBeVisible();
    const pickedResourceId = await firstResource.getAttribute("data-resource-id");
    await firstResource.click();
    await page.getByTestId("db-monster-species-resource-dialog-ok").click();
    await expect(resourceDialog).toBeHidden();

    await page.getByTestId("db-monster-species-name").fill("QA종");
    await page.getByTestId("db-monster-species-type-fire").check();
    await page.getByTestId("db-monster-species-type-water").check();
    await page.getByTestId("db-monster-species-hue").fill("120");
    await openSpeciesSection(page, "capture");
    await page.getByTestId("db-monster-species-capture-rate").fill("0.5");
    await openSpeciesSection(page, "growth");
    // wave2 fix: 능력치 6종을 rerender 없이 연달아 편집해도(HP→MP→공격→방어→정신→민첩)
    // 전부 저장된다(이전에는 스테일 클로저로 마지막 필드만 살아남았다 — 보고서 결함 참조).
    await page.getByTestId("db-monster-species-hp").fill("64");
    await page.getByTestId("db-monster-species-mp").fill("30");
    await page.getByTestId("db-monster-species-atk").fill("21");
    await page.getByTestId("db-monster-species-def").fill("22");
    await page.getByTestId("db-monster-species-mind").fill("23");
    await page.getByTestId("db-monster-species-agi").fill("24");
    // 레벨별 스킬: 드롭다운 행 편집기(스킬 추가 → 레벨 입력 + 스킬 선택). 값 편집은 rerender 없이
    // store만 갱신하고, 행 추가는 rerender 하므로 이전 행 값이 보존된다.
    await page.getByTestId("db-monster-species-skill-add").click();
    await page.getByTestId("db-monster-species-skill-level-0").fill("3");
    await page.getByTestId("db-monster-species-skill-0").selectOption("skill_attack");
    await page.getByTestId("db-monster-species-skill-add").click();
    await page.getByTestId("db-monster-species-skill-level-1").fill("7");
    await page.getByTestId("db-monster-species-skill-1").selectOption("skill_fire");
    // 진화: 대상 종족 드롭다운 + 조건(레벨/친밀도)
    await openSpeciesSection(page, "evolution");
    await page.getByTestId("db-monster-species-evo-add").click();
    await page.getByTestId("db-monster-species-evo-target-0").selectOption("species_king_slime");
    await page.getByTestId("db-monster-species-evo-level-0").fill("7");
    await page.getByTestId("db-monster-species-evo-friendship-0").fill("220");

    // tab away/back: persistence (선택 상태 + 값)
    await switchDatabaseTab(page, ENEMIES_TAB);
    await switchDatabaseTab(page, SPECIES_TAB);
    await expect(page.getByTestId(`db-monster-species-row-${id}`)).toHaveClass(/active/);
    await expect(page.getByTestId("db-monster-species-name")).toHaveValue("QA종");
    await expect(page.getByTestId("db-monster-species-type-fire")).toBeChecked();
    await expect(page.getByTestId("db-monster-species-type-water")).toBeChecked();
    await expect(page.getByTestId("db-monster-species-hue")).toHaveValue("120");
    await expect(page.getByTestId("db-monster-species-capture-rate")).toHaveValue("0.5");
    await expect(page.getByTestId("db-monster-species-hp")).toHaveValue("64");
    await expect(page.getByTestId("db-monster-species-mp")).toHaveValue("30");
    await expect(page.getByTestId("db-monster-species-atk")).toHaveValue("21");
    await expect(page.getByTestId("db-monster-species-def")).toHaveValue("22");
    await expect(page.getByTestId("db-monster-species-mind")).toHaveValue("23");
    await expect(page.getByTestId("db-monster-species-agi")).toHaveValue("24");
    await expect(page.getByTestId("db-monster-species-skill-level-0")).toHaveValue("3");
    await expect(page.getByTestId("db-monster-species-skill-0")).toHaveValue("skill_attack");
    await expect(page.getByTestId("db-monster-species-skill-level-1")).toHaveValue("7");
    await expect(page.getByTestId("db-monster-species-skill-1")).toHaveValue("skill_fire");
    await expect(page.getByTestId("db-monster-species-evo-target-0")).toHaveValue("species_king_slime");
    await expect(page.getByTestId("db-monster-species-evo-level-0")).toHaveValue("7");
    await expect(page.getByTestId("db-monster-species-evo-friendship-0")).toHaveValue("220");

    // export: real project state
    const project = await exportedProject(page) as unknown as { database: { monsterSpecies?: ExportedSpecies[] } };
    const species = (project.database.monsterSpecies ?? []).find((entry) => entry.id === id);
    expect(species, "exported species should exist").toBeTruthy();
    expect(species?.name).toBe("QA종");
    expect(species?.types).toEqual(["fire", "water"]);
    expect(species?.graphic.graphicHue).toBe(120);
    expect(species?.captureRate).toBe(0.5);
    expect(species?.baseStats.maxHp).toBe(64);
    expect(species?.baseStats.maxMp).toBe(30);
    expect(species?.baseStats.attack).toBe(21);
    expect(species?.baseStats.defense).toBe(22);
    expect(species?.baseStats.mind).toBe(23);
    expect(species?.baseStats.agility).toBe(24);
    expect(species?.skillsByLevel).toEqual([{ level: 3, skillId: "skill_attack" }, { level: 7, skillId: "skill_fire" }]);
    expect(species?.evolutions).toEqual([{ toSpeciesId: "species_king_slime", requires: { level: 7, friendshipAtLeast: 220 } }]);
    if (pickedResourceId) expect(species?.graphic.monsterResourceId).toBe(pickedResourceId);

    // duplicate: "이름 사본" 접미사(wave2 fix) + 2단계 삭제(참조 가드 재사용)
    await page.getByTestId("db-monster-species-duplicate").click();
    const duplicatedId = await selectedRecordId(page);
    expect(duplicatedId).not.toBe(id);
    await expect(page.getByTestId("db-monster-species-name")).toHaveValue("QA종 사본");
    await openSpeciesSection(page, "basic");

    const deleteButton = page.getByTestId("db-monster-species-delete");
    await deleteButton.click();
    await expect(deleteButton).toHaveText("정말 삭제?");
    await expect(page.getByTestId(`db-monster-species-row-${duplicatedId}`)).toBeVisible();
    await deleteButton.click();
    await expect(page.getByTestId(`db-monster-species-row-${duplicatedId}`)).toBeHidden();

    // 원본도 2단계 삭제로 제거 후 undo로 복원
    await page.getByTestId(`db-monster-species-row-${id}`).click();
    await deleteButton.click();
    await deleteButton.click();
    await expect(page.getByTestId(`db-monster-species-row-${id}`)).toBeHidden();
    // undo restores the deleted species
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId(`db-monster-species-row-${id}`)).toBeVisible();
  });

  test("boundary clamps: captureRate 0~1, hue 0~360, stats min, types max 2", async ({ page }) => {
    await gotoExpertDatabase(page);
    await switchDatabaseTab(page, SPECIES_TAB);
    await page.getByTestId("db-monster-species-add").click();

    await openSpeciesSection(page, "capture");
    await page.getByTestId("db-monster-species-capture-rate").fill("5");
    await openSpeciesSection(page, "growth");
    await page.getByTestId("db-monster-species-hp").fill("-10");
    await openSpeciesSection(page, "basic");
    await page.getByTestId("db-monster-species-hue").fill("999");
    await page.getByTestId("db-monster-species-type-fire").check();
    await page.getByTestId("db-monster-species-type-water").check();
    await page.getByTestId("db-monster-species-type-grass").click();
    await expect(page.getByTestId("db-monster-species-type-grass")).not.toBeChecked();
    await switchDatabaseTab(page, ENEMIES_TAB);
    await switchDatabaseTab(page, SPECIES_TAB);
    await expect(page.getByTestId("db-monster-species-capture-rate")).toHaveValue("1");
    await expect(page.getByTestId("db-monster-species-hue")).toHaveValue("360");
    await expect(page.getByTestId("db-monster-species-hp")).toHaveValue("1");
    await expect(page.getByTestId("db-monster-species-type-fire")).toBeChecked();
    await expect(page.getByTestId("db-monster-species-type-water")).toBeChecked();
    await expect(page.getByTestId("db-monster-species-type-grass")).not.toBeChecked();
  });

  test("undo: species name edit reverts with Ctrl+Z", async ({ page }) => {
    await gotoExpertDatabase(page);
    await switchDatabaseTab(page, SPECIES_TAB);
    await page.locator(".db-list-row").first().click();
    const nameField = page.getByTestId("db-monster-species-name");
    const original = await nameField.inputValue();
    await nameField.fill("Undo종이름");
    await switchDatabaseTab(page, ENEMIES_TAB);
    await switchDatabaseTab(page, SPECIES_TAB);
    await expect(page.getByTestId("db-monster-species-name")).toHaveValue("Undo종이름");
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("db-monster-species-name")).toHaveValue(original);
  });
});
