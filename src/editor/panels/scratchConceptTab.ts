// 데이터베이스 「임시 → 개념 꾸러미」.
// 타일셋에 동봉된 시설→장소→물건→칩 나무를 그림으로 고친다.
// 시공 파이프는 아직 읽지 않는다 — 저작 면만.

import { editorState } from "@/editor/editorState";
import { interiorObjectById, type InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { interiorFurnitureKits, interiorObjectFromKit } from "@/editor/interiorRoomVocab";
import {
  claimThingPicture,
  conceptObjectsForTileset,
  isOwnedPicture,
  registerStampOnTileset,
  resolveConceptObject,
} from "@/editor/panels/conceptStudioModel";
import { field } from "@/editor/panels/databaseControls";
import { makeDatabaseTabIcon } from "@/editor/panels/databaseTabIcons";
import { emptyState } from "@/editor/panels/databaseWorkspace";
import { openStructureKitEditor } from "@/editor/panels/structureKitEditorDialog";
import { interiorObjectCanvas } from "@/editor/panels/structureKitInspector";
import { INTERIOR_OBJECT_THUMB_BACKGROUND_TILE } from "@/editor/panels/structureKitDbSources";
import { getSelectedTilesetId, setSelectedTileset } from "@/editor/panels/tilesetSettingsPanel";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { TILE } from "@/project/defaults/constants";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "@/project/defaults/scratchInnBundle";
import { store } from "@/project/store";
import type {
  ConceptBundleRecord,
  ConceptChipId,
  ConceptFacilityRecord,
  ConceptPlaceRecord,
  ConceptThingRecord,
  TilesetDef,
} from "@/project/types";
import { CONCEPT_CHIP_IDS, CONCEPT_CHIP_LABELS } from "@/project/types/conceptBundle";
import { el } from "@/util/dom";

interface ScratchSession {
  tilesetId: string | null;
  bundleId: string | null;
  facilityId: string | null;
  placeId: string | null;
  thingId: string | null;
  pickerOpen: boolean;
  selectedTiles: number[];
}

const session: ScratchSession = {
  tilesetId: null,
  bundleId: null,
  facilityId: null,
  placeId: null,
  thingId: null,
  pickerOpen: false,
  selectedTiles: [],
};

export function resetScratchConceptTabSession(): void {
  session.tilesetId = null;
  session.bundleId = null;
  session.facilityId = null;
  session.placeId = null;
  session.thingId = null;
  session.pickerOpen = false;
  session.selectedTiles = [];
}

export function renderScratchConceptTab(host: HTMLElement, rerender: () => void): void {
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
  if (activeTileset) activeTileset = ensureScratchBundles(activeTileset);

  const bundles = activeTileset?.scratchConceptBundles ?? [];
  const bundle = bundles.find((entry) => entry.id === session.bundleId) ?? bundles[0] ?? null;
  session.bundleId = bundle?.id ?? null;
  const facility = bundle
    ? bundle.facilities.find((entry) => entry.id === session.facilityId) ?? bundle.facilities[0] ?? null
    : null;
  session.facilityId = facility?.id ?? null;
  const place = bundle
    ? bundle.places.find((entry) => entry.id === session.placeId)
      ?? bundle.places.find((entry) => facility?.placeIds.includes(entry.id))
      ?? bundle.places[0]
      ?? null
    : null;
  session.placeId = place?.id ?? null;
  const thing = bundle
    ? bundle.things.find((entry) => entry.id === session.thingId)
      ?? bundle.things.find((entry) => place && entry.placeIds.includes(place.id))
      ?? null
    : null;
  session.thingId = thing?.id ?? null;

  host.append(
    el("header", {
      class: "db-tab-note",
      children: [
        el("h3", { text: "개념 꾸러미", dataset: { testid: "scratch-concept-heading" } }),
        el("span", {
          class: "db-tab-note-chip",
          children: [makeDatabaseTabIcon("scratchConcepts"), el("span", { text: "임시 · 그림으로 고침" })],
          attrs: { title: "타일셋 그림판에서 물건을 그리고, 카탈로그는 고치는 순간 내 것이 됩니다." },
        }),
      ],
    }),
  );

  const workspace = el("div", {
    class: "structure-kit-album-workspace scratch-concept-workspace",
    dataset: { testid: "scratch-concept-workspace" },
  });
  host.append(workspace);
  workspace.append(renderTilesetRail(tilesets, activeTileset, host, rerender));

  const tableCol = el("div", { class: "scratch-concept-main" });
  workspace.append(tableCol);
  if (activeTileset) tableCol.append(renderSheet(activeTileset, host, rerender));

  if (!activeTileset) {
    tableCol.append(emptyState({
      icon: "⌂",
      title: "타일셋이 없습니다.",
      body: "타일셋을 만든 뒤 개념 꾸러미를 붙입니다.",
      testid: "scratch-concept-no-tileset",
    }));
    return;
  }

  if (bundles.length === 0) {
    tableCol.append(renderEmpty(activeTileset, host, rerender));
    return;
  }

  if (bundle && facility) {
    tableCol.append(renderBundleBoard(activeTileset, bundle, facility, place, thing, host, rerender));
  }

  if (bundle && thing && activeTileset) {
    workspace.append(renderThingInspector(activeTileset, bundle, thing, host, rerender));
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
    dataset: { testid: "scratch-concept-rail" },
    children: [el("div", { class: "structure-kit-album-rail-title", text: "타일셋" })],
  });
  for (const tileset of tilesets) {
    const count = tileset.scratchConceptBundles?.length ?? 0;
    const isActive = tileset.id === activeTileset?.id;
    rail.append(
      el("button", {
        class: `structure-kit-album-item${isActive ? " active" : ""}${count === 0 ? " zero" : ""}`,
        attrs: { type: "button" },
        dataset: { testid: `scratch-concept-tileset-${tileset.id}` },
        children: [
          el("span", { text: tileset.name }),
          el("span", { class: "structure-kit-album-count", text: String(count) }),
        ],
        on: {
          click: () => {
            session.tilesetId = tileset.id;
            session.bundleId = null;
            session.facilityId = null;
            session.placeId = null;
            session.thingId = null;
            session.pickerOpen = false;
            session.selectedTiles = [];
            setSelectedTileset(tileset.id);
            refresh(host, rerender);
          },
        },
      }),
    );
  }
  return rail;
}

