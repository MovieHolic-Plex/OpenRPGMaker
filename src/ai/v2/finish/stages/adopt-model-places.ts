// 청사진 장소 이름이 모델이 지은 맵과 어긋나면(모델이 장소를 지으며 맵 이름을 바꿨다) 함수가 새로 짓지 않고 모델이 지은 맵을 그 장소로 잇는다.
//
// 왜(2026-10-29 vm8 flash 방탈출): 모델이 시작 맵에 「escape_room」(11×10 서재)을 지었는데 청사진 장소는 옛 맵 이름 그대로였다 —
// 장소 자동 짓기가 그 장소를 «없다»고 보고 견본 거실 9×10 을 새로 지었고, 방탈출 봉인이 모델 방으로 들어가는 이동을 지워 시작이 견본 방으로 옮겨졌다.
// 모델이 지은 방은 버리지 않는다: 아직 어느 청사진 장소도 가리키지 않는 모델 장소가 있으면(실내/바깥이 이름과 어긋나지 않는 것), 그 맵을 장소로 삼는다.
import type { FinishStage } from "../types";
import type { PlaceRecord } from "../../types";
import { walkBlueprint } from "../../blueprint";
import { blueprintMapFor } from "../../blueprintPath";
import { placeTypeFromName } from "../../placeGuess";
import { moveBareEvents } from "../../blankStart";

const inside = (t: string | undefined) => t === "interior" || t === "house";

export const stage: FinishStage = {
  id: "adopt-model-places", phase: "blueprint", order: 25,
  run(ctx) {
    const { env, session, done } = ctx;
    if (!session.buildPlaces || session.autoPlacesDone) return;
    const project0 = env.ctx.project;
    const bp = project0.gameBlueprint;
    if (!bp) return;
    const missing = [...new Set(bp.steps.map((s) => s.place))].filter((p) => !blueprintMapFor(project0, p));
    if (!missing.length) return;
    const claimed = new Set(bp.steps.map((s) => blueprintMapFor(project0, s.place)?.id).filter((id): id is string => !!id));
    const seen = new Set<PlaceRecord>();
    const cands: { rec: PlaceRecord; mapId: string }[] = [];
    for (const rec of session.places.values()) {
      if (seen.has(rec)) continue;
      seen.add(rec);
      const mapId = rec.result.mapIds[0];
      if (mapId && project0.maps[mapId] && !claimed.has(mapId)) cands.push({ rec, mapId });
    }
    if (!cands.length) return;
    const rename = new Map<string, string>();
    const notes: string[] = [];
    let project = project0;
    for (const place of missing) {
      const want = placeTypeFromName(place);
      const i = cands.findIndex((c) => want === undefined || inside(want) === inside(c.rec.spec.type));
      if (i < 0) continue;
      const { mapId } = cands.splice(i, 1)[0]!;
      const map = project.maps[mapId]!;
      // 같은 이름 맵이 둘이면 id 로 가리킨다(blueprintMapFor 는 id 도 읽는다).
      const label = map.name && Object.values(project.maps).filter((m) => m.name === map.name).length === 1 ? map.name : map.id;
      rename.set(place, label);
      const bareId = session.barePlaces?.get(place);
      if (bareId) {
        session.barePlaces!.delete(place);
        const moved = moveBareEvents(project, bareId, mapId);
        project = moved.project;
        if (moved.notes.length) notes.push(`빈 맵 이벤트를 「${map.name ?? mapId}」로 옮김: ${moved.notes.join(", ")}`);
      }
      notes.push(`청사진 장소 「${place}」 = 모델이 지은 「${map.name ?? mapId}」(${mapId}) — 함수가 새로 짓지 않는다`);
    }
    if (!rename.size) return;
    env.ctx.project = { ...project, gameBlueprint: { ...bp, steps: bp.steps.map((s) => (rename.has(s.place) ? { ...s, place: rename.get(s.place)! } : s)) } };
    done.push(`모델이 지은 장소 잇기: ${notes.join(" / ").slice(0, 600)}`);
    ctx.walked = walkBlueprint(env.ctx.project).blockers;
  },
};
