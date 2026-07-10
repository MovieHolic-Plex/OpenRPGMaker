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
  // 다이얼로그 안의 편집은 draft 에만 쌓는다 — "취소"가 진짜 취소가 되도록(P7).
  let draft: ClassRecord["expCurve"] = { ...currentClassExpCurve(record) };
  let view: "total" | "delta" = "total";
  const baseInput = dialogNumberInput("db-class-exp-base", draft.base, 0, 999999);
  const extraInput = dialogNumberInput("db-class-exp-extra", draft.extra, 0, 999999);
  const accelerationInput = dialogNumberInput("db-class-exp-acceleration", draft.acceleration, 0, 999999);
  const table = el("div", { class: "db-class-exp-table" });
  const graph = el("div", { class: "db-class-exp-dialog-graph" });
  const totalTab = el("button", {
    class: "active",
    text: "누적 경험치",
    dataset: { testid: "db-class-exp-tab-total" },
    attrs: { type: "button" },
    on: { click: () => setView("total") },
  });
  const deltaTab = el("button", {
    text: "다음 레벨까지",
    dataset: { testid: "db-class-exp-tab-delta" },
    attrs: { type: "button" },
    on: { click: () => setView("delta") },
  });
  const setView = (next: "total" | "delta"): void => {
    view = next;
    totalTab.className = next === "total" ? "active" : "";
    deltaTab.className = next === "delta" ? "active" : "";
    renderExp();
  };
  const readDraftFromInputs = (): void => {
    draft = {
      base: clampDialogInteger(dialogInputNumber(baseInput), 0, 999999),
      extra: clampDialogInteger(dialogInputNumber(extraInput), 0, 999999),
      acceleration: clampDialogInteger(dialogInputNumber(accelerationInput), 0, 999999),
    };
    baseInput.value = String(draft.base);
    extraInput.value = String(draft.extra);
    accelerationInput.value = String(draft.acceleration);
  };
  const renderExp = (): void => {
    const totals = Array.from({ length: 99 }, (_, index) => totalExpForLevel(draft, index + 1));
    // "다음 레벨까지" 뷰: 레벨 n → n+1 에 필요한 경험치(L99 는 최고 레벨 — 없음).
    const values = view === "total"
      ? totals
      : totals.map((value, index) => (index + 1 < totals.length ? (totals[index + 1] ?? value) - value : 0));
    table.replaceChildren(...values.map((value, index) => el("span", {
      text: view === "delta" && index === totals.length - 1
        ? `L${String(index + 1).padStart(2, " ")}: -`
        : `L${String(index + 1).padStart(2, " ")}: ${value.toLocaleString()}`,
    })));
    graph.replaceChildren(...values.map((value) => el("i", { attrs: { style: `height:${curveHeight(value, values)}%` } })));
  };
  const commitDraft = (): void => {
    readDraftFromInputs();
    updateDatabaseRecord("classes", record.id, { expCurve: { ...draft } });
    refresh();
  };
  const backdrop = el("div", {
    class: "db-class-dialog-backdrop",
    dataset: { testid: "db-class-exp-dialog" },
    children: [el("section", {
      class: "db-class-dialog db-class-exp-dialog",
      attrs: { role: "dialog", "aria-label": "경험치 곡선 설정" },
      children: [
        el("header", { children: [el("strong", { text: "경험치 곡선" }), el("button", { text: "x", attrs: { type: "button" }, on: { click: close } })] }),
        el("div", { class: "db-class-exp-dialog-tabs", children: [totalTab, deltaTab] }),
        el("div", { class: "db-class-exp-dialog-body", children: [table, graph] }),
        el("div", { class: "db-class-exp-controls", children: [
          dialogNumberLabel("기본값", baseInput),
          dialogNumberLabel("추가값", extraInput),
          dialogNumberLabel("가속", accelerationInput),
        ] }),
        el("footer", { children: [
          el("button", { class: "btn", text: "OK", dataset: { testid: "db-class-exp-close" }, attrs: { type: "button" }, on: { click: () => {
            commitDraft();
            close();
          } } }),
          el("button", { class: "btn", text: "취소", dataset: { testid: "db-class-exp-cancel" }, attrs: { type: "button" }, on: { click: close } }),
        ] }),
      ],
    })],
  });
  [baseInput, extraInput, accelerationInput].forEach((input) => input.addEventListener("change", () => {
    readDraftFromInputs();
    renderExp();
  }));
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
  input.value = String(value);
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

// valueAsNumber 는 fake DOM 테스트 환경에 없다 — value 문자열 기반으로 통일.
function dialogInputNumber(input: HTMLInputElement): number {
  return input.value.trim() === "" ? Number.NaN : Number(input.value);
}
