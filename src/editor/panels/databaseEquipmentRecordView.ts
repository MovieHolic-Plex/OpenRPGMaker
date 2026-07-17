import { updateDatabaseRecord } from "@/editor/databaseActions";
import { emptyToUndefined, numberField, selectField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { store } from "@/project/store";
import type { EquipmentRecord, EquipmentStatBonuses, ItemEquipmentEffectFlags } from "@/project/types";
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

/** Pure summary used by the detail-form chip row and unit tests (G004). */
export type EquipmentEffectSummaryChips = {
  readonly flags: readonly string[];
  readonly badges: readonly string[];
  readonly counts: readonly string[];
};

// 아이템 탭 equipmentEffectFields(databaseItemRecordView.ts)와 동일한 9종 플래그.
const EFFECT_FLAG_FIELDS: readonly { readonly key: keyof ItemEquipmentEffectFlags; readonly label: string; readonly testid: string }[] = [
  { key: "preemptive", label: "선제 공격", testid: "db-field-equipment-effect-preemptive" },
  { key: "doubleAttack", label: "2회 공격", testid: "db-field-equipment-effect-double" },
  { key: "attackAll", label: "전체 공격", testid: "db-field-equipment-effect-all" },
  { key: "ignoreDodge", label: "회피 무시", testid: "db-field-equipment-effect-ignore-dodge" },
  { key: "preventCriticalHits", label: "치명타 방지", testid: "db-field-equipment-effect-prevent-critical" },
  { key: "increasePhysicalDodge", label: "물리 회피율 증가", testid: "db-field-equipment-effect-dodge" },
  { key: "halfMpCost", label: "MP 소모 절반", testid: "db-field-equipment-effect-half-mp" },
  { key: "negateTerrainDamage", label: "지형 피해 무효", testid: "db-field-equipment-effect-terrain" },
  { key: "fixedEquipment", label: "장비 해제 불가", testid: "db-field-equipment-effect-fixed" },
];

export function equipmentEffectSummaryChips(record: EquipmentRecord): EquipmentEffectSummaryChips {
  const flags = EFFECT_FLAG_FIELDS
    .filter(({ key }) => record.effectFlags[key])
    .map(({ label }) => label);
  const badges: string[] = [];
  if (record.twoHanded) badges.push("양손 장비");
  if (record.cursed) badges.push("저주");
  const counts: string[] = [];
  if (record.attackElementIds.length > 0) counts.push(`공격 속성 ${record.attackElementIds.length}`);
  if (record.elementalDefenseIds.length > 0) counts.push(`속성 방어 ${record.elementalDefenseIds.length}`);
  if (record.stateInflictIds.length > 0) counts.push(`상태 부여 ${record.stateInflictIds.length}`);
  if (record.stateDefenseIds.length > 0) counts.push(`상태 방어 ${record.stateDefenseIds.length}`);
  return { flags, badges, counts };
}

export function renderEquipmentRecordForm(form: HTMLElement, record: EquipmentRecord, rerender: () => void = () => undefined): void {
  const summaryHost = el("div", {
    class: "db-equipment-summary-chips",
    dataset: { testid: "db-equipment-summary-chips" },
  });
  const refreshSummaryChips = (): void => {
    fillEquipmentSummaryChips(summaryHost, currentEquipment(record));
  };
  refreshSummaryChips();

  form.append(
    resourcePanel(record, rerender),
    summaryHost,
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
        onInput: (twoHanded) => {
          updateDatabaseRecord("equipment", record.id, { twoHanded });
          refreshSummaryChips();
        },
        testid: "db-field-equipment-two-handed",
      }),
      // 기본 데이터에서 배우명=직업명이라 어느 쪽인지 구분 불가했다(P10) — 소제목으로 구분.
      choiceGroup("주인공별 허용", "db-equipment-actor-permission-group", actorChoices(record)),
      choiceGroup("직업별 허용", "db-equipment-class-permission-group", classChoices(record)),
    ]),
    // 아이템 탭 equipmentProfile 블록과 동일한 효과 필드군 이식(P10 — 스키마·런타임은
    // 이미 지원하는데 UI 만 없어 AI 도구로만 편집 가능했다).
    panel("효과", equipmentEffectFields(record, refreshSummaryChips)),
    panel("공격/방어 속성", [
      choiceGroup("공격 속성", "db-equipment-attack-element-group", elementChoices(record, "attackElementIds", refreshSummaryChips)),
      choiceGroup("속성 방어", "db-equipment-defense-element-group", elementChoices(record, "elementalDefenseIds", refreshSummaryChips)),
    ]),
    panel("상태", [
      choiceGroup("상태 부여", "db-equipment-state-inflict-group", stateChoices(record, "stateInflictIds", refreshSummaryChips)),
      numberField("상태 부여율(%)", "db-field-equipment-state-infliction", record.stateInflictionChance, (stateInflictionChance) =>
        updateDatabaseRecord("equipment", record.id, { stateInflictionChance }), { min: 0, max: 100 }
      ),
      choiceGroup("상태 방어", "db-equipment-state-defense-group", stateChoices(record, "stateDefenseIds", refreshSummaryChips)),
      selectLiteral("방어 방식", "db-field-equipment-state-defense-mode", record.stateDefenseMode, ["resist", "inflict"], (stateDefenseMode) =>
        updateDatabaseRecord("equipment", record.id, { stateDefenseMode })
      ),
      numberField("상태 저항률(%)", "db-field-equipment-state-resistance", record.stateResistanceChance, (stateResistanceChance) =>
        updateDatabaseRecord("equipment", record.id, { stateResistanceChance }), { min: 0, max: 100 }
      ),
    ]),
    panel("사용 효과", [
      selectField("사용 스킬", "db-picker-equipment-use-skill", record.usableAsItemSkillId ?? "", store.getCurrent().database.skills, (usableAsItemSkillId) =>
        updateDatabaseRecord("equipment", record.id, { usableAsItemSkillId: emptyToUndefined(usableAsItemSkillId) })
      ),
      checkboxField({
        checked: record.cursed,
        label: "저주",
        onInput: (cursed) => {
          updateDatabaseRecord("equipment", record.id, { cursed });
          refreshSummaryChips();
        },
        testid: "db-field-equipment-cursed",
      }),
    ])
  );
}

