import { sharedPlaceSummaries } from "../../sharedContent";
// Card list for the Places gallery. Full rasters stay in reviewedPlaceCatalog
// and load only when a place is copied or its map is compiled.
export type ReviewedPlaceSummary = {
  readonly id: string;
  readonly name: string;
  readonly kind: "facility" | "settlement" | "natural";
  readonly tags: readonly string[];
  readonly tilesetId: string | null;
};

// 2026-10-07 사용자 결정(저작권): 번들 검수 장소는 전부 지웠다. 공용 DB 장소(sharedPlaceSummaries)만 남는다.
export const REVIEWED_PLACE_INDEX: readonly ReviewedPlaceSummary[] = [];

export function reviewedPlaceIndex(): readonly ReviewedPlaceSummary[] {
  const entries = new Map(REVIEWED_PLACE_INDEX.map(p => [p.id, p]));
  for (const p of sharedPlaceSummaries()) entries.set(p.id, p);
  return [...entries.values()];
}

export function reviewedPlaceSummary(id: string): ReviewedPlaceSummary | undefined {
  return reviewedPlaceIndex().find(place => place.id === id);
}
