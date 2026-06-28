import { ACTOR_PARAMETER_KEYS, parameterValueAtLevel } from "@/project/actorModel";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { ActorParameterKey, ClassRecord } from "@/project/types";
import { el } from "@/util/dom";

const PARAMETER_LABELS: Record<ActorParameterKey, string> = {
  maxHp: "최대 HP",
  maxMp: "최대 MP",
  attack: "공격력",
  defense: "방어력",
  mind: "정신력",
  agility: "민첩성",
};
const LAST_CLASS_PARAMETER_LEVELS = new Map<string, number>();

export function classCurveCards(record: ClassRecord, refresh: () => void = () => undefined): HTMLElement[] {
  return ACTOR_PARAMETER_KEYS.map((key) => {
    const curve = currentClassParameterCurves(record)[key];
    const currentLevel = lastEditedParameterLevel(record.id, key);
    return el("button", {
      class: `db-class-curve db-class-curve-${key}`,
      dataset: { testid: `db-class-curve-edit-${key}` },
      attrs: { type: "button", title: `${PARAMETER_LABELS[key]} 곡선 설정` },
      on: { click: () => openClassParameterDialog(record, key, refresh), dblclick: () => openClassParameterDialog(record, key, refresh) },
      children: [
        el("strong", { text: PARAMETER_LABELS[key] }),
        el("span", { text: `Lv${currentLevel}:${parameterValueAtLevel(curve, currentLevel)}` }),
        el("div", { class: "db-class-curve-graph", children: curveBars(curve, currentLevel) }),
      ],
    });
  });
}

function openClassParameterDialog(record: ClassRecord, initialKey: ActorParameterKey, refresh: () => void = () => undefined): void {
  let activeKey = initialKey;
  let activeLevel = lastEditedParameterLevel(record.id, initialKey);
  const close = (): void => backdrop.remove();
  const levelInput = dialogNumberInput("db-class-parameter-level", activeLevel, 1, 99);
  const valueInput = dialogNumberInput("db-class-parameter-value", parameterValueAtLevel(currentClassParameterCurves(record)[activeKey], activeLevel), 1, 99999);
  const valueLabel = el("span", { text: PARAMETER_LABELS[activeKey] });
  const graph = el("div", { class: "db-class-curve-dialog-graph" });
  const tabs = el("div", { class: "db-class-curve-tabs" });

  const syncValueInput = (): void => {
    valueLabel.textContent = PARAMETER_LABELS[activeKey];
    valueInput.value = String(parameterValueAtLevel(currentClassParameterCurves(record)[activeKey], activeLevel));
  };
  const renderGraph = (): void => {
    const curve = currentClassParameterCurves(record)[activeKey];
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
    const curves = currentClassParameterCurves(record);
    const nextCurve = curves[activeKey].slice();
    nextCurve[activeLevel - 1] = value;
    updateDatabaseRecord("classes", record.id, { parameterCurves: { ...curves, [activeKey]: nextCurve } });
    setLastEditedParameterLevel(record.id, activeKey, activeLevel);
    levelInput.value = String(activeLevel);
    valueInput.value = String(value);
    renderGraph();
    refresh();
  };
  const applyPreset = (preset: ClassCurvePreset): void => {
    const curves = currentClassParameterCurves(record);
    updateDatabaseRecord("classes", record.id, { parameterCurves: { ...curves, [activeKey]: presetCurve(curves[activeKey], preset) } });
    syncValueInput();
    renderGraph();
    refresh();
  };
  const backdrop = el("div", {
    class: "db-class-dialog-backdrop",
    dataset: { testid: "db-class-parameter-dialog" },
    children: [el("section", {
      class: "db-class-dialog db-class-parameter-dialog",
      attrs: { role: "dialog", "aria-label": "능력치 곡선 설정" },
      children: [
        el("header", { children: [el("strong", { text: "능력치 곡선" }), el("button", { text: "x", attrs: { type: "button" }, on: { click: close } })] }),
        tabs,
        el("div", { class: "db-class-dialog-body", children: [
          graph,
          el("aside", { class: "db-class-dialog-side", children: [
            dialogNumberLabel("레벨", levelInput),
            el("label", { class: "db-class-dialog-number", children: [valueLabel, valueInput] }),
            el("button", { class: "btn", text: "적용", dataset: { testid: "db-class-parameter-apply" }, attrs: { type: "button" }, on: { click: applyValue } }),
            panel("간단 설정", [
              presetButton("천재형", () => applyPreset("genius")),
              presetButton("우수형", () => applyPreset("superior")),
              presetButton("표준형", () => applyPreset("standard")),
              presetButton("열등형", () => applyPreset("inferior")),
            ]),
          ] }),
        ] }),
        el("footer", { children: [
          el("button", { class: "btn", text: "OK", dataset: { testid: "db-class-parameter-close" }, attrs: { type: "button" }, on: { click: close } }),
          el("button", { class: "btn", text: "취소", attrs: { type: "button" }, on: { click: close } }),
          el("button", { class: "btn", text: "도움말", attrs: { type: "button" } }),
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

type ClassCurvePreset = "genius" | "superior" | "standard" | "inferior";

function currentClassParameterCurves(record: ClassRecord): ClassRecord["parameterCurves"] {
  return store.getCurrent().database.classes.find((entry) => entry.id === record.id)?.parameterCurves ?? record.parameterCurves;
}

function lastEditedParameterLevel(classId: string, key: ActorParameterKey): number {
  return LAST_CLASS_PARAMETER_LEVELS.get(`${classId}:${key}`) ?? 1;
}

function setLastEditedParameterLevel(classId: string, key: ActorParameterKey, level: number): void {
  LAST_CLASS_PARAMETER_LEVELS.set(`${classId}:${key}`, level);
}

function curveColumn(value: number, values: readonly number[], level: number, activeLevel: number, onSelect: (level: number) => void): HTMLElement {
  return el("button", {
    class: level === activeLevel ? "active" : "",
    attrs: { type: "button", style: `height:${curveHeight(value, values)}%` },
    on: { click: () => onSelect(level) },
  });
}

function presetCurve(curve: readonly number[], preset: ClassCurvePreset): number[] {
  const start = curve[0] ?? 1;
  const end = curve[curve.length - 1] ?? start;
  const exponent = preset === "genius" ? 0.72 : preset === "superior" ? 0.88 : preset === "inferior" ? 1.28 : 1;
  const multiplier = preset === "genius" ? 1.22 : preset === "superior" ? 1.1 : preset === "inferior" ? 0.82 : 1;
  return curve.map((_, index) => {
    const ratio = index / Math.max(1, curve.length - 1);
    return clampDialogInteger(Math.round((start + (end - start) * Math.pow(ratio, exponent)) * multiplier), 1, 99999);
  });
}

function curveHeight(value: number, values: readonly number[]): number {
  const max = Math.max(...values, 1);
  return Math.max(2, Math.round((value / max) * 100));
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
  for (let step = 0; step < 33; step += 1) {
    indexes.add(Math.round((step / 32) * lastIndex));
  }
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

function presetButton(label: string, onClick: () => void): HTMLElement {
  return el("button", { class: "btn", text: label, attrs: { type: "button" }, on: { click: onClick } });
}

function panel(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

function clampDialogInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
