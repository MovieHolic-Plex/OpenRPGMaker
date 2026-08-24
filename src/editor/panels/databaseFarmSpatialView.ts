import {
  farmBuildingTypeReferenceMessage,
  homeDecorationTypeReferenceMessage,
} from "@/editor/databaseReferences";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { canOccupySpatialFootprint } from "@/project/spatialOccupancy";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type {
  Dir,
  FarmBuildingLevelDefinition,
  FarmBuildingPlacement,
  FarmBuildingTypeRecord,
  HomeDecorationPlacement,
  HomeDecorationTypeRecord,
  Project,
} from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const ORIENTATIONS: readonly Dir[] = ["down", "left", "right", "up"];
const DEFAULT_GRAPHIC = "easyrpg-picture-cloud";

export function renderFarmSpatialTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const buildingTypes = project.database.farmBuildingTypes ?? [];
  const decorationTypes = project.database.homeDecorationTypes ?? [];
  const buildingPlacements = project.session.farmBuildingPlacements ?? [];
  const decorationPlacements = project.session.homeDecorationPlacements ?? [];
  const count = buildingTypes.length + decorationTypes.length + buildingPlacements.length + decorationPlacements.length;
  host.append(el("section", {
    class: "db-life-authoring-workspace db-spatial-workspace",
    dataset: { testid: "db-spatial-workspace" },
    children: [
      el("header", {
        class: "db-spatial-hero",
        children: [
          el("img", {
            attrs: {
              src: "/assets/farming/life-ui/decorating-card.png",
              alt: "농장 건물과 집 꾸미기",
              loading: "lazy",
            },
            dataset: { testid: "db-spatial-hero-image" },
          }),
          el("div", { children: [
            el("span", { class: "db-life-panel-eyebrow", text: "공간과 성장" }),
            el("h2", { text: "농장 건물·집 꾸미기" }),
            el("p", { text: "동물 축사와 별개인 범용 건물의 크기·수용량·업그레이드, 집 장식의 회전·배치를 설계합니다." }),
          ] }),
        ],
      }),
      el("div", {
        class: "db-life-toolbar db-spatial-toolbar",
        children: [
          addButton("건물 유형 추가", "db-spatial-add-building-type", () => addBuildingType(rerender)),
          addButton("장식 유형 추가", "db-spatial-add-decoration-type", () => addDecorationType(rerender)),
          addButton("시작 건물 배치", "db-spatial-add-building-placement", () => addBuildingPlacement(rerender)),
          addButton("시작 장식 배치", "db-spatial-add-decoration-placement", () => addDecorationPlacement(rerender)),
          el("span", { text: `건물 유형 ${buildingTypes.length} · 장식 유형 ${decorationTypes.length} · 시작 배치 ${buildingPlacements.length + decorationPlacements.length}` }),
        ],
      }),
      ...(count === 0 ? [el("div", {
        class: "db-spatial-empty-state",
        dataset: { testid: "db-spatial-empty-state" },
        children: [el("strong", { text: "아직 설계된 공간 요소가 없습니다." }), el("p", { text: "먼저 건물 유형이나 장식 유형을 추가한 다음 시작 배치를 만드세요." })],
      })] : []),
      el("div", {
        class: "db-spatial-grid",
        children: [
          panel("범용 농장 건물", "레벨마다 footprint, 수용량, 비용, 그래픽을 설정합니다.", buildingTypes.map((row, index) => buildingTypeCard(row, index, rerender))),
          panel("집 장식", "인벤토리 아이템과 회전 방향, 충돌 footprint를 설정합니다.", decorationTypes.map((row, index) => decorationTypeCard(row, index, rerender))),
          panel("시작 건물 배치", "새 게임에서 생성될 범용 건물입니다.", buildingPlacements.map((row, index) => buildingPlacementCard(row, index, buildingTypes, rerender))),
          panel("시작 장식 배치", "새 게임에서 인벤토리와 별도로 시작 배치되는 장식입니다.", decorationPlacements.map((row, index) => decorationPlacementCard(row, index, decorationTypes, rerender))),
        ],
      }),
    ],
  }));
}

