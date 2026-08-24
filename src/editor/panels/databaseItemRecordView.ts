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
  Project,
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

export type ItemEffectStory = {
  readonly target: string;
  readonly occasion: string;
  readonly consumption: string;
  readonly effects: readonly string[];
  readonly notes: readonly string[];
};

/** Pure, schema-preserving projection of the fields the live item runtimes consume. */
export function itemEffectStory(project: Project, record: ItemRecord): ItemEffectStory {
  const effects: string[] = [];
  const notes: string[] = [];
  const hpRecovery = recoveryStory("HP", record.hpRecovery);
  const mpRecovery = recoveryStory("MP", record.mpRecovery);
  if (hpRecovery) effects.push(hpRecovery);
  if (mpRecovery) effects.push(mpRecovery);

  const healedStateIds = new Set([
    ...record.healStateIds,
    ...record.stateEffects.filter((effect) => effect.operation === "remove").map((effect) => effect.stateId),
  ]);
  if (healedStateIds.size > 0) {
    effects.push(`상태 회복: ${namedIds([...healedStateIds], project.database.states).join(", ")}`);
  }

  const learnedSkillId = record.type === "book" ? record.learnedSkillId ?? record.skillId : undefined;
  if (learnedSkillId) effects.push(`스킬 습득: ${namedId(learnedSkillId, project.database.skills)}`);
  const activatedSkillId = record.type === "special" ? record.activateSkillId ?? record.skillId : undefined;
  if (activatedSkillId) effects.push(`스킬 발동: ${namedId(activatedSkillId, project.database.skills)}`);

  if (record.type === "seed") {
    const statChanges = statStory(record.seedParameterBonuses);
    if (statChanges.length > 0) effects.push(`영구 성장: ${statChanges.join(" · ")}`);
  }
  if (record.type === "switch" && record.switchId) {
    effects.push(`스위치 ON: ${namedId(record.switchId, project.switches)}`);
  }
  if (record.captureProfile) effects.push(`포획 배율 ×${record.captureProfile.multiplier}`);
  if (record.careProfile) {
    const exp = record.careProfile.expDelta ? ` · 경험치 +${record.careProfile.expDelta}` : "";
    effects.push(`몬스터 친밀도 ${signed(record.careProfile.friendshipDelta)}${exp}`);
  }
  if (record.farmTool) effects.push(`농사 도구: ${FARM_TOOL_LABELS[record.farmTool]}`);
  if (isEquipmentItemType(record.type)) notes.push("전투 효과는 장비 탭의 장비 레코드에서 설정합니다.");
  if (record.onlyEffectiveOnDeadActors) notes.push("전투불능 대상에게만 유효");
  if (record.usableActorIds.length > 0 || record.usableClassIds.length > 0) {
    const actorCount = record.usableActorIds.length;
    const classCount = record.usableClassIds.length;
    notes.push(`사용 허용: 주인공 ${actorCount}명 · 직업 ${classCount}개`);
  }

  return {
    target: itemTargetLabel(record),
    occasion: itemOccasionLabel(record),
    consumption: record.consumable
      ? record.consumptionLimit === "noLimit"
        ? "사용할 때 1개 소비"
        : `1개당 ${record.consumptionLimit}회 사용`
      : "소비하지 않음",
    effects: effects.length > 0 ? effects : ["직접 효과 없음"],
    notes,
  };
}

export function renderItemRecordForm(form: HTMLElement, record: ItemRecord, rerender: () => void): void {
  const storyHost = el("section", {
    class: "db-item-effect-story",
    attrs: { "aria-label": "아이템 효과 요약" },
    dataset: { testid: "db-item-effect-story" },
  });
  const refreshStory = (): void => fillItemEffectStory(storyHost, store.getCurrent(), currentItem(record));
  refreshStory();
  form.append(
    el("div", {
      class: "db-items-oprn-workbench",
      dataset: { testid: "db-items-oprn-workbench" },
      children: [
        itemHeader(record),
        storyHost,
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
          consumptionLimitField(record, refreshStory),
          farmToolField(record, refreshStory),
        ]),
        ...typePanels(record, form, refreshStory),
      ],
    })
  );
}

