/**
 * 세계 지도(월드맵 키트) 지형 편집 — 조수가 대륙·바다·섬·산줄기·강·숲·바닥 종류까지 바꾼다(2026-10-03).
 *
 * 지형은 키트의 공용 지형(96×72칸) 위에 「작업(ops)」을 차례로 얹어 만든다. 작업은 칸 좌표 다각형·꺾은선이고,
 * 키트가 같은 노이즈 왜곡으로 그려 손으로 만든 지형과 결이 같다. 빌드는 호스트의 Python 키트가 한다
 * (src/editor/worldmap/worldmapBuild.ts). 결과 지도는 `worldmap_<mapId>` 타일셋(지도 그림을 칸마다 한 타일)과
 * 키트의 걷기 표로 통행을 갖는 맵이 된다. 장소는 맵의 이름 붙은 로케이션으로 들어간다.
 *
 * 작업 문법·검사의 정본: tiledata/worldmap-kit/kit/lib/kit_terrain.py (이 파일의 스키마는 그 거울).
 */
import { mapCharacterSizeFactor } from "@/project/characterScale";
import type { GameMap, MapId, MapNamedLocation, PassFlag, Project, TilesetDef, TilesetId } from "@/project/types";
import {
  buildWorldmap, WORLDMAP_BASES, WORLDMAP_GROUNDS, WORLDMAP_OPS, WORLDMAP_REGIONS, WORLDMAP_STYLES,
  type WorldmapBase, type WorldmapBuildRequest, type WorldmapBuildResult,
} from "@/editor/worldmap/worldmapBuild";
import { PLACE_REFERENCES } from "@/project/regionReferences";
import themeCatalog from "@/assets/worldmapThemeCatalog.json";
import { WORLDMAP_SELECTED_ICONS, WORLDMAP_SELECTED_ID } from "@/project/defaults/worldmapSelected";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

export const WORLDMAP_THEMES = [
  "fantasy", "fantasy-dungeons", "monster", "joseon", "sengoku", "wuxia", "classical", "desert-east", "dark-gothic", "snow-north",
  "sea-isles", "prehistoric", "alien", "steampunk", "modern-town", "modern-sf", "starmap",
] as const;
const TILE = 16;
const OPEN: PassFlag = { up: true, down: true, left: true, right: true };
const CLOSED: PassFlag = { up: false, down: false, left: false, right: false };

