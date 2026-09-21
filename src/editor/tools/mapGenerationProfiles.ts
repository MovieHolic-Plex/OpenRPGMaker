import { FOREST_HARMONY_ID } from "@/project/defaults/forestHarmony";
import type { Project } from "@/project/types";
import { bundledChipsetFrameCount } from "@/assets/bundled";
import { DEFAULT_TILE_COUNT, DEFAULT_TILE_SIZE, DEFAULT_TILES_PER_ROW } from "@/project/defaults/constants";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { tileMetaLocked, tileMetaOrigin } from "@/project/tilesetPalette";
import { ToolError } from "./types";

export type MapGenerationLayout =
  | "settlement"
  | "dungeon"
  | "rooms"
  | "ship"
  | "world"
  | "city"
  | "wilds";

export type MapGenerationPalette = {
  readonly base: number;
  readonly path: number;
  readonly obstacle: number;
  readonly accent: number;
};

export type MapGenerationProfile = {
  readonly tilesetId: string;
  readonly layout: MapGenerationLayout;
  readonly palettes: Readonly<Record<"village" | "forest" | "cave", MapGenerationPalette>>;
};

const samePalette = (palette: MapGenerationPalette): MapGenerationProfile["palettes"] => ({
  village: palette,
  forest: palette,
  cave: palette,
});

const PROFILES = [
  {
    tilesetId: FOREST_HARMONY_ID,
    layout: "settlement",
    palettes: samePalette({ base: 240, path: 360, obstacle: 289, accent: 288 }),
  },
  {
    tilesetId: "easyrpg_chipset_dungeon",
    layout: "dungeon",
    palettes: {
      village: { base: 240, path: 270, obstacle: 306, accent: 288 },
      forest: { base: 240, path: 270, obstacle: 306, accent: 288 },
      cave: { base: 300, path: 330, obstacle: 366, accent: 384 },
    },
  },
  {
    tilesetId: "easyrpg_chipset_interior",
    layout: "rooms",
    palettes: {
      village: { base: 72, path: 72, obstacle: 366, accent: 325 },
      forest: { base: 12, path: 12, obstacle: 366, accent: 355 },
      cave: { base: 102, path: 102, obstacle: 430, accent: 408 },
    },
  },
  {
    tilesetId: "easyrpg_chipset_ship",
    layout: "ship",
    palettes: samePalette({ base: 120, path: 396, obstacle: 222, accent: 385 }),
  },
  {
    tilesetId: "easyrpg_chipset_world",
    layout: "world",
    palettes: {
      village: { base: 240, path: 241, obstacle: 306, accent: 288 },
      forest: { base: 240, path: 241, obstacle: 290, accent: 318 },
      cave: { base: 243, path: 241, obstacle: 306, accent: 385 },
    },
  },
  {
    tilesetId: "easyrpg_chipset_retro_dungeon",
    layout: "dungeon",
    palettes: {
      village: { base: 240, path: 270, obstacle: 306, accent: 288 },
      forest: { base: 240, path: 270, obstacle: 306, accent: 384 },
      cave: { base: 300, path: 330, obstacle: 366, accent: 385 },
    },
  },
  {
    tilesetId: "easyrpg_chipset_retro_exterior",
    layout: "settlement",
    palettes: {
      village: { base: 240, path: 360, obstacle: 306, accent: 288 },
      forest: { base: 240, path: 360, obstacle: 290, accent: 318 },
      cave: { base: 423, path: 360, obstacle: 306, accent: 385 },
    },
  },
  {
    tilesetId: "easyrpg_chipset_retro_house",
    layout: "rooms",
    palettes: {
      village: { base: 72, path: 72, obstacle: 42, accent: 325 },
      forest: { base: 102, path: 102, obstacle: 42, accent: 355 },
      cave: { base: 132, path: 132, obstacle: 42, accent: 408 },
    },
  },
  {
    tilesetId: "easyrpg_chipset_combined_town",
    layout: "settlement",
    palettes: {
      village: { base: 240, path: 360, obstacle: 306, accent: 288 },
      forest: { base: 240, path: 360, obstacle: 290, accent: 318 },
      cave: { base: 423, path: 360, obstacle: 306, accent: 385 },
    },
  },
  {
    tilesetId: "easyrpg_chipset_retro_world",
    layout: "world",
    palettes: {
      village: { base: 240, path: 241, obstacle: 306, accent: 288 },
      forest: { base: 240, path: 241, obstacle: 290, accent: 318 },
      cave: { base: 243, path: 241, obstacle: 306, accent: 385 },
    },
  },
  {
    // 위 480칸이 합본 마을과 같은 ID 이므로 팔레트도 같다. 아래 반쪽(레트로 월드맵)은 생성이 안 쓴다.
    tilesetId: "easyrpg_chipset_combined_town_retro_world",
    layout: "settlement",
    palettes: {
      village: { base: 240, path: 360, obstacle: 306, accent: 288 },
      forest: { base: 240, path: 360, obstacle: 290, accent: 318 },
      cave: { base: 423, path: 360, obstacle: 306, accent: 385 },
    },
  },
  {
    tilesetId: "modern_exteriors_nocturne",
    layout: "city",
    palettes: samePalette({ base: 0, path: 1, obstacle: 30, accent: 10 }),
  },
  {
    tilesetId: "scarloxy_chipset_grassland",
    layout: "settlement",
    palettes: samePalette({ base: 0, path: 60, obstacle: 48, accent: 78 }),
  },
  {
    tilesetId: "scarloxy_chipset_wilds",
    layout: "wilds",
    palettes: {
      village: { base: 0, path: 60, obstacle: 117, accent: 119 },
      forest: { base: 10, path: 70, obstacle: 175, accent: 149 },
      cave: { base: 0, path: 60, obstacle: 117, accent: 119 },
    },
  },
  {
    tilesetId: "scarloxy_chipset_indoor",
    layout: "rooms",
    palettes: samePalette({ base: 3, path: 3, obstacle: 31, accent: 34 }),
  },
] as const satisfies readonly MapGenerationProfile[];

