import { compileGeography } from "./compileGeography";
import { compileRegions } from "./compileRegions";
import type { SpatialCompileContext } from "./compilerTypes";

/** World crossings use bounded horizontal-then-vertical paths and explicit entry intent. */
export function compileWorlds(context: SpatialCompileContext) {
  return compileGeography(context, compileRegions);
}
