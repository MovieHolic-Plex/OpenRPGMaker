// 조수 v2 한국 현대 도시 빌더 — 「현대 한국·서울」 요청의 거리·실내를 modern_city 칩셋으로 짓는다.
//   거리: compose_modern_city_street({korean:true}) — 한글 입간판·점자 블록·버스 쉘터. 일본 거리(jp_city)는 역 이름·간판이 가나라 한국 배경에 못 쓴다
//         (2026-10-25 조수만으로 게임 만들기 G8: 「현대 한국」 연애 게임 거리에 「さくら駅」).
//   실내: build_hand_interior_room({tileset:"modern_city", layout:{program}}) — 카페(바 카운터·좌석)·편의점·지하철역·사무실…
//         (G9: 카페 「온기」가 일본 집 거실 ldk 10×7 로 지어졌다).
// 모델은 칸·좌표를 쓰지 않는다. 못 하는 것은 missingArt 로 정직하게 보고한다.
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { isPassable } from "@/project/collision";
import type { Project } from "@/project/types";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../types";

const MODERN_CITY_ID = "modern_city";

/** 한국 현대 배경 낱말 — 요청 원문이나 명세에 있으면 거리·집을 이 빌더가 맡는다. 「조선」 같은 옛 한국은 아니다. */
export const KR_MODERN_WORDS = /kr-modern|korea|서울|부산|인천|대구|대전|홍대|강남|명동|신촌|이태원|성수|현대\s*한국|한국\s*(?:현대|도시|거리|동네|배경)|한국의\s*(?:도시|거리|동네)/iu;

/** make_place·make_game 이 원문 요청을 보고 명세에 문화권 표시를 붙인다(계획 모델이 style 을 빠뜨려도 일본 거리로 새지 않게). */
export function localizePlaceSpec<T extends PlaceSpec>(spec: T, task: string): T {
  if (spec.type !== "street" && spec.type !== "house") return spec;
  if (/jp-modern|japan|일본|fantasy|판타지|wizard|sengoku/iu.test(spec.style ?? "")) return spec;
  if (!KR_MODERN_WORDS.test(task) && !KR_MODERN_WORDS.test(`${spec.name} ${spec.style ?? ""} ${spec.theme ?? ""}`)) return spec;
  return /kr-modern/iu.test(spec.style ?? "") ? spec : { ...spec, style: spec.style ? `${spec.style} kr-modern` : "kr-modern" };
}

export const MODERN_KR_CARD =
  "[한국 현대 type:street|house, style kr-modern] 서울·현대 한국 배경이면 style 에 kr-modern 을 넣는다(일본 거리·일본 집으로 짓지 않는다). " +
  "street=한국 도시 거리 한 장(60×48: 차도·교차로·횡단보도·한글 입간판·버스 쉘터·공원·건물 문). features 가게 낱말: 편의점·카페·은행·병원·사무실·호텔·백화점·아파트·주택·빵집·우체국·경찰서. " +
  "house=그 도시의 실내 하나: 카페(바 카운터·좌석)·편의점·지하철역·사무실·아파트·빌딩 로비·은행·병원·마트·백화점·영화관·식당·미술관·도서관·시청·의원·빵집 카페·창고. hints.program 으로 직접 고를 수도 있다.";

type Rule = readonly [RegExp, string];
const has = (text: string, re: RegExp): boolean => re.test(text);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const textOf = (spec: PlaceSpec): string => [spec.name, spec.theme, ...(spec.features ?? []), ...(spec.zones ?? []).map((z) => `${z.kind} ${z.purpose ?? ""}`)].join(" ");

/** 실내 낱말 → modern_city 예제 구성(program). 앞이 우선 — 이름 낱말이 방 종류(zones)보다 먼저다. */
const PROGRAM_RULES: readonly Rule[] = [
  [/bakery|빵집|베이커리/i, "mc_bakery_cafe"], [/cafe|café|coffee|카페|커피|찻집|바리스타/i, "cafe"], [/konbini|convenience|편의점/i, "konbini"],
  [/subway|metro|지하철|전철|승강장|역사|(?:^|\s)역(?:$|\s)/i, "subway-station"], [/concourse|대합실|환승/i, "concourse"],
  [/department|백화점/i, "department-store"], [/super|mart|마트|슈퍼/i, "supermarket-mart"], [/hospital|병원|병동/i, "hospital-ward"], [/clinic|의원|내과|치과/i, "clinic"],
  [/cinema|movie|영화관|오락실|arcade/i, "cinema-arcade"], [/restaurant|bar|식당|레스토랑|술집|(?:^|\s)바(?:$|\s)/i, "restaurant-bar"], [/museum|gallery|미술관|박물관/i, "museum-gallery"],
  [/library|도서관/i, "library"], [/city hall|시청|구청|주민센터/i, "city-hall"], [/bank|은행/i, "bank"], [/office|사무실|오피스|회사/i, "office-floor"],
  [/lobby|로비/i, "lobby"], [/warehouse|창고/i, "warehouse"], [/apartment|아파트|원룸|오피스텔|집|자취|방|home|house/i, "apartment"],
];

