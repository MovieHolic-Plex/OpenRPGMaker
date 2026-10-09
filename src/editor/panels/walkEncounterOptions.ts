import type { WalkEncounterChoice, WalkEncounterDraft } from "@/editor/walkEncounterAuthoring";
import { store } from "@/project/store";
import { SEASONS, TIME_PHASES } from "@/project/gameTime";
import type { TroopRecord } from "@/project/types";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
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
  const troop = db.troops.find((record) => record.id === choice.id);
  return troop ? troop.name.trim() || troop.id : `${choice.id} (없음)`;
}

// Members are the authored formation; never infer a single-enemy encounter.
export function walkGroupComposition(troop: TroopRecord): HTMLElement {
  const project = store.getCurrent();
  const counts = new Map<string, { count: number; hidden: number }>();
  const members = troop.members ?? troop.enemyIds.map((enemyId) => ({ enemyId, hidden: false }));
  for (const member of members) {
    const entry = counts.get(member.enemyId) ?? { count: 0, hidden: 0 };
    entry.count += 1;
    if (member.hidden) entry.hidden += 1;
    counts.set(member.enemyId, entry);
  }
  const strip = el("div", { class: "walk-encounter-composition" });
  for (const [id, count] of counts) {
    const enemy = project.database.enemies.find((record) => record.id === id);
    const item = el("span", { class: "walk-encounter-member", dataset: { enemyId: id, count: String(count.count), hiddenCount: String(count.hidden) } });
    if (enemy) {
      const art = recordListThumbnail("enemies", enemy, project);
      if (art) { art.setAttribute("aria-hidden", "true"); item.append(art); }
    }
    item.append(el("span", { text: `${enemy?.name || id} ×${count.count}${count.hidden ? ` (숨김 ${count.hidden})` : ""}` }));
    strip.append(item);
  }
  if (!counts.size) strip.append(el("span", { text: "구성원 없음" }));
  return strip;
}

export function renderWalkEncounterOptions(draft: WalkEncounterDraft, refreshChoices: () => void, editGroup: (id?: string) => void, replaceGroup: (index: number) => void): HTMLElement {
  const worksheet = el("div", { class: "walk-encounter-worksheet", dataset: { testid: "walk-encounter-worksheet" } });
  const project = store.getCurrent();
  const shares: HTMLElement[] = [];
  const updateShares = (): void => {
    const valid = draft.choices.every((choice) => Number.isInteger(choice.weight) && choice.weight >= 1 && choice.weight <= 999);
    const total = draft.choices.reduce((sum, choice) => sum + choice.weight, 0);
    shares.forEach((share, index) => {
      share.textContent = valid ? `${Number((draft.choices[index]!.weight / total * 100).toFixed(1))}%` : "—";
    });
  };
  for (const [index, choice] of draft.choices.entries()) {
    const troop = project.database.troops.find((record) => record.id === choice.id);
    const section = el("section", { class: "walk-encounter-rule", attrs: { "aria-label": walkChoiceName(choice) }, dataset: { testid: `walk-encounter-row-${index}` } });
    const identity = el("div", { class: "walk-encounter-identity", children: [el("strong", { text: walkChoiceName(choice) })] });
    if (troop) identity.append(walkGroupComposition(troop));
    else identity.append(el("p", { class: "walk-encounter-missing", text: "그룹을 찾을 수 없습니다. 다른 그룹으로 바꾸거나 이 행을 제외해 주세요." }));
    const weight = el("input", { attrs: { type: "number", min: "1", max: "999", step: "1" }, value: choice.weight,
      dataset: { testid: `walk-encounter-weight-${index}` } });
    weight.addEventListener("input", () => { choice.weight = weight.valueAsNumber; updateShares(); });
    const share = el("output", { class: "walk-encounter-share", attrs: { "aria-label": "선택 목록 내 상대 비율", "aria-live": "polite" }, dataset: { testid: `walk-encounter-share-${index}` } });
    shares.push(share);
    const weightField = walkField("비중", weight);
    weightField.classList.add("walk-encounter-weight");
    const shareField = el("div", { class: "walk-encounter-field", children: [el("span", { text: "상대 비율" }), share] });
    const actions = el("div", { class: "walk-encounter-actions", children: [
      el("button", { class: "btn", text: troop ? "그룹 편집" : "그룹 바꾸기", attrs: { type: "button" }, dataset: { testid: `walk-encounter-edit-group-${index}` }, on: { click: () => troop ? editGroup(choice.id) : replaceGroup(index) } }),
      el("button", { class: "btn", text: "제외", attrs: { type: "button", "aria-label": `${walkChoiceName(choice)} 제외` }, dataset: { testid: `walk-encounter-remove-${index}` }, on: { click: () => { draft.choices.splice(index, 1); refreshChoices(); } } }),
    ] });
    section.append(el("div", { class: "walk-encounter-row-main", children: [identity, weightField, shareField, actions] }));
    const details = el("details", { class: "walk-encounter-conditions", dataset: { testid: `walk-encounter-conditions-${index}` } });
    const summary = el("summary", { text: Object.values(choice.conditions).some((value) => value !== undefined) ? "출현 조건 · 설정됨" : "출현 조건 · 항상" });
    const grid = el("div", { class: "walk-encounter-options-grid" });
    const number = (label: string, value: number | undefined, update: (value: number | undefined) => void, key: string, min?: number): void => {
      const input = el("input", { attrs: { type: "number", step: "1", ...(min !== undefined ? { min: String(min) } : {}) }, value: value ?? "",
        dataset: { testid: `walk-encounter-${key}-${index}` } });
      input.addEventListener("input", () => update(input.value === "" ? undefined : input.valueAsNumber));
      grid.append(walkField(label, input));
    };
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

    const updateSummary = (): void => { summary.textContent = Object.values(c).some((value) => value !== undefined) ? "출현 조건 · 설정됨" : "출현 조건 · 항상"; };
    grid.addEventListener("input", updateSummary);
    grid.addEventListener("change", updateSummary);
    details.append(summary, grid, el("p", { class: "walk-encounter-help", text: "시간·계절 조건은 게임 시간 설정을 따릅니다." }));
    section.append(details);
    worksheet.append(section);
  }
  if (!draft.choices.length) worksheet.append(el("div", { class: "walk-encounter-empty", text: "아직 선택한 그룹이 없습니다. 함께 등장할 적 구성을 그룹으로 추가하세요." }));
  updateShares();
  return worksheet;
}
