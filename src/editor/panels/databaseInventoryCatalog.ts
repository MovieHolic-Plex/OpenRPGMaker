import { el } from "@/util/dom";
import { store } from "@/project/store";
import { addDatabaseRecord, duplicateDatabaseRecord } from "@/editor/databaseActions";
import { matchesNameOrId } from "@/editor/panels/databaseControls";
import { emptyState, listPane, listRow, listToolbar, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { aiGenerateButton, deleteButton, recordCategoryLabel, recordForm } from "@/editor/panels/databaseRecordViews";
import { createVirtualList } from "@/editor/panels/databaseListVirtualizer";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import {
  inventoryCatalogSession, listScrollTopForCollection, searchQueryForCollection,
  selectedRecordIdForSession, setListScrollTopForCollection, setSearchQueryForCollection,
  setSelectedRecordId, setViewModeForCollection, takeRecordRevealForSession, viewModeForCollection,
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
function entryKey(entry: CatalogEntry): string {
  return `${entry.collection}:${entry.record.id}`;
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

// Value snapshots: database edits clone records, including unchanged catalog fields.
type CatalogProjection = readonly [name: string, subtype: string, category: string, resourceId: string | undefined, url: string | null];
function projection(entry: CatalogEntry): CatalogProjection {
  const resourceId = entry.record.iconResourceId ?? entry.record.imageResourceId;
  return [entry.record.name, subtype(entry), category(entry), resourceId,
    resolveAssetResourceUrl(resourceId, { project: store.getCurrent() })];
}
function sameProjection(a: CatalogProjection, b: CatalogProjection): boolean {
  return a.every((value, index) => value === b[index]);
}

/** One view over two collections. Search/filter updates never replace the input or inspector. */
export function renderInventoryCatalog(host: HTMLElement, rerender: () => void): void {
  const session = inventoryCatalogSession();
  const revealId = takeRecordRevealForSession(session.collection);
  if (revealId) {
    session.filter = "all"; session.subtype = "all";
    setSearchQueryForCollection("items", "");
  }
  const restoredScrollTop = listScrollTopForCollection("items");
  const initial = entries();
  const selected = initial.find(isSelected) ?? initial.find((entry) => entry.collection === session.collection) ?? initial[0];
  if (selected) setSelectedRecordId(selected.collection, selected.record.id);
  const detail = el("div", { class: "db-detail-pane oprn-record-detail-pane db-catalog-detail" });
  const rows = el("div", { class: "db-list db-ws-list db-catalog-rows", dataset: { testid: "db-catalog-rows" },
    attrs: { tabindex: "0", "aria-label": "아이템·장비 목록" } });
  // Only mounted DOM owns a projection; discarded windows have no strong cache references.
  const rowCache = new WeakMap<HTMLElement, { projection: CatalogProjection; gallery: boolean }>();
  let visibleEntries: CatalogEntry[] = [];
  let windowKeys: string[] = [];
  let windowGallery = viewModeForCollection("items") === "gallery";
  const mountedRows = (): HTMLElement[] => Array.from(rows.querySelectorAll<HTMLElement>(".db-list-row"));
  const mountedRow = (entry: CatalogEntry): HTMLElement | undefined => mountedRows().find((row) =>
    row.dataset.collection === entry.collection && row.dataset.recordId === entry.record.id);
  const scrollToSelected = (): void => {
    const index = visibleEntries.findIndex(isSelected);
    if (index >= 0) virtualList.scrollToIndex(index);
    setListScrollTopForCollection("items", rows.scrollTop);
  };
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
    scrollToSelected();
    search.focus({ preventScroll: true });
  };
  const refreshAfterMutation = (): void => {
    // New/duplicated/generated records must not disappear behind the old filter.
    session.filter = "all"; session.subtype = "all";
    setSearchQueryForCollection("items", "");
    setSelectedRecordId(session.collection, selectedRecordIdForSession(session.collection), { reveal: true });
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
    let previous = projection(entry);
    const refreshProjection = (): void => {
      const database = store.getCurrent().database;
      let current: CatalogEntry | undefined;
      if (entry.collection === "items") {
        const record = database.items.find((record) => record.id === entry.record.id);
        if (record) current = { collection: "items", record };
      } else {
        const record = database.equipment.find((record) => record.id === entry.record.id);
        if (record) current = { collection: "equipment", record };
      }
      if (!current) return;
      const next = projection(current);
      if (sameProjection(previous, next)) return;
      if (previous[1] !== next[1] || previous[2] !== next[2]) updateSubtypes();
      previous = next;
      renderRows();
    };
    form.addEventListener("input", refreshProjection);
    form.addEventListener("change", refreshProjection);
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
    const keys = visible.map(entryKey);
    const changed = gallery !== windowGallery || keys.length !== windowKeys.length
      || keys.some((key, index) => key !== windowKeys[index]);
    visibleEntries = visible;
    const indexByKey = new Map(keys.map((key, index) => [key, index]));
    const focused = document.activeElement;
    // Refresh just the mounted window before measuring it (including a mode change).
    for (const row of mountedRows()) {
      const index = indexByKey.get(`${row.dataset.collection}:${row.dataset.recordId}`);
      if (index !== undefined) renderRow(visible[index], index, row);
    }
    emptyHint.remove();
    if (changed) virtualList.setItems(keys);
    // Measure the first newly mounted row, then correct the initial fallback pitch.
    virtualList.render();
    windowKeys = keys; windowGallery = gallery;
    if (!visible.length) rows.append(emptyHint);
    if (focused instanceof HTMLElement && focused !== rows && document.activeElement !== focused) {
      if (rows.contains(focused)) focused.focus({ preventScroll: true });
      else if (focused.classList.contains("db-list-row")) rows.focus({ preventScroll: true });
    }
    setListScrollTopForCollection("items", rows.scrollTop);
    updateSelectionNotice();
  };
  const renderRow = (entry: CatalogEntry, index: number, existing = mountedRow(entry)): HTMLElement => {
    const gallery = viewModeForCollection("items") === "gallery";
    const next = projection(entry);
    const cached = existing && rowCache.get(existing);
    if (existing && existing.dataset.recordIndex !== String(index)) existing.dataset.recordIndex = String(index);
    if (existing && cached) {
      const row = existing;
      const active = isSelected(entry);
      if (row.getAttribute("aria-pressed") !== String(active)) {
        row.classList.toggle("active", active);
        row.setAttribute("aria-pressed", String(active));
      }
      const previous = cached.projection;
      if (!sameProjection(previous, next) || cached.gallery !== gallery) {
        const name = row.querySelector(".db-list-name");
        if (name) name.textContent = next[0] || "(이름 없음)";
        const sub = row.querySelector<HTMLElement>(".db-list-sub");
        if (sub) sub.textContent = sub.title = `${LABELS[entry.collection]} · ${next[2]}`;
        row.title = `${next[0]} (${entry.record.id})`;
        if (previous[0] !== next[0] || previous[3] !== next[3] || previous[4] !== next[4] || cached.gallery !== gallery) {
          const thumb = recordListThumbnail(entry.collection, entry.record, store.getCurrent(), gallery ? 48 : 24);
          row.querySelector(".db-list-thumb")?.remove();
          if (thumb) row.prepend(thumb);
        }
        row.classList.toggle("db-gallery-card", gallery);
        row.dataset.testid = `db-record-${gallery ? "card" : "row"}-${entry.record.id}`;
      }
      rowCache.set(row, { projection: next, gallery });
      return row;
    }
    const thumb = recordListThumbnail(entry.collection, entry.record, store.getCurrent(), gallery ? 48 : 24);
    const row = listRow({ name: entry.record.name, sub: `${LABELS[entry.collection]} · ${category(entry)}`,
      ...(thumb ? { thumb } : {}), active: isSelected(entry), title: `${entry.record.name} (${entry.record.id})`,
      testid: `db-record-${gallery ? "card" : "row"}-${entry.record.id}`,
      dataset: { recordId: entry.record.id, collection: entry.collection, recordIndex: String(index) },
      onSelect: () => {
        setSelectedRecordId(entry.collection, entry.record.id);
        // Keep row nodes and keyboard focus; only change selected styling and the inspector.
        for (const candidate of mountedRows()) {
          const active = candidate instanceof HTMLElement && candidate.dataset.collection === entry.collection && candidate.dataset.recordId === entry.record.id;
          candidate.classList.toggle("active", active); candidate.setAttribute("aria-pressed", String(active));
        }
        renderDetail(); renderActions(); updateSelectionNotice();
      },
    });
    if (gallery) row.classList.add("db-gallery-card");
    rowCache.set(row, { projection: next, gallery });
    return row;
  };
  const updateSelectionNotice = (): void => {
    const current = entries().find(isSelected);
    // Filtering and windowing are separate: an offscreen selection stays selected.
    const included = current && visibleEntries.some((entry) => entryKey(entry) === entryKey(current));
    selectionNotice.hidden = !current || Boolean(included);
    selectionNotice.replaceChildren(...(current && !included ? [el("button", {
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
  const emptyHint = emptyState({ title: initial.length ? "검색 결과가 없습니다" : "아직 항목이 없습니다",
    compact: true, testid: "db-record-list-empty", action: { label: "필터 지우기", onClick: revealSelected, testid: "db-record-list-empty-clear" } });
  const virtualList = createVirtualList<string>({
    items: [], container: rows, measureRows: true,
    rowHeight: windowGallery ? 140 : 36, columns: () => viewModeForCollection("items") === "gallery" ? 2 : 1,
    onScroll: (scrollTop) => {
      if (!rows.isConnected) return;
      setListScrollTopForCollection("items", scrollTop);
      // Native Tab can scroll a mounted button into view. Window replacement
      // reparents retained buttons, so restore their focus after that render.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && rows.contains(focused)) queueMicrotask(() => {
        if (rows.isConnected && rows.contains(focused) && document.activeElement === document.body) {
          focused.focus({ preventScroll: true });
        }
      });
    },
    renderRow: (_key, index) => renderRow(visibleEntries[index], index),
  });
  // Buttons retain native Enter/Space activation. Navigation crosses window boundaries
  // explicitly so Tab and End can reach records that do not yet exist in the DOM.
  rows.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !visibleEntries.length) return;
    const row = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".db-list-row") : null;
    const viewportTop = rows.getBoundingClientRect().top;
    const anchor = row ?? mountedRows().find((candidate) => candidate.getBoundingClientRect().bottom > viewportTop);
    const current = anchor ? Number(anchor.dataset.recordIndex) : Math.max(0, visibleEntries.findIndex(isSelected));
    const columns = viewModeForCollection("items") === "gallery" ? 2 : 1;
    const gap = anchor ? Number.parseFloat(getComputedStyle(anchor.parentElement ?? rows).rowGap) || 0 : 0;
    const pitch = anchor ? anchor.getBoundingClientRect().height + gap : (columns === 2 ? 148 : 37);
    const page = Math.max(1, Math.floor(rows.clientHeight / pitch)) * columns;
    let index: number;
    switch (event.key) {
      case "Home": index = 0; break;
      case "End": index = visibleEntries.length - 1; break;
      case "ArrowDown": index = row ? current + columns : current; break;
      case "ArrowUp": index = row ? current - columns : current; break;
      case "ArrowRight": if (columns === 1) return; index = current + 1; break;
      case "ArrowLeft": if (columns === 1) return; index = current - 1; break;
      case "PageDown": index = current + page; break;
      case "PageUp": index = current - page; break;
      case "Tab":
        if (!row) return;
        index = current + (event.shiftKey ? -1 : 1);
        if (index < 0 || index >= visibleEntries.length || mountedRow(visibleEntries[index])) return;
        break;
      default: return;
    }
    event.preventDefault();
    index = Math.max(0, Math.min(visibleEntries.length - 1, index));
    virtualList.scrollToIndex(index);
    mountedRow(visibleEntries[index])?.focus({ preventScroll: true });
    setListScrollTopForCollection("items", rows.scrollTop);
  });
  updateSubtypes(); renderDetail(); renderActions(); renderRows();
  const restoreScroll = (): void => {
    if (!rows.isConnected) return;
    if (revealId) scrollToSelected();
    else { rows.scrollTop = restoredScrollTop; virtualList.render(); }
    setListScrollTopForCollection("items", rows.scrollTop);
  };
  restoreScroll();
  // The caller may attach its host after this render; restore again after layout.
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(restoreScroll);
}
