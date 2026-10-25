import { naturalizeBeodeulHamlet } from './beodeulHamletTools';
import { harmonizeBeodeulDaylight } from './beodeulLightTools';
// author_beodeul_town — 버들항 문법으로 마을·도시를 블록 키트 조립으로 깐다(2026-10-01).
// 버들항(beodeul_city)은 한 채씩 집을 놓는 타일셋이 아니라 「가로 격자 → 블록 키트(bd-block-*) → 길 이음 → 공원·가로수」
// 순서로 조립하는 타일셋이다. author_village 는 숲마을 전용 절차 생성기라 버들항을 받지 못한다(village-tileset-mismatch).
// 이 도구는 scripts/content/lib/beodeul-layout-specs.ts 의 "blocks" 배치(검증 끝난 조립 순서)를 크기에 맞게 매개변수화한 것이다.
// 원본 도시 배치를 베끼지 않는다: 열 폭·띠 높이·블록 종류·공원 자리를 크기와 seed 로 새로 고른다.
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import type { GameMap, Project } from "@/project/types";
import { isPassable } from "@/project/collision";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { assertMapIdAvailable } from "./mapHelpers";
import { MAP_TOOLS, assignCreatedMapBgm } from "./mapTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { BEODEUL_YARD_QUARTERS, beodeulYardReserve } from "./villageQuarterTool";
import { BEODEUL_FOREST_TYPES, parseBeodeulForestType, type BeodeulForestType } from "./beodeulForest";
import { BEODEUL_ROOF_PALETTES, BEODEUL_VILLAGE_WATERS, BEODEUL_VILLAGE_WOODS, BEODEUL_VILLAGE_FORMS, BEODEUL_VILLAGE_THEMES, buildBeodeulVillage, resolveVillageForm, themeDefaultSize, type BeodeulVillageTheme } from "./beodeulVillage";
import { VILLAGE_TERRAINS } from "./beodeulTerrain";

import { buildSmallBeodeulVillage } from "./beodeulSmallVillage";
import { addBeodeulVillageChurch } from './beodeulArchitectureTools';
import { clearBeodeulGroundDressing, dressBeodeulGround } from "./beodeulGroundTools";

const BEODEUL_TILESET_ID = "beodeul_city";
const PAVING = "버들항 길 포석";
const GRASS = "버들항 풀밭";
const COL_WIDTHS = [20, 14] as const; // 블록 폭(키트가 있는 폭만)
const MIN_W = 16;
const MIN_H = 10;
const DEFAULT_W = 60;
const DEFAULT_H = 60;
const HARBOUR_W = 83;
const HARBOUR_H = 15;

const createMapTool = requireTool(MAP_TOOLS, "create_map");
const fillRegionTool = requireTool(CONSTRUCTION_TOOLS_V3, "fill_region");
const stampObjectTool = requireTool(SHARED_OBJECT_TOOLS, "stamp_object");

interface Rect { x: number; y: number; w: number; h: number }
interface BlockKit { id: string; kind: string; w: number; h: number }
interface PlacedBlock { id: string; x: number; y: number; w: number; h: number }
interface Seg { start: number; size: number; gapAfter: number }

