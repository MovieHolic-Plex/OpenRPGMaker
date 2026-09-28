import { equipmentSlots, equipmentSlotLabel, hasEquipmentSlot } from "@/project/equipmentSlots";
import { el } from "@/util/dom";
import { matchesNameOrId, textField } from "@/editor/panels/databaseControls";
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
import { renderActorStudioList } from "@/editor/panels/databaseActorStudio";
import { databaseReferenceMessage } from "@/editor/databaseReferences";
import { skillFields } from "@/editor/panels/databaseBasicRecordFields";
import { stopSkillAnimationStagesIn } from "@/editor/panels/databaseSkillAnimationStage";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { recordIdentity } from "@/editor/panels/databaseRecordIdentity";
import { emptyState } from "@/editor/panels/databaseWorkspace";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import {
  retroSkillClassFilters,
  retroSkillListBadge,
  setSkillClassFilter,
  skillClassFilterFor,
  skillMatchesRetroClass,
} from "@/editor/panels/databaseSkillRetroStage";
import { enemyPixelListBadge } from "@/editor/panels/databaseEnemyPixelPreview";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { renderEquipmentRecordForm, renderItemRecordForm, renderSkillRecordForm, renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { ITEM_TYPES } from "@/editor/panels/databaseItemRecordView";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { openMonsterResourceEditor } from "@/editor/panels/databaseMonsterResourceEditor";
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
  takeRecordRevealForSession,
  viewModeForCollection,
  type RecordViewMode,
} from "@/editor/panels/databaseRecordViewSession";
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import type { ActorRecord, DatabaseRecords, EquipmentRecord, ItemRecord } from "@/project/types";

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
  seed: "능력치 성장",
  special: "특수",
  switch: "장치 작동",
};

