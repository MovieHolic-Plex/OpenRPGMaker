import { el } from "@/util/dom";
import { matchesNameOrId, textField } from "@/editor/panels/databaseControls";
import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { createVirtualList } from "@/editor/panels/databaseListVirtualizer";
import {
  addDatabaseRecord,
  deleteDatabaseRecord,
  duplicateDatabaseRecord,
  generatedBattleEffectPackPendingChanges,
  generatedBattleEffectPackStatus,
  installGeneratedBattleEffectPack,
  type DatabaseCollection,
  updateDatabaseRecord,
} from "@/editor/databaseActions";
import { renderActorRecordForm } from "@/editor/panels/actorRecordView";
import { databaseReferenceMessage } from "@/editor/databaseReferences";
import { equipmentFields, itemFields, skillFields } from "@/editor/panels/databaseBasicRecordFields";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { recordIdentity } from "@/editor/panels/databaseRecordIdentity";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { renderEquipmentRecordForm, renderItemRecordForm, renderSkillRecordForm, renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { ITEM_TYPES, isEquipmentItemType } from "@/editor/panels/databaseItemRecordView";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import {
  categoryFilterForCollection,
  listScrollTopForCollection,
  resetRecordViewSessionState,
  searchQueryForCollection,
  selectedRecordForSession,
  selectedRecordIdForSession,
  setCategoryFilterForCollection,
  setListScrollTopForCollection,
  setSearchQueryForCollection,
  setSelectedRecordId,
  setViewModeForCollection,
  viewModeForCollection,
  type RecordViewMode,
} from "@/editor/panels/databaseRecordViewSession";
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import type { DatabaseRecords, EquipmentRecord, ItemRecord } from "@/project/types";

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

// 갤러리 카드 그리드 상수 — 48px 썸네일(recordListThumbnail size 파라미터), 카드 행 높이
// (가상화 rowHeight), 열 수 분기 기준(모달 창 폭 ≤1100px → 3열, 초과 → 4열).
const GALLERY_THUMB_SIZE = 48;
const GALLERY_ROW_HEIGHT = 124;
const GALLERY_COLUMNS_BREAKPOINT = 1100;
const GALLERY_COLUMNS_NARROW = 3;
const GALLERY_COLUMNS_WIDE = 4;

// 카테고리 필터 칩 라벨 — 아이템 종류는 databaseItemRecordView 의 ITEM_TYPES 상수 값과
// DB 자체 라벨(databaseControls.literalLabel, 아이템 폼 종류 드롭다운과 동일)을 따른다.
// 장비는 EquipmentRecord.slot 실값(weapon/shield/helmet/armor/accessory) 기준이다.
// 주의: EQUIPMENT_TYPES 는 ItemType 명명(body/head)이라 slot 도메인(armor/helmet)과
// 다르므로 칩 id 는 slot 값을 쓴다(부위 라벨은 actorRecordBattlePanels EQUIPMENT_SLOTS 와 동일).
const ITEM_TYPE_CHIP_LABELS: Record<(typeof ITEM_TYPES)[number], string> = {
  normalGoods: "일반 물품",
  weapon: "무기",
  shield: "방패",
  body: "갑옷",
  head: "머리",
  accessory: "장신구",
  medicine: "약",
  book: "책",
  seed: "씨앗",
  special: "특수",
  switch: "스위치",
};

const EQUIPMENT_SLOT_CHIPS: readonly { readonly slot: EquipmentRecord["slot"]; readonly label: string }[] = [
  { slot: "weapon", label: "무기" },
  { slot: "shield", label: "방패" },
  { slot: "helmet", label: "머리" },
  { slot: "armor", label: "몸" },
  { slot: "accessory", label: "장신구" },
];

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
  const chips = categoryFilterChips(collection, rerender);
  listPane.append(
    el("h3", { text: COLLECTION_LABELS[collection] }),
    recordSearch(collection, rerender),
    ...(chips ? [chips] : []),
    listEl,
    recordListFooter(records.length),
    toolbar(collection, rerender),
  );
  renderDetail(selected?.id);
  const workspace = el("div", { class: `db-record-workspace rm2k3-record-workspace rm2k3-record-${collection}`, children: [listPane, detailPane] });
  if (collection === "enemies") {
    // 몬스터(적) 탭과 종족 탭의 역할 구분 안내. height:100% 워크스페이스가 배너에 밀리지 않도록
    // 셸(auto + 1fr)로 감싼다.
    host.append(
      el("div", {
        class: "db-record-intro-shell",
        children: [
          el("p", {
            class: "db-record-intro",
            dataset: { testid: "db-enemies-intro" },
            text: "이 탭은 전투에 등장하는 적·야생 몬스터의 스탯과 행동을 정의합니다. 잡아서 키우는 몬스터의 종족값·레벨업 스킬·진화는 [종족] 탭에서 설정합니다.",
          }),
          workspace,
        ],
      })
    );
    return;
  }
  host.append(workspace);
}