const point: JsonSchema = { type: "array", items: { type: "number" } };
const opSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["op"],
  properties: {
    op: { type: "string", enum: [...WORLDMAP_OPS] },
    poly: { type: "array", items: point, description: "land·sea·biome·forest·clear·plateau·dune_sea: 꼭짓점 [[x,y],...] (칸 좌표)" },
    line: { type: "array", items: point, description: "ridge·river·wall: 꺾은선 [[x,y],...]. 강은 바다에서 끝낸다. wall 은 시작 대륙을 해안에서 해안까지 가른다" },
    lava: { type: "array", items: point, description: "volcano: 용암 줄기 꺾은선(선택)" },
    x: { type: "number", description: "island·pass·volcano 중심 · move_place·sky_island 새 왼쪽 위 칸" },
    y: { type: "number" },
    rx: { type: "number", description: "island 가로 반지름(칸)" },
    ry: { type: "number", description: "island 세로 반지름(칸)" },
    r: { type: "number", description: "pass 반지름(기본 1.5)" },
    ground: { type: "string", enum: [...WORLDMAP_GROUNDS], description: "land·island·biome·plateau 바닥" },
    kind: { type: "string", enum: ["mount", "small", "mesa", "broad", "conifer", "snow", "jungle", "dead"], description: "ridge: mount|small|mesa · forest: broad|conifer|snow|jungle|dead" },
    width: { type: "number", description: "ridge 최대 폭 1~3(기본 2)" },
    peak: point,
    widen: { type: "number", description: "river: 이 비율(0~1)부터 하류가 두 칸 폭. 0 = 처음부터 두 칸, 없으면 한 칸" },
    density: { type: "number", description: "forest: 다각형 안 숲이 놓일 수 있는 칸 중 숲 비율 0~1(기본 0.55)" },
    what: { type: "string", enum: ["forest", "mount", "all"], description: "clear: 걷을 물체" },
    level: { type: "integer", enum: [1, 2], description: "plateau 높이" },
    id: { type: "string", description: "move_place: 장소 id(read_world_terrain 의 places)" },
    style: { type: "string", enum: [...WORLDMAP_STYLES], description: "continents: 대륙 구조 — blobs 덩이 대륙 · shards 조각난 대륙 · ring 고리 대륙 · pangaea 초대륙+섬 · archipelago 군도 · galaxy 우주(성계·공허) · peninsula 반도(조선: 북쪽 대륙+반도, 동쪽 척추 산줄기, 서쪽으로 흐르는 강, 동쪽 섬나라) · river-continent 강 문명 대륙(중국·무협: 서쪽 설산 고원, 북쪽 사막, 서→동 큰 강 둘) · arc-islands 열도(일본·전국: 휜 본섬+북·남 섬, 건너편 대륙 끝) · korea 조선 테마용 한반도 윤곽(손으로 다듬은 판) · real 실제 지리(실제 해안선·높이·산맥·사막·강·호수 자료 — region 이나 box 로 지구 어디든)" },
    count: { type: "integer", description: "continents: 땅 덩이 수 1~40(shards 면 조각 수, galaxy 면 성단 수, peninsula·river-continent·arc-islands 면 앞바다 작은 섬 수, korea·real 은 0 — 실제 땅이라 안 쓴다)" },
    land: { type: "number", description: "continents: 땅 비율 0.2~0.7" },
    region: { type: "string", enum: [...WORLDMAP_REGIONS], description: "continents style real: 실제 지역 이름 — korea 한반도와 둘레(요동·만주 남부·일본 서부) · east-asia 동아시아(중국 동부·한반도·일본) · china 중국 전체(티베트·고비·황하·장강) · japan 일본 열도(규슈~홋카이도) · southeast-asia 동남아시아(인도차이나·말레이·인도네시아·필리핀) · india 인도 아대륙(히말라야·데칸·타르 사막) · middle-east 중동(아라비아·메소포타미아·페르시아) · mediterranean 지중해 세계(이베리아~레반트·북아프리카) · europe 유럽 · britain 브리튼·아일랜드 · scandinavia 스칸디나비아·발트 · greece 그리스·에게해 · italy 이탈리아 반도 · egypt 이집트·나일강·시나이 · africa 아프리카 대륙 · north-america 북아메리카 · caribbean 카리브해·서인도 제도 · south-america 남아메리카 · australia 오스트레일리아·뉴질랜드 서부 · iceland 아이슬란드. 목록에 없으면 box" },
    box: { type: "array", items: { type: "number" }, description: "continents style real: 실제 지도 범위 [서경, 남위, 동경, 북위](경도 -180~180, 위도 -85~85, 네 지식으로 정한다 — 그 나라·지역이 둘레 바다와 함께 넉넉히 들어오게. 가로 3° 이상, 4:3 으로 자동으로 넓힌다)" },
    home: { type: "array", items: { type: "number" }, description: "continents style real: 여정을 시작할 땅 [경도, 위도](예: 일본이면 혼슈 [137.5, 36]). 없으면 지역 기본값 또는 가장 큰 땅" },
    beyond: { type: "array", items: { type: "number" }, description: "continents style real: 관문 너머(2막) 쪽으로 바라는 [경도, 위도]. 희망일 뿐 — 첫 화면 규칙(시작·관문·항구·탑이 한 화면)이 먼저다" },
    sands: { type: "array", items: { type: "number" }, description: "continents style real: 모래 바다(4막)로 바라는 [경도, 위도]. 희망일 뿐 — 좁은 땅에서는 끝자락으로 밀린다" },
    seed: { type: "integer", description: "continents·climate: 같은 구조의 다른 모양(정수)" },
    wet: { type: "number", description: "climate: -1(건조)~1(습윤)" },
    cold: { type: "number", description: "climate: -1(더움)~1(추움)" },
    gate: point,
    note: { type: "string", description: "왜 이 작업을 했는지(지도 원본에 남는다)" },
  },
};

