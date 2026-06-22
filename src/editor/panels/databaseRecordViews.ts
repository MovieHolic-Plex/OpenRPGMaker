import { el } from "@/util/dom";
import { textField } from "@/editor/panels/databaseControls";
import {
  addDatabaseRecord,
  deleteDatabaseRecord,
  duplicateDatabaseRecord,
  type DatabaseCollection,
  updateDatabaseRecord,
} from "@/editor/databaseActions";
import { renderActorRecordForm } from "@/editor/panels/actorRecordView";
import {
  animationFields,
  enemyFields,
  equipmentFields,
  itemFields,
  skillFields,
  skillPicker,
  troopFields,
} from "@/editor/panels/databaseBasicRecordFields";
import {
  renderClassRecordForm,
  renderEnemyRecordForm,
  renderEquipmentRecordForm,
  renderItemRecordForm,
  renderSkillRecordForm,
  renderTroopRecordForm,
} from "@/editor/panels/databaseAdvancedRecordViews";
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import type { DatabaseRecords } from "@/project/types";

const selectedIds: Partial<Record<DatabaseCollection, string>> = {};
let searchQuery = "";
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
  const selected = selectedRecord(collection);
  const listPane = el("div", { class: "db-list-pane" });
  listPane.append(toolbar(collection, rerender), recordSearch(rerender), recordList(collection, records, selected?.id ?? "", rerender));
  const detailPane = el("div", { class: "db-detail-pane" });
  if (!selected) {
    detailPane.append(el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" }, text: "레코드가 없습니다." }));
    host.append(el("h3", { text: COLLECTION_LABELS[collection] }), el("div", { class: "db-record-workspace", children: [listPane, detailPane] }));
    return;
  }
  detailPane.append(recordForm(collection, selected, rerender));
  host.append(el("h3", { text: COLLECTION_LABELS[collection] }), el("div", { class: "db-record-workspace", children: [listPane, detailPane] }));
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
          selectedIds[collection] = addDatabaseRecord(collection);
          rerender();
        },
      },
    }),
    el("button", {
      class: "btn small",
      text: "복제",
      on: {
        click: () => {
          const selected = selectedIds[collection];
          if (!selected) return;
          selectedIds[collection] = duplicateDatabaseRecord(collection, selected);
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
          const selected = selectedIds[collection];
          if (!selected) return;
          const result = deleteDatabaseRecord(collection, selected);
          if (!result.ok) {
            toast(result.message, "error");
            return;
          }
          selectedIds[collection] = store.getCurrent().database[collection][0]?.id;
          rerender();
        },
      },
    })
  );
  return wrap;
}

function recordSearch(rerender: () => void): HTMLElement {
  const input = el("input", {
    attrs: { type: "search", placeholder: "레코드 검색" },
    value: searchQuery,
  });
  input.addEventListener("input", () => {
    const cursor = input.selectionStart ?? input.value.length;
    searchQuery = input.value;
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

function recordList(
  collection: DatabaseCollection,
  records: DatabaseRecords[DatabaseCollection],
  selectedId: string,
  rerender: () => void
): HTMLElement {
  const list = el("div", { class: "db-list" });
  const query = searchQuery.toLowerCase();
  for (const record of records) {
    if (query && !record.name.toLowerCase().includes(query) && !record.id.toLowerCase().includes(query)) continue;
    list.append(
      el("button", {
        class: `db-list-row${record.id === selectedId ? " active" : ""}`,
        text: `${record.name} ${record.id}`,
        on: {
          click: () => {
            selectedIds[collection] = record.id;
            rerender();
          },
        },
      })
    );
  }
  return list;
}

function recordForm(collection: DatabaseCollection, record: DatabaseRecords[DatabaseCollection][number], rerender: () => void): HTMLElement {
  const form = el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" } });
  form.append(nameField(collection, record.id, record.name));
  switch (collection) {
    case "actors": {
      const actor = store.getCurrent().database.actors.find((entry) => entry.id === record.id);
      return actor ? renderActorRecordForm(actor, rerender) : form;
    }
    case "classes":
      renderClassRecordForm(form, store.getCurrent().database.classes.find((entry) => entry.id === record.id) ?? store.getCurrent().database.classes[0]);
      skillPicker(form, collection, record.id);
      return form;
    case "skills":
      skillFields(form, record.id);
      renderSkillRecordForm(form, store.getCurrent().database.skills.find((entry) => entry.id === record.id) ?? store.getCurrent().database.skills[0]);
      return form;
    case "items":
      itemFields(form, record.id);
      renderItemRecordForm(form, store.getCurrent().database.items.find((entry) => entry.id === record.id) ?? store.getCurrent().database.items[0]);
      return form;
    case "equipment":
      equipmentFields(form, record.id);
      renderEquipmentRecordForm(form, store.getCurrent().database.equipment.find((entry) => entry.id === record.id) ?? store.getCurrent().database.equipment[0]);
      return form;
    case "enemies":
      enemyFields(form, record.id);
      renderEnemyRecordForm(form, store.getCurrent().database.enemies.find((entry) => entry.id === record.id) ?? store.getCurrent().database.enemies[0]);
      return form;
    case "troops":
      troopFields(form, record.id);
      renderTroopRecordForm(form, store.getCurrent().database.troops.find((entry) => entry.id === record.id) ?? store.getCurrent().database.troops[0]);
      return form;
    case "states":
      form.append(textField("메시지", "db-field-state-message", record.name, () => undefined));
      return form;
    case "battleAnimations":
      animationFields(form, record.id, rerender);
      return form;
  }
}

function selectedRecord(collection: DatabaseCollection): DatabaseRecords[DatabaseCollection][number] | undefined {
  const records = store.getCurrent().database[collection];
  const selected = selectedIds[collection];
  const record = records.find((entry) => entry.id === selected) ?? records[0];
  selectedIds[collection] = record?.id;
  return record;
}

function nameField(collection: DatabaseCollection, id: string, value: string): HTMLElement {
  return textField("이름", "db-field-name", value, (next) => updateDatabaseRecord(collection, id, { name: next }));
}
