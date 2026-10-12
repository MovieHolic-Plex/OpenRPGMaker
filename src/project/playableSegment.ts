// project/playableSegment.ts
// 프리셋 첫 생성의 「끝낼 수 있는 구간」 뼈대와 그 판정.
//
// 왜 코드가 뼈대를 만드는가 (2026-09-28): 프리셋 첫 생성을 AI 팀에만 맡긴 실측 24판 중 끝낼 수 있는 판이 없었다.
// 맵 17장을 만든 판도 구간 끝이 없었고, 맵 4장 판은 문이 끊긴 빈 맵 셋·첫 몬스터 없음·포획 도구 없음이었다
// (runGameCheck 로 확인). AI 결과는 매번 달라 「끝까지 간다」를 약속할 수 없다. 그래서
//   1. 인터뷰 직후 코드가 실제 편집 도구(runTool)로 뼈대를 깔고 자동 플레이로 합격을 확인한 뒤 저장한다.
//   2. AI 팀은 그 위에 얹는다. 팀장의 finish 는 같은 판정을 통과해야 받아들여진다(scripts/lib/piTeamRuntime.ts).
//   3. 끝난 결과가 판정을 통과하지 못하면 브라우저가 적용하지 않고 마지막 합격본으로 되돌린다(aiPiAgentCommand.ts).
// 판정은 「구간 끝(SEGMENT_END_ENDING_ID) 까지 헤드리스 런타임으로 걸어가 도달했는가」 하나다.
// 이 판정은 재미·보기 좋음을 보증하지 않는다 — 시작부터 구간 끝까지 막힘 없이 갈 수 있음만 보증한다.
//
// 장르마다 핵심 행동이 다르다: 몬스터 수집은 첫 파트너 받기 + 풀숲 조우, JRPG 는 의뢰 받기 + 이길 수 있는 전투,
// 스토리는 기억 조사 + 이어지는 장면. 셋 다 「핵심 행동 → 문 → 길 → 구간 끝」이고 구간 끝은 핵심 행동의 스위치가 연다.

import { runTool } from "@/editor/tools";
import { canPaintStoryWalk, paintBeodeulStoryWalk } from "@/editor/tools/storyWalkBeodeul";
import { runGameCheck } from "@/qa/gameCheck";
import { canMove, isPassable, isPassableLanding } from "@/project/collision";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { blankFillTileFor } from "@/project/defaults/defaultMaps";
import { paintMainStreet, paintStartRoute, routeStyleFor, startMapSizeFor } from "@/project/startRoutePaint";
import { preloadRegionReferenceScene } from "@/project/regionReferenceImport";
import { regionReference } from "@/project/regionReferences";
import { labelStreetBuildings, planJpCityStreet, runJpStreetPlan, shopsFromText, streetStyleFromText } from "@/project/jpCityStreetComposer";
import { KIT_START_PLACES, planStartForBrief, type StartPlan } from "@/project/startVariety";
import type { GameMap, Project } from "@/project/types";
import { authoringHarnessFor, eligibleAuthoringHarnessFor, inspectAuthoringHarness } from '../harnesses/_core/authoringRegistry';
import {
  hasPlayableSegmentSkeleton,
  playableSegmentGenre,
  SEGMENT_END_ENDING_ID,
  SEGMENT_END_EVENT_ID,
  SEGMENT_KEY_SWITCH_ID,
  SEGMENT_ROUTE_MAP_ID,
  SEGMENT_STARTER_EVENT_ID,
  SEGMENT_WILD_TROOP_ID,
  supportsPlayableSegment,
  type PlayableSegmentGenre,
} from "./playableSegmentContract";

export * from "./playableSegmentContract";

const SEGMENT_WILD_ENEMY_ID = "enemy_segment_wild";
const CAPTURE_ITEM_ID = "item_capture_orb";
const STARTER_SPECIES = ["species_leafling", "species_sparkit", "species_aqualing"] as const;
/** JRPG 문지기. 기본 DB 의 슬라임 무리는 시작 파티(Lv1 영웅)가 모의전 5/5 로 이긴다(2026-09-28 simulateBattle). */
const JRPG_GATE_TROOP_ID = "troop_slime_pair";

export type PlayableSegmentVerdict =
  | { readonly ok: true; readonly endingId: string; readonly ms: number }
  | { readonly ok: false; readonly blockers: readonly string[]; readonly ms: number };