function typePanels(record: ItemRecord, form: HTMLElement, refreshStory: () => void): HTMLElement[] {
  if (isEquipmentItemType(record.type)) return [equipmentRedirect(form)];
  if (record.type === "medicine") return medicinePanels(record, refreshStory);
  if (record.type === "book") return bookPanels(record, refreshStory);
  if (record.type === "seed") return seedPanels(record, refreshStory);
  if (record.type === "special") return specialPanels(record, refreshStory);
  if (record.type === "switch") return switchPanels(record, refreshStory);
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

function medicinePanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return [
    el("div", {
      class: "db-item-type-panels",
      dataset: { testid: "db-items-medicine-panel" },
      children: [
        panel("범위", [
          segmentedControl("대상", "db-field-item-scope", record.scope, MEDICINE_SCOPE_OPTIONS, (scope) =>
            updateItemAndRefresh(record, { scope: scope as ItemScope }, refreshStory)
          ),
        ]),
        panel("사용 가능", actorClassChoices(record, refreshStory)),
        panel("상태 회복", [choiceList("상태", healStateChoices(record, refreshStory))]),
        panel("HP 회복", recoveryFields(record, "hpRecovery", "hp", refreshStory)),
        panel("MP 회복", recoveryFields(record, "mpRecovery", "mp", refreshStory)),
        panel("옵션", [
          toggleSwitch("메뉴에서만 사용", "db-field-item-only-menu", record.onlyUsableInMenu, (onlyUsableInMenu) => {
            updateDatabaseRecord("items", record.id, { onlyUsableInMenu, occasion: onlyUsableInMenu ? "field" : currentItem(record).occasion });
            refreshStory();
          }),
          toggleSwitch("전투불능 대상에게만 유효", "db-field-item-only-dead", record.onlyEffectiveOnDeadActors, (onlyEffectiveOnDeadActors) =>
            updateItemAndRefresh(record, { onlyEffectiveOnDeadActors }, refreshStory)
          ),
        ]),
      ],
    }),
  ];
}

function bookPanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return [
    panel("습득 스킬", [
      selectField("스킬", "db-picker-item-learned-skill", record.learnedSkillId ?? record.skillId ?? "", store.getCurrent().database.skills, (skillId) => {
        updateDatabaseRecord("items", record.id, { learnedSkillId: emptyToUndefined(skillId), skillId: emptyToUndefined(skillId) });
        refreshStory();
      }),
    ]),
    panel("사용 가능", actorClassChoices(record, refreshStory)),
  ];
}

function seedPanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return [
    panel("능력치 보정", statBonusFields(record, record.seedParameterBonuses, "seedParameterBonuses", "db-field-item-seed", refreshStory)),
    panel("사용 가능", actorClassChoices(record, refreshStory)),
  ];
}

function specialPanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return [
    el("div", {
      class: "db-item-type-panels",
      dataset: { testid: "db-items-special-panel" },
      children: [
        panel("발동 스킬", [
          selectField("발동 스킬", "db-picker-item-activate-skill", record.activateSkillId ?? record.skillId ?? "", store.getCurrent().database.skills, (skillId) => {
            updateDatabaseRecord("items", record.id, { activateSkillId: emptyToUndefined(skillId), skillId: emptyToUndefined(skillId) });
            refreshStory();
          }),
        ]),
        panel("사용 메시지", [
          selectLiteral("메시지", "db-field-item-usage-message", record.usageMessage, ["normal", "skill"], (usageMessage) =>
            updateDatabaseRecord("items", record.id, { usageMessage })
          ),
        ]),
        panel("사용 가능", actorClassChoices(record, refreshStory)),
      ],
    }),
  ];
}

function switchPanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return [
    el("div", {
      class: "db-item-type-panels",
      dataset: { testid: "db-items-switch-panel" },
      children: [
        panel("스위치 토글 ON/OFF", [
          selectField("스위치", "db-picker-item-switch", record.switchId ?? "", switchOptions(), (switchId) =>
            updateItemAndRefresh(record, { switchId: emptyToUndefined(switchId) }, refreshStory)
          ),
        ]),
        panel("사용 조건", [
          toggleSwitch("필드", "db-field-item-occasion-field", record.occasionField, (occasionField) => {
            updateDatabaseRecord("items", record.id, {
              occasionField,
              occasion: occasionFromFlags(occasionField, currentItem(record).occasionBattle),
            });
            refreshStory();
          }),
          toggleSwitch("전투", "db-field-item-occasion-battle", record.occasionBattle, (occasionBattle) => {
            updateDatabaseRecord("items", record.id, {
              occasionBattle,
              occasion: occasionFromFlags(currentItem(record).occasionField, occasionBattle),
            });
            refreshStory();
          }),
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
  refreshStory?: () => void,
): HTMLElement[] {
  return [
    statBonusField(record, bonuses, target, "attack", "공격력", `${testIdPrefix}-attack`, refreshStory),
    statBonusField(record, bonuses, target, "defense", "방어력", `${testIdPrefix}-defense`, refreshStory),
    statBonusField(record, bonuses, target, "mind", "정신력", `${testIdPrefix}-mind`, refreshStory),
    statBonusField(record, bonuses, target, "agility", "민첩성", `${testIdPrefix}-agility`, refreshStory),
  ];
}

function statBonusField(
  record: ItemRecord,
  bonuses: EquipmentStatBonuses,
  target: "equipmentProfile" | "seedParameterBonuses",
  key: keyof EquipmentStatBonuses,
  label: string,
  testid: string,
  refreshStory?: () => void,
): HTMLElement {
  // store normalize 와 동일 범위: 씨앗 보정 -50..50, 장비형 아이템 보정 -500..500 (P4).
  const bounds = target === "seedParameterBonuses" ? { min: -50, max: 50 } : { min: -500, max: 500 };
  return numberField(label, testid, bonuses[key], (value) => {
    const current = currentItem(record);
    const currentBonuses = target === "seedParameterBonuses" ? current.seedParameterBonuses : current.equipmentProfile.statBonuses;
    const next = { ...currentBonuses, [key]: value };
    if (target === "seedParameterBonuses") updateDatabaseRecord("items", record.id, { seedParameterBonuses: next });
    if (target === "equipmentProfile") updateEquipmentProfile(current, { ...current.equipmentProfile, statBonuses: next });
    refreshStory?.();
  }, bounds);
}

function recoveryFields(record: ItemRecord, key: "hpRecovery" | "mpRecovery", testIdPrefix: string, refreshStory: () => void): HTMLElement[] {
  const value = record[key];
  return [
    percentRecoveryField(record, key, testIdPrefix, refreshStory),
    numberField("고정값", `db-field-item-${testIdPrefix}-flat`, value.flat, (flat) => {
      updateDatabaseRecord("items", record.id, { [key]: { ...currentItem(record)[key], flat } });
      refreshStory();
    }, { min: 0, max: 999 }),
  ];
}

// 회복 % — 슬라이더+스테퍼 쌍(0-100, 스텝 5). base testid 는 필드 래퍼에도 남겨
// 기존 testid 계약을 유지하고, 입력은 -slider/-stepper 로 식별한다.
function percentRecoveryField(record: ItemRecord, key: "hpRecovery" | "mpRecovery", testIdPrefix: string, refreshStory: () => void): HTMLElement {
  const testid = `db-field-item-${testIdPrefix}-percent`;
  const fieldNode = sliderStepperField("%", testid, record[key].percentMax, (percentMax) => {
    updateDatabaseRecord("items", record.id, { [key]: { ...currentItem(record)[key], percentMax } });
    refreshStory();
  },
    { min: 0, max: 100, step: 5, unit: "%" }
  );
  fieldNode.dataset.testid = testid;
  return fieldNode;
}

function actorClassChoices(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  const project = store.getCurrent();
  return [
    avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", actorChips(project.database.actors), record.usableActorIds, (actorId, checked) => {
      updateDatabaseRecord("items", record.id, { usableActorIds: toggleActorIds(currentItem(record).usableActorIds, actorId, checked) });
      refreshStory();
    }),
    choiceList("직업", [
      ...project.database.classes.map((klass) =>
        checkboxField(klass.name, `db-field-item-usable-class-${klass.id}`, record.usableClassIds.includes(klass.id), (checked) => {
          updateDatabaseRecord("items", record.id, { usableClassIds: toggleClassIds(currentItem(record).usableClassIds, klass.id, checked) });
          refreshStory();
        })
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

function healStateChoices(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return store.getCurrent().database.states.map((state) =>
    checkboxField(state.name, `db-field-item-state-${state.id}`, record.healStateIds.includes(state.id), (checked) => {
      updateDatabaseRecord("items", record.id, { healStateIds: toggleStateIds(currentItem(record).healStateIds, state.id, checked) });
      refreshStory();
    })
  );
}

function consumptionLimitField(record: ItemRecord, refreshStory: () => void): HTMLElement {
  const value = String(record.consumptionLimit);
  const select = el("select", { dataset: { testid: "db-field-item-consumption-limit" } });
  for (const option of CONSUMPTION_LIMITS) select.append(el("option", { attrs: { value: option }, text: option === "noLimit" ? "제한 없음" : `${option}회` }));
  select.value = value;
  select.addEventListener("change", () => {
    updateDatabaseRecord("items", record.id, { consumptionLimit: parseConsumptionLimit(select.value) });
    refreshStory();
  });
  return field("사용 횟수", select);
}

// 농사 도구 옵션은 FARM_TOOLS(정본)에서 파생한다 — 하드코딩하면 axe/pickaxe 처럼
// 런타임 규칙(toolActions legacy-axe-chop/legacy-pick-mine)은 있는데 저작이 불가능한
// 드리프트가 생긴다. 라벨만 한글이고 저장값은 영문 정본 id 그대로다.
function farmToolField(record: ItemRecord, refreshStory: () => void): HTMLElement {
  const options = FARM_TOOLS.map((tool) => ({ id: tool, name: FARM_TOOL_LABELS[tool] }));
  return selectField("농사 도구", "db-field-item-farm-tool", record.farmTool ?? "", options, (farmTool) => {
    updateDatabaseRecord("items", record.id, { farmTool: isFarmTool(farmTool) ? farmTool : undefined });
    refreshStory();
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

function fillItemEffectStory(host: HTMLElement, project: Project, record: ItemRecord): void {
  const story = itemEffectStory(project, record);
  host.replaceChildren(
    el("div", { class: "db-effect-story-kicker", text: "사용하면" }),
    el("div", {
      class: "db-effect-story-facts",
      children: [
        storyFact("대상", story.target, "db-item-story-target"),
        storyFact("언제", story.occasion, "db-item-story-occasion"),
        storyFact("소비", story.consumption, "db-item-story-consumption"),
      ],
    }),
    el("div", {
      class: "db-effect-story-lines",
      children: story.effects.map((effect) => el("span", {
        class: "db-effect-story-line",
        text: effect,
        dataset: { testid: "db-item-story-effect" },
      })),
    }),
    ...story.notes.map((note) => el("p", { class: "db-effect-story-note", text: note })),
  );
}

function storyFact(label: string, value: string, testid: string): HTMLElement {
  return el("span", {
    class: "db-effect-story-fact",
    dataset: { testid },
    children: [el("small", { text: label }), el("strong", { text: value })],
  });
}

function recoveryStory(label: "HP" | "MP", recovery: ItemRecord["hpRecovery"]): string | undefined {
  if (recovery.percentMax <= 0 && recovery.flat <= 0) return undefined;
  if (recovery.percentMax > 0 && recovery.flat > 0) return `${label} 최대치 ${recovery.percentMax}% + ${recovery.flat} 회복`;
  if (recovery.percentMax > 0) return `${label} 최대치 ${recovery.percentMax}% 회복`;
  return `${label} ${recovery.flat} 회복`;
}

function itemTargetLabel(record: ItemRecord): string {
  if (record.captureProfile) return "적 1명";
  if (record.careProfile) return "파티 몬스터 1마리";
  switch (record.scope) {
    case "ally": return "아군 1명";
    case "allAllies": return "아군 전체";
    case "enemy": return "적 1명";
    case "none": return "대상 없음";
    default: return "대상 없음";
  }
}

function itemOccasionLabel(record: ItemRecord): string {
  if (record.onlyUsableInMenu) return "메뉴 전용";
  const field = record.occasion !== "never" && record.occasion !== "battle"
    && (record.occasionField || record.occasion === "field" || record.occasion === "always");
  const battle = record.occasion !== "never" && record.occasion !== "field"
    && (record.occasionBattle || record.occasion === "battle" || record.occasion === "always");
  if (field && battle) return "필드 · 전투";
  if (field) return "필드";
  if (battle) return "전투";
  return "사용 불가";
}

function statStory(bonuses: EquipmentStatBonuses): string[] {
  const labels: readonly [keyof EquipmentStatBonuses, string][] = [
    ["attack", "공격력"],
    ["defense", "방어력"],
    ["mind", "정신력"],
    ["agility", "민첩성"],
  ];
  return labels.flatMap(([key, label]) => bonuses[key] === 0 ? [] : [`${label} ${signed(bonuses[key])}`]);
}

function namedIds(ids: readonly string[], records: readonly { readonly id: string; readonly name: string }[]): string[] {
  return ids.map((id) => namedId(id, records));
}

function namedId(id: string, records: readonly { readonly id: string; readonly name: string }[]): string {
  return records.find((record) => record.id === id)?.name ?? `삭제된 항목(${id})`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function updateItemAndRefresh(record: ItemRecord, patch: Partial<ItemRecord>, refreshStory: () => void): void {
  updateDatabaseRecord("items", record.id, patch);
  refreshStory();
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
