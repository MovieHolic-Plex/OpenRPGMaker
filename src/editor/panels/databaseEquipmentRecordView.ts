import { updateDatabaseRecord } from "@/editor/databaseActions";
import {
  emptyToUndefined,
  numberField,
  segmentedControl,
  selectField,
  sliderStepperField,
  textField,
  toggleSwitch,
} from "@/editor/panels/databaseControls";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { panel } from "@/editor/panels/databaseEnemyRecordSupport";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { store } from "@/project/store";
import { databaseFieldSupportNotice } from "@/editor/databaseFieldSupport";
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

// 부위 세그먼트 옵션 — EquipmentRecord.slot 실값(weapon/shield/armor/helmet/accessory)
// 기준. 라벨은 갤러리 필터 칩(databaseRecordViews EQUIPMENT_SLOT_CHIPS)과 동일.
const EQUIPMENT_SLOT_OPTIONS: readonly { readonly id: EquipmentRecord["slot"]; readonly name: string }[] = [
  { id: "weapon", name: "무기" },
  { id: "shield", name: "방패" },
  { id: "helmet", name: "머리" },
  { id: "armor", name: "몸" },
  { id: "accessory", name: "장신구" },
];

// 방어 방식 — 이진 enum(resist/inflict)이라 세그먼트로. 라벨은 기존 selectLiteral 과 동일.
const STATE_DEFENSE_MODE_OPTIONS: readonly { readonly id: EquipmentRecord["stateDefenseMode"]; readonly name: string }[] = [
  { id: "resist", name: "저항" },
  { id: "inflict", name: "공격 시 부여" },
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
  // 요약 칩 호스트 — 헤더로 승격. refreshSummaryChips 클로저는 호스트 자식만 교체하는
  // 부분 갱신 경로를 유지한다(전체 폼 재렌더 금지).
  const summaryHost = el("div", {
    class: "db-equipment-summary-chips",
    dataset: { testid: "db-equipment-summary-chips" },
  });
  const refreshSummaryChips = (): void => {
    fillEquipmentSummaryChips(summaryHost, currentEquipment(record));
  };
  refreshSummaryChips();

  form.append(
    equipmentHeader(record, summaryHost, refreshSummaryChips),
    resourcePanel(record, rerender),
    databaseFieldSupportNotice("imageResourceId", "iconResourceId", "twoHanded", "usableAsItemSkillId", "stateInflictIds", "stateInflictionChance", "stateResistanceChance"),
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
      toggleSwitch("양손 장비", "db-field-equipment-two-handed", record.twoHanded, (twoHanded) => {
        updateDatabaseRecord("equipment", record.id, { twoHanded });
        refreshSummaryChips();
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
      statePercentField(record, "stateInflictionChance", "db-field-equipment-state-infliction", "상태 부여율(%)"),
      choiceGroup("상태 방어", "db-equipment-state-defense-group", stateChoices(record, "stateDefenseIds", refreshSummaryChips)),
      segmentedControl("방어 방식", "db-field-equipment-state-defense-mode", record.stateDefenseMode, STATE_DEFENSE_MODE_OPTIONS, (stateDefenseMode) =>
        updateDatabaseRecord("equipment", record.id, { stateDefenseMode: stateDefenseMode as EquipmentRecord["stateDefenseMode"] })
      ),
      statePercentField(record, "stateResistanceChance", "db-field-equipment-state-resistance", "상태 저항률(%)"),
    ]),
    panel("사용 효과", [
      selectField("사용 스킬", "db-picker-equipment-use-skill", record.usableAsItemSkillId ?? "", store.getCurrent().database.skills, (usableAsItemSkillId) =>
        updateDatabaseRecord("equipment", record.id, { usableAsItemSkillId: emptyToUndefined(usableAsItemSkillId) })
      ),
      toggleSwitch("저주", "db-field-equipment-cursed", record.cursed, (cursed) => {
        updateDatabaseRecord("equipment", record.id, { cursed });
        refreshSummaryChips();
      }),
    ])
  );
}

function equipmentHeader(record: EquipmentRecord, summaryHost: HTMLElement, refreshSummaryChips: () => void): HTMLElement {
  const project = store.getCurrent();
  const url = resolveAssetResourceUrl(record.iconResourceId ?? record.imageResourceId, { project });
  const icon = el("div", {
    class: "db-equipment-inspector-icon",
    attrs: { role: "img", "aria-label": `${record.name} 아이콘` },
  });
  if (url) icon.style.backgroundImage = `url("${url}")`;
  const name = textField("이름", "db-field-name", record.name, (name) =>
    updateDatabaseRecord("equipment", record.id, { name })
  );
  return el("div", {
    class: "db-equipment-inspector-header",
    dataset: { testid: "db-equipment-inspector-header" },
    children: [
      icon,
      el("div", {
        class: "db-equipment-inspector-title",
        children: [
          el("div", { class: "db-equipment-inspector-name", children: [name] }),
          segmentedControl("부위", "db-field-equipment-slot", record.slot, EQUIPMENT_SLOT_OPTIONS, (slot) => {
            updateDatabaseRecord("equipment", record.id, { slot: slot as EquipmentRecord["slot"] });
            refreshSummaryChips();
          }),
          summaryHost,
        ],
      }),
    ],
  });
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
    toggleSwitch(label, testid, record.effectFlags[key], (value) => {
      updateDatabaseRecord("equipment", record.id, {
        effectFlags: { ...currentEquipment(record).effectFlags, [key]: value },
      });
      onChange?.();
    })
  );
}

// 0-100% 수치 — 슬라이더+스테퍼 쌍. base testid 는 클램프+쓰기-백을 수행하는 숫자
// 입력(stepper)에 남긴다: numberField 시절 계약(databaseWave2BatchC — 250 → 100
// 쓰기-백)이 그대로 성립해야 한다. range 는 -slider 접미사로 식별한다.
function statePercentField(
  record: EquipmentRecord,
  key: "stateInflictionChance" | "stateResistanceChance",
  testid: string,
  label: string,
): HTMLElement {
  const fieldNode = sliderStepperField(label, testid, record[key], (value) =>
    updateDatabaseRecord("equipment", record.id, { [key]: value }),
    { min: 0, max: 100, step: 1, unit: "%" }
  );
  const stepper = fieldNode.querySelector<HTMLElement>(`[data-testid="${testid}-stepper"]`);
  if (stepper) stepper.dataset.testid = testid;
  return fieldNode;
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

function currentEquipment(record: EquipmentRecord): EquipmentRecord {
  return store.getCurrent().database.equipment.find((equipment) => equipment.id === record.id) ?? record;
}

function toggleId(source: readonly string[], id: string, checked: boolean): string[] {
  if (checked) return source.includes(id) ? [...source] : [...source, id];
  return source.filter((entry) => entry !== id);
}
