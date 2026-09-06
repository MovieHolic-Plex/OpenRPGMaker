import type { WalkEncounterChoice, WalkEncounterDraft } from "@/editor/walkEncounterAuthoring";
import { store } from "@/project/store";
import { SEASONS, TIME_PHASES } from "@/project/gameTime";
import { el } from "@/util/dom";

export function walkField(label: string, control: HTMLElement): HTMLElement {
  control.setAttribute("aria-label", label);
  return el("label", { class: "walk-encounter-field", children: [el("span", { text: label }), control] });
}

export function walkSelect(options: readonly { readonly id: string; readonly name: string }[], value: string, change: (value: string) => void): HTMLSelectElement {
  const select = el("select", { class: "walk-encounter-native-select" });
  for (const item of options) select.append(el("option", { text: item.name.trim() || `이름 없음 (${item.id})`, attrs: { value: item.id } }));
  if (value && !options.some((item) => item.id === value)) select.append(el("option", { text: `${value} (없음)`, attrs: { value } }));
  select.value = value;
  select.addEventListener("change", () => change(select.value));
  return select;
}

export function walkChoiceName(choice: WalkEncounterChoice): string {
  const db = store.getCurrent().database;
  return (choice.kind === "enemy" ? db.enemies : db.troops).find((record) => record.id === choice.id)?.name ?? `${choice.id} (없음)`;
}

export function renderWalkEncounterOptions(draft: WalkEncounterDraft, refreshChoices: () => void): HTMLDetailsElement {
  const advanced = el("details", { class: "walk-encounter-advanced", dataset: { testid: "walk-encounter-advanced" } });
  advanced.append(el("summary", { text: "고급 설정 · 비중과 출현 조건" }));
  advanced.append(el("p", { class: "walk-encounter-help", text: "비중 2인 적은 1인 적보다 두 배 자주 뽑힙니다. 겹친 범위와 맵 전체 규칙도 함께 뽑힙니다." }));
  const project = store.getCurrent();
  const troopSelect = walkSelect([{ id: "", name: "기존 적 그룹 고르기" }, ...project.database.troops], "", () => undefined);
  troopSelect.dataset.testid = "walk-encounter-troop";
  const add = el("button", { class: "btn", text: "그룹 추가", attrs: { type: "button" }, on: { click: () => {
    if (!troopSelect.value) return;
    draft.choices.push({ kind: "troop", id: troopSelect.value, weight: 1, conditions: {} });
    refreshChoices();
  } } });
  advanced.append(el("div", { class: "walk-encounter-actions", children: [walkField("여러 적이 함께 나오는 그룹", troopSelect), add] }));
  for (const [index, choice] of draft.choices.entries()) {
    const section = el("fieldset", { class: "walk-encounter-rule" });
    section.append(el("legend", { text: walkChoiceName(choice) }));
    const grid = el("div", { class: "walk-encounter-options-grid" });
    const number = (label: string, value: number | undefined, update: (value: number | undefined) => void, key: string, min?: number): void => {
      const input = el("input", { attrs: { type: "number", step: "1", ...(min !== undefined ? { min: String(min) } : {}) }, value: value ?? "",
        dataset: { testid: `walk-encounter-${key}-${index}` } });
      input.addEventListener("input", () => update(input.value === "" ? undefined : input.valueAsNumber));
      grid.append(walkField(label, input));
    };
    number("상대 비중", choice.weight, (value) => { choice.weight = value ?? 0; }, "weight", 1);
    const c = choice.conditions;
    grid.append(walkField("이 스위치가 켜졌을 때", walkSelect([{ id: "", name: "조건 없음" }, ...project.switches], c.switchId ?? "", (value) => { c.switchId = value || undefined; })));
    grid.append(walkField("이 변수의 값이 기준 이상", walkSelect([{ id: "", name: "조건 없음" }, ...project.variables], c.variableId ?? "", (value) => { c.variableId = value || undefined; })));
    number("변수 기준값", c.atLeast, (value) => { c.atLeast = value; }, "threshold");
    number("파티 최고 레벨 · 최소", c.minPartyLevel, (value) => { c.minPartyLevel = value; }, "min-level", 1);
    number("파티 최고 레벨 · 최대", c.maxPartyLevel, (value) => { c.maxPartyLevel = value; }, "max-level", 1);
    const phaseNames = { morning: "아침", day: "낮", evening: "저녁", night: "밤" };
    const seasonNames = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };
    grid.append(walkField("시간대", walkSelect([{ id: "", name: "언제나" }, ...TIME_PHASES.map((id) => ({ id, name: phaseNames[id] }))], c.timePhase ?? "", (value) => { c.timePhase = TIME_PHASES.find((phase) => phase === value); })));
    grid.append(walkField("계절", walkSelect([{ id: "", name: "언제나" }, ...SEASONS.map((id) => ({ id, name: seasonNames[id] }))], c.season ?? "", (value) => { c.season = SEASONS.find((season) => season === value); })));
    section.append(grid, el("button", { class: "btn", text: "이 적 제외", attrs: { type: "button" },
      dataset: { testid: `walk-encounter-remove-${index}` }, on: { click: () => { draft.choices.splice(index, 1); refreshChoices(); } } }));
    advanced.append(section);
  }
  advanced.append(el("p", { class: "walk-encounter-help", text: "시간·계절 조건은 게임 시간 설정이 있어야 맞습니다. 통행 불가 칸에서는 걸을 수 없고, 지형 설정이 빈도를 바꿀 수 있습니다." }));
  return advanced;
}