export const MAP_GENERATION_PROFILES: ReadonlyMap<string, MapGenerationProfile> = new Map(
  PROFILES.map((profile) => [profile.tilesetId, profile]),
);

export function requireMapGenerationProfile(project: Project, tilesetId: string): MapGenerationProfile {
  if (!project.tilesets[tilesetId]) {
    throw new ToolError(`존재하지 않는 타일셋입니다: ${tilesetId}`, { code: "invalid-args" });
  }
  const profile = MAP_GENERATION_PROFILES.get(tilesetId);
  if (!profile) {
    throw new ToolError(`타일셋 '${tilesetId}' 전용 맵 생성 로직이 아직 없습니다`, { code: "unsupported-tileset" });
  }
  return profile;
}

export type MapGenerationTile = { readonly tile: number; readonly layer: "lower" | "upper" };
export type MapGenerationPaletteResolver = (paletteSlot: keyof MapGenerationPalette) => MapGenerationTile;

// Resolve only roles actually consumed by the algorithm. In particular, settlement
// never consumes accent. This boundary must not author shared tileset rules.
export function resolveMapGenerationPalette(
  project: Project,
  profile: MapGenerationProfile,
  palette: MapGenerationPalette,
): MapGenerationPaletteResolver {
  const tileset = project.tilesets[profile.tilesetId];
  const reject = (detail: string): never => {
    throw new ToolError(`타일셋 '${profile.tilesetId}' 생성 팔레트가 현재 타일 규칙과 호환되지 않습니다: ${detail}`, {
      code: "incompatible-generation-palette",
    });
  };
  // The numeric profiles address these bundled atlases, not an uploaded replacement
  // that happens to retain the same tileset ID. The cell count must be the bundled
  // sheet's own (480 for RM2K sheets; 960 for the combined-town + retro-world sheet,
  // whose palette indices all sit in the combined-town half below 480).
  if (tileset.image.type !== "bundled" || tileset.image.id !== `tex_${profile.tilesetId}`
    || tileset.tileSize !== DEFAULT_TILE_SIZE || tileset.tilesPerRow !== DEFAULT_TILES_PER_ROW
    || tileset.count < DEFAULT_TILE_COUNT || tileset.count !== bundledChipsetFrameCount(tileset.image.id)) {
    reject("atlas image / geometry");
  }
  // Use the same authored/default authority as reload, on a private copy. Reject
  // stale runtime rules rather than normalizing the project's unrelated tiles.
  const canonical = structuredClone(tileset);
  ensureTilesetHarnesses({ tilesets: { [profile.tilesetId]: canonical } });
  const resolved = new Map<keyof MapGenerationPalette, MapGenerationTile>();
  return paletteSlot => {
    const cached = resolved.get(paletteSlot);
    if (cached) return cached;
    const tile = palette[paletteSlot];
    if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) reject(`${paletteSlot}:${tile} out of atlas`);
    const layer = tileset.priority[tile];
    const pass = tileset.passability[tile];
    const expected = canonical.passability[tile];
    const directions = ["up", "down", "left", "right"] as const;
    if ((layer !== "lower" && layer !== "upper") || !pass || !expected
      || layer !== canonical.priority[tile] || directions.some(dir => pass[dir] !== expected[dir])) {
      reject(`${paletteSlot}:${tile} runtime / authored rules differ`);
    }
    const meta = tileset.tileMeta?.[tile];
    if (tileMetaLocked(meta) || tileMetaOrigin(meta) === "user") {
      if ((meta?.defaultLayer === "lower" || meta?.defaultLayer === "upper") && meta.defaultLayer !== layer) {
        reject(`${paletteSlot}:${tile} authored layer`);
      }
      if (meta?.passage && directions.some(dir => pass[dir] !== (meta.passage !== "solid"))) {
        reject(`${paletteSlot}:${tile} authored passage`);
      }
    }
    // Corridors are carved in both axes. Obstacles may be lower terrain/trunks or
    // upper solid props; world accent bands need not be passable corridors.
    if ((paletteSlot === "base" || paletteSlot === "path") && (layer !== "lower" || directions.some(dir => !pass[dir]))) {
      reject(`${paletteSlot}:${tile} requires lower, four-direction passable ground`);
    }
    if (paletteSlot === "obstacle" && directions.some(dir => pass[dir])) reject(`${paletteSlot}:${tile} requires solid passage`);
    const choice = { tile, layer };
    resolved.set(paletteSlot, choice);
    return choice;
  };
}
