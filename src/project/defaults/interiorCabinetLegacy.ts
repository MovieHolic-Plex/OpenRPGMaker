import type { SectionStructureKitDef } from "@/project/types";

/** Complete pre-upper-layer seed. Provenance alone never authorizes migration. */
export const LEGACY_INTERIOR_CABINET: SectionStructureKitDef = {
  id: "cabinet", kind: "section", name: "캐비닛", width: 1, height: 2,
  rows: [{ tiles: [148] }, { tiles: [178] }], learnedFrom: "interior-catalog",
  ai: { description: "", placementRules: "", snap: "wall-north", themes: ["bedroom", "dining"] },
};