const OP_HELP =
  "작업(ops, 칸 좌표 96×72, x 오른쪽·y 아래): "
  + "land{poly,ground?} 땅 더하기 · sea{poly} 바다로 자르기(대륙 가르기·만 파기·호수) · island{x,y,rx,ry,ground?} · "
  + "biome{poly,ground} 바닥 바꾸기 · ridge{line,kind?,width?,peak?} 산줄기 · pass{x,y,r?} 고개 뚫기 · "
  + "river{line,widen?} 강(바다로 끝낼 것) · forest{poly,kind?,density?} · clear{poly,what?} 숲·산 걷기 · "
  + "plateau{poly,level?,ground?} 고원(절벽이 생긴다) · volcano{x,y,lava?} 화산(분화구+고리, 반지름 4칸 땅 필요) · move_place{id,x,y} 장소 옮기기. "
  + "새 대륙 구조(base=\"generate\", 기존 대륙을 버리고 빈 판에서): 첫 작업 continents{style?,count?,land?,seed?} — 「20조각 대륙」 = continents{style:shards,count:20}, "
  + "고리 대륙 = ring, 초대륙 = pangaea, 섬나라 = archipelago, 우주 = galaxy, **실제 나라·지역 모양**(조선·중국·일본·유럽·지중해·이집트·브리튼… 지구 어디든) = continents{style:\"real\", region} 또는 {style:\"real\", box:[서경,남위,동경,북위], home?:[경도,위도]} — 범위는 네 지식으로 정한다(예: 중국 [73,17,136,54], 일본 [127.5,29.5,147,46], 노르만 잉글랜드 [-11,49.5,3,59.5]). 실제 해안선·높이·산맥·사막·강·호수 자료로 그리고 기후는 실제 위도·높이로 정해진다. 가장 큰 사막이 4막 사구 바다가 된다(없으면 내륙). 조선 테마의 한반도는 korea(손으로 다듬은 판). peninsula·river-continent·arc-islands 는 실제가 아닌 닮은꼴 가상 세계. climate{seed?,wet?,cold?} 기후. 여정 장소 31곳·장벽 4개(산벽+관문, 바다, 사구 바다, 천공섬)는 키트가 자동으로 맞춘다. 「월드맵에서 캐릭터를 작게」는 characterScale(0.5~0.75) 를 같이 준다 — "
  + "places 줄의 「입구 x,y」는 장소 아이콘의 성문 칸이다 — 고을·던전 맵은 반드시 그 칸에 출입구(create_transfer_pair)를 두고, 시작 위치는 그 바로 아래 칸이 자연스럽다. "
  + "결과의 layout.regions(a 1막 · b 2막 · w 산벽 · d 사구 바다 · s 배로 가는 땅)를 보고 그 위에 다른 작업을 얹어라. 손으로 정하려면 wall{line,gate?}(산벽) · dune_sea{poly} · sky_island{x,y} · move_place(고정). "
  + "generate 에서 land·sea·island 는 맞춤 전에 구조에 접힌다. "
  + `바닥 이름→글자: grass . farm f crop p savanna v sand s dune d dirt D badlands b ash a basalt B swamp w marsh m tundra t snow n glacier g jungle j. `
  + "규칙: 길은 바다·빙하를 못 건넌다(다리는 강에만 생긴다) — 해협이 길을 가로지르면 길 자리에 땅 목을 남기고 짧은 river 로 끊어 다리를 놓게 하라. "
  + "숲은 물·장소 둘레·길·산 위에 안 놓이고 사막에서 지워진다. 장소마다 여정 규칙(places 줄 끝)이 있다 — 열쇠 장소·장벽 뒤 장소는 그 장벽 밖으로 옮기지 마라. "
  + "테마는 대개 화풍만 바꾼다(지형·장소 배치는 공용) — 자기 지형을 먼저 까는 테마(sea-isles 군도, starmap 은하, joseon 반도, wuxia 강 문명 대륙, sengoku 열도)는 themeNote 가 알려 준다. "
  + "지형 편집으로 정한 바닥은 지역 팔레트가 덮지 않는다. 섬은 rx·ry 보다 1~2칸 클 수 있다. 실제 빌드는 처음 약 2분, 같은 지형은 캐시.";

// ── 준비(prepare) 결과 캐시: 같은 (테마, 작업, 미리보기) 는 한 번만 빌드한다 ──
const prepared = new Map<string, WorldmapBuildResult>();
const lastImage = new Map<string, string>();

function requestKey(request: WorldmapBuildRequest): string {
  return JSON.stringify([request.theme, request.terrain?.base ?? null, request.terrain?.fit_salt ?? null, request.terrain?.ops ?? [], request.preview === true]);
}

function remember(key: string, result: WorldmapBuildResult): void {
  prepared.set(key, result);
  while (prepared.size > 8) prepared.delete(prepared.keys().next().value as string);
}

function theme(args: Record<string, unknown>, map: GameMap | undefined): string {
  const t = typeof args.theme === "string" && args.theme ? args.theme : map?.worldmapSource?.theme ?? "fantasy";
  if (!(WORLDMAP_THEMES as readonly string[]).includes(t)) {
    throw new ToolError(`theme 은 ${WORLDMAP_THEMES.join(", ")} 중 하나다: ${t}`, { code: "invalid-args" });
  }
  return t;
}

function opsOf(value: unknown): Array<Record<string, unknown>> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(o => !o || typeof o !== "object" || Array.isArray(o))) {
    throw new ToolError("ops 는 작업 객체 배열이다. " + OP_HELP, { code: "invalid-args" });
  }
  return value as Array<Record<string, unknown>>;
}

function mapOf(project: Project | undefined, args: Record<string, unknown>): GameMap | undefined {
  const id = typeof args.mapId === "string" ? args.mapId : "";
  return id && project ? project.maps[id as MapId] : undefined;
}

function baseOf(value: unknown): WorldmapBase | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!(WORLDMAP_BASES as readonly unknown[]).includes(value)) {
    throw new ToolError(`base 는 ${WORLDMAP_BASES.join(" | ")} 중 하나다: ${String(value)}`, { code: "invalid-args" });
  }
  return value as WorldmapBase;
}

/** 작업도 바탕 지정도 없으면 null — 테마 기본 지형의 공용 캐시를 그대로 쓴다(새로 그리면 2분). */
function terrainOf(ops: Array<Record<string, unknown>>, base?: WorldmapBase, fitSalt?: number): WorldmapBuildRequest["terrain"] {
  if (!ops.length && !base) return null;
  return { id: "edit", ops, ...(base ? { base } : {}), ...(base === "generate" && typeof fitSalt === "number" ? { fit_salt: fitSalt } : {}) };
}

