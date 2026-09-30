import { numberField, selectField, selectLiteral } from "@/editor/panels/databaseControls";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { stateBehavior } from "@/battle/battleStates";
import { resolvedStateValues, stateOntologyFor } from "@/project/ontology/databaseStateOntology";
import type { StateRateGrade } from "@/project/ontology/databaseStateOntology";
import { store } from "@/project/store";
import { equipmentSlots } from "@/project/equipmentSlots";
import type { StateRecord } from "@/project/types";
import { el } from "@/util/dom";

const RATE_GRADES: readonly StateRateGrade[] = ["A", "B", "C", "D", "E"];
const RATE_GRADE_LABEL: Record<StateRateGrade, string> = {
  A: "약함",
  B: "조금 약함",
  C: "보통",
  D: "강함",
  E: "무효",
};

const REMOVAL_OPTIONS = ["전투 종료 후 유지", "전투 종료", "피격 또는 전투 종료", "즉시 해제", "턴 경과"] as const;
const RESTRICTION_OPTIONS = ["없음", "행동 불가", "아군에게 공격 불가", "스킬 사용 불가", "물리 공격 불가"] as const;
const GEN1_MAJOR_STATUS_OPTIONS = ["none", "poison", "burn", "sleep", "freeze", "paralysis"] as const;

