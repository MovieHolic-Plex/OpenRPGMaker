// 물건 동사 — place_object · dress_room · move_object.
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import { adoptExactInterior, interiorBuilder, interiorMoveObjects, type ObjectEdit } from "../../place/builders/interior";
import type { PlaceSpec } from "../../shared/types";
import { resolveWhere } from "../../place/where";
import { findMap } from "../../place/cells";
import { takeObjectPlan } from "../../place/drawObject";
import { dressRoom } from "../../place/builders/dressRoom";
import { tileMoveObjects } from "../../place/builders/tileMove";
import { POINT } from "../placeSchema";
import { text } from "../support";
import type { VerbContext } from "../context";

/** createV2Tools 에서 뗀 것 — placeObject · dressBudget · DRESS_ROOM_LIMIT · dressRoomVerb · moveBudget · MOVE_OBJECT_LIMIT · moveObject. (objectVerbs) */
export function objectVerbs(c: VerbContext) {
  const { env, session, run, finishPlace, finishContent } = c;
  const placeObject: PiToolShape = {
    name: "place_object", label: "그린 물건 놓기", concurrency: "exclusive",
    description: "Place an object drawn in the workshop and added to the chipset (objectId) on the map. Spot = a word (where) or the cell given by the critic or a follow-up (at). If blocked, the function moves it to nearby free floor.",
    parameters: { type: "object", properties: { mapId: { type: "string" }, objectId: { type: "string" }, where: { type: "string" }, at: POINT }, required: ["mapId", "objectId"] },
    async execute(id, params) {
      const p = params as { mapId: string; objectId: string; where?: string; at?: { x: number; y: number } };
      const map = findMap(env.ctx.project, p.mapId);
      if (!map) return text({ ok: false, summary: `맵 ${p.mapId} 이 없다` });
      // where·at 이 없으면 draw_object 가 크기에 맞춰 미리 정한 자리(있으면).
      const plan = !p.where && !p.at ? takeObjectPlan(session, p.mapId, p.objectId) : undefined;
      const first = plan ? plan.base : p.at && !p.where ? p.at : resolveWhere(env.ctx.project, map, p.where, p.at ? { at: p.at } : {}).cell;
      const tried: string[] = [];
      let placed: { ok: boolean; summary: string } | undefined;
      for (let r = 0; r <= 3 && !placed?.ok; r++) for (let dy = -r; dy <= r && !placed?.ok; dy++) for (let dx = -r; dx <= r && !placed?.ok; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const base = { x: first.x + dx, y: first.y + dy };
        const res = run.call("stamp_tileset_object", { mapId: p.mapId, objectId: p.objectId, base });
        tried.push(`(${base.x},${base.y})`);
        if (res.ok) placed = { ok: true, summary: `${p.objectId} 를 (${base.x},${base.y})에 놓았다${plan && !r ? ` — draw_object 가 미리 정한 자리${plan.how ? `(${plan.how})` : ""}` : ""}${r ? ` — 처음 자리 (${first.x},${first.y})가 막혀 옮겼다` : ""}` };
        else placed = { ok: false, summary: String(res.summary).slice(0, 200) };
      }
      return finishContent(id, "place_object", params, { ok: !!placed?.ok, mapIds: [p.mapId], summary: placed?.ok ? placed.summary : `놓지 못했다(${tried.length}자리 시도): ${placed?.summary ?? ""}`, warnings: [], missingArt: placed?.ok ? [] : [`${p.objectId} — 놓을 자리가 없다`], calls: [] });
    },
  };
  // ───── move_object: 놓인 가구 하나 옮기기·돌리기·빼기(손 도트 실내). 다시 짓지 않으므로 고치기 바퀴를 쓰지 않는다 ─────
  const dressBudget = new Map<string, number>();
  const DRESS_ROOM_LIMIT = 4;
  const dressRoomVerb: PiToolShape = {
    name: "dress_room", label: "방 채우기", concurrency: "exclusive",
    description: "Fill one room of an already built interior map with furniture for its use (purpose, e.g. 교장실 principal's office · 교실 classroom · 음악실 music room · 복도 corridor · 보건실 infirmary). Fix «room is empty», «lots of bare floor», «feels bare» defects with this — do not stamp objects one by one. at is one floor cell of that room. It picks furniture for that use from the chipset, places it backed against the walls, and undoes spots that block paths or events. The rest of the room stays and no fix round is used (4 per map).",
    parameters: { type: "object", properties: {
      mapId: { type: "string" }, at: POINT, purpose: { type: "string", description: "the room's use — e.g. 교장실, 교실, 음악실, 복도" },
    }, required: ["mapId", "at", "purpose"] },
    async execute(id, params) {
      const p = params as { mapId: string; at: { x: number; y: number }; purpose: string };
      if (!env.ctx.project.maps[p.mapId]) return text({ ok: false, summary: `맵 ${p.mapId} 이 없다` });
      // 조수가 design 으로 설계한 방은 함수가 가구를 골라 채우지 않는다(2026-10-29 사용자 결정 「방을 짓는 건 조수여야만 한다」 — 첫 실조수 시험에서
      // Argon 이 설계한 서재를 dress_room 이 망원경 둘·책상 둘을 더해 채웠다).
      if ((env.ctx.project.maps[p.mapId]!.locations ?? []).some((l) => (l.tags ?? []).includes("model-designed"))) {
        return text({ ok: false, summary: "이 방은 네가 design 으로 설계한 방이라 함수가 가구를 골라 채우지 않는다. 빈 바닥이 넓으면 design 의 w·h 를 줄이거나 groups 에 묶음(무엇을·몇 개·어디)을 더해 edit_place({patch:{mapId, design: 고친 설계 전체}}) 로 다시 짓는다." });
      }
      const used = dressBudget.get(p.mapId) ?? 0;
      if (used >= DRESS_ROOM_LIMIT) return text({ ok: false, summary: `${p.mapId} 의 방 채우기 상한(${DRESS_ROOM_LIMIT}번)에 닿았다 — 남은 문제를 사용자에게 보고한다.` });
      if (!p.at || typeof p.at.x !== "number" || typeof p.at.y !== "number") return text({ ok: false, summary: "at 에 그 방 바닥 한 칸 {x,y} 을 준다" });
      const from = run.calls.length;
      const result = dressRoom(run, p.mapId, p.at, String(p.purpose ?? ""));
      if (result.placed.length) dressBudget.set(p.mapId, used + 1);
      return finishContent(id, "dress_room", params, { ok: result.ok, mapIds: [p.mapId], summary: result.summary, warnings: [], missingArt: [], calls: run.calls.slice(from) });
    },
  };
  const moveBudget = new Map<string, number>();
  const MOVE_OBJECT_LIMIT = 6;
  const moveObject: PiToolShape = {
    name: "move_object", label: "가구 옮기기", concurrency: "exclusive",
    description: "Move a piece of furniture already placed in a hand-pixel interior (to), turn it to art facing another way (face), or remove it (remove). at is a cell the furniture covers (the cell the critic named). to is where the at cell goes — the whole piece shifts by the same amount. The rest of the room stays and no fix round is used (6 per map). If it blocks a path or the spot is not buildable it is undone with the reason. Tables, merchandise, platforms, walls and floors cannot be moved. In a hand-fixed room (filled with dress_room/stamp_object) the art cells move or are removed as is (face does not work).",
    parameters: { type: "object", properties: {
      mapId: { type: "string" },
      edits: { type: "array", minItems: 1, maxItems: 8, items: { type: "object", properties: {
        at: POINT, to: POINT, face: { type: "string", enum: ["N", "S", "E", "W"] }, remove: { type: "boolean" },
      }, required: ["at"] } },
    }, required: ["mapId", "edits"] },
    async execute(id, params) {
      const p = params as { mapId: string; edits: ObjectEdit[] };
      const map = env.ctx.project.maps[p.mapId];
      if (!map) return text({ ok: false, summary: `맵 ${p.mapId} 이 없다` });
      const used = moveBudget.get(p.mapId) ?? 0;
      if (used >= MOVE_OBJECT_LIMIT) return text({ ok: false, summary: `${p.mapId} 의 가구 옮기기 상한(${MOVE_OBJECT_LIMIT}번)에 닿았다 — 남은 문제를 사용자에게 보고한다.` });
      const edits = (p.edits ?? []).filter((e) => e && e.at && (e.to || e.face || e.remove));
      if (!edits.length) return text({ ok: false, summary: "edits 마다 at 과 함께 to·face·remove 중 하나가 필요하다" });
      const record = session.placeOf(p.mapId);
      type ArgsState = { tilesetId?: string; mapId?: string; args?: Record<string, unknown>; stampEdit?: boolean; adopted?: { tilesetId: string; args: Record<string, unknown> } };
      const state = record?.result.state as ArgsState | undefined;
      let base: { tilesetId: string; args: Record<string, unknown> } | undefined;
      let prev: ArgsState | undefined;
      // 일본 실내(jp-city 빌더)의 기록 인자는 예제 구성(program) 이라 가구 목록(objects)이 없다 — 인자로 다시 짓지 않고 아래 그림 칸 경로로 간다.
      // 전에는 그 기록에 mapId 가 없어 「위층·딸린 맵」으로 잘못 거절했다(2026-10-31 asst-parity 마왕 편의점: dress_room 이 더 놓은 계산대 둘을 못 뺐다).
      const argsRoom = !!state?.args && !state.stampEdit && record?.builder !== "jp-city";
      if (argsRoom && String(state!.args!.mapId ?? state!.mapId) === p.mapId) { base = { tilesetId: state!.tilesetId ?? map.tilesetId, args: state!.args! }; prev = state; }
      else {
        if (argsRoom && state!.mapId !== p.mapId) return text({ ok: false, summary: `${p.mapId} 는 위층·딸린 맵이라 아직 가구를 옮기지 못한다 — 보고에 적는다.` });
        // 이 실행이 짓지 않은 방: 지금 그림과 똑같이 다시 지어지는 인자를 찾는다(못 찾으면 옮기지 않는다 — 방이 견본으로 바뀌면 안 된다).
        const exact = adoptExactInterior(run, p.mapId);
        if (!exact) {
          // 다시 지을 인자가 없는 방(손으로 고친 방·dress_room 으로 채운 방): 그림 칸 그대로 옮기거나 뺀다(2026-10-26 j81 교장실 소파).
          const moved = tileMoveObjects(env.ctx.project, p.mapId, edits);
          if (moved.ok) moveBudget.set(p.mapId, used + 1);
          if (moved.ok) env.ctx.project = moved.project;
          const summary = moved.ok
            ? `${moved.done.join(" · ")}${moved.refused.length ? ` — 못 한 것: ${moved.refused.join(" · ")}` : ""} (그림 칸 그대로 옮김 — 방의 나머지는 그대로)`
            : `옮기지 못했다: ${moved.refused.join(" · ")}`;
          return finishContent(id, "move_object", params, { ok: moved.ok, mapIds: [p.mapId], summary, warnings: [], missingArt: [], calls: [] });
        }
        base = exact;
        prev = { tilesetId: exact.tilesetId, mapId: p.mapId, args: exact.args, adopted: exact };
      }
      const spec: PlaceSpec = record?.spec ?? { type: "interior", name: map.name, mapId: p.mapId };
      const before = record ? { project: env.ctx.project, record, seen: new Map(record.result.mapIds.map((m) => [m, session.seen.get(m)!] as const).filter(([, v]) => !!v)) } : undefined;
      env.emit({ type: "execution_status", name: "v2.move_object", ok: true, summary: `${spec.name}: 가구 ${edits.length}개 고치는 중` });
      const moved = interiorMoveObjects(run, spec, base, edits, prev as never);
      moveBudget.set(p.mapId, used + 1);
      const result = moved.ok && record ? { ...moved, mapIds: record.result.mapIds, ...(record.result.entrance ? { entrance: record.result.entrance } : {}) } : moved;
      return finishPlace(id, "move_object", params, spec, interiorBuilder.id, result, record?.rounds ?? 0, before?.seen.size ? before : undefined);
    },
  };
  return { placeObject, dressRoomVerb, moveObject };
}
