import { el } from "@/util/dom";
import { store } from "@/project/store";
import { addDatabaseRecord, duplicateDatabaseRecord } from "@/editor/databaseActions";
import { matchesNameOrId } from "@/editor/panels/databaseControls";
import { emptyState, listPane, listRow, listToolbar, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { aiGenerateButton, deleteButton, recordCategoryLabel, recordForm } from "@/editor/panels/databaseRecordViews";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import {
  inventoryCatalogSession, listScrollTopForCollection, searchQueryForCollection,
  selectedRecordIdForSession, setListScrollTopForCollection, setSearchQueryForCollection,
  setSelectedRecordId, setViewModeForCollection, viewModeForCollection,
} from "@/editor/panels/databaseRecordViewSession";
import type { ItemRecord, EquipmentRecord } from "@/project/types";

type CatalogEntry =
  | { readonly collection: "items"; readonly record: ItemRecord }
  | { readonly collection: "equipment"; readonly record: EquipmentRecord };
const LABELS = { items: "아이템", equipment: "장비", all: "전체" } as const;
function entries(): CatalogEntry[] {
  const database = store.getCurrent().database;
  return [
    ...database.items.map((record): CatalogEntry => ({ collection: "items", record })),
    ...database.equipment.map((record): CatalogEntry => ({ collection: "equipment", record })),
  ];
}
function subtype(entry: CatalogEntry): string {
  return `${entry.collection}:${entry.collection === "items" ? entry.record.type : entry.record.slot}`;
}
function category(entry: CatalogEntry): string {
  return recordCategoryLabel(entry.collection, entry.record)
    ?? (entry.collection === "equipment" ? entry.record.slot : entry.record.type);
}
function isSelected(entry: CatalogEntry): boolean {
  return entry.collection === inventoryCatalogSession().collection
    && entry.record.id === selectedRecordIdForSession(entry.collection);
}

/** One view over two collections. Search/filter updates never replace the input or inspector. */
export function renderInventoryCatalog(host: HTMLElement, rerender: () => void): void {
  const session = inventoryCatalogSession();
  const initial = entries();
  const selected = initial.find(isSelected) ?? initial.find((entry) => entry.collection === session.collection) ?? initial[0];
  if (selected) setSelectedRecordId(selected.collection, selected.record.id);
  const detail = el("div", { class: "db-detail-pane oprn-record-detail-pane db-catalog-detail" });
  const rows = el("div", { class: "db-list db-ws-list db-catalog-rows", dataset: { testid: "db-catalog-rows" } });
  rows.scrollTop = listScrollTopForCollection("items");
  rows.addEventListener("scroll", () => setListScrollTopForCollection("items", rows.scrollTop));
  const count = el("span", { class: "db-ws-count", dataset: { testid: "db-catalog-count" }, attrs: { role: "status" } });
  const search = el("input", {
    attrs: { type: "search", placeholder: "아이템·장비 이름 또는 ID 검색", "aria-label": "아이템·장비 검색" },
    dataset: { testid: "db-catalog-search" }, value: searchQueryForCollection("items"),
  });
  const subtypeSelect = el("select", { attrs: { "aria-label": "종류 또는 장착 부위" }, dataset: { testid: "db-catalog-subtype" } });
  const filters = el("div", { class: "db-catalog-filters", attrs: { role: "group", "aria-label": "카탈로그 종류" } });
  const selectionNotice = el("div", { class: "db-catalog-selection-notice", dataset: { testid: "db-catalog-selection-notice" } });
  const actions = el("div", { class: "db-catalog-actions" });
  const viewToggle = el("div", { class: "db-view-toggle-group", attrs: { role: "group", "aria-label": "목록 보기 방식" } });
  const filterButtons = (["all", "items", "equipment"] as const).map((filter) => {
    const button = el("button", {
      class: "db-filter-chip", attrs: { type: "button" }, dataset: { testid: `db-catalog-filter-${filter}` },
      on: { click: () => { session.filter = filter; session.subtype = "all"; updateSubtypes(); renderRows(); } },
    });
    filters.append(button);
    return { filter, button };
  });
  for (const mode of ["list", "gallery"] as const) {
    viewToggle.append(el("button", {
      class: "db-view-toggle", text: mode === "list" ? "목록" : "갤러리",
      attrs: { type: "button" }, dataset: { testid: `db-view-toggle-${mode}` },
      on: { click: () => { setViewModeForCollection("items", mode); renderRows(); } },
    }));
  }
  const revealSelected = (): void => {
    session.filter = "all"; session.subtype = "all";
    setSearchQueryForCollection("items", ""); search.value = "";
    updateSubtypes(); renderRows();
    rows.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest" });
  };
  const refreshAfterMutation = (): void => {
    // New/duplicated/generated records must not disappear behind the old filter.
    session.filter = "all"; session.subtype = "all";
    setSearchQueryForCollection("items", "");
    rerender();
  };
  const renderActions = (): void => {
    const current = entries().find(isSelected);
    actions.replaceChildren(listToolbar((["items", "equipment"] as const).map((collection) => ({
      label: `+ ${LABELS[collection]}`, testid: `db-catalog-add-${collection}`,
      onClick: () => { setSelectedRecordId(collection, addDatabaseRecord(collection)); refreshAfterMutation(); },
    }))));
    const recordActions = listToolbar([{
      label: "복제", testid: "db-catalog-duplicate", disabled: !current,
      ariaLabel: current ? `선택한 ${LABELS[current.collection]} 복제` : "선택한 항목 복제",
      onClick: () => {
        if (!current) return;
        setSelectedRecordId(current.collection, duplicateDatabaseRecord(current.collection, current.record.id));
        refreshAfterMutation();
      },
    }]);
    if (current) recordActions.append(deleteButton(current.collection, rerender));
    const ai = aiGenerateButton("items", refreshAfterMutation);
    ai.textContent = "AI 아이템";
    recordActions.append(ai);
    actions.append(recordActions);
  };
  const renderDetail = (): void => {
    const entry = entries().find(isSelected);
    if (!entry) {
      detail.replaceChildren(emptyState({ title: "아이템 또는 장비를 만드세요", compact: true }));
      return;
    }
    const refreshForm = (): void => {
      const scrollTop = detail.querySelector(".db-ws-detail-body")?.scrollTop ?? 0;
      const focused = document.activeElement;
      const testid = focused instanceof HTMLElement ? focused.dataset.testid : undefined;
      renderDetail(); updateSubtypes(); renderRows();
      const body = detail.querySelector(".db-ws-detail-body");
      if (body) body.scrollTop = scrollTop;
      if (testid) detail.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.focus();
    };
    const form = recordForm(entry.collection, entry.record, refreshForm, host);
    form.addEventListener("input", renderRows);
    form.addEventListener("change", () => { updateSubtypes(); renderRows(); });
    detail.replaceChildren(form);
  };
  const updateSubtypes = (): void => {
    const options = new Map<string, string>();
    for (const entry of entries()) {
      if (session.filter !== "all" && entry.collection !== session.filter) continue;
      options.set(subtype(entry), `${LABELS[entry.collection]} · ${category(entry)}`);
    }
    if (!options.has(session.subtype)) session.subtype = "all";
    subtypeSelect.replaceChildren(el("option", { attrs: { value: "all" }, text: "모든 종류·부위" }),
      ...Array.from(options, ([value, text]) => el("option", { attrs: { value }, text })));
    subtypeSelect.value = session.subtype;
  };
  const renderRows = (): void => {
    const all = entries();
    const matching = all.filter(({ record }) => matchesNameOrId(record.name, record.id, search.value));
    const visible = matching.filter((entry) => (session.filter === "all" || entry.collection === session.filter)
      && (session.subtype === "all" || subtype(entry) === session.subtype));
    count.textContent = visible.length === all.length ? `${all.length}개` : `${visible.length}/${all.length}개`;
    count.dataset.visibleCount = String(visible.length); count.dataset.totalCount = String(all.length);
    for (const { filter, button } of filterButtons) {
      const total = filter === "all" ? matching.length : matching.filter((entry) => entry.collection === filter).length;
      button.textContent = `${LABELS[filter]} ${total}`;
      button.setAttribute("aria-pressed", String(session.filter === filter));
      button.classList.toggle("active", session.filter === filter);
    }
    const gallery = viewModeForCollection("items") === "gallery";
    rows.classList.toggle("db-catalog-gallery", gallery);
    for (const button of Array.from(viewToggle.children)) {
      const active = button instanceof HTMLElement && button.dataset.testid === `db-view-toggle-${gallery ? "gallery" : "list"}`;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    }
    const scrollTop = rows.scrollTop;
    rows.replaceChildren(...visible.map((entry) => {
      const thumb = recordListThumbnail(entry.collection, entry.record, store.getCurrent(), gallery ? 48 : 24);
      const row = listRow({ name: entry.record.name, sub: `${LABELS[entry.collection]} · ${category(entry)}`,
        ...(thumb ? { thumb } : {}), active: isSelected(entry), title: `${entry.record.name} (${entry.record.id})`,
        testid: `db-record-${gallery ? "card" : "row"}-${entry.record.id}`,
        dataset: { recordId: entry.record.id, collection: entry.collection },
        onSelect: () => {
          setSelectedRecordId(entry.collection, entry.record.id);
          // Keep row nodes and keyboard focus; only change selected styling and the inspector.
          for (const candidate of Array.from(rows.children)) {
            const active = candidate instanceof HTMLElement && candidate.dataset.collection === entry.collection && candidate.dataset.recordId === entry.record.id;
            candidate.classList.toggle("active", active); candidate.setAttribute("aria-pressed", String(active));
          }
          renderDetail(); renderActions(); updateSelectionNotice();
        },
      });
      if (gallery) row.classList.add("db-gallery-card");
      return row;
    }));
    if (!visible.length) rows.append(emptyState({ title: all.length ? "검색 결과가 없습니다" : "아직 항목이 없습니다",
      compact: true, testid: "db-record-list-empty", action: { label: "필터 지우기", onClick: revealSelected, testid: "db-record-list-empty-clear" } }));
    rows.scrollTop = scrollTop;
    updateSelectionNotice();
  };
  const updateSelectionNotice = (): void => {
    const current = entries().find(isSelected);
    const row = Array.from(rows.children).find((node) => node instanceof HTMLElement
      && node.dataset.collection === current?.collection && node.dataset.recordId === current?.record.id);
    selectionNotice.hidden = !current || Boolean(row);
    selectionNotice.replaceChildren(...(current && !row ? [el("button", {
      class: "db-ws-btn db-ws-btn-ghost", text: `선택 중: ${current.record.name} · 목록에서 보기`, attrs: { type: "button" },
      dataset: { testid: "db-catalog-reveal-selection" }, on: { click: revealSelected },
    })] : []));
  };
  search.addEventListener("input", () => { setSearchQueryForCollection("items", search.value); renderRows(); });
  subtypeSelect.addEventListener("change", () => { session.subtype = subtypeSelect.value; renderRows(); });
  const pane = listPane({ title: "카탈로그", search: el("div", { class: "db-search db-ws-search", children: [search] }),
    chips: el("div", { class: "db-catalog-controls", children: [filters, subtypeSelect, viewToggle, selectionNotice] }),
    rows: [], toolbar: actions,
  });
  pane.querySelector(".db-ws-list-head")?.append(count);
  pane.querySelector(".db-list")?.replaceWith(rows);
  const workspace = workspaceShell({ list: pane, detail, legacyClass: "oprn-record-workspace db-inventory-catalog", testid: "db-inventory-catalog" });
  host.append(workspace);
  updateSubtypes(); renderDetail(); renderActions(); renderRows();
}
