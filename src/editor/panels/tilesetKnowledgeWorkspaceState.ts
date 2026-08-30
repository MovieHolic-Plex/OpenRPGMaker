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
import { asPlacementFacing, asPlacementZone } from "@/project/placementSurface";
import type {
  ClusterRule,
  ClusterRuleStrength,
  PlacementFacing,
  PlacementZone,
  TileGroupMetadata,
  PassFlag,
  TilesetDef,
} from "@/project/types";

export type KnowledgeDraft = {
  readonly activeGroupId: string | null;
  readonly cellLayers: readonly ("lower" | "upper")[] | null;
  readonly description: string;
  readonly name: string;
  readonly passage: PassFlag;
  readonly placementRules: string;
  /**
   * 배치 면(2026-08-30). "none" = 조건 없음(예전과 같은 동작).
   * placementRules 는 사람이 읽는 문장이고 이쪽은 **집행되는 조건**이다 —
   * projectLint 가 맵을 훑어 위반을 규칙 감사 패널에 올린다.
   */
  readonly surfaceZone: PlacementZone | "none";
  readonly surfaceFacing: PlacementFacing;
  readonly surfaceStrength: ClusterRuleStrength;
  readonly template: TilesetKnowledgeTemplate;
};

/** 그룹의 배치 면 규칙 id — 그룹당 하나만 둔다(있으면 갱신, 없으면 추가). */
export function surfaceRuleId(groupId: string): string {
  return `r_surface_${groupId}`;
}

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
    ...surfaceDraftFromGroup(group),
    template: templateForGroup(group),
  };
}

/** 그룹에 이미 걸려 있는 배치 면 규칙 → 초안 필드. 없으면 "none". */
function surfaceDraftFromGroup(group: TileGroupMetadata): {
  readonly surfaceFacing: PlacementFacing;
  readonly surfaceStrength: ClusterRuleStrength;
  readonly surfaceZone: PlacementZone | "none";
} {
  const rule = (group.rules ?? []).find((entry) => entry.kind === "surface");
  const zone = rule ? asPlacementZone(rule.params.zone) : undefined;
  if (!rule || !zone) return { surfaceFacing: "any", surfaceStrength: "hard", surfaceZone: "none" };
  return {
    surfaceFacing: asPlacementFacing(rule.params.facing) ?? "any",
    surfaceStrength: rule.strength,
    surfaceZone: zone,
  };
}

/**
 * 초안의 배치 면 → 그룹 규칙 목록.
 * 다른 규칙(인접·간격·개수)은 **보존한다** — 예전에는 저장이 compiled.group 으로 통째 교체해서
 * 손으로 만든 hard 인접 규칙이 조용히 사라졌다.
 */
export function mergeSurfaceRule(
  existing: readonly ClusterRule[] | undefined,
  groupId: string,
  draftValue: Pick<KnowledgeDraft, "surfaceFacing" | "surfaceStrength" | "surfaceZone">,
): ClusterRule[] {
  const others = (existing ?? []).filter((rule) => rule.kind !== "surface");
  if (draftValue.surfaceZone === "none") return others;
  const params: Record<string, unknown> = { zone: draftValue.surfaceZone };
  // 방향은 `againstWall` 에서만 뜻이 있다 — 다른 면에 붙이면 읽는 쪽이 헷갈린다.
  if (draftValue.surfaceZone === "againstWall" && draftValue.surfaceFacing !== "any") {
    params.facing = draftValue.surfaceFacing;
  }
  return [
    ...others,
    { id: surfaceRuleId(groupId), kind: "surface", params, strength: draftValue.surfaceStrength },
  ];
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
    surfaceFacing: "any",
    surfaceStrength: "hard",
    surfaceZone: "none",
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
  const previous = (tileset.tileGroups ?? []).find((entry) => entry.id === compiled.value.group.id);
  const group = {
    ...compiled.value.group,
    description: draft.description,
    placementRules: draft.placementRules,
    rules: mergeSurfaceRule(previous?.rules, compiled.value.group.id, draft),
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
    surfaceFacing: "any",
    surfaceStrength: "hard",
    surfaceZone: "none",
    template: "desk",
  };
}
