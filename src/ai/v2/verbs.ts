// 조수 v2 동사 — 모델이 부르는 도구는 이 열 개 안팎뿐이다. 동사마다: 명세 → 결정론 빌더 → 1배 그림 + 기계 검사 → 독립 비평가.
// 고치기는 모델이 비평 결과(칸 좌표 major)를 보고 edit_place 패치로 한다(맵당 V2_MAX_REPAIR_ROUNDS 바퀴 상한). 끝맺음 관문(afterMain)이
// 「비평 major 0 + 기계 검사 통과」가 아닌 장소를 남긴 채 「다 됐다」고 말하지 못하게 한다.
import { flattenWrapperTool } from "./flatWrapper";
import type { PiToolShape, PiToolExecResult } from "@/ai/piAgent/toolAdapter";
import { shipBlockers, wantsWholeGame } from "./shipChecks";
import { applyBlueprintAssembly, isPlaceholderTitle } from "@/project/blueprintAssembly";
import { applyBlueprintOpening } from "@/editor/tools/blueprintOpening";
import { WRITE_BLUEPRINT_SCHEMA, blueprintDesignerFromEnv, blueprintProgressNote, designBlueprint, parseBlueprintArgs, walkBlueprint } from "./blueprint";
import { projectBrief } from "./prompt";
import type { PiAssistantV2Env } from "./env";
import { HAND_INTERIOR_TILESET_ID, roomSpecOf } from "@/editor/handInterior/builder";
import { createBuildRun, type RecordingBuildRun } from "./buildRun";
import { builderFor } from "./builders";
import { localizePlaceSpec } from "./builders/modernCity";
import { localizeCultureSpec } from "./builders/joseon";
import { villageLayoutGuide, cleanLayoutHint, villageArgs, villageMapSize } from "./builders/village";
import { codeTerrainFor, usesCodeTerrain } from "@/editor/tools/authorBeodeulTown";
import { describeCodeTerrain } from "@/editor/tools/beodeulTerrainGen";
import { terrainPreviewPng } from "@/editor/tools/beodeulTerrainPreview";
import { applyModernSetupDefaults, applyStorySetupDefaults, isFreshProject } from "./genreDefaults";
import { dedupeToolSchemas } from "./schemaDedupe";
import { adoptExactInterior, interiorAddAnchors, interiorBuilder, interiorEditFromArgs, interiorMoveObjects, roomMaterials, type ObjectEdit } from "./builders/interior";
import { interiorStampEdit, type StampEditState } from "./builders/interiorEdit";
import { fixPlayerStart, runMachineChecks, summarizeChecks, type MachineCheck } from "./checks";
import { critique } from "./critic";
import type { CriticVerdict } from "@/ai/piAgent/featureReview";
import type { ContentBuildResult, EventSpec, ObjectSpec, PersonSpec, PlaceBuildResult, PlacePatch, PlaceRecord, PlaceSpec, PlaceType, ZoneSpec } from "./types";
import type { Project } from "@/project/types";
import { DEAD_END_PREFIX } from "./deadEndRoads";
import { buildPeople, findMap, resolveWhere } from "./people";
import { mapBundleIds } from "@/ai/piAgent/mapBundle";
import { buildEvent } from "./events";
import { drawObject } from "./drawObject";
import { buildScene, SCENE_SCHEMA, type SceneSpec } from "./scene";
import { buildPuzzleChain, sealLockedRoom, type ChainArgs } from "./puzzle";
import { BUILD_BLUEPRINT_PATH_SCHEMA, blueprintMapFor, buildBlueprintPath, type PathStepText } from "./blueprintPath";
import { repairEventReach, spreadCrowdedPeople } from "./eventReach";
import { runLaneStages } from "./lanes";
import { isPlaceholderMap, moveBareEvents, retireBlankStart } from "./blankStart";
import { dungeonGateSpot, pickTransferSpot } from "./transferSpot";
import { guessPlaceSpec } from "./placeGuess";
// 콘텐츠 동사(컷신 무대·연출 비평·물건 자리 계획) — finishContent·addEvent·drawObjectVerb·placeObject 가 쓴다.
import { critiqueStaging } from "./critic";
import { createGameTools, wantsPuzzle, wantsGameTools, wantsMusicTools, wantsStoreTools, wantsTerrainTools } from "./game";
import { musicOnly } from "./musicWords";
import { gameContentProblems, unaskedChanges } from "./gameChecks";
import { HELPER_LIMITS, helpersOn, runHelperJobs, type HelperJob } from "./helpers";
import { isStoreCardRequest } from "@/editor/tools/storeTools";
import { combatProblems } from "./combatChecks";
import { edgeCell, eventBeats, isInside, isOutdoor, oppositeSide, makeGameOn, orderPlaces, pickDoor, villageDoors, walkGame, wantsMakeGame, type GameSpec } from "./makeGame";
import { restoreEventFromBefore } from "./restoreEvent";
import { pickStageFrames, stageFrameProject, type EventBuildResult } from "./events";
import { rememberObjectPlan, takeObjectPlan, type DrawObjectResult } from "./drawObject";
import { dressRoom } from "./builders/dressRoom";
import { tileMoveObjects } from "./builders/tileMove";
import { planObjective } from "./discoverability";
import { roomParts, SHAPE_EXAMPLES } from "./roomParts";
import { DUNGEON_PLACE_WORD, gateFor, innerDungeonParent, innerGateSpot, requestedDungeonSide, settleDungeonGates } from "./dungeonGates";
const OPP_SIDE = { north: "south", south: "north", east: "west", west: "east" } as const;
import { DUNGEON_DESIGN_SCHEMA, arrivalEntrance, createDungeonPartsVerb, dungeonContext, dungeonParts, screenDungeonSpec } from "./dungeonParts";
import { ROOM_IDEA_RULE, roomIdeasFor } from "./roomIdeas";
import { buildsHandInterior, designMissingRooms } from "./designRooms";
import { dropModelSeed } from "./modelSeed";
import { TodoStore } from "./loop/todoStore";
import { TodoLoop } from "./loop/continuation";
import { HookStats } from "./loop/hookStats";
import { buildBossEncounter, buildEndingScene, wantsBossEncounter, wantsEndingScene, type BossEncounterSpec, type EndingSceneSpec } from "./sceneVerbs";

// 2026-10-23 5차: 고치기 3바퀴는 바퀴마다 다시 짓기+비평(20~35초)이라 던전 한 장에 200~250초가 들었다.
// 속도 우선(6차)으로 1바퀴만 — 첫 비평의 major 를 한 번 고치고 남은 것은 보고한다.
// 2026-10-30 omo 할 일 고리: 1바퀴 상한이 비평 항목을 «상한 막힘»으로 닫았다(세 장면 모두). 상한은 할 일 항목의 시도 상한(TODO_MAX_ATTEMPTS=3)과
// 고리의 진척 규칙(진척 없는 재주입 2번이면 멈춤)이 맡는다 — 맵당 다시 짓기 상한도 같은 3.
export const V2_MAX_REPAIR_ROUNDS = 3;
/** build_hand_interior_room 이 layout 방마다 다는 장소 꼬리표(handInteriorTools.ts 와 같은 값). */
const HAND_LAYOUT_ROOM_TAG = "hand-layout-room";

interface Seen {
  readonly checks: readonly MachineCheck[];
  readonly critics: readonly CriticVerdict[];
  readonly images: readonly { readonly mapId: string; readonly dataUrl: string }[];
}

/** 이 실행의 v2 상태 — 맵별 장소 기록·마지막 검사·누적 「그림 없음」. */
export class V2Session {
  /** 이번 실행의 할 일 목록(omo todo — src/ai/v2/loop). todo 동사가 쓰고, 멈춤 재주입 고리·최종 보고가 읽는다. */
  readonly todo = new TodoStore();
  /** 멈춤 재주입 고리의 연속·진척 상태(src/ai/v2/loop/continuation.ts). */
  readonly loop = new TodoLoop();
  /** 할 일 고리 갈고리의 발화 수(src/ai/v2/loop/hookStats.ts) — v2.summary 에 싣는다. */
  readonly hooks = new HookStats();
  readonly places = new Map<string, PlaceRecord>();
  readonly seen = new Map<string, Seen>();
  readonly content: { verb: string; result: ContentBuildResult }[] = [];
  readonly missingArt = new Set<string>();
  /** 컷신 무대(맵별) — 무대 검사·연출 비평 major 가 남았는지(G39: 비평이 짚은 겹침을 보고만 하고 끝냈다). */
  readonly stages = new Map<string, { name: string; rounds: number; problems: string[]; eventIds?: readonly string[] }>();
  readonly questions: string[] = [];
  /** ask_user 를 한 번 되돌려 보냈는가(아무것도 짓지 않고 물었을 때). */
  askBounced = false;
  /** 설계 없이 온 손 도트 실내 make_place 를 한 번 되돌려 보낸 장소 이름(2026-10-29 「방을 짓는 건 조수여야만 한다」). */
  readonly designBounced = new Set<string>();
  /** 지형 설계(hints.landform) 없이 온 마을 make_place 를 한 번 되돌려 보낸 장소 이름(2026-10-29 「지형을 먼저 깔고 마을은 지형에 맞춰 자란다」). */
  readonly terrainBounced = new Set<string>();
  /** 코드 지형 마을: 미리보기로 보여 준 땅(장소 이름 → 씨앗·크기·성격 힌트). 자리(hints.layout)를 받아 지을 때 같은 땅을 쓴다. */
  readonly villageTerrain = new Map<string, { terrainSeed: number; width: number; height: number; shape: string; previews: number }>();
  /** 설계(dungeonDesign) 없이 온 던전·동굴 make_place 를 한 번 되돌려 보낸 장소 이름(2026-10-29 「맵은 조수가 설계한다」). */
  readonly dungeonBounced = new Set<string>();
  /** 같은 청사진을 다시 쓴 횟수(내용이 같으면 바꾸지 않고 다음 동사로 보낸다). */
  blueprintRewrites = 0;
  /** 끝맺음에서 청사진 경로를 함수가 대신 지었는가(한 번만). */
  autoPathDone = false;
  /** 끝맺음에서 청사진 장소를 함수가 대신 지었는가(한 번만). */
  autoPlacesDone = false;
  /** 끝맺음에서 지은 장소를 시작과 이었는가(한 번만). */
  linkBuiltDone = false;
  /** 빈 맵을 가리키던 청사진 장소의 새 이름 → 그 빈 맵 id(renameBareBlueprintPlaces). 장소를 지으면 빈 맵 이벤트를 옮긴다. */
  barePlaces?: Map<string, string>;
  /** 끝맺음에서 이동 칸 앞을 막는 이벤트를 옮겼는가(한 번만). */
  autoLanesDone = false;
  /** 출구·이동 칸 마감을 돈 뒤의 맵 지문(finishAutoBuild.lanesStamp). 늦은 고치기 차례가 장소를 다시 지으면 달라져 마감을 다시 돈다. */
  lanesStamp?: string;
  /** 지문이 달라져 마감을 다시 돈 횟수(되풀이 상한). */
  lanesReruns = 0;
  /** 이동 칸(착지·문) 앞을 막는 이벤트를 옆으로 옮긴다(createV2Tools 가 건다). 한 일 목록. */
  clearLanes?: () => Promise<string[]>;
  /** 청사진에 있는데 없는(또는 닿지 않는) 장소를 짓고 앞 장소와 잇는다(createV2Tools 가 건다). 한 일 목록. */
  buildPlaces?: () => Promise<string[]>;
  /** 이번 실행에 make_place 로 지은 장소가 시작에서 닿지 않으면 요청 속 맵(없으면 지금·시작 맵)과 잇는다(createV2Tools 가 건다). 한 일 목록. */
  linkBuiltPlaces?: () => Promise<string[]>;
  /** 청사진 경로를 결정적으로 짓는다(createV2Tools 가 건다) — 끝맺음 단계가 모델 대신 부른다. */
  buildPath?: (why: string) => Promise<{ ok: boolean; summary: string }>;
  criticCalls = 0;
  criticMs = 0;
  /** 모델 입장에서 「아직 안 끝난 것」 — 끝맺음 관문이 읽는다. */
  unresolved(): { mapId: string; name: string; rounds: number; problems: string[] }[] {
    const out: { mapId: string; name: string; rounds: number; problems: string[] }[] = [];
    for (const [mapId, record] of this.places) {
      const seen = this.seen.get(mapId);
      if (!seen) continue;
      const critics = seen.critics.filter((v) => v.mapId === mapId);
      const problems = [
        ...seen.checks.filter((c) => !c.ok && c.mapId === mapId).map((c) => `[기계 ${c.id}] ${c.detail}`),
        ...critics.flatMap((v) => v.majors.map((m) => `[비평 축${m.axis}${m.x !== undefined ? ` (${m.x},${m.y})${m.w ? ` ${m.w}×${m.h}` : ""}` : ""}] ${m.what}${m.fix ? ` → ${m.fix}` : ""}`)),
        ...critics.filter((v) => v.problem).map((v) => `[비평 미판정] ${v.problem}`),
      ];
      if (problems.length) out.push({ mapId, name: record.spec.name, rounds: record.rounds, problems });
    }
    for (const [mapId, st] of this.stages) if (st.problems.length) out.push({ mapId, name: `${st.name} 컷신(add_event 를 같은 kind·when 으로 다시)`, rounds: st.rounds, problems: st.problems });
    return out;
  }
}

const text = (value: unknown): PiToolExecResult => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });

