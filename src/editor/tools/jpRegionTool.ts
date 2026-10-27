// compose_jp_region · list_jp_regions — 일본 지역 30종(japaneseRegionsCatalog.ts)을 jp_city 맵 한 장에 짓는다.
// 장면 지역은 regionComposer 가 펼친 바닥·키트 단계를 복제본에 시공하고, 상가·주택가 지역은 compose_jp_city_street 에 넘긴다.
import { JP_REGION_CATEGORIES, JP_REGIONS, jpRegionBrief, jpRegionById, searchJpRegions, type JpRegion } from "@/editor/jpCity/japaneseRegionsCatalog";
import { composeJpForestR4, hasJpForestR3, hasJpForestR4, paintJpForest } from "@/editor/jpCity/forestPainter";
import { paintJpRegionGround, planJpRegionScene } from "@/editor/jpCity/regionComposer";
import { regionWithLayout, STATION_LANDMARKS, STATION_PLAZA_KINDS, STATION_SHOP_POOL, type StationPlazaLayout } from "@/editor/jpCity/regionVariants";
import { isPassable } from "@/project/collision";
import { blankFillTileFor } from "@/project/defaults/defaultMaps";
import { isJpCityTileset, JP_CITY_FAMILY, JP_CITY_ID } from "@/project/defaults/jpCity";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import type { GameMap, Project } from "@/project/types";
import { claimStartIfBlank } from "./composerStart";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

// toolRegistry 가 이 파일을 불러오므로 레지스트리를 직접 import 하면 순환이다 — 레지스트리가 만들어진 뒤 조회 함수를 꽂는다.
let lookup: (name: string) => ToolDefinition | undefined = () => undefined;
export function bindRegionToolLookup(fn: (name: string) => ToolDefinition | undefined): void { lookup = fn; }

function callTool(project: Project, name: string, args: Record<string, unknown>): ToolExecResult {
  const tool = lookup(name);
  if (!tool) throw new ToolError(`도구 ${name} 이 없다`, { code: "unknown-tool" });
  return tool.run(project, args);
}

function isUntouched(map: GameMap): boolean {
  return map.lowerTiles.every((t) => t === map.lowerTiles[0]) && map.upperTiles.every((t) => t === -1);
}

