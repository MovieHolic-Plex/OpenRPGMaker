import { totalExpForLevel } from "@/project/actorModel";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { ClassRecord } from "@/project/types";
import { el } from "@/util/dom";

export function renderClassExperiencePanel(record: ClassRecord, host: HTMLElement, refresh: () => void): void {
  const curve = currentClassExpCurve(record);
  host.replaceChildren(
    el("div", {
      class: "db-class-exp-summary",
      dataset: { testid: "db-class-exp-summary" },
      text: `기본=${curve.base}; 추가=${curve.extra}; 가속=${curve.acceleration}`,
    }),
    el("button", {
      class: "db-class-exp-graph",
      dataset: { testid: "db-class-exp-edit" },
      attrs: { type: "button", title: "경험치 곡선 설정" },
      on: { click: () => openClassExperienceDialog(record, refresh) },
      children: curveBars(experienceSamples(record)),
    })
  );
}

function openClassExperienceDialog(record: ClassRecord, refresh: () => void = () => undefined): void {
  const close = (): void => backdrop.remove();
  const baseInput = dialogNumberInput("db-class-exp-base", currentClassExpCurve(record).base, 0, 999999);
  const extraInput = dialogNumberInput("db-class-exp-extra", currentClassExpCurve(record).extra, 0, 999999);
  const accelerationInput = dialogNumberInput("db-class-exp-acceleration", currentClassExpCurve(record).acceleration, 0, 999999);
  const table = el("div", { class: "db-class-exp-table" });
  const graph = el("div", { class: "db-class-exp-dialog-graph" });
  const applyCurve = (): void => {
    updateDatabaseRecord("classes", record.id, {
      expCurve: {
        base: clampDialogInteger(baseInput.valueAsNumber, 0, 999999),
        extra: clampDialogInteger(extraInput.valueAsNumber, 0, 999999),
        acceleration: clampDialogInteger(accelerationInput.valueAsNumber, 0, 999999),
      },
    });
    renderExp();
    refresh();
  };
  const renderExp = (): void => {
    const curve = currentClassExpCurve(record);
    const values = Array.from({ length: 99 }, (_, index) => totalExpForLevel(curve, index + 1));
    table.replaceChildren(...values.map((value, index) => el("span", { text: `L${String(index + 1).padStart(2, " ")}: ${value.toLocaleString()}` })));
    graph.replaceChildren(...values.map((value) => el("i", { attrs: { style: `height:${curveHeight(value, values)}%` } })));
  };
  const backdrop = el("div", {
    class: "db-class-dialog-backdrop",
    dataset: { testid: "db-class-exp-dialog" },
    children: [el("section", {
      class: "db-class-dialog db-class-exp-dialog",
      attrs: { role: "dialog", "aria-label": "경험치 곡선 설정" },
      children: [
        el("header", { children: [el("strong", { text: "경험치 곡선" }), el("button", { text: "x", attrs: { type: "button" }, on: { click: close } })] }),
        el("div", { class: "db-class-exp-dialog-tabs", children: [
          el("button", { class: "active", text: "누적 경험치", attrs: { type: "button" } }),
          el("button", { text: "다음 레벨까지", attrs: { type: "button" } }),
        ] }),
        el("div", { class: "db-class-exp-dialog-body", children: [table, graph] }),
        el("div", { class: "db-class-exp-controls", children: [
          dialogNumberLabel("기본값", baseInput),
          dialogNumberLabel("추가값", extraInput),
          dialogNumberLabel("가속", accelerationInput),
        ] }),
        el("footer", { children: [
          el("button", { class: "btn", text: "OK", dataset: { testid: "db-class-exp-close" }, attrs: { type: "button" }, on: { click: () => {
            applyCurve();
            close();
          } } }),
          el("button", { class: "btn", text: "취소", attrs: { type: "button" }, on: { click: close } }),
          el("button", { class: "btn", text: "도움말", attrs: { type: "button" } }),
        ] }),
      ],
    })],
  });
  [baseInput, extraInput, accelerationInput].forEach((input) => input.addEventListener("change", applyCurve));
  renderExp();
  document.body.append(backdrop);
}

function currentClassExpCurve(record: ClassRecord): ClassRecord["expCurve"] {
  return store.getCurrent().database.classes.find((entry) => entry.id === record.id)?.expCurve ?? record.expCurve;
}

function experienceSamples(record: ClassRecord): readonly number[] {
  const curve = currentClassExpCurve(record);
  return previewSampleLevels().map((level) => Math.max(1, totalExpForLevel(curve, level)));
}

function curveHeight(value: number, values: readonly number[]): number {
  const max = Math.max(...values, 1);
  return Math.max(2, Math.round(Math.pow(value / max, 0.62) * 100));
}

function curveBars(curve: readonly number[]): HTMLElement[] {
  const max = Math.max(...curve, 1);
  return curve.map((value, index) =>
    el("i", {
      attrs: {
        "aria-label": `L${previewSampleLevels()[index] ?? index + 1}: ${value}`,
        "data-value": String(value),
        style: `height:${Math.max(5, Math.round(Math.pow(value / max, 0.62) * 100))}%`,
      },
    })
  );
}

function previewSampleLevels(): number[] {
  const levels = new Set<number>();
  for (let step = 0; step < 33; step += 1) {
    levels.add(1 + Math.round((step / 32) * 98));
  }
  return [...levels].sort((left, right) => left - right);
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
