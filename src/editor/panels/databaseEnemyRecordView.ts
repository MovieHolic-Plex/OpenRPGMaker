import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { emptyToUndefined, numberField, selectField, textField } from "@/editor/panels/databaseControls";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { openActionContextMenu, openActionDialog } from "@/editor/panels/databaseEnemyActionDialog";
import { openGraphicDialog } from "@/editor/panels/databaseEnemyGraphicDialog";
import { setSelectedMonsterSpeciesId } from "@/editor/panels/databaseMonsterSpeciesView";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
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
        panel("종족", speciesFields(record, rerender), "db-enemy-panel-species"),
        panel("보상", [el("div", { class: "db-enemy-reward-grid", children: rewardFields(record) })], "db-enemy-panel-rewards"),
        panel("치명타 %", [el("div", { class: "db-enemy-critical-row", children: criticalFields(record) })], "db-enemy-panel-critical"),
        panel("옵션", optionFields(record), "db-enemy-panel-options"),
        panel("액션 전투", actionCombatFields(record), "db-enemy-panel-action-combat"),
        panel("상태 유효도", rateRows(record, "state"), "db-enemy-panel-state"),
        panel("속성 유효도", rateRows(record, "element"), "db-enemy-panel-element"),
        panel("공격 패턴", [actionSkillField(record), attackPatternTable(record, rerender)], "db-enemy-panel-actions"),
      ],
    })
  );
}

function speciesFields(record: EnemyRecord, rerender: () => void): HTMLElement[] {
  const project = store.getCurrent();
  const speciesList = project.database.monsterSpecies ?? [];
  const current = currentEnemy(record);
  const speciesId = current.speciesId ?? "";
  const fields: HTMLElement[] = [
    selectField("포획 종족", "db-picker-enemy-species", speciesId, speciesList, (nextId) => {
      updateDatabaseRecord("enemies", record.id, { speciesId: emptyToUndefined(nextId) });
      // 종족 선택 변경 시 warn/error/mismatch 칩이 즉시 반영되도록 폼을 다시 그린다.
      rerender();
    }),
  ];

  // 프로젝트에 종족 카탈로그가 있는데 포획 종족이 비어 있으면 경고.
  if (!speciesId && speciesList.length > 0) {
    fields.push(speciesStatusChip("warn", "db-enemy-species-unset-warn", "포획 종족 미설정"));
  }

  if (speciesId) {
    const species = speciesList.find((entry) => entry.id === speciesId);
    if (!species) {
      fields.push(speciesStatusChip("error", "db-enemy-species-missing-error", "존재하지 않는 종족"));
    } else if ((current.monsterResourceId ?? "") !== (species.graphic.monsterResourceId ?? "")) {
      // 그래픽 불일치 정보 + 종족 그래픽을 적으로 복사하는 버튼.
      fields.push(
        el("div", {
          class: "db-enemy-species-mismatch-row",
          children: [
            speciesStatusChip("info", "db-enemy-species-graphic-mismatch", "그래픽이 종족과 다름"),
            el("button", {
              class: "btn small",
              text: "그래픽 복사",
              attrs: { type: "button" },
              dataset: { testid: "db-enemy-species-copy-graphic" },
              on: {
                click: () => {
                  copySpeciesGraphicToEnemy(record);
                  rerender();
                },
              },
            }),
          ],
        })
      );
    }
  }

  // G006: append open/create species actions (panel structure owned by G002).
  fields.push(...speciesNavActions(record, rerender));
  return fields;
}

function speciesNavActions(record: EnemyRecord, rerender: () => void): HTMLElement[] {
  const current = currentEnemy(record);
  const speciesId = current.speciesId;
  const actions: HTMLElement[] = [];

  if (speciesId) {
    actions.push(
      el("button", {
        class: "btn small",
        text: "종족 열기",
        attrs: { type: "button" },
        dataset: { testid: "db-enemy-open-species" },
        on: {
          click: (event) => {
            const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
            setSelectedMonsterSpeciesId(speciesId);
            if (!panelRoot) {
              toast(`종족 탭에서 ${speciesId}를 선택하세요`, "ok");
              return;
            }
            switchDatabaseActiveTab("monsterSpecies", panelRoot);
          },
        },
      })
    );
  }

  actions.push(
    el("button", {
      class: "btn small",
      text: "종족 생성",
      attrs: { type: "button" },
      dataset: { testid: "db-enemy-create-species" },
      on: {
        click: (event) => {
          const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
          createSpeciesFromEnemy(record.id, panelRoot);
          // Form may still be mounted when panelRoot is missing (toast-only path).
          if (!panelRoot) rerender();
        },
      },
    })
  );

  return [
    el("div", {
      class: "db-enemy-species-nav-actions",
      dataset: { testid: "db-enemy-species-nav-actions" },
      children: actions,
    }),
  ];
}

