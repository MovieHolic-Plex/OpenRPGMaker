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
import { resolveGraphic } from "@/editor/tools/eventCompile";
import { withNpcGraphicCatalogFilter } from "@/assets/charsetQuery";
import { genreLockCharsetCatalogFilter } from "@/project/genreLockCharsets";
import { canPaintStoryWalk, paintBeodeulStoryWalk } from "@/editor/tools/storyWalkBeodeul";
import { canPaintBeodeulWildRoute } from "@/editor/tools/wildRouteBeodeul";
import { runGameCheck } from "@/qa/gameCheck";
import { canMove, isPassable, isPassableLanding } from "@/project/collision";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { blankFillTileFor } from "@/project/defaults/defaultMaps";
import { paintMainStreet, paintRiversidePromenade, paintStartRoute, routeStyleFor, startMapSizeFor } from "@/project/startRoutePaint";
import { preloadRegionReferenceScene } from "@/project/regionReferenceImport";
import { regionReference } from "@/project/regionReferences";
import { labelStreetBuildings, planJpCityStreet, runJpStreetPlan, shopsFromText, streetStyleFromText } from "@/project/jpCityStreetComposer";
import { flavorAvailable } from "@/project/jpShitamachiStreet";
import { isRomanceInterviewProject } from "@/project/romancePreset";
import { ANY_FRIENDSHIP_KEY } from "@/project/session";
import { isWaterfrontRouteName, KIT_START_PLACES, planStartForBrief, type StartPlan } from "@/project/startVariety";
import type { Command, GameMap, Project } from "@/project/types";
import { authoringHarnessFor, eligibleAuthoringHarnessFor, inspectAuthoringHarness } from '../harnesses/_core/authoringRegistry';
import { romanceStageFlatFindings } from '../harnesses/romance-scene/artDirection';
import {
  hasPlayableSegmentSkeleton,
  playableSegmentGenre,
  ROMANCE_ENDING_HAPPY_AT,
  ROMANCE_ENDING_HAPPY_ID,
  ROMANCE_ENDING_NAMES,
  ROMANCE_ENDING_NORMAL_AT,
  ROMANCE_ENDING_NORMAL_ID,
  ROMANCE_PLACEHOLDER_NAMES,
  ROMANCE_SKELETON_ENDING_IDS,
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

function nodeEnv(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

const SEGMENT_WILD_ENEMY_ID = "enemy_segment_wild";
const CAPTURE_ITEM_ID = "item_capture_orb";
const STARTER_SPECIES = ["species_leafling", "species_sparkit", "species_aqualing"] as const;
/** JRPG 문지기. 기본 DB 의 슬라임 무리는 시작 파티(Lv1 영웅)가 모의전 5/5 로 이긴다(2026-09-28 simulateBattle). */
const JRPG_GATE_TROOP_ID = "troop_slime_pair";

/** 연애 뼈대(호감 갈림 엔딩)를 가진 프로젝트인가 — 인터뷰 연애이거나 뼈대의 해피 엔딩이 있다(인터뷰 기록이 지워진 채팅 경로도 같게 본다). */
export function isRomanceSkeletonProject(project: Project): boolean {
  return isRomanceInterviewProject(project) || (project.endings ?? []).some((ending) => ending.id === ROMANCE_ENDING_HAPPY_ID);
}

export type PlayableSegmentVerdict =
  | { readonly ok: true; readonly endingId: string; readonly ms: number }
  | { readonly ok: false; readonly blockers: readonly string[]; readonly ms: number };

/**
 * 구간 끝까지 갈 수 있는가. 자동 플레이가 SEGMENT_END_ENDING_ID 에 닿아야 합격이다.
 * 다른 엔딩에 닿은 것만으로는 합격이 아니다 — 첫 구간의 약속은 이 엔딩이다.
 */
export function judgePlayableSegment(project: Project, options: { readonly budgetMs?: number; readonly expected?: Project } = {}): PlayableSegmentVerdict {
  const authoring = inspectAuthoringHarness(project, options.expected ?? project);
  if (authoring) {
    // 마무리 판정: 동작 검사 통과 + 첫 만남 화면이 단색 빈 판이 아님(초안 시드는 이 판정을 거치지 않는다 — 사람이 먼저 대화를 쓰고 꾸민다).
    const flat = authoring.ok ? romanceStageFlatFindings(project) : [];
    return authoring.ok && flat.length === 0 ? { ok: true, endingId: 'ending_romance_first_meeting', ms: authoring.ms }
      : { ok: false, blockers: authoring.ok ? flat : authoring.blockers, ms: authoring.ms };
  }
  const started = Date.now();
  const report = runGameCheck(project, { autoPlayBudgetMs: options.budgetMs ?? 60_000 });
  // 연애 뼈대는 엔딩이 호감으로 갈린다 — 자동 플레이는 아무도 안 만난 채 닿으니 대개 기본 결말이지만, 해피·평범에 닿아도 같은 구간 끝이다.
  const accepted = isRomanceSkeletonProject(project) ? ROMANCE_SKELETON_ENDING_IDS : [SEGMENT_END_ENDING_ID];
  const reachedRun = report.autoPlay?.runs.find((run) => run.ok && ((run.endingReached !== undefined && accepted.includes(run.endingReached)) || accepted.some((id) => run.label.includes(id))));
  const reached = reachedRun !== undefined;
  const ms = Date.now() - started;
  if (reached) return { ok: true, endingId: reachedRun!.endingReached ?? SEGMENT_END_ENDING_ID, ms };
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

function page(id: string, commands: readonly unknown[], conditions: readonly unknown[] = [], graphic: Record<string, unknown> = { transparent: true }): Record<string, unknown> {
  return { id, conditions, trigger: { kind: "action" }, graphic, commands };
}

/**
 * 첫 구간 뼈대의 핵심 행동 NPC 그림. 예전에는 뼈대 페이지가 전부 transparent 라, 이벤트는 있는데
 * 마을 어디에도 사람이 그려지지 않아 빈 타일을 조사해야 첫 목표를 받을 수 있었다
 * (2026-10-23 필드 QA F2: JRPG 촌장·몬스터 박사가 화면에 없다). 사람 NPC 는 걷기 칩으로 그린다.
 * 장르 잠금이 켜져 있으면 허용 칩 안에서만 고르고, 못 고르면 투명으로 물러선다(뼈대를 포기하지 않는다).
 */
function starterNpcGraphic(project: Project, query: string, seed: string): Record<string, unknown> {
  try {
    const filter = genreLockCharsetCatalogFilter(project);
    const graphic = withNpcGraphicCatalogFilter(filter, () => resolveGraphic({ query }, { overrides: project.charsetLabels, seed }));
    return graphic.sprite ? { ...graphic } : { transparent: true };
  } catch {
    return { transparent: true };
  }
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
  const routeMap = ctx.project.maps[SEGMENT_ROUTE_MAP_ID];
  if (routeMap && (plan.theme === "river" || isWaterfrontRouteName(routeMap.name))) {
    paintRiversidePromenade(ctx.project, routeMap, plan);
  }
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

/**
 * 버들항이 아닌 칩셋(몬스터 키트)의 몬스터 도로 — 칩셋의 「모래길」 오토타일로 입구→끝 마당 길을 깔고(이웃에 맞춰 자동 재성형),
 * 길을 가로지르는 키 큰 풀(지형 태그 5) 두 덩이를 얹고, 조우표를 키 큰 풀 지형(terrain_grass)으로 묶는다.
 * 칩셋에 길 오토타일이나 조우 풀이 없으면 실패를 그대로 던진다(다른 칩셋으로 바꿔 칠하지 않는다).
 */
const MONSTER_ROUTE_GRASS_TAG = 5;
function paveMonsterKitRoute(ctx: { project: Project }, tilesetId: string, route: RouteGeometry, plan: StartPlan | null): void {
  const tileset = ctx.project.tilesets[tilesetId];
  const pathGroup = tileset?.autotileGroups?.find((group) => group.name === "모래길");
  const pathTile = pathGroup?.variantMap["255"];
  const grassTile = tileset?.tileMeta?.findIndex((meta) => meta?.terrainTag === MONSTER_ROUTE_GRASS_TAG && /키 큰 풀/u.test(meta.label ?? ""));
  if (pathTile === undefined || grassTile === undefined || grassTile < 0) {
    throw new Error(`첫 구간 뼈대: ${tilesetId} 칩셋에는 몬스터 도로 재료(모래길 오토타일·키 큰 풀)가 없습니다.`);
  }
  const tiles: Record<string, number> = { road: pathTile, yard: pathTile, grass: grassTile };
  const paint = (rect: { x: number; y: number; w: number; h: number }, material: string): void => {
    tool(ctx, "paint_tiles", { mapId: SEGMENT_ROUTE_MAP_ID, layer: "1", mode: "rect", tile: tiles[material], from: { x: rect.x, y: rect.y }, to: { x: rect.x + rect.w - 1, y: rect.y + rect.h - 1 } });
  };
  const roadWidth = 2;
  paintStartRoute(paint, { roadWidth, road: "road", yard: "yard" }, plan ?? { seed: 1, theme: undefined }, route);
  // 길을 가로지르는 풀숲: 입구 쪽 직선과 끝 줄 직선 위에 하나씩.
  const patch = (x: number, roadY: number) => {
    const y = Math.max(1, roadY - 1);
    return { x, y, w: 3, h: Math.min(route.height - 1, roadY + roadWidth + 1) - y };
  };
  paint(patch(2, route.entryY), "grass");
  paint(patch(Math.max(6, route.width - 12), route.endY), "grass");
  tool(ctx, "set_encounter_table", { mapId: SEGMENT_ROUTE_MAP_ID, entries: [{ troopId: SEGMENT_WILD_TROOP_ID, weight: 1, conditions: { terrainId: "terrain_grass" } }] });
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
  /** 구간 끝 엔딩·이벤트 이름(생략하면 「첫 구간 끝」·「구간 끝」). 연애처럼 장르 말투가 필요한 뼈대만 쓴다. */
  readonly endingName?: string;
  readonly endEventName?: string;
  /** 구간 끝 엔딩 말고 더 깔 엔딩(호감 갈림). 있으면 구간 끝 이벤트가 엔딩 id 없이 triggerEnding 해 조건·priority 로 고른다. */
  readonly branchEndings?: readonly { readonly id: string; readonly name: string; readonly priority: number; readonly conditions: readonly unknown[]; readonly epilogue: string }[];
  /** 도구가 없는 마무리(시작 소지품 등). 복제본에 직접 쓴다. */
  readonly finish?: (project: Project) => void;
}

const SKELETONS: Record<PlayableSegmentGenre, GenreSkeleton> = {
  "monster-collect": {
    routeName: "1번 길",
    paveRoute(ctx, tilesetId, route, plan) {
      // 도로 야생은 Lv5 스타터가 이기고 잡을 수 있는 세기(종족 공식 Lv3). 기본 DB 의 troop_slime 은 액터 파티 척도라 스타터가 진다.
      tool(ctx, "upsert_enemy", { enemy: { id: SEGMENT_WILD_ENEMY_ID, name: "야생 슬라임", speciesId: "species_wild_slime", level: 3, monsterResourceId: "generated-enemy-slime-01" } });
      tool(ctx, "upsert_troop", { troop: { id: SEGMENT_WILD_TROOP_ID, name: "풀숲 슬라임", enemyIds: [SEGMENT_WILD_ENEMY_ID] } });
      const tileset = ctx.project.tilesets[tilesetId];
      if (tileset && canPaintBeodeulWildRoute(tileset)) {
        tool(ctx, "author_wild_route", { mapId: SEGMENT_ROUTE_MAP_ID, exits: [{ x: 0, y: route.entryY }, { x: route.width - 1, y: route.endY }], grassPatches: 2, encounters: [{ troopId: SEGMENT_WILD_TROOP_ID, weight: 1 }] });
        return;
      }
      // 몬스터 수집 새 프로젝트의 시작 맵은 몬스터 키트(monster_overworld)다(#2675). author_wild_route 는 버들항 전용이라
      // 그대로 부르면 뼈대가 통째로 실패했다 — 같은 칩셋의 길·키 큰 풀 재료로 길을 깔고, 조우는 키 큰 풀 칸(terrain_grass)에서만 난다.
      paveMonsterKitRoute(ctx, tilesetId, route, plan);
    },
    placeStarter(ctx, at) {
      tool(ctx, "give_starter_monsters", { speciesIds: [...STARTER_SPECIES], actorEvent: { mapId: at.mapId, eventId: SEGMENT_STARTER_EVENT_ID, x: at.x, y: at.y, name: "박사" } });
      // 도구가 만든 선택지마다 giveMonster 뒤에 구간 스위치를 켠다(스위치 켜기 인자가 도구에 없다).
      const map = ctx.project.maps[at.mapId]!;
      const next = structuredClone(ctx.project);
      const starter = next.maps[map.id]!.events.find((event) => event.id === SEGMENT_STARTER_EVENT_ID);
      let switched = 0;
      // 스타팅 선택은 「고르기 → 정할까요? 예/아니오」 중첩이라 어느 깊이의 giveMonster 뒤에도 켠다.
      const switchAfterGive = (commands: Command[]): void => {
        for (const command of commands) {
          if (command.kind !== "choices") continue;
          for (const option of command.options) {
            const index = option.branch.findIndex((entry) => entry.kind === "giveMonster");
            if (index >= 0) {
              option.branch.splice(index + 1, 0, { kind: "setSwitch", switchId: SEGMENT_KEY_SWITCH_ID, value: true });
              switched += 1;
            } else switchAfterGive(option.branch);
          }
        }
      };
      for (const starterPage of starter?.pages ?? []) switchAfterGive(starterPage.commands);
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
      // 지도·배지 메뉴는 **실제 캠페인 정의**가 있어야 열린다(menuSystem 의 내재 가용성 관문,
      // gameSystemAuthoringTools 는 「지도·배지 항목에는 실제 캠페인 정의가 필요합니다」로 거부한다).
      // 수집 프리셋 메뉴에는 두 항목이 저작돼 있는데 정의가 없어 런타임이 둘 다 숨겼다
      // (2026-10-23 필드 QA F2: 도감·동료·가방·원정 수첩·저장·설정 6개만 나온다).
      // 예제가 실제로 가진 장소(마을·1번 길)와 종·목표로 정의를 깔아 두 항목이 진짜 화면을 갖게 한다.
      const startMap = project.maps[project.startMapId];
      const routeMap = project.maps[SEGMENT_ROUTE_MAP_ID];
      project.system.monsterCampaign = {
        id: "campaign_starter_expedition",
        name: "첫 원정",
        speciesIds: (project.database.monsterSpecies ?? []).map((species) => species.id),
        speciesNotes: {},
        badges: [],
        locations: [
          ...(startMap ? [{ mapId: startMap.id, name: startMap.name, x: startMap.width - 2, y: Math.floor(startMap.height / 2), kind: "town" as const }] : []),
          ...(routeMap ? [{ mapId: routeMap.id, name: routeMap.name, x: routeMap.width - 2, y: Math.floor(routeMap.height / 2), kind: "route" as const }] : []),
        ],
        objectives: [{ id: "objective_first_partner", title: "마을의 박사에게 첫 파트너를 받는다", summary: "첫 파트너 받기", switchId: SEGMENT_KEY_SWITCH_ID }],
      };
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
      // 촌장은 화면에 서 있어야 한다 — 예전에는 투명 그래픽이라 마을 서쪽 끝 빈 잔디를 조사해야 했다(2026-10-23 필드 QA F2).
      const look = starterNpcGraphic(ctx.project, "노인", `${at.mapId}:${SEGMENT_STARTER_EVENT_ID}`);
      tool(ctx, "upsert_event", {
        mapId: at.mapId,
        event: {
          id: SEGMENT_STARTER_EVENT_ID, name: "촌장", x: at.x, y: at.y, trigger: { kind: "action" },
          pages: [
            page(SEGMENT_STARTER_EVENT_ID + "_ask", [
              { kind: "text", body: "숲길 끝에 괴물이 길을 막고 있네. 부탁하네." },
              { kind: "setSwitch", switchId: SEGMENT_KEY_SWITCH_ID, value: true },
            ], [], look),
            page(SEGMENT_STARTER_EVENT_ID + "_asked", [{ kind: "text", body: "숲길은 동쪽 문 너머일세." }], [{ kind: "switch", switchId: SEGMENT_KEY_SWITCH_ID, value: true }], look),
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

/** 현대 캠퍼스·도시 시작 맵을 칩셋 구성기 도구로 깐다. 시작 맵의 칩셋을 컨셉 칩셋으로 옮기고 구성기가 서는 크기로 키운 뒤 부른다. 실패하면 던진다(호출부가 빈 칩셋 맵으로 물러난다). */
export function composeKitStartMap(ctx: { project: Project }, mapId: string, plan: StartPlan): void {
  const kit = ctx.project.tilesets[plan.tilesetId];
  if (!kit || !plan.composeKit) throw new Error("구성기가 있는 칩셋이 아닙니다: " + plan.tilesetId);
  const base = startMapSizeFor(kit.id, plan) ?? { width: 56, height: 44 };
  const campus = plan.composeKit === "modern_campus";
  const schoolText = /고등학교|중학교|교복|학원/u.test(ctx.project.gameDesignBrief?.summary ?? "");
  const style = campus ? (schoolText ? "school" : "university") : undefined;
  // 구성기 최소 크기: 대학 52×40 · 학교 48×36 · 도시 40×30.
  const min = campus ? (style === "school" ? { w: 48, h: 36 } : { w: 52, h: 40 }) : { w: 40, h: 30 };
  const width = Math.max(min.w, base.width), height = Math.max(min.h, base.height);
  tool(ctx, "resize_map", { mapId, width, height });
  const blank = ctx.project.maps[mapId]!;
  blank.tilesetId = kit.id; blank.tileSize = kit.tileSize;
  blank.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit));
  const text = ctx.project.gameDesignBrief?.summary ?? "";
  // 기본 이름 「빈 맵」 은 장소를 말해 주지 않는다 — 구성기가 까는 장소 이름으로 바꾼다(조수·인터뷰가 이미 지은 이름은 건드리지 않는다).
  if (blank.name === "빈 맵") blank.name = campus ? (style === "school" ? "학교 교정" : "캠퍼스 교정") : "거리";
  const data = campus
    ? tool(ctx, "compose_campus_grounds", { mapId, style, seed: plan.seed })
    : tool(ctx, "compose_modern_city_street", { mapId, seed: plan.seed, shops: modernCityShopsFromText(text) });
  // 시작 칸은 구성기가 정한 교문·보도 칸이다 — 기본 시작 칸 (10,8) 이 우연히 풀밭이라 통과해도 거기서 시작하지 않는다.
  const at = (data as { start?: { x: number; y: number } } | undefined)?.start;
  if (at && ctx.project.startMapId === mapId) ctx.project.startPos = { x: at.x, y: at.y };
}

/** 기획 글에서 도시 거리에 꼭 넣을 건물(연애·일상 무대의 단골 장소)을 뽑는다. 못 짚으면 비워 씨앗이 고른다. */
function modernCityShopsFromText(text: string): string[] {
  const table: readonly (readonly [RegExp, string])[] = [
    [/카페|커피/u, "카페"], [/편의점/u, "편의점"], [/사무실|회사|직장|출근|퇴근|오피스/u, "사무실"], [/아파트|원룸|자취/u, "아파트"],
    [/은행/u, "은행"], [/병원/u, "병원"], [/빵집|베이커리/u, "빵집"],
  ];
  const out: string[] = [];
  for (const [pattern, shop] of table) if (pattern.test(text) && !out.includes(shop)) out.push(shop);
  return out.slice(0, 5);
}

/**
 * 시작 마을을 기획의 구상(형태·지형·무대)대로 미리 짓고, 시작 칸에서 걸어 닿는 동쪽 끝 문 자리와 시작 NPC 자리를 찾는다.
 * 길을 새로 파지 않는다 — 시공기가 만든 길 위에서만 찾는다. 못 찾으면 null(호출부가 옛 뼈대로 물러난다).
 */
const PLACE_TMP_ID = "map_place_tmp";
function prebuildStartTown(ctx: { project: Project }, start: GameMap, plan: StartPlan): TownLayout | null {
  const placeRef = plan.placeId ? regionReference(plan.placeId) : undefined;
  if (plan.composeStreet || plan.composeKit) {
    if (start.tilesetId !== DEFAULT_TILESET_ID || !ctx.project.tilesets[plan.tilesetId] || !isUntouchedBlank(start)) return null;
  } else if (plan.placeId) {
    if (!placeRef || start.tilesetId !== DEFAULT_TILESET_ID || !ctx.project.tilesets[plan.tilesetId] || !isUntouchedBlank(start)) return null;
  } else if (!plan.prebuildTown || start.tilesetId !== DEFAULT_TILESET_ID || !ctx.project.tilesets[DEFAULT_TILESET_ID] || !isUntouchedBlank(start)) return null;
  // 시험 사본에서 짓는다 — 걸어 닿는 문 자리를 못 찾으면 마을을 채택하지 않고 빈 시작 맵 그대로 둔다(호출부가 옛 모양으로 간다).
  const trial = { project: structuredClone(ctx.project) };
  if (plan.composeKit) {
    // 현대 캠퍼스·도시: 칩셋 구성기 도구가 시작 맵을 통째로 깐다(칸 번호로 칠하지 않는다) — 단색 잔디 시작 금지.
    try {
      composeKitStartMap(trial, start.id, plan);
    } catch (error) { if (nodeEnv("START_DEBUG")) console.error("[start-kit]", error); return null; }
  } else if (plan.composeStreet) {
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
      const style0 = streetStyleFromText(text);
      const style = (style0 === "shitamachi" || style0 === "shotengai") && !flavorAvailable(kit, style0) ? "shopping" : style0;   // 굽지 않은 칩셋이면 기본 상가
      const streetPlan = planJpCityStreet({ mapId: start.id, width, height, seed: plan.seed, style, shops: shopsFromText(text) });
      const outcome = runJpStreetPlan(streetPlan, (name, args) => tool(trial, name, args) as never, () => ({ map: trial.project.maps[start.id]!, tileset: trial.project.tilesets[kit.id]! }));
      if (outcome.built < 4) return null;
      labelStreetBuildings(trial.project.maps[start.id]!, outcome.buildings);
    } catch (error) { if (nodeEnv("START_DEBUG")) console.error("[start-street]", error); return null; }
  } else if (plan.placeId && placeRef) {
    try {
    // 완성 장소가 시작 맵이 된다 — 장소는 자기 칩셋 판본(칸 번호가 다른 확장본)을 쓰므로 붙이지 않고 새 맵으로 가져온 뒤(시작 칸이 아직 옛 맵에 있어 무결성이 통과한다),
    // 아래 걷기 분석이 끝나면 옛 빈 맵 자리에 같은 id 로 앉힌다.
    tool(trial, "import_region_reference", { id: plan.placeId, newMapId: PLACE_TMP_ID, name: start.name });
    } catch (error) { if (nodeEnv("START_DEBUG")) console.error("[start-place]", error); return null; }
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
  // 구성기가 정한 시작 칸(교문·보도)이 걸어 다니는 큰 덩어리 안이면 그 자리에서 시작한다 — 서쪽 끝 풀밭이 아니라.
  const composerStart = plan.composeKit ? trial.project.startPos : undefined;
  const composerOrigin = composerStart && composerStart.x >= 0 && composerStart.y >= 0 && composerStart.x < map.width && composerStart.y < map.height ? key(composerStart.x, composerStart.y) : undefined;
  const origin = composerOrigin !== undefined && largest.has(composerOrigin) ? composerOrigin : [...largest.keys()].sort((a, b) => (a % map.width) - (b % map.width) || Math.abs(Math.floor(a / map.width) - midY) - Math.abs(Math.floor(b / map.width) - midY))[0]!;
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

/** 연애 인터뷰 프로젝트의 뼈대 이름·대사(2026-10-16). 판타지 말투(「기억의 조각·기억의 길」)는 연애 게임에 어울리지 않아 자리표시도 연애 말투로 둔다 — 그래도 자리표시라서 romance 검사가 끝내 이름 바꾸기를 요구한다(이름은 playableSegmentContract.ts). */
const ROMANCE_SKELETON: GenreSkeleton = {
  ...SKELETONS["story-cutscene"],
  routeName: ROMANCE_PLACEHOLDER_NAMES[0],
  placeStarter(ctx, at) {
    tool(ctx, "upsert_event", {
      mapId: at.mapId,
      event: {
        id: SEGMENT_STARTER_EVENT_ID, name: ROMANCE_PLACEHOLDER_NAMES[1], x: at.x, y: at.y, trigger: { kind: "action" },
        pages: [
          page(SEGMENT_STARTER_EVENT_ID + "_look", [
            { kind: "text", body: "누군가 떨어뜨린 수첩이다. 펼쳐 보니 낯익은 글씨가 적혀 있다." },
            { kind: "setSwitch", switchId: SEGMENT_KEY_SWITCH_ID, value: true },
          ]),
          page(SEGMENT_STARTER_EVENT_ID + "_seen", [{ kind: "text", body: "주인은 산책로 끝에서 기다릴 것 같다." }], [{ kind: "switch", switchId: SEGMENT_KEY_SWITCH_ID, value: true }]),
        ],
      },
    });
  },
  lockedLine: "아직 이 길을 갈 이유를 모르겠다. 주변에서 단서를 찾아보자.",
  endCommands: [{ kind: "text", body: "산책로 끝에서 누군가 이쪽을 돌아본다. 지금까지 쌓은 마음이 이 순간의 대답이 된다." }],
  // 기본(조건 없는) 결말 = 혼자. 호감이 문턱에 못 닿았을 때 열린다. 해피·평범은 아래 branchEndings 가 누적 호감 문턱으로 깐다.
  epilogue: "아직 누구에게도 마음을 전하지 못한 채 계절이 지났다. 다음 계절에는 먼저 말을 걸어 볼 수 있을까.",
  endingName: ROMANCE_ENDING_NAMES.solo,
  endEventName: ROMANCE_PLACEHOLDER_NAMES[2],
  branchEndings: [
    {
      id: ROMANCE_ENDING_HAPPY_ID, name: ROMANCE_ENDING_NAMES.happy, priority: 20,
      conditions: [{ kind: "friendshipAtLeast", npcKey: ANY_FRIENDSHIP_KEY, value: ROMANCE_ENDING_HAPPY_AT }],
      epilogue: "쌓아 온 시간이 한 사람의 이름으로 이어졌다. 이야기는 이제부터 두 사람의 것이다.",
    },
    {
      id: ROMANCE_ENDING_NORMAL_ID, name: ROMANCE_ENDING_NAMES.normal, priority: 10,
      conditions: [{ kind: "friendshipAtLeast", npcKey: ANY_FRIENDSHIP_KEY, value: ROMANCE_ENDING_NORMAL_AT }],
      epilogue: "고백은 하지 못했지만 서로를 아끼는 사이가 되었다. 지금은 이 거리가 딱 좋다.",
    },
  ],
};

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
  const skeleton = genre === "story-cutscene" && isRomanceInterviewProject(input) ? ROMANCE_SKELETON : SKELETONS[genre];
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
    name: skeleton.endingName ?? "첫 구간 끝",
    conditions: [],
    epilogue: [{ kind: "say", speaker: "", text: skeleton.epilogue }],
  });
  for (const branch of skeleton.branchEndings ?? []) {
    tool(ctx, "define_ending", { id: branch.id, name: branch.name, priority: branch.priority, conditions: branch.conditions, epilogue: [{ kind: "say", speaker: "", text: branch.epilogue }] });
  }
  tool(ctx, "upsert_event", {
    mapId: SEGMENT_ROUTE_MAP_ID,
    event: {
      id: SEGMENT_END_EVENT_ID, name: skeleton.endEventName ?? "구간 끝", x: route.width - 2, y: route.endY, trigger: { kind: "action" },
      pages: [
        page(SEGMENT_END_EVENT_ID + "_locked", [{ kind: "text", body: skeleton.lockedLine }]),
        // 호감 갈림 뼈대는 엔딩 id 없이 부른다 — 조건을 만족한 엔딩 중 priority 가 가장 높은 것이 열린다(마지막 선택지가 아니라 누적 호감이 결말을 가른다).
        page(SEGMENT_END_EVENT_ID + "_page", [...skeleton.endCommands, skeleton.branchEndings?.length ? { kind: "triggerEnding" } : { kind: "triggerEnding", endingId: SEGMENT_END_ENDING_ID }],
          [{ kind: "switch", switchId: SEGMENT_KEY_SWITCH_ID, value: true }]),
      ],
    },
  });
  const project = structuredClone(ctx.project);
  skeleton.finish?.(project);
  return project;
}

/**
 * 손대지 않은 빈 시작 맵을 기획이 고른 현대 칩셋(캠퍼스·도시) 구성기로 깐 사본. 해당 없음·실패면 null(호출부가 입력 그대로 쓴다).
 * 길 맵·시작 NPC·엔딩은 만들지 않는다 — 한 장면 하네스가 그 위에 자기 이벤트를 얹는다.
 */
export function stageStartOnModernKit(project: Project): Project | null {
  const plan = planStartForBrief(project.gameDesignBrief, project.meta.title);
  const start = project.maps[project.startMapId];
  if (!plan.composeKit || !start || start.tilesetId !== DEFAULT_TILESET_ID || !project.tilesets[plan.tilesetId] || !isUntouchedBlank(start)) return null;
  const ctx = { project: structuredClone(project) };
  try { composeKitStartMap(ctx, start.id, plan); }
  catch (error) { if (nodeEnv("START_DEBUG")) console.error("[stage-kit]", error); return null; }
  return ctx.project;
}

/**
 * 뼈대를 깔고 판정까지 통과한 프로젝트. 대상 장르가 아니거나, 이미 있거나, 깔다 실패하거나, 판정을 통과하지 못하면 null —
 * 호출부는 예전 흐름(AI 만)으로 진행한다. 실패는 코드 결함이므로 콘솔에 남긴다.
 */
export function withVerifiedPlayableSegment(project: Project): Project | null {
  const harness = authoringHarnessFor(project) ?? eligibleAuthoringHarnessFor(project);
  if (harness) {
    // 연애 첫 만남 같은 한 장면 하네스도 단색 잔디가 아니라 인터뷰가 고른 현대 무대(캠퍼스·거리)에서 시작한다 — 시작 맵 한 장을 그 구성기로 깐다.
    const seeded = harness.seed(stageStartOnModernKit(project) ?? project);
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

