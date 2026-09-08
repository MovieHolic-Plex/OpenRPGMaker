import { footprintBounds, normalizeCharacterFootprint, pointRect, rectsOverlap } from "../footprint";
import { assert } from "../io/guards";
import type { MapConnection, Project } from "../types";
import { isOwnedSpatialBinding } from "./bindings";
import { own } from "./domain";
import { spatialPortLanding } from "./overview";
import { validateSpatialReferences } from "./references";
import type { SpatialAuthoringDocument } from "./types";

type TransferPair = { readonly id: string; readonly from: MapConnection["from"]; readonly to: MapConnection["to"] };
/** Generated automatic pairs have exactly one unconditional, fixed transfer page. No first-command/page inference. */
function validatePair(project: Project, pair: TransferPair): void {
  const path = `spatialAuthoring.overviewEntries.${pair.id}`;
  const map = own(project.maps, pair.from.mapId);
  const matches = map.events.filter(event => event.id === pair.id);
  const event = matches[0];
  assert(matches.length === 1 && event !== undefined && event.x === pair.from.x && event.y === pair.from.y, `${path}.event: missing exact source`);
  assert(event.draft === undefined && event.condition === undefined, `${path}.event: expected committed unconditional event`);
  const page = event.pages?.[0];
  assert(event.commands.length === 0 && event.pages?.length === 1 && page !== undefined && page.conditions.length === 0 &&
    page.trigger.kind === "playerTouch" && page.priority === "below" && page.movement.type === "fixed" && !page.overlapForbidden &&
    (page.footprint === undefined || page.footprint.width === 1 && page.footprint.height === 1),
  `${path}.page: expected unconditional automatic transfer`);
  const command = page.commands[0];
  assert(page.commands.length === 1 && command?.kind === "transfer" && command.mapId === pair.to.mapId && command.x === pair.to.x && command.y === pair.to.y &&
    (command.direction === undefined || command.direction === "retain"), `${path}.commands: transfer mismatch`);
  const connections = project.mapConnections?.filter(connection => connection.id === pair.id) ?? [];
  const connection = connections[0];
  assert(connections.length === 1 && connection !== undefined && connection.playerEnabled && connection.npcEnabled &&
    connection.from.mapId === pair.from.mapId && connection.from.x === pair.from.x && connection.from.y === pair.from.y &&
    connection.to.mapId === pair.to.mapId && connection.to.x === pair.to.x && connection.to.y === pair.to.y &&
    connection.from.direction === undefined && connection.to.direction === undefined && connection.name === undefined,
  `${path}.mapConnection: missing exact enabled projection`);
  // Any automatic page may become effective as session conditions change. Touch uses the body, not the origin or passage rows.
  assert(!map.events.some(candidate => candidate.id !== pair.id &&
    (candidate.pages?.length ? candidate.pages : [{ trigger: candidate.trigger, footprint: undefined }]).some(page =>
      ["playerTouch", "touch", "eventTouch", "auto"].includes(page.trigger.kind) &&
      rectsOverlap(footprintBounds(candidate.x, candidate.y, normalizeCharacterFootprint(page.footprint)), pointRect(pair.from.x, pair.from.y)))),
    `${path}.event: competing automatic event`);
  assert(!project.mapConnections?.some(candidate => candidate.id !== pair.id && candidate.from.mapId === pair.from.mapId &&
    candidate.from.x === pair.from.x && candidate.from.y === pair.from.y), `${path}.mapConnection: competing source`);
}
/** Full project boundary only. The domain context intentionally has no mapConnections. */
export function validateSpatialProject(document: SpatialAuthoringDocument, project: Project): void {
  validateSpatialReferences(document, project);
  for (const occurrence of Object.values(document.occurrences)) for (const binding of occurrence.bindings.filter(isOwnedSpatialBinding)) {
    for (const entry of binding.overviewEntries ?? []) {
      const landing = spatialPortLanding(document, entry.target);
      assert(landing !== undefined, `spatialAuthoring.overviewEntries.${entry.eventId}.target: missing landing`);
      const marker = { mapId: binding.mapId, x: entry.x, y: entry.y };
      validatePair(project, { id: entry.eventId, from: marker, to: landing });
      validatePair(project, { id: entry.returnEventId, from: landing, to: marker });
    }
  }
}
