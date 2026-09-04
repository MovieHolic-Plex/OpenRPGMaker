// panels/structureKitDbTab.ts
// 데이터베이스 '구조물' 탭 — 타일셋 앨범 + 표 + 인스펙터 래스터.
// IA 규약:
// 1. 타일셋 레일은 필터가 아니라 앨범. 기본 앨범은 현재 맵 타일셋(editorState.currentMapId).
// 2. 표에는 선택된 타일셋의 구조물만 표시.
// 3. 빈 상태 정확한 카피: "이 타일셋에는 아직 구조물이 없습니다."
// 4. 인스펙터는 이 파일이 배치만 한다 — 내용·액션 계약은 structureKitInspector.ts 를 본다.
// 5. 원본(source) 칩은 앨범 안의 두 갈래 — 실내 오브젝트 · 내가 저장한 구조물. 실내 오브젝트는 실내 칩셋 전용.
// 6. 공간 종류(침실·주방 문법)는 형제 탭 tilesetSpacesTab 이 소유한다. 이 파일은 방 카드를 그리지 않는다.

import { editorState } from "@/editor/editorState";
import {
  createBlankStructureKit,
  conceptThingsReferencingKit,
  deleteStructureKit,
  duplicateIntoTileset,
} from "@/editor/harnessSuggestion/structureKitActions";
import { serializeStructureKitFile, structureKitFileName } from "@/editor/harnessSuggestion/structureKitFile";
import { assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { structureKitSize } from "@/editor/harnessSuggestion/structureKitModel";
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_TILESET_ID, seedDefaultInteriorCatalog } from "@/editor/interiorRoomPipeline";
import { makeDatabaseTabIcon } from "@/editor/panels/databaseTabIcons";
import {
  albumEntries,
  albumEntryId,
  entriesForSource,
  interiorObjectThemeLabels,
  STRUCTURE_KIT_SOURCES,
  type StructureAlbumEntry,
  type StructureKitDbSource,
} from "@/editor/panels/structureKitDbSources";
import { openStructureKitEditor } from "@/editor/panels/structureKitEditorDialog";
import { pickAndImportStructureKits } from "@/editor/panels/structureKitImportDialog";
import {
  interiorObjectCanvas,
  partKindName,
  renderInspector,
  renderObjectInspector,
  setInspectorSelectedPartId,
} from "@/editor/panels/structureKitInspector";
import { clearSelectedTileset, getSelectedTilesetId, setSelectedTileset } from "@/editor/panels/tilesetSettingsPanel";
import { store } from "@/project/store";
import type {
  SectionStructureKitDef,
  StructureKitPart,
  StructureKitPartKind,
  TilesetDef,
} from "@/project/types";
import { downloadBlob } from "@/util/downloadBlob";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

interface ActiveSessionState {
  tilesetId: string | null;
  source: StructureKitDbSource;
  selectedKitId: string | null;
  selectedObjectId: string | null;
  searchQuery: string;
  checkedKitIds: Set<string>;
}

const session: ActiveSessionState = {
  tilesetId: null,
  source: "all",
  selectedKitId: null,
  selectedObjectId: null,
  searchQuery: "",
  checkedKitIds: new Set(),
};

export function resetStructureKitsTabSession(): void {
  session.tilesetId = null;
  session.source = "all";
  session.selectedKitId = null;
  session.selectedObjectId = null;
  setInspectorSelectedPartId(null);
  session.searchQuery = "";
  session.checkedKitIds.clear();
  clearSelectedTileset();
}

/**
 * 방금 만든(또는 복제한) 내 구조물로 선택을 옮긴다.
 *
 * **세 값을 함께 바꿔야 한다.** 선택 하나만 옮기면 다음 렌더에서 그 킷이 화면에서 사라진다:
 * 1. `selectedKitId` — 인스펙터가 볼 대상.
 * 2. `source` — 원본 칩이 "내장 건물"·"실내 오브젝트" 로 남아 있으면 `entriesForSource()` 가
 *    사용자 킷을 통째로 걸러내 사본이 `visibleEntries` 에 없다. ("전체" 는 사본도 보여 주니 그대로 둔다.)
 * 3. `searchQuery` — 검색어가 남아 있으면 `matchesQuery()` 가 사본 이름을 걸러낼 수 있다.
 *
 * 둘 중 하나만 어긋나도 renderStructureKitsTab 의 선택 복구 로직이 사본을 못 찾고
 * 즉시 `visibleEntries[0]` 으로 갈아치워, 선택 이동이 그 자리에서 무효화된다.
 */
