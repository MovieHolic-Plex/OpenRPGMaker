// 낱말 없는 마을이 구성기 세계로 지어진 뒤 make_place 가 그 세계의 실내 종류로 지은 방을, 이번 요청에 지은 그 세계 바깥 장소의 집 문에 단다.
// make_game · 끝맺음 자동 짓기와 같은 잇기(linkChild: 집 문 → 문 그림·길 끝 → 이동 칸)를 쓴다.
import type { PlaceBuildResult, PlaceRecord, PlaceSpec } from "../shared/types";
import { pickWorldDoor, type WorldKind, type WorldSetting } from "../place/world";
import { isOutdoor, villageDoors } from "../story/makeGame";
import { transfersOut } from "../judge/todoCheckFacts";
import type { VerbContext } from "./context";

/** 돌려주는 값: make_place 결과 글에 붙일 영어 한 문장(이어졌으면 두 문의 칸, 못 이었으면 그 까닭). */
export function linkWorldRoom(c: Pick<VerbContext, "env" | "session" | "linkChild">, world: WorldSetting, kind: WorldKind, spec: PlaceSpec, built: PlaceBuildResult): string {
  const { env, session, linkChild } = c;
  const room = built.mapIds[0];
  if (!room) return "";
  const outdoors = [...session.pastPlaces.entries(), ...session.places.entries()]
    .filter(([id, r]) => r.result.mapIds[0] === id && id !== room && isOutdoor(r.spec) && env.ctx.project.maps[id]?.tilesetId === world.tilesetId).reverse();
  const freeDoors = (id: string, r: PlaceRecord) => {
    const used = new Set((env.ctx.project.maps[id]?.events ?? []).map((e) => `${e.x},${e.y + 1}`));
    return villageDoors(r.result).filter((d) => !used.has(`${d.x},${d.y}`));
  };
  // 그 종류의 문이 남은 바깥 장소 → 문이 남은 바깥 장소 → 마지막 바깥 장소(문 목록이 없으면 linkChild 가 문 그림·길 끝을 고른다).
  const host = (kind.door ? outdoors.find(([id, r]) => freeDoors(id, r).some((d) => kind.door!.test(d.kit ?? ""))) : undefined) ?? outdoors.find(([id, r]) => freeDoors(id, r).length > 0) ?? outdoors[0];
  if (!host) return " It is not linked to another map yet: no outdoor place of this world was built to hang its door on.";
  const [hostId, rec] = host;
  linkChild(hostId, rec.spec, rec.result, spec, built, undefined, pickWorldDoor(world, kind, freeDoors(hostId, rec)));
  const hostMap = env.ctx.project.maps[hostId], roomMap = env.ctx.project.maps[room];
  const into = hostMap ? transfersOut(hostMap).find((x) => x.to.mapId === room) : undefined;
  const back = roomMap ? transfersOut(roomMap).find((x) => x.to.mapId === hostId) : undefined;
  return into && back
    ? ` It is linked both ways with «${hostMap!.name ?? hostId}» (${hostId}): the door at (${into.ev.x},${into.ev.y}) there leads to (${into.to.x},${into.to.y}) in this room, and the exit at (${back.ev.x},${back.ev.y}) here leads back to (${back.to.x},${back.to.y}).`
    : ` It is not linked with «${hostMap?.name ?? hostId}» yet: no door of that map could be joined to this room.`;
}
