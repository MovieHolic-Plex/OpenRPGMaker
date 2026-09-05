// 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」.
// 타일셋에 동봉된 시설→장소→물건→칩 나무를 그림으로 고친다.
// 사용자가 고친 나무는 place_concept 이 그대로 읽는다.

import { editorState } from "@/editor/editorState";
import {
  INTERIOR_OBJECT_CATALOG,
  interiorObjectById,
  type InteriorObjectDef,
} from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { interiorFurnitureKits, interiorObjectFromKit } from "@/editor/interiorRoomVocab";
import { field } from "@/editor/panels/databaseControls";
import { makeDatabaseTabIcon } from "@/editor/panels/databaseTabIcons";
import { emptyState } from "@/editor/panels/databaseWorkspace";
import { duplicateIntoTileset } from "@/editor/harnessSuggestion/structureKitActions";
import { interiorObjectCanvas } from "@/editor/panels/structureKitInspector";
import { getSelectedTilesetId, setSelectedTileset } from "@/editor/panels/tilesetSettingsPanel";
import {
  CONCEPT_FACILITY_TEMPLATES,
  cloneConceptFacilityTemplates,
  conceptFacilityTemplateById,
} from "@/project/defaults/conceptFacilityTemplates";
import { cloneConceptBundle } from "@/project/defaults/scratchInnBundle";
import { store } from "@/project/store";
import type {
  ConceptBundleRecord,
  ConceptChipId,
  ConceptFacilityRecord,
  ConceptPlaceRecord,
  ConceptThingRecord,
  TilesetDef,
} from "@/project/types";
import {
  conceptFacilityWall,
  conceptPlaceCount,
  conceptPlaceFloor,
  conceptPlaceLevel,
  conceptPlaceRole,
  conceptPlaceSize,
} from "@/editor/conceptBundleResolve";
import {
  CONCEPT_CHIP_IDS,
  conceptChipLabel,
  isConceptChipId,
  validateConceptChipId,
  CONCEPT_FLOOR_MATERIAL_LABELS,
  CONCEPT_FLOOR_MATERIALS,
  CONCEPT_LAYOUT_KIND_LABELS,
  CONCEPT_LAYOUT_KINDS,
  CONCEPT_PLACE_COUNT_MAX,
  CONCEPT_PLACE_LEVEL_MAX,
  CONCEPT_PLACE_ROLE_LABELS,
  CONCEPT_PLACE_ROLES,
  CONCEPT_PLACE_SIZE_LABELS,
  CONCEPT_PLACE_SIZES,
  CONCEPT_PLACE_ZONE_LABELS,
  CONCEPT_PLACE_ZONES,
  CONCEPT_WALL_MATERIAL_LABELS,
  CONCEPT_WALL_MATERIALS,
  isConceptFloorMaterial,
  isConceptLayoutKind,
  isConceptPlaceRole,
  isConceptPlaceSize,
  isConceptPlaceZone,
  isConceptWallMaterial,
} from "@/project/types/conceptBundle";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

interface ScratchSession {
  tilesetId: string | null;
  bundleId: string | null;
  facilityId: string | null;
  placeId: string | null;
  thingId: string | null;
  pickerOpen: boolean;
}

const session: ScratchSession = {
  tilesetId: null,
  bundleId: null,
  facilityId: null,
  placeId: null,
  thingId: null,
  pickerOpen: false,
};

