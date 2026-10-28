// 조수 v2 동사 — 모델이 부르는 도구는 이 열 개 안팎뿐이다. 동사마다: 명세 → 결정론 빌더 → 1배 그림 + 기계 검사 → 독립 비평가.
// 고치기는 모델이 비평 결과(칸 좌표 major)를 보고 edit_place 패치로 한다(맵당 V2_MAX_REPAIR_ROUNDS 바퀴 상한). 끝맺음 관문(afterMain)이
// 「비평 major 0 + 기계 검사 통과」가 아닌 장소를 남긴 채 「다 됐다」고 말하지 못하게 한다.
import { flattenWrapperTool } from "./flatWrapper";
import type { PiToolShape, PiToolExecResult } from "@/ai/piAgent/toolAdapter";
import { shipBlockers, wantsWholeGame } from "./shipChecks";
import { applyBlueprintAssembly } from "@/project/blueprintAssembly";
import { applyBlueprintOpening } from "@/editor/tools/blueprintOpening";
import { WRITE_BLUEPRINT_SCHEMA, blueprintDesignerFromEnv, blueprintProgressNote, designBlueprint, parseBlueprintArgs, walkBlueprint } from "./blueprint";
import { projectBrief } from "./prompt";
import type { PiAssistantV2Env } from "./env";
import { roomSpecOf } from "@/editor/handInterior/builder";
import { createBuildRun, type RecordingBuildRun } from "./buildRun";
import { builderFor } from "./builders";
import { localizePlaceSpec } from "./builders/modernCity";
import { localizeCultureSpec } from "./builders/joseon";
import { applyModernSetupDefaults, applyStorySetupDefaults, isFreshProject } from "./genreDefaults";
import { dedupeToolSchemas } from "./schemaDedupe";
import { adoptExactInterior, interiorAddAnchors, interiorBuilder, interiorEditFromArgs, interiorMoveObjects, roomMaterials, type ObjectEdit } from "./builders/interior";
import { interiorStampEdit, type StampEditState } from "./builders/interiorEdit";
import { fixPlayerStart, runMachineChecks, summarizeChecks, type MachineCheck } from "./checks";
import { critique } from "./critic";
import type { CriticVerdict } from "@/ai/piAgent/featureReview";
import type { ContentBuildResult, EventSpec, ObjectSpec, PersonSpec, PlaceBuildResult, PlacePatch, PlaceRecord, PlaceSpec, PlaceType } from "./types";
import type { Project } from "@/project/types";
import { buildPeople, findMap, resolveWhere } from "./people";
import { mapBundleIds } from "@/ai/piAgent/mapBundle";
import { buildEvent } from "./events";
import { drawObject } from "./drawObject";
import { buildScene, SCENE_SCHEMA, type SceneSpec } from "./scene";
import { buildPuzzleChain, sealLockedRoom, type ChainArgs } from "./puzzle";
import { BUILD_BLUEPRINT_PATH_SCHEMA, blueprintMapFor, buildBlueprintPath, sealEscapeExits, type PathStepText } from "./blueprintPath";
import { clearTransferLanes } from "./eventReach";
import { dressInteriorExits } from "./exitDress";
import { isPlaceholderMap, retireBlankStart } from "./blankStart";
import { chaserEvents, ensureChaserHidingSpots, mapHidingEvents } from "@/project/chaserHiding";
import { dungeonGateSpot, pickTransferSpot } from "./transferSpot";
import { guessPlaceSpec } from "./placeGuess";
// 콘텐츠 동사(컷신 무대·연출 비평·물건 자리 계획) — finishContent·addEvent·drawObjectVerb·placeObject 가 쓴다.
import { critiqueStaging } from "./critic";
import { createGameTools, wantsPuzzle, wantsGameTools, wantsStoreTools, wantsTerrainTools } from "./game";
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

// 2026-10-23 5차: 고치기 3바퀴는 바퀴마다 다시 짓기+비평(20~35초)이라 던전 한 장에 200~250초가 들었다.
// 속도 우선(6차)으로 1바퀴만 — 첫 비평의 major 를 한 번 고치고 남은 것은 보고한다.
export const V2_MAX_REPAIR_ROUNDS = 1;
/** build_hand_interior_room 이 layout 방마다 다는 장소 꼬리표(handInteriorTools.ts 와 같은 값). */
const HAND_LAYOUT_ROOM_TAG = "hand-layout-room";

interface Seen {
  readonly checks: readonly MachineCheck[];
  readonly critics: readonly CriticVerdict[];
  readonly images: readonly { readonly mapId: string; readonly dataUrl: string }[];
}