export function renderStateRecordForm(form: HTMLElement, state: StateRecord): HTMLElement {
  const database = store.getCurrent().database;
  // 이 상태를 실제로 참조(stateEffects.stateId)하는 스킬만 — effect.kind === "switch" 는
  // 스위치 조작 스킬 여부일 뿐 상태 참조와 무관했다(P10, 삭제 가드 databaseReferences.ts와 동일 조건).
  const referencingSkills = database.skills.filter((skill) =>
    skill.stateEffects?.some((effect) => effect.stateId === state.id)
  );
  const referencingItems = database.items.filter((item) =>
    item.stateEffects?.some((effect) => effect.stateId === state.id)
  );
  // 사용자 재정의(record)를 우선, 없으면 ontology 기본값으로 병합.
  const ontology = resolvedStateValues(state.id, state.name, state);
  const baseOntology = stateOntologyFor(state.id, state.name);
  const update = (patch: Partial<StateRecord>) => updateDatabaseRecord("states", state.id, patch);

  form.append(
    el("div", {
      class: "db-state-oprn-workbench",
      dataset: { testid: "db-states-oprn-workbench" },
      children: [
        panel("기본 설정", [
          selectLiteral("Gen1 주요 상태", "db-state-gen1-major-status", state.gen1MajorStatus ?? "none", GEN1_MAJOR_STATUS_OPTIONS, (gen1MajorStatus) =>
            update({ gen1MajorStatus: gen1MajorStatus === "none" ? undefined : gen1MajorStatus })
          ),
          selectLiteral("해제 조건", "db-state-removal-condition", ontology.removalCondition, REMOVAL_OPTIONS, (removalCondition) =>
            update({ removalCondition })
          ),
          colorControl(ontology),
          numberField("우선도", "db-state-rating", ontology.rating, (priority) => update({ priority }), { min: 0, max: 100 }),
          selectLiteral("제한", "db-state-restriction", ontology.restriction, RESTRICTION_OPTIONS, (restriction) =>
            update({ restriction })
          ),
        ], "db-state-panel-base"),
        panel("명중률 보정", [
          numberField("성공률", "db-state-accuracy", ontology.accuracyModifier, (accuracyModifier) =>
            update({ accuracyModifier }), { min: 0, max: 100 }
          ),
        ], "db-state-panel-acc"),
        panel("특수", specialFlags(baseOntology, state, update), "db-state-panel-special"),
        panel("상태 유효도", rateRows(ontology), "db-state-panel-rate"),
        panel("회복 방법", [
          numberField("자연 회복(턴부터)", "db-state-recover-turn", ontology.recoverNaturallyFromTurn, (recoverNaturallyFromTurn) =>
            update({ recoverNaturallyFromTurn }), { min: 0, max: 999 }
          ),
          numberField("회복 확률(%)", "db-state-recover-chance", ontology.recoverNaturallyChance, (recoverNaturallyChance) =>
            update({ recoverNaturallyChance }), { min: 0, max: 100 }
          ),
          numberField("피격 회복(%)", "db-state-hit-recover", ontology.recoverWhenHitChance, (recoverWhenHitChance) =>
            update({ recoverWhenHitChance }), { min: 0, max: 100 }
          ),
        ], "db-state-panel-heal"),
        panel("행동 제한", [
          readonlyControl("능력치", ontology.actorStatus, "db-state-actor-status"),
          readonlyControl("스킬 제한", ontology.skillLimit, "db-state-skill-limit"),
          readonlyControl("고정 항목", ontology.lockedParameters.join(", ") || "없음", "db-state-locked-params"),
        ], "db-state-panel-restrict"),
        panel("HP", [
          numberField("전투 중(턴당%)", "db-state-hp-turn", numericRelease(state.hpReleaseTurn, baseOntology.hpTurn), (hpReleaseTurn) =>
            update({ hpReleaseTurn }), { min: -100, max: 100 }
          ),
          numberField("맵 이동(걸음당)", "db-state-hp-move", numericRelease(state.hpReleaseStep, baseOntology.hpMove), (hpReleaseStep) =>
            update({ hpReleaseStep }), { min: -999, max: 999 }
          ),
          // 명작 공백 #25: 걸음 효과 간격·치사 여부·N걸음 후 해제.
          numberField("걸음 효과 간격", "db-state-step-interval", state.fieldStepInterval ?? 1, (fieldStepInterval) =>
            update({ fieldStepInterval: Math.max(1, fieldStepInterval) }), { min: 1, max: 99 }
          ),
          numberField("N걸음 후 풀림(0=안 풀림)", "db-state-release-steps", state.releaseAfterSteps ?? 0, (releaseAfterSteps) =>
            update({ releaseAfterSteps: Math.max(0, releaseAfterSteps) }), { min: 0, max: 9999 }
          ),
          numberField("걸음 피해로 쓰러짐(1=예)", "db-state-step-can-kill", state.fieldStepCanKill ? 1 : 0, (value) =>
            update({ fieldStepCanKill: value >= 1 }), { min: 0, max: 1 }
          ),
        ], "db-state-panel-hp"),
        panel("MP", [
          numberField("전투 중(턴당%)", "db-state-mp-turn", numericRelease(state.mpReleaseTurn, baseOntology.mpTurn), (mpReleaseTurn) =>
            update({ mpReleaseTurn }), { min: -100, max: 100 }
          ),
          numberField("맵 이동(걸음당)", "db-state-mp-move", numericRelease(state.mpReleaseStep, baseOntology.mpMove), (mpReleaseStep) =>
            update({ mpReleaseStep }), { min: -999, max: 999 }
          ),
        ], "db-state-panel-mp"),
        animationPanel(state, ontology, update),
        referencePanel(referencingSkills.map((skill) => `${skill.name} (${skill.id})`), referencingItems.map((item) => `${item.name} (${item.id})`)),
        // 배치는 DOM 순서가 아니라 패널이 직접 들고 있는 `db-state-panel-*` 클래스가 정한다.
        // 예전에는 states.css 가 nth-child(1..9) → grid-area 로 잡아서, 중간에 패널을
        // 하나 끼우면 이후 전부가 다른 영역으로 밀렸다(실제로 그렇게 깨졌고 이 주석이
        // 그 흔적이었다). 이제는 어디에 넣어도 안전하다.
        runtimeEffectsPanel(state, update),
        panel("부위 손실", [
          selectLiteral("잃는 장비 슬롯", "db-state-disables-equip-slot", state.disablesEquipSlot ?? "",
            ["", ...equipmentSlots(store.getCurrent()).map((slot) => slot.id)], (slot) => update({ disablesEquipSlot: slot || undefined })),
          el("p", { class: "db-skill-card-note", text: "이 상태인 동안 그 슬롯 장비의 능력치를 잃습니다(팔 부상 → 무기 등)." }),
        ], "db-state-panel-part-loss"),
        el("div", { class: "db-state-summary", dataset: { testid: "db-state-ontology-summary" }, text: ontology.summary }),
      ],
    }),
  );
  return form;
}

