import type { PalettePreset, PaletteSlot, PaletteSlotRole, TileAiMetadata, TilesetDef } from "./types";
import type { Rng } from "@/util/rng";

export const PALETTE_SLOT_ROLES: readonly PaletteSlotRole[] = [
  "ground",
  "path",
  "wall",
  "water",
  "decor",
  "boundary",
  "roof",
  "furniture",
] as const;

export interface PaletteTileChoice {
  readonly preset: PalettePreset;
  readonly role: PaletteSlotRole;
  readonly tileIds: readonly number[];
  readonly weight: number;
}

export interface PickedPaletteTile {
  readonly preset: PalettePreset;
  readonly role: PaletteSlotRole;
  readonly tile: number;
}

export function isPaletteSlotRole(value: unknown): value is PaletteSlotRole {
  return typeof value === "string" && (PALETTE_SLOT_ROLES as readonly string[]).includes(value);
}

export function normalizePalettePresetId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("pp_")) return trimmed;
  const body = trimmed.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 48) || "preset";
  return `pp_${body}`;
}

export function confidenceScore(value: TileAiMetadata["confidence"] | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  if (value === "high") return 1;
  if (value === "medium") return 0.65;
  if (value === "low") return 0.25;
  return null;
}

export function tileMetaLocked(meta: TileAiMetadata | undefined): boolean {
  return meta?.locked === true || meta?.userLocked === true;
}

export function tileMetaOrigin(meta: TileAiMetadata | undefined): "user" | "ai" | undefined {
  if (meta?.origin === "user" || meta?.origin === "ai") return meta.origin;
  if (meta?.source === "user") return "user";
  if (meta?.source === "ai") return "ai";
  return undefined;
}

export function paletteTileChoices(
  tileset: TilesetDef,
  presetId: string,
  role: PaletteSlotRole
): readonly PaletteTileChoice[] {
  const normalizedId = normalizePalettePresetId(presetId);
  const preset = (tileset.palettePresets ?? []).find((entry) => entry.id === normalizedId);
  if (!preset) return [];
  return preset.slots
    .filter((slot) => slot.role === role)
    .map((slot) => ({
      preset,
      role,
      tileIds: slot.tileIds.filter((tile) => Number.isInteger(tile) && tile >= 0 && tile < tileset.count),
      weight: slotWeight(slot),
    }))
    .filter((choice) => choice.tileIds.length > 0 && choice.weight > 0);
}

export function pickPaletteTile(choices: readonly PaletteTileChoice[], rng: Rng): PickedPaletteTile | null {
  if (choices.length === 0) return null;
  const totalWeight = choices.reduce((total, choice) => total + choice.weight, 0);
  if (totalWeight <= 0) return null;
  let cursor = rng() * totalWeight;
  for (const choice of choices) {
    cursor -= choice.weight;
    if (cursor > 0) continue;
    return {
      preset: choice.preset,
      role: choice.role,
      tile: choice.tileIds[Math.floor(rng() * choice.tileIds.length)] ?? choice.tileIds[0],
    };
  }
  const fallback = choices[choices.length - 1];
  return fallback
    ? {
      preset: fallback.preset,
      role: fallback.role,
      tile: fallback.tileIds[Math.floor(rng() * fallback.tileIds.length)] ?? fallback.tileIds[0],
    }
    : null;
}

export function paletteRolesForTile(tileset: TilesetDef, tile: number, presetId?: string): readonly PaletteSlotRole[] {
  const normalizedPresetId = presetId ? normalizePalettePresetId(presetId) : undefined;
  const roles = new Set<PaletteSlotRole>();
  for (const preset of tileset.palettePresets ?? []) {
    if (normalizedPresetId && preset.id !== normalizedPresetId) continue;
    for (const slot of preset.slots) {
      if (slot.tileIds.includes(tile)) roles.add(slot.role);
    }
  }
  return [...roles];
}

export function tileCategoriesForTile(tileset: TilesetDef, tile: number): readonly string[] {
  const categories = new Set<string>();
  const meta = tileset.tileMeta?.[tile];
  const metaCategory = metadataString(meta, "category");
  if (metaCategory) categories.add(metaCategory);
  if (typeof meta?.role === "string" && meta.role.trim()) categories.add(meta.role.trim());
  for (const role of paletteRolesForTile(tileset, tile)) categories.add(role);
  for (const group of tileset.tileGroups ?? []) {
    if (group.tileIds.includes(tile)) categories.add(group.role);
  }
  return [...categories];
}

export function primaryTileRole(tileset: TilesetDef, tile: number): PaletteSlotRole | null {
  const metaRole = tileset.tileMeta?.[tile]?.role;
  if (isPaletteSlotRole(metaRole)) return metaRole;
  return paletteRolesForTile(tileset, tile).find(isPaletteSlotRole) ?? null;
}

function slotWeight(slot: PaletteSlot): number {
  if (slot.weight === undefined) return 1;
  return Number.isFinite(slot.weight) ? Math.max(0, slot.weight) : 0;
}

function metadataString(meta: TileAiMetadata | undefined, key: string): string | null {
  if (!meta) return null;
  const value = (meta as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
