import type { SpatialCompiledBinding, SpatialId, SpatialOccurrence, SpatialOwnedBinding } from "./types";

/** Only this variant authorizes raster/event cleanup or owns connection bookkeeping. */
export function isOwnedSpatialBinding(binding: SpatialCompiledBinding): binding is SpatialOwnedBinding {
  switch (binding.kind) {
    case undefined: return true;
    case "projection": return false;
    default: return assertNever(binding);
  }
}
/** Bookkeeping evidence only: the exact persisted port projects into this raster owner.
 * Neither ancestry nor the projection extent grants artifact erasure rights.
 */
export function hasProjectedSpatialPort(occurrence: SpatialOccurrence, owner: SpatialOwnedBinding, portId: SpatialId): boolean {
  const rect = owner.rect;
  return occurrence.bindings.some(binding => !isOwnedSpatialBinding(binding) && binding.mapId === owner.mapId &&
    binding.ports.some(port => port.portId === portId && port.x >= rect.x && port.y >= rect.y &&
      port.x < rect.x + rect.width && port.y < rect.y + rect.height));
}
function assertNever(value: never): never { throw new TypeError(`Unreachable spatial binding variant: ${String(value)}`); }
