import { ACTOR_PARAMETER_KEYS, parameterValueAtLevel, totalExpForLevel } from "@/project/actorModel";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { ActorParameterKey, ActorRecord } from "@/project/types";
import { el } from "@/util/dom";

const PARAMETER_LABELS: Record<ActorParameterKey, string> = {
  maxHp: "최대 HP",
  maxMp: "최대 MP",
  attack: "공격력",
  defense: "방어력",
  mind: "정신력",
  agility: "민첩성",
};

const LAST_ACTOR_PARAMETER_LEVELS = new Map<string, number>();

export function actorCurveCards(actor: ActorRecord): HTMLElement[] {
  return ACTOR_PARAMETER_KEYS.map((key) => {
    const curve = currentActorParameterCurves(actor)[key];
    const currentLevel = lastEditedParameterLevel(actor.id, key);
    return el("button", {
      class: `actor-curve actor-curve-${key}`,
      dataset: { testid: `db-actor-curve-edit-${key}` },
      attrs: { type: "button", title: `${PARAMETER_LABELS[key]} 곡선 설정` },
      on: { click: () => openActorParameterDialog(actor, key) },
      children: [
        el("strong", { text: PARAMETER_LABELS[key] }),
        el("span", { text: `Lv${currentLevel}:${parameterValueAtLevel(curve, currentLevel)}` }),
        el("div", { class: "actor-curve-graph", children: curveBars(curve, currentLevel) }),
      ],
    });
  });
}

export function actorExperiencePanel(actor: ActorRecord): HTMLElement[] {
  const curve = currentActorExpCurve(actor);
  return [
    el("div", {
      class: "actor-exp-row",
      children: [
        el("span", {
          dataset: { testid: "db-actor-exp-summary" },
          text: `기본=${curve.base}; 추가=${curve.extra}; 가속=${curve.acceleration}`,
        }),
        el("span", { text: `Lv99 ${totalExpForLevel(curve, 99).toLocaleString()}` }),
        el("button", {
          class: "btn small",
          text: "설정",
          dataset: { testid: "db-actor-exp-edit" },
          attrs: { type: "button" },
          on: { click: () => openActorExperienceDialog(actor) },
        }),
      ],
    }),
  ];
}

