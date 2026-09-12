import { assert } from "../io/guards";
import type { ConceptBundleRecord, ConceptFacilityRecord, ConceptPlaceRecord, ConceptPlaceRole } from "../types/conceptBundle";
import type { SpatialRect } from "./types";

export type LegacyLayoutRoom = SpatialRect & {
  readonly place: ConceptPlaceRecord;
  readonly role: ConceptPlaceRole;
};
type Instance = Pick<LegacyLayoutRoom, "place" | "role">;
const sizes = { s: { width: 5, height: 3 }, m: { width: 7, height: 4 }, l: { width: 9, height: 5 } } as const;
export function legacyRoomRole(place: ConceptPlaceRecord): ConceptPlaceRole {
  return place.role ?? (place.id === "corridor" || /복도|통로|corridor|hall/i.test(place.label) ? "walkway" : "room");
}
export function legacyRoomSize(place: ConceptPlaceRecord): Pick<SpatialRect, "width" | "height"> {
  const box = sizes[place.size ?? "m"];
  const shape = place.shape ?? "rect";
  switch (shape) {
    case "rect": return box;
    case "l": case "alcove": return { width: box.width + 2, height: box.height + 3 };
    default: return unreachable(shape);
  }
}
function unreachable(value: never): never { throw new TypeError(`Unknown legacy layout variant: ${String(value)}`); }
function rowWidth(entries: readonly Instance[]): number {
  return entries.reduce((sum, entry) => sum + legacyRoomSize(entry.place).width, 0) + Math.max(0, entries.length - 1);
}
function rowHeight(entries: readonly Instance[]): number {
  return Math.max(0, ...entries.map(entry => legacyRoomSize(entry.place).height));
}
function placeRow(entries: readonly Instance[], rect: SpatialRect, bottom: boolean): LegacyLayoutRoom[] {
  let x = rect.x;
  return entries.map(entry => {
    const size = legacyRoomSize(entry.place);
    const room = { ...entry, ...size, x, y: rect.y + (bottom ? rect.height - size.height : 0) };
    x += size.width + 1;
    return room;
  });
}

/** One-shot translation of the legacy row grammar, not a new runtime layout engine.
 * Coordinates include the original wall gaps (horizontal 1, vertical 3) and margins.
 */
function rowLayout(entries: readonly Instance[], minWidth: number): LegacyLayoutRoom[] {
  const entrance = entries.find(entry => entry.role === "entrance");
  const walkway = entries.find(entry => entry.role === "walkway");
  const row = entries.filter(entry => entry !== entrance && entry !== walkway);
  const promoted = !entrance && !walkway ? row.pop() : undefined;
  const doorBand = entrance ?? promoted;
  const width = rowWidth(row);
  const height = rowHeight(row);
  const spread = !walkway && doorBand && row.length >= 2 ? 1 : 0;
  const doorWidth = doorBand ? sizes[doorBand.place.size ?? "m"].width + (doorBand.place.shape && doorBand.place.shape !== "rect" ? 4 : 0) : 0;
  const bandWidth = Math.max(width + spread * 2, doorWidth, entries.length > 0 ? 8 : 0, minWidth);
  const rooms = placeRow(row, { x: 2 + Math.floor((bandWidth - width) / 2), y: 3, width, height }, true);
  let y = 3 + height;
  for (const entry of [walkway, doorBand]) {
    if (!entry) continue;
    if (rooms.length > 0) y += 3;
    const baseHeight = entry === walkway ? 3 : sizes[entry.place.size ?? "m"].height;
    const bandHeight = baseHeight + (entry.place.shape && entry.place.shape !== "rect" ? 3 : 0);
    rooms.push({ ...entry, x: 2, y, width: bandWidth, height: bandHeight });
    y += bandHeight;
  }
  return rooms;
}

function doubleRowLayout(entries: readonly Instance[], minWidth: number): LegacyLayoutRoom[] {
  const only = entries.length === 1 ? entries[0] : undefined;
  if (only) return [{ ...only, ...legacyRoomSize(only.place), x: 2, y: 3 }];
  const entrance = entries.find(entry => entry.role === "entrance");
  const walkway = entries.find(entry => entry.role === "walkway");
  const rest = entries.filter(entry => entry !== entrance && entry !== walkway);
  const southOf = (entry: Instance) => entry.place.zone === "south" || (entry.place.zone === undefined && entry.role === "room" && /주방|창고|부엌|저장|kitchen|storage|pantry|cellar/i.test(`${entry.place.id}${entry.place.label}`));
  const north = rest.filter(entry => !southOf(entry));
  const south = rest.filter(southOf);
  const host = entrance ?? walkway ?? rest[rest.length - 1];
  const hall = entrance ?? (host?.role === "walkway" ? undefined : host);
  const split = Math.ceil(south.length / 2);
  const southBand = hall ? [...south.slice(0, split), hall, ...south.slice(split)] : south;
  const northWidth = rowWidth(north);
  const southWidth = rowWidth(southBand);
  const width = Math.max(northWidth, southWidth, 8, minWidth);
  const northHeight = rowHeight(north);
  const rooms = placeRow(north, { x: 2 + Math.floor((width - northWidth) / 2), y: 3, width: northWidth, height: northHeight }, true);
  const y = 3 + (north.length > 0 ? northHeight + 3 : 0);
  rooms.push({ ...(walkway ?? { place: { id: "_walkway", label: "복도", role: "walkway" }, role: "walkway" }), x: 2, y, width, height: 3 });
  rooms.push(...placeRow(southBand, { x: 2 + Math.floor((width - southWidth) / 2), y: y + 6, width: southWidth, height: rowHeight(southBand) }, false));
  return rooms;
}

export function legacyFacilityFloors(bundle: ConceptBundleRecord, facility: ConceptFacilityRecord) {
  const places = facility.placeIds.map(id => {
    const place = bundle.places.find(place => place.id === id);
    assert(place !== undefined, `bundle ${bundle.id}.facility ${facility.id}.placeIds: unknown place ${id}`);
    return place;
  });
  const levels = [...new Set(places.map(place => place.level ?? 1))].sort((a, b) => a - b);
  if (levels.length === 0) levels.push(1);
  const instances = (level: number): Instance[] => places.filter(place => (place.level ?? 1) === level)
    .flatMap(place => Array.from({ length: place.count ?? 1 }, () => ({ place, role: legacyRoomRole(place) })));
  const layout = (level: number, minWidth: number) => {
    const entries = instances(level);
    const kind = facility.layout ?? "row";
    switch (kind) {
      case "row": {
        const rooms = rowLayout(entries, minWidth);
        return rooms.length > 0 ? rooms : [{ place: { id: facility.id, label: facility.label }, role: "room" as const, x: 2, y: 3, ...sizes.m }];
      }
      case "double-row": return doubleRowLayout(entries, minWidth);
      // wing 은 레거시 도면 문법에 없다 — import 경계(legacyImport 의 layout assert)가
      // 먼저 거절하므로 여기까지 오면 경계를 우회한 호출이다.
      case "wing": return unreachable(kind as never);
      default: return unreachable(kind);
    }
  };
  const minWidth = levels.length > 1 ? Math.max(0, ...levels.flatMap(level => layout(level, 0).filter(room => room.role !== "room").map(room => room.width))) : 0;
  return levels.map(level => ({ level, rooms: layout(level, minWidth) }));
}
