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
import { isBareTileMap, isPlaceholderMap, moveBareEvents } from "../../blankStart";
import type { GameMap } from "@/project/types";

const inside = (t: string | undefined) => t === "interior" || t === "house";
/** 실내 맵인가 — placeGuess 의 같은 종류 판정과 같은 기준(실내 기후 또는 실내 칩셋). */
const indoorMap = (m: GameMap) => (m as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor" || /interior|wizard|sengoku|modern_city|campus|gothic/u.test(m.tilesetId);

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
    // 후보: 아직 어느 청사진 장소도 가리키지 않는, 내용이 있는(잔디 한 장 자리표시가 아닌) 맵 — 이번 실행이 지은 장소 먼저, 그다음 앞 차례들이 지은 맵.
    const cands: { mapId: string; indoor: boolean }[] = [];
    const add = (mapId: string | undefined) => {
      const m = mapId ? project0.maps[mapId] : undefined;
      if (!m || claimed.has(m.id) || cands.some((c) => c.mapId === m.id) || isPlaceholderMap(m) || isBareTileMap(m)) return;
      cands.push({ mapId: m.id, indoor: indoorMap(m) });
    };
    const seen = new Set<PlaceRecord>();
    for (const rec of session.places.values()) { if (seen.has(rec)) continue; seen.add(rec); add(rec.result.mapIds[0]); }
    // 다른 맵의 위층(그 맵에서만 계단으로 닿는 「… 2층」)은 장소로 삼지 않는다 — 대표 맵만.
    const upper = new Set([...session.places.values()].flatMap((r) => r.result.mapIds.slice(1)));
    for (const id of Object.keys(project0.maps)) if (!upper.has(id)) add(id);
    if (!cands.length) return;
    const rename = new Map<string, string>();
    const notes: string[] = [];
    let project = project0;
    for (const place of missing) {
      const want = placeTypeFromName(place);
      const fits = (c: { mapId: string; indoor: boolean }) => want === undefined || inside(want) === c.indoor;
      // 어느 맵이 그 장소인가 — ① 이름이 겹치는 맵 ② 시작 맵(모델이 시작 맵 위에 장소를 지어 옛 이름이 청사진에 남은 경우, vm8)
      // ③ 남은 장소·후보가 하나씩뿐일 때 그 맵. 그 밖에는 잇지 않는다(남은 장소는 자동 짓기가 모델 설계로 짓는다).
      const key = (t: string) => t.replace(/\s+/gu, "").toLowerCase();
      const named = cands.findIndex((c) => { const n = key(project.maps[c.mapId]?.name ?? ""); const q = key(place); return fits(c) && !!n && !!q && (n.includes(q) || q.includes(n)); });
      const start = cands.findIndex((c) => fits(c) && c.mapId === project.startMapId);
      const only = missing.length === 1 && cands.length === 1 && fits(cands[0]!) ? 0 : -1;
      const i = named >= 0 ? named : start >= 0 ? start : only;
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