/**
 * 구간 끝까지 갈 수 있는가. 자동 플레이가 SEGMENT_END_ENDING_ID 에 닿아야 합격이다.
 * 다른 엔딩에 닿은 것만으로는 합격이 아니다 — 첫 구간의 약속은 이 엔딩이다.
 */
export function judgePlayableSegment(project: Project, options: { readonly budgetMs?: number; readonly expected?: Project } = {}): PlayableSegmentVerdict {
  const authoring = inspectAuthoringHarness(project, options.expected ?? project);
  if (authoring) return authoring.ok ? { ok: true, endingId: 'ending_romance_first_meeting', ms: authoring.ms }
    : { ok: false, blockers: authoring.blockers, ms: authoring.ms };
  const started = Date.now();
  const report = runGameCheck(project, { autoPlayBudgetMs: options.budgetMs ?? 60_000 });
  const reached = report.autoPlay?.runs.some((run) => run.ok && run.endingReached === SEGMENT_END_ENDING_ID) === true;
  const ms = Date.now() - started;
  if (reached) return { ok: true, endingId: SEGMENT_END_ENDING_ID, ms };
  const blockers = report.findings.filter((finding) => finding.severity === "blocker").map((finding) => finding.message);
  if (!project.endings?.some((ending) => ending.id === SEGMENT_END_ENDING_ID)) blockers.unshift("첫 구간의 끝(" + SEGMENT_END_ENDING_ID + ") 엔딩이 없습니다.");
  if (report.autoPlay?.skipped) blockers.push("자동 플레이: " + report.autoPlay.skipped);
  if (blockers.length === 0) blockers.push("자동 플레이가 첫 구간의 끝(" + SEGMENT_END_ENDING_ID + ")에 닿지 못했습니다.");
  return { ok: false, blockers: [...new Set(blockers)], ms };
}

/**
 * 이 프로젝트가 판정 대상인가 — 뼈대를 가진 지원 장르 프로젝트이고, 지금 합격 상태인가.
 * 합격하지 않은 프로젝트(저자가 이미 뼈대를 고쳐 끊은 경우 등)는 판정으로 되돌릴 합격본이 없으므로 대상이 아니다.
 */
export function playableSegmentGateApplies(project: Project): boolean {
  if (authoringHarnessFor(project)) return true;
  return supportsPlayableSegment(project) && hasPlayableSegmentSkeleton(project) && judgePlayableSegment(project).ok;
}

function tool(ctx: { project: Project }, name: string, args: Record<string, unknown>): Record<string, unknown> | undefined {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error("첫 구간 뼈대 " + name + " 실패: " + result.summary + " " + JSON.stringify(result.issues ?? []));
  return (result as { data?: Record<string, unknown> }).data;
}

function page(id: string, commands: readonly unknown[], conditions: readonly unknown[] = []): Record<string, unknown> {
  return { id, conditions, trigger: { kind: "action" }, graphic: { transparent: true }, commands };
}

/** 길 맵 기하 — 입구는 x=0, 구간 끝 이벤트는 x=width-2. 기본(옛 뼈대)은 24×12 · 입구/끝 줄 6. */
interface RouteGeometry {
  readonly width: number;
  readonly height: number;
  readonly entryY: number;
  readonly endY: number;
}
const LEGACY_ROUTE: RouteGeometry = { width: 24, height: 12, entryY: 6, endY: 6 };

/** 길 맵을 칩셋 재료로 깐다. 길·마당은 필수(실패하면 뼈대를 포기), 보도 연석 같은 장식은 못 칠해도 건너뛴다. 구상이 없으면(옛 뼈대) 깔지 않는다. */
function paintRouteFor(ctx: { project: Project }, tilesetId: string, route: RouteGeometry, plan: StartPlan | null): void {
  const style = routeStyleFor(tilesetId);
  if (!plan || !style) return;
  paintStartRoute((rect, material, optional) => {
    try { tool(ctx, "fill_region", { mapId: SEGMENT_ROUTE_MAP_ID, rect, material }); }
    catch (error) { if (!optional) throw error; }
  }, style, plan, route);
}