// ontology의 텍스트 형태(예: "매 턴 최대 HP의 -6%")에서 부호가 붙은 수치를 추출하거나,
// 이미 숫자로 저장된 값을 그대로 반환. 사용자가 아직 편집하지 않았다면 ontology에서 파생.
function numericRelease(value: number | undefined, ontologyText: string): number {
  if (value !== undefined) return value;
  const match = ontologyText.match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function panel(title: string, children: readonly HTMLElement[], extraClass?: string): HTMLElement {
  return el("fieldset", {
    class: `db-advanced-panel db-state-panel${extraClass ? ` ${extraClass}` : ""}`,
    children: [el("legend", { text: title }), ...children],
  });
}

// Gen1 규칙 knob 직접 저작. 온톨로지 텍스트 파싱 경로(restrictsActionFrom 등)는 영어
// 정규식인데 온톨로지 데이터는 한국어라 사실상 죽어 있다 — 그래서 위 "제한: 행동 불가"
// 드롭다운을 골라도 새 상태는 그대로 행동한다. 이 패널은 runtimeEffects 에 직접 써서
// 그 경로를 우회하고, 표시값은 stateBehavior() 의 실효값(재정의 없으면 온톨로지 폴백)이다.
function runtimeEffectsPanel(state: StateRecord, update: (patch: Partial<StateRecord>) => void): HTMLElement {
  const behavior = stateBehavior(state);
  const patchEffects = (effects: Partial<NonNullable<StateRecord["runtimeEffects"]>>): void =>
    update({ runtimeEffects: effects });
  return panel("전투 규칙 (Gen1 knob)", [
    checkControl("행동 불가", "db-state-rt-restricts", behavior.restrictsAction, (restrictsAction) =>
      patchEffects({ restrictsAction })
    ),
    numberField("턴당 HP 피해(%)", "db-state-rt-hp-percent", behavior.hpDamagePercentPerTurn, (hpDamagePercentPerTurn) =>
      patchEffects({ hpDamagePercentPerTurn }), { min: 0, max: 100, step: 0.05 }
    ),
    numberField("턴당 HP 회복(%)", "db-state-rt-hp-heal-percent", behavior.hpHealPercentPerTurn, (hpHealPercentPerTurn) =>
      patchEffects({ hpHealPercentPerTurn }), { min: 0, max: 100, step: 0.05 }
    ),
    checkControl("스킬 사용 불가", "db-state-rt-blocks-skill", behavior.blocksSkillUse, (blocksSkillUse) =>
      patchEffects({ blocksSkillUse })
    ),
    numberField("공격 배율", "db-state-rt-attack-mult", behavior.attackMultiplier, (attackMultiplier) =>
      patchEffects({ attackMultiplier }), { min: 0, max: 10, step: 0.05 }
    ),
    numberField("방어 배율", "db-state-rt-defense-mult", behavior.defenseMultiplier, (defenseMultiplier) =>
      patchEffects({ defenseMultiplier }), { min: 0, max: 10, step: 0.05 }
    ),
    numberField("민첩 배율", "db-state-rt-agility-mult", behavior.agilityMultiplier, (agilityMultiplier) =>
      patchEffects({ agilityMultiplier }), { min: 0, max: 10, step: 0.05 }
    ),
    checkControl("전투 종료 시 해제", "db-state-rt-remove-on-end", behavior.removeOnBattleEnd, (removeOnBattleEnd) =>
      patchEffects({ removeOnBattleEnd })
    ),
    checkControl("전투 불능으로 침 (석화 — 전원이면 패배)", "db-state-rt-incapacitates", state.runtimeEffects?.incapacitates === true, (incapacitates) =>
      patchEffects({ incapacitates: incapacitates ? true : undefined })
    ),
    numberField("피해를 MP 로 (0~1)", "db-state-rt-damage-to-mp", state.runtimeEffects?.damageToMpRate ?? 0, (damageToMpRate) =>
      patchEffects({ damageToMpRate: damageToMpRate > 0 ? Math.min(1, damageToMpRate) : undefined }), { min: 0, max: 1, step: 0.05 }
    ),
    ...retroGimmickControls(state, patchEffects),
    // 감정 계열·단계(battleEmotion). 같은 계열을 다시 걸면 단계가 오른다. 계열 상성은 시스템 → 전투 자원.
    emotionFamilyControl(state, update),
    numberField("감정 단계", "db-state-emotion-tier", state.emotion?.tier ?? 1, (tier) => {
      const family = store.getCurrent().database.states.find((entry) => entry.id === state.id)?.emotion?.family;
      if (family) update({ emotion: { family, tier } });
    }, { min: 1, max: 9 }, state.emotion ? undefined : { disabled: true, disabledReason: "감정 계열을 먼저 적으세요." }),
    el("div", {
      // db-state-summary 를 쓰면 안 된다 — 그 클래스에 grid-area: summary 가 박혀 있어
      // 온톨로지 요약 칸과 겹쳐 찌그러진다(실제로 그렇게 깨졌다).
      class: "db-state-runtime-hint",
      dataset: { testid: "db-state-runtime-hint" },
      // 위 "HP > 전투 중(턴당%)" 필드는 정수 파서를 타서 6.25 가 0 으로 뭉개진다. 소수는 여기로.
      text: "Gen1 화상 = 공격 배율 0.5 + 턴당 HP 6.25%(=1/16). 독도 6.25%. 배율은 런타임에서 0.4~2.5 로 clamp 된다.",
    }),
  ], "db-state-runtime-panel");
}

/** 감정 계열 이름 입력. 비우면 감정 상태가 아니다. */
function emotionFamilyControl(state: StateRecord, update: (patch: Partial<StateRecord>) => void): HTMLElement {
  const input = el("input", {
    attrs: { type: "text", maxlength: "24", placeholder: "예: 기쁨 · 분노 · 슬픔" },
    value: state.emotion?.family ?? "",
    dataset: { testid: "db-state-emotion-family" },
  }) as HTMLInputElement;
  input.addEventListener("change", () => {
    const family = input.value.trim();
    const tier = store.getCurrent().database.states.find((entry) => entry.id === state.id)?.emotion?.tier ?? 1;
    update({ emotion: family ? { family, tier } : undefined });
  });
  return el("label", { class: "db-state-control", children: [el("span", { text: "감정 계열" }), input] });
}

function checkControl(label: string, testid: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "db-state-check", children: [input, el("span", { text: label })] });
}