export function resetScratchConceptTabSession(): void {
  session.tilesetId = null;
  session.bundleId = null;
  session.facilityId = null;
  session.placeId = null;
  session.thingId = null;
  session.pickerOpen = false;
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
  const place = bundle && facility
    ? bundle.places.find((entry) => entry.id === session.placeId && facility.placeIds.includes(entry.id))
      ?? bundle.places.find((entry) => facility.placeIds.includes(entry.id))
      ?? null
    : null;
  session.placeId = place?.id ?? null;
  const thing = bundle && facility
    ? bundle.things.find((entry) => entry.id === session.thingId && entry.placeIds.some((id) => facility.placeIds.includes(id)))
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
          children: [makeDatabaseTabIcon("scratchConcepts"), el("span", { text: "타일셋별로 분리됨" })],
          attrs: { title: "place_concept 가 이 나무를 읽어 시공합니다. 고친 내용이 다음 시설에 그대로 쓰입니다." },
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
  const canSeedTemplates = tileset.id === INTERIOR_ROOM_TILESET_ID;
  return emptyState({
    icon: "⌂",
    title: "이 타일셋에는 아직 개념 꾸러미가 없습니다.",
    body: canSeedTemplates
      ? "여관·민가·상점처럼 꺼내는 시설 나무를 만듭니다. 그림은 이 칩셋의 가구를 씁니다."
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
    secondary: canSeedTemplates
      ? {
          label: `초안 ${CONCEPT_FACILITY_TEMPLATES.length}종 넣기`,
          kind: "ghost",
          testid: "scratch-concept-seed-templates",
          onClick: () => {
            writeBundles(tileset.id, cloneConceptFacilityTemplates(), "시설 초안 시드");
            const first = CONCEPT_FACILITY_TEMPLATES[0]!;
            session.bundleId = first.id;
            session.facilityId = first.facilities[0]?.id ?? null;
            session.placeId = first.facilities[0]?.placeIds[0] ?? null;
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
  board.append(renderFacilityStrip(tileset, bundle, host, rerender));
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

/** 시설 띠 — 이 타일셋의 꾸러미를 오가고, 아직 없는 초안을 넣거나 빈 시설을 만든다. */
function renderFacilityStrip(
  tileset: TilesetDef,
  active: ConceptBundleRecord,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const bundles = tileset.scratchConceptBundles ?? [];
  const strip = el("div", { class: "scratch-concept-facilities", dataset: { testid: "scratch-concept-facilities" } });
  for (const bundle of bundles) {
    const label = bundle.facilities[0]?.label ?? bundle.label;
    strip.append(
      el("button", {
        class: `scratch-concept-facility${bundle.id === active.id ? " active" : ""}`,
        attrs: { type: "button", title: `${label} — 장소 ${bundle.places.length} · 물건 ${bundle.things.length}` },
        dataset: { testid: `scratch-concept-facility-${bundle.id}` },
        text: label,
        on: {
          click: () => {
            if (session.bundleId === bundle.id) return;
            session.bundleId = bundle.id;
            session.facilityId = bundle.facilities[0]?.id ?? null;
            session.placeId = null;
            session.thingId = null;
            session.pickerOpen = false;
            refresh(host, rerender);
          },
        },
      }),
    );
  }
  strip.append(
    el("button", {
      class: "db-mini-btn",
      attrs: { type: "button", title: "빈 시설 하나를 만든다" },
      dataset: { testid: "scratch-concept-facility-add" },
      text: "+ 시설",
      on: {
        click: () => {
          const created = addBlankBundle(tileset.id);
          session.bundleId = created.id;
          session.facilityId = created.facilities[0]?.id ?? null;
          session.placeId = created.places[0]?.id ?? null;
          session.thingId = null;
          session.pickerOpen = false;
          refresh(host, rerender);
        },
      },
    }),
  );
  const present = new Set(bundles.map((bundle) => bundle.id));
  const missing = tileset.id === INTERIOR_ROOM_TILESET_ID
    ? CONCEPT_FACILITY_TEMPLATES.filter((template) => !present.has(template.id))
    : [];
  if (missing.length > 0) {
    const select = el("select", {
      class: "scratch-concept-plan-select",
      attrs: { title: "초안을 하나 골라 넣는다. 넣은 뒤에는 이 프로젝트의 데이터다" },
      dataset: { testid: "scratch-concept-template-select" },
      on: {
        change: (event) => {
          const id = (event.target as HTMLSelectElement).value;
          const template = conceptFacilityTemplateById(id);
          if (!template) return;
          const current = store.getCurrent().tilesets[tileset.id]?.scratchConceptBundles ?? [];
          if (current.some((bundle) => bundle.id === template.id)) return;
          writeBundles(tileset.id, [...current, cloneConceptBundle(template)], `초안 넣기: ${template.label}`);
          session.bundleId = template.id;
          session.facilityId = template.facilities[0]?.id ?? null;
          session.placeId = template.facilities[0]?.placeIds[0] ?? null;
          session.thingId = null;
          session.pickerOpen = false;
          refresh(host, rerender);
        },
      },
    }) as HTMLSelectElement;
    select.append(el("option", { attrs: { value: "" }, text: "초안 넣기…" }));
    for (const template of missing) {
      select.append(el("option", { attrs: { value: template.id }, text: template.facilities[0]?.label ?? template.label }));
    }
    select.value = "";
    strip.append(select);
  }
  return strip;
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

  const wall = el("select", {
    class: "scratch-concept-plan-select",
    attrs: { title: "벽면 재질 — 크림 벽 · 금빛 벽돌(귀족) · 석재 벽돌(대장간·성소). 시공 뒤 벽면을 이 재질로 바꾼다" },
    dataset: { testid: "scratch-concept-facility-wall" },
    on: {
      change: (event) => {
        const next = (event.target as HTMLSelectElement).value;
        if (isConceptWallMaterial(next)) patchFacility(tileset.id, bundle.id, facility.id, { wall: next === "cream" ? undefined : next });
        refresh(host, rerender);
      },
    },
  }) as HTMLSelectElement;
  const currentWall = conceptFacilityWall(facility);
  for (const value of CONCEPT_WALL_MATERIALS) {
    wall.append(el("option", { attrs: { value, ...(value === currentWall ? { selected: "" } : {}) }, text: CONCEPT_WALL_MATERIAL_LABELS[value] }));
  }
  wall.value = currentWall;

  const layout = el("select", {
    class: "scratch-concept-plan-select scratch-concept-layout-select",
    attrs: { title: "도면 문법 — 한 줄은 방 줄→복도→홀, 두 줄은 객실은 복도 북쪽·날개(주방·창고)는 홀 옆" },
    dataset: { testid: "scratch-concept-facility-layout" },
    on: {
      change: (event) => {
        const next = (event.target as HTMLSelectElement).value;
        if (isConceptLayoutKind(next)) patchFacility(tileset.id, bundle.id, facility.id, { layout: next === "row" ? undefined : next });
        refresh(host, rerender);
      },
    },
  }) as HTMLSelectElement;
  const currentLayout = facility.layout ?? "row";
  for (const value of CONCEPT_LAYOUT_KINDS) {
    layout.append(el("option", { attrs: { value, ...(value === currentLayout ? { selected: "" } : {}) }, text: CONCEPT_LAYOUT_KIND_LABELS[value] }));
  }
  layout.value = currentLayout;

  const membership = el("div", {
    class: "scratch-concept-facility-places",
    dataset: { testid: "scratch-concept-facility-places" },
    children: [el("span", { class: "scratch-concept-quiet", text: "시설 장소" })],
  });
  for (const place of bundle.places) {
    const on = facility.placeIds.includes(place.id);
    membership.append(
      el("button", {
        class: `db-mini-btn${on ? " active" : ""}`,
        attrs: { type: "button", "aria-pressed": String(on), title: on ? "시설에서 뺀다 — 꾸러미에는 남는다" : "시설에 넣는다" },
        dataset: { testid: `scratch-concept-facility-place-${place.id}` },
        text: place.label,
        on: {
          click: () => {
            toggleFacilityPlace(tileset.id, bundle.id, facility.id, place.id);
            if (session.placeId === place.id) {
              const after = store.getCurrent().tilesets[tileset.id]?.scratchConceptBundles
                ?.find((entry) => entry.id === bundle.id)?.facilities.find((entry) => entry.id === facility.id);
              session.placeId = after?.placeIds[0] ?? null;
            }
            refresh(host, rerender);
          },
        },
      }),
    );
  }

  return el("div", {
    class: "scratch-concept-toolbar",
    children: [
      el("div", {
        class: "scratch-concept-crumb",
        dataset: { testid: "scratch-concept-crumb" },
        text: `${facility.label} → 장소 → 물건 → 칩`,
      }),
      field("시설 이름", name),
      field("벽 재질", wall),
      field("도면", layout),
      membership,
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
      el("button", {
        class: "db-mini-btn danger",
        attrs: { type: "button", title: "이 시설(꾸러미)을 지운다. 초안이었다면 시설 띠의 「초안 넣기」로 다시 넣을 수 있다" },
        dataset: { testid: "scratch-concept-facility-remove" },
        text: "시설 삭제",
        on: {
          click: () => {
            removeBundle(tileset.id, bundle.id);
            session.bundleId = null;
            session.facilityId = null;
            session.placeId = null;
            session.thingId = null;
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
  const selectPlace = () => {
    session.placeId = place.id;
    session.pickerOpen = false;
    refresh(host, rerender);
  };
  const card = el("article", {
    class: `scratch-concept-place${active ? " active" : ""}`,
    attrs: { tabindex: "0", role: "button", "aria-label": `${place.label} 선택` },
    dataset: { testid: `scratch-concept-place-${place.id}` },
    on: {
      click: () => {
        selectPlace();
      },
      keydown: (event) => {
        if ((event as KeyboardEvent).key !== "Enter" && (event as KeyboardEvent).key !== " ") return;
        if ((event.target as HTMLElement | null)?.closest?.("input, select, button, textarea, a")) return;
        event.preventDefault();
        selectPlace();
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

  card.append(renderPlacePlanRow(tileset, bundle, place, host, rerender));

  const row = el("div", { class: "scratch-concept-things", dataset: { testid: `scratch-concept-things-${place.id}` } });
  for (const entry of things) {
    row.append(renderThingChip(tileset, bundle, entry, selectedThing?.id === entry.id, host, rerender));
  }
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
  card.append(row);
  return card;
}

/** 도면 열: 역할(홀·복도·방) · 크기 · 개수. place_concept 이 이 셋으로 방을 앉힌다. */
function renderPlacePlanRow(
  tileset: TilesetDef,
  bundle: ConceptBundleRecord,
  place: ConceptPlaceRecord,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const stop = (event: Event): void => event.stopPropagation();
  const role = el("select", {
    class: "scratch-concept-plan-select",
    attrs: { title: "도면 역할 — 홀은 정문을 품고, 복도는 방을 잇고, 방은 그 위에 선다" },
    dataset: { testid: `scratch-concept-place-role-${place.id}` },
    on: {
      click: stop,
      change: (event) => {
        const next = (event.target as HTMLSelectElement).value;
        if (isConceptPlaceRole(next)) patchPlace(tileset.id, bundle.id, place.id, { role: next });
        refresh(host, rerender);
      },
    },
  });
  const currentRole = conceptPlaceRole(place);
  for (const value of CONCEPT_PLACE_ROLES) {
    role.append(el("option", { attrs: { value, ...(value === currentRole ? { selected: "" } : {}) }, text: CONCEPT_PLACE_ROLE_LABELS[value] }));
  }
  role.value = currentRole;

  const size = el("select", {
    class: "scratch-concept-plan-select",
    attrs: { title: "바닥 크기 — 작게 5×3 · 보통 7×4 · 크게 9×5" },
    dataset: { testid: `scratch-concept-place-size-${place.id}` },
    on: {
      click: stop,
      change: (event) => {
        const next = (event.target as HTMLSelectElement).value;
        if (isConceptPlaceSize(next)) patchPlace(tileset.id, bundle.id, place.id, { size: next });
        refresh(host, rerender);
      },
    },
  });
  const currentSize = conceptPlaceSize(place);
  for (const value of CONCEPT_PLACE_SIZES) {
    size.append(el("option", { attrs: { value, ...(value === currentSize ? { selected: "" } : {}) }, text: CONCEPT_PLACE_SIZE_LABELS[value] }));
  }
  size.value = currentSize;

  const count = el("input", {
    class: "scratch-concept-plan-count",
    attrs: { type: "number", min: "1", max: String(CONCEPT_PLACE_COUNT_MAX), step: "1", title: "같은 장소를 몇 개 짓나(객실 ×2)" },
    dataset: { testid: `scratch-concept-place-count-${place.id}` },
    on: {
      click: stop,
      change: (event) => {
        const raw = Math.floor(Number((event.target as HTMLInputElement).value));
        const next = Number.isFinite(raw) ? Math.min(CONCEPT_PLACE_COUNT_MAX, Math.max(1, raw)) : 1;
        patchPlace(tileset.id, bundle.id, place.id, { count: next === 1 ? undefined : next });
        refresh(host, rerender);
      },
    },
  }) as HTMLInputElement;
  count.value = String(conceptPlaceCount(place));

  const floor = el("select", {
    class: "scratch-concept-plan-select",
    attrs: { title: "바닥 재질 — 나무(기본) · 돌 · 널 · 돗자리. 시공 뒤 이 장소의 바닥만 바꾼다" },
    dataset: { testid: `scratch-concept-place-floor-${place.id}` },
    on: {
      click: stop,
      change: (event) => {
        const next = (event.target as HTMLSelectElement).value;
        if (isConceptFloorMaterial(next)) patchPlace(tileset.id, bundle.id, place.id, { floor: next === "wood" ? undefined : next });
        refresh(host, rerender);
      },
    },
  });
  const currentFloor = conceptPlaceFloor(place);
  for (const value of CONCEPT_FLOOR_MATERIALS) {
    floor.append(el("option", { attrs: { value, ...(value === currentFloor ? { selected: "" } : {}) }, text: CONCEPT_FLOOR_MATERIAL_LABELS[value] }));
  }
  floor.value = currentFloor;

  const level = el("select", {
    class: "scratch-concept-plan-select",
    attrs: { title: "층 — 2층 이상 장소는 별도 맵(<mapId>_2f)으로 서고, 계단(맵 연결 칩) 물건이 층을 잇는다" },
    dataset: { testid: `scratch-concept-place-level-${place.id}` },
    on: {
      click: stop,
      change: (event) => {
        const next = Math.floor(Number((event.target as HTMLSelectElement).value));
        const clamped = Number.isFinite(next) ? Math.min(CONCEPT_PLACE_LEVEL_MAX, Math.max(1, next)) : 1;
        patchPlace(tileset.id, bundle.id, place.id, { level: clamped === 1 ? undefined : clamped });
        refresh(host, rerender);
      },
    },
  });
  const currentLevel = conceptPlaceLevel(place);
  for (let value = 1; value <= CONCEPT_PLACE_LEVEL_MAX; value += 1) {
    level.append(el("option", { attrs: { value: String(value), ...(value === currentLevel ? { selected: "" } : {}) }, text: `${value}층` }));
  }
  level.value = String(currentLevel);

  const zone = el("select", {
    class: "scratch-concept-plan-select",
    attrs: { title: "구역 — 두 줄 도면에서 북쪽은 복도 위 객실, 남쪽은 홀 옆 날개. 자동은 주방·창고 라벨을 남쪽으로 본다" },
    dataset: { testid: `scratch-concept-place-zone-${place.id}` },
    on: {
      click: stop,
      change: (event) => {
        const next = (event.target as HTMLSelectElement).value;
        if (next === "auto") patchPlace(tileset.id, bundle.id, place.id, { zone: undefined });
        else if (isConceptPlaceZone(next)) patchPlace(tileset.id, bundle.id, place.id, { zone: next });
        refresh(host, rerender);
      },
    },
  });
  const currentZone = place.zone;
  zone.append(el("option", { attrs: { value: "auto", ...(currentZone === undefined ? { selected: "" } : {}) }, text: "자동" }));
  for (const value of CONCEPT_PLACE_ZONES) {
    zone.append(el("option", { attrs: { value, ...(value === currentZone ? { selected: "" } : {}) }, text: CONCEPT_PLACE_ZONE_LABELS[value] }));
  }
  zone.value = currentZone ?? "auto";

  return el("div", {
    class: "scratch-concept-place-plan",
    dataset: { testid: `scratch-concept-place-plan-${place.id}` },
    children: [
      el("label", { class: "scratch-concept-plan-field", children: [el("span", { text: "역할" }), role] }),
      el("label", { class: "scratch-concept-plan-field", children: [el("span", { text: "크기" }), size] }),
      el("label", { class: "scratch-concept-plan-field", children: [el("span", { text: "개수" }), count] }),
      el("label", { class: "scratch-concept-plan-field", children: [el("span", { text: "바닥" }), floor] }),
      el("label", { class: "scratch-concept-plan-field", children: [el("span", { text: "층" }), level] }),
      el("label", { class: "scratch-concept-plan-field", children: [el("span", { text: "구역" }), zone] }),
    ],
  });
}

function renderThingChip(
  tileset: TilesetDef,
  bundle: ConceptBundleRecord,
  thing: ConceptThingRecord,
  active: boolean,
  host: HTMLElement,
  rerender: () => void,
): HTMLElement {
  const object = resolveThingObject(tileset, thing.objectId);
  const thumb = object
    ? decorateThumb(interiorObjectCanvas(tileset, object, 3), "scratch-concept-thumb")
    : el("span", { class: "scratch-concept-missing", text: "?" });
  // 버튼 안에 버튼을 넣지 않으려 칩 외곽은 div — 칠하기는 안의 버튼, 선택은 칩 클릭/Enter/Space.
  const selectThing = () => {
    session.thingId = thing.id;
    session.pickerOpen = false;
    refresh(host, rerender);
  };
  return el("div", {
    class: `scratch-concept-thing${active ? " active" : ""}${thing.required ? " required" : ""}`,
    attrs: { tabindex: "0", role: "button", "aria-label": `${thing.label} 선택` },
    dataset: { testid: `scratch-concept-thing-${thing.id}` },
    children: [
      thumb,
      el("span", { class: "scratch-concept-thing-label", text: thing.label }),
      el("span", {
        class: "scratch-concept-thing-chips",
        text: thing.chips.map((chip) => conceptChipLabel(chip)).join(" · "),
      }),
      el("button", {
        class: "db-mini-btn scratch-concept-thing-paint",
        attrs: {
          type: "button",
          title: object
            ? "이 그림의 타일을 직접 칠한다 — 카탈로그·시드 그림이면 사본을 만들어 이 물건에 붙이고, 내가 만든 그림이면 그 그림을 바로 고친다"
            : "그림이 없어 칠할 수 없다",
          ...(object ? {} : { disabled: "" }),
        },
        dataset: { testid: `scratch-concept-thing-paint-${thing.id}` },
        text: storedKitId(tileset, thing.objectId) ? "칠하기" : "사본 칠하기",
        on: {
          click: (event) => {
            event.stopPropagation();
            paintThingGraphic(tileset, bundle, thing, host, rerender);
          },
        },
      }),
    ],
    on: {
      click: (event) => {
        event.stopPropagation();
        selectThing();
      },
      keydown: (event) => {
        if ((event as KeyboardEvent).key !== "Enter" && (event as KeyboardEvent).key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        selectThing();
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
  const preview = object
    ? decorateThumb(interiorObjectCanvas(tileset, object, 5), "scratch-concept-preview")
    : el("span", { class: "scratch-concept-missing", text: "그림 없음" });

  const graphic = el("select", {
    class: "scratch-concept-plan-select",
    attrs: { title: "그림 — 같은 타일셋 가구를 가리킨다. 픽셀을 복제하지 않는다" },
    dataset: { testid: "scratch-concept-thing-graphic" },
    on: {
      change: (event) => {
        const next = (event.target as HTMLSelectElement).value;
        if (!next || next === thing.objectId) return;
        patchThing(tileset.id, bundle.id, thing.id, { objectId: next });
        refresh(host, rerender);
      },
    },
  }) as HTMLSelectElement;
  const candidates = objectsForTileset(tileset);
  if (!candidates.some((candidate) => candidate.id === thing.objectId)) {
    graphic.append(el("option", {
      attrs: { value: thing.objectId, selected: "" },
      text: `${thing.objectId} — 그림 없음`,
    }));
  }
  for (const candidate of candidates) {
    graphic.append(el("option", {
      attrs: { value: candidate.id, ...(candidate.id === thing.objectId ? { selected: "" } : {}) },
      text: candidate.id === thing.objectId ? `${candidate.label} — 지금 그림` : candidate.label,
    }));
  }
  graphic.value = thing.objectId;

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
        text: conceptChipLabel(chip),
        on: {
          click: () => {
            toggleChip(tileset.id, bundle.id, thing.id, chip);
            refresh(host, rerender);
          },
        },
      }),
    );
  }
  const chipError = el("p", { class: "scratch-concept-chip-error" });
  chipError.hidden = true;
  const setChipError = (message: string | null): void => {
    if (message) {
      chipError.hidden = false;
      chipError.textContent = message;
      chipError.dataset.testid = "scratch-concept-chip-error";
      return;
    }
    chipError.hidden = true;
    chipError.textContent = "";
    delete chipError.dataset.testid;
  };
  const customChips = thing.chips.filter((chip) => !isConceptChipId(chip));
  for (const chip of customChips) {
    const input = el("input", {
      class: "scratch-concept-chip-custom-input",
      attrs: { type: "text", value: chip, title: "자유 칩 이름 — 바꾸면 바로 저장" },
      dataset: { testid: `scratch-concept-chip-custom-input-${chip}` },
      value: chip,
      on: {
        change: (event) => {
          const field = event.target as HTMLInputElement;
          const result = renameThingChip(tileset.id, bundle.id, thing.id, chip, field.value);
          if (!result.ok) {
            field.value = chip;
            setChipError(result.error);
            return;
          }
          if (result.value === chip) {
            setChipError(null);
            return;
          }
          refresh(host, rerender);
        },
      },
    }) as HTMLInputElement;
    chips.append(
      el("div", {
        class: "scratch-concept-chip-custom",
        attrs: { title: "자유 칩" },
        dataset: { testid: `scratch-concept-chip-custom-${chip}` },
        children: [
          input,
          el("button", {
            class: "scratch-concept-chip-remove",
            attrs: { type: "button", title: "자유 칩 지우기" },
            dataset: { testid: `scratch-concept-chip-remove-${chip}` },
            text: "지우기",
            on: {
              click: () => {
                toggleChip(tileset.id, bundle.id, thing.id, chip);
                refresh(host, rerender);
              },
            },
          }),
        ],
        on: {
          click: (event) => {
            if (event.target !== event.currentTarget) return;
            toggleChip(tileset.id, bundle.id, thing.id, chip);
            refresh(host, rerender);
          },
        },
      }),
    );
  }
  const chipAdd = el("input", {
    class: "scratch-concept-chip-add",
    attrs: { type: "text", placeholder: "자유 칩 추가", title: "영문·숫자·-_·1~32자 — 엔진 무동작 메모" },
    dataset: { testid: "scratch-concept-chip-add" },
    on: {
      change: (event) => {
        const result = addChip(tileset.id, bundle.id, thing.id, (event.target as HTMLInputElement).value);
        if (!result.ok) {
          setChipError(result.error);
          return;
        }
        refresh(host, rerender);
      },
    },
  }) as HTMLInputElement;
  chips.append(chipAdd);

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
      field("이름", name),
      field("그림", graphic),
      el("div", {
        class: "scratch-concept-paint-row",
        children: [
          el("button", {
            class: "db-mini-btn",
            attrs: {
              type: "button",
              title: object
                ? "이 그림의 타일을 직접 칠한다 — 카탈로그·시드 그림이면 사본을 만들어 이 물건에 붙이고, 내가 만든 그림이면 그 그림을 바로 고친다"
                : "그림이 없어 칠할 수 없다 — 먼저 위 「그림」에서 골라라",
              ...(object ? {} : { disabled: "" }),
            },
            dataset: { testid: "scratch-concept-thing-paint" },
            text: storedKitId(tileset, thing.objectId) ? "그림 칠하기" : "사본 만들어 칠하기",
            on: {
              click: () => {
                paintThingGraphic(tileset, bundle, thing, host, rerender);
              },
            },
          }),
          ...(storedKitId(tileset, thing.objectId)
            ? []
            : [el("span", { class: "scratch-concept-quiet", text: "카탈로그·시드 그림은 사본을 만들어 고친다 — 원본은 그대로 둔다" })]),
        ],
      }),
      el("p", {
        class: "scratch-concept-line",
        dataset: { testid: "scratch-concept-line" },
        text: oneLine(bundle, thing),

      }),
      el("div", { class: "scratch-concept-section-label", text: "능력 칩" }),
      chips,
      chipError,
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
  const chips = thing.chips.map((chip) => conceptChipLabel(chip)).join(", ");
  return `${facility} — ${place} — ${thing.label} — ${chips || "칩 없음"}`;
}

export function resolveThingObject(tileset: TilesetDef, objectId: string): InteriorObjectDef | undefined {
  const kit = interiorFurnitureKits(tileset).find((entry) => entry.id === objectId);
  if (kit) return interiorObjectFromKit(kit);
  return interiorObjectById(objectId);
}

export function objectsForTileset(tileset: TilesetDef): readonly InteriorObjectDef[] {
  const kits = interiorFurnitureKits(tileset).map(interiorObjectFromKit);
  if (tileset.id !== INTERIOR_ROOM_TILESET_ID) return kits;
  // 실내 칩셋: 프로젝트 킷이 정본이되, 킷을 시드한 뒤 카탈로그에 늘어난 소품(성상·선반·자루…)도 고를 수 있게 뒤에 붙인다.
  // place_concept 도 같은 순서(킷 → 카탈로그)로 그림을 푼다.
  const known = new Set(kits.map((kit) => kit.id));
  return [...kits, ...INTERIOR_OBJECT_CATALOG.filter((object) => !known.has(object.id))];
}

function ensureScratchBundles(tileset: TilesetDef): TilesetDef {
  if (tileset.scratchConceptBundles !== undefined) return tileset;
  if (tileset.id !== INTERIOR_ROOM_TILESET_ID) return tileset;
  writeBundles(tileset.id, cloneConceptFacilityTemplates(), "시설 초안 시드");
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
  if (object.id.startsWith("stairs")) return ["pass", "transfer"];
  if (object.id.startsWith("rug")) return ["pass", "floor"];
  if (object.snap === "wall-north" || object.snap === "wall-any") return ["wall"];
  if (object.snap === "floor") return ["block"];
  return ["block"];
}

function addChip(
  tilesetId: string,
  bundleId: string,
  thingId: string,
  chip: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const validated = validateConceptChipId(chip);
  if (!validated.ok) return validated;
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const thing = bundle.things.find((entry) => entry.id === thingId);
    if (!thing) return;
    if (!thing.chips.includes(validated.value)) thing.chips = [...thing.chips, validated.value];
  }, "칩 추가");
  return validated;
}

function renameThingChip(
  tilesetId: string,
  bundleId: string,
  thingId: string,
  from: string,
  to: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const validated = validateConceptChipId(to);
  if (!validated.ok) return validated;
  const next = validated.value;
  if (next === from) return validated;
  let error: string | undefined;
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const thing = bundle.things.find((entry) => entry.id === thingId);
    if (!thing || !thing.chips.includes(from)) return;
    if (thing.chips.includes(next)) {
      error = "같은 칩이 이미 있습니다";
      return;
    }
    thing.chips = thing.chips.map((chip) => (chip === from ? next : chip));
  }, "칩 이름");
  if (error) return { ok: false, error };
  return validated;
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

function toggleFacilityPlace(tilesetId: string, bundleId: string, facilityId: string, placeId: string): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const facility = bundle.facilities.find((entry) => entry.id === facilityId);
    if (!facility) return;
    if (facility.placeIds.includes(placeId)) {
      // 시설에서만 뺀다 — 꾸러미 장소·그 장소의 물건은 그대로 둔다.
      facility.placeIds = facility.placeIds.filter((id) => id !== placeId);
      return;
    }
    // 다시 넣을 때는 꾸러미 장소 순서를 따라 붙인다.
    const wanted = new Set([...facility.placeIds, placeId]);
    facility.placeIds = bundle.places.map((place) => place.id).filter((id) => wanted.has(id));
  }, "시설 장소");
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
    if (!facility) return;
    if (patch.label !== undefined) facility.label = patch.label;
    if ("wall" in patch) {
      if (patch.wall) facility.wall = patch.wall;
      else delete facility.wall;
    }
    if ("layout" in patch) {
      if (patch.layout) facility.layout = patch.layout;
      else delete facility.layout;
    }
  }, "시설 수정");
}

function patchPlace(
  tilesetId: string,
  bundleId: string,
  placeId: string,
  patch: Partial<ConceptPlaceRecord>,
): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    const place = bundle.places.find((entry) => entry.id === placeId);
    if (!place) return;
    if (patch.label !== undefined) place.label = patch.label;
    if ("role" in patch) {
      if (patch.role) place.role = patch.role;
      else delete place.role;
    }
    if ("size" in patch) {
      if (patch.size) place.size = patch.size;
      else delete place.size;
    }
    if ("count" in patch) {
      if (patch.count !== undefined && patch.count > 1) place.count = patch.count;
      else delete place.count;
    }
    if ("floor" in patch) {
      if (patch.floor) place.floor = patch.floor;
      else delete place.floor;
    }
    if ("level" in patch) {
      if (patch.level !== undefined && patch.level > 1) place.level = patch.level;
      else delete place.level;
    }
    if ("zone" in patch) {
      if (patch.zone) place.zone = patch.zone;
      else delete place.zone;
    }
  }, "장소 도면");
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
    if (patch.objectId !== undefined) thing.objectId = patch.objectId;
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

function removeBundle(tilesetId: string, bundleId: string): void {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const bundles = (tileset?.scratchConceptBundles ?? []).filter((bundle) => bundle.id !== bundleId);
  // 마지막 시설을 지우면 빈 배열이 남는다 — 사용자가 비운 것이라 다시 시드하지 않는다.
  writeBundles(tilesetId, bundles, "시설 삭제");
}

function removeThing(tilesetId: string, bundleId: string, thingId: string): void {
  mutateBundle(tilesetId, bundleId, (bundle) => {
    bundle.things = bundle.things.filter((thing) => thing.id !== thingId);
  }, "물건 삭제");
}

/** 직접 칠할 사용자 section 킷 id. 카탈로그·interior-catalog 시드는 사본을 써야 하므로 null. */
function storedKitId(tileset: TilesetDef, objectId: string): string | null {
  const kit = (tileset.structureKits ?? []).find((entry) => entry.id === objectId);
  return kit?.kind === "section" && kit.learnedFrom !== "interior-catalog" ? kit.id : null;
}

/**
 * 물건 그림을 칠 수 있는 타일셋 킷 id 를 확보한다 — UI 없음.
 * 사용자 section 킷이면 그 id, 카탈로그·시드면 사본을 만들어 thing.objectId 를 붙인 뒤 사본 id.
 * 물건을 풀 수 없으면 null.
 */
export function ensureThingKitForEdit(tilesetId: string, bundleId: string, thingId: string): string | null {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) return null;
  const bundle = (tileset.scratchConceptBundles ?? []).find((entry) => entry.id === bundleId);
  if (!bundle) return null;
  const thing = bundle.things.find((entry) => entry.id === thingId);
  if (!thing) return null;
  const object = resolveThingObject(tileset, thing.objectId);
  if (!object) return null;
  const existing = storedKitId(tileset, thing.objectId);
  if (existing) return existing;
  const copy = duplicateIntoTileset(tilesetId, object);
  patchThing(tilesetId, bundleId, thingId, { objectId: copy.id });
  return copy.id;
}

/** `ensureThingKitForEdit` 뒤 구조물 타일 에디터를 연다. 카탈로그 사본이면 화면을 한 번 다시 그린다. */
function paintThingGraphic(
  tileset: TilesetDef,
  bundle: ConceptBundleRecord,
  thing: ConceptThingRecord,
  host: HTMLElement,
  rerender: () => void,
): void {
  const kitId = ensureThingKitForEdit(tileset.id, bundle.id, thing.id);
  if (!kitId) return;
  if (kitId !== thing.objectId) refresh(host, rerender);
  void import("@/editor/panels/structureKitEditorDialog").then(({ openStructureKitEditor }) => {
    openStructureKitEditor(tileset.id, kitId, () => {
      refresh(host, rerender);
    });
  }).catch(() => {
    toast("그림 에디터를 열지 못했습니다. 다시 시도해 주세요.", "error");
  });
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
