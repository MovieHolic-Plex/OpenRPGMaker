import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { emptyToUndefined, numberField, selectField, sliderStepperField, textField } from "@/editor/panels/databaseControls";
import { databaseFieldSupportNotice } from "@/editor/databaseFieldSupport";
import { capturePreviewLine } from "@/editor/panels/databaseCapturePreview";
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
import { detailHero, emptyState, listToolbar, sectionCard } from "@/editor/panels/databaseWorkspace";
// JS import 로 넣는다 — 번들 순서상 index.css 의 studio-theme.css 뒤에 오므로,
// studio-theme 이 남긴 `grid-area: combat !important` 같은 잔재를 !important 남발 없이 이긴다.
// (databaseUtilityRecordViews.ts 가 modern/utility-records.css 를 넣는 방식과 동일.)
import "@/styles/database/modern/enemies.css";
import {
  checkboxField,
  conditionLabel,
  currentEnemy,
  defaultAction,
  enemyGraphicVisual,
  rateField,
  replaceAction,
  skillName,
} from "@/editor/panels/databaseEnemyRecordSupport";

/** 공격 패턴 표에서 편집 대상 행. 레코드 id → 원본 배열 인덱스(정렬 인덱스가 아니다). */
const selectedActionIndexes = new Map<string, number>();

/**
 * 패널 상자. 예전에는 `<fieldset><legend>` 였는데, studio-theme.css 가
 * `.oprn-detail-enemies fieldset { border:0 !important; background:transparent !important }`
 * 로 11 개 패널의 테두리를 통째로 지워 "능력치"와 "종족"의 경계가 사라져 있었다.
 * `sectionCard()` 는 `<section class="db-ws-card">` 를 내므로 그 선택자에 아예 걸리지 않는다.
 *
 * `db-advanced-panel` + `db-enemy-panel-*` 클래스는 그대로 유지한다 —
 * test/databasePanelGridClasses.test.ts 가 패널 11 개와 각 고유 클래스를 고정한다.
 */
function enemyCard(
  title: string,
  key: string,
  children: readonly HTMLElement[],
  options: { readonly hint?: string; readonly span?: boolean } = {}
): HTMLElement {
  const card = sectionCard({
    title,
    ...(options.hint ? { hint: options.hint } : {}),
    children,
    testid: `db-enemy-card-${key}`,
  });
  card.classList.add("db-advanced-panel", `db-enemy-panel-${key}`);
  if (options.span) card.classList.add("db-ws-span");
  return card;
}

export function renderEnemyRecordForm(form: HTMLElement, record: EnemyRecord, rerender: () => void = () => undefined): void {
  const hero = enemyHero(record);
  form.append(
    el("div", {
      // 예전 클래스명(db-enemy-bm101-workbench)을 버린다. desktop.css / 05-dense-workbenches.css /
      // studio-theme.css 가 서로 다른 grid-template-areas 를 같은 이름에 걸어 두고 있어서,
      // 그 이름을 유지하는 한 어떤 배치를 짜도 마지막에 로드된 맵이 이겨 버린다(겹침 3 건의 원인).
      // testid 는 e2e 계약이라 그대로 둔다.
      class: "db-enemy-workbench",
      dataset: { testid: "db-enemies-bm101-workbench" },
      children: [
        hero.node,
        el("div", {
          class: "db-ws-stack db-enemy-stack",
          children: [
            enemyCard("이름", "name", identityFields(record, hero.setTitle), { hint: "목록과 전투 로그에 쓰입니다" }),
            enemyCard("능력치", "stats", [el("div", { class: "db-enemy-stat-grid", children: statFields(record) })]),
            enemyCard("그래픽", "graphic", graphicFields(record, rerender)),
            enemyCard("종족", "species", speciesFields(record, rerender), { hint: "포획해 키우는 몬스터의 원본" }),
            enemyCard("보상", "rewards", [el("div", { class: "db-enemy-reward-grid", children: rewardFields(record) })]),
            enemyCard("치명타 %", "critical", [el("div", { class: "db-enemy-critical-row", children: criticalFields(record) })]),
            enemyCard("옵션", "options", optionFields(record)),
            enemyCard("액션 전투", "action-combat", actionCombatFields(record), { hint: "필드에서 직접 싸우는 액션 전투용" }),
            enemyCard("상태 유효도", "state", rateRows(record, "state")),
            enemyCard("속성 유효도", "element", rateRows(record, "element")),
            enemyCard("공격 패턴", "actions", [actionSkillField(record), attackPatternTable(record, rerender)], { span: true }),
          ],
        }),
      ],
    })
  );
}

