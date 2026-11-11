// 조수 v2 실내 빌더 — 명세(방 구역·주인공 물건·층)를 손 도트 실내 도구(build_hand_interior_room)의 인자로 옮긴다.
//
// 1) 구역 → layout.rooms(방 종류). 방 배치·칸막이·문·출구·견본 가구는 도구의 결정론 배치기가 짠다(layout.ts).
// 2) 주인공 물건(anchors) → 부품 사전에서 찾아 그 방의 빈 자리에 놓는다. 놓을 때마다 다시 지어 도달 검사(unreachedFloor 0)를 통과한 자리만 남긴다.
// 3) 「계단」 앵커 → 위층을 따로 짓고 계단끼리 이동 이벤트로 잇는다(계단 입구 계약은 도구의 fitStairTransfers 가 맞춘다).
// 모델은 칸 좌표를 쓰지 않는다 — 비평가가 짚은 칸(near)은 「그 근처의 빈 자리」를 고르는 힌트로만 쓴다.
import { HAND_INTERIOR_TILESET_ID, roomSpecOf } from "@/editor/handInterior/builder";
import { roomTemplates, templateStyle } from "@/editor/handInterior/templates";
import { measureInteriorBareFloor } from "@/editor/handInterior/bareFloor";
import type { PlaceBuilder, PlaceBuildResult } from "../../shared/types";
import { interiorVenues } from "./interiorVenues";
import { DRESS_ROOM_TARGET, roomBarePct } from "./dressRoom";
import { VIGNETTE_TARGET, hashText, vignetteRoomSize } from "@/editor/handInterior/vignettes";
import type { HandInteriorNotch } from "@/editor/handInterior/rooms";
import { type DesignRoomReport, type RoomDesign } from "@/editor/handInterior/designRoom";
import { harmonizeRoomGraph, RoomGraphError, type GraphOut } from "@/editor/handInterior/roomGraph";
import { copiedReference } from "../roomIdeas";
import { buildFromLayout, hasLayout } from "./interiorLayoutBuild";
import { LAYOUT_FORMAT, LAYOUT_FORMAT_REGIONS, LAYOUT_GRID_RULES } from "../interiorLayout";
import { effectiveSpec } from "../interiorCatalog";
import { Obj, Room, Rebuild, InteriorState, interiorTilesetOf, resolveKind, SHRINK_BARE_PCT, FILL_BARE_PCT, SCALE, findPart } from "./interiorKind";
import { argsFromRebuild, clean, Attempt, build, reachOk, crashesOf, openingColumns, placeAnchor, fillBare, usedTemplates, rotateTemplate, TemplatePick, pickTemplate } from "./interiorFill";
import { RoomShape, composeShape } from "./interiorShape";
import { swapForPurpose, cosyFor, coverZones, designedRoom, dressEmptyRooms } from "./interiorCosy";
import { buildVenue, addBackDoor, buildUpperFloor } from "./interiorFloors";

/** 조합 길로 짓는 방 종류(2026-10-29 서재부터 — 다른 종류는 서재 결과를 본 뒤). */
const COMPOSED_KINDS: ReadonlySet<string> = new Set(["study"]);

export const INTERIOR_CARD = `[Interior interior] make_place({type:"interior", name, layout:{…}}) — inns, taverns, shops, libraries, studies, jails, chapels, forges, guild halls, houses inside.
- ★ You design every cell: put one cell layout in spec.layout — map size, the landmark, the outer wall ring, partition walls (wall to wall), doors on those walls, the entrance, one label per room (floor, purpose), wall_items bound to a wall (windows, shelves, fireplace, beds, stairs up) and floor objects (catalog ids). Code lays it exactly as written — nothing is added, moved or chosen for you — and checks it: unknown id, overlap, out of bounds, open walls, unlabelled pockets, wall-face rules, a door that joins nothing, unreachable rooms, landmark placement. A failed check comes back as Rejected / You sent / Fixed call: fix exactly what it names. You get 2 repairs; after that, pieces that still fail are left out and the rest is laid.
- layout format: ${LAYOUT_FORMAT}
${LAYOUT_GRID_RULES.map((r) => `- ${r}`).join("\n")}
- Ids: the [Interior catalog] card (generated from the chipset's own room tables) lists pieces suggested for this request first, then every floor, wall, carpet, dais, sized table and object id grouped by category with counts, with its footprint and placement kind (h and w pieces go in wall_items). Use exact ids. find_pieces(category, tags) shows a whole category with placement, art rise and the example rooms each piece is used in — furnish every room with several different pieces that serve it, not the first few of the suggested slice. The older rectangle form (regions + openings: ${LAYOUT_FORMAT_REGIONS.replace(/\s+/gu, " ").slice(0, 120)}…) is still accepted.
- After it is laid you get its picture. Look at it as a player walking in and send review_layout({mapId, problems, patch}) — a patch (remove/add pieces, replace a field) is applied to your layout exactly and validated; an empty patch means nothing to fix. The todo loop asks for these review rounds. room_parts({purpose}) adds reference rooms players liked (structure summaries + pictures) — borrow structure, not plans.
- Design it like a real place: a clear landmark (a big piece the place is built around), distinct functional areas, side rooms or alcoves, furniture and decoration so that no large floor area is empty, and walking paths from the entrance to every area.
- ★ "Build one room / one place" means one map — one place — not one cell. Design the room graph inside that map from what the place needs to work: an inn has a hall, a kitchen, stairs and guest rooms; a library has reading rooms and stacks; a shop has the sales floor and a back storeroom; a jail has a guard room, a corridor and cells. Players and the judge expect a place with structure — rooms to walk between, a reason to go deeper, one landmark per room — and a single box reads as unfinished. A single cell is right only for places that really are one room (a closet, a hut, a cell on its own). How many rooms is your call.
- (zones path — older, weaker than layout) zones[{kind, purpose, design}] per room: the function lays out shapes and groups from your design; room_parts shows the design format.
- (zones path) Several rooms in one map (the reference rooms players liked are all like this: a main room, side rooms, a corridor or stairs, one big landmark per room): give each zone id, x, y (rough top-left cell), design (w, h, groups) and landmark (a part id in its groups; big multi-cell parts welcome), plus connections:[{a, b, type:"door"|"open"}] and entrance (the southernmost room). You decide the room count, sizes, positions and links; the function only snaps walls, carves doors and checks reachability, and the todo check room_graph verifies the result.
- zones = each room (rooms split by partitions). kind words: tavern (tavern hall) · kitchen · storeroom · cellar · bedroom · inn_room (guest room) · study · library · living · dining · forge · workshop · alchemy · chapel · treasury · armory · throne_room · great_hall · entrance · corridor · bathroom · cell. Korean words also work.
- anchors = the room's hero objects (words): 「큰 망원경」(big telescope) 「벽난로」(fireplace) 「바 카운터」(bar counter) 「책장」(bookshelf) 「별자리표」(star chart) 「올라가는 계단」(stairs up). Prefix 「큰」 for big ones. The function looks them up in the parts dictionary and places them on free floor, or tells you they are missing.
- For stairs to a 2nd/upper floor, put "올라가는 계단" in anchors and floors:2 — it builds the upper floor and links the stairs.
- style: fantasy (default — also wizard towers, alchemy workshops and observatories; telescope and alchemy parts are in this chipset) · wizarding (Hogwarts-style magic «school» buildings only) · sengoku (Sengoku/Edo) · modern (modern city). Modern Japanese homes use type:"house".
- A name word (inn, tavern, observatory…) does not lay down a preset room — an inn hall or a study stands as your design says. Put hero objects like a big telescope in anchors and design.groups.
- Changing a laid layout: review_layout, or edit_place({patch:{mapId, layoutPatch:{remove_objects, add_objects, remove_wall_items, add_wall_items, replace}}}), or edit_place({patch:{mapId, set:{layout:{…the full corrected layout}}}}) — relaid exactly; layout places are not limited to 3 rebuilds. Fixing an existing room built another way: edit_place({mapId, patch:{dressing:1}}) = keep the room layout and floor, add props. A north back door: patch.set.exits:["north"] or addAnchors:[{what:"북쪽 뒷문"}] — it adds a door in the north wall and builds and links a back room. Keep the original floor and wall materials.`;

