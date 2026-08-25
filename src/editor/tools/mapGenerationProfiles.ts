import type { Project } from "@/project/types";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
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
    tilesetId: "easyrpg_chipset_dungeon",
    layout: "dungeon",
    palettes: {
      village: { base: 240, path: 270, obstacle: 306, accent: 288 },
      forest: { base: 60, path: 90, obstacle: 306, accent: 288 },
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
    palettes: samePalette({ base: 120, path: 222, obstacle: 396, accent: 385 }),
  },
  {
    tilesetId: "easyrpg_chipset_world",
    layout: "world",
    palettes: {
      village: { base: 240, path: 360, obstacle: 306, accent: 288 },
      forest: { base: 240, path: 360, obstacle: 290, accent: 318 },
      cave: { base: 423, path: 360, obstacle: 306, accent: 385 },
    },
  },
  {
    tilesetId: "easyrpg_chipset_retro_dungeon",
    layout: "dungeon",
    palettes: {
      village: { base: 240, path: 270, obstacle: 306, accent: 288 },
      forest: { base: 180, path: 210, obstacle: 306, accent: 384 },
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
      forest: { base: 10, path: 70, obstacle: 145, accent: 149 },
      cave: { base: 20, path: 80, obstacle: 117, accent: 119 },
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

export function applyMapGenerationPassage(
  project: Project,
  profile: MapGenerationProfile,
  palette: MapGenerationPalette,
): void {
  const tileset = project.tilesets[profile.tilesetId];
  if (!tileset) return;
  for (const tileId of [palette.base, palette.path, palette.accent]) {
    tileset.passability[tileId] = passableFlag();
    tileset.priority[tileId] = "lower";
  }
  tileset.passability[palette.obstacle] = blockedFlag();
  tileset.priority[palette.obstacle] = "lower";
}
