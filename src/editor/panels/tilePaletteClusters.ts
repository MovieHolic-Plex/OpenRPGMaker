import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import type { Layer } from "@/editor/editorState";
import { tileAiLabelForIndex, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export type PaletteViewMode = "cluster" | "sheet";

type TilePatternKind = NonNullable<TileGroupMetadata["patternGrammar"]>["kind"];

export type ClusteredTileGroup = {
  readonly id: string;
  readonly name: string;
  readonly patternKind: TilePatternKind | undefined;
  readonly role: TileGroupMetadata["role"];
  readonly sourceRect: TileGroupMetadata["sourceRect"];
  readonly tileIds: readonly number[];
};

export type TileClusterSections = {
  readonly groups: readonly ClusteredTileGroup[];
  readonly labeledTileIds: readonly number[];
  readonly uncategorizedTileIds: readonly number[];
};

type RenderTilePaletteClustersArgs = {
  readonly layer: Exclude<Layer, "event">;
  readonly onSelectTile: (index: number) => void;
  readonly selectedTile: number;
  readonly tileset: TilesetDef;
};

const FLOW_COLUMNS = 8;
const CLUSTER_TILE_SIZE = "var(--cluster-tile-size)";

export const TILE_GROUP_ROLE_ORDER = [
  "terrain",
  "water",
  "wall",
  "building",
  "castle",
  "roof",
  "fence",
  "prop",
] as const satisfies readonly TileGroupMetadata["role"][];

const TILE_GROUP_ROLE_RANK: Record<TileGroupMetadata["role"], number> = {
  building: 3,
  castle: 4,
  fence: 6,
  prop: 7,
  roof: 5,
  terrain: 0,
  wall: 2,
  water: 1,
};

const TILE_PATTERN_KIND_LABELS: Record<TilePatternKind, string> = {
  animated_terrain: "애니",
  autotile_3x3: "3×3",
  event_required_object: "이벤트",
  horizontal_expandable: "가로 확장",
  nine_slice_expandable: "9분할",
  overlay_detail: "장식",
  single: "단일",
  source_rect: "영역",
  vertical_expandable: "세로 확장",
};

export function createTileClusterSections(tileset: TilesetDef): TileClusterSections {
  const assignedTileIds = new Set<number>();
  const groups = sortedTileGroups(tileset).flatMap((group) => {
    const tileIds = uniqueValidTileIds(group.tileIds, tileset.count, assignedTileIds);
    if (tileIds.length === 0) return [];
    for (const tileId of tileIds) assignedTileIds.add(tileId);
    return [{
      id: group.id,
      name: group.name,
      patternKind: group.patternGrammar?.kind,
      role: group.role,
      sourceRect: group.sourceRect,
      tileIds,
    }];
  });

  const labeledTileIds: number[] = [];
  for (let index = 0; index < tileset.count; index += 1) {
    if (assignedTileIds.has(index)) continue;
    if (!cleanTileText(tileset.tileMeta?.[index]?.label)) continue;
    assignedTileIds.add(index);
    labeledTileIds.push(index);
  }

  const uncategorizedTileIds: number[] = [];
  for (let index = 0; index < tileset.count; index += 1) {
    if (!assignedTileIds.has(index)) uncategorizedTileIds.push(index);
  }

  return { groups, labeledTileIds, uncategorizedTileIds };
}

export function tilePatternKindLabel(kind: TilePatternKind | undefined): string {
  if (kind === undefined) return TILE_PATTERN_KIND_LABELS.single;
  return TILE_PATTERN_KIND_LABELS[kind];
}

export function tileGroupGridColumns(group: {
  readonly sourceRect?: TileGroupMetadata["sourceRect"];
  readonly tileIds: readonly number[];
}): number {
  const rect = group.sourceRect;
  if (rect && rect.width > 0 && rect.height > 0 && rect.width * rect.height === group.tileIds.length) return rect.width;
  return FLOW_COLUMNS;
}

export function renderTilePaletteClusters(args: RenderTilePaletteClustersArgs): HTMLElement {
  const sections = createTileClusterSections(args.tileset);
  const root = el("div", { class: "tile-palette-clusters", dataset: { testid: "tile-palette-clusters" } });
  const hasMetadata = sections.groups.length > 0 || sections.labeledTileIds.length > 0;

  if (!hasMetadata) {
    root.append(el("div", {
      class: "tile-cluster-hint",
      text: "타일 메타데이터가 아직 없습니다 — AI 맵 인터뷰나 타일셋 메타데이터 에디터에서 채우면 여기 묶여 보입니다.",
    }));
  }
  if (sections.groups.length > 0) root.append(renderGroupSection(args, sections.groups));
  if (sections.labeledTileIds.length > 0) root.append(renderLabeledSection(args, sections.labeledTileIds));
  root.append(renderUncategorizedSection(args, sections.uncategorizedTileIds));
  return root;
}

function sortedTileGroups(tileset: TilesetDef): readonly TileGroupMetadata[] {
  return [...(tileset.tileGroups ?? [])].sort((left, right) => {
    const roleDelta = TILE_GROUP_ROLE_RANK[left.role] - TILE_GROUP_ROLE_RANK[right.role];
    if (roleDelta !== 0) return roleDelta;
    return left.name.localeCompare(right.name, "ko");
  });
}

function uniqueValidTileIds(tileIds: readonly number[], count: number, assignedTileIds: ReadonlySet<number>): number[] {
  const local = new Set<number>();
  const result: number[] = [];
  for (const tileId of tileIds) {
    if (!Number.isInteger(tileId) || tileId < 0 || tileId >= count) continue;
    if (assignedTileIds.has(tileId) || local.has(tileId)) continue;
    local.add(tileId);
    result.push(tileId);
  }
  return result;
}

function renderGroupSection(args: RenderTilePaletteClustersArgs, groups: readonly ClusteredTileGroup[]): HTMLElement {
  const section = renderSectionShell("타일 묶음");
  const list = el("div", { class: "tile-cluster-group-list" });
  for (const group of groups) {
    list.append(renderGroupCard(args, group));
  }
  section.append(list);
  return section;
}

function renderGroupCard(args: RenderTilePaletteClustersArgs, group: ClusteredTileGroup): HTMLElement {
  const card = el("article", { class: "tile-cluster-card" });
  card.append(
    el("div", {
      class: "tile-cluster-card-header",
      children: [
        el("span", { class: "tile-cluster-card-name", text: group.name }),
        el("span", {
          class: "tile-cluster-card-actions",
          children: [
            el("span", { class: "tile-cluster-kind-badge", text: tilePatternKindLabel(group.patternKind) }),
            renderClusterAiButton(args.tileset.id, group.id),
          ],
        }),
      ],
    })
  );
  card.append(renderTileGrid(args, group.tileIds, tileGroupGridColumns(group), group.name));
  return card;
}

function renderLabeledSection(args: RenderTilePaletteClustersArgs, tileIds: readonly number[]): HTMLElement {
  const section = renderSectionShell("설명된 타일");
  section.append(renderTileGrid(args, tileIds, FLOW_COLUMNS));
  return section;
}

function renderUncategorizedSection(args: RenderTilePaletteClustersArgs, tileIds: readonly number[]): HTMLElement {
  const details = el("details", { class: "tile-cluster-section tile-cluster-uncategorized" });
  details.append(el("summary", {
    children: [
      el("span", { text: `미분류 ${tileIds.length}` }),
      tileIds.length > 0
        ? renderUncategorizedAiButton(args.tileset.id, tileIds)
        : el("span", { class: "tile-cluster-complete-badge", text: "✓ 모두 분류됨" }),
    ],
  }));
  details.append(renderTileGrid(args, tileIds, FLOW_COLUMNS));
  return details;
}

function renderClusterAiButton(tilesetId: string, groupId: string): HTMLButtonElement {
  return el("button", {
    class: "tile-cluster-ai-button",
    text: "🤖",
    attrs: { "aria-label": "AI로 이 묶음 수정", title: "AI로 이 묶음 수정", type: "button" },
    dataset: { testid: `cluster-ai-edit-${groupId}` },
    on: {
      click: (event) => {
        event.preventDefault();
        event.stopPropagation();
        openClusterAiModal({ kind: "cluster-edit", groupId, tilesetId });
      },
    },
  });
}

function renderUncategorizedAiButton(tilesetId: string, tileIds: readonly number[]): HTMLButtonElement {
  return el("button", {
    class: "tile-cluster-ai-analyze",
    text: "🤖 분석",
    attrs: { title: "AI로 미분류 타일 분석", type: "button" },
    dataset: { testid: "cluster-ai-analyze" },
    on: {
      click: (event) => {
        event.preventDefault();
        event.stopPropagation();
        openClusterAiModal({
          kind: "unclassified-analysis",
          sampleTiles: tileIds.slice(0, 24),
          tilesetId,
          total: tileIds.length,
        });
      },
    },
  });
}

function renderSectionShell(title: string): HTMLElement {
  return el("section", {
    class: "tile-cluster-section",
    children: [el("h4", { class: "tile-cluster-section-title", text: title })],
  });
}

function renderTileGrid(
  args: RenderTilePaletteClustersArgs,
  tileIds: readonly number[],
  columns: number,
  fallbackLabel?: string
): HTMLElement {
  const grid = el("div", {
    class: "tile-cluster-grid",
    attrs: { style: `--cluster-cols:${columns}` },
  });
  for (const tileId of tileIds) {
    grid.append(renderClusterTile(args, tileId, fallbackLabel));
  }
  return grid;
}

function renderClusterTile(args: RenderTilePaletteClustersArgs, tileId: number, fallbackLabel?: string): HTMLButtonElement {
  const active = args.selectedTile === tileId;
  const currentLayer = tileVisibleOnLayer(args.tileset, tileId, args.layer);
  const title = tileTitle(args.tileset, tileId, fallbackLabel);
  return el("button", {
    class: "quick-tile-cell tile-cluster-cell" + (active ? " active" : "") + (currentLayer ? "" : " muted"),
    attrs: {
      "aria-label": title,
      style: tilesetTileBackgroundStyle(args.tileset, tileId, CLUSTER_TILE_SIZE),
      title,
    },
    children: [el("span", { class: "quick-tile-index", text: String(tileId) })],
    dataset: { testid: `cluster-tile-${tileId}` },
    on: {
      click: (event) => {
        event.preventDefault();
        args.onSelectTile(tileId);
      },
      pointerdown: (event) => event.preventDefault(),
    },
  });
}

function tileTitle(tileset: TilesetDef, tileId: number, fallbackLabel?: string): string {
  const label = cleanTileText(tileset.tileMeta?.[tileId]?.label) || fallbackLabel || tileDisplayLabelForIndex(tileId);
  const description = cleanTileText(tileset.tileMeta?.[tileId]?.description) || tileAiLabelForIndex(tileId);
  return `${tileId} ${label} / AI: ${description}`;
}

function cleanTileText(value: string | undefined): string {
  return value?.trim() ?? "";
}