function renderEmpty(tileset: TilesetDef, host: HTMLElement, rerender: () => void): HTMLElement {
  const canSeedInn = tileset.id === INTERIOR_ROOM_TILESET_ID;
  return emptyState({
    icon: "⌂",
    title: "이 타일셋에는 아직 개념 꾸러미가 없습니다.",
    body: canSeedInn
      ? "여관처럼 꺼내는 시설 나무를 만듭니다. 그림은 이 칩셋의 가구를 씁니다."
      : "이 칩셋에서 꺼낼 시설을 만듭니다. 물건은 구조물 탭의 그림을 가리킵니다.",
    testid: "scratch-concept-empty",
    action: {
      label: "+ 시설",
      kind: "primary",
      testid: "scratch-concept-empty-add",
      onClick: () => {
        const created = addBlankBundle(tileset.id);
        session.bundleId = created.id;
        session.facilityId = created.facilities[0]?.id ?? null;
        refresh(host, rerender);
      },
    },
    secondary: canSeedInn
      ? {
          label: "여관 초안 넣기",
          kind: "ghost",
          testid: "scratch-concept-seed-inn",
          onClick: () => {
            writeBundles(tileset.id, [cloneConceptBundle(SCRATCH_INN_BUNDLE)]);
            session.bundleId = SCRATCH_INN_BUNDLE.id;
            session.facilityId = "inn";
            session.placeId = "bedroom";
            refresh(host, rerender);
          },
        }
      : undefined,
  });
}

function renderBundleBoard(
  tileset: TilesetDef,
  bundle: ConceptBundleRecord,
  facility: ConceptFacilityRecord,
  place: ConceptPlaceRecord | null,
  thing: ConceptThingRecord | null,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const board = el("div", { class: "scratch-concept-board", dataset: { testid: "scratch-concept-board" } });
  board.append(renderToolbar(tileset, bundle, facility, host, rerender));

  const places = facility.placeIds
    .map((id) => bundle.places.find((entry) => entry.id === id))
    .filter((entry): entry is ConceptPlaceRecord => Boolean(entry));

  const grid = el("div", { class: "scratch-concept-places", dataset: { testid: "scratch-concept-places" } });
  for (const entry of places) {
    grid.append(renderPlaceCard(tileset, bundle, entry, entry.id === place?.id, thing, host, rerender));
  }
  board.append(grid);

  if (session.pickerOpen && place) {
    board.append(renderPicker(tileset, bundle, place, host, rerender));
  }
  return board;
}

