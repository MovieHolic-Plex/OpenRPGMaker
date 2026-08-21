import {
  avatarChipRow,
  emptyToUndefined,
  field,
  numberField,
  segmentedControl,
  selectField,
  selectLiteral,
  sliderStepperField,
  textField,
  toggleSwitch,
  type AvatarChipActor,
} from "@/editor/panels/databaseControls";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { panel } from "@/editor/panels/databaseEnemyRecordSupport";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { FARM_TOOLS, isFarmTool } from "@/project/farmModel";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import { databaseFieldSupportNotice } from "@/editor/databaseFieldSupport";
import type {
  ActorId,
  ActorRecord,
  ClassId,
  EquipmentStatBonuses,
  FarmTool,
  ItemConsumptionLimit,
  ItemEquipmentProfile,
  ItemRecord,
  ItemScope,
  ItemType,
  StateId,
} from "@/project/types";
import { el } from "@/util/dom";

// allow: SIZE_OK - one RM2K3 Items manual surface with type-specific panels kept together for auditability.
export const ITEM_TYPES = [
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

const ITEM_TYPE_LABELS: Record<(typeof ITEM_TYPES)[number], string> = {
  normalGoods: "일반 물품",
  weapon: "무기",
  shield: "방패",
  body: "갑옷",
  head: "머리",
  accessory: "장신구",
  medicine: "약",
  book: "책",
  seed: "씨앗",
  special: "특수",
  switch: "스위치",
};

const FARM_TOOL_LABELS: Record<FarmTool, string> = {
  hoe: "괭이",
  wateringCan: "물뿌리개",
  axe: "도끼",
  pickaxe: "곡괭이",
};

// 약 계열 아이템의 대상(scope) 배타 선택 — 저장 필드는 ItemScope enum 그대로(스키마 불변).
const MEDICINE_SCOPE_OPTIONS: readonly { readonly id: ItemScope; readonly name: string }[] = [
  { id: "ally", name: "아군" },
  { id: "allAllies", name: "아군 전체" },
];

export function renderItemRecordForm(form: HTMLElement, record: ItemRecord, rerender: () => void): void {
  form.append(
    el("div", {
      class: "db-items-oprn-workbench",
      dataset: { testid: "db-items-oprn-workbench" },
      children: [
        itemHeader(record),
        resourcePanel(record, rerender),
        databaseFieldSupportNotice("imageResourceId", "iconResourceId", "consumptionLimit", "usableActorIds", "usableClassIds", "seedParameterBonuses", "usageMessage", "equipmentProfile"),
        panel("기본 설정", [
          textField("설명", "db-field-item-description", record.description, (description) =>
            updateDatabaseRecord("items", record.id, { description })
          ),
          selectLiteral("종류", "db-field-item-type", record.type, ITEM_TYPES, (type) => {
            updateItemType(record, type);
            rerender();
          }),
          consumptionLimitField(record),
          farmToolField(record),
        ]),
        ...typePanels(record, form),
      ],
    })
  );
}

function typePanels(record: ItemRecord, form: HTMLElement): HTMLElement[] {
  if (isEquipmentItemType(record.type)) return [equipmentRedirect(form)];
  if (record.type === "medicine") return medicinePanels(record);
  if (record.type === "book") return bookPanels(record);
  if (record.type === "seed") return seedPanels(record);
  if (record.type === "special") return specialPanels(record);
  if (record.type === "switch") return switchPanels(record);
  return [panel("일반 물품", [el("div", { class: "db-preview", text: "효과가 없는 이벤트 제어용 아이템입니다." })])];
}

function equipmentRedirect(form: HTMLElement): HTMLElement {
  return el("div", {
    class: "db-item-equipment-redirect",
    dataset: { testid: "db-item-equipment-redirect" },
    children: [
      panel("장비는 장비 탭에서", [
        el("p", {
          class: "db-item-equipment-redirect-copy",
          text: "무기·방패·갑옷·머리·장신구의 전투 스탯은 이 탭에서 적용되지 않습니다. 장비 탭에서 만듭니다.",
        }),
        el("button", {
          class: "db-toolbar-button",
          text: "장비 탭 열기",
          attrs: { type: "button" },
          dataset: { testid: "db-item-open-equipment-tab" },
          on: {
            click: () => {
              const root = databasePanelRootFrom(form);
              if (root) switchDatabaseActiveTab("equipment", root);
            },
          },
        }),
      ]),
    ],
  });
}

function itemHeader(record: ItemRecord): HTMLElement {
  const project = store.getCurrent();
  const url = resolveAssetResourceUrl(record.iconResourceId ?? record.imageResourceId, { project });
  const icon = el("div", {
    class: "db-item-inspector-icon",
    attrs: { role: "img", "aria-label": `${record.name} 아이콘` },
  });
  if (url) icon.style.backgroundImage = `url("${url}")`;
  const name = textField("이름", "db-field-name", record.name, (name) => updateDatabaseRecord("items", record.id, { name }));
  return el("div", {
    class: "db-item-inspector-header",
    dataset: { testid: "db-item-inspector-header" },
    children: [
      icon,
      el("div", {
        class: "db-item-inspector-title",
        children: [
          el("div", { class: "db-item-inspector-name", children: [name] }),
          el("span", { class: "db-item-inspector-type-tag", text: ITEM_TYPE_LABELS[record.type] }),
        ],
      }),
    ],
  });
}

function resourcePanel(record: ItemRecord, rerender: () => void): HTMLElement {
  return panel("아이템 그래픽", [
    resourcePickerControl({
      label: "이미지",
      resourceId: record.imageResourceId,
      kind: "image",
      testid: "db-field-item-image-resource",
      allowClear: true,
      dialogTitle: "아이템 이미지",
      onChange: (result) =>
        updateDatabaseRecord("items", record.id, { imageResourceId: emptyToUndefined(result.resourceId) }),
      rerender,
    }),
    resourcePickerControl({
      label: "아이콘",
      resourceId: record.iconResourceId,
      kind: "icon",
      testid: "db-field-item-icon-resource",
      allowClear: true,
      dialogTitle: "아이템 아이콘",
      onChange: (result) =>
        updateDatabaseRecord("items", record.id, { iconResourceId: emptyToUndefined(result.resourceId) }),
      rerender,
    }),
  ]);
}

function medicinePanels(record: ItemRecord): HTMLElement[] {
  return [
    el("div", {
      class: "db-item-type-panels",
      dataset: { testid: "db-items-medicine-panel" },
      children: [
        panel("범위", [
          segmentedControl("대상", "db-field-item-scope", record.scope, MEDICINE_SCOPE_OPTIONS, (scope) =>
            updateDatabaseRecord("items", record.id, { scope: scope as ItemScope })
          ),
        ]),
        panel("사용 가능", actorClassChoices(record)),
        panel("상태 회복", [choiceList("상태", healStateChoices(record))]),
        panel("HP 회복", recoveryFields(record, "hpRecovery", "hp")),
        panel("MP 회복", recoveryFields(record, "mpRecovery", "mp")),
        panel("옵션", [
          toggleSwitch("메뉴에서만 사용", "db-field-item-only-menu", record.onlyUsableInMenu, (onlyUsableInMenu) =>
            updateDatabaseRecord("items", record.id, { onlyUsableInMenu, occasion: onlyUsableInMenu ? "field" : currentItem(record).occasion })
          ),
          toggleSwitch("전투불능 대상에게만 유효", "db-field-item-only-dead", record.onlyEffectiveOnDeadActors, (onlyEffectiveOnDeadActors) =>
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
    panel("사용 가능", actorClassChoices(record)),
  ];
}

function seedPanels(record: ItemRecord): HTMLElement[] {
  return [
    panel("능력치 보정", statBonusFields(record, record.seedParameterBonuses, "seedParameterBonuses", "db-field-item-seed")),
    panel("사용 가능", actorClassChoices(record)),
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
        panel("사용 가능", actorClassChoices(record)),
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
          toggleSwitch("필드", "db-field-item-occasion-field", record.occasionField, (occasionField) =>
            updateDatabaseRecord("items", record.id, {
              occasionField,
              occasion: occasionFromFlags(occasionField, currentItem(record).occasionBattle),
            })
          ),
          toggleSwitch("전투", "db-field-item-occasion-battle", record.occasionBattle, (occasionBattle) =>
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
  // store normalize 와 동일 범위: 씨앗 보정 -50..50, 장비형 아이템 보정 -500..500 (P4).
  const bounds = target === "seedParameterBonuses" ? { min: -50, max: 50 } : { min: -500, max: 500 };
  return numberField(label, testid, bonuses[key], (value) => {
    const current = currentItem(record);
    const currentBonuses = target === "seedParameterBonuses" ? current.seedParameterBonuses : current.equipmentProfile.statBonuses;
    const next = { ...currentBonuses, [key]: value };
    if (target === "seedParameterBonuses") updateDatabaseRecord("items", record.id, { seedParameterBonuses: next });
    if (target === "equipmentProfile") updateEquipmentProfile(current, { ...current.equipmentProfile, statBonuses: next });
  }, bounds);
}

function recoveryFields(record: ItemRecord, key: "hpRecovery" | "mpRecovery", testIdPrefix: string): HTMLElement[] {
  const value = record[key];
  return [
    percentRecoveryField(record, key, testIdPrefix),
    numberField("고정값", `db-field-item-${testIdPrefix}-flat`, value.flat, (flat) =>
      updateDatabaseRecord("items", record.id, { [key]: { ...currentItem(record)[key], flat } }), { min: 0, max: 999 }
    ),
  ];
}

// 회복 % — 슬라이더+스테퍼 쌍(0-100, 스텝 5). base testid 는 필드 래퍼에도 남겨
// 기존 testid 계약을 유지하고, 입력은 -slider/-stepper 로 식별한다.
function percentRecoveryField(record: ItemRecord, key: "hpRecovery" | "mpRecovery", testIdPrefix: string): HTMLElement {
  const testid = `db-field-item-${testIdPrefix}-percent`;
  const fieldNode = sliderStepperField("%", testid, record[key].percentMax, (percentMax) =>
    updateDatabaseRecord("items", record.id, { [key]: { ...currentItem(record)[key], percentMax } }),
    { min: 0, max: 100, step: 5, unit: "%" }
  );
  fieldNode.dataset.testid = testid;
  return fieldNode;
}

function actorClassChoices(record: ItemRecord): HTMLElement[] {
  const project = store.getCurrent();
  return [
    avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", actorChips(project.database.actors), record.usableActorIds, (actorId, checked) =>
      updateDatabaseRecord("items", record.id, { usableActorIds: toggleActorIds(currentItem(record).usableActorIds, actorId, checked) })
    ),
    choiceList("직업", [
      ...project.database.classes.map((klass) =>
        checkboxField(klass.name, `db-field-item-usable-class-${klass.id}`, record.usableClassIds.includes(klass.id), (checked) =>
          updateDatabaseRecord("items", record.id, { usableClassIds: toggleClassIds(currentItem(record).usableClassIds, klass.id, checked) })
        )
      ),
    ]),
  ];
}

function actorChips(actors: readonly ActorRecord[]): AvatarChipActor[] {
  return actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
    faceResourceId: actor.faceResourceId,
    faceIndex: actor.faceIndex,
  }));
}

function healStateChoices(record: ItemRecord): HTMLElement[] {
  return store.getCurrent().database.states.map((state) =>
    checkboxField(state.name, `db-field-item-state-${state.id}`, record.healStateIds.includes(state.id), (checked) =>
      updateDatabaseRecord("items", record.id, { healStateIds: toggleStateIds(currentItem(record).healStateIds, state.id, checked) })
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

// 농사 도구 옵션은 FARM_TOOLS(정본)에서 파생한다 — 하드코딩하면 axe/pickaxe 처럼
// 런타임 규칙(toolActions legacy-axe-chop/legacy-pick-mine)은 있는데 저작이 불가능한
// 드리프트가 생긴다. 라벨만 한글이고 저장값은 영문 정본 id 그대로다.
function farmToolField(record: ItemRecord): HTMLElement {
  const options = FARM_TOOLS.map((tool) => ({ id: tool, name: FARM_TOOL_LABELS[tool] }));
  return selectField("농사 도구", "db-field-item-farm-tool", record.farmTool ?? "", options, (farmTool) => {
    updateDatabaseRecord("items", record.id, { farmTool: isFarmTool(farmTool) ? farmTool : undefined });
  });
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

function currentItem(record: ItemRecord): ItemRecord {
  return store.getCurrent().database.items.find((item) => item.id === record.id) ?? record;
}

function switchOptions(): readonly { readonly id: string; readonly name: string }[] {
  const project = store.getCurrent();
  const switches = project.switches;
  const labeled = switches.map((entry, index) => ({ id: entry.id, name: storyFlagOptionLabel(project, "switch", entry, index) }));
  if (labeled.length > 0) return labeled;
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

function databasePanelRootFrom(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const modalBody = node.closest(".database-modal-body");
  if (modalBody instanceof HTMLElement) return modalBody;
  let current: HTMLElement | null = node;
  while (current) {
    if (current.querySelector(".db-body") && !current.classList.contains("db-body")) return current;
    current = current.parentElement;
  }
  return null;
}

export function isEquipmentItemType(type: ItemType): type is typeof EQUIPMENT_TYPES[number] {
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
