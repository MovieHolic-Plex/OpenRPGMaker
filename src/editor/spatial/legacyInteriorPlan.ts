import { checkedDocument, own } from "@/project/spatial/domain";
import { choice } from "@/project/spatial/guardValues";
import { CONCEPT_FLOOR_MATERIALS } from "@/project/types/conceptBundle";
import type { Project } from "@/project/types";
import { CONCEPT_FLOOR_TILES, type ConceptOverlayRoom } from "../conceptBundleResolve";
import type { InteriorRoomPlan, RoomSpec } from "../interiorRoomPipeline";
import { ToolError } from "../tools/types";
import { canonicalRoomAlias } from "./legacyConcepts";

/** Compatibility rooms keep caller geometry; selections/chips come only from the active library. */
export function bindCanonicalInteriorPlan(plan: InteriorRoomPlan, project: Project): InteriorRoomPlan {
  const document = checkedDocument(project.spatialAuthoring, project);
  const sourceRooms: readonly RoomSpec[] = plan.rooms?.length ? plan.rooms : plan.wings.map((wing, index) => ({ ...wing, id: `room_${index + 1}`, theme: plan.theme }));
  const overlay: Record<string, ConceptOverlayRoom> = {};
  const rooms = sourceRooms.map(room => {
    const space = canonicalRoomAlias(project, room.theme ?? plan.theme, plan.tilesetId ?? "easyrpg_chipset_interior");
    if (!space || space.environment !== "interior") throw new ToolError(`Canonical space not found: ${room.theme ?? plan.theme}`, { code: "concept-place-not-found" });
    if (space.tilesetId !== (plan.tilesetId ?? "easyrpg_chipset_interior")) throw new ToolError(`Unsupported atlas: ${space.tilesetId}`, { code: "spatial-atlas" });
    const things = space.objectSlots.flatMap(slot => {
      const object = own(document.library.objects, slot.objectDesignId);
      if (object.graphic.tilesetId !== space.tilesetId) throw new ToolError(`Unsupported object atlas: ${object.id}`, { code: "spatial-atlas" });
      return Array.from({ length: slot.quantity }, (_, index) => ({ thingId: `${slot.id}/${index}`, objectId: object.graphic.kitId,
        label: object.name, chips: [...slot.chipOverrides ?? object.chips], required: slot.required }));
    });
    overlay[room.id] = { placeId: space.id, placeLabel: space.name, role: space.role, things };
    return { ...room, floorTile: room.floorTile ?? plan.floorTile ?? CONCEPT_FLOOR_TILES[choice(CONCEPT_FLOOR_MATERIALS)(space.floor, `${space.id}.floor`)] };
  });
  return { ...plan, rooms, concept: { bundleId: "canonical", facilityId: "canonical", facilityLabel: plan.name, rooms: overlay } };
}
