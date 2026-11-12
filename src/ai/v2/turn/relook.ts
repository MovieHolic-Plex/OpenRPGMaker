// 비평가가 본 그림이 낡았으면 다시 본다 — 비평은 짓기·다시 짓기 때만 돌아, 다시 짓지 않는 도구로 고친 맵의 옛 지적을 끝맺음 관문이 항목으로 되풀이했다.
// 판정을 풀지 않는다: 지금 그림을 같은 비평가에게 다시 보인다.
import type { PiAssistantV2Env } from "../shared/env";
import { renderMap, see } from "../tools/support";
import type { V2Session } from "./session";

/** 맵 하나를 한 턴에 다시 보는 횟수 — 모델이 맵을 계속 바꿔도 비평 호출이 끝없이 늘지 않게. */
const RELOOK_MAX = 2;

/** 비평 지적이 남은 장소 가운데 그림이 달라진 맵을 다시 본다(기계 검사 + 비평가). 돌려주는 값: 기록에 남길 줄. */
export async function relookChangedPlaces(env: PiAssistantV2Env, session: V2Session): Promise<string[]> {
  const notes: string[] = [];
  for (const [mapId, record] of [...session.places]) {
    const seen = session.seen.get(mapId);
    const map = env.ctx.project.maps[mapId];
    if (!seen || !map || !seen.critics.some((v) => v.mapId === mapId && (v.majors.length > 0 || !!v.problem))) continue;
    if ((session.relooks.get(mapId) ?? 0) >= RELOOK_MAX) continue;
    const was = seen.images.find((i) => i.mapId === mapId)?.dataUrl;
    const now = was ? await renderMap(env, mapId) : undefined;
    if (!was || !now || now === was) continue;
    session.relooks.set(mapId, (session.relooks.get(mapId) ?? 0) + 1);
    const again = await see(env, session, String(env.request.task ?? ""), record.spec.type, [mapId], record.result.entrance, true);
    const before = seen.critics.filter((v) => v.mapId === mapId).reduce((n, v) => n + v.majors.length, 0);
    const after = again.critics.reduce((n, v) => n + v.majors.length, 0);
    // 같은 짓기의 다른 층 기록은 그대로 두고 이 맵 것만 갈아 끼운다.
    const merged = {
      checks: [...seen.checks.filter((c) => c.mapId !== mapId || !again.checks.some((n) => n.id === c.id)), ...again.checks],
      critics: [...seen.critics.filter((v) => v.mapId !== mapId), ...again.critics],
      images: [...seen.images.filter((i) => i.mapId !== mapId), ...again.images],
    };
    for (const id of record.result.mapIds) if (session.seen.get(id) === seen) session.seen.set(id, merged);
    notes.push(`「${map.name ?? mapId}」 그림이 비평 뒤에 바뀌어 다시 봄 — 비평 major ${before} → ${after}`);
  }
  return notes;
}
