import { updateDatabaseRecord } from "@/editor/databaseActions";
import { emptyToUndefined, numberField, selectField, textField } from "@/editor/panels/databaseControls";
import { openActionContextMenu, openActionDialog } from "@/editor/panels/databaseEnemyActionDialog";
import { openGraphicDialog } from "@/editor/panels/databaseEnemyGraphicDialog";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { el } from "@/util/dom";
import {
  checkboxField,
  conditionLabel,
  currentEnemy,
  defaultAction,
  ELEMENT_RATE_LABELS,
  enemyGraphicVisual,
  panel,
  rateField,
  replaceAction,
  skillName,
} from "@/editor/panels/databaseEnemyRecordSupport";

export function renderEnemyRecordForm(form: HTMLElement, record: EnemyRecord, rerender: () => void = () => undefined): void {
  form.append(
    el("div", {
      class: "db-enemy-bm101-workbench",
      dataset: { testid: "db-enemies-bm101-workbench" },
      children: [
        panel("이름", [textField("이름", "db-field-name", record.name, (name) => updateDatabaseRecord("enemies", record.id, { name }))], "db-enemy-panel-name"),
        panel("능력치", [el("div", { class: "db-enemy-stat-grid", children: statFields(record) })], "db-enemy-panel-stats"),
        panel("그래픽", graphicFields(record, rerender), "db-enemy-panel-graphic"),
        panel("Species", speciesFields(record), "db-enemy-panel-species"),
        panel("보상", [el("div", { class: "db-enemy-reward-grid", children: rewardFields(record) })], "db-enemy-panel-rewards"),
        panel("치명타 %", [el("div", { class: "db-enemy-critical-row", children: criticalFields(record) })], "db-enemy-panel-critical"),
        panel("옵션", optionFields(record), "db-enemy-panel-options"),
        panel("상태 유효도", rateRows(record, "state"), "db-enemy-panel-state"),
        panel("속성 유효도", rateRows(record, "element"), "db-enemy-panel-element"),
        panel("공격 패턴", [actionSkillField(record), attackPatternTable(record, rerender)], "db-enemy-panel-actions"),
      ],
    })
  );
}

function speciesFields(record: EnemyRecord): HTMLElement[] {
  return [
    selectField("포획 species", "db-picker-enemy-species", record.speciesId ?? "", store.getCurrent().database.monsterSpecies ?? [], (speciesId) =>
      updateDatabaseRecord("enemies", record.id, { speciesId: emptyToUndefined(speciesId) })
    ),
  ];
}

function statFields(record: EnemyRecord): HTMLElement[] {
  return [
    enemyStatField(record, "최대 HP", "maxHp", "db-field-enemy-max-hp"),
    enemyStatField(record, "공격력", "attack", "db-field-enemy-attack"),
    enemyStatField(record, "정신력", "mind", "db-field-enemy-mind"),
    enemyStatField(record, "최대 MP", "maxMp", "db-field-enemy-max-mp"),
    enemyStatField(record, "방어력", "defense", "db-field-enemy-defense"),
    enemyStatField(record, "민첩성", "agility", "db-field-enemy-agility"),
  ];
}

function enemyStatField(record: EnemyRecord, label: string, key: keyof EnemyRecord["stats"], testid: string): HTMLElement {
  return numberField(label, testid, record.stats[key], (value) =>
    updateDatabaseRecord("enemies", record.id, { stats: { ...currentEnemy(record).stats, [key]: value } })
  );
}

function graphicFields(record: EnemyRecord, rerender: () => void): HTMLElement[] {
  return [
    el("div", {
      class: "db-enemy-graphic-preview",
      children: [enemyGraphicVisual(record), el("button", { class: "btn small", text: "설정", dataset: { testid: "db-enemy-graphic-set" }, on: { click: () => openGraphicDialog(record, rerender) } })],
    }),
    checkboxField("투명", "db-field-enemy-transparent", record.transparent, (transparent) => {
      updateDatabaseRecord("enemies", record.id, { transparent });
      updateGraphicPreviewState(transparent, currentEnemy(record).flying);
    }),
    checkboxField("비행", "db-field-enemy-flying", record.flying, (flying) => {
      updateDatabaseRecord("enemies", record.id, { flying });
      updateGraphicPreviewState(currentEnemy(record).transparent, flying);
    }),
    textField("리소스", "db-field-enemy-monster-resource", record.monsterResourceId ?? "", (monsterResourceId) =>
      updateDatabaseRecord("enemies", record.id, { monsterResourceId: emptyToUndefined(monsterResourceId) })
    ),
  ];
}

function updateGraphicPreviewState(transparent: boolean, flying: boolean): void {
  const image = document.querySelector<HTMLImageElement>(".db-enemy-graphic-stage img");
  if (!image) return;
  image.style.opacity = transparent ? "0.58" : "1";
  image.classList.toggle("flying", flying);
}

