// 장소 동사 — build_places(세계 장소 한 번에) · make_place · edit_place · review_layout · find_pieces.
import { doorHouseAt, doorHouseForName } from "../../place/doorHouse";
import { placeFactKey } from "../../place/placeGuess";
import { adoptGrownLayout } from "../../place/builders/interiorTierLayout";
import type { PiToolShape, PiToolExecResult } from "@/ai/piAgent/toolAdapter";
import { interiorCatalogCard, placeSpecKindOf } from "../../prompt/placeSpecs";
import { INTERIOR_WORDS } from "../../request/place";
import { hasLayout, layoutDeclNote } from "../../place/builders/interiorLayoutBuild";
import { LAYOUT_FORMAT, LAYOUT_TAG, applyLayoutPatch, layoutGiven, layoutPatchIsEmpty, patchedWholeLayout, type InteriorLayout, type LayoutPatch } from "../../place/interiorLayout";
import { layoutReviewRounds, REVIEWS_TAG } from "../../place/layoutReview";
import { effectiveSpec, findPieces, gameInteriorTable, interiorTilesetFor } from "../../place/interiorCatalog";
import { HAND_INTERIOR_TILESET_ID, roomSpecOf } from "@/editor/handInterior/builder";
import { builderFor } from "../../place/builders";
import { localizePlaceSpec } from "../../place/builders/modernCity";
import { localizeCultureSpec } from "../../place/builders/joseon";
import { isComposedWorld, parseWorldStyle, pickWorld, spareKind, worldKind, worldOf, worldPlaceSpec } from "../../place/world";
import type { GameBlueprintPlace } from "@/project/gameBlueprint";
import { villageLayoutGuide, cleanLayoutHint, villageArgs, villageMapSize, villageKindsLine, fixUnknownVillageKind, WALLED_BUILDINGS_LINE, VILLAGE_BUILDINGS_LINE, askedBuildingWords } from "../../place/builders/village";
import { codeTerrainFor, usesCodeTerrain, villageCliffHabitFor } from "@/editor/tools/authorBeodeulTown";
import { describeCodeTerrain } from "@/editor/tools/beodeulTerrainGen";
import { terrainPreviewPng } from "@/editor/tools/beodeulTerrainPreview";
import { interiorBuilder, layoutTableOf } from "../../place/builders/interior";
import { adoptExactInterior, interiorAddAnchors, interiorEditFromArgs } from "../../place/builders/interiorRebuild";
import { interiorStampEdit, type StampEditState } from "../../place/builders/interiorEdit";
import type { PlacePatch, PlaceRecord, PlaceSpec } from "../../shared/types";
import { blueprintMapFor } from "../../story/blueprintPathNames";
import { isPlaceholderMap } from "../../blankStart";
import { walkGame, isOutdoor } from "../../story/makeGame";
import { DUNGEON_LAYOUT_SCHEMA, LAYOUT_CRITIQUE_ROUNDS, LAYOUT_REPAIRS, VILLAGE_LAYOUT_SCHEMA, attachLayoutCritique, bboxDungeonSpec, bboxPlacesOn, bboxVillageSpec, dungeonLayoutCard, hasDungeonLayout, hasVillageLayout, layoutRejectText, layoutSession, toBboxTerrain, villageLayoutCard } from "../../place/builders/placeLayout";
import { gateFor, innerDungeonParent, innerGateSpot } from "../../place/dungeonGates";
import { DUNGEON_PLACE_WORD, requestedDungeonSide } from "../../request/place";
import { DUNGEON_DESIGN_SCHEMA, arrivalEntrance, dungeonContext, dungeonParts, screenDungeonSpec } from "../../place/dungeonParts";
import { buildsHandInterior, designMissingRooms } from "../../place/designRooms";
import { dropModelSeed } from "../../place/modelSeed";
import { V2_MAX_REPAIR_ROUNDS } from "../../turn/session";
import { SIZE, ROOM_DESIGN_SCHEMA, ZONE_SCHEMA, CONNECTIONS_SCHEMA, HINTS_SCHEMA, LAYOUT_SCHEMA, LAYOUT_PATCH_SCHEMA, PLACE_SPEC_SCHEMA, POINT } from "../placeSchema";
import { OPP_SIDE, LAYOUT_BOUNCES, repairCap, HAND_LAYOUT_ROOM_TAG, text, INTERIOR_PLACE, CLEAR_DUNGEON, renderMap, recordWrite, adoptInterior, applyPatch, dropPatchFill, withSetupDefaults, placeVariety } from "../support";
import { PAST_DESIGN_NOTE, composedRefusal, layoutPatchRefusal, noDesignRefusal, notRelaidRefusal } from "../placeMemory";
import { runTodoItemCheck } from "../../judge/todoChecks";
import { COVERABLE } from "../../loop/builderCover";
import { linkWorldRoom } from "../worldRoomLink";
import { recordArtGaps } from "@/project/artGap";
import { drawnThingNames } from "../../place/fixtures";
import type { VerbContext } from "../context";
import { keptPlaceResult } from "../../place/keepMapId";