/** 컨셉이 고른 칩셋(조선·마법 학교·일본 도시)으로 손대지 않은 빈 시작 맵을 옮긴다 — 조수는 보는 맵의 칩셋 계열을 따르므로 버들항 빈 맵에서는 컨셉의 칩셋이 영영 안 쓰인다. */
function openBlankStartOnConceptKit(ctx: { project: Project }, startId: string, plan: StartPlan): void {
  const kit = ctx.project.tilesets[plan.tilesetId];
  const map = ctx.project.maps[startId];
  if (!kit || !map || plan.tilesetId === map.tilesetId || map.tilesetId !== DEFAULT_TILESET_ID || !isUntouchedBlank(map)) return;
  map.tilesetId = kit.id;
  map.tileSize = kit.tileSize;
  map.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit));
  const size = startMapSizeFor(kit.id, plan);
  if (size) tool(ctx, "resize_map", { mapId: startId, width: size.width, height: size.height });
  const grown = ctx.project.maps[startId]!;
  grown.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit));
  const ground = routeStyleFor(kit.id)?.ground;
  if (ground) {
    try { tool(ctx, "fill_region", { mapId: startId, rect: { x: 0, y: 0, w: grown.width, h: grown.height }, material: ground }); } catch { /* 바탕은 장식이다 — 빈 칸 그대로 둔다 */ }
  }
  const style = routeStyleFor(kit.id);
  if (style && !style.noMainStreet) {
    // 큰길: 시작 칸 줄을 가로질러 동쪽 문까지. 보도 연석 같은 장식은 못 칠해도 건너뛰고, 길 자체는 필수다.
    paintMainStreet((rect, material, optional) => {
      try { tool(ctx, "fill_region", { mapId: startId, rect, material }); }
      catch (error) { if (!optional) throw error; }
    }, style, { width: grown.width, height: grown.height }, ctx.project.startPos.y);
  }
}

interface GenreSkeleton {
  readonly routeName: string;
  /** 길 맵을 채운다(도로 시공·조우). 문을 달기 전에 부른다. */
  readonly paveRoute: (ctx: { project: Project }, tilesetId: string, route: RouteGeometry, plan: StartPlan | null) => void;
  /** 시작 맵의 핵심 행동 이벤트. 끝나면 SEGMENT_KEY_SWITCH_ID 가 켜져야 한다. */
  readonly placeStarter: (ctx: { project: Project }, at: { mapId: string; x: number; y: number }) => void;
  readonly lockedLine: string;
  /** 구간 끝에서 엔딩 앞에 도는 명령(JRPG 의 문지기 전투 등). */
  readonly endCommands: readonly unknown[];
  readonly epilogue: string;
  /** 도구가 없는 마무리(시작 소지품 등). 복제본에 직접 쓴다. */
  readonly finish?: (project: Project) => void;
}