// 활성 레코드 행/카드만 갱신한다(다른 행/카드는 그대로 두어 스크롤/포커스 유지).
// 갤러리 카드(.db-gallery-card)와 리스트 행(.db-list-row)을 함께 다룬다. fake DOM 의
// 단일 클래스 셀렉터 한계 때문에 콤마 셀렉터 대신 별도 query 로 합친다.
function markActiveRow(listEl: HTMLElement, id: string): void {
  const rows = [
    ...Array.from(listEl.querySelectorAll(".db-list-row")),
    ...Array.from(listEl.querySelectorAll(".db-gallery-card")),
  ];
  for (const row of rows) {
    if (!(row instanceof HTMLElement)) continue;
    const rowId = row.dataset.recordId;
    if (!rowId) continue;
    const isActive = rowId === id;
    if (isActive) row.classList.add("active");
    else row.classList.remove("active");
    row.setAttribute("aria-pressed", String(isActive));
  }
}

// 필드 수정 시 해당 레코드 행/카드 라벨만 갱신한다(디테일 폼 재생성 없이 포커스 유지).
function updateRecordRowLabel(listEl: HTMLElement, id: string, name: string): void {
  const row =
    listEl.querySelector(`[data-testid='db-record-row-${id}']`) ??
    listEl.querySelector(`[data-testid='db-record-card-${id}']`);
  if (!(row instanceof HTMLElement)) return;
  const nameNode = row.querySelector(".db-list-name") ?? row.querySelector(".db-gallery-name");
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
    deleteButton(collection, rerender),
    ...(collection === "battleAnimations" ? [generatedEffectInstallButton(rerender)] : []),
    viewToggle(collection, rerender)
  );
  return wrap;
}

function generatedEffectInstallButton(rerender: () => void): HTMLElement {
  const status = generatedBattleEffectPackStatus();
  const pending = generatedBattleEffectPackPendingChanges(status);
  const button = el("button", {
    class: "btn small",
    text: pending === 0 ? `이펙트 ${status.totalAnimations}종 적용됨` : `이펙트 ${status.totalAnimations}종 적용`,
    attrs: {
      type: "button",
      title: pending === 0
        ? "생성 이펙트와 기본 배우·직업·스킬·아이템 연결이 모두 적용되어 있습니다."
        : `누락 ${status.missingAnimations}종을 추가하고 기본 배우·직업·스킬·아이템 연결을 적용합니다.`,
    },
    dataset: { testid: "db-install-generated-effects" },
    on: {
      click: () => {
        if (pending === 0) return;
        const result = installGeneratedBattleEffectPack();
        setSelectedRecordId("battleAnimations", result.firstAnimationId);
        toast(
          `전투 이펙트 적용: 애니메이션 ${result.addedAnimations + result.updatedAnimations}종, 배우·직업 ${result.updatedActors + result.updatedClasses}개, 스킬 ${result.updatedSkills}개, 아이템 ${result.updatedItems}개`,
          "ok",
        );
        rerender();
      },
    },
  });
  if (pending === 0) (button as HTMLButtonElement).disabled = true;
  return button;
}

