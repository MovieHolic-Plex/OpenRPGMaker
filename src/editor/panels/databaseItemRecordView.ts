import { activeItemEffects, itemAllowsMenu, itemAllowsBattle } from "@/project/itemUsage";
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
import { emptyState, sectionCard } from "@/editor/panels/databaseWorkspace";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { itemCaptureFields, itemPriceField, itemScopeField } from "@/editor/panels/databaseBasicRecordFields";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { FARM_TOOLS, isFarmTool } from "@/project/farmModel";
import { isItemActorEligible } from "@/project/itemEligibility";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import { databaseFieldSupportNotice } from "@/editor/databaseFieldSupport";
import type {
  ActorId,
  ActorRecord,
  ClassId,
  DatabaseStateEffect,
  EquipmentStatBonuses,
  ItemCareProfile,
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

const STATE_EFFECT_OPERATIONS = ["add", "remove"] as const satisfies readonly DatabaseStateEffect["operation"][];
const CARE_KIND_OPTIONS: readonly { readonly id: "none" | ItemCareProfile["kind"]; readonly name: string }[] = [
  { id: "none", name: "(없음)" },
  { id: "feed", name: "먹이" },
  { id: "toy", name: "장난감" },
];
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
  seed: "능력치 성장",
  special: "특수",
  switch: "장치 작동",
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
export function itemEffectStory(project: Project, authoredRecord: ItemRecord): ItemEffectStory {
  const record = activeItemEffects(authoredRecord);
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
  // add-op 는 전투(applyStateEffects)와 필드 메뉴(playerItemUse) 둘 다 확률 판정을 거친다 —
  // 100 미만이면 확률을 함께 적어 저작자가 판정을 예측할 수 있게 한다.
  for (const effect of record.stateEffects) {
    if (effect.operation !== "add") continue;
    const name = namedId(effect.stateId, project.database.states);
    effects.push(effect.chance < 100 ? `상태 부여: ${name} (${effect.chance}%)` : `상태 부여: ${name}`);
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
  if (record.animationId) notes.push(`전투 연출: ${namedId(record.animationId, project.database.battleAnimations)}`);
  if (isEquipmentItemType(record.type)) notes.push("착용 효과는 카탈로그의 장비 항목에서 설정합니다.");
  if (record.onlyEffectiveOnDeadActors) notes.push("전투불능 대상에게만 유효");
  const runtimeAppliesActorRestrictions = !isItemActorEligible(project, record, undefined);
  if (runtimeAppliesActorRestrictions && (record.usableActorIds.length > 0 || record.usableClassIds.length > 0)) {
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
  // 공용 상세 창 골격: 히어로는 고정, 본문(.db-ws-detail-body)만 스크롤한다.
  // 카드는 db-ws-stack(auto-fit minmax) 이라 폭이 남으면 열이 늘고, 좁아지면 접힌다.
  form.classList.add("db-item-ws");
  form.append(
    itemHeader(record),
    el("div", {
      class: "db-ws-detail-body",
      children: [
        el("div", {
          class: "db-items-oprn-workbench db-ws-stack",
          dataset: { testid: "db-items-oprn-workbench" },
          children: itemWorkbenchCards(record, form, rerender, storyHost, refreshStory),
        }),
      ],
    }),
  );
}

/**
 * 카드 순서 = 정보 위계. 오름차순으로 쌓지 않고 세 단계로 나눠 밝혀둔다:
 *   요약(무엇이 일어나는가) → 정의(이게 무엇인가) → 효과(무엇을 하는가) → 사용 제한.
 *
 * 이전 배열은 [요약][기본 설정][수치][그래픽][범위][옵션][회복량][상태 회복][사용 가능] 이라
 * (1) 그래픽 카드가 효과 카드들 사이에 끼어 있었고,
 * (2) "수치" 한 장에 가격·범위·포획 배율·볼 등급·연결 스킬이 섞여 이름이 내용을 설명하지 못했고,
 * (3) scope 컨트롤이 "수치 → 범위" 셀렉트와 "범위 → 대상" 세그먼트로 **두 개** 있었고,
 * (4) "사용 가능" 카드가 종류별 패널 4곳에 각각 복제돼 있었다.
 */
function itemWorkbenchCards(
  record: ItemRecord,
  form: HTMLElement,
  rerender: () => void,
  storyHost: HTMLElement,
  refreshStory: () => void,
): HTMLElement[] {
  const story = spanCard(sectionCard({
    title: "이 아이템을 사용하면",
    testid: "db-item-card-story",
    collapsible: true,
    collapsed: true,
    children: [storyHost],
  }));
  if (isEquipmentItemType(record.type)) {
    return [story, basicsCard(record, rerender, refreshStory), graphicCard(record, rerender), equipmentRedirect(form), supportNotice()];
  }
  return [
    story,
    sectionLabel("정의", "definition"),
    basicsCard(record, rerender, refreshStory),
    sectionLabel("효과", "effect"),
    ...typePanels(record, refreshStory),
    ...(record.type === "medicine" || (record.type === "special" && !record.captureProfile && !record.careProfile) ? [stateEffectsCard(record, rerender, refreshStory)] : []),
    ...(hasUseEffects(record.type) && (record.type === "medicine" || (!record.captureProfile && !record.careProfile)) ? [animationCard(record, refreshStory)] : []),
    ...(record.type !== "normalGoods" ? [targetingCard(record, refreshStory)] : []),
    sectionLabel("사용 제한", "limits"),
    ...(hasActorRestrictions(record.type) ? [usableCard(record, refreshStory)] : []),
    ...(record.type === "special" && !record.careProfile ? [captureCard(record, refreshStory, rerender)] : []),
    ...(record.type === "special" && !record.captureProfile ? [careCard(record, rerender, refreshStory)] : []),
    graphicCard(record, rerender),
    supportNotice(),
  ];
}

/** 카드 제목(2단계)·필드 라벨(3단계) 위에 한 단계를 더한 카드 묶음 구분자. */
function sectionLabel(text: string, slug: string): HTMLElement {
  return el("h4", {
    class: "db-item-section-label db-ws-span",
    text,
    dataset: { testid: `db-item-section-${slug}` },
  });
}

function basicsCard(record: ItemRecord, rerender: () => void, refreshStory: () => void): HTMLElement {
  const card = sectionCard({
    title: "기본",
    testid: "db-item-card-basics",
    children: [
      textField("설명", "db-field-item-description", record.description, (description) =>
        updateDatabaseRecord("items", record.id, { description })
      ),
      itemTypeField(record, rerender),
      el("p", { class: "db-field-hint", text: "종류를 바꾸면 이전 효과는 보관되며 적용되지 않습니다. 착용할 물건은 목록 아래의 ‘+ 장비’로 만드세요." }),
      itemPriceField(record.id),
      ...(!isEquipmentItemType(record.type) ? [consumptionLimitField(record, refreshStory)] : []),
      ...(record.type === "normalGoods" || record.farmTool ? [farmToolField(record, refreshStory)] : []),
    ],
  });
  card.classList.add("db-item-basics", "db-ws-span");
  return card;
}

function itemTypeField(record: ItemRecord, rerender: () => void): HTMLElement {
  const control = selectLiteral("종류", "db-field-item-type", record.type,
    ITEM_TYPES.filter((type) => !isEquipmentItemType(type) || type === record.type), (type) => {
      updateItemType(record, type);
      rerender();
    });
  for (const option of control.querySelectorAll("option")) option.textContent = ITEM_TYPE_LABELS[option.value as ItemType];
  return control;
}

function graphicCard(record: ItemRecord, rerender: () => void): HTMLElement {
  return spanCard(sectionCard({
    title: "외형",
    collapsible: true,
    collapsed: true,
    hint: "목록·게임 인벤토리·장비 메뉴·상점은 아이콘을 우선하며, 없으면 이미지를 사용합니다.",
    testid: "db-item-card-graphic",
    children: [resourcePanel(record, rerender)],
  }));
}

/**
 * 대상·사용 시점을 한 카드가 소유한다. **한 화면에 scope 컨트롤은 하나만 생긴다** — 약
 * 계열은 자신의 2지 세그먼트(`db-field-item-scope`)가 권위자이므로 공용 `db-field-scope`
 * 셀렉트를 그리지 않는다. 두 컨트롤이 같은 record.scope 를 각각 쓰면 한쪽을 바꿔도 다른
 * 쪽은 재렌더 전까지 옛 값을 보여준다(장비 부위 중복 P0 와 같은 모양).
 */
function targetingCard(record: ItemRecord, refreshStory: () => void): HTMLElement {
  const children: HTMLElement[] = record.type === "medicine"
    ? [segmentedControl("대상", "db-field-item-scope", record.scope, MEDICINE_SCOPE_OPTIONS, (scope) =>
      updateItemAndRefresh(record, { scope: scope as ItemScope }, refreshStory)
    )]
    : [itemScopeField(record.id, refreshStory)];
  children.push(itemOccasionField(record, refreshStory));
  if (record.type === "medicine") {
    children.push(
      toggleSwitch("전투불능 대상에게만 유효", "db-field-item-only-dead", record.onlyEffectiveOnDeadActors, (onlyEffectiveOnDeadActors) =>
        updateItemAndRefresh(record, { onlyEffectiveOnDeadActors }, refreshStory)
      ),
    );
  }
  children.push(el("p", { class: "db-field-hint", text: "책·능력치 성장·장치 작동은 필드 전용, 스킬 발동·포획은 전투 전용입니다. 부활은 필드에서만 사용할 수 있습니다." }));
  return sectionCard({ title: "대상과 사용 시점", testid: "db-item-card-targeting", children });
}

function itemOccasionField(record: ItemRecord, refreshStory: () => void): HTMLElement {
  return selectLiteral("사용 시점", "db-field-item-occasion", record.occasion,
    ["always", "field", "battle", "never"], (occasion) => {
      updateDatabaseRecord("items", record.id, {
        occasion, occasionField: occasion === "always" || occasion === "field",
        occasionBattle: occasion === "always" || occasion === "battle",
        onlyUsableInMenu: occasion === "field",
      });
      refreshStory();
    });
}

/** 포획은 특수 아이템에서 명시적으로 켠 뒤 수치를 편집한다. */
function captureCard(record: ItemRecord, refreshStory: () => void, rerender: () => void): HTMLElement {
  return sectionCard({
    title: "몬스터 포획",
    collapsible: true,
    collapsed: !record.captureProfile,
    hint: "몬스터 포획용 아이템일 때만 적용됩니다",
    testid: "db-item-card-capture",
    children: [
      toggleSwitch("포획 기능 사용", "db-field-item-capture-enabled", Boolean(record.captureProfile), (enabled) => {
        updateDatabaseRecord("items", record.id, { captureProfile: enabled ? { multiplier: 1 } : undefined });
        rerender();
      }),
      ...(record.captureProfile ? [el("div", { class: "db-item-grid", children: itemCaptureFields(record.id, refreshStory, 0.01) })] : []),
    ],
  });
}

function usableCard(record: ItemRecord, refreshStory: () => void): HTMLElement {
  return spanCard(sectionCard({
    title: "사용 대상 제한",
    collapsible: true,
    collapsed: record.usableActorIds.length === 0 && record.usableClassIds.length === 0,
    hint: "필드: 사용 대상 / 전투: 아이템을 사용하는 주인공",
    testid: "db-item-card-usable",
    children: actorClassChoices(record, refreshStory),
  }));
}

/** 사용 시 효과(상태 변화·전투 연출)가 실행되는 종류 — 전투 런타임 applyItem 이 읽는 두 종류. */
function hasUseEffects(type: ItemType): boolean {
  return type === "medicine" || type === "special";
}

/**
 * 상태 변화 — 스킬 탭과 같은 행 모양(상태 · 확률 · 부여/해제 · 삭제). 「상태 회복」 체크박스는
 * remove 100% 의 지름길이고, 이 카드는 부여와 확률까지 다루는 정본 편집기다.
 */
function stateEffectsCard(record: ItemRecord, rerender: () => void, refreshStory: () => void): HTMLElement {
  const states = store.getCurrent().database.states;
  const effects = record.stateEffects;
  const rows = effects.map((effect, index) => stateEffectRow(record, effect, index, rerender, refreshStory));
  const add = el("button", {
    class: "db-ws-btn db-ws-btn-ghost db-item-state-effect-add",
    text: "+ 상태 추가",
    attrs: { type: "button", ...(states.length === 0 ? { disabled: "" } : {}) },
    dataset: { testid: "db-item-state-effect-add" },
    on: {
      click: () => {
        const state = states[0];
        if (!state) return;
        updateStateEffects(record, [...currentItem(record).stateEffects, { stateId: state.id, chance: 100, operation: "add" }], refreshStory);
        rerender();
      },
    },
  });
  const body = rows.length > 0 ? rows : [el("div", { class: "db-item-state-effect-empty", text: "상태 변화 없음" })];
  return spanCard(sectionCard({
    title: "상태 변화",
    collapsible: true,
    collapsed: record.stateEffects.length === 0,
    hint: "필드·전투에 적용됩니다. 특수 아이템에 발동 스킬이 있으면 스킬 효과를 사용합니다.",
    testid: "db-item-card-state-effects",
    children: [el("div", { class: "db-item-state-effects", children: [...body, add] })],
  }));
}

function stateEffectRow(record: ItemRecord, effect: DatabaseStateEffect, index: number, rerender: () => void, refreshStory: () => void): HTMLElement {
  const states = store.getCurrent().database.states;
  const stateOptions = states.some((state) => state.id === effect.stateId) ? states : [...states, { id: effect.stateId, name: effect.stateId }];
  const chance = el("input", { attrs: { type: "number", min: "0", max: "100" }, value: effect.chance, dataset: { testid: `db-field-item-state-effect-chance-${index}` } });
  chance.addEventListener("input", () => {
    const next = clampPercent(Number(chance.value));
    chance.value = String(next);
    updateStateEffectAt(record, index, { chance: next }, refreshStory);
  });
  return el("div", {
    class: "db-item-state-effect-row",
    dataset: { testid: `db-item-state-effect-row-${index}` },
    children: [
      selectField("상태", `db-field-item-state-effect-state-${index}`, effect.stateId, stateOptions, (stateId) =>
        updateStateEffectAt(record, index, { stateId }, refreshStory)
      ),
      field("확률 %", chance),
      selectLiteral("조작", `db-field-item-state-effect-op-${index}`, effect.operation, STATE_EFFECT_OPERATIONS, (operation) =>
        updateStateEffectAt(record, index, { operation }, refreshStory)
      ),
      el("button", {
        class: "db-ws-btn db-ws-btn-danger db-item-state-effect-delete",
        text: "삭제",
        attrs: { type: "button" },
        dataset: { testid: `db-item-state-effect-delete-${index}` },
        on: {
          click: () => {
            updateStateEffects(record, currentItem(record).stateEffects.filter((_, effectIndex) => effectIndex !== index), refreshStory);
            rerender();
          },
        },
      }),
    ],
  });
}

function updateStateEffectAt(record: ItemRecord, index: number, patch: Partial<DatabaseStateEffect>, refreshStory: () => void): void {
  updateStateEffects(record, currentItem(record).stateEffects.map((effect, effectIndex) => (effectIndex === index ? { ...effect, ...patch } : effect)), refreshStory);
}

function updateStateEffects(record: ItemRecord, stateEffects: readonly DatabaseStateEffect[], refreshStory: () => void): void {
  updateDatabaseRecord("items", record.id, { stateEffects: stateEffects.map((effect) => ({ ...effect, chance: clampPercent(effect.chance) })) });
  refreshStory();
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** 전투에서 아이템을 쓰면 대상 위치에 재생되는 애니메이션(battle/runtime.ts applyItem). */
function animationCard(record: ItemRecord, refreshStory: () => void): HTMLElement {
  return sectionCard({
    title: "전투 연출",
    collapsible: true,
    collapsed: !record.animationId,
    hint: "전투에서 사용할 때 대상 위치에 재생됩니다",
    testid: "db-item-card-animation",
    children: [
      selectField("애니메이션", "db-picker-item-animation", record.animationId ?? "", store.getCurrent().database.battleAnimations, (animationId) =>
        updateItemAndRefresh(record, { animationId: emptyToUndefined(animationId) }, refreshStory)
      ),
    ],
  });
}

/** 몬스터 돌봄(monsterCare.applyCareItem) — 종류가 (없음)이면 careProfile 자체를 지운다. */
function careCard(record: ItemRecord, rerender: () => void, refreshStory: () => void): HTMLElement {
  const care = record.careProfile;
  const children: HTMLElement[] = [
    selectField("종류", "db-field-item-care-kind", care?.kind ?? "none", CARE_KIND_OPTIONS, (kind) => {
      const current = currentItem(record).careProfile;
      const next: ItemCareProfile | undefined = kind !== "feed" && kind !== "toy"
        ? undefined
        : { kind, friendshipDelta: current?.friendshipDelta ?? 0, ...(current?.expDelta !== undefined ? { expDelta: current.expDelta } : {}) };
      updateItemAndRefresh(record, { careProfile: next, ...(next ? { occasion: "field", occasionField: true, occasionBattle: false, onlyUsableInMenu: true } : {}) }, refreshStory);
      rerender();
    }),
  ];
  if (care) {
    children.push(
      numberField("친밀도 증감", "db-field-item-care-friendship", care.friendshipDelta, (friendshipDelta) => {
        const current = currentItem(record).careProfile ?? care;
        updateItemAndRefresh(record, { careProfile: { ...current, friendshipDelta } }, refreshStory);
      }, { min: -100, max: 100 }),
      numberField("경험치", "db-field-item-care-exp", care.expDelta ?? 0, (expDelta) => {
        const current = currentItem(record).careProfile ?? care;
        const { expDelta: _drop, ...rest } = current;
        updateItemAndRefresh(record, { careProfile: expDelta > 0 ? { ...rest, expDelta } : rest }, refreshStory);
      }, { min: 0, max: 9999 }),
    );
  }
  return sectionCard({
    title: "몬스터 돌봄",
    collapsible: true,
    collapsed: !care,
    hint: "파티 몬스터에게 먹이·장난감으로 쓰는 아이템일 때만 적용됩니다",
    testid: "db-item-card-care",
    children: [el("div", { class: "db-item-grid", children })],
  });
}

/** 배우/직업 허용 목록이 의미를 갖는 종류 — 사용자가 직접 쓰는 아이템만. */
function hasActorRestrictions(type: ItemType): boolean {
  return type === "medicine" || type === "book" || type === "seed";
}

function supportNotice(): HTMLElement {
  return spanCard(databaseFieldSupportNotice("consumptionLimit", "usableActorIds", "usableClassIds", "seedParameterBonuses", "stateEffects", "animationId", "careProfile"));
}

/** `db-ws-stack` 안에서 한 행을 다 쓰는 카드로 표시한다. */
function spanCard(node: HTMLElement): HTMLElement {
  node.classList.add("db-ws-span");
  return node;
}

function typePanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  if (record.type === "medicine") return medicinePanels(record, refreshStory);
  if (record.type === "book") return bookPanels(record, refreshStory);
  if (record.type === "seed") return seedPanels(record, refreshStory);
  if (record.type === "special") return specialPanels(record, refreshStory);
  if (record.type === "switch") return switchPanels(record, refreshStory);
  return [spanCard(sectionCard({
    title: "일반 물품",
    testid: "db-item-card-normal",
    children: [el("p", { class: "db-ws-usage", text: "효과가 없는 이벤트 제어용 아이템입니다. 소지·전달·상점 판매만 가능합니다." })],
  }))];
}

// 장비형 아이템은 이 탭에서 편집할 게 없다 — 빈 폼 대신 정규 빈 상태 + 이동 CTA.
function equipmentRedirect(form: HTMLElement): HTMLElement {
  return el("div", {
    class: "db-item-equipment-redirect db-ws-span",
    dataset: { testid: "db-item-equipment-redirect" },
    children: [
      emptyState({
        icon: "⚔",
        title: "착용 장비는 별도 항목으로 만듭니다",
        body: "이 항목은 이전 형식의 비착용 물품입니다. 장비로 변환되거나 연결되지 않습니다. 목록 아래의 ‘+ 장비’로 착용할 물건을 만드세요.",
        testid: "db-item-equipment-redirect-empty",
        action: {
          label: "장비 목록에서 새로 만들기",
          testid: "db-item-open-equipment-tab",
          onClick: () => {
            const root = databasePanelRootFrom(form);
            if (root) switchDatabaseActiveTab("equipment", root);
          },
        },
      }),
    ],
  });
}

function itemHeader(record: ItemRecord): HTMLElement {
  const project = store.getCurrent();
  const url = resolveAssetResourceUrl(record.iconResourceId ?? record.imageResourceId, { project });
  const icon = el("div", {
    class: `db-item-inspector-icon${url ? "" : " db-image-placeholder"}`,
    attrs: { role: "img", "aria-label": url ? `${record.name} 아이콘` : `${record.name} 이미지 없음` },
    text: url ? undefined : "이미지 없음",
  });
  if (url) icon.style.backgroundImage = `url("${url}")`;
  const name = textField("이름", "db-field-name", record.name, (name) => updateDatabaseRecord("items", record.id, { name }));
  return el("div", {
    class: "db-item-inspector-header db-ws-hero",
    dataset: { testid: "db-item-inspector-header" },
    children: [
      el("div", { class: "db-ws-hero-media", children: [icon] }),
      el("div", {
        class: "db-item-inspector-title db-ws-hero-text",
        children: [
          el("div", { class: "db-item-inspector-name", children: [name] }),
          el("div", {
            class: "db-ws-hero-tags",
            children: [el("span", { class: "db-ws-tag db-item-inspector-type-tag", text: ITEM_TYPE_LABELS[record.type] })],
          }),
        ],
      }),
    ],
  });
}

function resourcePanel(record: ItemRecord, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-item-grid db-item-graphic-grid",
    children: [
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
    ],
  });
}

// 종류별 패널 묶음. testid 계약(db-items-<type>-panel) 때문에 래퍼 노드는 남기지만
// 레이아웃에는 참여하지 않는다(`display: contents`) — 카드가 바깥 스택의 남은 칸을
// 그대로 채우도록 해서, 묶음이 자기 행을 통째로 잡아먹던 여백을 없앤다.
function typePanelGroup(testid: string, cards: readonly HTMLElement[]): HTMLElement {
  return el("div", {
    class: "db-item-type-panels",
    dataset: { testid },
    children: [...cards],
  });
}

function medicinePanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return [
    typePanelGroup("db-items-medicine-panel", [
      // HP·MP 는 같은 두 필드(%, 고정값)라 카드 두 장으로 나누면 격자에 홀수 칸이
      // 남는다 — 한 카드 안에서 소제목으로 나눈다.
      spanCard(sectionCard({
        title: "회복량",
        hint: "% 는 최대치 기준, 고정값과 합산됩니다",
        testid: "db-item-card-recovery",
        children: [
          fieldGroup("HP 회복", recoveryFields(record, "hpRecovery", "hp", refreshStory)),
          fieldGroup("MP 회복", recoveryFields(record, "mpRecovery", "mp", refreshStory)),
        ],
      })),
      spanCard(sectionCard({
        title: "상태 회복",
        collapsible: true,
        collapsed: record.healStateIds.length === 0 && !record.stateEffects.some((effect) => effect.operation === "remove"),
        testid: "db-item-card-heal-states",
        children: [choiceList("상태", healStateChoices(record, refreshStory))],
      })),
    ]),
  ];
}

function bookPanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return [
    typePanelGroup("db-items-book-panel", [
      sectionCard({
        title: "습득 스킬",
        testid: "db-item-card-learned-skill",
        children: [
          selectField("스킬", "db-picker-item-learned-skill", record.learnedSkillId ?? record.skillId ?? "", store.getCurrent().database.skills, (skillId) => {
            updateDatabaseRecord("items", record.id, { learnedSkillId: emptyToUndefined(skillId), skillId: emptyToUndefined(skillId) });
            refreshStory();
          }),
        ],
      }),
    ]),
  ];
}

function seedPanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return [
    typePanelGroup("db-items-seed-panel", [
      sectionCard({
        title: "영구 능력치 보정",
        testid: "db-item-card-seed-bonuses",
        children: [el("div", { class: "db-item-grid", children: statBonusFields(record, record.seedParameterBonuses, "seedParameterBonuses", "db-field-item-seed", refreshStory) })],
      }),
    ]),
  ];
}

function specialPanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  if (record.careProfile) return [];
  if (record.captureProfile) return [];
  return [
    typePanelGroup("db-items-special-panel", [
      sectionCard({
        title: "전투에서 발동할 스킬",
        hint: "스킬 발동은 전투 전용입니다. 스킬 없는 상태 변화와 몬스터 돌봄은 필드에서도 사용할 수 있습니다.",
        testid: "db-item-card-activate-skill",
        children: [
          selectField("발동 스킬", "db-picker-item-activate-skill", record.activateSkillId ?? record.skillId ?? "", store.getCurrent().database.skills, (skillId) => {
            updateDatabaseRecord("items", record.id, { activateSkillId: emptyToUndefined(skillId), skillId: emptyToUndefined(skillId) });
            refreshStory();
          }),
        ],
      }),
    ]),
  ];
}