function buildingTypeCard(record: FarmBuildingTypeRecord, index: number, rerender: () => void): HTMLElement {
  return el("article", {
    class: "db-life-record-card db-spatial-record-card",
    dataset: { testid: `db-spatial-building-type-${record.id}` },
    children: [
      textField("ID", record.id, `db-spatial-building-id-${record.id}`, (value) => renameBuildingType(index, value, rerender)),
      textField("이름", record.name, `db-spatial-building-name-${record.id}`, (value) => patchBuildingType(index, { name: value }, rerender)),
      mapChecks(record.allowedMapIds, `db-spatial-building-map-${record.id}`, (ids) => patchBuildingType(index, { allowedMapIds: ids.length ? ids : undefined }, rerender)),
      ...record.levels.map((level, levelIndex) => buildingLevelCard(record, index, level, levelIndex, rerender)),
      addButton("업그레이드 레벨 추가", `db-spatial-building-add-level-${record.id}`, () => addBuildingLevel(index, rerender)),
      deleteButton("건물 유형 삭제", `db-spatial-delete-building-type-${record.id}`, () => removeBuildingType(index, rerender)),
    ],
  });
}

function buildingLevelCard(
  record: FarmBuildingTypeRecord,
  typeIndex: number,
  level: FarmBuildingLevelDefinition,
  levelIndex: number,
  rerender: () => void,
): HTMLElement {
  const prefix = `${record.id}-${level.level}`;
  const costItems = level.cost?.items ?? [];
  return el("section", {
    class: "db-spatial-level-card",
    dataset: { testid: `db-spatial-building-level-${prefix}` },
    children: [
      el("h4", { text: level.level === 1 ? "Lv.1 건설" : `Lv.${level.level} 업그레이드` }),
      textField("레벨 이름", level.name ?? "", `db-spatial-building-level-name-${prefix}`, (value) => patchBuildingLevel(typeIndex, levelIndex, { name: value || undefined }, rerender)),
      numberField("너비", level.footprint.width, 1, 16, `db-spatial-building-width-${prefix}`, (value) => patchFootprint(typeIndex, levelIndex, "width", value, rerender)),
      numberField("높이", level.footprint.height, 1, 16, `db-spatial-building-height-${prefix}`, (value) => patchFootprint(typeIndex, levelIndex, "height", value, rerender)),
      numberField("수용량", level.capacity, 1, 9999, `db-spatial-building-capacity-${prefix}`, (value) => patchBuildingLevel(typeIndex, levelIndex, { capacity: value }, rerender)),
      numberField("골드 비용", level.cost?.gold ?? 0, 0, 9_999_999, `db-spatial-building-gold-${prefix}`, (value) => patchBuildingCost(typeIndex, levelIndex, { gold: value }, rerender)),
      textField("기본 그래픽 ID", level.graphicResourceId, `db-spatial-building-graphic-${prefix}`, (value) => patchBuildingLevel(typeIndex, levelIndex, { graphicResourceId: value }, rerender)),
      orientationGraphicFields(level.orientationGraphicResourceIds, `db-spatial-building-orientation-graphic-${prefix}`, (graphics) => patchBuildingLevel(typeIndex, levelIndex, { orientationGraphicResourceIds: graphics }, rerender)),
      el("div", {
        class: "db-spatial-cost-list",
        children: [
          ...costItems.map((item, itemIndex) => el("div", {
            class: "db-spatial-inline-row",
            children: [
              itemSelect("재료", item.itemId, `db-spatial-building-cost-item-${prefix}-${itemIndex}`, (itemId) => patchBuildingCostItem(typeIndex, levelIndex, itemIndex, { itemId }, rerender)),
              numberField("수량", item.count, 1, 9_999_999, `db-spatial-building-cost-count-${prefix}-${itemIndex}`, (count) => patchBuildingCostItem(typeIndex, levelIndex, itemIndex, { count }, rerender)),
              deleteButton("재료 삭제", `db-spatial-building-cost-delete-${prefix}-${itemIndex}`, () => removeBuildingCostItem(typeIndex, levelIndex, itemIndex, rerender)),
            ],
          })),
          addButton("재료 추가", `db-spatial-building-cost-add-${prefix}`, () => addBuildingCostItem(typeIndex, levelIndex, rerender)),
        ],
      }),
      ...(levelIndex > 0 ? [deleteButton("업그레이드 레벨 삭제", `db-spatial-building-delete-level-${prefix}`, () => removeBuildingLevel(typeIndex, levelIndex, rerender))] : []),
    ],
  });
}