export function focusUserStructureKit(kitId: string): void {
  session.selectedKitId = kitId;
  session.selectedObjectId = null;
  if (session.source !== "all" && session.source !== "user") session.source = "user";
  session.searchQuery = "";
  setInspectorSelectedPartId(null);
}

/** 새 킷·사본 공통 후처리 — 선택을 그 킷으로 옮기고 편집기까지 이어 준다. */
function enterStructureKitEditor(
  tilesetId: string,
  kitId: string,
  host: HTMLElement,
  rerender: () => void,
): void {
  focusUserStructureKit(kitId);
  rerender();
  refresh(host, rerender);
  openStructureKitEditor(tilesetId, kitId, () => {
    rerender();
    refresh(host, rerender);
  });
}

/** 실내 오브젝트를 내 구조물로 굳히고 그 사본을 바로 편집한다. */
function duplicateAndEdit(
  tilesetId: string,
  source: SectionStructureKitDef | InteriorObjectDef,
  host: HTMLElement,
  rerender: () => void,
): void {
  const copy = duplicateIntoTileset(tilesetId, source);
  // 실내 오브젝트 사본은 그림만 가져온다 — 인스펙터 경로와 같은 단서를 여기서도 준다.
  toast(
    "cells" in source
      ? `'${copy.name}' 을 만들었습니다 — 사본은 그림만 가져옵니다. AI 실내 방 채우기는 원본 카탈로그만 씁니다.`
      : `'${copy.name}' 을 만들었습니다 — 사본을 편집합니다`,
    "cells" in source ? "info" : "ok",
  );
  enterStructureKitEditor(tilesetId, copy.id, host, rerender);
}

/**
 * 표 행의 hover 액션 아이콘. mapList 의 `.map-tree-action` 규약을 그대로 따른다 —
 * 기본 `opacity:.55`, 행 hover/focus-within 에서 1.
 * `display:none` 으로 숨기지 않는다: 숨기면 키보드 포커스가 못 닿고,
 * 유닛 테스트의 FakeDom 은 `:hover` 같은 의사클래스를 몰라 요소를 아예 못 찾는다.
 */
function rowActionButton(
  glyph: string,
  label: string,
  testid: string,
  onClick: () => void,
  extraClass?: string,
): HTMLElement {
  return el("button", {
    class: extraClass ? `structure-kit-row-action ${extraClass}` : "structure-kit-row-action",
    attrs: { type: "button", title: label, "aria-label": label },
    text: glyph,
    dataset: { testid },
    on: {
      click: (event: Event) => {
        // 행 클릭(인스펙터 선택)·더블클릭과 겹치지 않게 한다.
        event.stopPropagation();
        onClick();
      },
    },
  });
}

