import { ACTOR_PARAMETER_KEYS, parameterValueAtLevel } from "@/project/actorModel";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import type { ActorParameterKey, ClassRecord } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { curvePreviewGraph } from "@/editor/panels/databaseCurvePreview";

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
        curvePreviewGraph("db-class-curve-graph", curve, currentLevel),
      ],
    });
  });
}

function openClassParameterDialog(record: ClassRecord, initialKey: ActorParameterKey, refresh: () => void = () => undefined): void {
  let activeKey = initialKey;
  let activeLevel = lastEditedParameterLevel(record.id, initialKey);
  // 다이얼로그 안의 편집은 store 가 아니라 draft(사본)에 쌓는다 — "취소"가 진짜 취소가
  // 되도록(P7). OK/적용을 눌러야만 store 에 커밋된다.
  let draft = cloneParameterCurves(currentClassParameterCurves(record));
  const close = (): void => {
    unregisterModal(backdrop);
    backdrop.remove();
  };
  const levelInput = dialogNumberInput("db-class-parameter-level", activeLevel, 1, 99);
  const valueInput = dialogNumberInput("db-class-parameter-value", parameterValueAtLevel(draft[activeKey], activeLevel), 1, 99999);
  const valueLabel = el("span", { text: PARAMETER_LABELS[activeKey] });
  const graph = el("div", { class: "db-class-curve-dialog-graph" });
  const tabs = el("div", { class: "db-class-curve-tabs" });

  const syncValueInput = (): void => {
    valueLabel.textContent = PARAMETER_LABELS[activeKey];
    valueInput.value = String(parameterValueAtLevel(draft[activeKey], activeLevel));
  };
  const renderGraph = (): void => {
    const curve = draft[activeKey];
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
  // 레벨/값 입력을 draft 에 반영(스토어 커밋 아님).
  const applyValueToDraft = (): void => {
    const rawLevel = dialogInputNumber(levelInput);
    const rawValue = dialogInputNumber(valueInput);
    // 빈 칸·NaN 을 min 으로 폴백하면 **보던 값이 Lv1 에 기록되고 원래 Lv1 이 파괴된다.**
    // (레벨을 비우고 적용 → clampDialogInteger(NaN,1,99) === 1) 유효하지 않은 입력은
    // 커밋 대상이 아니다 — 마지막 유효 상태로 되돌리고 이유를 알린다.
    if (!Number.isFinite(rawLevel) || !Number.isFinite(rawValue)) {
      levelInput.value = String(activeLevel);
      syncValueInput();
      toast("레벨과 값은 숫자로 입력하세요. 마지막 값으로 되돌렸습니다.", "error");
      return;
    }
    activeLevel = clampDialogInteger(rawLevel, 1, 99);
    const value = clampDialogInteger(rawValue, 1, 99999);
    const nextCurve = draft[activeKey].slice();
    nextCurve[activeLevel - 1] = value;
    draft = { ...draft, [activeKey]: nextCurve };
    levelInput.value = String(activeLevel);
    valueInput.value = String(value);
    renderGraph();
  };
  const applyPreset = (preset: ClassCurvePreset): void => {
    draft = { ...draft, [activeKey]: presetCurve(draft[activeKey], preset) };
    syncValueInput();
    renderGraph();
  };
  // draft 전체를 store 에 커밋하고 요약 카드(refresh)를 갱신.
  const commitDraft = (): void => {
    applyValueToDraft();
    updateDatabaseRecord("classes", record.id, { parameterCurves: cloneParameterCurves(draft) });
    setLastEditedParameterLevel(record.id, activeKey, activeLevel);
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
            el("button", { class: "btn", text: "적용", dataset: { testid: "db-class-parameter-apply" }, attrs: { type: "button" }, on: { click: commitDraft } }),
            panel("간단 설정", [
              presetButton("천재형", () => applyPreset("genius")),
              presetButton("우수형", () => applyPreset("superior")),
              presetButton("표준형", () => applyPreset("standard")),
              presetButton("열등형", () => applyPreset("inferior")),
            ]),
          ] }),
        ] }),
        el("footer", { children: [
          el("button", { class: "btn", text: "OK", dataset: { testid: "db-class-parameter-close" }, attrs: { type: "button" }, on: { click: () => {
            commitDraft();
            close();
          } } }),
          el("button", { class: "btn", text: "취소", dataset: { testid: "db-class-parameter-cancel" }, attrs: { type: "button" }, on: { click: close } }),
        ] }),
      ],
    })],
  });
  levelInput.addEventListener("change", () => {
    activeLevel = clampDialogInteger(dialogInputNumber(levelInput), 1, 99);
    levelInput.value = String(activeLevel);
    syncValueInput();
    renderGraph();
  });
  valueInput.addEventListener("change", applyValueToDraft);
  renderTabs();
  renderGraph();
  document.body.append(backdrop);
  registerModal(backdrop, close);
}

type ClassCurvePreset = "genius" | "superior" | "standard" | "inferior";

function currentClassParameterCurves(record: ClassRecord): ClassRecord["parameterCurves"] {
  return store.getCurrent().database.classes.find((entry) => entry.id === record.id)?.parameterCurves ?? record.parameterCurves;
}

function cloneParameterCurves(curves: ClassRecord["parameterCurves"]): ClassRecord["parameterCurves"] {
  return {
    maxHp: curves.maxHp.slice(),
    maxMp: curves.maxMp.slice(),
    attack: curves.attack.slice(),
    defense: curves.defense.slice(),
    mind: curves.mind.slice(),
    agility: curves.agility.slice(),
  };
}

// valueAsNumber 는 fake DOM 테스트 환경에 없다 — value 문자열 기반으로 통일.
function dialogInputNumber(input: HTMLInputElement): number {
  return input.value.trim() === "" ? Number.NaN : Number(input.value);
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

function dialogNumberInput(testid: string, value: number, min: number, max: number): HTMLInputElement {
  const input = el("input", { dataset: { testid }, attrs: { type: "number", min: String(min), max: String(max), value: String(value) } }) as HTMLInputElement;
  input.value = String(value);
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