function renderToolbar(
  tileset: TilesetDef,
  bundle: ConceptBundleRecord,
  facility: ConceptFacilityRecord,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const name = el("input", {
    attrs: { type: "text", value: facility.label },
    dataset: { testid: "scratch-concept-facility-name" },
    on: {
      change: (event) => {
        const next = (event.target as HTMLInputElement).value.trim() || facility.label;
        patchFacility(tileset.id, bundle.id, facility.id, { label: next });
        if (bundle.facilities.length === 1) patchBundle(tileset.id, bundle.id, { label: next });
        refresh(host, rerender);
      },
    },
  }) as HTMLInputElement;

  return el("div", {
    class: "scratch-concept-toolbar",
    children: [
      el("div", {
        class: "scratch-concept-crumb",
        dataset: { testid: "scratch-concept-crumb" },
        text: `${facility.label} → 장소 → 물건 → 칩`,
      }),
      field("시설 이름", name),
      el("button", {
        class: "db-mini-btn primary",
        attrs: { type: "button" },
        dataset: { testid: "scratch-concept-thing-from-sheet" },
        text: session.selectedTiles.length > 0
          ? `고른 ${session.selectedTiles.length}칸으로 물건`
          : "고른 칸으로 물건",
        on: {
          click: () => {
            if (session.selectedTiles.length === 0) return;
            const placeId = session.placeId ?? facility.placeIds[0];
            if (!placeId) return;
            const kit = registerStampOnTileset(
              tileset.id,
              session.selectedTiles,
              session.selectedTiles.length === 1 ? "새 물건" : `새 물건 ${session.selectedTiles.length}칸`,
            );
            const created = addThingFromObject(tileset.id, bundle.id, placeId, interiorObjectFromKit(kit));
            session.thingId = created.id;
            session.placeId = placeId;
            session.pickerOpen = false;
            session.selectedTiles = [];
            refresh(host, rerender);
          },
        },
      }),
      el("button", {
        class: "db-mini-btn",
        attrs: { type: "button" },
        dataset: { testid: "scratch-concept-place-add" },
        text: "+ 장소",
        on: {
          click: () => {
            const created = addBlankPlace(tileset.id, bundle.id, facility.id);
            session.placeId = created.id;
            session.pickerOpen = false;
            refresh(host, rerender);
          },
        },
      }),
    ],
  });
}

function renderPlaceCard(
  tileset: TilesetDef,
  bundle: ConceptBundleRecord,
  place: ConceptPlaceRecord,
  active: boolean,
  selectedThing: ConceptThingRecord | null,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const things = bundle.things.filter((entry) => entry.placeIds.includes(place.id));
  const card = el("article", {
    class: `scratch-concept-place${active ? " active" : ""}`,
    dataset: { testid: `scratch-concept-place-${place.id}` },
    on: {
      click: () => {
        session.placeId = place.id;
        session.pickerOpen = false;
        refresh(host, rerender);
      },
    },
  });

  const name = el("input", {
    attrs: { type: "text", value: place.label },
    dataset: { testid: `scratch-concept-place-name-${place.id}` },
    on: {
      click: (event) => event.stopPropagation(),
      change: (event) => {
        const next = (event.target as HTMLInputElement).value.trim() || place.label;
        patchPlace(tileset.id, bundle.id, place.id, { label: next });
        refresh(host, rerender);
      },
    },
  }) as HTMLInputElement;

  card.append(
    el("header", {
      class: "scratch-concept-place-head",
      children: [
        name,
        el("button", {
          class: "db-mini-btn danger",
          attrs: { type: "button", title: "이 장소를 지운다" },
          dataset: { testid: `scratch-concept-place-remove-${place.id}` },
          text: "삭제",
          on: {
            click: (event) => {
              event.stopPropagation();
              removePlace(tileset.id, bundle.id, place.id);
              if (session.placeId === place.id) session.placeId = null;
              refresh(host, rerender);
            },
          },
        }),
      ],
    }),
  );

  const stage = el("div", {
    class: "scratch-concept-stage",
    dataset: { testid: `scratch-concept-stage-${place.id}` },
    attrs: {
      style: tilesetTileBackgroundStyle(
        tileset,
        tileset.id === INTERIOR_ROOM_TILESET_ID ? INTERIOR_OBJECT_THUMB_BACKGROUND_TILE : TILE.GRASS,
        24,
      ),
    },
  });
  const row = el("div", { class: "scratch-concept-things", dataset: { testid: `scratch-concept-things-${place.id}` } });
  for (const entry of things) {
    row.append(renderThingChip(tileset, entry, selectedThing?.id === entry.id, host, rerender));
  }
  stage.append(row);
  card.append(stage);
  row.append(
    el("button", {
      class: "scratch-concept-add-thing",
      attrs: { type: "button" },
      dataset: { testid: `scratch-concept-thing-add-${place.id}` },
      text: "+ 물건",
      on: {
        click: (event) => {
          event.stopPropagation();
          session.placeId = place.id;
          session.pickerOpen = true;
          refresh(host, rerender);
        },
      },
    }),
  );
  return card;
}

