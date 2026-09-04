// 진영 탭 — 전투에 이미 쓰이던 희소 관계표를 사람이 저작하는 화면.
//
// 행/열을 따로 편집하게 두면 양방향 중 더 적대적인 값이 이긴다는 규칙 때문에, 한쪽에서
// 우호로 바꿔도 반대쪽 적대가 남아 "안 바뀐" 것처럼 보인다. 그래서 행렬 셀은 한 쌍을
// 대칭으로 편집하고 프로젝트에는 관계 한 항목만 쓴다. 런타임의 보수적 판정은 안내문으로
// 드러내고, 가져온 비대칭 데이터도 authoredFactionStance 로 실제 저작 결과를 보여 준다.

import { field } from "@/editor/panels/databaseControls";
import {
  detailHero,
  detailPane,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  noticeBar,
  restoreFocusAfterRerender,
  sectionCard,
  statStrip,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import {
  aggressionLabel,
  deleteFaction,
  duplicateFaction,
  factionMatrixCell,
  isReservedFactionId,
  nextFactionId,
  renameFaction,
  setPlayerKillReputation,
  setSparseFactionStance,
  upsertFactionDef,
} from "@/editor/panels/databaseFactionModel";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  DEFAULT_AGGRESSION,
  DEFAULT_ENEMY_FACTION_ID,
  PLAYER_FACTION_ID,
  factionColor,
  isHittableByFaction,
  normalizeProjectFactions,
  resolveFactionTable,
  stanceBarColor,
  willAttackOnSight,
} from "@/project/factions";
import { store } from "@/project/store";
import type { FactionAggression, FactionDef, FactionStance, ProjectFactions } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import "@/styles/database/modern/factions.css";

const STANCES = [-2, -1, 0, 1, 2] as const satisfies readonly FactionStance[];
const AGGRESSIONS = [0, 1, 2, 3] as const satisfies readonly FactionAggression[];
const STANCE_LABEL: Readonly<Record<FactionStance, string>> = {
  [-2]: "최악의 적",
  [-1]: "적",
  [0]: "중립",
  [1]: "우호",
  [2]: "동맹",
};
const AGGRESSION_DESC: Readonly<Record<FactionAggression, string>> = {
  [0]: "먼저 싸움을 걸지 않음",
  [1]: "적(-1 이하)에게만 먼저 공격",
  [2]: "중립(0)까지 먼저 공격",
  [3]: "아군까지 공격",
};
const RESERVED_NAME: Readonly<Record<string, string>> = {
  [PLAYER_FACTION_ID]: "플레이어",
  [DEFAULT_ENEMY_FACTION_ID]: "적",
};

let factionSearch = "";
let selectedFactionId = PLAYER_FACTION_ID;