function decorationTypeCard(record: HomeDecorationTypeRecord, index: number, rerender: () => void): HTMLElement {
  return el("article", {
    class: "db-life-record-card db-spatial-record-card",
    dataset: { testid: `db-spatial-decoration-type-${record.id}` },
    children: [
      textField("ID", record.id, `db-spatial-decoration-id-${record.id}`, (value) => renameDecorationType(index, value, rerender)),
      textField("이름", record.name, `db-spatial-decoration-name-${record.id}`, (value) => patchDecorationType(index, { name: value }, rerender)),
      itemSelect("배치 아이템", record.placementItemId, `db-spatial-decoration-item-${record.id}`, (placementItemId) => patchDecorationType(index, { placementItemId }, rerender)),
      numberField("너비", record.footprint.width, 1, 16, `db-spatial-decoration-width-${record.id}`, (width) => patchDecorationType(index, { footprint: { ...record.footprint, width } }, rerender)),
      numberField("높이", record.footprint.height, 1, 16, `db-spatial-decoration-height-${record.id}`, (height) => patchDecorationType(index, { footprint: { ...record.footprint, height } }, rerender)),
      checkboxField("이동을 막음", record.blocksMovement, `db-spatial-decoration-blocks-${record.id}`, (blocksMovement) => patchDecorationType(index, { blocksMovement }, rerender)),
      textField("기본 그래픽 ID", record.graphicResourceId, `db-spatial-decoration-graphic-${record.id}`, (graphicResourceId) => patchDecorationType(index, { graphicResourceId }, rerender)),
      orientationChecks(record.allowedOrientations, record.id, (allowedOrientations) => patchDecorationType(index, { allowedOrientations }, rerender)),
      orientationGraphicFields(record.orientationGraphicResourceIds, `db-spatial-decoration-orientation-graphic-${record.id}`, (orientationGraphicResourceIds) => patchDecorationType(index, { orientationGraphicResourceIds }, rerender)),
      mapChecks(record.allowedMapIds, `db-spatial-decoration-map-${record.id}`, (ids) => patchDecorationType(index, { allowedMapIds: ids.length ? ids : undefined }, rerender)),
      deleteButton("장식 유형 삭제", `db-spatial-delete-decoration-type-${record.id}`, () => removeDecorationType(index, rerender)),
    ],
  });
}

function buildingPlacementCard(
  record: FarmBuildingPlacement,
  index: number,
  types: readonly FarmBuildingTypeRecord[],
  rerender: () => void,
): HTMLElement {
  const type = types.find((entry) => entry.id === record.typeId);
  return el("article", {
    class: "db-life-record-card db-spatial-record-card",
    dataset: { testid: `db-spatial-building-placement-${record.instanceId}` },
    children: [
      textField("배치 ID", record.instanceId, `db-spatial-building-placement-id-${record.instanceId}`, (value) => renameBuildingPlacement(index, value, rerender)),
      selectField("건물 유형", record.typeId, types.map(namedOption), `db-spatial-building-placement-type-${record.instanceId}`, (typeId) => patchBuildingPlacement(index, { typeId, level: 1 }, rerender)),
      numberField("레벨", record.level, 1, Math.max(1, type?.levels.length ?? 1), `db-spatial-building-placement-level-${record.instanceId}`, (level) => patchBuildingPlacement(index, { level }, rerender)),
      placementFields("building", record, index, rerender),
      deleteButton("시작 건물 삭제", `db-spatial-delete-building-placement-${record.instanceId}`, () => removeBuildingPlacement(index, rerender)),
    ],
  });
}