function fillEquipmentSummaryChips(host: HTMLElement, record: EquipmentRecord): void {
  const summary = equipmentEffectSummaryChips(record);
  const chips: HTMLElement[] = [];
  for (const label of summary.flags) {
    chips.push(summaryChip(label, "flag"));
  }
  for (const label of summary.badges) {
    chips.push(summaryChip(label, "badge"));
  }
  for (const label of summary.counts) {
    chips.push(summaryChip(label, "count"));
  }
  if (chips.length === 0) {
    chips.push(summaryChip("효과 없음", "empty"));
  }
  host.replaceChildren(...chips);
}

function summaryChip(label: string, kind: "flag" | "badge" | "count" | "empty"): HTMLElement {
  return el("span", {
    class: kind === "empty" ? "db-equipment-summary-chip muted" : `db-equipment-summary-chip db-equipment-summary-chip-${kind}`,
    text: label,
    dataset: {
      kind,
      testid: kind === "empty" ? "db-equipment-summary-empty" : `db-equipment-summary-chip-${kind}`,
    },
  });
}

function resourcePanel(record: EquipmentRecord, rerender: () => void): HTMLElement {
  const graphicPanel = panel("장비 그래픽", [
    resourcePickerControl({
      label: "이미지",
      resourceId: record.imageResourceId,
      kind: "image",
      testid: "db-field-equipment-image-resource",
      allowClear: true,
      dialogTitle: "장비 이미지",
      onChange: (result) =>
        updateDatabaseRecord("equipment", record.id, { imageResourceId: emptyToUndefined(result.resourceId) }),
      rerender,
    }),
    resourcePickerControl({
      label: "아이콘",
      resourceId: record.iconResourceId,
      kind: "icon",
      testid: "db-field-equipment-icon-resource",
      allowClear: true,
      dialogTitle: "장비 아이콘",
      onChange: (result) =>
        updateDatabaseRecord("equipment", record.id, { iconResourceId: emptyToUndefined(result.resourceId) }),
      rerender,
    }),
  ]);
  graphicPanel.classList.add("db-panel-equipment-graphic");
  return graphicPanel;
}

function statField(input: StatFieldInput): HTMLElement {
  return numberField(input.label, input.testid, input.equipment.statBonuses[input.key], (value) => {
    const statBonuses = { ...currentEquipment(input.equipment).statBonuses, [input.key]: value };
    updateDatabaseRecord("equipment", input.equipment.id, { statBonuses });
  }, { min: 0, max: 9999 });
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

function stateChoices(
  record: EquipmentRecord,
  key: "stateInflictIds" | "stateDefenseIds",
  onChange?: () => void,
): HTMLElement[] {
  // 기존 testid(db-field-equipment-state-<id>)는 부여 목록에서 유지한다 — e2e 호환.
  const testIdPrefix = key === "stateInflictIds" ? "db-field-equipment-state" : "db-field-equipment-state-defense";
  return store.getCurrent().database.states.map((state) =>
    checkboxField({
      checked: record[key].includes(state.id),
      label: state.name,
      onInput: (checked) => {
        updateDatabaseRecord("equipment", record.id, {
          [key]: toggleId(currentEquipment(record)[key], state.id, checked),
        });
        onChange?.();
      },
      testid: `${testIdPrefix}-${state.id}`,
    })
  );
}

function elementChoices(
  record: EquipmentRecord,
  key: "attackElementIds" | "elementalDefenseIds",
  onChange?: () => void,
): HTMLElement[] {
  return (store.getCurrent().database.elements ?? []).map((element) =>
    checkboxField({
      checked: record[key].includes(element.id),
      label: element.name,
      onInput: (checked) => {
        updateDatabaseRecord("equipment", record.id, {
          [key]: toggleId(currentEquipment(record)[key], element.id, checked),
        });
        onChange?.();
      },
      testid: `db-field-equipment-${key}-${element.id}`,
    })
  );
}

function equipmentEffectFields(record: EquipmentRecord, onChange?: () => void): HTMLElement[] {
  return EFFECT_FLAG_FIELDS.map(({ key, label, testid }) =>
    checkboxField({
      checked: record.effectFlags[key],
      label,
      onInput: (value) => {
        updateDatabaseRecord("equipment", record.id, {
          effectFlags: { ...currentEquipment(record).effectFlags, [key]: value },
        });
        onChange?.();
      },
      testid,
    })
  );
}

function choiceGroup(title: string, testid: string, children: readonly HTMLElement[]): HTMLElement {
  return el("div", {
    class: "db-item-choice-list",
    dataset: { testid },
    children: [el("strong", { text: title }), ...children],
  });
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

function currentEquipment(record: EquipmentRecord): EquipmentRecord {
  return store.getCurrent().database.equipment.find((equipment) => equipment.id === record.id) ?? record;
}

function toggleId(source: readonly string[], id: string, checked: boolean): string[] {
  if (checked) return source.includes(id) ? [...source] : [...source, id];
  return source.filter((entry) => entry !== id);
}