const SKELETONS: Record<PlayableSegmentGenre, GenreSkeleton> = {
  "monster-collect": {
    routeName: "1번 길",
    paveRoute(ctx, _tilesetId, route, _plan) {
      // 도로 야생은 Lv5 스타터가 이기고 잡을 수 있는 세기(종족 공식 Lv3). 기본 DB 의 troop_slime 은 액터 파티 척도라 스타터가 진다.
      tool(ctx, "upsert_enemy", { enemy: { id: SEGMENT_WILD_ENEMY_ID, name: "야생 슬라임", speciesId: "species_wild_slime", level: 3, monsterResourceId: "generated-enemy-slime-01" } });
      tool(ctx, "upsert_troop", { troop: { id: SEGMENT_WILD_TROOP_ID, name: "풀숲 슬라임", enemyIds: [SEGMENT_WILD_ENEMY_ID] } });
      tool(ctx, "author_wild_route", { mapId: SEGMENT_ROUTE_MAP_ID, exits: [{ x: 0, y: route.entryY }, { x: route.width - 1, y: route.endY }], grassPatches: 2, encounters: [{ troopId: SEGMENT_WILD_TROOP_ID, weight: 1 }] });
    },
    placeStarter(ctx, at) {
      tool(ctx, "give_starter_monsters", { speciesIds: [...STARTER_SPECIES], actorEvent: { mapId: at.mapId, eventId: SEGMENT_STARTER_EVENT_ID, x: at.x, y: at.y, name: "박사" } });
      // 도구가 만든 선택지마다 giveMonster 뒤에 구간 스위치를 켠다(스위치 켜기 인자가 도구에 없다).
      const map = ctx.project.maps[at.mapId]!;
      const next = structuredClone(ctx.project);
      const starter = next.maps[map.id]!.events.find((event) => event.id === SEGMENT_STARTER_EVENT_ID);
      let switched = 0;
      for (const starterPage of starter?.pages ?? []) {
        for (const command of starterPage.commands) {
          if (command.kind !== "choices") continue;
          for (const option of command.options) {
            const index = option.branch.findIndex((entry) => entry.kind === "giveMonster");
            if (index < 0) continue;
            option.branch.splice(index + 1, 0, { kind: "setSwitch", switchId: SEGMENT_KEY_SWITCH_ID, value: true });
            switched += 1;
          }
        }
      }
      if (switched === 0) throw new Error("첫 구간 뼈대: 박사 이벤트에서 giveMonster 선택지를 찾지 못했습니다.");
      ctx.project = next;
    },
    lockedLine: "혼자서는 더 갈 수 없다. 마을의 박사에게 먼저 가 보자.",
    endCommands: [{ kind: "text", body: "여기까지가 첫 구간이다." }],
    epilogue: "첫 여정을 마쳤다. 다음 길은 이어서 만들 수 있다.",
    finish(project) {
      // 시작 소지품 도구는 없다 — 포획 게임이 포획 도구 없이 시작하지 않게 코드가 직접 넣는다.
      const inventory = project.session.inventory ?? {};
      project.session = { ...project.session, inventory: { ...inventory, [CAPTURE_ITEM_ID]: Math.max(5, inventory[CAPTURE_ITEM_ID] ?? 0) } };
    },
  },
  "adventure-jrpg": {
    routeName: "숲길",
    paveRoute(ctx, tilesetId, route, plan) {
      // 길 맵은 시작 맵의 칩셋을 따른다 — 현대 거리·조선·마법 학교 컨셉은 그 칩셋의 길과 마당으로 깐다(예전엔 길을 안 깔아 빈 풀밭이었다).
      paintRouteFor(ctx, tilesetId, route, plan);
      // 계약 문장이 부르는 id 를 실제 트룹으로 둔다 — 길 조우를 바꾸고 싶으면 이 트룹을 고치면 된다.
      tool(ctx, "upsert_troop", { troop: { id: SEGMENT_WILD_TROOP_ID, name: "숲길 슬라임", enemyIds: ["enemy_slime"] } });
      tool(ctx, "set_encounter_table", { mapId: SEGMENT_ROUTE_MAP_ID, entries: [{ troopId: SEGMENT_WILD_TROOP_ID, weight: 1 }], encounterRate: 20 });
    },
    placeStarter(ctx, at) {
      tool(ctx, "upsert_event", {
        mapId: at.mapId,
        event: {
          id: SEGMENT_STARTER_EVENT_ID, name: "촌장", x: at.x, y: at.y, trigger: { kind: "action" },
          pages: [
            page(SEGMENT_STARTER_EVENT_ID + "_ask", [
              { kind: "text", body: "숲길 끝에 괴물이 길을 막고 있네. 부탁하네." },
              { kind: "setSwitch", switchId: SEGMENT_KEY_SWITCH_ID, value: true },
            ]),
            page(SEGMENT_STARTER_EVENT_ID + "_asked", [{ kind: "text", body: "숲길은 동쪽 문 너머일세." }], [{ kind: "switch", switchId: SEGMENT_KEY_SWITCH_ID, value: true }]),
          ],
        },
      });
    },
    lockedLine: "길이 막혀 있다. 먼저 마을 촌장에게 이야기를 들어 보자.",
    endCommands: [
      { kind: "text", body: "길을 막던 괴물이 덤벼든다!" },
      { kind: "battleProcessing", troopId: JRPG_GATE_TROOP_ID, canEscape: false, canLose: false },
      { kind: "text", body: "길이 열렸다. 여기까지가 첫 구간이다." },
    ],
    epilogue: "첫 의뢰를 마쳤다. 다음 길은 이어서 만들 수 있다.",
  },
  "story-cutscene": {
    routeName: "기억의 길",
    paveRoute(ctx, tilesetId, route, plan) {
      // 버들항은 만남 광장이 있는 산책길(소품 포함)을 먼저 깐다. 다른 칩셋은 그 칩셋의 길·마당으로 깐다.
      if (plan && tilesetId !== DEFAULT_TILESET_ID) { paintRouteFor(ctx, tilesetId, route, plan); return; }
      // 빈 풀밭으로 두면 첫 장소 단계가 몬스터 도로(author_wild_route)로 깔았다(2026-10-07) — 만남 광장이 있는 산책길을 먼저 깐다.
      const map = ctx.project.maps[SEGMENT_ROUTE_MAP_ID]!;
      const tileset = ctx.project.tilesets[tilesetId];
      if (canPaintStoryWalk(tileset)) paintBeodeulStoryWalk(ctx.project, map, tileset, { exit: { x: 0, y: route.entryY }, meet: { x: route.width - 2, y: route.endY } });
    },
    placeStarter(ctx, at) {
      tool(ctx, "upsert_event", {
        mapId: at.mapId,
        event: {
          id: SEGMENT_STARTER_EVENT_ID, name: "기억의 조각", x: at.x, y: at.y, trigger: { kind: "action" },
          pages: [
            page(SEGMENT_STARTER_EVENT_ID + "_look", [
              { kind: "text", body: "낡은 물건을 만지자 오래된 기억이 떠오른다." },
              { kind: "setSwitch", switchId: SEGMENT_KEY_SWITCH_ID, value: true },
            ]),
            page(SEGMENT_STARTER_EVENT_ID + "_seen", [{ kind: "text", body: "동쪽 길 끝에 그날의 장소가 있다." }], [{ kind: "switch", switchId: SEGMENT_KEY_SWITCH_ID, value: true }]),
          ],
        },
      });
    },
    lockedLine: "아직 무엇을 찾아야 할지 모르겠다. 마을에서 단서를 찾아보자.",
    endCommands: [{ kind: "text", body: "그날의 장소에 닿았다. 여기까지가 첫 구간이다." }],
    epilogue: "첫 기억을 되찾았다. 다음 장면은 이어서 만들 수 있다.",
  },
};

