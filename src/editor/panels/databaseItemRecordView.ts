import {
  emptyToUndefined,
  field,
  numberField,
  selectField,
  selectLiteral,
  textField,
} from "@/editor/panels/databaseControls";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type {
  ActorId,
  ClassId,
  EquipmentStatBonuses,
  ItemConsumptionLimit,
  ItemEquipmentEffectFlags,
  ItemEquipmentProfile,
  ItemRecord,
  ItemType,
  StateId,
} from "@/project/types";
import { el } from "@/util/dom";

// allow: SIZE_OK - one RM2K3 Items manual surface with type-specific panels kept together for auditability.
const ITEM_TYPES = [
  "normalGoods",
  "weapon",
  "shield",
  "body",
  "head",
  "accessory",
  "medicine",
  "book",
  "seed",
  "special",
  "switch",
] as const satisfies readonly ItemType[];

const CONSUMPTION_LIMITS = ["noLimit", "1", "2", "3", "4", "5"] as const;
const EQUIPMENT_TYPES = ["weapon", "shield", "body", "head", "accessory"] as const satisfies readonly ItemType[];

export function renderItemRecordForm(form: HTMLElement, record: ItemRecord, rerender: () => void): void {
  form.append(
    el("div", {
      class: "db-items-rm2k3-workbench",
      dataset: { testid: "db-items-rm2k3-workbench" },
      children: [
        resourcePanel(record),
        panel("기본 설정", [
          textField("설명", "db-field-item-description", record.description, (description) =>
            updateDatabaseRecord("items", record.id, { description })
          ),
          selectLiteral("종류", "db-field-item-type", record.type, ITEM_TYPES, (type) => {
            updateItemType(record, type);
            rerender();
          }),
          consumptionLimitField(record),
        ]),
        ...typePanels(record),
      ],
    })
  );
}

function typePanels(record: ItemRecord): HTMLElement[] {
  if (isEquipmentItemType(record.type)) return equipmentPanels(record);
  if (record.type === "medicine") return medicinePanels(record);
  if (record.type === "book") return bookPanels(record);
  if (record.type === "seed") return seedPanels(record);
  if (record.type === "special") return specialPanels(record);
  if (record.type === "switch") return switchPanels(record);
  return [panel("일반 물품", [el("div", { class: "db-preview", text: "효과가 없는 이벤트 제어용 아이템입니다." })])];
}

function equipmentPanels(record: ItemRecord): HTMLElement[] {
  const profile = record.equipmentProfile;
  return [
    panel("장비 설정", [
      choiceList("사용 가능", actorClassChoices(record)),
      selectLiteral("장착 방식", "db-field-item-wield-type", profile.twoHanded ? "twoHanded" : "oneHanded", ["oneHanded", "twoHanded"], (wieldType) =>
        updateCurrentEquipmentProfile(record, { twoHanded: wieldType === "twoHanded" })
      ),
    ]),
    panel("능력치 보정", statBonusFields(record, profile.statBonuses, "equipmentProfile", "db-field-item-equipment")),
    panel("효과", equipmentEffectFields(record, profile.effectFlags)),
    panel("공격/방어 속성", [
      choiceList("공격 속성", elementChoices(record, "attackElementIds")),
      choiceList("속성 방어", elementChoices(record, "elementalDefenseIds")),
    ]),
    panel("상태", [
      choiceList("상태", stateChoices(record, "stateInflictIds")),
      numberField("상태 부여율", "db-field-item-state-infliction", profile.stateInflictionChance, (stateInflictionChance) =>
        updateCurrentEquipmentProfile(record, { stateInflictionChance })
      ),
    ]),
    panel("전투", [
      numberField("MP 소모", "db-field-item-mp-cost", profile.mpCost, (mpCost) => updateCurrentEquipmentProfile(record, { mpCost })),
      numberField("명중률", "db-field-item-accuracy", profile.accuracy, (accuracy) => updateCurrentEquipmentProfile(record, { accuracy })),
      numberField("치명타율", "db-field-item-critical-rate", profile.criticalRate, (criticalRate) => updateCurrentEquipmentProfile(record, { criticalRate })),
      selectField("발동 스킬", "db-picker-item-invoke-skill", record.skillId ?? "", store.getCurrent().database.skills, (skillId) =>
        updateDatabaseRecord("items", record.id, { skillId: emptyToUndefined(skillId) })
      ),
    ]),
  ];
}