/** edit_world_terrain 이 빌드할 요청 — 맵에 쌓인 작업 + 이번 작업(replace 면 이번 작업만). 바탕을 바꾸면(공용 ↔ 생성) 쌓인 작업은 버린다. */
function editRequest(args: Record<string, unknown>, map: GameMap | undefined): WorldmapBuildRequest {
  const add = opsOf(args.ops);
  const src = map?.worldmapSource;
  const asked = baseOf(args.base);
  const switching = asked !== undefined && src !== undefined && asked !== (src.base ?? "shared-v9");
  const keep = args.replace === true || switching ? [] : src?.ops ?? [];
  const base = asked ?? src?.base;
  const salt = switching || args.replace === true ? undefined : src?.fitSalt;
  return { theme: theme(args, map), terrain: terrainOf([...keep, ...add], base, salt), preview: args.preview === true };
}

function readRequest(args: Record<string, unknown>, map: GameMap | undefined): WorldmapBuildRequest {
  const src = map?.worldmapSource;
  const ops = args.ops !== undefined ? opsOf(args.ops) : src?.ops ?? [];
  const base = baseOf(args.base) ?? src?.base;
  return { theme: theme(args, map), terrain: terrainOf(ops, base, args.ops === undefined ? src?.fitSalt : undefined), preview: true };
}

/** 생성 지형의 배치 요약 — regions(칸 행 글자)는 읽기 도구에만 싣는다(편집 결과마다 7천 자). */
function layoutOf(result: Extract<WorldmapBuildResult, { ok: true }>, withRegions: boolean): Record<string, unknown> | null {
  const layout = result.world.layout;
  if (!layout) return null;
  if (withRegions) return { ...layout };
  const { regions: _regions, ...rest } = layout;
  return rest;
}