export const AUTHOR_BEODEUL_TOWN_TOOL: ToolDefinition = {
  name: "author_beodeul_town",
  description:
    "버들항(beodeul_city) 타일셋으로 마을·도시를 한 번에 시공한다. 새 마을을 만들 때 기존 맵은 보존한다. " +
    "마을마다 다르게 — 요청에서 마을의 정체를 먼저 정하고 그에 맞는 선택지를 고른다: theme(물·기후) · form(왜 거기 생겼나) · terrain(땅 모양) · roofs(지붕 팔레트) · forestType(숲) · 크기(width·height, 작은 마을 40×32 안팎·보통 56×44·큰 마을 72×56 이상) · houseCount(집 3~5채 작은 마을). 요청이 말하지 않은 선택은 보내지 말 것 — 도구가 프로젝트마다 다르게 고른다(결과 data 에 고른 값). seed 도 보내지 않는다(같은 마을을 다시 지을 때만 결과 data.seed). " +
    "theme 으로 문법을 고른다. " +
    "마을(기본 theme:\"river\" 강가 마을 · \"coast\" 포구 · \"desert\" 사막 오아시스 · \"snow\" 설원 · \"swamp\" 늪 수상 마을): " +
    "물(강·바다·못·늪)을 먼저 깔고 길·집(문 앞 칸 = 길, 이웃 키트 반복 없음)·앵커 건물(여관·회관·대상 숙소)·용도별 소품 덩이(방앗간·포구 그물터·대상 마당·얼음낚시터)·울타리 친 밭·숲 덩이까지 짓는다. 집·소품은 bd-house-*·고른 조각 bd-pick-* 키트다. " +
    "form 으로 마을 형태를 고른다 — 마을이 왜 여기 생겼나에서 고를 것: \"street\" 길가 마을(나루·다리·포구 길·오아시스로 드는 길가에 선 마을, 광장 없이 앵커가 다리 머리·어귀에), " +
    "\"riverbank\" 물가 띠 마을(river 만 — 둑을 따라 남북으로 늘어선 방앗간·나루 마을), \"scatter\" 흩어진 마을(농가·산촌 — 오솔길, 집마다 마당·텃밭), " +
    "\"plaza\" 광장 마을(장터·교역지일 때만 — 큰길 위 광장과 그 북쪽 앵커). 중심 광장·십자 길을 기본으로 삼지 말 것. 생략하면 seed 로 형태를 고른다(결과 data.form). " +
    "terrain 으로 땅 모양을 먼저 정한다 — 지형을 깐 뒤 그 위에 물·길·집을 앉힌다: 집·소품은 한 단 위에만, 길이 단을 건너는 곳은 매끈한 경사로로 오른다(계단 없음), 길이 없는 높은 단에는 아랫길에서 오르막과 단 위 윗길(밭길·숲길, 맵 가장자리로)을 낸다. 생략하면 seed 로(평지가 아닌 것 우선). " +
    "2026-10-11 지형 도입 이후 같은 seed 도 예전과 다른 배치가 나온다. 이미 지은 마을 맵은 그대로다 — 지형을 넣으려면 다시 지어야 한다(맵 전체를 다시 깐다 — 손으로 고친 부분은 사라진다): 마을 집이 이미 선 맵은 완성된 집 보호로 같은 mapId 덮어 짓기가 거절되므로 remove_map 으로 지우고 같은 id 로 새로 짓는다. " +
    "theme:\"city\" 는 로마풍 블록 격자 도시(가로 격자 → bd-block-* 블록 → 공원·가로수, harbour:true 이고 가로 83 이상이면 항구 호수)다 — 사용자가 「도시·로마풍·대도시·블록」을 말할 때만. " +
    "mapId 없으면 버들항 새 맵을 만든다(마을 기본 56×44 안팎, 36×30~96×80 / 도시 기본 60×60). mapId 가 있으면 그 버들항 맵 전체를 비우고 다시 깐다(다른 계열 맵이면 거부, 마을 집이 이미 선 맵은 완성된 집 보호로 거부). " +
    "같은 seed·선택 = 같은 마을. 시공 뒤 check_city_form·check_reachability 로 점검한다(마을의 문 앞 칸은 결과 data.doors). " +
    "고칠 곳만 stamp_object(kit:beodeul_city/…)·fill_region 으로 손본다 — 집을 하나씩 따로 놓지 말 것. " +
    "성벽 마을(성벽·성곽·성문·요새로 둘러싼 마을)은 walls:true 로 짓는다 — 버들항 마을 성벽(3/4: 두 줄 깊이 성벽 윗면·흉벽, 네 줄 높이(단층 집보다 높은) 마름돌 앞면, 4×8 아치 터널 성문루, 성벽보다 높이 솟은 3×9 망루, 옆 계단, 땅 그림자 — 설원 마을은 눈 덮인 성벽, 사막 마을은 사암 성벽)이 맵 둘레를 두른다. 성문루는 wallGate 쪽(S 남문 기본 · N 북문 · NS 남북)에 하나씩, 가운데에 가까운 길에 서고 그 길이 맵 끝까지 나간다. 그 밖에서 성벽을 지나는 길은 성벽 안에서 끊긴다(서·동 쪽문 — 성벽 위에 솟은 작은 문루 밑으로 길이 지난다 — 은 wallSideGaps:true 일 때만). 평지로 짓고, 강가 마을은 강 없이(water none) 짓는다(강이 성벽을 뚫는 수문 그림은 없다). theme river·desert·snow 만. " +
    "paint_tiles·fill_region 으로 맵 테두리에 돌 줄을 그려 성벽 흉내를 내지 말 것(위에서 본 납작한 선이 되어 3/4 시점이 깨진다) — 성벽 조각을 손으로 놓을 일이 있으면 키트 beodeul_city/bd-wall-*(성문루·닫힌 성문루·망루·계단·곧은 성벽)와 참고문서 beodeul-town-wall 을 따른다. " +
    "농가·농촌 마을은 지은 뒤 농장 키트로 쓰임을 더한다: 헛간 bd-farm-barn 6×6·닭장 bd-farm-coop 3×3 을 흙 마당에 모은 농가 덩이, 울타리 두른 밭 bd-farm-fenced-plot 7×6(문 아래 흙길), 작물 밭 bd-farm-plot-wheat·cabbage·tomato·sowing — 밭 덩이 사이·마당 길은 폭 2칸 흙길(fill_region 재료 「버들항 농장 흙길」), 넓은 풀밭을 경작지로 통째로 덮지 않는다(참고문서 beodeul-farm). 던전·필드는 이 도구가 아니다(참고문서 beodeul-picks-dungeon·field, 필드 길은 author_wild_route).",
  mode: "write",
  domains: ["map"],
  preservesAuthoredRaster: true,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "기존 버들항 맵 id. 생략하면 새 맵을 만든다." },
      name: { type: "string", description: "새 맵 이름(기본: 버들 마을)" },
      id: { type: "string", description: "새 맵 id(생략 시 자동)" },
      width: { type: "integer", description: `새 맵 가로(기본 ${DEFAULT_W}, ${MIN_W}~${MAX_TOOL_MAP_DIMENSION}). 블록 격자에 맞춰 줄어든다.` },
      height: { type: "integer", description: `새 맵 세로(기본 ${DEFAULT_H}, ${MIN_H}~${MAX_TOOL_MAP_DIMENSION}). 블록 띠에 맞춰 줄어든다.` },
      seed: { type: "integer", description: "배치 변주 시드(같은 값·같은 선택 = 같은 마을). 보내지 말 것 — 생략하면 프로젝트·맵마다 다른 값을 도구가 고르고 data.seed 로 돌려준다. 이미 지은 마을을 그대로 다시 지을 때만 그 값을 보낸다." },
      houseCount: {type:"integer",minimum:3,maximum:5,description:"집 3~5채의 작은 마을(앵커 건물 1채 별도). theme·form·terrain·roofs 와 함께 쓴다 — 크기를 생략하면 40×32 안팎. 생략하면 크기만큼 집을 앉힌다."},
      water: { type: "string", enum: [...BEODEUL_VILLAGE_WATERS], description: "강가 마을(theme river)의 물: river 강이 맵을 세로로 지나고 다리(방앗간·나루 마을) · none 강 없는 마을(숲 빈터·언덕·산골·성벽 안 마을 — 큰길이 가로지르고 일터는 타작마당). riverbank 형태는 늘 river. 생략하면 도구가 고른다(결과 data.water)." },
      quarter: { type: "string", enum: [...BEODEUL_YARD_QUARTERS], description: "이 마을에 곧 dress_village_quarter 로 앉힐 마당 덩이(mining 광산촌 · vineyard 포도원 · temple-ruins 신전 폐허). 주면 숲·밭을 놓기 전에 길가 풀밭에 그 마당 자리를 비워 둔다 — 그다음 dress_village_quarter({mapId, quarter}) 를 같은 값으로 부른다." },
      woods: { type: "string", enum: [...BEODEUL_VILLAGE_WOODS], description: "숲(theme river·coast·snow): edge 마을 둘레에 숲 덩이(기본) · dense 숲속 빈터 마을 — 집·길 사이를 숲이 메우고 밭은 둘까지(숲속 마을·숲 깊은 곳)." },
      roofs: { type: "string", enum: [...BEODEUL_ROOF_PALETTES], description: "지붕 팔레트(theme river·coast 마을만 — 사막·설원·늪은 자기 집): red 붉은 기와 목골집 · slate 청회색 슬레이트 · moss 이끼 낀 초가·너와(농가·숲 마을) · log 통나무집(산골·숲속) · medieval 중세 건물(목골집·막돌집·탑집에 여관·대장간·예배당·비둘기탑 같은 앵커, 3/4 관문과 독립 검수 둘을 통과한 bd-house-mk-*). 집의 80%가 이 지붕, 나머지는 돌벽 작은 집. 생략하면 도구가 고른다(결과 data.roofs)." },
      church: {type:'boolean',description:'houseCount 와 함께 true 이면 옛 예제 작은 마을(고정 배치 40×30 + 석조 교회와 마당, 폭 54칸)을 짓는다. 기본 false — 새 마을에는 쓰지 말 것.'},
      form: { type: "string", enum: [...BEODEUL_VILLAGE_FORMS], description: "마을 형태(theme 마을만, city 에는 없음): street 길가 · riverbank 물가 띠(river 만) · scatter 흩어진 · plaza 광장(장터일 때만). 생략하면 seed 로 고른다." },
      terrain: { type: "string", enum: [...VILLAGE_TERRAINS], description: "지형(theme 마을만) — 마을보다 먼저 정하는 땅 모양: terraces 계단식 비탈(river·coast, 큰길 북쪽 집 띠 뒤로 한두 단, 강은 곧은 골) · highland 높은 산비탈(river, 7칸 간격 세 단 — 산골, 요청할 때만) · hillside 눈 덮인 비탈(snow) · basin 오아시스 골(desert) · ridge 마른 둔덕(swamp, 북쪽 높은 마른 땅·늪물은 낮은 땅에만) · flat 평지. 생략하면 seed 로 고른다(결과 data.terrain)." },
      theme: { type: "string", enum: [...BEODEUL_VILLAGE_THEMES, "city"], description: "마을 문법(기본 river): river 강가 · coast 포구(바다) · desert 사막 오아시스 · snow 설원 · swamp 늪 · city 로마풍 블록 도시(도시를 말할 때만)" },
      forestType: { type: "string", enum: [...BEODEUL_FOREST_TYPES], description: "숲 종류(theme river·coast 마을만). 숲 덩이는 늘 이어진 수관 오토타일(활엽 사이 전나무)이고, 이 값은 낱 나무·숲 둘레 나무를 고른다: broadleaf 활엽(기본) · conifer 전나무·측백(숲 둘레에도 선다) · mixed 혼효" },
      walls: { type: "boolean", description: "true 이면 마을 둘레에 성벽을 두른다(성벽·성곽·성문·요새 마을). theme river·desert·snow 마을만 — 평지로, 강가 마을은 강 없이 짓는다. 성문루·망루·계단도 함께. 결과 data.walls." },
      wallGate: { type: "string", enum: ["S", "N", "NS"], description: "walls 일 때 성문 쪽. S 남문 하나(기본) · N 북문 하나 · NS 남북에 하나씩. 사용자가 말한 쪽을 그대로." },
      wallSideGaps: { type: "boolean", description: "walls 일 때 서·동 성벽 밑으로 길이 지나는 쪽문(작은 문루)을 낼지(기본 false — 성문 말고는 성벽이 닫힌다). 사용자가 옆 출입구를 말할 때만 true." },
      harbour: { type: "boolean", description: `true 이고 가로 ${HARBOUR_W} 이상이면 맨 아래에 항구 호수를 붙인다(세로 ${HARBOUR_H}칸 추가).` },
    },
  },
  invalidArgsExample: { width: 60, height: 60 },
  run(draft, rawArgs) {
    const normalized = normalizeTownArgs(draft, rawArgs);
    const notes = normalized.notes;
    // seed 를 생략하면 프로젝트·맵마다 다른 값(2026-10-22 「마을 만들어 달라 하면 다 비슷하다」 — 모델이 늘 seed 7 을 보냈고 기본값도 7 이었다)
    const args: Record<string, unknown> = normalized.args.seed === undefined ? { ...normalized.args, seed: defaultTownSeed(draft, normalized.args) } : normalized.args;
    if(typeof args.mapId==='string') clearBeodeulGroundDressing(draft,args.mapId);
    // 옛 고정 배치 작은 마을(늘 같은 세 집·같은 길·같은 우물)은 교회 예제(church:true)에만 남긴다 — houseCount 는 이제 theme 마을의 집 수 상한이다
    const legacySmall=args.houseCount!==undefined&&args.church===true&&(!args.theme||args.theme==='river')&&!args.form&&!args.terrain&&!args.roofs;
    const result=legacySmall?buildSmallBeodeulVillage(draft,args):buildTown(draft,args);
    const builtMapId = (result.data as { mapId?: string } | undefined)?.mapId;
    if (builtMapId && draft.startMapId === builtMapId) {
      const moved = keepStartWalkable(draft, builtMapId);
      if (moved) notes.push(moved);
    }
    if (notes.length) { result.warnings = [...notes, ...(result.warnings ?? [])]; result.summary = `${notes.join(' ')} ${result.summary}`; }
    const theme=String(args.theme??(args.harbour===true?'coast':'river'));
    const mapId=(result.data as {mapId?:string}|undefined)?.mapId;
    if(mapId&&legacySmall){
      const church=addBeodeulVillageChurch(draft,mapId);
      result.data={...(result.data as Record<string,unknown>),church,width:draft.maps[mapId]!.width};
      result.summary+=' 석조 교회와 마당을 연결했습니다.';
    }
    if(mapId&&['river','coast','city'].includes(theme)) {
      const dressing=dressBeodeulGround(draft,mapId,'living',Number(args.seed));
      result.data={...(result.data as Record<string,unknown>),groundDressing:dressing.data};
      result.summary+=` ${dressing.summary}`;
    }
    if(mapId&&legacySmall){
      const composition=naturalizeBeodeulHamlet(draft,mapId);
      result.data={...(result.data as Record<string,unknown>),composition:composition.data};result.summary+=` ${composition.summary}`;
      const light=harmonizeBeodeulDaylight(draft,mapId);
      result.data={...(result.data as Record<string,unknown>),daylight:light.data};result.summary+=` ${light.summary}`;
    }
    return result;
  },
};


