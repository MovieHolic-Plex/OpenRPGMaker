import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { emptyToUndefined, numberField, selectField, textField } from "@/editor/panels/databaseControls";
import { store } from "@/project/store";
import type { EquipmentRecord, EquipmentStatBonuses } from "@/project/types";
import { el } from "@/util/dom";

type CheckboxFieldInput = {
  readonly checked: boolean;
  readonly label: string;
  readonly onInput: (value: boolean) => void;
  readonly testid: string;
};

type StatFieldInput = {
  readonly equipment: EquipmentRecord;
  readonly key: keyof EquipmentStatBonuses;
  readonly label: string;
  readonly testid: string;
};

export function renderEquipmentRecordForm(form: HTMLElement, record: EquipmentRecord): void {
  form.append(
    resourcePanel(record),
    textField("설명", "db-field-equipment-description", record.description, (description) =>
      updateDatabaseRecord("equipment", record.id, { description })
    ),
    panel("능력치", [
      statField({ equipment: record, key: "attack", label: "공격력", testid: "db-field-equipment-attack" }),
      statField({ equipment: record, key: "defense", label: "방어력", testid: "db-field-equipment-defense" }),
      statField({ equipment: record, key: "mind", label: "정신력", testid: "db-field-equipment-mind" }),
      statField({ equipment: record, key: "agility", label: "민첩성", testid: "db-field-equipment-agility" }),
    ]),
    panel("장착 허용", [
      checkboxField({
        checked: record.twoHanded,
        label: "양손 장비",
        onInput: (twoHanded) => updateDatabaseRecord("equipment", record.id, { twoHanded }),
        testid: "db-field-equipment-two-handed",
      }),
      ...actorChoices(record),
      ...classChoices(record),
    ]),
    panel("상태", stateChoices(record)),
    panel("사용 효과", [
      selectField("사용 스킬", "db-picker-equipment-use-skill", record.usableAsItemSkillId ?? "", store.getCurrent().database.skills, (usableAsItemSkillId) =>
        updateDatabaseRecord("equipment", record.id, { usableAsItemSkillId: emptyToUndefined(usableAsItemSkillId) })
      ),
      checkboxField({
        checked: record.cursed,
        label: "저주",
        onInput: (cursed) => updateDatabaseRecord("equipment", record.id, { cursed }),
        testid: "db-field-equipment-cursed",
      }),
    ])
  );
}

function resourcePanel(record: EquipmentRecord): HTMLElement {
  return panel("장비 그래픽", [
    imagePreview("이미지", record.imageResourceId),
    textField("이미지", "db-field-equipment-image-resource", resourceText(record.imageResourceId), (imageResourceId) =>
      updateDatabaseRecord("equipment", record.id, { imageResourceId: emptyToUndefined(imageResourceId) })
    ),
    imagePreview("아이콘", record.iconResourceId),
    textField("아이콘", "db-field-equipment-icon-resource", resourceText(record.iconResourceId), (iconResourceId) =>
      updateDatabaseRecord("equipment", record.id, { iconResourceId: emptyToUndefined(iconResourceId) })
    ),
  ]);
}

function imagePreview(label: string, resourceId: string | undefined): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const visual = url
    ? el("img", { attrs: { alt: `${label} 미리보기`, src: url } })
    : el("strong", { text: resourceId ?? "(없음)" });
  return el("div", { class: "db-image-preview", children: [el("span", { text: label }), visual] });
}

function statField(input: StatFieldInput): HTMLElement {
  return numberField(input.label, input.testid, input.equipment.statBonuses[input.key], (value) => {
    const statBonuses = { ...currentEquipment(input.equipment).statBonuses, [input.key]: value };
    updateDatabaseRecord("equipment", input.equipment.id, { statBonuses });
  });
}

function actorChoices(record: EquipmentRecord): HTMLElement[] {
  return store.getCurrent().database.actors.map((actor) =>
    checkboxField({
      checked: record.equippableActorIds.includes(actor.id),
      label: actor.name,
      onInput: (checked) => updateDatabaseRecord("equipment", record.id, {
        equippableActorIds: toggleId(currentEquipment(record).equippableActorIds, actor.id, checked),
      }),
      testid: `db-field-equipment-actor-${actor.id}`,
    })
  );
}

function classChoices(record: EquipmentRecord): HTMLElement[] {
  return store.getCurrent().database.classes.map((klass) =>
    checkboxField({
      checked: record.equippableClassIds.includes(klass.id),
      label: klass.name,
      onInput: (checked) => updateDatabaseRecord("equipment", record.id, {
        equippableClassIds: toggleId(currentEquipment(record).equippableClassIds, klass.id, checked),
      }),
      testid: `db-field-equipment-class-${klass.id}`,
    })
  );
}

function stateChoices(record: EquipmentRecord): HTMLElement[] {
  return store.getCurrent().database.states.map((state) =>
    checkboxField({
      checked: record.stateInflictIds.includes(state.id),
      label: state.name,
      onInput: (checked) => updateDatabaseRecord("equipment", record.id, {
        stateInflictIds: toggleId(currentEquipment(record).stateInflictIds, state.id, checked),
      }),
      testid: `db-field-equipment-state-${state.id}`,
    })
  );
}

function checkboxField(input: CheckboxFieldInput): HTMLElement {
  const control = el("input", { attrs: { type: "checkbox" }, dataset: { testid: input.testid } });
  if (control instanceof HTMLInputElement) control.checked = input.checked;
  control.addEventListener("change", () => {
    if (control instanceof HTMLInputElement) input.onInput(control.checked);
  });
  return el("label", { class: "actor-check", children: [control, el("span", { text: input.label })] });
}

function panel(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

function resourceText(resourceId: string | undefined): string {
  return resourceId?.startsWith("generated-") ? "" : resourceId ?? "";
}

function currentEquipment(record: EquipmentRecord): EquipmentRecord {
  return store.getCurrent().database.equipment.find((equipment) => equipment.id === record.id) ?? record;
}

function toggleId(source: readonly string[], id: string, checked: boolean): string[] {
  if (checked) return source.includes(id) ? [...source] : [...source, id];
  return source.filter((entry) => entry !== id);
}