// 갤러리↔리스트 뷰 토글 — 컬렉션별 세션 상태만 전환하고 기존 rerender 경로로 목록 창을
// 다시 그린다(갤러리 카드 렌더링 자체는 후속 작업 범위). renderRecordTab 내부에서만
// 생성되므로 record 탭이 아닌 탭(요소/지형/유틸리티)에는 절대 나타나지 않는다.
function viewToggle(collection: DatabaseCollection, rerender: () => void): HTMLElement {
  const current = viewModeForCollection(collection);
  const toggleButton = (mode: RecordViewMode): HTMLElement => {
    const isActive = current === mode;
    const label = mode === "gallery" ? "갤러리" : "목록";
    return el("button", {
      class: `db-view-toggle${isActive ? " active" : ""}`,
      attrs: { "aria-pressed": String(isActive), type: "button", title: label },
      dataset: { testid: mode === "gallery" ? "db-view-toggle-gallery" : "db-view-toggle-list" },
      text: label,
      on: {
        click: () => {
          if (viewModeForCollection(collection) === mode) return;
          setViewModeForCollection(collection, mode);
          rerender();
        },
      },
    });
  };
  return el("div", { class: "db-view-toggle-group", children: [toggleButton("gallery"), toggleButton("list")] });
}

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

// 삭제는 원클릭 즉시 실행하지 않는다 — 같은 버튼을 DELETE_CONFIRM_WINDOW_MS 안에 한 번 더
// 눌러야 확정되는 2단계 확인이다(무확인 삭제로 인한 소실 사고 방지).
// armedRecordId 로 "어떤 레코드에 대해 armed 되었는지"를 추적한다 — 그렇지 않으면
// A 를 arm 한 뒤 3초 내 B 로 선택을 바꾸고 삭제를 다시 누르면 B 가 확인 없이
// 즉시 삭제되는 사고가 난다(armed 상태가 레코드 전환을 가로질러 생존).
function deleteButton(collection: DatabaseCollection, rerender: () => void): HTMLElement {
  let armedUntil = 0;
  let armedRecordId: string | null = null;
  let resetTimer: number | null = null;

  const button = el("button", {
    class: "btn danger small",
    text: DELETE_IDLE_LABEL,
    dataset: { testid: "db-delete-selected" },
    on: {
      click: () => {
        const selected = selectedRecordIdForSession(collection);
        if (!selected) return;

        // 참조 가드 실패는 어차피 삭제할 수 없는 시도이므로 기존처럼 즉시(1클릭) 에러를 알린다
        // — 확인 단계를 강제하지 않는다.
        const blockedMessage = databaseReferenceMessage(collection, selected);
        if (blockedMessage) {
          toast(blockedMessage, "error");
          return;
        }

        const now = Date.now();
        const isArmedForSelected = armedRecordId === selected && now <= armedUntil;
        if (!isArmedForSelected) {
          // 새로 arm 하는 대상이 이전 armed 대상과 달라도(레코드 전환) 그냥 이 레코드로
          // 다시 arm 한다 — 삭제하지 않고 "정말 삭제?" 상태와 타이머만 리셋.
          armedRecordId = selected;
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          if (resetTimer !== null) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            resetTimer = null;
            if (Date.now() >= armedUntil) {
              armedRecordId = null;
              button.textContent = DELETE_IDLE_LABEL;
              button.classList.remove("confirming");
            }
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          return;
        }

        armedUntil = 0;
        armedRecordId = null;
        button.textContent = DELETE_IDLE_LABEL;
        button.classList.remove("confirming");
        const result = deleteDatabaseRecord(collection, selected);
        if (!result.ok) {
          toast(result.message, "error");
          return;
        }
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        setSelectedRecordId(collection, store.getCurrent().database[collection][0]?.id);
        rerender();
      },
    },
  });
  return button;
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
  const searchQuery = searchQueryForCollection(collection);
  // 저장된 필터 id가 현재 컬렉션의 칩 목록에 없으면 'all'로 취급한다(손상/낡은
  // localStorage 값에서도 크래시 없이 전체 목록을 보여준다).
  const categoryFilter = effectiveCategoryFilter(collection);
  const visible: VisibleRow[] = [];
  let visibleIndex = 0;
  for (const [originalIndex, record] of records.entries()) {
    // 카테고리 필터와 검색어는 AND 결합한다.
    if (categoryFilter !== "all" && !matchesCategoryFilter(collection, record, categoryFilter)) continue;
    if (searchQuery && !matchesNameOrId(record.name, record.id, searchQuery)) continue;
    visibleIndex += 1;
    visible.push({ record, originalIndex, visibleIndex });
  }

  // 갤러리 모드 = 카드 그리드 + columns 가상화, 리스트 모드 = 기존 행 렌더 그대로.
  const isGallery = viewModeForCollection(collection) === "gallery";
  const virtualList = createVirtualList<VisibleRow>({
    items: visible,
    className: isGallery ? "db-list db-gallery" : "db-list",
    rowHeight: isGallery ? GALLERY_ROW_HEIGHT : undefined,
    columns: isGallery ? (container) => galleryColumnsFor(container) : undefined,
    onScroll: (scrollTop) => setListScrollTopForCollection(collection, scrollTop),
    renderRow: (entry) =>
      isGallery ? recordGalleryCard(collection, entry, onSelect) : recordListRow(collection, entry, records.length, onSelect),
  });

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
  const sub = recordCategoryLabel(collection, record);
  return el("button", {
    class: `db-list-row${thumb ? " db-list-row-has-thumb" : ""}${isSelected ? " active" : ""}`,
    attrs: { "aria-pressed": String(isSelected), title: `${record.name} (${record.id})`, type: "button" },
    dataset: { recordId: record.id, recordIndex: String(visibleIndex), recordName: record.name, recordTotal: String(total), testid: `db-record-row-${record.id}` },
    children: [
      el("span", { class: "db-list-number", text: `${ordinalLabel(originalIndex)}:` }),
      ...(thumb ? [thumb] : []),
      el("span", { class: "db-list-name", text: record.name || "(이름 없음)" }),
      ...(sub ? [el("span", { class: "db-list-sub", text: sub })] : []),
    ],
    on: { click: () => onSelect(record.id) },
  });
}