/** 손대지 않은 빈 시작 맵인가 — 같은 칸만 있고 이벤트·위 칸이 없다. 사람이 칠한 맵은 코드가 다시 짓지 않는다. */
function isUntouchedBlank(map: GameMap): boolean {
  return map.events.length === 0
    && map.lowerTiles.every((tile) => tile === map.lowerTiles[0])
    && map.upperTiles.every((tile) => tile === -1)
    && !map.relief;
}

interface TownLayout {
  /** 걸어 닿는 동쪽 끝 문 자리 후보, 시작 줄에 가까운 순. 도구가 거절하면 다음 후보로 간다. */
  readonly doors: readonly { readonly x: number; readonly y: number }[];
  readonly starter: { readonly x: number; readonly y: number };
}

/**
 * 시작 마을을 기획의 구상(형태·지형·무대)대로 미리 짓고, 시작 칸에서 걸어 닿는 동쪽 끝 문 자리와 시작 NPC 자리를 찾는다.
 * 길을 새로 파지 않는다 — 시공기가 만든 길 위에서만 찾는다. 못 찾으면 null(호출부가 옛 뼈대로 물러난다).
 */
const PLACE_TMP_ID = "map_place_tmp";
function prebuildStartTown(ctx: { project: Project }, start: GameMap, plan: StartPlan): TownLayout | null {
  const placeRef = plan.placeId ? regionReference(plan.placeId) : undefined;
  if (plan.composeStreet) {
    if (start.tilesetId !== DEFAULT_TILESET_ID || !ctx.project.tilesets[plan.tilesetId] || !isUntouchedBlank(start)) return null;
  } else if (plan.placeId) {
    if (!placeRef || start.tilesetId !== DEFAULT_TILESET_ID || !ctx.project.tilesets[plan.tilesetId] || !isUntouchedBlank(start)) return null;
  } else if (!plan.prebuildTown || start.tilesetId !== DEFAULT_TILESET_ID || !ctx.project.tilesets[DEFAULT_TILESET_ID] || !isUntouchedBlank(start)) return null;
  // 시험 사본에서 짓는다 — 걸어 닿는 문 자리를 못 찾으면 마을을 채택하지 않고 빈 시작 맵 그대로 둔다(호출부가 옛 모양으로 간다).
  const trial = { project: structuredClone(ctx.project) };
  if (plan.composeStreet) {
    // 구성기가 씨앗으로 거리를 새로 짠다 — 칩셋을 옮기고 맵을 키운 뒤 땅·도로·건물·소품을 도구 호출로 깐다.
    try {
      const kit = trial.project.tilesets[plan.tilesetId]!;
      const size = startMapSizeFor(kit.id, plan) ?? { width: 52, height: 34 };
      const width = Math.max(48, size.width), height = Math.max(34, size.height);
      tool(trial, "resize_map", { mapId: start.id, width, height });
      const blank = trial.project.maps[start.id]!;
      blank.tilesetId = kit.id; blank.tileSize = kit.tileSize;
      blank.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit));
      const text = ctx.project.gameDesignBrief?.summary ?? "";
      const streetPlan = planJpCityStreet({ mapId: start.id, width, height, seed: plan.seed, style: streetStyleFromText(text), shops: shopsFromText(text) });
      const outcome = runJpStreetPlan(streetPlan, (name, args) => tool(trial, name, args) as never);
      if (outcome.built < 4) return null;
      labelStreetBuildings(trial.project.maps[start.id]!, outcome.buildings);
    } catch (error) { if (process.env.START_DEBUG) console.error("[start-street]", error); return null; }
  } else if (plan.placeId && placeRef) {
    try {
    // 완성 장소가 시작 맵이 된다 — 장소는 자기 칩셋 판본(칸 번호가 다른 확장본)을 쓰므로 붙이지 않고 새 맵으로 가져온 뒤(시작 칸이 아직 옛 맵에 있어 무결성이 통과한다),
    // 아래 걷기 분석이 끝나면 옛 빈 맵 자리에 같은 id 로 앉힌다.
    tool(trial, "import_region_reference", { id: plan.placeId, newMapId: PLACE_TMP_ID, name: start.name });
    } catch (error) { if (process.env.START_DEBUG) console.error("[start-place]", error); return null; }
  } else {
    tool(trial, "author_beodeul_town", { mapId: start.id, theme: plan.theme, form: plan.form, terrain: plan.terrain, seed: plan.seed });
  }
  const map = trial.project.maps[plan.placeId && !plan.composeStreet ? PLACE_TMP_ID : start.id]!;
  const key = (x: number, y: number): number => y * map.width + x;
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const walk = (from: number, blocked?: number): Map<number, number> => {
    const dist = new Map<number, number>([[from, 0]]);
    const queue: number[] = [from];
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head]!;
      const cx = cell % map.width, cy = Math.floor(cell / map.width);
      for (const [dx, dy] of steps) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const next = key(nx, ny);
        if (next === blocked || dist.has(next) || !isPassable(trial.project, map, nx, ny) || !canMove(trial.project, map, cx, cy, nx, ny)) continue;
        dist.set(next, dist.get(cell)! + 1);
        queue.push(next);
      }
    }
    return dist;
  };
  // 시공기가 시작 칸을 「가장 가까운 통행 칸」으로 옮기면 갇힌 주머니일 수 있다 — 가장 큰 걸어 다니는 덩어리에서 서쪽 끝을 시작 칸으로 다시 고른다.
  const seen = new Set<number>();
  let largest = new Map<number, number>();
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const cell = key(x, y);
    if (seen.has(cell) || !isPassableLanding(trial.project, map, x, y)) continue;
    const group = walk(cell);
    for (const member of group.keys()) seen.add(member);
    if (group.size > largest.size) largest = group;
  }
  if (largest.size < 40) return null;
  const midY = map.height / 2;
  const origin = [...largest.keys()].sort((a, b) => (a % map.width) - (b % map.width) || Math.abs(Math.floor(a / map.width) - midY) - Math.abs(Math.floor(b / map.width) - midY))[0]!;
  const startAt = { x: origin % map.width, y: Math.floor(origin / map.width) };
  const reach = walk(origin);
  const doors = [...reach.keys()].filter((cell) => cell % map.width === map.width - 1 && isPassableLanding(trial.project, map, map.width - 1, Math.floor(cell / map.width)))
    .map((cell) => ({ x: map.width - 1, y: Math.floor(cell / map.width) }));
  if (!doors.length) return null;
  // 시작 줄에 가장 가까운 문 자리 — 마을이 어느 쪽으로 열렸든 걸어 닿는 곳이다.
  doors.sort((a, b) => Math.abs(a.y - startAt.y) - Math.abs(b.y - startAt.y) || a.y - b.y);
  const doorCell = key(doors[0]!.x, doors[0]!.y);
  // 시작 NPC: 시작 칸에서 2~7걸음, 서 있어도 문으로 가는 길이 끊기지 않는 칸. 문 칸은 피한다.
  const candidates = [...reach.entries()].filter(([cell, d]) => d >= 2 && d <= 7 && cell !== doorCell)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [cell] of candidates) {
    if (walk(origin, cell).has(doorCell)) {
      trial.project.startPos = { ...startAt };
      if (plan.placeId && !plan.composeStreet) {
        const placed = trial.project.maps[PLACE_TMP_ID]!;
        delete trial.project.maps[PLACE_TMP_ID];
        trial.project.maps[start.id] = { ...placed, id: start.id };
        trial.project.mapTree = { mapId: start.id, children: [] } as Project["mapTree"];
      }
      ctx.project = trial.project;
      return { doors, starter: { x: cell % map.width, y: Math.floor(cell / map.width) } };
    }
  }
  return null;
}

