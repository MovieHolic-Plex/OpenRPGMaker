// 목적표가 지은 방 — 역할 건물(가게·여관·궁전…)에 청사진이 방을 적지 않았으면 그 역할의 실내 종류로 방을 짓고 그 문에 잇는다.
// 왜: 역할 건물은 들어갈 수 있어야 역할이다(문만 있는 가게는 예전의 빈 집 줄과 같다). 청사진의 장소 수(최대 12)는 이야기의 것이라, 가게 안·여관 안은
// 빌더가 맡아 짓고 세지 않는다(programMark.ts). 가게 주인·여관 주인은 끝맺음(story/healingAccess.ts)이 이 방 안에 세운다.
// 방 종류가 없는 역할(사막의 살림집)은 짓지 않는다 — 덮지 않고 빈칸으로 적는다(program.ts programGaps).
import type { BuildRun } from "../shared/types";
import { composeWorldRoom } from "./builders/worldPlace";
import { roleDoors, roomBehind, type RoleDoor } from "./program";
import { programRoomTags } from "./programMark";
import type { WorldKind, WorldSetting } from "./world";
import { yieldToLoop } from "../shared/yieldLoop";

/** 그 역할의 실내 종류 — 세계 표의 실내 종류(같은 구성기 값)를 먼저, 없으면 목적표 전용 방 크기(가게)로. */
export function programRoomKindOf(world: WorldSetting, role: string): WorldKind | undefined {
  const decl = world.program?.decl.roles[role];
  if (!decl?.room) return undefined;
  const listed = world.kinds.find((k) => k.indoor && k.compose?.value === decl.room);
  if (listed) return listed;
  const size = world.program?.rooms?.[decl.room];
  return size ? { id: decl.room, ko: decl.ko, about: "", indoor: true, compose: { value: decl.room, size, ...(world.program?.roomTool ? { tool: world.program.roomTool } : {}) } } : undefined;
}

const seedOf = (text: string): number => Math.abs([...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 9000 + 1;

/**
 * 이 프로젝트의 모든 역할 건물을 돌며, 실내 종류가 있는데 아직 아무 방도 달리지 않은 문에 방을 지어 잇는다. 되풀이 안전(문에 이동이 있으면 건너뛴다).
 * link = 부모 맵의 문 앞 칸과 새 방의 들어오는 칸을 잇는 일(build_places 의 잇기와 같은 길 — tools/context.ts linkChild).
 */
export async function layProgramRooms(run: BuildRun, world: WorldSetting, link: (parentMapId: string, name: string, roomMapId: string, entrance: { x: number; y: number }, door: { x: number; y: number; kit?: string }) => string): Promise<string[]> {
  const notes: string[] = [];
  const pending: { hostId: string; door: RoleDoor }[] = [];
  for (const map of Object.values(run.ctx.project.maps)) for (const door of roleDoors(run.ctx.project, map)) if (!roomBehind(map, door)) pending.push({ hostId: map.id, door });
  for (const { hostId, door } of pending) {
    // 방 하나를 짓고 나면 루프에 차례를 준다 — 방 여럿을 한 번에 지으면 그 합만큼 워커가 말이 없다.
    await yieldToLoop();
    const kind = programRoomKindOf(world, door.role);
    const host = run.ctx.project.maps[hostId];
    if (!kind || !host) continue;
    const taken = new Set(Object.values(run.ctx.project.maps).map((m) => m.name));
    let name = `${host.name} ${kind.ko}`;
    for (let n = 2; taken.has(name); n++) name = `${host.name} ${kind.ko} ${n}`;
    const made = composeWorldRoom(run, world, kind, name, seedOf(`${host.name}|${door.need}`));
    if ("error" in made) { notes.push(`「${name}」 방을 짓지 못했다: ${made.error.slice(0, 120)}`); continue; }
    const room = run.ctx.project.maps[made.mapId]!;
    // 빌더의 방이라는 표시는 여기서 한 번.
    run.call("create_map_location", { mapId: room.id, name: kind.ko, x: 0, y: 0, w: room.width, h: room.height, note: `목적표가 지은 방 — 「${host.name}」의 ${door.label}`, tags: programRoomTags(door.role, kind.compose!.value) });
    const how = link(hostId, name, room.id, made.entrance, { x: door.front.x, y: door.front.y, kit: door.kit });
    notes.push(`「${name}」(${kind.compose!.value} ${room.width}×${room.height}) 지음 — ${how}`);
  }
  return notes;
}
