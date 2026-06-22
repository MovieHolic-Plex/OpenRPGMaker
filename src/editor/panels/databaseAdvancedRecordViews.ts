import {
  emptyToUndefined,
  numberField,
  selectField,
  selectLiteral,
  textField,
} from "@/editor/panels/databaseControls";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { ClassRecord, EnemyRecord, EquipmentRecord, ItemRecord, SkillRecord, TroopRecord } from "@/project/types";
import { el } from "@/util/dom";

export function renderClassRecordForm(form: HTMLElement, record: ClassRecord): void {
  const command = record.battleCommands[0] ?? { id: "cmd_attack", name: "공격", kind: "attack" as const };
  const learned = record.learnedSkills[0] ?? { level: 1, skillId: "" };
  form.append(
    panel("전투 명령", [
      textField("명령", "db-field-class-command-name", command.name, (name) =>
        updateDatabaseRecord("classes", record.id, { battleCommands: [{ ...currentClassCommand(record.id, command), name }] })
      ),
      selectLiteral("종류", "db-field-class-command-kind", command.kind, ["attack", "skill", "skillSubset", "defend", "item", "escape", "event"], (kind) =>
        updateDatabaseRecord("classes", record.id, { battleCommands: [{ ...currentClassCommand(record.id, command), kind }] })
      ),
    ]),
    panel("스킬 습득", [
      numberField("레벨", "db-field-class-skill-level", learned.level, (level) =>
        updateDatabaseRecord("classes", record.id, { learnedSkills: [{ ...currentClassSkill(record.id, learned), level }] })
      ),
      selectField("스킬", "db-picker-class-skill", learned.skillId, store.getCurrent().database.skills, (skillId) =>
        updateDatabaseRecord("classes", record.id, { learnedSkills: skillId ? [{ ...currentClassSkill(record.id, learned), skillId }] : [] })
      ),
    ]),
    panel("장비와 저항", [
      selectField("장비", "db-picker-class-equipment", record.equipmentPermissions.equipmentIds[0] ?? "", store.getCurrent().database.equipment, (equipmentId) =>
        updateDatabaseRecord("classes", record.id, {
          equipmentPermissions: { ...record.equipmentPermissions, equipmentIds: equipmentId ? [equipmentId] : [] },
        })
      ),
      rateSummary("상태", record.stateRates),
      rateSummary("속성", record.elementRates),
    ])
  );
}

export function renderSkillRecordForm(form: HTMLElement, record: SkillRecord): void {
  form.append(
    textField("설명", "db-field-skill-description", record.description, (description) =>
      updateDatabaseRecord("skills", record.id, { description })
    ),
    selectLiteral("종류", "db-field-skill-type", record.type, ["normal", "teleport", "escape", "switch"], (type) =>
      updateDatabaseRecord("skills", record.id, { type })
    ),
    panel("소모와 명중", [
      numberField("MP", "db-field-skill-mp-flat", record.mpCost.flat, (flat) =>
        updateDatabaseRecord("skills", record.id, { mpCost: { ...currentSkillMpCost(record.id, record.mpCost), flat } })
      ),
      numberField("MP %", "db-field-skill-mp-percent", record.mpCost.percentMax, (percentMax) =>
        updateDatabaseRecord("skills", record.id, { mpCost: { ...currentSkillMpCost(record.id, record.mpCost), percentMax } })
      ),
      numberField("성공률", "db-field-skill-success", record.successRate, (successRate) =>
        updateDatabaseRecord("skills", record.id, { successRate })
      ),
      numberField("분산", "db-field-skill-variance", record.variance, (variance) =>
        updateDatabaseRecord("skills", record.id, { variance })
      ),
    ])
  );
}