function openActorParameterDialog(actor: ActorRecord, initialKey: ActorParameterKey): void {
  let activeKey = initialKey;
  let activeLevel = lastEditedParameterLevel(actor.id, initialKey);
  const close = (): void => backdrop.remove();
  const levelInput = dialogNumberInput("db-actor-parameter-level", activeLevel, 1, 99);
  const valueInput = dialogNumberInput("db-actor-parameter-value", parameterValueAtLevel(currentActorParameterCurves(actor)[activeKey], activeLevel), 1, 99999);
  const valueLabel = el("span", { text: PARAMETER_LABELS[activeKey] });
  const graph = el("div", { class: "db-class-curve-dialog-graph" });
  const tabs = el("div", { class: "db-class-curve-tabs" });

  const syncValueInput = (): void => {
    valueLabel.textContent = PARAMETER_LABELS[activeKey];
    valueInput.value = String(parameterValueAtLevel(currentActorParameterCurves(actor)[activeKey], activeLevel));
  };
  const renderGraph = (): void => {
    const curve = currentActorParameterCurves(actor)[activeKey];
    graph.replaceChildren(...curve.map((value, index) => curveColumn(value, curve, index + 1, activeLevel, (level) => {
      activeLevel = level;
      levelInput.value = String(activeLevel);
      syncValueInput();
      renderGraph();
    })));
  };
  const renderTabs = (): void => {
    tabs.replaceChildren(...ACTOR_PARAMETER_KEYS.map((key) => el("button", {
      class: key === activeKey ? "active" : "",
      text: PARAMETER_LABELS[key],
      attrs: { type: "button" },
      on: { click: () => {
        activeKey = key;
        syncValueInput();
        renderTabs();
        renderGraph();
      } },
    })));
  };
  const applyValue = (): void => {
    activeLevel = clampDialogInteger(levelInput.valueAsNumber, 1, 99);
    const value = clampDialogInteger(valueInput.valueAsNumber, 1, 99999);
    const curves = currentActorParameterCurves(actor);
    const nextCurve = curves[activeKey].slice();
    nextCurve[activeLevel - 1] = value;
    updateDatabaseRecord("actors", actor.id, { parameterCurves: { ...curves, [activeKey]: nextCurve } });
    setLastEditedParameterLevel(actor.id, activeKey, activeLevel);
    levelInput.value = String(activeLevel);
    valueInput.value = String(value);
    renderGraph();
  };
  const backdrop = el("div", {
    class: "db-class-dialog-backdrop",
    dataset: { testid: "db-actor-parameter-dialog" },
    children: [el("section", {
      class: "db-class-dialog db-class-parameter-dialog",
      attrs: { role: "dialog", "aria-label": "주인공 능력치 곡선 설정" },
      children: [
        el("header", { children: [el("strong", { text: "능력치 곡선" }), el("button", { text: "x", attrs: { type: "button" }, on: { click: close } })] }),
        tabs,
        el("div", { class: "db-class-dialog-body", children: [
          graph,
          el("aside", { class: "db-class-dialog-side", children: [
            dialogNumberLabel("레벨", levelInput),
            el("label", { class: "db-class-dialog-number", children: [valueLabel, valueInput] }),
            el("button", { class: "btn", text: "적용", dataset: { testid: "db-actor-parameter-apply" }, attrs: { type: "button" }, on: { click: applyValue } }),
          ] }),
        ] }),
        el("footer", { children: [
          el("button", { class: "btn", text: "OK", dataset: { testid: "db-actor-parameter-close" }, attrs: { type: "button" }, on: { click: close } }),
          el("button", { class: "btn", text: "취소", attrs: { type: "button" }, on: { click: close } }),
        ] }),
      ],
    })],
  });
  levelInput.addEventListener("change", () => {
    activeLevel = clampDialogInteger(levelInput.valueAsNumber, 1, 99);
    levelInput.value = String(activeLevel);
    syncValueInput();
    renderGraph();
  });
  valueInput.addEventListener("change", applyValue);
  renderTabs();
  renderGraph();
  document.body.append(backdrop);
}

function openActorExperienceDialog(actor: ActorRecord): void {
  const close = (): void => backdrop.remove();
  const baseInput = dialogNumberInput("db-actor-exp-base", currentActorExpCurve(actor).base, 0, 999999);
  const extraInput = dialogNumberInput("db-actor-exp-extra", currentActorExpCurve(actor).extra, 0, 999999);
  const accelerationInput = dialogNumberInput("db-actor-exp-acceleration", currentActorExpCurve(actor).acceleration, 0, 999999);
  const table = el("div", { class: "db-class-exp-table" });
  const graph = el("div", { class: "db-class-exp-dialog-graph" });
  const applyCurve = (): void => {
    updateDatabaseRecord("actors", actor.id, {
      expCurve: {
        base: clampDialogInteger(baseInput.valueAsNumber, 0, 999999),
        extra: clampDialogInteger(extraInput.valueAsNumber, 0, 999999),
        acceleration: clampDialogInteger(accelerationInput.valueAsNumber, 0, 999999),
      },
    });
    renderExp();
  };
  const renderExp = (): void => {
    const curve = currentActorExpCurve(actor);
    const values = Array.from({ length: 99 }, (_, index) => totalExpForLevel(curve, index + 1));
    table.replaceChildren(...values.map((value, index) => el("span", { text: `L${String(index + 1).padStart(2, " ")}: ${value.toLocaleString()}` })));
    graph.replaceChildren(...values.map((value) => el("i", { attrs: { style: `height:${curveHeight(value, values)}%` } })));
  };
  const backdrop = el("div", {
    class: "db-class-dialog-backdrop",
    dataset: { testid: "db-actor-exp-dialog" },
    children: [el("section", {
      class: "db-class-dialog db-class-exp-dialog",
      attrs: { role: "dialog", "aria-label": "주인공 경험치 곡선 설정" },
      children: [
        el("header", { children: [el("strong", { text: "경험치 곡선" }), el("button", { text: "x", attrs: { type: "button" }, on: { click: close } })] }),
        el("div", { class: "db-class-exp-dialog-body", children: [table, graph] }),
        el("div", { class: "db-class-exp-controls", children: [
          dialogNumberLabel("기본값", baseInput),
          dialogNumberLabel("추가값", extraInput),
          dialogNumberLabel("가속", accelerationInput),
        ] }),
        el("footer", { children: [
          el("button", { class: "btn", text: "OK", dataset: { testid: "db-actor-exp-close" }, attrs: { type: "button" }, on: { click: () => {
            applyCurve();
            close();
          } } }),
          el("button", { class: "btn", text: "취소", attrs: { type: "button" }, on: { click: close } }),
        ] }),
      ],
    })],
  });
  [baseInput, extraInput, accelerationInput].forEach((input) => input.addEventListener("change", applyCurve));
  renderExp();
  document.body.append(backdrop);
}

