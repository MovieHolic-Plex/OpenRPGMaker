import { combatConditionFields } from "@/editor/panels/databaseCombatConditionFields";
import { troopAuthoringPreview } from "@/battle/battleAuthoringPreview";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { numberField, selectField } from "@/editor/panels/databaseControls";
import { store } from "@/project/store";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { Project } from "@/project/types";
import type { ActorRateGrade, EnemyActionPattern, TroopRecord } from "@/project/types/database";
import { el } from "@/util/dom";

// 적 그룹 탭 「밸런스」 구획의 행동 후보·받는 속성 배율 편집기.
//
// 예전 루트는 `.db-ws-readout` 클래스를 달고 있었다. 그 클래스는 숫자 한 개를 크게 보여 주는
// 판독 칸(`font: 700 15px/1 var(--font-mono)`, workspace-modern.css)이라 패널 전체와 행동 블록이
// 고정폭 굵은 글꼴로 그려졌다 — 이 탭 전용 클래스로 바꿔 그 규칙을 받지 않는다.
export function troopIntentPanel(troop: TroopRecord, memberIndex: number): HTMLElement {
  const project = store.getCurrent();
  let actorId = project.database.actors[0]?.id ?? "";
  let turn = 1;
  let hpPercent = 100;
  let mpPercent = 100;
  let row: "front" | "back" = "front";
  const content = el("div", { class: "db-troop-intent-content", dataset: { testid: "feature16-intent-content" } });
  const elementsHost = el("div", { class: "db-troop-intent-elements", dataset: { testid: "feature16-intent-elements" } });
  const update = () => render();
  // 가정·면책 문단은 접어 둔다. 예전에는 네 줄짜리 설명이 맨 위에 펼쳐져 있었고, 정작 중요한
  // "여기서 고치면 모든 그룹이 바뀐다"는 사실이 그 문단 한가운데 묻혀 있었다 — 그 경고는
  // 편집 행 바로 위(render 안)로 꺼낸다.
  const assumptions = el("details", {
    class: "db-troop-intent-assumptions",
    dataset: { testid: "feature16-intent-assumptions" },
    children: [
      el("summary", { class: "db-troop-intent-assumptions-summary", text: "ⓘ 가정한 조건" }),
      el("p", { class: "db-troop-intent-note", text: "가정한 전투 조건을 통과한 후보입니다. 실제 선택은 대상·효용·동률 난수에 따라 달라집니다. 피해는 명중·치명타·분산을 제외하고 타격 배율을 합산한 예상입니다." }),
      el("p", { class: "db-troop-intent-note", dataset: { testid: "feature16-intent-context-note" }, text: "전투 중 상태를 관측한 결과가 아닙니다. 상태이상 없음 · 스위치는 프로젝트 시작값 · 생존 동료는 초기 배치 중 숨김과 자신을 제외한 수로 가정합니다." }),
      el("div", {
        class: "db-troop-intent-assumption-fields",
        children: [
          numberField("가정 턴", "feature16-intent-turn", turn, value => { turn = Math.max(1, Math.trunc(value) || 1); update(); }, { min: 1, max: 999 }),
          numberField("적 HP %", "feature16-intent-hp", hpPercent, value => { hpPercent = Math.max(0, Math.min(100, value)); update(); }, { min: 0, max: 100 }),
          numberField("적 MP %", "feature16-intent-mp", mpPercent, value => { mpPercent = Math.max(0, Math.min(100, value)); update(); }, { min: 0, max: 100 }),
          selectField("비교할 아군", "feature16-intent-actor", actorId, project.database.actors.map(a => ({ id: a.id, name: a.name })), value => { actorId = value; update(); }),
          selectField("비교 아군 열", "feature16-intent-row", row, [{ id: "front", name: "전열" }, { id: "back", name: "후열" }], value => { row = value === "back" ? "back" : "front"; update(); }),
        ],
      }),
    ],
  });
  const root = el("section", { class: "db-troop-intent-panel", dataset: { testid: "feature16-intent-panel" }, children: [
    el("header", { class: "db-troop-intent-head", children: [
      el("h4", { class: "db-troop-intent-title", text: "행동 후보" }),
      el("span", { class: "db-troop-intent-hint", text: "선택한 적이 이 조건에서 고를 수 있는 행동입니다." }),
      assumptions,
    ] }),
    content,
    elementsHost,
  ] });
  function render() {
    const current = store.getCurrent();
    const liveTroop = current.database.troops.find(t => t.id === troop.id) ?? troop;
    const preview = troopAuthoringPreview(current, liveTroop, { memberIndex, actorId, turn, hpPercent, mpPercent, row });
    content.replaceChildren();
    elementsHost.replaceChildren();
    if (!preview) { content.append(el("p", { class: "db-troop-intent-empty", text: "미리 볼 적을 추가하세요." })); return; }
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
    content.append(el("p", { class: "db-troop-intent-context", text: `${preview.enemyName} · HP ${preview.hp}/${preview.maxHp} · 초기 생존 동료 ${preview.livingAllies} · MP ${preview.mp}/${preview.maxMp} · 대상 ${preview.actorName ?? "없음"}`, dataset: { testid: "feature16-intent-context" } }));
    content.append(sharedEditWarning(current, enemy.id, enemy.name));
    for (const candidate of preview.actions) {
      const { index, action } = candidate;

      const block = el("div", { class: "db-troop-intent-action", dataset: { testid: `feature16-intent-action-${index}` }, children: [
        el("p", { class: "db-troop-intent-prediction", text: predictionText(candidate), dataset: { testid: `feature16-intent-prediction-${index}` } }),
        selectField("행동", `feature16-intent-skill-${index}`, action.skillId, [{ id: "", name: "일반 공격" }, ...current.database.skills.map(s => ({ id: s.id, name: s.name }))], skillId => mutateAction(index, { skillId })),
        numberField("선택 우선도", `feature16-intent-priority-${index}`, action.priority, priority => mutateAction(index, { priority }, false), { min: 1, max: 100 }),
        intentConditionFields(action, index, condition => mutateAction(index, { condition }, false)),
      ] });
      block.append(el("button", { text: "이 행동 삭제", class: "db-ws-btn db-ws-btn-ghost db-troop-intent-remove", attrs: { type: "button" }, dataset: { testid: `feature16-intent-remove-${index}` }, on: { click: () => {
        const latest = store.getCurrent().database.enemies.find(e => e.id === enemy.id)!;
        updateDatabaseRecord("enemies", enemy.id, { actions: normalizeEnemyRecord(latest).actions.filter((_, i) => i !== index) }); render();
      } } }));
      content.append(block);
    }
    if (!preview.actions.length) content.append(el("p", { class: "db-troop-intent-empty", text: "저작된 행동 없음 · 런타임 기본 행동으로 대체됩니다." }));
    content.append(el("button", { text: "＋ 행동 추가", class: "db-ws-btn db-ws-btn-ghost db-troop-intent-add", attrs: { type: "button" }, dataset: { testid: "feature16-intent-add" }, on: { click: () => {
      const latest = store.getCurrent().database.enemies.find(e => e.id === enemy.id)!;
      updateDatabaseRecord("enemies", enemy.id, { actions: [...normalizeEnemyRecord(latest).actions, { skillId: "", priority: 1, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }] }); render();
    } } }));
    elementsHost.append(el("h4", { class: "db-troop-intent-title", text: "받는 속성 배율" }));
    if (current.system.battleModel === "gen1") elementsHost.append(el("p", { class: "db-troop-intent-note", text: "포켓몬식은 종족 타입 상성 사용. 아래 등급은 RM식 전투용이며 현재 배율을 변경하지 않습니다." }));
    const rates = el("div", { class: "db-troop-intent-rate-grid" });
    elementsHost.append(rates);
    for (const element of preview.elements) rates.append(selectField(
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

/** 여기서의 행동·배율 편집은 적 레코드를 고친다 — 같은 적을 쓰는 다른 그룹도 함께 바뀐다는 사실을 편집 행 바로 위에 둔다. */
function sharedEditWarning(project: Project, enemyId: string, enemyName: string): HTMLElement {
  const usage = project.database.troops.filter(t => (t.members?.length ? t.members.map(m => m.enemyId) : t.enemyIds ?? []).includes(enemyId)).length;
  return el("p", {
    class: "db-troop-intent-shared-warning",
    attrs: { role: "note" },
    dataset: { testid: "feature16-intent-shared-warning" },
    text: `여기서 고치면 이 적(${enemyName})을 쓰는 모든 그룹이 바뀝니다${usage > 0 ? ` · 현재 ${usage}곳` : ""}`,
  });
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
