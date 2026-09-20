import { combatConditionFields } from "@/editor/panels/databaseCombatConditionFields";
import { troopAuthoringPreview } from "@/battle/battleAuthoringPreview";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { numberField, selectField } from "@/editor/panels/databaseControls";
import { store } from "@/project/store";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { ActorRateGrade, EnemyActionPattern, TroopRecord } from "@/project/types/database";
import { el } from "@/util/dom";

export function troopIntentPanel(troop: TroopRecord, memberIndex: number): HTMLElement {
  const project = store.getCurrent();
  let actorId = project.database.actors[0]?.id ?? "";
  let turn = 1;
  let hpPercent = 100;
  let mpPercent = 100;
  let row: "front" | "back" = "front";
  const content = el("div", { dataset: { testid: "feature16-intent-content" } });
  const root = el("section", { class: "db-ws-readout", dataset: { testid: "feature16-intent-panel" }, children: [
    el("h4", { text: "행동 후보 · 약점 저작" }),
    el("p", { text: "가정한 전투 조건을 통과한 후보입니다. 실제 선택은 대상·효용·동률 난수에 따라 달라집니다. 수정은 이 적을 쓰는 모든 그룹에 적용됩니다. 피해는 명중·치명타·분산을 제외한 단일 타격 예상입니다." }),
    el("p", { dataset: { testid: "feature16-intent-context-note" }, text: "전투 중 상태를 관측한 결과가 아닙니다. 상태이상 없음 · 스위치는 프로젝트 시작값 · 생존 동료는 초기 배치 중 숨김과 자신을 제외한 수로 가정합니다." }),
  ] });
  const update = () => render();
  root.append(
    numberField("가정 턴", "feature16-intent-turn", turn, value => { turn = Math.max(1, Math.trunc(value) || 1); update(); }, { min: 1, max: 999 }),
    numberField("적 HP %", "feature16-intent-hp", hpPercent, value => { hpPercent = Math.max(0, Math.min(100, value)); update(); }, { min: 0, max: 100 }),
    numberField("적 MP %", "feature16-intent-mp", mpPercent, value => { mpPercent = Math.max(0, Math.min(100, value)); update(); }, { min: 0, max: 100 }),
    selectField("비교할 아군", "feature16-intent-actor", actorId, project.database.actors.map(a => ({ id: a.id, name: a.name })), value => { actorId = value; update(); }),
    selectField("비교 아군 열", "feature16-intent-row", row, [{ id: "front", name: "전열" }, { id: "back", name: "후열" }], value => { row = value === "back" ? "back" : "front"; update(); }), content,
  );
  function render() {
    const current = store.getCurrent();
    const liveTroop = current.database.troops.find(t => t.id === troop.id) ?? troop;
    const preview = troopAuthoringPreview(current, liveTroop, { memberIndex, actorId, turn, hpPercent, mpPercent, row });
    content.replaceChildren();
    if (!preview) { content.append(el("p", { text: "미리 볼 적을 추가하세요." })); return; }
    const enemyId = (liveTroop.members?.[memberIndex]?.enemyId ?? liveTroop.enemyIds?.[memberIndex]);
    const enemy = current.database.enemies.find(e => e.id === enemyId);
    if (!enemy) return;
    const mutateAction = (index: number, patch: Partial<EnemyActionPattern>, refresh = true) => {
      const latest = store.getCurrent().database.enemies.find(e => e.id === enemy.id);
      if (!latest) return;
      const actions = normalizeEnemyRecord(latest).actions.map((action, i) => i === index ? { ...action, ...patch } : action);
      updateDatabaseRecord("enemies", enemy.id, { actions });
      if (refresh) render();
      else {
        const next = troopAuthoringPreview(store.getCurrent(), liveTroop, { memberIndex, actorId, turn, hpPercent, mpPercent, row });
        for (const candidate of next?.actions ?? []) {
          const label = content.querySelector(`[data-testid="feature16-intent-prediction-${candidate.index}"]`);
          if (label) label.textContent = predictionText(candidate);
        }
      }
    };
    content.append(el("p", { text: `${preview.enemyName} · HP ${preview.hp}/${preview.maxHp} · 초기 생존 동료 ${preview.livingAllies} · MP ${preview.mp}/${preview.maxMp} · 대상 ${preview.actorName ?? "없음"}`, dataset: { testid: "feature16-intent-context" } }));
    for (const candidate of preview.actions) {
      const { index, action } = candidate;

      const block = el("div", { class: "db-ws-readout", dataset: { testid: `feature16-intent-action-${index}` }, children: [
        el("p", { text: predictionText(candidate), dataset: { testid: `feature16-intent-prediction-${index}` } }),
        selectField("행동", `feature16-intent-skill-${index}`, action.skillId, [{ id: "", name: "일반 공격" }, ...current.database.skills.map(s => ({ id: s.id, name: s.name }))], skillId => mutateAction(index, { skillId })),
        numberField("선택 우선도", `feature16-intent-priority-${index}`, action.priority, priority => mutateAction(index, { priority }, false), { min: 1, max: 100 }),
        intentConditionFields(action, index, condition => mutateAction(index, { condition }, false)),
      ] });
      block.append(el("button", { text: "이 행동 삭제", class: "db-ws-btn", attrs: { type: "button" }, dataset: { testid: `feature16-intent-remove-${index}` }, on: { click: () => {
        const latest = store.getCurrent().database.enemies.find(e => e.id === enemy.id)!;
        updateDatabaseRecord("enemies", enemy.id, { actions: normalizeEnemyRecord(latest).actions.filter((_, i) => i !== index) }); render();
      } } }));
      content.append(block);
    }
    if (!preview.actions.length) content.append(el("p", { text: "저작된 행동 없음 · 런타임 기본 행동으로 대체됩니다." }));
    content.append(el("button", { text: "행동 추가", class: "db-ws-btn", attrs: { type: "button" }, dataset: { testid: "feature16-intent-add" }, on: { click: () => {
      const latest = store.getCurrent().database.enemies.find(e => e.id === enemy.id)!;
      updateDatabaseRecord("enemies", enemy.id, { actions: [...normalizeEnemyRecord(latest).actions, { skillId: "", priority: 1, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }] }); render();
    } } }));
    content.append(el("h4", { text: "받는 속성 배율" }));
    if (current.system.battleModel === "gen1") content.append(el("p", { text: "포켓몬식은 종족 타입 상성 사용. 아래 등급은 RM식 전투용이며 현재 배율을 변경하지 않습니다." }));
    for (const element of preview.elements) content.append(selectField(
      `${element.name} · ${element.multiplier < 0 ? "흡수" : element.multiplier === 0 ? "무효" : element.multiplier > 1 ? "약점" : element.multiplier < 1 ? "내성" : "보통"} ×${element.multiplier}`,
      `feature16-intent-element-${element.id}`, element.grade ?? "", [{ id: "", name: "미지정" }, ...["A", "B", "C", "D", "E"].map(id => ({ id, name: id }))], grade => {
        const latest = store.getCurrent().database.enemies.find(e => e.id === enemy.id)!;
        const elementRates = { ...latest.elementRates };
        if (grade) elementRates[element.id] = grade as ActorRateGrade; else delete elementRates[element.id];
        updateDatabaseRecord("enemies", enemy.id, { elementRates }); render();
      },
    ));
  }
  render();
  return root;
}

