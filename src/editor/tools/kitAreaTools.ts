// 번들 키트 시트(몬스터 수집 monster_* 등)의 야외 빈 터를 그 지역 재료로 꾸민다 — find_empty_ground·furnish_outdoor_area.
// 왜(2026-10-06~07 실편집기 이어 고치기 r8~r13): 「서리꽃 마을 왼쪽 아래 공터 채워」에 조수가 칸 번호를 하나씩 칠해 55턴을 썼고,
// 이 도구를 쓴 뒤에도 터 하나·스타일 하나로 부르면 소품 네댓 개만 놓여 빈칸이 53→27/34 에 머물렀다.
// 모델은 구역(region)만 고르고, 구획 나누기·쓰임 고르기·덩이·여백·문 앞 비우기·도달성은 코드가 지킨다(src/project/kitAreaFurnish.ts —
// 캠페인 생성기도 같은 코드로 마을 빈터를 채운다).
import {
  FurnishError, REGIONS, STYLES, findEmptyGround, furnishOutdoorArea, measureBareGround, regionRect,
  type Rect, type Region, type Style,
} from "@/project/kitAreaFurnish";
import type { Project } from "@/project/types";
import { RECT_SCHEMA } from "./schemaShapes";
import { ToolError, type ToolDefinition } from "./types";

export { findEmptyGround, furnishOutdoorArea };

/** 키트 시트 야외 맵이면 조수에게 처음부터 쥐여 줄 도구. */
export const KIT_AREA_EXPOSED_TOOLS = ["find_empty_ground", "furnish_outdoor_area", "show_map_region"] as const;

/**
 * 대상 맵이 구조 키트 시트의 야외 맵(바닥 칸 1/4 이상이 지역 바닥)이면 조수 노트 한 단락, 아니면 null.
 * r8~r11 에서 조수는 이 도구가 있어도 찾지 않고 paint_tiles 로 칸을 하나씩 칠했다 — 처음부터 보이게 하고 이름을 부른다.
 */
export function kitAreaNote(project: Project, mapId: string | null | undefined): string | null {
  const map = mapId ? project.maps[mapId] : undefined;
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset?.structureKits?.length || map.mapRole === "interior" || map.mapRole === "dungeon") return null;
  const bare = measureBareGround(project, map);
  if (bare.ground * 4 < map.lowerTiles.length) return null;
  return `[키트 시트 야외 맵] ${map.name}(${map.id})은 구조 키트 시트(${tileset.id})다. 빈 터·공터를 채우거나 꾸미는 요청은 칸 번호를 하나씩 칠하지 말고 `
    + "furnish_outdoor_area(mapId, region:사용자가 말한 쪽 — 예 「왼쪽 아래」→bottom-left) 한 번으로 먼저 채운 뒤 show_map_region 으로 본다. "
    + "코드가 그 구역의 빈터를 구획으로 나눠 구획마다 쓰임(숲 덩이·꽃밭·눈놀이 터·선인장 밭·파라솔 쉼터·어구 더미…)을 고르고 걷는 띠를 남긴다. "
    + "결과의 bareAfter(맨땅 비율)가 아직 높으면 seed 를 바꿔 한 번 더 부르거나 남은 칸만 place_props 로 다듬는다. 연못·광장을 원하면 style:pond|plaza 를 함께 준다.";
}

