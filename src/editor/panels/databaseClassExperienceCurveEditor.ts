import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { totalExpForLevel } from "@/project/actorModel";
import type { ActorExperienceCurve } from "@/project/types";
import { el } from "@/util/dom";
import { CURVE_PREVIEW_SAMPLES } from "@/editor/panels/databaseCurvePreview";

/**
 * 경험치 곡선 패널. 직업(`expCurve`)과 몬스터 종족(`expCurve`)이 같은 편집기를 공유한다 —
 * 레코드 타입에 결합하지 않도록 값 읽기/커밋만 주입받는다. testid 접두사는 호출부가 정한다.
 */
export type ExperienceCurvePanelOptions = Readonly<{
  testidPrefix: string;
  dialogLabel: string;
  readCurve: () => ActorExperienceCurve;
  onCommit: (curve: ActorExperienceCurve) => void;
  refresh: () => void;
}>;

export function renderExperienceCurvePanel(options: ExperienceCurvePanelOptions, host: HTMLElement): void {
  const curve = options.readCurve();
  const samples = previewSampleLevels().map((level) => Math.max(1, totalExpForLevel(curve, level)));
  host.replaceChildren(
    el("div", {
      class: "db-class-exp-summary",
      dataset: { testid: `${options.testidPrefix}-summary` },
      text: `기본=${curve.base}; 추가=${curve.extra}; 가속=${curve.acceleration}`,
    }),
    el("button", {
      class: "db-class-exp-graph",
      dataset: { testid: `${options.testidPrefix}-edit` },
      // 열 개수를 CSS 에 내려준다 — 막대 수와 그리드 열 수가 어긋나면 접혀서 뭉개진다.
      attrs: { type: "button", title: "경험치 곡선 설정", style: `--curve-samples:${samples.length}` },
      on: { click: () => openExperienceCurveDialog(options) },
      children: curveBars(samples),
    })
  );
}

function openExperienceCurveDialog(options: ExperienceCurvePanelOptions): void {
  const close = (): void => {
    unregisterModal(backdrop);
    backdrop.remove();
  };
  const prefix = options.testidPrefix;
  // 다이얼로그 안의 편집은 draft 에만 쌓는다 — "취소"가 진짜 취소가 되도록(P7).
  let draft: ActorExperienceCurve = { ...options.readCurve() };
  let view: "total" | "delta" = "total";
  const baseInput = dialogNumberInput(`${prefix}-base`, draft.base, 0, 999999);
  const extraInput = dialogNumberInput(`${prefix}-extra`, draft.extra, 0, 999999);
  const accelerationInput = dialogNumberInput(`${prefix}-acceleration`, draft.acceleration, 0, 999999);
  const table = el("div", { class: "db-class-exp-table" });
  const graph = el("div", { class: "db-class-exp-dialog-graph" });
  const totalTab = el("button", {
    class: "active",
    text: "누적 경험치",
    dataset: { testid: `${prefix}-tab-total` },
    attrs: { type: "button" },
    on: { click: () => setView("total") },
  });
  const deltaTab = el("button", {
    text: "다음 레벨까지",
    dataset: { testid: `${prefix}-tab-delta` },
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
    options.onCommit({ ...draft });
    options.refresh();
  };
  const backdrop = el("div", {
    class: "db-class-dialog-backdrop",
    dataset: { testid: `${prefix}-dialog` },
    children: [el("section", {
      class: "db-class-dialog db-class-exp-dialog",
      attrs: { role: "dialog", "aria-label": options.dialogLabel },
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
          el("button", { class: "btn", text: "OK", dataset: { testid: `${prefix}-close` }, attrs: { type: "button" }, on: { click: () => {
            commitDraft();
            close();
          } } }),
          el("button", { class: "btn", text: "취소", dataset: { testid: `${prefix}-cancel` }, attrs: { type: "button" }, on: { click: close } }),
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
  registerModal(backdrop, close);
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

// 인라인 스파크라인의 표본 수는 능력치 곡선과 같은 상수를 쓴다 — 예전에는 여기(33),
// actorRecordCurveEditors(33), databaseClassCurveEditors(33) 세 곳에 같은 숫자가 따로
// 박혀 있었고 CSS 열 개수(9)와도 어긋나 그래프가 뭉개졌다.
function previewSampleLevels(): number[] {
  const levels = new Set<number>();
  const steps = CURVE_PREVIEW_SAMPLES;
  for (let step = 0; step < steps; step += 1) {
    levels.add(1 + Math.round((step / (steps - 1)) * 98));
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
