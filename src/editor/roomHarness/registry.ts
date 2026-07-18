/** Room Harness 킷 레지스트리 — 새 하네스는 여기 한 곳에 등록한다. */
import { DUNGEON_ROOM_KIT } from "./dungeonKit";
import { INTERIOR_ROOM_KIT } from "./interiorKit";
import type { RoomHarnessKit } from "./types";

export const ROOM_HARNESS_KITS: Record<string, RoomHarnessKit> = {
  [INTERIOR_ROOM_KIT.kitId]: INTERIOR_ROOM_KIT as RoomHarnessKit,
  [DUNGEON_ROOM_KIT.kitId]: DUNGEON_ROOM_KIT as RoomHarnessKit,
};

export function getRoomKit(kitId: string): RoomHarnessKit | undefined {
  return ROOM_HARNESS_KITS[kitId];
}

export function listRoomKitIds(): string[] {
  return Object.keys(ROOM_HARNESS_KITS);
}
