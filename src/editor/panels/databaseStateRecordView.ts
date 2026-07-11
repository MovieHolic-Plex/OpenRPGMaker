import { numberField, selectLiteral } from "@/editor/panels/databaseControls";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { resolvedStateValues, stateOntologyFor } from "@/project/ontology/databaseStateOntology";
import type { StateRateGrade } from "@/project/ontology/databaseStateOntology";
import { store } from "@/project/store";
import type { StateRecord } from "@/project/types";
import { el } from "@/util/dom";

const RATE_GRADES: readonly StateRateGrade[] = ["A", "B", "C", "D", "E"];

const REMOVAL_OPTIONS = ["전투 종료 후 유지", "전투 종료", "피격 또는 전투 종료", "즉시 해제", "턴 경과"] as const;
const RESTRICTION_OPTIONS = ["없음", "행동 불가", "아군에게 공격 불가", "스킬 사용 불가", "물리 공격 불가"] as const;

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
      class: "db-state-rm2k3-workbench",
      dataset: { testid: "db-states-rm2k3-workbench" },
      children: [
        panel("기본 설정", [
          selectLiteral("해제 조건", "db-state-removal-condition", ontology.removalCondition, REMOVAL_OPTIONS, (removalCondition) =>
            update({ removalCondition })
          ),
          colorControl(ontology),
          numberField("우선도", "db-state-rating", ontology.rating, (priority) => update({ priority }), { min: 0, max: 100 }),
          selectLiteral("제한", "db-state-restriction", ontology.restriction, RESTRICTION_OPTIONS, (restriction) =>
            update({ restriction })
          ),
        ]),
        panel("명중률 보정", [
          numberField("성공률", "db-state-accuracy", ontology.accuracyModifier, (accuracyModifier) =>
            update({ accuracyModifier }), { min: 0, max: 100 }
          ),
        ]),
        panel("특수", specialFlags(baseOntology, state, update)),
        panel("상태 유효도", rateRows(ontology)),
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
        ]),
        panel("행동 제한", [
          readonlyControl("능력치", ontology.actorStatus, "db-state-actor-status"),
          readonlyControl("스킬 제한", ontology.skillLimit, "db-state-skill-limit"),
          readonlyControl("고정 항목", ontology.lockedParameters.join(", ") || "없음", "db-state-locked-params"),
        ]),
        panel("HP", [
          numberField("전투 중(턴당%)", "db-state-hp-turn", numericRelease(state.hpReleaseTurn, baseOntology.hpTurn), (hpReleaseTurn) =>
            update({ hpReleaseTurn }), { min: -100, max: 100 }
          ),
          numberField("맵 이동(걸음당)", "db-state-hp-move", numericRelease(state.hpReleaseStep, baseOntology.hpMove), (hpReleaseStep) =>
            update({ hpReleaseStep }), { min: -999, max: 999 }
          ),
        ]),
        panel("MP", [
          numberField("전투 중(턴당%)", "db-state-mp-turn", numericRelease(state.mpReleaseTurn, baseOntology.mpTurn), (mpReleaseTurn) =>
            update({ mpReleaseTurn }), { min: -100, max: 100 }
          ),
          numberField("맵 이동(걸음당)", "db-state-mp-move", numericRelease(state.mpReleaseStep, baseOntology.mpMove), (mpReleaseStep) =>
            update({ mpReleaseStep }), { min: -999, max: 999 }
          ),
        ]),
        animationPanel(state, ontology, update),
        referencePanel(referencingSkills.map((skill) => `${skill.name} (${skill.id})`), referencingItems.map((item) => `${item.name} (${item.id})`)),
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

function panel(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", {
    class: "db-advanced-panel db-state-panel",
    children: [el("legend", { text: title }), ...children],
  });
}

function readonlyControl(label: string, value: string, testid: string): HTMLElement {
  return el("label", {
    class: "db-state-control",
    children: [
      el("span", { text: label }),
      el("input", { attrs: { readonly: "true", type: "text" }, dataset: { testid }, value }),
    ],
  });
}

function colorControl(ontology: ReturnType<typeof stateOntologyFor>): HTMLElement {
  return el("label", {
    class: "db-state-control db-state-color-control",
    children: [
      el("span", { text: "색상" }),
      el("i", { attrs: { "aria-hidden": "true", style: `background:${ontology.colorHex}` } }),
      el("input", { attrs: { readonly: "true", type: "text" }, dataset: { testid: "db-state-color" }, value: ontology.color }),
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
      children: [el("b", { text: grade }), el("input", { attrs: { readonly: "true", type: "text" }, value: `${ontology.rates[grade]}%` })],
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
  ]);
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