function renderThingChip(
  tileset: TilesetDef,
  thing: ConceptThingRecord,
  active: boolean,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const object = resolveThingObject(tileset, thing.objectId);
  const thumb = object
    ? decorateThumb(interiorObjectCanvas(tileset, object, 3), "scratch-concept-thumb")
    : el("span", { class: "scratch-concept-missing", text: "?" });
  return el("button", {
    class: `scratch-concept-thing${active ? " active" : ""}${thing.required ? " required" : ""}`,
    attrs: { type: "button" },
    dataset: { testid: `scratch-concept-thing-${thing.id}` },
    children: [
      thumb,
      el("span", { class: "scratch-concept-thing-label", text: thing.label }),
      el("span", {
        class: "scratch-concept-thing-chips",
        text: thing.chips.map((chip) => CONCEPT_CHIP_LABELS[chip]).join(" · "),
      }),
    ],
    on: {
      click: (event) => {
        event.stopPropagation();
        session.thingId = thing.id;
        session.pickerOpen = false;
        refresh(host, rerender);
      },
    },
  });
}

function renderPicker(
  tileset: TilesetDef,
  bundle: ConceptBundleRecord,
  place: ConceptPlaceRecord,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const used = new Set(
    bundle.things.filter((thing) => thing.placeIds.includes(place.id)).map((thing) => thing.objectId),
  );
  const available = objectsForTileset(tileset).filter((object) => !used.has(object.id));
  const grid = el("div", {
    class: "scratch-concept-picker",
    dataset: { testid: "scratch-concept-picker" },
    children: [
      el("div", { class: "scratch-concept-picker-title", text: `${place.label}에 넣을 물건` }),
    ],
  });
  if (available.length === 0) {
    grid.append(el("p", { class: "scratch-concept-quiet", text: "이 칩셋에서 더 넣을 가구가 없습니다." }));
    return grid;
  }
  for (const object of available) {
    const canvas = decorateThumb(interiorObjectCanvas(tileset, object, 3), "scratch-concept-thumb");
    grid.append(
      el("button", {
        class: "scratch-concept-pick",
        attrs: { type: "button" },
        dataset: { testid: `scratch-concept-pick-${object.id}` },
        children: [canvas, el("span", { text: object.label })],
        on: {
          click: () => {
            const created = addThingFromObject(tileset.id, bundle.id, place.id, object);
            session.thingId = created.id;
            session.pickerOpen = false;
            refresh(host, rerender);
          },
        },
      }),
    );
  }
  return grid;
}