/** 뼈대가 붙일 완성 장소의 원본(비동기 적재)을 미리 받는다 — 뼈대 만들기는 동기라, 부르기 전에 한 번 기다린다. 실패해도 조용히(뼈대가 빈 칩셋 맵으로 물러난다). */
export async function preparePlayableSegmentAssets(project: Project): Promise<void> {
  const plan = planStartForBrief(project.gameDesignBrief, project.meta.title);
  if (plan.placeId) await preloadRegionReferenceScene(plan.placeId).catch(() => undefined);
}

/** 프로젝트 없이 모든 칩셋의 시작 장소를 받아 둔다 — 하네스(qa-game)처럼 프로젝트가 동기로 만들어지는 곳용. */
export async function preloadKitStartPlaces(): Promise<void> {
  await Promise.all(Object.values(KIT_START_PLACES).flat().map((id) => preloadRegionReferenceScene(id).catch(() => undefined)));
}

/**
 * 장르별 첫 구간 뼈대: 시작 맵의 핵심 행동 이벤트 → 동쪽 문 → 길 맵 → 길 끝의 구간 끝(핵심 행동의 스위치가 있어야 열림).
 * 맵·문·조우·이벤트·엔딩은 실제 편집 도구로 만든다 — 모델이 쓰는 것과 같은 검증(통행·착지·커밋 게이트)을 지난다.
 * 도구가 없는 것(스위치 이름, 선택지 안 스위치, 시작 소지품)만 코드가 직접 넣는다.
 * 입력은 바꾸지 않고 새 프로젝트를 돌려준다. 이미 뼈대가 있으면 입력을 그대로 돌려준다.
 *
 * 모양은 기획에서 뽑은 구상(startVariety.planStart)을 따른다: 길 맵 크기·입구/끝 줄이 기획마다 다르고, 손대지 않은 빈 시작 맵은
 * 구상의 형태·지형으로 마을을 미리 짓는다. legacy 는 예전 고정 모양(24×12, 줄 6, 빈 시작 맵) — 구상 뼈대가 판정을 못 넘을 때의 물러남이다.
 */