function decorationPlacementCard(
  record: HomeDecorationPlacement,
  index: number,
  types: readonly HomeDecorationTypeRecord[],
  rerender: () => void,
): HTMLElement {
  const type = types.find((entry) => entry.id === record.typeId);
  return el("article", {
    class: "db-life-record-card db-spatial-record-card",
    dataset: { testid: `db-spatial-decoration-placement-${record.instanceId}` },
    children: [
      textField("배치 ID", record.instanceId, `db-spatial-decoration-placement-id-${record.instanceId}`, (value) => renameDecorationPlacement(index, value, rerender)),
      selectField("장식 유형", record.typeId, types.map(namedOption), `db-spatial-decoration-placement-type-${record.instanceId}`, (typeId) => {
        const nextType = types.find((entry) => entry.id === typeId);
        patchDecorationPlacement(index, { typeId, orientation: nextType?.allowedOrientations[0] ?? "down" }, rerender);
      }),
      placementFields("decoration", record, index, rerender, type?.allowedOrientations),
      deleteButton("시작 장식 삭제", `db-spatial-delete-decoration-placement-${record.instanceId}`, () => removeDecorationPlacement(index, rerender)),
    ],
  });
}

function placementFields(
  kind: "building" | "decoration",
  record: FarmBuildingPlacement | HomeDecorationPlacement,
  index: number,
  rerender: () => void,
  orientations: readonly Dir[] = ORIENTATIONS,
): HTMLElement {
  const patch = (value: Partial<typeof record>): void => kind === "building"
    ? patchBuildingPlacement(index, value, rerender)
    : patchDecorationPlacement(index, value, rerender);
  const prefix = `db-spatial-${kind}-placement`;
  return el("div", {
    class: "db-spatial-placement-fields",
    children: [
      selectField("맵", record.mapId, mapOptions(), `${prefix}-map-${record.instanceId}`, (mapId) => patch({ mapId })),
      numberField("X", record.x, 0, 9999, `${prefix}-x-${record.instanceId}`, (x) => patch({ x })),
      numberField("Y", record.y, 0, 9999, `${prefix}-y-${record.instanceId}`, (y) => patch({ y })),
      selectField("방향", record.orientation, orientations.map((value) => ({ value, label: orientationLabel(value) })), `${prefix}-orientation-${record.instanceId}`, (orientation) => patch({ orientation: orientation as Dir })),
    ],
  });
}

function panel(title: string, description: string, cards: HTMLElement[]): HTMLElement {
  return el("section", { class: "db-life-card db-spatial-panel", children: [el("h3", { text: title }), el("p", { text: description }), ...cards] });
}

function addBuildingType(rerender: () => void): void {
  recordProjectSnapshot("범용 농장 건물 유형 추가");
  store.update((project) => {
    const id = uniqueId("farm_building", new Set((project.database.farmBuildingTypes ?? []).map((entry) => entry.id)));
    project.database.farmBuildingTypes ??= [];
    project.database.farmBuildingTypes.push({
      id,
      name: "새 농장 건물",
      levels: [{ level: 1, footprint: { width: 2, height: 2 }, capacity: 4, graphicResourceId: DEFAULT_GRAPHIC }],
    });
  });
  rerender();
}

function addDecorationType(rerender: () => void): void {
  const itemId = store.getCurrent().database.items[0]?.id;
  if (!itemId) { toast("장식에 연결할 아이템을 먼저 추가하세요.", "error"); return; }
  recordProjectSnapshot("집 장식 유형 추가");
  store.update((project) => {
    const id = uniqueId("home_decoration", new Set((project.database.homeDecorationTypes ?? []).map((entry) => entry.id)));
    project.database.homeDecorationTypes ??= [];
    project.database.homeDecorationTypes.push({
      id,
      name: "새 집 장식",
      placementItemId: itemId,
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
      allowedOrientations: ["down"],
      graphicResourceId: DEFAULT_GRAPHIC,
    });
  });
  rerender();
}