/**
 * 거부 대신 의도대로 고쳐 짓는 인자 정리(2026-10-07 장르 시험, gpt-6.1-sol 등대지기 JRPG).
 * - houseCount 는 2026-10-22 부터 theme 마을의 집 수 상한이다(어느 theme·form 과도 같이 쓴다). 도시(city)에만 없어 뺀다.
 * - 새 프로젝트의 빈 시작 맵(20×15, 바닥 한 가지·이벤트 없음)에 지으라고 하면 「너무 작다」로 거부했다.
 *   비어 있는 버들항 맵이면 그 자리에서 필요한 크기로 넓혀 짓는다 — 시작 맵 id·시작 위치가 그대로 이어진다.
 */
function normalizeTownArgs(draft: Project, raw: Record<string, unknown>): { args: Record<string, unknown>; notes: string[] } {
  const notes: string[] = [];
  let args = raw;
  if (args.houseCount !== undefined && args.theme === "city") {
    const { houseCount: _houseCount, church: _church, ...rest } = args;
    args = rest;
    notes.push("houseCount 는 마을의 집 수라 도시(theme city)에서는 빼고 지었다.");
  }
  const map = typeof args.mapId === "string" ? draft.maps[args.mapId] : undefined;
  const small = args.houseCount !== undefined && args.church === true;
  const minW = small ? 40 : VILLAGE_MIN_W, minH = small ? 30 : VILLAGE_MIN_H;
  if (map && map.tilesetId === BEODEUL_TILESET_ID && (map.width < minW || map.height < minH) && isBlankMap(map)) {
    const theme = String(args.theme ?? (args.harbour === true ? "coast" : "river")) as BeodeulVillageTheme;
    const [defaultW, defaultH] = small ? [40, 30] : (BEODEUL_VILLAGE_THEMES as readonly string[]).includes(theme) ? villageDefaultSize(theme, args.houseCount) : [56, 44];
    const want = (value: unknown, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isInteger(value) ? value as number : fallback));
    const width = want(args.width, defaultW, minW, small ? 48 : VILLAGE_MAX_W), height = want(args.height, defaultH, minH, small ? 38 : VILLAGE_MAX_H);
    const before = `${map.width}×${map.height}`;
    requireTool(MAP_TOOLS, "resize_map").run(draft, { mapId: map.id, width, height });
    notes.push(`빈 맵 ${map.id}(${before})을 ${width}×${height} 로 넓혀 그 자리에 지었다.`);
  }
  // 빈 시작 맵 위에 지으면 그 맵이 곧 이 마을이다 — 이름(「빈 맵」 그대로였다)과 마을 BGM(없었다)을 새 맵처럼 준다(2026-10-25 조수 단독 게임 시험 G1·G2).
  if (map && isBlankMap(map)) {
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "버들 마을";
    if (/^(빈 맵|새 맵|맵\s*\d*|map\s*\d*|untitled)$/iu.test(map.name.trim()) || !map.name.trim()) { map.name = name; notes.push(`맵 이름을 「${name}」 로 바꿨다.`); }
    if (!map.bgm || (map.bgm.mode === "custom" && !map.bgm.resourceId)) {
      try { const bgm = assignCreatedMapBgm(map, {}, { themeOrName: `${name} 마을 town village peaceful`, fallbackTheme: "town", draft }); notes.push(`마을 BGM ${bgm}.`); } catch { /* 곡이 없으면 그대로 */ }
    }
  }
  return { args, notes };
}