async function prepareRequest(request: WorldmapBuildRequest): Promise<void> {
  const key = requestKey(request);
  if (prepared.get(key)?.ok) return;
  try {
    remember(key, await buildWorldmap(request));
  } catch (error) {
    remember(key, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function resultFor(request: WorldmapBuildRequest): Extract<WorldmapBuildResult, { ok: true }> {
  const entry = prepared.get(requestKey(request));
  if (!entry) throw new ToolError("월드맵 빌드가 실행되지 않았다 — 같은 인자로 다시 호출하라.", { code: "worldmap-not-prepared" });
  if (!entry.ok) {
    throw new ToolError(`월드맵 빌드 실패:\n${entry.error}\n\n같은 ops 의 앞부분만 read_world_terrain(ops) 로 미리 보면 어디가 깨졌는지 글자 지도로 보인다.\n${OP_HELP}`, { code: "worldmap-build-failed" });
  }
  return entry;
}

/**
 * 장소의 입구 칸 — 아이콘 성문이 그려지는 아래 가운데 칸(걸을 수 있으면), 아니면 그 칸에서 가장 가까운 걸을 수 있는 장소 칸.
 * 고을·던전 맵은 여기에 출입구를 둔다. 실측(2026-10-03 조선 시험): 입구를 모르는 조수가 시작 칸 바로 위 빈 풀칸에 문을 뒀다.
 */
export function placeEntrance(p: { x: number; y: number; w: number; h: number }, walk: readonly string[]): { x: number; y: number } {
  const gx = p.x + Math.floor(p.w / 2);
  const gy = p.y + p.h - 1;
  const open = (x: number, y: number) => (walk[y] ?? "")[x] === "1";
  if (open(gx, gy)) return { x: gx, y: gy };
  let best = { x: gx, y: gy };
  let bd = Infinity;
  for (let y = p.y; y < p.y + p.h; y += 1) {
    for (let x = p.x; x < p.x + p.w; x += 1) {
      const d = (x - gx) ** 2 + (y - gy) ** 2 * 2;
      if (open(x, y) && d < bd) { bd = d; best = { x, y }; }
    }
  }
  return best;
}

function placesSummary(result: Extract<WorldmapBuildResult, { ok: true }>): string[] {
  const rules = result.world.placeRules ?? {};
  return result.world.places.map(p => {
    const e = placeEntrance(p, result.world.walk);
    return `${p.id}${p.label ? `「${p.label}」` : ""}(${p.role}) ${p.x},${p.y} ${p.w}×${p.h} 입구 ${e.x},${e.y}${rules[p.id] ? ` — ${rules[p.id]}` : ""}`;
  });
}

/**
 * 세계 지도 테마와 같은 문화권의 마을 칩셋. 세계 지도는 지도 그림을 자른 전용 칩셋이라 마을·실내 그림체를 정해 주지 않는다 —
 * 실측(2026-10-03 조선 시험): 조수가 조선 칩셋이 있는 줄 모르고 한양 고을을 로마풍 버들항 마을 도구로 깔았다.
 * 없는 테마는 기본 마을 도구를 쓰되 이름·NPC 로 문화권을 살린다.
 */
const THEME_TOWN_TILESETS: Readonly<Record<string, readonly string[]>> = {
  joseon: ["joseon_baram"],
  "modern-town": ["jp_city", "modern_city"],
  "modern-sf": ["modern_city"],
  "snow-north": ["forest_harmony_snow"],
  "desert-east": ["forest_harmony_desert"],
};

function townArtHint(theme: string): string {
  const tilesets = THEME_TOWN_TILESETS[theme] ?? [];
  const places = PLACE_REFERENCES.filter(p => "placeKind" in p && p.placeKind === "settlement" && tilesets.includes(String(p.tilesetId)));
  const interior = "실내는 build_hand_interior_room(손 도트 v5 atlas_biome_interior), 배·던전은 atlas_biome_dungeon 을 쓴다.";
  if (theme === "starmap" || theme === "alien") return `테마 ${theme} 전용 정거장·외계 거점 칩셋과 완성 지역은 현재 없다. 지형 생성과 거점 저작의 준비 상태를 구분해서 보고하라. 기본 로마풍 마을을 우주정거장으로 대신 깔지 마라. 월드맵 후보 아이콘은 사람이 하네스에서 선택한 것만 사용할 수 있다. ${interior}`;
  if (!tilesets.length) return `테마 ${theme} 전용 마을 칩셋은 없다 — 마을은 기본 마을 도구로 깔고 이름·NPC·대사로 문화권을 살려라. ${interior}`;
  return `야외 마을은 이 테마와 같은 문화권 칩셋 ${tilesets.join("·")} 으로 깔아라(버들항 등 다른 계열 도구로 깔지 말 것). `
    + (places.length ? `완성 마을: ${places.map(p => `${p.id}「${p.name}」`).join(", ")} — import_region_reference({id}) 한 번으로 가져와 이름만 바꿔도 된다. ` : "")
    + `새로 지으려면 create_map(tilesetId=${tilesets[0]}) 뒤 그 타일셋 참고문서(list_tileset_references)를 읽고 깐다. 세계 지도 장소와는 places 의 「입구 x,y」에 create_transfer_pair 로 잇는다. ${interior}`;
}

function slug(text: string, i: number): string {
  const ascii = text.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  return `wm_${ascii || "place"}_${i}`;
}

/** 지도 그림을 칸마다 한 타일로 쓰는 타일셋 + 걷기 표 통행. */
function worldmapTileset(id: TilesetId, assetId: string, name: string, walk: readonly string[], width: number, height: number): TilesetDef {
  const count = width * height;
  const passability: PassFlag[] = new Array(count);
  for (let y = 0; y < height; y += 1) {
    const row = walk[y] ?? "";
    for (let x = 0; x < width; x += 1) passability[y * width + x] = row[x] === "1" ? OPEN : CLOSED;
  }
  return {
    id, name, image: { type: "uploaded", id: assetId }, kind: "custom", family: "worldmap-kit",
    tileSize: TILE, tilesPerRow: width, count, passability,
    priority: new Array(count).fill("lower"), terrain: new Array(count).fill(0),
  };
}

function applyWorldmap(
  draft: Project, mapId: MapId, name: string | undefined, request: WorldmapBuildRequest,
  result: Extract<WorldmapBuildResult, { ok: true }>,
): { created: boolean; strandedEvents: string[] } {
  const { world } = result;
  const tilesetId = `worldmap_${mapId}` as TilesetId;
  const assetId = `worldmap_${mapId}_image`;
  const existing = draft.maps[mapId];
  if (existing && !existing.worldmapSource) {
    throw new ToolError(`맵 ${mapId} 은 월드맵 키트 지도가 아니다 — 새 mapId 를 주거나 mapId 를 비워 새 세계 지도를 만들어라.`, { code: "not-worldmap" });
  }
  const mapName = name ?? existing?.name ?? "세계 지도";
  const oldTileset = existing ? draft.tilesets[existing.tilesetId] : undefined;
  const authored = existing && ([existing.upperTiles, existing.lowerOverlayTiles, existing.upperOverlayTiles]
    .some((layer) => layer?.some((tile) => tile >= 0)) || oldTileset?.tileGrafts?.length || existing.shadowBits?.some((bits) => bits !== 0)
    || existing.relief);
  if (existing && authored && (existing.width !== world.width || existing.height !== world.height)) {
    throw new ToolError("위층·이식 아이콘이 있는 지도는 지형 재생성으로 크기를 바꾸지 않습니다. 새 mapId로 만드세요.", { code: "authored-worldmap-resize" });
  }
  draft.assets.uploaded[assetId] = {
    id: assetId, name: `${mapName} 지도 그림`, kind: "tileset", dataUrl: result.imageDataUrl,
    meta: { tileSize: TILE, width: world.width * TILE, height: world.height * TILE },
  };
  draft.tilesets[tilesetId] = worldmapTileset(tilesetId, assetId, `${mapName} (월드맵 키트)`, world.walk, world.width, world.height);
  // 지형 그림을 다시 구워도 따로 저작한 아이콘의 소스·칸 번호·통행은 보존한다.
  if (oldTileset?.tileGrafts?.length) {
    const fresh = draft.tilesets[tilesetId]!;
    fresh.tileGrafts = structuredClone(oldTileset.tileGrafts);
    fresh.count = Math.max(fresh.count, oldTileset.count);
    for (let i = world.width * world.height; i < fresh.count; i++) {
      fresh.passability[i] = { up: true, down: true, left: true, right: true };
      fresh.priority[i] = "upper";
      fresh.terrain[i] = 0;
    }
    fresh.tileMeta ??= [];
    for (const graft of fresh.tileGrafts) {
      const i = graft.targetTile;
      fresh.passability[i] = { ...oldTileset.passability[i]! };
      fresh.priority[i] = oldTileset.priority[i]!;
      fresh.terrain[i] = oldTileset.terrain[i] ?? 0;
      if (oldTileset.tileMeta?.[i]) fresh.tileMeta[i] = { ...oldTileset.tileMeta[i]! };
    }
  }
  const size = world.width * world.height;
  const lowerTiles = Array.from({ length: size }, (_, i) => i);
  const locations: MapNamedLocation[] = world.places.map((p, i) => ({
    id: slug(p.id, i), name: p.label ?? p.id, x: p.x, y: p.y, w: p.w, h: p.h, tags: [p.role, `act${p.act}`],
    note: `월드맵 장소(${p.role}, ${p.act + 1}막${p.label ? `, 키트 id ${p.id}` : ""}) — 입구(성문) ${placeEntrance(p, world.walk).x},${placeEntrance(p, world.walk).y}: 고을·던전 맵은 이 칸에 출입구를 둔다`,
  }));
  const strandedEvents: string[] = [];
  const events = existing?.events ?? [];
  for (const event of events) {
    const row = world.walk[event.y] ?? "";
    if (row[event.x] !== "1") strandedEvents.push(`${event.name ?? event.id}(${event.x},${event.y})`);
  }
  const map: GameMap = {
    ...(existing ?? { events: [] as GameMap["events"] }),
    id: mapId, name: mapName, width: world.width, height: world.height, tilesetId, tileSize: TILE,
    lowerTiles, upperTiles: existing?.width === world.width && existing.height === world.height
      ? [...existing.upperTiles] : new Array<number>(size).fill(-1),
    locations,
    worldmapSource: {
      theme: request.theme, ops: request.terrain?.ops ?? [], terrainId: world.terrain, palette: world.palette,
      base: request.terrain?.base ?? (world.layout ? "generate" : "shared-v9"),
      ...(world.layout ? { fitSalt: world.layout.salt } : {}),
    },
  } as GameMap;
  if (existing?.width !== world.width || existing.height !== world.height) {
    delete (map as Partial<GameMap>).lowerOverlayTiles;
    delete (map as Partial<GameMap>).upperOverlayTiles;
    delete (map as Partial<GameMap>).shadowBits;
  }
  draft.maps[mapId] = map;
  if (!existing) {
    if (!draft.maps[draft.mapTree.mapId]) draft.mapTree = { mapId, children: [] };
    else if (draft.mapTree.mapId !== mapId && !draft.mapTree.children.some(child => child.mapId === mapId)) {
      draft.mapTree.children.push({ mapId, children: [] });
    }
  }
  return { created: !existing, strandedEvents };
}

const listWorldmapThemes: ToolDefinition = {
  name: "list_worldmap_themes",
  mode: "read",
  domains: ["world", "map"],
  description: "월드맵 세계관 17종의 생성 구조·여정과 사람 선택 아이콘 준비 상태를 조회한다. 우주 성계 지도와 외계 행성 지도를 구분하며, 테마가 있다는 것만으로 거점 그림·내부·이동 이벤트가 완성된 것은 아니다. 새 세계 지도를 만들기 전에 읽는다.",
  parameters: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false },
  run(_project, args): ToolExecResult {
    const query = String(args.query ?? "").trim().toLowerCase();
    const themes = themeCatalog.filter(entry => !query || `${entry.id} ${entry.name} ${entry.kind} ${entry.terrainNote ?? ""} ${entry.kind === "space" ? "우주 은하 space galaxy" : ""} ${entry.id === "alien" ? "외계 행성 planet" : ""}`.toLowerCase().includes(query)).map(entry => {
      const selected = WORLDMAP_SELECTED_ICONS.filter(icon => icon.theme === entry.iconset);
      return { ...entry, selectedIcons: selected.length, iconReadiness: selected.length ? "partial-human-selection" : "human-selection-required",
        ...(selected.length ? { referenceRead: { tilesetId: WORLDMAP_SELECTED_ID, categoryId: `wmi-${entry.iconset}` } } : {}),
        ...(entry.kind === "space" ? { semantics: "항행 공간·깊은 공허·성운·소행성대·이온 폭풍·초공간 항로. 항로 허가증→워프→폭풍 항법→점프 게이트." } : {}) };
    });
    return { summary: `월드맵 세계관 ${themes.length}종 — 생성기와 확정 그림의 준비 상태`, data: { themes,
      help: "read_world_terrain({theme})로 지형·여정을 미리 보고 edit_world_terrain({theme,ops:[]})로 새 지도를 만든다. 결과마다 여정 검사를 확인한다. 전용 타일셋 worldmap_<mapId>는 생성 후 생기며 worldmap_<theme> 같은 ID를 추측하지 않는다. 미선택 후보는 지도에 붙이지 않는다. 논리 장소·장벽 검사는 실제 거점 그림과 게임 해금 이벤트의 완성이 아니다." } };
  },
};

const readWorldTerrain: ToolDefinition = {
  name: "read_world_terrain",
  description:
    "세계 지도(월드맵 키트 96×72칸)의 지형을 읽는다 — 칸 글자 지도(첫 줄이 범례: ~ 바다 . 초원 s 사막 ^ 산 * 숲 = 길 @ 장소 …), 장소 목록(id·역할·칸), 지금까지 쌓인 지형 작업(ops), "
    + "여정 도달성 검사, 도식 그림. mapId 가 월드맵 키트 지도면 그 원본을, 없으면 theme 의 기본 지형을 읽는다. "
    + "ops 를 주면 그 작업을 얹은 결과를 저장하지 않고 미리 본다(몇 초). edit_world_terrain 전에 좌표를 고르려고 부른다.",
  mode: "read",
  domains: ["map", "world"],
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      mapId: { type: "string", description: "월드맵 키트 지도 id(edit_world_terrain 이 만든 맵)" },
      theme: { type: "string", enum: [...WORLDMAP_THEMES], description: "세계관 테마(mapId 가 없을 때, 기본 fantasy)" },
      base: { type: "string", enum: [...WORLDMAP_BASES], description: "지형 바탕 — shared-v9 손 대륙(기본) · generate 새 대륙 구조(ops 첫 작업 continents)" },
      ops: { type: "array", items: opSchema, description: "미리 볼 작업 목록(쌓인 작업 대신 이것으로 본다)" },
    },
  },
  async prepare(args, project): Promise<void> {
    await prepareRequest(readRequest(args, mapOf(project, args)));
  },
  run(project, args): ToolExecResult {
    const map = mapOf(project, args);
    const request = readRequest(args, map);
    const result = resultFor(request);
    lastImage.set("read_world_terrain", result.imageDataUrl);
    return {
      summary: `세계 지형 ${result.world.terrain}(${request.theme}) — 장소 ${result.world.places.length}곳, 여정 검사 ${result.journeyCheck?.ok === false ? "불일치" : "통과"}`,
      data: {
        theme: request.theme, mapId: map?.id ?? null, ops: request.terrain?.ops ?? [],
        themeNote: result.themeNote, iconSelection: result.iconSelection, ascii: result.ascii, places: placesSummary(result), journeyCheck: result.journeyCheck,
        layout: layoutOf(result, true), warnings: result.warnings, help: OP_HELP,
      },
    };
  },
};

