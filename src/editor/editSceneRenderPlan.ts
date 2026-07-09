import type { ProjectChangeCell, ProjectChangeDescriptor } from "@/project/store";
import type { MapId } from "@/project/types";

export type EditSceneRenderPlan =
  | { readonly kind: "skip" }
  | { readonly kind: "full" }
  | { readonly kind: "cells"; readonly cells: readonly ProjectChangeCell[] };

export function planEditSceneRenderForStoreChange(input: {
  readonly change: ProjectChangeDescriptor;
  readonly currentMapId: MapId | null;
  readonly canIncrementalCells: boolean;
}): EditSceneRenderPlan {
  const { change, currentMapId } = input;
  if (change.scope === "database" || change.scope === "system") return { kind: "skip" };
  if (change.scope !== "map") return { kind: "full" };
  if (change.mapId !== currentMapId) return { kind: "skip" };
  if (change.cells?.length && input.canIncrementalCells) return { kind: "cells", cells: change.cells };
  return { kind: "full" };
}
