// 조수 v2 일본 도시(jp_city) 빌더 — PlaceSpec(street·house, village+jp-modern) → v1 결정론 도구 인자.
//   거리: compose_jp_city_street(상가·주택가·시타마치·쇼텐가이) 또는 compose_jp_region(학교·역·신사… 지역 30종).
//         요청한 소품(자판기·공원·횡단보도…)은 거리 계획(planJpCityStreet, 순수 함수)을 씨앗별로 미리 보고 다 들어가는 씨앗을 고른다.
//   집:   build_hand_interior_room({tileset:"jp_city", layout:{program}}) — 일본 집·가게 실내 예제 구성. 2층이면 위층을 짓고 계단을 잇는다.
// 모델은 칸·좌표를 쓰지 않는다. 도구가 못 하는 것은 missingArt 로 정직하게 보고한다(대체물을 지어내지 않는다).
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { JP_REGIONS, jpRegionById } from "@/editor/jpCity/japaneseRegionsCatalog";
import { isPassable } from "@/project/collision";
import { layerTileAt } from "@/project/mapLayers";
import { JP_CITY_ID } from "@/project/defaults/jpCity";
import { planJpCityStreet, type JpStreetStyle } from "@/project/jpCityStreetComposer";
import type { GameMap, Project } from "@/project/types";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../types";

/** v2 계획 모델에게 주는 일본 도시 지식(≤900자). */
export const JP_CITY_CARD =
  "[일본 현대 type:street|house, style jp-modern] street=거리 한 장. features 낱말: shops/상점가(상가)·houses/주택가·alley/골목(시타마치)·arcade(아케이드 상점가)·" +
  "가게 konbini·izakaya·ramen·cafe·sento·bento·machiya·apartment·office·garage, 소품 vending/자판기·park/공원·crosswalk/횡단보도·signal·bus stop·post box·river/다리·bench·sakura·bicycle·car·lamp. " +
  "한 맵=지역 하나: station/역전·school/학교·university·shrine/신사·temple/절·castle·rail crossing/건널목·danchi·onsen·harbor·beach·rice terraces·mountain trail·festival·museum·yokocho·office district·canal (넣으면 그 지역 문법). " +
  "size small 40×28·medium 48×36·large 60×48. house=집·가게 실내 하나: 다다미/옛집(平屋)·단독주택(floors 2면 2층+계단)·원룸·맨션·편의점·라멘·이자카야·초밥·찻집·빵집·서점·약국·꽃집·센토·파출소·의원·우체국·학교·역·료칸·노래방… " +
  "zones kind 로 방(ldk·washitsu·bedroom·kitchen·genkan·bath·toilet·study) 직접 지정 가능. 거리와 실내 잇기·사람·탑·지하철 노선은 못 함(보고됨). hints: seed·variant·region·style·parkForest. 역전(station)은 짜임을 직접 고른다: hints.length short|medium|long, hints.plaza rotary|crossing|square, hints.landmark fountain|hachiko|clock|zelkova|kiosk, hints.shops 「books,cafe,…」(books·cafe·pharmacy·ramen·bakery·izakaya·sushi·soba·teishoku·flower·barber·cleaning·wagashi·conbini·parking·office 중 4~7곳 순서대로), hints.mirror — 요청이 정한 것만 넣는다(횡단보도는 어느 꼴에나 있다). 말하지 않은 손잡이는 비워 둔다 — 비우면 판마다 다르게 짜고, 채우면 같은 요청이 늘 같은 거리가 된다.";

type Rule = readonly [RegExp, string];
const has = (text: string, re: RegExp): boolean => re.test(text);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const KNOWN_HINTS = new Set(["seed", "variant", "region", "style", "parkForest", "width", "height", "program", "length", "plaza", "landmark", "shops", "mirror"]);

/** 한 장에 한 지역 — 거리 조합기가 아니라 지역 문법(compose_jp_region)으로 짓는 낱말. 앞이 우선. */
const REGION_RULES: readonly Rule[] = [
  [/rail(?:road|way)?\s*crossing|level crossing|건널목|踏切|철길|선로/i, "rail_crossing_neighborhood"],
  [/abandoned (?:rail|track)|폐선|폐철도/i, "abandoned_forest_railway"],
  [/rural station|무인역|간이역/i, "rural_wayside_station"],
  [/station|역전|기차역|전철역|(?:^|\s)역(?:$|\s)|駅/i, "station_plaza"],
  [/university|대학/i, "university_avenue"],
  [/school|학교|校/i, "high_school_grounds"],
  [/shrine|신사|神社|torii|도리이/i, "torii_shrine_precinct"],
  [/temple|pagoda|사찰|(?:^|\s)절(?:$|\s)|寺|오중탑/i, "buddhist_temple_pagoda"],
  [/castle|천수각|성곽|해자|城/i, "castle_moat_ruins"],
  [/ruins|유적/i, "ancient_stone_ruins"],
  [/jizo|지조/i, "jizo_mountain_pass"],
  [/danchi|단치|団地|아파트 단지/i, "danchi_complex"],
  [/onsen|온천|ryokan|료칸/i, "onsen_ryokan_town"],
  [/harbou?r|항구|어시장|방파제|등대|fishing/i, "fishing_harbor_market"],
  [/beach|seaside|해변|해안|모래사장/i, "coastal_seaside_road"],
  [/rice|논밭|다랑논|terrace/i, "terraced_rice_village"],
  [/bamboo|mountain trail|등산로|대나무숲|삼나무/i, "bamboo_mountain_trail"],
  [/ropeway|케이블카|전망대/i, "mountain_ropeway_lookout"],
  [/gorge|waterfall|계곡|폭포/i, "gorge_waterfall_trail"],
  [/marsh|습원|boardwalk/i, "alpine_marsh_boardwalk"],
  [/festival|matsuri|마츠리|축제|야시장/i, "matsuri_festival_grounds"],
  [/museum|library|도서관|박물관|미술관/i, "civic_museum_plaza"],
  [/yokocho|요코초|포장마차/i, "yokocho_alley"],
  [/business district|office district|오피스 거리|빌딩 거리|은행 거리/i, "business_district"],
  [/canal|운하/i, "canal_promenade"],
  [/slope|stair town|언덕길|계단 마을/i, "slope_stair_town"],
  [/machiya quarter|보존지구|전통 거리/i, "machiya_quarter"],
  [/quiet residential|한적한/i, "quiet_residential"],
];