export function renderFactionsTab(host: HTMLElement, rerender: () => void): void {
  const factions = store.getCurrent().factions;
  const table = resolveFactionTable(factions);
  selectedFactionId = table.ids.includes(selectedFactionId) ? selectedFactionId : table.ids[0]!;
  const selectedId = selectedFactionId;
  const selected = factionDefFor(factions, selectedId);
  const query = factionSearch.trim().toLowerCase();
  const rows = table.ids.flatMap((id, index) => {
    const name = table.names[index] ?? id;
    if (query && !name.toLowerCase().includes(query) && !id.toLowerCase().includes(query)) return [];
    return [listRow({
      name,
      sub: aggressionLabel(table.aggression[index] as FactionAggression),
      number: isReservedFactionId(id) ? "예약" : index + 1,
      active: id === selectedId,
      title: id,
      testid: `db-faction-row-${id}`,
      dataset: { factionId: id },
      onSelect: () => { selectedFactionId = id; rerender(); },
    })];
  });

  const list = listPane({
    title: "진영",
    count: query && rows.length !== table.size ? `${rows.length}/${table.size}개` : table.size,
    search: listSearch({
      placeholder: "이름 또는 ID 검색",
      value: factionSearch,
      testid: "db-faction-search",
      onInput: (value) => { factionSearch = value; rerender(); },
    }),
    rows,
    empty: emptyState({
      icon: "⌕",
      title: "검색 결과가 없습니다",
      body: `“${factionSearch}”와 일치하는 진영이 없습니다.`,
      compact: true,
      testid: "db-faction-list-empty",
    }),
    toolbar: listToolbar([
      { label: "+ 추가", kind: "primary", testid: "db-faction-create", onClick: () => createFaction(rerender) },
      { label: "복제", testid: "db-faction-duplicate", onClick: () => duplicateSelected(selected, rerender) },
      {
        label: "삭제",
        kind: "danger",
        testid: "db-faction-delete",
        disabled: isReservedFactionId(selectedId),
        title: isReservedFactionId(selectedId) ? "예약 진영은 삭제할 수 없습니다" : "선택한 진영과 연결된 관계를 함께 삭제합니다",
        onClick: () => removeSelected(selectedId, rerender),
      },
    ]),
    testid: "db-faction-list-pane",
  });

  const detail = detailPane({
    hero: detailHero({
      eyebrow: "전투 진영",
      title: factionDisplayName(factions, selectedId),
      subtitle: isReservedFactionId(selectedId)
        ? "항상 존재하는 예약 진영 · 이름과 전투 성향은 덮어쓸 수 있습니다"
        : "NPC 소속과 선공 판정을 묶는 프로젝트 진영",
      tags: [selectedId, `${aggressionLabel(selected.aggression ?? DEFAULT_AGGRESSION)}`],
      media: factionSwatch(factionColor(table, selectedId), factionDisplayName(factions, selectedId)),
      testid: "db-faction-hero",
    }),
    body: [
      statStrip([
        { label: "진영 수", value: String(table.size), hint: "플레이어·적 포함", tone: "good" },
        { label: "바꾼 관계", value: String(factions?.relations.length ?? 0), hint: "기본과 다르게 정한 쌍" },
        {
          label: "이 진영의 관계",
          value: String((factions?.relations ?? []).filter((relation) => relation.a === selectedId || relation.b === selectedId).length),
          hint: "저장되는 설정 수",
        },
      ], { testid: "db-faction-stats" }),
      el("div", {
        class: "db-ws-stack db-faction-inspector",
        children: [
          sectionCard({
            title: "기본 정보",
            hint: isReservedFactionId(selectedId) ? "예약 ID는 바꿀 수 없습니다" : "ID 변경 시 관계·몬스터·필드 스폰 소속도 함께 바뀝니다",
            children: factionFields(selected, rerender),
            testid: "db-faction-basics",
          }),
          sectionCard({
            title: `${factionDisplayName(factions, selectedId)}의 관계`,
            hint: "상대를 고르고 어떻게 대할지 누르세요 — 바로 저장됩니다",
            children: [relationList(factions, selectedId, rerender)],
            testid: "db-faction-relations",
          }),
          sectionCard({
            title: "행동 규칙",
            hint: "누가 먼저 공격하는지 정합니다",
            children: behaviorFields(selected, rerender),
            testid: "db-faction-behavior",
          }),
          sectionCard({
            title: "플레이어 처치 평판",
            hint: "프로젝트 전체 규칙",
            children: reputationFields(factions, rerender),
            testid: "db-faction-reputation",
          }),
          span(matrixCard(factions, rerender)),
        ],
      }),
    ],
    testid: "db-faction-detail-pane",
  });

  host.append(workspaceShell({ list, detail, legacyClass: "db-faction-workspace", testid: "db-faction-workspace" }));
}

