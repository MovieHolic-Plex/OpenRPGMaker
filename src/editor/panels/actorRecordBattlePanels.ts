import { DEFAULT_ELEMENT_RATE_LABELS, stateRatePercentage } from "@/project/actorModel";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import {
  actorPanel,
  checkboxControl,
  emptyToUndefined,
  gradeSelect,
  numberInput,
  selectInput,
  selectRecord,
} from "@/editor/panels/actorRecordControls";
import { store } from "@/project/store";
import type { ActorInitialEquipment, ActorOptions, ActorRateGrade, ActorRecord, EquipmentRecord } from "@/project/types";
import { el } from "@/util/dom";

const EQUIPMENT_SLOTS: readonly { readonly key: keyof ActorInitialEquipment; readonly label: string; readonly slot: EquipmentRecord["slot"] }[] = [
  { key: "weapon", label: "무기", slot: "weapon" },
  { key: "shield", label: "방패", slot: "shield" },
  { key: "helmet", label: "머리", slot: "helmet" },
  { key: "armor", label: "몸", slot: "armor" },
  { key: "accessory", label: "장신구", slot: "accessory" },
] as const;

const OPTION_LABELS: readonly { readonly key: keyof ActorOptions; readonly label: string }[] = [
  { key: "dualWield", label: "이도류" },
  { key: "autoBattle", label: "자동 전투" },
  { key: "fixedEquipment", label: "장비 고정" },
  { key: "mightyGuard", label: "강력 방어" },
] as const;

export function battlePanel(actor: ActorRecord, rerender: () => void, refreshBuildPreview: () => void): HTMLElement {
  return actorPanel("전투", "actor-battle", [
    equipmentPanel(actor, refreshBuildPreview),
    selectRecord("맨손 애니메이션", "db-picker-unarmed-animation", actor.unarmedAnimationId ?? "", store.getCurrent().database.battleAnimations, (unarmedAnimationId) =>
      updateDatabaseRecord("actors", actor.id, { unarmedAnimationId: emptyToUndefined(unarmedAnimationId) })
    ),
    optionsPanel(actor),
    learnedSkillsPanel(actor, rerender),
  ]);
}

export function ratesPanel(actor: ActorRecord): HTMLElement {
  const stateRows = [{ id: "state_death", name: "전투불능" }, ...store.getCurrent().database.states].map((state) =>
    stateRateRow(state.id, state.name, actor.stateRates[state.id] ?? "C", (grade) =>
      updateDatabaseRecord("actors", actor.id, {
        stateRates: { ...currentActor(actor).stateRates, [state.id]: grade },
      })
    )
  );
  const elementRows = DEFAULT_ELEMENT_RATE_LABELS.map((element) =>
    rateRow(element.name, actor.elementRates[element.id] ?? "C", (grade) =>
      updateDatabaseRecord("actors", actor.id, { elementRates: { ...currentActor(actor).elementRates, [element.id]: grade } })
    )
  );
  return actorPanel("저항", "actor-rates", [
    el("p", {
      class: "actor-rate-manual-note",
      dataset: { testid: "db-actor-state-rate-manual-note" },
      text: "States Page 기준: 주인공의 A-E 상태 저항 등급은 상태 발생 확률로 해석되며 A에서 E로 갈수록 낮아집니다.",
    }),
    el("div", {
      class: "actor-rate-columns",
      children: [rateList("상태 저항", stateRows), rateList("속성 방어", elementRows)],
    }),
  ]);
}

function equipmentPanel(actor: ActorRecord, refreshBuildPreview: () => void): HTMLElement {
  const equipment = store.getCurrent().database.equipment;
  return actorPanel("초기 장비", "actor-starting-equipment", EQUIPMENT_SLOTS.map((slot) => {
    const options = equipment.filter((entry) => entry.slot === slot.slot);
    return selectRecord(slot.label, `db-picker-actor-equipment-${slot.key}`, actor.initialEquipment[slot.key] ?? "", options, (id) => {
      updateDatabaseRecord("actors", actor.id, {
        initialEquipment: { ...currentActor(actor).initialEquipment, [slot.key]: emptyToUndefined(id) },
      });
      refreshBuildPreview();
    });
  }));
}

function optionsPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("옵션", "actor-options", [
    el("div", {
      class: "actor-options-grid",
      children: OPTION_LABELS.map((option) =>
        checkboxControl(option.label, `db-field-actor-option-${option.key}`, actor.options[option.key], (enabled) =>
          updateDatabaseRecord("actors", actor.id, { options: { ...currentActor(actor).options, [option.key]: enabled } })
        )
      ),
    }),
  ]);
}

function learnedSkillsPanel(actor: ActorRecord, rerender: () => void): HTMLElement {
  const skills = store.getCurrent().database.skills;
  const rows = actor.learnedSkills.map((learned, index) =>
    el("div", {
      class: "actor-skill-row",
      children: [
        numberInput(`db-field-actor-skill-level-${index}`, learned.level, (level) => {
          const learnedSkills = currentActor(actor).learnedSkills.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, level } : entry
          );
          updateDatabaseRecord("actors", actor.id, { learnedSkills });
          rerender();
        }),
        selectInput(`db-picker-actor-skill-${index}`, learned.skillId, skills, (skillId) => {
          const learnedSkills = currentActor(actor).learnedSkills.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, skillId } : entry
          );
          updateDatabaseRecord("actors", actor.id, { learnedSkills });
          rerender();
        }),
        el("button", {
          class: "btn small",
          text: "삭제",
          attrs: { type: "button" },
          on: {
            click: () => {
              updateDatabaseRecord("actors", actor.id, {
                learnedSkills: currentActor(actor).learnedSkills.filter((_, entryIndex) => entryIndex !== index),
              });
              rerender();
            },
          },
        }),
      ],
    })
  );
  return actorPanel("스킬", "actor-skills", [
    el("div", { class: "actor-skill-header", children: [el("span", { text: "레벨" }), el("span", { text: "스킬" })] }),
    el("div", { class: "actor-skill-list", children: rows }),
    el("button", {
      class: "btn small",
      text: "스킬 추가",
      attrs: { type: "button" },
      dataset: { testid: "db-add-actor-skill" },
      on: {
        click: () => {
          const skillId = skills[0]?.id;
          if (!skillId) return;
          updateDatabaseRecord("actors", actor.id, {
            learnedSkills: [...currentActor(actor).learnedSkills, { level: currentActor(actor).initialLevel, skillId }],
          });
          rerender();
        },
      },
    }),
  ]);
}

function rateList(title: string, rows: HTMLElement[]): HTMLElement {
  return el("div", { class: "actor-rate-list", children: [el("strong", { text: title }), ...rows] });
}

function rateRow(label: string, value: ActorRateGrade, onChange: (value: ActorRateGrade) => void): HTMLElement {
  return el("label", {
    class: "actor-rate-row",
    children: [el("span", { text: label }), gradeSelect(value, onChange)],
  });
}

function currentActor(actor: ActorRecord): ActorRecord {
  return store.getCurrent().database.actors.find((record) => record.id === actor.id) ?? actor;
}

function stateRateRow(id: string, label: string, value: ActorRateGrade, onChange: (value: ActorRateGrade) => void): HTMLElement {
  const labelNode = el("span", { text: `${label} ${stateRatePercentage(value)}%` });
  const select = gradeSelect(value, (grade) => {
    labelNode.textContent = `${label} ${stateRatePercentage(grade)}%`;
    onChange(grade);
  });
  select.dataset.testid = `db-picker-actor-state-rate-${id}`;
  return el("label", {
    class: "actor-rate-row actor-state-rate-row",
    dataset: { testid: `db-actor-state-rate-${id}` },
    children: [
      labelNode,
      select,
    ],
  });
}