/** 거리 조합기의 가게 낱말 → shops 값. */
const SHOP_RULES: readonly Rule[] = [
  [/konbini|convenience|편의점|コンビニ/i, "konbini"], [/izakaya|이자카야|居酒屋|선술집/i, "izakaya"], [/ramen|라멘|라면/i, "ramen"],
  [/cafe|café|coffee|kissaten|카페|찻집|喫茶/i, "cafe"], [/sento|bathhouse|목욕탕|센토|銭湯/i, "sento"], [/bento|도시락|弁当/i, "bento"],
  [/machiya|마치야|町家/i, "machiya"], [/apartment|아파트/i, "apartment"], [/office|사무실|오피스/i, "office"], [/garage|차고/i, "garage"],
];

/** 계획에서 확인할 수 있는 거리 소품 — 계획의 찍기 id 또는 공원 구획으로 확인한다. */
const PROP_RULES: readonly (readonly [RegExp, string, (plan: PlanView) => boolean])[] = [
  [/vending|자판기|自販機/i, "자판기", (p) => p.ids.some((id) => /vending/.test(id))],
  [/park|공원|놀이터|playground/i, "공원", (p) => p.parks > 0],
  [/crosswalk|zebra|횡단보도|crossing|교차로/i, "횡단보도", (p) => p.ids.some((id) => /crosswalk/.test(id))],
  [/signal|traffic light|신호등/i, "신호등", (p) => p.ids.some((id) => /signal/.test(id))],
  [/bus\s*stop|버스\s*정류장|정류장/i, "버스 정류장", (p) => p.ids.some((id) => /bus-stop/.test(id))],
  [/post\s*box|mailbox|우체통/i, "우체통", (p) => p.ids.some((id) => /post-?box/.test(id))],
  [/river|stream|하천|개천|(?:^|\s)강(?:$|\s)|강가/i, "하천", (p) => p.ids.some((id) => /jp-river/.test(id))],
  [/bridge|다리/i, "다리", (p) => p.ids.some((id) => /bridge/.test(id))],
  [/bench|벤치/i, "벤치", (p) => p.ids.some((id) => /bench/.test(id))],
  [/sakura|cherry|벚/i, "벚나무", (p) => p.ids.some((id) => /sakura/.test(id))],
  [/bicycle|bike|자전거/i, "자전거", (p) => p.ids.some((id) => /bike/.test(id))],
  [/\bcars?\b|자동차|주차|parking|taxi|택시/i, "자동차", (p) => p.ids.some((id) => /car-|parking|coin/.test(id))],
  [/lamp|street\s*light|가로등/i, "가로등", (p) => p.ids.some((id) => /lamp|lantern-post/.test(id))],
  [/street trees?|가로수|trees?|나무/i, "가로수", (p) => p.ids.some((id) => /tree-/.test(id))],
  [/nobori|깃발|노보리/i, "노보리", (p) => p.ids.some((id) => /nobori|street-flag/.test(id))],
  [/supermarket|슈퍼/i, "슈퍼마켓 건물", (p) => p.ids.some((id) => /supermarket/.test(id))],
  [/clinic|의원|병원/i, "의원 건물", (p) => p.ids.some((id) => /clinic/.test(id))],
  [/post office|우체국/i, "우체국 건물", (p) => p.ids.some((id) => /post-office/.test(id))],
  [/mansion|맨션/i, "맨션", (p) => p.ids.some((id) => /mansion/.test(id))],
];
/** 거리 짜임을 정하는 낱말(소품이 아님 — 확인 대상 아님). */
const STYLE_WORDS = /shops?|shopping|store|상점가|상가|가게|shotengai|arcade|아케이드|商店街|alley|골목|shitamachi|시타마치|下町|houses?|주택|residential|집|street|거리|town|downtown|도시|동네|city|modern|jp-modern|modern-city|일본/i;
/** 이 빌더가 못 짓는 것 — 그대로 missingArt. */
const UNSUPPORTED: readonly Rule[] = [
  [/tower|타워/i, "탑·타워(거리 도구에 없음)"], [/subway|metro|지하철/i, "지하철 노선(거리 조합기에 없음 — set_map_transit 별도)"],
  [/hospital|종합병원/i, "종합병원 외관(거리 조합기에 없음)"], [/mall|쇼핑몰|백화점|department/i, "쇼핑몰·백화점 외관(거리 조합기에 없음)"],
  [/people|npc|사람|주민|행인|손님/i, "사람·NPC(장소 빌더는 사람을 놓지 않음 — add_people)"], [/interior|실내|들어가|link/i, "거리 건물과 실내 잇기(이 빌더는 거리만 — link_jp_city_interior 별도)"],
  [/highway|고속도로/i, "고속도로"], [/airport|공항/i, "공항"], [/snow|눈 내린|설경/i, "눈 덮인 거리(계절 변형 없음)"],
];