function switchPanels(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return [
    typePanelGroup("db-items-switch-panel", [
      sectionCard({
        title: "장치 켜기 (ON)",
        hint: "선택한 스위치를 켭니다. 이미 켜져 있으면 사용하지 않습니다.",
        testid: "db-item-card-switch",
        children: [
          selectField("스위치", "db-picker-item-switch", record.switchId ?? "", switchOptions(), (switchId) =>
            updateItemAndRefresh(record, { switchId: emptyToUndefined(switchId) }, refreshStory)
          ),
        ],
      }),
    ]),
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
    el("p", { class: "db-field-hint", text: "주인공과 직업 목록은 각각 비어 있으면 제한 없습니다. 둘 다 선택하면 두 조건을 모두 만족해야 합니다." }),
    avatarChipRow("허용 주인공", "db-field-item-usable-actors", actorChips(project.database.actors), record.usableActorIds, (actorId, checked) => {
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
  }));
}

function healStateChoices(record: ItemRecord, refreshStory: () => void): HTMLElement[] {
  return store.getCurrent().database.states.map((state) =>
    checkboxField(state.name, `db-field-item-state-${state.id}`, (record.healStateIds.includes(state.id) || record.stateEffects.some((effect) => effect.stateId === state.id && effect.operation === "remove")), (checked) => {
      updateDatabaseRecord("items", record.id, {
        healStateIds: toggleStateIds(currentItem(record).healStateIds, state.id, checked),
        stateEffects: currentItem(record).stateEffects.filter((effect) => effect.stateId !== state.id || effect.operation !== "remove"),
      });
      refreshStory();
    })
  );
}