function targetMap(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): string | undefined {
  if (previous?.result.mapIds[0] && run.ctx.project.maps[previous.result.mapIds[0]]) return previous.result.mapIds[0];
  if (spec.mapId && run.ctx.project.maps[spec.mapId]) return spec.mapId;
  const cur = run.ctx.currentMapId ? run.ctx.project.maps[run.ctx.currentMapId] : undefined;
  if (cur && isBlankMap(cur)) return cur.id;
  return undefined;
}

/** 거리 맵: 같은 칩셋이면 크기만 맞추고, 빈 다른 칩셋 맵이면 같은 id 로 다시 만든다(옛 바탕 칸이 막힌 칸이 되지 않게). */
function prepareStreetMap(run: BuildRun, spec: PlaceSpec, target: string | undefined, w: number, h: number, warnings: string[]): string | undefined {
  const project: Project = run.ctx.project;
  const map = target ? project.maps[target] : undefined;
  if (map && map.tilesetId === MODERN_CITY_ID) {
    if (map.width !== w || map.height !== h) run.call("resize_map", { mapId: map.id, width: w, height: h });
    return map.id;
  }
  let reuseId: string | undefined;
  let spare: string | undefined;
  if (map && isBlankMap(map)) {
    const tmp = run.call("create_map", { name: "임시", width: 3, height: 3, tilesetId: MODERN_CITY_ID });
    spare = tmp.ok ? (tmp.data as { mapId?: string } | undefined)?.mapId : undefined;
    if (run.call("remove_map", { mapId: map.id }).ok) reuseId = map.id;
    else warnings.push(`빈 맵 ${map.id} 를 비우지 못해 새 맵에 지었다`);
  } else if (map) warnings.push(`맵 ${map.id} 는 다른 칩셋(${map.tilesetId})의 손댄 맵이라 덮지 않고 새 맵에 지었다`);
  const made = run.call("create_map", { name: spec.name, width: w, height: h, tilesetId: MODERN_CITY_ID, ...(reuseId ? { id: reuseId } : {}) });
  const id = (made.data as { mapId?: string } | undefined)?.mapId;
  if (spare && run.ctx.project.maps[spare]) run.call("remove_map", { mapId: spare });
  return made.ok && typeof id === "string" ? id : undefined;
}

const SHOP_WORDS: readonly Rule[] = [
  [/편의점|convenience|konbini/i, "편의점"], [/카페|커피|cafe|찻집/i, "카페"], [/은행|bank/i, "은행"], [/병원|의원|hospital|clinic/i, "병원"],
  [/사무|오피스|회사|office/i, "사무실"], [/호텔|hotel/i, "호텔"], [/백화점|department/i, "백화점"], [/아파트|apartment|오피스텔/i, "아파트"],
  [/주택|house/i, "주택"], [/빵집|베이커리|bakery/i, "빵집"], [/우체국|post office/i, "우체국"], [/경찰|파출소|police/i, "경찰서"], [/창고|warehouse/i, "창고"],
];

interface KrState { readonly seed: number; readonly program?: string }