const PLACE_TYPES: PlaceType[] = ["interior", "village", "dungeon", "cave", "street", "house"];
const SIZE = { type: "string", enum: ["small", "medium", "large"] };
// 모델이 쓰는 방 설계(손 도트 실내) — 2026-10-29 사용자 결정 「방을 짓는 건 조수여야만 한다」. 함수는 조화·검사만(designRoom.ts).
const ROOM_DESIGN_SCHEMA = {
  type: "object",
  description: "(interior, when you design this room yourself) room shape, size, door and furniture groups. When given, the builder lays no sample and builds this design, fixing only name matching, overlap, chair facing, the aisle in front of the door and reachability, and returns what it fixed. See part ids with room_parts.",
  properties: {
    shape: { type: "string", description: "rect · L (cuts the corner) · U (cuts the middle of the north wall) · T (two south corners) · bay window bump (two north corners) · alcove (keeps only the north-wall nook on the corner side and lowers the rest of the north wall). Minimum floor per shape, examples and pictures in room_parts. A side room is not a shape but one more zone (each with its own design)" },
    w: { type: "integer", description: "floor width in cells (5–24)" },
    h: { type: "integer", description: "floor height in cells (wall-face rows excluded, 4–18)" },
    corner: { type: "string", description: "(nw·ne·sw·se) the corner L cuts" },
    door: { type: "string", description: "south exit spot — left·center·right" },
    floor: { type: "string", description: "floor material id (floors in room_parts)" },
    wall: { type: "string", description: "wall-face material id (walls in room_parts)" },
    groups: { type: "array", description: "(up to 16) furniture groups — parts used together (desk+chair, two armchairs+round table+lamp, a row of bookshelves). This list is everything placed (the function adds nothing).", items: {
      type: "object",
      properties: {
        name: { type: "string", description: "group name: desk spot · reading nook · bookshelf wall" },
        at: { type: "string", description: "(north·south·west·east·center·nw·ne·sw·se) where it goes (wall, corner, center). Bookshelves/display cases (wall furniture) and hangings (window, map, frame) stand only on north." },
        pos: { type: "number", description: "along that wall from 0 (west/north end) to 1 (east/south end). Default 0.5" },
        x: { type: "integer", description: "(optional) floor cell coordinate — the floor's top-left is 0,0. Takes precedence over at" },
        y: { type: "integer" },
        rug: { type: "string", description: "(optional) rug color under the group: red·royal·blue·green·purple·brown" },
        items: { type: "array", items: { type: "object", properties: {
          id: { type: "string", description: "chipset part id (room_parts) — e.g. bookshelf 3w · desk 3x1 · chair N (chair facing north) · armchair" },
          dx: { type: "integer", description: "relative cell inside the group (top-left 0,0). Omitted = next to the previous part (downward for west/east wall groups)" },
          dy: { type: "integer", description: "hangings use -2 (top row of the wall face)" },
          count: { type: "integer", description: "(1–8) how many of the same part in a row" },
        }, required: ["id"] } },
      },
      required: ["items"],
    } },
  },
};
const ZONE_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", description: "zone kind word (a word from the card)" },
    purpose: { type: "string", description: "one line: what the place is for" },
    anchors: { type: "array", items: { type: "string" }, description: "hero-object words for this zone" },
    vignettes: { type: "array", items: { type: "string" }, description: "(interior, optional) furniture groups for this room — main part ids (bookshelf 2w · forge · counter 3x1). The function picks the spots. Omitted = chosen by room kind" },
    size: SIZE,
    design: ROOM_DESIGN_SCHEMA,
    floor: { type: "number", description: "which floor (default 1)" },
    id: { type: "string" },
  },
  required: ["kind"],
};
const HINTS_SCHEMA = {
  type: "object",
  description: "only builder knobs the card told you about. Leave out anything you do not know.",
  properties: {
    variant: { type: "number", description: "another layout of the same spec (0,1,2…)" },
    dressing: { type: "number", description: "amount of dressing 0 normal · 1 more · 2 packed (cozy)" },
    houseCount: { type: "number" },
    roofs: { type: "string" },
    water: { type: "string", description: "(village) water in the land design — river: a river flowing east-west in the south (crossed by plank bridges) · none: no water. Always set it for grassland villages" },
    woods: { type: "string" },
    form: { type: "string" },
    terrain: { type: "string" },
    landform: { type: "string", enum: ["terraces", "hill", "slope", "plateau", "flat"], description: "(village) terrain design — the land shape. The village grows to fit this land" },
    settle: { type: "string", enum: ["middle", "low"], description: "(village) the tier the village sits on — low: the lowest waterside tier (riverside and swamp villages; the river runs in front of the village) · middle: the middle tier (lower road and barns on the low southern tier)" },
    tiers: { type: "number", description: "(village) number of high tiers above the village tier, 1–4" },
    high: { type: "string", enum: ["north", "center", "west", "east"], description: "(village) where the high ground is" },
    forestType: { type: "string" },
    walls: { type: "boolean" },
    wallGate: { type: "string" },
    width: { type: "number" },
    height: { type: "number" },
    length: { type: "string", description: "street length short|medium|long (only for builders the card mentions)" },
    plaza: { type: "string" },
    landmark: { type: "string" },
    shops: { type: "string", description: "short shop names, comma-separated, left to right" },
    mirror: { type: "boolean" },
    floorShapes: { type: "string", description: "shape per floor, comma-separated (bottom floor first)" },
    floorGimmicks: { type: "string", description: "device per floor, comma-separated (bottom floor first, none if none)" },
    townSize: { type: "string" },
    streets: { type: "string" },
    pond: { type: "boolean" },
    terrainSeed: { type: "number", description: "(village) code terrain seed — change only if you dislike the preview land" },
    layout: { type: "object", description: "(village) spots chosen by land-picture coordinates (x right, y down, in cells). The function moves them to the nearest buildable spot and links roads", properties: {
      gather: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, plaza: { type: "boolean" } }, required: ["x", "y"], description: "gathering place (square, well)" },
      landmark: { ...{ type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "high-ground building (watchtower, chapel, temple) — usually on the high tier" },
      anchor: { ...{ type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "big building (inn, hall) — usually beside the gathering place" },
      work: { ...{ type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "workplace (barn, storehouse)" },
      houses: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, kind: { type: "string", enum: ["small", "medium", "large"], description: "house size — mix them so the same house does not repeat" } }, required: ["x", "y"] }, description: "house spots (house center) 3–12" },
      fields: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "field spots" },
      orchards: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "orchard (rows of trees, about 14×9) spots" },
      pastures: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "fenced pasture (sheep, haystacks) spots" },
      forests: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "forest clump spots" },
      props: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "roadside prop piles (cart, crates, hay, firewood, signpost, bench) — placed beside the nearest road" },
      exits: { type: "array", items: { type: "string", enum: ["west", "east", "north", "south"] }, description: "map edges where the main road leaves the village, 1–2" },
    } },
  },
};
const PLACE_SPEC_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: PLACE_TYPES },
    name: { type: "string" },
    style: { type: "string" },
    theme: { type: "string" },
    size: SIZE,
    zones: { type: "array", items: ZONE_SCHEMA },
    features: { type: "array", items: { type: "string" } },
    floors: { type: "number" },
    exits: { type: "array", items: { type: "string", enum: ["south", "north", "east", "west"] } },
    mapId: { type: "string", description: "only to rebuild an existing map in place" },
    hints: HINTS_SCHEMA,
    dungeonDesign: DUNGEON_DESIGN_SCHEMA,
    floorDesigns: { type: "array", items: DUNGEON_DESIGN_SCHEMA, description: "(multi-floor dungeon) a design per floor (bottom floor first)" },
  },
  required: ["type", "name"],
};
const POINT = { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] };

/** 맵 하나를 사람이 보는 1배 그림으로(모델·비평가 공용). 렌더 경로가 없으면 undefined. */
async function renderMap(env: PiAssistantV2Env, mapId: string): Promise<string | undefined> {
  const map = env.ctx.project.maps[mapId];
  if (!map || !env.render) return undefined;
  try { return await env.render(mapId, 0, 0, map.width, map.height); } catch { return undefined; }
}

/** 보기 단계: 기계 검사 + 1배 그림 + 독립 비평가(맵마다, 같은 짓기의 다른 맵은 문맥으로). */
async function see(env: PiAssistantV2Env, session: V2Session, task: string, type: PlaceType | "content", mapIds: readonly string[], entrance: PlaceBuildResult["entrance"], critic: boolean): Promise<Seen> {
  const project = env.ctx.project;
  const checks = runMachineChecks(project, mapIds, entrance);
  const images: { mapId: string; dataUrl: string }[] = [];
  for (const mapId of mapIds.slice(0, 4)) {
    const dataUrl = await renderMap(env, mapId);
    if (dataUrl) images.push({ mapId, dataUrl });
  }
  const critics: CriticVerdict[] = [];
  if (critic && images.length) {
    env.emit({ type: "execution_status", name: "v2.critic", ok: true, summary: `다른 눈(독립 비평가)이 1배 그림 ${images.length}장을 보는 중` });
    const judged = await Promise.all(images.slice(0, 3).map(async (image) => {
      const map = project.maps[image.mapId]!;
      // 다른 층은 이름만 준다 — 그림까지 주면 층마다 비평가가 그림 3장을 읽어 한 번에 ~6초 더 걸렸다(72회 실측: 1장 23초 · 3장 29초 중앙값).
      const others = images.filter((o) => o.mapId !== image.mapId).map((o) => ({ name: project.maps[o.mapId]?.name ?? o.mapId, image: "" }));
      try {
        const run = await critique({ task, type, map: { id: map.id, name: map.name, width: map.width, height: map.height }, image: image.dataUrl, others, sideChat: env.sideChat, ...(env.signal ? { signal: env.signal } : {}) });
        session.criticCalls++; session.criticMs += run.ms;
        return run.verdict;
      } catch (error) {
        return { mapId: image.mapId, majors: [], problem: `비평 호출 실패: ${error instanceof Error ? error.message : String(error)}` } satisfies CriticVerdict;
      }
    }));
    critics.push(...judged);
  }
  return { checks, critics, images };
}

function seenPayload(seen: Seen): Record<string, unknown> {
  return {
    machineChecks: summarizeChecks(seen.checks),
    critic: seen.critics.map((v) => ({ mapId: v.mapId, score: v.score, majors: v.majors, ...(v.problem ? { problem: v.problem } : {}) })),
  };
}

function withImages(payload: unknown, seen: Seen | undefined, maxImages = 2): PiToolExecResult {
  const result = text(payload);
  for (const image of seen?.images.slice(0, maxImages) ?? []) {
    const comma = image.dataUrl.indexOf(",");
    result.content.push({ type: "image", mimeType: "image/png", data: image.dataUrl.slice(comma + 1) });
  }
  return result;
}

/** 쓰기 기록 하나: 시공 재생 단계를 실어 다음 체크포인트가 편집기에서 다시 튼다. */
const recorded = new WeakMap<PiAssistantV2Env, Set<string>>();
/** 청사진 경로를 하나씩 맞추려 할 때 build_blueprint_path 로 보낼 하위 도구. */
const PATH_LOW_LEVEL = new Set(["upsert_event", "patch_event_page", "define_ending", "declare_story_flag", "upsert_item", "place_npc", "upsert_common_event"]);
const BLUEPRINT_PROGRESS_VERBS = new Set(["make_place", "make_game", "edit_place", "add_people", "add_event", "add_scene", "author_puzzle_chain", "build_blueprint_path"]);
function recordWrite(env: PiAssistantV2Env, run: RecordingBuildRun, toolCallId: string, name: string, args: unknown, ok: boolean, summary: string, data?: unknown): void {
  if (!recorded.has(env)) recorded.set(env, new Set());
  recorded.get(env)!.add(toolCallId);
  const logs = run.takeConstructionLogs();
  env.record({ toolCallId, name, args, result: { ok, summary, ...(data !== undefined ? { data } : {}) }, ...(logs.length ? { constructionLogs: logs } : {}) });
}

function nextStep(seen: Seen, rounds: number, designed: boolean | "dungeon" = false): string {
  const bad = seen.checks.filter((c) => !c.ok).length + seen.critics.reduce((n, v) => n + v.majors.length, 0);
  if (!bad && !seen.critics.some((v) => v.problem)) return "통과 — 비평 major 0, 기계 검사 통과. 다른 요청 부분이 남았으면 이어서, 아니면 사용자에게 보고한다.";
  // 조수가 설계한 방: 고치기도 설계로 — 함수가 가구를 골라 채우는 dress_room 을 권하지 않는다.
  if (designed === "dungeon") return `문제 ${bad}건 — 이 층은 네 dungeonDesign 대로 지었다. warnings 의 「고침:」 줄과 비평을 보고 설계(방 크기·모양·자리 at·길 links·물)를 고쳐 edit_place({patch:{mapId, set:{dungeonDesign: 고친 설계 전체}}}) 로 다시 짓는다. 못 고치는 것은 보고에 남긴다.`;
  if (designed) return `문제 ${bad}건 — 이 방은 네 design 대로 지었다. warnings 의 「고침:」·「맨바닥」 줄과 비평을 보고 design(크기 w·h, 모양, 묶음과 자리)을 고쳐 edit_place({patch:{mapId, design: 고친 설계 전체}}) 로 다시 짓는다. 가구 하나만 옮기거나 돌리려면 move_object. 못 고치는 것(그림이 없는 물건 등)은 보고에 남긴다.`;
  const furniture = "놓인 가구 하나가 문·길을 막거나 방향이 틀린 major 는 move_object(그 칸 at → to·face·remove)로 고친다. 방이 비었다·빈 바닥이 많다는 문제는 dress_room(mapId, at: 그 방 바닥 한 칸, purpose: 방 쓰임)으로 채운다 — 둘 다 바퀴를 쓰지 않는다.";
  if (rounds >= V2_MAX_REPAIR_ROUNDS) return `고치기 상한(${V2_MAX_REPAIR_ROUNDS}바퀴)에 닿았다 — 다시 짓는 고치기는 더 하지 않는다. ${furniture} 그 밖의 남은 문제는 사용자에게 그대로 보고한다.`;
  return `문제 ${bad}건 — 고칠 수 있으면 edit_place 패치(구역 더하기·주인공 물건 near 좌표·크기·variant·dressing)로 한 번에 고친다(남은 바퀴 ${V2_MAX_REPAIR_ROUNDS - rounds}). ${furniture} 패치로 못 고치는 것(그림이 없는 물건 등)은 보고에 적는다.`;
}

/** 빌더 기록이 없는 손 도트 실내(이전 실행이나 사람이 layout 으로 지은 방)를 같은 방 구성으로 다시 지어 기록을 만든다. */
function adoptInterior(run: RecordingBuildRun, mapId: string): PlaceRecord | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map || !roomSpecOf(project.tilesets[map.tilesetId])) return undefined;
  const rooms = (map.locations ?? []).filter((l) => (l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG));
  if (!rooms.length) return undefined;
  const style = map.tilesetId === "atlas_biome_interior" ? undefined : map.tilesetId;
  // 원래 방 크기·바닥·벽면 재질을 지킨다 — 크기를 안 주면 다른 견본(돌바닥)이 골라져 「아늑하게」가 오히려 차가워졌다(2026-10-23 비교, v1 7.5 · v2 3.5).
  const roomSpec = roomSpecOf(project.tilesets[map.tilesetId])!;
  const spec: PlaceSpec = { type: "interior", name: map.name, mapId, ...(style ? { style } : {}),
    zones: rooms.map((r) => ({ kind: r.name, keep: { w: r.w ?? 0, h: r.h ?? 0, ...roomMaterials(roomSpec, map, { x: r.x, y: r.y, w: r.w ?? 1, h: r.h ?? 1 }) } })) };
  const result = interiorBuilder.build(run, spec);
  return result.ok ? { builder: interiorBuilder.id, spec, result: { ...result, warnings: [...result.warnings, "v2 기록이 없던 방이라 같은 방 구성(layout)으로 다시 지은 뒤 고쳤다 — 손으로 옮긴 가구는 견본 가구로 돌아간다"] }, rounds: 0 } : undefined;
}

export function applyPatch(spec: PlaceSpec, patch: PlacePatch, floor = 1): PlaceSpec {
  const removed = new Set(patch.removeZones ?? []);
  let zones = (spec.zones ?? []).filter((z) => !removed.has(z.id ?? z.kind) && !removed.has(z.kind));
  // 설계 방 고치기: 고친 설계 전체로 그 구역의 design 을 바꾼다. 같은 종류의 설계 구역을 addZones 로 다시 보낸 것도 «바꾸기»로 읽는다
  // (2026-10-29 flash 실조수: 고친 서재 설계를 addZones 로 보내 서재가 둘인 2실이 됐다).
  const designAt = (want?: string) => zones.findIndex((z) => (z.floor ?? 1) === floor && (want ? z.id === want || z.kind === want : !!z.design));
  if (patch.design) {
    const i = designAt(patch.designZone) >= 0 ? designAt(patch.designZone) : zones.findIndex((z) => (z.floor ?? 1) === floor);
    if (i >= 0) zones[i] = { ...zones[i]!, design: patch.design };
  }
  const adds: ZoneSpec[] = [];
  for (const z of patch.addZones ?? []) {
    const i = z.design ? zones.findIndex((q) => !!q.design && q.kind === z.kind && (q.floor ?? 1) === (z.floor ?? floor)) : -1;
    if (i >= 0) zones[i] = { ...zones[i]!, ...z, design: z.design };
    else adds.push(floor > 1 && !z.floor ? { ...z, floor } : z);
  }
  zones = [...zones, ...adds];
  // 위층 맵을 고치는 패치: 물건은 그 층 구역으로(없으면 객실 구역을 만든다) — 1층 홀에 침대가 들어갔다(2026-10-23 v2 실조수).
  if (floor > 1 && patch.addAnchors?.length && !zones.some((z) => z.floor === floor)) zones = [...zones, { kind: "inn_room", floor }];
  const loose: string[] = [];
  for (const add of patch.addAnchors ?? []) {
    const index = floor > 1
      ? zones.findIndex((z) => z.floor === floor && (!add.zone || z.id === add.zone || z.kind === add.zone)) >= 0
        ? zones.findIndex((z) => z.floor === floor && (!add.zone || z.id === add.zone || z.kind === add.zone))
        : zones.findIndex((z) => z.floor === floor)
      : zones.findIndex((z) => (z.floor ?? 1) === 1 && (z.id === add.zone || z.kind === add.zone));
    const at = index >= 0 ? index : 0;
    if (zones[at]) zones[at] = { ...zones[at]!, anchors: [...(zones[at]!.anchors ?? []), add.what] };
    else loose.push(add.what); // 구역 없는 장소(마을·던전)는 장소 전체의 낱말로
  }
  const features = [...new Set([...(spec.features ?? []).filter((f) => !(patch.removeFeatures ?? []).includes(f)), ...(patch.addFeatures ?? []), ...loose])];
  const { seed: _modelSeed, ...setHints } = (patch.set?.hints ?? {}) as Record<string, string | number | boolean>;   // 씨앗은 모델 손잡이가 아니다(make_place 와 같다)
  const hints = { ...(spec.hints ?? {}), ...setHints,
    ...(patch.variant !== undefined ? { variant: patch.variant } : {}), ...(patch.seed !== undefined ? { seed: patch.seed } : {}), ...(patch.dressing !== undefined ? { dressing: patch.dressing } : {}) };
  return { ...spec, ...(patch.set ?? {}), type: spec.type, ...(zones.length ? { zones } : {}), ...(features.length ? { features } : {}), hints };
}

/** 현대(한국·일본 도시) 장소를 처음 지은 게임 요청이면 장르 기본값(주인공 현대 칩·체력 HUD 끄기·연애 기본값)을 깔고 보고에 한 줄 남긴다. */
function withSetupDefaults(result: PlaceBuildResult, builderId: string, project: Project, task: string, freshStart = false): PlaceBuildResult {
  if (!result.ok) return result;
  const set = builderId === "kr-modern" || builderId === "jp-city" ? applyModernSetupDefaults(project, task, freshStart) : applyStorySetupDefaults(project, task, freshStart);
  return set.length ? { ...result, warnings: [...result.warnings, `게임 기본값을 깔았다: ${set.join(" · ")} — 사용자가 다른 것을 원하면 바꾼다`] } : result;
}