export function renderStructureKitsTab(host: HTMLElement, rerender: () => void): void {
  host.dataset.testid = "db-detail-form";
  const current = store.getCurrent();
  const tilesets = Object.values(current.tilesets);

  // 타일셋 폴더 자식(통행·오토타일·미분류·구조물·공간 종류)은 칩셋 선택을 공유한다.
  // 앨범 클릭은 setSelectedTileset 도 같이 쓰므로 여기 재도입이 방금 고른 앨범을 덮지 않는다.
  // 테스트는 resetStructureKitsTabSession → clearSelectedTileset 으로 공유 선택을 비운다.
  const sharedTilesetId = getSelectedTilesetId();
  if (sharedTilesetId && current.tilesets[sharedTilesetId]) session.tilesetId = sharedTilesetId;
  if (!session.tilesetId || !current.tilesets[session.tilesetId]) {
    const currentMapId = editorState.get().currentMapId ?? current.startMapId;
    const currentMap = current.maps[currentMapId];
    session.tilesetId = currentMap?.tilesetId ?? tilesets[0]?.id ?? "";
  }

  let activeTileset = current.tilesets[session.tilesetId] ?? tilesets[0];
  if (activeTileset?.id === INTERIOR_ROOM_TILESET_ID && activeTileset.interiorRoomKinds === undefined) {
    store.update((project) => {
      const tileset = project.tilesets[activeTileset.id];
      if (!tileset || tileset.interiorRoomKinds !== undefined) return;
      seedDefaultInteriorCatalog(tileset);
    }, { scope: "database", label: "실내 가구·방 종류 시드" });
    activeTileset = store.getCurrent().tilesets[session.tilesetId] ?? tilesets[0];
  }
  // 팔레트 선반과 같은 규약: 실내 오브젝트 → 등록 킷 순.
  const allEntries = albumEntries(activeTileset);
  const query = session.searchQuery.trim().toLowerCase();
  const visibleEntries = entriesForSource(allEntries, session.source)
    .filter((entry) => matchesQuery(entry, query));

  // 체크는 지금 보이는 행에만 뜻이 있다 — 원본 칩·검색으로 가려지면 그 선택은 화면에서 사라진다.
  // 푸터 개수·내보내기 버튼 라벨·실제 내보내기 대상을 전부 이 한 배열에서 갈라내 서로 어긋나지
  // 않게 한다. 지워진 킷의 남은 id 도 visibleEntries 에 없으니 따로 걸러낼 필요가 없다.
  const checkedVisibleKits: SectionStructureKitDef[] = visibleEntries.flatMap((entry) =>
    entry.kind === "kit" && entry.kit.kind === "section" && session.checkedKitIds.has(entry.kit.id) ? [entry.kit] : [],
  );

  // 선택 유효성 확인 — 보이는 행 안에서만 선택을 유지하고, 없으면 첫 행으로 되돌린다.
  // 이 재계산은 매 렌더 무조건 실행된다 — 인스펙터의 삭제·복제 액션이 지운 킷/오브젝트의
  // 선택을 저절로 걸러내므로, 그쪽에서 session.selectedKitId 를 따로 비우지 않는다.
  const selectedId = session.selectedObjectId ?? session.selectedKitId;
  const selectedEntry =
    visibleEntries.find((entry) => albumEntryId(entry) === selectedId) ?? visibleEntries[0] ?? null;
  session.selectedKitId = selectedEntry?.kind === "kit" ? selectedEntry.kit.id : null;
  session.selectedObjectId = selectedEntry?.kind === "object" ? selectedEntry.object.id : null;

  const selectedKit = selectedEntry?.kind === "kit" ? selectedEntry.kit : null;
  const selectedObject = selectedEntry?.kind === "object" ? selectedEntry.object : null;

  // 헤더 — 설명문 대신 아이콘 칩. 원래 문장은 "타일셋에 묶입니다. 한 타일셋의 구조물은 다른
  // 타일셋에 섞이지 않습니다." 였고 두 줄 75.7px 을 먹었다. 사실은 하나뿐이라 칩 하나로 옮긴다.
  host.append(
    el("header", {
      class: "db-tab-note",
      children: [
        el("h3", {
          text: "구조물",
          dataset: { testid: "structure-kit-heading" },
        }),
        el("span", {
          class: "db-tab-note-chip",
          children: [makeDatabaseTabIcon("tilesets"), el("span", { text: "타일셋별로 분리됨" })],
          attrs: { title: "한 타일셋의 구조물은 다른 타일셋에 섞이지 않습니다." },
        }),
      ],
    }),
  );

  const workspace = el("div", {
    class: "structure-kit-album-workspace",
    dataset: { testid: "structure-kit-album-workspace" },
  });
  host.append(workspace);

  // 1. 타일셋 레일 (앨범)
  const rail = el("div", {
    class: "structure-kit-album-rail",
    dataset: { testid: "structure-kit-album-rail" },
    children: [
      // 원본 개수는 「지금 고른 칩셋 안에서」의 수이고, 아래 타일셋 개수는 칩셋별 총계다.
      // 그냥 "원본" 이라고만 두면 전체 6 < 실내 28 처럼 서로 모순돼 보였다.
      el("div", {
        class: "structure-kit-album-rail-title",
        text: activeTileset ? `원본 — ${activeTileset.name} 안에서` : "원본",
        attrs: { title: "아래 「타일셋」 개수는 칩셋별 총계입니다." },
      }),
    ],
  });

  // 1-a. 원본 칩 — 개수는 그 원본이 지금 나열하는 행 수와 같다.
  for (const source of STRUCTURE_KIT_SOURCES) {
    const sourceCount = entriesForSource(allEntries, source.id).filter((entry) => matchesQuery(entry, query)).length;
    const isActiveSource = source.id === session.source;
    rail.append(
      el("button", {
        class: `structure-kit-source-item${isActiveSource ? " active" : ""}${sourceCount === 0 ? " zero" : ""}`,
        attrs: { type: "button" },
        dataset: { testid: `structure-kit-source-${source.id}` },
        children: [
          el("span", { text: source.label }),
          el("span", { class: "structure-kit-album-count", text: String(sourceCount) }),
        ],
        on: {
          click: () => {
            session.source = source.id;
            setInspectorSelectedPartId(null);
            refresh(host, rerender);
          },
        },
      }),
    );
  }

  rail.append(el("div", { class: "structure-kit-album-rail-title spaced", text: "타일셋" }));

  for (const tileset of tilesets) {
    const count = albumEntries(tileset).length;
    const isActive = tileset.id === activeTileset?.id;
    const item = el("button", {
      class: `structure-kit-album-item${isActive ? " active" : ""}${count === 0 ? " zero" : ""}`,
      attrs: { type: "button" },
      dataset: { testid: `structure-kit-tileset-${tileset.id}` },
      children: [
        el("span", { text: tileset.name }),
        el("span", { class: "structure-kit-album-count", text: String(count) }),
      ],
      on: {
        click: () => {
          session.tilesetId = tileset.id;
          setSelectedTileset(tileset.id);
          session.selectedKitId = null;
          session.selectedObjectId = null;
          setInspectorSelectedPartId(null);
          session.checkedKitIds.clear();
          refresh(host, rerender);
        },
      },
    });
    rail.append(item);
  }
  workspace.append(rail);

  // 2. 표 (가운데 열)
  const tableCol = el("div", { class: "structure-kit-table-col" });

  const tools = el("div", {
    class: "structure-kit-tools",
    children: [
      el("input", {
        class: "structure-kit-search",
        attrs: { type: "search", placeholder: "이름, 부위 검색" },
        value: session.searchQuery,
        on: {
          input: (event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            session.searchQuery = target.value;
            refresh(host, rerender);
          },
        },
      }),
      el("button", {
        class: "btn small primary",
        attrs: { type: "button" },
        text: "+ 새 구조물",
        dataset: { testid: "structure-kit-new" },
        on: {
          click: () => {
            const tilesetId = session.tilesetId;
            if (!tilesetId) return;
            enterStructureKitEditor(tilesetId, createBlankStructureKit(tilesetId).id, host, rerender);
          },
        },
      }),
    ],
  });
  tools.append(
    el("button", {
      class: "btn small",
      attrs: { type: "button" },
      text: "가져오기",
      dataset: { testid: "structure-kit-import" },
      on: { click: () => { if (session.tilesetId) pickAndImportStructureKits(session.tilesetId, () => { rerender(); refresh(host, rerender); }); } },
    }),
    el("button", {
      class: "btn small",
      attrs: { type: "button" },
      text: checkedVisibleKits.length > 0 ? "선택 내보내기" : "앨범 내보내기",
      dataset: { testid: "structure-kit-export" },
      on: {
        click: () => {
          if (!activeTileset) return;
          const targets = checkedVisibleKits.length > 0
            ? checkedVisibleKits
            : (activeTileset.structureKits ?? []).filter((kit) => kit.kind === "section");
          if (targets.length === 0) {
            toast("내보낼 구조물이 없습니다. 먼저 [+ 새 구조물]이나 [복제]로 만들어 주세요.", "info");
            return;
          }
          const text = serializeStructureKitFile(activeTileset, targets, new Date().toISOString());
          downloadBlob(new Blob([text], { type: "application/json" }), structureKitFileName(activeTileset.name, targets));
          toast(`구조물 ${targets.length}개를 내보냈습니다`, "ok");
        },
      },
    }),
  );
  tableCol.append(tools);

  if (allEntries.length === 0) {
    const emptyWrap = el("div", {
      class: "structure-kit-empty-wrap",
      dataset: { testid: "structure-kit-db-empty" },
      children: [
        el("strong", { text: "이 타일셋에는 아직 구조물이 없습니다." }),
        el("p", {
          class: "structure-kit-quiet",
          text: "[+ 새 구조물]로 바로 만들거나, 맵에서 타일 영역을 선택한 후 [구조물로 저장]을 누르면 이 앨범에 추가됩니다.",
        }),
      ],
    });
    tableCol.append(emptyWrap);
  } else if (visibleEntries.length === 0) {
    // 앨범 자체는 비지 않았다 — 지금 원본·검색·테마에 맞는 행만 없으니 조용한 안내만 둔다.
    tableCol.append(
      el("div", {
        class: "structure-kit-empty-wrap",
        dataset: { testid: "structure-kit-source-empty" },
        children: [
          el("strong", { text: `'${activeSourceLabel()}'에 해당하는 항목이 없습니다.` }),
          el("p", {
            class: "structure-kit-quiet",
            text: query
              ? "검색어를 지우거나 다른 원본을 골라 보세요."
              : "다른 원본을 고르면 이 앨범의 다른 구조물을 보실 수 있습니다.",
          }),
        ],
      }),
    );
  } else {
    const tableWrap = el("div", { class: "structure-kit-table-wrap" });
    const table = el("table", { class: "structure-kit-table" });
    const hasObjectRow = visibleEntries.some((entry) => entry.kind === "object");
    const hasKitRow = visibleEntries.some((entry) => entry.kind === "kit");
    const lastColumnLabel = hasObjectRow ? (hasKitRow ? "부위 · 테마" : "테마") : "부위";
    table.append(
      el("thead", {
        children: [
          el("tr", {
            children: [
              el("th", { class: "structure-kit-check-col", attrs: { style: "width: 28px;" } }),
              el("th", { attrs: { style: "width: 50%;" }, text: "이름" }),
              el("th", { text: "크기" }),
              el("th", { text: lastColumnLabel }),
              el("th", { class: "structure-kit-action-col", attrs: { "aria-label": "행 동작" } }),
            ],
          }),
        ],
      })
    );

    const tbody = el("tbody");
    for (const entry of visibleEntries) {
      if (entry.kind === "object") {
        tbody.append(
          renderObjectRow(activeTileset!, entry.object, entry.object.id === selectedObject?.id, host, rerender),
        );
        continue;
      }
      if (entry.kit.kind !== "section") continue;
      const kit = entry.kit;
      const isSelected = kit.id === selectedKit?.id;
      const size = structureKitSize(kit);
      const row = el("tr", {
        class: `structure-kit-row${isSelected ? " active" : ""}`,
        dataset: { testid: `structure-kit-db-${kit.id}` },
        children: [
          el("td", {
            class: "structure-kit-check-col",
            children: entry.source === "user"
              ? [
                  el("input", {
                    attrs: session.checkedKitIds.has(kit.id)
                      ? { type: "checkbox", checked: "" }
                      : { type: "checkbox" },
                    dataset: { testid: `structure-kit-check-${kit.id}` },
                    on: {
                      click: (event: Event) => {
                        // 행 클릭(인스펙터 선택)과 겹치지 않게 한다.
                        event.stopPropagation();
                        if (session.checkedKitIds.has(kit.id)) session.checkedKitIds.delete(kit.id);
                        else session.checkedKitIds.add(kit.id);
                        refresh(host, rerender);
                      },
                    },
                  }),
                ]
              : [],
          }),
          el("td", {
            children: [
              el("div", {
                class: "structure-kit-row-name",
                children: [
                  el("div", {
                    class: "structure-kit-row-thumb",
                    children: [
                      renderTileCellsToCanvas({
                        tileset: activeTileset,
                        widthTiles: size.width,
                        heightTiles: size.height,
                        cells: assembledKitCells(kit, size.width),
                        scale: 1,
                      }),
                    ],
                  }),
                  el("span", { text: kit.name ?? "구조물" }),
                ],
              }),
            ],
          }),
          el("td", {
            class: "structure-kit-row-meta",
            text: `${size.width}×${size.height}`,
          }),
          el("td", {
            children: renderPartBadges(kit.parts),
          }),
          el("td", {
            class: "structure-kit-action-col",
            children: [
              el("div", {
                class: "structure-kit-row-actions",
                children: [
                  rowActionButton("✎", "편집", `structure-kit-row-edit-${kit.id}`, () => {
                    enterStructureKitEditor(activeTileset!.id, kit.id, host, rerender);
                  }),
                  rowActionButton("⧉", "복제", `structure-kit-row-duplicate-${kit.id}`, () => {
                    duplicateAndEdit(activeTileset!.id, kit, host, rerender);
                  }),
                  rowActionButton("↓", "내보내기", `structure-kit-export-${kit.id}`, () => {
                    exportOneKit(activeTileset!, kit);
                  }),
                  rowActionButton("✕", "삭제", `structure-kit-db-delete-${kit.id}`, () => {
                    const refs = conceptThingsReferencingKit(activeTileset!.id, kit.id);
                    deleteStructureKit(activeTileset!.id, kit.id);
                    toast(
                      refs.length > 0
                        ? `'${kit.name ?? "구조물"}" 삭제 — 개념 꾸러미 ${refs.length}개 물건('${refs[0]!.thingLabel}' 외)의 그림이 고아가 됐다`
                        : `'${kit.name ?? "구조물"}" 삭제`,
                      refs.length > 0 ? "error" : "info",
                    );
                    setInspectorSelectedPartId(null);
                    rerender();
                    refresh(host, rerender);
                  }, "structure-kit-delete"),
                ],
              }),
            ],
          }),
        ],
        on: {
          click: () => {
            session.selectedKitId = kit.id;
            session.selectedObjectId = null;
            setInspectorSelectedPartId(null);
            refresh(host, rerender);
          },
          dblclick: () => {
            enterStructureKitEditor(activeTileset!.id, kit.id, host, rerender);
          },
        },
      });
      tbody.append(row);
    }
    table.append(tbody);
    tableWrap.append(table);
    tableCol.append(tableWrap);

    const footer = el("div", {
      class: "structure-kit-footer",
      children: [
        el("span", {
          text: checkedVisibleKits.length > 0
            ? `${checkedVisibleKits.length}개 선택됨`
            : `${visibleEntries.length}개`,
        }),
      ],
    });
    tableCol.append(footer);
  }

  workspace.append(tableCol);

  // 3. 인스펙터 (오른쪽 열)
  if (selectedObject && activeTileset) {
    workspace.append(
      renderObjectInspector(activeTileset, selectedObject, (kitId) =>
        enterStructureKitEditor(activeTileset.id, kitId, host, rerender))
    );
  } else if (selectedKit && selectedKit.kind === "section" && activeTileset) {
    // 편집 잠금의 축은 "프로젝트 데이터에 있나"(source)다.
    const editable = selectedEntry?.source === "user";
    workspace.append(
      renderInspector(
        activeTileset,
        selectedKit,
        editable,
        () => refresh(host, rerender),
        rerender,
        (kitId) => enterStructureKitEditor(activeTileset.id, kitId, host, rerender),
      )
    );
  }
}

