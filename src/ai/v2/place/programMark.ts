// 목적표가 지은 방의 표시 — 청사진에 없는 방(가게·여관 안)을 빌더가 지었다는 사실 하나를 맵에 적고 읽는다.
// 표시는 방을 지을 때 한 번(programRooms.ts): 방 맵의 로케이션 꼬리표 program-room + room:<방 종류>. 세는 맵(judge/mapCount)과 검수 그림 예산(judge/vqa)이 이것만 읽는다 —
// 목적표가 지은 방은 빌더의 것이라 세지 않고, 그림은 방 종류마다 한 장만(예산이 남을 때) 본다. 닿는지·문·양쪽 이음 같은 모델 없는 검사는 다른 맵과 똑같이 받는다.
import { PROGRAM_ROOM_TAG } from "@/project/settlementProgram";
import type { Project } from "@/project/types";

const ROOM_KIND_TAG = "room:";
export const programRoomTags = (role: string, roomKind: string): string[] => [PROGRAM_ROOM_TAG, `role:${role}`, `${ROOM_KIND_TAG}${roomKind}`];

/** 목적표가 지은 방인가. */
export function isProgramRoom(project: Pick<Project, "maps">, mapId: string): boolean {
  return (project.maps[mapId]?.locations ?? []).some((l) => (l.tags ?? []).includes(PROGRAM_ROOM_TAG));
}
/** 목적표가 지은 방의 종류(구성기의 방 kind). 목적표가 지은 방이 아니면 undefined. */
export function programRoomKind(project: Pick<Project, "maps">, mapId: string): string | undefined {
  for (const l of project.maps[mapId]?.locations ?? []) if ((l.tags ?? []).includes(PROGRAM_ROOM_TAG)) return (l.tags ?? []).find((t) => t.startsWith(ROOM_KIND_TAG))?.slice(ROOM_KIND_TAG.length) ?? "";
  return undefined;
}
