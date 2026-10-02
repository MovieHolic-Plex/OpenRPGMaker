import { CHARACTER_MOTION_STYLES, CHARACTER_MOTION_LABELS, normalizeCharacterMotion } from "@/battle/characterMotion";
import { resolveCharacterMotion } from "@/assets/characterMotionCatalog";
import { numberField, selectField } from "@/editor/panels/databaseControls";
import { equipmentSlots } from "@/project/equipmentSlots";
import { equipmentSlotAccepts } from "@/project/equipmentRules";
import { ACTOR_BATTLE_COMMAND_MAX, DEFAULT_ELEMENT_RATE_LABELS, stateRatePercentage } from "@/project/actorModel";
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
import type { ActorAutoTactic, ActorOptions, ActorRateGrade, ActorRecord } from "@/project/types";
import { el } from "@/util/dom";

type ActorBooleanOption = Exclude<keyof ActorOptions, "autoTactic">;

const OPTION_LABELS: readonly { readonly key: ActorBooleanOption; readonly label: string }[] = [
  { key: "dualWield", label: "이도류" },
  { key: "autoBattle", label: "자동 전투" },
  { key: "fixedEquipment", label: "장비 고정" },
  { key: "mightyGuard", label: "강력 방어" },
] as const;

/** 자동 전투 작전. 빈 값 = 균형(기존 자동 전투). */
const AUTO_TACTIC_OPTIONS: readonly { readonly id: ActorAutoTactic; readonly name: string }[] = [
  { id: "attackAll", name: "전원 공격" },
  { id: "healFirst", name: "회복 우선" },
  { id: "conserveMp", name: "MP 아끼기" },
  { id: "followOrders", name: "명령 따르기 (직접 조작)" },
];

export function battlePanel(actor: ActorRecord, rerender: () => void, refreshBuildPreview: () => void): HTMLElement {
  return actorPanel("장비와 스킬", "actor-battle", [
    equipmentPanel(actor, refreshBuildPreview),
    selectRecord("무기 없이 공격할 때 효과", "db-picker-unarmed-animation", actor.unarmedAnimationId ?? "", store.getCurrent().database.battleAnimations, (unarmedAnimationId) =>
      updateDatabaseRecord("actors", actor.id, { unarmedAnimationId: emptyToUndefined(unarmedAnimationId) })
    ),
    characterMotionPanel(actor, rerender),
    optionsPanel(actor),
    battleCommandsPanel(actor, rerender),
    learnedSkillsPanel(actor, rerender),
  ]);
}

/** 배우가 고를 수 있는 명령 — 전역 명령 목록 + 이 배우 직업의 명령(같은 id 는 한 번). */
function actorCommandChoices(actor: ActorRecord): readonly { readonly id: string; readonly name: string }[] {
  const project = store.getCurrent();
  const klass = project.database.classes.find((record) => record.id === actor.classId);
  const choices: { id: string; name: string }[] = [];
  for (const command of [...(project.database.battleCommands ?? []), ...(klass?.battleCommands ?? [])]) {
    if (choices.some((choice) => choice.id === command.id)) continue;
    choices.push({ id: command.id, name: command.name || command.id });
  }
  return choices;
}

/**
 * RM2003 의 「배우별 전투 명령」. 비우면 직업 명령을 그대로 쓰고, 켜면 이 배우만 다른 메뉴를 갖는다.
 * 우선순위는 전투 중 이벤트로 바꾼 명령 > 이 목록 > 직업 명령(battleCommandsForActor).
 */
function battleCommandsPanel(actor: ActorRecord, rerender: () => void): HTMLElement {
  const choices = actorCommandChoices(actor);
  const klass = store.getCurrent().database.classes.find((record) => record.id === actor.classId);
  const ids = actor.battleCommandIds ?? [];
  const custom = ids.length > 0;
  const write = (next: readonly string[]): void => {
    updateDatabaseRecord("actors", actor.id, { battleCommandIds: next.length > 0 ? [...next] : undefined });
    rerender();
  };
  const classNames = (klass?.battleCommands ?? []).map((command) => command.name || command.id).join(" · ");
  const rows = ids.map((id, index) => {
    const options = choices.some((choice) => choice.id === id) ? choices : [...choices, { id, name: `${id} (없음)` }];
    return el("div", {
      class: "actor-skill-row actor-command-row",
      dataset: { testid: `db-actor-command-row-${index}` },
      children: [
        selectInput(`db-picker-actor-command-${index}`, id, options, (nextId) =>
          write((currentActor(actor).battleCommandIds ?? []).map((entry, entryIndex) => (entryIndex === index ? nextId : entry)))
        ),
        el("button", {
          class: "btn small",
          text: "↑",
          attrs: { type: "button", "aria-label": "한 칸 위로", ...(index === 0 ? { disabled: "" } : {}) },
          dataset: { testid: `db-actor-command-up-${index}` },
          on: { click: () => write(moveEntry(currentActor(actor).battleCommandIds ?? [], index, -1)) },
        }),
        el("button", {
          class: "btn small",
          text: "↓",
          attrs: { type: "button", "aria-label": "한 칸 아래로", ...(index === ids.length - 1 ? { disabled: "" } : {}) },
          dataset: { testid: `db-actor-command-down-${index}` },
          on: { click: () => write(moveEntry(currentActor(actor).battleCommandIds ?? [], index, 1)) },
        }),
        el("button", {
          class: "btn small",
          text: "삭제",
          attrs: { type: "button" },
          dataset: { testid: `db-actor-command-remove-${index}` },
          on: { click: () => write((currentActor(actor).battleCommandIds ?? []).filter((_, entryIndex) => entryIndex !== index)) },
        }),
      ],
    });
  });
  const firstUnused = choices.find((choice) => !ids.includes(choice.id))?.id;
  return actorPanel("전투 명령", "actor-battle-commands", [
    checkboxControl("이 배우만 다른 명령 쓰기", "db-field-actor-custom-commands", custom, (enabled) => {
      // 켜는 순간 직업 명령을 그대로 옮겨 와서, 빈 메뉴가 되거나 처음부터 다시 고르지 않게 한다.
      if (enabled) write((klass?.battleCommands ?? []).map((command) => command.id).slice(0, ACTOR_BATTLE_COMMAND_MAX));
      else write([]);
    }),
    custom
      ? el("div", { class: "actor-skill-list", dataset: { testid: "db-actor-command-list" }, children: rows })
      : el("p", {
          class: "actor-rate-manual-note",
          dataset: { testid: "db-actor-command-class-note" },
          text: classNames ? `직업 명령을 씁니다: ${classNames}` : "직업 명령을 씁니다.",
        }),
    ...(custom
      ? [el("button", {
          class: "btn small",
          text: `명령 추가 (${ids.length}/${ACTOR_BATTLE_COMMAND_MAX})`,
          attrs: { type: "button", ...(!firstUnused || ids.length >= ACTOR_BATTLE_COMMAND_MAX ? { disabled: "" } : {}) },
          dataset: { testid: "db-add-actor-command" },
          on: { click: () => { if (firstUnused) write([...(currentActor(actor).battleCommandIds ?? []), firstUnused]); } },
        })]
      : []),
  ]);
}

