export type GridSelectionModifiers = {
  readonly additive?: boolean;
  readonly range?: boolean;
};

type GridSelectionDrag = {
  readonly base: readonly number[];
  readonly nextAnchor: number | null;
  readonly mode: "add" | "replace";
  readonly previousAnchor: number | null;
  readonly previousSelected: readonly number[];
  readonly startTile: number;
  readonly currentTile: number;
};

export type GridSelectionState = {
  readonly anchorTile: number | null;
  readonly drag: GridSelectionDrag | null;
  readonly selected: readonly number[];
};

export type GridSelectionGeometry = {
  readonly height: number;
  readonly rectangular: boolean;
  readonly tileIds: readonly number[];
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

export type GridSelectionSpec = {
  readonly tileCount: number;
  readonly tilesPerRow: number;
};

type GridTileSelectionInput = {
  readonly modifiers: GridSelectionModifiers;
  readonly spec: GridSelectionSpec;
  readonly tile: number;
};

type GridDragUpdate = {
  readonly spec: GridSelectionSpec;
  readonly tile: number;
};

export function createGridSelectionState(): GridSelectionState {
  return { anchorTile: null, drag: null, selected: [] };
}

export function selectGridTile(
  state: GridSelectionState,
  input: GridTileSelectionInput
): GridSelectionState {
  if (!isValidTile(input.tile, input.spec)) return state;
  if (input.modifiers.range) {
    const anchor = state.anchorTile ?? input.tile;
    return {
      anchorTile: anchor,
      drag: null,
      selected: rectangleTiles(anchor, input.tile, input.spec),
    };
  }
  if (input.modifiers.additive) {
    const selected = new Set(state.selected);
    if (selected.has(input.tile)) selected.delete(input.tile);
    else selected.add(input.tile);
    return {
      anchorTile: state.anchorTile ?? input.tile,
      drag: null,
      selected: [...selected].sort((left, right) => left - right),
    };
  }
  return { anchorTile: input.tile, drag: null, selected: [input.tile] };
}

export function beginGridSelectionDrag(
  state: GridSelectionState,
  tile: number,
  modifiers: GridSelectionModifiers
): GridSelectionState {
  const startTile = modifiers.range && state.anchorTile !== null ? state.anchorTile : tile;
  return {
    ...state,
    drag: {
      base: modifiers.additive ? state.selected : [],
      currentTile: tile,
      mode: modifiers.additive ? "add" : "replace",
      nextAnchor: modifiers.range ? state.anchorTile ?? tile : modifiers.additive ? state.anchorTile ?? tile : tile,
      previousAnchor: state.anchorTile,
      previousSelected: state.selected,
      startTile,
    },
  };
}

export function updateGridSelectionDrag(
  state: GridSelectionState,
  input: GridDragUpdate
): GridSelectionState {
  if (!state.drag || !isValidTile(input.tile, input.spec)) return state;
  const rectangle = rectangleTiles(state.drag.startTile, input.tile, input.spec);
  const selected = state.drag.mode === "add"
    ? [...new Set([...state.drag.base, ...rectangle])].sort((left, right) => left - right)
    : rectangle;
  return {
    ...state,
    drag: { ...state.drag, currentTile: input.tile },
    selected,
  };
}

export function commitGridSelectionDrag(state: GridSelectionState): GridSelectionState {
  if (!state.drag) return state;
  return { anchorTile: state.drag.nextAnchor, drag: null, selected: state.selected };
}

export function cancelGridSelectionDrag(state: GridSelectionState): GridSelectionState {
  if (!state.drag) return state;
  return {
    anchorTile: state.drag.previousAnchor,
    drag: null,
    selected: state.drag.previousSelected,
  };
}

export function gridSelectionGeometry(
  tileIds: readonly number[],
  spec: GridSelectionSpec
): GridSelectionGeometry {
  const valid = [...new Set(tileIds.filter((tile) => isValidTile(tile, spec)))].sort((left, right) => left - right);
  if (valid.length === 0) return { height: 0, rectangular: false, tileIds: [], width: 0, x: 0, y: 0 };
  const columns = valid.map((tile) => tile % spec.tilesPerRow);
  const rows = valid.map((tile) => Math.floor(tile / spec.tilesPerRow));
  const x = Math.min(...columns);
  const y = Math.min(...rows);
  const width = Math.max(...columns) - x + 1;
  const height = Math.max(...rows) - y + 1;
  const rectangle = rectangleTiles((y * spec.tilesPerRow) + x, ((y + height - 1) * spec.tilesPerRow) + x + width - 1, spec);
  return {
    height,
    rectangular: rectangle.length === valid.length && rectangle.every((tile, index) => tile === valid[index]),
    tileIds: valid,
    width,
    x,
    y,
  };
}

function rectangleTiles(from: number, to: number, spec: GridSelectionSpec): readonly number[] {
  const fromX = from % spec.tilesPerRow;
  const toX = to % spec.tilesPerRow;
  const fromY = Math.floor(from / spec.tilesPerRow);
  const toY = Math.floor(to / spec.tilesPerRow);
  const left = Math.min(fromX, toX);
  const right = Math.max(fromX, toX);
  const top = Math.min(fromY, toY);
  const bottom = Math.max(fromY, toY);
  const selected: number[] = [];
  for (let row = top; row <= bottom; row += 1) {
    for (let column = left; column <= right; column += 1) {
      const tile = (row * spec.tilesPerRow) + column;
      if (isValidTile(tile, spec)) selected.push(tile);
    }
  }
  return selected;
}

function isValidTile(tile: number, spec: GridSelectionSpec): boolean {
  return Number.isInteger(tile) && tile >= 0 && tile < spec.tileCount && spec.tilesPerRow > 0;
}