function factionFields(def: FactionDef, rerender: () => void): HTMLElement[] {
  const nameInput = el("input", {
    attrs: { type: "text" },
    value: def.name,
    dataset: { testid: "db-faction-name" },
  }) as HTMLInputElement;
  nameInput.addEventListener("input", () => {
    patchFaction(def.id, { name: nameInput.value }, `faction-name:${def.id}`, "진영 이름 변경");
    updateVisibleFactionName(def.id, nameInput.value);
  });
  nameInput.addEventListener("change", rerender);

  const idInput = el("input", {
    attrs: { type: "text", spellcheck: "false", ...(isReservedFactionId(def.id) ? { disabled: "true" } : {}) },
    value: def.id,
    dataset: { testid: "db-faction-id" },
  }) as HTMLInputElement;
  idInput.addEventListener("change", () => {
    const result = renameFaction(store.getCurrent(), def.id, idInput.value);
    if (!result.ok) {
      toast(result.reason, "error");
      idInput.value = def.id;
      return;
    }
    if (idInput.value.trim() === def.id) return;
    recordProjectSnapshot("진영 ID 변경");
    selectedFactionId = idInput.value.trim();
    store.replace(result.project);
    rerender();
  });

  const colorInput = el("input", {
    attrs: { type: "color", "aria-label": "진영 색" },
    value: colorInputValue(def.id, def.color),
    dataset: { testid: "db-faction-color" },
  }) as HTMLInputElement;
  colorInput.addEventListener("input", () => {
    patchFaction(def.id, { color: colorInput.value }, `faction-color:${def.id}`, "진영 색 변경");
    const swatch = document.querySelector<HTMLElement>("[data-testid='db-faction-color-preview']");
    swatch?.style.setProperty("--db-faction-color", colorInput.value);
  });
  colorInput.addEventListener("change", rerender);

  return [field("이름", nameInput), field("ID", idInput), field("식별 색", colorInput)];
}

function behaviorFields(def: FactionDef, rerender: () => void): HTMLElement[] {
  const current = def.aggression ?? DEFAULT_AGGRESSION;
  const aggression = el("select", { dataset: { testid: "db-faction-aggression" } }) as HTMLSelectElement;
  for (const value of AGGRESSIONS) aggression.append(el("option", {
    attrs: { value: String(value) },
    text: `${aggressionLabel(value)} — ${AGGRESSION_DESC[value]}`,
  }));
  aggression.value = String(current);
  const aggressionDesc = el("p", { class: "db-ws-usage", text: AGGRESSION_DESC[current] });
  aggression.addEventListener("change", () => {
    recordProjectSnapshot("진영 선공 성향 변경");
    patchFaction(def.id, { aggression: Number(aggression.value) as FactionAggression });
    rerender();
  });

  const protectedInput = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "db-faction-protected-from-npcs" },
  }) as HTMLInputElement;
  protectedInput.checked = def.protectedFromNpcs === true;
  protectedInput.addEventListener("change", () => {
    recordProjectSnapshot("NPC 전투불능 보호 변경");
    patchFaction(def.id, { protectedFromNpcs: protectedInput.checked });
    rerender();
  });
  return [
    field("먼저 공격하는 범위", aggression),
    aggressionDesc,
    field("쓰러지지 않게 보호", el("label", {
      class: "db-faction-check",
      children: [protectedInput, el("span", { text: "HP 1에서 버팀 (플레이어 공격은 제외)" })],
    })),
  ];
}

