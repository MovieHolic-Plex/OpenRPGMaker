import { equipmentSlots } from "@/project/equipmentSlots";
import { equipmentSlotManager } from "@/editor/panels/equipmentSlotManager";
import { equipmentFields } from "@/editor/panels/databaseBasicRecordFields";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import {
  emptyToUndefined,
  field,
  numberField,
  selectField,
  sliderStepperField,
  textField,
  toggleSwitch,
} from "@/editor/panels/databaseControls";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { iconChangeButton, openDatabaseResourcePickerDialog, resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { actorDerivedStats } from "@/battle/battleBattlers";
import { normalizeActorRecord } from "@/project/actorModel";
import { DEFAULT_SWING_COOLDOWN_MS, DEFAULT_SWING_RANGE } from "@/project/actionCombat";
import {
  canEquip,
  effectiveActorEquipment,
  logicalEquipmentIds,
  transitionActorEquipment,
  type EquipmentTransitionFailureReason,
} from "@/project/equipmentRules";
import { store } from "@/project/store";
import { databaseFieldSupportNotice } from "@/editor/databaseFieldSupport";
import type { ActionWeaponProfile, ActorInitialEquipment, EquipmentRecord, EquipmentStatBonuses, ItemEquipmentEffectFlags, Project } from "@/project/types";
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

export type EquipmentEffectStory = {
  readonly statChanges: readonly string[];
  readonly effects: readonly string[];
};

export type EquipmentActorComparison = {
  readonly actorId: string;
  readonly actorName: string;
  readonly className: string;
  readonly level: number;
  readonly eligible: boolean;
  readonly alreadyEquipped: boolean;
  readonly reason?: EquipmentTransitionFailureReason;
  readonly replacedEquipmentNames: readonly string[];
  readonly current: EquipmentStatBonuses;
  readonly next?: EquipmentStatBonuses;
  readonly deltas?: EquipmentStatBonuses;
};

// 아이템 탭 equipmentEffectFields(databaseItemRecordView.ts)와 동일한 9종 플래그.
const LEGACY_EFFECT_FLAG_FIELDS: readonly { readonly key: Exclude<keyof ItemEquipmentEffectFlags, "autoRevive">; readonly label: string; readonly testid: string }[] = [
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

// halfMpCost 는 전투 MP 소모 계산(battleSkillMpCostFor)이 소비한다 — 그래서 저작 가능한 플래그다.
const EFFECT_FLAG_FIELDS = LEGACY_EFFECT_FLAG_FIELDS.filter(({ key }) =>
  key === "doubleAttack" || key === "attackAll" || key === "fixedEquipment" || key === "halfMpCost"
);

const STAT_FIELDS = [
  ["attack", "공격력"],
  ["defense", "방어력"],
  ["mind", "정신력"],
  ["agility", "민첩성"],
] as const satisfies readonly (readonly [keyof EquipmentStatBonuses, string])[];

export function equipmentEffectStory(project: Project, record: EquipmentRecord): EquipmentEffectStory {
  const statChanges = STAT_FIELDS.flatMap(([key, label]) =>
    record.statBonuses[key] === 0 ? [] : [`${label} ${signed(record.statBonuses[key])}`]
  );
  const effects = EFFECT_FLAG_FIELDS.filter(({ key }) => record.effectFlags[key]).map(({ label }) => label);
  effects.push(`명중률 ${record.accuracy}%`);
  effects.push(`치명타율 +${record.criticalRate}%p`);
  if (record.twoHanded) effects.push("양손 장비 · 방패 해제");
  if (record.cursed) effects.push("저주 · 장착 후 해제 제한");
  if (record.attackElementIds.length > 0) effects.push(`공격 속성: ${namedIds(record.attackElementIds.slice(0, 1), project.database.elements ?? [])}`);
  if (record.elementalDefenseIds.length > 0) effects.push(`속성 방어: ${namedIds(record.elementalDefenseIds, project.database.elements ?? [])}`);
  if (record.stateInflictIds.length > 0) {
    effects.push(`상태 부여 ${record.stateInflictionChance}%: ${namedIds(record.stateInflictIds, project.database.states)}`);
  }
  if (record.stateDefenseIds.length > 0 && record.stateDefenseMode === "resist") {
    const label = "상태 저항";
    effects.push(`${label} ${record.stateResistanceChance}%: ${namedIds(record.stateDefenseIds, project.database.states)}`);
  }
  if (record.usableAsItemSkillId) {
    effects.push(`사용 시 스킬: ${namedId(record.usableAsItemSkillId, project.database.skills)}`);
  }
  if ((record.grantsSkillIds ?? []).length > 0) {
    effects.push(`장착 시 스킬: ${namedIds(record.grantsSkillIds ?? [], project.database.skills)}`);
  }
  if (record.grantsCommand) effects.push(`장착 시 명령: ${record.grantsCommand.name || record.grantsCommand.id}`);
  return {
    statChanges,
    effects: effects.length > 0 ? effects : ["고유 효과 없음"],
  };
}

/** Uses the same equip transition and derived-stat authorities as the live runtime. */
export function equipmentActorComparison(
  project: Project,
  record: EquipmentRecord,
  actorId: string,
): EquipmentActorComparison | undefined {
  const actor = project.database.actors.find((entry) => entry.id === actorId);
  if (!actor) return undefined;
  const normalizedActor = normalizeActorRecord(actor);
  const level = normalizedActor.initialLevel;
  const className = project.database.classes.find((entry) => entry.id === actor.classId)?.name ?? "직업 없음";
  const currentEquipment = effectiveActorEquipment(project, actor, actor.initialEquipment, actor.classId);
  const current = equipmentComparisonStats(project, normalizedActor, level, currentEquipment);
  const alreadyEquipped = logicalEquipmentIds(project, currentEquipment).includes(record.id);
  if (alreadyEquipped) {
    return {
      actorId,
      actorName: actor.name,
      className,
      level,
      eligible: true,
      alreadyEquipped: true,
      replacedEquipmentNames: [],
      current,
      next: current,
      deltas: statDifference(current, current),
    };
  }
  const transition = transitionActorEquipment({
    project,
    actorId,
    classId: actor.classId,
    equipment: actor.initialEquipment,
    inventory: { [record.id]: 1 },
    slot: record.slot,
    equipmentId: record.id,
  });
  if (transition.kind === "rejected") {
    return {
      actorId,
      actorName: actor.name,
      className,
      level,
      eligible: false,
      alreadyEquipped: false,
      reason: transition.reason,
      replacedEquipmentNames: [],
      current,
    };
  }
  const nextEquipment = effectiveActorEquipment(project, actor, transition.equipment, actor.classId);
  const next = equipmentComparisonStats(project, normalizedActor, level, nextEquipment);
  return {
    actorId,
    actorName: actor.name,
    className,
    level,
    eligible: true,
    alreadyEquipped: false,
    replacedEquipmentNames: removedEquipmentNames(project, currentEquipment, nextEquipment),
    current,
    next,
    deltas: statDifference(next, current),
  };
}

export function equipmentEffectSummaryChips(record: EquipmentRecord): EquipmentEffectSummaryChips {
  const flags = EFFECT_FLAG_FIELDS
    .filter(({ key }) => record.effectFlags[key])
    .map(({ label }) => label);
  const badges: string[] = [];
  if (record.twoHanded) badges.push("양손 장비");
  if (record.cursed) badges.push("저주");
  const counts: string[] = [
    `명중률 ${record.accuracy}%`,
    `치명타율 +${record.criticalRate}%p`,
  ];
  if (record.attackElementIds.length > 0) counts.push("공격 속성 1");
  if (record.elementalDefenseIds.length > 0) counts.push(`속성 방어 ${record.elementalDefenseIds.length}`);
  if (record.stateInflictIds.length > 0) counts.push(`상태 부여 ${record.stateInflictIds.length}`);
  if (record.stateDefenseIds.length > 0 && record.stateDefenseMode === "resist") counts.push(`상태 방어 ${record.stateDefenseIds.length}`);
  return { flags, badges, counts };
}

export function renderEquipmentRecordForm(form: HTMLElement, record: EquipmentRecord, rerender: () => void = () => undefined): void {
  // 요약 칩 호스트 — 헤더로 승격. refreshSummaryChips 클로저는 호스트 자식만 교체하는
  // 부분 갱신 경로를 유지한다(전체 폼 재렌더 금지).
  const summaryHost = el("div", {
    class: "db-equipment-summary-chips",
    dataset: { testid: "db-equipment-summary-chips" },
  });
  const storyHost = el("section", {
    class: "db-equipment-effect-story",
    attrs: { "aria-label": "장비 효과 요약" },
    dataset: { testid: "db-equipment-effect-story" },
  });
  const comparisonResultHost = el("div", {
    class: "db-equipment-comparison-result",
    dataset: { testid: "db-equipment-comparison-result" },
  });
  let selectedActorId = store.getCurrent().database.actors[0]?.id ?? "";
  const permissions = el("p", { class: "db-field-hint", dataset: { testid: "db-equipment-permission-result" } });
  const refreshOverview = (): void => {
    const project = store.getCurrent();
    const current = currentEquipment(record);
    const allowed = project.database.actors.filter((actor) => canEquip(project, actor, current));
    permissions.textContent = `최종 허용: ${allowed.length ? allowed.map((actor) => actor.name).join(", ") : "없음"} (주인공·직업의 허용 설정 포함)`;
    fillEquipmentSummaryChips(summaryHost, current);
    fillEquipmentEffectStory(storyHost, project, current);
    fillEquipmentComparison(comparisonResultHost, equipmentActorComparison(project, current, selectedActorId));
  };
  const comparisonPanel = equipmentComparisonPanel(
    selectedActorId,
    comparisonResultHost,
    (actorId) => {
      selectedActorId = actorId;
      refreshOverview();
    },
  );
  refreshOverview();

  // 공용 상세 창 골격(databaseWorkspace detailPane 과 같은 구조): 히어로는 고정 행,
  // 본문(.db-ws-detail-body)만 스크롤한다. 예전에는 폼 자체가 2열 그리드 + overflow:auto
  // 라 카드가 열 사이에 흩어지고 라벨이 82px 열에 눌려 잘렸다.
  form.classList.add("db-eq-ws");
  form.append(
    equipmentHeader(record, summaryHost, () => { refreshOverview(); rerender(); }),
    el("div", {
      class: "db-ws-detail-body",
      children: [
        el("div", {
          class: "db-ws-stack db-eq-stack",
          children: [
            equipmentSlotManager(record.id, () => { refreshOverview(); rerender(); }),
            spanCard(sectionCard({
              title: "효과 요약과 착용 비교",
              collapsible: true,
              collapsed: true,
              hint: "DB 초기 레벨·초기 장비 기준 시뮬레이션",
              testid: "db-equipment-card-overview",
              children: [storyHost, comparisonPanel],
            })),
            sectionCard({
              title: "능력치 보정",
              hint: "착용 중에만 더해집니다",
              testid: "db-equipment-card-stats",
              children: [
                el("div", {
                  class: "db-eq-grid",
                  children: [
                    statField({ equipment: record, key: "attack", label: "공격력", testid: "db-field-equipment-attack" }, refreshOverview),
                    statField({ equipment: record, key: "defense", label: "방어력", testid: "db-field-equipment-defense" }, refreshOverview),
                    statField({ equipment: record, key: "mind", label: "정신력", testid: "db-field-equipment-mind" }, refreshOverview),
                    statField({ equipment: record, key: "agility", label: "민첩성", testid: "db-field-equipment-agility" }, refreshOverview),
                  ],
                }),
              ],
            }),
            sectionCard({
              title: "기본",
              testid: "db-equipment-card-basics",
              children: [
                equipmentSpecStrip(record),
                textField("설명", "db-field-equipment-description", record.description, (description) =>
                  updateDatabaseRecord("equipment", record.id, { description })
                ),
              ],
            }),
            sectionCard({
              title: "전투·장착 규칙",
              testid: "db-equipment-card-rules",
              children: [
                el("div", {
                  class: "db-eq-grid",
                  children: [
                    combatAxisField(record, "accuracy", "명중률(%)", "db-field-equipment-accuracy", refreshOverview),
                    combatAxisField(record, "criticalRate", "치명타율(%p)", "db-field-equipment-critical-rate", refreshOverview),
                  ],
                }),
                ...(record.slot === "weapon" || record.twoHanded ? [toggleSwitch("양손 장비", "db-field-equipment-two-handed", record.twoHanded, (twoHanded) => {
                  updateDatabaseRecord("equipment", record.id, { twoHanded });
                  refreshOverview();
                })] : []),
                toggleSwitch("저주", "db-field-equipment-cursed", record.cursed, (cursed) => {
                  updateDatabaseRecord("equipment", record.id, { cursed });
                  refreshOverview();
                }),
                selectField("사용 시 발동 스킬", "db-picker-equipment-use-skill", record.usableAsItemSkillId ?? "", store.getCurrent().database.skills, (usableAsItemSkillId) => {
                  updateDatabaseRecord("equipment", record.id, { usableAsItemSkillId: emptyToUndefined(usableAsItemSkillId) });
                  refreshOverview();
                }),
              ],
            }),
            twoColumnCard(spanCard(sectionCard({
              title: "장착 허용",
              // 기본 데이터에서 배우명=직업명이라 어느 쪽인지 구분 불가했다(P10) — 소제목으로 구분.
              collapsible: true,
              collapsed: true,
              hint: "주인공 또는 직업 중 하나가 허용하면 장착 가능. 직업 탭에서 허용한 장비도 포함됩니다.",
              testid: "db-equipment-card-permissions",
              children: [
                permissions,
                choiceGroup("주인공별 허용", "db-equipment-actor-permission-group", actorChoices(record, refreshOverview)),
                choiceGroup("직업별 허용", "db-equipment-class-permission-group", classChoices(record, refreshOverview)),
              ],
            }))),
            // 아이템 탭 equipmentProfile 블록과 동일한 효과 필드군 이식(P10 — 스키마·런타임은
            // 이미 지원하는데 UI 만 없어 AI 도구로만 편집 가능했다).
            spanCard(sectionCard({
              title: "전투 효과",
              collapsible: true,
              collapsed: !EFFECT_FLAG_FIELDS.some(({ key }) => record.effectFlags[key]),
              testid: "db-equipment-card-effects",
              children: [
                el("div", { class: "db-eq-grid", children: equipmentEffectFields(record, refreshOverview) }),
                ...unsupportedEffectNotice(record),
              ],
            })),
            spanCard(sectionCard({
              title: "장착 시 스킬·명령",
              collapsible: true,
              collapsed: (record.grantsSkillIds ?? []).length === 0 && !record.grantsCommand,
              hint: "장착 중에만 전투에서 쓸 수 있습니다 — 배우지 않아도 됩니다",
              testid: "db-equipment-card-grants",
              children: [
                choiceGroup("장착 시 쓸 수 있는 스킬", "db-equipment-grant-skill-group", grantedSkillChoices(record, refreshOverview)),
                ...grantedCommandFields(record, () => { refreshOverview(); rerender(); }),
              ],
            })),
            twoColumnCard(spanCard(sectionCard({
              title: "공격/방어 속성",
              collapsible: true,
              collapsed: record.attackElementIds.length === 0 && record.elementalDefenseIds.length === 0,
              testid: "db-equipment-card-elements",
              children: [
                selectField("공격 속성 (하나)", "db-field-equipment-attack-element", record.attackElementIds[0] ?? "", store.getCurrent().database.elements ?? [], (id) => {
                  updateDatabaseRecord("equipment", record.id, { attackElementIds: id ? [id] : [] });
                  refreshOverview();
                }),
                ...(record.attackElementIds.length > 1 ? [el("p", { class: "db-field-hint", text: "이전 복수 속성은 첫 속성만 적용됩니다. 다시 선택하면 한 속성으로 정리됩니다." })] : []),
                choiceGroup("속성 방어", "db-equipment-defense-element-group", elementChoices(record, "elementalDefenseIds", refreshOverview)),
              ],
            }))),
            ...(store.getCurrent().system.actionCombat?.enabled && record.slot === "weapon" ? [sectionCard({
              title: "액션 전투 스윙",
              collapsible: true,
              collapsed: !record.actionWeapon,
              hint: "실시간 액션 전투에서만 쓰입니다 — 비우면 시스템 기본값",
              testid: "db-equipment-card-action-weapon",
              children: actionWeaponFields(record),
            })] : []),
            spanCard(sectionCard({
              title: "상태 부여·저항",
              collapsible: true,
              collapsed: record.stateInflictIds.length === 0 && record.stateDefenseIds.length === 0,
              testid: "db-equipment-card-states",
              children: [
                choiceGroup("상태 부여", "db-equipment-state-inflict-group", stateChoices(record, "stateInflictIds", refreshOverview)),
                statePercentField(record, "stateInflictionChance", "db-field-equipment-state-infliction", "상태 부여율(%)", refreshOverview),
                ...(record.stateDefenseMode === "resist" ? [choiceGroup("상태 방어", "db-equipment-state-defense-group", stateChoices(record, "stateDefenseIds", refreshOverview))] : []),
                ...(record.stateDefenseMode === "inflict" ? [el("p", { class: "db-field-hint", text: "이전 ‘공격 시 부여’ 방어 설정은 적용되지 않습니다. 공격 효과는 위 상태 부여에서 설정하세요." }),
                  el("button", { text: "선택한 상태를 저항으로 적용", attrs: { type: "button" }, dataset: { testid: "db-equipment-enable-state-resistance" }, on: { click: () => {
                    updateDatabaseRecord("equipment", record.id, { stateDefenseMode: "resist" });
                    rerender();
                  } } })] : []),
                ...(record.stateDefenseMode === "resist" ? [statePercentField(record, "stateResistanceChance", "db-field-equipment-state-resistance", "상태 저항률(%)", refreshOverview)] : []),
              ],
            })),
            graphicCard(record, rerender),
            spanCard(databaseFieldSupportNotice("imageResourceId", "iconResourceId", "twoHanded", "accuracy", "criticalRate", "usableAsItemSkillId", "stateInflictIds", "stateInflictionChance", "stateResistanceChance")),
          ],
        }),
      ],
    }),
  );
  form.querySelector("[data-testid=\"db-equipment-card-rules\"]")?.classList.add("db-equipment-rules", "db-ws-span");
}

/** `db-ws-stack` 안에서 한 행을 다 쓰는 카드로 표시한다. */
function spanCard(node: HTMLElement): HTMLElement {
  node.classList.add("db-ws-span");
  return node;
}

/** 카드 본문을 다시 2열로 쪼갠다 — 체크박스 묶음 두 개가 세로로 길어지는 걸 막는다. */
function twoColumnCard(node: HTMLElement): HTMLElement {
  node.classList.add("db-eq-two-col");
  return node;
}

function equipmentSpecStrip(record: EquipmentRecord): HTMLElement {
  const spec = el("div", { class: "db-eq-grid", dataset: { testid: "db-equipment-spec-strip" } });
  equipmentFields(spec, record.id);
  return spec;
}

function equipmentHeader(record: EquipmentRecord, summaryHost: HTMLElement, refreshSummaryChips: () => void): HTMLElement {
  const project = store.getCurrent();
  const url = resolveAssetResourceUrl(record.iconResourceId ?? record.imageResourceId, { project });
  const icon = iconChangeButton({
    className: "db-equipment-inspector-icon",
    name: record.name,
    url,
    testid: "db-equipment-inspector-icon",
    onClick: () => {
      openDatabaseResourcePickerDialog({
        kind: "icon",
        title: "장비 아이콘",
        currentId: record.iconResourceId,
        allowClear: true,
        testidPrefix: "db-equipment-inspector-icon-dialog",
        onConfirm: (result) => {
          updateDatabaseRecord("equipment", record.id, { iconResourceId: emptyToUndefined(result.resourceId) });
          refreshSummaryChips();
        },
      });
    },
  });
  const name = textField("이름", "db-field-name", record.name, (name) =>
    updateDatabaseRecord("equipment", record.id, { name })
  );
  const slotSelect = el("select", {
    dataset: { testid: "db-field-equipment-slot" },
    children: equipmentSlots(project).map(({ id, label }) =>
      el("option", { text: label, attrs: { value: id } })),
  });
  slotSelect.value = record.slot;
  slotSelect.addEventListener("change", () => {
    const slot = slotSelect.value;
    updateDatabaseRecord("equipment", record.id, { slot, ...(slot !== "weapon" ? { twoHanded: false } : {}) });
    refreshSummaryChips();
  });
  return el("div", {
    class: "db-equipment-inspector-header db-ws-hero",
    dataset: { testid: "db-equipment-inspector-header" },
    children: [
      el("div", { class: "db-ws-hero-media", children: [icon] }),
      el("div", {
        class: "db-equipment-inspector-title db-ws-hero-text",
        children: [
          el("div", { class: "db-equipment-inspector-name", children: [name] }),
          field("장착 부위", slotSelect),
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

function fillEquipmentEffectStory(host: HTMLElement, project: Project, record: EquipmentRecord): void {
  const story = equipmentEffectStory(project, record);
  host.replaceChildren(
    el("div", { class: "db-effect-story-kicker", text: "착용하면" }),
    el("div", {
      class: "db-equipment-story-stats",
      text: story.statChanges.length > 0 ? story.statChanges.join(" · ") : "능력치 보정 없음",
      dataset: { testid: "db-equipment-story-stats" },
    }),
    el("div", {
      class: "db-effect-story-lines",
      children: story.effects.map((effect) => el("span", {
        class: "db-effect-story-line",
        text: effect,
        dataset: { testid: "db-equipment-story-effect" },
      })),
    }),
  );
}

function equipmentComparisonPanel(
  selectedActorId: string,
  resultHost: HTMLElement,
  onActorChange: (actorId: string) => void,
): HTMLElement {
  return el("section", {
    class: "db-equipment-comparison",
    dataset: { testid: "db-equipment-comparison" },
    children: [
      el("div", {
        class: "db-equipment-comparison-heading",
        children: [
          el("div", { class: "db-effect-story-kicker", text: "초기 빌드 비교" }),
          selectField("캐릭터", "db-equipment-comparison-actor", selectedActorId, store.getCurrent().database.actors, onActorChange),
        ],
      }),
      resultHost,
      el("p", {
        class: "db-equipment-comparison-note",
        text: "DB의 초기 레벨·초기 장비 기준입니다. 플레이 중 전직, 영구 보정, 인벤토리 수량은 포함하지 않습니다.",
      }),
    ],
  });
}

function fillEquipmentComparison(host: HTMLElement, comparison: EquipmentActorComparison | undefined): void {
  if (!comparison) {
    host.dataset.state = "empty";
    host.replaceChildren(el("p", { class: "db-effect-story-note", text: "비교할 캐릭터를 선택하세요." }));
    return;
  }
  if (!comparison.eligible || !comparison.next || !comparison.deltas) {
    host.dataset.state = "ineligible";
    host.replaceChildren(
      comparisonStatus("장착 불가", "ineligible"),
      el("strong", { text: `${comparison.actorName} · ${comparison.className} · Lv.${comparison.level}` }),
      el("p", { class: "db-effect-story-note", text: equipmentFailureLabel(comparison.reason) }),
    );
    return;
  }
  host.dataset.state = "eligible";
  const replaced = comparison.alreadyEquipped
    ? "이미 착용 중"
    : comparison.replacedEquipmentNames.length > 0
      ? `교체: ${comparison.replacedEquipmentNames.join(", ")}`
      : "빈 부위에 장착";
  host.replaceChildren(
    comparisonStatus("장착 가능", "eligible"),
    el("strong", { text: `${comparison.actorName} · ${comparison.className} · Lv.${comparison.level}` }),
    el("span", { class: "db-equipment-comparison-replaced", text: replaced }),
    el("div", {
      class: "db-equipment-comparison-stats",
      children: STAT_FIELDS.map(([key, label]) => comparisonStatRow(
        key,
        label,
        comparison.current[key],
        comparison.next?.[key] ?? comparison.current[key],
        comparison.deltas?.[key] ?? 0,
      )),
    }),
  );
}

function comparisonStatus(label: string, state: "eligible" | "ineligible"): HTMLElement {
  return el("span", {
    class: `db-equipment-comparison-status is-${state}`,
    text: label,
    dataset: { testid: "db-equipment-comparison-status" },
  });
}

function comparisonStatRow(
  key: keyof EquipmentStatBonuses,
  label: string,
  current: number,
  next: number,
  delta: number,
): HTMLElement {
  return el("div", {
    class: "db-equipment-comparison-stat",
    dataset: { testid: `db-equipment-comparison-delta-${key}`, delta: String(delta) },
    children: [
      el("span", { text: label }),
      el("small", { text: `${current} → ${next}` }),
      el("strong", { class: delta > 0 ? "gain" : delta < 0 ? "loss" : "neutral", text: signed(delta) }),
    ],
  });
}

// 장비 그래픽 카드. `db-advanced-panel db-panel-equipment-graphic` 두 클래스는
// databasePanelGridClasses.test.ts 의 계약이라 카드로 바뀐 뒤에도 유지한다
// (아이콘 "설정…" 버튼을 이 카드 안에서 찾을 수 있어야 한다).
function graphicCard(record: EquipmentRecord, rerender: () => void): HTMLElement {
  const card = sectionCard({
    title: "외형",
    collapsible: true,
    collapsed: true,
    hint: "목록·게임 인벤토리·장비 메뉴·상점은 아이콘을 우선하며, 없으면 이미지를 사용합니다.",
    testid: "db-equipment-card-graphic",
    children: [resourcePanel(record, rerender)],
  });
  card.classList.add("db-advanced-panel", "db-panel-equipment-graphic", "db-ws-span");
  return card;
}

function resourcePanel(record: EquipmentRecord, rerender: () => void): HTMLElement {
  const graphicPanel = el("div", {
    class: "db-eq-grid db-eq-graphic-grid",
    children: [
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
    ],
  });
  return graphicPanel;
}

function statField(input: StatFieldInput, onChange?: () => void): HTMLElement {
  return numberField(input.label, input.testid, input.equipment.statBonuses[input.key], (value) => {
    const statBonuses = { ...currentEquipment(input.equipment).statBonuses, [input.key]: value };
    updateDatabaseRecord("equipment", input.equipment.id, { statBonuses });
    onChange?.();
  }, { min: 0, max: 9999 });
}

function combatAxisField(
  record: EquipmentRecord,
  key: "accuracy" | "criticalRate",
  label: string,
  testid: string,
  onChange?: () => void,
): HTMLElement {
  return numberField(label, testid, record[key], (value) => {
    updateDatabaseRecord("equipment", record.id, { [key]: value });
    onChange?.();
  }, { min: 0, max: 100 });
}

function actorChoices(record: EquipmentRecord, onChange?: () => void): HTMLElement[] {
  return store.getCurrent().database.actors.map((actor) =>
    checkboxField({
      checked: record.equippableActorIds.includes(actor.id),
      label: actor.name,
      onInput: (checked) => {
        updateDatabaseRecord("equipment", record.id, {
          equippableActorIds: toggleId(currentEquipment(record).equippableActorIds, actor.id, checked),
        });
        onChange?.();
      },
      testid: `db-field-equipment-actor-${actor.id}`,
    })
  );
}

function classChoices(record: EquipmentRecord, onChange?: () => void): HTMLElement[] {
  return store.getCurrent().database.classes.map((klass) =>
    checkboxField({
      checked: record.equippableClassIds.includes(klass.id),
      label: klass.name,
      onInput: (checked) => {
        updateDatabaseRecord("equipment", record.id, {
          equippableClassIds: toggleId(currentEquipment(record).equippableClassIds, klass.id, checked),
        });
        onChange?.();
      },
      testid: `db-field-equipment-class-${klass.id}`,
    })
  );
}

function grantedSkillChoices(record: EquipmentRecord, onChange?: () => void): HTMLElement[] {
  return store.getCurrent().database.skills.map((skill) =>
    checkboxField({
      checked: (record.grantsSkillIds ?? []).includes(skill.id),
      label: skill.name,
      onInput: (checked) => {
        const next = toggleId(currentEquipment(record).grantsSkillIds ?? [], skill.id, checked);
        updateDatabaseRecord("equipment", record.id, { grantsSkillIds: next.length > 0 ? next : undefined });
        onChange?.();
      },
      testid: `db-field-equipment-grant-skill-${skill.id}`,
    })
  );
}

/** 장착 시 붙는 전투 명령 — 지금은 「스킬 하나를 바로 쓰는 명령」만 저작한다(가장 흔한 쓰임새: 무기 기술). */
function grantedCommandFields(record: EquipmentRecord, onChange: () => void): HTMLElement[] {
  const command = record.grantsCommand;
  const skills = store.getCurrent().database.skills;
  const nodes: HTMLElement[] = [
    selectField("장착 시 명령 스킬", "db-field-equipment-grant-command-skill", command?.skillId ?? "", skills, (skillId) => {
      const id = emptyToUndefined(skillId);
      const skillName = skills.find((skill) => skill.id === id)?.name ?? "";
      updateDatabaseRecord("equipment", record.id, {
        grantsCommand: id
          ? { id: `cmd_equip_${record.id}`, name: currentEquipment(record).grantsCommand?.name || skillName, kind: "skill", skillId: id }
          : undefined,
      });
      onChange();
    }),
  ];
  if (command) {
    nodes.push(textField("명령 이름", "db-field-equipment-grant-command-name", command.name, (name) => {
      const current = currentEquipment(record).grantsCommand;
      if (current) updateDatabaseRecord("equipment", record.id, { grantsCommand: { ...current, name } });
    }));
  }
  return nodes;
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

function unsupportedEffectNotice(record: EquipmentRecord): HTMLElement[] {
  const labels = LEGACY_EFFECT_FLAG_FIELDS.filter(({ key }) => record.effectFlags[key] && !EFFECT_FLAG_FIELDS.some((entry) => entry.key === key)).map(({ label }) => label);
  return labels.length ? [el("p", { class: "db-field-hint", dataset: { testid: "db-equipment-unsupported-effects" }, text: `이전 설정 중 적용되지 않는 효과: ${labels.join(", ")}. 저장값은 보관되지만 전투 효과에는 포함되지 않습니다.` })] : [];
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
  onChange?: () => void,
): HTMLElement {
  const fieldNode = sliderStepperField(label, testid, record[key], (value) => {
    updateDatabaseRecord("equipment", record.id, { [key]: value });
    onChange?.();
  },
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

function equipmentComparisonStats(
  project: Project,
  actor: ReturnType<typeof normalizeActorRecord>,
  level: number,
  equipment: ActorInitialEquipment,
): EquipmentStatBonuses {
  const derived = actorDerivedStats(project, actor, { level, equipment });
  return {
    attack: derived.attack,
    defense: derived.defense,
    mind: derived.mind,
    agility: derived.agility,
  };
}

function removedEquipmentNames(
  project: Project,
  current: ActorInitialEquipment,
  next: ActorInitialEquipment,
): string[] {
  const remaining = new Map<string, number>();
  for (const id of logicalEquipmentIds(project, next)) remaining.set(id, (remaining.get(id) ?? 0) + 1);
  const removed: string[] = [];
  for (const id of logicalEquipmentIds(project, current)) {
    const count = remaining.get(id) ?? 0;
    if (count > 0) {
      remaining.set(id, count - 1);
      continue;
    }
    removed.push(namedId(id, project.database.equipment));
  }
  return removed;
}

function statDifference(next: EquipmentStatBonuses, current: EquipmentStatBonuses): EquipmentStatBonuses {
  return {
    attack: next.attack - current.attack,
    defense: next.defense - current.defense,
    mind: next.mind - current.mind,
    agility: next.agility - current.agility,
  };
}

function equipmentFailureLabel(reason: EquipmentTransitionFailureReason | undefined): string {
  switch (reason) {
    case "notEquippable": return "이 캐릭터나 직업의 장착 허용 목록에 없습니다.";
    case "fixedEquipment": return "캐릭터·직업 또는 현재 장비가 교체를 막고 있습니다.";
    case "cursedEquipment": return "현재 부위의 저주 장비를 해제할 수 없습니다.";
    case "invalidSlot": return "현재 부위 규칙과 맞지 않습니다.";
    case "missingEquipment": return "장비 레코드를 찾을 수 없습니다.";
    case "missingActor": return "캐릭터 레코드를 찾을 수 없습니다.";
    case "insufficientInventory": return "실제 플레이에서는 소지 수량이 필요합니다.";
    default: return "현재 초기 빌드에는 장착할 수 없습니다.";
  }
}

function namedIds(ids: readonly string[], records: readonly { readonly id: string; readonly name: string }[]): string {
  return ids.map((id) => namedId(id, records)).join(", ");
}

function namedId(id: string, records: readonly { readonly id: string; readonly name: string }[]): string {
  return records.find((record) => record.id === id)?.name ?? `삭제된 항목(${id})`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function currentEquipment(record: EquipmentRecord): EquipmentRecord {
  return store.getCurrent().database.equipment.find((equipment) => equipment.id === record.id) ?? record;
}

function toggleId(source: readonly string[], id: string, checked: boolean): string[] {
  if (checked) return source.includes(id) ? [...source] : [...source, id];
  return source.filter((entry) => entry !== id);
}

function actionWeaponFields(record: EquipmentRecord): HTMLElement[] {
  const profile = record.actionWeapon;
  const patch = (key: keyof ActionWeaponProfile, fallback: number, value: number): void => {
    // 폼 전역 재렌더 없이 연속 편집해도 이전 필드가 사라지지 않도록 살아 있는 레코드를 읽는다.
    const next: ActionWeaponProfile = { ...(currentEquipment(record).actionWeapon ?? {}) };
    if (value === fallback) delete next[key];
    else next[key] = value;
    updateDatabaseRecord("equipment", record.id, {
      actionWeapon: Object.keys(next).length > 0 ? next : undefined,
    });
  };
  return [
    numberField(
      "스윙 범위",
      "db-field-equipment-action-weapon-swing-range",
      profile?.swingRange ?? DEFAULT_SWING_RANGE,
      (value) => patch("swingRange", DEFAULT_SWING_RANGE, value),
      { min: 1, max: 5 },
    ),
    numberField(
      "쿨다운(ms)",
      "db-field-equipment-action-weapon-swing-cooldown",
      profile?.swingCooldownMs ?? DEFAULT_SWING_COOLDOWN_MS,
      (value) => patch("swingCooldownMs", DEFAULT_SWING_COOLDOWN_MS, value),
      { min: 50, max: 5000 },
    ),
    numberField(
      "데미지 가산",
      "db-field-equipment-action-weapon-swing-bonus",
      profile?.swingDamageBonus ?? 0,
      (value) => patch("swingDamageBonus", 0, value),
      { min: 0, max: 9999 },
    ),
  ];
}