function consumptionLimitField(record: ItemRecord, refreshStory: () => void): HTMLElement {
  const value = !record.consumable ? "reusable" : record.consumptionLimit === "noLimit" ? "1" : String(record.consumptionLimit);
  const options = [
    { id: "reusable", name: "소모하지 않음" },
    ...[1, 2, 3, 4, 5].map((n) => ({ id: String(n), name: n === 1 ? "매회 1개 소모" : `한 개를 ${n}회 사용` })),
  ];
  return selectField("소모 방식", "db-field-item-consumption-limit", value, options, (next) => {
    if (!options.some((option) => option.id === next)) return;
    updateDatabaseRecord("items", record.id, {
      consumable: next !== "reusable",
      consumptionLimit: next === "reusable" ? record.consumptionLimit : parseConsumptionLimit(next),
    });
    refreshStory();
  });
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

/** 카드 안 소제목 + 세로 필드 묶음(체크박스 격자인 choiceList 와 달리 필드 폭을 유지). */
function fieldGroup(title: string, children: HTMLElement[]): HTMLElement {
  return el("div", { class: "db-item-subgroup", children: [el("strong", { text: title }), ...children] });
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
  const field = itemIsFieldUsable(record);
  const battle = itemIsBattleUsable(record);
  if (field && battle) return "필드 · 전투";
  if (field) return "필드";
  if (battle) return "전투";
  return "사용 불가";
}

function itemIsFieldUsable(record: ItemRecord): boolean { return itemAllowsMenu(record); }
function itemIsBattleUsable(record: ItemRecord): boolean { return itemAllowsBattle(record); }

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
  const occasion: ItemRecord["occasion"] = type === "normalGoods" || isEquipmentItemType(type) ? "never" : type === "special" && !current.careProfile ? "battle" : type === "medicine" ? "always" : "field";
  updateDatabaseRecord("items", record.id, {
    type,
    scope: type === "medicine" || type === "book" || type === "seed" ? "ally" : current.scope,
    occasion, occasionField: occasion === "always" || occasion === "field",
    occasionBattle: occasion === "always" || occasion === "battle",
    onlyUsableInMenu: occasion === "field",
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
