import type { SpatialGalleryCard } from "./spatialCatalog";
import {
  openPlacedSpatialDestination, openSpatialDestination, pushSpatialBreadcrumb,
  selectSpatialDesign, selectSpatialOccurrence, spatialSession, patchSpatialSession,
} from "./spatialAuthoringSession";

/** Unified lists retain each record's editor and identity, including frozen placements. */
export function selectSpatialGalleryEntry(card: SpatialGalleryCard): void {
  if (card.kind !== spatialSession().tab) {
    pushSpatialBreadcrumb();
    if (card.source === "placed") {
      openPlacedSpatialDestination({ tab: card.kind, mode: "instances", occurrenceId: card.id });
    } else {
      patchSpatialSession({ tab: card.kind, mode: "design", source: "all", legacyOrigin: null });
      openSpatialDestination(card.kind, card.id);
    }
  } else if (card.source === "placed") selectSpatialOccurrence(card.id);
  else selectSpatialDesign(card.id);
}