/**
 * 상세 창 상단 고정 헤더. 지금 어떤 몬스터를 편집 중인지(스프라이트/이름/핵심 수치)가
 * 항상 보인다 — 예전에는 좌측 목록 말고는 단서가 없었고 상세 창 상단 절반이 빈 칸이었다.
 */
function enemyHero(record: EnemyRecord): { readonly node: HTMLElement; readonly setTitle: (name: string) => void } {
  const live = currentEnemy(record);
  const species = live.speciesId
    ? store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === live.speciesId)
    : undefined;
  const tags = [
    `Lv ${live.level ?? 1}`,
    species ? `종족 ${species.name}` : "종족 미설정",
    `행동 ${live.actions.length}개`,
    ...(live.flying ? ["비행"] : []),
    ...(live.transparent ? ["투명"] : []),
  ];
  const node = detailHero({
    eyebrow: "몬스터",
    title: live.name || "(이름 없음)",
    subtitle: `HP ${live.stats.maxHp} · 공격 ${live.stats.attack} · 방어 ${live.stats.defense} · 민첩 ${live.stats.agility} · 경험치 ${live.rewards.exp}`,
    tags,
    media: enemyGraphicVisual(live),
    testid: "db-enemy-hero",
  });
  const titleNode = node.querySelector(".db-ws-hero-title");
  return {
    node,
    setTitle: (name: string): void => {
      if (titleNode instanceof HTMLElement) titleNode.textContent = name || "(이름 없음)";
    },
  };
}

function identityFields(record: EnemyRecord, setHeroTitle: (name: string) => void): HTMLElement[] {
  const level = numberField("레벨", "db-field-enemy-level", record.level ?? 1, (value) =>
    updateDatabaseRecord("enemies", record.id, { level: value }),
    { min: 1, max: 99 }
  );
  level.title = "경험치 레벨갭 보정과 포획 몬스터의 시작 레벨에 쓰입니다.";
  return [
    textField("이름", "db-field-name", record.name, (name) => {
      updateDatabaseRecord("enemies", record.id, { name });
      setHeroTitle(name);
    }),
    level,
  ];
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
              class: "db-ws-btn db-ws-btn-ghost",
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

  if (speciesId) {
    const species = speciesList.find((entry) => entry.id === speciesId);
    if (species) fields.push(capturePreviewLine(species.captureRate, "db-enemy-capture-preview"));
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
        class: "db-ws-btn db-ws-btn-ghost",
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
      class: "db-ws-btn db-ws-btn-ghost",
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
    enemyStatField(record, "최대 HP", "maxHp", "db-field-enemy-max-hp", { min: 1, max: 99999 }),
    enemyStatField(record, "최대 MP", "maxMp", "db-field-enemy-max-mp", { min: 0, max: 9999 }),
    enemyStatField(record, "공격력", "attack", "db-field-enemy-attack", { min: 1, max: 999 }),
    enemyStatField(record, "방어력", "defense", "db-field-enemy-defense", { min: 1, max: 999 }),
    enemyStatField(record, "정신력", "mind", "db-field-enemy-mind", { min: 1, max: 999 }),
    enemyStatField(record, "민첩성", "agility", "db-field-enemy-agility", { min: 1, max: 999 }),
  ];
}

function enemyStatField(
  record: EnemyRecord,
  label: string,
  key: keyof EnemyRecord["stats"],
  testid: string,
  bounds: { readonly min: number; readonly max: number }
): HTMLElement {
  return numberField(label, testid, record.stats[key], (value) =>
    updateDatabaseRecord("enemies", record.id, { stats: { ...currentEnemy(record).stats, [key]: value } }),
    bounds
  );
}

