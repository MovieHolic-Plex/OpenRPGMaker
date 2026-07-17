/**
 * Legacy interior wall contract — read-only diagnosis + narrow, explicit conversion.
 *
 * Before Option B (2026-07-15) the interior chipset stored one number under three
 * meanings: a 105-body wall-frame store autotile, a multi-variant dark-wall store,
 * and finished house shell tiles. A tile id alone cannot recover which layer wrote a
 * cell, so this module never guesses:
 *
 * - `findLegacyInteriorWallContract` reports group ids and suspicious map cells only.
 * - `collapseLegacyDarkWallMap` is a pure transform the caller opts into per map,
 *   after deciding that map is dark-only.
 * - House maps are regenerated from their original `InteriorRoomPlan` by the owning
 *   build script. There is deliberately no house tile remap here — a numeric guess is
 *   exactly the failure this contract exists to stop.
 *
 * Nothing here is a writer. New paint/generate paths must not emit legacy variants.
 */
import { DARK_WALL_AUTOTILE_GROUP_ID, DARK_WALL_TILE } from "@/project/defaults/darkWallAutotile";
import { HOUSE_SHELL_FORBIDDEN_TILES } from "@/project/defaults/interiorHouseWallTiles";
import {
  INTERIOR_TEXTURE_KEY,
  INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
} from "@/project/tilesetHarness/themePacks";
import type { GameMap, MapId, Project, TilesetDef, TilesetId } from "@/project/types";

/**
 * The nine ids the pre-Option-B dark-wall variantMap could write.
 * Collapse target once a caller declares a map dark-only.
 */
export const LEGACY_DARK_STORE_TILES: readonly number[] = [
  366, 367, 368, 369, 396, 398, 426, 427, 428,
];

/**
 * Legacy dark store ids the house whole-tile grammar never writes.
 * Stored anywhere → that cell came from the old dark contract, not a house shell.
 * (396/398/426/428 are excluded on purpose: they are live house post/flank tiles.)
 */
export const LEGACY_DARK_ONLY_TILES: readonly number[] = [367, 368, 369, 427];

/** Old wall-frame cap joints (233/258) and door post base (257) — forbidden in any new wall result. */
export const LEGACY_FORBIDDEN_WALL_TILES: readonly number[] = HOUSE_SHELL_FORBIDDEN_TILES;

/**
 * Finished house face ids (cream + gold/stone retint). House-only: the dark contract
 * never stored these, so they are the evidence that a map holds a house shell.
 */
export const HOUSE_FACE_EVIDENCE_TILES: readonly number[] = [
  74, 75, 76, 104, 105, 106, 77, 107, // cream 2-row + solo partition
  314, 315, 316, 344, 345, 346, //       gold-brick retint
  134, 135, 136, 164, 165, 166, //       stone-brick retint
];

export type LegacyWallCellKind = "dark-only-variant" | "forbidden-placeholder";

export type LegacyWallCell = {
  readonly x: number;
  readonly y: number;
  readonly tile: number;
  readonly kind: LegacyWallCellKind;
};

/**
 * Evidence verdict — a hint for a human/script picking a mode, never an instruction.
 * Only `dark-legacy` is safe to hand to `collapseLegacyDarkWallMap` unattended.
 */
export type LegacyWallVerdict = "clean" | "dark-legacy" | "house-legacy" | "ambiguous";

export type LegacyWallMapReport = {
  readonly mapId: MapId;
  readonly tilesetId: TilesetId;
  readonly verdict: LegacyWallVerdict;
  readonly cells: readonly LegacyWallCell[];
  /** Count of house face tiles — non-zero means a dark collapse would eat house walls. */
  readonly houseFaceCells: number;
};

export type LegacyWallGroupReport = {
  readonly tilesetId: TilesetId;
  readonly groupId: string;
  readonly reason: "wall-frame-store-group" | "dark-multi-variant-store";
};

export type LegacyInteriorWallContractReport = {
  /** True when no legacy group and no suspicious cell was found. */
  readonly clean: boolean;
  readonly groups: readonly LegacyWallGroupReport[];
  /** Only maps with findings — clean maps are omitted. */
  readonly maps: readonly LegacyWallMapReport[];
};

type ProjectView = Pick<Project, "maps" | "tilesets">;

const DARK_ONLY = new Set(LEGACY_DARK_ONLY_TILES);
const FORBIDDEN = new Set(LEGACY_FORBIDDEN_WALL_TILES);
const HOUSE_FACE = new Set(HOUSE_FACE_EVIDENCE_TILES);
const DARK_STORE = new Set(LEGACY_DARK_STORE_TILES);

function isInteriorTileset(tileset: TilesetDef | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY;
}

/** A dark group is legacy when it can still store anything other than the 366 body. */
function isLegacyDarkGroup(group: { memberTileIds: number[]; variantMap: Record<string, number> }): boolean {
  const stored = [...group.memberTileIds, ...Object.values(group.variantMap)];
  return stored.some((tile) => tile !== DARK_WALL_TILE.BODY);
}