function renderThingInspector(
  tileset: TilesetDef,
  bundle: ConceptBundleRecord,
  thing: ConceptThingRecord,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const object = resolveThingObject(tileset, thing.objectId);
  const owned = isOwnedPicture(tileset, thing.objectId);
  const preview = object
    ? decorateThumb(interiorObjectCanvas(tileset, object, 5), "scratch-concept-preview")
    : el("span", { class: "scratch-concept-missing", text: "그림 없음" });

  const name = el("input", {
    attrs: { type: "text", value: thing.label },
    dataset: { testid: "scratch-concept-thing-name" },
    on: {
      change: (event) => {
        const next = (event.target as HTMLInputElement).value.trim() || thing.label;
        patchThing(tileset.id, bundle.id, thing.id, { label: next });
        refresh(host, rerender);
      },
    },
  }) as HTMLInputElement;

  const chips = el("div", { class: "scratch-concept-chip-row", dataset: { testid: "scratch-concept-chips" } });
  for (const chip of CONCEPT_CHIP_IDS) {
    const on = thing.chips.includes(chip);
    chips.append(
      el("button", {
        class: `scratch-concept-chip ${chip}${on ? " on" : ""}`,
        attrs: { type: "button" },
        dataset: { testid: `scratch-concept-chip-${chip}` },
        text: CONCEPT_CHIP_LABELS[chip],
        on: {
          click: () => {
            toggleChip(tileset.id, bundle.id, thing.id, chip);
            refresh(host, rerender);
          },
        },
      }),
    );
  }

  const places = el("div", { class: "scratch-concept-place-toggles" });
  for (const place of bundle.places) {
    const on = thing.placeIds.includes(place.id);
    places.append(
      el("button", {
        class: `db-mini-btn${on ? " active" : ""}`,
        attrs: { type: "button" },
        dataset: { testid: `scratch-concept-thing-place-${place.id}` },
        text: place.label,
        on: {
          click: () => {
            toggleThingPlace(tileset.id, bundle.id, thing.id, place.id);
            refresh(host, rerender);
          },
        },
      }),
    );
  }

  return el("aside", {
    class: "scratch-concept-inspector",
    dataset: { testid: "scratch-concept-inspector" },
    children: [
      el("div", { class: "scratch-concept-inspector-title", text: thing.label }),
      el("div", { class: "scratch-concept-raster", children: [preview] }),
      el("button", {
        class: "db-mini-btn primary",
        attrs: { type: "button" },
        dataset: { testid: "scratch-concept-claim-art" },
        text: owned ? "그림 고치기" : "이 그림으로 내 것 만들어 고치기",
        on: {
          click: () => {
            const kitId = claimThingPicture(tileset.id, bundle.id, thing.id);
            if (!kitId) return;
            session.thingId = thing.id;
            refresh(host, rerender);
            openOwnedEditor(tileset.id, kitId, () => refresh(host, rerender));
          },
        },
      }),
      el("p", {
        class: "scratch-concept-quiet",
        text: owned
          ? "이 타일셋에 저장된 그림입니다. 고치면 구조물 편집기가 열립니다."
          : "카탈로그·내장 그림입니다. 고치는 순간 이 타일셋의 내 구조물이 됩니다.",
      }),
      field("이름", name),
      el("p", {
        class: "scratch-concept-line",
        dataset: { testid: "scratch-concept-line" },
        text: oneLine(bundle, thing),
      }),
      el("div", { class: "scratch-concept-section-label", text: "능력 칩" }),
      chips,
      el("div", { class: "scratch-concept-section-label", text: "이 물건이 속한 장소" }),
      places,
      el("label", {
        class: "scratch-concept-required",
        children: [
          el("input", {
            attrs: { type: "checkbox", ...(thing.required ? { checked: "" } : {}) },
            dataset: { testid: "scratch-concept-required" },
            on: {
              change: (event) => {
                patchThing(tileset.id, bundle.id, thing.id, {
                  required: (event.target as HTMLInputElement).checked || undefined,
                });
                refresh(host, rerender);
              },
            },
          }),
          el("span", { text: "이 장소에 필수" }),
        ],
      }),
      el("button", {
        class: "db-mini-btn danger",
        attrs: { type: "button" },
        dataset: { testid: "scratch-concept-thing-remove" },
        text: "물건 지우기",
        on: {
          click: () => {
            removeThing(tileset.id, bundle.id, thing.id);
            session.thingId = null;
            refresh(host, rerender);
          },
        },
      }),
    ],
  });
}

function decorateThumb(node: HTMLElement, className: string): HTMLElement {
  node.className = className;
  return node;
}

function oneLine(bundle: ConceptBundleRecord, thing: ConceptThingRecord): string {
  const facility = bundle.facilities[0]?.label ?? bundle.label;
  const place = bundle.places.find((entry) => thing.placeIds.includes(entry.id))?.label ?? "장소";
  const chips = thing.chips.map((chip) => CONCEPT_CHIP_LABELS[chip]).join(", ");
  return `${facility} — ${place} — ${thing.label} — ${chips || "칩 없음"}`;
}

