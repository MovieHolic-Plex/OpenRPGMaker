import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  beginGridSelectionDrag,
  cancelGridSelectionDrag,
  commitGridSelectionDrag,
  createGridSelectionState,
  gridSelectionGeometry,
  selectGridTile,
  updateGridSelectionDrag,
  type GridSelectionState,
} from "@/editor/panels/tilesetGridSelection";
import { persistTilesetKnowledge } from "@/editor/panels/tilesetKnowledgePersistence";
import { store } from "@/project/store";
import { compileTilesetKnowledge, type TilesetKnowledgeTemplate } from "@/project/tilesetKnowledge";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import type { PassFlag, TileGroupMetadata, TilesetDef } from "@/project/types";

export type KnowledgeDraft = {
  readonly activeGroupId: string | null;
  readonly cellLayers: readonly ("lower" | "upper")[] | null;
  readonly description: string;
  readonly name: string;
  readonly passage: PassFlag;
  readonly placementRules: string;
  readonly template: TilesetKnowledgeTemplate;
};

let tilesetId: string | null = null;
let selection: GridSelectionState = createGridSelectionState();
let draft: KnowledgeDraft = defaultDraft();

export function activateKnowledgeWorkspace(tileset: TilesetDef): void {
  if (tilesetId === tileset.id) return;
  tilesetId = tileset.id;
  selection = createGridSelectionState();
  draft = defaultDraft();
}

export function knowledgeSelection(): GridSelectionState {
  return selection;
}

export function knowledgeDraft(): KnowledgeDraft {
  return draft;
}

export function updateKnowledgeDraft(patch: Partial<KnowledgeDraft>): void {
  draft = { ...draft, ...patch };
}

export function chooseKnowledgeTemplate(template: TilesetKnowledgeTemplate): void {
  const passage = template === "one-way-path" ? passableFlag() : blockedFlag();
  draft = { ...draft, cellLayers: null, passage, template };
}

export function selectKnowledgeTile(tileset: TilesetDef, tile: number, event: MouseEvent): void {
  const previousSelected = selection.selected;
  selection = selectGridTile(selection, {
    modifiers: { additive: event.ctrlKey || event.metaKey, range: event.shiftKey },
    spec: selectionSpec(tileset),
    tile,
  });
  normalizeDraftLayers(previousSelected);
}

export function beginKnowledgeDrag(tileset: TilesetDef, tile: number, event: PointerEvent): void {
  const previousSelected = selection.selected;
  selection = beginGridSelectionDrag(selection, tile, {
    additive: event.ctrlKey || event.metaKey,
    range: event.shiftKey,
  });
  selection = updateGridSelectionDrag(selection, { spec: selectionSpec(tileset), tile });
  normalizeDraftLayers(previousSelected);
}

export function extendKnowledgeDrag(tileset: TilesetDef, tile: number): boolean {
  if (!selection.drag) return false;
  const before = selection.selected;
  selection = updateGridSelectionDrag(selection, { spec: selectionSpec(tileset), tile });
  normalizeDraftLayers(before);
  return before.length !== selection.selected.length || before.some((value, index) => value !== selection.selected[index]);
}

export function finishKnowledgeDrag(): void {
  selection = commitGridSelectionDrag(selection);
}

export function cancelKnowledgeDrag(): void {
  const previousSelected = selection.selected;
  selection = cancelGridSelectionDrag(selection);
  normalizeDraftLayers(previousSelected);
}

export function clearKnowledgeSelection(): void {
  selection = createGridSelectionState();
  draft = { ...draft, activeGroupId: null, cellLayers: null };
}

export function toggleKnowledgeCellLayer(tile: number): void {
  const index = selection.selected.indexOf(tile);
  if (index < 0) return;
  const layers = effectiveLayers();
  layers[index] = layers[index] === "upper" ? "lower" : "upper";
  draft = { ...draft, cellLayers: layers };
}

export function loadKnowledgeGroup(group: TileGroupMetadata, tileset: TilesetDef): void {
  const ordered = orderTilesAndLayers(group.tileIds, group.cellLayers ?? null);
  selection = {
    anchorTile: ordered.tileIds[0] ?? null,
    drag: null,
    selected: ordered.tileIds,
  };
  draft = {
    activeGroupId: group.id,
    cellLayers: ordered.cellLayers,
    description: group.description,
    name: group.name,
    passage: { ...(tileset.passability[group.tileIds[0] ?? -1] ?? passableFlag()) },
    placementRules: group.placementRules,
    template: templateForGroup(group),
  };
}

