// panels/tilesetSpacesTab.ts
// 데이터베이스 '공간 종류' 탭 — 장소 문법(침실·주방·광장…)을 저작한다.
//
// 구조물(스탬프 가능한 킷·가구)은 structureKitDbTab 이 소유한다. 이 파일은
// 앨범·원본 칩·[+ 새 구조물]을 그리지 않는다. 공간 종류가 가구를 보여 주는 것은
// "이 역할을 채우는 구조물" 미리보기뿐이고, 구조물을 고치거나 복제하지 않는다.

import { editorState } from "@/editor/editorState";
import {
  INTERIOR_ROOM_TILESET_ID,
  INTERIOR_SEMANTIC_TILE_CATALOG,
  INTERIOR_THEME_MODIFIERS,
  type InteriorSemanticTileRole,
  type InteriorThemeModifier,
} from "@/editor/interiorRoomPipeline";
import { makeDatabaseTabIcon } from "@/editor/panels/databaseTabIcons";
import { field, toggleSwitch } from "@/editor/panels/databaseControls";
import {
  INTERIOR_THEME_MODIFIER_LABELS,
  interiorThemeCards,
  type InteriorThemeCard,
} from "@/editor/panels/structureKitDbSources";
import { interiorObjectCanvas } from "@/editor/panels/structureKitInspector";
import { interiorRoomKindSource, kindsDerivedFromConceptBundles } from "@/editor/interiorRoomVocab";
import { emptyState } from "@/editor/panels/databaseWorkspace";
import { getSelectedTilesetId, setSelectedTileset } from "@/editor/panels/tilesetSettingsPanel";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
import { store } from "@/project/store";
import type { InteriorRoomKindRecord, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const KNOWN_ROLES = Object.keys(INTERIOR_SEMANTIC_TILE_CATALOG) as InteriorSemanticTileRole[];

interface SpacesSession {
  tilesetId: string | null;
  selectedKindId: string | null;
  searchQuery: string;
}

const session: SpacesSession = {
  tilesetId: null,
  selectedKindId: null,
  searchQuery: "",
};

export function resetTilesetSpacesTabSession(): void {
  session.tilesetId = null;
  session.selectedKindId = null;
  session.searchQuery = "";
}

export function renderTilesetSpacesTab(host: HTMLElement, rerender: () => void): void {
  host.dataset.testid = "db-detail-form";
  const current = store.getCurrent();
  const tilesets = Object.values(current.tilesets);

  const sharedTilesetId = getSelectedTilesetId();
  if (sharedTilesetId && current.tilesets[sharedTilesetId]) session.tilesetId = sharedTilesetId;
  if (!session.tilesetId || !current.tilesets[session.tilesetId]) {
    const currentMapId = editorState.get().currentMapId ?? current.startMapId;
    const currentMap = current.maps[currentMapId];
    session.tilesetId = currentMap?.tilesetId ?? tilesets[0]?.id ?? "";
  }

  let activeTileset = current.tilesets[session.tilesetId] ?? tilesets[0];
  if (activeTileset) activeTileset = ensureInteriorSpaceKinds(activeTileset);

  // Phase 3 파생 읽기: 저작값이 없으면 꾸러미 장소를 읽기 전용으로 보여준다. 편집(추가·삭제·인스펙터)은
  // 저작값에만 닿는다 — 파생 행을 고치려면 꾸러미를 고치거나 "+ 공간 종류"로 저작값을 새로 만든다.
  const kindSource = activeTileset ? interiorRoomKindSource(activeTileset) : "none";
  const kinds = kindSource === "authored"
    ? activeTileset?.interiorRoomKinds ?? []
    : kindSource === "derived"
      ? kindsDerivedFromConceptBundles(activeTileset)
      : [];
  const query = session.searchQuery.trim().toLowerCase();
  const visibleKinds = kinds.filter((kind) => matchesKindQuery(kind, query));
  const selectedKind =
    visibleKinds.find((kind) => kind.id === session.selectedKindId) ?? visibleKinds[0] ?? null;
  session.selectedKindId = selectedKind?.id ?? null;

  host.append(
    el("header", {
      class: "db-tab-note",
      children: [
        el("h3", {
          text: "공간 종류",
          dataset: { testid: "tileset-spaces-heading" },
        }),
        el("span", {
          class: "db-tab-note-chip",
          children: [makeDatabaseTabIcon("tilesets"), el("span", { text: "타일셋별로 분리됨" })],
          attrs: { title: "한 타일셋의 공간 종류는 다른 타일셋에 섞이지 않습니다." },
        }),
        ...(activeTileset && interiorRoomKindSource(activeTileset) === "derived"
          ? [el("span", {
            class: "db-tab-note-chip",
            dataset: { testid: "tileset-spaces-derived-chip" },
            children: [el("span", { text: `개념 꾸러미에서 유도됨(${kindsDerivedFromConceptBundles(activeTileset).length})` })],
            attrs: { title: "저작된 공간 종류가 없어 개념 꾸러미의 장소를 방 종류 문법으로 읽는다. 꾸러미를 고치면 여기도 바뀐다." },
          })]
          : []),
      ],
    }),
  );

  const workspace = el("div", {
    class: "structure-kit-album-workspace tileset-spaces-workspace",
    dataset: { testid: "tileset-spaces-workspace" },
  });
  host.append(workspace);

  workspace.append(renderTilesetRail(tilesets, activeTileset, host, rerender));

  const tableCol = el("div", { class: "structure-kit-table-col" });
  tableCol.append(renderTools(activeTileset, host, rerender));

  if (!activeTileset || kinds.length === 0) {
    tableCol.append(renderEmpty(activeTileset, host, rerender));
  } else if (visibleKinds.length === 0) {
    tableCol.append(
      el("div", {
        class: "structure-kit-empty-wrap",
        dataset: { testid: "tileset-spaces-source-empty" },
        children: [
          el("strong", { text: "검색에 맞는 공간 종류가 없습니다." }),
          el("p", { class: "structure-kit-quiet", text: "검색어를 지워 보세요." }),
        ],
      }),
    );
  } else {
    tableCol.append(renderKindCards(activeTileset, visibleKinds, selectedKind, host, rerender));
  }
  workspace.append(tableCol);

  if (selectedKind && activeTileset) {
    if (kindSource === "derived") {
      // 파생 행은 읽기 전용 — 고치려면 꾸러미를 고치거나 저작값을 새로 만든다.
      workspace.append(
        el("div", {
          class: "structure-kit-inspector",
          dataset: { testid: `tileset-spaces-derived-note-${selectedKind.id}` },
          children: [
            el("h4", { text: selectedKind.label || selectedKind.id }),
            el("p", {
              class: "structure-kit-quiet",
              text: "개념 꾸러미의 장소에서 유도된 행이다. 역할·복도 여부는 꾸러미에서 고친다.",
            }),
          ],
        }),
      );
    } else {
      workspace.append(renderKindInspector(activeTileset, selectedKind, host, rerender));
    }
  }
}

function renderTilesetRail(
  tilesets: readonly TilesetDef[],
  activeTileset: TilesetDef | undefined,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const rail = el("div", {
    class: "structure-kit-album-rail",
    dataset: { testid: "tileset-spaces-rail" },
    children: [el("div", { class: "structure-kit-album-rail-title", text: "타일셋" })],
  });
  for (const tileset of tilesets) {
    const count = interiorRoomKindCount(tileset);
    const isActive = tileset.id === activeTileset?.id;
    rail.append(
      el("button", {
        class: `structure-kit-album-item${isActive ? " active" : ""}${count === 0 ? " zero" : ""}`,
        attrs: { type: "button" },
        dataset: { testid: `tileset-spaces-tileset-${tileset.id}` },
        children: [
          el("span", { text: tileset.name }),
          el("span", { class: "structure-kit-album-count", text: String(count) }),
        ],
        on: {
          click: () => {
            session.tilesetId = tileset.id;
            setSelectedTileset(tileset.id);
            session.selectedKindId = null;
            refresh(host, rerender);
          },
        },
      }),
    );
  }
  return rail;
}

function renderTools(
  tileset: TilesetDef | undefined,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  return el("div", {
    class: "structure-kit-tools",
    children: [
      el("input", {
        class: "structure-kit-search",
        attrs: { type: "search", placeholder: "이름, 역할 검색" },
        value: session.searchQuery,
        dataset: { testid: "tileset-spaces-search" },
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
        text: "+ 공간 종류",
        dataset: { testid: "tileset-spaces-kind-add" },
        on: {
          click: () => {
            if (!tileset) return;
            const created = addBlankKind(tileset.id);
            session.selectedKindId = created.id;
            refresh(host, rerender);
          },
        },
      }),
    ],
  });
}

function renderEmpty(
  tileset: TilesetDef | undefined,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const canSeedInterior = tileset?.id === INTERIOR_ROOM_TILESET_ID;
  return emptyState({
    icon: "⌂",
    title: "이 타일셋에는 아직 공간 종류가 없습니다.",
    body: canSeedInterior
      ? "침실·주방처럼 AI 가 방을 채울 문법을 만듭니다. 가구 모양은 「구조물」 탭에 있습니다."
      : "광장·부두처럼 이 칩셋에서 쓰는 장소 문법을 만듭니다. 찍을 타일 덩어리는 「구조물」 탭에 있습니다.",
    testid: "tileset-spaces-empty",
    action: {
      label: "+ 공간 종류",
      kind: "primary",
      testid: "tileset-spaces-empty-add",
      onClick: () => {
        if (!tileset) return;
        session.selectedKindId = addBlankKind(tileset.id).id;
        refresh(host, rerender);
      },
    },
    secondary: canSeedInterior
      ? {
          label: "기본 실내 7종 넣기",
          kind: "ghost",
          testid: "tileset-spaces-seed-builtin",
          onClick: () => {
            if (!tileset) return;
            writeKinds(tileset.id, BUILTIN_INTERIOR_ROOM_KINDS.map(cloneKind));
            session.selectedKindId = BUILTIN_INTERIOR_ROOM_KINDS[0]?.id ?? null;
            refresh(host, rerender);
          },
        }
      : undefined,
  });
}

function renderKindCards(
  tileset: TilesetDef,
  kinds: readonly InteriorRoomKindRecord[],
  selected: InteriorRoomKindRecord | null,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  // kinds를 그대로 넘긴다 — 저작값이면 타일셋 값과 같고, 파생이면 꾸러미 유도 목록이다.
  const cards = interiorThemeCards(tileset, kinds).filter((card) => kinds.some((kind) => kind.id === card.theme));
  const grid = el("div", {
    class: "structure-kit-theme-grid",
    dataset: { testid: "tileset-spaces-kind-grid" },
    children: [
      el("div", {
        class: "structure-kit-theme-grid-title",
        text: "공간 종류 — 이 장소에 있어야 하는 역할. 가구 모양은 구조물 탭에서 고칩니다.",
      }),
    ],
  });
  for (const card of cards) {
    grid.append(renderKindCard(tileset, card, card.theme === selected?.id, host, rerender));
  }
  return grid;
}

function renderKindCard(
  tileset: TilesetDef,
  card: InteriorThemeCard,
  active: boolean,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const roles = card.roles;
  const body =
    roles.length === 0
      ? [
          el("p", {
            class: "structure-kit-quiet",
            dataset: { testid: `tileset-spaces-kind-${card.theme}-no-roles` },
            text: "필수 가구가 없는 공간입니다 — 통로·여백.",
          }),
        ]
      : roles.map((slot) => {
          const children: HTMLElement[] = [];
          if (slot.object) {
            children.push(
              el("div", {
                class: "structure-kit-theme-role-thumb",
                children: [interiorObjectCanvas(tileset, slot.object, 1)],
              }),
            );
          }
          children.push(el("span", { class: "structure-kit-theme-role-label", text: slot.label }));
          return el("div", {
            class: "structure-kit-theme-role",
            dataset: { testid: `tileset-spaces-kind-${card.theme}-role-${slot.role}` },
            children,
          });
        });
  return el("button", {
    class: `structure-kit-theme-card${active ? " active" : ""}`,
    attrs: { type: "button" },
    dataset: {
      testid: `tileset-spaces-kind-${card.theme}`,
      // 예전 구조물 탭에 붙어 있던 카드 testid — 폴더 계약이 이 이름을 아직 본다.
      kindId: card.theme,
    },
    children: [
      el("div", { class: "structure-kit-theme-card-title", text: card.label }),
      el("div", { class: "structure-kit-theme-roles", children: body }),
      el("div", {
        class: "structure-kit-theme-modifiers",
        text: card.modifierLabels.length > 0 ? `분위기: ${card.modifierLabels.join(" · ")}` : "분위기 제안 없음",
      }),
    ],
    on: {
      click: () => {
        session.selectedKindId = card.theme;
        refresh(host, rerender);
      },
    },
  });
}

function renderKindInspector(
  tileset: TilesetDef,
  kind: InteriorRoomKindRecord,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const patch = (next: InteriorRoomKindRecord): void => {
    const kinds = tileset.interiorRoomKinds ?? [];
    writeKinds(
      tileset.id,
      kinds.map((entry) => (entry.id === kind.id ? next : entry)),
    );
    refresh(host, rerender);
  };

  return el("div", {
    class: "structure-kit-inspector",
    dataset: { testid: `tileset-spaces-inspector-${kind.id}` },
    children: [
      el("h4", { text: kind.label || kind.id }),
      el("p", {
        class: "structure-kit-quiet",
        text: "장소의 문법입니다. 침대·화덕 같은 모양은 구조물 탭의 가구입니다.",
      }),
      field(
        "이름",
        el("input", {
          attrs: { type: "text", value: kind.label, "aria-label": "공간 이름" },
          dataset: { testid: `tileset-spaces-kind-label-${kind.id}` },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLInputElement)) return;
              patch({ ...kind, label: target.value.trim() || kind.id });
            },
          },
        }),
      ),
      el("div", {
        class: "structure-kit-field",
        children: [
          el("label", { text: "필수 역할" }),
          renderRoleChips(kind, patch),
          el("input", {
            attrs: {
              type: "text",
              value: kind.requiredRoles.join(", "),
              placeholder: "bed, stove",
              "aria-label": "필수 역할",
            },
            dataset: { testid: `tileset-spaces-kind-roles-${kind.id}` },
            on: {
              change: (event: Event) => {
                const target = event.currentTarget;
                if (!(target instanceof HTMLInputElement)) return;
                const requiredRoles = target.value.split(",").map((role) => role.trim()).filter(Boolean);
                patch({ ...kind, requiredRoles });
              },
            },
          }),
        ],
      }),
      el("div", {
        class: "structure-kit-field",
        children: [
          el("label", { text: "분위기" }),
          renderModifierChips(kind, patch),
        ],
      }),
      toggleSwitch("복도 · 통로", `tileset-spaces-kind-walkway-${kind.id}`, Boolean(kind.walkway), (checked) => {
        patch({ ...kind, ...(checked ? { walkway: true } : { walkway: undefined }) });
      }),
      el("button", {
        class: "btn small",
        attrs: { type: "button" },
        text: "삭제",
        dataset: { testid: `tileset-spaces-kind-delete-${kind.id}` },
        on: {
          click: () => {
            writeKinds(
              tileset.id,
              (tileset.interiorRoomKinds ?? []).filter((entry) => entry.id !== kind.id),
            );
            session.selectedKindId = null;
            refresh(host, rerender);
          },
        },
      }),
    ],
  });
}