export function renderRecordTab(host: HTMLElement, collection: DatabaseCollection, rerender: () => void): void {
  const records = store.getCurrent().database[collection];
  const selected = selectedRecordForSession(collection, records);
  const detailPane = el("div", { class: "db-detail-pane oprn-record-detail-pane" });

  // 디테일 폼만 부분 갱신한다(리스트/스크롤/검색 포커스는 유지).
  const renderDetail = (id: string | undefined): void => {
    const liveRecords = store.getCurrent().database[collection];
    const record = id ? liveRecords.find((entry) => entry.id === id) : undefined;
    if (!record) {
      stopSkillAnimationStagesIn(detailPane);
      detailPane.replaceChildren(el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" }, text: "레코드가 없습니다." }));
      return;
    }
    const index = liveRecords.findIndex((entry) => entry.id === record.id);
    const onRename = (next: string): void => {
      updateRecordRowLabel(listEl, record.id, next);
      const selectedSummary = listPane.querySelector("[data-testid='db-actor-summary-selected']");
      if (selectedSummary instanceof HTMLElement) selectedSummary.textContent = next || "(이름 없음)";
    };
    const form = recordForm(collection, record, rerender, host, onRename);
    form.classList.add("oprn-detail-form", `oprn-detail-${collection}`);
    stopSkillAnimationStagesIn(detailPane);
    detailPane.replaceChildren(recordIdentity(COLLECTION_LABELS[collection], record.id, record.name, index), form);
  };

  // 레코드 선택 시: 리스트를 통째로 재빌드하지 않고 활성 행 표시 + 디테일만 교체한다.
  const onSelect = (id: string): void => {
    // 선택이 바뀌면 삭제 무장을 해제한다 — 툴바는 여기서 재빌드되지 않으므로 그냥 두면
    // A 를 arm 한 라벨(`정말 삭제?`)이 B 를 고른 뒤에도 남고, 그 상태에서 누른 첫 클릭은
    // 가드에 막혀 **아무 반응 없이 삼켜진다**(실측: 삭제까지 2클릭 필요). 상태는 안전했지만
    // 표시가 거짓말을 했다.
    disarmDelete(collection);
    setSelectedRecordId(collection, id);
    markActiveRow(listEl, id);
    renderDetail(id);
  };

  let listEl: HTMLElement;
  let listPane: HTMLElement;
  // 필터 통과 행은 **한 번만** 계산하고 목록·푸터가 같은 배열을 쓴다. 예전에는 목록이
  // 자체 필터를, 푸터가 필터 전 개수를 써서 "0행에 29개" 가 나왔다. 배우 스튜디오 경로도
  // 자체 인라인 필터(검색만, 카테고리 무시)를 들고 있어 같은 결함이 잠재해 있었다.
  const visible = visibleRecordRows(collection, records);
  const actorStudioActive = collection === "actors" && viewModeForCollection(collection) === "list";
  if (actorStudioActive) {
    const studio = renderActorStudioList({
      actors: records as ActorRecord[],
      filteredActors: visible.map((row) => row.record as ActorRecord),
      selectedId: selected?.id,
      project: store.getCurrent(),
      search: recordSearch(collection, rerender),
      footer: recordListFooter(visible.length, records.length),
      toolbar: toolbar(collection, rerender),
      onSelect,
    });
    listEl = studio.scrollRegion;
    listPane = studio.pane;
    // 부착 전 요소에 scrollTop 을 대입하면 브라우저가 무시한다(스크롤 범위가 0이라).
    // 여기서 바로 쓰면 아래 host.append 보다 먼저라 주인공 탭 스크롤 복원이 매번 no-op 였다.
    // 가상 목록 경로와 같은 규약으로 프레임 뒤에 복원한다.
    const restoredStudioScrollTop = listScrollTopForCollection(collection);
    if (restoredStudioScrollTop > 0) scheduleFrame(() => { listEl.scrollTop = restoredStudioScrollTop; });
    listEl.addEventListener("scroll", () => setListScrollTopForCollection(collection, listEl.scrollTop));
    detailPane.classList.add("db-studio-inspector-pane");
  } else {
    listEl = recordList(collection, records, visible, onSelect, rerender);
    listPane = el("div", { class: "db-list-pane oprn-record-list-pane" });
    const chips = categoryFilterChips(collection, rerender);
    // 제목과 개수를 한 줄(.db-ws-list-head)로 묶는다 — databaseWorkspace.listPane() 과 같은
    // 모양이라 두 세대 목록 창이 같은 CSS 를 받는다. 개수가 목록 아래 별도 행이던 시절엔
    // 툴바까지 세 줄이 목록 밑에 쌓였다(2026-09-03 30탭 실측).
    listPane.append(
      el("div", {
        class: "db-ws-list-head",
        children: [
          el("h3", { class: "db-ws-list-title", text: COLLECTION_LABELS[collection] }),
          recordListFooter(visible.length, records.length),
        ],
      }),
      recordSearch(collection, rerender),
      ...(chips ? [chips] : []),
      listEl,
      toolbar(collection, rerender),
    );
  }
  renderDetail(selected?.id);
  const studioClass = actorStudioActive ? " db-actor-studio-workspace" : "";
  const workspace = el("div", { class: `db-record-workspace oprn-record-workspace oprn-record-${collection}${studioClass}`, children: [listPane, detailPane] });
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
    ...(collection === "enemies" ? [el("button", {
      class: "btn small", text: "몬스터 소재", attrs: { type: "button" },
      dataset: { testid: "db-monster-resources-open" },
      on: { click: openMonsterResourceEditor },
    })] : []),
    el("button", {
      class: "btn small",
      text: "+ 추가",
      dataset: { testid: "db-add-record" },
      on: {
        click: () => {
          // reveal 없이 두면 새 레코드가 목록 끝에 붙기만 해서 스크롤 밖에 남고,
          // 카테고리 칩이 켜져 있으면 아예 안 보인다.
          setSelectedRecordId(collection, addDatabaseRecord(collection), { reveal: true });
          rerender();
        },
      },
    }),
    el("button", {
      class: "btn small",
      text: "복제",
      dataset: { testid: "db-duplicate-record" },
      on: {
        click: () => {
          const selected = selectedRecordIdForSession(collection);
          if (!selected) return;
          setSelectedRecordId(collection, duplicateDatabaseRecord(collection, selected), { reveal: true });
          rerender();
        },
      },
    }),
    deleteButton(collection, rerender),
    ...(collection === "items" || collection === "enemies" ? [aiGenerateButton(collection, rerender)] : []),
    ...(collection === "battleAnimations" ? [generatedEffectInstallButton(rerender)] : []),
    viewToggle(collection, rerender)
  );
  return wrap;
}

