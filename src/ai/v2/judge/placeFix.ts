// «이 장소를 고쳐라» 에 붙이는 동사 — 그 맵을 지은 빌더·칩셋이 실제로 받는 것만 이른다(안 받는 동사를 이르면 거절만 쌓인다).
import { roomSpecOf } from "@/editor/handInterior/builder";
import type { Project } from "@/project/types";
import { V2Session } from "../turn/session";

/** 끝맺음 관문이 «이 장소를 고쳐라»에 붙이는 동사 — 그 맵을 지은 빌더가 받는 것만 이른다(안 받는 동사를 이르면 거절만 쌓인다). */
/** 그 맵의 칩셋에 방 짓기 역할표(roomKit)가 있나 — move_object·dress_room 이 듣는 맵(손 도트 실내·일본·마법 학교·에도·캠퍼스·고딕·현대 도시 방). */
export const hasRoomKit = (project: Project, mapId: string): boolean => !!roomSpecOf(project.tilesets[project.maps[mapId]?.tilesetId ?? ""]);

export function placeFixVerbs(session: V2Session, project: Project | undefined, mapId: string): string {
  const builder = session.places.get(mapId)?.builder;
  if (builder === "world") return "구성기가 한 번에 깐 세계 맵이라 다시 짓지 않는다: 이벤트는 move_event, 소품은 stamp_object, 못 고치면 보고";
  if (project ? hasRoomKit(project, mapId) : builder === "interior") return "장소는 edit_place·move_object(설계하지 않은 방의 빈 바닥만 dress_room)";
  return "장소는 edit_place(소품 하나는 stamp_object)";
}