/** 이 실행의 v2 상태 — 맵별 장소 기록·마지막 검사·누적 「그림 없음」. */
export class V2Session {
  readonly places = new Map<string, PlaceRecord>();
  readonly seen = new Map<string, Seen>();
  readonly content: { verb: string; result: ContentBuildResult }[] = [];
  readonly missingArt = new Set<string>();
  /** 컷신 무대(맵별) — 무대 검사·연출 비평 major 가 남았는지(G39: 비평이 짚은 겹침을 보고만 하고 끝냈다). */
  readonly stages = new Map<string, { name: string; rounds: number; problems: string[] }>();
  readonly questions: string[] = [];
  /** ask_user 를 한 번 되돌려 보냈는가(아무것도 짓지 않고 물었을 때). */
  askBounced = false;
  /** 같은 청사진을 다시 쓴 횟수(내용이 같으면 바꾸지 않고 다음 동사로 보낸다). */
  blueprintRewrites = 0;
  /** 끝맺음에서 청사진 경로를 함수가 대신 지었는가(한 번만). */
  autoPathDone = false;
  /** 끝맺음에서 청사진 장소를 함수가 대신 지었는가(한 번만). */
  autoPlacesDone = false;
  /** 끝맺음에서 이동 칸 앞을 막는 이벤트를 옮겼는가(한 번만). */
  autoLanesDone = false;
  /** 이동 칸(착지·문) 앞을 막는 이벤트를 옆으로 옮긴다(createV2Tools 가 건다). 한 일 목록. */
  clearLanes?: () => Promise<string[]>;
  /** 청사진에 있는데 없는(또는 닿지 않는) 장소를 짓고 앞 장소와 잇는다(createV2Tools 가 건다). 한 일 목록. */
  buildPlaces?: () => Promise<string[]>;
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
const ZONE_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", description: "구역 종류 낱말(카드의 낱말)" },
    purpose: { type: "string", description: "무엇을 위한 곳인지 한 줄" },
    anchors: { type: "array", items: { type: "string" }, description: "이 구역의 주인공 물건 낱말" },
    size: SIZE,
    floor: { type: "number", description: "몇 층(기본 1)" },
    id: { type: "string" },
  },
  required: ["kind"],
};
const HINTS_SCHEMA = {
  type: "object",
  description: "카드가 알려 준 빌더 손잡이만. 모르는 것은 넣지 않는다.",
  properties: {
    variant: { type: "number", description: "같은 명세의 다른 배치(0,1,2…)" },
    seed: { type: "number" },
    dressing: { type: "number", description: "꾸밈 정도 0 보통 · 1 많이 · 2 가득(아늑하게)" },
    houseCount: { type: "number" },
    roofs: { type: "string" },
    water: { type: "string" },
    woods: { type: "string" },
    form: { type: "string" },
    terrain: { type: "string" },
    forestType: { type: "string" },
    walls: { type: "boolean" },
    wallGate: { type: "string" },
    width: { type: "number" },
    height: { type: "number" },
    length: { type: "string", description: "거리 길이 short|medium|long(카드가 말한 빌더만)" },
    plaza: { type: "string" },
    landmark: { type: "string" },
    shops: { type: "string", description: "가게 짧은 이름을 쉼표로, 왼쪽부터 순서대로" },
    mirror: { type: "boolean" },
    floorShapes: { type: "string", description: "층마다 꼴을 쉼표로(아래층부터)" },
    floorGimmicks: { type: "string", description: "층마다 장치를 쉼표로(아래층부터, 없으면 none)" },
    townSize: { type: "string" },
    streets: { type: "string" },
    pond: { type: "boolean" },
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
    mapId: { type: "string", description: "이미 있는 맵을 그 자리에서 다시 지을 때만" },
    hints: HINTS_SCHEMA,
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

function nextStep(seen: Seen, rounds: number): string {
  const bad = seen.checks.filter((c) => !c.ok).length + seen.critics.reduce((n, v) => n + v.majors.length, 0);
  if (!bad && !seen.critics.some((v) => v.problem)) return "통과 — 비평 major 0, 기계 검사 통과. 다른 요청 부분이 남았으면 이어서, 아니면 사용자에게 보고한다.";
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
  zones = [...zones, ...(patch.addZones ?? []).map((z) => (floor > 1 && !z.floor ? { ...z, floor } : z))];
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
  const hints = { ...(spec.hints ?? {}), ...(patch.set?.hints ?? {}),
    ...(patch.variant !== undefined ? { variant: patch.variant } : {}), ...(patch.seed !== undefined ? { seed: patch.seed } : {}), ...(patch.dressing !== undefined ? { dressing: patch.dressing } : {}) };
  return { ...spec, ...(patch.set ?? {}), type: spec.type, ...(zones.length ? { zones } : {}), ...(features.length ? { features } : {}), hints };
}

/** 현대(한국·일본 도시) 장소를 처음 지은 게임 요청이면 장르 기본값(주인공 현대 칩·체력 HUD 끄기·연애 기본값)을 깔고 보고에 한 줄 남긴다. */
function withSetupDefaults(result: PlaceBuildResult, builderId: string, project: Project, task: string, freshStart = false): PlaceBuildResult {
  if (!result.ok) return result;
  const set = builderId === "kr-modern" || builderId === "jp-city" ? applyModernSetupDefaults(project, task, freshStart) : applyStorySetupDefaults(project, task, freshStart);
  return set.length ? { ...result, warnings: [...result.warnings, `게임 기본값을 깔았다: ${set.join(" · ")} — 사용자가 다른 것을 원하면 바꾼다`] } : result;
}

export function createV2Tools(env: PiAssistantV2Env, session: V2Session): PiToolShape[] {
  const task = env.request.task;
  const run = createBuildRun(env.ctx);
  // 이 차례를 시작할 때 빈 프로젝트였나 — 첫 장소를 짓는 요청은 「게임」 낱말이 없어도 게임 시작으로 보고 장르 기본값을 깐다(G51).
  const freshStart = isFreshProject(env.ctx.project);

  const problemCount = (seen: Seen | undefined, mapIds: readonly string[]) => !seen ? Infinity
    : seen.checks.filter((c) => !c.ok && mapIds.includes(c.mapId)).length + seen.critics.filter((v) => mapIds.includes(v.mapId)).reduce((n, v) => n + v.majors.length, 0);
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
    return withImages({ ok: true, mapIds: result.mapIds, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, ...seenPayload(seen), round: rounds, next: nextStep(seen, rounds) }, seen);
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
      session.stages.set(stage.mapId, { name: map?.name ?? stage.mapId, rounds, problems: clean ? [] : [
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
    description: "게임 하나를 짓기 전에 이 게임의 청사진(새 플레이어 목표 한 줄·시작부터 엔딩까지 핵심 경로·엔딩·장면마다 느낌)을 쓴다. 이미 있으면 통째로 바꾼다(실제 지은 이름에 맞출 때도). 결과로 지금 프로젝트에서 이 경로가 어디까지 이어지는지 돌려준다.",
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
      const filled = { ...raw, title: raw.title || prior?.title || env.ctx.project.meta?.title || "제목 없는 게임", genre: raw.genre || prior?.genre || "게임" };
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
    description: "청사진(write_blueprint)의 핵심 경로를 실제 플레이 길로 짓는다 — 단계마다 그 맵에 조사·대화 이벤트를 두고(같은 이름 이벤트가 있으면 고쳐 쓴다), 앞 단계의 gives(열쇠·쪽지는 아이템, 나머지는 스위치)를 다음 단계의 조건으로 걸고, 마지막 단계가 엔딩을 부르게 한다(엔딩이 없으면 청사진 ending 으로 정의). 장소를 지은 뒤 한 번 부른다 — 이벤트를 upsert_event·define_ending 으로 하나씩 맞추지 않는다. 대사만 steps[{id, lines, lockedLines}] 로 줄 수 있고(비우면 청사진 글로 채움), 숫자 자물쇠는 그 단계에 code 와 앞 단계 lines 에 답을 준다. 다시 불러도 같은 이벤트를 고쳐 쓴다.",
    parameters: BUILD_BLUEPRINT_PATH_SCHEMA as unknown as PiToolShape["parameters"],
    async execute(id, params) {
      if (!env.ctx.project.gameBlueprint) return text({ ok: false, summary: "청사진이 없다 — write_blueprint 를 먼저 부른다." });
      const steps = ((params as { steps?: PathStepText[] }).steps ?? []).filter((t) => t && typeof t.id === "string");
      return finishContent(id, "build_blueprint_path", params, runBlueprintPath(steps));
    },
  };
  session.buildPath = async (why: string) => {
    const result = runBlueprintPath([]);
    recordWrite(env, run, `auto-path-${Date.now()}`, "build_blueprint_path", { auto: why }, result.ok, result.summary, { eventIds: result.eventIds });
    session.content.push({ verb: "build_blueprint_path", result });
    if (result.ok) await env.checkpoint("build_blueprint_path");
    return { ok: result.ok, summary: result.summary };
  };
  // 끝맺음(2026-10-28 standin jrpg): 컷신에서 주인공에게 다가온 소녀가 동굴 입구 착지 칸 앞에 서서 자동 플레이가 막혔다.
  session.clearLanes = async () => {
    // 쓰지 않는 빈 시작 맵(잔디 한 장)을 먼저 치운다 — 그쪽으로 가던 이동이 사라진 막다른 틈은 아래 출구 마감이 문 그림으로 닫는다.
    const notes: string[] = retireBlankStart(run);
    // 방탈출이면 청사진 장소 밖으로 조건 없이 나가는 이동을 치운다(빈 맵이 아닌 바깥 맵 — retireBlankStart 가 못 치운다). 틈은 아래 출구 마감이 메운다.
    notes.push(...sealEscapeExits(run));
    // 추격자가 있는데 숨을 곳이 0곳인 맵(2026-10-29 standin horror 「폐병원」) — 맵에 있는 옷장·사물함·침대·커튼 1~2곳을 순찰 길 가까이에서 은신처로.
    for (const [mapId, map0] of Object.entries(env.ctx.project.maps)) {
      if (!chaserEvents(map0).length || mapHidingEvents(map0).length) continue;
      const copy = { ...map0, events: [...(map0.events ?? [])] };
      const auto = ensureChaserHidingSpots(env.ctx.project, copy);
      if (auto.placed.length) {
        env.ctx.project = { ...env.ctx.project, maps: { ...env.ctx.project.maps, [mapId]: copy } } as Project;
        notes.push(`${map0.name}: 추격자 은신처 ${auto.placed.map((p) => `${p.label}(${p.x},${p.y})`).join(" · ")}`);
      } else if (auto.note) notes.push(`${auto.note} — 은신처 0곳`);
    }
    for (const mapId of Object.keys(env.ctx.project.maps)) {
      // 실내 출구·공허 마감(막다른 남쪽 틈 메우기·문 그림·남색 공허 칸) — 화면 검수 장부 builder-exit/builder-tiles.
      for (const n of dressInteriorExits(run, mapId).notes) notes.push(`${env.ctx.project.maps[mapId]?.name ?? mapId}: ${n}`);
      const r = clearTransferLanes(run, mapId);
      const name = env.ctx.project.maps[mapId]?.name ?? mapId;
      for (const m of r.moved) notes.push(`${name}: ${m}`);
      for (const s of r.stuck) notes.push(`${name}: ${s} — 옮길 자리가 없어 그대로 둠`);
    }
    if (notes.length) {
      recordWrite(env, run, `auto-lanes-${Date.now()}`, "move_event", { auto: "transfer-lanes" }, true, notes.join(" / ").slice(0, 400), {});
      await env.checkpoint("clear_transfer_lanes");
    }
    return notes;
  };

  const makePlace: PiToolShape = {
    name: "make_place", label: "장소 짓기", concurrency: "exclusive",
    description: "장소(실내·마을·던전·동굴·거리·집)를 명세 하나로 짓는다. 칸·좌표·타일 번호는 쓰지 않는다 — 함수가 짓고, 1배 그림·기계 검사·독립 비평 결과를 돌려준다.",
    parameters: { type: "object", properties: { spec: PLACE_SPEC_SCHEMA }, required: ["spec"] },
    async execute(id, params) {
      const gate = await blueprintGate();
      if (gate) return text(gate);
      // 같은 요청 → 같은 맵을 막는다(2026-10-23 다양성: 역전 상점가가 v1·v2·4차·5차 모두 화소까지 같았다). 고치기는 기록된 명세의 salt 를 물려받는다.
      const raw = (params as { spec: PlaceSpec }).spec;
      let spec: PlaceSpec = localizeCultureSpec(localizePlaceSpec({ ...raw, salt: Math.floor(Math.random() * 1_000_000) }, String(task ?? "")), String(task ?? ""));
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
      const builder = builderFor(spec);
      if (!builder) {
        session.missingArt.add(`${spec.name}(${spec.type}${spec.style ? `·${spec.style}` : ""}) — 이 종류를 짓는 빌더가 없다`);
        return text({ ok: false, summary: `${spec.type}${spec.style ? `(${spec.style})` : ""} 을 짓는 빌더가 없다. 다른 type 으로 바꾸거나 사용자에게 못 한다고 알린다.` });
      }
      env.emit({ type: "execution_status", name: "v2.build", ok: true, summary: `${spec.name} 짓는 중(${builder.id})` });
      await builder.prepare?.(spec);
      let result = builder.build(run, spec);
      result = withSetupDefaults(result, builder.id, run.ctx.project, String(task ?? ""), freshStart);
      if (keptNote) result = { ...result, warnings: [keptNote, ...result.warnings] };
      return finishPlace(id, "make_place", params, spec, builder.id, result, 0);
    },
  };

  const editPlace: PiToolShape = {
    name: "edit_place", label: "장소 고치기", concurrency: "exclusive",
    description: "지은(또는 이미 있는) 장소의 명세 일부만 바꿔 같은 빌더로 다시 짓는다. 비평 major 의 좌표는 addAnchors.near 로 넘긴다. 맵당 1바퀴까지.",
    parameters: { type: "object", properties: { patch: { type: "object", properties: {
      mapId: { type: "string", description: "고칠 맵 id(patch 안에)" },
      set: { type: "object", properties: { name: { type: "string" }, style: { type: "string" }, theme: { type: "string" }, size: SIZE, floors: { type: "number" }, features: { type: "array", items: { type: "string" } }, exits: { type: "array", items: { type: "string", enum: ["south", "north", "east", "west"] } }, hints: HINTS_SCHEMA } },
      addZones: { type: "array", items: ZONE_SCHEMA },
      removeZones: { type: "array", items: { type: "string" } },
      addAnchors: { type: "array", items: { type: "object", properties: { zone: { type: "string" }, what: { type: "string" }, near: POINT }, required: ["what"] } },
      addFeatures: { type: "array", items: { type: "string" } },
      removeFeatures: { type: "array", items: { type: "string" } },
      variant: { type: "number" }, seed: { type: "number" }, dressing: { type: "number" },
    }, required: ["mapId"] } }, required: ["patch"] },
    async execute(id, params) {
      const raw = params as { patch: PlacePatch; mapId?: string };
      // 모델이 mapId 를 patch 바깥에 두기도 한다(2026-10-23 실조수) — 둘 다 받는다.
      const patch: PlacePatch = { ...raw.patch, mapId: raw.patch?.mapId ?? raw.mapId ?? env.ctx.currentMapId ?? "" };
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
      const spec = applyPatch(record.spec, patch, floor);
      env.emit({ type: "execution_status", name: "v2.repair", ok: true, summary: `${spec.name} 고치는 중(${record.rounds + 1}바퀴)` });
      const before = { project: env.ctx.project, record, seen: new Map(record.result.mapIds.map((m) => [m, session.seen.get(m)!] as const).filter(([, v]) => !!v)) };
      const result = onlyAnchors && builder.id === interiorBuilder.id ? interiorAddAnchors(run, record, patch.addAnchors!) : builder.build(run, spec, record);
      return finishPlace(id, "edit_place", params, spec, builder.id, result, record.rounds + 1, before.seen.size ? before : undefined);
    },
  };

  const addPeople: PiToolShape = {
    name: "add_people", label: "사람 두기", concurrency: "exclusive",
    description: "NPC 를 명세로 둔다(역할·자리 낱말·외형 낱말·대사). 함수가 걸어서 닿는 칸을 고르고 첫 대화/다음 대화 쪽을 만든다.",
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

  const addEvent: PiToolShape = {
    name: "add_event", label: "사건·컷신", concurrency: "exclusive",
    description: "컷신·대화 사건을 비트 목록으로 만든다(walk/say/appear/face/wait/fade/tint/weather/shake/flash/music/emote/camera/look/vanish). 함수가 걸을 수 있는 길·자리를 정하고 미리보기 탐침으로 검사한다.",
    parameters: { type: "object", properties: { event: { type: "object", properties: {
      kind: { type: "string", enum: ["cutscene", "talk", "trigger"] }, mapId: { type: "string" },
      when: { type: "string", enum: ["game-start", "touch", "talk"] }, where: { type: "string" }, at: POINT,
      after: { type: "string", description: "이 NPC 이름과 대화가 끝나면 이어서 재생(그 NPC 대화 끝에 붙는다, 한 번만)" },
      afterTalk: { type: "array", items: { type: "string" }, description: "after 장면이 끝난 뒤 그 NPC 에게 다시 말 걸면 할 말(밤이 됐다·사건 뒤처럼 상황이 바뀌었으면). 없으면 원래 대사" },
      afterPage: { type: "integer", description: "after NPC 의 말 걸기 페이지가 여럿일 때 장면을 이을 페이지 번호(0부터). 낮·밤처럼 페이지가 갈리면 장면이 일어나는 쪽 페이지 — 모르면 비우고 부르면 페이지 목록을 돌려준다" },
      beats: { type: "array", items: { type: "object", properties: {
        do: { type: "string", enum: ["walk", "say", "appear", "face", "wait", "fade", "tint", "weather", "shake", "flash", "music", "emote", "camera", "look", "vanish"] },
        who: { type: "string" }, to: { type: "string", description: "자리 낱말(또는 'x,y')" }, text: { type: "string" },
        where: { type: "string" }, looks: { type: "string" }, toward: { type: "string" }, ms: { type: "number" }, dir: { type: "string", enum: ["in", "out"] },
        tone: { type: "string", enum: ["night", "dusk", "dawn", "sepia", "clear"] }, as: { type: "string", enum: ["shadow", "ghost", "normal"] },
        weather: { type: "string", enum: ["rain", "storm", "snow", "fog", "none"] }, intensity: { type: "number" },
        strength: { type: "string", enum: ["weak", "medium", "strong"] }, axis: { type: "string", enum: ["both", "horizontal", "vertical"] }, color: { type: "string" },
        action: { type: "string", enum: ["bgm", "se", "bgs", "stop", "fade"] }, emote: { type: "string", description: "emote: ! ? ♥ 땀 화 … zzz 반짝 전구 또는 exclamation·question·heart·sweat·anger·ellipsis·sleep·sparkle·idea·music·smile" }, query: { type: "string", description: "music: 음원 찾을 낱말(festival·battle·town·sad·boss·door…; 공포 비명·심장·삐걱·물방울·웅웅·속삭임·쾅·발소리)" },
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
    description: "상대 한 명과의 짧은 대화 장면 — 도입 대사, 선택지 두 개와 선택별 반응, 다시 말 걸면 하는 말. 확정 연애 기획이 있으면 그 계약대로 쓰고, 함수가 짝 얼굴 그림으로 세워 두 선택을 실제 런타임으로 검사한다.",
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
    description: "단서 → 자물쇠(비밀번호·선택) → 보상 → 잠긴 문을 한 번에 짓는다. 고리는 순서대로: 앞 고리의 learn·reward.flag·reward.item 이름만 뒤 고리의 needs 가 된다. 답(code)은 clue 의 lines 에만 두고 자물쇠 대사에는 쓰지 않는다(새면 거부). door 는 지은 뒤 문 칸을 막고 걸어 보아 문 너머가 다른 길로 닿으면 그 틈을 벽으로 메운다. 있는 이벤트는 eventId 로 고쳐 쓰고, 새 것은 at{x,y}·name 을 준다.",
    parameters: { type: "object", properties: {
      mapId: { type: "string" }, name: { type: "string", description: "사슬 이름(예: 서재의 비밀)" },
      links: { type: "array", items: { type: "object", properties: {
        role: { type: "string", enum: ["clue", "code", "door", "pickup"] },
        eventId: { type: "string" }, name: { type: "string" }, mapId: { type: "string" },
        at: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
        learn: { type: "string", description: "clue: 읽으면 알게 되는 것(뒤 고리 needs 이름)" },
        needs: { type: "string", description: "먼저 있어야 하는 것 — 앞 고리 learn·reward.flag·reward.item 이름" },
        code: { type: "string", description: "code: 숫자 답 또는 options 중 정답" },
        options: LINES, lines: LINES, lockedLines: LINES, wrongLines: LINES, doneLines: LINES,
        reward: { type: "object", properties: { item: { type: "string" }, flag: { type: "string" }, lines: LINES } },
        seal: { type: "boolean", description: "door: 문 너머 틈 막기(기본 true)" },
      }, required: ["role"] } },
    }, required: ["mapId", "name", "links"] },
    async execute(id, params) {
      const args = params as unknown as ChainArgs;
      return finishContent(id, "author_puzzle_chain", params, buildPuzzleChain(run, { ...args, mapId: args.mapId || env.ctx.currentMapId || "" }));
    },
  };
  const setObjectiveVerb: PiToolShape = {
    name: "set_objective", label: "현재 목표 걸기", concurrency: "exclusive",
    description: "화면 오른쪽 위 「현재 목표」 줄에 지금 할 일 한 줄을 건다(불러오기·맵 이동 뒤에도 남는다). 게임을 만들면 반드시: at:'start' 로 시작 목표 하나, 그리고 이야기를 한 단계 넘기는 이벤트(열쇠를 줌·회상을 봄·스위치를 켬)마다 eventId 로 다음 목표 — 그 이벤트의 스위치 켜기·아이템 얻기 바로 뒤에 들어간다. 글은 장소·사람·물건 이름을 넣어 구체적으로(「창고 상자에서 태엽 열쇠를 찾자」, 「밤이 되면 집 현관에서 쉬자」). 「어디」도 붙는다: where 에 대상 이벤트·장소(id 또는 이름)를 주거나 글에 다른 장소 이름이 나오면 그 입구의 방위가 자동으로 붙는다(「(지하철역 입구: 동네 거리 남동쪽)」). 엔딩을 부르는 이벤트에는 필요 없다.",
    parameters: { type: "object", properties: {
      text: { type: "string", description: "지금 할 일 한 줄(80자 안)" },
      at: { type: "string", enum: ["start"], description: "start = 게임 시작 목표" },
      eventId: { type: "string", description: "이 이벤트(id 또는 이름)가 이야기를 넘긴 뒤의 목표" },
      mapId: { type: "string" },
      where: { type: "string", description: "목표 대상 이벤트 또는 장소(id 또는 이름) — 그 자리의 방위·입구가 목표 줄에 붙는다" },
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
    description: "잠긴 문(eventId) 너머 방에 문을 거치지 않고 걸어 닿는 틈이 있으면 옆 벽 타일로 메운다(문 칸을 막고 시작·착지점에서 걸어 본다). 게임 검사 「잠긴 방」이 짚으면 쓴다.",
    parameters: { type: "object", properties: { mapId: { type: "string" }, eventId: { type: "string" } }, required: ["mapId", "eventId"] },
    async execute(id, params) {
      const p = params as { mapId: string; eventId: string };
      return finishContent(id, "seal_locked_room", params, sealLockedRoom(run, p.mapId, p.eventId));
    },
  };

  const drawObjectVerb: PiToolShape = {
    name: "draw_object", label: "없는 물건 그리기", concurrency: "exclusive",
    description: "칩셋에 없는 물건을 공방 원클릭 그리기 경로로 맡긴다. 결과의 summary 가 놓였는지·대기인지를 정직하게 말한다.",
    parameters: { type: "object", properties: { object: { type: "object", properties: {
      what: { type: "string" }, description: { type: "string" }, mapId: { type: "string" }, where: { type: "string" }, at: POINT,
      notThese: { type: "array", items: { type: "string" }, description: "「이미 있다」로 거부됐지만 그 그림이 요청과 다른 물건일 때 그 id 들" },
    }, required: ["what"] } }, required: ["object"] },
    async execute(id, params) {
      const object = (params as { object: ObjectSpec }).object;
      const result: DrawObjectResult = drawObject(run, { ...object, ...(object.mapId || !env.ctx.currentMapId ? {} : { mapId: env.ctx.currentMapId }) });
      // 미리 정한 자리·크기를 기억한다 — 그림이 끝난 뒤 place_object 가 where·at 없이 불리면 이 자리에 놓는다.
      if (result.ok && result.plan) rememberObjectPlan(session, result.plan);
      return finishContent(id, "draw_object", params, result);
    },
  };

  const placeObject: PiToolShape = {
    name: "place_object", label: "그린 물건 놓기", concurrency: "exclusive",
    description: "공방에서 그려 칩셋에 넣은 물건(objectId)을 맵에 놓는다. 자리는 낱말(where) 또는 비평·후속 지시가 준 칸(at). 막히면 함수가 가까운 빈 바닥으로 옮긴다.",
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
    description: "이미 지은 실내 맵의 방 하나를 그 쓰임(purpose, 예: 교장실·교실·음악실·복도·보건실) 가구로 채운다. 「방이 비었다」「빈 바닥이 많다」「휑하다」 결함은 이것으로 고친다 — 물건을 하나씩 stamp 하지 않는다. at 은 그 방 바닥 한 칸. 칩셋에서 쓰임에 맞는 가구를 골라 벽을 등지게 놓고, 길·이벤트를 막는 자리는 되돌린다. 방의 나머지는 그대로이고 고치기 바퀴를 쓰지 않는다(맵당 4번).",
    parameters: { type: "object", properties: {
      mapId: { type: "string" }, at: POINT, purpose: { type: "string", description: "방의 쓰임 — 예: 교장실, 교실, 음악실, 복도" },
    }, required: ["mapId", "at", "purpose"] },
    async execute(id, params) {
      const p = params as { mapId: string; at: { x: number; y: number }; purpose: string };
      if (!env.ctx.project.maps[p.mapId]) return text({ ok: false, summary: `맵 ${p.mapId} 이 없다` });
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
    description: "손 도트 실내에 이미 놓인 가구를 하나씩 옮기거나(to), 다른 방향 그림으로 돌리거나(face), 뺀다(remove). at 은 그 가구가 덮는 칸(비평이 짚은 칸). to 는 at 칸이 갈 자리 — 가구 전체가 같은 만큼 밀린다. 방의 나머지는 그대로이고 고치기 바퀴를 쓰지 않는다(맵당 6번). 길을 막거나 지을 수 없는 자리면 되돌리고 이유를 말한다. 탁자·상품·단상·벽·바닥은 못 옮긴다. 손으로 고친 방(dress_room·stamp_object 로 채운 방)은 그림 칸 그대로 옮기거나 뺀다(face 는 안 된다).",
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
    let prev: { mapId: string; spec?: PlaceSpec; result?: PlaceBuildResult } = { mapId: start0 && isPlaceholderMap(start0) ? "" : env.ctx.project.startMapId };
    for (const step of bp.steps) {
      let map = blueprintMapFor(env.ctx.project, step.place);
      if (!map) {
        const guess = guessPlaceSpec(step.place, env.ctx.project, bp.genre, String(task ?? ""));
        const spec: PlaceSpec = { ...guess, salt: Math.floor(Math.random() * 1_000_000), ...(isInside(guess) ? { mapId: `map_auto_${Math.floor(Math.random() * 1e9).toString(36)}` } : {}) };
        const builder = builderFor(spec);
        if (!builder) { notes.push(`「${step.place}」(${spec.type}) — 짓는 빌더가 없다`); continue; }
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
    if (notes.length) await env.checkpoint("auto_places");
    return notes;
  };
  const makeGame: PiToolShape = {
    name: "make_game", label: "작은 게임 짓기", concurrency: "exclusive",
    description: "작은 게임 한 판 — 장소 여러 곳(5~8)을 짓고 부모-자식으로 잇고(마을 집 문↔실내, 바깥 가장자리끼리, 던전 입구), 사람·사건을 둔 뒤, 시작에서 모든 맵에 갔다 돌아오는 길을 기계로 걸어 보고 맵마다 비평을 돌려준다. 맵마다 make_place 를 따로 부르지 않는다.",
    parameters: { type: "object", properties: { game: { type: "object", properties: {
      title: { type: "string" },
      start: { type: "string", description: "시작 장소 key(생략하면 첫 장소)" },
      places: { type: "array", maxItems: 8, items: { type: "object", properties: {
        key: { type: "string" }, spec: PLACE_SPEC_SCHEMA, from: { type: "string", description: "들어오는 부모 장소 key(시작 장소는 생략)" },
        side: { type: "string", enum: ["north", "south", "east", "west"], description: "바깥끼리 잇는 쪽(부모에서 본 방향)" },
      }, required: ["key", "spec"] } },
      people: { type: "array", items: { ...personItem, properties: { ...personItem.properties, place: { type: "string", description: "장소 key" } }, required: [...personItem.required, "place"] } },
      events: { type: "array", items: { ...eventItem, properties: { ...eventItem.properties, place: { type: "string", description: "장소 key" } }, required: [...eventItem.required, "place"] } },
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
        const spec0: PlaceSpec = localizeCultureSpec(localizePlaceSpec({ ...place.spec, salt: Math.floor(Math.random() * 1_000_000) }, String(task ?? "")), String(task ?? ""));
        const parent = place.from ? built.get(place.from) : undefined;
        const parentMap = parent?.result.mapIds[0];
        // 실내는 새 맵 id 로(지금 맵을 덮어쓰지 않게), 나머지는 부모 맵을 「지금 맵」으로 — 빌더가 새 맵을 만들고 던전은 부모와 입구를 잇는다.
        const spec: PlaceSpec = i > 0 && isInside(spec0) && !spec0.mapId ? { ...spec0, mapId: `map_${place.key.replace(/[^A-Za-z0-9_]/gu, "") || "room"}_${Math.floor(Math.random() * 1e6).toString(36)}` } : spec0;
        const builder = builderFor(spec);
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

  const inspect: PiToolShape = {
    name: "inspect", label: "맵 보기", concurrency: "shared",
    description: "맵 하나의 1배 그림·기계 검사·사람/이벤트 목록을 본다(비평가 없이). 고치기 전에 지금 상태를 확인할 때.",
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
    description: "이번 요청 전에 있던 이벤트를 요청 전 그대로(페이지·조건·스위치·그림·대사 원본) 되살린다 — 지웠거나 덮어쓴 것을 되돌릴 때. 기억으로 upsert_event 를 다시 쓰지 않는다(이름·조건이 달라진다). eventId 는 id 또는 이름.",
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
    description: "요청이 정말 둘 이상으로 갈리고 잘못 고르면 다시 지어야 할 때만 묻는다. 부른 뒤에는 짓지 말고 질문으로 턴을 끝낸다.",
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
    description: `짧고 틀이 정해진 글 일을 싼 일꾼 모델에게 한꺼번에 맡긴다(동시에 ${HELPER_LIMITS.parallel}개씩, 최대 ${HELPER_LIMITS.jobs}개). 예: NPC 여럿의 대사 초안, 이름 후보, 아이템·스킬 설명, 긴 대본 요약, 말투 다듬기. 일꾼은 프로젝트를 못 본다 — 필요한 인물·장면·말투를 context 에 넣는다. fields(+count)를 주면 그 열쇠를 가진 JSON 을 검사해 돌려준다. 결과는 초안이다: 맞는지 보고 쓰기 도구(add_people·add_event·upsert_* 등)로 직접 넣는다. 맵·이벤트를 짓거나 고치는 일, 판단이 필요한 일은 맡기지 않는다.`,
    parameters: { type: "object", properties: { jobs: { type: "array", maxItems: HELPER_LIMITS.jobs, items: { type: "object", properties: {
      id: { type: "string", description: "결과를 가려 볼 이름(예: npc_baker)" },
      task: { type: "string", description: "해 달라는 일 한두 문장" },
      context: { type: "string", description: "일꾼이 볼 재료(인물 설명·장면·말투 예시). 프로젝트를 못 보므로 필요한 것은 다 여기에" },
      fields: { type: "array", items: { type: "string" }, description: "JSON 으로 받을 열쇠들(예: [\"speaker\",\"line\"])" },
      count: { type: "integer", description: "fields 모양 객체를 몇 개(배열로) 받을지" },
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
      let parsed: { ok?: boolean; summary?: string } = {};
      try { parsed = first ? JSON.parse(first.text) as { ok?: boolean; summary?: string } : {}; } catch { /* 글 */ }
      env.record({ toolCallId: id, name: tool.name, args: params, result: { ok: parsed.ok !== false, summary: String(parsed.summary ?? (parsed.ok === false ? "실패" : `${tool.label} 완료`)) } });
    }
    return result;
  } });
  const verbs = [writeBlueprint, buildBlueprintPathVerb, makePlace, ...(makeGameOn() && wantsMakeGame(String(task ?? "")) ? [makeGame] : []), editPlace, moveObject, dressRoomVerb, addPeople, addEvent, addScene, ...(wantsPuzzle(String(task ?? "")) ? [authorPuzzleChain] : []), sealLockedRoomVerb, setObjectiveVerb, drawObjectVerb, placeObject, inspect, restoreEvent, ...(helpersOn() ? [askHelpers] : []), askUser].map((tool) => guard(flattenWrapperTool(tool)));
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
  return wantsGameTools(t) || wantsTerrainTools(t) || wantsStoreTools(t) ? dedupeToolSchemas([...verbs, ...createGameTools(gameEnv, t).map((tool) => escalate(flattenWrapperTool(tool, gameEnv.record)))]) : verbs;
}

/** 끝맺음 관문 — 남은 문제가 있으면 한 번 더 돌게 하는 글. 다 통과면 undefined. */
export function v2FinishGate(session: V2Session, env?: PiAssistantV2Env): string | undefined {
  if (session.questions.length) return undefined;
  const open = session.unresolved();
  const missing = [...session.missingArt];
  const fixable = open.filter((o) => o.rounds < V2_MAX_REPAIR_ROUNDS);
  // 게임 내용 검사(날씨·엔딩·상태·물건 고르기·깃발·부작용) — 요청 낱말과 실제로 바뀐 이벤트를 맞댄다.
  let game: string[] = [];
  if (env) { try { game = [...gameContentProblems(env.request.project, env.ctx.project, env.request.task), ...unaskedChanges(env.request.project, env.ctx.project, env.request.task)]; } catch { game = []; } }
  // 끝까지 깰 수 있는 전투인가(2026-10-25 판정 J55·J4): 회복 수단 없음·시키지 않은 무작위 조우·첫 구역이 너무 센 조우.
  if (env) { try { game.push(...combatProblems(env.request.project, env.ctx.project, env.request.task)); } catch { /* 검사 실패는 무시 */ } }
  // 출하 차단(2026-10-25 사용자 규칙): 게임을 만드는 요청이면 편집기 기본값·한 줄 엔딩이 남은 채 «다 됐다»고 하지 못한다.
  if (env) { try { game.push(...shipBlockers(env.ctx.project, env.request.task).map((b) => `[출하 차단 ${b.id}] ${b.message} 고치지 못하면 «완성»이라고 쓰지 말고 남은 기본값으로 보고한다.`)); } catch { /* 검사 실패는 무시 */ } }
  // 아무것도 안 바꾸고 «도구가 없다»며 끝내기(2026-10-24 g3-edit-move: 대장장이 옮기기를 묻기만 했다, g3-apple-count: 그림 카드만 남겼다).
  // 설정이 이미 기본값(켜짐)이면 set_project_settings 가 아무것도 안 바꾸는 것이 맞다(2026-10-25 데모 과업: 탭 걷기·팡파레·빠른 달려들기는 기본 켜짐).
  const settingOnly = /휴대폰|모바일|터치|탭하면|진동|조이스틱|달리기 단추|레벨 ?업|팡파레|달려들|도움말/u.test(env?.request.task ?? "") && !/만들|두고|세워|놓아|놔|추가/u.test(env?.request.task ?? "");
  // 스토어 평가 읽기·답글·소식 카드는 프로젝트를 바꾸지 않는 것이 맞다(2026-10-25).
  // «내 게임 평가에 답글 달아 줘»처럼 «게임» 낱말이 섞여도 만들기·고치기 동사가 없으면 스토어 일로 본다.
  const storeOnly = wantsStoreTools(env?.request.task ?? "") && !/만들|추가|넣어|놓아|세워|지어|고쳐|바꿔|옮겨|줄여|늘려/u.test(env?.request.task ?? "");
  if (env && !settingOnly && !storeOnly && !/\?\s*$|알려\s*줘|뭐야|어디|있어\?|보여\s*줘|설명|정리해서|요약/u.test(env.request.task.trim())) {
    const pick = (p: typeof env.ctx.project) => JSON.stringify([p.maps, p.database, p.endings ?? null, p.commonEvents ?? null, p.switches, p.variables, p.startMapId, p.startPos ?? null, p.system ?? null, p.dialogueDesk ?? null]);
    try {
      if (pick(env.request.project) === pick(env.ctx.project)) game.push("[게임 검사 실행] 이 요청으로 맵·데이터가 하나도 바뀌지 않았다. 묻거나 «도구가 없다»고 끝내지 말고 실행한다: 있는 NPC·물건은 move_event·upsert_event·patch_event_page 로 고치고, 새 것은 add_people·add_event·upsert_event 로 만든다. 꼭 맞는 그림이 없으면 가장 비슷한 기존 그림·물건으로 두고 보고에 적는다(아이템·이벤트·대사는 그림과 상관없이 만든다).");
    } catch { /* 비교 실패는 무시 */ }
  }
  // 고칠 것이 없으면 한 바퀴를 더 쓰지 않는다 — 남은 문제·「그림 없음」은 동사 결과가 이미 보고하라고 일렀다.
  if (!fixable.length && !game.length) return undefined;
  return [
    "[v2 끝맺음 관문] 「다 됐다」고 말하기 전에:",
    ...(game.length ? ["게임 검사가 짚은 것 — 고친 뒤 get_event 로 다시 읽어 확인한다(고칠 수 없으면 보고에 그대로 적는다):", ...game.map((g) => `- ${g}`)] : []),
    ...(fixable.length ? [`아직 고칠 수 있는 곳 ${fixable.length}곳 — 장소는 edit_place, 컷신은 add_event 로 고친다:`, ...fixable.map((o) => `- ${o.name}(${o.mapId}, ${o.rounds}바퀴): ${o.problems.slice(0, 5).join(" / ")}`)] : []),
    ...(open.length > fixable.length ? ["고치기 상한에 닿은 장소의 남은 문제는 사용자 보고에 그대로 적는다:", ...open.filter((o) => o.rounds >= V2_MAX_REPAIR_ROUNDS).map((o) => `- ${o.name}: ${o.problems.slice(0, 4).join(" / ")}`)] : []),
    ...(missing.length ? [`그림·부품이 없어 못 한 것(보고에 반드시 적는다, 대체물로 지어내지 않는다): ${missing.join(" / ")}`] : []),
    "고칠 것을 고친 뒤(또는 고칠 수 없으면 바로) 앞 보고를 대신하는 최종 보고 하나를 다시 쓴다 — 첫 줄을 「최종 보고(앞 보고를 고침):」로 시작하고, 지은 것·통과 여부·못 한 것을 처음부터 다시 적되 앞 보고와 달라진 것(고친 것·되돌린 것)을 분명히 밝힌다. 앞 보고에서 «했다»고 한 것을 되돌렸으면 반드시 그렇다고 쓴다(사용자는 두 보고를 다 본다).",
  ].join("\n");
}