function addBuildingPlacement(rerender: () => void): void {
  const project = store.getCurrent();
  const type = project.database.farmBuildingTypes?.[0];
  const level = type?.levels[0];
  if (!type || !level) { toast("건물 유형을 먼저 추가하세요.", "info"); return; }
  const position = findFreePosition(project, level.footprint, "down");
  if (!position) { toast("건물을 배치할 빈 공간을 찾지 못했습니다.", "error"); return; }
  recordProjectSnapshot("시작 범용 농장 건물 배치");
  store.update((draft) => {
    draft.session.farmBuildingPlacements ??= [];
    draft.session.farmBuildingPlacements.push({
      instanceId: uniqueId("farm_building_placement", new Set(draft.session.farmBuildingPlacements.map((entry) => entry.instanceId))),
      typeId: type.id,
      level: 1,
      ...position,
    });
  });
  rerender();
}

function addDecorationPlacement(rerender: () => void): void {
  const project = store.getCurrent();
  const type = project.database.homeDecorationTypes?.[0];
  const orientation = type?.allowedOrientations[0];
  if (!type || !orientation) { toast("장식 유형을 먼저 추가하세요.", "info"); return; }
  const position = findFreePosition(project, type.footprint, orientation);
  if (!position) { toast("장식을 배치할 빈 공간을 찾지 못했습니다.", "error"); return; }
  recordProjectSnapshot("시작 집 장식 배치");
  store.update((draft) => {
    draft.session.homeDecorationPlacements ??= [];
    draft.session.homeDecorationPlacements.push({
      instanceId: uniqueId("home_decoration_placement", new Set(draft.session.homeDecorationPlacements.map((entry) => entry.instanceId))),
      typeId: type.id,
      ...position,
    });
  });
  rerender();
}

function findFreePosition(project: Project, footprint: { width: number; height: number }, orientation: Dir) {
  const session = startSession(project, 0);
  const maps = Object.values(project.maps);
  for (const map of maps) {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const position = { mapId: map.id, x, y, orientation };
        if (canOccupySpatialFootprint(project, session, position, footprint)) return position;
      }
    }
  }
  return undefined;
}

function addBuildingLevel(typeIndex: number, rerender: () => void): void {
  recordProjectSnapshot("건물 업그레이드 레벨 추가");
  store.update((project) => {
    const type = project.database.farmBuildingTypes?.[typeIndex];
    const previous = type?.levels.at(-1);
    if (!type || !previous || type.levels.length >= 16) return;
    type.levels.push({ ...structuredClone(previous), level: previous.level + 1, name: `Lv.${previous.level + 1}`, cost: undefined });
  });
  rerender();
}

function removeBuildingLevel(typeIndex: number, levelIndex: number, rerender: () => void): void {
  recordProjectSnapshot("건물 업그레이드 레벨 삭제");
  store.update((project) => { project.database.farmBuildingTypes?.[typeIndex]?.levels.splice(levelIndex); });
  rerender();
}

function addBuildingCostItem(typeIndex: number, levelIndex: number, rerender: () => void): void {
  const itemId = store.getCurrent().database.items[0]?.id;
  if (!itemId) return;
  recordProjectSnapshot("건물 재료 추가");
  store.update((project) => {
    const level = project.database.farmBuildingTypes?.[typeIndex]?.levels[levelIndex];
    if (!level) return;
    project.database.farmBuildingTypes![typeIndex]!.levels[levelIndex] = {
      ...level,
      cost: { ...level.cost, items: [...(level.cost?.items ?? []), { itemId, count: 1 }] },
    };
  });
  rerender();
}

function removeBuildingCostItem(typeIndex: number, levelIndex: number, itemIndex: number, rerender: () => void): void {
  recordProjectSnapshot("건물 재료 삭제");
  store.update((project) => {
    const level = project.database.farmBuildingTypes?.[typeIndex]?.levels[levelIndex];
    if (!level) return;
    project.database.farmBuildingTypes![typeIndex]!.levels[levelIndex] = {
      ...level,
      cost: { ...level.cost, items: (level.cost?.items ?? []).filter((_, index) => index !== itemIndex) },
    };
  });
  rerender();
}