function resourcePanel(record: ItemRecord): HTMLElement {
  return panel("아이템 그래픽", [
    imagePreview("이미지", record.imageResourceId),
    textField("이미지", "db-field-item-image-resource", resourceText(record.imageResourceId), (imageResourceId) =>
      updateDatabaseRecord("items", record.id, { imageResourceId: emptyToUndefined(imageResourceId) })
    ),
    imagePreview("아이콘", record.iconResourceId),
    textField("아이콘", "db-field-item-icon-resource", resourceText(record.iconResourceId), (iconResourceId) =>
      updateDatabaseRecord("items", record.id, { iconResourceId: emptyToUndefined(iconResourceId) })
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

function medicinePanels(record: ItemRecord): HTMLElement[] {
  return [
    el("div", {
      class: "db-item-type-panels",
      dataset: { testid: "db-items-medicine-panel" },
      children: [
        panel("범위", [selectLiteral("대상", "db-field-item-scope", record.scope, ["ally", "allAllies"], (scope) => updateDatabaseRecord("items", record.id, { scope }))]),
        panel("사용 가능", [choiceList("사용 가능", actorClassChoices(record))]),
        panel("상태 회복", [choiceList("상태", healStateChoices(record))]),
        panel("HP 회복", recoveryFields(record, "hpRecovery", "hp")),
        panel("MP 회복", recoveryFields(record, "mpRecovery", "mp")),
        panel("옵션", [
          checkboxField("메뉴에서만 사용", "db-field-item-only-menu", record.onlyUsableInMenu, (onlyUsableInMenu) =>
            updateDatabaseRecord("items", record.id, { onlyUsableInMenu, occasion: onlyUsableInMenu ? "field" : currentItem(record).occasion })
          ),
          checkboxField("전투불능 대상에게만 유효", "db-field-item-only-dead", record.onlyEffectiveOnDeadActors, (onlyEffectiveOnDeadActors) =>
            updateDatabaseRecord("items", record.id, { onlyEffectiveOnDeadActors })
          ),
        ]),
      ],
    }),
  ];
}

function bookPanels(record: ItemRecord): HTMLElement[] {
  return [
    panel("습득 스킬", [
      selectField("스킬", "db-picker-item-learned-skill", record.learnedSkillId ?? record.skillId ?? "", store.getCurrent().database.skills, (skillId) =>
        updateDatabaseRecord("items", record.id, { learnedSkillId: emptyToUndefined(skillId), skillId: emptyToUndefined(skillId) })
      ),
    ]),
    panel("사용 가능", [choiceList("사용 가능", actorClassChoices(record))]),
  ];
}

function seedPanels(record: ItemRecord): HTMLElement[] {
  return [
    panel("능력치 보정", statBonusFields(record, record.seedParameterBonuses, "seedParameterBonuses", "db-field-item-seed")),
    panel("사용 가능", [choiceList("사용 가능", actorClassChoices(record))]),
  ];
}

function specialPanels(record: ItemRecord): HTMLElement[] {
  return [
    el("div", {
      class: "db-item-type-panels",
      dataset: { testid: "db-items-special-panel" },
      children: [
        panel("발동 스킬", [
          selectField("발동 스킬", "db-picker-item-activate-skill", record.activateSkillId ?? record.skillId ?? "", store.getCurrent().database.skills, (skillId) =>
            updateDatabaseRecord("items", record.id, { activateSkillId: emptyToUndefined(skillId), skillId: emptyToUndefined(skillId) })
          ),
        ]),
        panel("사용 메시지", [
          selectLiteral("메시지", "db-field-item-usage-message", record.usageMessage, ["normal", "skill"], (usageMessage) =>
            updateDatabaseRecord("items", record.id, { usageMessage })
          ),
        ]),
        panel("사용 가능", [choiceList("사용 가능", actorClassChoices(record))]),
      ],
    }),
  ];
}

function switchPanels(record: ItemRecord): HTMLElement[] {
  return [
    el("div", {
      class: "db-item-type-panels",
      dataset: { testid: "db-items-switch-panel" },
      children: [
        panel("스위치 토글 ON/OFF", [
          selectField("스위치", "db-picker-item-switch", record.switchId ?? "", switchOptions(), (switchId) =>
            updateDatabaseRecord("items", record.id, { switchId: emptyToUndefined(switchId) })
          ),
        ]),
        panel("사용 조건", [
          checkboxField("필드", "db-field-item-occasion-field", record.occasionField, (occasionField) =>
            updateDatabaseRecord("items", record.id, {
              occasionField,
              occasion: occasionFromFlags(occasionField, currentItem(record).occasionBattle),
            })
          ),
          checkboxField("전투", "db-field-item-occasion-battle", record.occasionBattle, (occasionBattle) =>
            updateDatabaseRecord("items", record.id, {
              occasionBattle,
              occasion: occasionFromFlags(currentItem(record).occasionField, occasionBattle),
            })
          ),
        ]),
      ],
    }),
  ];
}

function statBonusFields(
  record: ItemRecord,
  bonuses: EquipmentStatBonuses,
  target: "equipmentProfile" | "seedParameterBonuses",
  testIdPrefix: string,
): HTMLElement[] {
  return [
    statBonusField(record, bonuses, target, "attack", "공격력", `${testIdPrefix}-attack`),
    statBonusField(record, bonuses, target, "defense", "방어력", `${testIdPrefix}-defense`),
    statBonusField(record, bonuses, target, "mind", "정신력", `${testIdPrefix}-mind`),
    statBonusField(record, bonuses, target, "agility", "민첩성", `${testIdPrefix}-agility`),
  ];
}

function statBonusField(
  record: ItemRecord,
  bonuses: EquipmentStatBonuses,
  target: "equipmentProfile" | "seedParameterBonuses",
  key: keyof EquipmentStatBonuses,
  label: string,
  testid: string,
): HTMLElement {
  return numberField(label, testid, bonuses[key], (value) => {
    const current = currentItem(record);
    const currentBonuses = target === "seedParameterBonuses" ? current.seedParameterBonuses : current.equipmentProfile.statBonuses;
    const next = { ...currentBonuses, [key]: value };
    if (target === "seedParameterBonuses") updateDatabaseRecord("items", record.id, { seedParameterBonuses: next });
    if (target === "equipmentProfile") updateEquipmentProfile(current, { ...current.equipmentProfile, statBonuses: next });
  });
}

function recoveryFields(record: ItemRecord, key: "hpRecovery" | "mpRecovery", testIdPrefix: string): HTMLElement[] {
  const value = record[key];
  return [
    numberField("%", `db-field-item-${testIdPrefix}-percent`, value.percentMax, (percentMax) =>
      updateDatabaseRecord("items", record.id, { [key]: { ...currentItem(record)[key], percentMax } })
    ),
    numberField("고정값", `db-field-item-${testIdPrefix}-flat`, value.flat, (flat) =>
      updateDatabaseRecord("items", record.id, { [key]: { ...currentItem(record)[key], flat } })
    ),
  ];
}

function equipmentEffectFields(record: ItemRecord, flags: ItemEquipmentEffectFlags): HTMLElement[] {
  return [
    equipmentFlag(record, flags, "preemptive", "선제 공격", "db-field-item-effect-preemptive"),
    equipmentFlag(record, flags, "doubleAttack", "2회 공격", "db-field-item-effect-double"),
    equipmentFlag(record, flags, "attackAll", "전체 공격", "db-field-item-effect-all"),
    equipmentFlag(record, flags, "ignoreDodge", "회피 무시", "db-field-item-effect-ignore-dodge"),
    equipmentFlag(record, flags, "preventCriticalHits", "치명타 방지", "db-field-item-effect-prevent-critical"),
    equipmentFlag(record, flags, "increasePhysicalDodge", "물리 회피율 증가", "db-field-item-effect-dodge"),
    equipmentFlag(record, flags, "halfMpCost", "MP 소모 절반", "db-field-item-effect-half-mp"),
    equipmentFlag(record, flags, "negateTerrainDamage", "지형 피해 무효", "db-field-item-effect-terrain"),
    equipmentFlag(record, flags, "fixedEquipment", "장비 해제 불가", "db-field-item-effect-fixed"),
  ];
}

function equipmentFlag(
  record: ItemRecord,
  flags: ItemEquipmentEffectFlags,
  key: keyof ItemEquipmentEffectFlags,
  label: string,
  testid: string,
): HTMLElement {
  return checkboxField(label, testid, flags[key], (value) =>
    updateEquipmentProfile(record, {
      ...currentItem(record).equipmentProfile,
      effectFlags: { ...currentItem(record).equipmentProfile.effectFlags, [key]: value },
    })
  );
}

function actorClassChoices(record: ItemRecord): HTMLElement[] {
  if (isEquipmentItemType(record.type)) return equipmentActorClassChoices(record);
  const project = store.getCurrent();
  return [
    ...project.database.actors.map((actor) =>
      checkboxField(actor.name, `db-field-item-usable-actor-${actor.id}`, record.usableActorIds.includes(actor.id), (checked) =>
        updateDatabaseRecord("items", record.id, { usableActorIds: toggleActorIds(currentItem(record).usableActorIds, actor.id, checked) })
      )
    ),
    ...project.database.classes.map((klass) =>
      checkboxField(klass.name, `db-field-item-usable-class-${klass.id}`, record.usableClassIds.includes(klass.id), (checked) =>
        updateDatabaseRecord("items", record.id, { usableClassIds: toggleClassIds(currentItem(record).usableClassIds, klass.id, checked) })
      )
    ),
  ];
}

function equipmentActorClassChoices(record: ItemRecord): HTMLElement[] {
  const project = store.getCurrent();
  return [
    ...project.database.actors.map((actor) =>
      checkboxField(actor.name, `db-field-item-usable-actor-${actor.id}`, record.equipmentProfile.equippableActorIds.includes(actor.id), (checked) =>
        updateCurrentEquipmentProfile(record, {
          equippableActorIds: toggleActorIds(currentItem(record).equipmentProfile.equippableActorIds, actor.id, checked),
        })
      )
    ),
    ...project.database.classes.map((klass) =>
      checkboxField(klass.name, `db-field-item-usable-class-${klass.id}`, record.equipmentProfile.equippableClassIds.includes(klass.id), (checked) =>
        updateCurrentEquipmentProfile(record, {
          equippableClassIds: toggleClassIds(currentItem(record).equipmentProfile.equippableClassIds, klass.id, checked),
        })
      )
    ),
  ];
}

function healStateChoices(record: ItemRecord): HTMLElement[] {
  return store.getCurrent().database.states.map((state) =>
    checkboxField(state.name, `db-field-item-state-${state.id}`, record.healStateIds.includes(state.id), (checked) =>
      updateDatabaseRecord("items", record.id, { healStateIds: toggleStateIds(currentItem(record).healStateIds, state.id, checked) })
    )
  );
}

function stateChoices(record: ItemRecord, key: "stateInflictIds" | "stateDefenseIds"): HTMLElement[] {
  return store.getCurrent().database.states.map((state) =>
    checkboxField(state.name, `db-field-item-${key}-${state.id}`, record.equipmentProfile[key].includes(state.id), (checked) =>
      updateCurrentEquipmentProfile(record, { [key]: toggleStateIds(currentItem(record).equipmentProfile[key], state.id, checked) })
    )
  );
}

function elementChoices(record: ItemRecord, key: "attackElementIds" | "elementalDefenseIds"): HTMLElement[] {
  return (store.getCurrent().database.elements ?? []).map((element) =>
    checkboxField(element.name, `db-field-item-${key}-${element.id}`, record.equipmentProfile[key].includes(element.id), (checked) =>
      updateCurrentEquipmentProfile(record, { [key]: toggleId(currentItem(record).equipmentProfile[key], element.id, checked) })
    )
  );
}

function consumptionLimitField(record: ItemRecord): HTMLElement {
  const value = String(record.consumptionLimit);
  const select = el("select", { dataset: { testid: "db-field-item-consumption-limit" } });
  for (const option of CONSUMPTION_LIMITS) select.append(el("option", { attrs: { value: option }, text: option === "noLimit" ? "제한 없음" : `${option}회` }));
  select.value = value;
  select.addEventListener("change", () => {
    updateDatabaseRecord("items", record.id, { consumptionLimit: parseConsumptionLimit(select.value) });
  });
  return field("사용 횟수", select);
}

function checkboxField(label: string, testid: string, checked: boolean, onInput: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("input", () => onInput(input.checked));
  return el("label", { class: "db-checkbox-field", children: [input, el("span", { text: label })] });
}

function choiceList(title: string, children: HTMLElement[]): HTMLElement {
  return el("div", { class: "db-item-choice-list", children: [el("strong", { text: title }), ...children] });
}

function panel(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel db-item-panel", children: [el("legend", { text: title }), ...children] });
}

function updateItemType(record: ItemRecord, type: ItemType): void {
  const current = currentItem(record);
  updateDatabaseRecord("items", record.id, {
    type,
    scope: type === "medicine" || type === "book" || type === "seed" ? "ally" : current.scope,
    consumable: type !== "normalGoods" && type !== "weapon" && type !== "shield" && type !== "body" && type !== "head" && type !== "accessory",
  });
}

function updateEquipmentProfile(record: ItemRecord, equipmentProfile: ItemEquipmentProfile): void {
  updateDatabaseRecord("items", record.id, { equipmentProfile });
}

function updateCurrentEquipmentProfile(record: ItemRecord, patch: Partial<ItemEquipmentProfile>): void {
  const equipmentProfile = currentItem(record).equipmentProfile;
  updateEquipmentProfile(record, { ...equipmentProfile, ...patch });
}

function currentItem(record: ItemRecord): ItemRecord {
  return store.getCurrent().database.items.find((item) => item.id === record.id) ?? record;
}

function resourceText(resourceId: string | undefined): string {
  return resourceId?.startsWith("generated-") ? "" : resourceId ?? "";
}

function switchOptions(): readonly { readonly id: string; readonly name: string }[] {
  const switches = store.getCurrent().switches;
  if (switches.length > 0) return switches;
  return [{ id: "switch_original", name: "0001:오리지널" }];
}

function occasionFromFlags(fieldEnabled: boolean, battleEnabled: boolean): ItemRecord["occasion"] {
  if (fieldEnabled && battleEnabled) return "always";
  if (fieldEnabled) return "field";
  if (battleEnabled) return "battle";
  return "never";
}

function parseConsumptionLimit(value: string): ItemConsumptionLimit {
  switch (value) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5":
      return 5;
    default:
      return "noLimit";
  }
}

function toggleId(source: readonly string[], id: string, checked: boolean): string[] {
  if (checked) return source.includes(id) ? [...source] : [...source, id];
  return source.filter((entry) => entry !== id);
}

function isEquipmentItemType(type: ItemType): type is typeof EQUIPMENT_TYPES[number] {
  return type === "weapon" || type === "shield" || type === "body" || type === "head" || type === "accessory";
}

function toggleActorIds(source: readonly ActorId[], id: ActorId, checked: boolean): ActorId[] {
  return toggleId(source, id, checked);
}

function toggleClassIds(source: readonly ClassId[], id: ClassId, checked: boolean): ClassId[] {
  return toggleId(source, id, checked);
}

function toggleStateIds(source: readonly StateId[], id: StateId, checked: boolean): StateId[] {
  return toggleId(source, id, checked);
}