function renderRoleChips(
  kind: InteriorRoomKindRecord,
  patch: (next: InteriorRoomKindRecord) => void,
): HTMLElement {
  return el("div", {
    class: "structure-kit-editor-chips",
    dataset: { testid: `tileset-spaces-role-chips-${kind.id}` },
    children: KNOWN_ROLES.map((role) => {
      const active = kind.requiredRoles.includes(role);
      return el("button", {
        class: `structure-kit-editor-chip${active ? " active" : ""}`,
        attrs: { type: "button" },
        text: INTERIOR_SEMANTIC_TILE_CATALOG[role].label,
        dataset: { testid: `tileset-spaces-role-chip-${kind.id}-${role}` },
        on: {
          click: () => {
            const requiredRoles = active
              ? kind.requiredRoles.filter((entry) => entry !== role)
              : [...kind.requiredRoles, role];
            patch({ ...kind, requiredRoles });
          },
        },
      });
    }),
  });
}

function renderModifierChips(
  kind: InteriorRoomKindRecord,
  patch: (next: InteriorRoomKindRecord) => void,
): HTMLElement {
  const selected = new Set(kind.suggestedModifiers ?? []);
  return el("div", {
    class: "structure-kit-editor-chips",
    dataset: { testid: `tileset-spaces-modifier-chips-${kind.id}` },
    children: INTERIOR_THEME_MODIFIERS.map((modifier) => {
      const active = selected.has(modifier);
      return el("button", {
        class: `structure-kit-editor-chip${active ? " active" : ""}`,
        attrs: { type: "button" },
        text: INTERIOR_THEME_MODIFIER_LABELS[modifier as InteriorThemeModifier] ?? modifier,
        dataset: { testid: `tileset-spaces-modifier-chip-${kind.id}-${modifier}` },
        on: {
          click: () => {
            const suggestedModifiers = active
              ? (kind.suggestedModifiers ?? []).filter((entry) => entry !== modifier)
              : [...(kind.suggestedModifiers ?? []), modifier];
            patch({
              ...kind,
              ...(suggestedModifiers.length > 0 ? { suggestedModifiers } : { suggestedModifiers: undefined }),
            });
          },
        },
      });
    }),
  });
}