function scheduleFrame(run: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => run());
    return;
  }
  run();
}

// 갤러리 카드 — 48px 썸네일 + 이름 + 카테고리 태그(아이템 종류/장비 부위만, 그 외 컬렉션은
// 태그 없음). 선택은 기존 onSelect 재사용(active 토글 + 디테일 교체, 리스트 재빌드 없음).
function recordGalleryCard(
  collection: DatabaseCollection,
  entry: VisibleRow,
  onSelect: (id: string) => void
): HTMLElement {
  const { record, visibleIndex } = entry;
  const isSelected = selectedRecordIdForSession(collection) === record.id;
  const thumb = recordListThumbnail(collection, record, store.getCurrent(), GALLERY_THUMB_SIZE);
  const tag = galleryCategoryTag(collection, record);
  return el("button", {
    class: `db-gallery-card${isSelected ? " active" : ""}`,
    attrs: { "aria-pressed": String(isSelected), title: `${record.name} (${record.id})`, type: "button" },
    dataset: {
      recordId: record.id,
      recordIndex: String(visibleIndex),
      recordName: record.name,
      testid: `db-record-card-${record.id}`,
    },
    children: [
      el("span", {
        class: "db-gallery-thumb",
        children: [thumb ?? el("span", { class: "db-list-thumb empty", attrs: { "aria-hidden": "true" } })],
      }),
      el("span", { class: "db-gallery-name", text: record.name || "(이름 없음)" }),
      ...(tag ? [tag] : []),
    ],
    on: { click: () => onSelect(record.id) },
  });
}

// 카테고리 태그 — 기존 필드만 읽는다(아이템: record.type → ITEM_TYPES 라벨, 장비:
// record.slot → 부위 라벨). 그 외 컬렉션은 태그 없음(subtle/none).
function galleryCategoryTag(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number]
): HTMLElement | null {
  const label = recordCategoryLabel(collection, record);
  return label ? el("span", { class: "db-gallery-tag", text: label }) : null;
}

// 카테고리 라벨 — 갤러리 태그와 목록 서브라벨이 같은 소스를 공유한다.
function recordCategoryLabel(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number]
): string | null {
  if (collection === "items") {
    return ITEM_TYPE_CHIP_LABELS[(record as ItemRecord).type] ?? null;
  }
  if (collection === "equipment") {
    return EQUIPMENT_SLOT_CHIPS.find((entry) => entry.slot === (record as EquipmentRecord).slot)?.label ?? null;
  }
  return null;
}

// 갤러리 열 수 — DB 모달 창 폭 기준(≤1100px → 3열, 초과 → 4열). fake DOM 테스트는
// .database-modal-window 의 clientWidth 를 주입해 결정적으로 검증하고, 브라우저에서는
// createVirtualList 내부 ResizeObserver 가 렌더 폭 변화를 render() 로 연결한다.
function galleryColumnsFor(container: HTMLElement): number {
  const modal = container.closest<HTMLElement>(".database-modal-window");
  const width = typeof modal?.clientWidth === "number" ? modal.clientWidth : 0;
  return width > GALLERY_COLUMNS_BREAKPOINT ? GALLERY_COLUMNS_WIDE : GALLERY_COLUMNS_NARROW;
}

