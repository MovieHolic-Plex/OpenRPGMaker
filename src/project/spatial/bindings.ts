import type { SpatialCompiledBinding, SpatialOwnedBinding } from "./types";

/** Only this variant authorizes raster/event cleanup or owns connection bookkeeping. */
export function isOwnedSpatialBinding(binding: SpatialCompiledBinding): binding is SpatialOwnedBinding {
  switch (binding.kind) {
    case undefined: return true;
    case "projection": return false;
    default: return assertNever(binding);
  }
}
function assertNever(value: never): never { throw new TypeError(`Unreachable spatial binding variant: ${String(value)}`); }
