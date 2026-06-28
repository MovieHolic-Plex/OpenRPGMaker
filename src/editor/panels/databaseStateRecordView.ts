import { stateOntologyFor, type StateOntology, type StateRateGrade } from "@/project/ontology/databaseStateOntology";
import { store } from "@/project/store";
import type { StateRecord } from "@/project/types";
import { el } from "@/util/dom";

const RATE_GRADES: readonly StateRateGrade[] = ["A", "B", "C", "D", "E"];

export function renderStateRecordForm(form: HTMLElement, state: StateRecord): HTMLElement {
  const database = store.getCurrent().database;
  const referencingSkills = database.skills.filter((skill) => skill.effect?.kind === "switch");
  const referencingItems = database.items.filter((item) =>
    item.stateEffects?.some((effect) => effect.stateId === state.id)
  );
  const ontology = stateOntologyFor(state.id, state.name);

  form.append(
    el("div", {
      class: "db-state-rm2k3-workbench",
      dataset: { testid: "db-states-rm2k3-workbench" },
      children: [
        panel("기본 설정", [
          readonlyControl("해제 조건", ontology.removalCondition, "db-state-removal-condition"),
          colorControl(ontology),
          readonlyControl("우선도", String(ontology.rating), "db-state-rating"),
          readonlyControl("제한", ontology.restriction, "db-state-restriction"),
        ]),
        panel("명중률 보정", [readonlyControl("성공률", `${ontology.accuracyModifier}%`, "db-state-accuracy")]),
        panel("특수", specialFlags(ontology)),
        panel("상태 유효도", rateRows(ontology)),
        panel("회복 방법", [
          readonlyControl("자연 회복", `${ontology.recoverNaturallyFromTurn}턴부터`, "db-state-recover-turn"),
          readonlyControl("회복 확률", `${ontology.recoverNaturallyChance}%`, "db-state-recover-chance"),
          readonlyControl("피격 회복", `${ontology.recoverWhenHitChance}%`, "db-state-hit-recover"),
        ]),
        panel("행동 제한", [
          readonlyControl("능력치", ontology.actorStatus, "db-state-actor-status"),
          readonlyControl("스킬 제한", ontology.skillLimit, "db-state-skill-limit"),
          readonlyControl("고정 항목", ontology.lockedParameters.join(", ") || "없음", "db-state-locked-params"),
        ]),
        panel("HP", [
          readonlyControl("전투 중", ontology.hpTurn, "db-state-hp-turn"),
          readonlyControl("맵 이동", ontology.hpMove, "db-state-hp-move"),
        ]),
        panel("MP", [
          readonlyControl("전투 중", ontology.mpTurn, "db-state-mp-turn"),
          readonlyControl("맵 이동", ontology.mpMove, "db-state-mp-move"),
        ]),
        animationPanel(ontology),
        referencePanel(referencingSkills.map((skill) => `${skill.name} (${skill.id})`), referencingItems.map((item) => `${item.name} (${item.id})`)),
        el("div", { class: "db-state-summary", dataset: { testid: "db-state-ontology-summary" }, text: ontology.summary }),
      ],
    }),
  );
  return form;
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

function colorControl(ontology: StateOntology): HTMLElement {
  return el("label", {
    class: "db-state-control db-state-color-control",
    children: [
      el("span", { text: "색상" }),
      el("i", { attrs: { "aria-hidden": "true", style: `background:${ontology.colorHex}` } }),
      el("input", { attrs: { readonly: "true", type: "text" }, dataset: { testid: "db-state-color" }, value: ontology.color }),
    ],
  });
}

function specialFlags(ontology: StateOntology): HTMLElement[] {
  const flags = ontology.specialFlags.length ? ontology.specialFlags : ["100% 회피", "마법 반사", "장비 고정"];
  return flags.map((flag) => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = ontology.specialFlags.includes(flag);
    input.disabled = true;
    return el("label", { class: "db-state-check", children: [input, el("span", { text: flag })] });
  });
}

function rateRows(ontology: StateOntology): HTMLElement[] {
  return RATE_GRADES.map((grade) =>
    el("div", {
      class: `db-state-rate-row grade-${grade.toLowerCase()}`,
      dataset: { testid: `db-state-rate-${grade}` },
      children: [el("b", { text: grade }), el("input", { attrs: { readonly: "true", type: "text" }, value: `${ontology.rates[grade]}%` })],
    })
  );
}

function animationPanel(ontology: StateOntology): HTMLElement {
  return panel("애니메이션", [
    el("div", { class: "db-state-animation-preview", text: "상태" }),
    readonlyControl("번호", String(ontology.animationIndex), "db-state-animation-index"),
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