// Single undo unit: snapshot → seed species → append + set enemy.speciesId → select + switch tab.
function createSpeciesFromEnemy(enemyId: string, panelRoot: HTMLElement | null): void {
  const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === enemyId);
  if (!enemy) return;

  const id = genId("species");
  recordProjectSnapshot();
  store.update(
    (project) => {
      project.database.monsterSpecies ??= [];
      project.database.monsterSpecies.push(
        normalizeMonsterSpeciesRecord({
          id,
          name: enemy.name,
          graphic: {
            monsterResourceId: enemy.monsterResourceId,
            graphicHue: enemy.graphicHue,
            transparent: enemy.transparent,
            flying: enemy.flying,
          },
          baseStats: { ...enemy.stats },
          types: [],
        })
      );
      const target = project.database.enemies.find((entry) => entry.id === enemyId);
      if (target) target.speciesId = id;
    },
    { scope: "database", collection: "monsterSpecies" }
  );

  setSelectedMonsterSpeciesId(id);
  if (!panelRoot) {
    toast(`종족 탭에서 ${id}를 선택하세요`, "ok");
    return;
  }
  switchDatabaseActiveTab("monsterSpecies", panelRoot);
}

function databasePanelRootFrom(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const modalBody = node.closest(".database-modal-body");
  if (modalBody instanceof HTMLElement) return modalBody;
  let current: HTMLElement | null = node;
  while (current) {
    if (current.querySelector(".db-body") && !current.classList.contains("db-body")) return current;
    current = current.parentElement;
  }
  return null;
}

function copySpeciesGraphicToEnemy(record: EnemyRecord): void {
  const enemy = currentEnemy(record);
  const speciesId = enemy.speciesId;
  if (!speciesId) return;
  const species = store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === speciesId);
  if (!species) return;
  const graphic = species.graphic;
  updateDatabaseRecord("enemies", record.id, {
    monsterResourceId: graphic.monsterResourceId,
    graphicHue: graphic.graphicHue,
    transparent: graphic.transparent,
    flying: graphic.flying,
  });
}

function speciesStatusChip(kind: "warn" | "info" | "error", testid: string, text: string): HTMLElement {
  return el("p", {
    class: `db-enemy-species-status db-enemy-species-status-${kind}`,
    text,
    dataset: { testid, speciesStatus: kind },
  });
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

function actionCombatFields(record: EnemyRecord): HTMLElement[] {
  const profile = record.actionProfile;
  const attack = profile?.attack;
  const patchProfile = (mutate: (draft: NonNullable<EnemyRecord["actionProfile"]>) => void): void => {
    const draft: NonNullable<EnemyRecord["actionProfile"]> = structuredClone(profile ?? {});
    mutate(draft);
    updateDatabaseRecord("enemies", record.id, { actionProfile: draft });
  };
  const attackKindOptions = [
    { id: "", name: "없음(접촉만)" },
    { id: "melee", name: "근접" },
    { id: "projectile", name: "투사체" },
    { id: "dash", name: "돌진" },
  ];
  const fields: HTMLElement[] = [
    numberField("접촉 데미지", "db-field-enemy-contact-damage", profile?.contactDamage ?? 0, (value) =>
      patchProfile((draft) => {
        draft.contactDamage = value;
      })
    ),
    selectField("공격 종류", "db-field-enemy-action-kind", attack?.kind ?? "", attackKindOptions, (value) => {
      if (!value) {
        updateDatabaseRecord("enemies", record.id, { actionProfile: { ...structuredClone(profile ?? {}), attack: undefined } });
        return;
      }
      patchProfile((draft) => {
        draft.attack = {
          kind: value as "melee" | "projectile" | "dash",
          windupMs: draft.attack?.windupMs ?? 500,
          recoverMs: draft.attack?.recoverMs ?? 500,
          damage: draft.attack?.damage ?? 4,
          range: draft.attack?.range ?? 1,
          ...(draft.attack?.cooldownMs !== undefined ? { cooldownMs: draft.attack.cooldownMs } : {}),
          ...(draft.attack?.projectileSpeedTilesPerSec !== undefined ? { projectileSpeedTilesPerSec: draft.attack.projectileSpeedTilesPerSec } : {}),
        };
      });
    }),
  ];
  if (attack) {
    const patchAttack = (key: "windupMs" | "recoverMs" | "damage" | "range" | "cooldownMs" | "projectileSpeedTilesPerSec", label: string, testid: string): HTMLElement =>
      numberField(label, testid, attack[key] ?? 0, (value) =>
        patchProfile((draft) => {
          if (!draft.attack) return;
          (draft.attack as unknown as Record<string, number>)[key] = value;
        })
      );
    fields.push(
      patchAttack("windupMs", "선딜(ms)", "db-field-enemy-windup-ms"),
      patchAttack("recoverMs", "후딜(ms)", "db-field-enemy-recover-ms"),
      patchAttack("damage", "공격 데미지", "db-field-enemy-attack-damage"),
      patchAttack("range", "사거리", "db-field-enemy-attack-range"),
      patchAttack("cooldownMs", "쿨다운(ms)", "db-field-enemy-attack-cooldown")
    );
    if (attack.kind === "projectile") {
      fields.push(patchAttack("projectileSpeedTilesPerSec", "탄 속도(타일/초)", "db-field-enemy-projectile-speed"));
    }
  }
  return [el("div", { class: "db-enemy-stat-grid", children: fields })];
}