function relationList(
  factions: ProjectFactions | undefined,
  selectedId: string,
  rerender: () => void,
): HTMLElement {
  const table = resolveFactionTable(factions);
  const aggressionOf = (id: string): FactionAggression =>
    (table.aggression[table.ids.indexOf(id)] ?? DEFAULT_AGGRESSION) as FactionAggression;
  const rows = table.ids
    .filter((id) => id !== selectedId)
    .map((otherId) => {
      const cell = factionMatrixCell(table, factions, selectedId, otherId);
      const otherName = table.names[table.ids.indexOf(otherId)] ?? otherId;
      const wraps = el("div", { class: "db-faction-relation", dataset: { testid: `db-faction-relation-${otherId}` } });
      const head = el("div", {
        class: "db-faction-relation-head",
        children: [
          el("strong", { text: otherName }),
          el("span", {
            class: `db-faction-chip${cell.authored ? " is-authored" : " is-default"}`,
            text: `${cell.stance} ${STANCE_LABEL[cell.stance]} · ${cell.authored ? "바꿈" : "기본"}`,
            dataset: { testid: `db-faction-relation-label-${otherId}` },
          }),
        ],
      });
      const outcomes: string[] = [];
      if (willAttackOnSight(cell.stance, aggressionOf(selectedId))) outcomes.push("이쪽이 먼저 공격");
      if (willAttackOnSight(cell.stance, aggressionOf(otherId))) outcomes.push("상대가 먼저 공격");
      const outcome = el("p", {
        class: "db-ws-usage",
        text: outcomes.length > 0 ? `실제 전투: ${outcomes.join(" · ")}` : "실제 전투: 서로 먼저 공격하지 않음",
      });
      const buttons = el("div", {
        class: "db-faction-stance-buttons",
        attrs: { role: "group", "aria-label": `${otherName}과의 관계` },
        children: STANCES.map((stance) => el("button", {
          class: `db-faction-stance-pick${stance === cell.stance ? " is-active" : ""}`,
          attrs: { type: "button", "aria-pressed": stance === cell.stance ? "true" : "false", title: isHittableByFaction(stance) ? `${STANCE_LABEL[stance]} — 유탄·광역에 맞습니다` : `${STANCE_LABEL[stance]} — 아군 오사격에서 면제됩니다` },
          dataset: { testid: `db-faction-pick-${otherId}-${stance}` },
          text: `${stance} ${STANCE_LABEL[stance]}`,
          on: {
            click: () => {
              recordProjectSnapshot("진영 관계 변경");
              replaceFactions(setSparseFactionStance(store.getCurrent().factions, selectedId, otherId, stance));
              rerender();
              restoreFocusAfterRerender(`db-faction-pick-${otherId}-${stance}`);
            },
          },
        })),
      });
      wraps.append(head, outcome, buttons);
      wraps.style.setProperty("--db-faction-stance-color", cssColor(stanceBarColor(cell.stance)));
      return wraps;
    });
  return el("div", { class: "db-faction-relations", children: rows });
}

function reputationFields(factions: ProjectFactions | undefined, rerender: () => void): HTMLElement[] {
  const config = factions?.playerKillReputation;
  const enabledInput = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "db-faction-reputation-enabled" },
  }) as HTMLInputElement;
  enabledInput.checked = config !== undefined;
  enabledInput.addEventListener("change", () => {
    recordProjectSnapshot("플레이어 처치 평판 변경");
    replaceFactions(setPlayerKillReputation(
      store.getCurrent().factions,
      enabledInput.checked,
      store.getCurrent().factions?.playerKillReputation?.weight ?? 0.25,
    ));
    rerender();
  });

  const weightInput = el("input", {
    attrs: { type: "number", min: "0", step: "0.05", ...(config ? {} : { disabled: "true" }) },
    value: config?.weight ?? 0.25,
    dataset: { testid: "db-faction-reputation-weight" },
  }) as HTMLInputElement;
  weightInput.addEventListener("change", () => {
    const weight = Math.max(0, Number.isFinite(Number(weightInput.value)) ? Number(weightInput.value) : 0.25);
    weightInput.value = String(weight);
    recordProjectSnapshot("플레이어 처치 평판 가중치 변경");
    replaceFactions(setPlayerKillReputation(store.getCurrent().factions, true, weight));
    rerender();
  });

  return [
    field("싸우면 평판 자동 변화", el("label", {
      class: "db-faction-check",
      children: [enabledInput, el("span", { text: "플레이어가 NPC를 처치하면 관련 진영 태도에 반영" })],
    })),
    field("처치당 가중치", weightInput),
    el("p", {
      class: "db-ws-usage",
      text: config
        ? "숫자가 클수록 한 번 처치했을 때 관계가 크게 변합니다."
        : "끄면 처치해도 진영 관계가 자동으로 변하지 않습니다.",
    }),
  ];
}

