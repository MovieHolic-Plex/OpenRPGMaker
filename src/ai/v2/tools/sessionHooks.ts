// 끝맺음 단계가 모델 대신 부르는 것 — 청사진 경로 짓기, 이동 칸 앞 비우기, 청사진 장소 짓기·잇기. 세션에 걸어 둔다.
import { createBuildRun } from "../buildRun";
import { builderFor } from "../place/builders";
import { parseWorldStyle, pickWorldDoor, worldKind, worldOf, worldPlaceSpec } from "../world";
import type { GameBlueprintPlace } from "@/project/gameBlueprint";
import type { PlaceBuildResult, PlaceRecord, PlaceSpec } from "../types";
import type { Project } from "@/project/types";
import { DEAD_END_PREFIX } from "../place/deadEndRoads";
import { blueprintMapFor } from "../story/blueprintPath";
import { populateWorldPlace } from "../place/worldPopulate";
import { repairEventReach } from "../judge/eventReach";
import { runLaneStages } from "../finish/lanes";
import { isPlaceholderMap, moveBareEvents, retireBlankStart } from "../blankStart";
import { guessPlaceSpec } from "../place/placeGuess";
import { edgeCell, isInside, villageDoors, walkGame } from "../makeGame";
import { designMissingRooms } from "../place/designRooms";
import { LINK_SIDES, recordWrite, placeVariety } from "./support";
import type { VerbContext } from "./context";

