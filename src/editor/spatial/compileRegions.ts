import { designNode } from "@/project/spatial/domain";
import { compositionOf } from "@/project/spatial/composition";
import { compileMixedComposition } from "./compileMixedComposition";
import { compileGeography } from "./compileGeography";
import { compilePlaces } from "./compilePlaces";
import type { SpatialCompileContext } from "./compilerTypes";

/** Frozen region terrain and authored polylines over real compiled places. */
export function compileRegions(context: SpatialCompileContext) {
  if (compositionOf(designNode(context.occurrence.snapshot.library, context.occurrence.source))) return compileMixedComposition(context);
  return compileGeography(context, compilePlaces);
}
