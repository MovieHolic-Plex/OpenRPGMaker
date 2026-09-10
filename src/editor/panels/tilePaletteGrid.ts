import type { Layer } from "@/editor/editorState";
import { isDefaultTilesetTexture, tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { CHIPSET_TILE_GROUPS, tileAiLabelForIndex, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import type { AutotileGroup, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import {
  displayOrderStampFactory,
  installPaletteStampGesture,
  sourceCoordinateStampFactory,
} from "@/editor/panels/tilePaletteCustomGesture";

// RM2003식 단일 타일 팔레트 — 그룹/시트 보기 분리 없이 가로 6칸 고정 리플로우.
// 오토타일 그룹(autotileGroupsForTileset)은 그룹당 대표 1칸(외딴/anchor 타일)으로
// 맨 앞에 축약 노출하고, variantMap 출력 전용 변형 타일은 일반 나열에서 숨긴다.
// 물(호수/폭포)은 오토타일 그룹이 아니라 별도 애니메이션 프레임 체계지만,
// RM2003과 동일하게 대표 1칸(물=0, 폭포=93)으로 축약한다.

export const GRID_PALETTE_COLUMNS = 6;
export const CUSTOM_PALETTE_MIN_CELL_SIZE = 16;


export type GridAutotileEntry = {
  readonly id: string;
  readonly name: string;
  /** 대표 칸 = 클릭 시 선택되는 타일. 오토타일 그룹은 mask 0(외딴/anchor) 변형. */
  readonly representativeTile: number;
};

export type GridPaletteModel = {
  /** 팔레트 상단에 1칸씩 노출되는 오토타일(+물) 대표 목록. */
  readonly autotiles: readonly GridAutotileEntry[];
  /** 대표/변형 축약 이후 일반 나열되는 타일 인덱스(오름차순). */
  readonly tileIds: readonly number[];
};

type MakeGridPaletteArgs = {
  readonly layer: Exclude<Layer, "event">;
  readonly onSelectTile: (index: number) => void;
  readonly selectedTile: number;
  readonly tileset: TilesetDef;
  /**
   * 검색·카테고리 필터 결과. `null`(기본)이면 필터 없음 — 전량 노출.
   *
   * 2026-08-21 좌패널 1면 통합: 예전에는 「찾기」 탭이 별개 그리드(`quick-tile-cell`)로
   * 타일셋을 두 번째로 그렸다. 같은 타일 그림판이 탭에 따라 다르게 보이고(오토타일 대표 1칸
   * 규칙을 안 따랐다), 96개 상한이 있었고, 고른 타일을 그 자리에서 칠할 수도 없었다.
   * 이제 필터는 **이 팔레트 하나**에 적용된다.
   */
  readonly visibleTiles?: ReadonlySet<number> | null;
};

type MakeCustomPaletteArgs = MakeGridPaletteArgs & {
  readonly onCreatePaletteStamp?: (stamp: PaletteStamp) => void;
};

type MakeGridPaletteWithStampArgs = MakeGridPaletteArgs & {
  /**
   * 있으면 기본 팔레트에서도 사각 드래그 = Combo Brush 가 된다 (OPRN-OUT-022).
   * 없으면 예전처럼 단일 선택만 — 구조물 편집기처럼 조합 선택이 뜻을 갖지 않는 호출부용.
   */
  readonly onCreatePaletteStamp?: (stamp: PaletteStamp) => void;
};

/** 선택 타일은 필터에 안 걸려도 항상 보여야 한다 — 안 그러면 "선택 중"인 칸이 사라진다. */
function passesFilter(args: MakeGridPaletteArgs, tileId: number): boolean {
  if (!args.visibleTiles) return true;
  return args.visibleTiles.has(tileId) || args.selectedTile === tileId;
}


/** 그룹의 대표(anchor) 타일 — 이웃이 전혀 없는 mask 0 변형(외딴 점). 없으면 첫 멤버. */
export function autotileRepresentativeTile(group: AutotileGroup): number {
  const isolated = group.variantMap["0"];
  if (typeof isolated === "number") return isolated;
  return group.memberTileIds[0] ?? -1;
}

function variantOutputTiles(group: AutotileGroup): readonly number[] {
  return Object.values(group.variantMap).filter((value): value is number => typeof value === "number");
}

type CollapsedEntrySource = {
  readonly id: string;
  readonly name: string;
  readonly representativeTile: number;
  /** 일반 나열에서 숨길 변형/프레임 타일들(대표 포함). */
  readonly collapsedTiles: readonly number[];
};

function collapsedEntrySources(tileset: TilesetDef): readonly CollapsedEntrySource[] {
  const sources: CollapsedEntrySource[] = [];
  if (isDefaultTilesetTexture(tileset)) {
    // 물(호수 몸통+물가) — 0~2열 애니 프레임 블록 전체를 대표 1칸으로.
    sources.push({
      id: "chipset_lake_water",
      name: "물",
      representativeTile: 0,
      collapsedTiles: [
        ...CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames,
        ...CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames,
      ],
    });
    // 폭포 — 3~5열 애니 프레임 블록.
    sources.push({
      id: "chipset_waterfall",
      name: "폭포",
      representativeTile: 93,
      collapsedTiles: [93, 94, ...CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames],
    });
  }
  for (const group of autotileGroupsForTileset(tileset)) {
    sources.push({
      id: group.id,
      name: group.name,
      representativeTile: autotileRepresentativeTile(group),
      collapsedTiles: variantOutputTiles(group),
    });
  }
  return sources;
}

export function buildCustomPaletteModel(tileset: TilesetDef): readonly number[] {
  // Custom sheets are visual source material, not a semantic tile list. Keep every
  // source cell in its original row/column position; layer routing happens on select.
  return Array.from({ length: tileset.count }, (_, tileId) => tileId);
}

export function buildGridPaletteModel(tileset: TilesetDef, layer: Exclude<Layer, "event">): GridPaletteModel {
  const hidden = new Set<number>();
  const usedRepresentatives = new Set<number>();
  const autotiles: GridAutotileEntry[] = [];
  for (const source of collapsedEntrySources(tileset)) {
    for (const tile of source.collapsedTiles) {
      if (tile >= 0 && tile < tileset.count) hidden.add(tile);
    }
    const representative = source.representativeTile;
    if (representative < 0 || representative >= tileset.count) continue;
    hidden.add(representative);
    if (usedRepresentatives.has(representative)) continue;
    if (!tileVisibleOnLayer(tileset, representative, layer)) continue;
    usedRepresentatives.add(representative);
    autotiles.push({ id: source.id, name: source.name, representativeTile: representative });
  }
  const tileIds: number[] = [];
  for (let index = 0; index < tileset.count; index += 1) {
    if (hidden.has(index)) continue;
    if (!tileVisibleOnLayer(tileset, index, layer)) continue;
    tileIds.push(index);
  }
  return { autotiles, tileIds };
}

/**
 * 팔레트에 실제로 노출되는 칸으로 매핑 — 숨겨진 변형/프레임 타일은 대표 칸으로.
 * (맵 스포이트 → 팔레트 스크롤 하이라이트에서 사용)
 */
export function gridPaletteDisplayTile(tileset: TilesetDef, tile: number): number {
  for (const source of collapsedEntrySources(tileset)) {
    const representative = source.representativeTile;
    if (representative < 0 || representative >= tileset.count) continue;
    if (tile === representative) return representative;
    if (source.collapsedTiles.includes(tile)) return representative;
  }
  return tile;
}

/**
 * 화면에 실제로 깔리는 순서 — 오토타일 대표 칸이 앞, 이어서 일반 나열.
 * 드래그 스탬프는 이 순서를 격자로 읽는다(리플로우 팔레트에는 원본 좌표가 없다).
 */
export function gridPaletteDisplayOrder(input: MakeGridPaletteArgs): readonly number[] {
  const args = { ...input, selectedTile: gridPaletteDisplayTile(input.tileset, input.selectedTile) };
  const model = buildGridPaletteModel(args.tileset, args.layer);
  const order: number[] = [];
  for (const entry of model.autotiles) {
    if (passesFilter(args, entry.representativeTile)) order.push(entry.representativeTile);
  }
  for (const tileId of model.tileIds) {
    if (passesFilter(args, tileId)) order.push(tileId);
  }
  return order;
}

export function makeGridPalette(input: MakeGridPaletteWithStampArgs): HTMLElement {
  // Selection is a display projection only; do not replace the selected paint variant.
  const args = { ...input, selectedTile: gridPaletteDisplayTile(input.tileset, input.selectedTile) };
  const model = buildGridPaletteModel(args.tileset, args.layer);
  const sheet = el("div", {
    class: "chipset-sheet tile-palette oprn-palette",
    dataset: { testid: "tile-palette" },
    attrs: {
      // 칸 크기는 CSS가 패널 폭에 맞춰 계산. 열 수는 항상 6.
      style: `--oprn-cols:${GRID_PALETTE_COLUMNS}`,
    },
  });
  const grid = el("div", {
    class: "chipset-grid oprn-palette-grid",
    dataset: { testid: "oprn-palette-grid" },
    attrs: {
      // 6열 고정 — 칸 크기는 CSS --chipset-cell(cqi) 이 담당.
      style: `grid-template-columns:repeat(${GRID_PALETTE_COLUMNS}, var(--chipset-cell))`,
    },
  });
  // 6열 리플로우 팔레트라 필터는 **숨김**이 맞다 — 위치가 정보가 아니고, 결과가
  // 위로 몰려 스크롤 없이 보인다. (커스텀 아틀라스는 반대 — makeCustomPalette 주석 참고)
  let shown = 0;
  for (const entry of model.autotiles) {
    if (!passesFilter(args, entry.representativeTile)) continue;
    grid.append(makeGridCell(args, entry.representativeTile, entry.name));
    shown += 1;
  }
  for (const tileId of model.tileIds) {
    if (!passesFilter(args, tileId)) continue;
    grid.append(makeGridCell(args, tileId));
    shown += 1;
  }
  installGridRoving(grid, GRID_PALETTE_COLUMNS);
  if (input.onCreatePaletteStamp) {
    installPaletteStampGesture(
      sheet,
      grid,
      displayOrderStampFactory({
        displayTiles: gridPaletteDisplayOrder(input),
        displayTilesPerRow: GRID_PALETTE_COLUMNS,
        tileset: args.tileset,
      }),
      args.onSelectTile,
      input.onCreatePaletteStamp,
    );
  }
  sheet.append(grid);
  if (shown === 0) {
    sheet.append(el("div", { class: "empty-hint palette-filter-empty", text: "조건에 맞는 타일이 없습니다.", dataset: { testid: "palette-filter-empty" } }));
  }
  return sheet;
}

export function makeCustomPalette(args: MakeCustomPaletteArgs): HTMLElement {
  const columns = Math.max(1, args.tileset.tilesPerRow);
  const rows = Math.max(1, Math.ceil(args.tileset.count / columns));
  const sheet = el("div", {
    class: "chipset-sheet tile-palette custom-palette",
    dataset: {
      testid: "tile-palette",
      paletteKind: "custom",
      sourceColumns: String(columns),
      sourceRows: String(rows),
    },
    attrs: { style: `--custom-cols:${columns};--custom-rows:${rows};--custom-min-cell:${CUSTOM_PALETTE_MIN_CELL_SIZE}px` },
  });
  const grid = el("div", {
    class: "chipset-grid custom-palette-grid",
    dataset: { testid: "custom-palette-grid" },
    attrs: { style: `grid-template-columns:repeat(${columns}, var(--chipset-cell))` },
  });
  // 커스텀 아틀라스는 **칸의 위치가 정보**다(원본 시트의 행·열을 그대로 유지).
  // 숨기면 아틀라스 모양이 깨져 감독이 "어디쯤 타일"인지 못 찾으므로 흐리게만 한다.
  for (const tileId of buildCustomPaletteModel(args.tileset)) {
    const cell = makePaletteCell(args, tileId);
    if (!passesFilter(args, tileId)) cell.classList.add("is-filtered-out");
    grid.append(cell);
  }
  installGridRoving(grid, columns);
  if (args.onCreatePaletteStamp) {
    installPaletteStampGesture(
      sheet,
      grid,
      sourceCoordinateStampFactory(args.tileset),
      args.onSelectTile,
      args.onCreatePaletteStamp,
    );
  }
  sheet.append(grid);
  return sheet;
}

/**
 * 2차원 roving tabindex — 그리드는 탭 스톱 1개, 화살표로 칸 이동.
 *
 * sidebarFocus.applyRovingTabindex 를 재사용하지 않는 이유: 그 헬퍼는 도구막대를
 * **선형** 목록으로 걸어 ArrowDown 을 "다음 버튼" 으로 취급한다. 타일 그림판은 행·열이
 * 있는 판이라 ArrowDown 은 한 **행**(= columns 칸) 아래여야 한다. 행 보폭은 호출부가
 * 실제 열 수를 넘겨준다 — RM 팔레트는 6열 고정이지만 커스텀 아틀라스는 저작된
 * tilesPerRow 를 그대로 유지한다.
 */
export function installGridRoving(grid: HTMLElement, columns: number): void {
  const cells = (): HTMLButtonElement[] =>
    Array.from(grid.querySelectorAll<HTMLButtonElement>("button"))
      .filter((cell) => !cell.disabled && !cell.hidden && cell.classList.contains("chipset-tile"));

  const focusCellAt = (list: readonly HTMLButtonElement[], index: number): void => {
    const target = list[index];
    if (!target) return;
    for (const [i, cell] of list.entries()) cell.setAttribute("tabindex", i === index ? "0" : "-1");
    target.focus();
  };

  const initial = cells();
  if (initial.length === 0) return;
  const activeIndex = Math.max(0, initial.findIndex((cell) => cell.classList.contains("active")));
  for (const [i, cell] of initial.entries()) cell.setAttribute("tabindex", i === activeIndex ? "0" : "-1");

  grid.addEventListener("keydown", (event: KeyboardEvent) => {
    const list = cells();
    const current = list.findIndex((cell) => cell === document.activeElement);
    if (current < 0) return;
    const stride = Math.max(1, columns);
    let next = current;
    switch (event.key) {
      case "ArrowRight":
        next = current + 1;
        break;
      case "ArrowLeft":
        next = current - 1;
        break;
      case "ArrowDown":
        next = current + stride;
        break;
      case "ArrowUp":
        next = current - stride;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = list.length - 1;
        break;
      default:
        return;
    }
    // 화살표는 맵 스크롤을 부르므로 판 안에서는 항상 삼킨다. 경계를 넘어가는 이동만
    // 좌표를 그대로 둔다(줄바꿈 없이 멈춤 — 판의 모양이 정보인 커스텀 아틀라스에서
    // 줄바꿈은 "한 칸 옆" 이라는 약속을 깬다).
    event.preventDefault();
    event.stopPropagation();
    if (next < 0 || next >= list.length) return;
    focusCellAt(list, next);
  });

  grid.addEventListener("focusin", (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const list = cells();
    const index = list.findIndex((cell) => cell === target);
    if (index < 0) return;
    for (const [i, cell] of list.entries()) cell.setAttribute("tabindex", i === index ? "0" : "-1");
  });
}

function makeGridCell(args: MakeGridPaletteArgs, tileId: number, autotileName?: string): HTMLButtonElement {
  const bannedReason = bannedTileReason(tileId);
  const waterKind = waterTileKind(tileId);
  const titleBase = autotileName !== undefined
    ? `${tileId} ${autotileName} (오토타일 — 이웃에 맞춰 자동 성형)`
    : gridTileTitle(args.tileset, tileId);
  const title = bannedReason ? `${titleBase} [사용 금지: ${bannedReason}]` : waterKind ? `${titleBase} [${waterKind}]` : titleBase;
  return makePaletteCell(args, tileId, title, {
    className: (autotileName !== undefined ? " oprn-autotile" : "") + (bannedReason ? " banned" : ""),
    badge: autotileName !== undefined ? "◆" : undefined,
  });
}

function makePaletteCell(
  args: MakeGridPaletteArgs,
  tileId: number,
  title = gridTileTitle(args.tileset, tileId),
  decorations: { readonly badge?: string; readonly className?: string } = {}
): HTMLButtonElement {
  const cell = el("button", {
    class: "chipset-tile" + (args.selectedTile === tileId ? " active" : "") + (decorations.className ?? ""),
    attrs: {
      title,
      type: "button",
      "aria-label": title,
      "aria-pressed": String(args.selectedTile === tileId),
      style: tilesetTileBackgroundStyle(args.tileset, tileId, "var(--chipset-cell)"),
    },
    dataset: { testid: `chipset-tile-${tileId}`, tileIndex: String(tileId) },
    on: {
      pointerdown: (event) => {
        if ("button" in event && typeof event.button === "number" && event.button !== 0) return;
        event.preventDefault();
        args.onSelectTile(tileId);
      },
      click: (event) => {
        event.preventDefault();
        // Assistive technology activates buttons with a zero-detail click and
        // no pointerdown. Physical clicks were already handled above.
        if (!Reflect.get(event, "detail")) args.onSelectTile(tileId);
      },
      // Enter/Space selects immediately; preventDefault suppresses the later
      // native click so this path does not activate the same tile twice.
      keydown: (event) => {
        const key = Reflect.get(event, "key");
        if (key !== "Enter" && key !== " " && key !== "Spacebar") return;
        event.preventDefault();
        args.onSelectTile(tileId);
      },
    },
  });
  if (decorations.badge) {
    cell.append(el("span", {
      class: "oprn-autotile-badge",
      text: decorations.badge,
      attrs: { "aria-hidden": "true" },
    }));
  }
  return cell;
}


function bannedTileReason(tileId: number): string | null {
  if (tileId >= 411 && tileId <= 413) return "천막 타일은 하네스 전용 — 일반 배치 시 시장과 불일치";
  if (tileId === 443) return "천막 타일은 하네스 전용";
  return null;
}

function waterTileKind(tileId: number): string | null {
  if (tileId === 0) return "호수(쿼터 합성)";
  if (tileId === 93 || tileId === 123) return "폭포(3프레임 3fps)";
  if (tileId === 3) return "수로(3프레임)";
  return null;
}

function gridTileTitle(tileset: TilesetDef, tileId: number): string {
  if (isDefaultTilesetTexture(tileset)) {
    return `${tileDisplayLabelForIndex(tileId)} / AI: ${tileAiLabelForIndex(tileId)}`;
  }
  const label = tileset.tileMeta?.[tileId]?.label?.trim();
  return label ? `${tileId} ${label}` : `타일 ${tileId}`;
}
