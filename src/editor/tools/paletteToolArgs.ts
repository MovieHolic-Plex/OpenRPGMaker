import {
  isPaletteSlotRole,
  normalizePalettePresetId,
  paletteTileChoices,
  pickPaletteTile,
} from "@/project/tilesetPalette";
import type { PaletteSlotRole, TilesetDef } from "@/project/types";
import { rngForTool } from "./naturalToolArgs";
import { ToolError } from "./types";

export interface PaletteTilePicker {
  readonly presetId: string;
  readonly role: PaletteSlotRole;
  pick(): number;
}

export function paletteTilePickerForTool(
  tileset: TilesetDef,
  args: Record<string, unknown>,
  signature: string
): PaletteTilePicker | null {
  const hasPreset = typeof args.presetId === "string" && args.presetId.trim().length > 0;
  const hasRole = typeof args.paletteRole === "string" && args.paletteRole.trim().length > 0;
  if (!hasPreset && !hasRole) return null;
  if (!hasPreset || !hasRole) {
    throw new ToolError("프리셋 배치를 쓰려면 presetId와 paletteRole을 함께 지정해야 합니다.", { code: "palette-args-missing" });
  }
  const presetId = normalizePalettePresetId(args.presetId as string);
  const role = args.paletteRole;
  if (!isPaletteSlotRole(role)) {
    throw new ToolError(`알 수 없는 paletteRole: ${String(role)}`, { code: "palette-role-invalid" });
  }
  const choices = paletteTileChoices(tileset, presetId, role);
  if (choices.length === 0) {
    const preset = (tileset.palettePresets ?? []).find((entry) => entry.id === presetId);
    if (!preset) throw new ToolError(`프리셋을 찾을 수 없습니다: ${presetId}`, { code: "palette-preset-not-found" });
    throw new ToolError(`프리셋 ${presetId}의 ${role} slot에 배치할 tileIds가 없습니다.`, { code: "palette-slot-empty" });
  }
  const rng = rngForTool(args, `${signature}|palette|${presetId}|${role}`);
  return {
    presetId,
    role,
    pick(): number {
      const picked = pickPaletteTile(choices, rng);
      if (!picked) throw new ToolError(`프리셋 ${presetId}의 ${role} slot에서 타일을 선택할 수 없습니다.`, { code: "palette-slot-empty" });
      return picked.tile;
    },
  };
}
