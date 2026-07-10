import { ACTOR_PARAMETER_KEYS, parameterValueAtLevel, totalExpForLevel } from "@/project/actorModel";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { ActorParameterKey, ActorRecord } from "@/project/types";
import { el } from "@/util/dom";
// 주인공 곡선 에디터 전용 CSS — 데스크톱(≥901px)에서 display:none 으로 사라진 곡선 컬럼 복원
// + 다이얼로그 스타일을 모든 화면 폭에서 제공(qa-actors Critical). A 배치의 파일과 충돌하지
// 않도록 curve* 계열 신규 파일로 분리하고 TS 에서 직접 로드한다.
import "@/styles/database/curve-editors.css";

const PARAMETER_LABELS: Record<ActorParameterKey, string> = {
  maxHp: "최대 HP",
  maxMp: "최대 MP",
  attack: "공격력",
  defense: "방어력",
  mind: "정신력",
  agility: "민첩성",
};

const LAST_ACTOR_PARAMETER_LEVELS = new Map<string, number>();

// 곡선 카드 6장 — 다이얼로그가 닫히거나 커밋될 때 카드 요약이 즉시 갱신되도록
// 카드 스스로를 다시 그리는 refreshAll 을 다이얼로그에 전달한다(P7: 요약 미갱신).
export function actorCurveCards(actor: ActorRecord): HTMLElement[] {
  const renderers: (() => void)[] = [];
  const refreshAll = (): void => renderers.forEach((render) => render());
  return ACTOR_PARAMETER_KEYS.map((key) => {
    const card = el("button", {
      class: `actor-curve actor-curve-${key}`,
      dataset: { testid: `db-actor-curve-edit-${key}` },
      attrs: { type: "button", title: `${PARAMETER_LABELS[key]} 곡선 설정` },
      on: { click: () => openActorParameterDialog(actor, key, refreshAll) },
    });
    const render = (): void => {
      const curve = currentActorParameterCurves(actor)[key];
      const currentLevel = lastEditedParameterLevel(actor.id, key);
      card.replaceChildren(
        el("strong", { text: PARAMETER_LABELS[key] }),
        el("span", { text: `Lv${currentLevel}:${parameterValueAtLevel(curve, currentLevel)}` }),
        el("div", { class: "actor-curve-graph", children: curveBars(curve, currentLevel) })
      );
    };
    renderers.push(render);
    render();
    return card;
  });
}

export function actorExperiencePanel(actor: ActorRecord): HTMLElement[] {
  const summary = el("span", { dataset: { testid: "db-actor-exp-summary" } });
  const lv99 = el("span");
  const render = (): void => {
    const curve = currentActorExpCurve(actor);
    summary.textContent = `기본=${curve.base}; 추가=${curve.extra}; 가속=${curve.acceleration}`;
    lv99.textContent = `Lv99 ${totalExpForLevel(curve, 99).toLocaleString()}`;
  };
  render();
  return [
    el("div", {
      class: "actor-exp-row",
      children: [
        summary,
        lv99,
        el("button", {
          class: "btn small",
          text: "설정",
          dataset: { testid: "db-actor-exp-edit" },
          attrs: { type: "button" },
          on: { click: () => openActorExperienceDialog(actor, render) },
        }),
      ],
    }),
  ];
}

