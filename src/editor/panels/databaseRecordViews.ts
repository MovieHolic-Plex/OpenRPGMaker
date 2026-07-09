import { el } from "@/util/dom";
import { matchesNameOrId, textField } from "@/editor/panels/databaseControls";
import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { createVirtualList } from "@/editor/panels/databaseListVirtualizer";
import {
  addDatabaseRecord,
  deleteDatabaseRecord,
  duplicateDatabaseRecord,
  type DatabaseCollection,
  updateDatabaseRecord,
} from "@/editor/databaseActions";
import { renderActorRecordForm } from "@/editor/panels/actorRecordView";
import { equipmentFields, itemFields, skillFields } from "@/editor/panels/databaseBasicRecordFields";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { recordIdentity } from "@/editor/panels/databaseRecordIdentity";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { renderEquipmentRecordForm, renderItemRecordForm, renderSkillRecordForm, renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import {
  listScrollTopForCollection,
  resetRecordViewSessionState,
  searchQueryForCollection,
  selectedRecordForSession,
  selectedRecordIdForSession,
  setListScrollTopForCollection,
  setSearchQueryForCollection,
  setSelectedRecordId,
} from "@/editor/panels/databaseRecordViewSession";
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import type { DatabaseRecords } from "@/project/types";

let searchRerenderTimer: number | null = null;

const COLLECTION_LABELS: Record<DatabaseCollection, string> = {
  actors: "주인공",
  classes: "직업",
  skills: "스킬",
  items: "아이템",
  equipment: "장비",
  enemies: "몬스터",
  troops: "적 그룹",
  states: "상태",
  battleAnimations: "전투 애니메이션",
};

export function renderRecordTab(host: HTMLElement, collection: DatabaseCollection, rerender: () => void): void {
  const records = store.getCurrent().database[collection];
  const selected = selectedRecordForSession(collection, records);
  const detailPane = el("div", { class: "db-detail-pane rm2k3-record-detail-pane" });

  // 디테일 폼만 부분 갱신한다(리스트/스크롤/검색 포커스는 유지).
  const renderDetail = (id: string | undefined): void => {
    const liveRecords = store.getCurrent().database[collection];
    const record = id ? liveRecords.find((entry) => entry.id === id) : undefined;
    if (!record) {
      detailPane.replaceChildren(el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" }, text: "레코드가 없습니다." }));
      return;
    }
    const index = liveRecords.findIndex((entry) => entry.id === record.id);
    const onRename = (next: string): void => updateRecordRowLabel(listEl, record.id, next);
    const form = recordForm(collection, record, rerender, onRename);
    form.classList.add("rm2k3-detail-form", `rm2k3-detail-${collection}`);
    detailPane.replaceChildren(recordIdentity(COLLECTION_LABELS[collection], record.id, record.name, index), form);
  };

  // 레코드 선택 시: 리스트를 통째로 재빌드하지 않고 활성 행 표시 + 디테일만 교체한다.
  const onSelect = (id: string): void => {
    setSelectedRecordId(collection, id);
    markActiveRow(listEl, id);
    renderDetail(id);
  };

  const listEl = recordList(collection, records, onSelect);
  const listPane = el("div", { class: "db-list-pane rm2k3-record-list-pane" });
  listPane.append(
    el("h3", { text: COLLECTION_LABELS[collection] }),
    recordSearch(collection, rerender),
    listEl,
    recordListFooter(records.length),
    toolbar(collection, rerender),
  );
  renderDetail(selected?.id);
  host.append(el("div", { class: `db-record-workspace rm2k3-record-workspace rm2k3-record-${collection}`, children: [listPane, detailPane] }));
}

// 활성 레코드 행만 갱신한다(다른 행은 그대로 두어 스크롤/포커스 유지).
function markActiveRow(listEl: HTMLElement, id: string): void {
  for (const row of Array.from(listEl.querySelectorAll(".db-list-row"))) {
    if (!(row instanceof HTMLElement)) continue;
    const rowId = row.dataset.recordId;
    if (!rowId) continue;
    const isActive = rowId === id;
    if (isActive) row.classList.add("active");
    else row.classList.remove("active");
    row.setAttribute("aria-pressed", String(isActive));
  }
}

// 필드 수정 시 해당 레코드 행 라벨만 갱신한다(디테일 폼 재생성 없이 포커스 유지).
function updateRecordRowLabel(listEl: HTMLElement, id: string, name: string): void {
  const row = listEl.querySelector(`[data-testid='db-record-row-${id}']`);
  if (!(row instanceof HTMLElement)) return;
  const nameNode = row.querySelector(".db-list-name");
  if (nameNode instanceof HTMLElement) nameNode.textContent = name || "(이름 없음)";
  row.dataset.recordName = name;
  row.setAttribute("title", `${name} (${id})`);
}

export function resetDatabaseRecordViewSession(): void {
  resetRecordViewSessionState();
  if (searchRerenderTimer === null) return;
  window.clearTimeout(searchRerenderTimer);
  searchRerenderTimer = null;
}

function toolbar(collection: DatabaseCollection, rerender: () => void): HTMLElement {
  const wrap = el("div", { class: "db-toolbar" });
  wrap.append(
    el("button", {
      class: "btn small",
      text: "+ 추가",
      dataset: { testid: "db-add-record" },
      on: {
        click: () => {
          setSelectedRecordId(collection, addDatabaseRecord(collection));
          rerender();
        },
      },
    }),
    el("button", {
      class: "btn small",
      text: "복제",
      on: {
        click: () => {
          const selected = selectedRecordIdForSession(collection);
          if (!selected) return;
          setSelectedRecordId(collection, duplicateDatabaseRecord(collection, selected));
          rerender();
        },
      },
    }),
    el("button", {
      class: "btn danger small",
      text: "삭제",
      dataset: { testid: "db-delete-selected" },
      on: {
        click: () => {
          const selected = selectedRecordIdForSession(collection);
          if (!selected) return;
          const result = deleteDatabaseRecord(collection, selected);
          if (!result.ok) {
            toast(result.message, "error");
            return;
          }
          setSelectedRecordId(collection, store.getCurrent().database[collection][0]?.id);
          rerender();
        },
      },
    })
  );
  return wrap;
}

function recordSearch(collection: DatabaseCollection, rerender: () => void): HTMLElement {
  const input = el("input", {
    attrs: { type: "search", placeholder: "레코드 검색" },
    value: searchQueryForCollection(collection),
  });
  input.addEventListener("input", () => {
    const cursor = input.selectionStart ?? input.value.length;
    setSearchQueryForCollection(collection, input.value);
    if (searchRerenderTimer !== null) window.clearTimeout(searchRerenderTimer);
    searchRerenderTimer = window.setTimeout(() => {
      searchRerenderTimer = null;
      rerender();
      restoreSearchFocus(".db-body .db-search input", cursor);
    }, 80);
  });
  return el("div", { class: "db-search", children: [input] });
}

function restoreSearchFocus(selector: string, cursor: number): void {
  requestAnimationFrame(() => {
    const next = document.querySelector<HTMLInputElement>(selector);
    if (!next) return;
    next.focus();
    next.setSelectionRange(cursor, cursor);
  });
}

type VisibleRow = {
  readonly record: DatabaseRecords[DatabaseCollection][number];
  readonly originalIndex: number;
  readonly visibleIndex: number;
};

function recordList(
  collection: DatabaseCollection,
  records: DatabaseRecords[DatabaseCollection],
  onSelect: (id: string) => void
): HTMLElement {
  const effectiveSearchQuery = collection === "classes" ? "" : searchQueryForCollection(collection);
  const visible: VisibleRow[] = [];
  let visibleIndex = 0;
  for (const [originalIndex, record] of records.entries()) {
    if (effectiveSearchQuery && !matchesNameOrId(record.name, record.id, effectiveSearchQuery)) continue;
    visibleIndex += 1;
    visible.push({ record, originalIndex, visibleIndex });
  }

  const virtualList = createVirtualList<VisibleRow>({
    items: visible,
    className: "db-list",
    onScroll: (scrollTop) => setListScrollTopForCollection(collection, scrollTop),
    renderRow: (entry) => recordListRow(collection, entry, records.length, onSelect),
  });

  // 직업 탭의 장식용 채움 행(가상화 대상이 아니며 항상 목록 뒤에 유지).
  if (collection === "classes" && records.length < 18) {
    virtualList.element.append(...classFillerRows(records.length));
  }

  // 탭 전환 후 되돌아올 때 리스트 스크롤 위치를 복원한다.
  const restoredScrollTop = listScrollTopForCollection(collection);
  if (restoredScrollTop > 0) {
    scheduleFrame(() => {
      virtualList.element.scrollTop = restoredScrollTop;
      virtualList.render();
    });
  }
  return virtualList.element;
}

function recordListRow(
  collection: DatabaseCollection,
  entry: VisibleRow,
  total: number,
  onSelect: (id: string) => void
): HTMLElement {
  const { record, originalIndex, visibleIndex } = entry;
  const isSelected = selectedRecordIdForSession(collection) === record.id;
  const thumb = recordListThumbnail(collection, record, store.getCurrent());
  return el("button", {
    class: `db-list-row${thumb ? " db-list-row-has-thumb" : ""}${isSelected ? " active" : ""}`,
    attrs: { "aria-pressed": String(isSelected), title: `${record.name} (${record.id})`, type: "button" },
    dataset: { recordId: record.id, recordIndex: String(visibleIndex), recordName: record.name, recordTotal: String(total), testid: `db-record-row-${record.id}` },
    children: [
      el("span", { class: "db-list-number", text: `${ordinalLabel(originalIndex)}:` }),
      ...(thumb ? [thumb] : []),
      el("span", { class: "db-list-name", text: record.name || "(이름 없음)" }),
    ],
    on: { click: () => onSelect(record.id) },
  });
}

function classFillerRows(startIndex: number): HTMLElement[] {
  const visualClassNames = ["마검사", "기사", "무투가", "도적", "해적", "사무라이", "닌자", "성기사", "암흑기사", "현자", "음유시인", "소환사"];
  const fillers: HTMLElement[] = [];
  for (let fillerIndex = startIndex; fillerIndex < 18; fillerIndex += 1) {
    const name = visualClassNames[fillerIndex - startIndex] ?? "";
    fillers.push(
      el("button", {
        class: "db-list-row db-list-row-visual-filler",
        attrs: { "aria-hidden": "true", disabled: "true", tabindex: "-1", type: "button" },
        children: [
          el("span", { class: "db-list-number", text: `${ordinalLabel(fillerIndex)}:` }),
          el("span", { class: "db-list-name", text: name }),
        ],
      })
    );
  }
  return fillers;
}

function scheduleFrame(run: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => run());
    return;
  }
  run();
}