function rewardFields(record: EnemyRecord): HTMLElement[] {
  return [
    numberField("경험치", "db-field-enemy-exp", record.rewards.exp, (exp) =>
      updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemy(record).rewards, exp } })
    ),
    numberField("돈", "db-field-enemy-gold", record.rewards.gold, (gold) =>
      updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemy(record).rewards, gold } })
    ),
    selectField("아이템", "db-picker-enemy-drop", record.rewards.dropItemId ?? "", store.getCurrent().database.items, (dropItemId) =>
      updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemy(record).rewards, dropItemId: emptyToUndefined(dropItemId) } })
    ),
    numberField("드롭률", "db-field-enemy-drop-rate", record.rewards.dropRatePercent, (dropRatePercent) =>
      updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemy(record).rewards, dropRatePercent } })
    ),
  ];
}

function criticalFields(record: EnemyRecord): HTMLElement[] {
  return [
    checkboxField("사용", "db-field-enemy-critical-enabled", record.criticalHit.enabled, (enabled) =>
      updateDatabaseRecord("enemies", record.id, { criticalHit: { ...currentEnemy(record).criticalHit, enabled } })
    ),
    numberField("1 /", "db-field-enemy-critical-one-in", record.criticalHit.oneIn, (oneIn) =>
      updateDatabaseRecord("enemies", record.id, { criticalHit: { ...currentEnemy(record).criticalHit, oneIn } })
    ),
  ];
}

function optionFields(record: EnemyRecord): HTMLElement[] {
  return [
    checkboxField("일반 공격 빗나감", "db-field-enemy-normal-miss", record.attackOptions.normalAttacksMiss, (normalAttacksMiss) =>
      updateDatabaseRecord("enemies", record.id, { attackOptions: { ...currentEnemy(record).attackOptions, normalAttacksMiss } })
    ),
  ];
}

function rateRows(record: EnemyRecord, kind: "state" | "element"): HTMLElement[] {
  const source = kind === "state" ? [{ id: "state_death", name: "전투불능" }, ...store.getCurrent().database.states] : ELEMENT_RATE_LABELS;
  return source.map((entry) => {
    const value = (kind === "state" ? record.stateRates[entry.id] : record.elementRates[entry.id]) ?? "C";
    const testid = kind === "state" ? `db-picker-enemy-state-rate-${entry.id}` : `db-picker-enemy-element-rate-${entry.id}`;
    return rateField(entry.name, testid, value, (grade) => {
      const current = currentEnemy(record);
      if (kind === "state") updateDatabaseRecord("enemies", record.id, { stateRates: { ...current.stateRates, [entry.id]: grade } });
      if (kind === "element") updateDatabaseRecord("enemies", record.id, { elementRates: { ...current.elementRates, [entry.id]: grade } });
    });
  });
}

function attackPatternTable(record: EnemyRecord, rerender: () => void): HTMLElement {
  const body = el("tbody");
  const actions = record.actions.length > 0 ? record.actions : [defaultAction()];
  actions.forEach((action, index) => {
    body.append(
      el("tr", {
        attrs: { role: "button", tabindex: "0", "aria-label": `${skillName(action.skillId)} 공격 패턴 편집` },
        dataset: { testid: `db-enemy-action-row-${index}` },
        on: {
          contextmenu: (event) => openActionContextMenu(record, index, action, event as MouseEvent, rerender),
          dblclick: () => openActionDialog(record, index, action, rerender),
          keydown: (event) => {
            const keyboardEvent = event as KeyboardEvent;
            if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
            keyboardEvent.preventDefault();
            openActionDialog(record, index, action, rerender);
          },
        },
        children: [
          el("td", { text: skillName(action.skillId) }),
          el("td", { text: conditionLabel(action.condition) }),
          el("td", { text: String(action.priority) }),
        ],
      })
    );
  });
  return el("div", {
    class: "db-enemy-attack-patterns",
    children: [
      el("table", {
        children: [
          el("thead", { children: [el("tr", { children: [el("th", { text: "행동" }), el("th", { text: "조건" }), el("th", { text: "우선도" })] })] }),
          body,
        ],
      }),
    ],
  });
}

function actionSkillField(record: EnemyRecord): HTMLElement {
  const action = currentEnemy(record).actions[0] ?? defaultAction();
  const field = selectField("스킬", "db-picker-enemy-action-skill", action.skillId, store.getCurrent().database.skills, (skillId) => {
    updateDatabaseRecord("enemies", record.id, { actions: replaceAction(currentEnemy(record).actions, 0, { ...action, skillId }) });
  });
  field.classList.add("db-enemy-action-skill-field");
  return field;
}
