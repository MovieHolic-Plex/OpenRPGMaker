import { isSpatialOrientation, SPATIAL_LEVEL_LIMIT, SPATIAL_PLACEMENT_LIMIT } from "@/project/spatialPlacements";
import type { HomeDecorationPlacement } from "@/project/types";
import type { FarmBuildingPlacementState, HomeDecorationPlacementState } from "@/project/session";
import { isDecorationRecoveryItem, isSpatialPaymentReceipt } from "@/project/lifeRecovery";

export function parseFarmBuildingPlacementRecord(value: unknown): Record<string, FarmBuildingPlacementState> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, FarmBuildingPlacementState> = Object.create(null);
  for (const [key, raw] of Object.entries(value).slice(0, SPATIAL_PLACEMENT_LIMIT)) {
    const base = parseBasePlacement(key, raw);
    if (!base || !isRecord(raw) || !Number.isSafeInteger(raw.level) || (raw.level as number) < 1 || (raw.level as number) > SPATIAL_LEVEL_LIMIT) continue;
    if (raw.paymentReceipt !== undefined && !isSpatialPaymentReceipt(raw.paymentReceipt)) continue;
    result[key] = { ...base, level: raw.level as number,
      ...(raw.paymentReceipt !== undefined ? { paymentReceipt: structuredClone(raw.paymentReceipt) } : {}) };
  }
  return result;
}

export function parseHomeDecorationPlacementRecord(value: unknown): Record<string, HomeDecorationPlacementState> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, HomeDecorationPlacementState> = {};
  for (const [key, raw] of Object.entries(value).slice(0, SPATIAL_PLACEMENT_LIMIT)) {
    const base = parseBasePlacement(key, raw);
    if (!base || !isRecord(raw)) continue;
    if (raw.recoveryItem !== undefined && !isDecorationRecoveryItem(raw.recoveryItem)) continue;
    result[key] = { ...base, ...(raw.recoveryItem !== undefined ? { recoveryItem: structuredClone(raw.recoveryItem) } : {}) };
  }
  return result;
}

function parseBasePlacement(instanceId: string, value: unknown): HomeDecorationPlacement | undefined {
  if (!isRecord(value)
    || typeof value.instanceId !== "string"
    || value.instanceId !== instanceId
    || !instanceId.trim()
    || typeof value.typeId !== "string"
    || !value.typeId.trim()
    || typeof value.mapId !== "string"
    || !value.mapId.trim()
    || !Number.isSafeInteger(value.x)
    || !Number.isSafeInteger(value.y)
    || !isSpatialOrientation(value.orientation)) return undefined;
  return {
    instanceId,
    typeId: value.typeId,
    mapId: value.mapId,
    x: value.x as number,
    y: value.y as number,
    orientation: value.orientation,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
