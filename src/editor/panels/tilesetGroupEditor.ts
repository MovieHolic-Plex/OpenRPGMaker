import { field } from "@/editor/panels/databaseControls";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { TileGroupLayer, TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const GROUP_ROLES: readonly TileGroupRole[] = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"];
const GROUP_LAYERS: readonly TileGroupLayer[] = ["lower", "upper", "event", "mixed"];
const selectedGroupTiles = new Set<number>();

let selectionAnchor = 0;
let groupDraftName = "";
let groupDraftRole: TileGroupRole = "building";
let groupDraftLayer: TileGroupLayer = "mixed";
let groupDraftDescription = "";
let groupDraftRules = "";
let isDraggingGroupSelection = false;

export function renderTileGroupPanel(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return renderDbGroup(
    "AI 타일 세트",
    el("div", {
      class: "tileset-db-group-editor",
      children: [
        el("div", { class: "tileset-db-selected-row", text: `선택: ${selectedGroupTiles.size}개` }),
        textControl("세트 이름", groupDraftName, (value) => {
          groupDraftName = value;
        }),
        selectControl("역할", GROUP_ROLES, groupDraftRole, (value) => {
          groupDraftRole = value;
        }),
        selectControl("기본 레이어", GROUP_LAYERS, groupDraftLayer, (value) => {
          groupDraftLayer = value;
        }),
        textAreaControl("설명", groupDraftDescription, (value) => {
          groupDraftDescription = value;
        }),
        textAreaControl("배치 규칙", groupDraftRules, (value) => {
          groupDraftRules = value;
        }),
        el("button", {
          class: "tileset-db-small-button",
          text: "선택 타일을 세트로 저장",
          attrs: { type: "button" },
          dataset: { testid: "tileset-group-save" },
          on: { click: () => saveGroup(tileset.id, tileset.count, rerender) },
        }),
        el("button", {
          class: "tileset-db-small-button",
          text: "선택 비우기",
          attrs: { type: "button" },
          on: { click: () => clearGroupSelection(rerender) },
        }),
        renderGroupList(tileset.tileGroups ?? [], rerender),
      ],
    })
  );
}

export function groupCellClass(tile: number): string {
  return selectedGroupTiles.has(tile) ? " group-selected" : "";
}

export function groupCellText(tileset: TilesetDef, tile: number): string {
  return selectedGroupTiles.has(tile) ? "SET" : groupBadge(tileset, tile);
}

export function handleGroupTileClick(tile: number, event: Event, rerender: () => void): void {
  if (!(event instanceof MouseEvent)) return;
  applyGroupSelection(tile, event.ctrlKey || event.metaKey, event.shiftKey);
  rerender();
}

export function startGroupDrag(tile: number, event: Event): void {
  if (!(event instanceof PointerEvent)) return;
  event.preventDefault();
  isDraggingGroupSelection = true;
  applyGroupSelection(tile, event.ctrlKey || event.metaKey, event.shiftKey);
}

export function extendGroupDrag(tile: number, rerender: () => void): void {
  if (!isDraggingGroupSelection) return;
  selectedGroupTiles.add(tile);
  rerender();
}

export function stopGroupDrag(): void {
  isDraggingGroupSelection = false;
}

function applyGroupSelection(tile: number, additive: boolean, range: boolean): void {
  if (!additive && !range) selectedGroupTiles.clear();
  if (range) selectRange(selectionAnchor, tile);
  else if (additive && selectedGroupTiles.has(tile)) selectedGroupTiles.delete(tile);
  else selectedGroupTiles.add(tile);
  selectionAnchor = tile;
}

function selectRange(from: number, to: number): void {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  for (let tile = start; tile <= end; tile += 1) selectedGroupTiles.add(tile);
}

function saveGroup(tilesetId: string, count: number, rerender: () => void): void {
  if (selectedGroupTiles.size === 0) return;
  const tileIds = [...selectedGroupTiles].filter((tile) => tile >= 0 && tile < count).sort((a, b) => a - b);
  const group: TileGroupMetadata = {
    id: `tile_group_${Date.now()}`,
    name: groupDraftName.trim() || `타일 세트 ${tileIds[0]}`,
    role: groupDraftRole,
    defaultLayer: groupDraftLayer,
    tileIds,
    description: groupDraftDescription,
    placementRules: groupDraftRules,
  };
  recordProjectSnapshot();
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    target.tileGroups = [...(target.tileGroups ?? []), group];
  });
  selectedGroupTiles.clear();
  rerender();
}

function renderGroupList(groups: readonly TileGroupMetadata[], rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-db-group-list",
    children: groups.map((group) =>
      el("button", {
        class: "tileset-db-group-row",
        text: `${group.name} · ${group.tileIds.length}`,
        attrs: { type: "button", title: group.description || group.placementRules },
        on: { click: () => loadGroupDraft(group, rerender) },
      })
    ),
  });
}

function loadGroupDraft(group: TileGroupMetadata, rerender: () => void): void {
  selectedGroupTiles.clear();
  for (const tileId of group.tileIds) selectedGroupTiles.add(tileId);
  groupDraftName = group.name;
  groupDraftRole = group.role;
  groupDraftLayer = group.defaultLayer;
  groupDraftDescription = group.description;
  groupDraftRules = group.placementRules;
  rerender();
}

function clearGroupSelection(rerender: () => void): void {
  selectedGroupTiles.clear();
  rerender();
}

function renderDbGroup(title: string, child: HTMLElement): HTMLElement {
  return el("fieldset", { class: "tileset-db-group", children: [el("legend", { text: title }), child] });
}

function textControl(label: string, value: string, onInput: (value: string) => void): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value });
  input.addEventListener("input", () => onInput(input.value));
  return field(label, input);
}

function textAreaControl(label: string, value: string, onInput: (value: string) => void): HTMLElement {
  const input = el("textarea", { text: value });
  input.addEventListener("input", () => onInput(input.value));
  return field(label, input);
}

function selectControl<T extends string>(label: string, options: readonly T[], value: T, onInput: (value: T) => void): HTMLElement {
  const select = el("select", {
    children: options.map((option) => el("option", { text: option, attrs: option === value ? { value: option, selected: "true" } : { value: option } })),
  });
  select.addEventListener("change", () => {
    const selected = options.find((option) => option === select.value);
    if (selected !== undefined) onInput(selected);
  });
  return field(label, select);
}

function groupBadge(tileset: TilesetDef, tile: number): string {
  return tileset.tileGroups?.some((group) => group.tileIds.includes(tile)) ? "G" : "";
}