function matchesKindQuery(kind: InteriorRoomKindRecord, query: string): boolean {
  if (!query) return true;
  if (kind.label.toLowerCase().includes(query) || kind.id.toLowerCase().includes(query)) return true;
  return kind.requiredRoles.some((role) => role.toLowerCase().includes(query));
}

function ensureInteriorSpaceKinds(tileset: TilesetDef): TilesetDef {
  if (tileset.interiorRoomKinds !== undefined) return tileset;
  if (tileset.id !== INTERIOR_ROOM_TILESET_ID) return tileset;
  // Phase 3: 개념 꾸러미가 있으면 자동 시드하지 않는다 — 파생 체인(꾸러미 장소 → 방 종류)이
  // 살아 있어야 공간 종류 탭의 "개념 꾸러미에서 유도됨" 칩이 뜬다. 시드는 명시 버튼으로만.
  if ((tileset.scratchConceptBundles ?? []).some((bundle) => bundle.places.length > 0)) return tileset;
  writeKinds(tileset.id, BUILTIN_INTERIOR_ROOM_KINDS.map(cloneKind), "공간 종류 시드");
  return store.getCurrent().tilesets[tileset.id] ?? tileset;
}

function addBlankKind(tilesetId: string): InteriorRoomKindRecord {
  const created: InteriorRoomKindRecord = {
    id: `space_${Date.now().toString(36)}`,
    label: "새 공간",
    requiredRoles: [],
  };
  const tileset = store.getCurrent().tilesets[tilesetId];
  // Phase 3: 저작값이 없으면(파생 모드) 유도 목록을 스냅샷으로 먼저 깔고 추가한다.
  // 파생 행을 버리고 [새 공간] 하나만 남기면 어휘가 붕괴한다.
  const base = tileset?.interiorRoomKinds ?? kindsDerivedFromConceptBundles(tileset);
  writeKinds(tilesetId, [...base, created]);
  return created;
}

/** 공간 종류 개수 — 저작값이 있으면 그 길이, 없으면 파생 길이. 레일·뱃지 공용. */
export function interiorRoomKindCount(tileset: TilesetDef | undefined): number {
  if (!tileset) return 0;
  if (tileset.interiorRoomKinds !== undefined) return tileset.interiorRoomKinds.length;
  return kindsDerivedFromConceptBundles(tileset).length;
}

function writeKinds(
  tilesetId: string,
  kinds: readonly InteriorRoomKindRecord[],
  label = "공간 종류 수정",
): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.interiorRoomKinds = kinds.map(cloneKind);
  }, { scope: "database", label });
}

function cloneKind(kind: InteriorRoomKindRecord): InteriorRoomKindRecord {
  return {
    id: kind.id,
    label: kind.label,
    requiredRoles: [...kind.requiredRoles],
    ...(kind.suggestedModifiers && kind.suggestedModifiers.length > 0
      ? { suggestedModifiers: [...kind.suggestedModifiers] }
      : {}),
    ...(kind.walkway ? { walkway: true } : {}),
  };
}

function refresh(host: HTMLElement, rerender: () => void): void {
  while (host.firstChild) host.removeChild(host.firstChild);
  renderTilesetSpacesTab(host, rerender);
}