interface PlanView { ids: string[]; parks: number }

const textOf = (spec: PlaceSpec): string => [spec.name, spec.style, spec.theme, ...(spec.features ?? []), ...(spec.zones ?? []).map((z) => `${z.kind} ${z.purpose ?? ""} ${(z.anchors ?? []).join(" ")}`)].join(" ");
/** 요청 낱말 목록(features·zones). 이름은 거리 짜임·지역 판단에만 쓰고, 소품 확인은 낱말별로 한다. */
const requestedWords = (spec: PlaceSpec): string[] => [...(spec.features ?? []), ...(spec.zones ?? []).flatMap((z) => [z.kind, ...(z.anchors ?? [])])].map((w) => String(w).trim()).filter(Boolean);

/** 역전 짜임 손잡이(hints 의 낱값) → compose_jp_region layout. */
function stationLayout(spec: PlaceSpec): Record<string, unknown> {
  const h = spec.hints ?? {};
  const out: Record<string, unknown> = {};
  if (typeof h.plaza === "string") out.plaza = h.plaza;
  if (typeof h.landmark === "string") out.landmark = h.landmark;
  if (typeof h.shops === "string") out.shops = h.shops.split(/[,\s·]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (typeof h.mirror === "boolean") out.mirror = h.mirror;
  return out;
}

function pickRegion(spec: PlaceSpec, text: string): { region?: string; others: string[] } {
  const asked = typeof spec.hints?.region === "string" ? spec.hints.region : undefined;
  if (asked && jpRegionById(asked)) return { region: asked, others: [] };
  const hits = REGION_RULES.filter(([re]) => has(text, re)).map(([, id]) => id);
  const uniq = [...new Set(hits)];
  return { region: uniq[0], others: uniq.slice(1) };
}

function pickStyle(spec: PlaceSpec, text: string): JpStreetStyle {
  const s = spec.hints?.style;
  if (s === "shopping" || s === "residential" || s === "shitamachi" || s === "shotengai") return s;
  if (has(text, /shotengai|arcade|아케이드|商店街/i)) return "shotengai";
  if (has(text, /shitamachi|下町|시타마치|alley|골목/i)) return "shitamachi";
  const shops = has(text, /shop|store|상점|상가|가게|market|konbini|편의점|izakaya|ramen|cafe|카페|이자카야|라멘/i);
  if (!shops && has(text, /house|주택|residential|집|park|공원/i)) return "residential";
  return "shopping";
}

const SIZES: Record<string, [number, number]> = { small: [40, 28], medium: [48, 36], large: [60, 48] };

function planView(mapId: string, w: number, h: number, seed: number, style: JpStreetStyle, shops: string[]): PlanView {
  const plan = planJpCityStreet({ mapId, width: w, height: h, seed, style, shops });
  const ids = plan.steps.filter((s) => s.tool === "stamp_object" || s.tool === "build_jp_city_building").map((s) => String((s.args as Record<string, unknown>).objectId ?? (s.args as Record<string, unknown>).kind ?? (s.args as Record<string, unknown>).preset ?? ""));
  return { ids, parks: plan.parks?.length ?? 0 };
}

interface JpState { readonly kind: "street" | "region" | "house"; readonly baseSeed: number; readonly seed: number; readonly args: Record<string, unknown>; readonly upperMapId?: string }

/** 지을 맵: 이전 기록 → spec.mapId → 지금 맵이 빈 맵이면 그 맵 → 없음(새 맵). */
function targetMap(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): string | undefined {
  if (previous?.result.mapIds[0] && run.ctx.project.maps[previous.result.mapIds[0]]) return previous.result.mapIds[0];
  if (spec.mapId && run.ctx.project.maps[spec.mapId]) return spec.mapId;
  const cur = run.ctx.currentMapId ? run.ctx.project.maps[run.ctx.currentMapId] : undefined;
  if (cur && isBlankMap(cur)) return cur.id;
  return undefined;
}

/** 거리 줄(walkRows) 위의 걸음 칸 — 가운데에 가까운 것. 없으면 가장 큰 걸음 덩이에서 가운데에 가까운 칸. */
function roadCell(project: Project, map: GameMap, rows: readonly number[]): { x: number; y: number } | undefined {
  // 맨땅 우선: 위층(3·4층)·위층 겹침·이벤트가 없는 걸음 칸 — 분수 꼭대기·나무 수관 밑 같은 「걸을 수는 있는」 칸에 서지 않게.
  const bare = (x: number, y: number) => {
    const i = y * map.width + x;
    return isPassable(project, map, x, y) && layerTileAt(map, 3, i) < 0 && layerTileAt(map, 4, i) < 0 && !map.upperTileStacks?.[i] && !(map.events ?? []).some((e) => e.x === x && e.y === y);
  };
  return cellWhere(map, rows, bare) ?? cellWhere(map, rows, (x, y) => isPassable(project, map, x, y));
}

function cellWhere(map: GameMap, rows: readonly number[], ok: (x: number, y: number) => boolean): { x: number; y: number } | undefined {
  const cx = Math.floor(map.width / 2);
  for (const y of rows) {
    if (y < 0 || y >= map.height) continue;
    for (let d = 0; d < map.width; d++) for (const x of [cx + d, cx - d]) if (x >= 0 && x < map.width && ok(x, y)) return { x, y };
  }
  const seen = new Uint8Array(map.width * map.height);
  let best: { x: number; y: number; size: number; dist: number } | undefined;
  for (let i = 0; i < seen.length; i++) {
    const sx = i % map.width, sy = Math.floor(i / map.width);
    if (seen[i] || !ok(sx, sy)) continue;
    const comp: number[] = [i]; seen[i] = 1;
    for (let k = 0; k < comp.length; k++) {
      const c = comp[k]!, x = c % map.width, y = Math.floor(c / map.width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy, ni = ny * map.width + nx;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen[ni] || !ok(nx, ny)) continue;
        seen[ni] = 1; comp.push(ni);
      }
    }
    if (best && comp.length < best.size) continue;
    let pick = comp[0]!, dist = Infinity;
    for (const c of comp) { const dd = Math.abs((c % map.width) - cx) + Math.abs(Math.floor(c / map.width) - Math.floor(map.height / 2)); if (dd < dist) { dist = dd; pick = c; } }
    if (!best || comp.length > best.size) best = { x: pick % map.width, y: Math.floor(pick / map.width), size: comp.length, dist };
  }
  return best ? { x: best.x, y: best.y } : undefined;
}

