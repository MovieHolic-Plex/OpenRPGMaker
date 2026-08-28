// panels/structureKitDbTab.ts
// 데이터베이스 '구조물' 탭 — 타일셋 앨범 + 표 + 인스펙터 래스터.
// IA 규약:
// 1. 타일셋 레일은 필터가 아니라 앨범. 기본 앨범은 현재 맵 타일셋(editorState.currentMapId).
// 2. 표에는 선택된 타일셋의 구조물만 표시.
// 3. 빈 상태 정확한 카피: "이 타일셋에는 아직 구조물이 없습니다."
// 4. 인스펙터: 이름, 래스터, 부위 목록(인스턴스 번호), 문에서 입구 추정, 팔레트에서 쓰기, 삭제.
// 5. 원본(source) 칩은 앨범 안의 세 갈래 — 내장 건물 · 실내 오브젝트 · 내가 저장한 구조물. 실내 오브젝트는 실내 칩셋 전용.

import { editorState } from "@/editor/editorState";
import { createBlankStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { structureKitSize } from "@/editor/harnessSuggestion/structureKitModel";
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_TILESET_ID, type InteriorRoomTheme } from "@/editor/interiorRoomPipeline";
import {
  albumEntries,
  albumEntryId,
  entriesForSource,
  interiorObjectThemeLabels,
  interiorThemeCards,
  STRUCTURE_KIT_SOURCES,
  type StructureAlbumEntry,
  type StructureKitDbSource,
} from "@/editor/panels/structureKitDbSources";
import { openNewStructureKitDialog, openStructureKitEditor } from "@/editor/panels/structureKitEditorDialog";
import {
  interiorObjectCanvas,
  partKindName,
  renderInspector,
  renderObjectInspector,
  setInspectorSelectedPartId,
} from "@/editor/panels/structureKitInspector";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type {
  StructureKitPart,
  StructureKitPartKind,
  TilesetDef,
} from "@/project/types";
import { el } from "@/util/dom";

interface ActiveSessionState {
  tilesetId: string | null;
  source: StructureKitDbSource;
  selectedKitId: string | null;
  selectedObjectId: string | null;
  searchQuery: string;
  themeFilter: InteriorRoomTheme | null;
}

const session: ActiveSessionState = {
  tilesetId: null,
  source: "all",
  selectedKitId: null,
  selectedObjectId: null,
  searchQuery: "",
  themeFilter: null,
};

export function resetStructureKitsTabSession(): void {
  session.tilesetId = null;
  session.source = "all";
  session.selectedKitId = null;
  session.selectedObjectId = null;
  setInspectorSelectedPartId(null);
  session.searchQuery = "";
  session.themeFilter = null;
}