function verdictFor(kinds: ReadonlySet<LegacyWallCellKind>, houseFaceCells: number): LegacyWallVerdict {
  const dark = kinds.has("dark-only-variant");
  const house = kinds.has("forbidden-placeholder");
  if (!dark && !house) return "clean";
  if (dark && house) return "ambiguous";
  if (house) return "house-legacy";
  // Dark evidence alongside a house shell is a mixed map — collapsing would eat the house.
  return houseFaceCells > 0 ? "ambiguous" : "dark-legacy";
}

/**
 * Read-only scan. Reports legacy store groups and every suspicious cell with map id +
 * coordinates. Never mutates the project.
 */
export function findLegacyInteriorWallContract(project: ProjectView): LegacyInteriorWallContractReport {
  const groups: LegacyWallGroupReport[] = [];
  for (const tileset of Object.values(project.tilesets)) {
    if (!isInteriorTileset(tileset)) continue;
    for (const group of tileset.autotileGroups ?? []) {
      if (group.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID) {
        groups.push({ tilesetId: tileset.id, groupId: group.id, reason: "wall-frame-store-group" });
      } else if (group.id === DARK_WALL_AUTOTILE_GROUP_ID && isLegacyDarkGroup(group)) {
        groups.push({ tilesetId: tileset.id, groupId: group.id, reason: "dark-multi-variant-store" });
      }
    }
  }

  const maps: LegacyWallMapReport[] = [];
  for (const map of Object.values(project.maps)) {
    const tileset = project.tilesets[map.tilesetId];
    if (!isInteriorTileset(tileset)) continue;

    const cells: LegacyWallCell[] = [];
    const kinds = new Set<LegacyWallCellKind>();
    let houseFaceCells = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.lowerTiles[y * map.width + x];
        if (tile === undefined) continue;
        if (HOUSE_FACE.has(tile)) houseFaceCells += 1;
        const kind: LegacyWallCellKind | undefined = DARK_ONLY.has(tile)
          ? "dark-only-variant"
          : FORBIDDEN.has(tile)
            ? "forbidden-placeholder"
            : undefined;
        if (!kind) continue;
        cells.push({ x, y, tile, kind });
        kinds.add(kind);
      }
    }
    if (cells.length === 0) continue;
    maps.push({
      mapId: map.id,
      tilesetId: map.tilesetId,
      verdict: verdictFor(kinds, houseFaceCells),
      cells,
      houseFaceCells,
    });
  }

  return { clean: groups.length === 0 && maps.length === 0, groups, maps };
}

export type LegacyDarkCollapseChange = {
  readonly x: number;
  readonly y: number;
  readonly from: number;
};

export type LegacyDarkCollapseResult = {
  readonly map: GameMap;
  readonly changed: readonly LegacyDarkCollapseChange[];
};

/**
 * Pure: rewrite legacy dark store variants to the single body 366 so render quarters
 * take over. Returns a new map; the input is untouched.
 *
 * Caller contract: only pass a map already decided to be dark-only. On a house or mixed
 * map this eats posts/flanks (396/398/426/428) — `findLegacyInteriorWallContract` marks
 * those `ambiguous` precisely so they never reach here.
 */
export function collapseLegacyDarkWallMap(map: GameMap): LegacyDarkCollapseResult {
  const changed: LegacyDarkCollapseChange[] = [];
  const lowerTiles = [...map.lowerTiles];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      const tile = lowerTiles[i];
      if (tile === undefined || tile === DARK_WALL_TILE.BODY || !DARK_STORE.has(tile)) continue;
      changed.push({ x, y, from: tile });
      lowerTiles[i] = DARK_WALL_TILE.BODY;
    }
  }
  return { map: { ...map, lowerTiles }, changed };
}

export type LegacyGroupStripResult = {
  readonly tileset: TilesetDef;
  readonly removed: readonly string[];
};

/**
 * Pure: drop the built-in legacy wall-frame store group. User-authored autotile groups
 * survive — only the exact built-in id is removed.
 */
export function stripLegacyInteriorWallFrameGroup(tileset: TilesetDef): LegacyGroupStripResult {
  const existing = tileset.autotileGroups;
  if (!existing) return { tileset, removed: [] };
  const next = existing.filter((group) => group.id !== INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
  if (next.length === existing.length) return { tileset, removed: [] };
  return {
    tileset: { ...tileset, autotileGroups: next },
    removed: [INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID],
  };
}

/** Human-readable lint lines — map id + coordinates, per plan §4.5.6. */
export function formatLegacyInteriorWallReport(report: LegacyInteriorWallContractReport): string[] {
  if (report.clean) return ["legacy interior wall contract: clean"];
  const lines: string[] = [];
  for (const group of report.groups) {
    lines.push(`[group] ${group.tilesetId}: ${group.groupId} (${group.reason})`);
  }
  for (const map of report.maps) {
    const sample = map.cells
      .slice(0, 8)
      .map((c) => `${c.tile}@${c.x},${c.y}`)
      .join(" ");
    const more = map.cells.length > 8 ? ` +${map.cells.length - 8} more` : "";
    lines.push(`[map] ${map.mapId} verdict=${map.verdict} cells=${map.cells.length}: ${sample}${more}`);
  }
  return lines;
}