function currentActorParameterCurves(actor: ActorRecord): ActorRecord["parameterCurves"] {
  return store.getCurrent().database.actors.find((entry) => entry.id === actor.id)?.parameterCurves ?? actor.parameterCurves;
}

function currentActorExpCurve(actor: ActorRecord): ActorRecord["expCurve"] {
  return store.getCurrent().database.actors.find((entry) => entry.id === actor.id)?.expCurve ?? actor.expCurve;
}

function lastEditedParameterLevel(actorId: string, key: ActorParameterKey): number {
  return LAST_ACTOR_PARAMETER_LEVELS.get(`${actorId}:${key}`) ?? 1;
}

function setLastEditedParameterLevel(actorId: string, key: ActorParameterKey, level: number): void {
  LAST_ACTOR_PARAMETER_LEVELS.set(`${actorId}:${key}`, level);
}

function curveColumn(value: number, values: readonly number[], level: number, activeLevel: number, onSelect: (level: number) => void): HTMLElement {
  return el("button", {
    class: level === activeLevel ? "active" : "",
    attrs: { type: "button", style: `height:${curveHeight(value, values)}%` },
    on: { click: () => onSelect(level) },
  });
}

function curveHeight(value: number, values: readonly number[]): number {
  const max = Math.max(...values, 1);
  return Math.max(2, Math.round(Math.pow(value / max, 0.62) * 100));
}

function curveBars(curve: readonly number[], activeLevel: number): HTMLElement[] {
  const max = Math.max(...curve, 1);
  return previewSampleIndexes(curve.length, activeLevel).map((index) => {
    const value = curve[index] ?? curve[curve.length - 1] ?? 1;
    const level = index + 1;
    return el("i", {
      class: level === activeLevel ? "active" : "",
      attrs: {
        "aria-label": `Lv${level}: ${value}`,
        "data-level": String(level),
        "data-value": String(value),
        style: `height:${Math.max(5, Math.round((value / max) * 100))}%`,
      },
    });
  });
}

function previewSampleIndexes(length: number, activeLevel: number): number[] {
  const lastIndex = Math.max(0, length - 1);
  const indexes = new Set<number>();
  for (let step = 0; step < 33; step += 1) indexes.add(Math.round((step / 32) * lastIndex));
  indexes.add(Math.min(lastIndex, Math.max(0, activeLevel - 1)));
  return [...indexes].sort((left, right) => left - right);
}

function dialogNumberInput(testid: string, value: number, min: number, max: number): HTMLInputElement {
  const input = el("input", { dataset: { testid }, attrs: { type: "number", min: String(min), max: String(max), value: String(value) } }) as HTMLInputElement;
  input.addEventListener("focus", () => input.select());
  return input;
}

function dialogNumberLabel(label: string, input: HTMLInputElement): HTMLElement {
  return el("label", { class: "db-class-dialog-number", children: [el("span", { text: label }), input] });
}

function clampDialogInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