export function renderItemRecordForm(form: HTMLElement, record: ItemRecord): void {
  const effect = record.stateEffects[0] ?? { stateId: "state_death", chance: 100, operation: "remove" as const };
  form.append(
    resourcePreviewPanel("아이템 그래픽", [
      imagePreview("이미지", record.imageResourceId),
      textField("이미지", "db-field-item-image-resource", record.imageResourceId ?? "", (imageResourceId) =>
        updateDatabaseRecord("items", record.id, { imageResourceId: emptyToUndefined(imageResourceId) })
      ),
      imagePreview("아이콘", record.iconResourceId),
      textField("아이콘", "db-field-item-icon-resource", record.iconResourceId ?? "", (iconResourceId) =>
        updateDatabaseRecord("items", record.id, { iconResourceId: emptyToUndefined(iconResourceId) })
      ),
    ]),
    textField("설명", "db-field-item-description", record.description, (description) =>
      updateDatabaseRecord("items", record.id, { description })
    ),
    selectLiteral("종류", "db-field-item-type", record.type, ["normal", "key", "switch", "skillBook"], (type) =>
      updateDatabaseRecord("items", record.id, { type })
    ),
    selectLiteral("사용 가능", "db-field-item-occasion", record.occasion, ["always", "battle", "field", "never"], (occasion) =>
      updateDatabaseRecord("items", record.id, { occasion })
    ),
    checkboxField("소모품", "db-field-item-consumable", record.consumable, (consumable) =>
      updateDatabaseRecord("items", record.id, { consumable })
    ),
    panel("상태 효과", [
      selectField("상태", "db-picker-item-state", effect.stateId, [{ id: "state_death", name: "전투불능" }, ...store.getCurrent().database.states], (stateId) =>
        updateDatabaseRecord("items", record.id, { stateEffects: [{ ...effect, stateId }] })
      ),
      numberField("확률", "db-field-item-state-chance", effect.chance, (chance) =>
        updateDatabaseRecord("items", record.id, { stateEffects: [{ ...effect, chance }] })
      ),
    ])
  );
}

export function renderEquipmentRecordForm(form: HTMLElement, record: EquipmentRecord): void {
  form.append(
    resourcePreviewPanel("장비 그래픽", [
      imagePreview("이미지", record.imageResourceId),
      textField("이미지", "db-field-equipment-image-resource", record.imageResourceId ?? "", (imageResourceId) =>
        updateDatabaseRecord("equipment", record.id, { imageResourceId: emptyToUndefined(imageResourceId) })
      ),
      imagePreview("아이콘", record.iconResourceId),
      textField("아이콘", "db-field-equipment-icon-resource", record.iconResourceId ?? "", (iconResourceId) =>
        updateDatabaseRecord("equipment", record.id, { iconResourceId: emptyToUndefined(iconResourceId) })
      ),
    ]),
    textField("설명", "db-field-equipment-description", record.description, (description) =>
      updateDatabaseRecord("equipment", record.id, { description })
    ),
    panel("능력치", [
      numberField("공격력", "db-field-equipment-attack", record.statBonuses.attack, (attack) =>
        updateDatabaseRecord("equipment", record.id, { statBonuses: { ...currentEquipmentBonuses(record.id, record.statBonuses), attack } })
      ),
      numberField("방어력", "db-field-equipment-defense", record.statBonuses.defense, (defense) =>
        updateDatabaseRecord("equipment", record.id, { statBonuses: { ...currentEquipmentBonuses(record.id, record.statBonuses), defense } })
      ),
    ]),
    selectField("직업", "db-picker-equipment-class", record.equippableClassIds[0] ?? "", store.getCurrent().database.classes, (classId) =>
      updateDatabaseRecord("equipment", record.id, { equippableClassIds: classId ? [classId] : [] })
    ),
    selectField("사용 스킬", "db-picker-equipment-use-skill", record.usableAsItemSkillId ?? "", store.getCurrent().database.skills, (usableAsItemSkillId) =>
      updateDatabaseRecord("equipment", record.id, { usableAsItemSkillId: emptyToUndefined(usableAsItemSkillId) })
    ),
    checkboxField("저주", "db-field-equipment-cursed", record.cursed, (cursed) => updateDatabaseRecord("equipment", record.id, { cursed }))
  );
}

export function renderEnemyRecordForm(form: HTMLElement, record: EnemyRecord): void {
  const action = record.actions[0] ?? { skillId: "", priority: 5, condition: { kind: "always" as const } };
  form.append(
    resourcePreviewPanel("몬스터 그래픽", [
      imagePreview("몬스터", record.monsterResourceId),
      textField("몬스터", "db-field-enemy-monster-resource", record.monsterResourceId ?? "", (monsterResourceId) =>
        updateDatabaseRecord("enemies", record.id, { monsterResourceId: emptyToUndefined(monsterResourceId) })
      ),
    ]),
    panel("능력치", [
      numberField("최대 HP", "db-field-enemy-max-hp", record.stats.maxHp, (maxHp) =>
        updateDatabaseRecord("enemies", record.id, { stats: { ...record.stats, maxHp } })
      ),
      numberField("공격력", "db-field-enemy-attack", record.stats.attack, (attack) =>
        updateDatabaseRecord("enemies", record.id, { stats: { ...record.stats, attack } })
      ),
    ]),
    panel("보상", [
      numberField("경험치", "db-field-enemy-exp", record.rewards.exp, (exp) =>
        updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemyRewards(record.id, record.rewards), exp } })
      ),
      selectField("드롭", "db-picker-enemy-drop", record.rewards.dropItemId ?? "", store.getCurrent().database.items, (dropItemId) =>
        updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemyRewards(record.id, record.rewards), dropItemId: emptyToUndefined(dropItemId) } })
      ),
    ]),
    selectField("행동", "db-picker-enemy-action-skill", action.skillId, store.getCurrent().database.skills, (skillId) =>
      updateDatabaseRecord("enemies", record.id, { actions: skillId ? [{ ...action, skillId }] : [] })
    )
  );
}