function graphicFields(record: EnemyRecord, rerender: () => void): HTMLElement[] {
  // 스프라이트 미리보기는 히어로가 갖는다 — 같은 그림을 두 번 그리면
  // updateGraphicPreviewState 가 어느 쪽을 갱신할지 모호해진다.
  return [
    el("div", {
      class: "db-enemy-graphic-actions",
      children: [
        el("button", {
          class: "db-ws-btn db-ws-btn-primary",
          text: "설정",
          attrs: { type: "button" },
          dataset: { testid: "db-enemy-graphic-set" },
          on: { click: () => openGraphicDialog(record, rerender) },
        }),
      ],
    }),
    el("div", {
      class: "db-enemy-graphic-flags",
      children: [
        checkboxField("투명", "db-field-enemy-transparent", record.transparent, (transparent) => {
          updateDatabaseRecord("enemies", record.id, { transparent });
          updateGraphicPreviewState(transparent, currentEnemy(record).flying);
        }),
        checkboxField("비행", "db-field-enemy-flying", record.flying, (flying) => {
          updateDatabaseRecord("enemies", record.id, { flying });
          updateGraphicPreviewState(currentEnemy(record).transparent, flying);
        }),
      ],
    }),
    textField("리소스", "db-field-enemy-monster-resource", record.monsterResourceId ?? "", (monsterResourceId) =>
      updateDatabaseRecord("enemies", record.id, { monsterResourceId: emptyToUndefined(monsterResourceId) })
    ),
    databaseFieldSupportNotice("transparent", "flying", "graphicHue"),
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
      updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemy(record).rewards, exp } }),
      { min: 0, max: 9999999 }
    ),
    numberField("돈", "db-field-enemy-gold", record.rewards.gold, (gold) =>
      updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemy(record).rewards, gold } }),
      { min: 0, max: 999999 }
    ),
    selectField("아이템", "db-picker-enemy-drop", record.rewards.dropItemId ?? "", store.getCurrent().database.items, (dropItemId) =>
      updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemy(record).rewards, dropItemId: emptyToUndefined(dropItemId) } })
    ),
    numberField("드롭률", "db-field-enemy-drop-rate", record.rewards.dropRatePercent, (dropRatePercent) =>
      updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemy(record).rewards, dropRatePercent } }),
      { min: 0, max: 100 }
    ),
  ];
}