function matrixCard(factions: ProjectFactions | undefined, rerender: () => void): HTMLElement {
  const table = resolveFactionTable(factions);
  const matrix = el("div", {
    class: "db-faction-matrix",
    attrs: { role: "grid", "aria-label": "진영 태도 행렬" },
    dataset: { testid: "db-faction-matrix" },
  });
  matrix.style.setProperty("--db-faction-count", String(table.size));

  // `role="grid"` 는 자식이 `role="row"` 여야 유효하다. 이 표는 CSS grid 라 셀이 전부
  // 격자의 직접 자식이어야 하므로, 행 래퍼를 `display:contents`(matrixRow 클래스)로 둬서
  // 배치는 그대로 두고 접근성 트리만 바로잡는다. 래퍼가 없던 동안 role=row 가 0 개였다.
  const matrixRow = (children: readonly HTMLElement[]): HTMLElement =>
    el("div", { class: "db-faction-matrix-rowgroup", attrs: { role: "row" }, children: [...children] });

  const headerCells: HTMLElement[] = [el("span", {
    class: "db-faction-matrix-corner",
    attrs: { role: "columnheader" },
    text: "행 ↔ 열",
  })];
  for (let column = 0; column < table.size; column += 1) {
    headerCells.push(matrixHeader(table.names[column] ?? table.ids[column]!, table.ids[column]!, "columnheader"));
  }
  matrix.append(matrixRow(headerCells));

  for (let row = 0; row < table.size; row += 1) {
    const rowId = table.ids[row]!;
    const rowCells: HTMLElement[] = [matrixHeader(table.names[row] ?? rowId, rowId, "rowheader")];
    for (let column = 0; column < table.size; column += 1) {
      const columnId = table.ids[column]!;
      const cell = factionMatrixCell(table, factions, rowId, columnId);
      rowCells.push(stanceCell(rowId, columnId, cell.stance, cell.authored, rerender));
    }
    matrix.append(matrixRow(rowCells));
  }

  attachMatrixKeyboardNavigation(matrix, table.size);

  return sectionCard({
    title: "전체 관계표 (고급)",
    hint: "위 목록과 같은 값입니다 · 셀을 누르면 순서대로 바뀝니다",
    collapsible: true,
    collapsed: true,
    children: [
      noticeBar({
        text: "한 쌍은 양쪽이 같은 값으로 함께 바뀝니다. 서로 다르게 들어온 데이터는 전투처럼 더 적대적인 쪽이 적용됩니다.",
        testid: "db-faction-hostility-notice",
      }),
      el("div", {
        class: "db-faction-legend",
        attrs: { "aria-label": "태도 범례" },
        children: [
          ...STANCES.map((stance) => stanceLegend(stance)),
          el("span", { class: "db-faction-author-legend is-authored", text: "● 바꿈" }),
          el("span", { class: "db-faction-author-legend is-default", text: "○ 기본" }),
        ],
      }),
      el("div", { class: "db-faction-matrix-scroll", children: [matrix] }),
      el("p", {
        class: "db-ws-usage",
        text: "기본과 같은 칸은 저장하지 않습니다. 기본은 자기 자신 2(같은 편), 플레이어↔적 -1(적), 나머지 0(가만히 있음)입니다.",
      }),
    ],
    testid: "db-faction-matrix-card",
  });
}

/**
 * ARIA grid 키보드 패턴: **roving tabindex + 화살표 이동**.
 *
 * 화살표만 붙이는 것으로는 부족하다 — 셀이 전부 native `<button>` 이라 Tab 이 N² 번
 * 멈춘다(진영 6 개면 36 번). 그래서 활성 셀 하나만 `tabindex=0` 으로 두고 나머지는 `-1` 로
 * 내려, 격자 전체가 Tab 순회에서 **한 정거장**이 되게 한다.
 */
function attachMatrixKeyboardNavigation(matrix: HTMLElement, size: number): void {
  const cells = (): HTMLElement[] => Array.from(matrix.querySelectorAll<HTMLElement>(".db-faction-stance-cell"));

  const setRovingFocus = (index: number, moveFocus: boolean): void => {
    const list = cells();
    for (const [i, cell] of list.entries()) cell.tabIndex = i === index ? 0 : -1;
    if (moveFocus && typeof list[index]?.focus === "function") list[index]!.focus();
  };

  // 초기에는 첫 셀만 Tab 으로 닿는다.
  setRovingFocus(0, false);

  // 마우스/포커스로 다른 셀에 들어가면 그 셀이 새 Tab 정거장이 된다.
  matrix.addEventListener("focusin", (event) => {
    const index = cells().indexOf(event.target as HTMLElement);
    if (index >= 0) setRovingFocus(index, false);
  });

  matrix.addEventListener("keydown", (event) => {
    const deltas: Readonly<Record<string, readonly [number, number]>> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    const index = cells().indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    const nextRow = Math.floor(index / size) + delta[0];
    const nextColumn = (index % size) + delta[1];
    if (nextRow < 0 || nextRow >= size || nextColumn < 0 || nextColumn >= size) return;
    event.preventDefault();
    setRovingFocus(nextRow * size + nextColumn, true);
  });
}