/** 시작 칸이 이 맵이면 걸음 칸(거리 줄)으로 맞추고, 들어오는 칸을 돌려준다. */
function settleEntrance(run: BuildRun, mapId: string, rows: readonly number[], warnings: string[]): { mapId: string; x: number; y: number } | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map) return undefined;
  const start = project.startPos;
  // 거리 줄을 아는 거리 맵만 지금 시작 칸을 믿는다. 지역 맵은 도구가 고른 칸이 고가선 위·구석일 수 있어 가장 큰 걸음 덩이의 가운데로 맞춘다.
  if (project.startMapId === mapId && start && rows.includes(start.y) && isPassable(project, map, start.x, start.y)) return { mapId, x: start.x, y: start.y };
  const cell = roadCell(project, map, rows);
  if (!cell) { warnings.push("걸을 수 있는 칸을 찾지 못했다"); return undefined; }
  if (project.startMapId === mapId && (start?.x !== cell.x || start?.y !== cell.y)) run.call("set_start_position", { mapId, x: cell.x, y: cell.y });
  return { mapId, ...cell };
}

/** jp_city 맵 준비: 대상이 빈 다른 칩셋 맵이면 칩셋을 바꾸고 크기를 맞춘다. 없거나 쓸 수 없으면 새 맵. */
function prepareStreetMap(run: BuildRun, spec: PlaceSpec, target: string | undefined, w: number, h: number, warnings: string[]): string | undefined {
  const project = run.ctx.project;
  const map = target ? project.maps[target] : undefined;
  if (map && map.tilesetId === JP_CITY_ID) {
    if (map.width !== w || map.height !== h) run.call("resize_map", { mapId: map.id, width: w, height: h });
    return map.id;
  }
  // 빈 다른 칩셋 맵(빈 시작 맵): 칩셋만 바꾸면 옛 바탕 칸이 jp_city 에서 막힌 칸이 된다 — 지우고 같은 id 로 jp_city 맵을 새로 만든다.
  let reuseId: string | undefined;
  let spare: string | undefined;
  if (map && isBlankMap(map)) {
    // 시작 맵은 마지막 한 장이면 못 지운다 — 작은 임시 맵을 하나 두고 지운 뒤, 같은 id 로 다시 만들고 임시 맵을 지운다.
    const tmp = run.call("create_map", { name: "임시", width: 3, height: 3, tilesetId: JP_CITY_ID });
    spare = tmp.ok ? (tmp.data as { mapId?: string } | undefined)?.mapId : undefined;
    if (run.call("remove_map", { mapId: map.id }).ok) reuseId = map.id;
    else warnings.push(`빈 맵 ${map.id} 를 비우지 못해 새 맵에 지었다`);
  } else if (map) warnings.push(`맵 ${map.id} 는 다른 칩셋(${map.tilesetId})의 손댄 맵이라 덮지 않고 새 맵에 지었다`);
  const made = run.call("create_map", { name: spec.name, width: w, height: h, tilesetId: JP_CITY_ID, ...(reuseId ? { id: reuseId } : {}) });
  const id = (made.data as { mapId?: string } | undefined)?.mapId;
  if (spare && run.ctx.project.maps[spare]) run.call("remove_map", { mapId: spare });
  return made.ok && typeof id === "string" ? id : undefined;
}