function openActorParameterDialog(actor: ActorRecord, initialKey: ActorParameterKey, refresh: () => void = () => undefined): void {
  let activeKey = initialKey;
  let activeLevel = lastEditedParameterLevel(actor.id, initialKey);
  // 다이얼로그 안의 편집은 draft 에만 쌓는다 — "취소"가 진짜 취소가 되도록(P7).
  let draft = cloneParameterCurves(currentActorParameterCurves(actor));
  const close = (): void => backdrop.remove();
  const levelInput = dialogNumberInput("db-actor-parameter-level", activeLevel, 1, 99);
  const valueInput = dialogNumberInput("db-actor-parameter-value", parameterValueAtLevel(draft[activeKey], activeLevel), 1, 99999);
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
  const applyValueToDraft = (): void => {
    activeLevel = clampDialogInteger(dialogInputNumber(levelInput), 1, 99);
    const value = clampDialogInteger(dialogInputNumber(valueInput), 1, 99999);
    const nextCurve = draft[activeKey].slice();
    nextCurve[activeLevel - 1] = value;
    draft = { ...draft, [activeKey]: nextCurve };
    levelInput.value = String(activeLevel);
    valueInput.value = String(value);
    renderGraph();
  };
  const commitDraft = (): void => {
    applyValueToDraft();
    updateDatabaseRecord("actors", actor.id, { parameterCurves: cloneParameterCurves(draft) });
    setLastEditedParameterLevel(actor.id, activeKey, activeLevel);
    refresh();
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
            el("button", { class: "btn", text: "적용", dataset: { testid: "db-actor-parameter-apply" }, attrs: { type: "button" }, on: { click: commitDraft } }),
          ] }),
        ] }),
        el("footer", { children: [
          el("button", { class: "btn", text: "OK", dataset: { testid: "db-actor-parameter-close" }, attrs: { type: "button" }, on: { click: () => {
            commitDraft();
            close();
          } } }),
          el("button", { class: "btn", text: "취소", dataset: { testid: "db-actor-parameter-cancel" }, attrs: { type: "button" }, on: { click: close } }),
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
}

function openActorExperienceDialog(actor: ActorRecord, refresh: () => void = () => undefined): void {
  const close = (): void => backdrop.remove();
  // draft 분리 — 취소 시 폐기(P7).
  let draft: ActorRecord["expCurve"] = { ...currentActorExpCurve(actor) };
  const baseInput = dialogNumberInput("db-actor-exp-base", draft.base, 0, 999999);
  const extraInput = dialogNumberInput("db-actor-exp-extra", draft.extra, 0, 999999);
  const accelerationInput = dialogNumberInput("db-actor-exp-acceleration", draft.acceleration, 0, 999999);
  const table = el("div", { class: "db-class-exp-table" });
  const graph = el("div", { class: "db-class-exp-dialog-graph" });
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
    const values = Array.from({ length: 99 }, (_, index) => totalExpForLevel(draft, index + 1));
    table.replaceChildren(...values.map((value, index) => el("span", { text: `L${String(index + 1).padStart(2, " ")}: ${value.toLocaleString()}` })));
    graph.replaceChildren(...values.map((value) => el("i", { attrs: { style: `height:${curveHeight(value, values)}%` } })));
  };
  const commitDraft = (): void => {
    readDraftFromInputs();
    updateDatabaseRecord("actors", actor.id, { expCurve: { ...draft } });
    refresh();
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
            commitDraft();
            close();
          } } }),
          el("button", { class: "btn", text: "취소", dataset: { testid: "db-actor-exp-cancel" }, attrs: { type: "button" }, on: { click: close } }),
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

function currentActorParameterCurves(actor: ActorRecord): ActorRecord["parameterCurves"] {
  return store.getCurrent().database.actors.find((entry) => entry.id === actor.id)?.parameterCurves ?? actor.parameterCurves;
}

function currentActorExpCurve(actor: ActorRecord): ActorRecord["expCurve"] {
  return store.getCurrent().database.actors.find((entry) => entry.id === actor.id)?.expCurve ?? actor.expCurve;
}

function cloneParameterCurves(curves: ActorRecord["parameterCurves"]): ActorRecord["parameterCurves"] {
  return {
    maxHp: curves.maxHp.slice(),
    maxMp: curves.maxMp.slice(),
    attack: curves.attack.slice(),
    defense: curves.defense.slice(),
    mind: curves.mind.slice(),
    agility: curves.agility.slice(),
  };
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