export function resolveThingObject(tileset: TilesetDef, objectId: string): InteriorObjectDef | undefined {
  const kit = (tileset.structureKits ?? []).find((entry) => entry.id === objectId)
    ?? interiorFurnitureKits(tileset).find((entry) => entry.id === objectId);
  if (kit) return interiorObjectFromKit(kit);
  return resolveConceptObject(tileset, objectId) ?? interiorObjectById(objectId);
}

export function objectsForTileset(tileset: TilesetDef): readonly InteriorObjectDef[] {
  return conceptObjectsForTileset(tileset);
}

function renderSheet(tileset: TilesetDef, host: HTMLElement, rerender: () => void): HTMLElement {
  const selected = new Set(session.selectedTiles);
  const sheet = el("section", {
    class: "scratch-concept-sheet",
    dataset: { testid: "scratch-concept-sheet" },
  });
  sheet.append(
    el("header", {
      class: "scratch-concept-sheet-head",
      children: [
        el("strong", { text: "타일셋 그림판" }),
        el("span", {
          class: "scratch-concept-quiet",
          text: selected.size > 0
            ? `${selected.size}칸 고름 · 장소의 「고른 칸으로 물건」`
            : "칸을 눌러 고르고, 그 그림으로 물건을 만듭니다.",
        }),
      ],
    }),
  );
  const grid = el("div", {
    class: "scratch-concept-sheet-grid",
    attrs: { style: `--sheet-cols:${tileset.tilesPerRow}` },
  });
  const count = Math.max(0, tileset.count);
  for (let tile = 0; tile < count; tile += 1) {
    const on = selected.has(tile);
    grid.append(
      el("button", {
        class: `scratch-concept-sheet-tile${on ? " on" : ""}`,
        attrs: {
          type: "button",
          title: `#${tile}`,
          style: tilesetTileBackgroundStyle(tileset, tile, 24),
        },
        dataset: { testid: `scratch-concept-sheet-tile-${tile}` },
        on: {
          click: () => {
            session.selectedTiles = on
              ? session.selectedTiles.filter((entry) => entry !== tile)
              : [...session.selectedTiles, tile];
            refresh(host, rerender);
          },
        },
      }),
    );
  }
  sheet.append(grid);
  return sheet;
}

function openOwnedEditor(tilesetId: string, kitId: string, onClosed: () => void): void {
  try {
    openStructureKitEditor(tilesetId, kitId, onClosed);
  } catch {
    onClosed();
  }
}

function ensureScratchBundles(tileset: TilesetDef): TilesetDef {
  if (tileset.scratchConceptBundles !== undefined) return tileset;
  if (tileset.id !== INTERIOR_ROOM_TILESET_ID) return tileset;
  writeBundles(tileset.id, [cloneConceptBundle(SCRATCH_INN_BUNDLE)], "여관 꾸러미 시드");
  return store.getCurrent().tilesets[tileset.id] ?? tileset;
}

function addBlankBundle(tilesetId: string): ConceptBundleRecord {
  const place = { id: `place_${Date.now().toString(36)}`, label: "새 장소" };
  const created: ConceptBundleRecord = {
    id: `bundle_${Date.now().toString(36)}`,
    label: "새 시설",
    facilities: [{ id: `facility_${Date.now().toString(36)}`, label: "새 시설", placeIds: [place.id] }],
    places: [place],
    things: [],
  };
  const tileset = store.getCurrent().tilesets[tilesetId];
  writeBundles(tilesetId, [...(tileset?.scratchConceptBundles ?? []), created]);
  return created;
}

function addBlankPlace(tilesetId: string, bundleId: string, facilityId: string): ConceptPlaceRecord {
  const created: ConceptPlaceRecord = { id: `place_${Date.now().toString(36)}`, label: "새 장소" };
  mutateBundle(tilesetId, bundleId, (bundle) => {
    bundle.places.push(created);
    const facility = bundle.facilities.find((entry) => entry.id === facilityId);
    facility?.placeIds.push(created.id);
  }, "장소 추가");
  return created;
}