function buildStreet(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const warnings: string[] = [];
  const missing: string[] = [];
  const prev = previous?.result.state as JpState | undefined;
  const text = textOf(spec);
  for (const key of Object.keys(spec.hints ?? {})) if (!KNOWN_HINTS.has(key)) warnings.push(`알 수 없는 hints.${key} 는 무시했다`);
  for (const [re, what] of UNSUPPORTED) if (has(text, re)) missing.push(what);
  const { region, others } = pickRegion(spec, text);
  for (const id of others) missing.push(`${jpRegionById(id)?.ko ?? id}(한 맵에 지역 하나 — 따로 make_place 로 짓는다)`);
  const variant = num(spec.hints?.variant) ?? 0;
  const baseSeed = (num(spec.hints?.seed) ?? prev?.baseSeed ?? (spec.salt ?? 0) % 9973) + variant * 101;
  const sizeKey = spec.size ?? "medium";
  const words = requestedWords(spec);

  let w: number, h: number;
  const r = region ? jpRegionById(region) : undefined;
  if (r) {
    const scale = sizeKey === "small" ? 0.8 : sizeKey === "large" ? 1.25 : 1;
    w = Math.max(40, Math.round(r.size[0] * scale)); h = Math.max(28, Math.round(r.size[1] * scale));
    // 거리 길이(역전): 모델이 고른 길이 → 폭. 안 고르면 씨앗으로 셋 중 하나(늘 같은 폭이면 같은 장면으로 읽힌다).
    if (r.id === "station_plaza") {
      const len = spec.hints?.length === "short" || spec.hints?.length === "medium" || spec.hints?.length === "long" ? spec.hints.length : (["short", "medium", "long"] as const)[Math.abs(baseSeed) % 3]!;
      w = Math.round(w * ({ short: 0.85, medium: 1, long: 1.3 } as const)[len]);
    }
  } else [w, h] = SIZES[sizeKey] ?? SIZES.medium!;
  w = num(spec.hints?.width) ?? w; h = num(spec.hints?.height) ?? h;
  w = Math.max(40, Math.min(200, Math.round(w))); h = Math.max(28, Math.min(200, Math.round(h)));

  const mapId = prepareStreetMap(run, spec, targetMap(run, spec, previous), w, h, warnings);
  if (!mapId) return { ok: false, mapIds: [], summary: "jp_city 맵을 만들지 못했다", warnings, missingArt: missing, calls: run.calls.slice(first) };

  let args: Record<string, unknown>;
  let seed = baseSeed;
  let kind: JpState["kind"];
  const notRegion = (word: string) => !REGION_RULES.some(([re]) => has(word, re));
  if (r) {
    kind = "region";
    args = { mapId, region: r.id, seed, replace: true, layout: stationLayout(spec) };
    const leftovers = words.filter((wd) => notRegion(wd) && !STYLE_WORDS.test(wd) && !UNSUPPORTED.some(([re]) => has(wd, re)));
    if (leftovers.length) warnings.push(`${leftovers.join("·")} — ${r.ko} 지도는 지역 문법대로 놓아 하나씩 확인하지 않았다`);
  } else {
    kind = "street";
    const style = pickStyle(spec, text);
    const shops = [...new Set(SHOP_RULES.filter(([re]) => has(text, re)).map(([, s]) => s))];
    const wantHouses = has(text, /houses?|주택|민가/i);
    const shopsFor = (st: JpStreetStyle): string[] => (st !== "residential" && wantHouses && !shops.includes("house") ? [...shops, "house"] : shops);
    // 요청 낱말 하나하나: 소품 확인 규칙 / 짜임 낱말 / 가게 / 못 함 중 어디에도 안 걸리면 정직하게 못 함.
    const checks = new Map<string, (p: PlanView) => boolean>();
    for (const wd of words) {
      const prop = PROP_RULES.find(([re]) => has(wd, re));
      if (prop) { checks.set(prop[1], prop[2]); continue; }
      if (STYLE_WORDS.test(wd) || SHOP_RULES.some(([re]) => has(wd, re)) || UNSUPPORTED.some(([re]) => has(wd, re))) continue;
      missing.push(`${wd}(거리 조합기가 모르는 낱말)`);
    }
    // 씨앗 고르기: 같은 크기·짜임·가게로 계획을 미리 보고(순수 함수) 요청 소품이 다 들어가는 첫 씨앗. 공원은 주택가 짜임에서 더 잘 나온다.
    let bestSeed = baseSeed, bestScore = -1, bestStyle = style;
    // 요청 소품이 다 안 들어가면 다른 짜임(상가↔주택가)도 본다 — 바꿨으면 경고로 알린다.
    // 주택가·골목 요청은 상가 짜임으로 넘어가지 않는다(2026-10-23 3차: 「주택가 골목」이 이자카야·사무소 거리로 바뀌어 «집 서너 채»를 못 지켰다).
    // 소품 하나를 못 넣는 쪽이 집 거리를 상가로 바꾸는 쪽보다 낫다 — 못 넣은 소품은 missingArt 로 정직하게 알린다.
    const homey = !has(text, /shops?|shopping|store|상점|상가|가게|market|shotengai|arcade|商店街/i) && (wantHouses || style === "residential" || style === "shitamachi");
    const styles: JpStreetStyle[] = homey
      ? [style, ...(["residential", "shitamachi"] as const).filter((st) => st !== style)]
      : [style, ...(["residential", "shopping"] as const).filter((st) => st !== style)];
    outer: for (const st of styles) {
      for (let s = baseSeed; s < baseSeed + 40; s++) {
        const view = planView(mapId, w, h, s, st, shopsFor(st));
        const score = [...checks].reduce((n, [what, f]) => n + (f(view) ? (what === "공원" ? 3 : 1) : 0), 0); // 공원은 구획 하나라 소품보다 무겁다
        if (score > bestScore) { bestScore = score; bestSeed = s; bestStyle = st; }
        if (score === checks.size + (checks.has("공원") ? 2 : 0)) break outer;
      }
    }
    if (bestStyle !== style) warnings.push(`요청 소품이 ${style} 짜임에는 함께 안 들어가 ${bestStyle} 짜임으로 짰다`);
    const finalShops = shopsFor(bestStyle);
    const finalView = planView(mapId, w, h, bestSeed, bestStyle, finalShops);
    for (const [what, f] of checks) if (!f(finalView)) missing.push(`${what}(씨앗 40개 안에서 이 크기·짜임 거리에 함께 못 놓음)`);
    seed = bestSeed;
    args = { mapId, seed, style: bestStyle, replace: true, ...(finalShops.length ? { shops: finalShops } : {}),
      ...(typeof spec.hints?.parkForest === "string" ? { parkForest: spec.hints.parkForest } : {}) };
  }
  const res = run.call(kind === "region" ? "compose_jp_region" : "compose_jp_city_street", args);
  const calls = run.calls.slice(first);
  if (!res.ok) return { ok: false, mapIds: [mapId], summary: `일본 거리 짓기 실패: ${res.summary}`, warnings: [...warnings, ...(res.issues ?? []).map((i) => i.message)], missingArt: missing, calls, state: prev };
  warnings.push(...(res.warnings ?? []));
  const data = (res.data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(data.walkRows) ? (data.walkRows as number[]) : [];
  const entrance = settleEntrance(run, mapId, rows, warnings);
  const shopsBuilt = Array.isArray(data.shopsBuilt) ? (data.shopsBuilt as string[]) : [];
  const what = kind === "region" ? `${r!.ko}` : `${String(data.style ?? args.style)} 거리, 건물 ${num(data.built) ?? "?"}채·소품 ${num(data.props) ?? "?"}개`;
  const state: JpState = { kind, baseSeed: baseSeed - variant * 101, seed, args };
  return {
    ok: true, mapIds: [mapId], ...(entrance ? { entrance } : {}),
    summary: `${spec.name}: ${what} (${w}×${h}, seed ${seed})${shopsBuilt.length ? ` — 문: ${shopsBuilt.slice(0, 6).join(" · ")}` : ""}`,
    warnings, missingArt: missing, calls: run.calls.slice(first), state,
  };
}

/** 집·가게 낱말 → 실내 예제 구성(program). 앞이 우선. */
const PROGRAM_RULES: readonly Rule[] = [
  [/konbini|convenience|편의점|コンビニ/i, "konbini"], [/supermarket|슈퍼/i, "supermarket"], [/ramen|라멘|라면/i, "ramen"], [/izakaya|이자카야|居酒屋|선술집/i, "izakaya"],
  [/sushi|초밥|스시/i, "sushi"], [/gyudon|규동/i, "gyudon"], [/famires|family restaurant|패밀리 레스토랑|ファミレス/i, "famires"], [/manga|만화/i, "manga-cafe"],
  [/kissaten|cafe|café|coffee|찻집|카페|喫茶/i, "kissaten"], [/bakery|빵/i, "bakery"], [/book|서점/i, "bookstore"], [/pharmacy|약국/i, "pharmacy"], [/flor|꽃집/i, "florist"],
  [/yaoya|greengrocer|채소|八百屋/i, "yaoya"], [/barber|이발|미용/i, "barber"], [/sento|bathhouse|목욕탕|센토|銭湯/i, "sento"], [/laundry|세탁|빨래방/i, "laundry"],
  [/koban|police|파출소|交番/i, "koban"], [/karaoke|노래방/i, "karaoke"], [/game center|arcade|오락실|게임 ?센터/i, "game-center"], [/pachinko|파친코/i, "pachinko"],
  [/cinema|movie|영화관/i, "cinema"], [/ryokan|료칸/i, "ryokan"], [/hotel|호텔/i, "business-hotel-1f"], [/hospital|병원/i, "hospital-1f"], [/clinic|의원|내과/i, "clinic"],
  [/bank|은행/i, "bank"], [/library|도서관/i, "public-library"], [/city hall|시청/i, "city-hall"], [/museum|gallery|미술관|박물관/i, "museum-gallery"], [/mall|쇼핑몰/i, "mall-1f"],
  [/post office|우체국/i, "post-office"], [/kindergarten|유치원/i, "kindergarten"], [/gym|체육관/i, "gym"], [/classroom|교실/i, "school-2f"], [/school|학교/i, "school-1f"],
  [/platform|승강장/i, "station-platform"], [/train car|전철 안|차내/i, "train-car"], [/station|역사|(?:^|\s)역(?:$|\s)|駅/i, "station"], [/office|사무실|오피스|회사/i, "office-1f"],
  [/mansion lobby|맨션 로비/i, "mansion-lobby"], [/mansion|2ldk|맨션/i, "mansion-2ldk"], [/mokuchin|목조 아파트|木造/i, "mokuchin"], [/one ?room|1k|원룸|아파트|apartment/i, "apartment-1k"],
  [/tatami|다다미|hiraya|平屋|옛집|단층|old house|민가|washitsu|화실/i, "hiraya"], [/house|집|주택|단독|home/i, "house-1f"],
];
const UPPER_FLOOR: Record<string, string> = { "house-1f": "house-2f", "school-1f": "school-2f", "office-1f": "office-floor", "mall-1f": "mall-2f", "hospital-1f": "hospital-2f", "business-hotel-1f": "business-hotel-floor" };
/** zones.kind 로 직접 줄 수 있는 일본 집 방 종류(list_hand_interior_parts roomKinds 의 집 쪽). */
const ROOM_KINDS = new Set(["toilet", "kitchen", "hall", "dressing", "ldk", "genkan", "bath", "kids", "washitsu", "bedroom", "study", "oneroom", "unitbath"]);
const ROOM_ALIASES: Record<string, string> = { living: "ldk", "living room": "ldk", 거실: "ldk", 부엌: "kitchen", 주방: "kitchen", 현관: "genkan", entrance: "genkan", 복도: "hall", corridor: "hall", 욕실: "bath", bathroom: "bath", 화장실: "toilet", 침실: "bedroom", 서재: "study", 다다미방: "washitsu", tatami: "washitsu", 화실: "washitsu", 아이방: "kids", 탈의실: "dressing" };

function buildHouse(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const warnings: string[] = [];
  const missing: string[] = [];
  const prev = previous?.result.state as JpState | undefined;
  for (const key of Object.keys(spec.hints ?? {})) if (!KNOWN_HINTS.has(key)) warnings.push(`알 수 없는 hints.${key} 는 무시했다`);
  const text = textOf(spec);
  const variant = num(spec.hints?.variant) ?? 0;
  const baseSeed = Math.max(1, (num(spec.hints?.seed) ?? prev?.baseSeed ?? 1 + (spec.salt ?? 0) % 9973) + variant * 101);
  // 방 직접 지정(zones.kind 가 일본 집 방 종류) — 아니면 낱말로 예제 구성을 고른다.
  const roomZones = (spec.zones ?? []).filter((z) => z.floor === undefined || z.floor === 1).map((z) => ROOM_ALIASES[z.kind.toLowerCase()] ?? z.kind.toLowerCase());
  const customRooms = roomZones.length > 0 && roomZones.every((k) => ROOM_KINDS.has(k));
  if (roomZones.length && !customRooms) for (const k of roomZones) if (!ROOM_KINDS.has(k)) missing.push(`${k} 방(일본 집 방 종류에 없음 — 예제 구성으로 지었다)`);
  const program = typeof spec.hints?.program === "string" ? spec.hints.program : PROGRAM_RULES.find(([re]) => has(text, re))?.[1] ?? "house-1f";
  for (const z of spec.zones ?? []) for (const a of z.anchors ?? []) missing.push(`${a}(주인공 물건 지정은 일본 실내 예제 구성에서 못 함 — 견본 가구 한 벌)`);
  for (const f of spec.features ?? []) if (!PROGRAM_RULES.some(([re]) => has(f, re))) missing.push(`${f}(일본 실내 예제 구성이 모르는 낱말)`);
  if (spec.exits?.some((e) => e !== "south")) missing.push("남쪽 말고 다른 출구(손 도트 실내는 남쪽 출구만)");

  const target = targetMap(run, spec, previous);
  const layout: Record<string, unknown> = customRooms
    ? { rooms: roomZones.map((kind, i) => ({ id: `${kind}${i + 1}`, kind })), seed: baseSeed }
    : { program, seed: baseSeed };
  const base: Record<string, unknown> = { tileset: JP_CITY_ID, name: spec.name, layout, ...(target ? { mapId: target, replace: true } : {}) };
  let res = run.call("build_hand_interior_room", base);
  if (!res.ok && target) res = run.call("build_hand_interior_room", { ...base, mapId: undefined, replace: undefined });
  if (!res.ok) return { ok: false, mapIds: [], summary: `일본 실내 짓기 실패: ${res.summary}`, warnings, missingArt: missing, calls: run.calls.slice(first), state: prev };
  const data = (res.data ?? {}) as Record<string, unknown>;
  const mapId = String(data.mapId);
  const mapIds = [mapId];
  warnings.push(...(res.warnings ?? []));
  let upperMapId: string | undefined;
  const upper = UPPER_FLOOR[program];
  const wantUpper = (spec.floors ?? 1) >= 2 || (spec.zones ?? []).some((z) => (z.floor ?? 1) >= 2);
  if (wantUpper && (!upper || customRooms)) missing.push(`위층(${customRooms ? "방 직접 지정" : program} 은 위층 예제 구성이 없음)`);
  if (wantUpper && upper && !customRooms) {
    const stair = (Array.isArray(data.travel) ? data.travel as { x: number; y: number }[] : [])[0];
    const prevUp = prev?.upperMapId && run.ctx.project.maps[prev.upperMapId] ? prev.upperMapId : undefined;
    const upBase: Record<string, unknown> = { tileset: JP_CITY_ID, name: `${spec.name} 2층`, layout: { program: upper, seed: baseSeed }, ...(prevUp ? { mapId: prevUp, replace: true } : {}) };
    const up = stair ? run.call("build_hand_interior_room", upBase) : undefined;
    const ud = (up?.data ?? {}) as Record<string, unknown>;
    const upStair = (Array.isArray(ud.travel) ? ud.travel as { x: number; y: number }[] : [])[0];
    const upEntry = (Array.isArray(ud.entrance) ? ud.entrance as { x: number; y: number }[] : [])[0];
    if (!stair) missing.push("위층(1층에 올라가는 계단이 없다)");
    else if (!up?.ok || !upStair || !upEntry) missing.push(`위층 짓기 실패: ${String(up?.summary ?? "").slice(0, 120)}`);
    else {
      upperMapId = String(ud.mapId);
      // 계단 잇기: 1층 계단 칸 → 위층 도착 칸, 위층 계단 구멍 → 1층 계단 곁 걸음 칸(계단 칸 자신은 피한다 — 다시 밟으면 되돌아간다).
      const f1 = run.ctx.project.maps[mapId]!;
      const landing = [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [0, 2]].map(([dx, dy]) => ({ x: stair.x + dx!, y: stair.y + dy! }))
        .find((c) => c.x >= 0 && c.y >= 0 && c.x < f1.width && c.y < f1.height && isPassable(run.ctx.project, f1, c.x, c.y));
      const down = landing ? run.call("build_hand_interior_room", { ...upBase, mapId: upperMapId, replace: true, links: [{ x: upStair.x, y: upStair.y, toMapId: mapId, toX: landing.x, toY: landing.y, direction: "down" }] }) : undefined;
      const upLink = down?.ok ? run.call("build_hand_interior_room", { ...base, mapId, replace: true, links: [{ x: stair.x, y: stair.y, toMapId: upperMapId, toX: upEntry.x, toY: upEntry.y, direction: "up" }] }) : undefined;
      if (down?.ok && upLink?.ok) mapIds.push(upperMapId);
      else {
        missing.push(`위층 계단 잇기 실패: ${landing ? String((down?.ok ? upLink : down)?.summary ?? "").slice(0, 120) : "1층 계단 곁에 내릴 칸이 없다"}`);
        // 잇지 못한 위층은 고아 맵으로 남기지 않는다(이전 짓기에서 이어 둔 위층이었으면 그대로 둔다).
        if (!prevUp && run.ctx.project.maps[upperMapId]) run.call("remove_map", { mapId: upperMapId });
        upperMapId = prevUp;
      }
    }
  }
  // 들어오는 칸: 출입구 틈 바로 위(틈은 나가는 자리). 시작 맵이면 시작 칸도 거기로.
  const map = run.ctx.project.maps[mapId]!;
  const ent = (Array.isArray(data.entrance) ? data.entrance as { x: number; y: number }[] : [])[0];
  let entrance: { mapId: string; x: number; y: number } | undefined;
  if (ent) {
    const inside = [{ x: ent.x, y: ent.y - 1 }, ent].find((c) => c.y >= 0 && isPassable(run.ctx.project, map, c.x, c.y)) ?? ent;
    entrance = { mapId, ...inside };
    const sp = run.ctx.project.startPos;
    if (run.ctx.project.startMapId === mapId && (!sp || sp.x !== inside.x || sp.y !== inside.y)) run.call("set_start_position", { mapId, x: inside.x, y: inside.y });
  }
  const state: JpState = { kind: "house", baseSeed: baseSeed - variant * 101, seed: baseSeed, args: base, ...(upperMapId ? { upperMapId } : {}) };
  const label = customRooms ? `방 ${roomZones.join("·")}` : `예제 구성 ${program}`;
  return {
    ok: true, mapIds, ...(entrance ? { entrance } : {}),
    summary: `${spec.name}: 일본 실내 ${label} (${num(data.width)}×${num(data.height)}, seed ${baseSeed})${mapIds.length > 1 ? ` + 위층 ${mapIds[1]}(계단 이음)` : ""}`,
    warnings, missingArt: missing, calls: run.calls.slice(first), state,
  };
}

const JP_STYLE = /jp-modern|modern-city|japan|일본/i;

export const JP_CITY_BUILDER: PlaceBuilder = {
  id: "jp-city",
  accepts: (spec) => spec.type === "street" || spec.type === "house" || (spec.type === "village" && JP_STYLE.test(spec.style ?? "")),
  build: (run, spec, previous) => (spec.type === "house" ? buildHouse(run, spec, previous) : buildStreet(run, spec, previous)),
};

/** 카드·검사용: 지역 id 목록(이 빌더가 아는 것). */
export const JP_CITY_REGION_IDS: readonly string[] = JP_REGIONS.map((r) => r.id);