/**
 * 파생 값(온톨로지에서 계산돼 여기서는 못 고치는 값)은 **입력처럼 보이면 안 된다**.
 * 예전에는 `<input readonly>` 였고 테두리·배경·높이·폰트가 옆의 살아 있는 숫자 필드와
 * 똑같아서, 클릭해 타이핑해도 아무 일이 안 일어나는데 이유를 알 수 없었다(감사 G 축).
 * 값은 칩으로 두고 "어디서 온 값인지"를 함께 적는다.
 */
function readonlyControl(label: string, value: string, testid: string): HTMLElement {
  return el("div", {
    class: "db-state-control db-state-derived",
    children: [
      el("span", { text: label }),
      el("output", { class: "db-state-derived-value", dataset: { testid }, text: value }),
    ],
  });
}

function colorControl(ontology: ReturnType<typeof stateOntologyFor>): HTMLElement {
  return el("label", {
    class: "db-state-control db-state-color-control",
    children: [
      el("span", { text: "색상" }),
      el("i", { attrs: { "aria-hidden": "true", style: `background:${ontology.colorHex}` } }),
      // 색상도 온톨로지 파생값이라 여기서는 못 바꾼다 — readonly 입력으로 위장하지 않는다.
      el("output", { class: "db-state-derived-value", dataset: { testid: "db-state-color" }, text: ontology.color }),
    ],
  });
}

// 특수 플래그 — ontology에서 파생된 후보에 대해 현재 record의 선택 상태를 반영.
const ALL_FLAGS = ["100% 회피", "마법 반사", "장비 고정", "회피 불가", "장비 고정 영향 없음"] as const;

function specialFlags(
  baseOntology: ReturnType<typeof stateOntologyFor>,
  state: StateRecord,
  update: (patch: Partial<StateRecord>) => void
): HTMLElement[] {
  const active = new Set(state.specialFlags ?? baseOntology.specialFlags);
  return ALL_FLAGS.map((flag) => {
    const input = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
    input.checked = active.has(flag);
    input.addEventListener("change", () => {
      const next = new Set(active);
      if (input.checked) next.add(flag);
      else next.delete(flag);
      update({ specialFlags: [...next] });
    });
    return el("label", { class: "db-state-check", children: [input, el("span", { text: flag })] });
  });
}

function rateRows(ontology: ReturnType<typeof stateOntologyFor>): HTMLElement[] {
  return RATE_GRADES.map((grade) =>
    el("div", {
      class: `db-state-rate-row grade-${grade.toLowerCase()}`,
      dataset: { testid: `db-state-rate-${grade}` },
      children: [el("b", { text: RATE_GRADE_LABEL[grade] }), el("input", { attrs: { readonly: "true", type: "text" }, value: `${ontology.rates[grade]}%` })],
    })
  );
}