export function buildPlayableSegmentSkeleton(input: Project, options: { readonly legacy?: boolean } = {}): Project {
  const genre = playableSegmentGenre(input);
  if (!genre) throw new Error("이 장르에는 첫 구간 뼈대가 없습니다: " + String(input.system.genre));
  if (hasPlayableSegmentSkeleton(input)) return input;
  const skeleton = SKELETONS[genre];
  const start = input.maps[input.startMapId];
  if (!start) throw new Error("시작 맵이 없어 첫 구간 뼈대를 깔 수 없습니다.");
  const ctx = { project: structuredClone(input) };
  // 구간 스위치는 먼저 정의한다 — upsert_event 참조 검사와 페이지 조건이 이 id 를 본다. 스위치 정의 도구는 없다.
  if (!ctx.project.switches.some((entry) => entry.id === SEGMENT_KEY_SWITCH_ID)) ctx.project.switches.push({ id: SEGMENT_KEY_SWITCH_ID, name: "첫 구간 핵심 행동" });

  const plan = options.legacy ? null : planStartForBrief(input.gameDesignBrief, input.meta.title);
  const route: RouteGeometry = plan ? { width: plan.routeW, height: plan.routeH, entryY: plan.entryY, endY: plan.endY } : LEGACY_ROUTE;
  const town = plan ? prebuildStartTown(ctx, start, plan) : null;
  if (plan && !town) openBlankStartOnConceptKit(ctx, start.id, plan);
  const here = ctx.project.maps[start.id]!;
  const midY = Math.min(here.height - 2, Math.max(1, ctx.project.startPos.y));
  const doorCandidates = town?.doors ?? [{ x: here.width - 1, y: midY }];
  const starter = town?.starter ?? { x: Math.min(here.width - 2, ctx.project.startPos.x + 2), y: midY };

  // 완성 장소로 연 시작 맵은 장소 전용 칩셋 판본을 쓴다 — 길 맵은 그 판본의 길 재료 이름이 달라 칠이 비므로 컨셉의 원래 칩셋으로 깐다.
  const routeTilesetId = plan?.placeId && ctx.project.tilesets[plan.tilesetId] ? plan.tilesetId : here.tilesetId;
  tool(ctx, "create_map", { id: SEGMENT_ROUTE_MAP_ID, name: skeleton.routeName, width: route.width, height: route.height, tilesetId: routeTilesetId });
  skeleton.paveRoute(ctx, routeTilesetId, route, plan);
  // 문: 후보를 시작 줄에 가까운 순으로 시도한다 — 도구가 「걸어 닿지 않음」 따위로 거절하면 다음 후보. 마지막 후보의 오류는 그대로 던진다.
  doorCandidates.slice(0, 12).some((door, index, list) => {
    try { tool(ctx, "create_transfer_pair", { a: { mapId: here.id, x: door.x, y: door.y }, b: { mapId: SEGMENT_ROUTE_MAP_ID, x: 0, y: route.entryY } }); return true; }
    catch (error) { if (index === list.length - 1) throw error; return false; }
  });
  skeleton.placeStarter(ctx, { mapId: here.id, x: starter.x, y: starter.y });
  tool(ctx, "define_ending", {
    id: SEGMENT_END_ENDING_ID,
    name: "첫 구간 끝",
    conditions: [],
    epilogue: [{ kind: "say", speaker: "", text: skeleton.epilogue }],
  });
  tool(ctx, "upsert_event", {
    mapId: SEGMENT_ROUTE_MAP_ID,
    event: {
      id: SEGMENT_END_EVENT_ID, name: "구간 끝", x: route.width - 2, y: route.endY, trigger: { kind: "action" },
      pages: [
        page(SEGMENT_END_EVENT_ID + "_locked", [{ kind: "text", body: skeleton.lockedLine }]),
        page(SEGMENT_END_EVENT_ID + "_page", [...skeleton.endCommands, { kind: "triggerEnding", endingId: SEGMENT_END_ENDING_ID }],
          [{ kind: "switch", switchId: SEGMENT_KEY_SWITCH_ID, value: true }]),
      ],
    },
  });
  const project = structuredClone(ctx.project);
  skeleton.finish?.(project);
  return project;
}