/** 시작 맵 위에 지었으면 시작 위치가 집·물에 묻힐 수 있다 — 가장 가까운 통행 칸으로 옮긴다(커밋 무결성 검사가 거부한다). */
function keepStartWalkable(draft: Project, mapId: string): string | null {
  const map = draft.maps[mapId];
  const start = draft.startPos;
  if (!map || !start) return null;
  if (start.x < map.width && start.y < map.height && isPassable(draft, map, start.x, start.y)) return null;
  for (let r = 1; r < Math.max(map.width, map.height); r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = start.x + dx, y = start.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || !isPassable(draft, map, x, y)) continue;
      draft.startPos = { ...start, x, y };
      return `시작 위치 (${start.x},${start.y}) 가 시공으로 막혀 가장 가까운 통행 칸 (${x},${y}) 로 옮겼다.`;
    }
  }
  return null;
}

/** 바닥 한 가지만 깔리고 위층·이벤트·구조물이 없는 맵. */
function isBlankMap(map: GameMap): boolean {
  if (map.events.length > 0 || (map.structurePlacements?.length ?? 0) > 0) return false;
  const first = map.lowerTiles[0];
  if (!map.lowerTiles.every((tile) => tile === first)) return false;
  return [map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles].every((layer) => !layer || layer.every((tile) => tile < 0));
}

function requireTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`필수 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

function intArg(args: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new ToolError(`${key}는 정수여야 합니다.`, { code: "invalid-args" });
  return Math.max(min, Math.min(max, value));
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
}

/** 축 하나를 조각(폭/높이)과 사이 길로 나눈다. 위치는 0 기준 상대값. 조각이 avenueMin 개 이상이면 가운데 사이 길을 4칸 대로로 넓힌다
 * (대로 때문에 조각이 줄어 땅을 더 못 쓰면 대로 없이 나눈 쪽을 고른다). */
function planAxis(total: number, pick: (i: number, room: number) => number | null, trailingGap: boolean, avenueMin: number): Seg[] {
  const layout = (avenue: number): Seg[] => {
    const segs: Seg[] = [];
    let pos = 0;
    for (let i = 0; ; i += 1) {
      const room = total - pos - (trailingGap ? 2 : 0);
      const size = pick(i, room);
      if (size === null || size > room) break;
      const gap = i === avenue ? 4 : 2;
      segs.push({ start: pos, size, gapAfter: gap });
      pos += size + gap;
    }
    return segs;
  };
  const extent = (segs: Seg[]): number => (segs.length ? segs[segs.length - 1]!.start + segs[segs.length - 1]!.size : 0);
  const plain = layout(-1);
  if (plain.length < avenueMin) return plain;
  let avenue = Math.floor(plain.length / 2) - 1;
  let withAvenue = layout(avenue);
  for (let pass = 0; pass < 3; pass += 1) {
    const next = withAvenue.length >= avenueMin ? Math.floor(withAvenue.length / 2) - 1 : -1;
    if (next === avenue) break;
    avenue = next;
    withAvenue = layout(avenue);
  }
  if (avenue < 0 || withAvenue.length < avenueMin) return plain;
  return extent(withAvenue) >= extent(plain) - 2 ? withAvenue : plain;
}

function kitsOf(tileset: any): Map<string, { w: number; h: number; kit: any }> {
  const out = new Map<string, { w: number; h: number; kit: any }>();
  for (const kit of (tileset?.structureKits ?? []) as any[]) out.set(kit.id, { w: kit.width, h: kit.height, kit });
  return out;
}

function parseBlocks(tileset: any): BlockKit[] {
  const out: BlockKit[] = [];
  for (const kit of (tileset?.structureKits ?? []) as any[]) {
    const m = /^bd-block-([a-z]+)-(\d+)x(\d+)(?:-[bc])?$/.exec(kit.id);
    if (m) out.push({ id: kit.id, kind: m[1]!, w: Number(m[2]), h: Number(m[3]) });
  }
  return out;
}

function buildTown(draft: Project, args: Record<string, unknown>): ToolExecResult {
  const themeArg = typeof args.theme === "string" ? args.theme.trim() : "";
  if (themeArg && themeArg !== "city" && !(BEODEUL_VILLAGE_THEMES as readonly string[]).includes(themeArg)) {
    throw new ToolError(`theme 은 ${[...BEODEUL_VILLAGE_THEMES, "city"].join("|")} 중 하나다(받은 값: ${themeArg}).`, { code: "invalid-args" });
  }
  if (themeArg !== "city") return buildVillage(draft, args, (themeArg || (args.harbour === true ? "coast" : "river")) as BeodeulVillageTheme);
  const seed = intArg(args, "seed", 7, 0, 2 ** 31 - 1);
  const rand = rng(seed * 2654435761 + 12345);
  const warnings: string[] = [];
  const wantHarbour = args.harbour === true;
  let mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
  const creating = !mapId;

  // 1. 크기
  let W: number, H: number;
  if (creating) {
    W = intArg(args, "width", DEFAULT_W, MIN_W, MAX_TOOL_MAP_DIMENSION);
    H = intArg(args, "height", DEFAULT_H, MIN_H, MAX_TOOL_MAP_DIMENSION);
  } else {
    const existing = draft.maps[mapId];
    if (!existing) throw new ToolError(`맵이 없습니다: ${mapId}`, { code: "map-not-found", mapId });
    W = existing.width;
    H = existing.height;
  }
  let harbour = false;
  if (wantHarbour) {
    if (W >= HARBOUR_W && H >= HARBOUR_H + MIN_H) harbour = true;
    else warnings.push(`항구 호수는 가로 ${HARBOUR_W} 이상·세로 ${HARBOUR_H + MIN_H} 이상에서만 붙는다. 이번에는 생략했다.`);
  }

  const tileset: any = draft.tilesets[BEODEUL_TILESET_ID];
  if (!tileset) throw new ToolError("이 프로젝트에는 버들항 타일셋(beodeul_city)이 없다.", { code: "beodeul-tileset-missing" });
  const kits = kitsOf(tileset);
  const blocks = parseBlocks(tileset);
  if (!blocks.length) throw new ToolError("버들항 블록 키트(bd-block-*)를 찾을 수 없다.", { code: "beodeul-kits-missing" });
  const blockSizes = new Set(blocks.map((b) => `${b.w}x${b.h}`));

  // 2. 계획: 열(가로)과 띠(세로)
  const colPlanWidth = W;
  const cols = planAxis(colPlanWidth - 2, (i, room) => {
    for (const w of [i % 3 === 2 ? 14 : 20, 20, 14]) if (w <= room && COL_WIDTHS.includes(w as 20 | 14)) return w;
    return null;
  }, false, 3).map((s) => ({ ...s, start: s.start + 2 }));
  if (!cols.length) throw new ToolError(`가로 ${W}칸에는 블록(14칸 이상)이 들어가지 않는다. 16칸 이상으로 만들 것.`, { code: "town-too-small" });
  const planH = harbour ? H - HARBOUR_H : H;
  const useChurch = planH >= 40 && cols.length >= 2;
  const bands: { y: number; h: number; gapAfter: number; church: boolean }[] = [];
  {
    const heightCycle = [13, 13, 8];
    const segs = planAxis(planH, (i, room) => {
      if (i === 0 && useChurch) return 17;
      const k = useChurch ? i - 1 : i;
      const h = heightCycle[k % heightCycle.length]!;
      if (h <= room) return h;
      return room >= 8 ? 8 : null;
    }, true, 4);
    segs.forEach((s, i) => bands.push({ y: s.start, h: s.size, gapAfter: s.gapAfter, church: useChurch && i === 0 }));
  }
  if (!bands.length) throw new ToolError(`세로 ${H}칸에는 블록 띠(8칸+길 2칸)가 들어가지 않는다. ${MIN_H}칸 이상으로 만들 것.`, { code: "town-too-small" });
  const lastCol = cols[cols.length - 1]!;
  const planW = lastCol.start + lastCol.size;
  const lastBand = bands[bands.length - 1]!;
  const planBottom = lastBand.y + lastBand.h + lastBand.gapAfter;
  if (creating) {
    W = planW;
    H = planBottom + (harbour ? HARBOUR_H : 0);
  }

  // 3. 맵
  if (creating) {
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "버들 마을";
    mapId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : uniqueId(draft, "map_beodeul", `${seed}_${W}x${H}`);
    assertMapIdAvailable(draft, mapId);
    createMapTool.run(draft, { id: mapId, name, width: W, height: H, tilesetId: BEODEUL_TILESET_ID, border: "none" });
  } else {
    const existing = draft.maps[mapId]!;
    if (existing.tilesetId !== BEODEUL_TILESET_ID && !kitsOf(draft.tilesets[existing.tilesetId]).has("bd-block-res-20x13")) {
      throw new ToolError(
        `맵 ${mapId} 는 버들항 타일셋이 아니다(${existing.tilesetId}). author_beodeul_town 은 버들항 맵에서만 쓴다. ` +
          "버들항으로 바꾸려면 사용자에게 칩셋 변경(ask_tileset_change)을 먼저 물어라.",
        { code: "beodeul-tileset-required", mapId },
      );
    }
  }
  const map = (): GameMap => draft.maps[mapId]!;
  const fill = (rect: Rect, material: string, clearUpper?: boolean): boolean => {
    try {
      fillRegionTool.run(draft, { mapId, rect, material, ...(clearUpper !== undefined ? { clearUpper } : {}) });
      return true;
    } catch {
      return false;
    }
  };
  const stamp = (kitId: string, x: number, y: number): boolean => {
    try {
      stampObjectTool.run(draft, { objectId: `kit:${BEODEUL_TILESET_ID}/${kitId}`, mapId, x, y });
      return true;
    } catch {
      return false;
    }
  };
  fill({ x: 0, y: 0, w: W, h: H }, GRASS, true);

  // 열린 풀밭 판정
  const lawn = new Set<number>();
  for (const g of (tileset.tileGroups ?? []) as any[]) if (g.id === "beodeul:grass") for (const t of g.tileIds) lawn.add(t);
  for (const [id, k] of kits) if (/^bd-ground-lawn-/.test(id)) for (const r of k.kit.rows) for (const t of r.tiles) if (t >= 0) lawn.add(t);
  const freeFor = (kitId: string, x: number, y: number, margin = 0): boolean => {
    const k = kits.get(kitId);
    if (!k) return false;
    const m = map();
    for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) {
      const r = k.kit.rows[j];
      const lo = r.tiles[i], up = r.upperTiles?.[i] ?? -1;
      if (lo < 0 && up < 0) continue;
      for (let dy = -margin; dy <= margin; dy += 1) for (let dx = -margin; dx <= margin; dx += 1) {
        const cx = x + i + dx, cy = y + j + dy;
        if (cx < 0 || cy < 0 || cx >= m.width || cy >= m.height) { if (dx === 0 && dy === 0) return false; continue; }
        const idx = cy * m.width + cx;
        if (m.upperTiles[idx]! >= 0 || !lawn.has(m.lowerTiles[idx]!)) return false;
      }
    }
    return true;
  };
  const dense = (rect: Rect, ids: string[], count: number, avoid: (x: number, y: number) => boolean = () => false): number => {
    const usable = ids.filter((id) => kits.has(id));
    if (!usable.length || rect.w < 1 || rect.h < 1) return 0;
    let placed = 0;
    for (let n = 0; n < count * 20 && placed < count; n += 1) {
      const id = usable[Math.floor(rand() * usable.length)]!;
      const k = kits.get(id)!;
      if (k.w > rect.w || k.h > rect.h) continue;
      const x = rect.x + Math.floor(rand() * (rect.w - k.w + 1)), y = rect.y + Math.floor(rand() * (rect.h - k.h + 1));
      let bad = false;
      for (let j = 0; j < k.h && !bad; j += 1) for (let i = 0; i < k.w; i += 1) if (avoid(x + i, y + j)) { bad = true; break; }
      if (bad || !freeFor(id, x, y) || !stamp(id, x, y)) continue;
      placed += 1;
    }
    return placed;
  };
  const onPath = (x: number, y: number): boolean => !lawn.has(map().lowerTiles[y * map().width + x]!);
  const PARK_TREES = ["bd-tree-03a8f7", "bd-tree-a80c85", "bd-tree-e9d9b3", "bd-tree-cc0fcb", "bd-tree-47e17a"];
  const PARK_PROPS = ["bd-prop-flowerbed", "bd-prop-bench_wood", "bd-prop-planter_round", "bd-tree-eef4bc"];
  const plant = (rect: Rect, thick = 1): void => {
    if (rect.w < 1 || rect.h < 1) return;
    const area = rect.w * rect.h;
    dense(rect, PARK_TREES, Math.round((area / 14) * thick), onPath);
    dense(rect, PARK_PROPS, Math.round((area / 12) * thick), onPath);
  };

  // 4. 길 격자를 먼저 깐다
  const bottom = planBottom;
  fill({ x: 0, y: 0, w: 2, h: bottom }, PAVING);
  cols.slice(0, -1).forEach((c) => fill({ x: c.start + c.size, y: 0, w: c.gapAfter, h: bottom }, PAVING));
  bands.forEach((b) => fill({ x: 0, y: b.y + b.h, w: planW, h: b.gapAfter }, PAVING));
  const churchBand = bands[0]!.church ? bands[0]! : null;
  if (churchBand) {
    const c0 = cols[0]!;
    const ax = c0.start + c0.size;
    if (planW - ax > 0) fill({ x: ax, y: churchBand.y + 8, w: planW - ax, h: 1 }, PAVING);
  }
  if (harbour) stamp("bd-harbour-lake", 0, bottom);

  // 5. 블록 고르기 + 찍기
  const placed: PlacedBlock[] = [];
  const uses: Record<string, number> = {};
  const conflicts = (id: string, x: number, y: number, w: number, h: number): boolean =>
    placed.some((p) => {
      if (p.id !== id) return false;
      const gx = Math.max(x - (p.x + p.w), p.x - (x + w)), gy = Math.max(y - (p.y + p.h), p.y - (y + h));
      return (gx < 0 && gy <= 20) || (gy < 0 && gx <= 20);
    });
  const rolePrefs = (bandIdx: number, colIdx: number, bandH: number): string[] => {
    const lastB = bandIdx === bands.length - 1 && bands.length >= 3;
    if (lastB) return ["port", "out", "market", "res", "shop"];
    const midB = bandIdx === Math.floor((bands.length - 1) / 2), midC = colIdx === Math.floor(cols.length / 2);
    if (midB && midC) return ["market", "manor", "shop", "res"];
    const base = bandH === 13 ? ["res", "shop", "manor", "res", "market", "out"] : ["res", "shop", "res", "market", "out"];
    const off = Math.floor(rand() * base.length);
    return [...base.slice(off), ...base.slice(0, off)];
  };
  const placeBlock = (x: number, y: number, w: number, h: number, prefs: string[], allowKinds?: string[]): PlacedBlock | null => {
    const pool = blocks.filter((b) => b.w === w && b.h === h && b.kind !== "church" && (allowKinds ? allowKinds.includes(b.kind) : b.kind !== "port" || prefs.includes("port")));
    if (!pool.length) return null;
    const scored = pool.map((b) => {
      const rank = prefs.indexOf(b.kind);
      return { b, score: (rank < 0 ? 9 : rank) + rand() * 1.6 + (uses[b.id] ?? 0) * 4 + (conflicts(b.id, x, y, w, h) ? 50 : 0) };
    }).sort((a, z) => a.score - z.score);
    for (const { b } of scored) {
      if (!stamp(b.id, x, y)) continue;
      const p = { id: b.id, x, y, w, h };
      placed.push(p);
      uses[b.id] = (uses[b.id] ?? 0) + 1;
      return p;
    }
    return null;
  };
  // 공원 칸: 오른쪽 끝 열, 아래에서 두 번째 띠(3열·3띠 이상일 때)
  const parkBand = bands.length >= 3 ? bands.length - 2 : -1;
  const parkCol = cols.length >= 3 ? cols.length - 1 : -1;
  const leftovers: Rect[] = [];
  bands.forEach((band, bi) => {
    cols.forEach((col, ci) => {
      if (band.church) {
        if (ci === 0) {
          const id = [`bd-block-church-${col.size}x17`].find((k) => kits.has(k));
          if (id && stamp(id, col.start, band.y)) { placed.push({ id, x: col.start, y: band.y, w: col.size, h: 17 }); uses[id] = (uses[id] ?? 0) + 1; } else leftovers.push({ x: col.start, y: band.y, w: col.size, h: 17 });
          return;
        }
        const a = placeBlock(col.start, band.y, col.size, 8, rolePrefs(bi, ci, 8), ["res", "shop", "market", "out"]);
        const b = placeBlock(col.start, band.y + 9, col.size, 8, rolePrefs(bi, ci, 8), ["res", "shop", "market", "out"]);
        if (!a) leftovers.push({ x: col.start, y: band.y, w: col.size, h: 8 });
        if (!b) leftovers.push({ x: col.start, y: band.y + 9, w: col.size, h: 8 });
        return;
      }
      if (bi === parkBand && ci === parkCol) { leftovers.push({ x: col.start, y: band.y, w: col.size, h: band.h }); return; }
      if (!blockSizes.has(`${col.size}x${band.h}`)) { leftovers.push({ x: col.start, y: band.y, w: col.size, h: band.h }); return; }
      if (!placeBlock(col.start, band.y, col.size, band.h, rolePrefs(bi, ci, band.h))) leftovers.push({ x: col.start, y: band.y, w: col.size, h: band.h });
    });
  });

  // 6. 골목 끝 잇기: 13칸 깊이 주택/상점/외곽 블록의 뒷골목이 길과 만나는 칸(바깥 한 칸씩)만 다시 포석으로
  // (길 전체를 다시 채우면 fill_region 이 블록 테두리의 한 칸 틈을 메워 길이 블록을 문다)
  for (const p of placed) {
    if (p.h !== 13 || !/^bd-block-(res|shop|out)-/.test(p.id)) continue;
    const y = p.y + 6;
    if (p.x - 1 >= 0) fill({ x: p.x - 1, y, w: 1, h: 1 }, PAVING);
    if (p.x + p.w < planW) fill({ x: p.x + p.w, y, w: 1, h: 1 }, PAVING);
  }

  // 7. 공원(대각 산책로) · 남는 땅 심기
  for (const r of leftovers) {
    const isPark = r.w >= 10 && r.h >= 8 && r.h <= 13;
    if (isPark) {
      for (let t = 0; t < r.h; t += 1) fill({ x: r.x + Math.round((t * (r.w - 3)) / Math.max(1, r.h - 1)), y: r.y + t, w: 3, h: 1 }, PAVING);
    }
    plant(r);
  }
  if (planW < W) plant({ x: planW, y: 0, w: W - planW, h: bottom });
  if (bottom < (harbour ? H - HARBOUR_H : H)) plant({ x: 0, y: bottom, w: W, h: (harbour ? H - HARBOUR_H : H) - bottom });
  if (harbour && W > HARBOUR_W) plant({ x: HARBOUR_W, y: bottom, w: W - HARBOUR_W, h: HARBOUR_H }, 2.2);

  // 8. 대로 가로수·가로등(문이나 골목이 열리지 않는 가장자리 줄)
  const crossX = new Set<number>();
  for (const x of [0, 1]) crossX.add(x);
  cols.slice(0, -1).forEach((c) => { for (let i = -1; i <= c.gapAfter; i += 1) crossX.add(c.start + c.size + i); });
  crossX.add(-1); crossX.add(2);
  const crossY = new Set<number>();
  for (const b of bands) {
    for (let i = -1; i <= b.gapAfter; i += 1) crossY.add(b.y + b.h + i);
    if (b.church) for (const y of [b.y + 7, b.y + 8, b.y + 9]) crossY.add(y);
    else if (b.h === 13) for (const y of [b.y + 5, b.y + 6, b.y + 7]) crossY.add(y);
  }
  const avenueCol = cols.findIndex((c) => c.gapAfter === 4);
  if (avenueCol >= 0) {
    const c = cols[avenueCol]!;
    const ax = c.start + c.size + 3;
    let n = 0;
    for (let y = 10; y + 2 < bottom; y += 4) {
      if ([y, y + 1, y + 2].some((v) => crossY.has(v))) continue;
      stamp(n++ % 2 ? "bd-tree-28ad5e" : "bd-prop-lamp_crook", ax, y);
    }
  }
  const avenueBand = bands.findIndex((b) => b.gapAfter === 4);
  if (avenueBand >= 0) {
    const b = bands[avenueBand]!;
    const ay = b.y + b.h + 1;
    let n = 0;
    for (let x = 4; x < planW - 1; x += 5) {
      if (crossX.has(x)) continue;
      stamp(n++ % 2 ? "bd-tree-eef4bc" : "bd-prop-lamp_crook", x, ay);
    }
  }

  const kindCount: Record<string, number> = {};
  for (const p of placed) { const k = /^bd-block-([a-z]+)-/.exec(p.id)?.[1] ?? "?"; kindCount[k] = (kindCount[k] ?? 0) + 1; }
  const planCols = cols.map((c) => c.size).join("+");
  const planBands = bands.map((b) => b.h).join("+");
  return {
    summary: `버들항 마을 ${W}×${H} (맵 ${mapId}): 블록 ${placed.length}개(${Object.entries(kindCount).map(([k, n]) => `${k} ${n}`).join(", ")}), 열 ${planCols}, 띠 ${planBands}${harbour ? ", 항구 호수 포함" : ""}. ` +
      "다음: check_city_form 과 check_reachability 로 길·문 앞 통행을 점검하고, 이름·NPC·이벤트는 그 뒤에 올린다.",
    data: {
      mapId, width: W, height: H, seed, tilesetId: BEODEUL_TILESET_ID,
      blocks: placed.map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h })),
      columns: cols.map((c) => ({ x: c.start, w: c.size })),
      bands: bands.map((b) => ({ y: b.y, h: b.h })),
      parks: leftovers.length,
      ...(harbour ? { harbour: { id: "bd-harbour-lake", x: 0, y: bottom } } : {}),
    },
    warnings: warnings.length ? warnings : undefined,
  };
}

const VILLAGE_MIN_W = 36, VILLAGE_MIN_H = 30, VILLAGE_MAX_W = 96, VILLAGE_MAX_H = 80;
/** 성벽 마을: walls:true, 또는 walls 를 보내지 않고 맵 이름이 성벽·성곽·성문·요새를 말할 때(모델이 walls 를 빠뜨려도 성벽이 선다). river·desert·snow 만. */
const WALL_THEMES: readonly BeodeulVillageTheme[] = ["river", "desert", "snow"];
function wallsWanted(args: Record<string, unknown>, theme: BeodeulVillageTheme): boolean {
  const asked = args.walls === true || (args.walls === undefined && /성벽|성곽|성문|요새|walled|rampart/i.test(`${args.name ?? ""}`));
  return asked && WALL_THEMES.includes(theme);
}

function buildVillage(draft: Project, args: Record<string, unknown>, theme: BeodeulVillageTheme): ToolExecResult {
  const seed = intArg(args, "seed", 7, 0, 2 ** 31 - 1);
  const hc = Number(args.houseCount);
  const houseCount = args.houseCount === undefined || !Number.isFinite(hc) ? undefined : Math.max(3, Math.min(5, Math.round(hc)));
  const tileset: any = draft.tilesets[BEODEUL_TILESET_ID];
  if (!tileset) throw new ToolError("이 프로젝트에는 버들항 타일셋(beodeul_city)이 없다.", { code: "beodeul-tileset-missing" });
  let mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
  const [dw0, dh0] = villageDefaultSize(theme, houseCount);
  // 성벽 띠(바깥 3줄 + 성벽·앞면 + 망루 지붕)가 가장자리를 먹으므로 기본 크기를 조금 키운다
  const [dw, dh] = wallsWanted(args, theme) ? [dw0 + 4, dh0 + 11] : [dw0, dh0]; // 3판 성벽 띠: 좌우 세 열씩, 위 아홉 줄·아래 아홉 줄(앞면 네 줄)
  if (!mapId) {
    const W = intArg(args, "width", dw, VILLAGE_MIN_W, VILLAGE_MAX_W);
    // highland(산골)는 큰길 위로 비탈 세 단이 서야 하므로 높이 46 이상
    const H = Math.max(args.terrain === "highland" ? Math.min(46, VILLAGE_MAX_H) : 0, intArg(args, "height", dh, VILLAGE_MIN_H, VILLAGE_MAX_H));
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "버들 마을";
    mapId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : uniqueId(draft, "map_beodeul", `${theme}_${seed}`);
    assertMapIdAvailable(draft, mapId);
    createMapTool.run(draft, { id: mapId, name, width: W, height: H, tilesetId: BEODEUL_TILESET_ID, border: "none" });
  } else {
    const existing = draft.maps[mapId];
    if (!existing) throw new ToolError(`맵이 없습니다: ${mapId}`, { code: "map-not-found", mapId });
    if (existing.tilesetId !== BEODEUL_TILESET_ID) {
      throw new ToolError(
        `맵 ${mapId} 는 버들항 타일셋이 아니다(${existing.tilesetId}). author_beodeul_town 은 버들항 맵에서만 쓴다. 버들항으로 바꾸려면 사용자에게 칩셋 변경을 먼저 물어라.`,
        { code: "beodeul-tileset-required", mapId },
      );
    }
    if (existing.width < VILLAGE_MIN_W || existing.height < VILLAGE_MIN_H) {
      throw new ToolError(`마을 문법은 ${VILLAGE_MIN_W}×${VILLAGE_MIN_H} 이상 맵에서 짓는다(지금 ${existing.width}×${existing.height}). mapId 없이 새 맵을 만들 것.`, { code: "town-too-small", mapId });
    }
    existing.structurePlacements = [];
  }
  const form = typeof args.form === "string" && args.form.trim() ? args.form.trim() : undefined;
  const terrain = typeof args.terrain === "string" && args.terrain.trim() ? args.terrain.trim() : undefined;
  const rebuilt = !!(typeof args.mapId === "string" && args.mapId.trim());
  let forestType: BeodeulForestType;
  try { forestType = parseBeodeulForestType(args.forestType); } catch (e) { throw new ToolError((e as Error).message, { code: "invalid-args", mapId }); }
  const roofs = typeof args.roofs === "string" && args.roofs.trim() ? args.roofs.trim() : undefined;
  const water = typeof args.water === "string" && args.water.trim() ? args.water.trim() : undefined;
  const woods = typeof args.woods === "string" && args.woods.trim() ? args.woods.trim() : undefined;
  // 성벽 마을: 평지, 강가는 강 없이(물가 띠 형태는 길가로) — 강·바다·단이 성벽 둘레를 뚫지 않게
  const walls = wallsWanted(args, theme);
  const wallNotes: string[] = [];
  let wallForm = form, wallTerrain = terrain, wallWater = water;
  if (walls) {
    if (theme === "river" && water === "river") wallNotes.push("성벽 마을이라 강 없이(water none) 지었다 — 강이 성벽을 지나는 수문 그림은 없다.");
    if (theme === "river") wallWater = "none";
    if (form === "riverbank") { wallForm = "street"; wallNotes.push("성벽 마을이라 물가 띠(riverbank) 대신 길가 마을(street)로 지었다."); }
    // form 을 생략해 seed 가 물가 띠를 고르면 강이 늘 붙어(물가 띠 = 강) 성벽을 뚫었다 — 성벽 마을은 seed 가 고른 물가 띠도 길가로
    else if (!form && resolveVillageForm(theme, seed) === "riverbank") wallForm = "street";
    if (terrain && terrain !== "flat") { wallTerrain = "flat"; wallNotes.push(`성벽 마을이라 지형 ${terrain} 대신 평지로 지었다.`); }
    else wallTerrain = "flat";
  } else if (args.walls === true) wallNotes.push(`성벽은 강가·사막·설원 마을(theme river·desert·snow)만 두른다 — ${theme} 마을은 성벽 없이 지었다.`);
  const build = () => buildBeodeulVillage(draft, mapId, theme, seed, wallForm, wallTerrain, forestType, { roofs, water: wallWater, woods, houseLimit: houseCount, walls, ...(typeof args.quarter === "string" && beodeulYardReserve(args.quarter) ? { yard: beodeulYardReserve(args.quarter) } : {}),
    ...(args.wallGate === "N" || args.wallGate === "NS" || args.wallGate === "S" ? { wallGate: args.wallGate } : {}), ...(args.wallSideGaps === true ? { wallSideGaps: true } : {}) });
  let r = build();
  // 성벽 띠가 가장자리를 먹어 요청한 집 수가 다 앉지 않는다(2026-10-22 조수 시험 r3: 5채 요청 → 44×32 에서 2채, 조수가 52×38 로 다시 지어 3채).
  // 이번 호출이 새로 만든 성벽 마을이면 맵을 넓혀 두 번까지 다시 짓고, 집이 가장 많이 앉은 크기를 남긴다(같은 seed 라 같은 크기는 같은 마을).
  const housesOf = (x: typeof r) => Number((x.data as { houses?: number }).houses ?? 0);
  const grown: string[] = [];
  if (walls && houseCount !== undefined && !rebuilt && housesOf(r) < houseCount) {
    const name = draft.maps[mapId]!.name;
    const rebuildAt = (w: number, h: number) => {
      requireTool(MAP_TOOLS, "remove_map").run(draft, { mapId });
      createMapTool.run(draft, { id: mapId, name, width: w, height: h, tilesetId: BEODEUL_TILESET_ID, border: "none" });
      return build();
    };
    const tried: { w: number; h: number; houses: number }[] = [{ w: draft.maps[mapId]!.width, h: draft.maps[mapId]!.height, houses: housesOf(r) }];
    for (let step = 0; step < 2 && housesOf(r) < houseCount; step += 1) {
      const last = tried[tried.length - 1]!;
      const w = Math.min(VILLAGE_MAX_W, last.w + 8), h = Math.min(VILLAGE_MAX_H, last.h + 6);
      if (w === last.w && h === last.h) break;
      r = rebuildAt(w, h);
      tried.push({ w, h, houses: housesOf(r) });
    }
    const best = tried.reduce((a, b) => (b.houses > a.houses ? b : a));
    const now = tried[tried.length - 1]!;
    if (best !== now) r = rebuildAt(best.w, best.h);
    if (tried.length > 1) grown.push(`성벽 띠 때문에 ${tried[0]!.w}×${tried[0]!.h} 에는 집이 ${tried[0]!.houses}채만 앉아 ${best.w}×${best.h} 로 넓혀 다시 지었다(집 ${best.houses}채).`);
  }
  // 요청한 집 수에 못 미치면 요약 맨 앞에 적는다 — 경고에만 두면 「요청대로 지었다」고 보고하기 쉽다
  if (houseCount !== undefined && housesOf(r) < houseCount) grown.push(`집 ${houseCount}채를 요청했지만 ${housesOf(r)}채만 앉았다(${walls ? "성벽 안 " : ""}자리 부족 — 맵을 넓혀 다시 짓거나 그대로 보고할 것).`);
  if (grown.length) r = { ...r, summary: `${grown.join(" ")} ${r.summary}`, warnings: [...grown, ...r.warnings] };
  // 지형 도입(2026-10-11)으로 같은 seed 도 배치가 달라졌다 — 예전 마을 맵을 가진 사용자·조수가 알 수 있게 결과에도 짧게
  const note = rebuilt
    ? " 같은 mapId 로 다시 지어 맵 전체를 새로 깔았다(손으로 고친 부분은 사라졌다)."
    : " 2026-10-11 지형 도입 이후 같은 seed 도 예전과 다른 배치다 — 기존 마을 맵에 지형을 넣으려면 다시 지어야 한다(맵 전체를 다시 깐다 — 손으로 고친 부분은 사라진다. 마을 집이 선 맵은 완성된 집 보호로 덮어 짓기가 거절되니 remove_map 후 같은 id 로).";
  const wallNote = wallNotes.length ? ` ${wallNotes.join(" ")}` : "";
  const warnings = [...wallNotes, ...r.warnings];
  return { summary: r.summary + note + wallNote, data: r.data, warnings: warnings.length ? warnings : undefined };
}

function uniqueId(draft: Project, prefix: string, body: string): string {
  const cleanBody = body.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "1";
  let id = `${prefix}_${cleanBody}`;
  let suffix = 2;
  const eventIds = new Set(Object.values(draft.maps).flatMap((m) => m.events.map((e) => e.id)));
  while (draft.maps[id] || eventIds.has(id)) {
    id = `${prefix}_${cleanBody}_${suffix}`;
    suffix += 1;
  }
  return id;
}

/** 작은 마을(집 3~5채)은 40×32 안팎 — 집 수가 많을수록 조금 넓게. 그 밖은 theme 기본 크기. */
function villageDefaultSize(theme: BeodeulVillageTheme, houseCount: unknown): [number, number] {
  if (typeof houseCount !== "number") return themeDefaultSize(theme);
  return houseCount <= 3 ? [40, 32] : houseCount === 4 ? [42, 34] : [44, 36];
}

/**
 * seed 를 생략했을 때의 값 — 같은 프로젝트·같은 상태면 같은 값(도구를 다시 돌려도 같은 마을), 프로젝트가 다르거나 맵이 늘면 다른 값.
 * 새 프로젝트도 시스템 설정의 오프닝 장면 id(무작위)가 달라 서로 다른 값이 나온다.
 */
function defaultTownSeed(draft: Project, args: Record<string, unknown>): number {
  const parts = [
    JSON.stringify((draft as { system?: unknown }).system ?? null),
    draft.meta?.title ?? "",
    Object.keys(draft.maps).sort().join(","),
    String(args.name ?? ""), String(args.id ?? ""), String(args.mapId ?? ""), String(args.theme ?? ""),
  ].join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < parts.length; i += 1) { h ^= parts.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h % 100000;
}