const editWorldTerrain: ToolDefinition = {
  name: "edit_world_terrain",
  description:
    "세계 지도의 지형 자체를 바꾼다 — 대륙을 바다로 갈라 섬나라로, 섬을 더하고, 산줄기·고개·강·숲·고원을 놓고, 지역의 바닥(사막·설원·늪…)을 바꾸고, 장소를 옮긴다. "
    + "base=generate 면 대륙 구조를 아예 새로 만든다(20조각 대륙·고리 대륙·초대륙·군도·은하) — 여정 장소는 키트가 자동으로 다시 놓는다. "
    + "월드맵 키트(테마 17종: 판타지·우주·현대·스팀펑크·조선…)가 같은 화풍으로 다시 그리고 여정 도달성(걸어서·배·사막선·비공정)을 검사한다. 먼저 list_worldmap_themes로 생성 구조와 사람 선택 아이콘 준비 상태를 조회한다. 후보는 사용자가 선택하기 전에는 붙이지 않으며 iconSelection.pending은 그림이 없는 논리 장소다. "
    + "mapId 가 기존 월드맵 키트 지도면 거기 쌓인 작업 뒤에 ops 를 잇는다(replace=true 면 ops 로 갈아 끼운다). mapId 가 없으면 새 세계 지도 맵을 만든다. 결과 data.townArt 가 이 테마의 야외 마을 칩셋·완성 마을과 공용 실내 칩셋을 알려 준다 — 마을을 깔기 전에 따르라. "
    + "좌표는 먼저 read_world_terrain 의 글자 지도로 고른다. 장소 발자국이 물이 되거나 길이 막히면 실패하고 이유를 돌려준다 — 그 문장대로 작업을 고쳐 다시 부른다. "
    + "preview=true 는 저장하지 않고 몇 초 만에 도식 그림만 본다(도식은 바닥 종류 색이라 테마 팔레트와 다르다 — themeNote 를 보라). 실제 빌드는 처음 2분 남짓, 같은 지형은 캐시. "
    + OP_HELP,
  mode: "write",
  domains: ["map", "world"],
  preservesAuthoredRaster: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["ops"],
    properties: {
      mapId: { type: "string", description: "고칠 월드맵 키트 지도 id. 없으면 새 맵(아래 newMapId)" },
      newMapId: { type: "string", description: "새로 만들 맵 id(mapId 가 없을 때, 생략 시 world_map)" },
      name: { type: "string", description: "맵 이름(새 맵 기본 「세계 지도」)" },
      theme: { type: "string", enum: [...WORLDMAP_THEMES], description: "세계관 테마(기존 지도는 그 테마, 새 지도는 fantasy)" },
      base: { type: "string", enum: [...WORLDMAP_BASES], description: "지형 바탕 — shared-v9 손 대륙 위에 얹기 · generate 빈 판에 새 대륙 구조(ops 첫 작업 continents, 여정 장소 자동 맞춤). 바탕을 바꾸면 쌓인 작업은 버린다" },
      ops: { type: "array", items: opSchema, description: "더할 지형 작업(차례대로). 테마만 바꾸려면 빈 배열" },
      replace: { type: "boolean", description: "true 면 쌓인 작업을 버리고 ops 만으로" },
      preview: { type: "boolean", description: "true 면 저장하지 않고 도식 그림·검사만" },
      characterScale: { type: "number", description: "이 세계 지도 위에서 걷는 캐릭터 크기 배율 0.25~1(사용자가 「월드맵에서 캐릭터를 작게」를 원할 때 0.5~0.75). 1 이면 기본 크기로. 생략하면 그대로" },
    },
  },
  invalidArgsExample: { ops: [{ op: "sea", poly: [[58, 30], [80, 29], [80, 32], [58, 33]], note: "동대륙을 두 섬으로" }] },
  async prepare(args, project): Promise<void> {
    await prepareRequest(editRequest(args, mapOf(project, args)));
  },
  run(draft, args): ToolExecResult {
    const map = mapOf(draft, args);
    if (typeof args.mapId === "string" && args.mapId && !map) {
      throw new ToolError(`맵을 찾을 수 없다: ${args.mapId}`, { code: "map-not-found" });
    }
    const request = editRequest(args, map);
    const result = resultFor(request);
    lastImage.set("edit_world_terrain", result.imageDataUrl);
    const base = {
      theme: request.theme, themeNote: result.themeNote, iconSelection: result.iconSelection, ops: request.terrain?.ops ?? [], ascii: result.ascii, places: placesSummary(result),
      journeyCheck: result.journeyCheck, warnings: result.warnings, seconds: result.seconds,
      ...(result.world.layout ? { base: "generate", layout: layoutOf(result, false) } : {}),
    };
    if (result.journeyCheck && !result.journeyCheck.ok) {
      throw new ToolError(
        `여정 도달성 검사 불일치 — 지도는 저장하지 않았다:\n${result.journeyCheck.bad.join("\n")}\n`
        + `같은 ops 로 read_world_terrain 을 부르면 글자 지도·장소별 여정 규칙을 보며 고칠 수 있다.`
        + (result.warnings.length ? `\n경고: ${result.warnings.join(" / ")}` : ""),
        { code: "journey-check-failed" },
      );
    }
    if (request.preview) {
      return { summary: `미리보기(저장 안 함, ${result.seconds}초) — 작업 ${base.ops.length}개, 여정 검사 통과`, data: { preview: true, ...base } };
    }
    const mapId = (map?.id ?? (typeof args.newMapId === "string" && args.newMapId ? args.newMapId : "world_map")) as MapId;
    if (!map && draft.maps[mapId] && !draft.maps[mapId]!.worldmapSource) {
      throw new ToolError(`맵 id ${mapId} 가 이미 다른 맵이다 — newMapId 를 바꿔라.`, { code: "map-id-taken" });
    }
    const { created, strandedEvents } = applyWorldmap(draft, mapId, typeof args.name === "string" ? args.name : undefined, request, result);
    if (typeof args.characterScale === "number" && Number.isFinite(args.characterScale)) {
      const built = draft.maps[mapId]!;
      if (args.characterScale >= 1) delete built.characterScale;
      else built.characterScale = mapCharacterSizeFactor({ characterScale: args.characterScale });
    }
    const sizeNote = draft.maps[mapId]!.characterScale ? `, 캐릭터 크기 ${Math.round(draft.maps[mapId]!.characterScale! * 100)}%` : "";
    const warnings = [
      ...result.warnings,
      ...(strandedEvents.length ? [`걸을 수 없는 칸에 놓인 이벤트 ${strandedEvents.length}개: ${strandedEvents.slice(0, 8).join(", ")} — 옮겨야 한다`] : []),
    ];
    return {
      summary: `${created ? "새 세계 지도" : "세계 지도"} ${mapId} — 테마 ${request.theme}, 지형 작업 ${base.ops.length}개, 장소 ${result.world.places.length}곳${sizeNote}, 여정 검사 통과(${result.seconds}초)`,
      data: { mapId, created, tilesetId: `worldmap_${mapId}`, townArt: townArtHint(request.theme), ...base },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const WORLD_TERRAIN_TOOLS: readonly ToolDefinition[] = [listWorldmapThemes, readWorldTerrain, editWorldTerrain];

/** 조수가 방금 빌드한 지도(미리보기면 도식)를 눈으로 보게 한다. */
export function worldTerrainImages(toolName: string): { dataUrl: string; label: string }[] {
  const dataUrl = lastImage.get(toolName);
  return dataUrl ? [{ dataUrl, label: toolName === "read_world_terrain" ? "세계 지형 도식" : "세계 지도" }] : [];
}