function buildStreet(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const warnings: string[] = [];
  const missing: string[] = [];
  const prev = previous?.result.state as KrState | undefined;
  const text = textOf(spec);
  const size = spec.size ?? "large";
  let [w, h] = size === "small" ? [44, 34] : size === "medium" ? [52, 40] : [60, 48];
  w = Math.max(40, Math.min(80, Math.round(num(spec.hints?.width) ?? w))); h = Math.max(30, Math.min(64, Math.round(num(spec.hints?.height) ?? h)));
  const mapId = prepareStreetMap(run, spec, targetMap(run, spec, previous), w, h, warnings);
  if (!mapId) return { ok: false, mapIds: [], summary: "modern_city 맵을 만들지 못했다", warnings, missingArt: missing, calls: run.calls.slice(first) };
  const shops = [...new Set(SHOP_WORDS.filter(([re]) => has(text, re)).map(([, s]) => s))];
  if (/subway|지하철|전철|역/iu.test(text)) warnings.push("지하철 입구 계단은 거리에 서지만 승강장은 house(지하철역)로 따로 지어 잇는다");
  const baseSeed = Math.max(0, Math.floor(num(spec.hints?.seed) ?? prev?.seed ?? (spec.salt ?? 0) % 9973));
  let res = run.call("compose_modern_city_street", { mapId, seed: baseSeed, korean: true, replace: true, ...(shops.length ? { shops } : {}) });
  let seed = baseSeed;
  for (let k = 1; !res.ok && k <= 6; k++) { seed = baseSeed + k; res = run.call("compose_modern_city_street", { mapId, seed, korean: true, replace: true, ...(shops.length ? { shops } : {}) }); }
  if (!res.ok) return { ok: false, mapIds: [mapId], summary: `한국 거리 짓기 실패: ${res.summary}`, warnings: [...warnings, ...(res.issues ?? []).map((i) => i.message)], missingArt: missing, calls: run.calls.slice(first), state: prev };
  warnings.push(...(res.warnings ?? []));
  const data = (res.data ?? {}) as { start?: { x: number; y: number }; buildings?: { name: string; program: string | null }[] };
  const start = data.start;
  const built = (data.buildings ?? []).map((b) => b.name);
  for (const s of shops) if (!built.some((b) => b.includes(s.slice(0, 2)))) missing.push(`${s}(거리 구성기가 이 크기 거리에 못 세움)`);
  return {
    ok: true, mapIds: [mapId], ...(start ? { entrance: { mapId, ...start } } : {}),
    summary: `${spec.name}: 한국 도시 거리 ${w}×${h}(seed ${seed}) — 건물 ${built.length}채${built.length ? `: ${built.slice(0, 8).join(" · ")}` : ""}. 건물 문은 그 실내(house kr-modern)와 link_modern_city_interior 로 잇는다`,
    warnings, missingArt: missing, calls: run.calls.slice(first), state: { seed } satisfies KrState,
  };
}

function buildHouse(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const warnings: string[] = [];
  const missing: string[] = [];
  const prev = previous?.result.state as KrState | undefined;
  // 이름 낱말이 먼저: 「카페 온기」에 방 종류 ldk 가 붙어 와도 카페다(G9).
  const program = typeof spec.hints?.program === "string" ? spec.hints.program
    : PROGRAM_RULES.find(([re]) => has(spec.name, re))?.[1] ?? PROGRAM_RULES.find(([re]) => has(textOf(spec), re))?.[1] ?? "apartment";
  const seed = Math.max(1, Math.floor(num(spec.hints?.seed) ?? prev?.seed ?? 1 + (spec.salt ?? 0) % 9973));
  for (const z of spec.zones ?? []) for (const a of z.anchors ?? []) missing.push(`${a}(주인공 물건 지정은 예제 구성에서 못 함 — 견본 가구 한 벌)`);
  if ((spec.floors ?? 1) >= 2) missing.push("위층(한국 도시 실내는 한 층씩 — 위층은 따로 지어 잇는다)");
  const target = targetMap(run, spec, previous);
  const base: Record<string, unknown> = { tileset: MODERN_CITY_ID, name: spec.name, layout: { program, seed }, ...(target ? { mapId: target, replace: true } : {}) };
  let res = run.call("build_hand_interior_room", base);
  if (!res.ok && target) res = run.call("build_hand_interior_room", { ...base, mapId: undefined, replace: undefined });
  if (!res.ok) return { ok: false, mapIds: [], summary: `한국 도시 실내 짓기 실패: ${res.summary}`, warnings, missingArt: missing, calls: run.calls.slice(first), state: prev };
  warnings.push(...(res.warnings ?? []));
  const data = (res.data ?? {}) as Record<string, unknown>;
  const mapId = String(data.mapId);
  const map = run.ctx.project.maps[mapId]!;
  const ent = (Array.isArray(data.entrance) ? data.entrance as { x: number; y: number }[] : [])[0];
  let entrance: { mapId: string; x: number; y: number } | undefined;
  if (ent) {
    const inside = [{ x: ent.x, y: ent.y - 1 }, ent].find((c) => c.y >= 0 && isPassable(run.ctx.project, map, c.x, c.y)) ?? ent;
    entrance = { mapId, ...inside };
    const sp = run.ctx.project.startPos;
    if (run.ctx.project.startMapId === mapId && (!sp || sp.x !== inside.x || sp.y !== inside.y)) run.call("set_start_position", { mapId, x: inside.x, y: inside.y });
  }
  return {
    ok: true, mapIds: [mapId], ...(entrance ? { entrance } : {}),
    summary: `${spec.name}: 한국 도시 실내 ${program} (${num(data.width)}×${num(data.height)}, seed ${seed})`,
    warnings, missingArt: missing, calls: run.calls.slice(first), state: { seed, program } satisfies KrState,
  };
}

export const MODERN_KR_BUILDER: PlaceBuilder = {
  id: "kr-modern",
  accepts: (spec) => (spec.type === "street" || spec.type === "house") && /kr-modern|korea|한국/iu.test(spec.style ?? ""),
  build: (run, spec, previous) => (spec.type === "house" ? buildHouse(run, spec, previous) : buildStreet(run, spec, previous)),
};