function patchBuildingType(index: number, patch: Partial<FarmBuildingTypeRecord>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-spatial-building-type:${index}`);
  store.update((project) => { const row = project.database.farmBuildingTypes?.[index]; if (row) project.database.farmBuildingTypes![index] = { ...row, ...patch }; });
  rerender();
}

function patchBuildingLevel(index: number, levelIndex: number, patch: Partial<FarmBuildingLevelDefinition>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-spatial-building-level:${index}:${levelIndex}`);
  store.update((project) => { const row = project.database.farmBuildingTypes?.[index]?.levels[levelIndex]; if (row) project.database.farmBuildingTypes![index]!.levels[levelIndex] = { ...row, ...patch }; });
  rerender();
}

function patchFootprint(index: number, levelIndex: number, axis: "width" | "height", value: number, rerender: () => void): void {
  const level = store.getCurrent().database.farmBuildingTypes?.[index]?.levels[levelIndex];
  if (!level) return;
  const next = { ...level.footprint, [axis]: value };
  if (next.width * next.height > 128) next[axis] = Math.max(1, Math.floor(128 / (axis === "width" ? next.height : next.width)));
  patchBuildingLevel(index, levelIndex, { footprint: next }, rerender);
}

function patchBuildingCost(index: number, levelIndex: number, patch: { gold?: number }, rerender: () => void): void {
  const level = store.getCurrent().database.farmBuildingTypes?.[index]?.levels[levelIndex];
  if (!level) return;
  patchBuildingLevel(index, levelIndex, { cost: { ...level.cost, ...patch } }, rerender);
}

function patchBuildingCostItem(index: number, levelIndex: number, itemIndex: number, patch: { itemId?: string; count?: number }, rerender: () => void): void {
  const level = store.getCurrent().database.farmBuildingTypes?.[index]?.levels[levelIndex];
  const items = level?.cost?.items;
  if (!level || !items?.[itemIndex]) return;
  const next = items.map((item, current) => current === itemIndex ? { ...item, ...patch } : item);
  patchBuildingLevel(index, levelIndex, { cost: { ...level.cost, items: next } }, rerender);
}

function patchDecorationType(index: number, patch: Partial<HomeDecorationTypeRecord>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-spatial-decoration-type:${index}`);
  store.update((project) => { const row = project.database.homeDecorationTypes?.[index]; if (row) project.database.homeDecorationTypes![index] = { ...row, ...patch }; });
  rerender();
}

function patchBuildingPlacement(index: number, patch: Partial<FarmBuildingPlacement>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-spatial-building-placement:${index}`);
  store.update((project) => { const row = project.session.farmBuildingPlacements?.[index]; if (row) project.session.farmBuildingPlacements![index] = { ...row, ...patch }; });
  rerender();
}