export function aiGenerateButton(collection: "items" | "enemies", rerender: () => void): HTMLElement {
  const kind = collection === "items" ? "item" : "enemy";
  return el("button", {
    class: "btn small",
    text: "AI로 생성",
    dataset: { testid: "db-ai-generate-open" },
    attrs: {
      type: "button",
      title: kind === "item"
        ? "설명을 주면 AI 가 아이템 레코드와 아이콘 그림을 만들어 등록합니다."
        : "설명을 주면 AI 가 적 레코드와 몬스터 그림을 만들어 등록합니다.",
    },
    on: {
      // 정적 import 금지: 이 모듈은 store 청크에서 초기화되는데 생성 모달은
      // aiDatabaseGeneration → applyChangesetToStore → 툴 레지스트리를 끌어와
      // 초기화 순환을 만든다. 실측(2026-08-30): 정적으로 묶으면 `npm run build:app`
      // 은 통과하지만 출하 번들 부팅이 `Cannot read properties of undefined
      // (reading 'deprecated')` 로 죽는다(dev·vitest 는 순환을 견뎌 못 잡는다).
      click: () => {
        void import("@/editor/panels/databaseAiGenerateDialog").then((module) => {
          module.openDatabaseAiGenerateDialog({ kind, rerender });
        });
      },
    },
  });
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
// 무장 상태를 컬렉션별 모듈 레지스트리에 둔다 — 버튼 클로저 안에만 있으면 `onSelect`(툴바를
// 재빌드하지 않는다)에서 해제할 방법이 없어 라벨이 낡는다.
type ArmedDelete = { recordId: string; until: number; button: HTMLElement; timer: number | null };
const ARMED_DELETE = new Map<DatabaseCollection, ArmedDelete>();

function disarmDelete(collection: DatabaseCollection): void {
  const armed = ARMED_DELETE.get(collection);
  if (!armed) return;
  if (armed.timer !== null) window.clearTimeout(armed.timer);
  ARMED_DELETE.delete(collection);
  armed.button.textContent = DELETE_IDLE_LABEL;
  armed.button.classList.remove("confirming");
  armed.button.setAttribute("aria-label", `선택한 ${COLLECTION_LABELS[collection]} 삭제`);
}

export function deleteButton(collection: DatabaseCollection, rerender: () => void): HTMLElement {
  // 툴바가 다시 그려지면 이전 버튼 참조는 죽는다 — 새 버튼이 주인이 되도록 등록을 비운다.
  disarmDelete(collection);

  const button = el("button", {
    class: "btn danger small",
    text: DELETE_IDLE_LABEL,
    // 탭마다 "삭제" 가 여러 개(레코드 · 하위 행 · 페이지)라 접근명만으로는 무엇을 지우는지
    // 알 수 없다. 보이는 글자는 좁은 툴바에 맞춰 두고 접근명에 컬렉션을 밝힌다.
    attrs: { "aria-label": `선택한 ${COLLECTION_LABELS[collection]} 삭제` },
    dataset: { testid: "db-delete-selected" },
    on: {
      click: () => {
        const selected = selectedRecordIdForSession(collection);
        if (!selected) return;

        // 선택은 필터와 무관하게 전체 목록에서 유지되므로, 칩·검색으로 가려진 레코드가
        // 선택된 채로 남을 수 있다. 그 상태의 2단계 확인은 **화면에 없는 레코드**를 겨냥한다
        // — 파괴 동작으로는 허용할 수 없다. 먼저 보이게 만들고 사용자에게 알린다.
        const records = store.getCurrent().database[collection];
        const isVisible = visibleRecordRows(collection, records).some((row) => row.record.id === selected);
        if (!isVisible) {
          disarmDelete(collection);
          setSelectedRecordId(collection, selected, { reveal: true });
          toast("선택한 레코드가 필터에 가려져 있었습니다. 목록에 표시했으니 확인하고 다시 누르세요.", "error");
          rerender();
          return;
        }

        // 참조 가드 실패는 어차피 삭제할 수 없는 시도이므로 기존처럼 즉시(1클릭) 에러를 알린다
        // — 확인 단계를 강제하지 않는다.
        const blockedMessage = databaseReferenceMessage(collection, selected);
        if (blockedMessage) {
          toast(blockedMessage, "error");
          return;
        }

        const now = Date.now();
        const armed = ARMED_DELETE.get(collection);
        const isArmedForSelected = armed?.recordId === selected && now <= armed.until;
        if (!isArmedForSelected) {
          // 새로 arm 하는 대상이 이전 armed 대상과 달라도(레코드 전환) 그냥 이 레코드로
          // 다시 arm 한다 — 삭제하지 않고 "정말 삭제?" 상태와 타이머만 리셋.
          disarmDelete(collection);
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          // 글자만 바뀌면 화면 낭독기는 여전히 「선택한 … 삭제」로 읽는다. 확인 단계임을 접근명에도 싣는다.
          button.setAttribute("aria-label", `${DELETE_CONFIRM_LABEL} 한 번 더 누르면 선택한 ${COLLECTION_LABELS[collection]}을(를) 삭제합니다`);
          const timer = window.setTimeout(() => {
            const current = ARMED_DELETE.get(collection);
            if (current && current.button === button && Date.now() >= current.until) disarmDelete(collection);
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          ARMED_DELETE.set(collection, { recordId: selected, until: now + DELETE_CONFIRM_WINDOW_MS, button, timer });
          return;
        }

        disarmDelete(collection);
        const result = deleteDatabaseRecord(collection, selected);
        if (!result.ok) {
          toast(result.message, "error");
          return;
        }
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        // 삭제 후 선택은 첫 레코드로 점프하는데, 스크롤은 기존 위치가 복원된다. reveal 이
        // 없으면 활성 행이 시야 밖에 있고, 다음 [삭제] 2단계 확인의 대상이 화면에 없는
        // 레코드가 된다 — 파괴 동작으로는 위험한 조합이다.
        setSelectedRecordId(collection, store.getCurrent().database[collection][0]?.id, { reveal: true });
        rerender();
      },
    },
  });
  return button;
}

function recordSearch(collection: DatabaseCollection, rerender: () => void): HTMLElement {
  // 문구는 그룹 안에서 통일한다 — 같은 동작(matchesNameOrId)에 "레코드 검색"/"종족 검색"/
  // "이름 또는 ID 검색" 세 문구가 섞여 있었다. 실제 술어를 그대로 적은 쪽으로 모은다.
  const placeholder = "이름 또는 ID 검색";
  const input = el("input", {
    attrs: { type: "search", placeholder, "aria-label": placeholder },
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

/**
 * 필터(카테고리 칩 + 검색어)를 통과한 행만 고른다.
 *
 * 목록 렌더와 카운트 배지가 **같은 술어**를 써야 한다. 이 함수를 분리하기 전에는
 * `recordList` 안에서만 필터링하고 푸터에는 `records.length`(필터 전)를 넘겨서,
 * 없는 이름을 검색하면 행 0 개인데 배지가 "29개"라고 말했다(2026-09-01 실측).
 */
function visibleRecordRows(
  collection: DatabaseCollection,
  records: DatabaseRecords[DatabaseCollection]
): VisibleRow[] {
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
  return visible;
}

function recordList(
  collection: DatabaseCollection,
  records: DatabaseRecords[DatabaseCollection],
  /** 호출부가 계산해 넘긴다 — 푸터 카운트와 같은 배열이어야 한다. */
  visible: readonly VisibleRow[],
  onSelect: (id: string) => void,
  rerender: () => void
): HTMLElement {
  const searchQuery = searchQueryForCollection(collection);
  const categoryFilter = effectiveCategoryFilter(collection);

  // 필터 결과가 0 이면 가상 목록 대신 빈 상태를 그린다. 빈 `.db-list` 만 남기면
  // 목록 창이 통째로 붕괴해(적 그룹에서 4px 로 실측) 검색을 지울 방법도 안 보인다.
  if (visible.length === 0) {
    const filtered = searchQuery.length > 0 || categoryFilter !== "all";
    // `db-ws-list` 도 함께 붙인다 — 빈 상태 중앙 정렬 규칙이 `.db-ws-list.db-ws-list-empty`
    // 로 선언돼 있어서 `db-list db-ws-list-empty` 만으로는 정렬이 적용되지 않는다.
    return el("div", {
      class: "db-list db-ws-list db-ws-list-empty",
      // role=status 는 아래 도달 불가였던 블록에만 있었다 — 살아 있는 경로로 옮긴다.
      // 목록이 0행이 된 이유는 보조기술에도 알려야 한다.
      attrs: { role: "status" },
      dataset: { testid: "db-list-empty" },
      children: [
        filtered
          ? emptyState({
            icon: "⌕",
            title: "검색 결과가 없습니다",
            // 컬렉션 이름을 조사와 붙이면 "몬스터이(가)" 처럼 어색해진다. 이름은 목록 창
            // 제목이 이미 말하고 있으므로 본문은 조사 없이 "항목"으로 둔다.
            body: searchQuery.length > 0
              ? `"${searchQuery}" 와 일치하는 항목이 없습니다.`
              : "이 분류에 해당하는 항목이 없습니다.",
            compact: true,
            testid: "db-record-list-empty",
            action: {
              label: "필터 지우기",
              onClick: () => {
                setSearchQueryForCollection(collection, "");
                setCategoryFilterForCollection(collection, "all");
                if (collection === "skills") setSkillClassFilter("all");
                rerender();
              },
              testid: "db-record-list-empty-clear",
            },
          })
          : emptyState({
            icon: "○",
            title: `${COLLECTION_LABELS[collection]} — 아직 없습니다`,
            body: "[+ 추가]로 첫 레코드를 만드세요.",
            compact: true,
            testid: "db-record-list-empty",
          }),
      ],
    });
  }

  // 갤러리 모드 = 카드 그리드 + columns 가상화, 리스트 모드 = 기존 행 렌더 그대로.
  const isGallery = viewModeForCollection(collection) === "gallery";
  const revealId = takeRecordRevealForSession(collection);
  const revealIndex = visible.findIndex((entry) => entry.record.id === revealId);
  const reveal = revealIndex >= 0;
  const virtualList = createVirtualList<VisibleRow>({
    items: visible,
    // 행 높이를 실측한다. 예전에는 enemies 한 컬렉션만 켜 두고 나머지 8개는 기본값
    // DEFAULT_ROW_HEIGHT=24 로 돌았는데 실제 행은 36px+gap 이라, 임계값(80) 을 넘는 큰
    // 컬렉션에서 스크롤 지도가 어긋났다(스크롤바 점프·행 순간이동).
    // 리스트 모드의 행은 .db-list-row 로 높이가 균일해 measureRows 의 CSS 계약을 만족한다.
    // 갤러리 카드는 이름 줄바꿈으로 높이가 달라질 수 있어 기존 고정 피치를 유지한다.
    measureRows: !isGallery,
    className: isGallery ? "db-list db-gallery" : "db-list",
    rowHeight: isGallery ? GALLERY_ROW_HEIGHT : undefined,
    columns: isGallery ? (container) => galleryColumnsFor(container) : undefined,
    onScroll: (scrollTop) => setListScrollTopForCollection(collection, scrollTop),
    renderRow: (entry) =>
      isGallery ? recordGalleryCard(collection, entry, onSelect) : recordListRow(collection, entry, records.length, onSelect),
  });

  // Related-record jumps override stale scroll once. Ordinary tab returns
  // retain their remembered position and virtual window.
  const restoredScrollTop = listScrollTopForCollection(collection);
  if (reveal || restoredScrollTop > 0) {
    scheduleFrame(() => {
      if (reveal) {
        virtualList.scrollToIndex(revealIndex);
        virtualList.element.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
        setListScrollTopForCollection(collection, virtualList.element.scrollTop);
      } else {
        virtualList.element.scrollTop = restoredScrollTop;
        virtualList.render();
      }
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
  // retro2003 도트 연출이 있는 스킬은 이펙트 시트 한 칸을, 손도트 시트가 있는 몬스터는 대기 칸을 썸네일 모서리 배지로 단다(행 그리드 열은 그대로).
  const badge = collection === "skills" ? retroSkillListBadge(record, 16)
    : collection === "enemies" ? enemyPixelListBadge((record as { monsterResourceId?: string }).monsterResourceId, 16) : null;
  if (badge && thumb) { thumb.classList.add("db-list-thumb-has-retro"); thumb.append(badge); }
  return el("button", {
    class: `db-list-row${thumb ? " db-list-row-has-thumb" : ""}${isSelected ? " active" : ""}`,
    attrs: { "aria-pressed": String(isSelected), title: `${record.name} (${record.id})`, type: "button" },
    dataset: { recordId: record.id, recordIndex: String(visibleIndex), recordName: record.name, recordTotal: String(total), testid: `db-record-row-${record.id}`, ...(badge ? { [collection === "enemies" ? "pixelSheet" : "retroFx"]: "true" } : {}) },
    children: [
      ...(thumb ? [thumb] : []),
      el("span", { class: "db-list-name", text: record.name || "(이름 없음)" }),
      ...(sub ? [el("span", { class: "db-list-sub", text: sub })] : []),
      el("span", { class: "db-list-number", text: `#${originalIndex + 1}` }),
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
  const badge = collection === "skills" ? retroSkillListBadge(record, 24)
    : collection === "enemies" ? enemyPixelListBadge((record as { monsterResourceId?: string }).monsterResourceId, 24) : null;
  if (badge && thumb) thumb.classList.add("db-list-thumb-has-retro");
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
        children: [thumb ?? el("span", { class: "db-list-thumb empty", attrs: { "aria-hidden": "true" } }), ...(badge ? [badge] : [])],
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
export function recordCategoryLabel(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number]
): string | null {
  if (collection === "items") {
    return ITEM_TYPE_CHIP_LABELS[(record as ItemRecord).type] ?? null;
  }
  if (collection === "equipment") {
    return equipmentSlotLabel(store.getCurrent(), (record as EquipmentRecord).slot);
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

// 아이템 카테고리는 11 종류다. 라벨만 있는 칩 12 개를 평평하게 흘리면 목록 창 상단이
// 세 줄(실측 88px)을 먹으면서도 어느 것이 소비품이고 어느 것이 장비인지, 각 종류에 몇
// 개가 있는지 알려주지 않는다. 그래서 저장값(ItemType)은 그대로 두고 **표시만** 개수
// 배지 + 소비/장비 묶음으로 나눈다. 칩 id·testid·필터 저장값은 불변이라 자동화 계약은
// 그대로다.
export const ITEM_CHIP_CLUSTERS: readonly { readonly caption: string; readonly types: readonly (typeof ITEM_TYPES)[number][] }[] = [
  // 첫 묶음은 캡션이 없다 — '전체' 바로 뒤에 붙는 무분류 물품이고, 캡션을 달면 한 줄이
  // 늘어나는 값에 비해 알려주는 게 없다.
  { caption: "", types: ["normalGoods"] },
  { caption: "소비", types: ["medicine", "book", "seed", "special", "switch"] },
  { caption: "장비", types: ["weapon", "shield", "body", "head", "accessory"] },
];

// 아이템/장비 카테고리 필터 칩 행 — 다른 컬렉션(배우/스킬/스위치 등)에서는 null.
// 클릭 시 세션 필터를 즉시 갱신하고 rerender 로 목록/갤러리를 다시 그린다(디바운스 없음).
// 개수는 **필터 적용 전 전체 컬렉션**에서 센다 — 필터된 배열로 세면 한 번 좁힌 뒤
// 다른 칩이 모두 0 으로 보인다.
function categoryFilterChips(collection: DatabaseCollection, rerender: () => void): HTMLElement | null {
  if (collection === "skills") return skillClassFilterChips(rerender);
  if (collection !== "items" && collection !== "equipment") return null;
  const current = effectiveCategoryFilter(collection);
  const counts = categoryCounts(collection);
  const total = store.getCurrent().database[collection].length;
  const chipFor = (id: string, label: string): HTMLElement =>
    filterChipButton(id, label, counts.get(id) ?? 0, current === id, () => {
      if (categoryFilterForCollection(collection) === id) return;
      setCategoryFilterForCollection(collection, id);
      rerender();
    });

  const allChip = filterChipButton("all", "전체", total, current === "all", () => {
    if (categoryFilterForCollection(collection) === "all") return;
    setCategoryFilterForCollection(collection, "all");
    rerender();
  });
  const row = el("div", { class: "db-filter-chips", attrs: { role: "group", "aria-label": "카테고리 필터" } });
  if (collection === "equipment") {
    row.append(chipCluster("", [allChip, ...equipmentSlots(store.getCurrent()).map(({ id, label }) => chipFor(id, label))]));
    return row;
  }
  // 캡션은 **자기 묶음 위 줄**에 둔다. 캡션을 칩과 같은 줄에 흘려보내면 줄바꿈 위치에 따라
  // "소비"/"장비" 가 줄 끝에 고아로 남아 어느 묶음의 머리인지 읽히지 않는다(실측).
  const [lead, ...rest] = ITEM_CHIP_CLUSTERS;
  row.append(chipCluster("", [allChip, ...(lead?.types ?? []).map((type) => chipFor(type, ITEM_TYPE_CHIP_LABELS[type]))]));
  for (const cluster of rest) {
    if (cluster.caption === "장비" && !cluster.types.some((type) => (counts.get(type) ?? 0) > 0)) continue;
    row.append(chipCluster(cluster.caption, cluster.types.map((type) => chipFor(type, ITEM_TYPE_CHIP_LABELS[type]))));
  }
  return row;
}

/**
 * 스킬 직업 필터(전사·수호자·마도사·정찰병·성직자·궁수). 직업 레코드도 계약 스킬도 없는 프로젝트는 칩 줄을 그리지 않는다.
 * 개수는 필터 전 전체 스킬에서 센다(아이템 칩과 같은 규칙).
 */
function skillClassFilterChips(rerender: () => void): HTMLElement | null {
  const project = store.getCurrent();
  const filters = retroSkillClassFilters(project);
  if (filters.length === 0) return null;
  const current = skillClassFilterFor(project);
  const skills = project.database.skills;
  const pick = (id: string) => () => {
    if (skillClassFilterFor(project) === id) return;
    setSkillClassFilter(id);
    rerender();
  };
  const row = el("div", { class: "db-filter-chips db-skill-class-chips", attrs: { role: "group", "aria-label": "직업 필터" } });
  row.append(chipCluster("", [
    filterChipButton("all", "전체", skills.length, current === "all", pick("all")),
    ...filters.map(({ id, label }) => filterChipButton(id, label, skills.filter((skill) => skillMatchesRetroClass(skill, id, project)).length, current === id, pick(id))),
  ]));
  return row;
}

function chipCluster(caption: string, chips: readonly HTMLElement[]): HTMLElement {
  return el("div", {
    class: "db-filter-cluster-group",
    children: [
      ...(caption ? [el("span", { class: "db-filter-cluster", text: caption })] : []),
      el("div", { class: "db-filter-cluster-chips", children: [...chips] }),
    ],
  });
}

/** 칩 id별 레코드 수. 아이템은 type, 장비는 slot 이 카테고리 키다. */
function categoryCounts(collection: "items" | "equipment"): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of store.getCurrent().database[collection]) {
    const key = collection === "items" ? (record as ItemRecord).type : (record as EquipmentRecord).slot;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function filterChipButton(id: string, label: string, count: number, active: boolean, onClick: () => void): HTMLElement {
  return el("button", {
    class: `db-filter-chip${active ? " active" : ""}${count === 0 ? " is-empty" : ""}`,
    attrs: { "aria-pressed": String(active), type: "button", "aria-label": `${label} ${count}개` },
    dataset: { testid: `db-filter-chip-${id}` },
    children: [
      el("span", { class: "db-filter-chip-label", text: label }),
      // 0 은 배지를 그리지 않는다 — 칩 11 개가 모두 배지를 달면 좁은 목록 창에서 한 줄이
      // 더 늘어나고, `is-empty` 흐림이 "비어 있다"를 이미 말한다.
      ...(count > 0 ? [el("span", { class: "db-filter-chip-count", text: String(count) })] : []),
    ],
    on: { click: onClick },
  });
}

// 저장된 필터가 현재 컬렉션의 알려진 칩 id가 아니면 'all'로 취급한다.
function effectiveCategoryFilter(collection: DatabaseCollection): string {
  // 스킬 직업 필터는 세션 메모리에만 있다(아이템·장비 localStorage 필터와 따로) — 저장값 검사보다 먼저 본다.
  if (collection === "skills") return skillClassFilterFor(store.getCurrent());
  const stored = categoryFilterForCollection(collection);
  if (stored === "all") return "all";
  if (collection === "items") return ITEM_TYPES.includes(stored as (typeof ITEM_TYPES)[number]) ? stored : "all";
  if (collection === "equipment") return hasEquipmentSlot(store.getCurrent(), stored) ? stored : "all";
  return "all";
}

function matchesCategoryFilter(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number],
  filter: string
): boolean {
  if (collection === "items") return (record as ItemRecord).type === filter;
  if (collection === "equipment") return (record as EquipmentRecord).slot === filter;
  if (collection === "skills") return skillMatchesRetroClass(record, filter, store.getCurrent());
  return true;
}

export function recordForm(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number],
  rerender: () => void,
  playbackOwner: HTMLElement,
  onRename?: (name: string) => void
): HTMLElement {
  const form = el("section", { class: `db-detail-form oprn-detail-form oprn-detail-${collection}`, dataset: { testid: "db-detail-form" } });
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
      return actor ? renderActorRecordForm(actor, rerender, onRename, "studio") : form;
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
      renderItemRecordForm(form, item, rerender);
      return form;
    }
    case "equipment":
      renderEquipmentRecordForm(
        form,
        store.getCurrent().database.equipment.find((entry) => entry.id === record.id) ?? store.getCurrent().database.equipment[0],
        rerender
      );
      return form;
    case "enemies":
      renderEnemyRecordForm(form, store.getCurrent().database.enemies.find((entry) => entry.id === record.id) ?? store.getCurrent().database.enemies[0], rerender, onRename);
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
        store.getCurrent().database.battleAnimations.find((entry) => entry.id === record.id) ?? store.getCurrent().database.battleAnimations[0],
        playbackOwner
      );
  }
}

/**
 * 목록 카운트. 필터가 걸려 있으면 `보이는/전체` 로 적어 "0개를 보여주면서 29개라고 말하는"
 * 상태를 만들지 않는다.
 */
function recordListFooter(visibleCount: number, totalCount: number): HTMLElement {
  const filtered = visibleCount !== totalCount;
  return el("div", {
    class: "oprn-record-list-footer",
    children: [el("span", {
      class: "oprn-record-count db-ws-count",
      text: filtered ? `${visibleCount}/${totalCount}개` : `${totalCount}개`,
      ...(filtered ? { attrs: { title: `필터로 ${totalCount}개 중 ${visibleCount}개만 보입니다` } } : {}),
    })],
  });
}

function nameField(collection: DatabaseCollection, id: string, value: string, onRename?: (name: string) => void): HTMLElement {
  return textField("이름", "db-field-name", value, (next) => {
    updateDatabaseRecord(collection, id, { name: next });
    onRename?.(next);
  });
}
