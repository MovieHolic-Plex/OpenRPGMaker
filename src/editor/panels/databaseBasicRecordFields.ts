import { emptyToUndefined, numberField, selectField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { updateDatabaseRecord, type DatabaseCollection } from "@/editor/databaseActions";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { openQuickBattleModal } from "@/editor/panels/quickBattleModal";

export function skillFields(form: HTMLElement, id: string): void {
  const skill = store.getCurrent().database.skills.find((record) => record.id === id);
  if (!skill) return;
  form.append(selectLiteral("범위", "db-field-scope", skill.scope, ["self", "ally", "allAllies", "enemy", "allEnemies"], (value) =>
    updateDatabaseRecord("skills", id, { scope: value })
  ));
  form.append(numberField("위력", "db-field-power", skill.power, (value) => updateDatabaseRecord("skills", id, { power: value }), { min: -9999, max: 9999 }));
  form.append(selectField("애니메이션", "db-picker-animation", skill.animationId ?? "", store.getCurrent().database.battleAnimations, (value) =>
    updateDatabaseRecord("skills", id, { animationId: emptyToUndefined(value) })
  ));
}

export function itemFields(form: HTMLElement, id: string): void {
  const item = store.getCurrent().database.items.find((record) => record.id === id);
  if (!item) return;
  form.append(numberField("가격", "db-field-price", item.price, (value) => updateDatabaseRecord("items", id, { price: value }), { min: 0, max: 999999 }));
  form.append(selectLiteral("범위", "db-field-scope", item.scope, ["none", "ally", "allAllies", "enemy"], (value) =>
    updateDatabaseRecord("items", id, { scope: value })
  ));
  form.append(numberField("포획 배율", "db-field-item-capture-multiplier", item.captureProfile?.multiplier ?? 0, (value) =>
    updateDatabaseRecord("items", id, { captureProfile: value > 0 ? { multiplier: value } : undefined }), { min: 0, max: 100 }
  ));
  skillPicker(form, "items", id);
}

export function equipmentFields(form: HTMLElement, id: string): void {
  const equipment = store.getCurrent().database.equipment.find((record) => record.id === id);
  if (!equipment) return;
  form.append(numberField("가격", "db-field-price", equipment.price, (value) => updateDatabaseRecord("equipment", id, { price: value }), { min: 0, max: 999999 }));
  form.append(selectLiteral("부위", "db-field-slot", equipment.slot, ["weapon", "shield", "armor", "helmet", "accessory"], (value) =>
    updateDatabaseRecord("equipment", id, { slot: value })
  ));
  skillPicker(form, "equipment", id);
}

export function enemyFields(form: HTMLElement, id: string): void {
  const enemy = store.getCurrent().database.enemies.find((record) => record.id === id);
  if (!enemy) return;
  form.append(textField("몬스터 그래픽", "db-field-monster-resource", enemy.monsterResourceId ?? "", (value) =>
    updateDatabaseRecord("enemies", id, { monsterResourceId: emptyToUndefined(value) })
  ));
  skillPicker(form, "enemies", id);
}

export function troopFields(form: HTMLElement, id: string): void {
  const troop = store.getCurrent().database.troops.find((record) => record.id === id);
  if (!troop) return;
  const previewWrap = el("div", { class: "db-preview" });
  previewWrap.append(el("div", { text: `전투 이벤트 페이지: ${troop.battleEventPages.length}` }));

  const testBtn = el("button", {
    class: "db-action-btn",
    text: "⚔️ 전투 시뮬레이션 테스트 (Quick Battle Test)",
    dataset: { testid: "quick-battle-test-btn" },
  });
  testBtn.style.cssText = `
    margin-top: 8px;
    padding: 6px 12px;
    background: #1742a5;
    color: #fff;
    border: 1px solid #7099fc;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    font-size: 11px;
    display: block;
    width: 100%;
  `;
  testBtn.onclick = (e) => {
    e.preventDefault();
    openQuickBattleModal(id);
  };

  form.append(previewWrap, testBtn);
}

export function animationFields(form: HTMLElement, id: string, rerender: () => void): void {
  const animation = store.getCurrent().database.battleAnimations.find((record) => record.id === id);
  if (!animation) return;
  const project = store.getCurrent();
  form.append(textField("리소스", "db-field-animation-resource", animation.resourceId ?? "", (value) => {
    updateDatabaseRecord("battleAnimations", id, { resourceId: emptyToUndefined(value) });
    rerender();
  }));
  const previewWrap = el("div", { class: "db-preview db-animation-preview", dataset: { testid: "db-animation-preview" } });
  const resourceId = animation.resourceId;
  const url = resourceId ? resolveAssetResourceUrl(resourceId, { project }) : undefined;
  if (url) {
    const image = el("img", { attrs: { alt: `${animation.name} 미리보기`, src: url } });
    image.className = "db-animation-image";
    previewWrap.append(image);
  } else {
    previewWrap.append(el("div", { class: "empty-hint", text: `미리보기 리소스: ${resourceId ?? "없음"}` }));
  }
  form.append(previewWrap);
  const referencingSkills = project.database.skills.filter((skill) => skill.animationId === animation.id);
  if (referencingSkills.length > 0) {
    const refs = el("div", { class: "db-refs", dataset: { testid: "db-animation-references" } });
    refs.append(el("div", { class: "db-field-hint", text: "사용하는 스킬:" }));
    for (const skill of referencingSkills) {
      refs.append(el("div", { class: "db-ref-row", text: `${skill.name} (${skill.id})` }));
    }
    form.append(refs);
  }
}

export function skillPicker(form: HTMLElement, collection: DatabaseCollection, id: string): void {
  const selected = selectedSkill(collection, id);
  form.append(selectField("스킬", "db-picker-skill", selected, store.getCurrent().database.skills, (value) => {
    if (collection === "actors") updateDatabaseRecord(collection, id, { learnedSkills: value ? [{ level: 1, skillId: value }] : [] });
    if (collection === "classes" || collection === "enemies") updateDatabaseRecord(collection, id, { skillIds: value ? [value] : [] });
    if (collection === "items" || collection === "equipment") updateDatabaseRecord(collection, id, { skillId: emptyToUndefined(value) });
  }));
}

function selectedSkill(collection: DatabaseCollection, id: string): string {
  const project = store.getCurrent();
  if (collection === "actors") return project.database.actors.find((record) => record.id === id)?.learnedSkills[0]?.skillId ?? "";
  if (collection === "classes") return project.database.classes.find((record) => record.id === id)?.learnedSkills[0]?.skillId ?? "";
  if (collection === "enemies") return project.database.enemies.find((record) => record.id === id)?.actions[0]?.skillId ?? "";
  if (collection === "items") return project.database.items.find((record) => record.id === id)?.skillId ?? "";
  if (collection === "equipment") return project.database.equipment.find((record) => record.id === id)?.skillId ?? "";
  return "";
}