function stanceCell(
  rowId: string,
  columnId: string,
  stance: FactionStance,
  authored: boolean,
  rerender: () => void,
): HTMLElement {
  const label = STANCE_LABEL[stance];
  const testid = `db-faction-stance-${rowId}-${columnId}`;
  // 대각선은 "같은 진영끼리"다. 런타임이 실제로 읽는 값이라(같은 진영 NPC 끼리 마주칠 때
  // effectiveFactionStance 가 이 쌍을 조회한다) 잠그지 않는다 — 내전을 저작하는 노브다.
  // 대신 무엇을 편집하는지 이름으로 밝힌다.
  const selfPair = rowId === columnId;
  const pairName = selfPair ? `${rowId} 내부(같은 진영끼리)` : `${rowId}와 ${columnId}`;
  const button = el("button", {
    class: `db-faction-stance-cell${authored ? " is-authored" : " is-default"}${selfPair ? " is-self-pair" : ""}`,
    attrs: {
      type: "button",
      role: "gridcell",
      "aria-label": `${pairName}: ${stance} ${label}, ${authored ? "바꿈" : "기본"}`,
      title: selfPair
        ? `${label} (${stance}) · 같은 진영끼리의 관계 — 적대로 두면 내전이 일어납니다`
        : `${label} (${stance}) · ${authored ? "저장된 설정" : "기본 관계"}`,
    },
    dataset: { testid, authored: authored ? "true" : "false" },
    children: [
      el("strong", { text: String(stance) }),
      el("span", { text: label }),
      el("small", { text: authored ? "● 바꿈" : "○ 기본" }),
    ],
    on: {
      click: () => {
        const next = STANCES[(STANCES.indexOf(stance) + 1) % STANCES.length]!;
        recordProjectSnapshot("진영 태도 변경");
        replaceFactions(setSparseFactionStance(store.getCurrent().factions, rowId, columnId, next));
        rerender();
        // rerender 는 셀 노드를 교체하므로 포커스가 body 로 떨어진다(실측). 값을 순환시키려면
        // 키보드 사용자가 매번 격자를 다시 훑어야 했다. 같은 좌표의 새 노드로 포커스를 옮긴다.
        restoreFocusAfterRerender(testid);
      },
    },
  });
  // 예외적으로 런타임 HP 바 색을 그대로 쓴다. 편집기와 플레이 화면에서 같은 관계가
  // 다른 색으로 읽히지 않게 하는 의도적 비토큰 값이며, 숫자/라벨/저작 표식도 함께 둔다.
  button.style.setProperty("--db-faction-stance-color", cssColor(stanceBarColor(stance)));
  return button;
}

function stanceLegend(stance: FactionStance): HTMLElement {
  const item = el("span", {
    class: "db-faction-stance-legend",
    text: `${stance} ${STANCE_LABEL[stance]}`,
  });
  item.style.setProperty("--db-faction-stance-color", cssColor(stanceBarColor(stance)));
  return item;
}

function matrixHeader(name: string, id: string, role: "columnheader" | "rowheader"): HTMLElement {
  return el("span", {
    class: `db-faction-matrix-head db-faction-matrix-${role === "rowheader" ? "row" : "column"}`,
    attrs: { role, title: `${name} (${id})` },
    children: [el("strong", { text: name }), el("small", { text: id })],
  });
}

/**
 * 식별 색 위의 이니셜 글자색을 배경 휘도에서 고른다.
 *
 * 흰색으로 고정해 두면 밝은 식별 색에서 글자가 사라진다 — 기본 플레이어 색(#7EC8F0)에서
 * 1.84:1 로 실측됐다(2026-09-01). 색은 사용자가 정하므로 고정색으로는 절대 보장할 수 없다.
 */