function animationPanel(
  state: StateRecord,
  ontology: ReturnType<typeof stateOntologyFor>,
  update: (patch: Partial<StateRecord>) => void
): HTMLElement {
  const index = state.animationIndex ?? ontology.animationIndex;
  return panel("애니메이션", [
    el("div", { class: "db-state-animation-preview", text: "상태" }),
    numberField("번호", "db-state-animation-index", index, (animationIndex) => update({ animationIndex }), { min: 0, max: 999 }),
  ], "db-state-panel-anim");
}

function referencePanel(skills: readonly string[], items: readonly string[]): HTMLElement {
  return el("fieldset", {
    class: "db-advanced-panel db-state-panel db-state-reference-panel",
    dataset: { testid: "db-state-references" },
    children: [
      el("legend", { text: "참조" }),
      el("h4", { text: "스킬" }),
      ...referenceRows(skills, "(참조하는 스킬 없음)"),
      el("h4", { text: "아이템" }),
      ...referenceRows(items, "(참조하는 아이템 없음)"),
    ],
  });
}

function referenceRows(values: readonly string[], emptyText: string): HTMLElement[] {
  const rows = values.length ? values : [emptyText];
  return rows.map((value) => el("div", { class: values.length ? "db-ref-row" : "empty-hint", text: value }));
}

/**
 * 레트로 전투 기믹 — 스톱(게이지 정지)·버서크(무작위 강제 공격)·프로텍트/실드(물리·마법 방어 배율)·
 * 속성 등급 덮어쓰기(젖음·기름 → 약점). 예전엔 조수 도구(dbTools stateRecordSchema)로만 저작할 수 있었다.
 * 값은 state.runtimeEffects 에 저장되고 battleStates.stateBehavior 가 그대로 읽는다.
 */
function retroGimmickControls(
  state: StateRecord,
  patchEffects: (effects: Partial<NonNullable<StateRecord["runtimeEffects"]>>) => void
): HTMLElement[] {
  const fx = (): NonNullable<StateRecord["runtimeEffects"]> =>
    store.getCurrent().database.states.find((entry) => entry.id === state.id)?.runtimeEffects ?? {};
  const multiplier = (label: string, testid: string, key: "physicalDefenseMultiplier" | "magicDefenseMultiplier"): HTMLElement =>
    numberField(label, testid, fx()[key] ?? 1, (value) => patchEffects({ [key]: value > 0 && value !== 1 ? value : undefined }), { min: 0, max: 10, step: 0.05 });
  const elements = store.getCurrent().database.elements ?? [];
  const elementRows = elements.map((element) => {
    const options = [{ id: "", name: "덮어쓰지 않음" }, ...RATE_GRADES.map((grade) => ({ id: grade, name: `${grade} · ${RATE_GRADE_LABEL[grade]}` }))];
    return selectField(`속성 ${element.name}`, `db-state-rt-element-${element.id}`, fx().elementRates?.[element.id] ?? "", options, (grade) => {
      const next: Record<string, StateRateGrade> = { ...(fx().elementRates ?? {}) };
      if (grade) next[element.id] = grade as StateRateGrade;
      else delete next[element.id];
      patchEffects({ elementRates: Object.keys(next).length ? next : undefined });
    });
  });
  return [
    checkControl("스톱 — ATB 게이지 정지·행동 불가", "db-state-rt-freezes-gauge", fx().freezesGauge === true, (freezesGauge) =>
      patchEffects({ freezesGauge: freezesGauge ? true : undefined })
    ),
    checkControl("버서크 — 명령 없이 무작위 상대를 통상 공격", "db-state-rt-forced-attack", fx().forcedAction === "attackRandom", (on) =>
      patchEffects({ forcedAction: on ? "attackRandom" : undefined })
    ),
    multiplier("물리 피해 방어 배율 (프로텍트)", "db-state-rt-physical-defense", "physicalDefenseMultiplier"),
    multiplier("마법 피해 방어 배율 (실드)", "db-state-rt-magic-defense", "magicDefenseMultiplier"),
    ...(elementRows.length
      ? [el("p", { class: "db-skill-card-note", text: "이 상태인 동안 대상의 속성 등급을 덮어씁니다(젖음 → 번개 약점 등). A 가 가장 약합니다." }), ...elementRows]
      : []),
  ];
}
