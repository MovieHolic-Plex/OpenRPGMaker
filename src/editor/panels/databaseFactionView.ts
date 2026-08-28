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
  normalizeProjectFactions,
  resolveFactionTable,
  stanceBarColor,
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
    count: table.size,
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
        { label: "전체 진영", value: String(table.size), hint: "예약 진영 포함", tone: "good" },
        { label: "저작한 관계", value: String(factions?.relations.length ?? 0), hint: "기본값과 다른 쌍" },
        {
          label: "선택 진영 관계",
          value: String((factions?.relations ?? []).filter((relation) => relation.a === selectedId || relation.b === selectedId).length),
          hint: "프로젝트에 기록됨",
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
            title: "행동 규칙",
            hint: "태도가 공격 허가라면, 성향이 실제 선공을 결정합니다",
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
  const aggression = el("select", { dataset: { testid: "db-faction-aggression" } }) as HTMLSelectElement;
  for (const value of AGGRESSIONS) aggression.append(el("option", {
    attrs: { value: String(value) },
    text: `${value} · ${aggressionLabel(value)}`,
  }));
  aggression.value = String(def.aggression ?? DEFAULT_AGGRESSION);
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
    field("선공 성향", aggression),
    field("NPC에게 전투불능 보호", el("label", {
      class: "db-faction-check",
      children: [protectedInput, el("span", { text: "HP 1에서 버팀 (플레이어 공격은 제외)" })],
    })),
  ];
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
    field("자동 평판 변화", el("label", {
      class: "db-faction-check",
      children: [enabledInput, el("span", { text: "플레이어가 NPC를 처치하면 관련 진영 태도에 반영" })],
    })),
    field("처치당 가중치", weightInput),
    el("p", {
      class: "db-ws-usage",
      text: config
        ? "가중치가 클수록 한 번의 처치가 평판에 더 크게 반영됩니다."
        : "끄면 처치로 진영 태도가 자동 변화하지 않습니다.",
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
  matrix.append(el("span", { class: "db-faction-matrix-corner", text: "행 ↔ 열" }));
  for (let column = 0; column < table.size; column += 1) {
    matrix.append(matrixHeader(table.names[column] ?? table.ids[column]!, table.ids[column]!, "columnheader"));
  }
  for (let row = 0; row < table.size; row += 1) {
    const rowId = table.ids[row]!;
    matrix.append(matrixHeader(table.names[row] ?? rowId, rowId, "rowheader"));
    for (let column = 0; column < table.size; column += 1) {
      const columnId = table.ids[column]!;
      const cell = factionMatrixCell(table, factions, rowId, columnId);
      matrix.append(stanceCell(rowId, columnId, cell.stance, cell.authored, rerender));
    }
  }

  return sectionCard({
    title: "태도 행렬",
    hint: "셀을 누르면 -2 → -1 → 0 → 1 → 2 순서로 바뀝니다",
    children: [
      noticeBar({
        text: "한 쌍을 대칭으로 편집합니다. 외부 JSON에서 양방향 값이 다르면 전투와 같이 더 적대적인 값이 우선합니다.",
        testid: "db-faction-hostility-notice",
      }),
      el("div", {
        class: "db-faction-legend",
        attrs: { "aria-label": "태도 범례" },
        children: [
          ...STANCES.map((stance) => stanceLegend(stance)),
          el("span", { class: "db-faction-author-legend is-authored", text: "● 저작됨" }),
          el("span", { class: "db-faction-author-legend is-default", text: "○ 기본값" }),
        ],
      }),
      el("div", { class: "db-faction-matrix-scroll", children: [matrix] }),
      el("p", {
        class: "db-ws-usage",
        text: "기본값과 같은 셀은 관계 항목을 쓰지 않습니다. 기본값은 같은 진영 2(동맹), player↔enemy -1(적), 나머지 0(중립)입니다.",
      }),
    ],
    testid: "db-faction-matrix-card",
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
  const button = el("button", {
    class: `db-faction-stance-cell${authored ? " is-authored" : " is-default"}`,
    attrs: {
      type: "button",
      role: "gridcell",
      "aria-label": `${rowId}와 ${columnId}: ${stance} ${label}, ${authored ? "저작됨" : "기본값"}`,
      title: `${label} (${stance}) · ${authored ? "프로젝트에 저작됨" : "런타임 기본값"}`,
    },
    dataset: { testid: `db-faction-stance-${rowId}-${columnId}`, authored: authored ? "true" : "false" },
    children: [
      el("strong", { text: String(stance) }),
      el("span", { text: label }),
      el("small", { text: authored ? "● 저작" : "○ 기본" }),
    ],
    on: {
      click: () => {
        const next = STANCES[(STANCES.indexOf(stance) + 1) % STANCES.length]!;
        recordProjectSnapshot("진영 태도 변경");
        replaceFactions(setSparseFactionStance(store.getCurrent().factions, rowId, columnId, next));
        rerender();
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

function factionSwatch(color: string, name: string): HTMLElement {
  const swatch = el("span", {
    class: "db-faction-hero-swatch",
    attrs: { role: "img", "aria-label": `${name} 식별 색` },
    dataset: { testid: "db-faction-color-preview" },
    text: name.slice(0, 1) || "F",
  });
  swatch.style.setProperty("--db-faction-color", color);
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