function patchDecorationPlacement(index: number, patch: Partial<HomeDecorationPlacement>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-spatial-decoration-placement:${index}`);
  store.update((project) => { const row = project.session.homeDecorationPlacements?.[index]; if (row) project.session.homeDecorationPlacements![index] = { ...row, ...patch }; });
  rerender();
}

function renameBuildingType(index: number, raw: string, rerender: () => void): void {
  renameType("building", index, raw, rerender);
}
function renameDecorationType(index: number, raw: string, rerender: () => void): void {
  renameType("decoration", index, raw, rerender);
}
function renameType(kind: "building" | "decoration", index: number, raw: string, rerender: () => void): void {
  const id = cleanId(raw);
  const project = store.getCurrent();
  const rows = kind === "building" ? project.database.farmBuildingTypes ?? [] : project.database.homeDecorationTypes ?? [];
  const current = rows[index];
  if (!current || !id || rows.some((row, rowIndex) => rowIndex !== index && row.id === id)) { toast("ID는 비어 있지 않고 같은 목록에서 고유해야 합니다.", "error"); rerender(); return; }
  recordProjectSnapshot(kind === "building" ? "건물 유형 ID 변경" : "장식 유형 ID 변경");
  store.update((draft) => {
    if (kind === "building") {
      const row = draft.database.farmBuildingTypes?.[index];
      if (!row) return;
      const oldId = row.id;
      draft.database.farmBuildingTypes![index] = { ...row, id };
      draft.session.farmBuildingPlacements = draft.session.farmBuildingPlacements?.map((placement) => placement.typeId === oldId ? { ...placement, typeId: id } : placement);
    } else {
      const row = draft.database.homeDecorationTypes?.[index];
      if (!row) return;
      const oldId = row.id;
      draft.database.homeDecorationTypes![index] = { ...row, id };
      draft.session.homeDecorationPlacements = draft.session.homeDecorationPlacements?.map((placement) => placement.typeId === oldId ? { ...placement, typeId: id } : placement);
    }
  });
  rerender();
}

function renameBuildingPlacement(index: number, raw: string, rerender: () => void): void { renamePlacement("building", index, raw, rerender); }
function renameDecorationPlacement(index: number, raw: string, rerender: () => void): void { renamePlacement("decoration", index, raw, rerender); }
function renamePlacement(kind: "building" | "decoration", index: number, raw: string, rerender: () => void): void {
  const id = cleanId(raw);
  const project = store.getCurrent();
  const rows = kind === "building" ? project.session.farmBuildingPlacements ?? [] : project.session.homeDecorationPlacements ?? [];
  if (!id || rows.some((row, rowIndex) => rowIndex !== index && row.instanceId === id)) { toast("배치 ID는 같은 목록에서 고유해야 합니다.", "error"); rerender(); return; }
  if (kind === "building") patchBuildingPlacement(index, { instanceId: id }, rerender);
  else patchDecorationPlacement(index, { instanceId: id }, rerender);
}

function removeBuildingType(index: number, rerender: () => void): void {
  const row = store.getCurrent().database.farmBuildingTypes?.[index];
  if (!row) return;
  const blocked = farmBuildingTypeReferenceMessage(row.id);
  if (blocked) { toast(blocked, "error"); return; }
  recordProjectSnapshot("범용 농장 건물 유형 삭제");
  store.update((project) => { project.database.farmBuildingTypes?.splice(index, 1); });
  rerender();
}

function removeDecorationType(index: number, rerender: () => void): void {
  const row = store.getCurrent().database.homeDecorationTypes?.[index];
  if (!row) return;
  const blocked = homeDecorationTypeReferenceMessage(row.id);
  if (blocked) { toast(blocked, "error"); return; }
  recordProjectSnapshot("집 장식 유형 삭제");
  store.update((project) => { project.database.homeDecorationTypes?.splice(index, 1); });
  rerender();
}

function removeBuildingPlacement(index: number, rerender: () => void): void { recordProjectSnapshot("시작 범용 농장 건물 삭제"); store.update((project) => { project.session.farmBuildingPlacements?.splice(index, 1); }); rerender(); }
function removeDecorationPlacement(index: number, rerender: () => void): void { recordProjectSnapshot("시작 집 장식 삭제"); store.update((project) => { project.session.homeDecorationPlacements?.splice(index, 1); }); rerender(); }

function orientationChecks(value: readonly Dir[], id: string, onChange: (value: Dir[]) => void): HTMLElement {
  return el("fieldset", {
    class: "db-spatial-check-grid",
    children: [el("legend", { text: "허용 회전" }), ...ORIENTATIONS.map((orientation) => checkboxField(
      orientationLabel(orientation),
      value.includes(orientation),
      `db-spatial-decoration-orientation-${id}-${orientation}`,
      (checked) => {
        const next = checked ? [...new Set([...value, orientation])] : value.filter((entry) => entry !== orientation);
        if (next.length === 0) { toast("회전 방향은 하나 이상 필요합니다.", "error"); return; }
        onChange(next);
      },
    ))],
  });
}

function orientationGraphicFields(
  value: Partial<Record<Dir, string>> | undefined,
  prefix: string,
  onChange: (value: Partial<Record<Dir, string>> | undefined) => void,
): HTMLElement {
  return el("details", {
    class: "db-spatial-optional-fields",
    children: [
      el("summary", { text: "방향별 그래픽(선택)" }),
      ...ORIENTATIONS.map((orientation) => textField(orientationLabel(orientation), value?.[orientation] ?? "", `${prefix}-${orientation}`, (resourceId) => {
        const next = { ...value };
        if (resourceId) next[orientation] = resourceId;
        else delete next[orientation];
        onChange(Object.keys(next).length > 0 ? next : undefined);
      })),
    ],
  });
}

function mapChecks(value: readonly string[] | undefined, prefix: string, onChange: (ids: string[]) => void): HTMLElement {
  const maps = Object.values(store.getCurrent().maps);
  return el("fieldset", {
    class: "db-spatial-check-grid",
    children: [el("legend", { text: "허용 맵 (선택하지 않으면 전체)" }), ...maps.map((map) => checkboxField(
      map.name,
      value?.includes(map.id) ?? false,
      `${prefix}-${map.id}`,
      (checked) => onChange(checked ? [...new Set([...(value ?? []), map.id])] : (value ?? []).filter((id) => id !== map.id)),
    ))],
  });
}

function textField(label: string, value: string, testid: string, onChange: (value: string) => void): HTMLElement {
  return field(label, el("input", { attrs: { type: "text", value }, dataset: { testid }, on: { change: (event) => onChange(valueOf(event)) } }));
}
function numberField(label: string, value: number, min: number, max: number, testid: string, onChange: (value: number) => void): HTMLElement {
  return field(label, el("input", { attrs: { type: "number", value: String(value), min: String(min), max: String(max) }, dataset: { testid }, on: { change: (event) => onChange(clampInt(valueOf(event), min, max)) } }));
}
function checkboxField(label: string, checked: boolean, testid: string, onChange: (checked: boolean) => void): HTMLElement {
  return el("label", { class: "db-spatial-checkbox", children: [el("input", { attrs: { type: "checkbox", ...(checked ? { checked: "" } : {}) }, dataset: { testid }, on: { change: (event) => onChange((event.currentTarget as HTMLInputElement).checked) } }), el("span", { text: label })] });
}
function itemSelect(label: string, value: string, testid: string, onChange: (value: string) => void): HTMLElement {
  return selectField(label, value, store.getCurrent().database.items.map(namedOption), testid, onChange);
}
function selectField(label: string, value: string, options: readonly { value: string; label: string }[], testid: string, onChange: (value: string) => void): HTMLElement {
  return field(label, el("select", { dataset: { testid }, on: { change: (event) => onChange(valueOf(event)) }, children: options.map((entry) => el("option", { text: entry.label, attrs: { value: entry.value, ...(entry.value === value ? { selected: "" } : {}) } })) }));
}
function field(label: string, control: HTMLElement): HTMLElement { return el("label", { class: "field", children: [el("span", { text: label }), control] }); }
function addButton(label: string, testid: string, onClick: () => void): HTMLElement { return el("button", { class: "btn small", text: label, attrs: { type: "button" }, dataset: { testid }, on: { click: onClick } }); }
function deleteButton(label: string, testid: string, onClick: () => void): HTMLElement { return el("button", { class: "btn small danger", text: "삭제", attrs: { type: "button", "aria-label": label }, dataset: { testid }, on: { click: onClick } }); }
function namedOption(record: { readonly id: string; readonly name: string }): { value: string; label: string } { return { value: record.id, label: record.name }; }
function mapOptions(): Array<{ value: string; label: string }> { return Object.values(store.getCurrent().maps).map(namedOption); }
function orientationLabel(value: Dir): string { return ({ down: "아래", left: "왼쪽", right: "오른쪽", up: "위" } as const)[value]; }
function valueOf(event: Event): string { return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value.trim(); }
function clampInt(value: string, min: number, max: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : min; }
function cleanId(value: string): string { return value.trim().replace(/\s+/gu, "_"); }
function uniqueId(base: string, used: ReadonlySet<string>): string { let id = genId(base); while (used.has(id)) id = genId(base); return id; }