function predictionText(candidate: { name: string; reason?: string; damage?: number }): string {
  return `${candidate.name} · ${candidate.reason ?? "조건 통과"}${candidate.damage === undefined ? "" : ` · 예상 피해 ${candidate.damage}`}`;
}

/** Preserve capture selectors while using the shared editor for every condition variant. */
function intentConditionFields(action: EnemyActionPattern, index: number, onChange: (condition: EnemyActionPattern["condition"]) => void): HTMLElement {
  const id = `feature16-intent-rule-${index}`;
  let condition = action.condition;
  const fields = combatConditionFields(condition, id, next => { condition = next; onChange(next); });
  const aliasSelectors = () => {
    const kind = fields.querySelector<HTMLElement>(`[data-testid="${id}-kind"]`);
    if (kind) kind.dataset.testid = `feature16-intent-condition-${index}`;
    if (condition.kind !== "turn") return;
    const start = fields.querySelector<HTMLElement>(`[data-testid="${id}-min"]`);
    const interval = fields.querySelector<HTMLElement>(`[data-testid="${id}-max"]`);
    if (start) start.dataset.testid = `feature16-intent-start-${index}`;
    if (interval) interval.dataset.testid = `feature16-intent-interval-${index}`;
  };
  // Shared kind changes synchronously rebuild their fields before this bubbling listener.
  fields.addEventListener("change", aliasSelectors);
  aliasSelectors();
  return fields;
}