/** createV2Tools 에서 뗀 것 —  · session.buildPath = · session.clearLanes = · session.buildPlaces = · session.linkBuiltPlaces =. (installSessionHooks) */
export function installSessionHooks(c: VerbContext) {
  const { env, session, task, run, runBlueprintPath, linkChild } = c;
  session.buildPath = async (why: string) => {
    const before = env.ctx.project;
    const result = runBlueprintPath([]);
    recordWrite(env, run, `auto-path-${Date.now()}`, "build_blueprint_path", { auto: why }, result.ok, result.summary, { eventIds: result.eventIds });
    session.content.push({ verb: "build_blueprint_path", result });
    // 경로를 다시 짓지 않고 거절해도(전투 단계 이벤트) 끝의 맞춤(열쇠 문·승리 관문·회복 길)은 했을 수 있다 — 바뀌었으면 저장한다.
    if (result.ok || env.ctx.project !== before) await env.checkpoint("build_blueprint_path");
    return { ok: result.ok, summary: result.summary };
  };
  // 끝맺음(2026-10-28 standin jrpg): 컷신에서 주인공에게 다가온 소녀가 동굴 입구 착지 칸 앞에 서서 자동 플레이가 막혔다.
  session.clearLanes = async () => {
    // 단계(빈 시작 맵 치우기 → 방탈출 봉인 → … → 맵마다 출구 마감·길·그림·사람 자리)는 src/ai/v2/finish/lanes/stages/ — 한 단계에 파일 하나.
    const notes = runLaneStages(env, session, run);
    if (notes.length) {
      recordWrite(env, run, `auto-lanes-${Date.now()}`, "move_event", { auto: "transfer-lanes" }, true, notes.join(" / ").slice(0, 400), {});
      await env.checkpoint("clear_transfer_lanes");
    }
    return notes;
  };
  // 끝맺음 자동 짓기(2026-10-28 스위트): 청사진 장소가 없으면 이름·장르로 명세를 추정해 make_place 와 같은 빌더로 짓고 앞 단계 장소와 잇는다.
  // 있는데 시작에서 걸어 닿지 않으면 잇기만 한다. 칩셋 계열은 placeGuess 가 같은 종류 기존 맵에서 물려받는다.
  session.buildPlaces = async () => {
    const bp = env.ctx.project.gameBlueprint;
    if (!bp) return [];
    const notes: string[] = [];
    // 시작 맵이 빈 자리표시 맵(잔디 한 장)이면 그 맵과 잇지 않는다 — 장소를 지은 뒤 retireBlankStart 가 시작을 첫 장소로 옮기고 빈 맵을 지운다.
    const start0 = env.ctx.project.maps[env.ctx.project.startMapId];
    const bareIds = new Set(session.barePlaces?.values() ?? []);
    const settle: { mapId: string; ids: string[] }[] = [];
    type Built = { mapId: string; spec?: PlaceSpec; result?: PlaceBuildResult };
    const recordOf = (mapId: string): Built => { const known = session.places.get(mapId); return { mapId, ...(known ? { spec: known.spec, result: known.result } : {}) }; };
    // 지을 장소 — 세계 청사진이면 장소 목록(종류·들어오는 앞 장소), 아니면 단계에 나온 장소를 차례로(종류는 이름으로 추정).
    // 목록의 장소는 이름이 똑같은 맵만 «이미 지었다»로 본다(「별빛 마을」과 「별빛 마을 시장」은 다른 장소다) — 단계에서 온 장소는 예전처럼 느슨하게 맞춘다.
    const world = worldOf(env.ctx.project);
    const listed = bp.places ?? [];
    const sameKey = (name: string) => name.normalize("NFC").replace(/\s+/gu, "");
    const mapOf = (name: string, exact: boolean) => exact ? Object.values(env.ctx.project.maps).find((m) => m.id === name || sameKey(m.name ?? "") === sameKey(name)) : blueprintMapFor(env.ctx.project, name);
    const kindOf = (place: GameBlueprintPlace | undefined) => (world && place ? worldKind(world, place.kind) : undefined);
    const entries = [...listed.map((place) => ({ name: place.name, place: place as GameBlueprintPlace | undefined })),
      ...[...new Set(bp.steps.map((st) => st.place))].filter((name) => !listed.some((pl) => pl.name === name)).map((name) => ({ name, place: undefined as GameBlueprintPlace | undefined }))];
    // 바깥 장소를 먼저 짓는다 — 실내는 바깥 장소의 집 문에 달린다(얼음 동굴 방은 얼음 절벽의 동굴 입구에).
    const plan = [...entries.filter((e) => !kindOf(e.place)?.indoor), ...entries.filter((e) => kindOf(e.place)?.indoor)];
    const exitsFrom = new Map<string, number>();
    const sideFrom = (parentId: string) => { const n = exitsFrom.get(parentId) ?? 0; exitsFrom.set(parentId, n + 1); return listed.length ? LINK_SIDES[n % LINK_SIDES.length] : undefined; };
    const freeDoors = (parent: Built) => {
      const used = new Set((env.ctx.project.maps[parent.mapId]?.events ?? []).map((e) => `${e.x},${e.y + 1}`));
      return villageDoors(parent.result ?? ({ state: undefined } as unknown as PlaceBuildResult)).filter((d) => !used.has(`${d.x},${d.y}`));
    };
    const outdoors: Built[] = [];
    let prev: Built = { mapId: start0 && (isPlaceholderMap(start0) || bareIds.has(start0.id)) ? "" : env.ctx.project.startMapId };
    for (const { name, place } of plan) {
      const kind = kindOf(place);
      const fromMap = place?.from ? mapOf(place.from, true) : undefined;
      // 들어오는 앞 장소: 청사진이 정했으면 그곳. 아니면 실내는 그 종류의 문이 남은 바깥 장소(없으면 마지막 바깥 장소), 바깥은 마지막 바깥 장소.
      // 문 낱말이 없는 실내 종류(버들항의 집·여관·가게)는 집 문이 남은 바깥 장소(마을)에 단다 — 마지막 바깥 장소가 동굴이어도 그 안에 여관을 달지 않는다.
      const doorHost = !kind?.indoor ? undefined
        : kind.door ? [...outdoors].reverse().find((o) => freeDoors(o).some((d) => kind.door!.test(d.kit ?? "")))
        : [...outdoors].reverse().find((o) => freeDoors(o).length > 0);
      const parent: Built = fromMap ? recordOf(fromMap.id) : doorHost ?? (world && kind ? outdoors.at(-1) : undefined) ?? prev;
      const door = world && kind?.indoor ? pickWorldDoor(world, kind, freeDoors(parent)) : undefined;
      let map = mapOf(name, !!place);
      if (!map) {
        const guess = world && kind ? worldPlaceSpec(world, kind, name) : guessPlaceSpec(name, env.ctx.project, bp.genre, String(task ?? ""));
        const composed = !!parseWorldStyle(guess.style);
        const spec0: PlaceSpec = { ...guess, salt: Math.floor(Math.random() * 1_000_000), variety: placeVariety(env, task), ...(isInside(guess) && !composed ? { mapId: `map_auto_${Math.floor(Math.random() * 1e9).toString(36)}` } : {}) };
        const builder = builderFor(spec0);
        if (!builder) { notes.push(`「${name}」(${spec0.type}) — 짓는 빌더가 없다`); continue; }
        // 자동으로 짓는 실내도 방은 모델이 설계한다(견본 거실 9×10 이 vm6·7·8 flash 방탈출 시작 방이 됐다) — 같은 모델에게 따로 받는다. 세계 구성기 방은 구성기가 짠다.
        const designedAuto = composed ? { spec: spec0, notes: [] as string[] } : await designMissingRooms(env, spec0, `청사진 장소 「${name}」 자동 짓기`);
        const spec = designedAuto.spec;
        notes.push(...designedAuto.notes);
        env.emit({ type: "execution_status", name: "v2.build", ok: true, summary: `청사진 장소 「${name}」 자동으로 짓는 중(${builder.id})` });
        await builder.prepare?.(spec);
        const sub = { ...env.ctx, project: env.ctx.project, currentMapId: parent.mapId || env.ctx.project.startMapId };
        const subRun = createBuildRun(sub);
        const result = builder.build(subRun, spec);
        env.ctx.project = sub.project;
        recordWrite(env, subRun, `auto-place-${name}`, "make_place", { spec, auto: true }, result.ok, result.summary, { mapIds: result.mapIds });
        for (const m of result.missingArt) session.missingArt.add(m);
        if (!result.ok || !result.mapIds[0] || !env.ctx.project.maps[result.mapIds[0]]) { notes.push(`「${name}」 짓기 실패: ${result.summary.slice(0, 160)}`); continue; }
        const first = env.ctx.project.maps[result.mapIds[0]]!;
        if (first.name !== name) run.call("set_map_properties", { mapId: first.id, name });
        const bareId = session.barePlaces?.get(name);
        if (bareId) {
          session.barePlaces!.delete(name);
          const moved = moveBareEvents(env.ctx.project, bareId, first.id);
          env.ctx.project = moved.project;
          if (moved.notes.length) notes.push(`빈 맵 이벤트를 「${name}」로 옮김: ${moved.notes.join(", ")}`);
          if (moved.ids.length) settle.push({ mapId: first.id, ids: moved.ids });
        }
        const record: PlaceRecord = { builder: builder.id, spec, result, rounds: 0 };
        for (const mapId of result.mapIds) session.places.set(mapId, record);
        const link = parent.mapId && env.ctx.project.maps[parent.mapId] && parent.mapId !== first.id ? linkChild(parent.mapId, parent.spec, parent.result, spec, result, sideFrom(parent.mapId), door) : "";
        notes.push(`「${name}」(${kind ? `${world!.id} ${kind.id}` : `${spec.type}${spec.style ? `·${spec.style}` : ""}`}, ${first.id}) 지음${link ? ` — ${link}` : ""}`);
        map = env.ctx.project.maps[first.id];
        prev = { mapId: first.id, spec, result };
        if (!isInside(spec)) outdoors.push(prev);
        continue;
      }
      const known = session.places.get(map.id);
      if (parent.mapId !== map.id && env.ctx.project.maps[parent.mapId] && walkGame(env.ctx.project, [map.id]).unreached.includes(map.id)) {
        const spec = known?.spec ?? guessPlaceSpec(map.name ?? name, env.ctx.project, bp.genre, String(task ?? ""));
        const result: PlaceBuildResult = known?.result ?? { ok: true, mapIds: [map.id], summary: "", warnings: [], missingArt: [], calls: [] };
        notes.push(`「${map.name ?? map.id}」 잇기 — ${linkChild(parent.mapId, parent.spec, parent.result, spec, result, sideFrom(parent.mapId), door)}`);
      }
      prev = recordOf(map.id);
      if (!kind?.indoor && !(prev.spec && isInside(prev.spec))) outdoors.push(prev);
    }
    for (const n of retireBlankStart(run)) notes.push(n);
    // 게임은 목록의 첫 장소에서 시작한다 — 바깥 장소를 먼저 지어 시작이 다른 장소에 가 있으면 첫 장소로 옮긴다(이번에 지은 세계 장소일 때만).
    const firstMap = listed[0] ? mapOf(listed[0].name, true) : undefined;
    const firstRecord = firstMap ? session.places.get(firstMap.id) : undefined;
    if (firstMap && firstRecord?.builder === "world" && env.ctx.project.startMapId !== firstMap.id && session.places.get(env.ctx.project.startMapId)?.builder === "world") {
      const spot = (firstRecord.result.state as { start?: { x: number; y: number } } | undefined)?.start ?? firstRecord.result.entrance;
      if (spot && run.call("set_start_position", { mapId: firstMap.id, x: spot.x, y: spot.y }).ok) notes.push(`시작을 첫 장소 「${firstMap.name}」로 옮김`);
    }
    // 위험한 종류(★)의 세계 장소에 보이는 적·보물상자 — 잇기가 끝난 뒤에(이동 칸 자리를 피한다). 이미 둔 맵은 건너뛴다.
    if (world) for (const [mapId, rec] of session.places) {
      const kind = rec.builder === "world" ? worldKind(world, String((rec.result.state as { kind?: string } | undefined)?.kind ?? "")) : undefined;
      if (!kind?.danger || !env.ctx.project.maps[mapId] || session.stockedPlaces.has(mapId)) continue;
      session.stockedPlaces.add(mapId);
      const placed = populateWorldPlace(run, mapId, rec.result.entrance, rec.spec.salt ?? 1);
      if (placed) notes.push(placed);
    }
    // 옮긴 조사 이벤트를 이름이 가리키는 물건(책상·쪽지…)·문 그림 칸으로 — 빈 맵에서는 물건이 없어 아무 칸이었다.
    // 시작이 새 방으로 옮겨진 뒤에 돈다(걸어 닿는지는 시작점에서 잰다).
    for (const { mapId, ids } of settle) { const rep = repairEventReach(run, mapId, ids); if (rep.moved.length) notes.push(`옮긴 이벤트 자리 맞춤: ${rep.moved.join(", ").slice(0, 300)}`); }
    if (notes.length) await env.checkpoint("auto_places");
    return notes;
  };
  // 지은 장소 잇기(2026-10-30 씬 벤치 sc-1030a terra river-village r2·r3): 「강가 어촌을 새로 만들어서 지금 마을과 이어 줘」에 조수가 어촌을 짓고
  // create_transfer_pair 를 버들마을 (35,14)·(20,29)에 불렀다가 「안전한 출입구를 만들 수 없다」로 거절당한 채 끝냈다 — 어촌은 어느 맵에서도 들어갈 수 없었고
  // 판정자는 「버들마을로 가는 출입구 없음」(blocker)이라 했다. 규칙: 이번 실행에 지은 장소 맵이 시작에서 걸어 닿지 않으면, 요청 글에 이름이 나온 맵
  // (없으면 요청 때 보던 맵, 그것도 이번에 지은 맵이면 시작 맵)과 make_game 의 잇기(linkChild: 문 그림·길 끝·칩셋 문 → 그림 없는 이동 칸)로 잇는다.
  // 길 끝에 세운 「막힌 길」 표지(ev_dead_end_*)는 잇기 전에 걷는다 — 표지가 길 끝 칸을 차지해 자리 고르기가 길 끝을 못 썼다. 남은 막힌 길은 마감이 다시 세운다.
  session.linkBuiltPlaces = async () => {
    const notes: string[] = [];
    const project0 = env.ctx.project;
    const built = new Map<string, PlaceRecord>();
    for (const [mapId, rec] of session.places) if (project0.maps[mapId] && rec.result.mapIds[0] === mapId) built.set(mapId, rec);
    if (!built.size) return notes;
    const taskText = String(task ?? "");
    const named = Object.values(project0.maps).filter((m) => !built.has(m.id) && m.name && m.name.length >= 2 && taskText.includes(m.name)).map((m) => m.id);
    const cur = env.ctx.currentMapId && !built.has(env.ctx.currentMapId) ? env.ctx.currentMapId : undefined;
    const parent = named[0] ?? cur ?? project0.startMapId;
    if (!project0.maps[parent] || built.has(parent)) return notes;
    for (const [mapId, rec] of built) {
      if (!walkGame(env.ctx.project, [mapId]).unreached.includes(mapId)) continue;
      // 막힌 길 표지 걷기(두 맵).
      const strip = (id: string) => {
        const m = env.ctx.project.maps[id];
        if (!m || !(m.events ?? []).some((e) => e.id.startsWith(DEAD_END_PREFIX))) return;
        env.ctx.project = { ...env.ctx.project, maps: { ...env.ctx.project.maps, [id]: { ...m, events: m.events.filter((e) => !e.id.startsWith(DEAD_END_PREFIX)) } } } as Project;
      };
      strip(parent); strip(mapId);
      const side = (["south", "east", "west", "north"] as const).find((d) => !!edgeCell(env.ctx.project, env.ctx.project.maps[parent]!, d)) ?? "south";
      const link = linkChild(parent, undefined, undefined, rec.spec, rec.result, side);
      const ok = !walkGame(env.ctx.project, [mapId]).unreached.includes(mapId);
      notes.push(`「${env.ctx.project.maps[mapId]?.name ?? mapId}」 시작에서 닿지 않아 「${env.ctx.project.maps[parent]?.name ?? parent}」와 이음 — ${link}${ok ? "" : " (그래도 닿지 않음)"}`);
    }
    if (notes.length) await env.checkpoint("link_built_places");
    return notes;
  };
}