/**
 * 뼈대를 깔고 판정까지 통과한 프로젝트. 대상 장르가 아니거나, 이미 있거나, 깔다 실패하거나, 판정을 통과하지 못하면 null —
 * 호출부는 예전 흐름(AI 만)으로 진행한다. 실패는 코드 결함이므로 콘솔에 남긴다.
 */
export function withVerifiedPlayableSegment(project: Project): Project | null {
  const harness = authoringHarnessFor(project) ?? eligibleAuthoringHarnessFor(project);
  if (harness) {
    const seeded = harness.seed(project);
    if (!seeded) return null;
    const verdict = harness.inspect(seeded, seeded, { allowDraft: true });
    if (!verdict.ok) throw Error('첫 만남 초안 실행 실패: ' + verdict.blockers.join(' / '));
    return seeded;
  }
  if (!supportsPlayableSegment(project) || hasPlayableSegmentSkeleton(project)) return null;
  // 기획 구상 뼈대 → 판정을 못 넘으면 옛 고정 뼈대로 물러난다(둘 다 못 넘을 때만 AI 만으로 진행).
  for (const legacy of [false, true]) {
    try {
      const skeleton = buildPlayableSegmentSkeleton(project, { legacy });
      const verdict = judgePlayableSegment(skeleton);
      if (verdict.ok) return skeleton;
      console.error("[playable-segment] " + (legacy ? "옛 " : "구상 ") + "뼈대가 자동 플레이를 통과하지 못했습니다:", verdict.blockers);
    } catch (error) {
      console.error("[playable-segment] " + (legacy ? "옛 " : "구상 ") + "뼈대를 깔지 못했습니다:", error);
    }
  }
  return null;
}