function criticalFields(record: EnemyRecord): HTMLElement[] {
  return [
    checkboxField("사용", "db-field-enemy-critical-enabled", record.criticalHit.enabled, (enabled) =>
      updateDatabaseRecord("enemies", record.id, { criticalHit: { ...currentEnemy(record).criticalHit, enabled } })
    ),
    numberField("1 /", "db-field-enemy-critical-one-in", record.criticalHit.oneIn, (oneIn) =>
      updateDatabaseRecord("enemies", record.id, { criticalHit: { ...currentEnemy(record).criticalHit, oneIn } }),
      { min: 1, max: 999 }
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
  const database = store.getCurrent().database;
  // 속성 행은 하드코딩 목록 대신 프로젝트 데이터를 쓴다 — 런타임(runtime.ts elementMultiplierFor)이
  // database.elements 를 권위로 본다. 상태 행의 state_death 는 데이터에 없어도 런타임이 인정하는
  // 암묵 상태이므로(references.ts isKnownStateId, commandCatalog) 항상 앞에 붙인다.
  const source: readonly { readonly id: string; readonly name: string }[] =
    kind === "state"
      ? [{ id: "state_death", name: "전투불능" }, ...database.states.filter((state) => state.id !== "state_death")]
      : database.elements ?? [];
  const rows = source.map((entry) => {
    const value = (kind === "state" ? record.stateRates[entry.id] : record.elementRates[entry.id]) ?? "C";
    const testid = kind === "state" ? `db-picker-enemy-state-rate-${entry.id}` : `db-picker-enemy-element-rate-${entry.id}`;
    return rateField(entry.name, testid, value, (grade) => {
      const current = currentEnemy(record);
      if (kind === "state") updateDatabaseRecord("enemies", record.id, { stateRates: { ...current.stateRates, [entry.id]: grade } });
      if (kind === "element") updateDatabaseRecord("enemies", record.id, { elementRates: { ...current.elementRates, [entry.id]: grade } });
    });
  });
  if (kind !== "element") return [rateList(rows, kind)];
  // 속성 목록에서 사라졌는데 등급이 남아 있는 키 — 런타임은 무시하므로 정리 경로를 준다.
  const known = new Set((database.elements ?? []).map((element) => element.id));
  for (const danglingId of Object.keys(record.elementRates).filter((id) => !known.has(id))) {
    rows.push(danglingElementRateRow(record, danglingId));
  }
  return [rateList(rows, kind)];
}

function rateList(rows: readonly HTMLElement[], kind: "state" | "element"): HTMLElement {
  if (rows.length === 0) {
    return emptyState({
      icon: "○",
      title: kind === "state" ? "상태가 없습니다" : "속성이 없습니다",
      body: kind === "state" ? "[상태] 탭에서 상태를 먼저 만드세요." : "[속성] 탭에서 속성을 먼저 만드세요.",
      compact: true,
      testid: `db-enemy-${kind}-rates-empty`,
    });
  }
  return el("div", { class: "db-enemy-rate-list", children: [...rows] });
}

function danglingElementRateRow(record: EnemyRecord, elementId: string): HTMLElement {
  return el("div", {
    class: "db-enemy-rate-row is-dangling",
    dataset: { testid: `db-enemy-element-rate-dangling-${elementId}` },
    children: [
      el("span", { text: `속성 목록에 없는 등급: ${elementId} (${record.elementRates[elementId]})` }),
      el("button", {
        class: "db-ws-btn db-ws-btn-danger",
        attrs: { type: "button" },
        text: "삭제",
        dataset: { testid: `db-enemy-element-rate-dangling-delete-${elementId}` },
        on: {
          click: () => {
            const current = currentEnemy(record);
            const next = { ...current.elementRates };
            delete next[elementId];
            updateDatabaseRecord("enemies", record.id, { elementRates: next });
          },
        },
      }),
    ],
  });
}

/** 지금 선택된 행의 **원본 배열 인덱스**. 툴바 클로저는 렌더 시점 값이 아니라 이걸 쓴다. */
function liveSelectedActionIndex(record: EnemyRecord): number {
  const length = currentEnemy(record).actions.length;
  return Math.min(selectedActionIndexes.get(record.id) ?? 0, Math.max(0, length - 1));
}

/** 선택 표시를 형제 행에 직접 옮긴다 — 표를 다시 그리지 않으므로 노드가 살아 있다. */
function markActiveActionRow(row: HTMLElement | null, index: number): void {
  const body = row?.parentElement;
  if (!body) return;
  for (const sibling of Array.from(body.children)) {
    if (!(sibling instanceof HTMLElement)) continue;
    sibling.classList.toggle("active", sibling.dataset.actionIndex === String(index));
  }
}

function attackPatternTable(record: EnemyRecord, rerender: () => void): HTMLElement {
  const actions = record.actions;
  const selectedIndex = liveSelectedActionIndex(record);
  const toolbar = listToolbar([
    {
      label: "행 추가",
      kind: "primary",
      testid: "db-enemy-action-add",
      onClick: () => {
        const current = currentEnemy(record);
        updateDatabaseRecord("enemies", record.id, { actions: [...current.actions, defaultAction()] });
        selectedActionIndexes.set(record.id, current.actions.length);
        rerender();
      },
    },
    {
      label: "행 복사",
      testid: "db-enemy-action-duplicate",
      disabled: actions.length === 0,
      ...(actions.length === 0 ? { title: "행동을 추가하면 사용할 수 있습니다" } : {}),
      onClick: () => {
        const current = currentEnemy(record);
        const selected = liveSelectedActionIndex(record);
        const source = current.actions[selected];
        if (!source) return;
        const next = [...current.actions];
        next.splice(selected + 1, 0, { ...source });
        updateDatabaseRecord("enemies", record.id, { actions: next });
        selectedActionIndexes.set(record.id, selected + 1);
        rerender();
      },
    },
    {
      label: "행 제거",
      kind: "danger",
      testid: "db-enemy-action-delete",
      disabled: actions.length === 0,
      ...(actions.length === 0 ? { title: "행동을 추가하면 사용할 수 있습니다" } : {}),
      onClick: () => {
        const current = currentEnemy(record);
        if (current.actions.length === 0) return;
        const selected = liveSelectedActionIndex(record);
        updateDatabaseRecord("enemies", record.id, { actions: current.actions.filter((_, index) => index !== selected) });
        selectedActionIndexes.set(record.id, Math.max(0, selected - 1));
        rerender();
      },
    },
  ]);
  toolbar.classList.add("db-enemy-action-toolbar");
  if (actions.length === 0) {
    return el("div", {
      class: "db-enemy-attack-patterns is-empty",
      children: [
        toolbar,
        emptyState({
          // 폰트에 없는 글리프(⚔ 등)는 두부(□)로 떨어진다 — 공용 빈 상태와 같은 기호를 쓴다.
          icon: "○",
          title: "행동이 없습니다",
          body: "전투에서 일반 공격만 사용합니다. [행 추가]로 스킬·조건·우선도를 지정하세요.",
          compact: true,
          testid: "db-enemy-actions-empty",
        }),
      ],
    });
  }
  const body = el("tbody");
  // 런타임 선택 순서(priority*10 + 상황 점수)를 흉내내 우선도 내림차순으로 보여준다.
  // 편집은 정렬 순서가 아니라 원본 배열 인덱스를 써야 한다.
  const sorted = actions.map((action, index) => ({ action, index })).sort((left, right) => right.action.priority - left.action.priority);
  for (const { action, index } of sorted) {
    const dangling = action.skillId.length > 0 && !store.getCurrent().database.skills.some((skill) => skill.id === action.skillId);
    const label = action.skillId.length === 0 ? "일반 공격" : dangling ? `삭제된 스킬(${action.skillId})` : skillName(action.skillId);
    body.append(
      el("tr", {
        class: `${index === selectedIndex ? "active" : ""}${dangling ? " is-dangling" : ""}`.trim(),
        attrs: { role: "button", tabindex: "0", "aria-label": `${label} 공격 패턴 편집` },
        dataset: { testid: `db-enemy-action-row-${index}`, actionIndex: String(index) },
        on: {
          // 선택은 제자리에서 클래스만 바꾼다. 예전처럼 rerender() 하면 첫 클릭에서 행이
          // DOM 에서 떨어져 나가 두 번째 클릭이 다른 노드에 떨어지고, 그래서 더블클릭으로
          // 행동 편집 창을 여는 경로가 아예 동작하지 않았다(qa-enemies.spec.ts 주석 참조).
          click: (event) => {
            selectedActionIndexes.set(record.id, index);
            markActiveActionRow(event.currentTarget as HTMLElement | null, index);
          },
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
          el("td", { text: label }),
          el("td", { text: conditionLabel(action.condition) }),
          el("td", { text: String(action.priority) }),
        ],
      })
    );
  }
  const priorityHeader = el("th", { text: "우선도" });
  priorityHeader.title = "우선도 × 10 + 상황 점수로 행동을 고릅니다. 우선도가 낮아도 상황에 따라 선택될 수 있습니다.";
  return el("div", {
    class: "db-enemy-attack-patterns",
    children: [
      toolbar,
      el("div", {
        class: "db-enemy-attack-table",
        children: [
          el("table", {
            children: [
              el("thead", { children: [el("tr", { children: [el("th", { text: "행동" }), el("th", { text: "조건" }), priorityHeader] })] }),
              body,
            ],
          }),
        ],
      }),
      el("p", {
        class: "db-enemy-attack-hint",
        text: "행을 더블클릭하거나 Enter 를 눌러 조건·우선도·스위치를 편집합니다.",
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
  const knockback = sliderStepperField("넉백 저항", "db-field-enemy-knockback-resist", profile?.knockbackResist ?? 0, (value) =>
    patchProfile((draft) => {
      draft.knockbackResist = value;
    }),
    { min: 0, max: 1, step: 0.05 }
  );
  // 슬라이더+스테퍼는 2열 수치 그리드 한 칸(≈130px)에 안 들어간다 — 한 줄을 다 쓴다.
  knockback.classList.add("db-enemy-wide-field");
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
      }),
      { min: 0, max: 9999 }
    ),
    numberField("어그로 거리", "db-field-enemy-aggro-range", profile?.aggroRange ?? 5, (value) =>
      patchProfile((draft) => {
        draft.aggroRange = value;
      }),
      { min: 1, max: 30 }
    ),
    numberField("이동 간격(ms)", "db-field-enemy-move-interval-ms", profile?.moveIntervalMs ?? 500, (value) =>
      patchProfile((draft) => {
        draft.moveIntervalMs = value;
      }),
      { min: 50, max: 10000 }
    ),
    knockback,
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
    // bounds 는 normalizeEnemyActionAttack(actionCombat.ts)의 clampInt 범위와 숫자까지 일치해야 한다.
    const attackBounds = {
      windupMs: { min: 100, max: 5000 },
      recoverMs: { min: 0, max: 5000 },
      damage: { min: 1, max: 9999 },
      range: { min: 1, max: 20 },
      cooldownMs: { min: 0, max: 30000 },
      projectileSpeedTilesPerSec: { min: 1, max: 30 },
    } as const;
    const patchAttack = (key: keyof typeof attackBounds, label: string, testid: string): HTMLElement =>
      numberField(label, testid, attack[key] ?? 0, (value) =>
        patchProfile((draft) => {
          if (!draft.attack) return;
          (draft.attack as unknown as Record<string, number>)[key] = value;
        }),
        attackBounds[key]
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