function pickWalkableStart(project: Project, map: GameMap): { x: number; y: number } {
  if (project.startMapId === map.id && isPassable(project, map, project.startPos.x, project.startPos.y)) {
    return project.startPos;
  }
  const cx = Math.floor(map.width / 2), cy = Math.floor(map.height / 2);
  for (let r = 0; r < Math.max(map.width, map.height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < map.width && y >= 0 && y < map.height && isPassable(project, map, x, y)) return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}

function regionData(r: JpRegion) {
  return { no: r.no, id: r.id, category: r.category, ko: r.ko, ja: r.ja, en: r.en, pitch: r.pitch, palette: r.palette, harmony: r.harmony, season: r.season, timeOfDay: r.timeOfDay, size: r.size, engine: r.engine.kind, ...(r.alsoWith ? { alsoWith: r.alsoWith } : {}) };
}

const REGION_IDS = JP_REGIONS.map((r) => r.id);

export const LIST_JP_REGIONS_TOOL: ToolDefinition = {
  name: "list_jp_regions",
  mode: "read",
  domains: ["map"],
  description: `일본 지역 30종 카탈로그(jp_city) - ${JP_REGION_CATEGORIES.map((c) => `${c.letter} ${c.ko}`).join(" · ")}. 상점가 말고 학교·주택가·등산로·유적지·온천·항구·논 같은 일본 장소를 지을 때 지역 id 를 고른다. query 로 좁히고 compose_jp_region 으로 짓는다.`,
  parameters: {
    type: "object",
    properties: {
      category: { type: "string", enum: JP_REGION_CATEGORIES.map((c) => c.id) },
      query: { type: "string", maxLength: 200, description: "요청 문장(예: \"온천 마을\", \"등산로\", \"성 유적\")" },
    },
    additionalProperties: false,
  },
  run(_project, args): ToolExecResult {
    const q = typeof args.query === "string" ? args.query.trim() : "";
    const pool = q ? searchJpRegions(q, 30) : JP_REGIONS.filter((r) => !args.category || r.category === args.category);
    return {
      summary: pool.length ? `일본 지역 ${pool.length}종 - ${pool.slice(0, 8).map((r) => r.id).join(", ")}${pool.length > 8 ? " …" : ""}. compose_jp_region({region, seed}) 으로 짓는다.`
        : "맞는 일본 지역이 없다 - query 를 짧게 하거나 category 만 준다.",
      data: { regions: pool.map(regionData), brief: pool.map(jpRegionBrief), next: "고른 region 으로 compose_jp_region 을 부른다. 맵이 작으면 region.size 로 resize_map 한다." },
    };
  },
};

export const COMPOSE_JP_REGION_TOOL: ToolDefinition = {
  name: "compose_jp_region",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "일본 지역 30종 중 하나를 jp_city 맵 한 장에 짓는다 - 바닥(길·물·논·모래)·랜드마크(천수각·오중탑·도리이·등대·로프웨이)·건물 줄·소품을 지역 문법대로 놓는다. 씨앗이 다르면 배치가 달라진다. "
    + "region 은 list_jp_regions 의 id(shotengai·station_plaza·high_school_grounds·torii_shrine_precinct·bamboo_mountain_trail·onsen_ryokan_town·fishing_harbor_market 등). 맵은 40×28 이상, 손댄 맵은 replace:true.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 jp_city 여야 한다" },
      region: { type: "string", enum: REGION_IDS, description: "지역 id(list_jp_regions)" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗 - 다른 값이면 다른 배치. 생략하면 0" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 짓는다(이벤트는 남는다)" },
      grounding: { type: "boolean", description: "옛 인자 — 무시한다. 숲 나무 밑 땅 그늘(접지)은 늘 켜진다" },
      layout: {
        type: "object", additionalProperties: false,
        description: "역전(station_plaza) 짜임 손잡이 — 고른 것만 그대로, 안 고른 것은 씨앗이 고른다. 다른 지역은 무시한다.",
        properties: {
          plaza: { type: "string", enum: [...STATION_PLAZA_KINDS], description: "rotary 잔디 섬 로터리 · crossing 큰길이 내려와 만나는 교차로+반쪽 광장 · square 차로 없는 너른 판석 광장" },
          landmark: { type: "string", enum: [...STATION_LANDMARKS], description: "광장 가운데 랜드마크" },
          shops: { type: "array", maxItems: 7, items: { type: "string", enum: Object.keys(STATION_SHOP_POOL) }, description: "앞줄 가게(왼쪽부터 순서대로, 4~7곳)" },
          mirror: { type: "boolean", description: "좌우 뒤집기" },
        },
      },
    },
    required: ["region"],
    additionalProperties: false,
  },
  invalidArgsExample: { region: "onsen_ryokan_town", seed: 2 },
  run(draft: Project, args): ToolExecResult {
    const region = typeof args.region === "string" ? jpRegionById(args.region) : undefined;
    if (!region) throw new ToolError(`알 수 없는 지역 '${String(args.region)}' - list_jp_regions 로 id 를 고른다`, { code: "region-not-found" });
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 지을 jp_city 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isJpCityTileset(tileset)) {
      throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 일본 도시(${JP_CITY_ID}, 계열 ${JP_CITY_FAMILY})가 아니다 — 이 도구는 jp_city 맵에서만 동작한다.`, { code: "wrong-tileset", mapId });
    }
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;
    const info = regionData(region);
    const varied = regionWithLayout(region, seed, args.layout && typeof args.layout === "object" ? args.layout as StationPlazaLayout : undefined);
    if (region.engine.kind === "street") {
      const res = callTool(draft, "compose_jp_city_street", { mapId, seed, style: region.engine.style, replace: args.replace === true });
      const section4 = { v1Failures: 0, whitelistViolations: 0, signatureClones: 0, adjacentClones: 0, strayTrees: 0, stairEndpoints: 0 };
      return { ...res, summary: `${region.ko}(${region.ja}) - ${res.summary}`, data: { ...(res.data as Record<string, unknown> | undefined), region: info, violations: [], section4 } };
    }
    if (map.width < 40 || map.height < 28) throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${region.size[0]}×${region.size[1]} 권장, 40×28 이상으로 resize_map 한 뒤 부른다`, { code: "map-too-small", mapId });
    if (!isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 지으려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });

    // 복제본에서 지은 뒤 성공하면 반영한다 — 중간 실패로 반쯤 지운 맵이 남지 않게.
    const next: Project = { ...draft, startMapId: "", maps: { ...draft.maps, [mapId]: structuredClone(map) }, tilesets: { ...draft.tilesets, [map.tilesetId]: structuredClone(tileset) } };
    const target = next.maps[mapId]!;
    target.lowerTiles.fill(blankFillTileFor(JP_CITY_ID, 0, next.tilesets[map.tilesetId]!));
    for (let i = 0; i < target.lowerTiles.length; i++) { setLayerTileAt(target, 3, i, -1); setLayerTileAt(target, 4, i, -1); clearTileStack(target, "upper", i); }
    const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, { w: k.width, h: k.height }]));
    // 숲 구획: r3 오토타일이 있거나, 나무 composer(r4 활엽)가 있으면 paint_forest 로 칠한다. 대숲 등산로는 r4(활엽만)로 바꾸면 대숲이 사라지므로 r3 가 없을 땐 옛 키트(대숲·삼나무)로 둔다.
    const useForestAutotile = hasJpForestR3(tileset) || (hasJpForestR4(tileset) && region.id !== "bamboo_mountain_trail");
    const grounding = args.grounding !== false;
    // 동서 큰길 횡단보도 칸: 생활도로 횡단보도 키트의 줄 칸(흰 줄이 동서로 나란한 투명 덧그림)을 그대로 쓴다 — 새 그림 없음.
    const crosswalkTile = (tileset.structureKits ?? []).find((k) => k.id === "jp-road-lane-crosswalk-h")?.rows.flatMap((row) => row.upperTiles ?? []).find((t) => t >= 0);
    let plan = planJpRegionScene({ region: varied.region, mapId, width: map.width, height: map.height, seed, kitSize: (id) => kits.get(id), forestAutotile: useForestAutotile, crosswalkTile });
    for (let retry = 1; retry < 8 && plan.violations.length > 0; retry++) {
      const candidate = planJpRegionScene({ region: varied.region, mapId, width: map.width, height: map.height, seed: seed + retry, kitSize: (id) => kits.get(id), forestAutotile: useForestAutotile, crosswalkTile });
      if (candidate.violations.length < plan.violations.length) plan = candidate;
      if (plan.violations.length === 0) break;
    }
    let stamped = 0;
    let forest: ReturnType<typeof paintJpForest> | undefined;
    const failed: string[] = [];
    for (const step of plan.steps) {
      try {
        if (step.tool === "paint_forest") {
          // 숲 구획: 마스크 → 수관 오토타일 → 하늘선 → 수관 머리 → 줄기 띠(forestPainter). 3층 수관·4층 덧그림.
          const kinds = Uint8Array.from(step.args.kinds as number[]);
          forest = paintJpForest({
            width: target.width,
            height: target.height,
            getLayer: (layer, i) => layerTileAt(target, layer, i),
            setLayer: (layer, i, t) => setLayerTileAt(target, layer, i, t),
          }, next.tilesets[map.tilesetId]!, kinds, Number(step.args.seed) || 0);
          stamped++;
          continue;
        }
        if (
          step.tool === "fill_region"
          && paintJpRegionGround(target, next.tilesets[map.tilesetId]!, step.args.rect as { x: number; y: number; w: number; h: number }, String(step.args.material))
        ) {
          continue;
        }
        if (step.tool === "stamp_object") {
          const sx = Number(step.args.x), sy = Number(step.args.y);
          const kitId = String(step.args.objectId ?? "").replace(/^kit:jp_city\//, "");
          const sz = kits.get(kitId) ?? { w: 16, h: 16 };
          const saved: [number, number][] = [];
          for (let yy = Math.max(0, sy); yy < Math.min(target.height, sy + sz.h); yy++) {
            for (let xx = Math.max(0, sx); xx < Math.min(target.width, sx + sz.w); xx++) {
              const idx = yy * target.width + xx;
              const prev = target.upperTiles[idx] ?? -1;
              if (prev >= 0) saved.push([idx, prev]);
            }
          }
          callTool(next, step.tool, step.args);
          for (const [idx, prev] of saved) {
            const after = target.upperTiles[idx] ?? -1;
            if (after >= 0 && after !== prev) {
              target.upperTiles[idx] = prev;
              setLayerTileAt(target, 4, idx, after);
            }
          }
          stamped++;
          continue;
        }
        callTool(next, step.tool, step.args);
      } catch (e) {
        // 바닥 실패는 장면 전체가 틀어진다 - 멈춘다. 키트 하나 실패는 건너뛰고 알린다.
        if (step.tool === "fill_region") throw new ToolError(`${region.id} 바닥 '${String(step.args.material)}' 을 칠하지 못했다: ${(e as Error).message}`, { code: "compose-failed", mapId });
        failed.push(step.note);
      }
    }
    // r4 나무 composer: 숲 바닥만 칠해 두었다가 집·소품을 다 찍은 뒤 한 번에 나무를 세운다(수관이 집·길·물 위로 넘치지 않게).
    if (forest && hasJpForestR4(next.tilesets[map.tilesetId]!)) composeJpForestR4(target, next.tilesets[map.tilesetId]!, 0, grounding);   // 씨앗 0: 편집기 붓과 같은 배치(붓질 한 번에 둘레 나무가 바뀌지 않게)
    if (stamped === 0) throw new ToolError(`${region.id} 키트를 하나도 세우지 못했다 — 맵을 ${region.size[0]}×${region.size[1]} 로 키우거나 다른 seed 를 준다`, { code: "compose-failed", mapId });
    draft.maps[mapId] = next.maps[mapId]!;
    for (const [id, ts] of Object.entries(next.tilesets)) draft.tilesets[id] = ts;
    const startNote = claimStartIfBlank(draft, mapId, pickWalkableStart(draft, draft.maps[mapId]!)).note;
    const unplaced = Object.entries(plan.unplaced).map(([k, n]) => `${k}×${n}`);
    const warnings = [
      ...(failed.length ? [`세우다 실패한 키트 ${failed.length}개: ${[...new Set(failed)].slice(0, 6).join(", ")}`] : []),
      ...(unplaced.length ? [`자리가 없어 빠진 키트: ${unplaced.slice(0, 6).join(", ")}${unplaced.length > 6 ? " …" : ""} - 맵을 키우면 들어간다`] : []),
      ...(plan.violations.length ? [`배치 검증 위반 ${plan.violations.length}건: ${plan.violations.slice(0, 4).join("; ")}`] : []),
    ];
    return {
      summary: `${region.ko}(${region.ja}) 지역을 지었다 — 키트 ${stamped}개, 씨앗 ${seed}. 주조 팔레트 ${region.palette.join("·")}, 권장 ${region.season}/${region.timeOfDay}. show_map_region 으로 확인하고 문·이벤트를 단다.${region.alsoWith ? ` 변형: ${region.alsoWith}.` : ""}${startNote}`,
      data: { mapId, seed, region: info, ...(varied.layout ? { layout: varied.layout } : {}), stamped, unplaced: plan.unplaced, failed, violations: plan.violations, section4: plan.section4, ...(forest ? { forest } : {}) },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};