function readableTextOn(color: string): "#FFFFFF" | "#0F172A" {
  const hex = color.trim().replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return "#FFFFFF";
  const channel = (offset: number): number => {
    const value = Number.parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // 흰 글자 대비 = 1.05/(L+0.05), 검은 글자 대비 = (L+0.05)/0.05. 둘이 같아지는 지점이 L≈0.179.
  return luminance > 0.179 ? "#0F172A" : "#FFFFFF";
}

function factionSwatch(color: string, name: string): HTMLElement {
  const swatch = el("span", {
    class: "db-faction-hero-swatch",
    attrs: { role: "img", "aria-label": `${name} 식별 색` },
    dataset: { testid: "db-faction-color-preview" },
    text: name.slice(0, 1) || "F",
  });
  swatch.style.setProperty("--db-faction-color", color);
  swatch.style.setProperty("--db-faction-on-color", readableTextOn(color));
  return swatch;
}

function factionDefFor(factions: ProjectFactions | undefined, id: string): FactionDef {
  const authored = factions?.defs.find((def) => def.id === id);
  if (authored) return { ...authored };
  return { id, name: RESERVED_NAME[id] ?? id };
}

function factionDisplayName(factions: ProjectFactions | undefined, id: string): string {
  return factions?.defs.find((def) => def.id === id)?.name ?? RESERVED_NAME[id] ?? id;
}

function patchFaction(
  id: string,
  patch: Partial<Omit<FactionDef, "id">>,
  coalesceKey?: string,
  historyLabel?: string,
): void {
  if (coalesceKey) recordCoalescedSnapshot(coalesceKey, historyLabel);
  const current = store.getCurrent().factions;
  replaceFactions(upsertFactionDef(current, id, RESERVED_NAME[id] ?? id, patch));
}

function replaceFactions(factions: ProjectFactions | undefined): void {
  const normalized = normalizeProjectFactions(factions);
  store.update((project) => {
    if (normalized) project.factions = normalized;
    else delete project.factions;
  }, { scope: "database", collection: "factions" });
}

function createFaction(rerender: () => void): void {
  const current = store.getCurrent().factions;
  const id = nextFactionId(current);
  recordProjectSnapshot("진영 추가");
  replaceFactions(upsertFactionDef(current, id, "새 진영", {}));
  selectedFactionId = id;
  factionSearch = "";
  rerender();
}

function duplicateSelected(selected: FactionDef, rerender: () => void): void {
  const current = store.getCurrent().factions;
  const id = nextFactionId(current, selected.id.replace(/_\d+$/, "") || "faction");
  recordProjectSnapshot("진영 복제");
  replaceFactions(duplicateFaction(current, selected, id));
  selectedFactionId = id;
  factionSearch = "";
  rerender();
}

function removeSelected(id: string, rerender: () => void): void {
  const result = deleteFaction(store.getCurrent(), id);
  if (!result.ok) { toast(result.reason, "error"); return; }
  recordProjectSnapshot("진영 삭제");
  store.replace(result.project);
  selectedFactionId = PLAYER_FACTION_ID;
  toast("진영과 연결된 태도를 삭제했습니다. Ctrl+Z로 되돌릴 수 있습니다.", "ok");
  rerender();
}

function updateVisibleFactionName(id: string, name: string): void {
  const row = document.querySelector<HTMLElement>(`[data-testid='db-faction-row-${id}'] .db-list-name`);
  if (row) row.textContent = name || id;
  const hero = document.querySelector<HTMLElement>("[data-testid='db-faction-hero'] .db-ws-hero-title");
  if (hero) hero.textContent = name || id;
}

function colorInputValue(id: string, authored: string | undefined): string {
  const value = authored ?? factionColor(resolveFactionTable(store.getCurrent().factions), id);
  return /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : factionColor(resolveFactionTable(undefined), "unknown");
}

function cssColor(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function span(node: HTMLElement): HTMLElement {
  node.classList.add("db-ws-span");
  return node;
}
