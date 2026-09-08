import { compileGeography } from "./compileGeography";
import { compilePlaces } from "./compilePlaces";
import type { SpatialCompileContext } from "./compilerTypes";

/** Frozen region terrain and authored polylines over real compiled places. */
export function compileRegions(context: SpatialCompileContext) {
  return compileGeography(context, compilePlaces);
}