/** 결정적 장소 열쇠 — 프로젝트 열쇠(없으면 게임 제목) + 요청문. 실내 빌더가 견본·조합 씨앗에 쓴다(같은 게임·같은 요청 → 같은 방, 다른 게임 → 다른 설계). */
function placeVariety(env: PiAssistantV2Env, task: unknown): string {
  return `${env.request.projectKey ?? env.ctx.project.meta.title ?? ""}|${String(task ?? "").slice(0, 400)}`;
}

export function createV2Tools(env: PiAssistantV2Env, session: V2Session): PiToolShape[] {
  const task = env.request.task;
  const run = createBuildRun(env.ctx);
  // 이 차례를 시작할 때 빈 프로젝트였나 — 첫 장소를 짓는 요청은 「게임」 낱말이 없어도 게임 시작으로 보고 장르 기본값을 깐다(G51).
  const freshStart = isFreshProject(env.ctx.project);

  const problemCount = (seen: Seen | undefined, mapIds: readonly string[]) => !seen ? Infinity
    : seen.checks.filter((c) => !c.ok && mapIds.includes(c.mapId)).length + seen.critics.filter((v) => mapIds.includes(v.mapId)).reduce((n, v) => n + v.majors.length, 0);
  const outsideBuilt = (mapId: string): boolean => { const r = session.places.get(mapId); return !!r && isOutdoor(r.spec); };
  const finishPlace = async (toolCallId: string, verb: string, args: unknown, spec: PlaceSpec, builderId: string, built: PlaceBuildResult, rounds: number,
    before?: { project: typeof env.ctx.project; record: PlaceRecord; seen: Map<string, Seen> }): Promise<PiToolExecResult> => {
    let result = built;
    recordWrite(env, run, toolCallId, verb, args, result.ok, result.summary, { mapIds: result.mapIds });
    for (const m of result.missingArt) session.missingArt.add(m);
    if (!result.ok) return text({ ok: false, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, next: "명세를 바꿔 다시 하거나(다른 type·style), 할 수 없으면 사용자에게 그대로 알린다." });
    // 맵 범위가 있는 실행은 체크포인트가 범위 맵의 «트리 묶음»만 싣는다 — 트리 맨 위에 따로 생긴 새 맵(마을 옆 들판)은
    // 다음 체크포인트에서 통째로 사라졌다(2026-10-24 g3-random-field: make_place 성공 → 맵 목록에 없음 → 잇기·조우 모두 실패).
    // 새 맵을 범위 맵 아래로 옮겨 묶음에 넣는다.
    {
      const roots = [...(env.toolsetOptions?.scopeMapIds ?? (env.request as { mapIds?: readonly string[] }).mapIds ?? [])].filter((id) => env.ctx.project.maps[id]);
      const parent = roots[0];
      if (parent) {
        const inBundle = new Set(roots.flatMap((r) => mapBundleIds(env.ctx.project, r)));
        for (const mapId of result.mapIds) {
          if (inBundle.has(mapId) || !env.ctx.project.maps[mapId]) continue;
          const moved = run.call("manage_map_tree", { operation: "move", mapId, parentId: parent });
          if (!moved.ok) result = { ...result, warnings: [...result.warnings, `새 맵 ${mapId} 를 ${parent} 아래로 옮기지 못했다 — 저장에서 빠질 수 있다: ${String(moved.summary).slice(0, 120)}`] };
        }
      }
    }
    // 실내·집도 시작 칸을 본다(2026-10-28 interior 장부 5): 방을 줄여 다시 짓거나 dress_room·stamp 뒤에 시작 칸이 가구·벽면 밑에 남을 수 있다.
    // 시작 맵이 이번에 지은 맵이고 시작 칸이 큰 땅(걸어 닿는 가장 큰 덩이) 밖일 때만 옮긴다 — 문 안쪽 시작 칸은 그대로다.
    {
      const fixed = fixPlayerStart(env.ctx.project, result.mapIds);
      if (fixed.note) { env.ctx.project = fixed.project; result = { ...result, warnings: [...result.warnings, fixed.note], ...(result.entrance && result.entrance.mapId === fixed.project.startMapId ? { entrance: { mapId: fixed.project.startMapId, x: fixed.project.startPos.x, y: fixed.project.startPos.y } } : {}) }; }
    }
    // 바깥 마을·거리 → 던전 문은 하나, 던전이 놓인 세계 방향 가장자리의 길 칸에(dungeonGates.ts — 짓기 기본 출구·다시 짓기 재연결이 문을 둘 남겼다).
    if (builderId === "dungeon") {
      const gates = settleDungeonGates(run, result.mapIds, outsideBuilt, requestedDungeonSide(String(task ?? "")));
      if (gates.length) result = { ...result, warnings: [...result.warnings, ...gates] };
    }
    // 다시 짓기(edit_place) 뒤 바닥이 바뀌어 앞서 둔 사람이 문 곁·가구 접근 칸·큰 양탄자 위에 남을 수 있다 — 방 하나만 짓는 판은 끝맺음(clearLanes)이
    // 돌지 않으므로 여기서도 spreadCrowdedPeople 을 부른다.
    for (const mapId of result.mapIds) {
      const settled = spreadCrowdedPeople(run, mapId);
      if (settled.length) result = { ...result, warnings: [...result.warnings, `사람 자리: ${settled.join(" · ")}`] };
    }
    const record: PlaceRecord = { builder: builderId, spec, result, rounds };
    for (const mapId of result.mapIds) session.places.set(mapId, record);
    // 다시 짓기로 사라진 층(새 id 로 바뀐 위층)은 기록·검사에서 뺀다 — 남겨 두면 없는 맵의 옛 major 를 「남은 문제」로 들고 다닌다.
    for (const mapId of [...session.places.keys()]) if (!env.ctx.project.maps[mapId]) { session.places.delete(mapId); session.seen.delete(mapId); }
    // 첫 짓기를 비평 전에 편집기에 싣는다 — 사용자는 비평을 기다리지 않고 지어지는 것을 본다.
    await env.checkpoint(verb);
    const seen0 = await see(env, session, task, spec.type, result.mapIds, result.entrance, true);
    // 요청한 주인공 물건이 못 놓였거나 밀려났으면 기계 실패로 센다 — 되돌리기·끝맺음 관문이 이것을 본다(「큰 망원경」이 빠진 채 끝났다).
    const anchorFails: MachineCheck[] = result.missingArt.filter((m) => /놓을 빈 자리가 없다|최종 맵에 없다/u.test(m)).map((m) => ({ id: "anchor-missing", mapId: result.mapIds[0]!, ok: false, detail: m }));
    const seen: Seen = anchorFails.length ? { ...seen0, checks: [...seen0.checks, ...anchorFails] } : seen0;
    for (const mapId of result.mapIds) session.seen.set(mapId, seen);
    // 고친 결과가 앞보다 나쁘면(기계 실패 + 비평 major 가 늘면) 앞 상태로 되돌린다 — 천문대 고치기가 방을 하나 더 붙여 맨바닥 52% 가 됐다(2026-10-23 v2 실조수).
    if (before) {
      const oldIds = before.record.result.mapIds;
      const was = problemCount(before.seen.get(oldIds[0]!), oldIds), now = problemCount(seen, result.mapIds);
      if (now > was) {
        env.ctx.project = before.project;
        for (const mapId of result.mapIds) { session.places.delete(mapId); session.seen.delete(mapId); }
        // 첫 되돌림은 한 번 더 기회를 준다 — 큰 패치가 바닥 무늬를 더 어지럽혀 되돌렸고, 비평 메모(바닥 무늬·복도 나무 타일·벽 밖 러그)는
        // 그대로 남아 보고만 됐다(2026-10-25 G28 장난감 가게). 다음 시도는 비평 하나씩, 좌표가 있는 것만 작게.
        const reverts = (before.record.reverts ?? 0) + 1;
        const keptRounds = reverts === 1 ? before.record.rounds : rounds;
        const kept: PlaceRecord = { ...before.record, rounds: keptRounds, reverts };
        for (const mapId of oldIds) { session.places.set(mapId, kept); const old = before.seen.get(mapId); if (old) session.seen.set(mapId, old); }
        env.record({ toolCallId, name: verb, args, result: { ok: false, summary: `고친 결과가 더 나빠(문제 ${was}→${now}) 되돌렸다` } });
        await env.checkpoint(`${verb}-revert`);
        return withImages({ ok: false, reverted: true, summary: `고친 결과의 문제(${now})가 앞(${was})보다 많아 앞 상태로 되돌렸다 — 이 패치는 버렸다.`, triedResult: { ...seenPayload(seen), summary: result.summary.slice(0, 300) }, round: rounds,
          next: keptRounds >= V2_MAX_REPAIR_ROUNDS ? "고치기 상한 — 남은 문제를 보고한다." : "더 작은 패치로 한 번 더 고친다 — 비평 major 중 좌표가 있는 것 하나·둘만 그 칸 범위로 고치고(바닥 전체·방 구조는 건드리지 않는다), 나머지는 보고한다." }, before.seen.get(oldIds[0]!));
      }
    }
    return withImages({ ok: true, mapIds: result.mapIds, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, ...seenPayload(seen), round: rounds, next: nextStep(seen, rounds, spec.dungeonDesign ? "dungeon" : (spec.zones ?? []).some((z) => !!z.design)) }, seen);
  };

  const finishContent = async (toolCallId: string, verb: string, args: unknown, result: ContentBuildResult): Promise<PiToolExecResult> => {
    recordWrite(env, run, toolCallId, verb, args, result.ok, result.summary, result.card !== undefined ? result.card : { eventIds: result.eventIds });
    session.content.push({ verb, result });
    for (const m of result.missingArt) session.missingArt.add(m);
    if (result.ok) await env.checkpoint(verb);
    const mapIds = result.mapIds.length ? result.mapIds : [];
    const stage = (result as EventBuildResult).stage;
    // 컷신: 끝 그림 한 장이 아니라 장면을 따라 그린 틀 여러 장 + 무대 검사(걸음 길이·도착·대사 거리) + 연출 비평가.
    if (result.ok && stage) {
      const map = env.ctx.project.maps[stage.mapId];
      const frames: { label: string; image: string; crop: { x: number; y: number; w: number; h: number } }[] = [];
      if (map && env.render) {
        for (const frame of pickStageFrames(stage, 5)) {
          const { project: framed, crop } = stageFrameProject(env.ctx.project, stage, frame);
          const saved = env.ctx.project;
          try {
            env.ctx.project = framed; // render 는 그 순간의 ctx.project 를 그린다
            frames.push({ label: frame.label, image: await env.render(stage.mapId, crop.x, crop.y, crop.w, crop.h), crop });
          } catch { /* 그림 경로 없음 */ } finally { env.ctx.project = saved; }
        }
      }
      const critics: CriticVerdict[] = [];
      if (map && frames.length) {
        env.emit({ type: "execution_status", name: "v2.critic", ok: true, summary: `다른 눈(연출 비평가)이 컷신 장면 ${frames.length}장을 보는 중` });
        const notes = [
          ...(stage.letterbox ? ["the scene starts by sliding in cinematic letterbox bars and removes them at the end"] : []),
          ...stage.walks.map((w) => `${w.who} walks ${w.steps} cells from (${w.from.x},${w.from.y}) to (${w.goal.x},${w.goal.y})${w.onRoad ? `, ${w.onRoad} of them on road tiles` : ""}`),
          "after walking up, the two characters turn to face each other; each spoken line is shown in a dialogue box with the speaker's portrait",
          ...(stage.effects?.length ? ["these frames are plain map renders: screen tint, sprite silhouettes and camera moves are NOT drawn in them but do happen in the game", ...stage.effects] : []),
          ...(stageOpensBattle(env.ctx.project, stage.mapId, result.eventIds?.map((e) => e.eventId)) ? ["after the dialogue the scene starts a battle (the battle screen is a separate scene and is NOT drawn in these frames — do not report the fight as missing)"] : []),
        ];
        try {
          const ran = await critiqueStaging({ task, map: { id: map.id, name: map.name }, frames, notes, sideChat: env.sideChat, ...(env.signal ? { signal: env.signal } : {}) });
          session.criticCalls++; session.criticMs += ran.ms;
          critics.push(ran.verdict);
        } catch (error) {
          critics.push({ mapId: map.id, majors: [], problem: `연출 비평 호출 실패: ${error instanceof Error ? error.message : String(error)}` });
        }
      }
      const seen = mapIds.length ? await see(env, session, task, "content", mapIds, undefined, false) : undefined;
      const npcProblems = seen?.checks.filter((c) => !c.ok && (c.id === "npc-reachable" || c.id.startsWith("exit"))) ?? [];
      const stageBad = stage.checks.filter((c) => !c.ok);
      const majors = critics.reduce((n, v) => n + v.majors.length, 0);
      // 고친 횟수 = 같은 맵 컷신을 다시 부른 횟수(첫 짓기는 빼고). 첫 짓기를 세면 상한 1 에서 고치기가 한 번도 없었다(2026-10-25 G39).
      const rounds = session.content.filter((c) => c.verb === verb && (c.result as EventBuildResult).stage?.mapId === stage.mapId).length - 1;
      const clean = !stageBad.length && !npcProblems.length && !majors && !critics.some((v) => v.problem);
      session.stages.set(stage.mapId, { name: map?.name ?? stage.mapId, rounds, eventIds: result.eventIds?.map((e) => e.eventId), problems: clean ? [] : [
        ...stageBad.map((c) => `[무대 ${c.id}] ${c.detail}`),
        ...critics.flatMap((v) => v.majors.map((m) => `[연출 비평] ${m.what}${m.fix ? ` → ${m.fix}` : ""}`)),
      ] });
      const payload = {
        ok: true, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, eventIds: result.eventIds,
        machineChecks: [...stage.checks.map((c) => `[${c.id}] ${c.ok ? "통과" : "문제"} — ${c.detail}`), ...(npcProblems.length ? npcProblems.map((c) => c.detail) : ["사람·출입 검사 통과"])],
        critic: critics.map((v) => ({ mapId: v.mapId, score: v.score, majors: v.majors, ...(v.problem ? { problem: v.problem } : {}) })),
        round: rounds,
        next: clean ? "통과 — 무대 검사·연출 비평 major 0. 다른 요청 부분이 남았으면 이어서, 아니면 보고한다."
          : rounds >= V2_MAX_REPAIR_ROUNDS ? `고치기 상한(${V2_MAX_REPAIR_ROUNDS}번)에 닿았다 — 남은 문제를 보고한다.`
          : "문제가 있다 — add_event 를 같은 kind·when 으로 다시 부르면 앞 컷신(과 그 컷신이 세운 사람)을 바꾼다(겹쳐 쌓이지 않는다). 걷는 곳 낱말·appear where·비트 순서를 고쳐 한 번에 다시 부른다. 칸 좌표는 비평이 짚은 칸이 꼭 필요할 때만.",
      };
      const shots: Seen = { checks: [...stage.checks], critics, images: frames.map((f) => ({ mapId: stage.mapId, dataUrl: f.image })) };
      return withImages(payload, shots.images.length ? shots : seen, 3);
    }
    const seen = mapIds.length ? await see(env, session, task, "content", mapIds, undefined, false) : undefined;
    const npcProblems = seen?.checks.filter((c) => !c.ok && (c.id === "npc-reachable" || c.id.startsWith("exit"))) ?? [];
    return withImages({ ok: result.ok, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, eventIds: result.eventIds,
      ...(seen ? { machineChecks: npcProblems.length ? npcProblems.map((c) => c.detail) : "사람·출입 검사 통과" } : {}),
      next: result.ok ? (npcProblems.length ? "where 낱말이나 at 칸을 바꿔 다시 부른다." : "통과.")
        : /이미 (칩셋에 )?있다/u.test(result.summary) ? "칩셋에 이름이 비슷한 물건이 있다 — inspect 그림이나 이름으로 보아 요청과 같은 물건이면 그 id 를 place_object 로 놓고, 요청과 다른 물건(재질·장치가 다름)이면 draw_object 에 notThese:[그 id 들] 을 넣어 다시 부른다(새로 그린다). 이름만 바꿔 다시 부르지 않는다."
        : "명세를 고쳐 다시 부르거나 못 하는 것을 보고한다." }, seen, 1);
  };

  // 청사진 먼저(2026-10-28): 게임 하나를 만드는 요청이면 짓기 전에 write_blueprint 로 목표·핵심 경로·엔딩을 쓴다.
  // 설계자가 따로 정해진 실행(비교 C: Argon 설계 + Flash 실행)은 설계자가 처음에 한 번 쓰고, 실행 모델은 그 청사진대로 짓는다.
  const needsBlueprint = wantsWholeGame(String(task ?? "")) && !env.ctx.project.gameBlueprint;
  const designer = needsBlueprint ? blueprintDesignerFromEnv() : undefined;
  const designed = designer && env.roleChat ? (() => {
    env.emit({ type: "execution_status", name: "v2.blueprint", ok: true, summary: `설계자(${designer.model})가 청사진을 쓰는 중` });
    return designBlueprint((messages, signal) => env.roleChat!(designer, messages, signal), String(task ?? ""), projectBrief(env.ctx.project, env.ctx.currentMapId), env.signal);
  })() : undefined;
  let designerNoted = false;
  const noteAssembly = (applied: string[]): void => {
    if (applied.length) env.emit({ type: "execution_status", name: "v2.assembly", ok: true, summary: `청사진 조립 기본값: ${applied.join(" · ")}` });
  };
  const blueprintGate = async (): Promise<{ ok: false; summary: string } | undefined> => {
    if (env.ctx.project.gameBlueprint || !wantsWholeGame(String(task ?? ""))) return undefined;
    if (designed) {
      const result = await designed;
      if ("blueprint" in result) {
        env.ctx.project.gameBlueprint = result.blueprint;
        noteAssembly(applyBlueprintAssembly(env.ctx.project));
        await env.checkpoint("write_blueprint");
        env.emit({ type: "execution_status", name: "v2.blueprint", ok: true, summary: `설계자 청사진 ${result.blueprint.steps.length}단계` });
        return { ok: false, summary: `설계자가 이 게임의 청사진을 썼다 — 이 명세는 짓지 않았다. 청사진의 장소·이벤트 이름 그대로 다시 부른다.\n${walkBlueprint(env.ctx.project).lines.join("\n")}\n${result.blueprint.steps.map((st) => `${st.id} 「${st.place}」 「${st.event}」: ${st.action} → ${st.gives}`).join("\n")}` };
      }
      if (!designerNoted) { designerNoted = true; env.emit({ type: "execution_status", name: "v2.blueprint", ok: false, summary: result.error }); }
    }
    return { ok: false, summary: "게임 하나를 만드는 요청이다 — 짓기 전에 write_blueprint 로 이 게임의 청사진(playerGoal·핵심 경로 steps·ending)을 먼저 쓴다. 그다음 청사진의 장소 이름 그대로 짓는다." };
  };
  const writeBlueprint: PiToolShape = {
    name: "write_blueprint", label: "게임 청사진", concurrency: "exclusive",
    description: "Before building a game, write its blueprint (one line of new-player goal, the critical path from start to ending, the ending, the feeling of each scene). Replaces an existing one wholesale (also to match the names actually built). Returns how far this path connects in the current project.",
    parameters: WRITE_BLUEPRINT_SCHEMA as unknown as PiToolShape["parameters"],
    async execute(_id, params) {
      // 설계자 실행에서는 첫 청사진을 설계자가 쓴다 — 실행 모델의 초안은 설계자 청사진이 없을 때만 쓴다(이름 맞추기 다시 쓰기는 그 뒤에 허용).
      if (designed && !env.ctx.project.gameBlueprint) {
        const gate = await blueprintGate();
        if (env.ctx.project.gameBlueprint) return text({ ok: true, summary: `설계자 청사진을 걸었다(네 초안 대신). ${gate?.summary ?? ""}` });
      }
      // 제목·장르를 빠뜨린 다시 쓰기(mt2 Flash: 매 턴 «title·genre is required» 로 한 번 실패한 뒤 다시 썼다)는 앞 청사진·프로젝트 제목으로 채운다.
      const prior = env.ctx.project.gameBlueprint;
      const raw = (params ?? {}) as Record<string, unknown>;
      const filled = { ...raw, title: raw.title || prior?.title || (isPlaceholderTitle(env.ctx.project.meta?.title) ? "" : env.ctx.project.meta?.title) || "제목 없는 게임", genre: raw.genre || prior?.genre || "게임" };
      const parsed = parseBlueprintArgs(filled, String(task ?? ""));
      if ("error" in parsed) return text({ ok: false, summary: `청사진을 읽지 못했다: ${parsed.error}` });
      // 같은 내용을 다시 쓰면 바꾸지 않는다 — 청사진을 되풀이해 쓰는 대신 경로를 짓게 한다.
      const core = (b: typeof parsed.blueprint | undefined) => b ? JSON.stringify({ t: b.title, g: b.genre, p: b.playerGoal, s: b.steps, e: b.ending }) : "";
      if (prior && core(prior) === core(parsed.blueprint)) {
        session.blueprintRewrites += 1;
        const walked = walkBlueprint(env.ctx.project);
        return text({ ok: true, summary: `청사진이 이미 같은 내용이다 — 다시 쓰지 않았다(${session.blueprintRewrites}번째). write_blueprint 를 또 부르지 않는다. ${walked.blockers.length ? "다음: build_blueprint_path 를 불러 청사진 단계대로 이벤트·조건·엔딩 호출을 짓는다." : "경로가 이어져 있다 — 남은 일(장소 꾸미기·대사)을 한다."}`, path: walked.lines, open: walked.blockers.slice(0, 6).map((b) => b.message) });
      }
      env.ctx.project.gameBlueprint = parsed.blueprint;
      const assembled = applyBlueprintAssembly(env.ctx.project);
      // 맵을 이미 지은 뒤 청사진을 다시 쓴 경우에만 실제로 깐다(빈 맵이면 건너뛴다 — 끝맺음 조립이 다시 부른다).
      try { assembled.push(...applyBlueprintOpening(env.ctx.project)); } catch { /* 끝맺음 조립이 다시 시도한다 */ }
      noteAssembly(assembled);
      const walked = walkBlueprint(env.ctx.project);
      await env.checkpoint("write_blueprint");
      return text({ ok: true, summary: `청사진을 걸었다(${parsed.blueprint.steps.length}단계). 장소를 make_place 로 지은 뒤 build_blueprint_path 한 번으로 단계별 이벤트·조건·엔딩 호출을 짓는다(이벤트를 upsert_event 로 하나씩 쓰지 않는다).${assembled.length ? ` 청사진에 맞춰 타이틀 기본값을 바꿨다: ${assembled.join(" · ")}.` : ""}`, path: walked.lines, open: walked.blockers.slice(0, 8).map((b) => b.message) });
    },
  };

  // 청사진 경로 짓기(2026-10-28 mt2): 단계(place·event·needs·gives)와 엔딩에서 이벤트·조건·스위치·아이템·엔딩 호출을 함수가 짓는다.
  const runBlueprintPath = (steps: readonly PathStepText[]) => {
    const result = buildBlueprintPath(run, steps);
    return result;
  };
  const buildBlueprintPathVerb: PiToolShape = {
    name: "build_blueprint_path", label: "청사진 경로 짓기", concurrency: "exclusive",
    description: "Build the blueprint's (write_blueprint) critical path as a real play path — per step put an examine/talk event on that map (an event with the same name is rewritten), hang the previous step's gives (keys and notes become items, the rest switches) as the next step's condition, and make the last step call the ending (if no ending exists it is defined from the blueprint ending). Call once after building the places — do not match events one by one with upsert_event/define_ending. Only dialogue can be given, via steps[{id, lines, lockedLines}] (empty = filled from the blueprint text); a number lock gets code on that step and the answer in the previous step's lines. Calling again rewrites the same events.",
    parameters: BUILD_BLUEPRINT_PATH_SCHEMA as unknown as PiToolShape["parameters"],
    async execute(id, params) {
      if (!env.ctx.project.gameBlueprint) return text({ ok: false, summary: "청사진이 없다 — write_blueprint 를 먼저 부른다." });
      const steps = ((params as { steps?: PathStepText[] }).steps ?? []).filter((t) => t && typeof t.id === "string");
      return finishContent(id, "build_blueprint_path", params, runBlueprintPath(steps));
    },
  };
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
    // 단계(빈 시작 맵 치우기 → 방탈출 봉인 → … → 맵마다 출구 마감·길·그림·사람 자리)는 src/ai/v2/lanes/stages/ — 한 단계에 파일 하나.
    const notes = runLaneStages(env, session, run);
    if (notes.length) {
      recordWrite(env, run, `auto-lanes-${Date.now()}`, "move_event", { auto: "transfer-lanes" }, true, notes.join(" / ").slice(0, 400), {});
      await env.checkpoint("clear_transfer_lanes");
    }
    return notes;
  };

  const makePlace: PiToolShape = {
    name: "make_place", label: "장소 짓기", concurrency: "exclusive",
    description: "Build a place (interior, village, dungeon, cave, street, house) from one spec. Do not write cells, coordinates or tile numbers — the function builds it and returns the 1x picture, machine checks and an independent critique.",
    parameters: { type: "object", properties: { spec: PLACE_SPEC_SCHEMA }, required: ["spec"] },
    async execute(id, params) {
      const gate = await blueprintGate();
      if (gate) return text(gate);
      // 같은 요청 → 같은 맵을 막는다(2026-10-23 다양성: 역전 상점가가 v1·v2·4차·5차 모두 화소까지 같았다). 고치기는 기록된 명세의 salt 를 물려받는다.
      // 씨앗은 모델이 정하지 않는다 — 요청·게임 열쇠(variety)로 빌더가 정한다(2026-10-29: terra 가 seed 0·1·2 를 채워 동굴 8장이 세 무리로 같았다).
      const raw0 = (params as { spec: PlaceSpec }).spec;
      const { seed: _modelSeed, ...rawHints } = (raw0.hints ?? {}) as Record<string, string | number | boolean>;
      const raw: PlaceSpec = raw0.hints ? { ...raw0, hints: rawHints } : raw0;
      let spec: PlaceSpec = localizeCultureSpec(localizePlaceSpec(dropModelSeed({ ...raw, salt: Math.floor(Math.random() * 1_000_000), variety: placeVariety(env, task) }, true), String(task ?? "")), String(task ?? ""));
      // 없는 맵 id 는 버리고 새 맵에 짓는다 — flash 가 타일셋 id(beodeul_city)를 mapId 로 보내 「맵이 없습니다」로 한 채도 못 지었다(2026-10-29 b5 강가 마을).
      if (spec.mapId && !run.ctx.project.maps[spec.mapId]) { const { mapId: _gone, ...rest } = spec; spec = rest; }
      // 이번 실행에서 이미 다른 장소를 지은 맵 위에 새 장소를 짓지 않는다 — 「지하 예배당」을 지은 맵에 「검은 장미 저택」을 다시 지어
      // 예배당이 1층 한 구석으로 사라졌다(2026-10-25 조수 단독 게임 G27). 같은 장소를 다시 짓는 것(이름이 같거나 한쪽이 다른 쪽을 품음)은 그대로 둔다.
      const target = spec.mapId ?? (spec.type === "interior" ? (run.ctx.currentMapId ?? run.ctx.project.startMapId) : undefined);
      const other = target ? session.places.get(target) : undefined;
      const norm = (s: string) => s.replace(/\s+/gu, "");
      const samePlace = (a: string, b: string) => { const [x, y] = norm(a).length <= norm(b).length ? [norm(a), norm(b)] : [norm(b), norm(a)]; return !!x && (y === x || y.startsWith(x) || y.endsWith(x)); };
      let keptNote = "";
      if (other && !samePlace(other.spec.name, spec.name)) {
        const { mapId: _drop, ...rest } = spec;
        spec = { ...rest, hints: { ...(spec.hints ?? {}), newMap: true } };
        keptNote = `「${other.spec.name}」(${target}) 는 이번에 지은 다른 장소라 덮지 않고 「${spec.name}」을 새 맵에 지었다 — 두 장소를 create_transfer_pair 로 잇는다(계단·문).`;
      }
      // 손 도트 실내 방은 조수가 설계한다: 설계(zones[].design) 없이 오면 장소마다 한 번 되돌려 보낸다. 다시 설계 없이 오면 짓기 전에 같은 모델에게 따로 설계를 받는다(designRooms.ts).
      // 손 도트 실내로 지어지는지는 빌더와 같은 함수로 본다 — style:modern 이어도 주인공 물건 때문에 v5 로 짓는 방이 견본 서재로 섰다(2026-10-29 vm8 flash 방탈출).
      if (spec.type === "interior" && !spec.mapId && buildsHandInterior(run.ctx.project, spec)
        && !(spec.zones ?? []).some((z) => z.design) && !session.designBounced.has(spec.name)) {
        session.designBounced.add(spec.name);
        // 재료(기물 이름표·견본 배치)를 같이 돌려준다 — 되돌려 보내기를 «실패»로 읽고 짓기를 그만둔 모델이 있었다(2026-10-29 flash 「마법사의 서재」).
        const purpose = (spec.zones ?? []).map((z) => `${z.kind} ${z.purpose ?? ""}`).join(" ") || spec.name;
        const parts = roomParts(run.ctx.project, purpose);
        return text({ ok: false, notFailure: true, summary: `아직 짓지 않았다(실패 아님) — 「${spec.name}」의 방은 네가 설계한다. 아래 parts(기물 이름표·바닥/벽면·깔개·견본 배치)를 보고 방마다 zones[].design 을 채워 make_place 를 바로 다시 부르면 지어진다: shape(rect·L ㄱ자·U ㄷ자·T ㅜ자·bay 창가 돌출·alcove 알코브 — parts.shapes·shapeExamples 를 보고 고른다, 곁방은 zones 둘)·w×h(바닥 칸)·door·floor·wall·groups[{name, at(north·south·west·east·center·nw·ne·sw·se), pos, rug, items[{id, dx, dy, count}]}]. 무엇을 몇 개 어디에 놓을지는 네가 정하고 함수는 고친 것만 알린다. 견본은 참고 — 베끼지 않는다.`,
          ...(parts ? { parts: { shapes: parts.shapes, shapeExamples: parts.shapeExamples, floors: parts.floors, walls: parts.walls, rugs: parts.rugs, items: parts.items, references: parts.references } } : {}) });
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
      if (builder.id === "dungeon" && !(spec.mapId && session.places.has(spec.mapId)) && !spec.dungeonDesign && !spec.floorDesigns?.length && !session.dungeonBounced.has(spec.name)) {
        session.dungeonBounced.add(spec.name);
        const parts = dungeonParts(`${spec.theme ?? ""} ${spec.name} ${spec.type}`, String(env.request.projectKey ?? run.ctx.project.meta.title ?? ""), dungeonContext(session.places.values(), spec.name));
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
        const va = villageArgs(spec).args; const vt = String(va.theme ?? "river");
        if (usesCodeTerrain(va, vt)) {
          const shape = JSON.stringify([va.theme, va.landform, va.terrain, va.water, va.high, va.tiers, spec.hints?.terrainSeed]);
          const kept = session.villageTerrain.get(spec.name);
          const hasLayout = !!spec.hints?.layout && typeof spec.hints.layout === "object";
          if (!hasLayout && (!kept || (kept.shape !== shape && kept.previews < 3))) {
            const [width, height] = villageMapSize(spec, va);
            const terrainSeed = typeof spec.hints?.terrainSeed === "number" ? Math.max(0, Math.floor(spec.hints.terrainSeed)) : (spec.salt ?? 0) % 100000;
            const terrain = codeTerrainFor(vt, va, width, height, terrainSeed);
            session.villageTerrain.set(spec.name, { terrainSeed, width, height, shape, previews: (kept?.previews ?? 0) + 1 });
            const res = text({ ok: false, notFailure: true,
              summary: `아직 짓지 않았다(실패 아님) — 「${spec.name}」의 땅을 코드가 만들었다(${width}×${height}, terrainSeed ${terrainSeed}). 아래 그림(좌표 눈금: 위 x·왼쪽 y, 칸 단위)과 요약을 보고 `
                + `마을 자리를 네가 고른다 — 같은 make_place 에 hints.layout 을 넣어 다시 부르면 이 땅 위에 짓는다. ${villageLayoutGuide(vt, va.fishing === true, va.form === "scatter")} 땅이 요청과 다르면 hints.landform·water·high 나 terrainSeed 를 바꿔 다시 부르면 새 땅을 보여 준다.`,
              terrain: describeCodeTerrain(terrain) });
            const png = terrainPreviewPng(terrain, 8);
            let bin = ""; for (let k = 0; k < png.length; k += 1) bin += String.fromCharCode(png[k]!);
            res.content.push({ type: "image", mimeType: "image/png", data: btoa(bin) });
            return res;
          }
          if (kept) spec = { ...spec, hints: { ...(spec.hints ?? {}), terrainSeed: kept.terrainSeed, width: kept.width, height: kept.height } };
        }
      }
      const designed = await designMissingRooms(env, spec, "make_place 설계 빈 방");
      spec = designed.spec;
      env.emit({ type: "execution_status", name: "v2.build", ok: true, summary: `${spec.name} 짓는 중(${builder.id})` });
      await builder.prepare?.(spec);
      let result = builder.build(run, spec);
      result = withSetupDefaults(result, builder.id, run.ctx.project, String(task ?? ""), freshStart);
      if (keptNote || designed.notes.length) result = { ...result, warnings: [...(keptNote ? [keptNote] : []), ...designed.notes, ...result.warnings] };
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
      return finishPlace(id, "make_place", params, spec, builder.id, result, 0);
    },
  };

  const editPlace: PiToolShape = {
    name: "edit_place", label: "장소 고치기", concurrency: "exclusive",
    description: "Rebuild a built (or existing) place with the same builder, changing only part of its spec. Pass critic-major coordinates as addAnchors.near. 1 round per map. For a room you designed with design, put the whole fixed design in patch.design (dressing is not for designed rooms).",
    parameters: { type: "object", properties: { patch: { type: "object", properties: {
      mapId: { type: "string", description: "map id to fix (inside patch)" },
      set: { type: "object", properties: { name: { type: "string" }, style: { type: "string" }, theme: { type: "string" }, size: SIZE, floors: { type: "number" }, features: { type: "array", items: { type: "string" } }, exits: { type: "array", items: { type: "string", enum: ["south", "north", "east", "west"] } }, hints: HINTS_SCHEMA, dungeonDesign: DUNGEON_DESIGN_SCHEMA } },
      addZones: { type: "array", items: ZONE_SCHEMA },
      removeZones: { type: "array", items: { type: "string" } },
      addAnchors: { type: "array", items: { type: "object", properties: { zone: { type: "string" }, what: { type: "string" }, near: POINT }, required: ["what"] } },
      addFeatures: { type: "array", items: { type: "string" } },
      removeFeatures: { type: "array", items: { type: "string" } },
      variant: { type: "number" }, dressing: { type: "number" },
      design: ROOM_DESIGN_SCHEMA, designZone: { type: "string", description: "(designed room) zone id or kind whose design changes — omitted = the first designed zone" },
    }, required: ["mapId"] } }, required: ["patch"] },
    async execute(id, params) {
      const raw = params as { patch: PlacePatch; mapId?: string };
      // 모델이 mapId 를 patch 바깥에 두기도 한다(2026-10-23 실조수) — 둘 다 받는다.
      const { seed: _seed, ...rawPatch } = (raw.patch ?? {}) as PlacePatch;
      const patch0: PlacePatch = { ...rawPatch, mapId: raw.patch?.mapId ?? raw.mapId ?? env.ctx.currentMapId ?? "" };
      const patch: PlacePatch = patch0.set?.hints && "seed" in patch0.set.hints ? { ...patch0, set: { ...patch0.set, hints: Object.fromEntries(Object.entries(patch0.set.hints).filter(([k]) => k !== "seed")) } } : patch0;
      let record = session.places.get(patch.mapId);
      // 이미 있는 방(이 실행이 짓지 않은 방)의 「아늑하게·물건 더하기·뒷문」은 다시 짓지 않고 덧찍는다 — 다시 지으면 원래 바닥·가구가 바뀐다(2026-10-23 비교).
      const doorWord = /뒷문|출입문|back ?door|^문$|^door$/iu;
      const north = (patch.set?.exits ?? []).includes("north") || (patch.addAnchors ?? []).some((a) => doorWord.test(a.what.trim()));
      const stampOnly = !patch.addZones?.length && !patch.removeZones?.length && patch.variant === undefined && patch.seed === undefined && !patch.addFeatures?.length && !patch.removeFeatures?.length
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
      if (!record) return text({ ok: false, summary: `${patch.mapId} 는 v2 가 지은 기록이 없고 다시 지을 방 구성도 읽지 못했다. make_place(mapId=${patch.mapId}) 로 그 자리에 새로 짓거나 못 한다고 알린다.` });
      if (record.rounds >= V2_MAX_REPAIR_ROUNDS) return text({ ok: false, summary: `고치기 상한(${V2_MAX_REPAIR_ROUNDS}바퀴)에 닿았다. 남은 문제를 사용자에게 보고한다.` });
      const builder = builderFor(record.spec)!;
      // 마을·던전·거리 빌더는 소품 하나하나·꾸밈 정도를 받지 않는다 — 그런 패치로 다시 지으면 같은 맵이 또 나오고 바퀴만 쓴다(2026-10-23 v2 실조수).
      if (builder.id !== interiorBuilder.id) {
        const effective = !!(patch.set || patch.variant !== undefined || patch.seed !== undefined || patch.addFeatures?.length || patch.removeFeatures?.length || patch.addZones?.length || patch.removeZones?.length
          || (patch.addAnchors ?? []).some((a) => /적|몬스터|박쥐|해골|거미|고블린|슬라임|늑대|좀비|유령|enem|monster|bat|skeleton|spider|goblin|slime|wolf|zombie|ghost|상자|chest|보스|boss|레버|lever|광장|plaza|우물|well|밭|field|자판기|vending|공원|park/iu.test(a.what)));
        if (!effective) {
          // 거절도 한 바퀴로 센다 — 바퀴를 안 쓰면 모델이 같은 거절을 열 번 넘게 되풀이했다(2026-10-23 3차 피라미드: edit_place 13번 중 12번 거절).
          const spent = { ...record, rounds: record.rounds + 1 };
          for (const mapId of record.result.mapIds) session.places.set(mapId, spent);
          const left = V2_MAX_REPAIR_ROUNDS - spent.rounds;
          return text({ ok: false, summary: `${builder.id} 빌더는 소품 하나하나·꾸밈(dressing)·단상·석관 같은 물건 지정을 받지 않는다 — 고칠 수 있는 것은 variant(다른 배치)·features·size·floors 뿐이다. 이 거절도 한 바퀴로 셌다(남은 바퀴 ${Math.max(0, left)}).${left <= 0 ? " 더 고치지 말고 남은 major 를 사용자에게 그대로 보고한다." : " 그 넷으로 못 고치는 major 는 고치려 하지 말고 보고에 적는다."}` });
        }
      }
      const floor = Math.max(1, record.result.mapIds.indexOf(patch.mapId) + 1);
      const onlyAnchors = floor === 1 && !!patch.addAnchors?.length && !patch.set && !patch.addZones?.length && !patch.removeZones?.length && !patch.addFeatures?.length && !patch.removeFeatures?.length && patch.variant === undefined && patch.seed === undefined && patch.dressing === undefined;
      let spec = applyPatch(record.spec, patch, floor);
      // 고치며 더한 구역·설계 없던 방도 모델이 설계한다(원래 방을 지키는 keep 구역은 빼고).
      const redesigned = onlyAnchors || builder.id !== interiorBuilder.id ? undefined : await designMissingRooms(env, spec, "edit_place 설계 빈 방");
      if (redesigned) spec = redesigned.spec;
      env.emit({ type: "execution_status", name: "v2.repair", ok: true, summary: `${spec.name} 고치는 중(${record.rounds + 1}바퀴)` });
      const before = { project: env.ctx.project, record, seen: new Map(record.result.mapIds.map((m) => [m, session.seen.get(m)!] as const).filter(([, v]) => !!v)) };
      const built = onlyAnchors && builder.id === interiorBuilder.id ? interiorAddAnchors(run, record, patch.addAnchors!) : builder.build(run, spec, record);
      const result = redesigned?.notes.length ? { ...built, warnings: [...redesigned.notes, ...built.warnings] } : built;
      return finishPlace(id, "edit_place", params, spec, builder.id, result, record.rounds + 1, before.seen.size ? before : undefined);
    },
  };

  const addPeople: PiToolShape = {
    name: "add_people", label: "사람 두기", concurrency: "exclusive",
    description: "Place NPCs from a spec (role, spot word, appearance words, lines). The function picks a walkable cell and builds the first-talk / later-talk pages.",
    parameters: { type: "object", properties: {
      mapId: { type: "string" },
      people: { type: "array", items: { type: "object", properties: {
        role: { type: "string" }, name: { type: "string" }, where: { type: "string" }, at: POINT, mapId: { type: "string" }, looks: { type: "string" },
        firstTalk: { type: "array", items: { type: "string" } }, laterTalk: { type: "array", items: { type: "string" } },
        movement: { type: "string", enum: ["still", "wander", "patrol"] },
      }, required: ["role"] } },
    }, required: ["people"] },
    async execute(id, params) {
      const p = params as { people: PersonSpec[]; mapId?: string };
      const result = buildPeople(run, p.people, p.mapId ?? env.ctx.currentMapId);
      return finishContent(id, "add_people", params, result);
    },
  };

  // 상위 동사 둘(sceneVerbs.ts) — 「말 걸고 → 보스전」·「대사 → 엔딩」을 한 번에. 모델은 누가·무슨 말·어디만 준다.
  const addBossEncounter: PiToolShape = {
    name: "add_boss_encounter", label: "보스 만남", concurrency: "exclusive",
    description: "Build a talking boss and the boss battle in one go — the boss person (if already present only the lines change), lines before the fight, the boss troop (if missing, made with art from the name/appearance words at a strength matched to the starting party), lines after winning, and vanishing after the win (or laterTalk). Do not assemble it from lower tools (upsert_enemy, upsert_troop, patch_event_page).",
    parameters: { type: "object", properties: {
      mapId: { type: "string", description: "map id (or map name) where the boss stands" },
      boss: { type: "object", properties: {
        name: { type: "string" }, where: { type: "string", description: "spot word (방 안쪽 back of the room · 제단 앞 in front of the altar…)" }, at: POINT, looks: { type: "string", description: "appearance words (해골 기사 skeleton knight · 검은 갑옷 black armor…)" },
        enemy: { type: "string", description: "enemy art word (해골 skeleton · 늑대 wolf · 용 dragon · 마왕 demon king…) — empty = from the name/appearance" }, troopId: { type: "string", description: "only to use an existing troop" },
      }, required: ["name"] },
      lines: { type: "array", items: { type: "string" }, description: "boss lines before the fight (1–6 lines)" },
      afterWin: { type: "array", items: { type: "string" }, description: "boss lines right after winning (optional)" },
      laterTalk: { type: "array", items: { type: "string" }, description: "when talked to again after the win (optional; empty = the boss vanishes)" },
    }, required: ["boss", "lines"] },
    async execute(id, params) {
      return finishContent(id, "add_boss_encounter", params, buildBossEncounter(run, params as BossEncounterSpec));
    },
  };
  const addEndingScene: PiToolShape = {
    name: "add_ending_scene", label: "엔딩 장면", concurrency: "exclusive",
    description: "Build an ending scene in one go — the ending definition (epilogue, final title) and an event on that map that calls the ending after its lines. When: automatically on entering the map after afterSwitchId (or the after word — «마왕» means the demon-king-defeated switch) is on; with talkTo, when talking to that person. Do not assemble it from lower tools (define_ending, patch_event_page).",
    parameters: { type: "object", properties: {
      mapId: { type: "string", description: "ending scene map id (or map name)" },
      title: { type: "string", description: "ending name and final screen title" },
      lines: { type: "array", items: { type: "string" }, description: "scene lines — «이름: 대사» (with speaker) or just the line" },
      epilogue: { type: "array", items: { type: "string" }, description: "epilogue lines on the ending screen (3+ lines recommended)" },
      talkTo: { type: "string", description: "ending when talking to this person (optional)" },
      afterSwitchId: { type: "string", description: "only after this switch is on (optional)" },
      after: { type: "string", description: "word for what it follows («마왕», «해골 기사») — finds the defeat switch (optional)" },
    }, required: ["title", "lines"] },
    async execute(id, params) {
      return finishContent(id, "add_ending_scene", params, buildEndingScene(run, params as EndingSceneSpec));
    },
  };

  const addEvent: PiToolShape = {
    name: "add_event", label: "사건·컷신", concurrency: "exclusive",
    description: "Make a cutscene or dialogue event as a list of beats (walk/say/appear/face/wait/fade/tint/weather/shake/flash/music/emote/camera/look/vanish). The function decides walkable paths and spots and checks with a preview probe.",
    parameters: { type: "object", properties: { event: { type: "object", properties: {
      kind: { type: "string", enum: ["cutscene", "talk", "trigger"] }, mapId: { type: "string" },
      when: { type: "string", enum: ["game-start", "touch", "talk"] }, where: { type: "string" }, at: POINT,
      after: { type: "string", description: "play right after talking with this NPC name ends (appended to the end of that NPC's talk, once only)" },
      afterTalk: { type: "array", items: { type: "string" }, description: "what that NPC says when talked to again after the after scene (if the situation changed, like night falling or after an incident). Omitted = the original lines" },
      afterPage: { type: "integer", description: "when the after NPC has several talk pages, the page number (from 0) to attach the scene to. If pages split like day/night, the page where the scene happens — if unsure leave it empty and the call returns the page list" },
      beats: { type: "array", items: { type: "object", properties: {
        do: { type: "string", enum: ["walk", "say", "appear", "face", "wait", "fade", "tint", "weather", "shake", "flash", "music", "emote", "camera", "look", "vanish"] },
        who: { type: "string" }, to: { type: "string", description: "spot word (or 'x,y')" }, text: { type: "string" },
        where: { type: "string" }, looks: { type: "string" }, toward: { type: "string" }, ms: { type: "number" }, dir: { type: "string", enum: ["in", "out"] },
        tone: { type: "string", enum: ["night", "dusk", "dawn", "sepia", "clear"] }, as: { type: "string", enum: ["shadow", "ghost", "normal"] },
        weather: { type: "string", enum: ["rain", "storm", "snow", "fog", "none"] }, intensity: { type: "number" },
        strength: { type: "string", enum: ["weak", "medium", "strong"] }, axis: { type: "string", enum: ["both", "horizontal", "vertical"] }, color: { type: "string" },
        action: { type: "string", enum: ["bgm", "se", "bgs", "stop", "fade"] }, emote: { type: "string", description: "emote: ! ? ♥ 땀 화 … zzz 반짝 전구 or exclamation·question·heart·sweat·anger·ellipsis·sleep·sparkle·idea·music·smile" }, query: { type: "string", description: "music: word to find the sound (festival·battle·town·sad·boss·door…; horror 비명 scream · 심장 heartbeat · 삐걱 creak · 물방울 drip · 웅웅 hum · 속삭임 whisper · 쾅 bang · 발소리 footsteps)" },
      }, required: ["do"] } },
    }, required: ["kind", "beats"] } }, required: ["event"] },
    async execute(id, params) {
      const event = (params as { event: EventSpec }).event;
      const beats = event.beats.map((b) => {
        const raw = b as unknown as Record<string, unknown>;
        const asPoint = (v: unknown) => typeof v === "string" && /^\s*\d+\s*,\s*\d+\s*$/u.test(v) ? { x: Number(v.split(",")[0]), y: Number(v.split(",")[1]) } : v;
        return { ...raw, ...(raw.to !== undefined ? { to: asPoint(raw.to) } : {}), ...(raw.where !== undefined ? { where: asPoint(raw.where) } : {}) } as unknown as EventSpec["beats"][number];
      });
      const result = buildEvent(run, { ...event, ...(event.mapId || !env.ctx.currentMapId ? {} : { mapId: env.ctx.currentMapId }), beats });
      return finishContent(id, "add_event", params, result);
    },
  };

  const addScene: PiToolShape = {
    name: "add_scene", label: "두 선택 대화 장면", concurrency: "exclusive",
    description: "A short dialogue scene with one partner — opening lines, two choices with a reaction per choice, and what they say when talked to again. If a confirmed romance plan exists it follows that contract; the function stands the partner up with matching-face art and checks both choices in the real runtime.",
    parameters: { type: "object", properties: { scene: SCENE_SCHEMA }, required: ["scene"] },
    async execute(id, params) {
      const scene = (params as { scene: SceneSpec }).scene;
      return finishContent(id, "add_scene", params, buildScene(run, { ...scene, ...(scene.mapId || !env.ctx.currentMapId ? {} : { mapId: env.ctx.currentMapId }) }));
    },
  };

  // 퍼즐 사슬·잠긴 방 막기(2026-10-25 공포 판정 J12/J13): 조각을 따로 지으면 답이 새고 잠긴 방에 벽 틈이 남는다.
  const LINES = { type: "array", items: { type: "string" } } as const;
  const authorPuzzleChain: PiToolShape = {
    name: "author_puzzle_chain", label: "퍼즐 사슬", concurrency: "exclusive",
    description: "Build clue → lock (password or choice) → reward → locked door in one go. Links in order: only the previous link's learn · reward.flag · reward.item names become a later link's needs. Put the answer (code) only in the clue's lines, never in the lock's lines (a leak is rejected). A door, after building, blocks the door cell and walks; if the room behind is reachable another way, the gap is filled with wall. Existing events are rewritten by eventId; new ones get at{x,y} and name.",
    parameters: { type: "object", properties: {
      mapId: { type: "string" }, name: { type: "string", description: "chain name (e.g. 서재의 비밀)" },
      links: { type: "array", items: { type: "object", properties: {
        role: { type: "string", enum: ["clue", "code", "door", "pickup"] },
        eventId: { type: "string" }, name: { type: "string" }, mapId: { type: "string" },
        at: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
        learn: { type: "string", description: "clue: what you learn by reading (the needs name of a later link)" },
        needs: { type: "string", description: "what must exist first — a previous link's learn · reward.flag · reward.item name" },
        code: { type: "string", description: "code: the number answer, or the right one among options" },
        options: LINES, lines: LINES, lockedLines: LINES, wrongLines: LINES, doneLines: LINES,
        reward: { type: "object", properties: { item: { type: "string" }, flag: { type: "string" }, lines: LINES } },
        seal: { type: "boolean", description: "door: seal gaps behind the door (default true)" },
      }, required: ["role"] } },
    }, required: ["mapId", "name", "links"] },
    async execute(id, params) {
      const args = params as unknown as ChainArgs;
      return finishContent(id, "author_puzzle_chain", params, buildPuzzleChain(run, { ...args, mapId: args.mapId || env.ctx.currentMapId || "" }));
    },
  };
  const setObjectiveVerb: PiToolShape = {
    name: "set_objective", label: "현재 목표 걸기", concurrency: "exclusive",
    description: "Set a one-line to-do in the «현재 목표» (current objective) bar at the top right of the screen (it persists across loads and map changes). When making a game always: one starting objective with at:'start', and for every event that advances the story (gives a key, shows a flashback, turns on a switch) the next objective with eventId — it goes right after that event's switch-on or item gain. Make the text concrete with place, person and object names («창고 상자에서 태엽 열쇠를 찾자», «밤이 되면 집 현관에서 쉬자»). A «where» is attached too: give the target event or place (id or name) in where, or if the text names another place, the direction of its entrance is added automatically («(지하철역 입구: 남동쪽)»). Not needed on events that call the ending.",
    parameters: { type: "object", properties: {
      text: { type: "string", description: "one line of what to do now (within 80 chars)" },
      at: { type: "string", enum: ["start"], description: "start = the game-start objective" },
      eventId: { type: "string", description: "the objective after this event (id or name) advances the story" },
      mapId: { type: "string" },
      where: { type: "string", description: "target event or place of the objective (id or name) — its direction/entrance is attached to the objective bar" },
    }, required: ["text"] },
    async execute(_id, params) {
      const p = params as { text?: string; at?: string; eventId?: string; mapId?: string; where?: string };
      const plan = planObjective(env.ctx.project, { text: String(p.text ?? ""), ...(p.at ? { at: p.at } : {}), ...(p.eventId ? { eventId: String(p.eventId) } : {}), ...(p.mapId ? { mapId: String(p.mapId) } : {}), ...(p.where ? { where: String(p.where) } : {}) });
      if (!plan.ok) return text({ ok: false, summary: plan.summary });
      for (const entry of plan.events) {
        // 목표 명령만 넣은 같은 페이지 묶음을 다시 쓴다 — 조수 「통째 다시 보내기」 거부(assistantRewriteGuard)가 이 동사의 쓰기까지 막아
        // romance-j91 에서 set_objective 가 여섯 번 모두 실패했다(「현재 목표 줄을 넣는 기능이 계속 오류」). 의도한 전체 쓰기라 replacePages.
        const wrote = run.call("upsert_event", { mapId: entry.mapId, event: entry.event, replacePages: true });
        if (!wrote.ok) return text({ ok: false, summary: `목표를 넣지 못했다: ${wrote.summary}` });
      }
      // 목표 줄을 숨기는 HUD(이야기·공포 기본값은 objective:false 였다)면 켠다.
      if (env.ctx.project.system.fieldHud?.objective === false) run.call("set_field_hud", { objective: true });
      await env.checkpoint("set_objective");
      return text({ ok: true, summary: plan.summary });
    },
  };
  const sealLockedRoomVerb: PiToolShape = {
    name: "seal_locked_room", label: "잠긴 방 막기", concurrency: "exclusive",
    description: "If the room behind a locked door (eventId) can be walked into without passing the door, fill the gap with the adjacent wall tile (blocks the door cell and walks from the start and landing spots). Use it when the game check «잠긴 방» (locked room) flags one.",
    parameters: { type: "object", properties: { mapId: { type: "string" }, eventId: { type: "string" } }, required: ["mapId", "eventId"] },
    async execute(id, params) {
      const p = params as { mapId: string; eventId: string };
      return finishContent(id, "seal_locked_room", params, sealLockedRoom(run, p.mapId, p.eventId));
    },
  };

  const drawObjectVerb: PiToolShape = {
    name: "draw_object", label: "없는 물건 그리기", concurrency: "exclusive",
    description: "Hand an object the chipset lacks to the workshop one-click drawing path. The result summary honestly says whether it was placed or is pending.",
    parameters: { type: "object", properties: { object: { type: "object", properties: {
      what: { type: "string" }, description: { type: "string" }, mapId: { type: "string" }, where: { type: "string" }, at: POINT,
      notThese: { type: "array", items: { type: "string" }, description: "ids that were rejected as «already exists» but whose art is a different object from the request" },
    }, required: ["what"] } }, required: ["object"] },
    async execute(id, params) {
      const object = (params as { object: ObjectSpec }).object;
      // 동굴·던전 입구는 물건이 아니라 들어가는 장소다 — 그림 카드로 미루면 맵에 아무것도 서지 않고 들어갈 곳도 없다(2026-10-30 실조수 opus 「서쪽 길 끝 동굴」).
      // 이 실행에 던전을 아직 짓지 않았으면 그리지 않고 make_place 로 돌려보낸다. 지은 뒤 입구 꾸밈을 더 그리는 것은 막지 않는다.
      if (DUNGEON_PLACE_WORD.test(`${object.what ?? ""} ${object.description ?? ""}`) && ![...session.places.values()].some((r) => r.builder === "dungeon")) {
        const side = requestedDungeonSide(String(task ?? ""));
        return text({ ok: false, notFailure: true, summary: `그리지 않았다(실패 아님) — 「${object.what}」은 그림 한 장이 아니라 들어가는 장소다. make_place type "cave"(또는 "dungeon")로 굴을 지으면 짓기가 지금 마을${side ? `의 ${({ north: "북", south: "남", east: "동", west: "서" } as const)[side]}쪽` : ""} 가장자리 길 끝 칸에 바깥 문(입구)을 잇는다. 굴을 지은 뒤에도 입구 꾸밈이 더 필요하면 그때 draw_object 를 부른다.` });
      }
      const result: DrawObjectResult = drawObject(run, { ...object, ...(object.mapId || !env.ctx.currentMapId ? {} : { mapId: env.ctx.currentMapId }) });
      // 미리 정한 자리·크기를 기억한다 — 그림이 끝난 뒤 place_object 가 where·at 없이 불리면 이 자리에 놓는다.
      if (result.ok && result.plan) rememberObjectPlan(session, result.plan);
      return finishContent(id, "draw_object", params, result);
    },
  };

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
      const record = session.places.get(p.mapId);
      type ArgsState = { tilesetId?: string; mapId?: string; args?: Record<string, unknown>; stampEdit?: boolean; adopted?: { tilesetId: string; args: Record<string, unknown> } };
      const state = record?.result.state as ArgsState | undefined;
      let base: { tilesetId: string; args: Record<string, unknown> } | undefined;
      let prev: ArgsState | undefined;
      if (state?.args && !state.stampEdit && String(state.args.mapId ?? state.mapId) === p.mapId) { base = { tilesetId: state.tilesetId ?? map.tilesetId, args: state.args }; prev = state; }
      else {
        if (state?.args && !state.stampEdit && state.mapId !== p.mapId) return text({ ok: false, summary: `${p.mapId} 는 위층·딸린 맵이라 아직 가구를 옮기지 못한다 — 보고에 적는다.` });
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

  // ───── make_game: 작은 게임 한 판(맵 5~8장·잇기·사람·사건)을 계획 한 번으로 ─────
  const personItem = (addPeople.parameters as { properties: { people: { items: { properties: Record<string, unknown>; required: string[] } } } }).properties.people.items;
  const eventItem = (addEvent.parameters as { properties: { event: { properties: Record<string, unknown>; required: string[] } } }).properties.event;
  const hasTransferTo = (fromId: string, toId: string): boolean => {
    const walk = (node: unknown): boolean => Array.isArray(node) ? node.some(walk) : !!node && typeof node === "object" && (((node as { kind?: string; mapId?: string }).kind === "transfer" && (node as { mapId?: string }).mapId === toId) || Object.values(node).some(walk));
    return (env.ctx.project.maps[fromId]?.events ?? []).some((e) => walk(e.commands ?? []) || walk(e.pages ?? []));
  };
  // 부모 맵 ↔ 새로 지은 자식 장소 잇기(make_game 과 끝맺음 자동 짓기가 같이 쓴다): 실내는 마을 집 문, 던전은 입구, 바깥끼리는 가장자리, 못 하면 이동 칸.
  const linkChild = (parentMap: string, parentSpec: PlaceSpec | undefined, parentResult: PlaceBuildResult | undefined, spec: PlaceSpec, result: PlaceBuildResult, side?: "north" | "south" | "east" | "west"): string => {
    const notes: string[] = [];
    const childMap = result.mapIds[0]!;
        const pName = env.ctx.project.maps[parentMap]?.name ?? parentMap, cName = env.ctx.project.maps[childMap]?.name ?? childMap;
        if (hasTransferTo(parentMap, childMap)) return `${pName} ↔ ${cName}: 짓기에서 이어짐`;
        const usedDoors = new Set<string>((env.ctx.project.maps[parentMap]?.events ?? []).map((e) => `${e.x},${e.y + 1}`));
        let linked = false;
        if (isInside(spec) && result.entrance) {
          const door = pickDoor(villageDoors(parentResult ?? ({ state: undefined } as unknown as PlaceBuildResult)), spec.name, usedDoors, env.ctx.project.maps[parentMap]!);
          if (door) {
            const r = run.call("create_transfer_pair", { a: { mapId: parentMap, x: door.x, y: door.y, doorAt: { x: door.x, y: door.y - 1 } }, b: { mapId: childMap, x: result.entrance.x, y: result.entrance.y } });
            linked = r.ok; notes.push(r.ok ? `${pName} 집 문(${door.x},${door.y - 1}${door.kit ? ` ${door.kit}` : ""}) ↔ ${cName}` : `${pName} 집 문 잇기 실패: ${r.summary.slice(0, 160)}`);
          } else {
            // 지은 결과의 집 문 목록이 없으면(모델이 지은 부모 맵) 그 맵의 문 그림·계단·길 끝, 없으면 칩셋 문을 벽에 깔아 그 앞으로.
            const spot = pickTransferSpot(run, parentMap, { side: side ?? "north", outdoor: !!parentSpec && isOutdoor(parentSpec), otherName: cName });
            if (spot) {
              const { note, ...a } = spot;
              const r = run.call("create_transfer_pair", { a: { mapId: parentMap, ...a }, b: { mapId: childMap, x: result.entrance.x, y: result.entrance.y } });
              linked = r.ok; notes.push(r.ok ? `${pName} ${note} ↔ ${cName}` : `${pName} ${note} 잇기 실패: ${r.summary.slice(0, 160)}`);
            }
          }
        } else if (spec.type === "dungeon" || spec.type === "cave") {
          // 던전: 부모 맵의 걸어 닿는 칸 ↔ 던전 입구 계단(자리표시 출구가 있으면 그것을 바꾼다).
          // 문 자리는 정본 하나(transferSpot.dungeonGateSpot = dungeonLinkTools.pickDungeonGateSpot): 갱구가 맞는 길 곁 칸 → 갱구 자리 → 가장자리 길 끝 → 가장자리.
          // 못 찾으면 예전처럼 걸어 닿는 가장자리 칸.
          const pm = env.ctx.project.maps[parentMap]!;
          const gate = dungeonGateSpot(env.ctx.project, pm, side ?? "north");
          const at = gate ? { x: gate.x, y: gate.y } : edgeCell(env.ctx.project, pm, side ?? "north");
          const r = at ? run.call("link_world_entrance", { worldMapId: parentMap, links: [{ x: at.x, y: at.y, toMapId: childMap }] }) : undefined;
          linked = !!r?.ok && hasTransferTo(parentMap, childMap);
          if (linked) notes.push(`${pName}(${at!.x},${at!.y}) ↔ ${cName} 입구`);
        } else if (isOutdoor(spec) && !!parentSpec && isOutdoor(parentSpec)) {
          const dir = side ?? "north";
          const r = run.call("link_maps", { from: { mapId: parentMap, exit: { side: dir } }, to: { mapId: childMap, entry: { side: oppositeSide(dir) } } });
          linked = r.ok; if (r.ok) notes.push(`${pName} ${dir} 가장자리 ↔ ${cName}`);
        }
        if (!linked) {
          // 대신 걸어 닿는 칸끼리 문을 둔다(그림 없는 이동 칸) — 못 이은 채 두지 않는다.
          // 문 그림·계단·길 끝을 먼저 고르고(없으면 칩셋 문을 벽에 깐다), 그래도 없을 때만 그림 없는 가장자리 칸.
          const dir = side ?? "north";
          const spotA = pickTransferSpot(run, parentMap, { side: dir, outdoor: !parentSpec || isOutdoor(parentSpec), otherName: cName });
          const a = spotA ? { x: spotA.x, y: spotA.y, ...(spotA.doorAt ? { doorAt: spotA.doorAt } : {}) } : edgeCell(env.ctx.project, env.ctx.project.maps[parentMap]!, dir);
          const spotB = result.entrance && result.entrance.mapId === childMap ? undefined : pickTransferSpot(run, childMap, { side: oppositeSide(dir), outdoor: isOutdoor(spec), otherName: pName });
          const b = result.entrance && result.entrance.mapId === childMap ? { x: result.entrance.x, y: result.entrance.y } : spotB ? { x: spotB.x, y: spotB.y, ...(spotB.doorAt ? { doorAt: spotB.doorAt } : {}) } : edgeCell(env.ctx.project, env.ctx.project.maps[childMap]!, oppositeSide(dir));
          const r = a && b ? run.call("create_transfer_pair", { a: { mapId: parentMap, ...a }, b: { mapId: childMap, ...b } }) : undefined;
          const how = [spotA?.note, spotB?.note].filter(Boolean).join(" · ");
          if (r?.ok) notes.push(`${pName}(${a!.x},${a!.y}) ↔ ${cName}(${b!.x},${b!.y}) — ${how || "문 그림 없이 이동 칸으로 이었다"}`);
          else notes.push(`${pName} ↔ ${cName}: 잇지 못했다(${r?.summary.slice(0, 120) ?? "걸어 닿는 칸이 없다"})`);
        }
    return notes.join(" / ");
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
    let prev: { mapId: string; spec?: PlaceSpec; result?: PlaceBuildResult } = { mapId: start0 && (isPlaceholderMap(start0) || bareIds.has(start0.id)) ? "" : env.ctx.project.startMapId };
    for (const step of bp.steps) {
      let map = blueprintMapFor(env.ctx.project, step.place);
      if (!map) {
        const guess = guessPlaceSpec(step.place, env.ctx.project, bp.genre, String(task ?? ""));
        const spec0: PlaceSpec = { ...guess, salt: Math.floor(Math.random() * 1_000_000), variety: placeVariety(env, task), ...(isInside(guess) ? { mapId: `map_auto_${Math.floor(Math.random() * 1e9).toString(36)}` } : {}) };
        const builder = builderFor(spec0);
        if (!builder) { notes.push(`「${step.place}」(${spec0.type}) — 짓는 빌더가 없다`); continue; }
        // 자동으로 짓는 실내도 방은 모델이 설계한다(견본 거실 9×10 이 vm6·7·8 flash 방탈출 시작 방이 됐다) — 같은 모델에게 따로 받는다.
        const designedAuto = await designMissingRooms(env, spec0, `청사진 장소 「${step.place}」 자동 짓기`);
        const spec = designedAuto.spec;
        notes.push(...designedAuto.notes);
        env.emit({ type: "execution_status", name: "v2.build", ok: true, summary: `청사진 장소 「${step.place}」 자동으로 짓는 중(${builder.id})` });
        await builder.prepare?.(spec);
        const sub = { ...env.ctx, project: env.ctx.project, currentMapId: prev.mapId || env.ctx.project.startMapId };
        const subRun = createBuildRun(sub);
        const result = builder.build(subRun, spec);
        env.ctx.project = sub.project;
        recordWrite(env, subRun, `auto-place-${step.id}`, "make_place", { spec, auto: true }, result.ok, result.summary, { mapIds: result.mapIds });
        for (const m of result.missingArt) session.missingArt.add(m);
        if (!result.ok || !result.mapIds[0] || !env.ctx.project.maps[result.mapIds[0]]) { notes.push(`「${step.place}」 짓기 실패: ${result.summary.slice(0, 160)}`); continue; }
        const first = env.ctx.project.maps[result.mapIds[0]]!;
        if (first.name !== step.place) run.call("set_map_properties", { mapId: first.id, name: step.place });
        const bareId = session.barePlaces?.get(step.place);
        if (bareId) {
          session.barePlaces!.delete(step.place);
          const moved = moveBareEvents(env.ctx.project, bareId, first.id);
          env.ctx.project = moved.project;
          if (moved.notes.length) notes.push(`빈 맵 이벤트를 「${step.place}」로 옮김: ${moved.notes.join(", ")}`);
          if (moved.ids.length) settle.push({ mapId: first.id, ids: moved.ids });
        }
        const record: PlaceRecord = { builder: builder.id, spec, result, rounds: 0 };
        for (const mapId of result.mapIds) session.places.set(mapId, record);
        const link = prev.mapId && env.ctx.project.maps[prev.mapId] && prev.mapId !== first.id ? linkChild(prev.mapId, prev.spec, prev.result, spec, result) : "";
        notes.push(`「${step.place}」(${spec.type}${spec.style ? `·${spec.style}` : ""}, ${first.id}) 지음${link ? ` — ${link}` : ""}`);
        map = env.ctx.project.maps[first.id];
        prev = { mapId: first.id, spec, result };
        continue;
      }
      const known = session.places.get(map.id);
      if (prev.mapId !== map.id && env.ctx.project.maps[prev.mapId] && walkGame(env.ctx.project, [map.id]).unreached.includes(map.id)) {
        const spec = known?.spec ?? guessPlaceSpec(map.name ?? step.place, env.ctx.project, bp.genre, String(task ?? ""));
        const result: PlaceBuildResult = known?.result ?? { ok: true, mapIds: [map.id], summary: "", warnings: [], missingArt: [], calls: [] };
        notes.push(`「${map.name ?? map.id}」 잇기 — ${linkChild(prev.mapId, prev.spec, prev.result, spec, result)}`);
      }
      prev = { mapId: map.id, ...(known ? { spec: known.spec, result: known.result } : {}) };
    }
    for (const n of retireBlankStart(run)) notes.push(n);
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
        const spec0: PlaceSpec = localizeCultureSpec(localizePlaceSpec(dropModelSeed({ ...place.spec, salt: Math.floor(Math.random() * 1_000_000), variety: placeVariety(env, task) }, true), String(task ?? "")), String(task ?? ""));
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
        let result = withSetupDefaults(builder.build(subRun, spec), builder.id, sub.project, String(task ?? ""), freshStart);
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

  // ───── room_parts: 방을 직접 설계하기 전에 보는 재료(기물 이름표 + 손 견본 배치 요약·그림). 읽기만 한다 ─────
  const refPictures = new Map<string, string>();
  const roomPartsVerb: PiToolShape = {
    name: "room_parts", label: "방 재료 보기", concurrency: "shared",
    description: "Call before designing a hand-pixel interior room yourself (make_place zones[].design). Returns the chipset part labels for that use (id, size, where it goes), floor/wall/rug ids, a summary of sample layouts for the same use, and composition idea pictures (1x). The pictures are only ideas about flow, focus and furniture groups — do not copy; compose shape, groups and spots fresh for the request.",
    parameters: { type: "object", properties: { purpose: { type: "string", description: "room use — e.g. 서재 study, 마법사의 서재 wizard's study, 침실 bedroom" }, query: { type: "string", description: "(optional) more part words to look up" } }, required: ["purpose"] },
    async execute(_id, params) {
      const p = params as { purpose: string; query?: string };
      // 글은 가볍게(기본 slim): 기물 40줄·모양 예 하나 — 2026-10-30 서재 시험에서 결과 글 1.2~1.3만 자 뒤 flash 가 도구 호출을 글로 쓰거나 «I'm having a hard time»으로 멈췄다.
      // 더 필요한 기물은 query 로 다시 묻는다.
      const slim = (env.roomPartsText ?? "slim") === "slim";
      const full = roomParts(env.ctx.project, String(p.purpose ?? ""), p.query, undefined, slim ? 40 : 90);
      if (!full) return text({ ok: false, summary: "손 도트 실내 칩셋이 이 프로젝트에 없다" });
      const out = slim ? { ...full, references: full.references.slice(0, 2), referenceIds: full.referenceIds.slice(0, 2), shapeExamples: full.shapeExamples.slice(0, 1), more: "기물은 용도에 맞는 40줄만 보였다 — 더 찾으려면 query 에 낱말을 넣어 다시 부른다. 모양 예는 하나만 글로, 나머지 모양은 그림으로." } : full;
      const result = text({ ok: true, ...out, how: "zones:[{kind, purpose, design:{shape, corner?, w, h, door, floor, wall, groups:[{name, at, pos?, rug?, items:[{id, dx?, dy?, count?}]}]}}]. 먼저 모양을 고른다(shapes·shapeExamples 와 아래 모양 그림 — 바닥 60칸 넘는 네모는 ㅁ자로 짚힌다, 곁방은 zones 둘). 묶음마다 무엇을 몇 개 놓을지는 네가 정한다 — 함수는 더하지 않고 이름 맞춤·겹침·의자 방향·문 앞 통로·도달만 고쳐 알려 준다. 기물 줄의 좌표는 바닥 왼쪽 위 0,0, 걸이는 y -2. 벽 가구·걸이는 북벽 밑에 서고, 도려 내 내려온 북벽(ㄷ자 가운데·창가 돌출 양옆·알코브 옆) 밑에도 선다." });
      // 그림: 구성 아이디어(사용자가 실내 기준으로 고른 assistant-rooms-2 방 — 동선·초점·묶음만 보고 베끼지 않는다) + 모양 예시(shapeExamples 를 지금 빌더로 지은 것).
      // 옛 사람 견본 그림(견본을 지어 찍은 것)은 더 보여 주지 않는다 — 2026-10-29 감사에서 모델이 그 서재를 그대로 옮겨 방탈출 방이 다 같아졌다.
      // 기본은 한 장으로 합쳐 싣는다(env.roomPartsPictures): 2026-10-30 서재 3d 에서 그림 8장·글 1.3만 자 결과 뒤 Gemini 계열이 짓지 못한 판이 늘었다(인계 handoff-study.md).
      const mode = env.roomPartsPictures ?? "one";
      const panels: { label: string; url: string }[] = [];
      if (mode !== "none" && env.readPublicAsset) for (const idea of roomIdeasFor(`${p.purpose ?? ""} ${p.query ?? ""}`)) {
        const key = `idea:${idea.id}`;
        let url = refPictures.get(key);
        if (!url) { try { url = await env.readPublicAsset(idea.file); } catch { url = undefined; } if (url) refPictures.set(key, url); }
        if (url) panels.push({ label: `구성 아이디어 ${idea.id} — ${idea.idea}`, url });
      }
      if (mode !== "none" && env.render && out.tileset === HAND_INTERIOR_TILESET_ID) for (const ex of SHAPE_EXAMPLES) {
        const key = `shape:${ex.shape}`;
        let url = refPictures.get(key);
        if (!url) {
          const scratch = { project: env.ctx.project, currentMapId: env.ctx.currentMapId, assistantRun: true } as typeof env.ctx;
          const sp = { name: `모양 예시 ${ex.ko}`, type: "interior", hints: { newMap: true }, zones: ex.zones.map((z) => ({ ...z })) } as unknown as PlaceSpec;
          const built = builderFor(sp)?.build(createBuildRun(scratch), sp);
          const mapId = built?.ok ? built.mapIds[0] : undefined;
          const m = mapId ? scratch.project.maps[mapId] : undefined;
          if (m && mapId) {
            const keep = env.ctx.project;
            try { env.ctx.project = scratch.project; url = await env.render(mapId, 0, 0, m.width, m.height); } catch { url = undefined; } finally { env.ctx.project = keep; }
            if (url) refPictures.set(key, url);
          }
        }
        if (url) panels.push({ label: `모양 ${ex.shape}(${ex.ko}) 예시 — shapeExamples 의 설계로 지은 것`, url });
      }
      const img = (url: string) => ({ type: "image" as const, mimeType: "image/png", data: url.slice(url.indexOf(",") + 1) });
      if (panels.length && mode === "each") for (const x of panels) { result.content.push({ type: "text", text: `${x.label} 1배 그림:` }); result.content.push(img(x.url)); }
      else if (panels.length && mode === "one") {
        const sheet = env.combinePictures ? await env.combinePictures(panels.map((x) => x.url)).catch(() => undefined) : undefined;
        const first = sheet ?? panels[0]!.url;
        const shown = sheet ? panels : panels.slice(0, 1);
        result.content.push({ type: "text", text: `그림 한 장(1배, 왼쪽 위부터 차례로 ${shown.length}칸): ${shown.map((x, i) => `${i + 1}) ${x.label}`).join(" / ")}. ${ROOM_IDEA_RULE}` });
        result.content.push(img(first));
      }
      return result;
    },
  };

  const inspect: PiToolShape = {
    name: "inspect", label: "맵 보기", concurrency: "shared",
    description: "Look at one map's 1x picture, machine checks and person/event list (no critic). Use it to check the current state before fixing.",
    parameters: { type: "object", properties: { mapId: { type: "string" } } },
    async execute(_id, params) {
      const mapId = (params as { mapId?: string }).mapId ?? env.ctx.currentMapId ?? env.ctx.project.startMapId;
      const map = env.ctx.project.maps[mapId];
      if (!map) return text({ ok: false, summary: `맵 ${mapId} 이 없다` });
      const seen = await see(env, session, task, "content", [mapId], undefined, false);
      const events = (map.events ?? []).slice(0, 30).map((e) => `${e.id} ${e.name ?? ""}(${e.x},${e.y})`);
      return withImages({ ok: true, map: { id: map.id, name: map.name, tileset: map.tilesetId, size: `${map.width}×${map.height}` }, record: session.places.get(mapId)?.spec, machineChecks: summarizeChecks(seen.checks), events }, seen, 1);
    },
  };

  const restoreEvent: PiToolShape = {
    name: "restore_event", label: "이벤트 되살리기", concurrency: "exclusive",
    description: "Restore an event that existed before this request exactly as it was (pages, conditions, switches, art, original lines) — to undo a deletion or overwrite. Do not rewrite it from memory with upsert_event (names and conditions drift). eventId is an id or a name.",
    parameters: { type: "object", properties: { eventId: { type: "string" }, mapId: { type: "string" } }, required: ["eventId"] },
    async execute(_id, params) {
      const p = params as { eventId: string; mapId?: string };
      const result = restoreEventFromBefore(env.request.project, env.ctx.project, String(p.eventId ?? ""), p.mapId);
      if (result.ok) await env.checkpoint("restore_event");
      return text({ ...result, ...(result.ok ? { next: "get_event 로 읽어 확인하고, 보고에는 「요청 전 그대로 되살렸다」고 쓴다." } : {}) });
    },
  };

  const askUser: PiToolShape = {
    name: "ask_user", label: "사용자에게 묻기", concurrency: "shared",
    description: "Ask only when the request truly splits two or more ways and a wrong pick means rebuilding. After calling, do not build; end the turn with the question.",
    parameters: { type: "object", properties: { question: { type: "string" }, choices: { type: "array", items: { type: "string" } } }, required: ["question"] },
    async execute(_id, params) {
      const p = params as { question: string; choices?: string[] };
      // 아직 아무것도 안 바꿨으면 한 번은 되돌려 보낸다 — 「다리가 없어 어디에?」처럼 고칠 수 있는 빈칸은 가장 그럴듯하게 지어 보고하는 편이 낫다(2026-10-24 g2-toll).
      if (!session.askBounced && JSON.stringify(env.ctx.project.maps) === JSON.stringify(env.request.project.maps) && JSON.stringify(env.ctx.project.database) === JSON.stringify(env.request.project.database)) {
        session.askBounced = true;
        return text({ ok: false, summary: "아직 아무것도 짓지 않았다. 요청이 가리키는 자리·물건이 맵에 없으면 묻지 말고 가장 그럴듯한 자리에 만들어(덧그리기·make_place·add_people) 짓고, 보고에 「~가 없어 ~로 정했다」고 쓴다. 그래도 정말 두 갈래로 갈려 잘못 고르면 다시 지어야 하는 경우에만 다시 ask_user 를 부른다." });
      }
      session.questions.push(p.question);
      return text({ ok: true, summary: "질문을 기록했다. 지금 응답 끝에 이 질문(과 고를 거리)을 그대로 쓰고 턴을 끝낸다.", question: p.question, choices: p.choices ?? [] });
    },
  };

  // 잔일 일꾼 — 주 모델이 계획·검수하고, 틀이 정해진 글 일은 잔일 모델(assistantRoles.smol, 예: Flash)이 나눠 한다. 일꾼은 도구가 없다(읽기·쓰기 없음).
  const askHelpers: PiToolShape = {
    name: "ask_helpers", label: "잔일 맡기기", concurrency: "shared",
    description: `Hand short, fixed-format text jobs to a cheap worker model in bulk (${HELPER_LIMITS.parallel} at a time, at most ${HELPER_LIMITS.jobs}). E.g. draft lines for several NPCs, name candidates, item/skill descriptions, summaries of long scripts, polishing speech style. Workers cannot see the project — put the needed characters, scenes and speech style in context. With fields (+count) it checks and returns JSON with those keys. Results are drafts: check them and put them in yourself with write tools (add_people, add_event, upsert_* etc.). Do not hand off building or fixing maps and events, or anything that needs judgment.`,
    parameters: { type: "object", properties: { jobs: { type: "array", maxItems: HELPER_LIMITS.jobs, items: { type: "object", properties: {
      id: { type: "string", description: "name to tell results apart (e.g. npc_baker)" },
      task: { type: "string", description: "the job in one or two sentences" },
      context: { type: "string", description: "material the worker sees (character notes, scene, speech examples). It cannot see the project, so put everything needed here" },
      fields: { type: "array", items: { type: "string" }, description: "keys to receive as JSON (e.g. [\"speaker\",\"line\"])" },
      count: { type: "integer", description: "how many fields-shaped objects to receive (as an array)" },
    }, required: ["task"] } } }, required: ["jobs"] },
    async execute(_id, params, signal) {
      const jobs = ((params as { jobs?: HelperJob[] }).jobs ?? []).filter(Boolean);
      if (!jobs.length) return text({ ok: false, summary: "jobs 가 비었다" });
      const smol = env.request.assistantRoles?.smol;
      const usable = smol && smol !== "off" && env.roleChat && (smol.provider.startsWith("local-cli:") || env.keyedProviders?.has(smol.provider));
      const chat = usable ? (messages: readonly unknown[], s?: AbortSignal) => env.roleChat!(smol, messages, s) : env.sideChat;
      const model = usable ? `${smol.provider}/${smol.model}` : "주 모델(잔일 칸이 비었거나 그 계정 키가 없음)";
      env.emit({ type: "execution_status", name: "v2.helpers", ok: true, summary: `잔일 ${Math.min(jobs.length, HELPER_LIMITS.jobs)}개를 일꾼(${model})에게 맡기는 중` });
      const results = await runHelperJobs(jobs, chat, signal ?? env.signal);
      const failed = results.filter((r) => !r.ok).length;
      env.emit({ type: "execution_status", name: "v2.helpers", ok: failed === 0, summary: `잔일 ${results.length}개 끝(실패 ${failed}) · ${model}`, data: { model, jobs: results.map((r) => ({ id: r.id, ok: r.ok, ms: r.ms, ...(r.problem ? { problem: r.problem } : {}) })) } });
      return text({ ok: failed < results.length, summary: `잔일 ${results.length}개 중 ${results.length - failed}개 받음${jobs.length > HELPER_LIMITS.jobs ? ` (앞 ${HELPER_LIMITS.jobs}개만)` : ""}`, model, results, next: "초안이다 — 맞는지 보고 쓰기 도구로 직접 넣는다. 실패한 일은 고쳐 다시 맡기거나 직접 쓴다." });
    },
  };

  // 기록 없이 끝난 실패(빌더 없음·맵 없음·상한)와 예외도 tool_end 에 ok:false·이유가 실리게 한다 — 안 그러면 편집기에 빈 「성공」 줄이 남는다.
  const guard = (tool: PiToolShape): PiToolShape => ({ ...tool, async execute(id, params, signal) {
    let result: PiToolExecResult;
    try { result = await tool.execute(id, params, signal); }
    catch (error) { result = text({ ok: false, summary: `${tool.name} 실패: ${error instanceof Error ? error.message : String(error)}` }); }
    // 짓는 단계마다 청사진과 대조한 진행을 덧붙인다(2026-10-28) — 모델이 어느 항목을 구현했고 무엇이 남았는지 매번 본다.
    if (BLUEPRINT_PROGRESS_VERBS.has(tool.name)) { const note = blueprintProgressNote(env.ctx.project); if (note) result = { ...result, content: [...result.content, { type: "text", text: note }] }; }
    if (!recorded.get(env)?.has(id)) {
      const first = result.content.find((c) => c.type === "text") as { text: string } | undefined;
      let parsed: { ok?: boolean; summary?: string; notFailure?: boolean } = {};
      try { parsed = first ? JSON.parse(first.text) as { ok?: boolean; summary?: string; notFailure?: boolean } : {}; } catch { /* 글 */ }
      // «아직 짓지 않았다(실패 아님)»(설계 받기·땅 미리보기·굴 입구 되돌림)는 정상 흐름이다 — tool_end 를 실패(FAIL)로 남기지 않는다.
      const notFailure = parsed.notFailure === true || /\(실패 아님\)/u.test(String(parsed.summary ?? "").slice(0, 300));
      env.record({ toolCallId: id, name: tool.name, args: params, result: { ok: parsed.ok !== false || notFailure, summary: String(parsed.summary ?? (parsed.ok === false ? "실패" : `${tool.label} 완료`)), ...(notFailure && parsed.ok === false ? { notFailure: true } : {}) } as never });
    }
    return result;
  } });
  const verbs = [writeBlueprint, buildBlueprintPathVerb, makePlace, ...(makeGameOn() && wantsMakeGame(String(task ?? "")) ? [makeGame] : []), editPlace, moveObject, dressRoomVerb, addPeople, addEvent, addScene, ...(wantsBossEncounter(String(task ?? "")) ? [addBossEncounter] : []), ...(wantsEndingScene(String(task ?? "")) ? [addEndingScene] : []), ...(wantsPuzzle(String(task ?? "")) ? [authorPuzzleChain] : []), sealLockedRoomVerb, setObjectiveVerb, drawObjectVerb, placeObject, inspect, roomPartsVerb, createDungeonPartsVerb(env, () => session.places.values()), restoreEvent, ...(helpersOn() ? [askHelpers] : []), askUser]
    // 음악만 바라는 요청은 맵·이벤트를 쓰는 동사를 싣지 않는다 — 보기·묻기만(2026-10-30 r12: 추격 음악 요청에 상자를 찍었다).
    .filter((tool) => !musicOnly(String(task ?? "")) || MUSIC_ONLY_VERBS.has(tool.name))
    .map((tool) => guard(flattenWrapperTool(tool)));
  // 게임 요소(퀘스트·아이템·전투·파티) 요청이면 v1 게임 도구를 덧붙인다 — 기록은 도구 묶음이 env.record 로 직접 남긴다.
  const t = String(task ?? "");
  // 스토어 음악 카드(사용자가 듣고 고른다)를 띄웠으면 사용자 질문과 같다 — 끝맺음 관문이 «음악을 안 걸었다»며 넣기를 재촉하지 않게 한다.
  const gameEnv: PiAssistantV2Env = { ...env, record: (r) => {
    if (r.name === "store_find_music" && r.result.ok && isStoreCardRequest(r.result.data)) session.questions.push("스토어 음악 카드: 사용자가 듣고 고른다");
    env.record(r);
  } };
  // 같은 Command·페이지 스키마의 설명은 처음 한 번만 보낸다(schemaDedupe.ts — 매 턴 다시 가는 도구 목록이 21만 자였다).
  // 청사진이 있는 게임에서 이벤트·엔딩 하위 도구가 되풀이해 실패하면 build_blueprint_path 로 보낸다(mt2 Flash: upsert_event 6번 인자 실패).
  const escalate = (tool: PiToolShape): PiToolShape => !PATH_LOW_LEVEL.has(tool.name) ? tool : { ...tool, escalateHint: () => env.ctx.project.gameBlueprint
    ? `[상위 동사로] ${tool.name} 로 청사진 경로(단계 이벤트·조건·엔딩 호출)를 하나씩 맞추지 않는다 — build_blueprint_path 를 한 번 부르면 청사진 단계대로 함수가 짓는다(대사만 steps[{id,lines}]). 이 도구는 경로 밖의 작은 수정에만 쓴다.`
    : undefined };
  return wantsGameTools(t) || wantsMusicTools(t) || wantsTerrainTools(t) || wantsStoreTools(t) ? dedupeToolSchemas([...verbs, ...createGameTools(gameEnv, t).map((tool) => escalate(flattenWrapperTool(tool, gameEnv.record)))]) : verbs;
}

/** 음악만 바라는 요청에 남기는 v2 동사 — 맵 보기·사용자에게 묻기. 곡 걸기는 음악 묶음(set_game_audio)이 한다. */
const MUSIC_ONLY_VERBS: ReadonlySet<string> = new Set(["inspect", "ask_user"]);
/** 음악 요청의 일감인 게임 검사 줄 — 나머지(이미 있던 위협·출하 차단 등)는 음악만 바라는 요청에서 참고다. */
const isMusicWork = (line: string) => /^\[게임 검사 (음악|실행|부작용)\]/u.test(line);

/** 끝맺음 관문이 짚은 문제 하나 — 할 일 고리(src/ai/v2/loop)가 gate·critic 항목으로 덧붙인다. key 가 같으면 같은 문제다. */
export interface V2GateProblem { readonly key: string; readonly text: string; readonly source: "gate" | "critic" }
const gateKey = (text: string): string => text.replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim().slice(0, 160);

/**
 * 끝맺음 관문의 재료 — 고칠 수 있는 장소 문제(비평 major·기계 검사, 맵당 고치기 상한 전)와 게임 검사·출하 차단 줄.
 * leftovers = 고치기 상한에 닿아 보고로만 갈 장소 문제, missing = 그림·부품이 없어 못 한 것. 사용자에게 물은 실행은 비운다.
 */
/** 게임 내용 검사 글(날씨·엔딩·상태·물건·깃발·부작용 + 전투 + 출하 차단). before = 요청 시작 저장본. */
function gameProblemTexts(before: Project, after: Project, task: string): string[] {
  let game: string[] = [];
  try { game = [...gameContentProblems(before, after, task), ...unaskedChanges(before, after, task)]; } catch { game = []; }
  // 끝까지 깰 수 있는 전투인가(2026-10-25 판정 J55·J4): 회복 수단 없음·시키지 않은 무작위 조우·첫 구역이 너무 센 조우.
  try { game.push(...combatProblems(before, after, task)); } catch { /* 검사 실패는 무시 */ }
  // 출하 차단(2026-10-25 사용자 규칙): 게임을 만드는 요청이면 편집기 기본값·한 줄 엔딩이 남은 채 «다 됐다»고 하지 못한다.
  try { game.push(...shipBlockers(after, task).filter((b) => b.id !== "combat-no-healing" /* combatProblems no-healing 이 같은 것을 짚는다 */).map((b) => `[출하 차단 ${b.id}] ${b.message} 고치지 못하면 «완성»이라고 쓰지 말고 남은 기본값으로 보고한다.`)); } catch { /* 검사 실패는 무시 */ }
  return game;
}

/**
 * 시작 저장본에 이미 있던 게임 검사 문제의 열쇠(before=after=시작 저장본). 할 일 고리는 이 열쇠와 같은 관문 문제를 «기존 결함»으로 보고에만 싣고
 * 완료를 막지 않는다(2026-10-30 omo-loop-1030: 버들마을 출입구 그림 없음이 세 장면 모두 할 일이 됐다).
 */
export function v2BaselineGameKeys(project: Project, task: string): Set<string> {
  return new Set(gameProblemTexts(project, project, task).map((g) => `game:${gateKey(g)}`));
}

/** 컷신 이벤트(또는 그 컷신이 세운 사람) 명령 안에 전투(battleProcessing)가 있나 — 지금 프로젝트 기준. */
function stageOpensBattle(project: Project, mapId: string, eventIds: readonly string[] | undefined): boolean {
  const map = project.maps[mapId];
  if (!map || !eventIds?.length) return false;
  const has = (n: unknown): boolean => Array.isArray(n) ? n.some(has) : !!n && typeof n === "object" && ((n as { kind?: unknown }).kind === "battleProcessing" || Object.values(n).some(has));
  return map.events.some((e) => eventIds.includes(e.id) && has(e.pages ?? []));
}
/**
 * 연출 비평가는 지도 틀만 본다 — 전투 화면은 그 틀에 없다. 컷신(또는 그 사람)이 지금 전투를 연다면 «싸움이 안 보인다»류 지적은 지난 일이다
 * (2026-10-30 omo-loop-1030b terra boss-room r1·r3: 컷신에 전투를 patch_event_page 로 붙이고 run_scene_test 로 전투 진입까지 확인했는데,
 * 붙이기 전에 받은 연출 비평 «요청한 싸움은 보이지 않는다»가 관문 항목으로 남아 두 판 모두 막힘으로 끝났다).
 */
const FIGHT_WORD = /싸움|싸우|전투|결투|battle|fight/iu;
function withoutStaleFightCritique(project: Project, session: V2Session, open: ReturnType<V2Session["unresolved"]>): ReturnType<V2Session["unresolved"]> {
  return open.map((o) => {
    const st = o.name.includes("컷신(") ? session.stages.get(o.mapId) : undefined;
    if (!st || !stageOpensBattle(project, o.mapId, st.eventIds)) return o;
    return { ...o, problems: o.problems.filter((p) => !(p.startsWith("[연출 비평]") && FIGHT_WORD.test(p))) };
  }).filter((o) => o.problems.length);
}

export function v2GateProblems(session: V2Session, env?: PiAssistantV2Env): { problems: V2GateProblem[]; leftovers: string[]; missing: string[] } {
  if (session.questions.length) return { problems: [], leftovers: [], missing: [] };
  const open = env ? withoutStaleFightCritique(env.ctx.project, session, session.unresolved()) : session.unresolved();
  const missing = [...session.missingArt];
  const fixable = open.filter((o) => o.rounds < V2_MAX_REPAIR_ROUNDS);
  // 게임 내용 검사(날씨·엔딩·상태·물건 고르기·깃발·부작용) — 요청 낱말과 실제로 바뀐 이벤트를 맞댄다.
  let game: string[] = env ? gameProblemTexts(env.request.project, env.ctx.project, env.request.task) : [];
  // 아무것도 안 바꾸고 «도구가 없다»며 끝내기(2026-10-24 g3-edit-move: 대장장이 옮기기를 묻기만 했다, g3-apple-count: 그림 카드만 남겼다).
  // 설정이 이미 기본값(켜짐)이면 set_project_settings 가 아무것도 안 바꾸는 것이 맞다(2026-10-25 데모 과업: 탭 걷기·팡파레·빠른 달려들기는 기본 켜짐).
  const settingOnly = /휴대폰|모바일|터치|탭하면|진동|조이스틱|달리기 단추|레벨 ?업|팡파레|달려들|도움말/u.test(env?.request.task ?? "") && !/만들|두고|세워|놓아|놔|추가/u.test(env?.request.task ?? "");
  // 스토어 평가 읽기·답글·소식 카드는 프로젝트를 바꾸지 않는 것이 맞다(2026-10-25).
  // «내 게임 평가에 답글 달아 줘»처럼 «게임» 낱말이 섞여도 만들기·고치기 동사가 없으면 스토어 일로 본다.
  const storeOnly = wantsStoreTools(env?.request.task ?? "") && !/만들|추가|넣어|놓아|세워|지어|고쳐|바꿔|옮겨|줄여|늘려/u.test(env?.request.task ?? "");
  if (env && !settingOnly && !storeOnly && !/\?\s*$|알려\s*줘|뭐야|어디|있어\?|보여\s*줘|설명|정리해서|요약/u.test(env.request.task.trim())) {
    const pick = (p: typeof env.ctx.project) => JSON.stringify([p.maps, p.database, p.endings ?? null, p.commonEvents ?? null, p.switches, p.variables, p.startMapId, p.startPos ?? null, p.system ?? null, p.dialogueDesk ?? null]);
    try {
      if (pick(env.request.project) === pick(env.ctx.project)) game.push("[게임 검사 실행] 이 요청으로 맵·데이터가 하나도 바뀌지 않았다. 묻거나 «도구가 없다»·«도구 호출 횟수 초과»라고 끝내지 말고 실행한다(도구 호출 횟수 제한은 없다 — 2026-10-29 3c Argon 이 room_parts 한 번 뒤 «호출 횟수 초과»라며 짓지 않았다). 장소·방은 make_place(방은 zones[].design 을 채워서)로 짓는다. 있는 NPC·물건은 move_event·upsert_event·patch_event_page 로 고치고, 새 것은 add_people·add_event·upsert_event 로 만든다. 꼭 맞는 그림이 없으면 가장 비슷한 기존 그림·물건으로 두고 보고에 적는다(아이템·이벤트·대사는 그림과 상관없이 만든다).");
    } catch { /* 비교 실패는 무시 */ }
  }
  // 음악만 바라는 요청: 음악 밖 지적(이미 있던 체크포인트 위협·출하 차단…)은 일감이 아니다 — 한 바퀴를 더 돌리지 않고 기록에만 남긴다.
  if (env && musicOnly(env.request.task)) {
    const outside = game.filter((g) => !isMusicWork(g));
    game = game.filter(isMusicWork);
    if (outside.length) env.emit({ type: "execution_status", name: "v2.music-only.notes", ok: true, summary: `음악 요청 밖 참고 ${outside.length}건 — 고치지 않음`, data: { notes: outside } });
  }
  const problems: V2GateProblem[] = [
    ...game.map((g) => ({ key: `game:${gateKey(g)}`, text: g, source: "gate" as const })),
    // 열쇠는 맵(과 장소/컷신)마다 하나 — 고칠 때마다 문제 글이 바뀌어도 같은 항목이 다시 열려 시도 상한(3)이 센다.
    ...fixable.map((o) => ({ key: `place:${o.mapId}:${o.name.includes("컷신(") ? "stage" : "place"}`, text: `${o.name}(${o.mapId}) 고치기 — 장소는 edit_place·move_object·dress_room, 컷신은 add_event: ${o.problems.slice(0, 5).join(" / ")}`,
      source: o.problems.some((p) => p.startsWith("[비평")) ? "critic" as const : "gate" as const })),
  ];
  const leftovers = open.filter((o) => o.rounds >= V2_MAX_REPAIR_ROUNDS).map((o) => `${o.name}: ${o.problems.slice(0, 4).join(" / ")}`);
  return { problems, leftovers, missing };
}

/** 끝맺음 관문 글(옛 고리 — 한 번 더 돌게 하는 글). 할 일 고리는 v2GateProblems 를 항목으로 쓴다. 다 통과면 undefined. */
export function v2FinishGate(session: V2Session, env?: PiAssistantV2Env): string | undefined {
  const { problems, leftovers, missing } = v2GateProblems(session, env);
  const game = problems.filter((p) => p.key.startsWith("game:")).map((p) => p.text);
  const fixable = problems.filter((p) => p.key.startsWith("place:")).map((p) => p.text);
  // 고칠 것이 없으면 한 바퀴를 더 쓰지 않는다 — 남은 문제·「그림 없음」은 동사 결과가 이미 보고하라고 일렀다.
  if (!fixable.length && !game.length) return undefined;
  return [
    "[v2 끝맺음 관문] 「다 됐다」고 말하기 전에:",
    ...(game.length ? ["게임 검사가 짚은 것 — 고친 뒤 get_event 로 다시 읽어 확인한다(고칠 수 없으면 보고에 그대로 적는다):", ...game.map((g) => `- ${g}`)] : []),
    ...(fixable.length ? [`아직 고칠 수 있는 곳 ${fixable.length}곳 — 장소는 edit_place, 컷신은 add_event 로 고친다:`, ...fixable.map((t) => `- ${t}`)] : []),
    ...(leftovers.length ? ["고치기 상한에 닿은 장소의 남은 문제는 사용자 보고에 그대로 적는다:", ...leftovers.map((t) => `- ${t}`)] : []),
    ...(missing.length ? [`그림·부품이 없어 못 한 것(보고에 반드시 적는다, 대체물로 지어내지 않는다): ${missing.join(" / ")}`] : []),
    "고칠 것을 고친 뒤(또는 고칠 수 없으면 바로) 앞 보고를 대신하는 최종 보고 하나를 다시 쓴다 — 첫 줄을 「최종 보고(앞 보고를 고침):」로 시작하고, 지은 것·통과 여부·못 한 것을 처음부터 다시 적되 앞 보고와 달라진 것(고친 것·되돌린 것)을 분명히 밝힌다. 앞 보고에서 «했다»고 한 것을 되돌렸으면 반드시 그렇다고 쓴다(사용자는 두 보고를 다 본다).",
  ].join("\n");
}