/** 한 구조물만 파일로. 예전엔 인스펙터 액션 줄이었고, 지금은 행의 ↓ 아이콘이다. */
function exportOneKit(tileset: TilesetDef, kit: SectionStructureKitDef): void {
  const text = serializeStructureKitFile(tileset, [kit], new Date().toISOString());
  downloadBlob(new Blob([text], { type: "application/json" }), structureKitFileName(tileset.name, [kit]));
  toast(`'${kit.name ?? "구조물"}'을 내보냈습니다`, "ok");
}

/** 지금 고른 원본 칩의 한국어 이름. */
function activeSourceLabel(): string {
  return STRUCTURE_KIT_SOURCES.find((source) => source.id === session.source)?.label ?? "전체";
}

/** 검색어 매칭 — 킷은 이름·부위를, 오브젝트는 이름·테마 이름을 본다. */
function matchesQuery(entry: StructureAlbumEntry, query: string): boolean {
  if (!query) return true;
  if (entry.kind === "object") {
    if (entry.object.label.toLowerCase().includes(query)) return true;
    return interiorObjectThemeLabels(entry.object).some((label) => label.toLowerCase().includes(query));
  }
  if (entry.kit.kind !== "section") return true;
  const kit = entry.kit;
  if ((kit.name ?? "").toLowerCase().includes(query)) return true;
  // 어휘를 적을 수 있게 만든 값은 찾을 수 있어야 한다 — 태그·테마를 검색이 못 보면
  // 사람이 적어 넣은 뒤 다시 찾을 방법이 이름뿐이다.
  if ((kit.ai?.tags ?? []).some((tag) => tag.toLowerCase().includes(query))) return true;
  if ((kit.ai?.themes ?? []).some((theme) => theme.toLowerCase().includes(query))) return true;
  if ((kit.cellHints ?? []).some((hint) => (hint.note ?? "").toLowerCase().includes(query))) return true;
  return (kit.parts ?? []).some((part) =>
    partKindName(part.kind).includes(query) || (part.note ?? "").toLowerCase().includes(query),
  );
}