function recordForm(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number],
  rerender: () => void,
  onRename?: (name: string) => void
): HTMLElement {
  const form = el("section", { class: `db-detail-form rm2k3-detail-form rm2k3-detail-${collection}`, dataset: { testid: "db-detail-form" } });
  if (collection !== "classes" && collection !== "enemies" && collection !== "troops") form.append(nameField(collection, record.id, record.name, onRename));
  switch (collection) {
    case "actors": {
      const actor = store.getCurrent().database.actors.find((entry) => entry.id === record.id);
      return actor ? renderActorRecordForm(actor, rerender) : form;
    }
    case "classes":
      renderClassRecordForm(form, store.getCurrent().database.classes.find((entry) => entry.id === record.id) ?? store.getCurrent().database.classes[0]);
      return form;
    case "skills":
      skillFields(form, record.id);
      renderSkillRecordForm(form, store.getCurrent().database.skills.find((entry) => entry.id === record.id) ?? store.getCurrent().database.skills[0]);
      return form;
    case "items":
      itemFields(form, record.id);
      renderItemRecordForm(form, store.getCurrent().database.items.find((entry) => entry.id === record.id) ?? store.getCurrent().database.items[0], rerender);
      return form;
    case "equipment":
      equipmentFields(form, record.id);
      renderEquipmentRecordForm(
        form,
        store.getCurrent().database.equipment.find((entry) => entry.id === record.id) ?? store.getCurrent().database.equipment[0],
        rerender
      );
      return form;
    case "enemies":
      renderEnemyRecordForm(form, store.getCurrent().database.enemies.find((entry) => entry.id === record.id) ?? store.getCurrent().database.enemies[0], rerender);
      return form;
    case "troops":
      renderTroopRecordForm(form, store.getCurrent().database.troops.find((entry) => entry.id === record.id) ?? store.getCurrent().database.troops[0], rerender);
      return form;
    case "states":
      renderStateRecordForm(form, store.getCurrent().database.states.find((entry) => entry.id === record.id) ?? store.getCurrent().database.states[0]);
      return form;
    case "battleAnimations":
      return renderBattleAnimationRecordForm(
        form,
        store.getCurrent().database.battleAnimations.find((entry) => entry.id === record.id) ?? store.getCurrent().database.battleAnimations[0]
      );
  }
}

function recordListFooter(count: number): HTMLElement {
  return el("div", {
    class: "rm2k3-record-list-footer",
    children: [
      el("button", { class: "database-footer-button rm2k3-maximum-button", text: "최대 개수", attrs: { disabled: "true", type: "button" } }),
      el("span", { class: "rm2k3-record-count", text: `${count}개` }),
    ],
  });
}

function nameField(collection: DatabaseCollection, id: string, value: string, onRename?: (name: string) => void): HTMLElement {
  return textField("이름", "db-field-name", value, (next) => {
    updateDatabaseRecord(collection, id, { name: next });
    onRename?.(next);
  });
}
