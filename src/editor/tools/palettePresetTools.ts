import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { isPaletteSlotRole, normalizePalettePresetId } from "@/project/tilesetPalette";
import type { PalettePreset, PaletteSlot, PaletteSlotRole, TilesetDef } from "@/project/types";
import { genId } from "@/util/id";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type JsonRecord = Record<string, unknown>;

const upsertPalettePreset: ToolDefinition = {
  name: "upsert_palette_preset",
  description: "타일셋 팔레트 프리셋을 추가/수정한다. 프리셋이 있으면 개별 타일 id 대신 presetId+paletteRole을 우선 사용하라. 잠긴 프리셋은 AI가 수정할 수 없다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "대상 타일셋 id(기본 tiles_default)" },
      preset: { type: "object", description: "PalettePreset 부분 객체. 신규는 id 생략 가능(name/slots 필요, origin 기본 ai)." },
    },
    required: ["preset"],
  },
  run(draft, args): ToolExecResult {
    const tilesetId = typeof args.tilesetId === "string" ? args.tilesetId : DEFAULT_TILESET_ID;
    const tileset = draft.tilesets[tilesetId];
    if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { code: "tileset-not-found" });
    const record = requireRecord(args.preset, "preset");
    const explicitId = typeof record.id === "string" && record.id.trim().length > 0 ? normalizePalettePresetId(record.id) : undefined;
    const id = explicitId ?? genId("pp");
    const presets = tileset.palettePresets ?? [];
    const existing = presets.find((preset) => preset.id === id);
    if (existing?.locked === true) {
      throw new ToolError(`잠긴 팔레트 프리셋은 AI가 수정할 수 없습니다: ${existing.id} (${existing.name})`, {
        code: "palette-preset-locked",
      });
    }
    const preservedLockedCount = presets.filter((preset) => preset.locked === true && preset.id !== existing?.id).length;

    const next = existing
      ? mergeExistingPreset(existing, record, tileset)
      : createNewPreset(id, record, tileset);
    const normalized = normalizePreset(next, tileset);
    if (existing) {
      tileset.palettePresets = presets.map((preset) => preset.id === existing.id ? normalized : preset);
    } else {
      tileset.palettePresets = [...presets, normalized];
    }
    const action = existing ? "수정" : "추가";
    const preservedLine = preservedLockedCount > 0 ? `잠긴 항목 ${preservedLockedCount}개 보존됨` : null;
    return {
      summary: `팔레트 프리셋 ${action}: ${normalized.name} (${normalized.id}, slot ${normalized.slots.length}개)${preservedLine ? ` · ${preservedLine}` : ""}`,
      ...(preservedLine ? { warnings: [preservedLine] } : {}),
      data: { tilesetId, presetId: normalized.id, action, slotCount: normalized.slots.length, preservedLockedCount },
    };
  },
};

export const PALETTE_PRESET_TOOLS: readonly ToolDefinition[] = [upsertPalettePreset];

function createNewPreset(id: string, record: JsonRecord, tileset: TilesetDef): PalettePreset {
  const name = stringField(record, "name", "신규 팔레트 프리셋에는 name(문자열)이 필요합니다.");
  const slots = slotsField(record, tileset, true);
  const origin = originField(record.origin);
  return {
    id,
    name,
    slots,
    origin: origin ?? "ai",
    ...(record.locked === undefined ? {} : { locked: booleanField(record.locked, "locked") }),
  };
}

function mergeExistingPreset(existing: PalettePreset, record: JsonRecord, tileset: TilesetDef): PalettePreset {
  const slots = record.slots === undefined ? existing.slots : slotsField(record, tileset, false);
  return {
    ...existing,
    ...(typeof record.name === "string" ? { name: cleanName(record.name) } : {}),
    slots,
    ...(record.origin === undefined ? {} : { origin: originField(record.origin) ?? existing.origin }),
    ...(record.locked === undefined ? {} : { locked: booleanField(record.locked, "locked") }),
  };
}

function normalizePreset(preset: PalettePreset, tileset: TilesetDef): PalettePreset {
  return {
    ...preset,
    id: normalizePalettePresetId(preset.id),
    name: cleanName(preset.name),
    slots: preset.slots.map((slot) => normalizeSlot(slot, tileset)),
  };
}

function normalizeSlot(slot: PaletteSlot, tileset: TilesetDef): PaletteSlot {
  const tileIds = [...new Set(slot.tileIds)].filter((tile) => tile >= 0 && tile < tileset.count);
  return {
    role: slot.role,
    tileIds,
    ...(slot.weight === undefined ? {} : { weight: slot.weight }),
  };
}

function slotsField(record: JsonRecord, tileset: TilesetDef, required: boolean): PaletteSlot[] {
  if (record.slots === undefined) {
    if (required) throw new ToolError("신규 팔레트 프리셋에는 slots 배열이 필요합니다.", { code: "palette-preset-required" });
    return [];
  }
  if (!Array.isArray(record.slots)) throw new ToolError("preset.slots는 배열이어야 합니다.", { code: "palette-preset-invalid" });
  return record.slots.map((slot, index) => {
    const slotRecord = requireRecord(slot, `preset.slots[${index}]`);
    const role = slotRecord.role;
    if (!isPaletteSlotRole(role)) throw new ToolError(`preset.slots[${index}].role은 팔레트 role이어야 합니다.`, { code: "palette-role-invalid" });
    const tileIds = tileIdsField(slotRecord.tileIds, tileset, `preset.slots[${index}].tileIds`);
    const weight = slotRecord.weight === undefined ? undefined : numberField(slotRecord.weight, `preset.slots[${index}].weight`);
    if (weight !== undefined && weight <= 0) throw new ToolError(`preset.slots[${index}].weight는 0보다 커야 합니다.`, { code: "palette-weight-invalid" });
    return {
      role: role as PaletteSlotRole,
      tileIds,
      ...(weight === undefined ? {} : { weight }),
    };
  });
}

function tileIdsField(value: unknown, tileset: TilesetDef, label: string): number[] {
  if (!Array.isArray(value)) throw new ToolError(`${label}는 배열이어야 합니다.`, { code: "palette-tileids-invalid" });
  return value.map((entry) => {
    if (typeof entry !== "number" || !Number.isInteger(entry)) throw new ToolError(`${label}에는 정수 tile id만 넣을 수 있습니다.`, { code: "palette-tileids-invalid" });
    if (entry < 0 || entry >= tileset.count) throw new ToolError(`타일 인덱스 범위 밖: ${entry} (0~${tileset.count - 1})`, { code: "tile-out-of-range" });
    return entry;
  });
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new ToolError(`${label}는 객체여야 합니다.`, { code: "palette-preset-invalid" });
}

function stringField(record: JsonRecord, key: string, message: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) throw new ToolError(message, { code: "palette-preset-required" });
  return cleanName(value);
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function originField(value: unknown): "user" | "ai" | undefined {
  if (value === undefined) return undefined;
  if (value === "user" || value === "ai") return value;
  throw new ToolError("preset.origin은 user 또는 ai여야 합니다.", { code: "palette-origin-invalid" });
}

function booleanField(value: unknown, label: string): boolean {
  if (typeof value === "boolean") return value;
  throw new ToolError(`preset.${label}은 boolean이어야 합니다.`, { code: "palette-preset-invalid" });
}

function numberField(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new ToolError(`${label}는 숫자여야 합니다.`, { code: "palette-preset-invalid" });
}
