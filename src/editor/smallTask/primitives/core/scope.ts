import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { BUILTIN_EQUIPMENT_SLOTS } from "@/project/equipmentSlots";
import type { GameMap } from "@/project/types";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

const MAP_PROPERTY_FIELDS: readonly (keyof GameMap)[] = [
  "name", "tilesetId", "tileSize", "bgm", "background", "battleBackground",
  "disableSave", "disableTeleport", "disableEscape", "encounterRate", "loop", "cameraZoom", "characterScale", "mapRole",
];

/** Bind scopes returned by units to the host's selection before applying the operation. */
export function primitiveScope(
  ctx: PrimitiveContext, primitive: SmallTaskPrimitive, args: Record<string, unknown>,
): SmallTaskScope {
  const scope = primitive.scope(ctx, args);
  const { target } = ctx;
  if (scope.kind === "dbEntries" || scope.kind === "dbRemove") {
    const rows = scope.kind === "dbRemove" ? [scope] : scope.entries;
    if (target.kind !== "dbEntry" || rows.some(row => row.collection !== target.collection || row.id !== target.id)) {
      throw new PrimitiveError("범위 밖: 선택한 자료집 항목만 바꿀 수 있어요.");
    }
    if (scope.kind === "dbRemove" || scope.remove) {
      return { kind: "dbRemove", collection: target.collection, id: target.id };
    }
    if (scope.create?.collection === "equipmentSlots" && primitive.id === "db.equipmentSlots.update"
      && target.collection === "equipmentSlots" && BUILTIN_EQUIPMENT_SLOTS.some(slot => slot.id === target.id)) {
      return { ...scope, create: { ...scope.create, max: 1, ids: [target.id] } };
    }
  }
  if (scope.kind === "mapMeta" && scope.fields === undefined && scope.connections === undefined && scope.startPosition === undefined) {
    // Map structure units written against the original mapMeta contract can migrate one operation at a time.
    const { mapId } = scope;
    switch (primitive.id) {
      case "map.structure.remove": return { kind: "mapRemove", mapId };
      case "map.structure.resize": return { kind: "mapResize", mapId };
      case "map.connection.upsert": return { ...scope, fields: [], connections: "outgoing" };
      case "map.startPosition.set": return { ...scope, fields: [], connections: "none", startPosition: true };
      case "map.properties.set": return { ...scope, fields: MAP_PROPERTY_FIELDS, connections: "none" };
      case "map.encounterTable.set": return { ...scope, fields: ["encounterTable", "encounterRate", "troopIds"], connections: "none" };
      case "map.door.set": return { ...scope, fields: ["doors"], connections: "none" };
      case "map.location.create":
      case "map.location.update":
      case "map.location.delete":
        return { ...scope, fields: ["locations"], connections: "none" };
    }
  }
  if (scope.kind === "projectArea" && scope.fields === undefined && !scope.remove) {
    switch (primitive.id) {
      case "switch.rename":
      case "variable.rename":
      case "commonEvent.rename": return { ...scope, fields: ["name"] };
      case "ending.update": return { ...scope, fields: ["name", "priority", "conditions"] };
      case "quest.rename": return { ...scope, fields: ["title"] };
      case "quest.reward.set": return { ...scope, fields: ["rewards"] };
      case "commonEvent.trigger.set": return { ...scope, fields: ["trigger", "conditionSwitchId"] };
      case "commonEvent.command.insert":
      case "commonEvent.command.update":
      case "commonEvent.command.delete": return { ...scope, fields: ["commands"] };
      case "quest.remove":
      case "ending.remove":
      case "commonEvent.remove": return { ...scope, remove: true };
    }
  }
  return scope;
}