function addThingFromObject(
  tilesetId: string,
  bundleId: string,
  placeId: string,
  object: InteriorObjectDef,
): ConceptThingRecord {
  let created: ConceptThingRecord | undefined;
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const existing = bundle.things.find((thing) => thing.objectId === object.id);
    if (existing) {
      if (!existing.placeIds.includes(placeId)) existing.placeIds.push(placeId);
      created = existing;
      return;
    }
    created = {
      id: object.id,
      label: object.label,
      objectId: object.id,
      placeIds: [placeId],
      chips: defaultChipsFor(object),
    };
    bundle.things.push(created);
  }, "물건 추가");
  return created!;
}

function defaultChipsFor(object: InteriorObjectDef): ConceptChipId[] {
  if (object.id === "stairs") return ["pass", "transfer"];
  if (object.id === "rug") return ["pass", "floor"];
  if (object.snap === "wall-north" || object.snap === "wall-any") return ["wall"];
  if (object.snap === "floor") return ["block"];
  return ["block"];
}

function toggleChip(tilesetId: string, bundleId: string, thingId: string, chip: ConceptChipId): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const thing = bundle.things.find((entry) => entry.id === thingId);
    if (!thing) return;
    thing.chips = thing.chips.includes(chip)
      ? thing.chips.filter((entry) => entry !== chip)
      : [...thing.chips, chip];
  }, "칩 토글");
}

function toggleThingPlace(tilesetId: string, bundleId: string, thingId: string, placeId: string): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const thing = bundle.things.find((entry) => entry.id === thingId);
    if (!thing) return;
    thing.placeIds = thing.placeIds.includes(placeId)
      ? thing.placeIds.filter((entry) => entry !== placeId)
      : [...thing.placeIds, placeId];
  }, "물건 장소");
}

function patchBundle(tilesetId: string, bundleId: string, patch: Partial<ConceptBundleRecord>): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    if (patch.label !== undefined) bundle.label = patch.label;
  }, "꾸러미 이름");
}

function patchFacility(
  tilesetId: string,
  bundleId: string,
  facilityId: string,
  patch: Partial<ConceptFacilityRecord>,
): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const facility = bundle.facilities.find((entry) => entry.id === facilityId);
    if (facility && patch.label !== undefined) facility.label = patch.label;
  }, "시설 이름");
}

function patchPlace(
  tilesetId: string,
  bundleId: string,
  placeId: string,
  patch: Partial<ConceptPlaceRecord>,
): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const place = bundle.places.find((entry) => entry.id === placeId);
    if (place && patch.label !== undefined) place.label = patch.label;
  }, "장소 이름");
}

function patchThing(
  tilesetId: string,
  bundleId: string,
  thingId: string,
  patch: Partial<ConceptThingRecord>,
): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const thing = bundle.things.find((entry) => entry.id === thingId);
    if (!thing) return;
    if (patch.label !== undefined) thing.label = patch.label;
    if ("required" in patch) {
      if (patch.required) thing.required = true;
      else delete thing.required;
    }
  }, "물건 수정");
}

function removePlace(tilesetId: string, bundleId: string, placeId: string): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    bundle.places = bundle.places.filter((place) => place.id !== placeId);
    for (const facility of bundle.facilities) {
      facility.placeIds = facility.placeIds.filter((id) => id !== placeId);
    }
    for (const thing of bundle.things) {
      thing.placeIds = thing.placeIds.filter((id) => id !== placeId);
    }
  }, "장소 삭제");
}

function removeThing(tilesetId: string, bundleId: string, thingId: string): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    bundle.things = bundle.things.filter((thing) => thing.id !== thingId);
  }, "물건 삭제");
}

function mutateBundle(
  tilesetId: string,
  bundleId: string,
  mutate: (bundle: ConceptBundleRecord) => void,
  label: string,
): void {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const bundles = (tileset?.scratchConceptBundles ?? []).map(cloneConceptBundle);
  const bundle = bundles.find((entry) => entry.id === bundleId);
  if (!bundle) return;
  mutate(bundle);
  writeBundles(tilesetId, bundles, label);
}

function writeBundles(tilesetId: string, bundles: readonly ConceptBundleRecord[], label = "개념 꾸러미 수정"): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.scratchConceptBundles = bundles.map(cloneConceptBundle);
  }, { scope: "database", label });
}

function refresh(host: HTMLElement, rerender: () => void): void {
  while (host.firstChild) host.removeChild(host.firstChild);
  renderScratchConceptTab(host, rerender);
}