function moveEntry(ids: readonly string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta;
  if (target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
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
  return actorPanel("약점과 저항", "actor-rates", [
    el("p", {
      class: "actor-rate-manual-note",
      dataset: { testid: "db-actor-state-rate-manual-note" },
      text: "상태는 A에서 E로 갈수록 걸릴 확률이 낮아집니다. 속성 등급은 공격 피해의 약점·저항을 정합니다.",
    }),
    el("div", {
      class: "actor-rate-columns",
      children: [rateList("상태 저항", stateRows), rateList("속성 방어", elementRows)],
    }),
  ]);
}

function equipmentPanel(actor: ActorRecord, refreshBuildPreview: () => void): HTMLElement {
  const project = store.getCurrent();
  const equipment = project.database.equipment;
  return actorPanel("초기 장비", "actor-starting-equipment", equipmentSlots(project).map((slot) => {
    const options = equipment.filter((entry) => equipmentSlotAccepts(project, actor, slot.id, entry));
    return selectRecord(slot.label, `db-picker-actor-equipment-${slot.id}`, actor.initialEquipment[slot.id] ?? "", options, (id) => {
      updateDatabaseRecord("actors", actor.id, {
        initialEquipment: { ...currentActor(actor).initialEquipment, [slot.id]: emptyToUndefined(id) },
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
    selectRecord("자동 전투 작전 (비우면 균형)", "db-picker-actor-auto-tactic", actor.options.autoTactic ?? "", AUTO_TACTIC_OPTIONS, (value) => {
      const { autoTactic: _previous, ...rest } = currentActor(actor).options;
      const autoTactic = AUTO_TACTIC_OPTIONS.find((option) => option.id === value)?.id;
      updateDatabaseRecord("actors", actor.id, { options: autoTactic ? { ...rest, autoTactic } : rest });
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

function characterMotionPanel(actor: ActorRecord, rerender: () => void): HTMLElement {
  const profile = resolveCharacterMotion(actor);
  const save = (patch: NonNullable<ActorRecord["battleMotion"]>) =>
    updateDatabaseRecord("actors", actor.id, {
      battleMotion: normalizeCharacterMotion({ ...currentActor(actor).battleMotion, ...patch }),
    });
  const style = selectField("움직임", "db-actor-motion-style", actor.battleMotion?.style ?? "",
    CHARACTER_MOTION_STYLES.map(id => ({ id, name: CHARACTER_MOTION_LABELS[id] })),
    value => { save({ style: (value || undefined) as typeof profile.style }); rerender(); });
  style.querySelector("option")!.textContent = "직업 기본 · " + CHARACTER_MOTION_LABELS[
    resolveCharacterMotion({ ...actor, battleMotion: undefined }).style];
  return actorPanel("전투 동작", "actor-motion", [
    style,
    ...([
      ["anticipation", "준비 시간"], ["travel", "이동 시간"], ["recovery", "복귀 시간"],
      ["jump", "도약 높이"], ["recoil", "피격 반동"], ["reach", "접촉 위치 보정"],
    ] as const).map(([key, label]) => numberField(
      label + (key === "reach" ? " (px)" : " (배율)"), "db-actor-motion-" + key,
      actor.battleMotion?.[key] ?? (key === "reach" ? 0 : profile[key]), value => save({ [key]: value }),
      { min: key === "reach" ? -20 : key === "recoil" ? 0 : 0.4, max: key === "reach" ? 24 : 2, step: key === "reach" ? 1 : 0.05 },
    )),
    el("button", { attrs: { type: "button" }, text: "직업 기본으로 되돌리기", on: { click: () => {
      updateDatabaseRecord("actors", actor.id, { battleMotion: undefined }); rerender();
    } } }),
  ]);
}