/** 실내 오브젝트 행 — 실래스터 썸네일 + 이름 + 크기 + 속한 테마. */
function renderObjectRow(
  tileset: TilesetDef,
  object: InteriorObjectDef,
  isSelected: boolean,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  return el("tr", {
    class: `structure-kit-row${isSelected ? " active" : ""}`,
    dataset: { testid: `structure-kit-object-${object.id}` },
    children: [
      el("td", { class: "structure-kit-check-col" }),
      el("td", {
        children: [
          el("div", {
            class: "structure-kit-row-name",
            children: [
              el("div", {
                class: "structure-kit-row-thumb",
                children: [interiorObjectCanvas(tileset, object, 1)],
              }),
              el("span", { text: object.label }),
            ],
          }),
        ],
      }),
      el("td", {
        class: "structure-kit-row-meta",
        text: `${object.width}×${object.height}`,
      }),
      el("td", { children: renderThemeBadges(object) }),
      el("td", {
        class: "structure-kit-action-col",
        children: [
          el("div", {
            class: "structure-kit-row-actions",
            children: [
              rowActionButton("⧉", "내 구조물로 복제", `structure-kit-row-duplicate-${object.id}`, () => {
                duplicateAndEdit(tileset.id, object, host, rerender);
              }),
            ],
          }),
        ],
      }),
    ],
    on: {
      click: () => {
        session.selectedObjectId = object.id;
        session.selectedKitId = null;
        setInspectorSelectedPartId(null);
        refresh(host, rerender);
      },
      dblclick: () => {
        // 카탈로그는 코드문이라 고칠 수 없다 — 킷 행과 같은 규약으로 사본을 만들어 연다.
        duplicateAndEdit(tileset.id, object, host, rerender);
      },
    },
  });
}

