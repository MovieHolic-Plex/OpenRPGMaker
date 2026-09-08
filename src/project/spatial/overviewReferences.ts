import { assert } from "../io/guards";
import { isOwnedSpatialBinding } from "./bindings";
import { findOccurrenceChildId, own } from "./domain";
import { hasOverviewRouteRepresentation, overviewDesign, overviewEntryAuthorized, spatialEventOwner, spatialPortLanding } from "./overview";
import type * as S from "./types";

export function validateOverviewEntries(document: S.SpatialAuthoringDocument, assets: S.SpatialAssetContext): void {
  const sourceCells = new Set<string>();
  const landingCells = new Set<string>();
  for (const occurrence of Object.values(document.occurrences)) {
    const overviews = occurrence.bindings.filter(isOwnedSpatialBinding).filter(binding => binding.overviewEntries !== undefined);
    assert(overviews.length <= 1, `occurrences.${occurrence.id}.overviewEntries: multiple overview rectangles`);
    for (const binding of overviews) {
      const path = `occurrences.${occurrence.id}.overviewEntries`;
      const design = overviewDesign(occurrence);
      assert(binding.rect.width === design.terrain.width && binding.rect.height === design.terrain.height, `${path}.rect: terrain extent mismatch`);
      for (const link of document.connections) if (hasOverviewRouteRepresentation(occurrence, binding, link)) {
        assert(binding.connectionIds.includes(link.id), `${path}.connectionIds: omitted represented route ${link.id}`);
      }
      const authorized = overviewEntryAuthorized(document, occurrence, binding);
      const targets = new Set<string>();
      for (const entry of binding.overviewEntries ?? []) {
        const target = own(document.occurrences, entry.target.occurrenceId);
        assert(target.parentId === occurrence.id && target.parentSlot !== undefined && target.parentSlot !== null &&
          findOccurrenceChildId(document, occurrence.id, target.parentSlot) === target.id, `${path}.target: expected associated direct child`);
        const key = JSON.stringify([target.id, entry.target.portId]);
        assert(!targets.has(key), `${path}.target: duplicate marker`);
        targets.add(key);
        assert(authorized(entry), `${path}.target: unauthorized entry`);
        assert(Number.isSafeInteger(entry.x) && Number.isSafeInteger(entry.y) && entry.x === binding.rect.x + target.x && entry.y === binding.rect.y + target.y &&
          entry.x >= binding.rect.x && entry.y >= binding.rect.y && entry.x < binding.rect.x + binding.rect.width && entry.y < binding.rect.y + binding.rect.height,
        `${path}.position: expected placed child inside owner`);
        const landing = spatialPortLanding(document, entry.target);
        assert(landing !== undefined && landing.mapId !== binding.mapId, `${path}.target: expected unique cross-map landing`);
        const sourceKey = JSON.stringify([binding.mapId, entry.x, entry.y]);
        const landingKey = JSON.stringify([landing.mapId, landing.x, landing.y]);
        assert(!sourceCells.has(sourceKey), `${path}.position: coincident automatic markers`);
        assert(!landingCells.has(landingKey), `${path}.target: coincident automatic returns`);
        sourceCells.add(sourceKey);
        landingCells.add(landingKey);
        assert(binding.eventIds.includes(entry.eventId), `${path}.eventId: missing entering ownership`);
        const event = own(assets.maps, binding.mapId).events.find(event => event.id === entry.eventId);
        assert(event !== undefined && event.x === entry.x && event.y === entry.y, `${path}.eventId: marker position mismatch`);
        const reverse = own(assets.maps, landing.mapId).events.find(event => event.id === entry.returnEventId);
        assert(reverse !== undefined && reverse.x === landing.x && reverse.y === landing.y, `${path}.returnEventId: landing mismatch`);
        assert(spatialEventOwner(document, { mapId: landing.mapId, eventId: entry.returnEventId }) !== undefined, `${path}.returnEventId: missing reverse ownership`);
      }
    }
  }
}