/** createV2Tools 에서 뗀 것 — buildWorldPlaces · buildWorld · makePlace · editPlace · reviewLayout · findPiecesVerb. (placeVerbs) */
export function placeVerbs(c: VerbContext) {
  const { env, session, task, run, poolVillage, freshStart, lean, specShown, specGate, outsideBuilt, noteLayoutPlace, finishPlace, blueprintGate, interiorCardShown, showInteriorCard } = c;
  // 세계 짓기(world.ts): 청사진 장소 목록을 그 세계의 구성기로 한 번에 짓고 잇는다 — 모델은 장소 이름·종류만 정한다.
  // add 로 장소를 더할 수 있다(세는 맵이 모자랄 때). 종류를 못 읽으면 아직 덜 쓴 종류를 준다(막다른 길을 만들지 않는다).
  const buildWorldPlaces = async (toolCallId: string, verb: string, args: unknown, add: readonly { name?: unknown; kind?: unknown; from?: unknown; indoor?: boolean; danger?: boolean }[]): Promise<PiToolExecResult> => {
    const bp0 = env.ctx.project.gameBlueprint;
    const world = worldOf(env.ctx.project);
    if (!bp0 || !world) return text({ ok: false, summary: "No blueprint with a world yet — call write_blueprint first (places:[{name, kind}] from the [World of this game] card)." });
    const places: GameBlueprintPlace[] = [...(bp0.places ?? [])];
    const adjusted: string[] = [];
    for (const raw of add) {
      const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 60) : "";
      if (!name || places.some((pl) => pl.name === name)) continue;
      const asked = typeof raw.kind === "string" ? worldKind(world, raw.kind) : undefined;
      const used = places.map((pl) => pl.kind);
      const kind = asked ?? spareKind(world, used, { ...(raw.indoor !== undefined ? { indoor: raw.indoor } : {}), ...(raw.danger ? { danger: true } : {}) });
      if (!asked) adjusted.push(`«${name}» → ${kind.id}${typeof raw.kind === "string" && raw.kind.trim() ? ` (unknown kind «${raw.kind}»)` : ""}`);
      const from = typeof raw.from === "string" && places.some((pl) => pl.name === raw.from) ? raw.from : undefined;
      places.push({ name, kind: kind.id, ...(from ? { from } : {}) });
    }
    if (places.length !== (bp0.places?.length ?? 0)) env.ctx.project = { ...env.ctx.project, gameBlueprint: { ...bp0, places } };
    const before = new Set(Object.keys(env.ctx.project.maps));
    const notes = await session.buildPlaces!();
    const project = env.ctx.project;
    const exact = (name: string) => Object.values(project.maps).find((m) => (m.name ?? "").normalize("NFC").replace(/\s+/gu, "") === name.normalize("NFC").replace(/\s+/gu, ""));
    const rows = places.map((pl) => ({ place: pl, map: exact(pl.name) }));
    const mapIds = rows.flatMap((r) => (r.map ? [r.map.id] : []));
    const path = mapIds.length ? walkGame(project, mapIds) : undefined;
    const missing = rows.filter((r) => !r.map).map((r) => `«${r.place.name}»(${r.place.kind})`);
    const unreached = (path?.unreached ?? []).map((id) => `«${project.maps[id]?.name ?? id}»`);
    const built = mapIds.filter((id) => !before.has(id));
    const ok = !missing.length && !unreached.length;
    // 조사·퍼즐 단계가 있는 장소마다 거기 그려진 물건 이름 — 모델이 build_blueprint_path 의 steps[].on 으로 고르고 대사를 그 그림에 맞춘다.
    const thingPlaces = [...new Set((project.gameBlueprint?.steps ?? []).filter((st) => st.kind === "find" || st.kind === "puzzle").map((st) => st.place))];
    const things = thingPlaces.flatMap((name) => { const map = exact(name); const names = map ? drawnThingNames(project, map, 8) : []; return names.length ? [`«${name}»: ${names.join(", ")}`] : []; });
    const summary = [
      `${world.name}: ${mapIds.length}/${places.length} places stand${built.length ? ` (${built.length} built now)` : ""} — ${rows.filter((r) => r.map).map((r) => `«${r.place.name}» ${r.place.kind} ${r.map!.width}×${r.map!.height} mapId=${r.map!.id}`).join(" · ")}.`,
      ...(adjusted.length ? [`Kinds chosen by code: ${adjusted.join("; ")}.`] : []),
      ...(missing.length ? [`Not built: ${missing.join(", ")} — ${notes.filter((n) => /실패|없다/u.test(n)).join(" / ").slice(0, 400)}`] : []),
      ...(unreached.length ? [`Not reachable on foot from the start: ${unreached.join(", ")} — link each with create_transfer_pair.`] : [`Every place is reachable on foot from the start («${project.maps[project.startMapId]?.name ?? project.startMapId}»).`]),
      ...(things.length ? [`Things drawn where a find/puzzle step happens (name one as that step's «on»): ${things.join(" · ")}.`] : []),
      ok ? "Next: build_blueprint_path once, then people and events per place (add_people, add_event). These maps are laid by composers in one pass — do not rebuild them with make_place or edit_place." : "",
    ].filter(Boolean).join(" ");
    recordWrite(env, run, toolCallId, verb, args, ok, summary, { mapIds });
    await env.checkpoint(verb);
    return text({ ok, summary, mapIds, links: notes.slice(0, 16) });
  };
  const buildWorld: PiToolShape = {
    name: "build_places", label: "세계 짓기", concurrency: "exclusive",
    description: "Build every place listed in the blueprint (write_blueprint places) with this game's world and link them (doors, roads) in one call — you only name places and pick kinds. Places that already stand are kept. add:[{name, kind, from?}] adds more places to the blueprint and builds them (kinds from the [World of this game] card).",
    parameters: { type: "object", properties: { add: { type: "array", description: "(optional) more places to add and build", items: { type: "object", properties: { name: { type: "string" }, kind: { type: "string", description: "place kind id from the [World of this game] card" }, from: { type: "string", description: "name of the place it is entered from" } }, required: ["name", "kind"] } } } },
    async execute(id, params) {
      const gate = await blueprintGate();
      if (gate) return text(gate);
      const add = Array.isArray((params as { add?: unknown })?.add) ? ((params as { add: unknown[] }).add.filter((x) => x && typeof x === "object") as { name?: unknown; kind?: unknown; from?: unknown }[]) : [];
      return buildWorldPlaces(id, "build_places", params, add);
    },
  };
  const makePlace: PiToolShape = {
    name: "make_place", label: "장소 짓기", concurrency: "exclusive",
    description: "Build a place (interior, village, dungeon, cave, street, house) from one spec. Do not write cells, coordinates or tile numbers — the function builds it and returns the 1x picture, machine checks and an independent critique."
      + (bboxPlacesOn() ? " Exception: for a dungeon floor (type dungeon) and a village on code terrain the first call returns a card asking for your exact cell layout (spec.dungeonLayout / spec.villageLayout) — then write it as the card says." : ""),
    parameters: { type: "object", properties: { spec: PLACE_SPEC_SCHEMA }, required: ["spec"] },
    async execute(id, params) {
      // 모델이 이 장소에 적은 종류는 어느 관문에서 돌려보내져도 남긴다 — 끝맺음 자동 짓기가 이름으로 추측하기 전에 읽는다(place/placeGuess.placeSpecFor).
      { const said = (params as { spec?: Partial<PlaceSpec> })?.spec; if (said?.name && said.type) session.notePlaceFact(said.name, { kind: said.type }); }
      const gate = await blueprintGate();
      if (gate) return text(gate);
      // 구성기 세계의 게임이면 장소는 그 세계의 종류로 짓는다 — 다른 칩셋(버들항 마을·동굴)이 섞이지 않게 make_place 도 세계 짓기로 보낸다.
      {
        const asked = (params as { spec?: Partial<PlaceSpec> })?.spec;
        if (isComposedWorld(worldOf(env.ctx.project)) && asked?.name && !parseWorldStyle(asked.style)) {
          if (blueprintMapFor(env.ctx.project, asked.name) && !(env.ctx.project.gameBlueprint?.places ?? []).some((pl) => pl.name === asked.name)) return text({ ok: false, summary: `«${asked.name}» already stands and this world's maps are laid by composers in one pass — it is not rebuilt. Add another place with build_places{add:[{name, kind}]}.` });
          const indoor = asked.type === "interior" || asked.type === "house";
          return buildWorldPlaces(id, "make_place", params, [{ name: asked.name, indoor, danger: asked.type === "dungeon" || asked.type === "cave" }]);
        }
      }
      // 청사진 없이도: 손댄 맵이 구성기 세계의 칩셋이면(낱말 없는 마을이 칩셋 풀에서 그 세계로 지어졌다) 뒤이은 새 장소는 그 세계의 종류로 짓는다.
      // 손 도트 실내·버들항 숲길은 다른 칩셋 계열이라 도구 실행기가 거절한다(2026-11-11 map-vqa 깔기 village-chief-house: 풀 마을 뒤 «촌장 집» 실내가 끝내 서지 못했다).
      {
        const asked = (params as { spec?: Partial<PlaceSpec> })?.spec;
        // 그 세계의 실내 종류를 화풍으로 적어 온 호출(world:<세계>:<방>)도 여기서 짓는다 — 종전 길은 방을 짓기만 하고 집 문에 잇지 않았다.
        const styled = parseWorldStyle(asked?.style);
        const lived = asked?.name && !env.ctx.project.gameBlueprint && !String(asked.style ?? "").startsWith("pool:") ? pickWorld(env.ctx.project, undefined, "") : undefined;
        const world = !styled || (styled.kind.indoor && styled.world === lived) ? lived : undefined;
        // 그 세계의 종류로 이미 선 장소에 손 도트 칸 배치나 다른 종류가 또 오면 다시 짓지 않는다(계열 거절 · 한 번에 짓는 맵) — 선 맵을 돌려주고 쓰지 않았다고 알린다.
        const stands = lived && asked?.name ? blueprintMapFor(env.ctx.project, asked.name) : undefined;
        const standsAs = stands ? parseWorldStyle(session.placeOf(stands.id)?.spec.style) : undefined;
        // 화풍으로 다른 종류를 적어 온 호출은 풀 마을(기록된 화풍 pool:<칩셋>)에도 답한다 — 종전에는 같은 이름의 맵이 한 장 더 섰다(이어지지 않은 «새벽 마을» 둘).
        if (stands && lived && (standsAs ? layoutGiven(asked?.layout) || styled : styled && stands.tilesetId === lived.tilesetId)) return text({ ok: true, mapIds: [stands.id], summary: `«${stands.name}» already stands${standsAs ? ` as the «${standsAs.kind.id}» kind of ${standsAs.world.name}` : ` in ${lived.name}`} (${stands.id}, ${stands.width}×${stands.height}). ${layoutGiven(asked?.layout) ? "The cell layout you sent was not used: this project's maps use that chipset and cell layouts belong to another one." : "It is laid by a composer in one pass and is not rebuilt as another kind — for a place of another kind call make_place with another place name and that style."} Put single things in it with place_object, add_people or move_event.` });
        if (world && asked?.name && !blueprintMapFor(env.ctx.project, asked.name) && !(asked.mapId && env.ctx.project.maps[asked.mapId])) {
          const want = styled ? { indoor: true, danger: !!styled.kind.danger } : { indoor: asked.type === "interior" || asked.type === "house", danger: asked.type === "dungeon" || asked.type === "cave" };
          // 종류: 장소 이름·테마가 그 세계 종류의 이름을 말하면 그것, 실내면 그 세계의 살림집(home)이나 가장 작은 방(오두막·선실 — 누구의 집·가게로도 읽힌다), 아니면 덜 쓴 종류.
          const said = `${asked.name} ${asked.theme ?? ""}`.toLowerCase();
          const fits = world.kinds.filter((k) => !!k.indoor === want.indoor && !!k.danger === want.danger);
          const named = styled?.kind ?? fits.find((k) => said.includes(k.id.replace(/-/gu, " ")) || k.ko.split(/\s+/u).some((w) => w.length >= 2 && said.includes(w)));
          // 실내 종류가 없는 세계(전국·SF 정거장)의 실내 요청을 바깥 종류로 짓지 않는다 — «촌장 집» 이 농촌 마을 한 장으로 서고 장소 확인은 ✓ 였다.
          if (want.indoor && !fits.length) {
            recordArtGaps(session, [{ chipset: world.tilesetId, want: "indoor-kind", wanted: "실내 종류", where: asked.name, standIn: "none", by: "make_place" }]);
            const cur = session.todo.current();
            return text({ ok: false, summary: `«${asked.name}» was not built: ${world.name} has no indoor place kind yet (its kinds are all outdoor: ${world.kinds.map((k) => k.id).join(", ")}), and this project's maps use that chipset — a room from another chipset is not mixed in. It is recorded as missing art for the report.${cur ? ` Next call: todo({"op":"block","task":${JSON.stringify(cur.id)},"reason":"${world.name} has no indoor place kind, so this room cannot be built in the project's chipset"})` : ""}` });
          }
          const area = (k: (typeof fits)[number]) => (k.compose?.size[0] ?? 99) * (k.compose?.size[1] ?? 99);
          const kind = named ?? (want.indoor && fits.length ? fits.find((k) => k.home) ?? [...fits].sort((x, y) => area(x) - area(y))[0]! : spareKind(world, [...session.places.values()].flatMap((r) => parseWorldStyle(r.spec.style)?.kind.id ?? []), want));
          const others = fits.filter((k) => k !== kind).map((k) => `"world:${world.id}:${k.id}" (${k.about})`).join(", ");
          // 모델이 적은 «다른 맵으로 나가는 변» 은 그대로 넘긴다 — 구성기가 그 가장자리까지 길을 낸다(전에는 버려져 섬·항구에 나가는 길이 없었다).
          const spec: PlaceSpec = { ...worldPlaceSpec(world, kind, asked.name), salt: Math.floor(Math.random() * 1_000_000), variety: placeVariety(env, task), ...(!kind.indoor && asked.exits?.length ? { exits: asked.exits } : {}) };
          const builder = builderFor(spec);
          if (builder) {
            env.emit({ type: "execution_status", name: "v2.build", ok: true, summary: `${spec.name} 짓는 중(${builder.id} — ${world.id}:${kind.id})` });
            await builder.prepare?.(spec);
            const built = builder.build(run, spec);
            // 실내 종류는 이 세계의 바깥 장소 집 문에 바로 단다 — 잇기를 모델에게 넘기면 그 동사가 요청의 도구 목록에 없을 수 있다.
            const linked = built.ok && kind.indoor ? linkWorldRoom(c, world, kind, spec, built) : "";
            const note = `«${asked.name}» was built as the «${kind.id}» kind of ${world.name} (${kind.about}): this project's maps use that chipset, so other chipsets and your own cell layout are not mixed in.${others ? ` For a place of another kind, call make_place with another place name and style ${others}.` : ""}${linked}`;
            return finishPlace(id, "make_place", params, spec, builder.id, withSetupDefaults({ ...built, warnings: [note, ...built.warnings] }, builder.id, run.ctx.project, String(task ?? ""), freshStart, session.stageWrites), 0);
          }
        }
      }
      const specFirst = specGate("make_place", placeSpecKindOf((params as { spec?: PlaceSpec })?.spec?.type));
      if (specFirst) return specFirst;
      // 같은 요청 → 같은 맵을 막는다(2026-10-23 다양성: 역전 상점가가 v1·v2·4차·5차 모두 화소까지 같았다). 고치기는 기록된 명세의 salt 를 물려받는다.
      // 씨앗은 모델이 정하지 않는다 — 요청·게임 열쇠(variety)로 빌더가 정한다(2026-10-29: terra 가 seed 0·1·2 를 채워 동굴 8장이 세 무리로 같았다).
      const raw0 = (params as { spec: PlaceSpec }).spec;
      const { seed: _modelSeed, ...rawHints } = (raw0.hints ?? {}) as Record<string, string | number | boolean>;
      const raw: PlaceSpec = raw0.hints ? { ...raw0, hints: rawHints } : raw0;
      // 던전·동굴은 세션 덧값도 섞는다 — 같은 시작 저장본의 같은 요청을 다른 세션에서 받아도 같은 굴이 되지 않게(2026-10-31 씬 벤치 보스 방 opus 3판).
      const varietyKey = placeVariety(env, task) + (raw.type === "dungeon" || raw.type === "cave" ? `|${session.nonce}` : "");
      let keptNoteEarly = "";
      let spec: PlaceSpec = poolVillage(localizeCultureSpec(localizePlaceSpec(dropModelSeed({ ...raw, salt: Math.floor(Math.random() * 1_000_000), variety: varietyKey }, true), String(task ?? "")), String(task ?? ""), run.ctx.project));
      // 없는 맵 id 는 버리고 새 맵에 짓는다 — flash 가 타일셋 id(beodeul_city)를 mapId 로 보내 「맵이 없습니다」로 한 채도 못 지었다(2026-10-29 b5 강가 마을).
      // 빈 mapId("" — 엄격 스키마가 채운 칸)도 «안 줬다» 다: 그대로 두면 같은 방을 다시 보낼 때마다 같은 이름의 새 맵이 생겼다(2026-11-11 map-vqa 깔기 재생: 「무기 가게」 5장).
      if (spec.mapId !== undefined && !run.ctx.project.maps[spec.mapId]) { const { mapId: _gone, ...rest } = spec; spec = rest; }
      // 실내형 장소(감옥·여관·가게·서재…)는 요청이 던전을 분명히 말하지 않으면 실내 칸 배치 길로 짓는다(2026-10-31 감독 결정 — 성 지하 감옥 4판이
      // 모두 던전 경로로 지어져 실내 안내가 닿지 않았다). 던전·미궁·동굴 낱말이 요청에 있거나 모델이 dungeonDesign 을 쓴 판은 그대로 둔다.
      if ((spec.type === "dungeon" || spec.type === "cave") && !spec.dungeonDesign && !spec.floorDesigns?.length) {
        const req = String(task ?? "");
        const placeText = `${spec.name} ${spec.theme ?? ""}`;
        if (INTERIOR_PLACE.test(`${placeText} ${req}`) && !CLEAR_DUNGEON.test(req) && !CLEAR_DUNGEON.test(placeText)) {
          spec = { ...spec, type: "interior" };
          keptNoteEarly = `"${spec.name}" is an interior place (not a dungeon crawl), so it is built on the interior path — write spec.layout for it.`;
        }
      }
      // 이 장소로 청한 명세를 적어 둔다(거절돼도 남는다) — 끝맺음이 이 장소를 대신 지을 때 종류를 이름으로 추측하지 않고 이것을 쓴다(place/placeGuess.placeSpecFor).
      session.notePlaceFact(spec.name ?? "", { asked: spec });
      // 이번 실행에서 이미 다른 장소를 지은 맵 위에 새 장소를 짓지 않는다 — 「지하 예배당」을 지은 맵에 「검은 장미 저택」을 다시 지어
      // 예배당이 1층 한 구석으로 사라졌다(2026-10-25 조수 단독 게임 G27). 같은 장소를 다시 짓는 것(이름이 같거나 한쪽이 다른 쪽을 품음)은 그대로 둔다.
      const target = spec.mapId ?? (spec.type === "interior" ? (run.ctx.currentMapId ?? run.ctx.project.startMapId) : undefined);
      const other = target ? session.places.get(target) : undefined;
      const norm = (s: string) => s.replace(/\s+/gu, "");
      const samePlace = (a: string, b: string) => { const [x, y] = norm(a).length <= norm(b).length ? [norm(a), norm(b)] : [norm(b), norm(a)]; return !!x && (y === x || y.startsWith(x) || y.endsWith(x)); };
      let keptNote = keptNoteEarly;
      /** 땅 그림 답이 없는 마을의 첫 결과 끝에 붙는 종류 목록 · 건물 청하는 법(지은 뒤에 붙는다). */
      let menuNote = "";
      if (other && !samePlace(other.spec.name, spec.name)) {
        const { mapId: _drop, ...rest } = spec;
        spec = { ...rest, hints: { ...(spec.hints ?? {}), newMap: true } };
        keptNote = `「${other.spec.name}」(${target}) 는 이번에 지은 다른 장소라 덮지 않고 「${spec.name}」을 새 맵에 지었다 — 두 장소를 create_transfer_pair 로 잇는다(계단·문).`;
      }
      // 이 실내가 어느 문 뒤인가(hints.door — 마을 결과의 문 앞 칸): 그 문이 달린 건물의 칩셋·킷을 명세에 적는다. 모델이 고른 문이므로 건물의 크기 단을 따른다
      // (큰 건물이면 구성 표의 방들, 칸 배치가 왔으면 방 수를 본다). 전에는 모델이 직접 부른 실내에 킷이 닿지 않아 크기 단이 한 번도 붙지 않았다(2026-11-16 r6 대성당).
      let doorNote = "";
      if (spec.type === "interior" && Array.isArray(spec.hints?.door)) {
        const [dx, dy] = (spec.hints!.door as unknown[]).map(Number);
        const { door: _door, ...restHints } = spec.hints as Record<string, unknown>;
        const hosts = [env.ctx.currentMapId, ...[...session.places.entries()].filter(([, r]) => isOutdoor(r.spec)).map(([id]) => id).reverse()].filter((id): id is string => !!id && !!env.ctx.project.maps[id] && id !== spec.mapId);
        const hit = Number.isInteger(dx) && Number.isInteger(dy) ? hosts.map((id) => doorHouseAt(env.ctx.project, id, dx!, dy!)).find(Boolean) : undefined;
        spec = { ...spec, hints: restHints as PlaceSpec["hints"], ...(hit ? { exterior: { tileset: hit.tileset, kit: hit.kit, asked: true } } : {}) };
        doorNote = hit ? `hints.door (${dx},${dy}) = «${hit.label}» (${hit.kit}${hit.tier ? `, ${hit.tier}` : ""}) — the inside follows that building.`
          : `hints.door (${String(dx)},${String(dy)}) is not a house door on the outdoor map — ignored (use a door cell from the village result's door list).`;
      } else if (spec.type === "interior" && !spec.exterior && !spec.mapId && spec.name) {
        // hints.door 없이 온 실내: 바깥 맵의 아직 이어지지 않은 문 가운데 장소 이름이 가리키는 건물(칩셋 킷 이름)의 문이 있으면 그 건물의 안으로 짓는다(2026-11-17 r8 D2).
        const hosts = [env.ctx.currentMapId, ...[...session.places.entries()].filter(([, r]) => isOutdoor(r.spec)).map(([id]) => id).reverse(), env.ctx.project.startMapId].filter((id): id is string => !!id && !!env.ctx.project.maps[id]);
        const hit = doorHouseForName(env.ctx.project, [...new Set(hosts)], spec.name);
        if (hit) {
          spec = { ...spec, exterior: { tileset: hit.tileset, kit: hit.kit } };
          doorNote = `«${spec.name}» is laid as the inside of «${hit.label}» (${hit.kit}${hit.tier ? `, ${hit.tier}` : ""}) — its door at (${hit.front.x},${hit.front.y}) on ${hit.mapId} is not linked yet; link it with create_transfer_pair (or send hints.door to pick another door).`;
        }
      }
      // 이 실내에서 내려가는 장소(청사진 places 의 던전 · 굴, from = 이 장소)가 있으면 빌더에 알린다 — 큰 건물 구성이 지하 맵을 따로 짓지 않고
      // 모델의 계단을 그 장소로 남긴다(내려가는 길이 둘이 되지 않게, 2026-11-17 r8 D1). 낱말이 아니라 청사진의 사실로 정한다.
      if (spec.type === "interior" && spec.name) {
        const here = placeFactKey(spec.name);
        const fromFacts = [...session.placeFacts.entries()].filter(([, f]) => f.from && placeFactKey(f.from) === here && (f.kind === "dungeon" || f.kind === "cave")).map(([k, f]) => f.name ?? k);
        const fromBp = (env.ctx.project.gameBlueprint?.places ?? []).filter((pl) => pl.from && placeFactKey(pl.from) === here && (pl.kind === "dungeon" || pl.kind === "cave")).map((pl) => pl.name);
        const below = [...fromBp, ...fromFacts.filter((k) => !fromBp.some((n) => placeFactKey(n) === placeFactKey(k)))][0];
        if (below) spec = { ...spec, hints: { ...(spec.hints ?? {}), placeBelow: below } };
      }
      // 손 도트 실내 방은 조수가 설계한다: 설계(zones[].design) 없이 오면 장소마다 한 번 되돌려 보낸다. 다시 설계 없이 오면 짓기 전에 같은 모델에게 따로 설계를 받는다(designRooms.ts).
      // 손 도트 실내로 지어지는지는 빌더와 같은 함수로 본다 — style:modern 이어도 주인공 물건 때문에 v5 로 짓는 방이 견본 서재로 섰다(2026-10-29 vm8 flash 방탈출).
      // 칸 배치(spec.layout)가 정본 경로다 — zones[].design 을 들고 와도 장소마다 한 번은 칸 배치로 돌려보낸다(2026-10-31 4회차: terra 가 design 으로 10×10 한 칸 서재를 지었다).
      // mapId 가 와도(엄격 스키마 모델은 지금 맵 id 를 채워 보낸다 — 4회차 terra 서재) 한 번은 돌려보낸다.
      if (spec.type === "interior" && !hasLayout(spec) && buildsHandInterior(run.ctx.project, spec)
        && (session.designBounced.get(spec.name) ?? 0) < LAYOUT_BOUNCES) {
        // 세 번까지 돌려보낸다 — 한 번만 돌려보내면 terra 가 같은 zones/design 을 다시 보내 옛 설계 길로 지어졌다(4회차 terra-high 12판 중 6판).
        const bounces = (session.designBounced.get(spec.name) ?? 0) + 1;
        session.designBounced.set(spec.name, bounces);
        // 재료(기물 이름표·견본 배치)를 같이 돌려준다 — 되돌려 보내기를 «실패»로 읽고 짓기를 그만둔 모델이 있었다(2026-10-29 flash 「마법사의 서재」).
        // 칩셋 목록 카드가 지시문에 없었으면(실내 낱말 없는 요청) 여기서 한 번 싣는다.
        // 바깥 칩셋의 표(버들항)로 검사될 장소면 그 표의 카드를 준다 — 지시문의 카드가 다른 칩셋의 것일 수 있다(턴을 시작한 뒤 마을이 섰다).
        const table = layoutTableOf(env.ctx.project, spec, env.ctx.currentMapId);
        const ownTable = table !== HAND_INTERIOR_TILESET_ID;
        const cardShown = ownTable ? interiorCardShown(table) : lean ? specShown("interior") : INTERIOR_WORDS.test(String(task ?? "")) || env.ctx.project.maps[env.ctx.currentMapId ?? ""]?.tilesetId === HAND_INTERIOR_TILESET_ID;
        return text({ ok: false, notFailure: true, ...(cardShown ? {} : { catalog: (ownTable ? showInteriorCard(table) : undefined) ?? interiorCatalogCard(env.ctx.project, env.ctx.currentMapId, String(task ?? ""), String(env.request.projectKey ?? "")) }), summary: `Not built yet (not a failure) — you design "${spec.name}" cell by cell.${bounces > 1 ? ` This is reminder ${bounces}/${LAYOUT_BOUNCES}: hand-pixel interiors are built from spec.layout; zones, design and anchors are not used for them — send the place with spec.layout and nothing in zones.` : ""} Call make_place again with spec.layout: ${LAYOUT_FORMAT}. Ids are in the [Interior catalog] card; the grid rules are in the interior card. One place is one map with the rooms it needs (an inn: hall, kitchen, stairs, guest rooms; a jail: guard room, corridor, cells). Code lays the layout exactly and checks it.`,
          });
      }
      const builder = builderFor(spec);
      if (!builder) {
        session.missingArt.add(`${spec.name}(${spec.type}${spec.style ? `·${spec.style}` : ""}) — 이 종류를 짓는 빌더가 없다`);
        return text({ ok: false, summary: `${spec.type}${spec.style ? `(${spec.style})` : ""} 을 짓는 빌더가 없다. 다른 type 으로 바꾸거나 사용자에게 못 한다고 알린다.` });
      }
      // 던전·동굴도 조수가 설계한다(방 설계와 같은 원칙): dungeonDesign 없이 오면 장소마다 한 번 되돌려 보낸다. 다시 없이 오면 함수 배치로 짓는다.
      if (builder.id === "dungeon") {
        const sc = screenDungeonSpec(spec, run.ctx.project.maps, session.dungeonBounced);
        spec = sc.spec;
        if (sc.bounce) return text(sc.bounce);
        if (sc.note) keptNote = [keptNote, sc.note].filter(Boolean).join(" ");
        const ar = arrivalEntrance(spec); spec = ar.spec;
        if (ar.note) keptNote = [keptNote, ar.note].filter(Boolean).join(" ");
        // 바깥 문: 지금 보는 맵이 이번에 지은 마을·거리면 던전이 놓인 쪽(설계 입구의 반대) 가장자리 길 칸과 짓기가 바로 잇는다(dungeonGates.ts).
        // 지금 보는 맵이 이번에 지은 마을이 아니면(마을을 새 id 로 다시 지은 판 — 보는 맵은 옛 id 에 남는다) 이번에 지은 마지막 바깥 장소에 잇는다.
        // 요청이 그 장소의 방향을 말하면(「서쪽 길 끝 동굴」) 설계 입구 쪽보다 그 방향을 먼저 쓴다(2026-10-30 실조수: 문이 강 동쪽 풀밭에 섰다).
        // 「지하 던전 가장 안쪽에 보스 방」: 이미 있는 던전 «안쪽»에 짓는 새 장소는 그 던전의 가장 먼 칸과 잇는다 — 짓기 도구 기본 출구가 보는 맵(마을)에
        // 이어 보스 방이 마을 가장자리에서도 들어가지고, 두 맵에서 이어진 탓에 다시 짓기도 막혔다(2026-10-30 omo-loop-1030b terra boss-room r1~r3).
        if (!spec.gate && !(spec.mapId && session.places.has(spec.mapId))) {
          const parent = innerDungeonParent(env.ctx.project, String(task ?? ""), spec.name);
          const spot = parent ? innerGateSpot(env.ctx.project, parent) : undefined;
          if (parent && spot) {
            spec = { ...spec, gate: { fromMapId: parent.id, x: spot.x, y: spot.y } };
            keptNote = [keptNote, `요청이 「${parent.name}」 안쪽이라 「${parent.name}」(${parent.id})에서 걸어서 가장 먼 칸 (${spot.x},${spot.y})과 이 장소 입구를 짓기가 바로 잇는다 — create_transfer_pair 로 또 잇지 않는다.`].filter(Boolean).join(" ");
          }
        }
        const cur = env.ctx.currentMapId;
        const outside = cur && outsideBuilt(cur) ? cur : [...session.places.keys()].filter((m) => outsideBuilt(m) && env.ctx.project.maps[m]).pop();
        if (!spec.gate && outside && !(spec.mapId && session.places.has(spec.mapId))) { const g = gateFor(env.ctx.project, outside, spec.dungeonDesign, requestedDungeonSide(String(task ?? ""))); if (g) spec = { ...spec, gate: g }; }
      }
      // 칸 배치 던전(2026-10-31): 설계·배치 없이 온 던전은 영어 카드(조각 목록·견본 그림·규칙·형식)로 되돌려 보낸다 — 모델이 칸 배치(spec.dungeonLayout)를 쓴다.
      // 옛 설계(dungeonDesign)를 먼저 채워 와도(terra 는 스키마 칸을 다 채운다) 카드는 장소마다 한 번 보여 준다 — 그다음에도 배치가 없으면 옛 빌더.
      if (builder.id === "dungeon" && bboxDungeonSpec(spec) && !hasDungeonLayout(spec) && !(spec.mapId && session.places.has(spec.mapId)) && !layoutSession(session).cards.has(`dungeon:${spec.name}`)) {
        layoutSession(session).cards.add(`dungeon:${spec.name}`); session.dungeonBounced.add(spec.name);
        return dungeonLayoutCard(env, spec, String(task ?? ""), dungeonContext(session.places.values(), spec.name));
      }
      if (builder.id === "dungeon" && !(spec.mapId && session.places.has(spec.mapId)) && !spec.dungeonDesign && !spec.floorDesigns?.length && !session.dungeonBounced.has(spec.name)) {
        session.dungeonBounced.add(spec.name);
        const parts = dungeonParts(`${spec.theme ?? ""} ${spec.name} ${spec.type}`, `${String(env.request.projectKey ?? run.ctx.project.meta.title ?? "")}|${session.nonce}`, dungeonContext(session.places.values(), spec.name));
        return text({ ok: false, notFailure: true, summary: `아직 짓지 않았다(실패 아님) — 「${spec.name}」의 층은 네가 설계한다. 아래 parts(방 모양·역할·물·특징·잇는 모양, 뼈대가 다른 예시)를 보고 spec.dungeonDesign 을 채워 make_place 를 바로 다시 부르면 지어진다: `
          + `entrance(플레이어가 들어오는 길 쪽 — 이 굴로 오는 마을 출구·세계 배치에 맞춘다, parts.context)·rooms[{id, role(entrance 하나·boss 하나·treasure·lake·camp·shrine·hall·grotto), size, shape(blob·cavern·long·shaft·ring·twin), at("x,y" 0~1 — 방마다 다르게), level(0 바닥·1 한 단·2 두 단 — 높이가 다른 방 사이에 돌계단), water(none·pool·lake·stream), features}]·links[{from,to,kind}]. `
          + `무엇이 사는 굴인지·어디가 위험한지·무엇을 숨겼는지에 맞게 방 수(보통 5~7, 작은 굴 3~4·큰 굴 8~10)·자리·모양·길을 네가 정한다 — 함수는 겹침·길·도달만 고쳐 알린다. 예시는 참고, 베끼지 않는다. 그림은 dungeon_parts.`, parts });
      }
      // 마을(2026-10-30 「지형은 코드가, 마을 배치는 조수가」): 땅은 코드가 만든다(높이맵·침식·강·단). 첫 호출은 짓지 않고 땅 그림(좌표 눈금)과
      // 요약을 돌려준다 — 모델이 그 그림을 보고 hints.layout 에 자리를 골라 다시 부르면 같은 땅 위에 짓는다(함수는 놓을 수 있는지·길·도달만 검사).
      if (builder.id === "village") {
        // 스키마 칸을 0·빈 값으로 다 채우는 모델(terra)이 있다 — {x:0,y:0} 자리·빈 배열·terrainSeed 0 은 「안 줬다」로 읽는다(2026-10-30 실조수: 빈 layout 으로 집 0채)
        if (spec.hints) {
          const h = { ...spec.hints } as Record<string, unknown>;
          if (h.terrainSeed === 0) delete h.terrainSeed;
          const lay = cleanLayoutHint(h.layout); if (lay) h.layout = lay; else delete h.layout;
          spec = { ...spec, hints: h as typeof spec.hints };
        }
        // 모르는 마을 종류(hints.kind) · 모르는 요청 건물: 거절하지 않는다(2026-11-16 오너 «거절은 게임이 깨질 때만»). 종류는 가장 가까운 종류로 고쳐 짓고
        // (가까운 것이 없으면 게임이 고른다), 건물은 시공기가 가장 가까운 킷으로 세운다 — 무엇으로 지었는지와 전체 목록을 결과 글에 적는다.
        const firstBuild = !(spec.mapId && session.places.has(spec.mapId));
        const va = villageArgs(spec).args; const vt = String(va.theme ?? "river");
        const kindFix = vt === "river" || vt === "coast" ? fixUnknownVillageKind(spec) : undefined; // 종류는 강가·포구 마을에만 있다
        if (kindFix) { spec = kindFix.spec; keptNote = [keptNote, kindFix.note].filter(Boolean).join(" "); }
        // 땅 그림 답이 없는 강가·포구 마을(성벽 마을 · 띠 지형): 종류 목록도 건물 청하는 법도 볼 자리가 없었다. 첫 호출은 그대로 짓고(되돌리지 않는다),
        // 결과 글 끝에 그 둘을 한 번 싣는다 — 성벽 마을에 이어 짓는 다음 마을과 손으로 찍는 건물에 쓴다.
        // 왜 되돌리지 않나(2026-11-16 명세 은행 lay-main-castle): 한 번 «Not built yet» 으로 돌려보냈더니 모델이 다시 부르지 않고 다음 할 일로 넘어가
        // 성벽 왕궁 맵이 «빈 맵» 으로 남았다. 거절은 게임이 깨질 때만이고, 짓지 않은 채 돌려보내는 것도 같은 값을 치른다.
        if (!usesCodeTerrain(va, vt) && (vt === "river" || vt === "coast") && firstBuild && !bboxVillageSpec(spec) && typeof spec.hints?.kind !== "string" && !askedBuildingWords(spec.hints?.buildings).length
          && !kindFix && !layoutSession(session).cards.has(`village-menu:${spec.name}`)) {
          layoutSession(session).cards.add(`village-menu:${spec.name}`);
          menuNote = `${villageKindsLine(vt, va.walls === true ? "none" : va.water, String(env.request.projectKey ?? "")) ?? ""} ${WALLED_BUILDINGS_LINE}`.trim();
        }
        if (usesCodeTerrain(va, vt)) {
          const shape = JSON.stringify([va.theme, va.landform, va.terrain, va.water, va.high, va.tiers, spec.hints?.terrainSeed]);
          const kept = session.villageTerrain.get(spec.name);
          // 칸 배치 마을: 카드를 장소마다 한 번은 보여 준다(옛 hints.layout 을 먼저 채워 와도). 그 뒤 villageLayout 없이 hints.layout 이면 옛 빌더.
          const bboxCardDue = bboxVillageSpec(spec) && !hasVillageLayout(spec) && !layoutSession(session).cards.has(`village:${spec.name}`);
          const hasLayout = !bboxCardDue && ((!!spec.hints?.layout && typeof spec.hints.layout === "object") || hasVillageLayout(spec));
          if (!hasLayout && (!kept || (kept.shape !== shape && kept.previews < 3))) {
            const [width, height] = villageMapSize(spec, va);
            const terrainSeed = typeof spec.hints?.terrainSeed === "number" ? Math.max(0, Math.floor(spec.hints.terrainSeed)) : (spec.salt ?? 0) % 100000;
            const terrain = codeTerrainFor(vt, va, width, height, terrainSeed, villageCliffHabitFor(env.ctx));
            session.villageTerrain.set(spec.name, { terrainSeed, width, height, shape, previews: (kept?.previews ?? 0) + 1 });
            // 칸 배치 마을(2026-10-31): 땅 그림·격자·요약·조각 목록(영어)을 주고 spec.villageLayout 을 받는다.
            if (bboxVillageSpec(spec)) { layoutSession(session).cards.add(`village:${spec.name}`); return villageLayoutCard(env, spec, String(task ?? ""), toBboxTerrain(terrain, vt)); }
            const res = text({ ok: false, notFailure: true,
              summary: `아직 짓지 않았다(실패 아님) — 「${spec.name}」의 땅을 코드가 만들었다(${width}×${height}, terrainSeed ${terrainSeed}). 아래 그림(좌표 눈금: 위 x·왼쪽 y, 칸 단위)과 요약을 보고 `
                + `마을 자리를 네가 고른다 — 같은 make_place 에 hints.layout 을 넣어 다시 부르면 이 땅 위에 짓는다. ${villageLayoutGuide(vt, va.fishing === true, va.form === "scatter")} 땅이 요청과 다르면 hints.landform·water·high 나 terrainSeed 를 바꿔 다시 부르면 새 땅을 보여 준다.`,
              terrain: describeCodeTerrain(terrain),
              // 마을 종류의 전체 목록은 여기서 온다(늘 실리는 카드에는 예 넷뿐) — 모델이 자리를 고르는 그 답에서 종류도 고를 수 있다.
              ...((kinds) => (kinds ? { villageKinds: kinds } : {}))(villageKindsLine(vt, va.water, String(env.request.projectKey ?? ""))),
              // 요청 건물을 청하는 법도 여기서 온다(늘 실리는 카드에는 한 문장뿐) — 자리를 고르는 이 답에서 건물도 청한다.
              buildings: VILLAGE_BUILDINGS_LINE, ...(kindFix ? { fixed: kindFix.note } : {}) });
            const png = terrainPreviewPng(terrain, 8);
            let bin = ""; for (let k = 0; k < png.length; k += 1) bin += String.fromCharCode(png[k]!);
            res.content.push({ type: "image", mimeType: "image/png", data: btoa(bin) });
            return res;
          }
          if (kept) spec = { ...spec, hints: { ...(spec.hints ?? {}), terrainSeed: kept.terrainSeed, width: kept.width, height: kept.height } };
        }
      }
      const designed = hasLayout(spec) ? { spec, notes: [] as string[] } : await designMissingRooms(env, spec, "make_place 설계 빈 방");
      if (doorNote) keptNote = [keptNote, doorNote].filter(Boolean).join(" ");
      spec = designed.spec;
      env.emit({ type: "execution_status", name: "v2.build", ok: true, summary: `${spec.name} 짓는 중(${builder.id})` });
      await builder.prepare?.(spec);
      // 칸 배치 고치기 횟수(두 번까지): 거절마다 센다. 다 쓰면 빌더가 여전히 걸리는 기물만 빼고 깐다.
      const layoutTries = hasLayout(spec) ? session.layoutRejects.get(spec.name) ?? 0 : 0;
      if (hasLayout(spec)) spec = { ...spec, hints: { ...(spec.hints ?? {}), layoutRepairsLeft: 2 - layoutTries } };
      let result = builder.build(run, spec);
      if (hasLayout(spec)) {
        // 거절된 배치는 기억한다 — 모델이 edit_place layoutPatch 로 그것을 고쳐 보내면 받아 준다(2026-10-31 6회차 terra-high 여관: 거절 뒤 layoutPatch 네 번이
        // «짓지 않은 맵»으로 거절돼 짓지 못하고 끝났다).
        const keys = [spec.name, spec.mapId, env.ctx.currentMapId].filter((k): k is string => !!k);
        if (!result.ok && /^Rejected:/u.test(result.summary)) { session.layoutRejects.set(spec.name, layoutTries + 1); for (const k of keys) session.pendingLayouts.set(k, spec); }
        else if (result.ok) { session.layoutRejects.delete(spec.name); for (const [k, v] of [...session.pendingLayouts]) if (v.name === spec.name || keys.includes(k)) session.pendingLayouts.delete(k); }
      }
      // 칸 배치가 거절되면 짓지 않고 문제 목록(칸 좌표)을 돌려준다 — 고칠 횟수가 다 차면 배치 없이 옛 빌더로 짓는다.
      const bboxState = result.state as { bbox?: "dungeon" | "village"; rejected?: string[] } | undefined;
      if (!result.ok && bboxState?.bbox && bboxState.rejected) {
        const ls = layoutSession(session);
        const n = (ls.rejects.get(spec.name) ?? 0) + 1; ls.rejects.set(spec.name, n);
        if (n <= LAYOUT_REPAIRS) return layoutRejectText(bboxState.bbox, spec, bboxState.rejected, LAYOUT_REPAIRS - n);
        const { dungeonLayout: _dl, villageLayout: _vl, ...plain } = spec;
        spec = plain as PlaceSpec;
        const fallback = builderFor(spec)!;
        result = fallback.build(run, spec);
        result = { ...result, warnings: [`Your ${bboxState.bbox} layout was rejected ${n} times (${bboxState.rejected.slice(0, 3).join(" | ")}) — built by the automatic builder instead.`, ...result.warnings] };
      }
      result = withSetupDefaults(result, builder.id, run.ctx.project, String(task ?? ""), freshStart, session.stageWrites);
      if (keptNote || designed.notes.length) result = { ...result, warnings: [...(keptNote ? [keptNote] : []), ...designed.notes, ...result.warnings] };
      if (menuNote && result.ok) result = { ...result, warnings: [...result.warnings, menuNote] };
      // 요청에 주민이 있는데 마을만 짓고 끝냈다(2026-10-30 씬 벤치 「강가 마을」: 「주민 몇 명」 요청 → NPC 0명) — 마을 결과에 다음 할 일로 붙인다
      if (result.ok && builder.id === "village" && /주민|마을\s*사람|사람\s*몇|npc|villager|resident/i.test(String(task ?? ""))) {
        const mapId = result.mapIds[0]; const npcs = mapId ? (run.ctx.project.maps[mapId]?.events ?? []).length : 0;
        if (mapId && npcs < 2) result = { ...result, warnings: [...result.warnings, `요청에 주민이 있다 — 이 마을(${mapId})에는 아직 말을 걸 사람이 ${npcs}명이다. add_people 로 둘 이상(어부·주민 등 요청에 맞게, 모이는 곳·물가 곁) 둔다.`] };
      }
      // 요청에 들어가는 장소(「서쪽 길 끝에 동굴」)가 있는데 마을만 지었다 — 모델이 동굴을 앵커·그림 카드로 처리해 맵에 아무것도 서지 않았다(2026-10-30 실조수 opus:
      // edit_place addAnchors 「동굴 입구」 → 거절, draw_object 「바위 동굴 입구」 → 대기 카드). 들어가는 장소는 던전 빌더가 짓고 바깥 문도 짓기가 잇는다 — 다음 할 일로 붙인다.
      if (result.ok && builder.id === "village" && DUNGEON_PLACE_WORD.test(String(task ?? "")) && ![...session.places.values()].some((r) => r.builder === "dungeon")) {
        const mapId = result.mapIds[0]; const side = requestedDungeonSide(String(task ?? ""));
        const KO = { north: "북", south: "남", east: "동", west: "서" } as const;
        if (mapId) result = { ...result, warnings: [...result.warnings, `요청에 들어가는 장소(동굴·던전)가 있다 — 그림 한 장(draw_object)이나 마을 앵커가 아니라 make_place type "cave"(또는 "dungeon")로 짓는다. 이 마을(${mapId})을 지은 뒤 바로 부르면 짓기가 마을${side ? ` ${KO[side]}쪽 가장자리 길 끝` : "의 그 방향 가장자리 길"} 칸에 바깥 문을 잇는다${side ? `(던전 설계 entrance 는 마을에서 들어오는 쪽 = ${OPP_SIDE[side]})` : ""}.`] };
      }
      // 크기 단 겉의 문 뒤에서 모델의 배치를 본채로 두고 방을 붙여 키웠으면 기록의 명세는 키운 배치다 — 다음 고침이 그림의 좌표로 닿는다(interiorTierLayout.ts).
      const placed = await finishPlace(id, "make_place", params, adoptGrownLayout(spec, result), builder.id, result, 0);
      // 그 게임의 집 안 표(버들항) 카드를 이 대화에서 아직 못 받았으면 첫 실내 결과에 싣는다 — 다음 실내부터 그 표의 id 로 쓴다(이번 것은 바꿔 깔았다, 2026-11-17 r8 D2).
      if (spec.type === "interior" && result.ok) {
        const game = gameInteriorTable(env.ctx.project, env.ctx.currentMapId);
        const card = game && !interiorCardShown(game) ? showInteriorCard(game) : undefined;
        if (card) placed.content.push({ type: "text", text: `Every interior in this game is laid with chipset ${game} (the chipset of its village); ids from another table are swapped for its nearest pieces. Write the next spec.layout with the ids of this card:\n${card}` });
      }
      // 다시 지으며 새 id 가 됐다가 옛 id 로 되돌려진 맵이면(place/keepMapId.ts) 끝난 뒤의 id 로 읽는다.
      result = keptPlaceResult(session, result);
      noteLayoutPlace(spec, result);
      if (result.ok && result.mapIds[0] && (result.state as { bbox?: string } | undefined)?.bbox) attachLayoutCritique(placed, env, session, result.mapIds[0], spec, result.state);
      return placed;
    },
  };
  const editPlace: PiToolShape = {
    name: "edit_place", label: "장소 고치기", concurrency: "exclusive",
    description: "Rebuild a built (or existing) place with the same builder, changing only part of its spec. Pass critic-major coordinates as addAnchors.near. 1 round per map (interiors laid from spec.layout: several rounds — layoutPatch or set.layout). For a room you designed with design, put the whole fixed design in patch.design (dressing is not for designed rooms).",
    parameters: { type: "object", properties: { patch: { type: "object", properties: {
      mapId: { type: "string", description: "map id to fix (inside patch)" },
      set: { type: "object", properties: { layout: LAYOUT_SCHEMA, name: { type: "string" }, style: { type: "string" }, theme: { type: "string" }, size: SIZE, floors: { type: "number" }, features: { type: "array", items: { type: "string" } }, exits: { type: "array", items: { type: "string", enum: ["south", "north", "east", "west"] } }, hints: HINTS_SCHEMA, dungeonDesign: DUNGEON_DESIGN_SCHEMA, connections: CONNECTIONS_SCHEMA, entrance: { type: "string", description: "(interior room graph) entrance room id" }, ...(bboxPlacesOn() ? { dungeonLayout: DUNGEON_LAYOUT_SCHEMA, villageLayout: VILLAGE_LAYOUT_SCHEMA } : {}) } },
      zones: { type: "array", items: ZONE_SCHEMA, description: "(interior) the whole new zone list for this floor — replaces the old rooms (use it to re-plan a room graph; send set.connections with it)" },
      ...(bboxPlacesOn() ? { layoutReview: { type: "string", description: "(place laid from your cell layout) finish one self-critique round without changes: what you checked and why it is good" } } : {}),
      addZones: { type: "array", items: ZONE_SCHEMA },
      removeZones: { type: "array", items: { type: "string" } },
      addAnchors: { type: "array", items: { type: "object", properties: { zone: { type: "string" }, what: { type: "string" }, near: POINT }, required: ["what"] } },
      addFeatures: { type: "array", items: { type: "string" } },
      removeFeatures: { type: "array", items: { type: "string" } },
      variant: { type: "number" }, dressing: { type: "number" },
      design: ROOM_DESIGN_SCHEMA, designZone: { type: "string", description: "(designed room) zone id or kind whose design changes — omitted = the first designed zone" },
      layoutPatch: { ...LAYOUT_PATCH_SCHEMA, description: "(interior laid from spec.layout) a patch to the current layout — remove/add pieces or replace whole fields; applied exactly, then validated" },
    }, required: ["mapId"] } }, required: ["patch"] },
    async execute(id, params) {
      const raw = params as { patch: PlacePatch; mapId?: string };
      // 모델이 mapId 를 patch 바깥에 두기도 한다(2026-10-23 실조수) — 둘 다 받는다.
      const { seed: _seed, ...rawPatch } = (raw.patch ?? {}) as PlacePatch;
      // 빈 mapId(엄격 스키마가 채운 필수 칸)는 지금 보는 맵이다 — `??` 로는 "" 가 그대로 남아 «맵 "" 이 없다» 로 거절됐다.
      const patch0: PlacePatch = { ...rawPatch, mapId: raw.patch?.mapId || raw.mapId || env.ctx.currentMapId || "" };
      const editKind = placeSpecKindOf(session.placeOf(patch0.mapId)?.spec.type) ?? (env.ctx.project.maps[patch0.mapId]?.tilesetId === HAND_INTERIOR_TILESET_ID ? "interior" : undefined);
      const editSpecFirst = specGate("edit_place", editKind);
      if (editSpecFirst) return editSpecFirst;
      const patch1: PlacePatch = patch0.set?.hints && "seed" in patch0.set.hints ? { ...patch0, set: { ...patch0.set, hints: Object.fromEntries(Object.entries(patch0.set.hints).filter(([k]) => k !== "seed")) } } : patch0;
      // 방이 둘 미만인 dungeonDesign(스키마를 기본값으로 채운 빈 껍데기 {rooms:[], links:[]})은 «설계를 바꾸지 않는다»로 읽는다 — make_place(screenDungeonSpec)와 같다.
      // 2026-10-30 scenes-duel terra boss-room: edit_place 가 이 껍데기로 «dungeonDesign.rooms 에 방이 둘 이상» 거절을 받았다(terra v2 동사 거절 1위).
      const shellDesign = !!patch1.set?.dungeonDesign && !(Array.isArray(patch1.set.dungeonDesign.rooms) && patch1.set.dungeonDesign.rooms.length >= 2);
      let patch: PlacePatch = shellDesign ? { ...patch1, set: (({ dungeonDesign: _d, ...rest }) => rest)(patch1.set!) } : patch1;
      const shellNote = shellDesign ? ["고침: patch.set.dungeonDesign 에 방이 둘 미만이라(빈 설계) 설계는 그대로 두고 나머지만 고쳤다 — 층 설계를 바꾸려면 rooms 를 둘 이상(입구·보스 포함) 보낸다."] : [];
      /** 할 일 목록에서 아직 열린 장소 항목의 이름 — 이름 없이 온 «아직 없는 장소» 고침에 쓴다. */
      const openPlace = (): { name: string; kind?: string } | undefined => { const c = session.todo.open().map((i) => i.check).find((k) => k?.kind === "place"); return c?.kind === "place" ? { name: c.name, ...(c.placeKind ? { kind: c.placeKind } : {}) } : undefined; };
      const openPlaceName = (): string | undefined => openPlace()?.name;
      let record = session.placeOf(patch.mapId);
      // 엄격 스키마가 채운 빈 칸·지금 값은 «보내지 않은 것» 이다(support.ts dropPatchFill).
      patch = dropPatchFill(patch, record?.spec);
      // 앞 턴의 설계에서 고친다(tools/placeMemory.ts) — 결과에 그 사실을 적는다.
      const fromPast = !!record && !session.places.has(patch.mapId);
      // 아직 서지 않은 칸 배치 장소(앞의 make_place 가 거절됐다)를 고치려 한 호출은 make_place 로 보낸다(고치기 횟수는 make_place 가 센다):
      // 거절된 배치에 layoutPatch 를 적용하거나, 모델이 통째로 다시 보낸 배치(set.layout · layoutPatch.replace 전체)를 쓴다. 거절된 장소가 하나뿐이면 맵·이름이 안 맞아도 그 장소다.
      const cur = record?.spec.layout;
      const lp = layoutPatchIsEmpty(patch.layoutPatch) ? undefined : patch.layoutPatch;
      if (!record || !layoutGiven(cur)) {
        const waiting = [...new Set(session.pendingLayouts.values())];
        const pending = session.pendingLayouts.get(patch.mapId) ?? session.pendingLayouts.get(String(patch.set?.name ?? "")) ?? (!record && waiting.length === 1 ? waiting[0] : undefined);
        const blank = env.ctx.project.maps[patch.mapId];
        const sent = layoutGiven(patch.set?.layout) ? patch.set!.layout as InteriorLayout : patchedWholeLayout(lp);
        const base = sent ?? (lp && layoutGiven(pending?.layout) ? pending!.layout as InteriorLayout : undefined);
        if (base && (pending || (!record && blank && isPlaceholderMap(blank)))) {
          const ap = lp ? applyLayoutPatch(base, lp) : { layout: base, errors: [] as string[] };
          const name = pending?.name ?? (String(patch.set?.name ?? "").trim() || openPlaceName() || "실내");
          // 맞지 않는 고침 줄(없는 기물 빼기 · 모르는 replace 칸)은 건너뛰고 나머지를 적용해 깐다 — 건너뛴 것을 결과에 적는다(거절은 게임이 깨질 때만).
          const skipped = ap.errors.map((e) => `skipped — ${e}`);
          const res = await makePlace.execute(id, { spec: { ...(pending ?? { type: "interior" as const, name, mapId: patch.mapId }), layout: ap.layout } });
          const head = res.content[0];
          if (head && head.type === "text") { try { const j = JSON.parse(head.text) as Record<string, unknown>; res.content[0] = { type: "text", text: JSON.stringify({ note: `"${name}" was not built yet, so this edit was sent as make_place with ${sent ? "the layout you sent" : "your rejected layout patched"}.${skipped.length ? ` ${skipped.join(" ")}` : ""}`, ...j }) }; } catch { /* 글 그대로 */ } }
          return res;
        }
        // 칸 배치로 깔지 않은 장소에 온 layoutPatch: 고침의 나머지(앵커·크기·특징)가 있으면 그것만 하고, 없으면 그 맵을 먼저 보게 한다.
        if (lp) {
          const { layoutPatch: _lp, ...rest } = patch;
          const other = !!(rest.addAnchors?.length || rest.addZones?.length || rest.removeZones?.length || rest.zones?.length || rest.addFeatures?.length || rest.removeFeatures?.length || rest.design || rest.variant !== undefined || rest.dressing !== undefined || Object.keys(rest.set ?? {}).length);
          if (!other) return text({ ok: false, summary: layoutPatchRefusal(env.ctx.project, patch.mapId, lp) });
          patch = rest; shellNote.push(`Ignored patch.layoutPatch: ${patch.mapId} was not laid from a cell layout (spec.layout), so only the rest of the patch was applied.`);
        }
      } else if (lp) {
        // 칸 배치 고침: 지금 배치에 그대로 적용해 set.layout 으로 다시 짓는다(검증은 짓기가 한다).
        const ap = applyLayoutPatch(cur!, lp);
        // 지금 배치와 맞지 않는 고침 줄은 건너뛰고 나머지를 적용한다 — 건너뛴 줄과 까닭을 결과에 적는다(거절은 게임이 깨질 때만).
        for (const e of ap.errors) shellNote.push(`skipped — ${e}`);
        patch = { ...patch, set: { ...(patch.set ?? {}), layout: ap.layout } };
      }
      // 이미 있는 방(이 실행이 짓지 않은 방)의 「아늑하게·물건 더하기·뒷문」은 다시 짓지 않고 덧찍는다 — 다시 지으면 원래 바닥·가구가 바뀐다(2026-10-23 비교).
      const doorWord = /뒷문|출입문|back ?door|^문$|^door$/iu;
      const north = (patch.set?.exits ?? []).includes("north") || (patch.addAnchors ?? []).some((a) => doorWord.test(a.what.trim()));
      const stampOnly = !patch.addZones?.length && !patch.zones?.length && !patch.design && !patch.removeZones?.length && patch.variant === undefined && patch.seed === undefined && !patch.addFeatures?.length && !patch.removeFeatures?.length
        && Object.keys(patch.set ?? {}).every((k) => k === "exits");
      const prevStamp = record?.result.state as StampEditState | undefined;
      const existing = env.ctx.project.maps[patch.mapId];
      const layoutRoom = !!existing && !!roomSpecOf(env.ctx.project.tilesets[existing.tilesetId]) && (existing.locations ?? []).some((l) => (l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG));
      const prevAdoptedState = (record?.result.state as { adopted?: unknown } | undefined)?.adopted;
      if ((!record || prevStamp?.stampEdit || prevAdoptedState) && stampOnly && layoutRoom) {
        const rounds = record?.rounds ?? 0;
        if (rounds >= V2_MAX_REPAIR_ROUNDS) return text({ ok: false, summary: `고치기 상한(${V2_MAX_REPAIR_ROUNDS}바퀴)에 닿았다. 남은 문제를 사용자에게 보고한다.` });
        const spec: PlaceSpec = { ...(record?.spec ?? { type: "interior", name: existing!.name, mapId: patch.mapId }), ...(north ? { exits: ["south", "north"] as const } : {}) };
        env.emit({ type: "execution_status", name: "v2.repair", ok: true, summary: `${spec.name} 덧찍어 고치는 중(${rounds + 1}바퀴)` });
        const before = record ? { project: env.ctx.project, record, seen: new Map(record.result.mapIds.map((m) => [m, session.seen.get(m)!] as const).filter(([, v]) => !!v)) } : undefined;
        const editReq = { dressing: patch.dressing ?? 0, adds: (patch.addAnchors ?? []).filter((a) => !doorWord.test(a.what.trim())), north };
        // 원래 방을 «똑같이» 다시 지을 인자를 찾으면 그 인자에서 고친다(가구 비키기·뒷문 자리 만들기가 된다). 못 찾으면 덧찍기.
        const prevAdopted = (record?.result.state as { adopted?: Parameters<typeof interiorEditFromArgs>[2] } | undefined)?.adopted;
        const exact = prevAdopted ?? (prevStamp?.stampEdit ? undefined : adoptExactInterior(run, patch.mapId));
        const result = exact
          ? interiorEditFromArgs(run, spec, exact, editReq, prevAdopted ? record!.result.state as never : undefined)
          : interiorStampEdit(run, spec, patch.mapId, { ...editReq, north: north && !prevStamp?.backMapId }, prevStamp);
        return finishPlace(id, "edit_place", params, spec, interiorBuilder.id, result, rounds + 1, before?.seen.size ? before : undefined);
      }
      if (prevStamp?.stampEdit || prevAdoptedState) record = undefined;
      if (!record) {
        record = adoptInterior(run, patch.mapId);
        if (record) for (const mapId of record.result.mapIds) session.places.set(mapId, record);
      }
      // 다시 짓기로 위층 id 가 바뀌었는데 옛 id 로 고치려 했다(2026-10-24 cmp-dungeon-floors) — 지금 있는 층 id 를 알려 준다.
      if (!record && !env.ctx.project.maps[patch.mapId]) {
        const now = [...new Set([...session.places.values()].flatMap((r) => r.result.mapIds))].filter((id) => env.ctx.project.maps[id]).map((id) => `${id}(${env.ctx.project.maps[id]!.name ?? ""})`);
        return text({ ok: false, summary: `${patch.mapId} 는 이제 없는 맵이다(앞의 다시 짓기로 층이 새 id 로 바뀌었다). 지금 v2 가 지은 맵: ${now.join(", ") || "없음"} — 이 id 로 고친다.` });
      }
      // 빈 자리표시 시작 맵(풀밭 한 장)에 구역을 붙여 「고치려」 했다 — 고칠 장소가 없으니 그 구역으로 그 자리에 실내를 새로 짓는다
      // (2026-10-29 방 과제 room-base/room-vig-1029: 교실·침실·예배당·주점 10개 중 4개가 edit_place(map_blank_start) 실패 한 번으로 빈 맵인 채 끝났다).
      if (!record && existing && isPlaceholderMap(existing) && patch.addZones?.length && !(patch.set as { type?: string } | undefined)?.type) {
        const spec = applyPatch({ type: "interior", name: patch.set?.name ?? existing.name ?? "실내", mapId: patch.mapId }, patch);
        return makePlace.execute(id, { spec });
      }
      if (!record) return text({ ok: false, summary: noDesignRefusal(session, env.ctx.project, patch.mapId, openPlace()) });
      if (record.rounds >= repairCap(record.spec)) return text({ ok: false, summary: `고치기 상한(${repairCap(record.spec)}바퀴)에 닿았다. 남은 문제를 사용자에게 보고한다.` });
      // 칸 배치 장소의 자기 비평: «고칠 것 없음»(layoutReview) 은 한 바퀴로 세고 다시 깔지 않는다. 고친 배치(set.dungeonLayout·villageLayout)는 한 바퀴로 세고 다시 깐다.
      const layoutState = layoutSession(session).byMap.get(patch.mapId);
      // 빈 배치(방 0개·길·건물 0개 — 스키마를 빈 값으로 채운 것)는 보내지 않은 것으로 본다. 그대로 두면 앞 배치가 지워져
      // 옛 빌더가 그 자리에 다른 던전을 지었다(2026-10-31 terra-high 지하 묘지: 빈 dungeonLayout·dungeonDesign → sandpit 40×27).
      if (patch.set?.dungeonLayout !== undefined && !hasDungeonLayout({ dungeonLayout: patch.set.dungeonLayout } as PlaceSpec)) { const { dungeonLayout: _d, ...rest } = patch.set; patch = { ...patch, set: rest }; }
      if (patch.set?.villageLayout !== undefined && !hasVillageLayout({ villageLayout: patch.set.villageLayout } as PlaceSpec)) { const { villageLayout: _v, ...rest } = patch.set; patch = { ...patch, set: rest }; }
      const newLayout = !!(patch.set?.dungeonLayout || patch.set?.villageLayout);
      if (layoutState && (newLayout || patch.layoutReview)) layoutState.critiqueRounds += 1;
      if (layoutState && patch.layoutReview && !newLayout) {
        const res = text({ ok: true, summary: `Self-critique round ${layoutState.critiqueRounds} of ${LAYOUT_CRITIQUE_ROUNDS} recorded without changes for ${record.spec.name} (${patch.mapId}).${layoutState.critiqueRounds >= LAYOUT_CRITIQUE_ROUNDS ? " Self-critique is complete — continue with the rest of the request." : ""}` });
        if (layoutState.critiqueRounds < LAYOUT_CRITIQUE_ROUNDS) {
          const pic = await renderMap(env, patch.mapId);
          if (pic) res.content.push({ type: "image", mimeType: "image/png", data: pic.slice(pic.indexOf(",") + 1) });
          attachLayoutCritique(res, env, session, patch.mapId, record.spec, record.result.state);
        }
        return res;
      }
      const builder = builderFor(newLayout ? applyPatch(record.spec, patch) : record.spec)!;
      // 거절은 기록이 있던 자리에 한 바퀴로 적는다 — 앞 턴의 기록을 «이번 턴에 지은 것»으로 옮기지 않는다.
      const keepRecord = (r: PlaceRecord) => { for (const mapId of r.result.mapIds) (fromPast ? session.pastPlaces : session.places).set(mapId, r); };
      if (builder.onePass) {
        keepRecord({ ...record, rounds: record.rounds + 1 });
        // 다음 호출 하나: 진행 중 항목이 이 맵의 방 검사이고 빌더가 덮었으면 그 항목을 닫는 todo done, 물건 고침이면 그 물건을 놓는 호출, 아니면 inspect.
        const cur = session.todo.current();
        let covered: string | undefined;
        try { const r = cur?.check && COVERABLE.has(cur.check.kind) ? runTodoItemCheck(env.ctx.project, cur, { startMapId: env.ctx.project.startMapId }) : undefined; covered = r?.pass && r.covered && r.evidence?.mapId === patch.mapId ? cur!.id : undefined; } catch { covered = undefined; }
        const anchor = (patch.addAnchors ?? []).find((a) => typeof a?.what === "string" && a.what.trim());
        return text({ ok: false, summary: composedRefusal(env.ctx.project, patch.mapId, { layout: layoutGiven(patch.set?.layout) || !!patch.layoutPatch, ...(covered ? { coveredItem: covered } : {}), ...(anchor ? { anchor: { what: anchor.what, ...(anchor.near && (anchor.near.x || anchor.near.y) ? { near: anchor.near } : {}) } } : {}) }) });
      }
      // 마을·던전·거리 빌더는 소품 하나하나·꾸밈 정도를 받지 않는다 — 그런 패치로 다시 지으면 같은 맵이 또 나오고 바퀴만 쓴다(2026-10-23 v2 실조수).
      if (builder.id !== interiorBuilder.id) {
        const effective = !!(patch.set || patch.variant !== undefined || patch.seed !== undefined || patch.addFeatures?.length || patch.removeFeatures?.length || patch.addZones?.length || patch.removeZones?.length
          || (patch.addAnchors ?? []).some((a) => /적|몬스터|박쥐|해골|거미|고블린|슬라임|늑대|좀비|유령|enem|monster|bat|skeleton|spider|goblin|slime|wolf|zombie|ghost|상자|chest|보스|boss|레버|lever|광장|plaza|우물|well|밭|field|자판기|vending|공원|park/iu.test(a.what)));
        if (!effective) {
          // 거절도 한 바퀴로 센다 — 바퀴를 안 쓰면 모델이 같은 거절을 열 번 넘게 되풀이했다(2026-10-23 3차 피라미드: edit_place 13번 중 12번 거절).
          const spent = { ...record, rounds: record.rounds + 1 };
          keepRecord(spent);
          const left = V2_MAX_REPAIR_ROUNDS - spent.rounds;
          // 걷어 내고 남은 것이 없는 고침(빈 칸·지금과 같은 값뿐)은 «바뀌는 것이 없다», 물건을 놓으려던 고침은 그 물건을 선 맵에 놓는 호출을 이른다.
          const anchor = (patch.addAnchors ?? []).find((a) => typeof a?.what === "string" && a.what.trim());
          return text({ ok: false, summary: notRelaidRefusal(env.ctx.project, patch.mapId, builder.id, left, { nothing: Object.entries(patch).every(([k, v]) => k === "mapId" || v === undefined), ...(anchor ? { anchor: { what: anchor.what, ...(anchor.near && (anchor.near.x || anchor.near.y) ? { near: anchor.near } : {}) } } : {}) }) });
        }
      }
      const floor = Math.max(1, record.result.mapIds.indexOf(patch.mapId) + 1);
      const onlyAnchors = floor === 1 && !!patch.addAnchors?.length && !patch.set && !patch.addZones?.length && !patch.removeZones?.length && !patch.addFeatures?.length && !patch.removeFeatures?.length && patch.variant === undefined && patch.seed === undefined && patch.dressing === undefined;
      let spec = applyPatch(record.spec, patch, floor);
      // 고치며 더한 구역·설계 없던 방도 모델이 설계한다(원래 방을 지키는 keep 구역은 빼고).
      const redesigned = onlyAnchors || builder.id !== interiorBuilder.id || hasLayout(spec) ? undefined : await designMissingRooms(env, spec, "edit_place 설계 빈 방");
      if (redesigned) spec = redesigned.spec;
      const layoutTries = hasLayout(spec) ? session.layoutRejects.get(spec.name) ?? 0 : 0;
      if (hasLayout(spec)) spec = { ...spec, hints: { ...(spec.hints ?? {}), layoutRepairsLeft: 2 - layoutTries } };
      env.emit({ type: "execution_status", name: "v2.repair", ok: true, summary: `${spec.name} 고치는 중(${record.rounds + 1}바퀴)` });
      const before = { project: env.ctx.project, record, seen: new Map(record.result.mapIds.map((m) => [m, session.seen.get(m)!] as const).filter(([, v]) => !!v)) };
      const built = onlyAnchors && builder.id === interiorBuilder.id ? interiorAddAnchors(run, record, patch.addAnchors!) : builder.build(run, spec, record);
      if (hasLayout(spec)) { if (!built.ok && /^Rejected:/u.test(built.summary)) session.layoutRejects.set(spec.name, layoutTries + 1); else if (built.ok) session.layoutRejects.delete(spec.name); }
      const rejectedLayout = (built.state as { bbox?: "dungeon" | "village"; rejected?: string[] } | undefined);
      if (!built.ok && rejectedLayout?.bbox && rejectedLayout.rejected) {
        // 고친 배치가 거절되면 앞 장소를 그대로 둔다(바퀴는 셌다) — 문제 목록을 주고 다시 보내게.
        return text({ ok: false, notFailure: true, summary: `Rejected: the checker found ${rejectedLayout.rejected.length} problem(s) in your corrected ${rejectedLayout.bbox}Layout — the place was NOT re-laid (the previous version stays). Fix every problem and call edit_place again with the full corrected layout, or finish the round with layoutReview.`, problems: rejectedLayout.rejected.slice(0, 40) });
      }
      const notes = [...shellNote, ...(redesigned?.notes ?? []), ...(fromPast ? [PAST_DESIGN_NOTE] : [])];
      const result = notes.length ? { ...built, warnings: [...notes, ...built.warnings] } : built;
      const fixed = await finishPlace(id, "edit_place", params, adoptGrownLayout(spec, result), builder.id, result, record.rounds + 1, before.seen.size ? before : undefined);
      // 다시 지으며 새 id 가 됐다가 옛 id 로 되돌려진 맵이면(place/keepMapId.ts) 끝난 뒤의 id 로 읽는다.
      const laid = keptPlaceResult(session, result);
      noteLayoutPlace(spec, laid);
      const laidMap = laid.mapIds[0];
      if (laid.ok && laidMap && (laid.state as { bbox?: string } | undefined)?.bbox) attachLayoutCritique(fixed, env, session, laidMap, spec, laid.state);
      return fixed;
    },
  };
  // 칸 배치 자기 검토(2026-10-31, agent/bbox-better critique.py: terra 0.61→0.71, sol 0.75 의 절반 시간) — 깔린 그림을 플레이어 눈으로 보고
  // 문제를 적고 배치 고침을 보낸다. 고침은 지금 배치에 그대로 적용해 다시 짓고(edit_place 와 같은 길, 검증·되돌림 포함), 바퀴를 센다(할 일 layout_review).
  const reviewLayout: PiToolShape = {
    name: "review_layout", label: "칸 배치 자기 검토", concurrency: "exclusive",
    description: "Self-review an interior you laid from spec.layout. Look at its picture (from make_place, edit_place or inspect) as a player walking in: bare floor, zones that do not read as what they are for, odd placements, blocked or cramped paths, pieces that look wrong in the art, a weak landmark, a boring box. Send the problems you see and a layout patch — applied to your layout exactly, then validated (Rejected / Fixed call). An empty patch means nothing to fix. Each call is one review round.",
    parameters: { type: "object", properties: {
      mapId: { type: "string" },
      problems: { type: "array", items: { type: "string" }, description: "what looks wrong or empty, short, with cells" },
      patch: LAYOUT_PATCH_SCHEMA,
    }, required: ["mapId", "problems"] },
    async execute(id, params) {
      const p = params as { mapId?: string; problems?: string[]; patch?: LayoutPatch };
      const mapId = p.mapId || env.ctx.currentMapId || "";
      const reviewSpecFirst = specGate("review_layout", "interior");
      if (reviewSpecFirst) return reviewSpecFirst;
      const record = session.placeOf(mapId);
      if (!record || !hasLayout(record.spec)) return text({ ok: false, summary: `review_layout is for interiors laid from spec.layout; ${mapId || "(no mapId)"} is not one. Laid interiors: ${[...new Set([...session.pastPlaces.entries(), ...session.places.entries()].filter(([, r]) => hasLayout(r.spec)).map(([m]) => m))].join(", ") || "none"}.` });
      const round = (Number(record.spec.hints?.layoutReviews ?? 0) || 0) + 1;
      const problems = (p.problems ?? []).map((x) => String(x)).filter(Boolean);
      const notes = [...String(record.spec.hints?.layoutReviewNotes ?? "").split(" || ").filter(Boolean), (problems.join("; ") || "nothing to fix").slice(0, 300)].slice(-6).join(" || ");
      const lp = layoutPatchIsEmpty(p.patch) ? undefined : p.patch;
      const want = layoutReviewRounds();
      // 빈 패치 = 고칠 것 없음: 다시 깔지 않고 바퀴만 센다. 예전엔 빈 패치도 다시 지어서, 다시 지은 배치가 더 나쁘다며 되돌리고 ok:false 를
      // 돌려줬다(2026-10-31 조수 대조 8회차 FS2 감방 Opus: 「no patch — layout kept」 인데 「문제 1→3 되돌렸다」 거절 3번, 할 일 검사도 못 넘김).
      const decl = !lp ? (env.ctx.project.maps[mapId]?.locations ?? []).find((l) => (l.tags ?? []).includes(LAYOUT_TAG) && (l.tags ?? []).includes("decl")) : undefined;
      if (!lp && decl) {
        let note0: Record<string, unknown> = {};
        try { note0 = JSON.parse(String((decl as { note?: string }).note ?? "{}")) as Record<string, unknown>; } catch { /* 읽지 못한 기록은 바퀴만 센다 */ }
        run.call("delete_map_location", { mapId, locationId: decl.id });
        run.call("create_map_location", { mapId, name: decl.name, x: decl.x, y: decl.y, w: decl.w, h: decl.h,
          note: layoutDeclNote({ ...note0, reviews: round, reviewNotes: notes.split(" || ").filter(Boolean) }),
          tags: [...(decl.tags ?? []).filter((x) => !x.startsWith(REVIEWS_TAG)), `${REVIEWS_TAG}${round}`] });
        const spent = { ...record, spec: { ...record.spec, hints: { ...(record.spec.hints ?? {}), layoutReviews: round, layoutReviewNotes: notes } } };
        for (const m of record.result.mapIds) session.places.set(m, spent);
        return text({ ok: true, review: `Review round ${round}${want ? `/${want}` : ""} for "${record.spec.name}" (${mapId}): no patch — layout kept as it is (not re-laid).`,
          summary: round < want ? `Round ${round} recorded with no changes. Send the next review_layout round (empty patch again if nothing is wrong), or a small patch for one or two real problems.` : "Review rounds done — continue with the rest of the request." });
      }
      const res = await editPlace.execute(id, { patch: { mapId, ...(lp ? { layoutPatch: lp } : {}), set: { hints: { layoutReviews: round, layoutReviewNotes: notes } } } });
      const note = `Review round ${round}${want ? `/${want}` : ""} for "${record.spec.name}" (${mapId}): ${lp ? "patch applied and re-laid" : "no patch — layout kept"}. ${round < want ? "Look at the new picture and send the next review_layout round." : "Review rounds done."}`;
      const head = res.content[0];
      if (head && head.type === "text") { try { const j = JSON.parse(head.text) as Record<string, unknown>; res.content[0] = { type: "text", text: JSON.stringify({ review: note, ...j }) }; } catch { res.content.push({ type: "text", text: note }); } }
      return res;
    },
  };
  // 실내 칸 배치 목록 조회(2026-10-31 bbox-walls-5·bbox-chipsets 2회차): 목록 카드는 범주별 id 만 싣고, 크기·놓는 자리·쓰인 방은 여기서 범주 하나씩 본다.
  const findPiecesVerb: PiToolShape = {
    name: "find_pieces", label: "실내 기물 찾기", concurrency: "shared",
    description: "Look up interior catalog pieces for spec.layout: every piece of one category (or the pieces matching some words), each with footprint, where it goes (objects / wall_items row), art rise, the example rooms it is used in and what it goes with. Use it to furnish rooms with varied, purposeful pieces beyond the suggested slice.",
    parameters: { type: "object", properties: {
      category: { type: "string", description: "a category name from the [Interior catalog] card, e.g. home, kitchen, study, decor (empty = all categories)" },
      tags: { type: "array", items: { type: "string" }, description: "optional English words to match in ids, e.g. [\"shelf\", \"barrel\"]" },
    }, required: [] },
    async execute(_id, params) {
      const p = params as { category?: string; tags?: string[] };
      const t = interiorTilesetFor(env.ctx.project, env.ctx.currentMapId);
      const S = effectiveSpec(t);
      if (!t || !S) return text({ ok: false, summary: "This project has no interior chipset with a room table." });
      const r = findPieces(S, String(p.category ?? ""), Array.isArray(p.tags) ? p.tags : []);
      const format = "id | footprint WxH (x,y = top-left) | category | where it goes | art rise | used in example rooms | goes with";
      // 표에 없는 갈래: 전부를 «맞았다» 고 돌려주지 않는다 — 갈래 목록 · 가까운 갈래 · 그 낱말이 든 기물만.
      if (r.unknownCategory) return text({ ok: true, chipset: t.id, category: r.unknownCategory.asked, matched: r.total, shown: r.lines.length,
        summary: `No category "${r.unknownCategory.asked}" in this chipset's table.${r.unknownCategory.near.length ? ` Nearest categories: ${r.unknownCategory.near.join(", ")}.` : ""} ${r.lines.length ? `Pieces whose words match "${r.unknownCategory.asked}" are listed` : `No piece matches "${r.unknownCategory.asked}" either`} — call find_pieces again with one of the categories.`,
        categories: r.categories, ...(r.lines.length ? { format, pieces: r.lines } : {}) });
      return text({ ok: true, chipset: t.id, category: p.category ?? "", matched: r.total, shown: r.lines.length, format,
        pieces: r.lines, ...(r.lines.length ? {} : { categories: r.categories }) });
    },
  };
  return { buildWorld, makePlace, editPlace, reviewLayout, findPiecesVerb };
}