function renderThemeBadges(object: InteriorObjectDef): HTMLElement[] {
  const labels = interiorObjectThemeLabels(object);
  if (labels.length === 0) {
    return [el("span", { class: "structure-kit-part-badge none", text: "테마 없음" })];
  }
  return labels.map((label) => el("span", { class: "structure-kit-part-badge teal", text: label }));
}

function refresh(host: HTMLElement, rerender: () => void): void {
  while (host.firstChild) {
    host.removeChild(host.firstChild);
  }
  renderStructureKitsTab(host, rerender);
}

function renderPartBadges(parts?: StructureKitPart[]): HTMLElement[] {
  if (!parts || parts.length === 0) {
    return [el("span", { class: "structure-kit-part-badge none", text: "부위 없음" })];
  }
  const badges: HTMLElement[] = [];
  const countByKind = new Map<StructureKitPartKind, number>();
  for (const part of parts) {
    countByKind.set(part.kind, (countByKind.get(part.kind) ?? 0) + 1);
  }

  for (const [kind, count] of countByKind) {
    const badgeText = count > 1 ? `${partKindName(kind)} ×${count}` : partKindName(kind);
    const colorClass = kind === "window" ? "teal" : kind === "anchor" ? "gray" : "";
    badges.push(el("span", { class: `structure-kit-part-badge ${colorClass}`.trim(), text: badgeText }));
  }
  return badges;
}