// 아이템/장비 카테고리 필터 칩 행 — 다른 컬렉션(배우/스킬/스위치 등)에서는 null.
// 클릭 시 세션 필터를 즉시 갱신하고 rerender 로 목록/갤러리를 다시 그린다(디바운스 없음).
function categoryFilterChips(collection: DatabaseCollection, rerender: () => void): HTMLElement | null {
  const chips: readonly { readonly id: string; readonly label: string }[] | null =
    collection === "items"
      ? ITEM_TYPES.map((type) => ({ id: type, label: ITEM_TYPE_CHIP_LABELS[type] }))
      : collection === "equipment"
        ? EQUIPMENT_SLOT_CHIPS.map(({ slot, label }) => ({ id: slot, label }))
        : null;
  if (!chips) return null;
  const current = effectiveCategoryFilter(collection);
  const row = el("div", { class: "db-filter-chips", attrs: { role: "group", "aria-label": "카테고리 필터" } });
  row.append(
    filterChipButton("all", "전체", current === "all", () => {
      if (categoryFilterForCollection(collection) === "all") return;
      setCategoryFilterForCollection(collection, "all");
      rerender();
    }),
    ...chips.map(({ id, label }) =>
      filterChipButton(id, label, current === id, () => {
        if (categoryFilterForCollection(collection) === id) return;
        setCategoryFilterForCollection(collection, id);
        rerender();
      })
    )
  );
  return row;
}

function filterChipButton(id: string, label: string, active: boolean, onClick: () => void): HTMLElement {
  return el("button", {
    class: `db-filter-chip${active ? " active" : ""}`,
    attrs: { "aria-pressed": String(active), type: "button" },
    dataset: { testid: `db-filter-chip-${id}` },
    text: label,
    on: { click: onClick },
  });
}

// 저장된 필터가 현재 컬렉션의 알려진 칩 id가 아니면 'all'로 취급한다.
function effectiveCategoryFilter(collection: DatabaseCollection): string {
  const stored = categoryFilterForCollection(collection);
  if (stored === "all") return "all";
  if (collection === "items") return ITEM_TYPES.includes(stored as (typeof ITEM_TYPES)[number]) ? stored : "all";
  if (collection === "equipment") return EQUIPMENT_SLOT_CHIPS.some((chip) => chip.slot === stored) ? stored : "all";
  return "all";
}

function matchesCategoryFilter(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number],
  filter: string
): boolean {
  if (collection === "items") return (record as ItemRecord).type === filter;
  if (collection === "equipment") return (record as EquipmentRecord).slot === filter;
  return true;
}

function recordForm(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number],
  rerender: () => void,
  onRename?: (name: string) => void
): HTMLElement {
  const form = el("section", { class: `db-detail-form rm2k3-detail-form rm2k3-detail-${collection}`, dataset: { testid: "db-detail-form" } });
  // items/equipment 는 모던 인스펙터 헤더가 db-field-name 을 소유한다(T9/T10) — 레거시 이름
  // 필드를 함께 그리면 동일 testid 가 두 개 생겨 Playwright strict-mode 가 깨진다.
  if (
    collection !== "classes" &&
    collection !== "enemies" &&
    collection !== "troops" &&
    collection !== "items" &&
    collection !== "equipment"
  )
    form.append(nameField(collection, record.id, record.name, onRename));
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
    case "items": {
      const item = store.getCurrent().database.items.find((entry) => entry.id === record.id) ?? store.getCurrent().database.items[0];
      if (item && !isEquipmentItemType(item.type)) itemFields(form, record.id);
      renderItemRecordForm(form, item, rerender);
      return form;
    }
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
    children: [el("span", { class: "rm2k3-record-count", text: `${count}개` })],
  });
}

function nameField(collection: DatabaseCollection, id: string, value: string, onRename?: (name: string) => void): HTMLElement {
  return textField("이름", "db-field-name", value, (next) => {
    updateDatabaseRecord(collection, id, { name: next });
    onRename?.(next);
  });
}