export function renderTroopRecordForm(form: HTMLElement, record: TroopRecord): void {
  const member = record.members?.[0] ?? { enemyId: "", x: 160, y: 120, hidden: false };
  const memberEnemy = store.getCurrent().database.enemies.find((enemy) => enemy.id === member.enemyId);
  form.append(
    selectField("적", "db-picker-troop-member-enemy", member.enemyId, store.getCurrent().database.enemies, (enemyId) =>
      updateDatabaseRecord("troops", record.id, { members: enemyId ? [{ ...currentTroopMember(record.id, member), enemyId }] : [] })
    ),
    resourcePreviewPanel("멤버 미리보기", [
      imagePreview(memberEnemy?.name ?? "적", memberEnemy?.monsterResourceId),
      el("div", { class: "db-preview", text: memberEnemy?.monsterResourceId ?? "(없음)" }),
    ]),
    panel("배치", [
      numberField("X", "db-field-troop-member-x", member.x, (x) =>
        updateDatabaseRecord("troops", record.id, { members: [{ ...currentTroopMember(record.id, member), x }] })
      ),
      numberField("Y", "db-field-troop-member-y", member.y, (y) =>
        updateDatabaseRecord("troops", record.id, { members: [{ ...currentTroopMember(record.id, member), y }] })
      ),
      checkboxField("숨김", "db-field-troop-member-hidden", member.hidden ?? false, (hidden) =>
        updateDatabaseRecord("troops", record.id, { members: [{ ...currentTroopMember(record.id, member), hidden }] })
      ),
    ]),
    textField("배경", "db-field-troop-backdrop", record.previewBackgroundResourceId ?? "", (previewBackgroundResourceId) =>
      updateDatabaseRecord("troops", record.id, { previewBackgroundResourceId: emptyToUndefined(previewBackgroundResourceId) })
    ),
    el("div", { class: "db-preview", text: `전투 이벤트 페이지: ${record.battleEventPages.length}` })
  );
}

function panel(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

function resourcePreviewPanel(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel db-resource-panel", children: [el("legend", { text: title }), ...children] });
}

function imagePreview(label: string, resourceId: string | undefined): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const visual = url
    ? el("img", { attrs: { alt: `${label} 미리보기`, src: url } })
    : el("strong", { text: resourceId ?? "(없음)" });
  return el("div", { class: "db-image-preview", children: [el("span", { text: label }), visual] });
}

function checkboxField(label: string, testid: string, checked: boolean, onInput: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onInput(input.checked));
  return el("label", { class: "actor-check", children: [input, el("span", { text: label })] });
}

function rateSummary(label: string, rates: Record<string, string>): HTMLElement {
  const cCount = Object.values(rates).filter((grade) => grade === "C").length;
  return el("div", { class: "db-preview", text: `${label} 저항: 기본 C 등급 ${cCount}개` });
}

function currentClassCommand(classId: string, fallback: ClassRecord["battleCommands"][number]): ClassRecord["battleCommands"][number] {
  return store.getCurrent().database.classes.find((record) => record.id === classId)?.battleCommands[0] ?? fallback;
}

function currentClassSkill(classId: string, fallback: ClassRecord["learnedSkills"][number]): ClassRecord["learnedSkills"][number] {
  return store.getCurrent().database.classes.find((record) => record.id === classId)?.learnedSkills[0] ?? fallback;
}

type TroopMember = NonNullable<TroopRecord["members"]>[number];

function currentTroopMember(troopId: string, fallback: TroopMember): TroopMember {
  return store.getCurrent().database.troops.find((record) => record.id === troopId)?.members?.[0] ?? fallback;
}

function currentEnemyRewards(enemyId: string, fallback: EnemyRecord["rewards"]): EnemyRecord["rewards"] {
  return store.getCurrent().database.enemies.find((record) => record.id === enemyId)?.rewards ?? fallback;
}

function currentSkillMpCost(skillId: string, fallback: SkillRecord["mpCost"]): SkillRecord["mpCost"] {
  return store.getCurrent().database.skills.find((record) => record.id === skillId)?.mpCost ?? fallback;
}

function currentEquipmentBonuses(equipmentId: string, fallback: EquipmentRecord["statBonuses"]): EquipmentRecord["statBonuses"] {
  return store.getCurrent().database.equipment.find((record) => record.id === equipmentId)?.statBonuses ?? fallback;
}