export function loadKnowledgeProposal(input: {
  readonly cellLayers: readonly ("lower" | "upper")[] | null;
  readonly description: string;
  readonly name: string;
  readonly passage: PassFlag;
  readonly placementRules: string;
  readonly template: TilesetKnowledgeTemplate;
  readonly tileIds: readonly number[];
}): void {
  const ordered = orderTilesAndLayers(input.tileIds, input.cellLayers);
  selection = {
    anchorTile: ordered.tileIds[0] ?? null,
    drag: null,
    selected: ordered.tileIds,
  };
  draft = {
    activeGroupId: null,
    cellLayers: ordered.cellLayers,
    description: input.description,
    name: input.name,
    passage: { ...input.passage },
    placementRules: input.placementRules,
    template: input.template,
  };
}

export function compileKnowledgeDraft(tileset: TilesetDef) {
  const groupId = draft.activeGroupId ?? nextGroupId(tileset.tileGroups ?? []);
  return compileTilesetKnowledge({
    cellLayers: draft.cellLayers ?? undefined,
    groupId,
    name: draft.name.trim() || `AI 세그먼트 ${selection.selected[0] ?? 0}`,
    passage: draft.passage,
    template: draft.template,
    tileCount: tileset.count,
    tileIds: selection.selected,
    tilesPerRow: tileset.tilesPerRow,
  });
}

export function saveKnowledgeDraft(tileset: TilesetDef): boolean {
  const compiled = compileKnowledgeDraft(tileset);
  if (compiled.kind === "invalid") return false;
  const group = {
    ...compiled.value.group,
    description: draft.description,
    placementRules: draft.placementRules,
  };
  recordProjectSnapshot("타일셋 지식 저장");
  store.update((project) => {
    const target = project.tilesets[tileset.id];
    if (!target) return;
    persistTilesetKnowledge(target, {
      compiled: { group, rules: compiled.value.rules },
      description: draft.description,
      placementRules: draft.placementRules,
      template: draft.template,
    });
  });
  draft = { ...draft, activeGroupId: group.id, name: group.name };
  return true;
}

export function knowledgeGeometry(tileset: TilesetDef) {
  return gridSelectionGeometry(selection.selected, selectionSpec(tileset));
}

function selectionSpec(tileset: TilesetDef) {
  return { tileCount: tileset.count, tilesPerRow: tileset.tilesPerRow };
}

function effectiveLayers(): ("lower" | "upper")[] {
  if (draft.cellLayers?.length === selection.selected.length) return [...draft.cellLayers];
  return selection.selected.map(() => draft.template === "desk" ? "upper" : "lower");
}

function normalizeDraftLayers(previousSelected: readonly number[]): void {
  if (!draft.cellLayers) return;
  const sameSelection = previousSelected.length === selection.selected.length
    && previousSelected.every((tile, index) => tile === selection.selected[index]);
  if (!sameSelection) draft = { ...draft, cellLayers: null };
}

function orderTilesAndLayers(
  tileIds: readonly number[],
  cellLayers: readonly ("lower" | "upper")[] | null,
): { readonly cellLayers: readonly ("lower" | "upper")[] | null; readonly tileIds: readonly number[] } {
  const ordered = tileIds
    .map((tile, index) => ({ layer: cellLayers?.[index], tile }))
    .sort((left, right) => left.tile - right.tile);
  return {
    cellLayers: cellLayers?.length === tileIds.length
      ? ordered.map(({ layer }) => layer ?? "lower")
      : null,
    tileIds: ordered.map(({ tile }) => tile),
  };
}

function nextGroupId(groups: readonly TileGroupMetadata[]): string {
  let suffix = 1;
  while (groups.some((group) => group.id === `tile_group_${suffix}`)) suffix += 1;
  return `tile_group_${suffix}`;
}

function templateForGroup(group: TileGroupMetadata): TilesetKnowledgeTemplate {
  if (group.sourceBlocks?.length === 9) return "water-atlas-9x9";
  if (group.patternGrammar?.kind === "repeatable_block") return "repeatable-cliff-2x3";
  if (group.patternGrammar?.kind === "autotile_3x3") return group.role === "water" ? "water-autotile-3x3" : "one-way-path";
  if (group.role === "prop" && (group.layerHome === "perCell" || group.defaultLayer === "mixed")) return "tree";
  return "desk";
}

function defaultDraft(): KnowledgeDraft {
  return {
    activeGroupId: null,
    cellLayers: null,
    description: "",
    name: "",
    passage: blockedFlag(),
    placementRules: "",
    template: "desk",
  };
}