export const interiorBuilder: PlaceBuilder = {
  id: "interior",
  accepts: (spec) => spec.type === "interior",
  build(run, spec, previous) {
    const notes: string[] = [];
    const missing: string[] = [];
    const prev = previous?.result.state as InteriorState | undefined;
    const sheet = prev ? { tilesetId: prev.tilesetId } : interiorTilesetOf(run.ctx.project, spec);
    const tilesetId = sheet.tilesetId;
    if ("note" in sheet && sheet.note) notes.push(sheet.note);
    if (/murim|wuxia|무협|무림|강호|객잔|문파|협객/iu.test(`${spec.name} ${spec.style ?? ""} ${spec.theme ?? ""}`)) missing.push(`${spec.name} — 무협 실내(무림 전용 칩셋 murim_wuxia 가 번들에 없어 ${tilesetId} 로 지었다)`);
    const roomSpec = roomSpecOf(run.ctx.project.tilesets[tilesetId]);
    if (!roomSpec) return { ok: false, mapIds: [], summary: `실내 칩셋 ${tilesetId} 이 이 프로젝트에 없다`, warnings: [], missingArt: [spec.name], calls: run.calls };
    // hints.newMap: make_place 가 「이번에 지은 다른 장소」를 덮지 않게 새 맵을 요구했다(2026-10-25 G27: 지하 예배당을 지은 맵에 저택을 다시 지어 예배당이 사라졌다).
    const mapId: string | undefined = prev?.mapId ?? spec.mapId ?? (spec.hints?.newMap === true ? undefined : run.ctx.currentMapId ?? run.ctx.project.startMapId);
    // 칸 배치(spec.layout, 2026-10-31): 모델이 모든 칸을 썼다 — 견본·묶음·방 그래프 길을 거치지 않고 그대로 깔고 검증만 한다(interiorLayoutBuild.ts).
    if (hasLayout(spec)) {
      const lt = run.ctx.project.tilesets[HAND_INTERIOR_TILESET_ID] ? HAND_INTERIOR_TILESET_ID : tilesetId;
      const ls = effectiveSpec(run.ctx.project.tilesets[lt]);
      if (ls) return buildFromLayout(run, spec, ls, lt, mapId);
    }
    // 장소 견본(천문대 등) — 방 종류 견본으로는 주인공 물건이 방을 정하지 못한다(2026-10-23 비교: 천문대가 평범한 서재로 읽혀 v1 8 · v2 3.5).
    const venueText = `${spec.name} ${spec.theme ?? ""} ${(spec.zones ?? []).map((z) => `${z.kind} ${z.purpose ?? ""}`).join(" ")}`;
    // 가구 길 고르기(2026-10-29 3단계, 벤치 room-base/vig/vig2-1029): 기본은 장소 견본·방 견본(제작자 구성이 있는 용도에선 이쪽이 강하다 — 예배당·여관).
    // 기물 묶음 배치기는 그 용도의 견본이 없거나(resolveKind 가 다른 방 견본으로 떨어짐) 고정 크기(keep)에 맞는 견본이 없을 때만 쓴다(서재 6×7 같은 방탈출 방).
    // hints.furnish:"vignette" 면 늘 묶음, "template" 이면 늘 견본.
    const venueAllowed = spec.hints?.furnish !== "vignette" || spec.hints?.venue === true;
    // 한 게임 안 반복 금지: 같은 장소 견본으로 지은 맵이 이 게임에 이미 있으면(그 맵을 다시 짓는 것은 빼고) 장소 견본을 건너뛰고 방 견본 변형으로 — 추리 여관의 로비·식당이 같은 16×14 통나무 홀이었다(vm1 flash mystery).
    const usedVenues = usedTemplates(run.ctx.project, mapId);
    // 장소 견본은 새로 짓는 방에 깔지 않는다(2026-10-29 사용자 원칙 «방은 모델이 설계한다, 함수는 고르지 않는다» — 23판 중 여관 1층 13개가 같은 16×14 홀이었다).
    // 이미 장소 견본으로 지은 방을 설계 없이 고칠 때만 그 견본을 다시 쓴다(가구 비키기·물건 더하기가 같은 방에서 출발하게).
    const venue = venueAllowed && !!prev?.venue && tilesetId === HAND_INTERIOR_TILESET_ID && !(spec.zones ?? []).some((z) => z.design) && (spec.zones ?? []).filter((z) => (z.floor ?? 1) === 1).length <= 1
      ? interiorVenues(roomSpec).find((v) => v.words.test(venueText) && (!(spec.floors && spec.floors > 1) || (spec.floors === 2 && !!v.stairs)) && (prev?.venue === v.id || !usedVenues.has(`venue-${v.id}`))) : undefined;
    if (venue) {
      const done = buildVenue(run, spec, venue, roomSpec, tilesetId, mapId, prev);
      if (done) return done;
      notes.push(`장소 견본 「${venue.id}」으로 짓지 못해 방 종류 견본으로 지었다`);
    }
    const zones = spec.zones?.length ? coverZones(tilesetId, spec, spec.zones, notes) : [{ kind: spec.name, purpose: spec.name }];
    const scale = SCALE[spec.size ?? "medium"] ?? 1;
    const used = new Map<string, number>();
    const usedTpl = usedTemplates(run.ctx.project, mapId);
    const firstFloor = zones.filter((z) => !z.floor || z.floor === 1);
    // 게임마다 다른, 같은 입력이면 같은 씨앗 — make_place 가 넣은 variety(프로젝트 열쇠 + 요청문), 없으면 게임 제목. 견본·조합 고르기가 이 열쇠를 쓴다.
    const varietyKey = `${spec.variety ?? run.ctx.project.meta.title ?? ""}|${spec.name}|${spec.theme ?? ""}`;
    const single = firstFloor.length === 1;
    let buildingStyle: string | undefined;
    let shapeOut: RoomShape | undefined;
    const rooms = firstFloor.map((zone) => {
      const kindOut: { fallback?: boolean } = {};
      const kind = resolveKind(tilesetId, zone, notes, `${spec.name} ${spec.theme ?? ""}`, firstFloor.length === 1, kindOut);
      const n = (used.get(kind) ?? 0) + 1; used.set(kind, n);
      const zoneKey = `${varietyKey}|${zone.kind}|${zone.purpose ?? ""}|${n}`;
      const pick: TemplatePick = { key: zoneKey, single, text: `${zone.kind} ${zone.purpose ?? ""} ${spec.name} ${spec.theme ?? ""} ${spec.style ?? ""}`, ...(buildingStyle ? { style: buildingStyle } : {}) };
      // 조합 길(2026-10-29 「서재가 늘 같은 방·늘 ㅁ자」): 견본 한 벌을 옮겨 심지 않고 성격 낱말·씨앗으로 방 모양(ㄱ자·ㅗ자·창가 돌출·곁방)과
      // 기물 묶음을 고른다. 견본 길은 hints.furnish:"template".
      // 모델이 설계한 방(zone.design): 견본·묶음 고르기를 하지 않는다 — 설계의 모양·크기·재질로 방을 세우고 가구는 설계대로(조화·검사만, designRoom.ts).
      const design = tilesetId === HAND_INTERIOR_TILESET_ID && zone.design && typeof zone.design === "object" ? zone.design : undefined;
      if (design) return designedRoom(zone, kind, n, design, roomSpec, notes);
      const compose = COMPOSED_KINDS.has(kind) && spec.hints?.furnish !== "template" && !zone.keep && !zone.vignettes?.length && tilesetId === HAND_INTERIOR_TILESET_ID;
      const roomText = `${zone.kind} ${zone.purpose ?? ""} ${single ? `${spec.name} ${spec.theme ?? ""}` : ""}`;
      // 크기: small = 가장 작은 견본, medium = 가운데, large = 가장 큰 견본(한 방짜리면 × 1.3). 큰 주인공 물건이 들어갈 만큼은 넓힌다.
      // 묶음 길: 방 크기를 견본이 아니라 그 용도 레시피 묶음 발자국 ÷ 목표 막힘(36%)으로 정한다(작게 0.75·크게 1.3 배 넓이).
      const sizeWord = zone.size ?? spec.size;
      const keepMiss = !!(zone.keep?.w && zone.keep.h) && !roomTemplates(tilesetId).some((t) => t.kind === kind && Math.abs(t.w - zone.keep!.w!) <= 2 && Math.abs(t.h - zone.keep!.h!) <= 2);
      const vig = compose || spec.hints?.furnish === "vignette" || (spec.hints?.furnish !== "template" && (!!kindOut.fallback || !pickTemplate(tilesetId, kind, sizeWord, pick) || keepMiss));
      if (vig && !compose && spec.hints?.furnish !== "vignette") notes.push(`구역 「${zone.id ?? zone.kind}」은 ${keepMiss ? `고정 크기 ${zone.keep!.w}×${zone.keep!.h} 에 맞는 ${kind} 견본이 없어` : `${zone.kind} 견본이 없어`} 기물 묶음 배치기로 꾸몄다`);
      const vsize0 = vig && !zone.keep
        ? vignetteRoomSize(tilesetId, kind, roomSpec, { purpose: compose ? roomText : `${zone.kind} ${zone.purpose ?? ""} ${firstFloor.length === 1 ? spec.name : ""}`, ...(zone.vignettes?.length ? { picks: zone.vignettes } : {}), scale: sizeWord === "small" ? 0.75 : sizeWord === "large" ? 1.3 : 1, composed: compose })
        : undefined;
      const shape = compose && vsize0 ? composeShape(zoneKey, sizeWord, roomText, vsize0, single) : undefined;
      if (shape) { shapeOut ??= shape; notes.push(`구역 「${zone.id ?? zone.kind}」은 조합 길로 지었다 — 모양 ${shape.label}${shape.annex ? ` + 곁방 ${shape.annex.kind}` : ""}, 성격 ${shape.characters.join("·")}`); }
      const vsize = shape ? { w: shape.w, h: shape.h } : vsize0;
      const picked = !vig && !zone.keep ? pickTemplate(tilesetId, kind, sizeWord, pick) : undefined;
      const rot = !vig && !zone.keep ? rotateTemplate(tilesetId, kind, sizeWord, usedTpl, pick) : undefined;
      if (rot && rot.id !== picked?.id) notes.push(`${kind} 견본 ${picked?.id} 은 이 게임에서 이미 써서 ${rot.id}(${rot.w}×${rot.h})로 바꿨다`);
      const chosen = rot ?? picked;
      const t = zone.keep?.w && zone.keep.h ? { w: zone.keep.w, h: zone.keep.h } : vsize ?? chosen;
      const tplId = chosen?.id;
      if (tplId) usedTpl.set(tplId, (usedTpl.get(tplId) ?? 0) + 1);
      if (chosen && !buildingStyle && templateStyle(chosen) !== "any") buildingStyle = templateStyle(chosen);
      const need = (zone.anchors ?? []).map((a) => findPart(roomSpec, a)).filter((p): p is NonNullable<typeof p> => !!p && p.kind !== "hang");
      // 벽면 두 줄 + 물건 + 앞 통로 두 줄. 벽에 붙는 물건(벽난로·창)은 벽면 줄에 박히니 한 줄 덜.
      const minW = Math.max(0, ...need.map((p) => p.w + 4)), minH = Math.max(0, ...need.map((p) => Math.max(1, p.h) + (p.kind === "wall" ? 4 : 5)));
      // 여러 방 건물에서 「크다」는 방 수로 낸다 — 방마다 견본 × 1.3 으로 키우면 방이 내용보다 커져 빈 홀이 된다(마법학교 홀 30×25). 한 방짜리만 키운다.
      const grow = spec.size === "large" && !zone.keep && firstFloor.length === 1 && !vsize ? scale : 1;
      const sized = t ? { w: Math.max(minW, Math.round(t.w * grow)), h: Math.max(minH, Math.round(t.h * grow)) } : minW ? { w: minW, h: minH } : {};
      // 고른 견본을 layout 에 못 박는다 — 크기만 넘기면 layout 이 같은 크기·화풍에서 늘 같은 견본(authored-study-sq)을 다시 골랐다.
      return { id: zone.id ?? (n > 1 ? `${kind}${n}` : kind), kind, vig, tplId, composed: !!shape, ...(tplId ? { template: tplId } : {}), ...sized, min: { w: Math.max(shape ? 7 : 5, minW), h: Math.max(shape ? 8 : 6, minH) },
        ...(zone.keep?.floor ? { floor: zone.keep.floor } : shape?.floor ? { floor: shape.floor } : {}), ...(zone.keep?.wall ? { wall: zone.keep.wall } : shape?.wall ? { wall: shape.wall } : {}), ...(shape?.notches.length ? { notches: shape.notches } : {}), zone };
    });
    // 조합 곁방(서고·연금 구석) — 한 방짜리 서재에만. 같은 바닥·벽 재질, 묶음 배치기로 꾸민다.
    if (single && shapeOut?.annex && rooms[0]) {
      const a = shapeOut.annex;
      rooms.push({ id: a.id, kind: a.kind, vig: true, tplId: undefined, composed: true, w: a.w, h: a.h, min: { w: 5, h: 6 }, ...(shapeOut.floor ? { floor: shapeOut.floor } : {}), ...(shapeOut.wall ? { wall: shapeOut.wall } : {}), zone: { kind: a.kind, purpose: a.purpose } } as unknown as typeof rooms[number]);
    }
    const hints = spec.hints ?? {};
    // 묶음 길은 방 크기를 묶음 발자국으로 정했다 — 배치 변주 C·D 는 한 방을 가로 +4·사방 +2 칸 키워(서재 6×6 → 10×6·8×8) 그 크기를 버린다.
    // 묶음 길에서는 모델이 변주를 직접 고를 때만 쓰고, 소금(salt)으로는 고르지 않는다(견본·묶음 고르기는 seed 가 바꾼다).
    const vignette = rooms.some((r) => r.vig);
    const designed = rooms.some((r) => (r as { designed?: boolean }).designed);
    const designs = Object.fromEntries(rooms.filter((r) => (r as { design?: RoomDesign }).design).map((r) => [r.id, (r as { design?: RoomDesign }).design!]));
    const designExit = (rooms.find((r) => (r as { exitAt?: number }).exitAt !== undefined) as { exitAt?: number } | undefined)?.exitAt;
    // 방 그래프(2026-10-30 2회차): 모델이 방마다 대략 자리(x,y)·연결·입구를 주면 배치 후보를 함수가 고르지 않는다 — 조화(칸막이 1칸 붙이기·문 내기·
    // 출구 열)만 하고 못 짓는 평면은 영어 고친 호출과 함께 돌려보낸다(roomGraph.ts). 기준 방 평면을 거의 그대로 옮기면 돌려보낸다(roomIdeas.ts 지문).
    // 방이 하나면 그래프가 아니다 — 2026-10-30 2회차 terra 가 엄격 스키마로 x·y·stairs 를 늘 채워 한 방짜리도 그래프로 지었고 «계단 선언·없음» 거짓 ✗ 가 났다.
    const graphMode = designed && rooms.length >= 2 && rooms.every((r) => (r as { designed?: boolean }).designed)
      && (!!spec.connections?.length || firstFloor.some((z) => typeof z.x === "number" && typeof z.y === "number"));
    let graph: GraphOut | undefined;
    if (graphMode) {
      const entranceId = spec.entrance && rooms.some((r) => r.id === spec.entrance) ? spec.entrance : undefined;
      const entranceRoom = rooms.find((r) => r.id === entranceId) as { exitAt?: number } | undefined;
      try {
        graph = harmonizeRoomGraph({
          rooms: rooms.map((r) => ({ id: r.id, kind: r.kind, w: r.w!, h: r.h!, x: r.zone.x, y: r.zone.y, floor: (r as { floor?: string }).floor, wall: (r as { wall?: string }).wall, notches: (r as { notches?: HandInteriorNotch[] }).notches })),
          connections: spec.connections ?? [], ...(entranceId ? { entrance: entranceId } : {}), ...(entranceRoom?.exitAt !== undefined ? { exitAt: entranceRoom.exitAt } : designExit !== undefined ? { exitAt: designExit } : {}),
        });
      } catch (error) {
        if (!(error instanceof RoomGraphError)) throw error;
        return { ok: false, mapIds: [], summary: `Room graph rejected: ${error.message}${error.fixed ? ` Fixed call: ${error.fixed}` : ""}`, warnings: notes, missingArt: missing, calls: run.calls };
      }
      const copy = copiedReference({ w: graph.width, h: graph.height, rooms: graph.rooms.map((r) => ({ name: r.id, x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 })) });
      if (copy) return { ok: false, mapIds: [], summary: `Room graph rejected: the plan is a near copy of reference room ${copy.id} (plan similarity ${copy.similarity}: same room count, sizes and positions). Borrow its structure, not its plan — change the room count, sizes or arrangement to fit this request.`, warnings: notes, missingArt: missing, calls: run.calls };
      notes.push(...graph.notes.map((n) => `room graph: ${n}`));
    }
    // 그래프 선언(검사 room_graph 가 맵 이름표로 읽는다 — handInteriorTools 가 room-graph 이름표로 남긴다).
    const graphDecl = graph ? {
      rooms: rooms.map((r) => ({ id: r.id, name: String(r.zone.purpose ?? r.kind).slice(0, 40), ...(r.zone.role ? { role: String(r.zone.role) } : {}), ...(r.zone.stairs === "up" || r.zone.stairs === "down" ? { stairs: r.zone.stairs } : {}), ...(r.zone.landmark && !/^(none|null|-)?$/iu.test(String(r.zone.landmark).trim()) ? { landmark: String(r.zone.landmark) } : {}) })),
      connections: graph.connect.map((c) => ({ a: c.a, b: c.b, type: c.open ? "open" : "door" })), entrance: graph.exit.room,
    } : undefined;
    // 방이 모두 손으로 짠 견본이면 소금 변주도 쓰지 않는다 — 배치 후보 C·D 가 방을 넓혀 5×6 객실 견본이 7×8 방 왼쪽 위에 몰리고 나머지가 맨바닥이 됐다.
    const allAuthored = rooms.length > 0 && rooms.every((r) => !r.vig && String(r.tplId ?? "").startsWith("authored-"));
    // variety 열쇠가 있으면 무작위 salt 대신 그 해시 — 같은 게임·같은 요청이면 같은 배치(재현), 다른 게임이면 다른 배치.
    const salt = spec.variety !== undefined ? hashText(varietyKey) % 1_000_000 : spec.salt;
    // 설계 방은 배치 변주(B 좌우 뒤집기·C 넓히기·D)를 쓰지 않는다 — 모델이 정한 크기·자리를 함수가 바꾸지 않는다.
    const variant = typeof hints.variant === "number" ? hints.variant : !vignette && !allAuthored && !designed ? (salt ?? 0) % 4 : 0;
    const seed = typeof hints.seed === "number" ? hints.seed : undefined;
    const layoutSeed = seed ?? (salt ? 1 + (salt % 99991) : undefined);
    // 가구: 견본 길(견본 한 벌 + 빈 바닥 메우기)이 기본, 견본 없는 방이 하나라도 있으면 기물 묶음 배치기(vignettes.ts — 벽·앞 통로·밀도 규칙,
    // 빈 바닥은 메우지 않고 방을 줄인다). 구역 vignettes(묶음 id·몸통 기물 id)는 모델이 고른 묶음.
    const picks = Object.fromEntries(rooms.filter((r) => r.zone.vignettes?.length).map((r) => [r.id, [...r.zone.vignettes!]]));
    const purposes = Object.fromEntries(rooms.map((r) => [r.id, `${r.zone.kind} ${r.zone.purpose ?? ""} ${rooms.length === 1 ? `${spec.name} ${spec.theme ?? ""}` : ""}`.trim()]));
    let base: Record<string, unknown> = { tileset: tilesetId, mapId, name: spec.name, replace: mapId ? true : undefined,
      layout: { rooms: rooms.map((r) => clean({ id: r.id, kind: r.kind, w: r.w, h: r.h, template: (r as { template?: string }).template, floor: (r as { floor?: string }).floor, wall: (r as { wall?: string }).wall, notches: (r as { notches?: unknown }).notches })), ...(variant ? { variant } : {}), ...(layoutSeed ? { seed: layoutSeed } : {}),
        ...(graph ? { placed: { rooms: graph.rooms, connect: graph.connect, exit: graph.exit }, graph: graphDecl } : {}),
        ...(shapeOut ? { exitAt: shapeOut.exitAt, composeSeed: hashText(`${varietyKey}|furnish`) % 1_000_000 } : designExit !== undefined ? { exitAt: designExit } : {}),
        ...(designed ? { designs } : {}),
        ...(vignette ? { furnish: "vignette", purposes, ...(Object.keys(picks).length ? { vignettes: picks } : {}) } : {}) } };
    let first = build(run, base);
    if (!first.ok) {
      // 맵이 다른 칩셋의 살아 있는 맵이면 새 맵으로 짓는다(덮어쓰지 않는다).
      const fresh = { ...base, mapId: undefined, replace: undefined };
      first = build(run, fresh);
      if (!first.ok) return { ok: false, mapIds: [], summary: `실내를 짓지 못했다: ${first.summary}`, warnings: notes, missingArt: missing, calls: run.calls };
    }
    // 설계 방: 함수가 고친 것을 모델에게 그대로 돌려준다(다시 설계할 기회).
    if (designed) {
      const reps = ((first.data?.layout as { rooms?: { id: string; design?: DesignRoomReport }[] } | undefined)?.rooms ?? []);
      for (const r of reps) if (r.design) {
        notes.push(`설계 방 ${r.id}: 묶음 ${r.design.placed.length}개·기물 ${r.design.items}점을 설계대로 놓았다(막힌 바닥 ${Math.round(r.design.blockedShare * 100)}%)${r.design.fixes.length ? ` — 함수가 고친 것 ${r.design.fixes.length}건` : " — 함수가 고친 것 없음"}`);
        for (const f of r.design.fixes) notes.push(`고침: ${f}`);
      }
    }
    // 방 크기를 내용에 맞춘다 — 빈 바닥이 넓으면 메우지 말고 방을 줄인다(2026-10-28 interior 장부: 중간 크기 여관 홀이 견본 그대로 16×15,
    // 견본 가구만으로 맨바닥 60% → fillBare·dress_room 이 식탁 열 벌·바 의자·벤치를 빈 곳마다 메워 「가구를 늘어놓은 전시장」이 됐다).
    // 큰 방(견본 넓이 48칸 이상)만 0.85 → 0.72 → 0.62 배로 줄여 다시 지어 보고, 맨바닥이 줄어든 만큼만 받는다. 주인공 물건 자리(min)는 지킨다.
    // 「large」도 줄인다 — 큰 학교를 견본 × 1.3 으로 지어 입학 홀이 맨바닥 60% 의 빈 광장이 됐다(2026-10-28 마법학교). 넓이는 요청보다 내용이 정한다.
    // 묶음 길: 방마다 막힌 바닥이 목표(30~44%, 예제 방 사분위 33~50%)를 벗어나면 그 비율만큼 방 넓이를 고쳐 한 번 다시 짓는다(남는 바닥은 메우지 않고 방을 줄인다).
    if (vignette && !rooms.some((r) => r.zone.keep)) {
      const builtId = String(first.data?.mapId ?? mapId);
      const shares = () => new Map(((first.data?.layout as { rooms?: { id: string; vignettes?: { blockedShare: number; floor: number } }[] } | undefined)?.rooms ?? []).map((r) => [r.id, r.vignettes] as const));
      // 조합 방은 맨바닥 15%(vqa 한도)를 목표로 두 번까지 줄인다.
      for (let pass = 0; pass < (rooms.some((r) => r.composed) ? 2 : 1); pass++) {
        const got = shares();
        const layout = base.layout as { rooms: { id?: string; w?: number; h?: number }[] };
        let changed = false;
        // 막힘 비율만 보면 앞 통로 줄 덕에 30% 를 넘어도 1배 화면은 맨바닥 덩이가 넓다 — 맨바닥(2×2 덩이, 실내 기준 15%)이 30% 를 넘는 방도 줄인다.
        const m = run.ctx.project.maps[builtId];
        const bareOfRoom = (id: string): number => {
          const l = (m?.locations ?? []).find((q) => (q.tags ?? []).includes("hand-layout-room") && q.name === rooms.find((z) => z.id === id)?.kind);
          return m && l ? roomBarePct(run.ctx.project, m, { name: l.name, x0: l.x, y0: l.y, x1: l.x + l.w - 1, y1: l.y + l.h - 1 }) : 0;
        };
        const resized = layout.rooms.map((r, i) => {
          const id = String(r.id ?? rooms[i]!.id);
          const v = got.get(id);
          if ((rooms[i] as { designed?: boolean } | undefined)?.designed) return r;   // 모델이 정한 크기는 함수가 바꾸지 않는다
          const bare = bareOfRoom(id);
          if (!v || !r.w || !r.h) return r;
          const byShare = v.blockedShare < 0.3 || v.blockedShare > 0.44 ? Math.max(0.05, v.blockedShare) / VIGNETTE_TARGET : 1;
          const comp = !!rooms[i]?.composed;
          const byBare = bare > (comp ? 15 : 30) ? (1 - bare / 100) / (comp ? 0.87 : 0.75) : 1;
          // 조합 방은 막힘이 높다고 키우지 않는다(책장 줄이 막힘을 올린다) — 줄이기만.
          const want = Math.min(comp ? Math.min(1, byShare) : byShare, byBare);
          if (want === 1) return r;
          // 줄일 때는 깊이를 먼저 — 묶음은 북벽·가운데에 서므로 남는 맨바닥은 문 쪽 아래 줄에 모인다(벤치 room-vig-1029 서재·침실).
          const k = Math.max(0.5, Math.min(1.6, want));
          const fw = k < 1 ? Math.pow(k, 0.3) : Math.sqrt(k), fd = k < 1 ? Math.pow(k, 0.7) : Math.sqrt(k);
          const w = Math.max(rooms[i]!.min.w, Math.round(r.w * fw)), fh = Math.max(rooms[i]!.min.h - 2, Math.round((r.h - 2) * fd));
          if (w === r.w && fh + 2 === r.h) return r;
          changed = true;
          return { ...r, w, h: fh + 2 };
        });
        if (!changed) { if (process.env.OPRN_VIGNETTE_DEBUG) notes.push(`방 넓이 그대로: ${layout.rooms.map((r, i) => { const id = String(r.id ?? rooms[i]!.id); return `${id} ${r.w}x${r.h} min ${rooms[i]!.min.w}x${rooms[i]!.min.h} 막힘 ${got.get(id)?.blockedShare} 맨바닥 ${bareOfRoom(id)}`; }).join(", ")}`); break; }
        const next = { ...base, mapId: builtId, replace: true, layout: { ...layout, rooms: resized } };
        const attempt = build(run, next);
        const before = layout.rooms.map((r) => `${r.w}×${r.h}`).join(",");
        if (!attempt.ok || !reachOk(attempt)) { build(run, base); notes.push(`방 넓이 고치기(${before} → ${resized.map((r) => `${r.w}×${r.h}`).join(",")}) 실패: ${attempt.ok ? "닿지 못한 바닥" : attempt.summary.slice(0, 100)}`); break; }
        // 줄인 방에 묶음이 덜 들어가면(서재 책상 세트가 빠지고 책장·안락의자만 남았다) 줄이지 않는다 — 빈 바닥보다 빠진 가구가 더 나쁘다.
        const placedOf = (a: Attempt) => ((a.data?.layout as { rooms?: { vignettes?: { placed: string[] } }[] } | undefined)?.rooms ?? []).reduce((n, q) => n + (q.vignettes?.placed.length ?? 0), 0);
        if (placedOf(attempt) < placedOf(first)) { build(run, base); notes.push(`방 넓이 고치기(${before} → ${resized.map((r) => `${r.w}×${r.h}`).join(",")})는 기물 묶음이 ${placedOf(first)} → ${placedOf(attempt)}개로 줄어 버렸다`); break; }
        first = attempt; base = next;
        if (process.env.OPRN_VIGNETTE_DEBUG) notes.push(`다시 지은 배치: ${JSON.stringify((attempt.data?.layout as { rooms?: unknown[] } | undefined)?.rooms?.map((q) => { const o = q as Record<string, unknown>; return { id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, v: o.vignettes }; }))} 요청 ${JSON.stringify((next.layout as {rooms:unknown}).rooms)} 결과 ${JSON.stringify(Object.keys(attempt.data ?? {}))} ${JSON.stringify((attempt.data?.layout as Record<string, unknown> | undefined) && Object.fromEntries(Object.entries(attempt.data!.layout as Record<string, unknown>).filter(([k]) => k !== "rooms")))}`);
        notes.push(`방 넓이를 기물 묶음 막힘 목표(36%)·맨바닥에 맞춰 ${before} → ${resized.map((r) => `${r.w}×${r.h}`).join(",")} 로 고쳐 지었다`);
      }
    }
    // 손으로 짠 견본(authored-…)은 그 크기에서 검수·도달 검사를 통과한 구성이다 — 줄이기·빈 바닥 메우기·빈 방 꾸미기·한 단계 줄이기를 하지 않는다
    // (2026-10-29 room-vig3: 잡화점 7×8 견본을 「빈 바닥이 넓다」며 줄여 계산대가 빠졌다).
    const settled = !designed && ((first.data?.layout as { rooms?: { template?: string }[] } | undefined)?.rooms ?? []).every((r) => String(r.template ?? "").startsWith("authored-"));
    if (settled) notes.push(`손으로 짠 방 견본(${((first.data?.layout as { rooms?: { template?: string }[] }).rooms ?? []).map((r) => r.template).join(", ")})을 크기 그대로 썼다`);
    if (!vignette && !settled && !designed && !rooms.some((r) => r.zone.keep)) {
      const builtId = String(first.data?.mapId ?? mapId);
      const bareOf = () => { const m = run.ctx.project.maps[builtId]; return m ? measureInteriorBareFloor(run.ctx.project, m)?.pct ?? 0 : 0; };
      let pct = bareOf();
      let kept = base;
      // 줄인 크기로는 다른 견본이 골라져 재질이 바뀐다(통나무 여관 홀이 푸른 얼룩 돌바닥이 됐다) — 첫 짓기의 바닥·벽면 재질을 물려준다.
      const firstRooms = ((first.data?.rebuild as Rebuild | undefined)?.rooms ?? []);
      // 줄이기 전 기물 부딪힘 수 — 줄인 판이 이보다 많으면 받지 않는다(crashesOf).
      let crashes = crashesOf(first);
      const crashNotes: string[] = [];
      for (const f of [0.85, 0.72, 0.62]) {
        if (pct <= SHRINK_BARE_PCT) break;
        const layout = base.layout as { rooms: { w?: number; h?: number }[] };
        const shrunk = layout.rooms.map((r, i) => {
          const want = rooms[i]!;
          const mat = firstRooms.find((q) => q.id === want.id) ?? firstRooms[i];
          const keepMat = { ...(mat?.floor ? { floor: mat.floor } : {}), ...(mat?.wall ? { wall: mat.wall } : {}), ...r };
          if (!r.w || !r.h || r.w * r.h < 48) return keepMat;
          return { ...keepMat, w: Math.max(want.min.w, Math.round(r.w * f)), h: Math.max(want.min.h, Math.round(r.h * f)) };
        });
        if (shrunk.every((r, i) => r.w === layout.rooms[i]!.w && r.h === layout.rooms[i]!.h)) break;
        const next = { ...base, mapId: builtId, replace: true, layout: { ...layout, rooms: shrunk } };
        const attempt = build(run, next);
        const now = attempt.ok ? bareOf() : Infinity;
        // 배율마다 배치가 달라져 맨바닥이 들쭉날쭉하다 — 한 번 나빠졌다고 멈추지 않고 셋 다 재 보고 가장 덜 빈 것을 받는다(5칸 넘게 줄어야).
        if (attempt.ok && now <= pct - 5 && crashesOf(attempt) >= crashes + 1) { crashNotes.push(`×${f} 은 기물 부딪힘 ${crashes.toFixed(1)}→${crashesOf(attempt).toFixed(1)}`); continue; }
        if (attempt.ok && now <= pct - 5) { first = attempt; kept = next; pct = now; crashes = crashesOf(attempt); }
      }
      if (crashNotes.length) notes.push(`빈 바닥 줄이기를 일부 받지 않았다 — 줄이면 기물끼리 겹친다(${crashNotes.join(", ")})`);
      // 한 방만 텅 빈 경우(마법학교: 입학 홀만 맨바닥 60%, 서고·교실은 꽉 참) — 전체를 같은 배율로 줄이면 꽉 찬 방이 같이 줄어 자리가 없어
      // 받지 못한다. 가장 빈 방 하나씩 0.7 배로 줄여 보고, 맨바닥 칸 수가 줄면 받는다(최대 다섯 번, 못 줄인 방은 건너뛴다). 비율로 재면 다른 빈 방들에 묻혀
      // 한 방을 줄여도 숫자가 안 움직인다(입학 홀 22×18 → 15×13 이 전체 64% → 65%).
      const bareCellsOf = () => { const m = run.ctx.project.maps[builtId]; return m ? measureInteriorBareFloor(run.ctx.project, m)?.bareCells ?? 0 : 0; };
      let cells = bareCellsOf();
      const stuck = new Set<string>();
      for (let k = 0; k < 5; k++) {   // 전체가 괜찮아도 한 방이 비면 그 방을 줄인다
        const m = run.ctx.project.maps[builtId];
        const builtRooms = ((first.data?.rebuild as Rebuild | undefined)?.rooms ?? []);
        if (!m) break;
        const layout = kept.layout as { rooms: { id?: string; w?: number; h?: number }[] };
        const share = (r: Room) => {
          let floor = 0, bare = 0;
          for (let y = r.y0 + 2; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
            const i = y * m.width + x;
            if ((m.lowerTiles[i] ?? -1) < 0) continue;
            floor++;
            if ((m.lowerOverlayTiles?.[i] ?? -1) < 0 && (m.upperTiles[i] ?? -1) < 0 && (m.upperOverlayTiles?.[i] ?? -1) < 0) bare++;
          }
          return floor ? bare / floor : 0;
        };
        const worst = builtRooms.filter((r) => !stuck.has(r.id)).map((r) => ({ r, s: share(r) })).sort((a, b) => b.s - a.s)[0];
        const li = worst ? layout.rooms.findIndex((q) => q.id === worst.r.id) : -1;
        const target = li >= 0 ? layout.rooms[li]! : undefined;
        const want = li >= 0 ? rooms[li] : undefined;
        if (!worst || worst.s < 0.4 || !target?.w || !target.h || !want || target.w * target.h < 40) break;
        const w = Math.max(want.min.w, Math.round(target.w * 0.7)), h = Math.max(want.min.h, Math.round(target.h * 0.7));
        if (w === target.w && h === target.h) { stuck.add(worst.r.id); continue; }
        const mat = builtRooms.find((q) => q.id === want.id);
        const shrunk = layout.rooms.map((q, i) => {
          const fm = builtRooms.find((b) => b.id === rooms[i]!.id);
          const withMat = { ...(fm?.floor ? { floor: fm.floor } : {}), ...(fm?.wall ? { wall: fm.wall } : {}), ...q };
          return i === li ? { ...withMat, ...(mat?.floor ? { floor: mat.floor } : {}), w, h } : withMat;
        });
        const next = { ...kept, mapId: builtId, replace: true, layout: { ...layout, rooms: shrunk } };
        const attempt = build(run, next);
        const nowCells = attempt.ok && reachOk(attempt) && crashesOf(attempt) < crashes + 1 ? bareCellsOf() : Infinity;
        if (nowCells < cells - 8) { first = attempt; kept = next; pct = bareOf(); cells = nowCells; crashes = crashesOf(attempt); }
        else { build(run, kept); stuck.add(worst.r.id); }
      }
      if (kept !== base || pct > SHRINK_BARE_PCT) build(run, kept);
      if (kept !== base) { notes.push(`빈 바닥이 넓어 큰 방을 줄여 지었다(맨바닥 ${pct}%) — 빈 바닥은 가구로 메우지 않고 방 크기로 맞춘다`); base = kept; }
    }
    // 올라가는 계단이 든 방은 건물 맨 북쪽 바깥 벽에 붙어야 한다(칸막이 속 계단 경고) — 그런 배치 후보를 고른다.
    const stairZone = rooms.find((r) => (r.zone.anchors ?? []).some((a) => /계단|stair/iu.test(a) && /올라|위층|2층|up/iu.test(a)));
    const northmost = (a: Attempt) => {
      const rr = (a.data?.rebuild as Rebuild | undefined)?.rooms ?? [];
      const top = Math.min(...rr.map((r) => r.y0));
      return rr.find((r) => r.id === stairZone?.id)?.y0 === top;
    };
    if (stairZone && first.ok && !northmost(first) && !seed) {
      for (let v = 1; v <= 3; v++) {
        const alt = build(run, { ...base, mapId: String(first.data?.mapId ?? mapId), replace: true, layout: { ...(base.layout as object), variant: (variant + v) % 4 } });
        if (alt.ok && northmost(alt)) { first = alt; break; }
      }
      if (!northmost(first)) first = build(run, { ...base, mapId: String(first.data?.mapId ?? mapId), replace: true });
    }
    const builtMapId = String(first.data?.mapId ?? mapId);
    let rb = first.data?.rebuild as Rebuild;
    // 빌린 견본의 가구를 그 방 쓰임의 가구로(장난감 가게가 빌린 재봉 가게 견본의 옷감 선반·마네킹 → 인형 진열장·흔들 목마, J31).
    if (!designed) {
      const swapped = swapForPurpose(roomSpec, rb, new Map(rooms.map((r) => [r.id, r.kind] as const)), rooms.length === 1 ? `${spec.name} ${spec.theme ?? ""}` : "", (id) => rooms.find((r) => r.id === id)?.zone);
      if (swapped.count) {
        const next = build(run, argsFromRebuild({ tileset: tilesetId, mapId: builtMapId, name: spec.name }, swapped.rb));
        if (next.ok && reachOk(next)) { first = next; rb = (next.data?.rebuild as Rebuild | undefined) ?? swapped.rb; notes.push(`빌린 견본 가구 ${swapped.count}점을 방 쓰임 가구로 바꿨다`); }
        else build(run, argsFromRebuild({ tileset: tilesetId, mapId: builtMapId, name: spec.name }, rb));
      }
    }
    let args = argsFromRebuild({ tileset: tilesetId, mapId: builtMapId, name: spec.name }, rb);
    const placed: { zone: string; what: string; id: string }[] = [];
    const openings = openingColumns(rb, first.data);
    const anchorKeys = new Set<string>();
    const protect = () => anchorKeys;
    let stairsUp: { id: string; x: number; y: number; w: number } | undefined;
    // 주인공 물건.
    for (const room of rooms) for (const what of room.zone.anchors ?? []) {
      let part = findPart(roomSpec, /계단|stair/iu.test(what) && /올라|위층|2층|up/iu.test(what) ? "stairs up wood" : what);
      if (!part) { missing.push(`${what}(${room.id}) — 부품 사전에 없다`); continue; }
      // 큰 주인공 물건(큰 굴절 망원경 5×6)은 그만한 방에만 — 13×12 연금술 공방에 큰 망원경을 세워 벽난로·선반을 가리고 다른 축척 그림처럼 보였다
      // (2026-10-28 interior 장부 25·26·29·36). 그림 넓이가 방 바닥의 15% 를 넘으면 같은 물건의 작은 그림(great 를 뗀 id)으로 바꾼다.
      {
        const host = rb.rooms.find((r) => r.id === room.id);
        const floorArea = host ? (host.x1 - host.x0 + 1) * Math.max(1, host.y1 - host.y0 - 1) : 0;
        const drawn = part.w * (Math.max(1, part.h) + Math.ceil((roomSpec.objects[part.id]?.up ?? 0) / 16));
        const small = /^great /u.test(part.id) ? roomSpec.objects[part.id.replace(/^great /u, "")] : undefined;
        if (host && small && drawn > floorArea * 0.15) {
          const smallPart = findPart(roomSpec, part.id.replace(/^great /u, ""));
          if (smallPart) { notes.push(`${what}: 방(${room.id}, 바닥 ${floorArea}칸)에 비해 ${part.id}(${drawn}칸 그림)가 커서 ${smallPart.id} 로 바꿨다`); part = smallPart; }
        }
      }
      // 이미 «그 방에» 있으면 놓은 것으로 친다 — 다른 방(견본)에 같은 가구가 있다고 넘기면 입학 홀의 「큰 벽난로」가 복도 견본 벽난로로 셈되어 홀이 비었다.
      const inZone = (o: Obj) => { const r = rb.rooms.find((q) => q.id === room.id); return !r || (o.x >= r.x0 && o.x <= r.x1 && o.y >= r.y0 && o.y <= r.y1 + 1); };
      if (rb.objects.some((o) => o.id === part.id && inZone(o)) && !/계단|stair/iu.test(what)) { placed.push({ zone: room.id, what, id: part.id }); continue; }
      // 손으로 짠 견본은 같은 종류(이름 첫 낱말이 같은 가구: counter 1x1 ↔ counter 3x1)가 이미 있으면 놓은 것으로 친다 — 덧놓으면 검수된 통로를 막는다.
      // 탁자·의자는 종류 묶음으로 본다(감옥 견본의 식탁 dining 3x1 이 있는데 「탁자」를 진열대 display 1x1 로 덧놓았다).
      const head = part.id.split(" ")[0]!;
      // 침대·책장도 묶음으로 본다 — 손으로 짠 침실(침대 있음)에 「큰 침대」를 canopy bed 로 덧놓아 침대가 둘이 됐다(room-vig6 bedroom).
      // 선반·진열장, 궤짝·자루·바구니도 묶음 — 손으로 짠 시골 잡화점(잡화 선반·단지·초 진열장, 궤짝·자루)에 「선반」을 shelf:potion 으로 벽 진열장 위에 겹쳐 걸고
      // 「나무 상자」를 도마(chopping block)로 계산대 틈에 덧놓았다(2026-10-29 room-vig8 healing-store major 둘).
      const KIN = [/^(dining|desk|display|table|counter|work|lab)\b/u, /^(chair|stool|bench|armchair|pew|sofa)\b/u, /\bbed\b/u,
        /shelf|bookcase|^cabinet\b|apothecary drawers/u, /wardrobe/u, /^(crate|chest|barrel|sack|basket|box|chopping block|seed sacks|loot sacks)\b/u];
      const same = (o: Obj) => { const h = o.id.split(/[ :]/u)[0]!; return h === head || KIN.some((k) => k.test(o.id) && k.test(part.id)); };
      // 견본 한 벌로 꾸민 방(묶음 길이 아닌 방)도 같다 — 병동 견본(가로 침대 여섯)에 「병원 침대」를 세로 침대로 덧놓아 세면대·정수기 앞을 막았다(2026-10-29 horror-ward).
      // 놓은 것으로 칠 때는 그 방에 실제로 있는 가구 id 로 적는다 — 찾은 부품 id(desk 1x1)로 적으면 설계 방의 desk 3x1 이 있는데도
      // 「최종 맵에 없다(놓은 뒤 밀려났다)」 anchor-missing 실패로 셌다(2026-10-29 vm8·fvL1 terra 방탈출: 책상·책장·금고 셋 다).
      const kin = (settled || !vignette) && !/계단|stair/iu.test(what) ? rb.objects.find((o) => same(o) && inZone(o)) : undefined;
      if (kin) { placed.push({ zone: room.id, what, id: kin.id }); continue; }
      // 올라가는 계단: 이 방이 맨 북쪽 바깥 벽에 닿지 않으면(위에 다른 방) 맨 북쪽 방 벽에 단다 — 칸막이 속으로 오르는 계단은 틀린 그림이다.
      const isUp = part.stairs === "up" || /stairs up/u.test(part.id);
      const top = Math.min(...rb.rooms.map((r) => r.y0));
      const hostId = isUp && rb.rooms.find((r) => r.id === room.id)?.y0 !== top ? (rb.rooms.find((r) => r.y0 === top)?.id ?? room.id) : room.id;
      if (hostId !== room.id) notes.push(`${what}: ${room.id} 위에 다른 방이 있어 맨 북쪽 ${hostId} 벽에 달았다`);
      const done = placeAnchor(run, roomSpec, args, rb, hostId, part, undefined, true, protect(), openings);
      if (!done) { missing.push(`${what}(${room.id}) — 놓을 빈 자리가 없다`); continue; }
      args = done.args; rb = done.rb; placed.push({ zone: hostId, what, id: part.id });
      const last = rb.objects[rb.objects.length - 1]!; anchorKeys.add(`${last.id}@${last.x},${last.y}`);
      if (part.stairs === "up" || /stairs up/u.test(part.id)) { const o = rb.objects[rb.objects.length - 1]!; stairsUp = { id: part.id, x: o.x, y: o.y, w: part.w }; }
    }
    // 꾸밈 정도(아늑하게): 방마다 빈 자리에 아늑한 소품을 한두 점.
    const dressing = typeof hints.dressing === "number" ? hints.dressing : 0;
    if (dressing > 0 && designed) notes.push("설계 방에는 꾸밈 정도(dressing)로 함수가 소품을 더하지 않는다 — 더할 것은 design 의 묶음에 넣는다");
    if (dressing > 0) for (const room of rooms) {
      if ((room as { designed?: boolean }).designed) continue;
      let added = 0;
      for (const word of cosyFor(room.kind, rooms.length === 1 ? `${spec.name} ${spec.theme ?? ""}` : "")) {
        if (added >= dressing * 2) break;
        const part = roomSpec.objects[word] ? { id: word, kind: roomSpec.objects[word]!.kind, w: roomSpec.objects[word]!.w, h: roomSpec.objects[word]!.h } : findPart(roomSpec, word);
        if (!part) continue;
        const done = placeAnchor(run, roomSpec, args, rb, room.id, part, undefined, false, protect(), openings);
        if (done) { args = done.args; rb = done.rb; added++; }
      }
    }
    // 빈 바닥 덩이 메우기(쓰임 한 벌) — 1배에서 「휑한 홀」이 v1 의 가장 흔한 major 였다.
    const kinds = new Map(rooms.map((r) => [r.id, r.kind] as const));
    build(run, args);
    if (!vignette && !settled && !designed) {
      const filled = fillBare(run, roomSpec, args, rb, kinds, FILL_BARE_PCT, `${spec.name} ${spec.theme ?? ""}`);
      args = filled.args; rb = filled.rb;
      if (filled.filled) notes.push(`빈 바닥 덩이 ${filled.filled}곳을 방 쓰임에 맞는 가구 한 벌로 채웠다`);
    }
    // 위층과 계단.
    const mapIds = [builtMapId];
    let upperMapId = prev?.upperMapId;
    let upperArgs: Record<string, unknown> | undefined;
    if (stairsUp) {
      const up = buildUpperFloor(run, roomSpec, tilesetId, spec, builtMapId, stairsUp, upperMapId, missing, notes, placed);
      if (up.lowerLink && up.upperMapId) { args = { ...args, links: [up.lowerLink] }; upperMapId = up.upperMapId; upperArgs = up.upperArgs; mapIds.push(up.upperMapId); }
    }

    // 북쪽 뒷문(「뒤쪽 벽에 뒷문」) — 아치 문틀 + 뒷방 맵 한 쌍.
    let backDoor = prev?.backDoor;
    if (spec.exits?.includes("north")) {
      const door = addBackDoor(run, roomSpec, tilesetId, args, rb, builtMapId, spec.name, prev?.backDoor, /kitchen|storeroom|pantry|cellar|corridor|hall/u);
      args = door.args; notes.push(door.note);
      if (door.backDoor) { backDoor = door.backDoor; mapIds.push(door.backDoor.mapId); } else missing.push(door.note);
    }
    const final = build(run, args);
    if (!final.ok) return { ok: false, mapIds, summary: `마지막 짓기 실패: ${final.summary}`, warnings: notes, missingArt: missing, calls: run.calls };
    if (spec.exits?.some((e) => e === "east" || e === "west")) missing.push(`${spec.exits.filter((e) => e === "east" || e === "west").join("·")} 출구 — 손 도트 실내는 남쪽 출구와 북쪽 뒷문(아치 문틀)만 낸다`);
    // 요청한 주인공 물건이 끝까지 남았는지 — 크기 줄이기·다시 짓기에서 「큰 망원경」이 빠진 채 끝났다(2026-10-23 비교).
    const finalIds = new Set(((args.objects as Obj[]) ?? []).map((o) => o.id));
    for (const p of placed) if (!/계단|stair/iu.test(p.what) && !finalIds.has(p.id) && !p.zone.startsWith("2층")) missing.push(`${p.what}(${p.zone}) — 최종 맵에 없다(놓은 뒤 밀려났다)`);
    if (!vignette && !settled && !designed) {
      dressEmptyRooms(run, builtMapId, rooms.map((r) => ({ kind: r.kind, id: r.id, purpose: r.zone.purpose })), notes);
      if (upperMapId && mapIds.includes(upperMapId)) dressEmptyRooms(run, upperMapId, [], notes);
    }
    // 한 방짜리가 채운 뒤에도 맨바닥 30% 를 넘으면 한 단계 작은 크기로 다시 지어 본다 — 벽 쪽 자리가 없어 못 채우는 방은 방이 큰 것이다
    // (2026-10-28 연금술 공방 13×11 맨바닥 42%). 더 나아지면 그것을 쓰고, 아니면 되돌린다.
    if (!vignette && !settled && !designed && rooms.length === 1 && spec.size !== "small" && spec.hints?.downsized !== true) {
      const barePctOf = (id: string) => {
        const mm = run.ctx.project.maps[id];
        const l = (mm?.locations ?? []).find((q) => (q.tags ?? []).includes("hand-layout-room"));
        return mm && l ? roomBarePct(run.ctx.project, mm, { name: l.name, x0: l.x, y0: l.y, x1: l.x + l.w - 1, y1: l.y + l.h - 1 }) : 0;
      };
      const was = barePctOf(builtMapId);
      if (was > DRESS_ROOM_TARGET) {
        const snapshot = run.ctx.project;
        const smaller = interiorBuilder.build(run, { ...spec, size: spec.size === "large" ? "medium" : "small", mapId: builtMapId, hints: { ...(spec.hints ?? {}), downsized: true } }, previous) as PlaceBuildResult;
        const now = smaller.ok ? barePctOf(builtMapId) : Infinity;
        if (smaller.ok && now < was) return { ...smaller, warnings: [`방이 내용보다 커서(맨바닥 ${was}%) 한 단계 작게 다시 지었다(${now}%)`, ...smaller.warnings] };
        run.ctx.project = snapshot;
      }
    }
    if (designed) {
      const mm = run.ctx.project.maps[builtMapId];
      for (const l of (mm?.locations ?? []).filter((q) => (q.tags ?? []).includes("hand-layout-room"))) {
        const pct = mm ? roomBarePct(run.ctx.project, mm, { name: l.name, x0: l.x, y0: l.y, x1: l.x + l.w - 1, y1: l.y + l.h - 1 }) : 0;
        if (pct > 15) notes.push(`설계 방 ${l.name}: 맨바닥 ${pct}% — 15% 를 넘는다. design.w·h 를 줄이거나 묶음을 더해 다시 설계하라(함수는 가구를 더하지 않는다)`);
      }
    }
    const entrance = Array.isArray(final.data?.entrance) ? (final.data!.entrance as { x: number; y: number }[])[0] : undefined;
    const state: InteriorState = { tilesetId, mapId: builtMapId, args, ...(upperMapId ? { upperMapId } : {}), ...(upperArgs ? { upperArgs } : {}), placed, ...(backDoor ? { backDoor } : {}) };
    const result: PlaceBuildResult = {
      ok: true, mapIds,
      ...(entrance ? { entrance: { mapId: builtMapId, ...entrance } } : {}),
      summary: `${spec.name}: 방 ${rooms.length}개(${rooms.map((r) => r.kind).join("·")})${placed.length ? `, 주인공 물건 ${placed.map((p) => `${p.what}→${p.id}`).join(", ")}` : ""}${upperMapId && mapIds.includes(upperMapId) ? `, 위층 ${upperMapId} 계단으로 이음` : ""} — ${final.summary.slice(0, 200)}`,
      // 설계 방의 ㅁ자 경고는 모델이 고칠 수 있는 말로(모양 어휘·곁방) — 「알코브·칸막이」만 듣고 같은 네모를 여덟 번 다시 지었다(2026-10-29 3c Argon 귀족 서재).
      warnings: [...notes, ...((final.data?.warnings as string[] | undefined) ?? []).map((w) => designed && /ㅁ자/u.test(w)
        ? `${w.replace(/ — .*$/u, "")} — 설계 방이면 design.shape 를 L(ㄱ자)·U(ㄷ자)·T(ㅜ자)·bay(창가 돌출)·alcove(알코브)로 바꾸거나, 곁방 zone 을 하나 더 두어(각자 design) 공간을 나눈다. 모양별 최소 크기·설계 예시·그림은 room_parts 의 shapes`
        : w).slice(0, 6)],
      missingArt: missing, calls: run.calls, state,
    };
    return result;
  },
};
