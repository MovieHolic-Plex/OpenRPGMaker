// make_game — 장소·사람·사건·퍼즐을 한 번에 받는 동사(OPRN_V2_MAKE_GAME 일 때만 싣는다).
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import { createBuildRun } from "../../buildRun";
import { builderFor } from "../../builders";
import { localizePlaceSpec } from "../../builders/modernCity";
import { localizeCultureSpec } from "../../builders/joseon";
import { fixPlayerStart } from "../../checks";
import type { PersonSpec, PlaceBuildResult, PlaceRecord, PlaceSpec } from "../../types";
import { buildPeople } from "../../people";
import { buildEvent } from "../../events";
import { eventBeats, isInside, orderPlaces, walkGame, type GameSpec } from "../../makeGame";
import { gateFor, settleDungeonGates } from "../../dungeonGates";
import { arrivalEntrance } from "../../dungeonParts";
import { designMissingRooms } from "../../designRooms";
import { dropModelSeed } from "../../modelSeed";
import { type Seen } from "../../turn/session";
import { PLACE_SPEC_SCHEMA } from "../placeSchema";
import { text, see, withImages, recordWrite, withSetupDefaults, placeVariety } from "../support";
import type { VerbContext } from "../context";
import type { peopleVerbs } from "./people";

/** createV2Tools 에서 뗀 것 — makeGame. (makeGameVerbs) */
export function makeGameVerbs(c: VerbContext & Pick<ReturnType<typeof peopleVerbs>, "personItem" | "eventItem">) {
  const { env, session, task, run, poolVillage, freshStart, outsideBuilt, blueprintGate, linkChild, personItem, eventItem } = c;
  const makeGame: PiToolShape = {
    name: "make_game", label: "작은 게임 짓기", concurrency: "exclusive",
    description: "One small game — build several places (5–8), link them parent-child (village house door ↔ interior, outdoor edge to edge, dungeon entrance), place people and events, then machine-walk the path from the start to every map and back, and return a critique per map. Do not call make_place per map.",
    parameters: { type: "object", properties: { game: { type: "object", properties: {
      title: { type: "string" },
      start: { type: "string", description: "start place key (omitted = the first place)" },
      places: { type: "array", maxItems: 8, items: { type: "object", properties: {
        key: { type: "string" }, spec: PLACE_SPEC_SCHEMA, from: { type: "string", description: "parent place key you enter from (omit for the start place)" },
        side: { type: "string", enum: ["north", "south", "east", "west"], description: "side for outdoor-to-outdoor links (direction seen from the parent)" },
      }, required: ["key", "spec"] } },
      people: { type: "array", items: { ...personItem, properties: { ...personItem.properties, place: { type: "string", description: "place key" } }, required: [...personItem.required, "place"] } },
      events: { type: "array", items: { ...eventItem, properties: { ...eventItem.properties, place: { type: "string", description: "place key" } }, required: [...eventItem.required, "place"] } },
    }, required: ["places"] } }, required: ["game"] },
    async execute(id, params) {
      const gate = await blueprintGate();
      if (gate) return text(gate);
      const game = (params as { game: GameSpec }).game;
      const { order, warnings } = orderPlaces(game);
      if (order.length < 2) return text({ ok: false, summary: "장소가 둘 이상이어야 한다 — 하나면 make_place 를 쓴다." });
      const built = new Map<string, { spec: PlaceSpec; builderId: string; result: PlaceBuildResult }>();
      const lines: string[] = [];
      const linkNotes: string[] = [];
      for (const [i, place] of order.entries()) {
        const spec0: PlaceSpec = poolVillage(localizeCultureSpec(localizePlaceSpec(dropModelSeed({ ...place.spec, salt: Math.floor(Math.random() * 1_000_000), variety: placeVariety(env, task) }, true), String(task ?? "")), String(task ?? "")));
        const parent = place.from ? built.get(place.from) : undefined;
        const parentMap = parent?.result.mapIds[0];
        // 실내는 새 맵 id 로(지금 맵을 덮어쓰지 않게), 나머지는 부모 맵을 「지금 맵」으로 — 빌더가 새 맵을 만들고 던전은 부모와 입구를 잇는다.
        const spec1: PlaceSpec = i > 0 && isInside(spec0) && !spec0.mapId ? { ...spec0, mapId: `map_${place.key.replace(/[^A-Za-z0-9_]/gu, "") || "room"}_${Math.floor(Math.random() * 1e6).toString(36)}` } : spec0;
        // 손 도트 실내 방은 모델이 설계한다 — 설계가 빈 방은 같은 모델에게 따로 받는다(designRooms.ts).
        let spec: PlaceSpec = (await designMissingRooms(env, spec1, "make_game 설계 빈 방")).spec;
        const builder = builderFor(spec);
        // 던전 입구는 세계 배치에서(부모에서 본 방향 side → 그 반대 쪽으로 들어온다). 설계가 다른 쪽을 적었으면 고치고 알린다(2026-10-30 맨 요청 남쪽 입구 13/16).
        if (builder?.id === "dungeon" && parent) {
          const ar = arrivalEntrance(spec, place.side); spec = ar.spec; if (ar.note) linkNotes.push(ar.note);
          if (parentMap && outsideBuilt(parentMap)) { const g = gateFor(env.ctx.project, parentMap, spec.dungeonDesign, place.side); if (g) spec = { ...spec, gate: g }; }
        }
        if (!builder) { session.missingArt.add(`${spec.name}(${spec.type}) — 이 종류를 짓는 빌더가 없다`); lines.push(`${place.key}: 짓는 빌더 없음`); continue; }
        env.emit({ type: "execution_status", name: "v2.build", ok: true, summary: `${spec.name} 짓는 중(${i + 1}/${order.length}, ${builder.id})` });
        await builder.prepare?.(spec);
        const sub = i === 0 ? env.ctx : { ...env.ctx, project: env.ctx.project, currentMapId: parentMap ?? env.ctx.currentMapId };
        const subRun = i === 0 ? run : createBuildRun(sub);
        let result = withSetupDefaults(builder.build(subRun, spec), builder.id, sub.project, String(task ?? ""), freshStart, session.stageWrites);
        if (sub !== env.ctx) env.ctx.project = sub.project;
        recordWrite(env, subRun, `${id}:${place.key}`, "make_game", { place: place.key, spec }, result.ok, result.summary, { mapIds: result.mapIds });
        for (const m of result.missingArt) session.missingArt.add(m);
        if (!result.ok) { lines.push(`${place.key}: 실패 — ${result.summary.slice(0, 160)}`); continue; }
        if (i === 0) {
          if (!isInside(spec)) { const fixed = fixPlayerStart(env.ctx.project, result.mapIds); if (fixed.note) env.ctx.project = fixed.project; }
          const ent = result.entrance;
          if (ent && env.ctx.project.startMapId !== result.mapIds[0]) run.call("set_start_position", { mapId: ent.mapId, x: ent.x, y: ent.y });
        }
        const first = env.ctx.project.maps[result.mapIds[0]!];
        if (first && first.name !== spec.name && !isInside(spec) && spec.type !== "dungeon" && spec.type !== "cave") run.call("set_map_properties", { mapId: first.id, name: spec.name });
        built.set(place.key, { spec, builderId: builder.id, result });
        const record: PlaceRecord = { builder: builder.id, spec, result, rounds: 0 };
        for (const mapId of result.mapIds) session.places.set(mapId, record);
        lines.push(`${place.key}: ${result.summary.slice(0, 200)}`);
        // 잇기
        if (!parent || !parentMap) continue;
        linkNotes.push(linkChild(parentMap, parent.spec, parent.result, spec, result, place.side));
        if (builder.id === "dungeon") linkNotes.push(...settleDungeonGates(run, result.mapIds, outsideBuilt, place.side));
      }
      recordWrite(env, run, `${id}:links`, "make_game", { links: true }, true, linkNotes.join(" / ").slice(0, 400));
      // 사람·사건
      const content: string[] = [];
      const mapOf = (key: string) => built.get(key)?.result.mapIds[0];
      const byPlace = new Map<string, PersonSpec[]>();
      for (const p of game.people ?? []) { const list = byPlace.get(p.place) ?? []; const { place: _place, ...person } = p; list.push(person); byPlace.set(p.place, list); }
      for (const [key, people] of byPlace) {
        const mapId = mapOf(key);
        if (!mapId) { content.push(`사람 ${people.length}명: 장소 「${key}」가 없다`); continue; }
        const r = buildPeople(run, people, mapId);
        session.content.push({ verb: "add_people", result: r });
        recordWrite(env, run, `${id}:people:${key}`, "add_people", { mapId, people }, r.ok, r.summary);
        content.push(`사람(${key}): ${r.summary.slice(0, 160)}`);
      }
      for (const ev of game.events ?? []) {
        const mapId = mapOf(ev.place);
        if (!mapId) { content.push(`사건: 장소 「${ev.place}」가 없다`); continue; }
        const { place: _place, ...event } = ev;
        const r = buildEvent(run, { ...event, mapId, beats: eventBeats(event) });
        session.content.push({ verb: "add_event", result: r });
        recordWrite(env, run, `${id}:event:${ev.place}`, "add_event", { ...event, mapId }, r.ok, r.summary);
        content.push(`사건(${ev.place}): ${r.summary.slice(0, 160)}`);
      }
      await env.checkpoint("make_game");
      // 길 검사 + 맵마다 보기(비평은 장소마다 첫 맵, 6곳까지 함께)
      const allMaps = [...built.values()].flatMap((b) => b.result.mapIds).filter((m) => env.ctx.project.maps[m]);
      const path = walkGame(env.ctx.project, allMaps);
      const views = await Promise.all([...built.values()].map(async (b, i) => {
        const ids = b.result.mapIds.filter((m) => env.ctx.project.maps[m]);
        const seen = await see(env, session, task, b.spec.type, ids.slice(0, i < 6 ? 3 : 1), b.result.entrance, i < 6);
        for (const mapId of ids) session.seen.set(mapId, seen);
        return { b, seen };
      }));
      const problems = views.flatMap(({ b, seen }) => [
        ...seen.checks.filter((c) => !c.ok).map((c) => `${b.spec.name} [기계 ${c.id}] ${c.detail}`),
        ...seen.critics.flatMap((v) => v.majors.map((m) => `${b.spec.name} [비평] ${m.what}${m.fix ? ` → ${m.fix}` : ""}`)),
      ]);
      const shots: Seen = { checks: [], critics: views.flatMap((v) => v.seen.critics), images: views.flatMap((v) => v.seen.images.slice(0, 1)) };
      return withImages({
        ok: built.size > 0, title: game.title, places: lines, links: linkNotes, warnings, content,
        path: path.lines, mapIds: Object.fromEntries([...built].map(([k, b]) => [k, b.result.mapIds])),
        problems: problems.slice(0, 20), missingArt: [...session.missingArt],
        next: path.unreached.length || path.noWayBack.length ? "닿지 않는 맵·돌아가는 문 없는 맵이 있다 — 그 맵 문을 create_transfer_pair 로 잇거나 보고에 적는다."
          : problems.length ? "고칠 major 는 edit_place 로 장소마다 한 번, 게임 요소(퀘스트·아이템·전투)는 게임 도구로 덧붙인 뒤 보고한다."
          : "길·검사 통과 — 남은 게임 요소가 있으면 덧붙이고 보고한다.",
      }, shots, 4);
    },
  };
  return { makeGame };
}