export function renderStructureKitsTab(host: HTMLElement, rerender: () => void): void {
  host.dataset.testid = "db-detail-form";
  const current = store.getCurrent();
  const tilesets = Object.values(current.tilesets);

  // 기본 앨범 결정: 현재 맵 타일셋
  if (!session.tilesetId || !current.tilesets[session.tilesetId]) {
    const currentMapId = editorState.get().currentMapId ?? current.startMapId;
    const currentMap = current.maps[currentMapId];
    const defaultTilesetId = currentMap?.tilesetId ?? tilesets[0]?.id ?? "";
    session.tilesetId = defaultTilesetId;
  }

  const activeTileset = current.tilesets[session.tilesetId] ?? tilesets[0];
  // 팔레트 선반과 같은 합집합 규약: 내장 파라메트릭 킷 → 실내 오브젝트 → 등록 킷 순.
  const allEntries = albumEntries(activeTileset);
  const query = session.searchQuery.trim().toLowerCase();
  const themeFilterActive = session.source === "interior" ? session.themeFilter : null;
  const visibleEntries = entriesForSource(allEntries, session.source)
    .filter((entry) => matchesQuery(entry, query))
    .filter((entry) => matchesThemeFilter(entry, themeFilterActive));

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

  // 헤더
  host.append(
    el("h3", { text: "구조물", dataset: { testid: "structure-kit-heading" } }),
    el("p", { text: "타일셋에 묶입니다. 한 타일셋의 구조물은 다른 타일셋에 섞이지 않습니다." })
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
      el("div", { class: "structure-kit-album-rail-title", text: "원본" }),
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
            if (source.id !== "interior") session.themeFilter = null;
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
          session.selectedKitId = null;
          session.selectedObjectId = null;
          setInspectorSelectedPartId(null);
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
            const openEditorFor = (kitId: string): void => {
              session.selectedKitId = kitId;
              session.selectedObjectId = null;
              rerender();
              refresh(host, rerender);
              openStructureKitEditor(tilesetId, kitId, () => {
                rerender();
                refresh(host, rerender);
              });
            };
            if (tilesetId !== DEFAULT_TILESET_ID) {
              openEditorFor(createBlankStructureKit(tilesetId).id);
              return;
            }
            openNewStructureKitDialog(tilesetId, openEditorFor);
          },
        },
      }),
    ],
  });
  tableCol.append(tools);

  // 2-a. 방 종류(테마) 문법 — 실내 오브젝트 원본에서만. AI 가 방을 채울 때 요구하는 역할을 그림으로 보여준다.
  if (session.source === "interior" && activeTileset?.id === INTERIOR_ROOM_TILESET_ID) {
    tableCol.append(renderThemeGrammar(activeTileset, themeFilterActive, host, rerender));
  }

  if (allEntries.length === 0) {
    const emptyWrap = el("div", {
      class: "structure-kit-empty-wrap",
      dataset: { testid: "structure-kit-db-empty" },
      children: [
        el("strong", { text: "이 타일셋에는 아직 구조물이 없습니다." }),
        el("p", {
          class: "structure-kit-quiet",
          text: "맵에서 타일 영역을 선택한 후 [구조물로 저장]을 누르면 이 앨범에 추가됩니다.",
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
              el("th", { attrs: { style: "width: 50%;" }, text: "이름" }),
              el("th", { text: "크기" }),
              el("th", { text: lastColumnLabel }),
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
      const kit = entry.kit;
      const isSelected = kit.id === selectedKit?.id;
      const size = structureKitSize(kit);
      const row = el("tr", {
        class: `structure-kit-row${isSelected ? " active" : ""}`,
        dataset: { testid: `structure-kit-db-${kit.id}` },
        children: [
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
        ],
        on: {
          click: () => {
            session.selectedKitId = kit.id;
            session.selectedObjectId = null;
            setInspectorSelectedPartId(null);
            refresh(host, rerender);
          },
          dblclick: () => {
            if (entry.source !== "user") return;
            openStructureKitEditor(activeTileset!.id, kit.id, () => {
              rerender();
              refresh(host, rerender);
            });
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
        el("span", { text: `${visibleEntries.length}개` }),
      ],
    });
    tableCol.append(footer);
  }

  workspace.append(tableCol);

  // 3. 인스펙터 (오른쪽 열)
  if (selectedObject && activeTileset) {
    workspace.append(
      renderObjectInspector(activeTileset, selectedObject, () => refresh(host, rerender), rerender)
    );
  } else if (selectedKit && activeTileset) {
    // 편집 잠금의 축은 "어떻게 만들어졌나"(learnedFrom)가 아니라 "프로젝트 데이터에 있나"(source)다.
    // learnedFrom 으로 판정하면 내장 킷을 내보낸 파일을 가져왔을 때 영구히 잠긴 유령 킷이 생긴다.
    const editable = selectedEntry?.source === "user";
    workspace.append(
      renderInspector(activeTileset, selectedKit, editable, () => refresh(host, rerender), rerender)
    );
  }
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
  const kit = entry.kit;
  if ((kit.name ?? "").toLowerCase().includes(query)) return true;
  return (kit.parts ?? []).some(
    (part) => partKindName(part.kind).includes(query) || (part.note ?? "").toLowerCase().includes(query),
  );
}

/** 테마 필터 — 고른 방 종류에 속한 실내 오브젝트만 남긴다. 킷 행은 테마 개념이 없어 그대로 통과. */
function matchesThemeFilter(entry: StructureAlbumEntry, theme: InteriorRoomTheme | null): boolean {
  if (!theme) return true;
  if (entry.kind !== "object") return true;
  return entry.object.themes.includes(theme);
}

/**
 * 방 종류 카드 그리드 — 카드 한 장이 "이 방에 반드시 있어야 하는 역할"과 그 역할을 채우는
 * 카탈로그 오브젝트의 래스터다. 카드를 누르면 표가 그 방의 오브젝트로 좁혀지고, 다시 누르면 풀린다.
 */
function renderThemeGrammar(
  tileset: TilesetDef,
  activeTheme: InteriorRoomTheme | null,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const grid = el("div", {
    class: "structure-kit-theme-grid",
    dataset: { testid: "structure-kit-theme-grid" },
    children: [
      el("div", { class: "structure-kit-theme-grid-title", text: "방 종류 — AI 가 이 방을 채울 때 요구하는 오브젝트" }),
    ],
  });

  for (const card of interiorThemeCards()) {
    const theme = card.theme;
    const slots = card.roles.filter((slot) => slot.object !== undefined);
    const modifiers = card.modifierLabels;

    const body =
      slots.length === 0
        ? [
            el("p", {
              class: "structure-kit-quiet",
              dataset: { testid: `structure-kit-theme-${theme}-no-roles` },
              text: "필수 오브젝트가 없는 방입니다 — 자유 배치.",
            }),
          ]
        : slots.map((slot) => {
            const canvas = interiorObjectCanvas(tileset, slot.object!, 1);
            return el("div", {
              class: "structure-kit-theme-role",
              dataset: { testid: `structure-kit-theme-${theme}-role-${slot.role}` },
              children: [
                el("div", { class: "structure-kit-theme-role-thumb", children: [canvas] }),
                el("span", { class: "structure-kit-theme-role-label", text: slot.label }),
              ],
            });
          });

    grid.append(
      el("button", {
        class: `structure-kit-theme-card${theme === activeTheme ? " active" : ""}`,
        attrs: { type: "button" },
        dataset: { testid: `structure-kit-theme-${theme}` },
        children: [
          el("div", { class: "structure-kit-theme-card-title", text: card.label }),
          el("div", { class: "structure-kit-theme-roles", children: body }),
          el("div", {
            class: "structure-kit-theme-modifiers",
            text: modifiers.length > 0 ? `분위기: ${modifiers.join(" · ")}` : "분위기 제안 없음",
          }),
        ],
        on: {
          click: () => {
            session.themeFilter = session.themeFilter === theme ? null : theme;
            setInspectorSelectedPartId(null);
            refresh(host, rerender);
          },
        },
      }),
    );
  }

  return grid;
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
    ],
    on: {
      click: () => {
        session.selectedObjectId = object.id;
        session.selectedKitId = null;
        setInspectorSelectedPartId(null);
        refresh(host, rerender);
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