export const KIT_AREA_TOOLS: readonly ToolDefinition[] = [{
  name: "find_empty_ground",
  mode: "read",
  domains: ["map", "tile"],
  description: "야외 맵에서 꾸밀 만한 빈 터(지역 바닥이 위층·이벤트 없이 비어 있는 사각형)를 큰 순서로 찾고, 터마다 어울리는 쓰임(suggest)을 붙인다. "
    + "region(사용자가 말한 쪽)을 주면 그 구역 안에서만 찾고 구역 사각형(regionRect)과 맨땅 비율도 돌려준다. 채우기는 furnish_outdoor_area 에 같은 region 을 주면 된다.",
  parameters: { type: "object", properties: {
    mapId: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: 8 },
    region: { type: "string", enum: [...REGIONS], description: "all|top|bottom|left|right|top-left|top-right|bottom-left|bottom-right|center (기본 all)" },
  }, required: ["mapId"], additionalProperties: false },
  fillsCurrentMapId: true,
  run(project, args) {
    const map = project.maps[String(args.mapId)];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${String(args.mapId)}`, { code: "map-not-found" });
    const region = (REGIONS as readonly string[]).includes(String(args.region)) ? args.region as Region : "all";
    const zone = regionRect(map, region);
    const areas = findEmptyGround(project, map, Number.isInteger(args.limit) ? Number(args.limit) : 4, 6, region === "all" ? undefined : zone);
    const bare = measureBareGround(project, map, zone);
    const head = `${map.name}${region === "all" ? "" : ` ${region} (${zone.x},${zone.y}) ${zone.w}×${zone.h}`} 맨땅 ${Math.round(bare.bareShare * 100)}%`;
    return {
      summary: areas.length ? `${head} · 빈 터 ${areas.length}곳: ${areas.map(a => `(${a.x},${a.y}) ${a.w}×${a.h} ${a.ground}${a.suggest ? `→${a.suggest}` : ""}`).join(" · ")}` : `${head} · 꾸밀 만한 빈 터(2×2 이상)가 없습니다.`,
      data: { mapId: map.id, region, regionRect: zone, bare, areas },
    };
  },
}, {
  name: "furnish_outdoor_area",
  mode: "write",
  domains: ["map", "tile"],
  description:
    "야외 맵의 휑한 빈 터·공터를 그 지역 재료로 「쓰임」별로 채운다(빈 곳 채워·허전해·휑해·꾸며 줘 요청). 몬스터 수집 시트(monster_*)처럼 구조 키트가 있는 시트용. " +
    "region(사용자가 말한 쪽, 예 왼쪽 아래→bottom-left) 또는 area 하나만 주면 된다 — 코드가 그 안의 빈터를 큰 것부터 구획으로 떼어 구획마다 쓰임을 고른다: " +
    "맵 가장자리·숲 벽 곁은 나무 덩이, 건물 곁은 마당 쓰임(꽃밭·눈놀이 터·선인장 밭·어구 더미), 나머지는 바닥(눈밭·사막 모래·재 덮인 풀·풀밭·모래)에 맞는 다른 쓰임을 돌아가며. " +
    "구획마다 둘레 한 칸을 걷는 띠로 남기고, 모든 조각은 같은 바닥 위에만 선다. 문·출구 앞과 이벤트 둘레·주민 산책길은 비우고, 닿던 이벤트가 막히면 그 조각은 되돌린다. " +
    "맨땅(3×3 이웃에 물체가 없는 바닥) 비율이 목표 아래로 내려가면 멈춘다. " +
    "style: auto(기본, 쓰임 채우기만) | grove | garden | plaza | pond — auto 가 아니면 그 스타일 덩이를 먼저 놓고 남은 터를 쓰임으로 채운다. " +
    "칸 번호를 하나씩 칠하는 것보다 먼저 쓴다. 결과는 show_map_region 으로 보고, 모자란 곳만 place_props·paint_tiles 로 다듬는다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      region: { type: "string", enum: [...REGIONS], description: "사용자가 말한 쪽. area 가 없으면 이 구역 전체를 채운다(기본 all)." },
      area: { ...RECT_SCHEMA, description: "{x,y,w,h} 꾸밀 터(region 대신 정확한 사각형을 줄 때)." },
      style: { type: "string", enum: [...STYLES], description: "auto|grove|garden|plaza|pond (기본 auto)" },
      seed: { type: "integer", description: "다른 배치를 원하면 바꾼다" },
    },
    required: ["mapId"],
    additionalProperties: false,
  },
  run(project, args) {
    const map = project.maps[String(args.mapId)];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${String(args.mapId)}`, { code: "map-not-found" });
    // 버들항(beodeul_city)은 이 도구의 지역 바닥 팔레트가 없다 — 2026-10-22 장면 교훈 시험에서 4건(성벽 마을·여관/상점·밤 마을·꾸미기)이
    // 「알려진 지역 바닥이 아닙니다」로 2~3번씩 거부된 뒤 나무를 한 그루씩 찍다 겹침 오류를 냈다. 처음부터 맞는 도구로 보낸다.
    if (map.tilesetId === "beodeul_city") {
      throw new ToolError(`버들항(beodeul_city) 맵은 furnish_outdoor_area 로 꾸미지 않는다 — 풀·꽃 군락·잔돌·화단·통·장작 덧그림은 dress_beodeul_ground({mapId:"${map.id}"}) 한 번, `
        + `나무·가로등·벤치 같은 기물은 stamp_object({mapId:"${map.id}", objectId:"kit:beodeul_city/bd-tree-…"|"kit:beodeul_city/bd-prop-…", x, y}) — 키트 id 는 list_spatial_designs({kind:"object", query:"tree"|"lamp"|"bench"}) 로 찾는다. stamp_object 가 겹친다고 하면 그 오류의 「가장 가까운 빈 바닥 자리」로 다시 찍는다.`,
        { code: "wrong-tileset-family", mapId: map.id });
    }
    const given = args.area as Rect | undefined;
    if (given !== undefined && ![given?.x, given?.y, given?.w, given?.h].every(Number.isInteger)) throw new ToolError("area 는 정수 {x,y,w,h} 입니다.", { code: "invalid-args", mapId: map.id });
    const region = (REGIONS as readonly string[]).includes(String(args.region)) ? args.region as Region : "all";
    const area = given ?? regionRect(map, region);
    const style = (STYLES as readonly string[]).includes(String(args.style)) ? args.style as Style : "auto";
    let result: ReturnType<typeof furnishOutdoorArea>;
    try { result = furnishOutdoorArea(project, map, area, style, Number.isInteger(args.seed) ? Number(args.seed) : 1); }
    catch (error) { if (error instanceof FurnishError) throw new ToolError(error.message, { code: error.code, mapId: map.id }); throw error; }
    const uses = result.lots.map(l => `${l.label}(${l.x},${l.y})`).join(" · ");
    const parts = [style !== "auto" ? `${style}: 나무 ${result.trees} · 소품 ${result.smalls}${result.pathCells ? ` · 길 ${result.pathCells}칸(기존 길에 이음)` : ""}` : "", uses ? `쓰임 ${result.lots.length}곳: ${uses}` : ""].filter(Boolean).join(" / ");
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    return {
      summary: `${map.name} (${area.x},${area.y}) ${area.w}×${area.h} 꾸밈(${result.ground}) — ${parts || "놓을 자리가 없었다"}, 맨땅 ${pct(result.bareBefore.bareShare)}→${pct(result.bareAfter.bareShare)} · 빈 바닥 ${result.emptyBefore}→${result.emptyAfter}칸`,
      data: { mapId: map.id, area, ...result },
      ...(result.bareAfter.bareShare > 0.2 ? { warnings: [`맨땅이 아직 ${pct(result.bareAfter.bareShare)}다 — 터가 길·문 앞으로 막혀 있거나 바닥이 여러 가지다. seed 를 바꿔 한 번 더 부르거나 남은 칸을 place_props 로 다듬는다.`] } : {}),
    };
  },
}];
