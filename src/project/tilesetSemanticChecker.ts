import type { TileAiMetadata, TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";

export type TilesetGenerationCheckId = "city" | "decor" | "house" | "road" | "water";

export type TilesetRoleSlot = {
  readonly acceptedRoles: readonly TileGroupRole[];
  readonly label: string;
};

export type TilesetGenerationCheck = {
  readonly coveredRoles: readonly TileGroupRole[];
  readonly description: string;
  readonly id: TilesetGenerationCheckId;
  readonly label: string;
  readonly missingRoleSlots: readonly string[];
  readonly ready: boolean;
  readonly roleSlots: readonly TilesetRoleSlot[];
};

export type TilesetGenerationSummary = {
  readonly checks: readonly TilesetGenerationCheck[];
  readonly invalidGroups: readonly TileGroupMetadata[];
  readonly ready: boolean;
};

export type SelectedTileGroupUsage = {
  readonly defaultLayer: TileGroupMetadata["defaultLayer"];
  readonly name: string;
  readonly placementRules: string;
  readonly role: TileGroupRole;
};

export type SelectedTileUsageSummary = {
  readonly description: string;
  readonly groups: readonly SelectedTileGroupUsage[];
  readonly label: string;
  readonly ruleText: string;
  readonly tags: readonly string[];
};

type GenerationRule = {
  readonly description: string;
  readonly id: TilesetGenerationCheckId;
  readonly label: string;
  readonly roleSlots: readonly TilesetRoleSlot[];
};

const GENERATION_RULES: readonly GenerationRule[] = [
  {
    id: "city",
    label: "City",
    description: "Starter city generation needs walkable ground, buildings, walls, water, and decor cues.",
    roleSlots: [
      { label: "terrain", acceptedRoles: ["terrain"] },
      { label: "building", acceptedRoles: ["building"] },
      { label: "wall", acceptedRoles: ["wall"] },
      { label: "water", acceptedRoles: ["water"] },
      { label: "decor", acceptedRoles: ["prop", "fence", "roof"] },
    ],
  },
  {
    id: "house",
    label: "House",
    description: "House generation needs shell, wall, and roof semantics.",
    roleSlots: [
      { label: "building", acceptedRoles: ["building"] },
      { label: "wall", acceptedRoles: ["wall"] },
      { label: "roof", acceptedRoles: ["roof"] },
    ],
  },
  {
    id: "road",
    label: "Road",
    description: "Road generation needs terrain groups, preferably with repeat or autotile grammar.",
    roleSlots: [{ label: "terrain", acceptedRoles: ["terrain"] }],
  },
  {
    id: "water",
    label: "Water",
    description: "Water generation needs water or hazard groups.",
    roleSlots: [{ label: "water", acceptedRoles: ["water"] }],
  },
  {
    id: "decor",
    label: "Decor",
    description: "Decor generation needs at least one prop, fence, or roof detail group.",
    roleSlots: [{ label: "decor", acceptedRoles: ["prop", "fence", "roof"] }],
  },
] as const;

export function summarizeTilesetGenerationReadiness(tileset: TilesetDef): TilesetGenerationSummary {
  const validGroups = (tileset.tileGroups ?? []).filter((group) => isValidSemanticGroup(tileset, group));
  const invalidGroups = (tileset.tileGroups ?? []).filter((group) => !isValidSemanticGroup(tileset, group));
  const checks = GENERATION_RULES.map((rule) => summarizeGenerationRule(rule, validGroups));
  return {
    checks,
    invalidGroups,
    ready: checks.every((check) => check.ready),
  };
}

export function summarizeTileUsage(tileset: TilesetDef, tile: number): SelectedTileUsageSummary {
  const meta = tileset.tileMeta?.[tile];
  const groups = groupsForTile(tileset, tile);
  const label = cleanText(meta?.label) || `Tile ${tile}`;
  const description = cleanText(meta?.description) || "No tile meaning has been recorded yet.";
  const ruleText = groups.map((group) => group.placementRules).filter((text) => text.length > 0).join(" / ")
    || "No placement rule has been recorded for this tile.";
  return {
    description,
    groups,
    label,
    ruleText,
    tags: usageTags(tileset, tile, meta, groups),
  };
}

function summarizeGenerationRule(
  rule: GenerationRule,
  groups: readonly TileGroupMetadata[]
): TilesetGenerationCheck {
  const coveredRoles = rolesCoveredByRule(rule, groups);
  const missingRoleSlots = rule.roleSlots
    .filter((slot) => !groups.some((group) => slot.acceptedRoles.includes(group.role)))
    .map((slot) => slot.label);
  return {
    coveredRoles,
    description: rule.description,
    id: rule.id,
    label: rule.label,
    missingRoleSlots,
    ready: missingRoleSlots.length === 0,
    roleSlots: rule.roleSlots,
  };
}

function rolesCoveredByRule(rule: GenerationRule, groups: readonly TileGroupMetadata[]): readonly TileGroupRole[] {
  const roles = new Set<TileGroupRole>();
  for (const slot of rule.roleSlots) {
    for (const group of groups) {
      if (slot.acceptedRoles.includes(group.role)) roles.add(group.role);
    }
  }
  return [...roles].sort();
}

function isValidSemanticGroup(tileset: TilesetDef, group: TileGroupMetadata): boolean {
  if (group.tileIds.length === 0) return false;
  return group.tileIds.every((tile) => Number.isInteger(tile) && tile >= 0 && tile < tileset.count);
}

function groupsForTile(tileset: TilesetDef, tile: number): readonly SelectedTileGroupUsage[] {
  return (tileset.tileGroups ?? [])
    .filter((group) => group.tileIds.includes(tile))
    .map((group) => ({
      defaultLayer: group.defaultLayer,
      name: group.name,
      placementRules: cleanText(group.placementRules),
      role: group.role,
    }));
}

function usageTags(
  tileset: TilesetDef,
  tile: number,
  meta: TileAiMetadata | undefined,
  groups: readonly SelectedTileGroupUsage[]
): readonly string[] {
  const tags: string[] = [];
  for (const group of groups) {
    addTag(tags, group.role);
    addTag(tags, group.defaultLayer);
  }
  if (meta?.passage) addTag(tags, meta.passage);
  if (meta?.role) addTag(tags, meta.role);
  addTag(tags, tileset.priority[tile] === "upper" ? "upper" : "lower");
  if (meta?.repeatability) addTag(tags, meta.repeatability);
  if (meta?.source) addTag(tags, meta.source);
  return tags;
}

function addTag(tags: string[], tag: string): void {
  if (tag.trim().length === 0 || tags.includes(tag)) return;
  tags.push(tag);
}

function cleanText(value: string | undefined): string {
  return value?.trim() ?? "";
}
